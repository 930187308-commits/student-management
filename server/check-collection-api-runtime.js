const { openDatabase, getCollection, getDataFromEntityColumns } = require('./db');

const COLLECTIONS = [
    'classes',
    'students',
    'prospects',
    'fees',
    'attendance',
    'grades',
    'communications',
    'communicationTopics',
    'prospectSources',
    'classTypes',
    'gradeOptions'
];

function main() {
    openDatabase();
    const snapshot = getDataFromEntityColumns();
    const rows = COLLECTIONS.map(collectionName => {
        const fromCollectionApi = getCollection(collectionName);
        const fromFullData = snapshot[collectionName] || [];
        return {
            collection: collectionName,
            collectionCount: fromCollectionApi.length,
            fullDataCount: fromFullData.length,
            same: JSON.stringify(fromCollectionApi) === JSON.stringify(fromFullData)
        };
    });
    const mismatches = rows.filter(row => !row.same);
    const report = {
        ok: mismatches.length === 0,
        checkedAt: new Date().toISOString(),
        rows
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
