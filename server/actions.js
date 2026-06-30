const crypto = require('node:crypto');
const { getData, setData, createBackup } = require('./db');
const { createDataHealthReportFromData } = require('./data-health');

function today() {
    return new Date().toISOString().slice(0, 10);
}

function nowIso() {
    return new Date().toISOString();
}

function createId(prefix) {
    return `${prefix}_${crypto.randomUUID()}`;
}

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getStudentStatusForSnapshot(status) {
    return status || 'active';
}

function isCurrentClassStudent(student) {
    return student && (student.status === 'active' || student.status === 'renewalPending' || !student.status);
}

function studentHasClassHistory(student, classId) {
    return Boolean(
        student &&
        (
            student.classJoinSessions?.[classId] !== undefined ||
            student.classLeaveSessions?.[classId] !== undefined
        )
    );
}

function createArchivedClassStudentSnapshot(data, classId) {
    const ids = new Set();
    (data.students || []).forEach(student => {
        if ((student.classId === classId && isCurrentClassStudent(student)) || studentHasClassHistory(student, classId)) {
            ids.add(String(student.id));
        }
    });
    (data.attendance || []).filter(session => session.classId === classId).forEach(session => {
        Object.keys(session.records || {}).forEach(studentId => ids.add(String(studentId)));
    });
    return [...ids].map(id => {
        const student = (data.students || []).find(item => String(item.id) === id);
        return {
            id,
            name: student?.name || `未知学员(${id})`,
            grade: student?.grade || '',
            school: student?.school || '',
            status: getStudentStatusForSnapshot(student?.status)
        };
    });
}

function inferProspectGrade(prospect) {
    if (prospect.grade) return prospect.grade;
    if (prospect.intent && prospect.intent.includes('小升初')) return '六年级';
    if (prospect.intent && prospect.intent.includes('中考')) return '初三';
    return '';
}

function buildProspectRemark(prospect) {
    return [
        prospect.wechat ? `微信：${prospect.wechat}；` : '',
        prospect.source ? `来源：${prospect.source}；` : '',
        prospect.intent ? `目前成绩：${prospect.intent}` : ''
    ].join('');
}

function convertProspectToStudent(prospectId, options = {}) {
    const data = getData();
    const prospect = (data.prospects || []).find(item => String(item.id) === String(prospectId));
    if (!prospect) throw createError('意向学员不存在', 404);
    if (prospect.convertedStudentId && (data.students || []).some(student => String(student.id) === String(prospect.convertedStudentId))) {
        throw createError('该意向学员已经转为正式学员', 409);
    }

    const student = {
        id: options.studentId || createId('student'),
        name: prospect.name || '',
        gender: '',
        grade: inferProspectGrade(prospect),
        classId: prospect.classId || '',
        teacher: options.teacher || '白老师',
        enrollDate: options.enrollDate || today(),
        firstEnrollDate: options.firstEnrollDate || options.enrollDate || today(),
        phone: prospect.phone || '',
        emergencyContact: '',
        status: 'active',
        remark: buildProspectRemark(prospect)
    };

    const nextProspects = (data.prospects || []).map(item => {
        if (String(item.id) !== String(prospectId)) return item;
        return {
            ...item,
            dealStatus: 'deal',
            trialStatus: 'deal',
            classId: '',
            convertedStudentId: student.id
        };
    });
    const nextStudents = [...(data.students || []), student];
    const saved = setData({
        ...data,
        students: nextStudents,
        prospects: nextProspects,
        lastModified: nowIso()
    }, `action_convert_prospect_${prospectId}`);

    return {
        student,
        prospect: saved.prospects.find(item => String(item.id) === String(prospectId)),
        students: saved.students,
        prospects: saved.prospects,
        updatedAt: saved.lastModified
    };
}

function finishClass(classId, options = {}) {
    const data = getData();
    const target = (data.classes || []).find(item => String(item.id) === String(classId));
    if (!target) throw createError('班级不存在', 404);

    let changedStudents = 0;
    let clearedProspects = 0;
    const nextClasses = (data.classes || []).map(item => {
        if (String(item.id) !== String(classId)) return item;
        return { ...item, status: 'finished' };
    });
    const nextStudents = (data.students || []).map(student => {
        if (!options.markStudentsRenewalPending) return student;
        if (student.classId === classId && (student.status === 'active' || student.status === 'renewalPending' || !student.status)) {
            changedStudents += student.status === 'renewalPending' ? 0 : 1;
            return { ...student, status: 'renewalPending' };
        }
        return student;
    });
    const nextProspects = (data.prospects || []).map(prospect => {
        if (target.status === 'forming' && prospect.classId === classId && prospect.dealStatus !== 'deal') {
            clearedProspects += 1;
            return { ...prospect, classId: '' };
        }
        return prospect;
    });

    const saved = setData({
        ...data,
        classes: nextClasses,
        students: nextStudents,
        prospects: nextProspects,
        lastModified: nowIso()
    }, `action_finish_class_${classId}`);

    return {
        class: saved.classes.find(item => String(item.id) === String(classId)),
        classes: saved.classes,
        students: saved.students,
        prospects: saved.prospects,
        changedStudents,
        clearedProspects,
        updatedAt: saved.lastModified
    };
}

function saveClassWithTransitions(classItem, options = {}) {
    if (!classItem || typeof classItem !== 'object' || Array.isArray(classItem)) {
        throw createError('班级记录必须是对象', 400);
    }
    const data = getData();
    const classId = classItem.id || createId('class');
    const oldClass = (data.classes || []).find(item => String(item.id) === String(classId));
    const isNew = !oldClass;
    const oldStatus = oldClass?.status;
    const newStatus = classItem.status || 'active';
    let changedStudents = 0;
    let clearedProspects = 0;

    const nextClass = {
        ...classItem,
        id: classId,
        archived: oldClass?.archived || classItem.archived || false
    };
    if (nextClass.archived) {
        nextClass.archivedAt = oldClass?.archivedAt || classItem.archivedAt || '';
        nextClass.archivedStudentSnapshot = oldClass?.archivedStudentSnapshot || classItem.archivedStudentSnapshot || [];
    } else {
        delete nextClass.archivedAt;
    }

    const nextClasses = isNew
        ? [...(data.classes || []), nextClass]
        : (data.classes || []).map(item => String(item.id) === String(classId) ? nextClass : item);
    const nextProspects = (data.prospects || []).map(prospect => {
        if (!isNew && oldStatus === 'forming' && newStatus !== 'forming' && prospect.classId === classId && prospect.dealStatus !== 'deal') {
            clearedProspects += 1;
            return { ...prospect, classId: '' };
        }
        return prospect;
    });
    const nextStudents = (data.students || []).map(student => {
        if (!isNew && oldStatus !== 'finished' && newStatus === 'finished' && options.markStudentsRenewalPending && student.classId === classId && (student.status === 'active' || student.status === 'renewalPending' || !student.status)) {
            changedStudents += student.status === 'renewalPending' ? 0 : 1;
            return { ...student, status: 'renewalPending' };
        }
        if (!isNew && oldStatus === 'finished' && newStatus === 'active' && options.restoreStudentsActive && student.classId === classId && student.status === 'renewalPending') {
            restoredStudents += 1;
            return { ...student, status: 'active' };
        }
        return student;
    });
    const saved = setData({
        ...data,
        classes: nextClasses,
        students: nextStudents,
        prospects: nextProspects,
        lastModified: nowIso()
    }, `action_save_class_${classId}`);

    return {
        class: saved.classes.find(item => String(item.id) === String(classId)),
        classes: saved.classes,
        students: saved.students,
        prospects: saved.prospects,
        created: isNew,
        changedStudents,
        restoredStudents,
        clearedProspects,
        updatedAt: saved.lastModified
    };
}

function archiveClass(classId) {
    const data = getData();
    const target = (data.classes || []).find(item => String(item.id) === String(classId));
    if (!target) throw createError('班级不存在', 404);
    if (target.archived) throw createError('班级已归档', 409);
    if (target.status === 'active') throw createError('正常上课班级不能直接归档，请先结课或改为组班中', 409);

    let clearedProspects = 0;
    const nextClasses = (data.classes || []).map(item => {
        if (String(item.id) !== String(classId)) return item;
        return {
            ...item,
            archived: true,
            archivedAt: nowIso(),
            archivedStudentSnapshot: createArchivedClassStudentSnapshot(data, classId)
        };
    });
    const nextProspects = (data.prospects || []).map(prospect => {
        if (prospect.classId === classId && prospect.dealStatus !== 'deal') {
            clearedProspects += 1;
            return { ...prospect, classId: '' };
        }
        return prospect;
    });

    const saved = setData({
        ...data,
        classes: nextClasses,
        prospects: nextProspects,
        lastModified: nowIso()
    }, `action_archive_class_${classId}`);

    return {
        class: saved.classes.find(item => String(item.id) === String(classId)),
        classes: saved.classes,
        prospects: saved.prospects,
        clearedProspects,
        updatedAt: saved.lastModified
    };
}

function unarchiveClass(classId) {
    const data = getData();
    const target = (data.classes || []).find(item => String(item.id) === String(classId));
    if (!target) throw createError('班级不存在', 404);
    if (!target.archived) throw createError('班级已经在主列表', 409);

    const nextClasses = (data.classes || []).map(item => {
        if (String(item.id) !== String(classId)) return item;
        const next = { ...item, archived: false };
        delete next.archivedAt;
        return next;
    });
    const saved = setData({
        ...data,
        classes: nextClasses,
        lastModified: nowIso()
    }, `action_unarchive_class_${classId}`);

    return {
        class: saved.classes.find(item => String(item.id) === String(classId)),
        classes: saved.classes,
        updatedAt: saved.lastModified
    };
}

function permanentlyDeleteArchivedClass(classId) {
    const data = getData();
    const target = (data.classes || []).find(item => String(item.id) === String(classId));
    if (!target) throw createError('班级不存在', 404);
    if (!target.archived) throw createError('只能彻底删除已归档班级', 409);

    const backup = createBackup('彻底删除归档班级前自动备份');
    const removedAttendance = (data.attendance || []).filter(item => item.classId === classId).length;
    let clearedStudents = 0;
    let clearedProspects = 0;
    const nextStudents = (data.students || []).map(student => {
        let changed = false;
        const next = { ...student };
        if (next.classId === classId) {
            next.classId = '';
            changed = true;
        }
        if (next.classJoinSessions?.[classId] !== undefined) {
            next.classJoinSessions = { ...next.classJoinSessions };
            delete next.classJoinSessions[classId];
            changed = true;
        }
        if (next.classLeaveSessions?.[classId] !== undefined) {
            next.classLeaveSessions = { ...next.classLeaveSessions };
            delete next.classLeaveSessions[classId];
            changed = true;
        }
        if (changed) clearedStudents += 1;
        return next;
    });
    const nextProspects = (data.prospects || []).map(prospect => {
        if (prospect.classId === classId) {
            clearedProspects += 1;
            return { ...prospect, classId: '' };
        }
        return prospect;
    });
    const saved = setData({
        ...data,
        classes: (data.classes || []).filter(item => String(item.id) !== String(classId)),
        attendance: (data.attendance || []).filter(item => item.classId !== classId),
        students: nextStudents,
        prospects: nextProspects,
        lastModified: nowIso()
    }, `action_delete_archived_class_${classId}`);

    return {
        deletedClass: target,
        classes: saved.classes,
        attendance: saved.attendance,
        students: saved.students,
        prospects: saved.prospects,
        removedAttendance,
        clearedStudents,
        clearedProspects,
        backup,
        updatedAt: saved.lastModified
    };
}

function cleanSafeDataHealthIssues(options = {}) {
    const data = getData();
    const report = createDataHealthReportFromData(data);
    const orphanAttendanceIds = new Set(report.orphanAttendance.map(item => item.id));
    const orphanFeeIds = new Set(report.orphanFees.map(item => item.id));
    const studentIds = new Set((data.students || []).map(item => item.id));

    let removedRecordRefs = 0;
    const nextAttendance = (data.attendance || [])
        .filter(item => !orphanAttendanceIds.has(item.id))
        .map(session => {
            const records = { ...(session.records || {}) };
            Object.keys(records).forEach(studentId => {
                if (!studentIds.has(studentId)) {
                    delete records[studentId];
                    removedRecordRefs += 1;
                }
            });
            return { ...session, records };
        });
    const nextFees = (data.fees || []).filter(item => !orphanFeeIds.has(item.id));
    const summary = {
        removedAttendance: (data.attendance || []).length - nextAttendance.length,
        removedFees: (data.fees || []).length - nextFees.length,
        removedRecordRefs
    };

    if (options.dryRun) {
        return {
            dryRun: true,
            ...summary
        };
    }

    const backup = createBackup('数据体检清理前自动备份');
    const saved = setData({
        ...data,
        attendance: nextAttendance,
        fees: nextFees,
        lastModified: nowIso()
    }, 'action_clean_safe_data_health');

    return {
        ...summary,
        attendance: saved.attendance,
        fees: saved.fees,
        backup,
        updatedAt: saved.lastModified
    };
}

module.exports = {
    convertProspectToStudent,
    saveClassWithTransitions,
    finishClass,
    archiveClass,
    unarchiveClass,
    permanentlyDeleteArchivedClass,
    cleanSafeDataHealthIssues
};
