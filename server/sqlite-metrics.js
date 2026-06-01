const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

function readAppState(db) {
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) return {};
    return JSON.parse(row.value);
}

function groupCountsFromRows(rows, fieldName, fallback = '未填写') {
    return rows.reduce((acc, row) => {
        const key = row[fieldName] || fallback;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function groupCountsFromItems(items, fieldName, fallback = '未填写') {
    return items.reduce((acc, item) => {
        const key = item[fieldName] || fallback;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function roundMoney(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function createSqliteMetricsReport(dbPath = config.dbPath) {
    const db = new DatabaseSync(dbPath);
    const classRows = db.prepare('SELECT status, archived, grade FROM classes').all();
    const studentRows = db.prepare('SELECT status, grade FROM students').all();
    const prospectRows = db.prepare('SELECT source, trial_status, deal_status, grade FROM prospects').all();
    const feeRow = db.prepare(`
        SELECT
            COUNT(*) AS totalFees,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidFees,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingFees,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paidAmount,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingAmount,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN hours ELSE 0 END), 0) AS paidHours,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN hours ELSE 0 END), 0) AS pendingHours
        FROM fees
    `).get();
    const attendanceRow = db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
            COUNT(*) AS records,
            COUNT(CASE WHEN status = 1 THEN 1 END) AS presentRecords,
            COUNT(CASE WHEN status = 0 THEN 1 END) AS absentRecords,
            COUNT(CASE WHEN status IS NULL THEN 1 END) AS emptyRecords,
            COALESCE(SUM(consumed_hours), 0) AS consumedHours
        FROM attendance_records
    `).get();
    const otherCounts = {
        grades: db.prepare('SELECT COUNT(*) AS count FROM grades').get().count,
        communications: db.prepare('SELECT COUNT(*) AS count FROM communications').get().count
    };

    return {
        source: 'sqlite_columns',
        counts: {
            classes: classRows.length,
            students: studentRows.length,
            prospects: prospectRows.length,
            fees: Number(feeRow.totalFees || 0),
            attendanceSessions: Number(attendanceRow.sessions || 0),
            attendanceRecords: Number(attendanceRow.records || 0),
            grades: otherCounts.grades,
            communications: otherCounts.communications
        },
        classes: {
            byStatus: groupCountsFromRows(classRows, 'status'),
            archived: classRows.filter(row => row.archived).length,
            byGrade: groupCountsFromRows(classRows, 'grade')
        },
        students: {
            byStatus: groupCountsFromRows(studentRows, 'status'),
            byGrade: groupCountsFromRows(studentRows, 'grade')
        },
        prospects: {
            bySource: groupCountsFromRows(prospectRows, 'source'),
            byTrialStatus: groupCountsFromRows(prospectRows, 'trial_status'),
            byDealStatus: groupCountsFromRows(prospectRows, 'deal_status'),
            byGrade: groupCountsFromRows(prospectRows, 'grade')
        },
        fees: {
            paidFees: Number(feeRow.paidFees || 0),
            pendingFees: Number(feeRow.pendingFees || 0),
            paidAmount: roundMoney(feeRow.paidAmount),
            pendingAmount: roundMoney(feeRow.pendingAmount),
            paidHours: Number(feeRow.paidHours || 0),
            pendingHours: Number(feeRow.pendingHours || 0)
        },
        attendance: {
            sessions: Number(attendanceRow.sessions || 0),
            records: Number(attendanceRow.records || 0),
            presentRecords: Number(attendanceRow.presentRecords || 0),
            absentRecords: Number(attendanceRow.absentRecords || 0),
            emptyRecords: Number(attendanceRow.emptyRecords || 0),
            consumedHours: Number(attendanceRow.consumedHours || 0)
        }
    };
}

function createSnapshotMetricsReport(dbPath = config.dbPath) {
    const db = new DatabaseSync(dbPath);
    const data = readAppState(db);
    const classes = data.classes || [];
    const students = data.students || [];
    const prospects = data.prospects || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const grades = data.grades || [];
    const communications = data.communications || [];
    let attendanceRecords = 0;
    let presentRecords = 0;
    let absentRecords = 0;
    let emptyRecords = 0;
    let consumedHours = 0;

    attendance.forEach(session => {
        Object.values(session.records || {}).forEach(status => {
            attendanceRecords += 1;
            if (status === 1) {
                presentRecords += 1;
                consumedHours += 1;
            } else if (status === 0) {
                absentRecords += 1;
            } else {
                emptyRecords += 1;
            }
        });
    });

    const paidFees = fees.filter(fee => fee.status === 'paid');
    const pendingFees = fees.filter(fee => fee.status === 'pending');

    return {
        source: 'app_state_snapshot',
        counts: {
            classes: classes.length,
            students: students.length,
            prospects: prospects.length,
            fees: fees.length,
            attendanceSessions: attendance.length,
            attendanceRecords,
            grades: grades.length,
            communications: communications.length
        },
        classes: {
            byStatus: groupCountsFromItems(classes, 'status'),
            archived: classes.filter(item => item.archived).length,
            byGrade: groupCountsFromItems(classes, 'grade')
        },
        students: {
            byStatus: groupCountsFromItems(students, 'status'),
            byGrade: groupCountsFromItems(students, 'grade')
        },
        prospects: {
            bySource: groupCountsFromItems(prospects, 'source'),
            byTrialStatus: groupCountsFromItems(prospects, 'trialStatus'),
            byDealStatus: groupCountsFromItems(prospects, 'dealStatus'),
            byGrade: groupCountsFromItems(prospects, 'grade')
        },
        fees: {
            paidFees: paidFees.length,
            pendingFees: pendingFees.length,
            paidAmount: roundMoney(paidFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0)),
            pendingAmount: roundMoney(pendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0)),
            paidHours: paidFees.reduce((sum, fee) => sum + Number(fee.hours || 0), 0),
            pendingHours: pendingFees.reduce((sum, fee) => sum + Number(fee.hours || 0), 0)
        },
        attendance: {
            sessions: attendance.length,
            records: attendanceRecords,
            presentRecords,
            absentRecords,
            emptyRecords,
            consumedHours
        }
    };
}

module.exports = {
    createSqliteMetricsReport,
    createSnapshotMetricsReport
};
