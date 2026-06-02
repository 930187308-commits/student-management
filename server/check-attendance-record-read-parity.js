const { openDatabase, getCollectionFromEntityTable, getAttendanceFromRecordColumns } = require('./db');

function summarize(attendance) {
    const recordCount = attendance.reduce((sum, session) => sum + Object.keys(session.records || {}).length, 0);
    const tempStudentCount = attendance.reduce((sum, session) => sum + (session.temporaryStudents || []).length, 0);
    return {
        sessions: attendance.length,
        records: recordCount,
        temporaryStudents: tempStudentCount
    };
}

function main() {
    openDatabase();
    const fromRawJson = getCollectionFromEntityTable('attendance');
    const fromRecordColumns = getAttendanceFromRecordColumns();
    const same = JSON.stringify(fromRawJson) === JSON.stringify(fromRecordColumns);
    const report = {
        ok: same,
        checkedAt: new Date().toISOString(),
        same,
        rawJson: summarize(fromRawJson),
        recordColumns: summarize(fromRecordColumns)
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
