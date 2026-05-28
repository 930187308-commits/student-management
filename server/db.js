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
    getDb().prepare(`
        INSERT INTO app_state (key, value, updated_at)
        VALUES ('data', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(dataWithTimestamp), stamp);
    logAudit('save_data', 'app_state:data', reason);
    return dataWithTimestamp;
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

    const beforeRestore = createBackup(`before_restore_${id}`);
    const parsed = JSON.parse(fs.readFileSync(backup.jsonBackupPath, 'utf8'));
    const restoredData = parsed.data || parsed;
    if (!restoredData || typeof restoredData !== 'object' || Array.isArray(restoredData)) {
        throw new Error('备份内容格式不正确');
    }
    const saved = setData(restoredData, `restore_backup_${id}`);
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
    createBackup,
    listBackups,
    restoreBackup,
    getMeta
};
