const fs = require('node:fs');
const path = require('node:path');
const { createBackup } = require('./db');
const { listResource, upsertResource } = require('./knowledge-service');
const { generateRawAIText } = require('./ai-service');

const DEFAULT_OBSIDIAN_VAULT = '/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台';
const SUPPORTED_TEXT_EXTENSIONS = new Set(['.md', '.txt']);

function slug(text) {
    return String(text || '')
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 100) || 'item';
}

function normalizeText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
}

function stripMarkdownTitle(text) {
    const first = normalizeText(text).split('\n').find(line => line.trim());
    return first ? first.replace(/^#+\s*/, '').trim() : '';
}

function safeTitleFromPath(filePath) {
    return path.basename(filePath || '', path.extname(filePath || '')) || '未命名资料';
}

function ensureSupportedTextFile(filePath) {
    const ext = path.extname(filePath || '').toLowerCase();
    if (!SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
        const error = new Error('第一阶段只支持 .md 和 .txt 文件，Word/PDF/图片请先复制文本后粘贴导入。');
        error.statusCode = 400;
        throw error;
    }
}

function readTextFile(filePath) {
    const resolved = path.resolve(String(filePath || ''));
    ensureSupportedTextFile(resolved);
    if (!fs.existsSync(resolved)) {
        const error = new Error(`文件不存在：${resolved}`);
        error.statusCode = 404;
        throw error;
    }
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
        const error = new Error(`不是文件：${resolved}`);
        error.statusCode = 400;
        throw error;
    }
    return {
        filePath: resolved,
        rawText: normalizeText(fs.readFileSync(resolved, 'utf8'))
    };
}

function scanTextFiles(rootPath) {
    const root = path.resolve(String(rootPath || ''));
    if (!fs.existsSync(root)) {
        const error = new Error(`文件夹不存在：${root}`);
        error.statusCode = 404;
        throw error;
    }
    const stat = fs.statSync(root);
    if (!stat.isDirectory()) {
        const error = new Error(`不是文件夹：${root}`);
        error.statusCode = 400;
        throw error;
    }
    const files = [];
    function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            if (entry.name.startsWith('.')) return;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                return;
            }
            if (entry.isFile() && SUPPORTED_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                files.push(fullPath);
            }
        });
    }
    walk(root);
    return { root, files: files.sort() };
}

function stripHtmlTags(value) {
    return String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function htmlTitle(html) {
    const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return stripHtmlTags(match?.[1] || '');
}

async function fetchUrlText(url) {
    const cleanUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
        const error = new Error('请输入 http 或 https 开头的网页地址。');
        error.statusCode = 400;
        throw error;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(cleanUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 StudentAIConsole/1.0' },
            signal: controller.signal
        });
        if (!response.ok) {
            const error = new Error(`网页读取失败：HTTP ${response.status}`);
            error.statusCode = 502;
            throw error;
        }
        const html = await response.text();
        return {
            title: htmlTitle(html),
            rawText: normalizeText(stripHtmlTags(html)).slice(0, 60000)
        };
    } finally {
        clearTimeout(timer);
    }
}

async function generateKnowledgeSummary({ title = '', rawText = '' } = {}) {
    const text = normalizeText(rawText);
    if (!text) return '';
    const fallback = fallbackKnowledgeSummary({ title, rawText: text });
    try {
        const result = await generateRawAIText({
            system: '你是教培资料整理助手。请把资料整理成简洁、可检索、可给 AI 引用的摘要，不要编造原文没有的信息。',
            user: [
                `资料标题：${title || '未命名资料'}`,
                '请用 150-300 字输出，结构固定为：',
                '核心结论：',
                '适用场景：',
                '关键提醒：',
                '',
                '资料原文：',
                text.slice(0, 12000)
            ].join('\n'),
            temperature: 0.2,
            timeoutMs: 30000
        });
        return normalizeText(result).slice(0, 1600) || fallback;
    } catch {
        return fallback;
    }
}

function fallbackKnowledgeSummary({ title = '', rawText = '' } = {}) {
    const text = normalizeText(rawText);
    if (!text) return '';
    const sentences = text
        .replace(/\n+/g, ' ')
        .split(/(?<=[。！？；;.!?])\s*/)
        .map(item => item.trim())
        .filter(Boolean);
    const excerpt = (sentences.length ? sentences.slice(0, 4).join('') : text.slice(0, 260)).slice(0, 360);
    return [
        `核心结论：${title ? `${title}。` : ''}${excerpt}`,
        '适用场景：可作为 AI 对话引用的背景资料。',
        '关键提醒：该摘要为本地自动兜底生成，建议人工快速核对。'
    ].join('\n');
}

function existingSourceIds() {
    return new Set(listResource('knowledgeSources').map(item => item.id));
}

function sourceIdForFile(prefix, filePath, rootPath = '') {
    let key = rootPath ? path.relative(rootPath, filePath) : filePath;
    if (prefix === 'obsidian-source') key = key.replace(/\.md$/i, '');
    return `${prefix}-${slug(key)}`;
}

async function buildSourceItem(input, options = {}) {
    const rawText = normalizeText(input.rawText || '');
    const title = String(input.title || stripMarkdownTitle(rawText) || input.fallbackTitle || '未命名资料').trim();
    const summary = input.summary !== undefined
        ? normalizeText(input.summary)
        : await generateKnowledgeSummary({ title, rawText });
    return {
        ...(input.id ? { id: input.id } : {}),
        title,
        sourceType: input.sourceType || 'manual',
        category: 'resource',
        subCategory: input.subCategory || '',
        filePath: input.filePath || '',
        sourceUrl: input.sourceUrl || '',
        status: 'active',
        trustLevel: input.trustLevel || 'unknown',
        grade: input.grade || '',
        tags: Array.isArray(input.tags) ? input.tags : [],
        summary,
        rawText: rawText.slice(0, 60000),
        ...options
    };
}

async function importText(input = {}) {
    const rawText = normalizeText(input.rawText || input.text || '');
    if (!rawText) {
        const error = new Error('请先粘贴原文。');
        error.statusCode = 400;
        throw error;
    }
    const item = await buildSourceItem({
        title: input.title,
        fallbackTitle: '粘贴资料',
        sourceType: 'manual',
        grade: input.grade || '',
        tags: input.tags || [],
        filePath: input.filePath || '',
        sourceUrl: input.sourceUrl || '',
        rawText,
        summary: input.summary
    });
    const result = upsertResource('knowledgeSources', item);
    return { source: result.item, created: result.created };
}

async function importUrl(input = {}) {
    const url = String(input.url || input.sourceUrl || '').trim();
    const fetched = await fetchUrlText(url);
    if (!fetched.rawText) {
        const error = new Error('网页未提取到有效正文。');
        error.statusCode = 422;
        throw error;
    }
    const item = await buildSourceItem({
        id: input.id,
        title: input.title || fetched.title || url,
        sourceType: 'url',
        grade: input.grade || '',
        tags: input.tags || [],
        sourceUrl: url,
        rawText: fetched.rawText,
        summary: input.summary
    });
    const result = upsertResource('knowledgeSources', item);
    return { source: result.item, created: result.created };
}

async function importFile(input = {}) {
    const read = readTextFile(input.filePath || input.path);
    const item = await buildSourceItem({
        id: input.id || sourceIdForFile('source-file', read.filePath),
        title: input.title || stripMarkdownTitle(read.rawText) || safeTitleFromPath(read.filePath),
        sourceType: 'file',
        grade: input.grade || '',
        tags: input.tags || [],
        filePath: read.filePath,
        rawText: read.rawText,
        summary: input.summary
    });
    const result = upsertResource('knowledgeSources', item);
    return { source: result.item, created: result.created };
}

async function draftFromUrl(input = {}) {
    const url = String(input.url || input.sourceUrl || '').trim();
    const fetched = await fetchUrlText(url);
    const title = input.title || fetched.title || url;
    return {
        title,
        sourceType: 'url',
        sourceUrl: url,
        rawText: fetched.rawText,
        summary: await generateKnowledgeSummary({ title, rawText: fetched.rawText })
    };
}

async function draftFromFile(input = {}) {
    const read = readTextFile(input.filePath || input.path);
    const title = input.title || stripMarkdownTitle(read.rawText) || safeTitleFromPath(read.filePath);
    return {
        title,
        sourceType: 'file',
        filePath: read.filePath,
        rawText: read.rawText,
        summary: await generateKnowledgeSummary({ title, rawText: read.rawText })
    };
}

function previewFolder(input = {}) {
    const rootPath = input.folderPath || input.vaultPath || input.path;
    const { root, files } = scanTextFiles(rootPath);
    const existing = existingSourceIds();
    const prefix = input.sourceType === 'obsidian' ? 'obsidian-source' : 'source-file';
    const preview = files.slice(0, 20).map(filePath => {
        const id = sourceIdForFile(prefix, filePath, root);
        const rawText = normalizeText(fs.readFileSync(filePath, 'utf8'));
        return {
            id,
            title: stripMarkdownTitle(rawText) || safeTitleFromPath(filePath),
            filePath,
            relativePath: path.relative(root, filePath),
            action: existing.has(id) ? 'update' : 'create'
        };
    });
    const willUpdate = files.filter(filePath => existing.has(sourceIdForFile(prefix, filePath, root))).length;
    return {
        root,
        summary: {
            total: files.length,
            willCreate: files.length - willUpdate,
            willUpdate,
            skipped: 0
        },
        preview
    };
}

async function importFolder(input = {}) {
    const mode = input.mode || (input.apply ? 'apply' : 'dry-run');
    const sourceType = input.sourceType || 'file';
    const scan = previewFolder({ ...input, sourceType });
    if (mode !== 'apply') {
        return { ok: true, mode: 'dry-run', ...scan };
    }
    const backup = createBackup(sourceType === 'obsidian' ? '导入 Obsidian 资料库前自动备份' : '导入资料文件夹前自动备份');
    const existing = existingSourceIds();
    const prefix = sourceType === 'obsidian' ? 'obsidian-source' : 'source-file';
    const results = { total: 0, created: 0, updated: 0, failed: 0, failedDetails: [] };
    const { root, files } = scanTextFiles(input.folderPath || input.vaultPath || input.path);
    for (const filePath of files) {
        results.total += 1;
        try {
            const rawText = normalizeText(fs.readFileSync(filePath, 'utf8'));
            const id = sourceIdForFile(prefix, filePath, root);
            const item = await buildSourceItem({
                id,
                title: stripMarkdownTitle(rawText) || safeTitleFromPath(filePath),
                sourceType,
                grade: input.grade || '',
                tags: sourceType === 'obsidian'
                    ? ['Obsidian', ...(Array.isArray(input.tags) ? input.tags : [])]
                    : (Array.isArray(input.tags) ? input.tags : []),
                filePath,
                rawText
            });
            upsertResource('knowledgeSources', item);
            if (existing.has(id)) results.updated += 1;
            else results.created += 1;
        } catch (error) {
            results.failed += 1;
            results.failedDetails.push(`${filePath}：${error.message}`);
        }
    }
    return { ok: true, mode: 'apply', root, backup, summary: results, preview: scan.preview };
}

function importObsidian(input = {}) {
    return importFolder({
        ...input,
        sourceType: 'obsidian',
        vaultPath: input.vaultPath || input.folderPath || DEFAULT_OBSIDIAN_VAULT
    });
}

module.exports = {
    DEFAULT_OBSIDIAN_VAULT,
    generateKnowledgeSummary,
    draftFromUrl,
    draftFromFile,
    importText,
    importUrl,
    importFile,
    importFolder,
    importObsidian
};
