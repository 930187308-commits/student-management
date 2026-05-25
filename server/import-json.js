const fs = require('node:fs');
const path = require('node:path');
const { openDatabase, setData, createBackup } = require('./db');

function printUsage() {
    console.error('Usage: node server/import-json.js /path/to/backup-or-data.json');
}

function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('导入文件必须是 JSON 对象');
    }

    const candidate = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const requiredArrays = ['classes', 'students', 'fees', 'attendance', 'grades', 'communications'];
    for (const key of requiredArrays) {
        if (!Array.isArray(candidate[key])) {
            throw new Error(`导入数据缺少数组字段：${key}`);
        }
    }

    return candidate;
}

function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        printUsage();
        process.exit(1);
    }

    const absolutePath = path.resolve(inputPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    const nextData = normalizePayload(parsed);

    openDatabase();
    const backup = createBackup('before_json_import');
    const saved = setData(nextData, `import_json:${absolutePath}`);

    console.log(JSON.stringify({
        ok: true,
        importedFrom: absolutePath,
        backup,
        lastModified: saved.lastModified,
        counts: {
            classes: saved.classes.length,
            students: saved.students.length,
            fees: saved.fees.length,
            attendance: saved.attendance.length,
            grades: saved.grades.length,
            communications: saved.communications.length,
            prospects: Array.isArray(saved.prospects) ? saved.prospects.length : 0
        }
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`导入失败：${error.message}`);
    process.exit(1);
}
