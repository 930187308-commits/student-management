const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const TABLES = [
    'classes',
    'students',
    'fees',
    'attendance_sessions',
    'attendance_records',
    'grades',
    'communications',
    'prospects'
];

function readAppState(db) {
    const row = db.prepare('SELECT value, updated_at FROM app_state WHERE key = ?').get('data');
    if (!row) throw new Error('app_state.data 不存在');
    return {
        data: JSON.parse(row.value),
        updatedAt: row.updated_at
    };
}

function countTable(db, tableName) {
    const exists = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(tableName);
    if (!exists) return null;
    return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function countSnapshot(data) {
    const attendance = data.attendance || [];
    let attendanceRecords = 0;
    attendance.forEach(session => {
        attendanceRecords += Object.keys(session.records || {}).length;
    });

    return {
        classes: (data.classes || []).length,
        students: (data.students || []).length,
        fees: (data.fees || []).length,
        attendance_sessions: attendance.length,
        attendance_records: attendanceRecords,
        grades: (data.grades || []).length,
        communications: (data.communications || []).length,
        prospects: (data.prospects || []).length
    };
}

function analyzeSnapshot(data) {
    const classes = data.classes || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const classIds = new Set(classes.map(c => String(c.id)));
    const studentIds = new Set(students.map(s => String(s.id)));

    const orphanAttendance = attendance.filter(a => a.classId && !classIds.has(String(a.classId))).length;
    let unknownRecordRefs = 0;
    let usedHours = 0;
    attendance.forEach(session => {
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (!studentIds.has(String(studentId))) unknownRecordRefs++;
            if (status === 1) usedHours++;
        });
    });

    const orphanFees = fees.filter(f => f.studentId && !studentIds.has(String(f.studentId))).length;
    const pendingFees = fees.filter(f => f.status === 'pending');
    const paidFees = fees.filter(f => f.status === 'paid');
    const pendingAmount = pendingFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const paidAmount = paidFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    return {
        archivedClasses: classes.filter(c => c.archived).length,
        finishedVisibleClasses: classes.filter(c => !c.archived && c.status === 'finished').length,
        renewalPendingStudents: students.filter(s => s.status === 'renewalPending').length,
        orphanAttendance,
        unknownRecordRefs,
        orphanFees,
        usedHours,
        paidFees: paidFees.length,
        pendingFees: pendingFees.length,
        paidAmount,
        pendingAmount
    };
}

function buildTableCounts(db) {
    return Object.fromEntries(TABLES.map(tableName => [tableName, countTable(db, tableName)]));
}

function compareCounts(snapshotCounts, tableCounts) {
    return TABLES.map(tableName => {
        const tableCount = tableCounts[tableName];
        const snapshotCount = snapshotCounts[tableName];
        return {
            table: tableName,
            snapshot: snapshotCount,
            sqlite: tableCount,
            status: tableCount === null ? 'missing_table' : tableCount === snapshotCount ? 'match' : 'mismatch'
        };
    });
}

function main() {
    const db = new DatabaseSync(config.dbPath);
    const { data, updatedAt } = readAppState(db);
    const snapshotCounts = countSnapshot(data);
    const tableCounts = buildTableCounts(db);
    const comparison = compareCounts(snapshotCounts, tableCounts);
    const health = analyzeSnapshot(data);

    const migratedTables = comparison.filter(row => row.status === 'match').length;
    const mismatchedTables = comparison.filter(row => row.status === 'mismatch');

    const report = {
        dbPath: config.dbPath,
        appStateUpdatedAt: updatedAt,
        migrationStatus: migratedTables === TABLES.length
            ? 'all_tables_match_snapshot'
            : 'tables_not_yet_matching_snapshot',
        counts: comparison,
        snapshotHealth: health,
        nextStep: mismatchedTables.length > 0
            ? '当前实体表尚未与 app_state 快照一致。下一步应先写 dry-run 迁移脚本，不要切换读路径。'
            : '实体表数量已与快照一致，可以继续做字段级和统计口径对账。'
    };

    console.log(JSON.stringify(report, null, 2));
}

main();
