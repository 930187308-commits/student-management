const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const config = require('./config');
const { getDb } = require('./db');
const { listResource, upsertResource } = require('./knowledge-service');
const { getAiStatus, generateRawAIText } = require('./ai-service');

const IMPORT_ROOT = path.join(config.dataRoot, 'question-imports');
const ASSET_ROOT = path.join(config.dataRoot, 'question-bank-assets');
const BUNDLED_PYTHON = '/Users/bzx/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const EXTRACT_SCRIPT = path.join(__dirname, 'extract-document-text.py');
const QUESTION_IMPORT_AI_TIMEOUT_MS = Number(process.env.QUESTION_IMPORT_AI_TIMEOUT_MS || 15000);
const QUESTION_IMPORT_AI_MAX_AUTO_CANDIDATES = Number(process.env.QUESTION_IMPORT_AI_MAX_AUTO_CANDIDATES || 8);
const QUESTION_IMPORT_AI_CHUNK_SIZE = Math.max(1, Number(process.env.QUESTION_IMPORT_AI_CHUNK_SIZE || 1));

function normalizeProvider(value) {
    return String(value || '').trim().toLowerCase();
}

function getDefaultProviderModel(provider) {
    if (provider === 'deepseek') return 'deepseek-v4-flash';
    if (provider === 'minimax') return 'MiniMax-M2.7-highspeed';
    if (provider === 'openai') return 'gpt-4.1-mini';
    if (provider === 'qwen') return 'qwen-plus';
    return '';
}

function getDefaultProviderBaseUrl(provider) {
    if (provider === 'deepseek') return 'https://api.deepseek.com';
    if (provider === 'minimax') return 'https://api.minimax.io/v1';
    if (provider === 'openai') return 'https://api.openai.com/v1';
    if (provider === 'qwen') return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    return '';
}

function resolveQuestionImportAI(input = {}) {
    const requested = normalizeProvider(input.aiProvider || input.modelProvider || config.ai.questionImport.provider || 'global');
    if (requested === 'rules' || requested === 'rules-only' || requested === 'local') {
        return { provider: 'rules-only', enabled: false, mode: 'rules-only', missing: [] };
    }
    const provider = requested === 'global' || requested === 'auto'
        ? normalizeProvider(config.ai.questionImport.provider || config.ai.provider)
        : requested;
    const useQuestionImportConfig = provider && provider === normalizeProvider(config.ai.questionImport.provider || '');
    const providerConfig = config.ai.providers?.[provider] || {};
    const model = useQuestionImportConfig
        ? (config.ai.questionImport.model || providerConfig.model || getDefaultProviderModel(provider))
        : (providerConfig.model || (provider === normalizeProvider(config.ai.provider) ? (config.ai.model || getDefaultProviderModel(provider)) : getDefaultProviderModel(provider)));
    const apiKey = useQuestionImportConfig
        ? (config.ai.questionImport.apiKey || providerConfig.apiKey || config.ai.apiKey)
        : (providerConfig.apiKey || (provider === normalizeProvider(config.ai.provider) ? config.ai.apiKey : config.ai.questionImport.apiKey));
    const baseUrl = useQuestionImportConfig
        ? (config.ai.questionImport.baseUrl || providerConfig.baseUrl || getDefaultProviderBaseUrl(provider))
        : (providerConfig.baseUrl || (provider === normalizeProvider(config.ai.provider) ? (config.ai.baseUrl || getDefaultProviderBaseUrl(provider)) : getDefaultProviderBaseUrl(provider)));
    const timeoutMs = config.ai.questionImport.timeoutMs || QUESTION_IMPORT_AI_TIMEOUT_MS;
    const missing = [];
    if (!provider || provider === 'disabled') missing.push('QUESTION_IMPORT_AI_PROVIDER');
    if (provider && provider !== 'disabled' && !apiKey) missing.push('QUESTION_IMPORT_AI_API_KEY');
    if (provider && provider !== 'disabled' && !model) missing.push('QUESTION_IMPORT_AI_MODEL');
    return {
        provider,
        model,
        apiKey,
        baseUrl,
        timeoutMs,
        enabled: missing.length === 0,
        mode: requested,
        missing
    };
}

function nowIso() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function ensureImportRoot() {
    fs.mkdirSync(IMPORT_ROOT, { recursive: true });
}

function ensureAssetRoot() {
    fs.mkdirSync(ASSET_ROOT, { recursive: true });
}

function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function json(value) {
    return JSON.stringify(value || {});
}

function decodeXmlEntities(text) {
    return String(text || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function normalizeAnswerText(answer = '') {
    let value = String(answer || '').trim().replace(/^答案\s*[:：]\s*/, '').replace(/^故选\s*[:：]?\s*/i, '').trim();
    const letters = value.match(/^([A-D](?:\s*[、,，/]\s*[A-D])*)\s*[。．.]?$/i);
    if (letters) return letters[1].toUpperCase().replace(/\s*[、,，/]\s*/g, '、');
    const compactLetters = value.match(/^([A-D]{2,4})\s*[。．.]?$/i);
    if (compactLetters) return compactLetters[1].toUpperCase().split('').join('、');
    return value;
}

function normalizeSource(input = {}) {
    return {
        title: input.title || input.examName || '',
        sourceType: input.sourceType || '',
        year: input.year || '',
        grade: input.grade || '',
        region: input.region || '',
        districtOrSchool: input.districtOrSchool || '',
        examName: input.examName || input.title || '',
        paperSection: input.paperSection || '',
        questionNo: input.questionNo || '',
        note: input.note || ''
    };
}

function sourceLabel(source = {}) {
    return [
        source.year,
        source.region || source.districtOrSchool,
        source.examName || source.sourceType || source.note
    ].filter(Boolean).join(' ') || '未标来源';
}

function questionNoFromText(text) {
    const m = String(text || '').trim().match(/^(?:第\s*)?(\d{1,3})\s*(?:[．、)]|\.(?!\d))/);
    return m ? (m[1] || '') : '';
}

function stripLeadingQuestionNo(text) {
    return String(text || '')
        .replace(/^\s*(?:第\s*)?\d{1,3}\s*(?:[．、)]|\.(?!\d))\s*/, '')
        .trim();
}

function hasMultipleQuestionStarts(text) {
    const lines = String(text || '').replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
    return lines.filter(line => /^(?:第\s*)?\d{1,3}\s*(?:[．、)]|\.(?!\d))/.test(line)).length > 1;
}

function extractScore(text, fallback = 5) {
    const value = String(text || '');
    const m = value.match(/[（(\[]\s*(\d{1,2})\s*分\s*[）)\]]|本题\s*(\d{1,2})\s*分|(?:^|[，,。；;\s])(\d{1,2})\s*分(?:[，,。；;\s]|$)/);
    return m ? Number(m[1] || m[2] || m[3]) : fallback;
}

function extractImageUrl(text) {
    const m = String(text || '').match(/(?:图片|图|image|img)\s*[:：]\s*(\S+)/i);
    return m ? m[1].trim() : '';
}

function extractImageUrls(text) {
    const urls = [];
    const re = /(?:图片|图|image|img)\s*[:：]\s*(\S+)/ig;
    let match;
    while ((match = re.exec(String(text || '')))) {
        if (match[1] && !urls.includes(match[1].trim())) urls.push(match[1].trim());
    }
    return urls;
}
function roleFromImageLabel(label = '') {
    const value = String(label || '').toUpperCase();
    if (/解析|答案/.test(value)) return 'solution';
    const option = value.match(/[ABCD]/)?.[0];
    if (option) return `option-${option}`;
    return 'stem';
}

function extractImageItems(text) {
    const items = [];
    const re = /(?:^|\n|[；;。]\s*|\s)((?:题干|解析|答案|[ABCD])?\s*(?:图片|图|image|img))\s*[:：]\s*(\S+)/ig;
    let match;
    while ((match = re.exec(String(text || '')))) {
        const url = match[2]?.trim();
        if (!url) continue;
        const role = roleFromImageLabel(match[1]);
        if (items.some(item => item.url === url && item.role === role)) continue;
        items.push({ url, role, optionLabel: role.startsWith('option-') ? role.slice(-1) : '', order: items.length + 1 });
    }
    return items;
}

function stripQuestionMeta(text) {
    let value = String(text || '').replace(/\r/g, '\n');
    const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length > 1 && /数学|试卷|测试|期末|期中|真题|专题|练习|验收卷|评价卷/.test(lines[0]) && lines.slice(1).some(line => /^(?:第\s*)?\d{1,3}\s*[.．、)]/.test(line))) {
        value = lines.slice(1).join('\n');
    }
    return value
        .replace(/^\s*(?:(?:题干|解析|答案|[ABCD])?\s*(?:图片|图|image|img))\s*[:：]\s*\S+\s*$/gim, '')
        .replace(/^\s*(?:第\s*)?\d{1,3}\s*[.．、)]\s*/, '')
        .replace(/[（(\[]\s*\d{1,2}\s*分\s*[）)\]]/g, '')
        .replace(/本题\s*\d{1,2}\s*分/g, '')
        .trim();
}

function parseStatusForCandidate(candidate = {}, usedAI = false, fallbackMessage = '') {
    const warnings = Array.isArray(candidate.aiParseWarnings)
        ? candidate.aiParseWarnings
        : Array.isArray(candidate.warnings) ? candidate.warnings : [];
    if (!usedAI) {
        return {
            parseStatus: fallbackMessage ? 'local-fallback' : 'local-rules',
            parseStatusLabel: fallbackMessage ? '本地规则兜底' : '本地规则',
            fieldWarnings: [...warnings, ...(fallbackMessage ? [fallbackMessage] : [])]
        };
    }
    const lowConfidence = warnings.length || !candidate.answer || !candidate.solution || !candidate.chapter;
    return {
        parseStatus: lowConfidence ? 'ai-partial' : 'ai-success',
        parseStatusLabel: lowConfidence ? 'AI 已解析，需复核' : 'AI 成功',
        fieldWarnings: warnings
    };
}

function withParseStatus(candidate = {}, usedAI = false, fallbackMessage = '') {
    const status = parseStatusForCandidate(candidate, usedAI, fallbackMessage);
    const aiParseWarnings = Array.isArray(candidate.aiParseWarnings) ? candidate.aiParseWarnings : [];
    return {
        ...candidate,
        ...status,
        aiParseWarnings: [...new Set([...aiParseWarnings, ...status.fieldWarnings])],
        warnings: [...new Set([...(candidate.warnings || []), ...status.fieldWarnings])]
    };
}

function splitAnswerSection(text, answerMode = 'auto') {
    if (answerMode === 'inline') return { questionText: String(text || ''), answerText: '' };
    const lines = String(text || '').replace(/\r/g, '\n').split('\n');
    const index = lines.findIndex(line => {
        const value = line.trim();
        return /^\s*(?:参考答案(?:与(?:试题)?解析)?|答案与解析|答案解析|试题解析)\s*[:：]?/.test(value)
            || /^\s*答案\s*[:：]?\s*$/.test(value)
            || /^\s*答案\s*[:：]\s*\d{1,3}\s*[.．、)]/.test(value);
    });
    if (index < 0) return { questionText: String(text || ''), answerText: '' };
    return {
        questionText: lines.slice(0, index).join('\n'),
        answerText: lines.slice(index).join('\n')
    };
}

function parseNumberedFinalSection(text, { normalizeAnswer = false } = {}) {
    const map = {};
    const normalized = String(text || '')
        .replace(/^\s*(?:参考答案|答案与解析|答案解析|答案|解析|解答|讲解)\s*[:：]?/gm, '')
        .replace(/([^\d])(\d{1,3})\s*[.．、)]/g, '$1\n$2.')
        .replace(/^(\d{1,3})\s*[.．、)]/gm, '$1.');
    const re = /(?:^|\n)\s*(\d{1,3})\s*[.．、)]\s*([\s\S]*?)(?=\n\s*\d{1,3}\s*[.．、)]|$)/g;
    let m;
    while ((m = re.exec(normalized))) {
        const value = m[2].trim();
        if (!value) continue;
        map[m[1]] = normalizeAnswer ? normalizeAnswerText(value) : value;
    }
    return map;
}

function parseAnswerMap(answerText) {
    const tableMap = parseAnswerTable(answerText);
    const raw = String(answerText || '').replace(/\r/g, '\n');
    const solutionHeader = raw.match(/\n\s*(?:解析|解答|讲解)\s*[:：]?(?=\s*(?:\n|\d{1,3}\s*[.．、)]))/);
    const answerPart = solutionHeader ? raw.slice(0, solutionHeader.index) : raw;
    const solutionPart = solutionHeader ? raw.slice(solutionHeader.index).replace(/^\s*(?:解析|解答|讲解)\s*[:：]?/m, '') : '';
    const answers = parseNumberedFinalSection(answerPart, { normalizeAnswer: true });
    const solutions = parseNumberedFinalSection(solutionPart);
    const keys = new Set([...Object.keys(tableMap), ...Object.keys(answers), ...Object.keys(solutions)]);
    const map = {};
    keys.forEach(key => {
        map[key] = {
            answer: answers[key] || tableMap[key]?.answer || '',
            solution: solutions[key] || tableMap[key]?.solution || ''
        };
    });
    return map;
}

function parseAnswerTable(answerText) {
    const map = {};
    const lines = String(answerText || '').replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
    for (let index = 0; index < lines.length - 1; index += 1) {
        if (!/^题号\s+/.test(lines[index]) || !/^答案\s+/.test(lines[index + 1])) continue;
        const questionNos = lines[index].replace(/^题号\s+/, '').split(/\s+/).filter(Boolean);
        const answers = lines[index + 1].replace(/^答案\s+/, '').split(/\s+/).filter(Boolean);
        questionNos.forEach((questionNo, answerIndex) => {
            if (answers[answerIndex]) map[questionNo] = { answer: normalizeAnswerText(answers[answerIndex]), solution: '' };
        });
    }
    return map;
}

function parseDetailedAnswerMap(answerText) {
    const map = {};
    const normalized = String(answerText || '').replace(/\r/g, '\n');
    const re = /(?:^|\n)\s*(\d{1,3})\s*[．、)](?!\d)\s*([\s\S]*?)(?=\n\s*\d{1,3}\s*[．、)](?!\d)|$)/g;
    let match;
    while ((match = re.exec(normalized))) {
        const questionNo = match[1];
        const block = match[2].trim();
        if (!questionNo) return;
        const answerMatch = block.match(/【答案】\s*([\s\S]*?)(?=\n?【(?:分析|解答|点评|考点)】|$)/);
        const solutionMatch = block.match(/【解答】\s*([\s\S]*?)(?=\n?【(?:点评|考点|答案|分析)】|$)/);
        if (!answerMatch && !solutionMatch) continue;
        const existing = map[questionNo] || {};
        map[questionNo] = {
            answer: answerMatch ? normalizeAnswerText(answerMatch[1]) : existing.answer || '',
            solution: solutionMatch ? solutionMatch[1].trim() : existing.solution || '',
            rawText: block || existing.rawText || ''
        };
    }
    return map;
}

function mergeAnswerMaps(...maps) {
    return maps.reduce((acc, map) => {
        Object.entries(map || {}).forEach(([key, value]) => {
            acc[key] = {
                ...(acc[key] || {}),
                ...(value || {}),
                answer: value?.answer || acc[key]?.answer || '',
                solution: value?.solution || acc[key]?.solution || '',
                rawText: value?.rawText || acc[key]?.rawText || ''
            };
        });
        return acc;
    }, {});
}

function parsePaperMeta(text, source = {}) {
    const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    const meta = { ...normalizeSource(source) };
    const titleLine = lines.find(line => /数学|试卷|测试|期末|期中|真题|专题|练习/.test(line) && !/^(?:第\s*)?\d{1,3}\s*[.．、)]/.test(line));
    const yearMatch = String(text || '').match(/(20\d{2})(?:\s*[-—~至]\s*20\d{2})?/);
    const gradeMatch = String(text || '').match(/六年级|初一|七年级|初二|八年级|初三|九年级/);
    const regionMatch = String(text || '').match(/(北京|上海|天津|重庆|广东|深圳|广州|佛山|东莞|江苏|浙江|杭州|南京|成都|武汉|长沙|西安|郑州|山东|福建|厦门|福州|河北|河南|湖北|湖南|四川|陕西|辽宁|沈阳|大连|青岛|苏州|无锡|南山|福田|罗湖|宝安|龙岗|龙华|光明|坪山|盐田)(?:市|区|省)?/);
    if (!meta.year && yearMatch) meta.year = yearMatch[1];
    if (gradeMatch && (!meta.grade || meta.grade === '六年级')) meta.grade = gradeMatch[0] === '七年级' ? '初一' : gradeMatch[0] === '八年级' ? '初二' : gradeMatch[0] === '九年级' ? '初三' : gradeMatch[0];
    if (!meta.region && regionMatch) meta.region = regionMatch[0];
    if (!meta.examName && titleLine) meta.examName = titleLine.replace(/^\s*[\-—=]+|[\-—=]+\s*$/g, '').trim();
    if (!meta.title && meta.examName) meta.title = meta.examName;
    if (!meta.examName && meta.title) meta.examName = meta.title;
    return meta;
}

function cleanText(text) {
    return String(text || '')
        .replace(/\r/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function saveExtractedAsset(asset = {}) {
    const fileBase64 = String(asset.dataBase64 || '').replace(/^data:[^,]+,/, '');
    if (!fileBase64) return '';
    const original = path.basename(asset.fileName || `docx-image${asset.extension || '.png'}`).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    const ext = (path.extname(original).toLowerCase() || asset.extension || '.png').replace(/[^.\w]/g, '') || '.png';
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
    if (!allowed.has(ext)) return '';
    ensureAssetRoot();
    const assetId = newId('qbasset');
    const fileName = `${assetId}${ext}`;
    fs.writeFileSync(path.join(ASSET_ROOT, fileName), Buffer.from(fileBase64, 'base64'));
    return `/question-bank-assets/${encodeURIComponent(fileName)}`;
}

function materializeExtractedAssets(parsed = {}) {
    let text = cleanText(parsed.text || '');
    const assets = Array.isArray(parsed.assets) ? parsed.assets : [];
    assets.forEach(asset => {
        const url = saveExtractedAsset(asset);
        if (url && asset.marker) {
            text = text.split(asset.marker).join(`\n图片：${url}\n`);
        }
    });
    return cleanText(text);
}

function runBundledExtractor(filePath) {
    const python = fs.existsSync(BUNDLED_PYTHON) ? BUNDLED_PYTHON : 'python3';
    try {
        const raw = execFileSync(python, [EXTRACT_SCRIPT, filePath], {
            encoding: 'utf8',
            maxBuffer: 50 * 1024 * 1024
        });
        const parsed = JSON.parse(raw || '{}');
        return parsed.ok ? materializeExtractedAssets(parsed) : '';
    } catch {
        return '';
    }
}

function extractDocxText(filePath) {
    const extracted = runBundledExtractor(filePath);
    if (extracted) return extracted;
    try {
        const xml = execFileSync('/usr/bin/unzip', ['-p', filePath, 'word/document.xml'], {
            encoding: 'utf8',
            maxBuffer: 30 * 1024 * 1024
        });
        return cleanText(decodeXmlEntities(
            xml
                .replace(/<\/w:p>/g, '\n')
                .replace(/<w:tab\/>/g, ' ')
                .replace(/<w:br\/>/g, '\n')
                .replace(/<[^>]+>/g, '')
        ));
    } catch {
        return '';
    }
}

function extractLegacyDocText(filePath) {
    try {
        return cleanText(execFileSync('/usr/bin/textutil', ['-convert', 'txt', '-stdout', filePath], {
            encoding: 'utf8',
            maxBuffer: 30 * 1024 * 1024
        }));
    } catch {
        return '';
    }
}

function extractPdfText(filePath) {
    const extracted = runBundledExtractor(filePath);
    if (extracted) return extracted;
    try {
        const raw = execFileSync('/usr/bin/strings', [filePath], {
            encoding: 'utf8',
            maxBuffer: 30 * 1024 * 1024
        });
        const likelyText = raw
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => /[\u4e00-\u9fa5A-Za-z0-9]/.test(line))
            .filter(line => !/^\/|^obj$|^endobj$|^stream$|^endstream$/.test(line))
            .join('\n');
        return cleanText(likelyText);
    } catch {
        return '';
    }
}

function textQuality(text) {
    const value = String(text || '');
    const compact = value.replace(/\s/g, '');
    if (!compact) return { ok: false, reason: 'empty', cjkRatio: 0, symbolRatio: 1 };
    const cjk = (compact.match(/[\u4e00-\u9fa5]/g) || []).length;
    const asciiWord = (compact.match(/[A-Za-z0-9]/g) || []).length;
    const replacement = (compact.match(/[�□]/g) || []).length;
    const noisy = (compact.match(/[^\u4e00-\u9fa5A-Za-z0-9，。！？、；：,.!?;:()[\]（）+\-×÷=<>≤≥\n]/g) || []).length;
    const meaningfulRatio = (cjk + asciiWord) / compact.length;
    const symbolRatio = (replacement + noisy) / compact.length;
    return {
        ok: compact.length >= 80 && meaningfulRatio >= 0.45 && symbolRatio <= 0.35,
        reason: compact.length < 80 ? 'too_short' : meaningfulRatio < 0.45 ? 'low_meaningful_ratio' : symbolRatio > 0.35 ? 'high_symbol_ratio' : '',
        cjkRatio: cjk / compact.length,
        symbolRatio
    };
}

function questionStructureQuality(text, blocks = []) {
    const value = String(text || '');
    const questionStarts = (value.match(/(?:^|\n)\s*\d{1,3}\s*(?:[.．、)]|\n)/g) || []).length;
    const answerMarkers = (value.match(/(?:^|\n)\s*(?:答案|解析)\s*(?:\n|[:：])/g) || []).length;
    const pageMarkers = (value.match(/^--- page \d+ ---$/gm) || []).length;
    const weakSplit = questionStarts >= 8 && blocks.length <= Math.max(2, Math.ceil(questionStarts * 0.25));
    const interleavedPdf = pageMarkers >= 1 && answerMarkers >= questionStarts && weakSplit;
    return {
        ok: !interleavedPdf,
        reason: interleavedPdf ? 'pdf_interleaved_answer_layout' : '',
        questionStarts,
        answerMarkers,
        pageMarkers,
        candidateCount: blocks.length
    };
}

function extractAnswerAndSolution(rawText) {
    const text = String(rawText || '').trim();
    const answerMatch = text.match(/(?:参考答案|答案)[:：]\s*([\s\S]*?)(?=\n\s*(?:解析|解答|讲解)[:：]|$)/);
    const solutionMatch = text.match(/(?:解析|解答|讲解)[:：]\s*([\s\S]*)$/);
    const stem = text
        .replace(/(?:参考答案|答案)[:：][\s\S]*$/m, '')
        .trim();
    return {
        stem: stem || text,
        answer: normalizeAnswerText(answerMatch ? answerMatch[1].trim() : ''),
        solution: solutionMatch ? solutionMatch[1].trim() : ''
    };
}

function inferCandidate(rawText, batchSource = {}) {
    const text = String(rawText || '');
    const grade = batchSource.grade || (/初一|七年级/.test(text) ? '初一'
        : /初二|八年级/.test(text) ? '初二'
            : /初三|九年级|中考/.test(text) ? '初三'
                : /六年级|小升初/.test(text) ? '六年级'
                    : '');
    const chapter = /几何|三角形|圆|面积|角|线段|四边形|长方形|正方形|坐标|点[ABCD]|规律摆图形|图形|周长|轴对称|中心对称|视线|观察物体|正方体展开图|展开图|logo/i.test(text) ? '几何'
        : /函数/.test(text) ? '函数'
            : /方程|代数|未知数|x/.test(text) ? '代数'
                : /应用|行程|工程|浓度|利润|比例|身份证|编码规则|设备尺寸|产品说明书|游客|预订酒店/.test(text) ? '应用题'
                    : /统计|概率|扇形统计图|条形统计图|可能性/.test(text) ? '统计概率'
                        : /计算|质数|合数|倍数|因数|整数|小数|分数|百分数|运算|比|比例尺|正比例|反比例|含盐率|近似数/.test(text) ? '计算'
                            : /求|多少|共有|一共|分到|剩下|还剩|实际距离/.test(text) ? '应用题'
                                : '';
    const questionType = /证明/.test(text) ? '证明题'
        : /选择|A[.．、]|B[.．、]|C[.．、]|D[.．、]|（\s*　*\s*）/.test(text) ? '选择题'
            : /计算题|计算\s*[:：]|我会算|脱式计算|解方程|直接写出得数/.test(text) ? '计算题'
            : /填空|　|____|(?:是|为|等于|填|写出)\s*$/.test(text.trim()) ? '填空题'
                : chapter === '几何' ? '几何题'
                    : chapter === '应用题' ? '应用题'
                        : /（1）|\(1\)|解答以下问题|解决问题/.test(text) ? '综合题'
                            : '';
    const difficulty = /压轴|综合|分类讨论/.test(text) ? '压轴'
        : /提高|拓展|变式/.test(text) ? '提高'
            : /基础/.test(text) ? '基础'
                : '中等';
    const knowledgePoints = ['分数', '比例', '方程', '行程', '工程', '几何', '面积', '函数', '圆', '有理数', '整式', '根式'].filter(k => text.includes(k));
    if (/\\frac|(?:^|[^\w])\d+\/\d+(?:$|[^\w])|[¼½¾⅓⅔⅕⅖⅗⅘]/.test(text) && !knowledgePoints.includes('分数')) knowledgePoints.push('分数');
    if (/图形|观察/.test(text) && chapter === '几何' && !knowledgePoints.includes('图形')) knowledgePoints.push('图形');
    if (/\\sqrt|√/.test(text) && !knowledgePoints.includes('根式')) knowledgePoints.push('根式');
    if (/[xX]\s*[+\-*/=]|方程|解方程/.test(text) && !knowledgePoints.includes('方程')) knowledgePoints.push('方程');
    const warnings = [];
    if (!grade) warnings.push('缺年级');
    if (!chapter) warnings.push('缺章节');
    if (!/(?:参考答案|答案)[:：]/.test(text)) warnings.push('缺答案');
    if (!/(?:解析|解答|讲解)\s*[:：]?/.test(text)) warnings.push('缺解析');
    if (/[□�]/.test(text)) warnings.push('疑似公式损坏');
    if (text.length < 12) warnings.push('题干过短');
    if (text.length > 1400) warnings.push('题干过长，疑似切题错误');

    return {
        grade,
        system: grade === '六年级' ? '小升初' : '校内',
        chapter,
        knowledgePoints,
        questionType,
        difficulty,
        sourceName: sourceLabel(batchSource)
    };
}

function splitCandidates(rawText) {
    const text = cleanText(rawText);
    if (!text) return [];
    const lines = text.split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => !/^--- page \d+ ---$/i.test(line))
        .filter(line => !/^20\d{2}~20\d{2}.*第\s*\d+\s*题$/.test(line))
        .filter(line => !/^[一二三四五六七八九十]+[、．.]\s*(?:我会|选择题|填空题|计算题|应用题|解答题|解决问题|证明题|作图题|判断题)/.test(line));
    const blocks = [];
    let current = [];
    let started = false;
    const boundary = /^(?:例题?|练习|题目)?\s*(?:第\s*)?(\d{1,2}|[一二三四五六七八九十]{1,3})\s*(?:[．、)]|\.(?!\d))|^\d{1,2}\s*[★☆]*$|^\d{1,2}\s+[★☆]+/;
    lines.forEach((line) => {
        if (boundary.test(line)) {
            if (current.length && started) {
                blocks.push(current.join('\n'));
            }
            current = [line];
            started = true;
            return;
        }
        if (!started) {
            return;
        }
        if (boundary.test(line) && current.length) {
            blocks.push(current.join('\n'));
            current = [line];
            return;
        }
        current.push(line);
    });
    if (current.length) blocks.push(current.join('\n'));

    if (blocks.length) {
        return blocks.map(item => item.trim()).filter(item => item.length >= 8);
    }
    if (blocks.length <= 1) {
        return text.split(/\n\s*\n/).map(item => item.trim()).filter(item => item.length >= 8);
    }
    return blocks.map(item => item.trim()).filter(item => item.length >= 8);
}

function normalizeStemForDuplicate(text) {
    return String(text || '')
        .replace(/\s+/g, '')
        .replace(/[，。,.；;：:（）()【】\[\]]/g, '')
        .slice(0, 160);
}

function buildLocalQuestionParse(input = {}) {
    const rawText = cleanText(input.rawText || '');
    const source = parsePaperMeta(rawText, input.source || {});
    const split = splitAnswerSection(rawText, input.answerMode || 'auto');
    const answerMap = mergeAnswerMaps(parseAnswerMap(split.answerText), parseDetailedAnswerMap(split.answerText));
    const localWarnings = [];
    let blocks = splitCandidates(split.questionText);
    const structureQuality = questionStructureQuality(rawText, blocks);
    if (!structureQuality.ok) {
        localWarnings.push('PDF 文本顺序疑似按版面交错，题目、答案、解析混在一起，当前无法可靠切题；建议改用 Word 原文件、OCR 后文本，或复制 PDF 中连续正文后粘贴导入。');
        blocks = [];
    }
    const candidates = blocks.map((block, index) => {
        const parsed = extractAnswerAndSolution(block);
        const questionNo = questionNoFromText(block) || String(index + 1);
        const keyed = answerMap[questionNo] || {};
        const cleanForInfer = stripQuestionMeta(block);
        const suggestions = inferCandidate(`${cleanForInfer}\n${keyed.rawText || ''}`, source);
        const score = extractScore(block, suggestions.difficulty === '压轴' ? 12 : suggestions.difficulty === '提高' ? 8 : 5);
        const imageItems = extractImageItems(block);
        const imageUrls = imageItems.length ? imageItems.map(item => item.url) : extractImageUrls(block);
        const imageUrl = imageUrls[0] || '';
        const stem = stripQuestionMeta(parsed.stem || block);
        const answer = parsed.answer || keyed.answer || '';
        const solution = parsed.solution || keyed.solution || '';
        const warnings = [];
        if (!answer) warnings.push('缺答案');
        if (!solution) warnings.push('缺解析');
        if (hasMultipleQuestionStarts(block)) warnings.push('疑似合并多题');
        if (/如图|图中|下图/.test(block) && !imageUrl) warnings.push('含图但无附件');
        return withParseStatus({
            rawText: block,
            questionNo,
            stem,
            answer,
            solution,
            grade: suggestions.grade || source.grade || '',
            chapter: suggestions.chapter || '',
            questionType: suggestions.questionType || '',
            difficulty: suggestions.difficulty || '中等',
            knowledgePoints: suggestions.knowledgePoints || [],
            score,
            imageUrl,
            images: imageItems.length ? imageItems : imageUrls.map((url, imageIndex) => ({ url, role: 'stem', order: imageIndex + 1 })),
            source: { ...source, questionNo },
            aiParseWarnings: warnings,
            answerConfidence: answer ? 0.68 : 0
        }, false);
    });
    return {
        paperMeta: source,
        candidates,
        warnings: candidates.length ? localWarnings : [...localWarnings, '未能切分出候选题，请检查文本是否包含题号'],
        usedAI: false,
        fallbackUsed: true
    };
}

function parseAiJson(text) {
    const value = String(text || '').trim();
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1].trim() : value.slice(value.indexOf('{'), value.lastIndexOf('}') + 1);
    return JSON.parse(jsonText || value);
}

function normalizeAiParseResult(parsed = {}, input = {}) {
    const rawText = cleanText(input.rawText || '');
    const local = buildLocalQuestionParse(input);
    const paperMeta = parsePaperMeta(rawText, { ...local.paperMeta, ...(parsed.paperMeta || {}) });
    const aiCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = aiCandidates.map((item, index) => {
        const raw = item.rawText || item.originalText || item.stem || '';
        const questionNo = String(item.questionNo || questionNoFromText(raw) || index + 1);
        const localCandidate = local.candidates.find(c => String(c.questionNo) === questionNo) || {};
        const score = Number(item.score || localCandidate.score || 5);
        const warnings = [
            ...(Array.isArray(item.warnings) ? item.warnings : []),
            ...(Array.isArray(item.aiParseWarnings) ? item.aiParseWarnings : [])
        ].filter(Boolean);
        return withParseStatus({
            rawText: raw || localCandidate.rawText || '',
            questionNo,
            stem: stripLeadingQuestionNo(item.stem || item.questionText || localCandidate.stem || raw),
            answer: normalizeAnswerText(item.answer || localCandidate.answer || ''),
            solution: item.solution || item.analysis || item.explanation || localCandidate.solution || '',
            grade: item.grade || paperMeta.grade || localCandidate.grade || '',
            chapter: item.chapter || localCandidate.chapter || '',
            questionType: item.questionType || item.type || localCandidate.questionType || '',
            difficulty: item.difficulty || localCandidate.difficulty || '中等',
            knowledgePoints: Array.isArray(item.knowledgePoints) && item.knowledgePoints.length ? item.knowledgePoints : (localCandidate.knowledgePoints || []),
            score,
            imageUrl: item.imageUrl || localCandidate.imageUrl || '',
            images: Array.isArray(item.images) ? item.images : (localCandidate.images || []),
            source: { ...paperMeta, questionNo },
            aiParseWarnings: warnings,
            answerConfidence: Number(item.answerConfidence || item.confidence || (item.answer ? 0.85 : 0))
        }, true);
    }).filter(item => item.stem && item.stem.trim().length >= 2);
    return {
        paperMeta,
        candidates: candidates.length ? candidates : local.candidates,
        warnings: [
            ...(Array.isArray(parsed.warnings) ? parsed.warnings : []),
            ...(candidates.length ? [] : ['AI 未返回有效候选题，已使用本地规则结果'])
        ],
        usedAI: candidates.length > 0,
        fallbackUsed: candidates.length === 0
    };
}

function buildQuestionParsePrompt(input = {}) {
    return [
        '请把以下数学试卷/题目文本解析成严格 JSON，不要输出 Markdown，不要解释。',
        'JSON 结构：{"paperMeta":{"title":"","year":"","region":"","school":"","grade":"","sourceType":""},"candidates":[{"questionNo":"","stem":"","score":0,"answer":"","solution":"","grade":"","chapter":"","questionType":"","difficulty":"","knowledgePoints":[],"imageUrl":"","images":[{"url":"","role":"stem|option-A|option-B|option-C|option-D|solution","optionLabel":""}],"warnings":[],"answerConfidence":0.0}],"warnings":[]}',
        '要求：',
        '1. 题目在前、答案在后时，必须按题号匹配答案和解析。',
        '2. 保留题干中的公式和选项；不要把答案混入题干。',
        '3. 识别每题分值；若分值来自大题说明，在 warnings 中注明“分值来自大题说明”。',
        '4. 如出现“如图/图中/下图”但没有图片链接，warnings 写“含图但无附件”。',
        '5. 不能确定的字段留空或写 warning，不要编造。',
        '',
        '用户填写来源：',
        JSON.stringify(normalizeSource(input.source || {}), null, 2),
        '',
        `答案位置模式：${input.answerMode === 'inline' ? '每题后跟答案/解析' : input.answerMode === 'final' ? '题目先列出，答案在最后' : '自动判断'}`,
        '',
        '原始文本：',
        cleanText(input.rawText || '').slice(0, 24000)
    ].join('\n');
}

function buildQuestionChunkPrompt({ source, paperMeta, candidates, answerMap }) {
    return [
        '请把下面这一组数学题解析成严格 JSON，不要输出 Markdown，不要解释。',
        'JSON 结构：{"paperMeta":{"title":"","year":"","region":"","school":"","grade":"","sourceType":""},"candidates":[{"questionNo":"","stem":"","score":0,"answer":"","solution":"","grade":"","chapter":"","questionType":"","difficulty":"","knowledgePoints":[],"imageUrl":"","images":[{"url":"","role":"stem|option-A|option-B|option-C|option-D|solution","optionLabel":""}],"warnings":[],"answerConfidence":0.0}],"warnings":[]}',
        '要求：',
        '1. 只解析【题目块】中列出的题，不要新增题号。',
        '2. 若【答案解析块】提供了同题号答案/解析，必须按题号匹配。',
        '3. 保留题干公式和选项，不要把答案解析混入题干。',
        '4. 识别分值；不能确定的字段留空或写 warning，不要编造。',
        '',
        '用户填写来源：',
        JSON.stringify(normalizeSource(source || {}), null, 2),
        '',
        '已识别试卷信息：',
        JSON.stringify(paperMeta || {}, null, 2),
        '',
        '【题目块】',
        candidates.map(c => `题号 ${c.questionNo}\n${c.rawText}`).join('\n\n---\n\n'),
        '',
        '【答案解析块】',
        candidates.map(c => {
            const paired = answerMap[String(c.questionNo)] || {};
            return paired.rawText ? `题号 ${c.questionNo}\n${paired.rawText}` : '';
        }).filter(Boolean).join('\n\n---\n\n') || '无'
    ].join('\n');
}

function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks;
}

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let cursor = 0;
    async function worker() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await mapper(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

async function parseQuestionImportInChunks(input, local) {
    const ai = resolveQuestionImportAI(input);
    const rawText = cleanText(input.rawText || '');
    const split = splitAnswerSection(rawText, input.answerMode || 'auto');
    const answerMap = mergeAnswerMaps(parseAnswerMap(split.answerText), parseDetailedAnswerMap(split.answerText));
    const paperMeta = parsePaperMeta(rawText, { ...local.paperMeta, ...(input.source || {}) });
    const chunks = chunkArray(local.candidates, QUESTION_IMPORT_AI_CHUNK_SIZE);
    const warnings = [];
    let aiChunkCount = 0;
    const parsedChunks = await mapWithConcurrency(chunks, 2, async (chunk, index) => {
        try {
            const result = await generateRawAIText({
                system: '你是数学试卷结构化解析助手。你只输出严格 JSON，不能输出解释、Markdown 或思考过程。',
                user: buildQuestionChunkPrompt({
                    source: input.source || {},
                    paperMeta,
                    candidates: chunk,
                    answerMap
                }),
                temperature: 0.03,
                timeoutMs: ai.timeoutMs,
                provider: ai.provider,
                model: ai.model,
                baseUrl: ai.baseUrl,
                apiKey: ai.apiKey,
                jsonMode: ai.provider === 'deepseek'
            });
            const normalized = normalizeAiParseResult(parseAiJson(result), {
                rawText: chunk.map(c => c.rawText).join('\n\n'),
                source: paperMeta
            });
            aiChunkCount += 1;
            const byQuestionNo = new Map(normalized.candidates.map(candidate => [String(candidate.questionNo), candidate]));
            return chunk.map(localCandidate => {
                const parsed = byQuestionNo.get(String(localCandidate.questionNo));
                if (parsed) return withParseStatus({ ...localCandidate, ...parsed, rawText: localCandidate.rawText || parsed.rawText }, true);
                const message = `第 ${localCandidate.questionNo} 题 AI 未返回有效结构，已使用本地规则`;
                warnings.push(message);
                return withParseStatus(localCandidate, false, message);
            });
        } catch (error) {
            const first = chunk[0]?.questionNo || index * 8 + 1;
            const last = chunk[chunk.length - 1]?.questionNo || first;
            const message = first === last
                ? `第 ${first} 题 AI 解析失败，已使用本地规则：${error.message}`
                : `第 ${first}-${last} 题 AI 分块解析失败，已使用本地规则：${error.message}`;
            warnings.push(message);
            return chunk.map(candidate => withParseStatus(candidate, false, message));
        }
    });
    return {
        paperMeta,
        candidates: parsedChunks.flat(),
        warnings,
        usedAI: aiChunkCount > 0,
        fallbackUsed: aiChunkCount === 0
    };
}

async function parseQuestionImportWithAI(input = {}) {
    const status = resolveQuestionImportAI(input);
    const local = buildLocalQuestionParse(input);
    const requestedProvider = normalizeProvider(input.aiProvider || input.provider || input.modelProvider || '');
    if (!status.enabled || input.parseMode === 'rules-only' || status.provider === 'rules-only' || ['rules', 'rules-only', 'local'].includes(requestedProvider)) {
        return {
            ...local,
            warnings: [...local.warnings, status.provider === 'rules-only' ? '已使用本地规则解析' : `题库导入 AI 未启用，已使用本地规则解析：${status.missing.join('、')}`],
            usedAI: false,
            fallbackUsed: true
        };
    }
    try {
        const rawText = cleanText(input.rawText || '');
        if (local.candidates.length > QUESTION_IMPORT_AI_MAX_AUTO_CANDIDATES || rawText.length > 6000) {
            return await parseQuestionImportInChunks(input, local);
        }
        const result = await generateRawAIText({
            system: '你是数学试卷结构化解析助手。你只输出严格 JSON，不能输出解释、Markdown 或思考过程。',
            user: buildQuestionParsePrompt(input),
            temperature: 0.05,
            timeoutMs: status.timeoutMs,
            provider: status.provider,
            model: status.model,
            baseUrl: status.baseUrl,
            apiKey: status.apiKey,
            jsonMode: status.provider === 'deepseek'
        });
        const normalized = normalizeAiParseResult(parseAiJson(result), input);
        return {
            ...normalized,
            warnings: normalized.warnings,
            usedAI: true,
            fallbackUsed: false
        };
    } catch (error) {
        return {
            ...local,
            warnings: [...local.warnings, `真实 AI 解析失败，已回退本地规则：${error.message}`],
            usedAI: false,
            fallbackUsed: true
        };
    }
}

function saveQuestionBankAsset(input = {}) {
    const fileBase64 = String(input.fileBase64 || '').replace(/^data:[^,]+,/, '');
    if (!fileBase64) {
        const error = new Error('缺少图片内容');
        error.statusCode = 400;
        throw error;
    }
    const buffer = Buffer.from(fileBase64, 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
        const error = new Error('图片大小需在 8MB 以内');
        error.statusCode = 400;
        throw error;
    }
    const original = path.basename(input.fileName || 'question-image.png').replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
    const ext = (path.extname(original).toLowerCase() || '.png').replace(/[^.\w]/g, '') || '.png';
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
    if (!allowed.has(ext)) {
        const error = new Error('仅支持 png/jpg/jpeg/gif/webp/svg 图片');
        error.statusCode = 400;
        throw error;
    }
    ensureAssetRoot();
    const assetId = newId('qbasset');
    const fileName = `${assetId}${ext}`;
    const filePath = path.join(ASSET_ROOT, fileName);
    fs.writeFileSync(filePath, buffer);
    return {
        assetId,
        fileName,
        filePath,
        url: `/question-bank-assets/${encodeURIComponent(fileName)}`
    };
}

function findDuplicateQuestion(stem) {
    const needle = normalizeStemForDuplicate(stem);
    if (!needle || needle.length < 10) return '';
    const questions = listResource('questionItems');
    const found = questions.find(question => {
        const hay = normalizeStemForDuplicate(question.stem);
        return hay === needle || (needle.length > 24 && (hay.includes(needle) || needle.includes(hay)));
    });
    return found?.id || '';
}

function rowToBatch(row) {
    return {
        id: row.id,
        inputType: row.input_type,
        originalFileName: row.original_file_name || '',
        originalFilePath: row.original_file_path || '',
        extractedTextPath: row.extracted_text_path || '',
        rawText: row.raw_text || '',
        source: parseJson(row.source_json, {}),
        status: row.status || '',
        summary: parseJson(row.summary_json, {}),
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || ''
    };
}

function rowToCandidate(row) {
    return {
        id: row.id,
        batchId: row.batch_id,
        candidateIndex: Number(row.candidate_index || 0),
        rawText: row.raw_text || '',
        detectedStem: row.detected_stem || '',
        detectedAnswer: row.detected_answer || '',
        detectedSolution: row.detected_solution || '',
        aiAnswer: row.ai_answer || '',
        aiSolution: row.ai_solution || '',
        aiSuggestions: parseJson(row.ai_suggestions_json, {}),
        source: parseJson(row.source_json, {}),
        sourcePage: row.source_page || '',
        warnings: parseJson(row.warnings_json, []),
        duplicateOf: row.duplicate_of || '',
        status: row.status || 'pending',
        acceptedQuestionId: row.accepted_question_id || '',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || ''
    };
}

function createImportBatch(input = {}) {
    const inputType = input.inputType || (input.fileName ? 'file' : 'text');
    const source = normalizeSource(input.source || {});
    const batchId = newId('qimport');
    const stamp = nowIso();
    ensureImportRoot();
    const batchDir = path.join(IMPORT_ROOT, batchId);
    fs.mkdirSync(batchDir, { recursive: true });

    let originalFileName = input.fileName || '';
    let originalFilePath = '';
    const pastedText = cleanText(input.rawText || '');
    let rawText = pastedText;
    const importWarnings = [];

    if (input.fileBase64 && originalFileName) {
        const safeName = path.basename(originalFileName).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
        originalFileName = safeName;
        originalFilePath = path.join(batchDir, safeName);
        fs.writeFileSync(originalFilePath, Buffer.from(input.fileBase64, 'base64'));
        const ext = path.extname(safeName).toLowerCase();
        if (ext === '.docx') {
            rawText = extractDocxText(originalFilePath);
            if (!rawText) importWarnings.push('Word 文档未提取到有效文本，请复制文本后粘贴导入');
        } else if (ext === '.doc') {
            rawText = extractLegacyDocText(originalFilePath);
            if (!rawText) importWarnings.push('旧版 Word .doc 未提取到有效文本，请另存为 .docx 或复制文本后粘贴导入');
        } else if (ext === '.pdf') {
            rawText = extractPdfText(originalFilePath);
            const quality = textQuality(rawText);
            if (!quality.ok) {
                importWarnings.push('PDF 文本提取质量不足或疑似乱码，已保存原文件；请从 PDF 复制文字粘贴，或 OCR 后粘贴导入');
                rawText = pastedText;
            }
        } else {
            importWarnings.push('当前文件导入支持 .doc/.docx 和可复制文字 PDF');
        }
    }

    const extractedTextPath = path.join(batchDir, 'extracted-text.txt');
    fs.writeFileSync(extractedTextPath, rawText || '', 'utf8');
    const split = splitAnswerSection(rawText, input.answerMode || 'auto');
    const answerMap = mergeAnswerMaps(parseAnswerMap(split.answerText), parseDetailedAnswerMap(split.answerText));
    let blocks = splitCandidates(split.questionText);
    const structureQuality = questionStructureQuality(rawText, blocks);
    if (!structureQuality.ok) {
        importWarnings.push('PDF 文本顺序疑似按版面交错，题目、答案、解析混在一起，当前无法可靠切题；建议改用 Word 原文件、OCR 后文本，或复制 PDF 中连续正文后粘贴导入。');
        blocks = [];
    }
    const database = getDb();
    database.exec('BEGIN IMMEDIATE');
    try {
        database.prepare(`
            INSERT INTO question_import_batches
            (id, input_type, original_file_name, original_file_path, extracted_text_path, raw_text, source_json, status, summary_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            batchId,
            inputType,
            originalFileName,
            originalFilePath,
            extractedTextPath,
            rawText,
            json(source),
            blocks.length ? 'parsed' : 'needs_review',
            json({ totalCandidates: blocks.length, warnings: importWarnings, structureQuality }),
            stamp,
            stamp
        );

        const insertCandidate = database.prepare(`
            INSERT INTO question_import_candidates
            (id, batch_id, candidate_index, raw_text, detected_stem, detected_answer, detected_solution, ai_answer, ai_solution, ai_suggestions_json, source_json, source_page, warnings_json, duplicate_of, status, accepted_question_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        blocks.forEach((block, index) => {
            const parsed = extractAnswerAndSolution(block);
            const questionNo = questionNoFromText(block) || String(index + 1);
            const keyed = answerMap[questionNo] || {};
            const suggestions = inferCandidate(`${block}\n${keyed.rawText || ''}`, source);
            const detectedAnswer = normalizeAnswerText(parsed.answer || keyed.answer || '');
            const detectedSolution = parsed.solution || keyed.solution || '';
            const duplicateOf = findDuplicateQuestion(parsed.stem);
            const candidateWarnings = [
                ...new Set([
                    ...((suggestions.grade || source.grade ? [] : ['缺年级'])),
                    ...((suggestions.chapter ? [] : ['缺章节'])),
                    ...(detectedAnswer ? [] : ['缺答案']),
                    ...(detectedSolution ? [] : ['缺解析']),
                    ...(duplicateOf ? ['疑似重复题'] : []),
                    ...(/[□�]/.test(block) ? ['疑似公式损坏'] : []),
                    ...(block.length > 1400 ? ['疑似切题错误'] : [])
                ])
            ];
            insertCandidate.run(
                newId('qcand'),
                batchId,
                index + 1,
                block,
                parsed.stem,
                detectedAnswer,
                detectedSolution,
                '',
                '',
                json(suggestions),
                json({ ...source, questionNo }),
                '',
                json(candidateWarnings),
                duplicateOf,
                duplicateOf ? 'duplicate' : 'pending',
                null,
                stamp,
                stamp
            );
        });
        database.exec('COMMIT');
    } catch (error) {
        database.exec('ROLLBACK');
        throw error;
    }

    return getImportBatch(batchId);
}

function listImportBatches(limit = 30) {
    return getDb().prepare('SELECT * FROM question_import_batches ORDER BY rowid DESC LIMIT ?').all(Number(limit || 30)).map(rowToBatch);
}

function getImportBatch(id) {
    const batch = getDb().prepare('SELECT * FROM question_import_batches WHERE id = ?').get(id);
    if (!batch) {
        const error = new Error('导入批次不存在');
        error.statusCode = 404;
        throw error;
    }
    const candidates = listImportCandidates({ batchId: id });
    return { ...rowToBatch(batch), candidates };
}

function listImportCandidates(filters = {}) {
    let rows = filters.batchId
        ? getDb().prepare('SELECT * FROM question_import_candidates WHERE batch_id = ? ORDER BY candidate_index ASC, rowid ASC').all(filters.batchId)
        : getDb().prepare('SELECT * FROM question_import_candidates ORDER BY rowid DESC').all();
    let items = rows.map(rowToCandidate);
    if (filters.status) items = items.filter(item => item.status === filters.status);
    return items;
}

function getImportCandidate(id) {
    const row = getDb().prepare('SELECT * FROM question_import_candidates WHERE id = ?').get(id);
    if (!row) {
        const error = new Error('候选题不存在');
        error.statusCode = 404;
        throw error;
    }
    return rowToCandidate(row);
}

function updateImportCandidate(id, patch = {}) {
    const existing = getImportCandidate(id);
    const next = {
        ...existing,
        ...patch,
        aiSuggestions: { ...(existing.aiSuggestions || {}), ...(patch.aiSuggestions || {}) },
        source: patch.source ? normalizeSource(patch.source) : existing.source,
        warnings: Array.isArray(patch.warnings) ? patch.warnings : existing.warnings
    };
    const stamp = nowIso();
    getDb().prepare(`
        UPDATE question_import_candidates
        SET raw_text = ?, detected_stem = ?, detected_answer = ?, detected_solution = ?,
            ai_answer = ?, ai_solution = ?, ai_suggestions_json = ?, source_json = ?,
            source_page = ?, warnings_json = ?, duplicate_of = ?, status = ?, updated_at = ?
        WHERE id = ?
    `).run(
        next.rawText,
        next.detectedStem,
        next.detectedAnswer,
        next.detectedSolution,
        next.aiAnswer,
        next.aiSolution,
        json(next.aiSuggestions),
        json(next.source),
        next.sourcePage || '',
        json(next.warnings),
        next.duplicateOf || '',
        next.status || 'pending',
        stamp,
        id
    );
    return getImportCandidate(id);
}

function ignoreImportCandidate(id) {
    return updateImportCandidate(id, { status: 'ignored' });
}

function deleteImportCandidate(id) {
    const candidate = getImportCandidate(id);
    if (candidate.status === 'accepted') {
        const error = new Error('已入库候选题不能删除，请先处理正式题库记录');
        error.statusCode = 400;
        throw error;
    }
    getDb().prepare('DELETE FROM question_import_candidates WHERE id = ?').run(id);
    return { deleted: candidate };
}

function batchUpdateImportCandidates(input = {}) {
    const ids = Array.isArray(input.ids) ? input.ids.map(String).filter(Boolean) : [];
    if (!ids.length) {
        const error = new Error('请选择候选题');
        error.statusCode = 400;
        throw error;
    }
    const action = input.action || 'update';
    const patch = input.patch || {};
    const results = [];
    ids.forEach((id) => {
        if (action === 'ignore') {
            results.push({ id, candidate: ignoreImportCandidate(id) });
            return;
        }
        if (action === 'delete') {
            results.push({ id, ...deleteImportCandidate(id) });
            return;
        }
        const existing = getImportCandidate(id);
        if (existing.status === 'accepted') {
            results.push({ id, skipped: true, reason: '已入库候选题不参与批量标记' });
            return;
        }
        const nextSuggestions = {
            ...(existing.aiSuggestions || {}),
            ...(patch.grade ? { grade: patch.grade } : {}),
            ...(patch.system ? { system: patch.system } : {}),
            ...(patch.chapter ? { chapter: patch.chapter } : {}),
            ...(patch.knowledgePoints ? { knowledgePoints: patch.knowledgePoints } : {}),
            ...(patch.questionType ? { questionType: patch.questionType } : {}),
            ...(patch.difficulty ? { difficulty: patch.difficulty } : {})
        };
        const nextPatch = {
            aiSuggestions: nextSuggestions,
            ...(patch.source ? { source: patch.source } : {})
        };
        const nextWarnings = new Set(existing.warnings || []);
        if (patch.grade) nextWarnings.delete('缺年级');
        if (patch.chapter) nextWarnings.delete('缺章节');
        nextPatch.warnings = [...nextWarnings];
        results.push({ id, candidate: updateImportCandidate(id, nextPatch) });
    });
    return { results };
}

function buildQualityFlags(candidate, question) {
    return [
        question.answer ? '' : '缺答案',
        question.solution ? '' : '缺解析',
        (question.knowledgePoints || []).length ? '' : '缺知识点',
        question.sourceName ? '' : '缺来源',
        ...(candidate.warnings || []).filter(warning => ['疑似公式损坏', '疑似切题错误', '疑似重复题', '含图但无附件'].includes(warning))
    ].filter(Boolean);
}

function acceptImportCandidate(id, overrides = {}) {
    const candidate = updateImportCandidate(id, overrides);
    const suggestions = candidate.aiSuggestions || {};
    const question = {
        grade: overrides.grade || suggestions.grade || '',
        system: overrides.system || suggestions.system || '校内',
        chapter: overrides.chapter || suggestions.chapter || '',
        knowledgePoints: overrides.knowledgePoints || suggestions.knowledgePoints || [],
        questionType: overrides.questionType || suggestions.questionType || '',
        difficulty: overrides.difficulty || suggestions.difficulty || '中等',
        score: Number(overrides.score || (suggestions.difficulty === '压轴' ? 10 : 5)),
        estimatedMinutes: Number(overrides.estimatedMinutes || (suggestions.difficulty === '压轴' ? 12 : 5)),
        stem: overrides.stem || candidate.detectedStem,
        answer: normalizeAnswerText(overrides.answer !== undefined ? overrides.answer : candidate.detectedAnswer),
        solution: overrides.solution !== undefined ? overrides.solution : candidate.detectedSolution,
        commonMistakes: overrides.commonMistakes || '',
        errorTags: overrides.errorTags || [],
        sourceName: overrides.sourceName || sourceLabel(candidate.source),
        source: candidate.source,
        originText: candidate.rawText,
        aiNotes: [
            '由导入候选题人工确认入库。',
            candidate.aiAnswer ? `AI 答案草稿：${candidate.aiAnswer}` : '',
            candidate.aiSolution ? `AI 解析草稿：${candidate.aiSolution}` : ''
        ].filter(Boolean).join('\n'),
        answerStatus: (overrides.answer || candidate.detectedAnswer) ? '人工已确认' : '未提供',
        importCandidateId: id,
        status: overrides.status || 'active'
    };

    if (!question.stem || !question.grade || !question.chapter) {
        const error = new Error('确认入库至少需要题干、年级、章节');
        error.statusCode = 400;
        throw error;
    }
    question.qualityFlags = buildQualityFlags(candidate, question);
    const result = upsertResource('questionItems', question);
    getDb().prepare(`
        UPDATE question_import_candidates
        SET status = 'accepted', accepted_question_id = ?, updated_at = ?
        WHERE id = ?
    `).run(result.item.id, nowIso(), id);
    return {
        candidate: getImportCandidate(id),
        question: result.item
    };
}

module.exports = {
    createImportBatch,
    listImportBatches,
    getImportBatch,
    listImportCandidates,
    getImportCandidate,
    updateImportCandidate,
    ignoreImportCandidate,
    deleteImportCandidate,
    batchUpdateImportCandidates,
    acceptImportCandidate,
    parseQuestionImportWithAI,
    saveQuestionBankAsset
};
