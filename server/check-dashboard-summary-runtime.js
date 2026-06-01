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

function summarize(summary) {
    return {
        activeStudents: summary.activeStudents,
        totalClasses: summary.totalClasses,
        totalRevenue: summary.totalRevenue,
        pendingAmount: summary.pendingAmount,
        totalHours: summary.totalHours,
        usedHours: summary.usedHours,
        absentHours: summary.absentHours,
        remainingHours: summary.remainingHours,
        usageRate: summary.usageRate,
        classOverviewRows: (summary.classOverview || []).length,
        pendingFeeRows: (summary.pendingFees || []).length
    };
}

function main() {
    const fromSnapshot = comparable(createDashboardSummaryFromData(readAppState()));
    const fromSqlite = comparable(createDashboardSummary());
    const same = JSON.stringify(fromSnapshot) === JSON.stringify(fromSqlite);
    const report = {
        ok: same,
        checkedAt: new Date().toISOString(),
        same,
        snapshot: summarize(fromSnapshot),
        sqlite: summarize(fromSqlite)
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
