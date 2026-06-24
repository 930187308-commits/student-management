function safeText(value, max = 200) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeLongText(value, max = 1200) {
    return String(value || '').replace(/\r/g, '').trim().slice(0, max);
}

function maskStudentName(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    if (value.length <= 1) return `${value}*`;
    return `${value[0]}${'*'.repeat(Math.min(value.length - 1, 2))}`;
}

function displayName(name, privacyMode) {
    return privacyMode === 'named' ? String(name || '') : maskStudentName(name);
}

function getStudentConsumption(data, studentId) {
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const totalHours = fees
        .filter(fee => fee.studentId === studentId && fee.status === 'paid')
        .reduce((sum, fee) => sum + Number(fee.hours || 0), 0);
    let usedHours = 0;
    let absentHours = 0;
    attendance.forEach(session => {
        const status = session.records?.[studentId];
        if (status === 1) usedHours += 1;
        else if (status === 0) absentHours += 1;
    });
    return {
        totalHours,
        usedHours,
        absentHours,
        remainingHours: totalHours - usedHours
    };
}

function normalizeAnswerLength(value) {
    return value === 'detailed' ? 'detailed' : 'brief';
}

function normalizeSourceScope(payload) {
    const raw = payload?.sourceScope || {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (
        !Object.prototype.hasOwnProperty.call(raw, 'systemData') &&
        !Object.prototype.hasOwnProperty.call(raw, 'knowledgeBase') &&
        !Object.prototype.hasOwnProperty.call(raw, 'webSearch')
    )) {
        return { systemData: true, knowledgeBase: false, webSearch: false };
    }
    const scope = {
        systemData: Boolean(raw.systemData),
        knowledgeBase: Boolean(raw.knowledgeBase),
        webSearch: Boolean(raw.webSearch)
    };
    if (!scope.systemData && !scope.knowledgeBase && !scope.webSearch) scope.systemData = true;
    return scope;
}

function extractLatestSystemQAQuestion(payload) {
    if (payload.latestQuestion) return safeLongText(payload.latestQuestion, 2000);
    const text = safeLongText(payload.userInstruction || payload.input || '', 2000);
    const marker = '用户最新问题：';
    const index = text.lastIndexOf(marker);
    if (index >= 0) return text.slice(index + marker.length).trim();
    return text.trim();
}

function getSystemQAFactQuestion(latestQuestion, payload) {
    const latest = safeText(latestQuestion, 300);
    const isFollowUp = /^(按|分|展开|全部|详细|简单|名单|列出|继续|第\d+|说得)/.test(normalizeComparableText(latest)) ||
        /(按班级|分组|展开|详细|全部|名单)/.test(latest);
    if (!isFollowUp) return latest;
    const history = Array.isArray(payload.conversationHistory) ? payload.conversationHistory : [];
    const previousUser = [...history].reverse().find(item => item?.role === 'user' && item.content);
    return previousUser ? `${safeText(previousUser.content, 300)} ${latest}` : latest;
}

function normalizeComparableText(value) {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function includesAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}

function findMatchedStudents(question, students) {
    const normalizedQuestion = normalizeComparableText(question);
    return students.filter(student => {
        const name = normalizeComparableText(student.name);
        return name && normalizedQuestion.includes(name);
    });
}

function findMatchedClass(question, classRows) {
    const normalizedQuestion = normalizeComparableText(question);
    const cleaned = normalizedQuestion.replace(/有哪些学生|哪些学生|学生|学员|成员|班级|班|课次|进度|计划|已登记|结课|上课时间|情况|怎么样|课消|消课|上课/g, '');
    return classRows.find(cls => {
        const name = normalizeComparableText(cls.name);
        return name && (normalizedQuestion.includes(name) || (cleaned && name.includes(cleaned)));
    }) || null;
}

function filterRowsByQuestionMonth(rows, question, dateGetter) {
    const month = getConsumptionQueryMonth(question);
    if (!month) return { month: '', rows };
    return {
        month,
        rows: rows.filter(row => String(dateGetter(row) || '').startsWith(month))
    };
}

function isSystemQAWriteIntent(question) {
    const text = normalizeComparableText(question);
    return /(新增|添加|创建|新建|修改|编辑|更新|删除|清空|归档|停课|转正式|转成交|导入|补录|生成并保存|自动保存|发给|发送给|群发)/.test(text) &&
        /(学员|学生|班级|收费|缴费|欠费|考勤|成绩|沟通|意向|记录|资料|题目|待办)/.test(text);
}

function isSystemQAAdviceIntent(question) {
    const text = normalizeComparableText(question);
    if (!text) return false;
    if (/(怎么|如何|怎样|方案|建议|流程|准备|规划|设计|安排|开|组织|策划|复盘|分析一下|帮我想|帮我写)/.test(text) &&
        /(家长会|招生|续费|沟通|反馈|课程|课堂|教学|教研|小升初|中考|升学|讲座|会议|活动|内容|文章|视频|朋友圈|公众号)/.test(text)) {
        return true;
    }
    return false;
}

function wantsSystemDataForAdvice(question) {
    const text = normalizeComparableText(question);
    if (!text) return false;
    return /(结合我的|结合系统|根据系统|按班级|按学员|按学生|按年级|结合数据|看一下我的|从系统里|基于系统|基于当前数据)/.test(text);
}

function buildSystemQAWriteIntentAnswer(question) {
    if (!isSystemQAWriteIntent(question)) return '';
    return [
        '我不能直接替你新增、修改、删除或发送系统数据。',
        '目前 AI 对话是只读助手，只能帮你查询、核对、整理建议。',
        '你可以让我先生成草稿或操作建议，然后你到对应模块手动确认。'
    ].join('\n');
}

function buildNoEvidenceSystemQAAnswer(context) {
    if (context.task !== 'system-qa') return '';
    const sourceScope = context.sourceScope || {};
    const refs = context.knowledge?.refs || [];
    const webResults = context.knowledge?.webResults || [];
    const warnings = context.knowledge?.warnings || [];
    const hasExternalScope = sourceScope.knowledgeBase || sourceScope.webSearch;
    if (sourceScope.systemData) return '';
    if (!hasExternalScope) return '这次没有选择任何可读取依据，我不能乱答。请勾选“系统”“资料库”或“联网”后再问。';
    const factualRefs = refs.filter(ref => !['style', 'style-sample'].includes(ref.refType));
    if (factualRefs.length || webResults.length) return '';
    const warningText = warnings.length ? `\n本次提示：${warnings.join('；')}` : '';
    return `当前没有可引用的资料或联网结果，我不能凭空整理。${warningText}\n建议先导入资料库，或稍后重新尝试联网。`;
}

function extractScoreQuery(question) {
    const text = normalizeComparableText(question);
    if (!text) return null;
    if (/(沟通|联系|反馈|跟进|通过什么|怎么通过)/.test(text)) return null;
    if (/(不及格|未及格|低于及格|没及格)/.test(text)) return { type: 'below-score', score: 60, label: '不及格' };
    if (/(优秀|高分)/.test(text)) return { type: 'at-least-score', score: 90, label: '不低于90分' };
    if (/(及格|通过)/.test(text) && !/(不及格|未及格|没及格)/.test(text)) return { type: 'at-least-score', score: 60, label: '不低于60分' };
    const aboveSuffix = text.match(/(\d+(?:\.\d+)?)分?(?:以上|及以上)/);
    if (aboveSuffix) return { type: 'at-least-score', score: Number(aboveSuffix[1]), label: `不低于${aboveSuffix[1]}分` };
    const belowSuffix = text.match(/(\d+(?:\.\d+)?)分?(?:以下|以内)/);
    if (belowSuffix) return { type: 'at-most-score', score: Number(belowSuffix[1]), label: `不高于${belowSuffix[1]}分` };
    const atLeastScore = text.match(/(?:不低于|不少于|至少|大于等于|高于等于)(\d+(?:\.\d+)?)(?:分)?/);
    if (atLeastScore) return { type: 'at-least-score', score: Number(atLeastScore[1]), label: `不低于${atLeastScore[1]}分` };
    const atMostScore = text.match(/(?:不高于|不超过|至多|小于等于|低于等于)(\d+(?:\.\d+)?)(?:分)?/);
    if (atMostScore) return { type: 'at-most-score', score: Number(atMostScore[1]), label: `不高于${atMostScore[1]}分` };
    const belowScore = text.match(/(?:低于|小于|少于|不到|不满)(\d+(?:\.\d+)?)(?:分)?/);
    if (belowScore) return { type: 'below-score', score: Number(belowScore[1]), label: `低于${belowScore[1]}分` };
    const aboveScore = text.match(/(?:高于|大于|超过|超出)(\d+(?:\.\d+)?)(?:分)?/);
    if (aboveScore) return { type: 'above-score', score: Number(aboveScore[1]), label: `高于${aboveScore[1]}分` };
    const explicitScore = text.match(/(?:考|分数|得分|成绩)?(\d+(?:\.\d+)?)分/);
    const bareScore = text.match(/(?:考|分数|得分|成绩)(\d+(?:\.\d+)?)/);
    if (explicitScore || bareScore) {
        return { type: 'exact-score', score: Number((explicitScore || bareScore)[1]) };
    }
    if (text.includes('满分')) return { type: 'full-score' };
    return null;
}

function buildScoreQueryFacts({ question, grades, studentsById, classesById, privacyMode }) {
    const scoreQuery = extractScoreQuery(question);
    if (!scoreQuery) return null;
    const compactQuestion = normalizeComparableText(question);
    const matches = grades.filter(item => {
        const score = Number(item.score);
        const fullScore = Number(item.fullScore);
        let scoreMatched = false;
        if (scoreQuery.type === 'full-score') {
            scoreMatched = Number.isFinite(score) && Number.isFinite(fullScore) && score === fullScore;
        } else if (scoreQuery.type === 'below-score') {
            scoreMatched = Number.isFinite(score) && score < scoreQuery.score;
        } else if (scoreQuery.type === 'above-score') {
            scoreMatched = Number.isFinite(score) && score > scoreQuery.score;
        } else if (scoreQuery.type === 'at-least-score') {
            scoreMatched = Number.isFinite(score) && score >= scoreQuery.score;
        } else if (scoreQuery.type === 'at-most-score') {
            scoreMatched = Number.isFinite(score) && score <= scoreQuery.score;
        } else {
            scoreMatched = Number.isFinite(score) && score === scoreQuery.score;
        }
        if (!scoreMatched) return false;
        const testName = normalizeComparableText(item.testName);
        if (isTestNameRelevantToQuestion(testName, compactQuestion)) return true;
        const questionHasLikelyTestFilter = ['期中', '期末', '月考', '周测', '单元', '模拟', '中考'].some(label => compactQuestion.includes(label));
        if (!questionHasLikelyTestFilter) return true;
        return false;
    }).map(item => {
        const student = studentsById.get(item.studentId);
        const cls = classesById.get(item.classId || student?.classId);
        return {
            studentName: displayName(item.studentName || student?.name || '', privacyMode),
            studentStatus: student?.status || '',
            studentGrade: student?.grade || '',
            className: cls?.name || '',
            testName: item.testName || '',
            testDate: item.testDate || '',
            score: item.score ?? '',
            fullScore: item.fullScore ?? '',
            ranking: item.ranking ?? '',
            weakPoints: safeText(item.weakPoints, 120),
            remark: safeText(item.remark, 120)
        };
    }).sort((a, b) => String(b.testDate).localeCompare(String(a.testDate)));
    return {
        type: scoreQuery.type,
        label: scoreQuery.label || '',
        score: scoreQuery.score ?? '',
        total: matches.length,
        matches
    };
}

function isTestNameRelevantToQuestion(testName, compactQuestion) {
    if (!testName) return false;
    if (compactQuestion.includes(testName)) return true;
    const likelyTestKeywords = ['期中', '期末', '月考', '周测', '单元', '模拟', '中考', '小测', '测试', '考试'];
    return likelyTestKeywords.some(keyword => compactQuestion.includes(keyword) && testName.includes(keyword));
}

function getSchoolHistoryForAI(student) {
    const history = student.schoolHistory || {};
    const fallback = String(student.school || '').trim();
    const normalized = {
        primarySchool: String(history.primarySchool || '').trim(),
        middleSchool: String(history.middleSchool || '').trim(),
        highSchool: String(history.highSchool || '').trim()
    };
    if (fallback) {
        const stage = getGradeStage(student.grade);
        if (stage === 'primary' && !normalized.primarySchool) normalized.primarySchool = fallback;
        if (stage === 'middle' && !normalized.middleSchool) normalized.middleSchool = fallback;
        if (stage === 'high' && !normalized.highSchool) normalized.highSchool = fallback;
    }
    return normalized;
}

function getGradeStage(grade) {
    const value = String(grade || '').trim();
    if (['五年级', '六年级'].includes(value)) return 'primary';
    if (['初一', '初二', '初三'].includes(value)) return 'middle';
    if (['高一', '高二', '高三'].includes(value)) return 'high';
    return '';
}

function getCurrentStageSchoolForAI(student) {
    const history = getSchoolHistoryForAI(student);
    const stage = getGradeStage(student.grade);
    if (stage === 'primary') return { stage, stageText: '小学', school: history.primarySchool || '' };
    if (stage === 'middle') return { stage, stageText: '初中', school: history.middleSchool || '' };
    if (stage === 'high') return { stage, stageText: '高中', school: history.highSchool || '' };
    return { stage: '', stageText: '未判断', school: '' };
}

function buildStudentSummaryForAI({ student, classesById, pendingFees, privacyMode }) {
    const consumption = getStudentConsumption({ fees: [], attendance: [] }, student.id);
    const cls = classesById.get(student.classId);
    const schoolHistory = getSchoolHistoryForAI(student);
    const currentSchool = getCurrentStageSchoolForAI(student);
    const pendingFee = pendingFees
        .filter(fee => fee.studentId === student.id)
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    return {
        id: student.id,
        name: displayName(student.name, privacyMode),
        gender: student.gender || '',
        grade: student.grade || '',
        status: student.status || '',
        phone: privacyMode === 'named' ? (student.phone || '') : '',
        teacher: student.teacher || '',
        enrollDate: student.enrollDate || '',
        firstEnrollDate: student.firstEnrollDate || '',
        firstEnrollGrade: student.firstEnrollGrade || '',
        remark: safeText(student.remark, 180),
        legacySchool: student.school || '',
        schoolHistory,
        currentSchool,
        classId: student.classId || '',
        className: cls?.name || '未分班',
        classStatus: cls?.status || '',
        classSchedule: cls?.schedule || '',
        classPlannedSessions: Number(cls?.plannedSessions || 0),
        pendingFeeAmount: pendingFee,
        totalHours: consumption.totalHours,
        usedHours: consumption.usedHours,
        absentHours: consumption.absentHours,
        remainingHours: consumption.remainingHours
    };
}

function enrichStudentSummaryWithConsumption(studentRow, data, studentId) {
    const consumption = getStudentConsumption(data, studentId);
    return {
        ...studentRow,
        totalHours: consumption.totalHours,
        usedHours: consumption.usedHours,
        absentHours: consumption.absentHours,
        remainingHours: consumption.remainingHours
    };
}

function buildStudentLookupFacts({ question, students, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!normalizedQuestion) return null;
    const matches = students.map((student, index) => ({ raw: student, summary: studentRows[index] }))
        .filter(item => findMatchedStudents(question, [item.raw]).length)
        .map(item => item.summary);
    if (!matches.length) return null;
    return { total: matches.length, matches };
}

function buildStudentSchoolFacts({ question, students, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!normalizedQuestion || !normalizedQuestion.includes('学校')) return null;
    const byStudent = students.map((student, index) => ({ raw: student, summary: studentRows[index] })).filter(item => {
        const name = normalizeComparableText(item.raw.name);
        return name && normalizedQuestion.includes(name);
    }).map(item => item.summary);
    if (byStudent.length) {
        return { type: 'student-school', total: byStudent.length, matches: byStudent };
    }
    const schoolQuery = normalizedQuestion
        .replace(/有哪些学生|哪些学生|学生|学员|学校|的|在读|名单|都有谁|有谁|哪些人|多少人/g, '');
    const schoolMatches = studentRows.filter(student => {
        const schools = [
            student.currentSchool?.school,
            student.schoolHistory?.primarySchool,
            student.schoolHistory?.middleSchool,
            student.schoolHistory?.highSchool,
            student.legacySchool
        ].filter(Boolean);
        return schools.some(school => {
            const normalizedSchool = normalizeComparableText(school);
            return normalizedSchool && (
                normalizedQuestion.includes(normalizedSchool) ||
                (schoolQuery && normalizedSchool.includes(schoolQuery)) ||
                (schoolQuery && schoolQuery.includes(normalizedSchool))
            );
        });
    });
    if (!schoolMatches.length) return null;
    return { type: 'school-students', total: schoolMatches.length, matches: schoolMatches };
}

function buildClassMemberFacts({ question, classRows, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!normalizedQuestion || !/(班|班级|学员|学生|成员)/.test(normalizedQuestion)) return null;
    const targetClass = findMatchedClass(question, classRows);
    if (!targetClass) return null;
    const matches = studentRows.filter(student => student.classId === targetClass.id);
    return { className: targetClass.name, total: matches.length, matches };
}

function buildClassProgressFacts({ question, classRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(班级|班|课次|进度|计划|已登记|结课|上课时间)/.test(normalizedQuestion)) return null;
    let rows = classRows;
    const targetClass = findMatchedClass(question, classRows);
    if (targetClass) rows = [targetClass];
    if (/(正常|在上|active)/.test(normalizedQuestion)) rows = rows.filter(cls => cls.status === 'active');
    if (/(组班|forming)/.test(normalizedQuestion)) rows = rows.filter(cls => cls.status === 'forming');
    if (/(结课|已结课|finished)/.test(normalizedQuestion)) rows = rows.filter(cls => cls.status === 'finished');
    if (!targetClass && !/(班级|课次|进度|计划|已登记|结课)/.test(normalizedQuestion)) return null;
    return {
        total: rows.length,
        matches: rows.map(cls => ({
            name: cls.name,
            grade: cls.grade,
            status: cls.status,
            schedule: cls.schedule,
            plannedSessions: cls.plannedSessions,
            recordedSessions: cls.recordedSessions,
            remainingSessions: Number(cls.plannedSessions || 0) ? Number(cls.plannedSessions || 0) - Number(cls.recordedSessions || 0) : '',
            studentCount: cls.studentCount
        }))
    };
}

function extractGradeFromQuestion(question) {
    const grades = ['五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];
    const compact = normalizeComparableText(question);
    return grades.find(grade => compact.includes(normalizeComparableText(grade))) || '';
}

function buildGradeStudentFacts({ question, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (/(意向|线索|试听)/.test(normalizedQuestion)) return null;
    if (isSystemQAAdviceIntent(question)) return null;
    const grade = extractGradeFromQuestion(question);
    if (!grade || !/(多少|几人|几名|人数|名单|哪些|都有谁|有谁|列出|在读)/.test(normalizedQuestion)) return null;
    const activeOnly = normalizedQuestion.includes('在读') || !/(非在读|停课|待续费)/.test(normalizedQuestion);
    const matches = studentRows
        .filter(student => student.grade === grade)
        .filter(student => activeOnly ? student.status === 'active' : true);
    return {
        grade,
        status: activeOnly ? 'active' : 'all',
        total: matches.length,
        matches
    };
}

function buildFeeRiskFacts({ question, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(欠费|续费|课时不足|课时快不够|没课时|无收费)/.test(normalizedQuestion)) return null;
    const matches = studentRows
        .filter(student => student.status === 'active' && (student.pendingFeeAmount > 0 || student.remainingHours <= 2 || student.totalHours === 0))
        .sort((a, b) => a.remainingHours - b.remainingHours);
    return { total: matches.length, matches };
}

function buildPendingFeeFacts({ question, fees, studentsById, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(待收款|欠费|未缴|未付款|待付款|应收|补缴|补交|补费)/.test(normalizedQuestion)) return null;
    const targetIds = new Set([...studentsById.values()]
        .filter(student => normalizeComparableText(student.name) && normalizedQuestion.includes(normalizeComparableText(student.name)))
        .map(student => student.id));
    const matches = fees
        .filter(fee => fee.status === 'pending')
        .filter(fee => !targetIds.size || targetIds.has(fee.studentId))
        .map(fee => {
            const student = studentsById.get(fee.studentId);
            const cls = classesById.get(student?.classId);
            return {
                studentName: displayName(fee.studentName || student?.name || '', privacyMode),
                studentGrade: student?.grade || '',
                studentStatus: student?.status || '',
                className: cls?.name || '',
                amount: Number(fee.amount || 0),
                hours: Number(fee.hours || 0),
                paymentDate: fee.paymentDate || '',
                remark: safeText(fee.remark, 120)
            };
        })
        .sort((a, b) => b.amount - a.amount);
    return {
        total: matches.length,
        totalAmount: matches.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        matches
    };
}

function buildFeeSummaryFacts({ question, fees, studentsById, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(收费|缴费|收款|收入|收了多少|收了多少钱|已缴|付款|费用)/.test(normalizedQuestion)) return null;
    if (/(欠费|待收款|未缴|未付款|应收|补缴|补交|补费)/.test(normalizedQuestion)) return null;

    const targetStudents = findMatchedStudents(question, [...studentsById.values()]);
    const targetIds = new Set(targetStudents.map(student => student.id));
    const { month, rows: monthRows } = filterRowsByQuestionMonth(fees, question, fee => fee.paymentDate);
    let rows = month ? monthRows : fees;
    rows = rows.filter(fee => fee.status === 'paid');
    if (targetIds.size) rows = rows.filter(fee => targetIds.has(fee.studentId));

    const matches = rows.map(fee => {
        const student = studentsById.get(fee.studentId);
        const cls = classesById.get(student?.classId);
        return {
            studentName: displayName(fee.studentName || student?.name || '', privacyMode),
            studentGrade: student?.grade || '',
            className: cls?.name || '',
            amount: Number(fee.amount || 0),
            hours: Number(fee.hours || 0),
            paymentDate: fee.paymentDate || '',
            package: fee.package || '',
            remark: safeText(fee.remark, 120)
        };
    }).sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));

    return {
        month,
        total: matches.length,
        totalAmount: matches.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        totalHours: matches.reduce((sum, item) => sum + Number(item.hours || 0), 0),
        matches
    };
}

function buildFocusStudentFacts({ question, studentRows }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(需要关注|重点关注|风险|异常|优先跟进)/.test(normalizedQuestion)) return null;
    const matches = studentRows
        .filter(student => student.status === 'active')
        .filter(student => student.pendingFeeAmount > 0 || student.remainingHours <= 2 || student.totalHours === 0)
        .map(student => ({
            ...student,
            reasons: [
                student.pendingFeeAmount > 0 ? `欠费 ${student.pendingFeeAmount} 元` : '',
                student.remainingHours < 0 ? `课时余额为负 ${student.remainingHours}` : '',
                student.remainingHours >= 0 && student.remainingHours <= 2 ? `剩余课时 ${student.remainingHours}` : '',
                student.totalHours === 0 ? '无已缴课时记录' : ''
            ].filter(Boolean)
        }))
        .sort((a, b) => {
            if (b.pendingFeeAmount !== a.pendingFeeAmount) return b.pendingFeeAmount - a.pendingFeeAmount;
            return a.remainingHours - b.remainingHours;
        });
    return { total: matches.length, matches };
}

function buildStudentGradeFacts({ question, students, grades, studentsById, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(成绩|考试|分数|薄弱|排名)/.test(normalizedQuestion)) return null;
    const targets = findMatchedStudents(question, students);
    if (!targets.length) return null;
    const targetIds = new Set(targets.map(student => student.id));
    const matches = grades
        .filter(grade => targetIds.has(grade.studentId))
        .map(item => {
            const student = studentsById.get(item.studentId);
            const cls = classesById.get(item.classId || student?.classId);
            return {
                studentName: displayName(item.studentName || student?.name || '', privacyMode),
                studentGrade: student?.grade || '',
                className: cls?.name || '',
                testName: item.testName || '',
                testDate: item.testDate || '',
                score: item.score ?? '',
                fullScore: item.fullScore ?? '',
                ranking: item.ranking ?? '',
                weakPoints: safeText(item.weakPoints, 160),
                remark: safeText(item.remark, 160)
            };
        })
        .sort((a, b) => String(b.testDate).localeCompare(String(a.testDate)));
    return { total: matches.length, matches };
}

function buildStudentAttendanceFacts({ question, students, attendance, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(上了几次课|上课几次|出勤几次|请假几次|考勤|课消|已消课时)/.test(normalizedQuestion)) return null;
    const targets = findMatchedStudents(question, students);
    if (!targets.length) return null;
    const month = getConsumptionQueryMonth(question);
    const matches = targets.map(student => {
        let present = 0;
        let absent = 0;
        const sessions = [];
        const targetAttendance = month ? attendance.filter(session => String(session.date || '').startsWith(month)) : attendance;
        targetAttendance.forEach(session => {
            const value = session.records?.[student.id];
            if (value === 1 || value === 0) {
                if (value === 1) present += 1;
                if (value === 0) absent += 1;
                sessions.push({
                    date: session.date || '',
                    className: classesById.get(session.classId)?.name || '',
                    lessonName: session.lessonName || session.name || '',
                    status: value === 1 ? '出勤' : '请假'
                });
            }
        });
        return {
            studentName: displayName(student.name, privacyMode),
            month,
            grade: student.grade || '',
            className: classesById.get(student.classId)?.name || '未分班',
            present,
            absent,
            recorded: present + absent,
            sessions: sessions.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 20)
        };
    });
    return { total: matches.length, matches };
}

function getConsumptionQueryMonth(question) {
    const normalizedQuestion = normalizeComparableText(question);
    const now = new Date();
    const toMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (/(上个月|上月|上一月)/.test(normalizedQuestion)) {
        return toMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    }
    const explicitYearMonth = normalizedQuestion.match(/(20\d{2})[-年/.]?(1[0-2]|0?[1-9])月?/);
    if (explicitYearMonth) {
        return `${explicitYearMonth[1]}-${String(Number(explicitYearMonth[2])).padStart(2, '0')}`;
    }
    const explicitMonth = normalizedQuestion.match(/(^|[^0-9])(1[0-2]|0?[1-9])月/);
    if (explicitMonth) {
        return `${now.getFullYear()}-${String(Number(explicitMonth[2])).padStart(2, '0')}`;
    }
    if (/(本月|这个月|月度)/.test(normalizedQuestion)) return toMonth(now);
    return '';
}

function buildMonthlyConsumptionFacts({ question, attendance, classesById }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(课消|消课|上课|考勤|课次)/.test(normalizedQuestion)) return null;
    const month = getConsumptionQueryMonth(question) || ((/(课消|消课).*(情况|怎么样|统计|概览|汇总)?$/.test(normalizedQuestion)) ? (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })() : '');
    if (!month) return null;
    const classRows = [...classesById.values()].map(cls => ({
        id: cls.id,
        name: cls.name || '',
        grade: cls.grade || '',
        status: cls.status || '',
        schedule: cls.schedule || ''
    }));
    const targetClass = findMatchedClass(question, classRows);
    const sessions = attendance
        .filter(session => String(session.date || '').startsWith(month))
        .filter(session => !targetClass || session.classId === targetClass.id);
    const classMap = new Map();
    let presentTotal = 0;
    let absentTotal = 0;
    sessions.forEach(session => {
        const className = classesById.get(session.classId)?.name || '未知班级';
        const present = Object.values(session.records || {}).filter(value => value === 1).length;
        const absent = Object.values(session.records || {}).filter(value => value === 0).length;
        presentTotal += present;
        absentTotal += absent;
        const row = classMap.get(className) || { className, sessions: 0, present: 0, absent: 0 };
        row.sessions += 1;
        row.present += present;
        row.absent += absent;
        classMap.set(className, row);
    });
    return {
        month,
        className: targetClass?.name || '',
        sessionCount: sessions.length,
        presentTotal,
        absentTotal,
        classes: [...classMap.values()].sort((a, b) => b.present - a.present)
    };
}

function buildStudentFeeFacts({ question, students, fees, attendance, studentsById, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(收费|缴费|欠费|待收款|课时|余额|剩余|已缴|费用)/.test(normalizedQuestion)) return null;
    const targets = findMatchedStudents(question, students);
    if (!targets.length) return null;
    const targetIds = new Set(targets.map(student => student.id));
    const matches = targets.map(student => {
        const cls = classesById.get(student.classId);
        const relatedFees = fees.filter(fee => fee.studentId === student.id);
        const paidFees = relatedFees.filter(fee => fee.status === 'paid');
        const pendingFees = relatedFees.filter(fee => fee.status === 'pending');
        const consumption = getStudentConsumption({ fees, attendance }, student.id);
        return {
            studentName: displayName(student.name, privacyMode),
            grade: student.grade || '',
            status: student.status || '',
            className: cls?.name || '未分班',
            totalPaidAmount: paidFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
            totalPaidHours: paidFees.reduce((sum, fee) => sum + Number(fee.hours || 0), 0),
            usedHours: consumption.usedHours,
            absentHours: consumption.absentHours,
            remainingHours: consumption.remainingHours,
            pendingAmount: pendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
            pendingHours: pendingFees.reduce((sum, fee) => sum + Number(fee.hours || 0), 0),
            feeCount: relatedFees.length,
            latestFees: relatedFees
                .map(fee => ({
                    paymentDate: fee.paymentDate || '',
                    status: fee.status || '',
                    amount: Number(fee.amount || 0),
                    hours: Number(fee.hours || 0),
                    package: fee.package || '',
                    remark: safeText(fee.remark, 120)
                }))
                .sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)))
                .slice(0, 8)
        };
    });
    return {
        total: matches.length,
        matchedStudentIds: [...targetIds],
        matches
    };
}

function buildCommunicationFacts({ question, students, communications, studentsById, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(沟通|跟进|联系|反馈|家长)/.test(normalizedQuestion)) return null;
    const targets = findMatchedStudents(question, students);
    const targetIds = new Set(targets.map(student => student.id));
    let rows = communications.filter(item => !targetIds.size || targetIds.has(item.studentId));
    if (/(待沟通|待跟进|未沟通)/.test(normalizedQuestion)) {
        rows = rows.filter(item => ['pending', 'todo', '待沟通', '待跟进'].includes(String(item.status || '')));
    }
    const monthFilter = filterRowsByQuestionMonth(rows, question, item => item.contactDate);
    rows = monthFilter.rows;
    rows = rows.map(item => {
        const student = studentsById.get(item.studentId);
        const cls = classesById.get(student?.classId);
        return {
            studentName: displayName(item.studentName || student?.name || '', privacyMode),
            studentGrade: student?.grade || '',
            className: cls?.name || '',
            contactDate: item.contactDate || '',
            contactType: item.contactType || '',
            contactPerson: item.contactPerson || '',
            status: item.status || '',
            content: safeText(item.content, 180),
            followUp: safeText(item.followUp, 180)
        };
    }).sort((a, b) => String(b.contactDate).localeCompare(String(a.contactDate)));
    if (!rows.length && targetIds.size) return { month: monthFilter.month, total: 0, matches: [] };
    if (!targetIds.size && !/(最近|待沟通|待跟进|沟通记录|联系记录)/.test(normalizedQuestion)) return null;
    return { month: monthFilter.month, total: rows.length, matches: rows.slice(0, 50) };
}

function getProspectContactLogs(prospect) {
    return Array.isArray(prospect?.contactLogs)
        ? prospect.contactLogs
            .filter(log => log && typeof log === 'object')
            .slice()
            .sort((a, b) => String(b.contactDate || b.createdAt || '').localeCompare(String(a.contactDate || a.createdAt || '')))
        : [];
}

function buildProspectFacts({ question, prospects, classesById, privacyMode }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(意向|线索|试听|成交|组班|来源|微信|咨询|接触|沟通|跟进)/.test(normalizedQuestion)) return null;
    let rows = prospects;
    const nameMatches = prospects.filter(item => normalizeComparableText(item.name) && normalizedQuestion.includes(normalizeComparableText(item.name)));
    if (nameMatches.length) rows = nameMatches;
    const grade = extractGradeFromQuestion(question);
    if (grade) rows = rows.filter(item => item.grade === grade);
    if (/(未成交|待跟进)/.test(normalizedQuestion)) rows = rows.filter(item => item.dealStatus !== 'deal');
    if (/(已成交|成交)/.test(normalizedQuestion) && !/(未成交)/.test(normalizedQuestion)) rows = rows.filter(item => item.dealStatus === 'deal');
    if (/(组班中|组班)/.test(normalizedQuestion)) rows = rows.filter(item => item.trialStatus === 'forming' || item.classId);
    const sourceToken = normalizedQuestion.replace(/意向|线索|试听|成交|组班|来源|学生|学员|有哪些|多少|名单|的|微信|咨询|接触|沟通|跟进/g, '');
    if (sourceToken) {
        const sourceFiltered = rows.filter(item => normalizeComparableText(item.source).includes(sourceToken));
        if (sourceFiltered.length) rows = sourceFiltered;
    }
    const matches = rows.map(item => {
        const contactLogs = getProspectContactLogs(item);
        const latestContact = contactLogs[0] || {};
        return {
            name: displayName(item.name, privacyMode),
            grade: item.grade || '',
            source: item.source || '',
            wechat: privacyMode === 'named' ? (item.wechat || '') : '',
            trialStatus: item.trialStatus || '',
            dealStatus: item.dealStatus || '',
            className: classesById.get(item.classId)?.name || '',
            intent: safeText(item.intent, 120),
            remark: safeText(item.remark, 160),
            contactCount: contactLogs.length,
            latestContactDate: latestContact.contactDate || '',
            latestContactType: latestContact.contactType || '',
            latestContactStatus: latestContact.status || '',
            latestContactContent: safeText(latestContact.content || '', 120),
            nextAction: safeText(latestContact.nextAction || '', 120)
        };
    });
    return { total: matches.length, matches: matches.slice(0, 50) };
}

function buildSystemCapabilityFacts({ question }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(能查什么|可以查什么|支持查什么|哪些数据|可查询|查询范围|有什么数据|查不到什么|不能查什么|查不到|不能查)/.test(normalizedQuestion)) return null;
    return {
        total: 8,
        groups: [
            { name: '学员', fields: ['姓名', '年级', '状态', '班级', '学校记录', '首次上课年级', '课时余额', '欠费'] },
            { name: '班级', fields: ['班级状态', '年级', '上课时间', '成员', '计划课次', '已登记课次'] },
            { name: '收费', fields: ['已缴记录', '欠费记录', '课时数', '金额', '收费备注'] },
            { name: '考勤', fields: ['出勤', '请假', '课消', '月份课次', '班级课次统计'] },
            { name: '成绩', fields: ['测试名称', '日期', '分数', '满分', '排名', '薄弱点', '备注'] },
            { name: '沟通', fields: ['沟通日期', '沟通状态', '内容摘要', '后续跟进'] },
            { name: '意向学员', fields: ['来源', '年级', '微信', '试课状态', '成交状态', '组班', '备注'] },
            { name: '资料库', fields: ['已导入 Obsidian/资料库的摘要和原文；未导入文件不能直接搜索'] }
        ],
        unsupported: [
            '没有录入系统的数据无法查询',
            '只写了文件路径但未导入摘要/原文的资料无法理解正文',
            '未接入题库专用系统的数据不在本窗口查询范围内',
            'AI 对话只读，不能直接新增、修改、删除业务记录'
        ]
    };
}

function buildSummaryFacts({ question, summary, gradeCounts }) {
    const normalizedQuestion = normalizeComparableText(question);
    if (!/(多少|几个|几人|人数|总数|一共|统计)/.test(normalizedQuestion)) return null;
    if (/(停课|非在读|已停课)/.test(normalizedQuestion)) {
        return { type: 'inactive-students', label: '非在读/停课学员', count: summary.inactiveStudentCount };
    }
    if (/(在读|正式学员|当前学生)/.test(normalizedQuestion)) {
        return { type: 'active-students', label: '在读学员', count: summary.activeStudentCount };
    }
    if (/(待续费)/.test(normalizedQuestion)) {
        return { type: 'renewal-pending', label: '待续费学员', count: summary.renewalPendingCount };
    }
    if (/(意向|线索|试听)/.test(normalizedQuestion)) {
        return { type: 'prospects', label: '意向学员', count: summary.prospectCount, pendingCount: summary.pendingProspectCount };
    }
    if (/(学生|学员)/.test(normalizedQuestion)) {
        return { type: 'all-students', label: '全部学员', count: summary.studentCount, gradeCounts };
    }
    if (/(班级|班)/.test(normalizedQuestion)) {
        return { type: 'classes', label: '班级', count: summary.classCount, activeCount: summary.activeClassCount };
    }
    if (/(沟通|记录)/.test(normalizedQuestion)) {
        return { type: 'communications', label: '沟通记录', count: summary.communicationCount };
    }
    return null;
}

function buildBusinessReviewFacts({ question, summary, classRows, studentRows, prospects = [], classesById = new Map(), privacyMode = 'masked' }) {
    const normalizedQuestion = normalizeComparableText(question);
    const isReviewIntent = /(经营|复盘|周报|月报|运营|工作总结|总结一下)/.test(normalizedQuestion) ||
        (/(本周|本月)/.test(normalizedQuestion) && /(先处理|关注|待办|动作|安排)/.test(normalizedQuestion));
    if (!isReviewIntent) return null;
    if (!/(经营|复盘|周报|月报|运营|工作总结|总结一下)/.test(normalizedQuestion) &&
        /(成绩|学校|哪个班|哪个学校|考|分数|收费多少|收了多少)/.test(normalizedQuestion)) return null;
    const riskStudents = studentRows
        .filter(student => student.status === 'active')
        .filter(student => student.pendingFeeAmount > 0 || student.remainingHours <= 2 || student.totalHours === 0)
        .sort((a, b) => {
            if (b.pendingFeeAmount !== a.pendingFeeAmount) return b.pendingFeeAmount - a.pendingFeeAmount;
            return a.remainingHours - b.remainingHours;
        });
    const classProgress = classRows
        .filter(cls => cls.status === 'active')
        .map(cls => ({
            name: cls.name,
            grade: cls.grade,
            schedule: cls.schedule,
            plannedSessions: cls.plannedSessions,
            recordedSessions: cls.recordedSessions,
            remainingSessions: Number(cls.plannedSessions || 0) ? Number(cls.plannedSessions || 0) - Number(cls.recordedSessions || 0) : ''
        }))
        .sort((a, b) => Number(a.remainingSessions || 999) - Number(b.remainingSessions || 999));
    const prospectFollowups = (prospects || [])
        .filter(item => item.dealStatus !== 'deal')
        .filter(item => ['pending', 'contacted', 'trial', 'forming', '待沟通', '已联系', '试课中', '组班中'].includes(String(item.trialStatus || '')) || !item.trialStatus)
        .map(item => ({
            name: displayName(item.name || '', privacyMode),
            grade: item.grade || '',
            source: item.source || '',
            trialStatus: item.trialStatus || '',
            className: classesById.get(item.classId)?.name || '',
            remark: safeText(item.remark || item.intent, 100)
        }))
        .slice(0, 8);
    return {
        type: /(周报|本周)/.test(normalizedQuestion) ? 'weekly' : /(月报|本月)/.test(normalizedQuestion) ? 'monthly' : 'review',
        summary,
        riskTotal: riskStudents.length,
        riskStudents: riskStudents.slice(0, 12).map(student => ({
            name: student.name,
            grade: student.grade,
            className: student.className,
            remainingHours: student.remainingHours,
            pendingFeeAmount: student.pendingFeeAmount,
            totalHours: student.totalHours
        })),
        classProgress: classProgress.slice(0, 10),
        prospectTotal: prospectFollowups.length,
        prospectFollowups
    };
}

function buildSystemQAContext(data, payload, privacyMode) {
    const students = data.students || [];
    const classes = data.classes || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const grades = data.grades || [];
    const communications = data.communications || [];
    const prospects = data.prospects || [];
    const activeStudents = students.filter(item => item.status === 'active');
    const renewalPending = students.filter(item => item.status === 'renewalPending');
    const pendingFees = fees.filter(item => item.status === 'pending');
    const paidFees = fees.filter(item => item.status === 'paid');
    const studentsById = new Map(students.map(student => [student.id, student]));
    const classesById = new Map(classes.map(cls => [cls.id, cls]));
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const latestQuestion = extractLatestSystemQAQuestion(payload);
    const factQuestion = getSystemQAFactQuestion(latestQuestion, payload);
    const intent = isSystemQAAdviceIntent(factQuestion) ? 'advice' : 'data-query';
    const sourceScope = normalizeSourceScope(payload);
    if (!sourceScope.systemData) {
        return {
            type: 'system-qa',
            readonly: true,
            intent,
            userQuestion: latestQuestion,
            factQuestion,
            sourceScope,
            summary: {},
            queryFacts: {},
            note: '本次未选择“当前系统”作为回答依据，因此未读取学生管理系统业务数据。'
        };
    }

    const studentRows = students.map(student => enrichStudentSummaryWithConsumption(
        buildStudentSummaryForAI({ student, classesById, pendingFees, privacyMode }),
        data,
        student.id
    ));
    const consumptionRows = studentRows.filter(student => student.status === 'active');

    const gradeCounts = {};
    activeStudents.forEach(student => {
        const grade = student.grade || '未填写';
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });
    const summary = {
        studentCount: students.length,
        activeStudentCount: activeStudents.length,
        renewalPendingCount: renewalPending.length,
        inactiveStudentCount: students.filter(item => item.status !== 'active' && item.status !== 'renewalPending').length,
        classCount: classes.length,
        activeClassCount: classes.filter(item => item.status === 'active').length,
        prospectCount: prospects.length,
        pendingProspectCount: prospects.filter(item => item.dealStatus !== 'deal').length,
        paidFeeAmount: paidFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
        pendingFeeAmount: pendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
        currentMonthAttendanceSessions: attendance.filter(session => String(session.date || '').startsWith(currentMonth)).length,
        communicationCount: communications.length,
        gradeRecordCount: grades.length
    };

    const classRows = classes.map(cls => {
        const classStudents = students.filter(student => student.classId === cls.id && (student.status === 'active' || student.status === 'renewalPending'));
        const sessions = attendance.filter(session => session.classId === cls.id);
        return {
            id: cls.id,
            name: cls.name || '',
            grade: cls.grade || '',
            status: cls.status || '',
            schedule: cls.schedule || '',
            plannedSessions: Number(cls.plannedSessions || 0),
            recordedSessions: sessions.length,
            studentCount: classStudents.length
        };
    });

    const gradeRows = grades.map(item => {
        const student = studentsById.get(item.studentId);
        const cls = classesById.get(item.classId || student?.classId);
        return {
            studentName: displayName(item.studentName || student?.name || '', privacyMode),
            studentStatus: student?.status || '',
            studentGrade: student?.grade || '',
            className: cls?.name || '',
            testName: item.testName || '',
            testDate: item.testDate || '',
            score: item.score ?? '',
            fullScore: item.fullScore ?? '',
            ranking: item.ranking ?? '',
            weakPoints: safeText(item.weakPoints, 120),
            remark: safeText(item.remark, 120)
        };
    });

    const recentGrades = gradeRows.slice(-30);

    const queryFacts = {};
    const scoreMatches = buildScoreQueryFacts({ question: factQuestion, grades, studentsById, classesById, privacyMode });
    if (scoreMatches) queryFacts.scoreMatches = scoreMatches;
    const studentLookup = buildStudentLookupFacts({ question: factQuestion, students, studentRows });
    if (studentLookup) queryFacts.studentLookup = studentLookup;
    const studentSchoolMatches = buildStudentSchoolFacts({ question: factQuestion, students, studentRows });
    if (studentSchoolMatches) queryFacts.studentSchoolMatches = studentSchoolMatches;
    const classMemberMatches = buildClassMemberFacts({ question: factQuestion, classRows, studentRows });
    if (classMemberMatches) queryFacts.classMemberMatches = classMemberMatches;
    const classProgressMatches = buildClassProgressFacts({ question: factQuestion, classRows });
    if (classProgressMatches) queryFacts.classProgressMatches = classProgressMatches;
    const gradeStudentMatches = buildGradeStudentFacts({ question: factQuestion, studentRows });
    if (gradeStudentMatches) queryFacts.gradeStudentMatches = gradeStudentMatches;
    const feeRiskMatches = buildFeeRiskFacts({ question: factQuestion, studentRows });
    if (feeRiskMatches) queryFacts.feeRiskMatches = feeRiskMatches;
    const pendingFeeMatches = buildPendingFeeFacts({ question: factQuestion, fees, studentsById, classesById, privacyMode });
    if (pendingFeeMatches) queryFacts.pendingFeeMatches = pendingFeeMatches;
    const feeSummaryMatches = buildFeeSummaryFacts({ question: factQuestion, fees, studentsById, classesById, privacyMode });
    if (feeSummaryMatches) queryFacts.feeSummaryMatches = feeSummaryMatches;
    const focusStudentMatches = buildFocusStudentFacts({ question: factQuestion, studentRows });
    if (focusStudentMatches) queryFacts.focusStudentMatches = focusStudentMatches;
    const studentGradeMatches = buildStudentGradeFacts({ question: factQuestion, students, grades, studentsById, classesById, privacyMode });
    if (studentGradeMatches) queryFacts.studentGradeMatches = studentGradeMatches;
    const studentAttendanceMatches = buildStudentAttendanceFacts({ question: factQuestion, students, attendance, classesById, privacyMode });
    if (studentAttendanceMatches) queryFacts.studentAttendanceMatches = studentAttendanceMatches;
    const monthlyConsumption = buildMonthlyConsumptionFacts({ question: factQuestion, attendance, classesById });
    if (monthlyConsumption) queryFacts.monthlyConsumption = monthlyConsumption;
    const studentFeeMatches = buildStudentFeeFacts({ question: factQuestion, students, fees, attendance, studentsById, classesById, privacyMode });
    if (studentFeeMatches) queryFacts.studentFeeMatches = studentFeeMatches;
    const communicationMatches = buildCommunicationFacts({ question: factQuestion, students, communications, studentsById, classesById, privacyMode });
    if (communicationMatches) queryFacts.communicationMatches = communicationMatches;
    const prospectMatches = buildProspectFacts({ question: factQuestion, prospects, classesById, privacyMode });
    if (prospectMatches) queryFacts.prospectMatches = prospectMatches;
    const capabilityMatches = buildSystemCapabilityFacts({ question: factQuestion });
    if (capabilityMatches) queryFacts.capabilityMatches = capabilityMatches;
    const summaryMatches = buildSummaryFacts({ question: factQuestion, summary, gradeCounts });
    if (summaryMatches) queryFacts.summaryMatches = summaryMatches;
    const businessReview = buildBusinessReviewFacts({ question: factQuestion, summary, classRows, studentRows, prospects, classesById, privacyMode });
    if (businessReview) queryFacts.businessReview = businessReview;

    const recentCommunications = communications.slice(-20).map(item => ({
        studentName: displayName(item.studentName, privacyMode),
        contactDate: item.contactDate || '',
        status: item.status || '',
        content: safeText(item.content, 160),
        followUp: safeText(item.followUp, 160)
    }));

    const recentAttendance = attendance
        .filter(session => String(session.date || '').startsWith(currentMonth))
        .map(session => {
            const present = Object.values(session.records || {}).filter(value => value === 1).length;
            const absent = Object.values(session.records || {}).filter(value => value === 0).length;
            return {
                date: session.date || '',
                className: classesById.get(session.classId)?.name || '',
                lessonName: session.lessonName || session.name || '',
                present,
                absent
            };
        })
        .slice(-30);

    const feeRows = fees.map(fee => ({
        studentName: displayName(fee.studentName || studentsById.get(fee.studentId)?.name || '', privacyMode),
        studentGrade: studentsById.get(fee.studentId)?.grade || '',
        className: classesById.get(studentsById.get(fee.studentId)?.classId)?.name || '',
        amount: Number(fee.amount || 0),
        hours: Number(fee.hours || 0),
        pricePerHour: Number(fee.pricePerHour || 0),
        paymentDate: fee.paymentDate || '',
        package: fee.package || '',
        status: fee.status || '',
        remark: safeText(fee.remark, 100)
    }));

    const communicationRows = communications.map(item => ({
        studentName: displayName(item.studentName || studentsById.get(item.studentId)?.name || '', privacyMode),
        studentGrade: studentsById.get(item.studentId)?.grade || '',
        className: classesById.get(studentsById.get(item.studentId)?.classId)?.name || '',
        contactDate: item.contactDate || '',
        contactType: item.contactType || '',
        contactPerson: item.contactPerson || '',
        teacher: item.teacher || '',
        status: item.status || '',
        content: safeText(item.content, 160),
        followUp: safeText(item.followUp, 160)
    }));

    return {
        type: 'system-qa',
        readonly: true,
        intent,
        userQuestion: latestQuestion,
        factQuestion,
        sourceScope,
        summary,
        gradeCounts,
        classes: classRows,
        students: studentRows,
        riskStudents: consumptionRows
            .filter(row => row.remainingHours <= 2 || row.pendingFeeAmount > 0 || row.totalHours === 0)
            .sort((a, b) => a.remainingHours - b.remainingHours)
            .slice(0, 30),
        pendingFees: pendingFees.slice(0, 30).map(fee => ({
            studentName: displayName(fee.studentName || studentsById.get(fee.studentId)?.name || '', privacyMode),
            amount: Number(fee.amount || 0),
            hours: Number(fee.hours || 0),
            paymentDate: fee.paymentDate || '',
            remark: safeText(fee.remark, 100)
        })),
        fees: feeRows,
        recentAttendance,
        grades: gradeRows,
        recentGrades,
        communications: communicationRows,
        recentCommunications,
        queryFacts,
        prospects: prospects.map(item => {
            const contactLogs = getProspectContactLogs(item);
            const latestContact = contactLogs[0] || {};
            return {
                name: displayName(item.name, privacyMode),
                grade: item.grade || '',
                phone: privacyMode === 'named' ? (item.phone || '') : '',
                wechat: privacyMode === 'named' ? (item.wechat || '') : '',
                source: item.source || '',
                intent: safeText(item.intent, 120),
                trialDate: item.trialDate || '',
                trialStatus: item.trialStatus || '',
                dealStatus: item.dealStatus || '',
                className: classesById.get(item.classId)?.name || '',
                remark: safeText(item.remark || item.intent, 120),
                contactCount: contactLogs.length,
                latestContactDate: latestContact.contactDate || '',
                latestContactType: latestContact.contactType || '',
                latestContactContent: safeText(latestContact.content || '', 120),
                nextAction: safeText(latestContact.nextAction || '', 120)
            };
        })
    };
}


function formatShortList(items, formatter, limit = 8) {
    const rows = (items || []).slice(0, limit).map(formatter).filter(Boolean);
    const more = (items || []).length > limit ? `\n还有 ${(items || []).length - limit} 条，需要我展开可以继续问。` : '';
    return `${rows.join('\n')}${more}`;
}

function formatGroupedByClass(items, formatter, limitPerGroup = 20) {
    const groups = new Map();
    (items || []).forEach(item => {
        const key = item.className || '未分班';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });
    return [...groups.entries()].map(([className, rows]) => {
        const body = rows.slice(0, limitPerGroup).map(formatter).join('、');
        const more = rows.length > limitPerGroup ? ` 等 ${rows.length} 人` : '';
        return `- ${className}：${body}${more}`;
    }).join('\n');
}

function buildSystemFactAnswer(context, options = {}) {
    if (context.task !== 'system-qa') return '';
    const facts = context.context?.queryFacts || {};
    const answerLength = normalizeAnswerLength(options.answerLength || context.answerLength);
    const detailed = answerLength === 'detailed';
    const factQuestion = normalizeComparableText(context.context?.factQuestion || context.context?.userQuestion || '');
    const groupByClass = factQuestion.includes('按班级') || factQuestion.includes('分组');
    const tail = detailed ? '\n\n以上为系统数据辅助判断，重要操作请以原始记录为准。' : '';

    if (facts.businessReview) {
        const fact = facts.businessReview;
        const s = fact.summary || {};
        const riskList = formatShortList(fact.riskStudents || [], item =>
            `- ${item.name}：${item.className || '未分班'}，剩余课时 ${item.remainingHours}，欠费 ${item.pendingFeeAmount} 元`,
            detailed ? 12 : 6
        );
        const classList = formatShortList(fact.classProgress || [], item =>
            `- ${item.name}：已登记 ${item.recordedSessions}/${item.plannedSessions || '-'} 次${item.remainingSessions !== '' ? `，剩余 ${item.remainingSessions} 次` : ''}`,
            detailed ? 10 : 5
        );
        const prospectList = formatShortList(fact.prospectFollowups || [], item =>
            `- ${item.name}：${item.grade || '-'}，${item.source || '-'}，${item.trialStatus || '待跟进'}${item.className ? `，${item.className}` : ''}`,
            detailed ? 10 : 5
        );
        return [
            `经营复盘摘要：在读 ${s.activeStudentCount || 0} 人，待续费 ${s.renewalPendingCount || 0} 人，意向 ${s.prospectCount || 0} 人，欠费 ¥${Number(s.pendingFeeAmount || 0).toLocaleString()}。`,
            `当前需关注 ${fact.riskTotal || 0} 名学员。`,
            riskList ? `优先关注：\n${riskList}` : '',
            classList ? `班级进度：\n${classList}` : '',
            prospectList ? `意向跟进：\n${prospectList}` : '',
            detailed ? '建议动作：先处理课时余额为负/欠费学员，再确认接近结课班级的续费沟通节奏，最后复盘意向学员来源。' : '需要详细行动清单可以切换“详细”模式再问。'
        ].filter(Boolean).join('\n');
    }

    if (facts.monthlyConsumption) {
        const fact = facts.monthlyConsumption;
        const list = formatShortList(fact.classes, item => `- ${item.className}：${item.sessions} 次课，出勤课消 ${item.present}，请假 ${item.absent}`, detailed ? 20 : 8);
        const scope = fact.className ? `${fact.className} ` : '';
        return `${fact.month} ${scope}课消概览：已登记 ${fact.sessionCount} 次课，出勤课消 ${fact.presentTotal}，请假 ${fact.absentTotal}。\n${list || '- 该月份暂无考勤课次'}${tail}`;
    }

    if (facts.scoreMatches) {
        const fact = facts.scoreMatches;
        const formatter = item => {
            const base = `${item.studentName}（${item.studentGrade || '-'}，${item.className || '未分班'}）`;
            return detailed
                ? `- ${base}：${item.testName || '未命名测试'}，${item.testDate || '-'}，${item.score}/${item.fullScore || '-'}，薄弱点：${item.weakPoints || '-'}`
                : `- ${base}：${item.testName || '未命名测试'} ${item.score}/${item.fullScore || '-'}`;
        };
        const list = groupByClass
            ? formatGroupedByClass(fact.matches, item => `${item.studentName}（${item.score}/${item.fullScore || '-'}）`)
            : formatShortList(fact.matches, formatter, detailed ? 30 : 8);
        const label = fact.label || (fact.type === 'full-score' ? '满分' : fact.score !== '' ? `${fact.score}分` : '符合条件');
        return `共找到 ${fact.total} 条${label}成绩记录。\n${list || '- 暂无匹配记录'}${tail}`;
    }

    if (facts.studentGradeMatches) {
        const fact = facts.studentGradeMatches;
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.studentName}：${item.testName || '未命名测试'}，${item.testDate || '-'}，${item.score}/${item.fullScore || '-'}，排名 ${item.ranking || '-'}，薄弱点：${item.weakPoints || '-'}`
            : `- ${item.studentName}：${item.testName || '未命名测试'} ${item.score}/${item.fullScore || '-'}（${item.testDate || '-'}）`,
        detailed ? 20 : 8);
        return `共找到 ${fact.total} 条该学生成绩记录。\n${list || '- 暂无成绩记录'}${tail}`;
    }

    if (facts.studentAttendanceMatches) {
        const fact = facts.studentAttendanceMatches;
        const list = formatShortList(fact.matches, item => {
            const recent = item.sessions?.length ? `；最近：${item.sessions.slice(0, detailed ? 8 : 3).map(session => `${session.date || '-'} ${session.status}`).join('、')}` : '';
            const month = item.month ? `${item.month} ` : '';
            return `- ${item.studentName}：${month}出勤 ${item.present} 次，请假 ${item.absent} 次，已登记 ${item.recorded} 次${recent}`;
        }, detailed ? 20 : 8);
        return `共找到 ${fact.total} 名学生的考勤统计。\n${list || '- 暂无考勤记录'}${tail}`;
    }

    if (facts.pendingFeeMatches) {
        const fact = facts.pendingFeeMatches;
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.studentName}：${item.amount} 元，${item.hours} 课时，${item.className || '未分班'}，备注：${item.remark || '-'}`
            : `- ${item.studentName}：${item.amount} 元（${item.className || '未分班'}）`,
        detailed ? 30 : 8);
        return `待收款/欠费共 ${fact.totalAmount} 元，涉及 ${fact.total} 条记录。\n${list || '- 暂无待收款/欠费记录'}${tail}`;
    }

    if (facts.feeSummaryMatches) {
        const fact = facts.feeSummaryMatches;
        const prefix = fact.month ? `${fact.month} 已缴收费` : '已缴收费';
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.studentName}：${item.paymentDate || '-'}，${item.amount} 元，${item.hours} 课时，${item.className || '未分班'}，${item.package || '-'}`
            : `- ${item.studentName}：${item.amount} 元 / ${item.hours} 课时（${item.paymentDate || '-'}）`,
        detailed ? 30 : 8);
        return `${prefix}共 ${fact.totalAmount} 元，${fact.totalHours} 课时，涉及 ${fact.total} 条记录。\n${list || '- 暂无已缴收费记录'}${tail}`;
    }

    if (facts.studentFeeMatches) {
        const fact = facts.studentFeeMatches;
        const list = formatShortList(fact.matches, item => {
            if (!detailed) {
                return `- ${item.studentName}：已缴 ${item.totalPaidHours} 课时，已消 ${item.usedHours}，剩余 ${item.remainingHours}，欠费 ${item.pendingAmount} 元`;
            }
            const feeLines = item.latestFees?.length
                ? `；最近收费：${item.latestFees.slice(0, 5).map(fee => `${fee.paymentDate || '-'} ${fee.status || '-'} ${fee.amount}元/${fee.hours}课时`).join('、')}`
                : '；暂无收费明细';
            return `- ${item.studentName}：已缴金额 ${item.totalPaidAmount} 元，已缴 ${item.totalPaidHours} 课时，已消 ${item.usedHours}，请假 ${item.absentHours}，剩余 ${item.remainingHours}，欠费 ${item.pendingAmount} 元${feeLines}`;
        }, detailed ? 20 : 8);
        return `共找到 ${fact.total} 名学员的收费/课时信息。\n${list || '- 暂无匹配记录'}${tail}`;
    }

    if (facts.focusStudentMatches) {
        const fact = facts.focusStudentMatches;
        const list = formatShortList(fact.matches, item => `- ${item.name}：${item.className || '未分班'}，${item.reasons?.join('；') || '需人工确认'}`, detailed ? 30 : 8);
        return `共找到 ${fact.total} 名需要关注的学员。\n${list || '- 暂无明显需要关注的学员'}${tail}`;
    }

    if (facts.communicationMatches) {
        const fact = facts.communicationMatches;
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.studentName}：${item.contactDate || '-'}，${item.status || '-'}，${item.content || '-'}${item.followUp ? `；跟进：${item.followUp}` : ''}`
            : `- ${item.studentName}：${item.contactDate || '-'}，${item.status || '-'}，${item.content || '-'}`
        , detailed ? 30 : 8);
        return `共找到 ${fact.total} 条沟通记录。\n${list || '- 暂无沟通记录'}${tail}`;
    }

    if (facts.studentSchoolMatches) {
        const fact = facts.studentSchoolMatches;
        const list = formatShortList(fact.matches, item => {
            const current = item.currentSchool?.school || item.legacySchool || '未填写';
            return detailed
                ? `- ${item.name}：当前阶段学校 ${current}；小学 ${item.schoolHistory?.primarySchool || '-'}；初中 ${item.schoolHistory?.middleSchool || '-'}；高中 ${item.schoolHistory?.highSchool || '-'}；班级 ${item.className || '未分班'}`
                : `- ${item.name}：${current}（${item.grade || '-'}，${item.className || '未分班'}）`;
        }, detailed ? 30 : 8);
        return `共找到 ${fact.total} 人。\n${list}${tail}`;
    }

    if (facts.studentLookup) {
        const fact = facts.studentLookup;
        const list = formatShortList(fact.matches, item => {
            const current = item.currentSchool?.school || item.legacySchool || '未填写';
            if (!detailed) {
                if (/(班级|哪个班|在哪个班|上课时间)/.test(factQuestion)) return `- ${item.name}：${item.className || '未分班'}（${item.classSchedule || '-'}）`;
                if (/(课时|剩余|已消|消课|课消)/.test(factQuestion)) return `- ${item.name}：已缴 ${item.totalHours}，已消 ${item.usedHours}，请假 ${item.absentHours}，剩余 ${item.remainingHours}`;
                if (/(欠费|待收款|未缴|费用)/.test(factQuestion)) return `- ${item.name}：欠费 ${item.pendingFeeAmount} 元，剩余课时 ${item.remainingHours}`;
                if (/(状态|在读|停课|待续费)/.test(factQuestion)) return `- ${item.name}：${item.status || '-'}，${item.grade || '-'}，${item.className || '未分班'}`;
                if (/(学校|小学|初中|高中)/.test(factQuestion)) return `- ${item.name}：${current}（${item.grade || '-'}，${item.className || '未分班'}）`;
                return `- ${item.name}：${item.grade || '-'}，${item.className || '未分班'}，学校 ${current}，剩余课时 ${item.remainingHours}`;
            }
            return `- ${item.name}：${item.grade || '-'}，${item.status || '-'}，${item.className || '未分班'}，当前学校 ${current}，已缴 ${item.totalHours}，已消 ${item.usedHours}，请假 ${item.absentHours}，剩余课时 ${item.remainingHours}，欠费 ${item.pendingFeeAmount} 元`;
        }, detailed ? 30 : 8);
        return `共找到 ${fact.total} 人。\n${list}${tail}`;
    }

    if (facts.classMemberMatches) {
        const fact = facts.classMemberMatches;
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.name}：${item.grade || '-'}，${item.status || '-'}，剩余课时 ${item.remainingHours}，欠费 ${item.pendingFeeAmount} 元`
            : `- ${item.name}（${item.grade || '-'}）`, detailed ? 50 : 8);
        return `${fact.className} 共 ${fact.total} 名学员。\n${list}${tail}`;
    }

    if (facts.classProgressMatches) {
        const fact = facts.classProgressMatches;
        const list = formatShortList(fact.matches, item => {
            const remain = item.remainingSessions === '' ? '未设置计划课次' : `剩余 ${item.remainingSessions} 次`;
            return detailed
                ? `- ${item.name}：${item.grade || '-'}，${item.status || '-'}，${item.schedule || '-'}，学员 ${item.studentCount} 人，已登记 ${item.recordedSessions}/${item.plannedSessions || '-'} 次，${remain}`
                : `- ${item.name}：已登记 ${item.recordedSessions}/${item.plannedSessions || '-'} 次，学员 ${item.studentCount} 人`;
        }, detailed ? 50 : 8);
        return `共找到 ${fact.total} 个班级。\n${list || '- 暂无班级记录'}${tail}`;
    }

    if (facts.gradeStudentMatches) {
        const fact = facts.gradeStudentMatches;
        const wantsList = /(哪些|名单|列出|都有谁|有谁)/.test(factQuestion);
        if (!detailed && !wantsList) {
            return `${fact.grade}${fact.status === 'active' ? '在读' : ''}学员共 ${fact.total} 人。需要名单可以继续问。`;
        }
        const list = formatShortList(fact.matches, item => `- ${item.name}：${item.className || '未分班'}`, detailed ? 50 : 8);
        return `${fact.grade}${fact.status === 'active' ? '在读' : ''}学员共 ${fact.total} 人。\n${list}${tail}`;
    }

    if (facts.prospectMatches) {
        const fact = facts.prospectMatches;
        const list = formatShortList(fact.matches, item => detailed
            ? `- ${item.name}：${item.grade || '-'}，来源 ${item.source || '-'}，试课状态 ${item.trialStatus || '-'}，成交状态 ${item.dealStatus || '-'}，接触 ${item.contactCount || 0} 次${item.latestContactDate ? `，最近 ${item.latestContactDate} ${item.latestContactType || ''}` : ''}${item.nextAction ? `，下一步：${item.nextAction}` : ''}，备注：${item.remark || item.intent || '-'}`
            : `- ${item.name}：${item.grade || '-'}，${item.source || '-'}，${item.trialStatus || '-'}，接触 ${item.contactCount || 0} 次`
        , detailed ? 30 : 8);
        return `共找到 ${fact.total} 条意向学员记录。\n${list || '- 暂无匹配记录'}${tail}`;
    }

    if (facts.capabilityMatches) {
        const fact = facts.capabilityMatches;
        const list = fact.groups.map(group => `- ${group.name}：${group.fields.join('、')}`).join('\n');
        const unsupported = (fact.unsupported || []).map(item => `- ${item}`).join('\n');
        return `目前 AI 系统问答主要能查 ${fact.total} 类信息：\n${list}\n\n目前不能可靠查询：\n${unsupported || '- 暂无'}${tail}`;
    }

    if (facts.summaryMatches) {
        const fact = facts.summaryMatches;
        if (fact.type === 'all-students' && detailed) {
            const gradeText = Object.entries(fact.gradeCounts || {}).map(([grade, count]) => `${grade}${count}人`).join('，');
            return `${fact.label}共 ${fact.count} 人。\n年级分布：${gradeText || '-'}${tail}`;
        }
        if (fact.type === 'classes') return `${fact.label}共 ${fact.count} 个，其中正常班级 ${fact.activeCount} 个。${tail}`;
        if (fact.type === 'prospects') return `${fact.label}共 ${fact.count} 人，未成交/待跟进 ${fact.pendingCount} 人。${tail}`;
        return `${fact.label}共 ${fact.count} 条/人。${tail}`;
    }

    if (facts.feeRiskMatches) {
        const fact = facts.feeRiskMatches;
        const list = formatShortList(fact.matches, item => `- ${item.name}：${item.className || '未分班'}，剩余课时 ${item.remainingHours}，欠费 ${item.pendingFeeAmount} 元`, detailed ? 30 : 8);
        return `共找到 ${fact.total} 名需要关注的学员。\n${list}${tail}`;
    }

    return '';
}


module.exports = {
    buildSystemQAContext,
    buildSystemFactAnswer,
    buildSystemQAWriteIntentAnswer,
    buildNoEvidenceSystemQAAnswer,
    normalizeSourceScope,
    isSystemQAAdviceIntent,
    wantsSystemDataForAdvice
};
