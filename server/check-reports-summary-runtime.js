const { getDataFromEntityColumns } = require('./db');
const { createReportsSummary, createReportsSummaryFromData } = require('./sqlite-metrics');

function sanitizeSummary(summary) {
    return {
        monthlyConsumption: summary.monthlyConsumption,
        studentConsumptionSummary: summary.studentConsumptionSummary.map(row => ({
            id: row.id,
            classId: row.classId,
            totalHours: row.totalHours,
            usedHours: row.usedHours,
            absentHours: row.absentHours,
            remainingHours: row.remainingHours,
            consumptionStatus: row.consumptionStatus,
            statusText: row.statusText
        })),
        renewalPendingCount: summary.renewalPendingCount,
        quarterlyStudentDynamics: summary.quarterlyStudentDynamics,
        classAttendanceStats: summary.classAttendanceStats.map(row => ({
            id: row.id,
            rate: row.rate,
            total: row.total
        })),
        sourceDistribution: summary.sourceDistribution,
        schoolDistribution: summary.schoolDistribution,
        reportClassOptions: summary.reportClassOptions.map(row => ({ id: row.id })),
        studentCount: summary.studentCount
    };
}

function main() {
    const data = getDataFromEntityColumns();
    const fromData = sanitizeSummary(createReportsSummaryFromData(data));
    const fromApiLogic = sanitizeSummary(createReportsSummary());
    const same = JSON.stringify(fromData) === JSON.stringify(fromApiLogic);
    const report = {
        ok: same,
        checkedAt: new Date().toISOString(),
        same,
        counts: {
            monthlyRows: fromApiLogic.monthlyConsumption.length,
            studentRows: fromApiLogic.studentConsumptionSummary.length,
            classRows: fromApiLogic.classAttendanceStats.length,
            sourceRows: fromApiLogic.sourceDistribution.length,
            schoolRows: fromApiLogic.schoolDistribution.length
        }
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
