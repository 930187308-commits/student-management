const { DatabaseSync } = require('node:sqlite');
const config = require('./config');
const { createBackup } = require('./db');

function getMode() {
    const isDryRun = process.argv.includes('--dry-run');
    const isApply = process.argv.includes('--apply');
    if (isDryRun === isApply) {
        console.error('请明确指定一种模式：--dry-run 或 --apply');
        process.exit(2);
    }
    return isApply ? 'apply' : 'dry-run';
}

function readAppState(db) {
    const row = db.prepare('SELECT value, updated_at FROM app_state WHERE key = ?').get('data');
    if (!row) throw new Error('app_state.data 不存在');
    return {
        data: JSON.parse(row.value),
        updatedAt: row.updated_at
    };
}

function json(value) {
    return JSON.stringify(value || {});
}

function normalizeId(prefix, index, id) {
    return id ? String(id) : `${prefix}_${index + 1}`;
}

function uniqueIssues(rows, table, issues) {
    const seen = new Set();
    rows.forEach(row => {
        if (!row.id) {
            issues.push({ level: 'error', table, message: '存在空 ID' });
            return;
        }
        if (seen.has(row.id)) {
            issues.push({ level: 'error', table, id: row.id, message: '存在重复 ID' });
        }
        seen.add(row.id);
    });
}

function buildMigrationPlan(data) {
    const issues = [];
    const classes = data.classes || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const grades = data.grades || [];
    const communications = data.communications || [];
    const prospects = data.prospects || [];

    const classIds = new Set(classes.map(c => String(c.id)));
    const studentIds = new Set(students.map(s => String(s.id)));

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

    const studentRows = students.map((s, index) => {
        if (s.classId && !classIds.has(String(s.classId))) {
            issues.push({ level: 'warn', table: 'students', id: s.id, message: `classId 不存在：${s.classId}` });
        }
        return {
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
        };
    });

    const feeRows = fees.map((f, index) => {
        if (f.studentId && !studentIds.has(String(f.studentId))) {
            issues.push({ level: 'warn', table: 'fees', id: f.id, message: `studentId 不存在：${f.studentId}` });
        }
        return {
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
        };
    });

    const attendanceSessionRows = [];
    const attendanceRecordRows = [];
    attendance.forEach((session, sessionIndex) => {
        if (session.classId && !classIds.has(String(session.classId))) {
            issues.push({ level: 'warn', table: 'attendance_sessions', id: session.id, message: `classId 不存在：${session.classId}` });
        }
        const sessionId = normalizeId('attendance', sessionIndex, session.id || `${session.classId || 'class'}_${session.date || sessionIndex + 1}`);
        attendanceSessionRows.push({
            id: sessionId,
            class_id: session.classId || null,
            date: session.date || '',
            session_name: session.sessionName || session.name || '',
            raw_json: json(session)
        });
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (!studentIds.has(String(studentId))) {
                issues.push({ level: 'warn', table: 'attendance_records', sessionId, studentId, message: `studentId 不存在：${studentId}` });
            }
            attendanceRecordRows.push({
                session_id: sessionId,
                student_id: String(studentId),
                status: status === '' || status === undefined ? null : Number(status),
                consumed_hours: status === 1 ? 1 : 0,
                note: ''
            });
        });
    });

    const gradeRows = grades.map((g, index) => {
        if (g.studentId && !studentIds.has(String(g.studentId))) {
            issues.push({ level: 'warn', table: 'grades', id: g.id, message: `studentId 不存在：${g.studentId}` });
        }
        return {
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
        };
    });

    const communicationRows = communications.map((c, index) => {
        if (c.studentId && !studentIds.has(String(c.studentId))) {
            issues.push({ level: 'warn', table: 'communications', id: c.id, message: `studentId 不存在：${c.studentId}` });
        }
        return {
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
        };
    });

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

    uniqueIssues(classRows, 'classes', issues);
    uniqueIssues(studentRows, 'students', issues);
    uniqueIssues(feeRows, 'fees', issues);
    uniqueIssues(attendanceSessionRows, 'attendance_sessions', issues);
    uniqueIssues(gradeRows, 'grades', issues);
    uniqueIssues(communicationRows, 'communications', issues);
    uniqueIssues(prospectRows, 'prospects', issues);

    return {
        rows: {
            classes: classRows,
            students: studentRows,
            fees: feeRows,
            attendance_sessions: attendanceSessionRows,
            attendance_records: attendanceRecordRows,
            grades: gradeRows,
            communications: communicationRows,
            prospects: prospectRows
        },
        issues
    };
}

function summarizeRows(rows) {
    return Object.fromEntries(Object.entries(rows).map(([name, items]) => [name, items.length]));
}

function clearTargetTables(db) {
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
        db.prepare(`DELETE FROM ${tableName}`).run();
    });
}

function insertRows(db, rows) {
    const stamp = new Date().toISOString();

    const insertClass = db.prepare(`
        INSERT INTO classes (id, name, grade, class_type, schedule, semester, max_students, status, summer_schedule, planned_sessions, archived, archived_at, archived_snapshot_json, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.classes.forEach(row => insertClass.run(
        row.id, row.name, row.grade, row.class_type, row.schedule, row.semester,
        row.max_students, row.status, row.summer_schedule, row.planned_sessions, row.archived,
        row.archived_at, row.archived_snapshot_json, row.raw_json, stamp
    ));

    const insertStudent = db.prepare(`
        INSERT INTO students (id, name, gender, grade, school, phone, emergency_contact, class_id, teacher, status, enroll_date, first_enroll_date, follow_up_status, created_at, class_join_sessions_json, class_leave_sessions_json, remark, archived_at, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.students.forEach(row => insertStudent.run(
        row.id, row.name, row.gender, row.grade, row.school, row.phone, row.emergency_contact,
        row.class_id, row.teacher, row.status, row.enroll_date, row.first_enroll_date,
        row.follow_up_status, row.created_at, row.class_join_sessions_json,
        row.class_leave_sessions_json, row.remark, row.archived_at, row.raw_json, stamp
    ));

    const insertFee = db.prepare(`
        INSERT INTO fees (id, student_id, student_name, amount, hours, price_per_hour, payment_date, payment_method, package_name, status, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.fees.forEach(row => insertFee.run(
        row.id, row.student_id, row.student_name, row.amount, row.hours, row.price_per_hour, row.payment_date,
        row.payment_method, row.package_name, row.status, row.remark, row.raw_json, stamp
    ));

    const insertAttendanceSession = db.prepare(`
        INSERT INTO attendance_sessions (id, class_id, date, session_name, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    rows.attendance_sessions.forEach(row => insertAttendanceSession.run(
        row.id, row.class_id, row.date, row.session_name, row.raw_json, stamp
    ));

    const insertAttendanceRecord = db.prepare(`
        INSERT INTO attendance_records (session_id, student_id, status, consumed_hours, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    rows.attendance_records.forEach(row => insertAttendanceRecord.run(
        row.session_id, row.student_id, row.status, row.consumed_hours, row.note, stamp
    ));

    const insertGrade = db.prepare(`
        INSERT INTO grades (id, student_id, student_name, class_id, test_name, test_date, exam_type, score, full_score, ranking, weak_points, remark, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.grades.forEach(row => insertGrade.run(
        row.id, row.student_id, row.student_name, row.class_id, row.test_name, row.test_date, row.exam_type,
        row.score, row.full_score, row.ranking, row.weak_points, row.remark, row.raw_json, stamp
    ));

    const insertCommunication = db.prepare(`
        INSERT INTO communications (id, student_id, student_name, topic_id, contact_type, contact_person, contact_date, teacher, status, content, follow_up, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.communications.forEach(row => insertCommunication.run(
        row.id, row.student_id, row.student_name, row.topic_id, row.contact_type, row.contact_person, row.contact_date,
        row.teacher, row.status, row.content, row.follow_up, row.raw_json, stamp
    ));

    const insertProspect = db.prepare(`
        INSERT INTO prospects (id, name, phone, source, grade, wechat, class_id, intent, trial_date, trial_status, deal_status, remark, create_date, converted_student_id, raw_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rows.prospects.forEach(row => insertProspect.run(
        row.id, row.name, row.phone, row.source, row.grade, row.wechat, row.class_id,
        row.intent, row.trial_date, row.trial_status, row.deal_status, row.remark,
        row.create_date, row.converted_student_id, row.raw_json, stamp
    ));
}

function applyMigration(db, plan) {
    db.exec('BEGIN IMMEDIATE');
    try {
        clearTargetTables(db);
        insertRows(db, plan.rows);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function main() {
    const mode = getMode();
    const db = new DatabaseSync(config.dbPath);
    const { data, updatedAt } = readAppState(db);
    const plan = buildMigrationPlan(data);
    const errors = plan.issues.filter(issue => issue.level === 'error');
    const warnings = plan.issues.filter(issue => issue.level !== 'error');
    const report = {
        mode,
        dbPath: config.dbPath,
        appStateUpdatedAt: updatedAt,
        plannedRows: summarizeRows(plan.rows),
        issueSummary: {
            errors: errors.length,
            warnings: warnings.length
        },
        issues: plan.issues.slice(0, 80),
        nextStep: errors.length > 0
            ? '存在错误，不能执行真实迁移。'
            : mode === 'dry-run'
                ? 'dry-run 未发现阻断错误。可执行 --apply；脚本会先创建服务器备份，再写入实体表。'
                : '实体表已从 app_state 快照写入。下一步运行 reconcile，并继续保持前端读 app_state，不切换读路径。'
    };

    if (mode === 'apply') {
        if (errors.length > 0) {
            console.log(JSON.stringify(report, null, 2));
            process.exit(1);
        }
        const backup = createBackup('sqlite_split_apply_before');
        applyMigration(db, plan);
        report.backup = backup;
        report.applied = true;
    }

    console.log(JSON.stringify(report, null, 2));
}

main();
