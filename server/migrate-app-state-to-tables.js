const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

function requireDryRun() {
    if (!process.argv.includes('--dry-run')) {
        console.error('当前脚本只开放 dry-run。请使用：scripts/node.sh server/migrate-app-state-to-tables.js --dry-run');
        process.exit(2);
    }
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

function main() {
    requireDryRun();
    const db = new DatabaseSync(config.dbPath);
    const { data, updatedAt } = readAppState(db);
    const plan = buildMigrationPlan(data);
    const errors = plan.issues.filter(issue => issue.level === 'error');
    const warnings = plan.issues.filter(issue => issue.level !== 'error');
    const report = {
        mode: 'dry-run',
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
            : 'dry-run 未发现阻断错误。下一步可设计真实写入脚本，但执行前必须先创建服务器备份。'
    };
    console.log(JSON.stringify(report, null, 2));
}

main();
