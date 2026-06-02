const config = require('./config');
const { getDb, getDataFromEntityColumns } = require('./db');

const AGENT_NAMES = {
    'admin-agent': '教务 Agent',
    'learning-agent': '学情沟通 Agent',
    'recruit-agent': '招生跟进 Agent',
    'teaching-agent': '教研 Agent',
    'biz-agent': '经营分析 Agent'
};

const TASK_NAMES = {
    'student-feedback': '生成学情反馈',
    'renewal-script': '生成续费沟通话术',
    'weekly-report': '生成本周经营周报',
    'monthly-report': '生成月度经营报告',
    'consumption-analysis': '班级课消分析',
    'fee-warning': '欠费预警',
    'follow-reminder': '招生跟进提醒',
    'trial-report': '试听反馈',
    'trial-conversion': '试听后转化话术',
    'social-content': '招生内容草稿',
    'schedule-check': '排课冲突检查',
    'attendance-anomaly': '考勤异常检查',
    'lesson-plan': '教案框架',
    'practice-suggestion': '练习建议',
    'learning-path': '学习路径',
    'exam-analysis': '试卷分析'
};

const TASK_DATA_RANGES = {
    'student-feedback': ['学员基础信息', '最近成绩', '最近考勤', '课时余额', '沟通摘要'],
    'renewal-script': ['学员基础信息', '课时余额', '班级进度', '收费摘要'],
    'weekly-report': ['本周新增', '课消摘要', '收费摘要', '欠费摘要', '待续费摘要'],
    'monthly-report': ['月度课消', '收费摘要', '班级进度', '意向学员摘要'],
    'consumption-analysis': ['班级课次', '学员课时余额', '出勤统计'],
    'fee-warning': ['欠费记录', '待续费学员', '课时不足摘要'],
    'follow-reminder': ['意向学员状态', '来源', '年级', '备注摘要'],
    'trial-report': ['意向学员信息', '试课状态', '备注摘要'],
    'trial-conversion': ['意向学员信息', '试课状态', '成交状态', '备注摘要'],
    'social-content': ['招生摘要', '课程方向', '用户补充说明']
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
    return config.ai.baseUrl || '';
}

function getDefaultModel(provider) {
    if (provider === 'openai') return 'gpt-4.1-mini';
    if (provider === 'deepseek') return 'deepseek-chat';
    return config.ai.model || '';
}

function safeText(value, max = 200) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
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

function getTaskDataRange(task) {
    return TASK_DATA_RANGES[task] || ['当前模块摘要', '用户补充说明'];
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

function buildAIContext(payload) {
    const data = getDataFromEntityColumns();
    const privacyMode = payload.privacyMode === 'named' ? 'named' : 'masked';
    const task = payload.task || '';
    const base = {
        agent: payload.agent || '',
        agentName: AGENT_NAMES[payload.agent] || payload.agent || '',
        task,
        taskName: TASK_NAMES[task] || task,
        privacyMode,
        dataRange: getTaskDataRange(task),
        userInstruction: safeText(payload.userInstruction || payload.input || '', 1000)
    };

    if (task === 'student-feedback' || task === 'renewal-script') {
        return { ...base, context: buildStudentContext(data, payload, privacyMode) };
    }
    if (task === 'follow-reminder' || task === 'trial-report' || task === 'trial-conversion' || task === 'social-content') {
        return { ...base, context: buildProspectContext(data, payload, privacyMode) };
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

function buildPrompt(context) {
    return [
        '你是一个个人教培机构的 AI 助手。',
        '请根据给定的脱敏业务上下文生成中文内容。',
        '必须遵守：只输出建议或文案，不声称已经修改系统，不自动发送给家长。',
        `任务：${context.taskName || context.task}`,
        `隐私模式：${context.privacyMode}`,
        `读取范围：${context.dataRange.join('、')}`,
        `用户补充：${context.userInstruction || '无'}`,
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
                temperature: 0.4
            }),
            signal: controller.signal
        });
        const parsed = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(parsed.error?.message || `AI 接口返回 ${response.status}`);
        }
        const result = parsed.choices?.[0]?.message?.content;
        if (!result) throw new Error('AI 返回内容为空');
        return result;
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
    const task = payload.task || '';
    if (!TASK_NAMES[task]) {
        const error = new Error('不支持的 AI 任务类型');
        error.statusCode = 400;
        throw error;
    }
    const context = buildAIContext({ ...payload, agent, task });
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
    buildAIContext,
    buildLocalTemplate
};
