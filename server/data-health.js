const { getDataFromEntityColumns } = require('./db');

function createDataHealthReportFromData(data) {
    const classes = data.classes || [];
    const students = data.students || [];
    const attendance = data.attendance || [];
    const fees = data.fees || [];
    const classIds = new Set(classes.map(item => item.id));
    const studentIds = new Set(students.map(item => item.id));
    const inactiveStudentIds = new Set(students.filter(item => item.status !== 'active' && item.status !== 'renewalPending').map(item => item.id));
    const paidHours = {};
    const pendingHours = {};
    const feeCounts = {};
    const usedHours = {};

    fees.filter(item => item.status === 'paid').forEach(item => {
        paidHours[item.studentId] = (paidHours[item.studentId] || 0) + Number(item.hours || 0);
    });
    fees.forEach(item => {
        feeCounts[item.studentId] = (feeCounts[item.studentId] || 0) + 1;
        if (item.status === 'pending') {
            pendingHours[item.studentId] = (pendingHours[item.studentId] || 0) + Number(item.hours || 0);
        }
    });
    attendance.forEach(session => {
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (status === 1) usedHours[studentId] = (usedHours[studentId] || 0) + 1;
        });
    });

    const getStudentDetail = (student) => {
        const paid = paidHours[student.id] || 0;
        const pending = pendingHours[student.id] || 0;
        const used = usedHours[student.id] || 0;
        const remaining = paid - used;
        const coveredRemaining = paid + pending - used;
        const cls = classes.find(item => item.id === student.classId);
        return {
            ...student,
            paidHours: paid,
            pendingHours: pending,
            usedHours: used,
            remainingHours: remaining,
            coveredRemainingHours: coveredRemaining,
            className: cls?.name || '未分班',
            feeCount: feeCounts[student.id] || 0,
            suggestedHours: Math.max(used - paid - pending, 1)
        };
    };

    const orphanAttendance = attendance.filter(item => item.classId && !classIds.has(item.classId));
    const orphanFees = fees.filter(item => item.studentId && !studentIds.has(item.studentId));
    const inactiveStudentFees = fees.filter(item => inactiveStudentIds.has(item.studentId));
    let unknownRecordRefs = 0;
    attendance.forEach(session => {
        Object.keys(session.records || {}).forEach(studentId => {
            if (!studentIds.has(studentId)) unknownRecordRefs += 1;
        });
    });
    const emptySessions = attendance.filter(item => Object.keys(item.records || {}).length === 0);
    const negativeRemaining = students.filter(item => (paidHours[item.id] || 0) - (usedHours[item.id] || 0) < 0);
    const missingDebtRecords = students.filter(item => {
        const paid = paidHours[item.id] || 0;
        const pending = pendingHours[item.id] || 0;
        const used = usedHours[item.id] || 0;
        return item.status === 'active' && used > 0 && (feeCounts[item.id] || 0) > 0 && paid + pending < used;
    });
    const activeNoPaid = students.filter(item => item.status === 'active' && (usedHours[item.id] || 0) > 0 && (feeCounts[item.id] || 0) === 0);
    const overCapacity = classes.filter(item => {
        if (item.status !== 'active') return false;
        const count = students.filter(student => student.classId === item.id && student.status === 'active').length;
        return count > Number(item.maxStudents || item.capacity || 10);
    });
    const negativeRemainingDetails = negativeRemaining.map(getStudentDetail)
        .sort((a, b) => a.remainingHours - b.remainingHours);
    const missingDebtDetails = missingDebtRecords.map(getStudentDetail)
        .sort((a, b) => a.coveredRemainingHours - b.coveredRemainingHours);
    const activeNoPaidDetails = activeNoPaid.map(getStudentDetail)
        .sort((a, b) => b.usedHours - a.usedHours || (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN'));

    return {
        source: 'sqlite_columns',
        orphanAttendance,
        orphanFees,
        unknownRecordRefs,
        emptySessions,
        negativeRemaining,
        missingDebtRecords,
        activeNoPaid,
        overCapacity,
        inactiveStudentFees,
        negativeRemainingDetails,
        missingDebtDetails,
        activeNoPaidDetails
    };
}

function summarizeDataHealthReport(report) {
    return {
        orphanAttendance: report.orphanAttendance.length,
        orphanFees: report.orphanFees.length,
        unknownRecordRefs: report.unknownRecordRefs,
        emptySessions: report.emptySessions.length,
        negativeRemaining: report.negativeRemaining.length,
        missingDebtRecords: report.missingDebtRecords.length,
        activeNoPaid: report.activeNoPaid.length,
        overCapacity: report.overCapacity.length,
        inactiveStudentFees: report.inactiveStudentFees.length,
        negativeRemainingDetails: report.negativeRemainingDetails.length,
        missingDebtDetails: report.missingDebtDetails.length,
        activeNoPaidDetails: report.activeNoPaidDetails.length
    };
}

function createDataHealthReport() {
    return createDataHealthReportFromData(getDataFromEntityColumns());
}

module.exports = {
    createDataHealthReport,
    createDataHealthReportFromData,
    summarizeDataHealthReport
};
