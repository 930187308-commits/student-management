const { openDatabase, getData, getDataFromEntityColumns } = require('./db');
const { createDataHealthReportFromData, summarizeDataHealthReport } = require('./data-health');

function main() {
    openDatabase();
    const snapshot = summarizeDataHealthReport(createDataHealthReportFromData(getData()));
    const sqlite = summarizeDataHealthReport(createDataHealthReportFromData(getDataFromEntityColumns()));
    const same = JSON.stringify(snapshot) === JSON.stringify(sqlite);
    const report = {
        ok: same,
        checkedAt: new Date().toISOString(),
        same,
        snapshot,
        sqlite
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
