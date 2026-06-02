const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
const ENTITY_READ_COLLECTIONS = new Set(['classes', 'students', 'prospects', 'fees', 'attendance', 'grades', 'communications']);

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
            planned_sessions INTEGER,
            archived INTEGER DEFAULT 0,
            archived_at TEXT,
            archived_snapshot_json TEXT,
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
            first_enroll_date TEXT,
            follow_up_status TEXT,
            created_at TEXT,
            class_join_sessions_json TEXT,
            class_leave_sessions_json TEXT,
            remark TEXT,
            archived_at TEXT,
            raw_json TEXT,
            updated_at TEXT,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        );

        CREATE TABLE IF NOT EXISTS fees (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            student_name TEXT,
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
            student_name TEXT,
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
            student_name TEXT,
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
            grade TEXT,
            wechat TEXT,
            class_id TEXT,
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
    ensureFieldColumns();

    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) {
        setData(DEFAULT_DATA, 'init');
    }
}

function getTableColumns(tableName) {
    return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map(column => column.name));
}

function addColumnIfMissing(tableName, columnName, columnDefinition) {
    const columns = getTableColumns(tableName);
    if (columns.has(columnName)) return;
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}

function ensureFieldColumns() {
    addColumnIfMissing('classes', 'planned_sessions', 'INTEGER');
    addColumnIfMissing('classes', 'archived', 'INTEGER DEFAULT 0');
    addColumnIfMissing('classes', 'archived_at', 'TEXT');
    addColumnIfMissing('classes', 'archived_snapshot_json', 'TEXT');

    addColumnIfMissing('students', 'first_enroll_date', 'TEXT');
    addColumnIfMissing('students', 'follow_up_status', 'TEXT');
    addColumnIfMissing('students', 'created_at', 'TEXT');
    addColumnIfMissing('students', 'class_join_sessions_json', 'TEXT');
    addColumnIfMissing('students', 'class_leave_sessions_json', 'TEXT');

    addColumnIfMissing('prospects', 'grade', 'TEXT');
    addColumnIfMissing('prospects', 'wechat', 'TEXT');
    addColumnIfMissing('prospects', 'class_id', 'TEXT');

    addColumnIfMissing('fees', 'student_name', 'TEXT');
    addColumnIfMissing('grades', 'student_name', 'TEXT');
    addColumnIfMissing('communications', 'student_name', 'TEXT');
}

function nowIso() {
    return new Date().toISOString();
}

function getData() {
    const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) return DEFAULT_DATA;
    return JSON.parse(row.value);
}

function getDataFromEntityTables() {
    const snapshot = getData();
    return {
        ...snapshot,
        classes: getCollectionFromEntityTable('classes'),
        students: getCollectionFromEntityTable('students'),
        fees: getCollectionFromEntityTable('fees'),
        attendance: getCollectionFromEntityTable('attendance'),
        grades: getCollectionFromEntityTable('grades'),
        communications: getCollectionFromEntityTable('communications'),
        prospects: getCollectionFromEntityTable('prospects')
    };
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
        return getCollectionFromEntityColumns(collectionName);
    }
    const data = getData();
    const value = data[collectionName];
    return Array.isArray(value) ? value : [];
}

function getCollectionFromEntityTable(collectionName) {
    const tableMap = {
        classes: 'classes',
        students: 'students',
        prospects: 'prospects',
        fees: 'fees',
        attendance: 'attendance_sessions',
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

function getAttendanceFromRecordColumns() {
    const database = getDb();
    const sessions = database.prepare('SELECT * FROM attendance_sessions ORDER BY rowid').all();
    const records = database.prepare(`
        SELECT session_id, student_id, status
        FROM attendance_records
        ORDER BY id
    `).all();
    const recordsBySession = new Map();
    records.forEach(row => {
        if (!recordsBySession.has(row.session_id)) {
            recordsBySession.set(row.session_id, {});
        }
        const sessionRecords = recordsBySession.get(row.session_id);
        sessionRecords[String(row.student_id)] = row.status === null || row.status === undefined ? null : Number(row.status);
    });

    return sessions.map(row => {
        const item = parseRawJson(row.raw_json);
        assignIfPresent(item, 'id', row.id || '');
        assignIfPresent(item, 'classId', row.class_id || '');
        assignIfPresent(item, 'date', row.date || '');
        assignIfPresent(item, 'sessionName', row.session_name || '');
        if (Object.prototype.hasOwnProperty.call(item, 'name') && !Object.prototype.hasOwnProperty.call(item, 'sessionName')) {
            item.name = row.session_name || '';
        }
        item.records = recordsBySession.get(row.id) || {};
        return item;
    });
}

function parseRawJson(value, fallback = {}) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function parseJsonObject(value) {
    const parsed = parseRawJson(value, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function parseJsonArray(value) {
    const parsed = parseRawJson(value, []);
    return Array.isArray(parsed) ? parsed : [];
}

function assignIfPresent(target, key, value) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = value;
    }
}

function getCollectionFromEntityColumns(collectionName) {
    const database = getDb();
    if (collectionName === 'classes') {
        return database.prepare('SELECT * FROM classes ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'name', row.name || '');
            assignIfPresent(item, 'grade', row.grade || '');
            assignIfPresent(item, 'classType', row.class_type || '');
            assignIfPresent(item, 'schedule', row.schedule || '');
            assignIfPresent(item, 'semester', row.semester || '');
            assignIfPresent(item, 'maxStudents', Number(row.max_students || 0));
            assignIfPresent(item, 'status', row.status || '');
            assignIfPresent(item, 'summerSchedule', row.summer_schedule || '');
            assignIfPresent(item, 'plannedSessions', Number(row.planned_sessions || 0));
            assignIfPresent(item, 'archived', Boolean(row.archived));
            assignIfPresent(item, 'archivedAt', row.archived_at || '');
            assignIfPresent(item, 'archivedStudentSnapshot', parseJsonArray(row.archived_snapshot_json));
            return item;
        });
    }

    if (collectionName === 'students') {
        return database.prepare('SELECT * FROM students ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'name', row.name || '');
            assignIfPresent(item, 'gender', row.gender || '');
            assignIfPresent(item, 'grade', row.grade || '');
            assignIfPresent(item, 'school', row.school || '');
            assignIfPresent(item, 'phone', row.phone || '');
            assignIfPresent(item, 'emergencyContact', row.emergency_contact || '');
            assignIfPresent(item, 'classId', row.class_id || '');
            assignIfPresent(item, 'teacher', row.teacher || '');
            assignIfPresent(item, 'status', row.status || '');
            assignIfPresent(item, 'enrollDate', row.enroll_date || '');
            assignIfPresent(item, 'firstEnrollDate', row.first_enroll_date || '');
            assignIfPresent(item, 'followUpStatus', row.follow_up_status || '');
            assignIfPresent(item, 'createdAt', row.created_at || '');
            assignIfPresent(item, 'classJoinSessions', parseJsonObject(row.class_join_sessions_json));
            assignIfPresent(item, 'classLeaveSessions', parseJsonObject(row.class_leave_sessions_json));
            assignIfPresent(item, 'remark', row.remark || '');
            assignIfPresent(item, 'archivedAt', row.archived_at || '');
            assignIfPresent(item, '_archivedAt', row.archived_at || '');
            return item;
        });
    }

    if (collectionName === 'prospects') {
        return database.prepare('SELECT * FROM prospects ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'name', row.name || '');
            assignIfPresent(item, 'phone', row.phone || '');
            assignIfPresent(item, 'source', row.source || '');
            assignIfPresent(item, 'grade', row.grade || '');
            assignIfPresent(item, 'wechat', row.wechat || '');
            assignIfPresent(item, 'classId', row.class_id || '');
            assignIfPresent(item, 'intent', row.intent || '');
            assignIfPresent(item, 'trialDate', row.trial_date || '');
            assignIfPresent(item, 'trialStatus', row.trial_status || '');
            assignIfPresent(item, 'dealStatus', row.deal_status || '');
            assignIfPresent(item, 'remark', row.remark || '');
            assignIfPresent(item, 'createDate', row.create_date || '');
            assignIfPresent(item, 'convertedStudentId', row.converted_student_id || '');
            return item;
        });
    }

    if (collectionName === 'fees') {
        return database.prepare('SELECT * FROM fees ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'studentId', row.student_id || '');
            assignIfPresent(item, 'studentName', row.student_name || '');
            assignIfPresent(item, 'amount', Number(row.amount || 0));
            assignIfPresent(item, 'hours', Number(row.hours || 0));
            assignIfPresent(item, 'pricePerHour', Number(row.price_per_hour || 0));
            assignIfPresent(item, 'paymentDate', row.payment_date || '');
            assignIfPresent(item, 'paymentMethod', row.payment_method || '');
            assignIfPresent(item, 'package', row.package_name || '');
            assignIfPresent(item, 'status', row.status || '');
            assignIfPresent(item, 'remark', row.remark || '');
            return item;
        });
    }

    if (collectionName === 'grades') {
        return database.prepare('SELECT * FROM grades ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'studentId', row.student_id || '');
            assignIfPresent(item, 'studentName', row.student_name || '');
            assignIfPresent(item, 'classId', row.class_id || '');
            assignIfPresent(item, 'testName', row.test_name || '');
            assignIfPresent(item, 'testDate', row.test_date || '');
            assignIfPresent(item, 'examType', row.exam_type || '');
            assignIfPresent(item, 'score', Number(row.score || 0));
            assignIfPresent(item, 'fullScore', Number(row.full_score || 0));
            assignIfPresent(item, 'ranking', row.ranking === null || row.ranking === undefined ? null : Number(row.ranking));
            assignIfPresent(item, 'weakPoints', row.weak_points || '');
            assignIfPresent(item, 'remark', row.remark || '');
            return item;
        });
    }

    if (collectionName === 'communications') {
        return database.prepare('SELECT * FROM communications ORDER BY rowid').all().map(row => {
            const item = parseRawJson(row.raw_json);
            assignIfPresent(item, 'id', row.id || '');
            assignIfPresent(item, 'studentId', row.student_id || '');
            assignIfPresent(item, 'studentName', row.student_name || '');
            assignIfPresent(item, 'topicId', row.topic_id || '');
            assignIfPresent(item, 'contactType', row.contact_type || '');
            assignIfPresent(item, 'contactPerson', row.contact_person || '');
            assignIfPresent(item, 'contactDate', row.contact_date || '');
            assignIfPresent(item, 'teacher', row.teacher || '');
            assignIfPresent(item, 'status', row.status || '');
            assignIfPresent(item, 'content', row.content || '');
            assignIfPresent(item, 'followUp', row.follow_up || '');
            return item;
        });
    }

    if (collectionName === 'attendance') {
        return getAttendanceFromRecordColumns();
    }

    return getCollectionFromEntityTable(collectionName);
}

function getDataFromEntityColumns() {
    const snapshot = getData();
    return {
        ...snapshot,
        classes: getCollectionFromEntityColumns('classes'),
        students: getCollectionFromEntityColumns('students'),
        prospects: getCollectionFromEntityColumns('prospects'),
        fees: getCollectionFromEntityColumns('fees'),
        attendance: getCollectionFromEntityColumns('attendance'),
        grades: getCollectionFromEntityColumns('grades'),
        communications: getCollectionFromEntityColumns('communications')
    };
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

function getCollectionItemId(collectionName, item) {
    const prefixMap = {
        classes: 'class',
        students: 'student',
        prospects: 'prospect',
        fees: 'fee',
        attendance: 'attendance',
        grades: 'grade',
        communications: 'communication'
    };
    return item.id ? String(item.id) : `${prefixMap[collectionName] || 'item'}_${crypto.randomUUID()}`;
}

function upsertCollectionItem(collectionName, item, reason = 'item_save') {
    if (!ENTITY_READ_COLLECTIONS.has(collectionName)) {
        const error = new Error(`${collectionName} 不支持单条记录保存`);
        error.statusCode = 400;
        throw error;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        const error = new Error('记录必须是对象');
        error.statusCode = 400;
        throw error;
    }

    const items = getCollection(collectionName);
    const nextItem = { ...item, id: getCollectionItemId(collectionName, item) };
    const index = items.findIndex(current => String(current.id) === String(nextItem.id));
    const nextItems = index >= 0
        ? items.map((current, currentIndex) => currentIndex === index ? nextItem : current)
        : [...items, nextItem];
    const saved = setCollection(collectionName, nextItems, reason);
    return {
        item: nextItem,
        created: index < 0,
        collection: saved[collectionName]
    };
}

function deleteCollectionItem(collectionName, id, reason = 'item_delete') {
    if (!ENTITY_READ_COLLECTIONS.has(collectionName)) {
        const error = new Error(`${collectionName} 不支持单条记录删除`);
        error.statusCode = 400;
        throw error;
    }
    const items = getCollection(collectionName);
    const index = items.findIndex(current => String(current.id) === String(id));
    if (index < 0) {
        const error = new Error('记录不存在');
        error.statusCode = 404;
        throw error;
    }
    const deleted = items[index];
    const nextItems = items.filter((_, currentIndex) => currentIndex !== index);
    const saved = setCollection(collectionName, nextItems, reason);
    return {
        deleted,
        collection: saved[collectionName]
    };
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
        planned_sessions: Number(c.plannedSessions || 0),
        archived: c.archived ? 1 : 0,
        archived_at: c.archivedAt || '',
        archived_snapshot_json: json(c.archivedStudentSnapshot || []),
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
        first_enroll_date: s.firstEnrollDate || '',
        follow_up_status: s.followUpStatus || '',
        created_at: s.createdAt || '',
        class_join_sessions_json: json(s.classJoinSessions || {}),
        class_leave_sessions_json: json(s.classLeaveSessions || {}),
        remark: s.remark || '',
        archived_at: s._archivedAt || s.archivedAt || '',
        raw_json: json(s)
    }));

    const feeRows = fees.map((f, index) => ({
        id: normalizeId('fee', index, f.id),
        student_id: f.studentId || null,
        student_name: f.studentName || '',
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
        student_name: g.studentName || '',
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
        student_name: c.studentName || '',
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
        grade: p.grade || '',
        wechat: p.wechat || '',
        class_id: p.classId || null,
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
        INSERT INTO classes (id, name, grade, class_type, schedule, semester, max_students, status, summer_schedule, planned_sessions, archived, archived_at, archived_snapshot_json, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.classes.forEach(row => insertClass.run(row.id, row.name, row.grade, row.class_type, row.schedule, row.semester, row.max_students, row.status, row.summer_schedule, row.planned_sessions, row.archived, row.archived_at, row.archived_snapshot_json, row.raw_json, stamp));

    const insertStudent = database.prepare(`
        INSERT INTO students (id, name, gender, grade, school, phone, emergency_contact, class_id, teacher, status, enroll_date, first_enroll_date, follow_up_status, created_at, class_join_sessions_json, class_leave_sessions_json, remark, archived_at, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.students.forEach(row => insertStudent.run(row.id, row.name, row.gender, row.grade, row.school, row.phone, row.emergency_contact, row.class_id, row.teacher, row.status, row.enroll_date, row.first_enroll_date, row.follow_up_status, row.created_at, row.class_join_sessions_json, row.class_leave_sessions_json, row.remark, row.archived_at, row.raw_json, stamp));

    const insertFee = database.prepare(`
        INSERT INTO fees (id, student_id, student_name, amount, hours, price_per_hour, payment_date, payment_method, package_name, status, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.fees.forEach(row => insertFee.run(row.id, row.student_id, row.student_name, row.amount, row.hours, row.price_per_hour, row.payment_date, row.payment_method, row.package_name, row.status, row.remark, row.raw_json, stamp));

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
        INSERT INTO grades (id, student_id, student_name, class_id, test_name, test_date, exam_type, score, full_score, ranking, weak_points, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.grades.forEach(row => insertGrade.run(row.id, row.student_id, row.student_name, row.class_id, row.test_name, row.test_date, row.exam_type, row.score, row.full_score, row.ranking, row.weak_points, row.remark, row.raw_json, stamp));

    const insertCommunication = database.prepare(`
        INSERT INTO communications (id, student_id, student_name, topic_id, contact_type, contact_person, contact_date, teacher, status, content, follow_up, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.communications.forEach(row => insertCommunication.run(row.id, row.student_id, row.student_name, row.topic_id, row.contact_type, row.contact_person, row.contact_date, row.teacher, row.status, row.content, row.follow_up, row.raw_json, stamp));

    const insertProspect = database.prepare(`
        INSERT INTO prospects (id, name, phone, source, grade, wechat, class_id, intent, trial_date, trial_status, deal_status, remark, create_date, converted_student_id, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.prospects.forEach(row => insertProspect.run(row.id, row.name, row.phone, row.source, row.grade, row.wechat, row.class_id, row.intent, row.trial_date, row.trial_status, row.deal_status, row.remark, row.create_date, row.converted_student_id, row.raw_json, stamp));
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

function getBackupData() {
    if (config.readFullDataFromSqliteColumns) return getDataFromEntityColumns();
    return config.readFullDataFromSqlite ? getDataFromEntityTables() : getData();
}

function createBackup(reason = 'manual') {
    ensureRuntimeDirs();
    const stamp = safeTimestamp();
    const sqliteBackupPath = path.join(config.backupDir, `student-console-${stamp}.sqlite`);
    const jsonBackupPath = path.join(config.backupDir, `student-console-${stamp}.json`);

    if (fs.existsSync(config.dbPath)) {
        fs.copyFileSync(config.dbPath, sqliteBackupPath);
    }
    fs.writeFileSync(jsonBackupPath, JSON.stringify(getBackupData(), null, 2));

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
    getDataFromEntityTables,
    getDataFromEntityColumns,
    getCollectionFromEntityTable,
    getAttendanceFromRecordColumns,
    getDataUpdatedAt,
    setData,
    getCollection,
    setCollection,
    upsertCollectionItem,
    deleteCollectionItem,
    createBackup,
    listBackups,
    restoreBackup,
    getMeta
};
