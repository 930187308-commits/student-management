const http = require('node:http');

const BASE_URL = process.env.STUDENT_CONSOLE_URL || 'http://localhost:3000';
const TEST_ID = `runtime_check_${Date.now()}`;
const INITIAL_CONTACT_LOGS = [
    {
        id: `${TEST_ID}_contact_1`,
        contactDate: '2026-06-01',
        contactType: '微信',
        status: 'pending',
        content: '第一次咨询小升初衔接',
        nextAction: '发送诊断题',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z'
    },
    {
        id: `${TEST_ID}_contact_2`,
        contactDate: '2026-06-03',
        contactType: '电话',
        status: 'done',
        content: '第二次确认试课时间',
        nextAction: '周末试课',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-03T10:00:00.000Z'
    }
];
const PATCHED_CONTACT_LOGS = [
    {
        id: `${TEST_ID}_contact_3`,
        contactDate: '2026-06-05',
        contactType: '试课',
        status: 'trialBooked',
        content: '第三次记录试课反馈',
        nextAction: '跟进是否报名',
        createdAt: '2026-06-05T10:00:00.000Z',
        updatedAt: '2026-06-05T10:00:00.000Z'
    },
    ...INITIAL_CONTACT_LOGS
];

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
    const before = await requestJson('/api/prospects');
    let updatedAt = before.headers['x-data-updated-at'] || before.payload.updatedAt;
    const beforeCount = before.payload.prospects.length;

    const created = await requestJson('/api/prospects', {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: {
            item: {
                id: TEST_ID,
                name: '__runtime_check__',
                wechat: '',
                phone: '',
                source: 'runtime-check',
                grade: '',
                intent: '',
                trialStatus: 'pending',
                dealStatus: 'pending',
                remark: 'temporary runtime check record',
                createDate: new Date().toISOString().slice(0, 10),
                contactLogs: INITIAL_CONTACT_LOGS
            }
        }
    });
    updatedAt = created.headers['x-data-updated-at'] || created.payload.updatedAt;

    const fetched = await requestJson(`/api/prospects/${encodeURIComponent(TEST_ID)}`);
    const patched = await requestJson(`/api/prospects/${encodeURIComponent(TEST_ID)}`, {
        method: 'PATCH',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: {
            item: {
                remark: 'temporary runtime check record updated',
                contactLogs: PATCHED_CONTACT_LOGS
            }
        }
    });
    updatedAt = patched.headers['x-data-updated-at'] || patched.payload.updatedAt;

    const deleted = await requestJson(`/api/prospects/${encodeURIComponent(TEST_ID)}`, {
        method: 'DELETE',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = deleted.headers['x-data-updated-at'] || deleted.payload.updatedAt;

    const after = await requestJson('/api/prospects');
    const report = {
        ok: created.statusCode === 201 &&
            fetched.payload.item?.id === TEST_ID &&
            Array.isArray(fetched.payload.item?.contactLogs) &&
            fetched.payload.item.contactLogs.length === INITIAL_CONTACT_LOGS.length &&
            patched.payload.item?.remark === 'temporary runtime check record updated' &&
            Array.isArray(patched.payload.item?.contactLogs) &&
            patched.payload.item.contactLogs.length === PATCHED_CONTACT_LOGS.length &&
            patched.payload.item.contactLogs[0]?.content === PATCHED_CONTACT_LOGS[0].content &&
            deleted.payload.deleted?.id === TEST_ID &&
            after.payload.prospects.length === beforeCount,
        checkedAt: new Date().toISOString(),
        collection: 'prospects',
        beforeCount,
        afterCount: after.payload.prospects.length,
        createdStatus: created.statusCode,
        contactLogCounts: {
            created: fetched.payload.item?.contactLogs?.length || 0,
            patched: patched.payload.item?.contactLogs?.length || 0
        },
        updatedAtSeen: Boolean(updatedAt)
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
