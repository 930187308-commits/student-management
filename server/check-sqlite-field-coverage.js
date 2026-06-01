const { getDb } = require('./db');

const CORE_COLLECTIONS = [
    'classes',
    'students',
    'prospects',
    'fees',
    'attendance',
    'grades',
    'communications'
];

const FIELD_MAPPINGS = {
    classes: {
        id: 'classes.id',
        name: 'classes.name',
        grade: 'classes.grade',
        classType: 'classes.class_type',
        schedule: 'classes.schedule',
        semester: 'classes.semester',
        maxStudents: 'classes.max_students',
        capacity: 'classes.max_students',
        status: 'classes.status',
        summerSchedule: 'classes.summer_schedule',
        plannedSessions: 'classes.planned_sessions',
        archived: 'classes.archived',
        archivedAt: 'classes.archived_at',
        archivedStudentSnapshot: 'classes.archived_snapshot_json'
    },
    students: {
        id: 'students.id',
        name: 'students.name',
        gender: 'students.gender',
        grade: 'students.grade',
        school: 'students.school',
        phone: 'students.phone',
        emergencyContact: 'students.emergency_contact',
        classId: 'students.class_id',
        teacher: 'students.teacher',
        status: 'students.status',
        enrollDate: 'students.enroll_date',
        firstEnrollDate: 'students.first_enroll_date',
        followUpStatus: 'students.follow_up_status',
        createdAt: 'students.created_at',
        classJoinSessions: 'students.class_join_sessions_json',
        classLeaveSessions: 'students.class_leave_sessions_json',
        remark: 'students.remark',
        archivedAt: 'students.archived_at',
        _archivedAt: 'students.archived_at'
    },
    prospects: {
        id: 'prospects.id',
        name: 'prospects.name',
        phone: 'prospects.phone',
        source: 'prospects.source',
        grade: 'prospects.grade',
        wechat: 'prospects.wechat',
        classId: 'prospects.class_id',
        intent: 'prospects.intent',
        trialDate: 'prospects.trial_date',
        trialStatus: 'prospects.trial_status',
        dealStatus: 'prospects.deal_status',
        remark: 'prospects.remark',
        createDate: 'prospects.create_date',
        convertedStudentId: 'prospects.converted_student_id'
    },
    fees: {
        id: 'fees.id',
        studentId: 'fees.student_id',
        studentName: 'fees.student_name',
        amount: 'fees.amount',
        hours: 'fees.hours',
        pricePerHour: 'fees.price_per_hour',
        paymentDate: 'fees.payment_date',
        paymentMethod: 'fees.payment_method',
        package: 'fees.package_name',
        status: 'fees.status',
        remark: 'fees.remark'
    },
    attendance: {
        id: 'attendance_sessions.id',
        classId: 'attendance_sessions.class_id',
        date: 'attendance_sessions.date',
        sessionName: 'attendance_sessions.session_name',
        name: 'attendance_sessions.session_name',
        records: 'attendance_records'
    },
    grades: {
        id: 'grades.id',
        studentId: 'grades.student_id',
        studentName: 'grades.student_name',
        classId: 'grades.class_id',
        testName: 'grades.test_name',
        testDate: 'grades.test_date',
        examType: 'grades.exam_type',
        score: 'grades.score',
        fullScore: 'grades.full_score',
        ranking: 'grades.ranking',
        weakPoints: 'grades.weak_points',
        remark: 'grades.remark'
    },
    communications: {
        id: 'communications.id',
        studentId: 'communications.student_id',
        studentName: 'communications.student_name',
        topicId: 'communications.topic_id',
        contactType: 'communications.contact_type',
        contactPerson: 'communications.contact_person',
        contactDate: 'communications.contact_date',
        teacher: 'communications.teacher',
        status: 'communications.status',
        content: 'communications.content',
        followUp: 'communications.follow_up'
    }
};

const NEXT_COLUMN_CANDIDATES = {
    classes: [
        'plannedSessions',
        'archived',
        'archivedAt',
        'archivedStudentSnapshot'
    ],
    students: [
        'firstEnrollDate',
        'followUpStatus',
        'classJoinSessions',
        'classLeaveSessions'
    ],
    prospects: [
        'grade',
        'wechat',
        'classId'
    ],
    fees: [
        'studentName'
    ],
    attendance: [
        'temporaryStudents'
    ],
    grades: [
        'studentName'
    ],
    communications: [
        'studentName',
        'topicName'
    ]
};

function parseData() {
    const row = getDb().prepare('SELECT value FROM app_state WHERE key = ?').get('data');
    if (!row) return {};
    return JSON.parse(row.value);
}

function collectFields(items) {
    const fields = new Map();
    items.forEach(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        Object.keys(item).forEach(field => {
            fields.set(field, (fields.get(field) || 0) + 1);
        });
    });
    return fields;
}

function summarizeCollection(collectionName, items) {
    const fieldCounts = collectFields(items);
    const mapping = FIELD_MAPPINGS[collectionName] || {};
    const observedFields = [...fieldCounts.keys()].sort();
    const coveredFields = observedFields
        .filter(field => mapping[field])
        .map(field => ({
            field,
            column: mapping[field],
            count: fieldCounts.get(field)
        }));
    const rawOnlyFields = observedFields
        .filter(field => !mapping[field])
        .map(field => ({
            field,
            count: fieldCounts.get(field),
            nextColumnCandidate: (NEXT_COLUMN_CANDIDATES[collectionName] || []).includes(field)
        }));
    return {
        count: items.length,
        observedFieldCount: observedFields.length,
        coveredFieldCount: coveredFields.length,
        rawOnlyFieldCount: rawOnlyFields.length,
        coveredFields,
        rawOnlyFields
    };
}

function buildRecommendations(coverage) {
    return Object.entries(NEXT_COLUMN_CANDIDATES).flatMap(([collectionName, fields]) => {
        const rawOnlyFields = new Set((coverage[collectionName]?.rawOnlyFields || []).map(row => row.field));
        return fields
            .filter(field => rawOnlyFields.has(field))
            .map(field => ({
                collection: collectionName,
                field,
                reason: '当前真实数据中存在，且还只保存在 raw_json 中'
            }));
    });
}

function main() {
    const data = parseData();
    const coverage = {};
    CORE_COLLECTIONS.forEach(collectionName => {
        const items = Array.isArray(data[collectionName]) ? data[collectionName] : [];
        coverage[collectionName] = summarizeCollection(collectionName, items);
    });

    const recommendations = buildRecommendations(coverage);
    const summary = {
        ok: true,
        checkedAt: new Date().toISOString(),
        collections: Object.fromEntries(Object.entries(coverage).map(([collectionName, row]) => [collectionName, {
            rows: row.count,
            observedFieldCount: row.observedFieldCount,
            coveredFieldCount: row.coveredFieldCount,
            rawOnlyFieldCount: row.rawOnlyFieldCount
        }])),
        recommendationCount: recommendations.length
    };

    console.log(JSON.stringify({
        summary,
        coverage,
        recommendations
    }, null, 2));
}

main();
