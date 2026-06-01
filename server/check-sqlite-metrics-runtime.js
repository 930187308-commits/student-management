const { createSqliteMetricsReport, createSnapshotMetricsReport } = require('./sqlite-metrics');

function compareObjects(path, left, right, mismatches) {
    if (typeof left !== typeof right) {
        mismatches.push({ path, snapshot: left, sqlite: right });
        return;
    }
    if (left === null || right === null || typeof left !== 'object') {
        if (left !== right) mismatches.push({ path, snapshot: left, sqlite: right });
        return;
    }
    const keys = new Set([...Object.keys(left), ...Object.keys(right)].filter(key => key !== 'source'));
    [...keys].sort().forEach(key => {
        compareObjects(path ? `${path}.${key}` : key, left[key], right[key], mismatches);
    });
}

function main() {
    const snapshot = createSnapshotMetricsReport();
    const sqlite = createSqliteMetricsReport();
    const mismatches = [];
    compareObjects('', snapshot, sqlite, mismatches);
    const report = {
        ok: mismatches.length === 0,
        checkedAt: new Date().toISOString(),
        mismatchCount: mismatches.length,
        snapshot,
        sqlite,
        mismatches
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
