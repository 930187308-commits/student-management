const fs = require('node:fs');
const path = require('node:path');
const { openDatabase, createBackup } = require('./db');
const { upsertResource, listResource } = require('./knowledge-service');

const DEFAULT_VAULT = '/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台';

function printUsage() {
    console.error(`Usage:
  scripts/node.sh server/import-obsidian-knowledge.js [vaultPath] [--dry-run|--apply]

Examples:
  scripts/node.sh server/import-obsidian-knowledge.js --dry-run
  scripts/node.sh server/import-obsidian-knowledge.js "${DEFAULT_VAULT}" --apply`);
}

function slug(text) {
    return String(text || '')
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 80) || 'item';
}

function readMarkdownFiles(root) {
    const files = [];
    function walk(dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
            if (entry.name.startsWith('.')) return;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                files.push(fullPath);
            }
        });
    }
    walk(root);
    return files.sort();
}

function firstNonEmptyLine(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
}

function stripHeading(line) {
    return line.replace(/^#+\s*/, '').trim();
}

function inferImportKind(relativePath) {
    if (relativePath.includes('风格库')) return 'style';
    if (relativePath.includes('题库素材')) return 'question-meta';
    if (relativePath.includes('内容素材')) return 'content';
    if (relativePath.includes('资料库')) return 'resource';
    return 'resource';
}

function extractListAfterHeading(text, headingPattern) {
    const lines = String(text || '').split(/\r?\n/);
    const start = lines.findIndex(line => headingPattern.test(line.trim()));
    if (start < 0) return [];
    const values = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (/^#{1,3}\s+/.test(line)) break;
        const match = line.match(/^[-*]\s+(.+)/);
        if (match) values.push(match[1].trim());
    }
    return values.slice(0, 80);
}

function toBaseItem(filePath, root) {
    const relativePath = path.relative(root, filePath);
    const text = fs.readFileSync(filePath, 'utf8');
    const title = stripHeading(firstNonEmptyLine(text)) || path.basename(filePath, '.md');
    const idBase = slug(relativePath.replace(/\.md$/i, ''));
    return {
        filePath,
        relativePath,
        text,
        title,
        idBase,
        kind: inferImportKind(relativePath)
    };
}

function buildStyleProfile(base) {
    if (!/白老师风格规则|常用表达|禁用词/.test(base.relativePath)) return null;
    const forbiddenWords = extractListAfterHeading(base.text, /禁用词|绝对化承诺|过度营销|过度焦虑/);
    const preferredPhrases = extractListAfterHeading(base.text, /常用表达|建议表达|判断表达|结尾表达/);
    return {
        resource: 'styleProfiles',
        item: {
            id: `obsidian-style-${base.idBase}`,
            name: base.title,
            description: `从 Obsidian 导入：${base.relativePath}`,
            rulesText: base.text.slice(0, 6000),
            forbiddenWords,
            preferredPhrases,
            platform: 'general',
            isDefault: /白老师风格规则/.test(base.relativePath)
        }
    };
}

function buildStyleSample(base) {
    if (!/内容样本/.test(base.relativePath)) return null;
    return {
        resource: 'styleSamples',
        item: {
            id: `obsidian-sample-${base.idBase}`,
            title: base.title,
            sampleType: 'article',
            content: base.text.slice(0, 8000),
            quality: 'good',
            tags: ['Obsidian', '白老师风格']
        }
    };
}

function buildKnowledgeSource(base) {
    const category = base.kind === 'content' ? 'content' : base.kind === 'question-meta' ? 'question' : 'resource';
    const subCategory = base.relativePath.split(path.sep)[0] || '';
    return {
        resource: 'knowledgeSources',
        item: {
            id: `obsidian-source-${base.idBase}`,
            title: base.title,
            sourceType: 'obsidian',
            category,
            subCategory,
            filePath: base.filePath,
            status: 'active',
            trustLevel: 'unknown',
            tags: ['Obsidian', subCategory].filter(Boolean),
            summary: base.text.slice(0, 1200),
            rawText: base.text.slice(0, 8000)
        }
    };
}

function buildImportItems(vaultPath) {
    return readMarkdownFiles(vaultPath).flatMap(filePath => {
        const base = toBaseItem(filePath, vaultPath);
        const items = [];
        const styleProfile = buildStyleProfile(base);
        const styleSample = buildStyleSample(base);
        if (styleProfile) items.push(styleProfile);
        if (styleSample) items.push(styleSample);
        if (!styleProfile || base.kind !== 'style') {
            items.push(buildKnowledgeSource(base));
        }
        return items;
    });
}

function parseArgs(argv) {
    const args = argv.slice(2);
    const apply = args.includes('--apply');
    const dryRun = args.includes('--dry-run') || !apply;
    const vaultPath = args.find(arg => !arg.startsWith('--')) || DEFAULT_VAULT;
    return { vaultPath: path.resolve(vaultPath), apply, dryRun };
}

function main() {
    const { vaultPath, apply, dryRun } = parseArgs(process.argv);
    if (!fs.existsSync(vaultPath)) {
        printUsage();
        throw new Error(`Obsidian 库不存在：${vaultPath}`);
    }

    openDatabase();
    const importItems = buildImportItems(vaultPath);
    const existing = {
        knowledgeSources: new Set(listResource('knowledgeSources').map(item => item.id)),
        styleProfiles: new Set(listResource('styleProfiles').map(item => item.id)),
        styleSamples: new Set(listResource('styleSamples').map(item => item.id))
    };
    const summary = importItems.reduce((acc, entry) => {
        acc[entry.resource] = (acc[entry.resource] || 0) + 1;
        const exists = existing[entry.resource]?.has(entry.item.id);
        acc[exists ? 'willUpdate' : 'willCreate'] += 1;
        return acc;
    }, { knowledgeSources: 0, styleProfiles: 0, styleSamples: 0, willCreate: 0, willUpdate: 0 });

    let backup = null;
    if (apply) {
        backup = createBackup('导入 Obsidian 知识库前自动备份');
        importItems.forEach(entry => upsertResource(entry.resource, entry.item));
    }

    console.log(JSON.stringify({
        ok: true,
        mode: dryRun ? 'dry-run' : 'apply',
        vaultPath,
        backup,
        summary,
        preview: importItems.slice(0, 20).map(entry => ({
            resource: entry.resource,
            id: entry.item.id,
            title: entry.item.title || entry.item.name
        }))
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`导入失败：${error.message}`);
    process.exit(1);
}
