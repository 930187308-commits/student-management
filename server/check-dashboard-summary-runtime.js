const { DatabaseSync } = require('node:sqlite');
const config = require('./config');
const { createDashboardSummary, createDashboardSummaryFromData } = require('./sqlite-metrics');

function readAppState() {
    const db = new DatabaseSync(config.dbPath);
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    return row ? JSON.parse(row.value) : {};
}

function comparable(summary) {
    const { source, ...rest } = summary;
    return rest;
}

function main() {
    const fromSnapshot = comparable(createDashboardSummaryFromData(readAppState()));
    const fromSqlite = comparable(createDashboardSummary());
    const same = JSON.stringify(fromSnapshot) === JSON.stringify(fromSqlite);
    const report = {
        ok: same,
        checkedAt: new Date().toISOString(),
        same,
        snapshot: fromSnapshot,
        sqlite: fromSqlite
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
