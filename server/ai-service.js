const config = require('./config');
const { getDb, getDataFromEntityColumns } = require('./db');
const { listResource, getResource } = require('./knowledge-service');
const { buildSystemQAContext, buildSystemFactAnswer, buildSystemQAWriteIntentAnswer, buildNoEvidenceSystemQAAnswer, normalizeSourceScope, isSystemQAAdviceIntent, wantsSystemDataForAdvice } = require('./ai-system-qa');

const AGENT_NAMES = {
    'system-agent': '系统问答助手',
    'admin-agent': '教务 Agent',
    'learning-agent': '学情沟通 Agent',
    'recruit-agent': '招生跟进 Agent',
    'teaching-agent': '教研 Agent',
    'biz-agent': '经营分析 Agent'
};

const TASK_NAMES = {
    'system-qa': '系统数据问答',

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
    'renewal-reminder': '续费到期提醒',

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
    'system-qa': ['学生', '班级', '收费', '考勤', '成绩', '沟通记录', '意向学员', '数据异常摘要'],

    'student-feedback': ['学员基础信息', '最近成绩', '最近考勤', '课时余额', '沟通摘要'],
    'renewal-script': ['学员基础信息', '课时余额', '班级进度', '收费摘要'],
    'parent-greeting': ['学员基础信息', '班级信息', '用户补充说明'],
    'weekly-report': ['本周新增', '课消摘要', '收费摘要', '欠费摘要', '待续费摘要'],
    'monthly-report': ['月度课消', '收费摘要', '班级进度', '意向学员摘要'],
    'class-consumption': ['班级课次', '学员课时余额', '出勤统计'],
    'consumption-analysis': ['班级课次', '学员课时余额', '出勤统计'],
    'tuition-warning': ['欠费记录', '待续费学员', '课时不足摘要'],
    'fee-warning': ['欠费记录', '待续费学员', '课时不足摘要'],
    'follow-reminder': ['意向学员状态', '来源', '年级', '多次接触记录', '下一步动作'],
    'trial-report': ['意向学员信息', '试课状态', '多次接触记录', '备注摘要'],
    'conversion-script': ['意向学员信息', '试课状态', '成交状态', '多次接触记录'],
    'trial-conversion': ['意向学员信息', '试课状态', '成交状态', '多次接触记录'],
    'moment-content': ['招生摘要', '课程方向', '用户补充说明'],
    'social-content': ['招生摘要', '课程方向', '用户补充说明'],
    'schedule-conflict': ['班级上课时间', '学员班级归属', '用户补充说明'],
    'schedule-check': ['班级上课时间', '学员班级归属', '用户补充说明'],
    'attendance-anomaly': ['考勤记录', '班级学员', '出勤异常摘要'],
    'class-full-check': ['班级人数', '班级容量', '组班状态'],
    'renewal-reminder': ['待续费学员', '欠费记录', '课时不足摘要'],
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

function normalizeAnswerLength(value) {
    return value === 'detailed' ? 'detailed' : 'brief';
}

function resolveAIProviderConfig(providerOverride = '') {
    const requestedProvider = normalizeProvider(providerOverride || config.ai.provider);
    const provider = requestedProvider === 'disabled' ? requestedProvider : requestedProvider || 'minimax';
    const savedConfig = config.ai.providers?.[provider] || {};
    return {
        provider,
        label: savedConfig.label || provider,
        apiKey: savedConfig.apiKey || (provider === normalizeProvider(config.ai.provider) ? config.ai.apiKey : ''),
        model: savedConfig.model || (provider === normalizeProvider(config.ai.provider) ? config.ai.model : '') || getDefaultModel(provider),
        baseUrl: savedConfig.baseUrl || (provider === normalizeProvider(config.ai.provider) ? config.ai.baseUrl : '') || getDefaultBaseUrl(provider),
        timeoutMs: Number(savedConfig.timeoutMs || config.ai.timeoutMs || 60000)
    };
}

function getAiStatus(providerOverride = '') {
    const providerConfig = resolveAIProviderConfig(providerOverride);
    const provider = providerConfig.provider;
    const model = providerConfig.model || getDefaultModel(provider) || '';
    const endpoint = getProviderEndpoint(provider, providerConfig.baseUrl);
    const missing = [];
    if (provider === 'disabled') missing.push('AI_PROVIDER');
    if (provider !== 'disabled' && !providerConfig.apiKey) missing.push(`${provider.toUpperCase()}_API_KEY`);
    if (provider !== 'disabled' && !model) missing.push('AI_MODEL');
    if (provider !== 'disabled' && !endpoint) missing.push('AI_BASE_URL');
    const enabled = missing.length === 0;
    const providers = Object.values(config.ai.providers || {}).map(item => {
        const itemProvider = normalizeProvider(item.provider);
        const itemConfig = resolveAIProviderConfig(itemProvider);
        const itemEndpoint = getProviderEndpoint(itemProvider, itemConfig.baseUrl);
        return {
            provider: itemProvider,
            label: item.label || itemProvider,
            enabled: Boolean(itemConfig.apiKey && itemConfig.model && itemEndpoint),
            model: itemConfig.model || '',
            baseUrl: itemConfig.baseUrl || ''
        };
    });
    return {
        provider,
        activeProvider: provider,
        enabled,
        mode: enabled ? 'real-ai' : 'local-template',
        model,
        timeoutMs: config.ai.timeoutMs,
        envFileLoaded: Boolean(config.ai.envFileLoaded),
        envFile: config.ai.envFile,
        providers,
        missing
    };
}

function getConfiguredFallbackProviders(primaryProvider = '') {
    const preferredOrder = ['deepseek', 'qwen', 'minimax'];
    const providers = Object.values(config.ai.providers || {})
        .map(item => normalizeProvider(item.provider))
        .filter(Boolean);
    return [...new Set([...preferredOrder, ...providers])]
        .filter(provider => provider && provider !== normalizeProvider(primaryProvider))
        .filter(provider => getAiStatus(provider).enabled);
}

async function callRealAIWithFallback(context, primaryStatus) {
    try {
        return {
            result: await callRealAI(context),
            status: primaryStatus,
            fallbackFrom: '',
            warning: ''
        };
    } catch (primaryError) {
        let lastError = primaryError;
        const originalProvider = context.modelProvider;
        const fallbackProviders = getConfiguredFallbackProviders(primaryStatus.provider);
        for (const provider of fallbackProviders) {
            const fallbackStatus = getAiStatus(provider);
            try {
                context.modelProvider = provider;
                return {
                    result: await callRealAI(context),
                    status: fallbackStatus,
                    fallbackFrom: primaryStatus.provider,
                    warning: `${primaryStatus.label || primaryStatus.provider} 调用失败，已自动改用 ${fallbackStatus.label || fallbackStatus.provider}。`
                };
            } catch (error) {
                lastError = error;
            } finally {
                context.modelProvider = originalProvider;
            }
        }
        throw lastError;
    }
}

function getDefaultBaseUrl(provider) {
    if (provider === 'openai') return 'https://api.openai.com/v1';
    if (provider === 'deepseek') return 'https://api.deepseek.com';
    if (provider === 'minimax') return 'https://api.minimax.io/v1';
    if (provider === 'qwen') return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    return config.ai.baseUrl || '';
}

function getDefaultModel(provider) {
    if (provider === 'openai') return 'gpt-4.1-mini';
    if (provider === 'deepseek') return 'deepseek-v4-flash';
    if (provider === 'minimax') return 'MiniMax-M2.7-highspeed';
    if (provider === 'qwen') return 'qwen-plus';
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

function getProspectContactLogs(prospect) {
    return Array.isArray(prospect?.contactLogs)
        ? prospect.contactLogs
            .filter(log => log && typeof log === 'object')
            .slice()
            .sort((a, b) => String(b.contactDate || b.createdAt || '').localeCompare(String(a.contactDate || a.createdAt || '')))
        : [];
}

function stripThinkTags(text) {
    return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function compactBriefAdviceResult(text) {
    const sourceLine = String(text || '').split(/\n/).find(line => /根据当前选择的回答依据/.test(line)) || '';
    const lines = String(text || '')
        .replace(/^[-–—]{3,}$/gm, '')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => !/^\|?\s*-{2,}/.test(line))
        .filter(line => !/^#+\s*/.test(line))
        .filter(line => !/^\|/.test(line));
    const contentLines = lines
        .filter(line => line !== sourceLine)
        .filter(line => !/以上为辅助判断/.test(line))
        .slice(0, 6)
        .map(line => line.length > 90 ? `${line.slice(0, 90)}...` : line);
    const resultLines = [];
    if (sourceLine) resultLines.push(sourceLine);
    resultLines.push(...contentLines);
    resultLines.push('以上为辅助判断，重要操作请以原始记录为准。');
    return resultLines.join('\n');
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
    const contactLogs = getProspectContactLogs(prospect);
    const latestContact = contactLogs[0] || {};
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
            remark: safeText(prospect.remark, 160),
            contactCount: contactLogs.length,
            latestContact: contactLogs.length ? {
                contactDate: latestContact.contactDate || '',
                contactType: latestContact.contactType || '',
                contactPerson: latestContact.contactPerson || '',
                status: latestContact.status || '',
                content: safeText(latestContact.content, 180),
                nextAction: safeText(latestContact.nextAction, 160)
            } : null
        },
        contactLogs: contactLogs.slice(0, 8).map(log => ({
            contactDate: log.contactDate || '',
            contactType: log.contactType || '',
            contactPerson: log.contactPerson || '',
            status: log.status || '',
            content: safeText(log.content, 180),
            nextAction: safeText(log.nextAction, 160)
        }))
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
    const sourceScope = normalizeSourceScope(payload);
    const refs = [];
    const knowledge = {
        styleProfile: null,
        styleSamples: [],
        sources: [],
        chunks: [],
        webResults: [],
        questions: [],
        refs,
        warnings: []
    };

    const profiles = task === 'system-qa' ? [] : listResource('styleProfiles');
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
    } else if (task !== 'system-qa') {
        knowledge.warnings.push('知识库还没有风格配置，当前只使用系统默认“白老师风格”。');
    }

    const sources = listResource('knowledgeSources').filter(item => item.status !== 'archived');
    const contentTasks = ['article-draft', 'xiaohongshu-note', 'video-script', 'moment-content'];
    const resourceTasks = ['resource-brief', 'research-plan'];
    const teachingTasks = ['question-bank-plan', 'question-classify', 'exercise-recommend', 'lesson-plan', 'learning-path', 'exam-analysis'];
    if (task === 'system-qa' && sourceScope.knowledgeBase) {
        knowledge.sources = pickKnowledgeItems(sources.filter(item => ['resource', 'content', 'style'].includes(item.category)), keywords, 8)
            .map(item => ({
                id: item.id,
                title: item.title,
                category: item.category,
                subCategory: item.subCategory,
                trustLevel: item.trustLevel,
                grade: item.grade,
                sourceType: item.sourceType,
                filePath: item.filePath,
                tags: item.tags || [],
                summary: safeLongText(item.summary || item.rawText, 800)
            }));
        knowledge.chunks = pickKnowledgeItems(listResource('knowledgeChunks'), keywords, 8)
            .map(item => ({
                id: item.id,
                sourceId: item.sourceId,
                title: item.title,
                summary: safeLongText(item.summary || item.content, 700),
                tags: item.tags || []
            }));
    } else if (contentTasks.includes(task)) {
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
    knowledge.chunks.forEach(item => refs.push(toContextRef('source', item, 'summary')));
    if ((contentTasks.includes(task) || resourceTasks.includes(task) || (task === 'system-qa' && sourceScope.knowledgeBase)) && knowledge.sources.length === 0 && knowledge.chunks.length === 0) {
        knowledge.warnings.push('本次没有匹配到资料库内容，生成质量主要依赖你的输入。');
    }

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
        if (knowledge.questions.length === 0) {
            knowledge.warnings.push('本次没有匹配到题库内容，题库类结果会偏方案/规则，暂不能替代正式题库。');
        }
    }

    return knowledge;
}

function buildAIContext(payload) {
    const data = getDataFromEntityColumns();
    const privacyMode = payload.privacyMode === 'named' ? 'named' : 'masked';
    const task = normalizeTask(payload.task || '');
    const sourceScope = normalizeSourceScope(payload);
    const base = {
        agent: payload.agent || '',
        agentName: AGENT_NAMES[payload.agent] || payload.agent || '',
        task,
        requestedTask: payload.task || '',
        taskName: TASK_NAMES[task] || task,
        modelProvider: normalizeProvider(payload.modelProvider || payload.aiProvider || payload.providerOverride || config.ai.provider),
        answerLength: normalizeAnswerLength(payload.answerLength),
        privacyMode,
        sourceScope,
        dataRange: getTaskDataRange(task),
        userInstruction: safeText(payload.latestQuestion || payload.userInstruction || payload.input || '', 1000),
        conversationHistory: Array.isArray(payload.conversationHistory) ? payload.conversationHistory.slice(-8).map(item => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: safeText(item?.content || '', 500)
        })).filter(item => item.content) : [],
        knowledge: buildKnowledgeContext(task, payload)
    };

    if (task === 'system-qa') {
        return { ...base, context: buildSystemQAContext(data, payload, privacyMode) };
    }
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
    if (task === 'system-qa') {
        const item = context.context || {};
        const summary = item.summary || {};
        const risks = item.riskStudents || [];
        return `【${taskName}｜本地模板】\n生成模式：${modeText}\n\n仅根据当前系统数据回答：\n- 在读学员：${summary.activeStudentCount || 0}人\n- 待续费学员：${summary.renewalPendingCount || 0}人\n- 正常班级：${summary.activeClassCount || 0}个\n- 意向学员：${summary.prospectCount || 0}人\n- 欠费金额：${summary.pendingFeeAmount || 0}元\n- 本月已登记课次：${summary.currentMonthAttendanceSessions || 0}次\n\n需要优先关注：\n${risks.slice(0, 8).map(row => `- ${row.name}：${row.grade}，${row.className}，剩余课时 ${row.remainingHours}，欠费 ${row.pendingFeeAmount}元`).join('\n') || '- 暂无明显风险学员'}\n\n你的问题：${userInstruction || '无'}\n\n以上为系统数据辅助判断，重要操作请以原始记录为准。`;
    }
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
        const latest = item.found ? item.prospect.latestContact : null;
        const latestLine = latest
            ? `\n最近接触：${latest.contactDate || '-'}，${latest.contactType || '接触'}，${latest.content || '-'}${latest.nextAction ? `；下一步：${latest.nextAction}` : ''}`
            : '\n最近接触：暂无记录，建议先补一条接触记录。';
        return `【${taskName}｜本地模板】\n生成模式：${modeText}\n\n${name}跟进建议：${latestLine}\n\n1. 先确认家长当前最关心的问题。\n2. 再结合年级、试课状态和目前成绩说明课程匹配度。\n3. 最后给出明确下一步：约试听、反馈试听结果、确认入班安排。\n\n说明：当前为本地模板，未调用真实 AI，不会自动改变成交状态。`;
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
        'system-qa': '回答用户关于学生管理系统、知识库资料或联网资料的问题。只能基于上下文 JSON 中的真实数据和资料回答；可以做统计、筛选、分组、风险提示和下一步建议。不要说已经修改、创建、删除或发送任何数据。回答开头必须写“根据当前选择的回答依据：”。回答结尾必须写“以上为辅助判断，重要操作请以原始记录为准。”',
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
        'renewal-reminder': '输出续费到期提醒：按优先级列出需要跟进的人群、触发原因、建议动作和温和沟通提示。',
        'student-feedback': '输出学情反馈草稿：近期表现、进步、薄弱点、建议。务必像老师真实反馈，不要夸张。',
        'renewal-script': '输出续费沟通草稿：温和版、直接版、后续跟进提醒。不自动承诺效果。',
        'follow-reminder': '输出招生跟进清单和话术：下一步、家长可能顾虑、回复模板。',
        'trial-report': '输出试听反馈草稿：观察点、适合程度、建议安排。',
        'conversion-script': '输出试听后转化话术：温和、真实、明确下一步。'
    };
    return map[task] || '输出可直接使用的中文草稿或行动清单，结构清晰，避免空泛。';
}

function getPromptContext(context) {
    if (context.task !== 'system-qa') return context.context;
    const source = context.context || {};
    const facts = source.queryFacts || {};
    const hasFacts = Object.keys(facts).length > 0;
    const isAdvice = source.intent === 'advice' || isSystemQAAdviceIntent(source.userQuestion || context.userInstruction || '');
    const adviceWithSystemData = isAdvice && wantsSystemDataForAdvice(source.userQuestion || context.userInstruction || '');
    return {
        type: source.type,
        readonly: true,
        intent: source.intent || (isAdvice ? 'advice' : 'data-query'),
        adviceWithSystemData,
        userQuestion: source.userQuestion,
        answerLength: context.answerLength,
        summary: isAdvice && !adviceWithSystemData ? {} : (source.summary || {}),
        gradeCounts: isAdvice && !adviceWithSystemData ? {} : (source.gradeCounts || {}),
        queryFacts: facts,
        students: hasFacts || isAdvice ? [] : (source.students || []).slice(0, 30),
        classes: isAdvice && !adviceWithSystemData ? [] : (source.classes || []),
        riskStudents: isAdvice ? [] : (source.riskStudents || []),
        pendingFees: isAdvice ? [] : (source.pendingFees || []),
        grades: hasFacts || isAdvice ? [] : (source.grades || []).slice(0, 80),
        recentAttendance: isAdvice && !adviceWithSystemData ? [] : (source.recentAttendance || []),
        communications: hasFacts || isAdvice ? [] : (source.communications || []).slice(-30),
        prospects: hasFacts || isAdvice ? [] : (source.prospects || []).slice(0, 30),
        note: hasFacts
            ? '本次已命中系统精确查询，回答必须优先使用 queryFacts。'
            : isAdvice
                ? adviceWithSystemData
                    ? '本次是方案/建议类问题，用户明确要求结合系统数据；只可使用摘要和班级层信息，不要输出完整学员名单。'
                    : '本次是方案/建议类问题；按通用教培经验回答，不要声称读取了系统明细，不要输出学员名单、人数、班级数量、课消或欠费金额。'
                : '本次未命中专门事实查询，请基于精简上下文回答；如果没有证据，直接说明看不到。'
    };
}

function getSystemQASourceInstruction(context) {
    if (context.task !== 'system-qa') {
        return `回答依据：当前系统=${context.sourceScope?.systemData ? '是' : '否'}；知识库/Obsidian=${context.sourceScope?.knowledgeBase ? '是' : '否'}；联网搜索=${context.sourceScope?.webSearch ? '是' : '否'}`;
    }
    const question = context.context?.userQuestion || context.userInstruction || '';
    if (isSystemQAAdviceIntent(question) && !wantsSystemDataForAdvice(question)) {
        return `回答依据：通用教培建议${context.sourceScope?.knowledgeBase ? ' + 已导入资料库' : ''}${context.sourceScope?.webSearch ? ' + 联网搜索' : ''}；未读取系统学员/班级明细。`;
    }
    return `回答依据：当前系统=${context.sourceScope?.systemData ? '是' : '否'}；知识库/Obsidian=${context.sourceScope?.knowledgeBase ? '是' : '否'}；联网搜索=${context.sourceScope?.webSearch ? '是' : '否'}`;
}

function getSystemQADataRangeInstruction(context) {
    if (context.task !== 'system-qa') return `读取范围：${context.dataRange.join('、')}`;
    const question = context.context?.userQuestion || context.userInstruction || '';
    if (isSystemQAAdviceIntent(question) && !wantsSystemDataForAdvice(question)) {
        return '读取范围：通用建议；未读取学生名单、班级明细、收费、考勤、成绩明细。';
    }
    return `读取范围：${context.dataRange.join('、')}`;
}

function buildPrompt(context) {
    return [
        '你是一个个人数学教培机构的 AI 助手，服务对象是数学老师本人。',
        '请根据给定的脱敏业务上下文生成中文内容。',
        '必须遵守：只输出建议或文案，不声称已经修改系统，不自动发送给家长。',
        context.task === 'system-qa' ? '当前任务是系统数据问答：你只能读数据、解释数据、做统计和给建议，绝不能声称执行了写入操作。' : '',
        context.task === 'system-qa' ? '如果用户问“怎么做、如何准备、方案、家长会、招生内容、沟通话术”等建议类问题，不要强行列学员名单；请给简洁可执行方案。除非用户明确要求“结合我的数据/按班级/按学员”，否则不要主动引用系统人数、班级数量、课消进度、欠费金额等内部数据。' : '',
        context.task === 'system-qa' ? '如果数据中没有证据，请明确说“当前系统数据里看不到/无法判断”，不要编造。' : '',
        context.task === 'system-qa' ? '如果上下文 JSON 里有 queryFacts，必须优先使用 queryFacts 的 total 和 matches 回答；回答精确筛选问题时先写“共找到 X 条/人”，再列姓名、班级、测试、日期、分数等明细。' : '',
        context.task === 'system-qa' ? '不要只根据 recentGrades 回答全量成绩查询；全量成绩查询应参考 grades 或 queryFacts。' : '',
        context.task === 'system-qa' ? '查询学校时优先参考 student.currentSchool 和 student.schoolHistory；查询学生详情时可参考 students 与 queryFacts.studentLookup。' : '',
        '隐私要求：如果上下文中的姓名带有 *，输出时必须保留 *，不要改成单字姓氏，也不要猜测完整姓名。',
        '不要输出思考过程，不要输出 <think> 标签内容。',
        '',
        '【表达风格】',
        getStyleGuide(context),
        '',
        '【输出要求】',
        getTaskOutputInstruction(context.task),
        context.task === 'system-qa' && context.answerLength === 'brief' ? '输出模式：简洁。能一句话回答就一句话回答；列表最多先列 5-8 条；建议类问题最多 6 条要点，禁止表格，禁止长篇分段。' : '',
        context.task === 'system-qa' && context.answerLength === 'detailed' ? '输出模式：详细。先给结论，再给明细和必要建议。' : '',
        `任务：${context.taskName || context.task}`,
        `隐私模式：${context.privacyMode}`,
        `输出模式：${context.answerLength === 'detailed' ? '详细' : '简洁'}`,
        getSystemQASourceInstruction(context),
        getSystemQADataRangeInstruction(context),
        `用户补充：${context.userInstruction || '无'}`,
        context.conversationHistory?.length ? `最近对话：${JSON.stringify(context.conversationHistory, null, 2)}` : '',
        '',
        '【知识库上下文】',
        JSON.stringify({
            styleSamples: context.knowledge?.styleSamples || [],
            sources: context.knowledge?.sources || [],
            chunks: context.knowledge?.chunks || [],
            webResults: context.knowledge?.webResults || [],
            questions: context.knowledge?.questions || []
        }, null, 2),
        '',
        '上下文 JSON：',
        JSON.stringify(getPromptContext(context), null, 2)
    ].join('\n');
}

function stripHtmlTags(value) {
    return String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchWebSearchResults(query) {
    const cleanQuery = safeText(query, 120);
    if (!cleanQuery) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 StudentAIConsole/1.0' },
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`搜索请求失败：${response.status}`);
        const html = await response.text();
        const results = [];
        const resultBlocks = html.match(/<div class="result[\s\S]*?<\/div>\s*<\/div>/g) || [];
        resultBlocks.forEach(block => {
            if (results.length >= 5) return;
            const linkMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            if (!linkMatch) return;
            const snippetMatch = block.match(/<a[^>]+class="result__snippet"[\s\S]*?>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[\s\S]*?>([\s\S]*?)<\/div>/);
            results.push({
                title: stripHtmlTags(linkMatch[2]),
                url: stripHtmlTags(linkMatch[1]),
                snippet: stripHtmlTags(snippetMatch?.[1] || snippetMatch?.[2] || '')
            });
        });
        return results;
    } finally {
        clearTimeout(timer);
    }
}

async function augmentContextWithWebSearch(context) {
    if (!context.sourceScope?.webSearch) return context;
    context.knowledge = context.knowledge || { refs: [], warnings: [] };
    try {
        const query = context.context?.userQuestion || context.userInstruction || '';
        const results = await fetchWebSearchResults(query);
        context.knowledge.webResults = results;
        if (!Array.isArray(context.knowledge.refs)) context.knowledge.refs = [];
        results.forEach((item, index) => {
            context.knowledge.refs.push({
                refType: 'web',
                refId: item.url || `web-${index + 1}`,
                title: item.title || `联网结果 ${index + 1}`,
                summary: safeText(item.snippet || item.url, 240)
            });
        });
        if (results.length === 0) {
            context.knowledge.warnings = [...(context.knowledge.warnings || []), '本次联网搜索未返回可用结果。'];
        }
    } catch (error) {
        context.knowledge.webResults = [];
        context.knowledge.warnings = [...(context.knowledge.warnings || []), `联网搜索失败：${error.name === 'AbortError' ? '请求超时' : error.message}`];
    }
    return context;
}

function getProviderEndpoint(provider, baseUrlOverride = '') {
    const baseUrl = (baseUrlOverride || config.ai.baseUrl || getDefaultBaseUrl(provider)).replace(/\/$/, '');
    if (!baseUrl) return '';
    return `${baseUrl}/chat/completions`;
}

async function callRealAI(context) {
    const providerConfig = resolveAIProviderConfig(context.modelProvider || '');
    const provider = providerConfig.provider;
    const endpoint = getProviderEndpoint(provider, providerConfig.baseUrl);
    const model = providerConfig.model || getDefaultModel(provider);
    if (!endpoint || !model || !providerConfig.apiKey) {
        throw new Error('AI 配置不完整');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), providerConfig.timeoutMs);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${providerConfig.apiKey}`
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

async function generateRawAIText({ system = '', user = '', temperature = 0.1, timeoutMs = 0, provider: providerOverride = '', model: modelOverride = '', baseUrl = '', apiKey = '', jsonMode = false } = {}) {
    const providerConfig = resolveAIProviderConfig(providerOverride || '');
    const provider = providerConfig.provider;
    const endpoint = getProviderEndpoint(provider, baseUrl || providerConfig.baseUrl);
    const model = modelOverride || providerConfig.model || getDefaultModel(provider);
    const key = apiKey || providerConfig.apiKey;
    if (!endpoint || !model || !key) {
        throw new Error('AI 配置不完整');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || config.ai.timeoutMs);
    const body = {
        model,
        messages: [
            { role: 'system', content: system || '你是谨慎的结构化信息抽取助手，只输出用户要求的内容。' },
            { role: 'user', content: user || '' }
        ],
        temperature
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`
            },
            body: JSON.stringify(body),
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
        modelProvider: context.modelProvider || '',
        answerLength: context.answerLength || '',
        privacyMode: context.privacyMode,
        dataRange: context.dataRange,
        relatedFound: Boolean(context.context?.found),
        contextType: context.context?.type || '',
        latestQuestion: context.context?.userQuestion || context.userInstruction || '',
        factQuestion: context.context?.factQuestion || '',
        queryFactKeys: Object.keys(context.context?.queryFacts || {})
    };
    if (config.ai.logFullInput) {
        input.fullContext = context;
    }
    return input;
}

async function generateAIResponse(payload) {
    const startedAt = Date.now();
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
    let context = buildAIContext({ ...payload, agent, task, requestedTask });
    context = await augmentContextWithWebSearch(context);
    let status = getAiStatus(context.modelProvider);
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
        const warnings = [...(context.knowledge?.warnings || [])];
        let mode = status.mode;
        let result;
        let fallbackFrom = '';
        const writeIntentAnswer = buildSystemQAWriteIntentAnswer(context.context?.userQuestion || context.userInstruction || '');
        const noEvidenceAnswer = buildNoEvidenceSystemQAAnswer(context);
        const factAnswer = buildSystemFactAnswer(context);
        const adviceIntent = context.task === 'system-qa' && isSystemQAAdviceIntent(context.context?.userQuestion || context.userInstruction || '');
        if (context.task === 'system-qa' && writeIntentAnswer) {
            mode = 'system-safe';
            result = writeIntentAnswer;
        } else if (context.task === 'system-qa' && factAnswer) {
            mode = 'system-facts';
            result = factAnswer;
        } else if (context.task === 'system-qa' && noEvidenceAnswer) {
            mode = 'system-safe';
            result = noEvidenceAnswer;
        } else if (context.task === 'system-qa' && context.answerLength !== 'detailed' && !adviceIntent) {
            mode = 'system-safe';
            result = [
                '这个问题暂时没有命中系统精确查询规则，我先不乱答。',
                '你可以换成更明确的问法，例如：',
                '- 某个学生的学校/班级/课时/欠费/成绩/考勤',
                '- 某个年级或班级有哪些学生',
                '- 多少分以上/以下/不及格/满分有哪些学生',
                '- 本月课消、待收款、需要关注的学生',
                '如果你想让我做综合分析，可以切换到“详细”模式再问。'
            ].join('\n');
        } else if (status.enabled) {
            try {
                const aiResult = await callRealAIWithFallback(context, status);
                result = aiResult.result;
                if (aiResult.fallbackFrom) {
                    fallbackFrom = aiResult.fallbackFrom;
                    status = aiResult.status;
                    mode = status.mode;
                    warnings.push(aiResult.warning);
                }
            } catch (error) {
                const message = error.name === 'AbortError' ? 'AI 接口超时' : error.message;
                if (payload.fallbackOnError === false) throw error;
                if (context.task === 'system-qa' && factAnswer) {
                    mode = 'system-facts';
                    fallbackFrom = status.mode;
                    result = `${factAnswer}\n\n注：真实 AI 组织语言失败，以上为系统精确查询结果。`;
                    warnings.push(`真实 AI 调用失败，已显示系统精确查询结果：${message}`);
                } else if (context.task === 'system-qa') {
                    throw error;
                } else {
                    mode = 'local-template';
                    fallbackFrom = status.mode;
                    result = buildLocalTemplate(context);
                    warnings.push(`真实 AI 调用失败，已自动回退本地模板：${message}`);
                }
            }
        } else {
            if (context.task === 'system-qa' && factAnswer) {
                mode = 'system-facts';
                result = `${factAnswer}\n\n注：真实 AI 未启用，以上为系统精确查询结果。`;
                warnings.push('真实 AI 未启用，已显示系统精确查询结果。');
            } else if (context.task === 'system-qa') {
                throw new Error('真实 AI 未启用或配置不完整，且本次问题没有命中系统精确查询。');
            } else {
                mode = 'local-template';
                result = buildLocalTemplate(context);
                warnings.push('AI_PROVIDER 未启用或未配置密钥，已使用本地模板。');
            }
        }
        if (context.task === 'system-qa' && context.answerLength === 'brief' && adviceIntent && result) {
            result = compactBriefAdviceResult(result);
        }
        const elapsedMs = Date.now() - startedAt;
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
                warnings,
                fallbackFrom,
                elapsedMs,
                provider: status.provider,
                contextSize: JSON.stringify(getPromptContext(context)).length
            },
            createdAt: nowIso()
        });
        return {
            success: true,
            taskId,
            mode,
            provider: status.provider,
            result,
            generatedAt: nowIso(),
            answerLength: context.answerLength,
            dataRange: context.dataRange,
            sourceScope: context.sourceScope,
            queryFactKeys: Object.keys(context.context?.queryFacts || {}),
            contextSize: JSON.stringify(getPromptContext(context)).length,
            contextRefs: listAIContextRefs(taskId),
            privacyMode: context.privacyMode,
            warnings,
            fallbackFrom,
            elapsedMs
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
                error: message,
                provider: status.provider,
                contextSize: JSON.stringify(getPromptContext(context)).length
            },
            createdAt: nowIso()
        });
        const apiError = new Error(message);
        apiError.statusCode = 502;
        throw apiError;
    }
}

function listAITasks(limit = 30) {
    const rows = getDb().prepare(`
        SELECT id, task_type AS taskType, title, status, related_type AS relatedType, related_id AS relatedId, created_at AS createdAt, updated_at AS updatedAt
        FROM ai_tasks
        ORDER BY rowid DESC
        LIMIT ?
    `).all(limit);
    const logs = listAgentLogs(Math.max(Number(limit) || 30, 30));
    const outputByTaskId = new Map();
    logs.forEach(log => {
        const taskId = log.output?.taskId;
        if (taskId && !outputByTaskId.has(taskId)) outputByTaskId.set(taskId, log.output);
    });
    return rows.map(row => {
        const output = outputByTaskId.get(row.id) || {};
        return {
            ...row,
            mode: output.mode || '',
            fallbackFrom: output.fallbackFrom || '',
            elapsedMs: output.elapsedMs || null
        };
    });
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
    buildLocalTemplate,
    generateRawAIText
};
