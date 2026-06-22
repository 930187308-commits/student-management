const http = require('node:http');

const BASE_URL = process.env.STUDENT_CONSOLE_URL || 'http://localhost:3000';
const TEST_ID = `op_runtime_check_${Date.now()}`;

function requestJson(path, options = {}) {
    const url = new URL(path, BASE_URL);
    const body = options.body ? JSON.stringify(options.body) : null;
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method: options.method || 'GET',
            headers: {
                'Accept': 'application/json',
                ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
                ...(options.headers || {})
            }
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                const payload = text ? JSON.parse(text) : {};
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    const error = new Error(payload.error || `HTTP ${res.statusCode}`);
                    error.statusCode = res.statusCode;
                    error.payload = payload;
                    reject(error);
                    return;
                }
                resolve({ payload, headers: res.headers, statusCode: res.statusCode });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    const before = await requestJson('/api/operationLogs');
    let updatedAt = before.headers['x-data-updated-at'] || before.payload.updatedAt;
    const beforeCount = before.payload.operationLogs.length;

    const created = await requestJson('/api/operationLogs', {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: {
            item: {
                id: TEST_ID,
                action: 'runtime-check',
                module: '运行检查',
                collectionName: 'operationLogs',
                targetType: 'operationLogs',
                targetId: TEST_ID,
                targetName: '操作日志运行检查',
                summary: '临时写入操作日志运行检查',
                canUndo: false,
                source: 'runtime-check',
                createdAt: new Date().toISOString()
            }
        }
    });
    updatedAt = created.headers['x-data-updated-at'] || created.payload.updatedAt;

    const fetched = await requestJson('/api/operationLogs');
    const existsAfterCreate = fetched.payload.operationLogs.some(item => item.id === TEST_ID);

    const deleted = await requestJson(`/api/operationLogs/${encodeURIComponent(TEST_ID)}`, {
        method: 'DELETE',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = deleted.headers['x-data-updated-at'] || deleted.payload.updatedAt;

    const after = await requestJson('/api/operationLogs');
    const report = {
        ok: created.statusCode === 201 &&
            existsAfterCreate &&
            deleted.payload.deleted?.id === TEST_ID &&
            after.payload.operationLogs.length === beforeCount,
        checkedAt: new Date().toISOString(),
        collection: 'operationLogs',
        beforeCount,
        afterCount: after.payload.operationLogs.length,
        createdStatus: created.statusCode,
        updatedAtSeen: Boolean(updatedAt)
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
