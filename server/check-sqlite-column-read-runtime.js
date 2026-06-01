const baseUrl = process.env.STUDENT_CONSOLE_URL || 'http://localhost:3000';

async function getJson(path) {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
        throw new Error(`${path} 返回 ${response.status}`);
    }
    return response.json();
}

function countRows(data) {
    const keys = [
        'classes',
        'students',
        'fees',
        'attendance',
        'grades',
        'communications',
        'prospects',
        'communicationTopics',
        'prospectSources',
        'classTypes',
        'gradeOptions'
    ];
    return Object.fromEntries(keys.map(key => [key, (data[key] || []).length]));
}

async function main() {
    const [rawJsonRead, columnRead] = await Promise.all([
        getJson('/api/data-sqlite'),
        getJson('/api/data-sqlite-columns')
    ]);
    const same = JSON.stringify(rawJsonRead) === JSON.stringify(columnRead);
    const report = {
        ok: same,
        baseUrl,
        same,
        rawJsonReadCounts: countRows(rawJsonRead),
        columnReadCounts: countRows(columnRead)
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
