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

function sumPaidFeeHours(fees, studentId) {
    return fees
        .filter(fee => fee.studentId === studentId && fee.status === 'paid')
        .reduce((sum, fee) => sum + Number(fee.hours || 0), 0);
}

function getBestPricePerHour(fees, studentId) {
    const fee = fees.find(item => item.studentId === studentId && item.status === 'paid' && item.pricePerHour);
    return fee ? Number(fee.pricePerHour || 0) : 0;
}

function currentQuarterInfo(now = new Date()) {
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return {
        year: now.getFullYear(),
        quarter,
        startMonth: (quarter - 1) * 3 + 1
    };
}

function createReportsSummaryFromData(data, now = new Date()) {
    const classes = data.classes || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const prospects = data.prospects || [];
    const { year, startMonth } = currentQuarterInfo(now);
    const studentsById = new Map(students.map(student => [student.id, student]));

    const monthlyConsumptionMap = {};
    attendance.forEach(session => {
        const month = String(session.date || '').substring(0, 7);
        if (!month) return;
        if (!monthlyConsumptionMap[month]) monthlyConsumptionMap[month] = { month, amount: 0, sessions: 0 };
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (status !== 1) return;
            monthlyConsumptionMap[month].sessions += 1;
            monthlyConsumptionMap[month].amount += getBestPricePerHour(fees, studentId);
        });
    });

    const studentConsumptionSummary = students
        .filter(student => student.status === 'active')
        .map(student => {
            const totalHours = sumPaidFeeHours(fees, student.id);
            let usedHours = 0;
            let absentHours = 0;
            attendance.forEach(session => {
                if (session.classId !== student.classId) return;
                const status = session.records?.[student.id];
                if (status === 1) usedHours += 1;
                else if (status === 0) absentHours += 1;
            });
            const remainingHours = totalHours - usedHours;
            return {
                id: student.id,
                name: student.name || '',
                grade: student.grade || '',
                classId: student.classId || '',
                totalHours,
                usedHours,
                absentHours,
                remainingHours,
                statusText: remainingHours <= 5 ? '需续费' : '正常'
            };
        });

    const newStudents = students.filter(student => {
        if (!student.enrollDate || student.status !== 'active') return false;
        const enrollDate = new Date(student.enrollDate);
        return enrollDate.getFullYear() === year && (enrollDate.getMonth() + 1) >= startMonth;
    });
    const churnedStudents = students.filter(student => student.status === 'withdrawn' || student.status === 'graduated');

    const classAttendanceStats = classes
        .filter(item => item.status === 'active' || item.status === 'forming')
        .map(item => {
            const classStudents = students.filter(student => student.classId === item.id && student.status === 'active');
            const classSessions = attendance.filter(session => session.classId === item.id);
            let totalPresent = 0;
            let totalAbsent = 0;
            classSessions.forEach(session => {
                classStudents.forEach(student => {
                    const status = session.records?.[student.id];
                    if (status === 1) totalPresent += 1;
                    else if (status === 0) totalAbsent += 1;
                });
            });
            const total = totalPresent + totalAbsent;
            const rate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
            return { id: item.id, name: item.name || '', rate, total };
        });

    const sourceDist = {};
    prospects.forEach(prospect => {
        const source = prospect.source || '其他';
        sourceDist[source] = (sourceDist[source] || 0) + 1;
    });

    const schoolDist = {};
    students.filter(student => student.status === 'active').forEach(student => {
        const school = String(student.school || '').trim() || '未填写';
        schoolDist[school] = (schoolDist[school] || 0) + 1;
    });

    return {
        source: 'app_state_report_logic',
        monthlyConsumption: Object.values(monthlyConsumptionMap)
            .map(row => ({ ...row, amount: roundMoney(row.amount) }))
            .sort((a, b) => b.month.localeCompare(a.month)),
        studentConsumptionSummary,
        quarterlyStudentDynamics: {
            year,
            quarter: Math.ceil((now.getMonth() + 1) / 3),
            newStudents: newStudents.length,
            churnedStudents: churnedStudents.length
        },
        classAttendanceStats,
        sourceDistribution: Object.entries(sourceDist).map(([label, value]) => ({ label, value })),
        schoolDistribution: Object.entries(schoolDist).map(([label, value]) => ({ label, value })),
        reportClassOptions: classes
            .filter(item => item.status === 'active' || item.status === 'forming')
            .map(item => ({ id: item.id, name: item.name || '' })),
        studentCount: studentsById.size
    };
}

function createReportsSummary(dbPath = config.dbPath) {
    const db = new DatabaseSync(dbPath);
    return createReportsSummaryFromData(readAppState(db));
}

function createDashboardSummary(dbPath = config.dbPath) {
    const db = new DatabaseSync(dbPath);
    const row = db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM students WHERE status = 'active') AS activeStudents,
            (SELECT COUNT(*) FROM classes WHERE status = 'active') AS totalClasses,
            (SELECT COALESCE(SUM(amount), 0) FROM fees WHERE status = 'paid') AS totalRevenue,
            (SELECT COALESCE(SUM(amount), 0) FROM fees WHERE status = 'pending') AS pendingAmount,
            (
                SELECT COALESCE(SUM(f.hours), 0)
                FROM fees f
                JOIN students s ON s.id = f.student_id
                WHERE f.status = 'paid' AND s.status = 'active'
            ) AS totalHours,
            (
                SELECT COUNT(*)
                FROM attendance_records r
                JOIN students s ON s.id = r.student_id
                WHERE r.status = 1 AND s.status = 'active'
            ) AS usedHours,
            (
                SELECT COUNT(*)
                FROM attendance_records r
                JOIN students s ON s.id = r.student_id
                WHERE r.status = 0 AND s.status = 'active'
            ) AS absentHours
    `).get();
    const totalHours = Number(row.totalHours || 0);
    const usedHours = Number(row.usedHours || 0);
    const remainingHours = totalHours - usedHours;
    return {
        source: 'sqlite_columns',
        activeStudents: Number(row.activeStudents || 0),
        totalClasses: Number(row.totalClasses || 0),
        totalRevenue: roundMoney(row.totalRevenue),
        pendingAmount: roundMoney(row.pendingAmount),
        totalHours,
        usedHours,
        absentHours: Number(row.absentHours || 0),
        remainingHours,
        usageRate: totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0
    };
}

function createDashboardSummaryFromData(data) {
    const activeStudents = (data.students || []).filter(student => student.status === 'active');
    const activeStudentIds = new Set(activeStudents.map(student => student.id));
    const totalHours = (data.fees || [])
        .filter(fee => fee.status === 'paid' && activeStudentIds.has(fee.studentId))
        .reduce((sum, fee) => sum + Number(fee.hours || 0), 0);
    let usedHours = 0;
    let absentHours = 0;
    activeStudents.forEach(student => {
        (data.attendance || []).forEach(session => {
            if (session.records && session.records[student.id] === 1) usedHours += 1;
            else if (session.records && session.records[student.id] === 0) absentHours += 1;
        });
    });
    const remainingHours = totalHours - usedHours;
    return {
        source: 'app_state_dashboard_logic',
        activeStudents: activeStudents.length,
        totalClasses: (data.classes || []).filter(item => item.status === 'active').length,
        totalRevenue: roundMoney((data.fees || []).filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)),
        pendingAmount: roundMoney((data.fees || []).filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + Number(fee.amount || 0), 0)),
        totalHours,
        usedHours,
        absentHours,
        remainingHours,
        usageRate: totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0
    };
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
    createSnapshotMetricsReport,
    createDashboardSummary,
    createDashboardSummaryFromData,
    createReportsSummary,
    createReportsSummaryFromData
};
