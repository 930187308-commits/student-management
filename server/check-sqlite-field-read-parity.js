const { getDb } = require('./db');

const TABLE_CHECKS = {
    classes: {
        table: 'classes',
        fields: {
            id: { column: 'id', type: 'text' },
            name: { column: 'name', type: 'text' },
            grade: { column: 'grade', type: 'text' },
            classType: { column: 'class_type', type: 'text' },
            schedule: { column: 'schedule', type: 'text' },
            semester: { column: 'semester', type: 'text' },
            maxStudents: { column: 'max_students', type: 'number' },
            status: { column: 'status', type: 'text' },
            summerSchedule: { column: 'summer_schedule', type: 'text' },
            plannedSessions: { column: 'planned_sessions', type: 'number' },
            archived: { column: 'archived', type: 'boolean' },
            archivedAt: { column: 'archived_at', type: 'text' },
            archivedStudentSnapshot: { column: 'archived_snapshot_json', type: 'json-array' }
        }
    },
    students: {
        table: 'students',
        fields: {
            id: { column: 'id', type: 'text' },
            name: { column: 'name', type: 'text' },
            gender: { column: 'gender', type: 'text' },
            grade: { column: 'grade', type: 'text' },
            school: { column: 'school', type: 'text' },
            schoolHistory: { column: 'school_history_json', type: 'json-object' },
            phone: { column: 'phone', type: 'text' },
            emergencyContact: { column: 'emergency_contact', type: 'text' },
            classId: { column: 'class_id', type: 'text' },
            teacher: { column: 'teacher', type: 'text' },
            status: { column: 'status', type: 'text' },
            enrollDate: { column: 'enroll_date', type: 'text' },
            firstEnrollDate: { column: 'first_enroll_date', type: 'text' },
            firstEnrollGrade: { column: 'first_enroll_grade', type: 'text' },
            followUpStatus: { column: 'follow_up_status', type: 'text' },
            createdAt: { column: 'created_at', type: 'text' },
            classJoinSessions: { column: 'class_join_sessions_json', type: 'json-object' },
            classLeaveSessions: { column: 'class_leave_sessions_json', type: 'json-object' },
            remark: { column: 'remark', type: 'text' }
        }
    },
    prospects: {
        table: 'prospects',
        fields: {
            id: { column: 'id', type: 'text' },
            name: { column: 'name', type: 'text' },
            phone: { column: 'phone', type: 'text' },
            source: { column: 'source', type: 'text' },
            grade: { column: 'grade', type: 'text' },
            wechat: { column: 'wechat', type: 'text' },
            classId: { column: 'class_id', type: 'text' },
            intent: { column: 'intent', type: 'text' },
            trialDate: { column: 'trial_date', type: 'text' },
            trialStatus: { column: 'trial_status', type: 'text' },
            dealStatus: { column: 'deal_status', type: 'text' },
            remark: { column: 'remark', type: 'text' },
            createDate: { column: 'create_date', type: 'text' },
            convertedStudentId: { column: 'converted_student_id', type: 'text' },
            contactLogs: { column: 'contact_logs_json', type: 'json-array' }
        }
    },
    fees: {
        table: 'fees',
        fields: {
            id: { column: 'id', type: 'text' },
            studentId: { column: 'student_id', type: 'text' },
            studentName: { column: 'student_name', type: 'text' },
            amount: { column: 'amount', type: 'number' },
            hours: { column: 'hours', type: 'number' },
            pricePerHour: { column: 'price_per_hour', type: 'number' },
            paymentDate: { column: 'payment_date', type: 'text' },
            paymentMethod: { column: 'payment_method', type: 'text' },
            package: { column: 'package_name', type: 'text' },
            status: { column: 'status', type: 'text' },
            remark: { column: 'remark', type: 'text' }
        }
    },
    grades: {
        table: 'grades',
        fields: {
            id: { column: 'id', type: 'text' },
            studentId: { column: 'student_id', type: 'text' },
            studentName: { column: 'student_name', type: 'text' },
            classId: { column: 'class_id', type: 'text' },
            testName: { column: 'test_name', type: 'text' },
            testDate: { column: 'test_date', type: 'text' },
            examType: { column: 'exam_type', type: 'text' },
            score: { column: 'score', type: 'number' },
            fullScore: { column: 'full_score', type: 'number' },
            ranking: { column: 'ranking', type: 'nullable-number' },
            weakPoints: { column: 'weak_points', type: 'text' },
            remark: { column: 'remark', type: 'text' }
        }
    },
    communications: {
        table: 'communications',
        fields: {
            id: { column: 'id', type: 'text' },
            studentId: { column: 'student_id', type: 'text' },
            studentName: { column: 'student_name', type: 'text' },
            topicId: { column: 'topic_id', type: 'text' },
            contactType: { column: 'contact_type', type: 'text' },
            contactPerson: { column: 'contact_person', type: 'text' },
            contactDate: { column: 'contact_date', type: 'text' },
            teacher: { column: 'teacher', type: 'text' },
            status: { column: 'status', type: 'text' },
            content: { column: 'content', type: 'text' },
            followUp: { column: 'follow_up', type: 'text' }
        }
    }
};

function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalize(value, type) {
    if (type === 'text') return value === null || value === undefined ? '' : String(value);
    if (type === 'number') return Number(value || 0);
    if (type === 'nullable-number') {
        return value === null || value === undefined || value === '' ? null : Number(value);
    }
    if (type === 'boolean') return Boolean(value);
    if (type === 'json-array') return Array.isArray(value) ? value : [];
    if (type === 'json-object') return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return value;
}

function normalizeColumnValue(row, rule) {
    if (rule.type === 'json-array') return normalize(parseJson(row[rule.column], []), rule.type);
    if (rule.type === 'json-object') return normalize(parseJson(row[rule.column], {}), rule.type);
    return normalize(row[rule.column], rule.type);
}

function valuesMatch(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function checkTable(db, collectionName, config) {
    const rows = db.prepare(`SELECT * FROM ${config.table} ORDER BY rowid`).all();
    const fieldResults = {};

    Object.entries(config.fields).forEach(([field, rule]) => {
        let checked = 0;
        let matched = 0;
        let mismatched = 0;
        rows.forEach(row => {
            const raw = parseJson(row.raw_json, {});
            if (!Object.prototype.hasOwnProperty.call(raw, field)) return;
            checked += 1;
            const rawValue = normalize(raw[field], rule.type);
            const columnValue = normalizeColumnValue(row, rule);
            if (valuesMatch(rawValue, columnValue)) {
                matched += 1;
            } else {
                mismatched += 1;
            }
        });
        fieldResults[field] = { checked, matched, mismatched };
    });

    const mismatchCount = Object.values(fieldResults).reduce((sum, result) => sum + result.mismatched, 0);
    return {
        rows: rows.length,
        checkedFieldCount: Object.keys(config.fields).length,
        mismatchCount,
        fields: fieldResults
    };
}

function main() {
    const db = getDb();
    const tables = Object.fromEntries(Object.entries(TABLE_CHECKS).map(([collectionName, config]) => [
        collectionName,
        checkTable(db, collectionName, config)
    ]));
    const totalMismatches = Object.values(tables).reduce((sum, table) => sum + table.mismatchCount, 0);
    const report = {
        ok: totalMismatches === 0,
        checkedAt: new Date().toISOString(),
        totalMismatches,
        tables
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main();
