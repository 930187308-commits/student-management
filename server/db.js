const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const DEFAULT_DATA = {
    classes: [],
    students: [],
    fees: [],
    attendance: [],
    grades: [],
    communications: [],
    communicationTopics: [
        { id: 't1', name: '续费沟通', color: '#27ae60' },
        { id: 't2', name: '学情反馈', color: '#3498db' },
        { id: 't3', name: '请假沟通', color: '#f39c12' },
        { id: 't4', name: '投诉处理', color: '#e74c3c' },
        { id: 't5', name: '其他', color: '#95a5a6' }
    ],
    prospects: [],
    prospectSources: ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'],
    classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班'],
    gradeOptions: ['五年级', '六年级', '初一', '初二', '初三', '新初一']
};

const ENTITY_COLLECTIONS = new Set([
    'classes',
    'students',
    'fees',
    'attendance',
    'grades',
    'communications',
    'prospects'
]);
const ENTITY_READ_COLLECTIONS = new Set(['classes', 'prospects', 'grades', 'communications']);

let db;

function ensureRuntimeDirs() {
    fs.mkdirSync(config.dataRoot, { recursive: true });
    fs.mkdirSync(config.backupDir, { recursive: true });
    fs.mkdirSync(config.logRoot, { recursive: true });
}

function openDatabase() {
    ensureRuntimeDirs();
    db = new DatabaseSync(config.dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrate();
    return db;
}

function getDb() {
    if (!db) return openDatabase();
    return db;
}

function migrate() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            target TEXT,
            detail TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS backup_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            backup_path TEXT NOT NULL,
            json_path TEXT,
            reason TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            grade TEXT,
            class_type TEXT,
            schedule TEXT,
            semester TEXT,
            max_students INTEGER,
            status TEXT,
            summer_schedule TEXT,
            raw_json TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            gender TEXT,
            grade TEXT,
            school TEXT,
            phone TEXT,
            emergency_contact TEXT,
            class_id TEXT,
            teacher TEXT,
            status TEXT,
            enroll_date TEXT,
            remark TEXT,
            archived_at TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        );

        CREATE TABLE IF NOT EXISTS fees (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            amount REAL,
            hours REAL,
            price_per_hour REAL,
            payment_date TEXT,
            payment_method TEXT,
            package_name TEXT,
            status TEXT,
            remark TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id TEXT PRIMARY KEY,
            class_id TEXT,
            date TEXT,
            session_name TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            status INTEGER,
            consumed_hours REAL DEFAULT 0,
            note TEXT,
            updated_at TEXT,
            UNIQUE(session_id, student_id),
            FOREIGN KEY(session_id) REFERENCES attendance_sessions(id),
            FOREIGN KEY(student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS grades (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            class_id TEXT,
            test_name TEXT,
            test_date TEXT,
            exam_type TEXT,
            score REAL,
            full_score REAL,
            ranking INTEGER,
            weak_points TEXT,
            remark TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(student_id) REFERENCES students(id),
            FOREIGN KEY(class_id) REFERENCES classes(id)
        );

        CREATE TABLE IF NOT EXISTS communications (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            topic_id TEXT,
            contact_type TEXT,
            contact_person TEXT,
            contact_date TEXT,
            teacher TEXT,
            status TEXT,
            content TEXT,
            follow_up TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS prospects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            source TEXT,
            intent TEXT,
            trial_date TEXT,
            trial_status TEXT,
            deal_status TEXT,
            remark TEXT,
            create_date TEXT,
            converted_student_id TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(converted_student_id) REFERENCES students(id)
        );

        CREATE TABLE IF NOT EXISTS content_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            channel TEXT,
            status TEXT,
            source_type TEXT,
            body TEXT,
            raw_json TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS ai_tasks (
            id TEXT PRIMARY KEY,
            task_type TEXT NOT NULL,
            title TEXT,
            input_json TEXT,
            output_text TEXT,
            status TEXT,
            related_type TEXT,
            related_id TEXT,
            created_at TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_logs (
            id TEXT PRIMARY KEY,
            agent_name TEXT NOT NULL,
            action TEXT NOT NULL,
            input_json TEXT,
            output_json TEXT,
            created_at TEXT NOT NULL
        );
    `);

    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) {
        setData(DEFAULT_DATA, 'init');
    }
}

function nowIso() {
    return new Date().toISOString();
}

function getData() {
    const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) return DEFAULT_DATA;
    return JSON.parse(row.value);
}

function getDataUpdatedAt() {
    const row = getDb().prepare('SELECT updated_at FROM app_state WHERE key = ?').get('data');
    return row?.updated_at || null;
}

function setData(nextData, reason = 'save') {
    const stamp = nowIso();
    const dataWithTimestamp = {
        ...nextData,
        lastModified: nextData.lastModified || stamp
    };
    const database = getDb();
    database.exec('PRAGMA foreign_keys = OFF');
    database.exec('BEGIN IMMEDIATE');
    try {
        database.prepare(`
            INSERT INTO app_state (key, value, updated_at)
            VALUES ('data', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(JSON.stringify(dataWithTimestamp), stamp);
        replaceEntityTables(database, dataWithTimestamp, stamp);
        database.prepare(`
            INSERT INTO audit_log (action, target, detail, created_at)
            VALUES (?, ?, ?, ?)
        `).run('save_data', 'app_state:data', reason || null, stamp);
        database.exec('COMMIT');
    } catch (error) {
        database.exec('ROLLBACK');
        throw error;
    } finally {
        database.exec('PRAGMA foreign_keys = ON');
    }
    return dataWithTimestamp;
}

function getCollection(collectionName) {
    if (ENTITY_READ_COLLECTIONS.has(collectionName)) {
        return getCollectionFromEntityTable(collectionName);
    }
    const data = getData();
    const value = data[collectionName];
    return Array.isArray(value) ? value : [];
}

function getCollectionFromEntityTable(collectionName) {
    const tableMap = {
        classes: 'classes',
        prospects: 'prospects',
        grades: 'grades',
        communications: 'communications'
    };
    const tableName = tableMap[collectionName];
    if (!tableName) {
        const data = getData();
        const value = data[collectionName];
        return Array.isArray(value) ? value : [];
    }
    const rows = getDb().prepare(`SELECT raw_json FROM ${tableName} ORDER BY rowid`).all();
    return rows.map(row => JSON.parse(row.raw_json || '{}'));
}

function setCollection(collectionName, items, reason = 'module_save') {
    if (!Array.isArray(items)) {
        const error = new Error(`${collectionName} 必须是数组`);
        error.statusCode = 400;
        throw error;
    }
    const data = getData();
    const nextData = {
        ...data,
        [collectionName]: items,
        lastModified: nowIso()
    };
    const saved = setData(nextData, reason);
    return saved;
}

function json(value) {
    return JSON.stringify(value || {});
}

function normalizeId(prefix, index, id) {
    return id ? String(id) : `${prefix}_${index + 1}`;
}

function buildEntityRows(data) {
    const classes = data.classes || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const grades = data.grades || [];
    const communications = data.communications || [];
    const prospects = data.prospects || [];

    const classRows = classes.map((c, index) => ({
        id: normalizeId('class', index, c.id),
        name: c.name || '',
        grade: c.grade || '',
        class_type: c.classType || '',
        schedule: c.schedule || '',
        semester: c.semester || '',
        max_students: Number(c.maxStudents || c.capacity || 0),
        status: c.status || 'active',
        summer_schedule: c.summerSchedule || '',
        raw_json: json(c)
    }));

    const studentRows = students.map((s, index) => ({
        id: normalizeId('student', index, s.id),
        name: s.name || '',
        gender: s.gender || '',
        grade: s.grade || '',
        school: s.school || '',
        phone: s.phone || '',
        emergency_contact: s.emergencyContact || '',
        class_id: s.classId || null,
        teacher: s.teacher || '',
        status: s.status || 'active',
        enroll_date: s.enrollDate || '',
        remark: s.remark || '',
        archived_at: s._archivedAt || s.archivedAt || '',
        raw_json: json(s)
    }));

    const feeRows = fees.map((f, index) => ({
        id: normalizeId('fee', index, f.id),
        student_id: f.studentId || null,
        amount: Number(f.amount || 0),
        hours: Number(f.hours || 0),
        price_per_hour: Number(f.pricePerHour || 0),
        payment_date: f.paymentDate || '',
        payment_method: f.paymentMethod || '',
        package_name: f.package || '',
        status: f.status || 'pending',
        remark: f.remark || '',
        raw_json: json(f)
    }));

    const attendanceSessionRows = [];
    const attendanceRecordRows = [];
    attendance.forEach((session, sessionIndex) => {
        const sessionId = normalizeId('attendance', sessionIndex, session.id || `${session.classId || 'class'}_${session.date || sessionIndex + 1}`);
        attendanceSessionRows.push({
            id: sessionId,
            class_id: session.classId || null,
            date: session.date || '',
            session_name: session.sessionName || session.name || '',
            raw_json: json(session)
        });
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            attendanceRecordRows.push({
                session_id: sessionId,
                student_id: String(studentId),
                status: status === '' || status === undefined ? null : Number(status),
                consumed_hours: status === 1 ? 1 : 0,
                note: ''
            });
        });
    });

    const gradeRows = grades.map((g, index) => ({
        id: normalizeId('grade', index, g.id),
        student_id: g.studentId || null,
        class_id: g.classId || null,
        test_name: g.testName || '',
        test_date: g.testDate || '',
        exam_type: g.examType || '',
        score: Number(g.score || 0),
        full_score: Number(g.fullScore || 0),
        ranking: g.ranking === null || g.ranking === '' || g.ranking === undefined ? null : Number(g.ranking),
        weak_points: g.weakPoints || '',
        remark: g.remark || '',
        raw_json: json(g)
    }));

    const communicationRows = communications.map((c, index) => ({
        id: normalizeId('communication', index, c.id),
        student_id: c.studentId || null,
        topic_id: c.topicId || '',
        contact_type: c.contactType || '',
        contact_person: c.contactPerson || '',
        contact_date: c.contactDate || '',
        teacher: c.teacher || '',
        status: c.status || '',
        content: c.content || '',
        follow_up: c.followUp || '',
        raw_json: json(c)
    }));

    const prospectRows = prospects.map((p, index) => ({
        id: normalizeId('prospect', index, p.id),
        name: p.name || '',
        phone: p.phone || '',
        source: p.source || '',
        intent: p.intent || '',
        trial_date: p.trialDate || '',
        trial_status: p.trialStatus || '',
        deal_status: p.dealStatus || '',
        remark: p.remark || '',
        create_date: p.createDate || '',
        converted_student_id: p.convertedStudentId || null,
        raw_json: json(p)
    }));

    return {
        classes: classRows,
        students: studentRows,
        fees: feeRows,
        attendance_sessions: attendanceSessionRows,
        attendance_records: attendanceRecordRows,
        grades: gradeRows,
        communications: communicationRows,
        prospects: prospectRows
    };
}

function clearEntityTables(database) {
    [
        'attendance_records',
        'attendance_sessions',
        'communications',
        'grades',
        'fees',
        'prospects',
        'students',
        'classes'
    ].forEach(tableName => {
        database.prepare(`DELETE FROM ${tableName}`).run();
    });
}

function insertEntityRows(database, rows, stamp) {
    const insertClass = database.prepare(`
        INSERT INTO classes (id, name, grade, class_type, schedule, semester, max_students, status, summer_schedule, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.classes.forEach(row => insertClass.run(row.id, row.name, row.grade, row.class_type, row.schedule, row.semester, row.max_students, row.status, row.summer_schedule, row.raw_json, stamp));

    const insertStudent = database.prepare(`
        INSERT INTO students (id, name, gender, grade, school, phone, emergency_contact, class_id, teacher, status, enroll_date, remark, archived_at, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.students.forEach(row => insertStudent.run(row.id, row.name, row.gender, row.grade, row.school, row.phone, row.emergency_contact, row.class_id, row.teacher, row.status, row.enroll_date, row.remark, row.archived_at, row.raw_json, stamp));

    const insertFee = database.prepare(`
        INSERT INTO fees (id, student_id, amount, hours, price_per_hour, payment_date, payment_method, package_name, status, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.fees.forEach(row => insertFee.run(row.id, row.student_id, row.amount, row.hours, row.price_per_hour, row.payment_date, row.payment_method, row.package_name, row.status, row.remark, row.raw_json, stamp));

    const insertAttendanceSession = database.prepare(`
        INSERT INTO attendance_sessions (id, class_id, date, session_name, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    rows.attendance_sessions.forEach(row => insertAttendanceSession.run(row.id, row.class_id, row.date, row.session_name, row.raw_json, stamp));

    const insertAttendanceRecord = database.prepare(`
        INSERT INTO attendance_records (session_id, student_id, status, consumed_hours, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    rows.attendance_records.forEach(row => insertAttendanceRecord.run(row.session_id, row.student_id, row.status, row.consumed_hours, row.note, stamp));

    const insertGrade = database.prepare(`
        INSERT INTO grades (id, student_id, class_id, test_name, test_date, exam_type, score, full_score, ranking, weak_points, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.grades.forEach(row => insertGrade.run(row.id, row.student_id, row.class_id, row.test_name, row.test_date, row.exam_type, row.score, row.full_score, row.ranking, row.weak_points, row.remark, row.raw_json, stamp));

    const insertCommunication = database.prepare(`
        INSERT INTO communications (id, student_id, topic_id, contact_type, contact_person, contact_date, teacher, status, content, follow_up, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.communications.forEach(row => insertCommunication.run(row.id, row.student_id, row.topic_id, row.contact_type, row.contact_person, row.contact_date, row.teacher, row.status, row.content, row.follow_up, row.raw_json, stamp));

    const insertProspect = database.prepare(`
        INSERT INTO prospects (id, name, phone, source, intent, trial_date, trial_status, deal_status, remark, create_date, converted_student_id, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.prospects.forEach(row => insertProspect.run(row.id, row.name, row.phone, row.source, row.intent, row.trial_date, row.trial_status, row.deal_status, row.remark, row.create_date, row.converted_student_id, row.raw_json, stamp));
}

function syncEntityTables(data) {
    const database = getDb();
    const stamp = nowIso();
    database.exec('PRAGMA foreign_keys = OFF');
    database.exec('BEGIN IMMEDIATE');
    try {
        replaceEntityTables(database, data, stamp);
        database.exec('COMMIT');
    } catch (error) {
        database.exec('ROLLBACK');
        throw error;
    } finally {
        database.exec('PRAGMA foreign_keys = ON');
    }
}

function replaceEntityTables(database, data, stamp) {
    const rows = buildEntityRows(data);
    clearEntityTables(database);
    insertEntityRows(database, rows, stamp);
}

function logAudit(action, target, detail) {
    getDb().prepare(`
        INSERT INTO audit_log (action, target, detail, created_at)
        VALUES (?, ?, ?, ?)
    `).run(action, target || null, detail || null, nowIso());
}

function safeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function createBackup(reason = 'manual') {
    ensureRuntimeDirs();
    const stamp = safeTimestamp();
    const sqliteBackupPath = path.join(config.backupDir, `student-console-${stamp}.sqlite`);
    const jsonBackupPath = path.join(config.backupDir, `student-console-${stamp}.json`);

    if (fs.existsSync(config.dbPath)) {
        fs.copyFileSync(config.dbPath, sqliteBackupPath);
    }
    fs.writeFileSync(jsonBackupPath, JSON.stringify(getData(), null, 2));

    getDb().prepare(`
        INSERT INTO backup_log (backup_path, json_path, reason, created_at)
        VALUES (?, ?, ?, ?)
    `).run(sqliteBackupPath, jsonBackupPath, reason, nowIso());

    return {
        sqliteBackupPath,
        jsonBackupPath,
        createdAt: nowIso()
    };
}

function listBackups(limit = 50) {
    return getDb().prepare(`
        SELECT id, backup_path AS sqliteBackupPath, json_path AS jsonBackupPath, reason, created_at AS createdAt
        FROM backup_log
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
}

function restoreBackup(id) {
    const backup = getDb().prepare(`
        SELECT id, json_path AS jsonBackupPath, reason, created_at AS createdAt
        FROM backup_log
        WHERE id = ?
    `).get(id);
    if (!backup) {
        const error = new Error('备份不存在');
        error.statusCode = 404;
        throw error;
    }
    if (!backup.jsonBackupPath || !fs.existsSync(backup.jsonBackupPath)) {
        const error = new Error('备份 JSON 文件不存在');
        error.statusCode = 404;
        throw error;
    }

    const beforeRestore = createBackup(`恢复备份 ${id} 前自动备份`);
    const parsed = JSON.parse(fs.readFileSync(backup.jsonBackupPath, 'utf8'));
    const restoredData = parsed.data || parsed;
    if (!restoredData || typeof restoredData !== 'object' || Array.isArray(restoredData)) {
        throw new Error('备份内容格式不正确');
    }
    const saved = setData(restoredData, `恢复备份 ${id}`);
    logAudit('restore_backup', 'app_state:data', JSON.stringify({ backupId: id, beforeRestore }));
    return {
        restoredBackup: backup,
        beforeRestore,
        data: saved
    };
}

function getMeta() {
    const state = getDb().prepare('SELECT updated_at FROM app_state WHERE key = ?').get('data');
    const counts = {
        auditLogs: getDb().prepare('SELECT COUNT(*) AS count FROM audit_log').get().count,
        backups: getDb().prepare('SELECT COUNT(*) AS count FROM backup_log').get().count
    };
    return {
        dbPath: config.dbPath,
        backupDir: config.backupDir,
        dataUpdatedAt: state?.updated_at || null,
        counts
    };
}

module.exports = {
    DEFAULT_DATA,
    openDatabase,
    getDb,
    getData,
    getDataUpdatedAt,
    setData,
    getCollection,
    setCollection,
    createBackup,
    listBackups,
    restoreBackup,
    getMeta
};
