const crypto = require('node:crypto');
const { getDb } = require('./db');

const TABLE_CONFIG = {
    knowledgeSources: {
        table: 'knowledge_sources',
        idPrefix: 'source',
        listKey: 'sources',
        required: ['title'],
        writable: [
            'title', 'sourceType', 'category', 'subCategory', 'filePath', 'sourceUrl',
            'status', 'trustLevel', 'grade', 'tags', 'summary', 'rawText'
        ],
        columns: {
            id: 'id',
            title: 'title',
            sourceType: 'source_type',
            category: 'category',
            subCategory: 'sub_category',
            filePath: 'file_path',
            sourceUrl: 'source_url',
            status: 'status',
            trustLevel: 'trust_level',
            grade: 'grade',
            tags: 'tags_json',
            summary: 'summary',
            rawText: 'raw_text',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        defaults: {
            sourceType: 'manual',
            category: 'resource',
            status: 'active',
            trustLevel: 'unknown'
        }
    },
    knowledgeChunks: {
        table: 'knowledge_chunks',
        idPrefix: 'chunk',
        listKey: 'chunks',
        required: ['sourceId', 'content'],
        writable: ['sourceId', 'chunkIndex', 'title', 'content', 'summary', 'tags', 'tokenEstimate'],
        columns: {
            id: 'id',
            sourceId: 'source_id',
            chunkIndex: 'chunk_index',
            title: 'title',
            content: 'content',
            summary: 'summary',
            tags: 'tags_json',
            tokenEstimate: 'token_estimate',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        defaults: {
            chunkIndex: 0,
            tokenEstimate: 0
        }
    },
    styleProfiles: {
        table: 'style_profiles',
        idPrefix: 'style',
        listKey: 'profiles',
        required: ['name'],
        writable: ['name', 'description', 'rulesText', 'forbiddenWords', 'preferredPhrases', 'platform', 'isDefault'],
        columns: {
            id: 'id',
            name: 'name',
            description: 'description',
            rulesText: 'rules_text',
            forbiddenWords: 'forbidden_words_json',
            preferredPhrases: 'preferred_phrases_json',
            platform: 'platform',
            isDefault: 'is_default',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        defaults: {
            platform: 'general',
            isDefault: 0
        }
    },
    styleSamples: {
        table: 'style_samples',
        idPrefix: 'sample',
        listKey: 'samples',
        required: ['content'],
        writable: ['profileId', 'title', 'sampleType', 'content', 'quality', 'tags'],
        columns: {
            id: 'id',
            profileId: 'profile_id',
            title: 'title',
            sampleType: 'sample_type',
            content: 'content',
            quality: 'quality',
            tags: 'tags_json',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        defaults: {
            sampleType: 'article',
            quality: 'good'
        }
    },
    questionItems: {
        table: 'question_items',
        idPrefix: 'question',
        listKey: 'questions',
        required: ['stem'],
        writable: [
            'grade', 'system', 'chapter', 'knowledgePoints', 'questionType',
            'difficulty', 'formulaLatex', 'diagramSvg', 'imageUrl', 'estimatedMinutes',
            'score', 'variantGroup', 'originText', 'aiNotes', 'sourceId', 'sourceName', 'stem', 'answer', 'solution',
            'commonMistakes', 'errorTags', 'classType', 'usageCount', 'status', 'remark',
            'subKnowledgePoint', 'source', 'answerStatus', 'qualityFlags', 'importCandidateId', 'internalNo'
        ],
        columns: {
            id: 'id',
            grade: 'grade',
            system: 'system',
            chapter: 'chapter',
            knowledgePoints: 'knowledge_points_json',
            questionType: 'question_type',
            difficulty: 'difficulty',
            formulaLatex: 'formula_latex',
            diagramSvg: 'diagram_svg',
            imageUrl: 'image_url',
            estimatedMinutes: 'estimated_minutes',
            score: 'score',
            variantGroup: 'variant_group',
            originText: 'origin_text',
            aiNotes: 'ai_notes',
            sourceId: 'source_id',
            sourceName: 'source_name',
            stem: 'stem',
            answer: 'answer',
            solution: 'solution',
            commonMistakes: 'common_mistakes',
            errorTags: 'error_tags_json',
            classType: 'class_type',
            usageCount: 'usage_count',
            status: 'status',
            remark: 'remark',
            subKnowledgePoint: 'sub_knowledge_point',
            source: 'source_json',
            answerStatus: 'answer_status',
            qualityFlags: 'quality_flags_json',
            importCandidateId: 'import_candidate_id',
            internalNo: 'internal_no',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        defaults: {
            difficulty: '基础',
            estimatedMinutes: 5,
            score: 5,
            usageCount: 0,
            status: 'draft',
            answerStatus: '未提供',
            qualityFlags: []
        }
    },
    aiContextRefs: {
        table: 'ai_context_refs',
        idPrefix: 'ctxref',
        listKey: 'refs',
        required: ['aiTaskId'],
        writable: ['aiTaskId', 'refType', 'refId', 'title', 'summary'],
        columns: {
            id: 'id',
            aiTaskId: 'ai_task_id',
            refType: 'ref_type',
            refId: 'ref_id',
            title: 'title',
            summary: 'summary',
            createdAt: 'created_at'
        },
        defaults: {
            refType: 'source'
        },
        noUpdatedAt: true
    }
};

function nowIso() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function toJsonArray(value) {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return JSON.stringify([]);
        try {
            const parsed = JSON.parse(trimmed);
            return JSON.stringify(Array.isArray(parsed) ? parsed : [trimmed]);
        } catch {
            return JSON.stringify(trimmed.split(/[,，]/).map(item => item.trim()).filter(Boolean));
        }
    }
    return JSON.stringify([]);
}

function normalizeBoolean(value) {
    return value === true || value === 1 || value === '1' ? 1 : 0;
}

function normalizeValue(key, value) {
    if ((key === 'profileId' || key === 'sourceId' || key === 'aiTaskId') && (value === undefined || value === null || String(value).trim() === '')) {
        return null;
    }
    if (key === 'tags' || key === 'forbiddenWords' || key === 'preferredPhrases' || key === 'knowledgePoints' || key === 'errorTags' || key === 'qualityFlags') {
        return toJsonArray(value);
    }
    if (key === 'source') {
        return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
    }
    if (key === 'isDefault') return normalizeBoolean(value);
    if (key === 'chunkIndex' || key === 'tokenEstimate' || key === 'usageCount' || key === 'estimatedMinutes' || key === 'score') return Number(value || 0);
    return value === undefined || value === null ? '' : String(value);
}

function denormalizeValue(key, value) {
    if (key === 'tags' || key === 'forbiddenWords' || key === 'preferredPhrases' || key === 'knowledgePoints' || key === 'errorTags' || key === 'qualityFlags') {
        return parseJson(value, []);
    }
    if (key === 'source') return parseJson(value, {});
    if (key === 'isDefault') return Boolean(value);
    if (key === 'chunkIndex' || key === 'tokenEstimate' || key === 'usageCount' || key === 'estimatedMinutes' || key === 'score') return Number(value || 0);
    return value ?? '';
}

function getConfig(resourceName) {
    const config = TABLE_CONFIG[resourceName];
    if (!config) {
        const error = new Error(`不支持的知识库资源：${resourceName}`);
        error.statusCode = 404;
        throw error;
    }
    return config;
}

function rowToItem(config, row) {
    const item = {};
    Object.entries(config.columns).forEach(([key, column]) => {
        item[key] = denormalizeValue(key, row[column]);
    });
    return item;
}

function validateItem(config, item) {
    config.required.forEach(key => {
        const value = item[key];
        if (value === undefined || value === null || String(value).trim() === '') {
            const error = new Error(`${key} 不能为空`);
            error.statusCode = 400;
            throw error;
        }
    });
}

function normalizeChunkText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
}

function splitKnowledgeTextIntoChunks(text, maxLength = 1200) {
    const normalized = normalizeChunkText(text);
    if (!normalized) return [];
    const blocks = normalized.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
    const chunks = [];
    let current = '';
    blocks.forEach(block => {
        if (!current) {
            current = block;
            return;
        }
        if ((current + '\n\n' + block).length <= maxLength) {
            current += '\n\n' + block;
            return;
        }
        chunks.push(current);
        current = block;
    });
    if (current) chunks.push(current);
    return chunks.flatMap(chunk => {
        if (chunk.length <= maxLength * 1.3) return [chunk];
        const parts = [];
        for (let i = 0; i < chunk.length; i += maxLength) {
            parts.push(chunk.slice(i, i + maxLength));
        }
        return parts;
    });
}

function estimateTokens(text) {
    const value = String(text || '');
    return Math.ceil(value.length / 2);
}

function buildChunkSummary(content) {
    const text = normalizeChunkText(content).replace(/\n+/g, ' ');
    return text.slice(0, 220);
}

function rebuildChunksForSource(source) {
    if (!source?.id) return { sourceId: '', chunks: 0 };
    const text = normalizeChunkText(source.rawText || source.summary || '');
    const db = getDb();
    db.prepare('DELETE FROM knowledge_chunks WHERE source_id = ?').run(source.id);
    const parts = splitKnowledgeTextIntoChunks(text);
    if (!parts.length) return { sourceId: source.id, chunks: 0 };
    const stamp = nowIso();
    const insert = db.prepare(`
        INSERT INTO knowledge_chunks (id, source_id, chunk_index, title, content, summary, tags_json, token_estimate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tags = Array.isArray(source.tags) ? source.tags : [];
    db.exec('BEGIN');
    try {
        parts.forEach((content, index) => {
            insert.run(
                `${source.id}-chunk-${String(index + 1).padStart(3, '0')}`,
                source.id,
                index,
                `${source.title || '资料'} · 片段 ${index + 1}`,
                content,
                buildChunkSummary(content),
                JSON.stringify(tags),
                estimateTokens(content),
                stamp,
                stamp
            );
        });
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    return { sourceId: source.id, chunks: parts.length };
}

function buildItem(config, input, existing = {}) {
    const stamp = nowIso();
    const item = {
        ...config.defaults,
        ...existing,
        ...input
    };
    item.id = String(input.id || existing.id || newId(config.idPrefix));
    item.createdAt = existing.createdAt || input.createdAt || stamp;
    if (!config.noUpdatedAt) item.updatedAt = stamp;
    return item;
}

function listResource(resourceName, filters = {}) {
    const config = getConfig(resourceName);
    const rows = getDb().prepare(`SELECT * FROM ${config.table} ORDER BY rowid DESC`).all();
    let items = rows.map(row => rowToItem(config, row));
    if (filters.category) items = items.filter(item => item.category === filters.category);
    if (filters.grade) items = items.filter(item => item.grade === filters.grade);
    if (filters.profileId) items = items.filter(item => item.profileId === filters.profileId);
    if (filters.sourceId) items = items.filter(item => item.sourceId === filters.sourceId);
    if (filters.q) {
        const keyword = String(filters.q).toLowerCase();
        items = items.filter(item => JSON.stringify(item).toLowerCase().includes(keyword));
    }
    return items;
}

function getResource(resourceName, id) {
    const config = getConfig(resourceName);
    const row = getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(id);
    if (!row) {
        const error = new Error('记录不存在');
        error.statusCode = 404;
        throw error;
    }
    return rowToItem(config, row);
}

function upsertResource(resourceName, input) {
    const config = getConfig(resourceName);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        const error = new Error('记录必须是对象');
        error.statusCode = 400;
        throw error;
    }
    const existing = input.id ? getDb().prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(String(input.id)) : null;
    const item = buildItem(config, input, existing ? rowToItem(config, existing) : {});
    validateItem(config, item);

    const keys = ['id', ...config.writable, 'createdAt'];
    if (!config.noUpdatedAt) keys.push('updatedAt');
    const columns = keys.map(key => config.columns[key]);
    const placeholders = columns.map(() => '?').join(', ');
    const updateColumns = columns.filter(column => column !== 'id' && column !== 'created_at');
    const updateSql = updateColumns.map(column => `${column} = excluded.${column}`).join(', ');
    const values = keys.map(key => normalizeValue(key, item[key]));

    getDb().prepare(`
        INSERT INTO ${config.table} (${columns.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT(id) DO UPDATE SET ${updateSql}
    `).run(...values);

    if (resourceName === 'styleProfiles' && item.isDefault) {
        getDb().prepare(`UPDATE style_profiles SET is_default = 0 WHERE id <> ?`).run(item.id);
    }

    if (resourceName === 'knowledgeSources') {
        rebuildChunksForSource(getResource(resourceName, item.id));
    }

    return {
        item: getResource(resourceName, item.id),
        created: !existing
    };
}

function deleteResource(resourceName, id) {
    const config = getConfig(resourceName);
    const item = getResource(resourceName, id);
    getDb().prepare(`DELETE FROM ${config.table} WHERE id = ?`).run(id);
    return { deleted: item };
}

function getKnowledgeSummary() {
    const database = getDb();
    const count = table => database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    return {
        sources: count('knowledge_sources'),
        chunks: count('knowledge_chunks'),
        styleProfiles: count('style_profiles'),
        styleSamples: count('style_samples'),
        questions: count('question_items'),
        contextRefs: count('ai_context_refs')
    };
}

function rebuildAllKnowledgeChunks() {
    const sources = listResource('knowledgeSources').filter(source => source.status !== 'archived');
    let chunks = 0;
    sources.forEach(source => {
        chunks += rebuildChunksForSource(source).chunks;
    });
    return { sources: sources.length, chunks };
}

module.exports = {
    TABLE_CONFIG,
    listResource,
    getResource,
    upsertResource,
    deleteResource,
    getKnowledgeSummary,
    rebuildChunksForSource,
    rebuildAllKnowledgeChunks
};
