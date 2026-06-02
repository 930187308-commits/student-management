const config = require('./config');
const { getDb, getDataFromEntityColumns } = require('./db');
const { listResource, getResource } = require('./knowledge-service');

const AGENT_NAMES = {
    'admin-agent': '教务 Agent',
    'learning-agent': '学情沟通 Agent',
    'recruit-agent': '招生跟进 Agent',
    'teaching-agent': '教研 Agent',
    'biz-agent': '经营分析 Agent'
};

const TASK_NAMES = {
    // 学情/续费
    'student-feedback': '生成学情反馈',
    'renewal-script': '生成续费沟通话术',
    'parent-greeting': '生成家长问候模板',

    // 经营
    'weekly-report': '生成本周经营周报',
    'monthly-report': '生成月度经营报告',
    'class-consumption': '班级课消分析',
    'consumption-analysis': '班级课消分析',
    'tuition-warning': '欠费与续费预警汇总',
    'fee-warning': '欠费预警',

    // 招生/内容
    'follow-reminder': '招生跟进提醒',
    'trial-report': '试听反馈',
    'conversion-script': '试听后转化话术',
    'trial-conversion': '试听后转化话术',
    'moment-content': '招生内容草稿',
    'social-content': '招生内容草稿',

    // 教务
    'schedule-conflict': '排课冲突检查',
    'schedule-check': '排课冲突检查',
    'attendance-anomaly': '考勤异常检查',
    'class-full-check': '班级满班预警',

    // 教研/题库/资料
    'lesson-plan': '教案框架',
    'exercise-recommend': '练习建议',
    'practice-suggestion': '练习建议',
    'learning-path': '学习路径',
    'exam-analysis': '试卷分析',
    'article-draft': '公众号长文草稿',
    'xiaohongshu-note': '小红书笔记草稿',
    'video-script': '视频号脚本',
    'question-bank-plan': '数学题库建设方案',
    'question-classify': '题目分类规则',
    'resource-brief': '升学/中高考资料简报',
    'research-plan': '资料收集计划'
};

const TASK_DATA_RANGES = {
    'student-feedback': ['学员基础信息', '最近成绩', '最近考勤', '课时余额', '沟通摘要'],
    'renewal-script': ['学员基础信息', '课时余额', '班级进度', '收费摘要'],
    'parent-greeting': ['学员基础信息', '班级信息', '用户补充说明'],
    'weekly-report': ['本周新增', '课消摘要', '收费摘要', '欠费摘要', '待续费摘要'],
    'monthly-report': ['月度课消', '收费摘要', '班级进度', '意向学员摘要'],
    'class-consumption': ['班级课次', '学员课时余额', '出勤统计'],
    'consumption-analysis': ['班级课次', '学员课时余额', '出勤统计'],
    'tuition-warning': ['欠费记录', '待续费学员', '课时不足摘要'],
    'fee-warning': ['欠费记录', '待续费学员', '课时不足摘要'],
    'follow-reminder': ['意向学员状态', '来源', '年级', '备注摘要'],
    'trial-report': ['意向学员信息', '试课状态', '备注摘要'],
    'conversion-script': ['意向学员信息', '试课状态', '成交状态', '备注摘要'],
    'trial-conversion': ['意向学员信息', '试课状态', '成交状态', '备注摘要'],
    'moment-content': ['招生摘要', '课程方向', '用户补充说明'],
    'social-content': ['招生摘要', '课程方向', '用户补充说明'],
    'schedule-conflict': ['班级上课时间', '学员班级归属', '用户补充说明'],
    'schedule-check': ['班级上课时间', '学员班级归属', '用户补充说明'],
    'attendance-anomaly': ['考勤记录', '班级学员', '出勤异常摘要'],
    'class-full-check': ['班级人数', '班级容量', '组班状态'],
    'lesson-plan': ['年级', '课程主题', '教学目标', '用户补充说明'],
    'exercise-recommend': ['年级', '知识点', '薄弱点', '用户补充说明'],
    'practice-suggestion': ['年级', '知识点', '薄弱点', '用户补充说明'],
    'learning-path': ['年级', '学习目标', '当前水平', '用户补充说明'],
    'exam-analysis': ['试卷信息', '错题/薄弱点', '用户补充说明'],
    'article-draft': ['主题', '目标读者', '素材要点', '用户补充说明'],
    'xiaohongshu-note': ['主题', '人群', '标题方向', '用户补充说明'],
    'video-script': ['主题', '镜头结构', '口播风格', '用户补充说明'],
    'question-bank-plan': ['年级', '章节', '题型', '难度', '标签规则'],
    'question-classify': ['题目文本', '知识点', '难度', '错因标签'],
    'resource-brief': ['资料主题', '适用年级', '收集目标', '用户补充说明'],
    'research-plan': ['资料方向', '来源类型', '整理方式', '用户补充说明']
};

const TASK_ALIASES = {
    'schedule-check': 'schedule-conflict',
    'consumption-analysis': 'class-consumption',
    'fee-warning': 'tuition-warning',
    'trial-conversion': 'conversion-script',
    'social-content': 'moment-content',
    'practice-suggestion': 'exercise-recommend'
};

function nowIso() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProvider(value) {
    return String(value || 'disabled').trim().toLowerCase();
}

function getAiStatus() {
    const provider = normalizeProvider(config.ai.provider);
    const model = config.ai.model || getDefaultModel(provider) || '';
    const endpoint = getProviderEndpoint(provider);
    const missing = [];
    if (provider === 'disabled') missing.push('AI_PROVIDER');
    if (provider !== 'disabled' && !config.ai.apiKey) missing.push('AI_API_KEY');
    if (provider !== 'disabled' && !model) missing.push('AI_MODEL');
    if (provider !== 'disabled' && !endpoint) missing.push('AI_BASE_URL');
    const enabled = missing.length === 0;
    return {
        provider,
        enabled,
        mode: enabled ? 'real-ai' : 'local-template',
        model,
        timeoutMs: config.ai.timeoutMs,
        envFileLoaded: Boolean(config.ai.envFileLoaded),
        envFile: config.ai.envFile,
        missing
    };
}

function getDefaultBaseUrl(provider) {
    if (provider === 'openai') return 'https://api.openai.com/v1';
    if (provider === 'deepseek') return 'https://api.deepseek.com/v1';
    if (provider === 'minimax') return 'https://api.minimax.io/v1';
    return config.ai.baseUrl || '';
}

function getDefaultModel(provider) {
    if (provider === 'openai') return 'gpt-4.1-mini';
    if (provider === 'deepseek') return 'deepseek-chat';
    if (provider === 'minimax') return 'MiniMax-M2.7-highspeed';
    return config.ai.model || '';
}

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

function stripThinkTags(text) {
    return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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

function getTaskDataRange(task) {
    return TASK_DATA_RANGES[task] || ['当前模块摘要', '用户补充说明'];
}

function normalizeTask(task) {
    const value = String(task || '').trim();
    return TASK_ALIASES[value] || value;
}

function resolveRelatedStudent(data, payload) {
    const relatedId = payload.relatedType === 'student' ? payload.relatedId : '';
    const input = safeText(payload.userInstruction || payload.input || '', 80);
    const students = data.students || [];
    if (relatedId) {
        const byId = students.find(student => String(student.id) === String(relatedId));
        if (byId) return byId;
    }
    if (input) {
        return students.find(student => input.includes(student.name)) || null;
    }
    return null;
}

function resolveRelatedProspect(data, payload) {
    const relatedId = payload.relatedType === 'prospect' ? payload.relatedId : '';
    const input = safeText(payload.userInstruction || payload.input || '', 80);
    const prospects = data.prospects || [];
    if (relatedId) {
        const byId = prospects.find(prospect => String(prospect.id) === String(relatedId));
        if (byId) return byId;
    }
    if (input) {
        return prospects.find(prospect => input.includes(prospect.name)) || null;
    }
    return null;
}

function buildStudentContext(data, payload, privacyMode) {
    const student = resolveRelatedStudent(data, payload);
    if (!student) {
        return {
            type: 'student',
            found: false,
            summary: '未锁定具体学员，仅使用用户补充说明生成通用模板。'
        };
    }
    const studentId = student.id;
    const grades = (data.grades || [])
        .filter(item => item.studentId === studentId)
        .slice(-8)
        .map(item => ({
            testName: item.testName || '',
            testDate: item.testDate || '',
            score: item.score || '',
            fullScore: item.fullScore || '',
            weakPoints: safeText(item.weakPoints, 120),
            remark: safeText(item.remark, 120)
        }));
    const communications = (data.communications || [])
        .filter(item => item.studentId === studentId)
        .slice(-5)
        .map(item => ({
            contactDate: item.contactDate || '',
            status: item.status || '',
            content: safeText(item.content, 120),
            followUp: safeText(item.followUp, 120)
        }));
    const classes = data.classes || [];
    const currentClass = classes.find(item => item.id === student.classId);
    const consumption = getStudentConsumption(data, studentId);
    return {
        type: 'student',
        found: true,
        student: {
            id: student.id,
            name: displayName(student.name, privacyMode),
            grade: student.grade || '',
            status: student.status || '',
            className: currentClass?.name || '未分班',
            enrollDate: student.enrollDate || '',
            firstEnrollDate: student.firstEnrollDate || ''
        },
        consumption,
        recentGrades: grades,
        recentCommunications: communications
    };
}

function buildProspectContext(data, payload, privacyMode) {
    const prospect = resolveRelatedProspect(data, payload);
    const prospects = data.prospects || [];
    const summary = {
        total: prospects.length,
        pending: prospects.filter(item => item.dealStatus !== 'deal').length,
        trial: prospects.filter(item => item.trialStatus === 'trial').length,
        forming: prospects.filter(item => item.trialStatus === 'forming').length,
        deal: prospects.filter(item => item.dealStatus === 'deal').length
    };
    if (!prospect) {
        return { type: 'prospect', found: false, summary };
    }
    return {
        type: 'prospect',
        found: true,
        summary,
        prospect: {
            id: prospect.id,
            name: displayName(prospect.name, privacyMode),
            grade: prospect.grade || '',
            source: prospect.source || '',
            trialStatus: prospect.trialStatus || '',
            dealStatus: prospect.dealStatus || '',
            intent: safeText(prospect.intent, 120),
            remark: safeText(prospect.remark, 160)
        }
    };
}

function buildBusinessContext(data, privacyMode) {
    const students = data.students || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const classes = data.classes || [];
    const prospects = data.prospects || [];
    const activeStudents = students.filter(item => item.status === 'active');
    const renewalPending = students.filter(item => item.status === 'renewalPending');
    const pendingFees = fees.filter(item => item.status === 'pending');
    const paidAmount = fees.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingAmount = pendingFees.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const activeClasses = classes.filter(item => item.status === 'active');
    const feeSample = pendingFees.slice(0, 8).map(item => ({
        studentName: displayName(item.studentName, privacyMode),
        amount: Number(item.amount || 0),
        paymentDate: item.paymentDate || ''
    }));
    return {
        type: 'business',
        activeStudents: activeStudents.length,
        renewalPending: renewalPending.length,
        prospects: prospects.length,
        activeClasses: activeClasses.length,
        attendanceSessions: attendance.length,
        paidAmount,
        pendingAmount,
        pendingFees: feeSample
    };
}

function buildTeachingContext(data, payload) {
    const students = data.students || [];
    const grades = data.grades || [];
    const classes = data.classes || [];
    const activeByGrade = {};
    students.filter(item => item.status === 'active').forEach(item => {
        const grade = item.grade || '未填写';
        activeByGrade[grade] = (activeByGrade[grade] || 0) + 1;
    });
    const weakPointCounts = {};
    grades.forEach(item => {
        String(item.weakPoints || '').split(/[、,，;；\s]+/).forEach(label => {
            const key = label.trim();
            if (!key) return;
            weakPointCounts[key] = (weakPointCounts[key] || 0) + 1;
        });
    });
    return {
        type: 'teaching',
        activeByGrade,
        activeClassCount: classes.filter(item => item.status === 'active').length,
        recentGradeCount: grades.length,
        commonWeakPoints: Object.entries(weakPointCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12)
            .map(([label, count]) => ({ label, count })),
        userTopic: safeText(payload.userInstruction || payload.input || '', 500)
    };
}

function buildContentContext(data, payload) {
    const students = data.students || [];
    const prospects = data.prospects || [];
    const classes = data.classes || [];
    const gradeCounts = {};
    students.filter(item => item.status === 'active').forEach(item => {
        const grade = item.grade || '未填写';
        gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    });
    const prospectSources = {};
    prospects.forEach(item => {
        const source = item.source || '未填写';
        prospectSources[source] = (prospectSources[source] || 0) + 1;
    });
    return {
        type: 'content',
        activeStudentGrades: gradeCounts,
        prospectSources,
        activeClasses: classes.filter(item => item.status === 'active').map(item => ({
            name: item.name || '',
            grade: item.grade || '',
            classType: item.classType || '',
            schedule: item.schedule || ''
        })).slice(0, 12),
        userTopic: safeText(payload.userInstruction || payload.input || '', 800)
    };
}

function getPlatformForTask(task) {
    if (task === 'xiaohongshu-note') return 'xiaohongshu';
    if (task === 'video-script') return 'video';
    if (task === 'student-feedback' || task === 'renewal-script' || task === 'follow-reminder' || task === 'trial-report' || task === 'conversion-script') return 'parent';
    if (task === 'article-draft') return 'wechat';
    return 'general';
}

function tokenizeForMatch(text) {
    return String(text || '')
        .toLowerCase()
        .split(/[\s,，。.!！?？;；:：、/\\|()[\]{}"'“”‘’<>《》]+/)
        .map(item => item.trim())
        .filter(item => item.length >= 2)
        .slice(0, 12);
}

function textMatches(item, keywords) {
    if (!keywords.length) return false;
    const text = JSON.stringify(item).toLowerCase();
    return keywords.some(keyword => text.includes(keyword));
}

function pickKnowledgeItems(items, keywords, limit) {
    const matched = items.filter(item => textMatches(item, keywords));
    const source = matched.length > 0 ? matched : items;
    return source.slice(0, limit);
}

function toContextRef(refType, item, summaryKey = 'summary') {
    return {
        refType,
        refId: item.id || '',
        title: item.title || item.name || item.stem || item.task || '',
        summary: safeText(item[summaryKey] || item.content || item.rulesText || item.stem || '', 240)
    };
}

function buildKnowledgeContext(task, payload) {
    const userText = payload.userInstruction || payload.input || '';
    const keywords = tokenizeForMatch(userText);
    const platform = getPlatformForTask(task);
    const refs = [];
    const knowledge = {
        styleProfile: null,
        styleSamples: [],
        sources: [],
        questions: [],
        refs
    };

    const profiles = listResource('styleProfiles');
    const defaultProfile = profiles.find(item => item.isDefault) ||
        profiles.find(item => item.platform === platform) ||
        profiles.find(item => item.platform === 'general') ||
        profiles[0];
    if (defaultProfile) {
        knowledge.styleProfile = {
            id: defaultProfile.id,
            name: defaultProfile.name,
            platform: defaultProfile.platform,
            rulesText: safeLongText(defaultProfile.rulesText, 1000),
            forbiddenWords: defaultProfile.forbiddenWords || [],
            preferredPhrases: defaultProfile.preferredPhrases || []
        };
        refs.push(toContextRef('style', defaultProfile, 'rulesText'));
        const samples = listResource('styleSamples')
            .filter(item => !item.profileId || item.profileId === defaultProfile.id)
            .filter(item => item.quality !== 'avoid');
        knowledge.styleSamples = pickKnowledgeItems(samples, keywords, 3).map(item => ({
            id: item.id,
            title: item.title,
            sampleType: item.sampleType,
            content: safeLongText(item.content, 600)
        }));
        knowledge.styleSamples.forEach(item => refs.push(toContextRef('style-sample', item, 'content')));
    }

    const sources = listResource('knowledgeSources').filter(item => item.status !== 'archived');
    const contentTasks = ['article-draft', 'xiaohongshu-note', 'video-script', 'moment-content'];
    const resourceTasks = ['resource-brief', 'research-plan'];
    const teachingTasks = ['question-bank-plan', 'question-classify', 'exercise-recommend', 'lesson-plan', 'learning-path', 'exam-analysis'];
    if (contentTasks.includes(task)) {
        knowledge.sources = pickKnowledgeItems(sources.filter(item => ['content', 'resource', 'style'].includes(item.category)), keywords, 5)
            .map(item => ({
                id: item.id,
                title: item.title,
                category: item.category,
                grade: item.grade,
                tags: item.tags || [],
                summary: safeLongText(item.summary || item.rawText, 500)
            }));
    } else if (resourceTasks.includes(task)) {
        knowledge.sources = pickKnowledgeItems(sources.filter(item => item.category === 'resource'), keywords, 6)
            .map(item => ({
                id: item.id,
                title: item.title,
                subCategory: item.subCategory,
                trustLevel: item.trustLevel,
                grade: item.grade,
                tags: item.tags || [],
                summary: safeLongText(item.summary || item.rawText, 700)
            }));
    }
    knowledge.sources.forEach(item => refs.push(toContextRef('source', item)));

    if (teachingTasks.includes(task)) {
        knowledge.questions = pickKnowledgeItems(listResource('questionItems').filter(item => item.status !== 'archived'), keywords, 5)
            .map(item => ({
                id: item.id,
                grade: item.grade,
                chapter: item.chapter,
                knowledgePoints: item.knowledgePoints || [],
                questionType: item.questionType,
                difficulty: item.difficulty,
                stem: safeLongText(item.stem, 500),
                answer: safeText(item.answer, 160),
                commonMistakes: safeText(item.commonMistakes, 200)
            }));
        knowledge.questions.forEach(item => refs.push(toContextRef('question', item, 'stem')));
    }

    return knowledge;
}

function buildAIContext(payload) {
    const data = getDataFromEntityColumns();
    const privacyMode = payload.privacyMode === 'named' ? 'named' : 'masked';
    const task = normalizeTask(payload.task || '');
    const base = {
        agent: payload.agent || '',
        agentName: AGENT_NAMES[payload.agent] || payload.agent || '',
        task,
        requestedTask: payload.task || '',
        taskName: TASK_NAMES[task] || task,
        privacyMode,
        dataRange: getTaskDataRange(task),
        userInstruction: safeText(payload.userInstruction || payload.input || '', 1000),
        knowledge: buildKnowledgeContext(task, payload)
    };

    if (task === 'student-feedback' || task === 'renewal-script') {
        return { ...base, context: buildStudentContext(data, payload, privacyMode) };
    }
    if (task === 'follow-reminder' || task === 'trial-report' || task === 'conversion-script' || task === 'moment-content') {
        return { ...base, context: buildProspectContext(data, payload, privacyMode) };
    }
    if (['lesson-plan', 'exercise-recommend', 'learning-path', 'exam-analysis', 'question-bank-plan', 'question-classify'].includes(task)) {
        return { ...base, context: buildTeachingContext(data, payload) };
    }
    if (['article-draft', 'xiaohongshu-note', 'video-script', 'resource-brief', 'research-plan'].includes(task)) {
        return { ...base, context: buildContentContext(data, payload) };
    }
    return { ...base, context: buildBusinessContext(data, privacyMode) };
}

function buildLocalTemplate(context) {
    const { task, taskName, privacyMode, userInstruction } = context;
    const modeText = privacyMode === 'named' ? '带姓名生成' : '脱敏生成';
    if (task === 'student-feedback') {
        const item = context.context;
        const name = item.found ? item.student.name : '该学员';
        return `【${taskName}｜本地模板】\n生成模式：${modeText}\n\n${name}近期学习反馈：\n1. 学习表现：结合最近成绩、考勤和课堂记录，整体表现可以继续保持观察。\n2. 进步点：建议补充老师实际观察到的进步，例如计算速度、审题习惯或课堂参与度。\n3. 薄弱点：可参考最近成绩记录中的薄弱点进行补充。\n4. 后续建议：建议保持稳定出勤，并针对薄弱题型安排复习。\n\n用户补充：${userInstruction || '无'}\n\n说明：当前为本地模板，未调用真实 AI，不会自动修改系统数据。`;
    }
    if (task === 'renewal-script') {
        const item = context.context;
        const name = item.found ? item.student.name : '孩子';
        const remaining = item.found ? item.consumption.remainingHours : '';
        return `【${taskName}｜本地模板】\n生成模式：${modeText}\n\n家长您好，${name}最近学习状态整体稳定，目前剩余课时${remaining === '' ? '需要再确认' : `${remaining}节`}。为了保证后续学习连续性，建议我们这两天确认一下下一阶段课程安排。\n\n可以根据孩子最近的表现，重点沟通：学习连续性、薄弱点巩固、下阶段目标。\n\n说明：当前为本地模板，未调用真实 AI，不会自动新增收费或欠费记录。`;
    }
    if (task === 'follow-reminder' || task === 'trial-report' || task === 'trial-conversion') {
        const item = context.context;
        const name = item.found ? item.prospect.name : '该意向学员';
        return `【${taskName}｜本地模板】\n生成模式：${modeText}\n\n${name}跟进建议：\n1. 先确认家长当前最关心的问题。\n2. 再结合年级、试课状态和目前成绩说明课程匹配度。\n3. 最后给出明确下一步：约试听、反馈试听结果、确认入班安排。\n\n说明：当前为本地模板，未调用真实 AI，不会自动改变成交状态。`;
    }
    const biz = context.context;
    return `【${taskName || 'AI 任务'}｜本地模板】\n生成模式：${modeText}\n\n当前业务摘要：\n- 在读学员：${biz.activeStudents || 0}人\n- 待续费学员：${biz.renewalPending || 0}人\n- 意向学员：${biz.prospects || 0}人\n- 正常班级：${biz.activeClasses || 0}个\n- 已登记课次：${biz.attendanceSessions || 0}次\n- 已缴金额：${biz.paidAmount || 0}元\n- 欠费金额：${biz.pendingAmount || 0}元\n\n建议：优先处理课时不足、待续费和未跟进意向学员。\n\n说明：当前为本地模板，未调用真实 AI，不会自动修改系统数据。`;
}

function getStyleGuide(context) {
    const profile = context?.knowledge?.styleProfile;
    const lines = [
        '默认采用“白老师”表达风格：真实、清楚、克制、偏实用，不夸张营销。',
        '句子尽量短，少用空话，不要堆形容词。',
        '可以直接给可执行清单、标题、结构、正文草稿。',
        '不要使用“突飞猛进、保证提升、逆袭、稳赢、名校必备”等过度承诺表达。',
        '面向家长时温和但不卑微；面向内容平台时专业但不油腻。',
        '如果信息不足，先基于用户补充做草稿，并列出需要补充的素材。'
    ];
    if (profile) {
        lines.push('');
        lines.push(`当前风格配置：${profile.name}`);
        if (profile.rulesText) lines.push(profile.rulesText);
        if (profile.preferredPhrases?.length) lines.push(`建议使用表达：${profile.preferredPhrases.join('、')}`);
        if (profile.forbiddenWords?.length) lines.push(`避免使用词：${profile.forbiddenWords.join('、')}`);
    }
    return lines.join('\n');
}

function getTaskOutputInstruction(task) {
    const map = {
        'article-draft': '输出公众号文章草稿：标题3个、开头、正文分段、小标题、结尾引导、可补充素材清单。正文要有观点和例子，不要只列提纲。',
        'xiaohongshu-note': '输出小红书笔记：标题5个、正文、分段符号、互动结尾、封面文字建议。避免夸张营销。',
        'video-script': '输出视频号脚本：标题、30-90秒口播稿、镜头/字幕提示、结尾引导。口语化，像老师本人在说。',
        'moment-content': '输出招生/朋友圈/短内容草稿：标题、正文、适用场景、可替换变量。注意低营销感。',
        'question-bank-plan': '输出数学题库建设方案：目录结构、字段设计、标签体系、难度分级、导入流程、后续可自动化的步骤。',
        'question-classify': '输出题目分类结果：知识点、题型、难度、易错点、适合年级、标签、讲解建议。若题目不足，请给分类规则。',
        'resource-brief': '输出资料简报：资料主题、需要收集的内容、可信来源类型、整理表格字段、使用方式、下次行动。',
        'research-plan': '输出资料收集计划：关键词、来源类型、筛选标准、整理结构、每周更新流程。',
        'lesson-plan': '输出教案框架：目标、重点、难点、课堂流程、例题类型、练习安排、课后反馈点。',
        'exercise-recommend': '输出练习建议：知识点、题型、难度、题量、错因标签、复习顺序。',
        'learning-path': '输出学习路径：阶段目标、每阶段任务、检测方式、资料/题型建议。',
        'exam-analysis': '输出试卷分析：得分结构、薄弱点、错因、下一步训练计划。',
        'weekly-report': '输出经营周报：关键数据、问题判断、下周重点、3条行动清单。',
        'monthly-report': '输出月度经营复盘：数据变化、风险、机会、下月动作。',
        'class-consumption': '输出课消分析：班级进度、课时风险、需要跟进的动作。',
        'tuition-warning': '输出欠费与续费预警：分类、优先级、建议动作，不要生成催收压力话术。',
        'student-feedback': '输出学情反馈草稿：近期表现、进步、薄弱点、建议。务必像老师真实反馈，不要夸张。',
        'renewal-script': '输出续费沟通草稿：温和版、直接版、后续跟进提醒。不自动承诺效果。',
        'follow-reminder': '输出招生跟进清单和话术：下一步、家长可能顾虑、回复模板。',
        'trial-report': '输出试听反馈草稿：观察点、适合程度、建议安排。',
        'conversion-script': '输出试听后转化话术：温和、真实、明确下一步。'
    };
    return map[task] || '输出可直接使用的中文草稿或行动清单，结构清晰，避免空泛。';
}

function buildPrompt(context) {
    return [
        '你是一个个人教培机构的 AI 助手。',
        '请根据给定的脱敏业务上下文生成中文内容。',
        '必须遵守：只输出建议或文案，不声称已经修改系统，不自动发送给家长。',
        '隐私要求：如果上下文中的姓名带有 *，输出时必须保留 *，不要改成单字姓氏，也不要猜测完整姓名。',
        '不要输出思考过程，不要输出 <think> 标签内容。',
        '',
        '【表达风格】',
        getStyleGuide(context),
        '',
        '【输出要求】',
        getTaskOutputInstruction(context.task),
        `任务：${context.taskName || context.task}`,
        `隐私模式：${context.privacyMode}`,
        `读取范围：${context.dataRange.join('、')}`,
        `用户补充：${context.userInstruction || '无'}`,
        '',
        '【知识库上下文】',
        JSON.stringify({
            styleSamples: context.knowledge?.styleSamples || [],
            sources: context.knowledge?.sources || [],
            questions: context.knowledge?.questions || []
        }, null, 2),
        '',
        '上下文 JSON：',
        JSON.stringify(context.context, null, 2)
    ].join('\n');
}

function getProviderEndpoint(provider) {
    const baseUrl = (config.ai.baseUrl || getDefaultBaseUrl(provider)).replace(/\/$/, '');
    if (!baseUrl) return '';
    return `${baseUrl}/chat/completions`;
}

async function callRealAI(context) {
    const provider = normalizeProvider(config.ai.provider);
    const endpoint = getProviderEndpoint(provider);
    const model = config.ai.model || getDefaultModel(provider);
    if (!endpoint || !model || !config.ai.apiKey) {
        throw new Error('AI 配置不完整');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.ai.apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: '你是谨慎的教培业务助手，输出必须简洁、可复制、不过度承诺。' },
                    { role: 'user', content: buildPrompt(context) }
                ],
                temperature: 0.4,
                reasoning_split: true
            }),
            signal: controller.signal
        });
        const parsed = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(parsed.error?.message || `AI 接口返回 ${response.status}`);
        }
        const result = parsed.choices?.[0]?.message?.content;
        if (!result) throw new Error('AI 返回内容为空');
        return stripThinkTags(result);
    } finally {
        clearTimeout(timer);
    }
}

function insertAiTask(task) {
    getDb().prepare(`
        INSERT INTO ai_tasks (id, task_type, title, input_json, output_text, status, related_type, related_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        task.id,
        task.taskType,
        task.title,
        JSON.stringify(task.input || {}),
        task.outputText || '',
        task.status,
        task.relatedType || '',
        task.relatedId || '',
        task.createdAt,
        task.updatedAt
    );
}

function updateAiTask(taskId, fields) {
    getDb().prepare(`
        UPDATE ai_tasks
        SET output_text = ?, status = ?, updated_at = ?
        WHERE id = ?
    `).run(fields.outputText || '', fields.status, nowIso(), taskId);
}

function insertAgentLog(log) {
    getDb().prepare(`
        INSERT INTO agent_logs (id, agent_name, action, input_json, output_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        log.id,
        log.agentName,
        log.action,
        JSON.stringify(log.input || {}),
        JSON.stringify(log.output || {}),
        log.createdAt
    );
}

function insertAiContextRefs(taskId, refs = []) {
    if (!Array.isArray(refs) || refs.length === 0) return;
    const insert = getDb().prepare(`
        INSERT INTO ai_context_refs (id, ai_task_id, ref_type, ref_id, title, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    refs.slice(0, 20).forEach(ref => {
        insert.run(
            newId('ctxref'),
            taskId,
            ref.refType || '',
            ref.refId || '',
            safeText(ref.title, 160),
            safeText(ref.summary, 500),
            nowIso()
        );
    });
}

function listAIContextRefs(taskId) {
    return getDb().prepare(`
        SELECT id, ref_type AS refType, ref_id AS refId, title, summary, created_at AS createdAt
        FROM ai_context_refs
        WHERE ai_task_id = ?
        ORDER BY rowid
    `).all(taskId);
}

function buildLogInput(context) {
    const input = {
        agent: context.agent,
        task: context.task,
        privacyMode: context.privacyMode,
        dataRange: context.dataRange,
        relatedFound: Boolean(context.context?.found),
        contextType: context.context?.type || ''
    };
    if (config.ai.logFullInput) {
        input.fullContext = context;
    }
    return input;
}

async function generateAIResponse(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        const error = new Error('AI 请求内容必须是对象');
        error.statusCode = 400;
        throw error;
    }
    const agent = payload.agent || 'biz-agent';
    const requestedTask = payload.task || '';
    const task = normalizeTask(requestedTask);
    if (!TASK_NAMES[task]) {
        const error = new Error('不支持的 AI 任务类型');
        error.statusCode = 400;
        throw error;
    }
    const context = buildAIContext({ ...payload, agent, task, requestedTask });
    const status = getAiStatus();
    const taskId = newId('ai_task');
    const createdAt = nowIso();
    insertAiTask({
        id: taskId,
        taskType: task,
        title: context.taskName,
        input: buildLogInput(context),
        outputText: '',
        status: 'running',
        relatedType: payload.relatedType || '',
        relatedId: payload.relatedId || '',
        createdAt,
        updatedAt: createdAt
    });
    insertAiContextRefs(taskId, context.knowledge?.refs || []);

    try {
        const warnings = [];
        let mode = status.mode;
        let result;
        if (status.enabled) {
            result = await callRealAI(context);
        } else {
            mode = 'local-template';
            result = buildLocalTemplate(context);
            warnings.push('AI_PROVIDER 未启用或未配置密钥，已使用本地模板。');
        }
        updateAiTask(taskId, { outputText: result, status: 'done' });
        insertAgentLog({
            id: newId('agent_log'),
            agentName: AGENT_NAMES[agent] || agent,
            action: context.taskName || task,
            input: buildLogInput(context),
            output: {
                mode,
                success: true,
                taskId,
                outputLength: result.length,
                warnings
            },
            createdAt: nowIso()
        });
        return {
            success: true,
            taskId,
            mode,
            provider: status.provider,
            result,
            dataRange: context.dataRange,
            contextRefs: listAIContextRefs(taskId),
            privacyMode: context.privacyMode,
            warnings
        };
    } catch (error) {
        const message = error.name === 'AbortError' ? 'AI 接口超时，请稍后重试' : error.message;
        updateAiTask(taskId, { outputText: message, status: 'failed' });
        insertAgentLog({
            id: newId('agent_log'),
            agentName: AGENT_NAMES[agent] || agent,
            action: context.taskName || task,
            input: buildLogInput(context),
            output: {
                mode: status.mode,
                success: false,
                taskId,
                error: message
            },
            createdAt: nowIso()
        });
        const apiError = new Error(message);
        apiError.statusCode = 502;
        throw apiError;
    }
}

function listAITasks(limit = 30) {
    return getDb().prepare(`
        SELECT id, task_type AS taskType, title, status, related_type AS relatedType, related_id AS relatedId, created_at AS createdAt, updated_at AS updatedAt
        FROM ai_tasks
        ORDER BY rowid DESC
        LIMIT ?
    `).all(limit);
}

function listAgentLogs(limit = 30) {
    return getDb().prepare(`
        SELECT id, agent_name AS agentName, action, output_json AS outputJson, created_at AS createdAt
        FROM agent_logs
        ORDER BY rowid DESC
        LIMIT ?
    `).all(limit).map(row => ({
        ...row,
        output: (() => {
            try {
                return JSON.parse(row.outputJson || '{}');
            } catch {
                return {};
            }
        })(),
        outputJson: undefined
    }));
}

module.exports = {
    getAiStatus,
    generateAIResponse,
    listAITasks,
    listAgentLogs,
    listAIContextRefs,
    buildAIContext,
    buildLocalTemplate
};
