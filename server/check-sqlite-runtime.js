const baseUrl = process.env.STUDENT_CONSOLE_URL || 'http://localhost:3000';

async function getJson(path) {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
        throw new Error(`${path} 返回 ${response.status}`);
    }
    return response.json();
}

async function main() {
    const [status, data, sqliteData] = await Promise.all([
        getJson('/api/sqlite/status'),
        getJson('/data'),
        getJson('/api/data-sqlite')
    ]);

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
    const comparisons = Object.fromEntries(keys.map(key => [key, {
        same: JSON.stringify(data[key] || []) === JSON.stringify(sqliteData[key] || []),
        data: (data[key] || []).length,
        sqlite: (sqliteData[key] || []).length
    }]));
    const allSame = Object.values(comparisons).every(row => row.same);
    const ok = Boolean(status.readFullDataFromSqlite && status.ok && status.healthMismatches === 0 && allSame);

    console.log(JSON.stringify({
        ok,
        baseUrl,
        readFullDataFromSqlite: status.readFullDataFromSqlite,
        migrationStatus: status.migrationStatus,
        healthMismatches: status.healthMismatches,
        comparisons
    }, null, 2));

    if (!ok) process.exit(1);
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
