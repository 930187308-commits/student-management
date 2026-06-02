const http = require('node:http');

const BASE_URL = process.env.STUDENT_CONSOLE_URL || 'http://localhost:3000';
const TEST_ID = `runtime_action_${Date.now()}`;

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

function getUpdatedAt(result) {
    return result.headers['x-data-updated-at'] || result.payload.updatedAt;
}

async function main() {
    const initialClasses = await requestJson('/api/classes');
    const initialStudents = await requestJson('/api/students');
    const initialProspects = await requestJson('/api/prospects');
    let updatedAt = getUpdatedAt(initialClasses);
    const beforeCounts = {
        classes: initialClasses.payload.classes.length,
        students: initialStudents.payload.students.length,
        prospects: initialProspects.payload.prospects.length
    };

    const createdProspect = await requestJson('/api/prospects', {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: {
            item: {
                id: `${TEST_ID}_prospect`,
                name: '__runtime_action_prospect__',
                phone: '',
                wechat: '',
                source: 'runtime-check',
                grade: '六年级',
                intent: 'runtime action check',
                trialStatus: 'pending',
                dealStatus: '',
                remark: '',
                createDate: new Date().toISOString().slice(0, 10)
            }
        }
    });
    updatedAt = getUpdatedAt(createdProspect);

    const converted = await requestJson(`/api/actions/prospects/${encodeURIComponent(`${TEST_ID}_prospect`)}/convert`, {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: { teacher: 'runtime-check' }
    });
    updatedAt = getUpdatedAt(converted);
    const createdStudentId = converted.payload.student.id;

    const deletedStudent = await requestJson(`/api/students/${encodeURIComponent(createdStudentId)}`, {
        method: 'DELETE',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(deletedStudent);
    const deletedProspect = await requestJson(`/api/prospects/${encodeURIComponent(`${TEST_ID}_prospect`)}`, {
        method: 'DELETE',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(deletedProspect);

    const createdClass = await requestJson('/api/classes', {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: {
            item: {
                id: `${TEST_ID}_class`,
                name: '__runtime_action_class__',
                grade: '六年级',
                classType: 'runtime-check',
                schedule: 'runtime-check',
                semester: 'runtime-check',
                maxStudents: 10,
                status: 'forming',
                plannedSessions: 1,
                summerSchedule: ''
            }
        }
    });
    updatedAt = getUpdatedAt(createdClass);

    const finished = await requestJson(`/api/actions/classes/${encodeURIComponent(`${TEST_ID}_class`)}/finish`, {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt },
        body: { markStudentsRenewalPending: false }
    });
    updatedAt = getUpdatedAt(finished);

    const archived = await requestJson(`/api/actions/classes/${encodeURIComponent(`${TEST_ID}_class`)}/archive`, {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(archived);

    const unarchived = await requestJson(`/api/actions/classes/${encodeURIComponent(`${TEST_ID}_class`)}/unarchive`, {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(unarchived);

    const reArchived = await requestJson(`/api/actions/classes/${encodeURIComponent(`${TEST_ID}_class`)}/archive`, {
        method: 'POST',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(reArchived);

    const deletedClass = await requestJson(`/api/actions/classes/${encodeURIComponent(`${TEST_ID}_class`)}`, {
        method: 'DELETE',
        headers: { 'X-Base-Data-Updated-At': updatedAt }
    });
    updatedAt = getUpdatedAt(deletedClass);

    const healthDryRun = await requestJson('/api/actions/data-health/clean-safe', {
        method: 'POST',
        body: { dryRun: true }
    });

    const finalClasses = await requestJson('/api/classes');
    const finalStudents = await requestJson('/api/students');
    const finalProspects = await requestJson('/api/prospects');
    const afterCounts = {
        classes: finalClasses.payload.classes.length,
        students: finalStudents.payload.students.length,
        prospects: finalProspects.payload.prospects.length
    };
    const countRestored = JSON.stringify(beforeCounts) === JSON.stringify(afterCounts);
    const report = {
        ok: countRestored && converted.payload.student && finished.payload.class?.status === 'finished' && archived.payload.class?.archived === true && unarchived.payload.class?.archived === false && reArchived.payload.class?.archived === true && deletedClass.payload.removedAttendance === 0 && healthDryRun.payload.dryRun === true,
        checkedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        beforeCounts,
        afterCounts,
        countRestored,
        healthDryRun: {
            removedAttendance: healthDryRun.payload.removedAttendance,
            removedFees: healthDryRun.payload.removedFees,
            removedRecordRefs: healthDryRun.payload.removedRecordRefs
        }
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main().catch(error => {
    console.error(error.message);
    if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
    process.exit(1);
});
