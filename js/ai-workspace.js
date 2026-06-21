// ==================== AI 工作台 Stage 6C ====================

let currentAgentId = 'biz-agent';
let agentLogs = [];

// 全局隐私模式状态
let aiPrivacyMode = 'masked';
let aiPrivacyModeLocked = false;

// 当前任务信息
let lastTaskId = '';
let lastTaskMode = '';
let lastTaskProvider = '';

// 风格选择
let currentStyle = 'bai-teacher';
let currentCenterId = 'content';
let currentTaskType = '';
let currentTaskLabel = '';
let aiConversationMessages = [];
let systemQAConversations = [];
let currentSystemQAConversationId = '';
let systemQAConversationsLoaded = false;
let systemQAConversationSaveQueue = Promise.resolve();
let systemQAPrompts = [];
let systemQAPromptsLoaded = false;
let systemQAPromptManageMode = false;
let systemQAHistoryBatchMode = false;
let selectedSystemQAConversationIds = new Set();
let openSystemQAHistoryMenuId = '';
let selectedSystemQAModelProvider = localStorage.getItem('systemQAModelProvider') || 'minimax';
let selectedSystemQAAnswerLength = localStorage.getItem('systemQAAnswerLength') || 'brief';
let systemQAAIStatus = null;
let aiSourceScope = {
    systemData: true,
    knowledgeBase: false,
    webSearch: false
};

const DEFAULT_SYSTEM_QA_PROMPTS = [
    { id: 'qa_prompt_school_student', text: '某个同学是哪个学校的？', category: '学生', sortOrder: 10, isDefault: true },
    { id: 'qa_prompt_school_list', text: '某个学校有哪些学生？', category: '学生', sortOrder: 20, isDefault: true },
    { id: 'qa_prompt_hours_risk', text: '哪些学生课时快不够了？', category: '课时', sortOrder: 30, isDefault: true },
    { id: 'qa_prompt_grade_count', text: '六年级目前有多少在读学员？', category: '学生', sortOrder: 40, isDefault: true },
    { id: 'qa_prompt_score_100', text: '期中考100分的有哪些？', category: '成绩', sortOrder: 50, isDefault: true },
    { id: 'qa_prompt_fee_risk', text: '哪些学生有欠费或需要续费？', category: '收费', sortOrder: 60, isDefault: true },
    { id: 'qa_prompt_focus_students', text: '帮我总结一下最近需要关注的学生', category: '经营', sortOrder: 70, isDefault: true }
];

// ========== Markdown 安全渲染 ==========
function renderMarkdownTables(html) {
    const lines = html.split('\n');
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const header = lines[i];
        const separator = lines[i + 1];
        if (/^\s*\|.+\|\s*$/.test(header) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator || '')) {
            const rows = [];
            const parseCells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
            const headers = parseCells(header);
            i += 2;
            while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
                rows.push(parseCells(lines[i]));
                i += 1;
            }
            i -= 1;
            output.push(`<div class="ai-md-table-wrap"><table class="ai-md-table"><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, index) => `<td>${row[index] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        } else {
            output.push(header);
        }
    }
    return output.join('\n');
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;margin:8px 0;font-size:12px;line-height:1.4;"><code>$1</code></pre>');
    html = renderMarkdownTables(html);
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:var(--text-primary);">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin:14px 0 8px;font-size:16px;font-weight:600;color:var(--text-primary);">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 style="margin:16px 0 10px;font-size:18px;font-weight:600;color:var(--text-primary);">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:disc;">$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:decimal;">$2</li>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul style="margin:8px 0;padding-left:0;">$&</ul>');
    return `<div class="ai-md-content">${html}</div>`;
}

// ========== AI 状态加载 ==========
function loadAIStatus() {
    fetch('/api/ai/status')
        .then(res => res.json())
        .then(info => { updateAIStatusUI(info); })
        .catch(() => { updateAIStatusUI({ mode: 'local-template', enabled: false }); });
}

function updateAIStatusUI(info) {
    systemQAAIStatus = info || null;
    renderSystemQAModelProviderSelect();
    const statusEl = document.getElementById('agentStatus');
    const modeLabelEl = document.getElementById('aiModeLabel');
    const configStatusEl = document.getElementById('aiConfigStatus');
    if (!statusEl || !modeLabelEl) return;

    if (info.mode === 'real-ai' && info.enabled) {
        statusEl.textContent = '真实 AI';
        statusEl.style.background = '#27ae60';
        modeLabelEl.textContent = info.provider ? `已启用 · ${info.provider}` : '已启用';
        if (configStatusEl) configStatusEl.innerHTML = `<span style="color:#27ae60;">● 真实 AI 已启用</span> · ${escapeHtml(info.provider || '')}`;
    } else if (info.mode === 'local-template') {
        statusEl.textContent = '本地模板';
        statusEl.style.background = '#95a5a6';
        modeLabelEl.textContent = info.enabled === false && info.missing?.length > 0 ? '真实 AI 未配置' : '本地模板模式';
        if (configStatusEl) {
            if (info.enabled === false && info.missing?.length > 0) {
                configStatusEl.innerHTML = `<span style="color:#f39c12;">● 当前使用本地模板</span><br><span style="font-size:11px;color:var(--text-muted);">缺少配置: ${escapeHtml(info.missing.join(', '))}</span>`;
            } else {
                configStatusEl.innerHTML = `<span style="color:#95a5a6;">● 当前使用本地模板</span>`;
            }
        }
    } else {
        statusEl.textContent = '本地模板';
        statusEl.style.background = '#95a5a6';
        modeLabelEl.textContent = '未接入真实 AI';
        if (configStatusEl) configStatusEl.innerHTML = `<span style="color:#95a5a6;">● 当前使用本地模板</span>`;
    }
}

// ========== 数据感知函数 ==========
function getAIWorkspaceSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const activeStudents = (data.students || []).filter(s => s.status === 'active');
    const pendingRenewal = (data.students || []).filter(s => s.status === 'renewalPending');
    const prospects = data.prospects || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const communications = data.communications || [];

    const unpaidFees = fees.filter(f => f.status === 'pending');
    let monthConsumedHours = 0;
    attendance.forEach(session => {
        const sessionDate = session.date || '';
        if (sessionDate >= `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`) {
            Object.values(session.records || {}).forEach(v => { if (v === 1) monthConsumedHours++; });
        }
    });
    const recentComms = communications.filter(c => c.contactDate && c.contactDate >= weekAgo);

    return {
        activeStudentCount: activeStudents.length || 0,
        pendingRenewalCount: pendingRenewal.length || 0,
        prospectCount: prospects.length || 0,
        unpaidCount: unpaidFees.length || 0,
        unpaidAmount: unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0) || 0,
        monthConsumedHours: monthConsumedHours || 0,
        recentCommCount: recentComms.length || 0,
    };
}

// ========== 工作中心定义 ==========
const WORK_CENTERS = {
    'content': {
        name: '内容生产', icon: '📝', color: '#9b59b6',
        tasks: [
            { task: 'article-draft', label: '公众号文章', placeholder: '输入主题、目标家长、想表达的观点', agent: 'biz-agent', hasRealAI: true, hasAdvanced: true },
            { task: 'xiaohongshu-note', label: '小红书笔记', placeholder: '输入话题、内容方向、目标人群', agent: 'biz-agent', hasRealAI: true, hasAdvanced: true },
            { task: 'video-script', label: '视频号脚本', placeholder: '输入视频主题、时长、目标观众', agent: 'biz-agent', hasRealAI: true, hasAdvanced: true },
            { task: 'moment-content', label: '朋友圈文案', placeholder: '输入今日主题或课程亮点', agent: 'recruit-agent', hasRealAI: true },
        ]
    },
    'question-bank': {
        name: '数学题库', icon: '📚', color: '#3498db',
        tasks: [
            { task: 'question-bank-plan', label: '题库建设方案', placeholder: '输入年级、章节、想建立的题库结构', agent: 'teaching-agent', hasRealAI: true, hasAdvanced: true },
            { task: 'question-classify', label: '题目分类规则', placeholder: '输入想分类的题目或题型', agent: 'teaching-agent', hasRealAI: true },
            { task: 'exercise-recommend', label: '推荐练习题', placeholder: '输入学员年级、薄弱点', agent: 'teaching-agent', hasRealAI: true },
            { task: 'exam-analysis', label: '试卷分析', placeholder: '输入试卷名称和学员得分', agent: 'teaching-agent', hasRealAI: true },
        ]
    },
    'resource': {
        name: '资料库/升学', icon: '🔍', color: '#e67e22',
        tasks: [
            { task: 'resource-brief', label: '资料简报', placeholder: '输入资料方向，例如：中高考数学变化、家长常见升学问题', agent: 'biz-agent', hasRealAI: true, hasAdvanced: true },
            { task: 'research-plan', label: '资料收集计划', placeholder: '输入想收集的资料主题', agent: 'biz-agent', hasRealAI: true, hasAdvanced: true },
        ]
    },
    'operations': {
        name: '教务经营', icon: '📊', color: '#27ae60',
        tasks: [
            { task: 'weekly-report', label: '本周经营周报', placeholder: '输入本周日期范围', agent: 'biz-agent', hasRealAI: true },
            { task: 'monthly-report', label: '本月经营报告', placeholder: '输入月份', agent: 'biz-agent', hasRealAI: true },
            { task: 'class-consumption', label: '班级课消分析', placeholder: '输入班级名称', agent: 'biz-agent', hasRealAI: true },
            { task: 'tuition-warning', label: '欠费/续费预警', placeholder: '自动汇总欠费和续费预警', agent: 'biz-agent', hasRealAI: true },
            { task: 'attendance-anomaly', label: '考勤异常', placeholder: '描述考勤异常情况', agent: 'admin-agent' },
            { task: 'class-full-check', label: '班级满班预警', placeholder: '输入班级名称', agent: 'admin-agent' },
        ]
    }
};

const MORE_TASKS = [
    { task: 'student-feedback', label: '学情反馈', placeholder: '选择学员后，描述本次需要重点反馈的内容', agent: 'learning-agent' },
    { task: 'renewal-script', label: '续费话术', placeholder: '描述学员情况和续费背景', agent: 'learning-agent' },
    { task: 'follow-reminder', label: '意向跟进话术', placeholder: '输入时间范围', agent: 'recruit-agent' },
    { task: 'trial-report', label: '试听报告', placeholder: '输入试课学员信息和试课表现', agent: 'recruit-agent' },
    { task: 'conversion-script', label: '转化话术', placeholder: '描述家长顾虑和课程特点', agent: 'recruit-agent' },
    { task: 'schedule-conflict', label: '调课冲突检测', placeholder: '描述需要检测的班级和时间范围', agent: 'admin-agent' },
    { task: 'renewal-reminder', label: '续费到期提醒', placeholder: '输入检查范围', agent: 'admin-agent' },
    { task: 'lesson-plan', label: '生成教案', placeholder: '输入课程主题、年级、课时数', agent: 'teaching-agent' },
    { task: 'learning-path', label: '学习路径规划', placeholder: '输入学员当前年级、学习目标', agent: 'teaching-agent' },
];

// 风格选项
const STYLE_OPTIONS = [
    { value: 'bai-teacher', label: '白老师风格（默认）' },
    { value: 'wechat-article', label: '公众号长文' },
    { value: 'xiaohongshu', label: '小红书笔记' },
    { value: 'video-script', label: '视频号口播' },
    { value: 'parent-comm', label: '家长沟通' },
    { value: 'teaching-note', label: '教研说明' },
];

const DRAFT_TYPE_OPTIONS = [
    { value: 'article-draft', label: '公众号' },
    { value: 'xiaohongshu-note', label: '小红书' },
    { value: 'video-script', label: '视频号' },
    { value: 'question-bank-plan', label: '题库' },
    { value: 'question-classify', label: '题库' },
    { value: 'resource-brief', label: '资料' },
    { value: 'research-plan', label: '资料' },
    { value: 'weekly-report', label: '经营' },
    { value: 'monthly-report', label: '经营' },
    { value: 'class-consumption', label: '经营' },
    { value: 'tuition-warning', label: '经营' },
];

// 内容生产工作流模式
const CONTENT_MODES = {
    'brainstorm': { label: '💡 选题', hint: '请给10个选题，每个附适合平台和切入点。' },
    'outline': { label: '📋 大纲', hint: '请给文章结构和每段要点。' },
    'full-draft': { label: '✏️ 初稿', hint: '请直接生成可修改的正文。' },
    'polish': { label: '🔄 润色', hint: '请保留原意，改成更像白老师风格。' },
    'title': { label: '📌 标题优化', hint: '请给10个标题，区分稳重/吸引/专业。' },
};

// ========== 渲染 AI 工作台 Stage 6C ==========
function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    const summary = getAIWorkspaceSummary();

    container.innerHTML = `
        <div class="ai-workspace-layout">
            <!-- 左侧工作中心列表 -->
            <div class="card ai-agent-sidebar">
                <div class="ai-agent-sidebar-header">AI 工作台</div>
                <div id="workCenterList">
                    ${renderWorkCenterItem('content', '📝', '内容生产', '#9b59b6', true)}
                    ${renderWorkCenterItem('question-bank', '📚', '数学题库', '#3498db', false)}
                    ${renderWorkCenterItem('resource', '🔍', '资料库/升学', '#e67e22', false)}
                    ${renderWorkCenterItem('operations', '📊', '教务经营', '#27ae60', false)}
                </div>
            </div>

            <!-- 主工作区 -->
            <div class="ai-workspace-main">
                <!-- 顶部：工作中心标题 + AI状态 + 数据参考折叠 -->
                <div class="ai-workspace-topbar">
                    <div class="ai-workspace-topbar-left">
                        <h3 id="workCenterTitle" class="ai-agent-name">📝 内容生产</h3>
                        <span id="currentTaskHint" class="ai-current-task-hint" style="display:none;"></span>
                    </div>
                    <div class="ai-workspace-topbar-right">
                        <span id="agentStatus" class="badge" style="background:#95a5a6;color:white;">加载中</span>
                        <span id="aiModeLabel" style="font-size:11px;color:var(--text-muted);">-</span>
                        <button class="btn btn-secondary btn-xs" onclick="toggleSnapshot()" style="margin-left:8px;">📊 数据参考</button>
                    </div>
                </div>

                <!-- 数据参考折叠区 -->
                <div id="snapshotArea" class="ai-snapshot-area" style="display:none;">
                    <div class="ai-snapshot-grid">
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#3498db;">${getPrivacyVal(summary.activeStudentCount)}</div>
                            <div class="ai-snapshot-label">在读学员</div>
                        </div>
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#f39c12;">${getPrivacyVal(summary.pendingRenewalCount)}</div>
                            <div class="ai-snapshot-label">待续费</div>
                        </div>
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#9b59b6;">${getPrivacyVal(summary.prospectCount)}</div>
                            <div class="ai-snapshot-label">意向学员</div>
                        </div>
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#e74c3c;">${getPrivacyVal(summary.unpaidCount)}</div>
                            <div class="ai-snapshot-label">欠费记录</div>
                        </div>
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#e74c3c;">${getPrivacyAmount(summary.unpaidAmount)}</div>
                            <div class="ai-snapshot-label">欠费金额</div>
                        </div>
                        <div class="ai-snapshot-item">
                            <div class="ai-snapshot-num" style="color:#27ae60;">${getPrivacyVal(summary.monthConsumedHours)}</div>
                            <div class="ai-snapshot-label">本月课消</div>
                        </div>
                    </div>
                </div>

                <!-- AI 配置状态 -->
                <div id="aiConfigStatus" class="ai-config-status"><span style="color:#95a5a6;">● 加载中...</span></div>
                <div id="relatedObjectHint" class="ai-related-hint" style="display:none;"></div>
                <div class="ai-teacher-note" style="margin-top:-4px;">
                    AI 工作台是主要使用入口：先选场景，再像聊天一样提出要求；知识库是后台资料仓库，用来给 AI 提供风格、素材、升学资料和题库摘要。
                </div>

                <!-- 任务卡片区 -->
                <div id="taskCardArea"></div>
                <div id="moreTasksArea" style="display:none;margin-top:12px;"></div>
                <button id="toggleMoreBtn" class="btn btn-secondary btn-sm" onclick="toggleMoreTasks()" style="margin-top:8px;">展开更多 ↓</button>

                <!-- 输入区 -->
                <div id="agentTaskArea">
                    <!-- 风格 + 工作流 -->
                    <div class="ai-form-row">
                        <div class="ai-form-group" style="flex:1;">
                            <label class="ai-form-label">生成风格</label>
                            <select id="styleSelect" onchange="onStyleChange()" class="ai-form-select">
                                ${STYLE_OPTIONS.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="ai-form-group" id="contentModeGroup" style="flex:1;display:none;">
                            <label class="ai-form-label">工作流模式</label>
                            <select id="contentModeSelect" onchange="onContentModeChange()" class="ai-form-select">
                                <option value="">普通模式</option>
                                ${Object.entries(CONTENT_MODES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="contentWorkflowHint" class="ai-workflow-hint" style="display:none;">
                        <span>选题</span><span>大纲</span><span>初稿</span><span>润色</span><span>标题优化</span>
                    </div>

                    <!-- 对话区 -->
                    <div class="ai-chat-panel">
                        <div class="ai-chat-header">
                            <span>对话记录</span>
                            <button class="btn btn-secondary btn-xs" onclick="startNewAIConversation()">新对话</button>
                        </div>
                        <div id="aiConversationArea" class="ai-conversation-area">
                            <div class="ai-chat-empty">选择场景后直接提需求；生成后可以继续说“再短一点”“更像微信聊天”“加一句提醒下次测验”。</div>
                        </div>
                    </div>

                    <!-- 任务描述 -->
                    <div class="ai-form-group">
                        <label class="ai-form-label">对 AI 说
                            <button class="btn btn-secondary btn-xs" onclick="toggleAdvancedOptions()" style="margin-left:8px;">高级选项</button>
                            <button class="btn btn-secondary btn-xs" onclick="fillExampleInput()" style="margin-left:4px;">填入示例</button>
                        </label>
                        <textarea id="agentInput" rows="4" placeholder="选择场景后在这里输入需求，也可以对上一条结果继续追问..." class="ai-form-textarea" style="resize:vertical;"></textarea>
                    </div>

                    <!-- 高级选项 -->
                    <div id="advancedOptionsArea" style="display:none;background:var(--hover-bg);border-radius:8px;padding:12px;margin-bottom:12px;">
                        <div id="advancedOptionsContent"></div>
                    </div>

                    <!-- 隐私模式 -->
                    <div class="ai-privacy-row">
                        <div class="ai-privacy-label">隐私模式：</div>
                        <label class="ai-privacy-option">
                            <input type="radio" name="aiPrivacyMode" value="masked" checked onchange="onPrivacyModeChange()">
                            <span>脱敏生成</span>
                        </label>
                        <label class="ai-privacy-option">
                            <input type="radio" name="aiPrivacyMode" value="named" onchange="onPrivacyModeChange()">
                            <span>带姓名生成</span>
                        </label>
                    </div>

                    <!-- 数据范围 -->
                    <div id="dataRangeInfo" class="ai-data-range" style="display:none;">
                        <span class="ai-data-range-title">本次读取数据范围</span>
                        <div id="dataRangeContent"></div>
                    </div>

                    <!-- 无任务警告 -->
                    <div id="noTaskWarning" class="ai-no-task-warning" style="display:none;">
                        ⚠️ 请先在左侧选择一个任务类型
                    </div>

                    <!-- 生成按钮 -->
                    <div class="ai-btn-group" style="flex-wrap:wrap;">
                        <button class="btn btn-primary" id="generateBtn" onclick="runAgentTask()">发送给 AI</button>
                        <button class="btn btn-secondary" onclick="previewContextRefs()">🔍 预览引用</button>
                        <button class="btn btn-secondary" onclick="clearAgentInput()">清空输入</button>
                        <button class="btn btn-secondary" onclick="clearAgentOutput()">清空</button>
                    </div>
                    <div class="ai-teacher-note">生成内容只是草稿，需要老师确认后使用；系统不会自动发送给家长，也不会自动修改学员、收费、考勤等业务数据。</div>

                    <!-- 输出区 -->
                    <div class="ai-output-area">
                        <div id="aiWarnings" class="ai-warnings" style="display:none;"></div>
                        <div class="ai-output-header">
                            <span class="ai-output-label">当前回复</span>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <span id="outputPrivacyTag" style="font-size:11px;color:var(--text-muted);"></span>
                                <button class="btn btn-secondary btn-xs" onclick="copyAgentOutput()">复制全文</button>
                            </div>
                        </div>
                        <div id="agentOutput" class="ai-output-content">
选择场景后输入需求，点击「发送给 AI」查看输出。后续可以继续追问修改。
                        </div>

                        <div id="outputActions" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button class="btn btn-secondary btn-sm" onclick="copyAgentOutput()">📋 复制全文</button>
                                <button class="btn btn-secondary btn-sm" onclick="copyAgentPlainText()">📝 复制纯文本</button>
                                <button class="btn btn-secondary btn-sm" onclick="saveToDrafts()">💾 保存草稿</button>
                                <button class="btn btn-secondary btn-sm" onclick="addToTodo()">✅ 加入待办</button>
                                <button class="btn btn-secondary btn-sm" onclick="regenerateResult()">🔄 重新生成</button>
                                <button class="btn btn-secondary btn-sm" onclick="clearAgentOutput()">🗑 清空</button>
                            </div>
                        </div>

                        <div id="taskRecordInfo" class="ai-task-record" style="display:none;"></div>

                        <!-- 本次引用资料 -->
                        <div id="contextRefsArea" class="ai-context-refs-area" style="display:none;margin-top:12px;padding:12px;background:var(--hover-bg);border-radius:8px;">
                            <div style="font-size:12px;font-weight:600;margin-bottom:8px;">📚 本次引用资料</div>
                            <div id="contextRefsContent"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧记录区 -->
            <div class="ai-workspace-right">
                <div class="card ai-right-panel">
                    <div class="ai-right-tabs">
                        <button class="ai-right-tab active" data-tab="drafts" onclick="switchRightTab('drafts')">📁 草稿箱</button>
                        <button class="ai-right-tab" data-tab="tasks" onclick="switchRightTab('tasks')">📋 最近</button>
                        <button class="ai-right-tab" data-tab="logs" onclick="switchRightTab('logs')">📝 日志</button>
                    </div>

                    <!-- 草稿箱 Tab -->
                    <div id="rightTabDrafts" class="ai-right-tab-content">
                        <div style="padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                            <input type="text" id="draftSearchInput" placeholder="搜索草稿..." oninput="filterDrafts()" style="flex:1;min-width:100px;padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <select id="draftCenterFilter" onchange="filterDrafts()" style="padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;">
                                <option value="">全部</option>
                                <option value="article-draft">公众号</option>
                                <option value="xiaohongshu-note">小红书</option>
                                <option value="video-script">视频号</option>
                                <option value="question-bank">题库</option>
                                <option value="resource">资料</option>
                                <option value="operations">经营</option>
                            </select>
                        </div>
                        <div style="display:flex;gap:8px;margin-bottom:8px;">
                            <button class="btn btn-secondary btn-xs" onclick="refreshDrafts()">刷新</button>
                            <button class="btn btn-secondary btn-xs" onclick="openStyleSettings()">🎨 风格</button>
                            <button class="btn btn-danger btn-xs" onclick="clearAllDrafts()">清空</button>
                        </div>
                        <div id="draftsArea" class="ai-log-content"><div class="ai-log-empty">暂无草稿</div></div>
                    </div>

                    <!-- 最近生成 Tab -->
                    <div id="rightTabTasks" class="ai-right-tab-content" style="display:none;">
                        <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
                            <button class="btn btn-secondary btn-xs" onclick="refreshAITasks()">刷新</button>
                        </div>
                        <div id="aiTasksArea" class="ai-log-content"><div class="ai-log-empty">暂无生成记录</div></div>
                    </div>

                    <!-- 日志 Tab -->
                    <div id="rightTabLogs" class="ai-right-tab-content" style="display:none;">
                        <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
                            <button class="btn btn-secondary btn-xs" onclick="refreshAgentLogs()">刷新</button>
                        </div>
                        <div id="agentLogArea" class="ai-log-content"><div class="ai-log-empty">暂无 Agent 调用记录</div></div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .ai-workspace-layout {
                display: grid;
                grid-template-columns: 90px 1fr 280px;
                gap: 12px;
                height: calc(100vh - 160px);
                min-height: 500px;
            }
            .ai-agent-sidebar {
                padding: 0;
                overflow-y: auto;
            }
            .ai-agent-sidebar-header {
                padding: 12px 8px;
                font-weight: 600;
                font-size: 12px;
                text-align: center;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-secondary);
            }
            .work-center-item {
                padding: 10px 6px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.2s;
                text-align: center;
            }
            .work-center-item:hover {
                background: var(--hover-bg);
            }
            .ai-workspace-main {
                display: flex;
                flex-direction: column;
                gap: 10px;
                overflow-y: auto;
                padding-right: 4px;
            }
            .ai-workspace-topbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            }
            .ai-workspace-topbar-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .ai-workspace-topbar-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .ai-current-task-hint {
                font-size: 12px;
                color: var(--text-muted);
                background: var(--hover-bg);
                padding: 2px 8px;
                border-radius: 4px;
            }
            .ai-snapshot-area {
                background: var(--hover-bg);
                border-radius: 8px;
                padding: 10px 12px;
            }
            .ai-snapshot-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            .ai-snapshot-item {
                text-align: center;
                padding: 6px 4px;
                background: var(--card-bg);
                border-radius: 6px;
            }
            .ai-snapshot-num {
                font-size: 18px;
                font-weight: 600;
            }
            .ai-snapshot-label {
                font-size: 10px;
                color: var(--text-muted);
            }
            .ai-form-row {
                display: flex;
                gap: 12px;
            }
            .ai-form-row .ai-form-group {
                margin-bottom: 8px;
            }
            .ai-no-task-warning {
                background: #fff3cd;
                color: #856404;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                margin-bottom: 8px;
            }
            .ai-workspace-right {
                overflow-y: auto;
            }
            .ai-right-panel {
                padding: 0;
            }
            .ai-right-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
            }
            .ai-right-tab {
                flex: 1;
                padding: 8px 4px;
                font-size: 11px;
                cursor: pointer;
                background: none;
                border: none;
                border-bottom: 2px solid transparent;
                color: var(--text-muted);
            }
            .ai-right-tab.active {
                color: var(--text-primary);
                border-bottom-color: #3498db;
                font-weight: 600;
            }
            .ai-right-tab-content {
                padding: 8px;
                max-height: calc(100vh - 300px);
                overflow-y: auto;
            }
            .ai-task-card-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 8px;
                margin-bottom: 10px;
            }
            .ai-task-card {
                padding: 10px 10px;
                background: var(--hover-bg);
                border-radius: 8px;
                cursor: pointer;
                border: 1px solid var(--border-color);
                transition: all 0.2s;
            }
            .ai-task-card:hover {
                border-color: var(--text-secondary);
            }
            .ai-task-card.selected {
                background: #e8f4fd;
                border: 1px solid #3498db;
                box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.12);
            }
            .ai-task-card.selected .ai-task-card-label {
                color: #3498db;
            }
            .ai-task-card-label {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 3px;
            }
            .ai-task-card-desc {
                font-size: 10px;
                color: var(--text-muted);
                line-height: 1.3;
            }
            .ai-log-content {
                max-height: 400px;
                overflow-y: auto;
            }
            .ai-log-empty {
                text-align: center;
                padding: 20px 0;
                color: var(--text-muted);
                font-size: 12px;
            }
            .ai-log-item {
                padding: 6px 0;
                border-bottom: 1px solid var(--border-color);
                font-size: 11px;
            }
            .ai-run-status {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--border-color);
            }
            .ai-run-pill {
                display: inline-flex;
                align-items: center;
                min-height: 22px;
                padding: 2px 8px;
                border: 1px solid var(--border-color);
                border-radius: 999px;
                color: var(--text-secondary);
                font-size: 11px;
                line-height: 1.3;
                background: var(--bg-card);
            }
            .ai-teacher-note {
                margin: 8px 0 0;
                padding: 8px 10px;
                background: var(--hover-bg);
                border-radius: 6px;
                color: var(--text-muted);
                font-size: 11px;
                line-height: 1.5;
            }
            .ai-workflow-hint {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                margin: -2px 0 10px;
            }
            .ai-workflow-hint span {
                padding: 3px 8px;
                border-radius: 999px;
                background: var(--hover-bg);
                color: var(--text-secondary);
                font-size: 11px;
            }
            .ai-context-ref-item {
                font-size: 12px;
                padding: 6px 8px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                margin-bottom: 4px;
            }
            .ai-context-ref-title {
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 2px;
            }
            .ai-context-ref-summary {
                font-size: 11px;
                color: var(--text-muted);
                line-height: 1.4;
            }
            .ai-context-more summary {
                cursor: pointer;
                color: var(--text-secondary);
                font-size: 11px;
                padding: 4px 0;
            }
            @media (max-width: 900px) {
                .ai-workspace-layout { grid-template-columns: 70px 1fr; }
                .ai-workspace-right { display: none; }
            }
            @media (max-width: 700px) {
                .ai-workspace-layout { grid-template-columns: 1fr; height: auto; }
                .ai-agent-sidebar { flex-direction: row !important; overflow-x: auto; }
                .ai-agent-sidebar .ai-agent-sidebar-header { writing-mode: horizontal-tb; border-bottom: none; border-right: 1px solid var(--border-color); min-width: 60px; text-align: center; }
                .work-center-item { min-width: 70px; border-left: none !important; border-bottom: 3px solid transparent !important; }
                .work-center-item.active-mobile { border-bottom-color: #3498db !important; }
                .ai-task-card-grid { grid-template-columns: 1fr 1fr !important; }
                .ai-snapshot-grid { grid-template-columns: repeat(2, 1fr); }
                .ai-form-row { flex-direction: column; gap: 0; }
                .ai-workspace-right { display: block; }
                .ai-right-panel { margin-top: 12px; }
                .ai-right-tabs { flex-wrap: wrap; }
                .ai-right-tab { font-size: 12px; padding: 8px; }
                .ai-workspace-right {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    background: var(--card-bg);
                    border-top: 1px solid var(--border-color);
                    max-height: 200px;
                }
                .ai-right-panel { border-radius: 12px 12px 0 0; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); }
            }
            @media (max-width: 390px) {
                .ai-task-card-grid { grid-template-columns: 1fr !important; }
                .ai-context-refs-area { overflow-x: auto; }
            }
        </style>
    `;

    loadAIStatus();
    loadAgentLogsFromServer();
    loadAITasksFromServer();
    loadDraftsFromStorage();
    selectWorkCenter('content');

    if (window.innerWidth <= 700) {
        const list = document.getElementById('workCenterList');
        if (list) { list.style.display = 'flex'; list.style.overflowX = 'auto'; list.style.gap = '8px'; list.style.padding = '8px'; }
    }
}

function toggleSnapshot() {
    const area = document.getElementById('snapshotArea');
    if (!area) return;
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function switchRightTab(tab) {
    document.querySelectorAll('.ai-right-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.ai-right-tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.ai-right-tab-content').forEach(c => c.style.display = 'none');
    const content = document.getElementById(`rightTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (content) content.style.display = 'block';
}

function renderWorkCenterItem(id, icon, name, color, isActive) {
    const activeStyle = isActive ? `background:var(--hover-bg);border-left:3px solid ${color};` : 'border-left:3px solid transparent;';
    return `<div class="work-center-item" onclick="selectWorkCenter('${id}')" data-center="${id}" style="${activeStyle}">
        <div style="font-size:18px;margin-bottom:4px;">${icon}</div>
        <div style="font-size:12px;font-weight:600;">${escapeHtml(name)}</div>
    </div>`;
}

function selectWorkCenter(centerId) {
    currentCenterId = centerId;
    const center = WORK_CENTERS[centerId];
    if (!center) return;
    currentTaskType = '';
    currentTaskLabel = '';

    // 更新标题
    document.getElementById('workCenterTitle').textContent = `${center.icon} ${center.name}`;
    document.getElementById('currentTaskHint').style.display = 'none';

    // 更新左侧选中态
    document.querySelectorAll('.work-center-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.borderLeft = '3px solid transparent';
        el.classList.remove('active-mobile');
    });
    const selected = document.querySelector(`.work-center-item[data-center="${centerId}"]`);
    if (selected) {
        selected.style.background = 'var(--hover-bg)';
        selected.style.borderLeft = `3px solid ${center.color}`;
        selected.classList.add('active-mobile');
    }

    // 渲染任务卡片
    renderTaskCards(centerId, center.tasks);

    // 内容中心显示工作流模式
    const contentModeGroup = document.getElementById('contentModeGroup');
    const workflowHint = document.getElementById('contentWorkflowHint');
    if (centerId === 'content') {
        contentModeGroup.style.display = 'block';
        if (workflowHint) workflowHint.style.display = 'flex';
        document.getElementById('contentModeSelect').value = '';
    } else {
        contentModeGroup.style.display = 'none';
        if (workflowHint) workflowHint.style.display = 'none';
    }

    // 清空输出
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择场景后输入需求，点击「发送给 AI」查看输出。后续可以继续追问修改。';
    document.getElementById('outputActions').style.display = 'none';
    document.getElementById('advancedOptionsArea').style.display = 'none';
    document.getElementById('noTaskWarning').style.display = 'none';
    startNewAIConversation({ silent: true });
    updatePrivacyModeUI();

    // 默认选中第一个任务
    const defaultTask = center.tasks?.[0];
    if (defaultTask) {
        selectTask(defaultTask.task, defaultTask.agent, defaultTask.label, { focusInput: false, clearInput: true });
    }
}

function renderTaskCards(centerId, tasks) {
    const area = document.getElementById('taskCardArea');
    if (!area) return;
    area.innerHTML = `<div class="ai-task-card-grid">` +
        tasks.map(t => {
            const badge = t.hasRealAI ? '<span style="background:#27ae60;color:white;padding:1px 4px;border-radius:3px;font-size:9px;margin-left:4px;">AI</span>' : '';
            return `<div class="ai-task-card" onclick="selectTask('${t.task}','${t.agent}','${escapeHtml(t.label)}')" data-task="${t.task}" data-label="${escapeHtml(t.label)}">
                <div class="ai-task-card-label">${escapeHtml(t.label)}${badge}</div>
                <div class="ai-task-card-desc">${escapeHtml(t.placeholder.substring(0,20))}...</div>
            </div>`;
        }).join('') + `</div>`;
}

function renderAIConversation() {
    const area = document.getElementById('aiConversationArea');
    if (!area) return;
    if (!aiConversationMessages.length) {
        area.innerHTML = '<div class="ai-chat-empty">选择场景后直接提需求；生成后可以继续说“再短一点”“更像微信聊天”“加一句提醒下次测验”。</div>';
        return;
    }
    area.innerHTML = aiConversationMessages.slice(-8).map(message => `
        <div class="ai-chat-message ${message.role === 'user' ? 'user' : 'assistant'}">
            <div class="ai-chat-role">${message.role === 'user' ? '我' : 'AI'}</div>
            <div class="ai-chat-bubble">${renderMarkdown(message.content || '')}</div>
        </div>
    `).join('');
    area.scrollTop = area.scrollHeight;
}

function addAIConversationMessage(role, content) {
    if (!content) return;
    aiConversationMessages.push({
        role,
        content,
        createdAt: new Date().toISOString(),
        task: currentTaskType,
        center: currentCenterId
    });
    aiConversationMessages = aiConversationMessages.slice(-12);
    renderAIConversation();
}

function getAIConversationContext() {
    if (!aiConversationMessages.length) return '';
    return '本次是连续对话，请参考最近对话上下文，但优先执行用户最新要求：\n' +
        aiConversationMessages.slice(-6).map(message => {
            const role = message.role === 'user' ? '用户' : 'AI';
            return `${role}：${message.content}`;
        }).join('\n\n');
}

function startNewAIConversation(options = {}) {
    aiConversationMessages = [];
    renderAIConversation();
    if (!options.silent) showToast('已开始新对话');
}

function toggleMoreTasks() {
    const moreArea = document.getElementById('moreTasksArea');
    const toggleBtn = document.getElementById('toggleMoreBtn');
    if (!moreArea) return;

    if (moreArea.style.display === 'none') {
        moreArea.style.display = 'block';
        toggleBtn.textContent = '收起更多 ↑';
        moreArea.innerHTML = `<div style="margin-bottom:8px;font-size:12px;color:var(--text-muted);">更多任务</div>` +
            `<div class="ai-task-card-grid">` +
            MORE_TASKS.map(t => `<div class="ai-task-card" onclick="selectTask('${t.task}','${t.agent}','${escapeHtml(t.label)}')" data-task="${t.task}" data-label="${escapeHtml(t.label)}">
                <div class="ai-task-card-label">${escapeHtml(t.label)}</div>
                <div class="ai-task-card-desc">更多功能</div>
            </div>`).join('') + `</div>`;
    } else {
        moreArea.style.display = 'none';
        toggleBtn.textContent = '展开更多 ↓';
    }
}

function selectTask(taskId, agentId, taskLabel, options = {}) {
    currentAgentId = agentId;
    currentTaskType = taskId;
    currentTaskLabel = taskLabel || '';

    // 更新任务卡片选中态
    document.querySelectorAll('.ai-task-card').forEach(el => {
        el.classList.remove('selected');
    });
    const selected = document.querySelector(`.ai-task-card[data-task="${taskId}"]`);
    if (selected) {
        selected.classList.add('selected');
    }

    // 显示当前任务提示
    const hintEl = document.getElementById('currentTaskHint');
    if (hintEl) {
        hintEl.textContent = `当前任务：${currentTaskLabel}`;
        hintEl.style.display = 'inline-block';
    }

    // 隐藏无任务警告
    document.getElementById('noTaskWarning').style.display = 'none';

    // 更新输入框 placeholder
    const input = document.getElementById('agentInput');
    const placeholder = getTaskPlaceholder(taskId);
    if (input) {
        input.placeholder = placeholder;
        if (options.clearInput) input.value = '';
        if (options.focusInput !== false) input.focus();
    }

    // 外部跳转时预填姓名
    if (currentRelatedType === 'student' && (taskId === 'student-feedback' || taskId === 'renewal-script')) {
        const student = data.students?.find(s => s.id === currentRelatedId);
        if (student && input) input.value = `${student.name}\n`;
    } else if (currentRelatedType === 'prospect' && taskId === 'follow-reminder') {
        const prospect = data.prospects?.find(p => p.id === currentRelatedId);
        if (prospect && input) input.value = `${prospect.name}\n`;
    }

    updateDataRangeInfo(taskId);
    updateAdvancedOptions();
}

function getTaskPlaceholder(taskId) {
    return {
        'article-draft': '输入主题、目标家长、想表达的观点，例如：为什么小升初数学不能只刷难题',
        'xiaohongshu-note': '输入话题、内容方向、目标人群，例如：六年级家长关注的学习方法',
        'video-script': '输入视频主题、时长、目标观众，例如：小升初家长必看的3个数学学习方法',
        'moment-content': '输入今日主题或课程亮点，生成朋友圈招生文案',
        'question-bank-plan': '输入年级、章节、想建立的题库结构，例如：六年级小升初，分数、比例、行程、几何',
        'question-classify': '输入想分类的题目或题型，例如：计算类、应用题、几何，证明题分类规则',
        'exercise-recommend': '输入学员年级、薄弱点，推荐练习题',
        'exam-analysis': '输入试卷名称和学员得分，分析薄弱点',
        'resource-brief': '输入资料方向，例如：2026中考数学变化、武汉小升初政策、家长常见升学问题',
        'research-plan': '输入想收集的资料主题，例如：初中数学竞赛入门资料、家长常见问题汇总',
        'weekly-report': '输入本周日期范围，自动汇总班级情况',
        'monthly-report': '输入月份，自动生成本月经营报告',
        'class-consumption': '输入班级名称，分析课消和剩余课时',
        'tuition-warning': '自动汇总欠费和续费预警学员列表',
        'attendance-anomaly': '描述考勤异常情况，例如：有哪些学员异常出勤或请假',
        'class-full-check': '输入班级名称，检查是否有班级接近或达到满班',
        'student-feedback': '选择学员后，描述本次需要重点反馈的内容',
        'renewal-script': '描述学员情况和续费背景，生成沟通话术',
        'follow-reminder': '输入时间范围，检查意向学员跟进情况',
        'trial-report': '输入试课学员信息和试课表现',
        'conversion-script': '描述家长顾虑和课程特点，生成针对性话术',
        'schedule-conflict': '描述需要检测的班级和时间范围',
        'renewal-reminder': '输入检查范围，检查未来两周内有哪些学员课时不足',
        'lesson-plan': '输入课程主题、年级、课时数，生成教案',
        'learning-path': '输入学员当前年级、学习目标，推荐学习路径',
    }[taskId] || '描述你的需求...';
}

function onContentModeChange() {
    const mode = document.getElementById('contentModeSelect')?.value;
    if (!mode) return;
    const modeInfo = CONTENT_MODES[mode];
    if (!modeInfo) return;
    const input = document.getElementById('agentInput');
    if (input && !input.value.trim()) {
        input.placeholder = modeInfo.hint;
    }
}

function toggleAdvancedOptions() {
    const area = document.getElementById('advancedOptionsArea');
    if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

function updateAdvancedOptions() {
    const area = document.getElementById('advancedOptionsContent');
    if (!area) return;
    const taskId = currentTaskType;

    if (taskId === 'article-draft' || taskId === 'xiaohongshu-note' || taskId === 'video-script') {
        area.innerHTML = `
            <div style="margin-bottom:8px;font-size:12px;color:var(--text-secondary);">高级选项（可选）</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input type="text" id="advTarget" placeholder="目标家长（选填）" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advCorePoint" placeholder="核心观点（选填）" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
            </div>
            ${taskId === 'video-script' ? `<div style="margin-top:8px;"><label style="font-size:11px;color:var(--text-muted);">时长：</label>
                <select id="advDuration" style="padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;margin-left:4px;">
                    <option value="">选择</option>
                    <option value="30s">30秒</option>
                    <option value="60s">60秒</option>
                    <option value="90s">90秒</option>
                </select>
                <label style="font-size:11px;color:var(--text-muted);margin-left:12px;"><input type="checkbox" id="advNeedScript"> 需要口播稿</label>
                <label style="font-size:11px;color:var(--text-muted);margin-left:12px;"><input type="checkbox" id="advNeedCue"> 需要镜头提示</label>
            </div>` : ''}
        `;
    } else if (taskId === 'question-bank-plan' || taskId === 'question-classify') {
        area.innerHTML = `
            <div style="margin-bottom:8px;font-size:12px;color:var(--text-secondary);">题库辅助（可选）</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">AI 辅助整理题库结构，当前为前端入口设计阶段，暂不接正式题库数据库。</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <input type="text" id="advGrade" placeholder="年级" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advChapter" placeholder="章节" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advKnowledge" placeholder="知识点" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
                <input type="text" id="advQuestionType" placeholder="题型" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advDifficulty" placeholder="难度" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advSource" placeholder="来源" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
            </div>
        `;
    } else if (taskId === 'resource-brief' || taskId === 'research-plan') {
        area.innerHTML = `
            <div style="margin-bottom:8px;font-size:12px;color:var(--text-secondary);">资料库/升学情报（可选）</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">资料来源：Obsidian 笔记、本地资料文件夹、后续 SQLite 资料库。暂不接文件上传。</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <input type="text" id="advResourceGrade" placeholder="适用年级" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                <input type="text" id="advResourceType" placeholder="资料类型（政策/真题/经验）" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
            </div>
        `;
    } else {
        area.innerHTML = '';
    }
}

function fillExampleInput() {
    const input = document.getElementById('agentInput');
    if (!input) return;
    const examples = {
        'article-draft': '主题：小升初数学规划\n目标家长：六年级学生家长\n核心观点：不要只刷难题，要注重基础和思维训练',
        'xiaohongshu-note': '话题：六年级数学学习规划\n目标人群：小升初家长\n语气：真实、专业',
        'video-script': '主题：如何培养数学思维\n时长：60秒\n需要口播稿：是',
        'moment-content': '主题：本周六年级小升初复习\n重点：计算习惯和应用题审题\n希望：低营销感，适合朋友圈',
        'question-bank-plan': '年级：六年级\n章节：小升初综合\n知识点：分数、比例、行程、几何\n目标：建立可按知识点、题型、难度筛选的题库',
        'question-classify': '题目：甲乙两车同时从两地相向而行，甲每小时60千米，乙每小时50千米，3小时后相遇。求两地距离。\n要求：标注知识点、题型、难度、易错点',
        'exercise-recommend': '学员：六年级\n薄弱点：分数应用题、行程问题\n要求：给训练顺序和题量建议',
        'exam-analysis': '试卷：六年级综合测试\n得分：82/100\n薄弱点：计算失分、应用题条件提取不稳定',
        'resource-brief': '资料方向：2026武汉小升初政策变化\n要求：整理家长最关心的问题和需要持续跟进的信息',
        'research-plan': '资料主题：初中数学竞赛入门\n要求：列出资料来源、筛选标准和每周整理流程',
        'weekly-report': '时间范围：本周\n重点：课消、欠费、待续费、意向学员跟进',
        'monthly-report': '月份：本月\n重点：收入、课消、班级进度、招生线索',
        'class-consumption': '班级：输入需要分析的班级名称\n重点：计划课次、已进行课次、课时不足风险',
        'tuition-warning': '检查范围：全部在读学员\n重点：欠费、课时不足、待续费优先级',
        'renewal-reminder': '检查范围：未来两周\n重点：课时即将不足、已经待续费、需要沟通的学员',
        'student-feedback': '重点：本周课堂表现、薄弱点、下次课安排\n语气：真实、温和，不夸张',
        'renewal-script': '背景：课程接近结束，需要和家长确认下一阶段安排\n要求：温和版和直接版各一份',
        'follow-reminder': '检查范围：近两周意向学员\n重点：谁需要跟进、下一句话怎么说',
        'trial-report': '试课表现：课堂能跟上，计算细节不稳定\n要求：给家长反馈草稿',
        'conversion-script': '家长顾虑：担心孩子时间不够\n课程优势：小班、能持续跟进薄弱点',
    };
    if (examples[currentTaskType]) {
        input.value = examples[currentTaskType];
        showToast('已填入示例');
    } else {
        showToast('当前任务无示例');
    }
}

function onStyleChange() {
    currentStyle = document.getElementById('styleSelect')?.value || 'bai-teacher';
}

function onPrivacyModeChange() {
    const selected = document.querySelector('input[name="aiPrivacyMode"]:checked');
    aiPrivacyMode = selected ? selected.value : 'masked';
}

function updatePrivacyModeUI() {
    const radioMasked = document.querySelector('input[name="aiPrivacyMode"][value="masked"]');
    const radioNamed = document.querySelector('input[name="aiPrivacyMode"][value="named"]');
    if (!radioMasked || !radioNamed) return;
    radioNamed.disabled = false;
    aiPrivacyMode === 'named' ? radioNamed.checked = true : radioMasked.checked = true;
}

function updateDataRangeInfo(taskType) {
    const rangeInfo = document.getElementById('dataRangeInfo');
    const rangeContent = document.getElementById('dataRangeContent');
    if (!rangeInfo || !rangeContent) return;
    if (!taskType) { rangeInfo.style.display = 'none'; return; }

    const range = TASK_DATA_RANGES[taskType] || '当前模块摘要、用户补充说明';
    rangeContent.innerHTML = `
        <div class="ai-data-range-item"><span class="ai-data-range-key">读取范围</span><span class="ai-data-range-val">${escapeHtml(range)}</span></div>
        <div class="ai-data-range-item"><span class="ai-data-range-key">隐私模式</span><span class="ai-data-range-val">${aiPrivacyMode === 'named' ? '带姓名生成' : '脱敏生成'}</span></div>
    `;
    rangeInfo.style.display = 'block';
}

const TASK_DATA_RANGES = {
    'student-feedback': '学员基础信息、最近成绩、最近考勤、课时余额、沟通摘要',
    'renewal-script': '学员基础信息、课时余额、班级进度、收费摘要',
    'weekly-report': '本周新增、课消摘要、收费摘要、欠费摘要、待续费摘要',
    'monthly-report': '月度课消、收费摘要、班级进度、意向学员摘要',
    'class-consumption': '班级课次、学员课时余额、出勤统计',
    'tuition-warning': '欠费记录、待续费学员、课时不足摘要',
    'follow-reminder': '意向学员状态、来源、年级、备注摘要',
    'trial-report': '意向学员信息、试课状态、备注摘要',
    'conversion-script': '意向学员信息、试课状态、成交状态、备注摘要',
    'moment-content': '招生摘要、课程方向、用户补充说明',
    'article-draft': '用户补充说明、课程方向',
    'xiaohongshu-note': '用户补充说明、课程方向',
    'video-script': '用户补充说明、课程方向',
    'question-bank-plan': '用户补充说明',
    'question-classify': '用户补充说明',
    'resource-brief': '用户补充说明',
    'research-plan': '用户补充说明',
    'schedule-conflict': '学员考勤、班级上课时间',
    'attendance-anomaly': '学员考勤、出勤状态',
    'class-full-check': '班级人数、容量',
    'renewal-reminder': '待续费学员、欠费记录',
    'lesson-plan': '课程主题、年级',
    'exercise-recommend': '学员年级、薄弱点',
    'learning-path': '学员年级、学习目标',
    'exam-analysis': '试卷名称、学员成绩',
};

function showPrivacyConfirm(callback) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = '确认带姓名生成';
    bodyEl.innerHTML = `
        <div style="padding:16px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
            <div style="font-size:14px;color:var(--text-primary);margin-bottom:8px;">本次将带入学员姓名用于生成文本。</div>
            <div style="font-size:13px;color:var(--text-secondary);">系统不会自动修改任何数据。<br>生成内容需要您确认后使用。</div>
            <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;">
                <button class="btn btn-secondary" id="privacyCancelBtn">取消</button>
                <button class="btn btn-primary" id="privacyConfirmBtn">继续</button>
            </div>
        </div>`;
    modal.classList.add('show');
    document.getElementById('privacyCancelBtn').onclick = closeModal;
    document.getElementById('privacyConfirmBtn').onclick = () => { closeModal(); if (typeof callback === 'function') callback(); };
}

// ========== 任务执行 ==========
function runAgentTask() {
    const input = document.getElementById('agentInput').value.trim();
    const output = document.getElementById('agentOutput');

    // 检查是否选择了任务
    if (!currentTaskType) {
        document.getElementById('noTaskWarning').style.display = 'block';
        showToast('请先选择任务类型');
        return;
    }

    document.getElementById('noTaskWarning').style.display = 'none';

    if (!input) {
        showToast('建议补充主题，效果会更好');
    }

    const conversationContext = getAIConversationContext();
    if (input) addAIConversationMessage('user', input);

    const taskNames = getTaskNames();
    const agentNames = { 'admin-agent': '教务 Agent', 'learning-agent': '学情沟通 Agent', 'recruit-agent': '招生跟进 Agent', 'teaching-agent': '教研 Agent', 'biz-agent': '经营分析 Agent' };

    const forceMaskedAgents = ['teaching-agent', 'biz-agent'];
    if (aiPrivacyMode === 'named' && !forceMaskedAgents.includes(currentAgentId)) {
        showPrivacyConfirm(() => doRunAgentTask(input, agentNames, taskNames, conversationContext));
        return;
    }
    doRunAgentTask(input, agentNames, taskNames, conversationContext);
}

function doRunAgentTask(input, agentNames, taskNames, conversationContext = '') {
    const output = document.getElementById('agentOutput');
    const btn = document.getElementById('generateBtn');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }
    window._aiGenerateTimeout = setTimeout(() => {
        const currentBtn = document.getElementById('generateBtn');
        if (currentBtn && currentBtn.disabled) {
            currentBtn.textContent = '生成较慢，请稍后...';
        }
        const currentOutput = document.getElementById('agentOutput');
        if (currentOutput && currentOutput.innerText.includes('生成中')) {
            currentOutput.innerHTML = `<div class="ai-output-placeholder">
<div style="font-size:24px;margin-bottom:8px;">⏳</div>
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">生成时间较长</div>
<div style="color:var(--text-muted);">真实 AI 仍在处理中，请稍等；如果稍后失败，系统会自动回退本地模板。</div>
</div>`;
        }
    }, 30000);

    const advancedText = collectAdvancedOptions();
    const styleNote = getStyleNote();
    const contentModeNote = getContentModeNote();
    const finalInput = [conversationContext, input, advancedText, contentModeNote, styleNote].filter(Boolean).join('\n\n');

    const payload = {
        agent: currentAgentId,
        task: currentTaskType,
        privacyMode: aiPrivacyMode,
        userInstruction: finalInput,
        relatedType: currentRelatedType,
        relatedId: currentRelatedId,
    };
    output.innerHTML = `<div class="ai-output-placeholder">
<div style="font-size:24px;margin-bottom:8px;">🤖</div>
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">生成中</div>
<div style="color:var(--text-muted);">正在读取业务数据和知识库上下文...</div>
</div>`;

    fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(async res => {
        const parsed = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parsed.error || parsed.message || 'API 请求失败');
        return parsed;
    })
    .then(response => {
        clearTimeout(window._aiGenerateTimeout);
        lastTaskId = response.taskId || '';
        lastTaskMode = response.mode || 'local-template';
        lastTaskProvider = response.provider || '';
        updateTaskRecordInfo();

        const warningsEl = document.getElementById('aiWarnings');
        if (warningsEl) {
            warningsEl.innerHTML = response.warnings?.map(w => `<div>⚠️ ${escapeHtml(w)}</div>`).join('') || '';
            warningsEl.style.display = response.warnings?.length > 0 ? 'block' : 'none';
        }

        output.innerHTML = `${renderAIRunStatus(response)}<div class="ai-output-text">${renderMarkdown(response.result || '')}</div>`;
        addAIConversationMessage('assistant', response.result || '');

        document.getElementById('outputActions').style.display = 'block';

        const isNamed = aiPrivacyMode === 'named';
        document.getElementById('outputPrivacyTag').innerHTML = isNamed
            ? '<span style="font-size:11px;color:#e74c3c;margin-right:6px;">⚠️ 带姓名</span>'
            : '<span style="font-size:11px;color:#888;margin-right:6px;">🔒 脱敏</span>';

        // 渲染引用资料
        renderContextRefs(response.contextRefs, response.mode);

        showToast(`${agentNames[currentAgentId]} · ${taskNames[currentTaskType] || currentTaskType} 已生成`);
        loadAgentLogsFromServer();
        loadAITasksFromServer();
    })
    .catch((err) => {
        clearTimeout(window._aiGenerateTimeout);
        output.innerHTML = `<div class="ai-output-placeholder">
<div style="font-size:24px;margin-bottom:8px;">🤖</div>
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">接口调用失败</div>
<div style="color:var(--text-muted);">${escapeHtml(err.message || '生成失败')}</div>
</div>`;
        showToast('生成失败');
    })
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = '发送给 AI'; } });
}

function renderAIRunStatus(response) {
    const refs = response.contextRefs || [];
    const hasContextRefs = refs.length > 0;
    const modeLabel = response.mode === 'real-ai' ? '真实 AI' : '本地模板';
    const modeColor = response.mode === 'real-ai' ? '#27ae60' : '#7f8c8d';
    const fallbackText = response.fallbackFrom ? '已回退' : '';
    const refText = hasContextRefs ? `已引用知识库 ${refs.length} 条` : '未引用知识库';
    const refColor = hasContextRefs ? '#27ae60' : '#f39c12';
    const elapsedText = response.elapsedMs ? `${Math.max(1, Math.round(response.elapsedMs / 1000))} 秒` : '-';

    return `<div class="ai-run-status">
        <span class="ai-run-pill" style="border-color:${modeColor};color:${modeColor};">${escapeHtml(modeLabel)}</span>
        ${fallbackText ? `<span class="ai-run-pill" style="border-color:#f39c12;color:#f39c12;">${fallbackText}</span>` : ''}
        <span class="ai-run-pill" style="border-color:${refColor};color:${refColor};">${escapeHtml(refText)}</span>
        <span class="ai-run-pill">用时 ${escapeHtml(elapsedText)}</span>
        <span class="ai-run-pill">需老师确认后使用</span>
    </div>`;
}

function collectAdvancedOptions() {
    const parts = [];
    const advTarget = document.getElementById('advTarget')?.value.trim();
    const advCorePoint = document.getElementById('advCorePoint')?.value.trim();
    const advDuration = document.getElementById('advDuration')?.value;
    const advNeedScript = document.getElementById('advNeedScript')?.checked;
    const advNeedCue = document.getElementById('advNeedCue')?.checked;
    const advGrade = document.getElementById('advGrade')?.value.trim();
    const advChapter = document.getElementById('advChapter')?.value.trim();
    const advKnowledge = document.getElementById('advKnowledge')?.value.trim();
    const advQuestionType = document.getElementById('advQuestionType')?.value.trim();
    const advDifficulty = document.getElementById('advDifficulty')?.value.trim();
    const advSource = document.getElementById('advSource')?.value.trim();
    const advResourceGrade = document.getElementById('advResourceGrade')?.value.trim();
    const advResourceType = document.getElementById('advResourceType')?.value.trim();

    if (advTarget) parts.push(`目标家长：${advTarget}`);
    if (advCorePoint) parts.push(`核心观点：${advCorePoint}`);
    if (advDuration) parts.push(`视频时长：${advDuration}`);
    if (advNeedScript) parts.push('需要口播稿：是');
    if (advNeedCue) parts.push('需要镜头提示：是');
    if (advGrade) parts.push(`年级：${advGrade}`);
    if (advChapter) parts.push(`章节：${advChapter}`);
    if (advKnowledge) parts.push(`知识点：${advKnowledge}`);
    if (advQuestionType) parts.push(`题型：${advQuestionType}`);
    if (advDifficulty) parts.push(`难度：${advDifficulty}`);
    if (advSource) parts.push(`来源：${advSource}`);
    if (advResourceGrade) parts.push(`适用年级：${advResourceGrade}`);
    if (advResourceType) parts.push(`资料类型：${advResourceType}`);

    return parts.join('\n');
}

function getContentModeNote() {
    const mode = document.getElementById('contentModeSelect')?.value;
    if (!mode) return '';
    return CONTENT_MODES[mode]?.hint || '';
}

function getStyleNote() {
    const style = currentStyle || 'bai-teacher';
    if (style === 'bai-teacher') {
        return '请用白老师风格：真实、清楚、克制、偏实用，不夸张营销。句子尽量短，不堆形容词。少用口号，多给具体判断和可执行建议。不要使用"突飞猛进、保证提升、逆袭、稳赢、名校必备"等过度承诺表达。';
    }
    const notes = {
        'wechat-article': '请使用公众号长文风格：正式、完整、有深度，适合家长阅读',
        'xiaohongshu': '请使用小红书笔记风格：轻松、有趣、带emoji，适合社交平台',
        'video-script': '请使用视频号口播风格：口语化、有节奏、适合朗读',
        'parent-comm': '请使用家长沟通风格：温和、专业、接地气',
        'teaching-note': '请使用教研说明风格：严谨、清晰、有逻辑',
    };
    return notes[style] || '';
}

function getTaskNames() {
    return {
        'student-feedback': '生成学情反馈', 'renewal-script': '生成续费沟通话术',
        'weekly-report': '生成本周经营周报', 'monthly-report': '生成本月经营报告',
        'class-consumption': '班级课消分析', 'tuition-warning': '欠费与续费预警汇总',
        'follow-reminder': '招生跟进提醒', 'trial-report': '试听反馈',
        'conversion-script': '试听后转化话术', 'moment-content': '招生内容草稿',
        'article-draft': '公众号长文草稿', 'xiaohongshu-note': '小红书笔记草稿',
        'video-script': '视频号脚本', 'question-bank-plan': '数学题库建设方案',
        'question-classify': '题目分类规则', 'resource-brief': '升学/中高考资料简报',
        'research-plan': '资料收集计划', 'schedule-conflict': '排课冲突检查',
        'attendance-anomaly': '考勤异常检查', 'class-full-check': '班级满班预警',
        'renewal-reminder': '续费到期提醒', 'lesson-plan': '教案框架',
        'exercise-recommend': '练习建议', 'learning-path': '学习路径',
        'exam-analysis': '试卷分析',
    };
}

function updateTaskRecordInfo() {
    const el = document.getElementById('taskRecordInfo');
    if (!el || (!lastTaskId && !lastTaskMode)) { if (el) el.style.display = 'none'; return; }
    const modeLabel = lastTaskMode === 'real-ai' ? '真实 AI' : '本地模板';
    el.innerHTML = `<span>任务ID: ${escapeHtml(lastTaskId)}</span> · <span>模式: ${escapeHtml(modeLabel)}</span> · <span>隐私: ${escapeHtml(aiPrivacyMode === 'named' ? '带姓名' : '脱敏')}</span>`;
    el.style.display = 'block';
}

function regenerateResult() {
    runAgentTask();
}

function copyAgentPlainText() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const text = output.innerText || '';
    if (!text || text.includes('选择场景后输入需求')) { showToast('暂无可复制内容'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== 草稿箱 ==========
function loadDraftsFromStorage() {
    try {
        renderDrafts(JSON.parse(localStorage.getItem('ai_drafts') || '[]'));
    } catch (e) { renderDrafts([]); }
}

function renderDrafts(drafts) {
    const area = document.getElementById('draftsArea');
    if (!area) return;
    if (!drafts || drafts.length === 0) { area.innerHTML = '<div class="ai-log-empty">暂无草稿</div>'; return; }
    area.innerHTML = drafts.slice(0, 20).map(draft => {
        const time = draft.createdAt ? new Date(draft.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const modeTag = draft.source === 'real-ai' ? '<span style="color:#27ae60;font-size:10px;">真实AI</span>' : '<span style="color:#888;font-size:10px;">本地</span>';
        const typeLabel = getDraftTypeLabel(draft);
        const typeBadge = typeLabel ? `<span style="background:#3498db;color:white;padding:1px 5px;border-radius:999px;font-size:9px;margin-left:4px;">${escapeHtml(typeLabel)}</span>` : '';
        const summary = (draft.content || '').replace(/\s+/g, ' ').trim();
        return `<div class="ai-log-item ai-draft-card" style="padding:8px 0;border-bottom:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:12px;font-weight:600;">${escapeHtml(draft.title || draft.task)}${typeBadge}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${time} · ${modeTag}</div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="continueFromDraft('${draft.id}')">继续生成</button>
                    <button class="btn btn-secondary btn-xs" onclick="copyDraft('${draft.id}')">复制</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteDraft('${draft.id}')">删除</button>
                </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.4;">${escapeHtml(summary.substring(0, 80))}${summary.length > 80 ? '...' : ''}</div>
        </div>`;
    }).join('');
}

function filterDrafts() {
    const search = document.getElementById('draftSearchInput')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('draftCenterFilter')?.value || '';
    try {
        let drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        if (search) drafts = drafts.filter(d => (d.title || '').toLowerCase().includes(search) || (d.content || '').toLowerCase().includes(search));
        if (typeFilter) {
            drafts = drafts.filter(d => d.task === typeFilter || d.center === typeFilter || getDraftGroup(d) === typeFilter);
        }
        renderDrafts(drafts);
    } catch (e) { renderDrafts([]); }
}

function getDraftGroup(draft) {
    if (['question-bank-plan', 'question-classify', 'exercise-recommend', 'exam-analysis'].includes(draft.task)) return 'question-bank';
    if (['resource-brief', 'research-plan'].includes(draft.task)) return 'resource';
    if (['weekly-report', 'monthly-report', 'class-consumption', 'tuition-warning', 'renewal-reminder'].includes(draft.task)) return 'operations';
    return draft.center || '';
}

function getDraftTypeLabel(draft) {
    const exact = DRAFT_TYPE_OPTIONS.find(item => item.value === draft.task);
    if (exact) return exact.label;
    const group = getDraftGroup(draft);
    if (group === 'question-bank') return '题库';
    if (group === 'resource') return '资料';
    if (group === 'operations') return '经营';
    return WORK_CENTERS[draft.center]?.name || '';
}

function saveToDrafts() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const content = output.innerText || '';
    if (!content || content.includes('选择场景后输入需求')) { showToast('暂无可保存内容'); return; }

    const taskNames = getTaskNames();
    const draft = {
        id: `draft_${Date.now()}`,
        task: currentTaskType,
        title: taskNames[currentTaskType] || currentTaskType || 'AI 生成',
        center: currentCenterId,
        style: currentStyle,
        content: content,
        createdAt: new Date().toISOString(),
        source: lastTaskMode || 'local-template',
    };

    try {
        const drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        drafts.unshift(draft);
        localStorage.setItem('ai_drafts', JSON.stringify(drafts.slice(0, 20)));
        loadDraftsFromStorage();
        showToast('已保存到草稿箱');
    } catch (e) { showToast('保存失败'); }
}

function continueFromDraft(draftId) {
    try {
        const drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        const draft = drafts.find(d => d.id === draftId);
        if (draft) {
            if (draft.center && WORK_CENTERS[draft.center]) selectWorkCenter(draft.center);
            if (draft.task) {
                const center = WORK_CENTERS[draft.center] || {};
                const task = [...(center.tasks || []), ...MORE_TASKS].find(item => item.task === draft.task);
                if (task) selectTask(task.task, task.agent, task.label, { focusInput: false, clearInput: false });
            }
            const input = document.getElementById('agentInput');
            if (input) input.value = draft.content.substring(0, 1000);
            showToast('已填入输入框，可继续编辑后再生成');
        }
    } catch (e) { showToast('操作失败'); }
}

function copyDraft(draftId) {
    try {
        const drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        const draft = drafts.find(d => d.id === draftId);
        if (draft) navigator.clipboard.writeText(draft.content || '').then(() => showToast('已复制')).catch(() => showToast('复制失败'));
    } catch (e) { showToast('复制失败'); }
}

function deleteDraft(draftId) {
    try {
        let drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        drafts = drafts.filter(d => d.id !== draftId);
        localStorage.setItem('ai_drafts', JSON.stringify(drafts));
        loadDraftsFromStorage();
        showToast('已删除');
    } catch (e) { showToast('删除失败'); }
}

function clearAllDrafts() {
    if (!confirm('确定要清空所有草稿吗？此操作不可恢复。')) return;
    localStorage.setItem('ai_drafts', '[]');
    loadDraftsFromStorage();
    showToast('草稿箱已清空');
}

function refreshDrafts() { loadDraftsFromStorage(); showToast('草稿箱已刷新'); }

function addToTodo() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const content = output.innerText || '';
    if (!content || content.includes('选择场景后输入需求')) { showToast('暂无可加入待办的内容'); return; }

    const taskNames = getTaskNames();
    const todo = {
        id: `todo_${Date.now()}`,
        title: `[AI] ${taskNames[currentTaskType] || currentTaskType}`,
        content: content.substring(0, 200),
        category: 'other',
        completed: false,
        createdAt: new Date().toISOString()
    };

    try {
        const todos = JSON.parse(localStorage.getItem('ai_todos') || '[]');
        todos.unshift(todo);
        localStorage.setItem('ai_todos', JSON.stringify(todos));
        showToast('已加入待办');
        if (typeof window.refreshTODOs === 'function') window.refreshTODOs();
    } catch (e) { showToast('加入待办失败'); }
}

// ========== 风格设置 ==========
function openStyleSettings() {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = '🎨 风格设置';
    const savedStyles = JSON.parse(localStorage.getItem('ai_styles') || '{}');
    const defaultStyles = {
        'bai-teacher': '请用白老师风格：真实、清楚、克制、偏实用，不夸张营销。句子尽量短，不堆形容词。少用口号，多给具体判断和可执行建议。',
        'wechat-article': '请使用公众号长文风格：正式、完整、有深度，适合家长阅读。',
        'xiaohongshu': '请使用小红书笔记风格：轻松、有趣、带emoji，适合社交平台。',
        'video-script': '请使用视频号口播风格：口语化、有节奏、适合朗读。',
        'parent-comm': '请使用家长沟通风格：温和、专业、接地气。',
        'teaching-note': '请使用教研说明风格：严谨、清晰、有逻辑。',
    };

    bodyEl.innerHTML = `<div style="max-height:400px;overflow-y:auto;">
        ${STYLE_OPTIONS.map(s => `
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">${s.label}</label>
                <textarea id="style_${s.value}" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;">${savedStyles[s.value] || defaultStyles[s.value] || ''}</textarea>
            </div>
        `).join('')}
        <div style="margin-top:16px;display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="saveStyleSettings()">保存</button>
            <button class="btn btn-warning" onclick="resetStyleSettings()">恢复默认</button>
        </div>
    </div>`;
    modal.classList.add('show');
}

function saveStyleSettings() {
    const styles = {};
    STYLE_OPTIONS.forEach(s => {
        const val = document.getElementById(`style_${s.value}`)?.value?.trim();
        if (val) styles[s.value] = val;
    });
    localStorage.setItem('ai_styles', JSON.stringify(styles));
    closeModal();
    showToast('风格设置已保存');
}

function resetStyleSettings() {
    localStorage.removeItem('ai_styles');
    closeModal();
    showToast('已恢复默认风格');
}

// ========== Agent 日志 ==========
function loadAgentLogsFromServer() {
    fetch('/api/agent-logs')
        .then(res => res.json())
        .then(payload => { renderAgentLogsFromServer(payload.logs || payload || []); })
        .catch(() => {});
}

function renderAgentLogsFromServer(logs) {
    const logArea = document.getElementById('agentLogArea');
    if (!logArea) return;
    if (!logs || logs.length === 0) { logArea.innerHTML = '<div class="ai-log-empty">暂无 Agent 调用记录</div>'; return; }
    logArea.innerHTML = logs.slice(0, 20).map(log => {
        const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const output = log.output || {};
        const mode = output.mode === 'real-ai' ? '<span style="color:#27ae60;">真实 AI</span>' : '<span style="color:#888;">本地模板</span>';
        const success = output.success !== false;
        const statusBadge = success ? '<span style="color:#27ae60;font-size:11px;font-weight:600;">成功</span>' : '<span style="color:#e74c3c;font-size:11px;font-weight:600;">失败</span>';
        const fallbackBadge = output.fallbackFrom ? ' · <span style="color:#f39c12;">已回退</span>' : '';
        const elapsed = output.elapsedMs ? ` · ${Math.round(output.elapsedMs / 1000)}秒` : '';
        return `<div class="ai-log-item" style="margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border-color);">[${time}] ${escapeHtml(log.agentName || log.agent || '')} · ${escapeHtml(log.action || '')} · ${mode}${fallbackBadge}${elapsed} · ${statusBadge}</div>`;
    }).join('');
}

function refreshAgentLogs() { loadAgentLogsFromServer(); showToast('日志已刷新'); }

function loadAITasksFromServer() {
    fetch('/api/ai/tasks')
        .then(res => res.json())
        .then(payload => { renderAITasksList(payload.tasks || payload || []); })
        .catch(() => { const area = document.getElementById('aiTasksArea'); if (area) area.innerHTML = '<div class="ai-log-empty">暂无生成记录</div>'; });
}

function renderAITasksList(tasks) {
    const area = document.getElementById('aiTasksArea');
    if (!area) return;
    if (!tasks || tasks.length === 0) { area.innerHTML = '<div class="ai-log-empty">暂无生成记录</div>'; return; }
    area.innerHTML = tasks.slice(0, 10).map(task => {
        const time = task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const title = task.title || task.agent || '未知任务';
        const statusBadge = task.status === 'done' ? '<span style="color:#27ae60;font-size:11px;font-weight:600;">已完成</span>' : task.status === 'failed' ? '<span style="color:#e74c3c;font-size:11px;font-weight:600;">失败</span>' : '<span style="color:#f39c12;font-size:11px;">进行中</span>';
        const mode = task.mode === 'real-ai' ? '<span style="color:#27ae60;font-size:11px;">真实 AI</span>' : task.mode === 'local-template' ? '<span style="color:#888;font-size:11px;">本地模板</span>' : '<span style="color:#888;font-size:11px;">模式待记录</span>';
        const fallback = task.fallbackFrom ? ' · <span style="color:#f39c12;font-size:11px;">已回退</span>' : '';
        return `<div class="ai-log-item">[${time}] ${escapeHtml(title)} · ${statusBadge} · ${mode}${fallback}</div>`;
    }).join('');
}

function refreshAITasks() { loadAITasksFromServer(); showToast('记录已刷新'); }

function clearAgentOutput() {
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择场景后输入需求，点击「发送给 AI」查看输出。后续可以继续追问修改。';
    document.getElementById('outputActions').style.display = 'none';
    showToast('输出已清空');
}

function clearAgentInput() {
    const input = document.getElementById('agentInput');
    if (input) input.value = '';
    showToast('输入已清空');
}

function copyAgentOutput() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const text = output.innerText || '';
    if (!text || text.includes('选择场景后输入需求')) { showToast('暂无可复制内容'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== 上下文引用 ==========
function renderContextRefs(contextRefs, mode) {
    const area = document.getElementById('contextRefsArea');
    const content = document.getElementById('contextRefsContent');
    if (!area || !content) return;

    const refs = Array.isArray(contextRefs) ? contextRefs : [];
    const factualRefs = refs.filter(ref => !['style', 'style-sample'].includes(ref.refType || ref.type || ''));
    if (refs.length === 0 || factualRefs.length === 0) {
        const label = mode === 'system-facts'
            ? '本次依据：当前系统数据。没有引用资料库或联网内容。'
            : '本次没有引用可作为事实依据的资料库或联网内容。风格样本只影响表达，不作为事实来源。';
        content.innerHTML = `<div class="system-qa-reference-empty">${label}</div>`;
        return;
    }

    const typeLabels = {
        'style': '风格规则',
        'style-sample': '风格样本',
        'source': '资料',
        'web': '联网结果',
        'question': '题库'
    };

    const grouped = {};
    refs.forEach(ref => {
        const type = ref.refType || ref.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(ref);
    });

    let html = '';
    Object.entries(grouped).forEach(([type, refs]) => {
        const label = typeLabels[type] || type;
        const visibleRefs = refs.slice(0, 3);
        const hiddenRefs = refs.slice(3);
        html += `<div style="margin-bottom:10px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;font-weight:600;">📂 ${escapeHtml(label)}（${refs.length}条）</div>`;
        visibleRefs.forEach(ref => { html += renderContextRefItem(ref); });
        if (hiddenRefs.length > 0) {
            html += `<details class="ai-context-more">
                <summary>查看其余 ${hiddenRefs.length} 条引用</summary>
                <div style="margin-top:6px;">${hiddenRefs.map(ref => renderContextRefItem(ref)).join('')}</div>
            </details>`;
        }
        html += '</div>';
    });

    content.innerHTML = html;
}

function clearSystemQARefs() {
    const content = document.getElementById('contextRefsContent');
    if (!content) return;
    content.innerHTML = '<div class="system-qa-reference-empty">已清空当前引用显示。下一次发送问题后会自动更新。</div>';
}

function renderContextRefItem(ref) {
    const titleText = escapeHtml(ref.title || ref.name || '未命名');
    const summaryText = ref.summary ? escapeHtml(ref.summary) : '';
    const hasLongContent = summaryText.length > 100;
    return `<div class="ai-context-ref-item">
        <div class="ai-context-ref-title">${titleText}</div>
        ${summaryText ? `<div class="ai-context-ref-summary">${hasLongContent ? summaryText.substring(0, 100) + '...' : summaryText}</div>` : ''}
    </div>`;
}

function previewContextRefs() {
    if (!currentTaskType) {
        showToast('请先选择一个任务类型');
        return;
    }

    const taskNames = getTaskNames();
    const input = document.getElementById('agentInput')?.value?.trim() || '';

    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = '🔍 上下文预览';
    bodyEl.innerHTML = `
        <div style="padding:16px;text-align:center;">
            <div style="font-size:16px;margin-bottom:12px;">⏳ 加载引用预览...</div>
        </div>
    `;
    modal.classList.add('show');

    const payload = {
        agent: currentAgentId,
        task: currentTaskType,
        latestQuestion: input || '(空)',
        userInstruction: input || '(空)',
        privacyMode: aiPrivacyMode,
        sourceScope: aiSourceScope,
        relatedType: currentRelatedType,
        relatedId: currentRelatedId,
    };

    fetch('/api/ai/context-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => res.json())
    .then(data => {
        const typeLabels = {
            'style': '🎨 风格规则',
            'style-sample': '📝 风格样本',
            'source': '📄 资料',
            'question': '📚 题库'
        };

        let html = `<div style="max-height:400px;overflow-y:auto;">
            <div style="margin-bottom:16px;padding:8px 12px;background:var(--hover-bg);border-radius:8px;">
                <div style="font-size:12px;color:var(--text-muted);">当前任务</div>
                <div style="font-size:14px;font-weight:600;">${escapeHtml(taskNames[currentTaskType] || currentTaskType)}</div>
            </div>`;

        const refs = data.refs || data.knowledge?.refs || [];
        const warnings = data.warnings || data.knowledge?.warnings || [];
        if (warnings.length > 0) {
            html += `<div style="margin-bottom:12px;padding:8px 10px;background:#fff8e1;border:1px solid #f1c40f;border-radius:6px;color:#7a5d00;font-size:12px;">
                ${warnings.map(item => `<div>⚠️ ${escapeHtml(item)}</div>`).join('')}
            </div>`;
        }

        if (refs.length === 0) {
            html += `<div style="text-align:center;padding:24px;color:var(--text-muted);">
                <div style="font-size:32px;margin-bottom:8px;">📭</div>
                <div style="font-size:13px;">知识库暂无可引用资料</div>
                <div style="font-size:12px;margin-top:4px;">可先到知识库录入风格样本或资料</div>
            </div>`;
        } else {
            const grouped = {};
            refs.forEach(ref => {
                const type = ref.refType || ref.type || 'unknown';
                if (!grouped[type]) grouped[type] = [];
                grouped[type].push(ref);
            });

            Object.entries(grouped).forEach(([type, refs]) => {
                const label = typeLabels[type] || type;
                html += `<div style="margin-bottom:12px;">
                    <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text-secondary);">${label}（${refs.length}条）</div>`;
                refs.forEach(ref => {
                    html += `<div style="padding:8px;background:var(--card-bg);border-radius:6px;margin-bottom:6px;">
                        <div style="font-size:13px;font-weight:600;margin-bottom:2px;">${escapeHtml(ref.title || ref.name || '未命名')}</div>
                        ${ref.summary ? `<div style="font-size:11px;color:var(--text-muted);line-height:1.4;">${escapeHtml(ref.summary.substring(0, 100))}${ref.summary.length > 100 ? '...' : ''}</div>` : ''}
                    </div>`;
                });
                html += '</div>';
            });
        }

        html += `<div style="margin-top:16px;display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
        </div></div>`;

        bodyEl.innerHTML = html;
    })
    .catch(err => {
        bodyEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);">
            <div style="font-size:24px;margin-bottom:8px;">❌</div>
            <div>预览失败：${escapeHtml(err.message || '未知错误')}</div>
            <button class="btn btn-secondary" style="margin-top:12px;" onclick="closeModal()">关闭</button>
        </div>`;
    });
}

// ========== 极简系统问答工作台 ==========
function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    if (!container) return;
    aiPrivacyMode = aiPrivacyMode || 'masked';
    currentAgentId = 'system-agent';
    currentTaskType = 'system-qa';
    currentTaskLabel = '系统数据问答';
    hydrateSystemQAConversationsFromData();
    ensureSystemQAConversation();

    container.innerHTML = `
        <div class="system-qa-shell">
            <aside class="system-qa-sidebar">
                <div class="system-qa-sidebar-head">
                    <div class="system-qa-sidebar-title">AI 对话</div>
                    <button class="btn btn-primary btn-sm" onclick="startSystemQAConversation()">新对话</button>
                </div>
                <div class="system-qa-sidebar-actions">
                    <button class="btn btn-secondary btn-sm" onclick="refreshSystemQAData()">刷新系统数据</button>
                    <button class="btn btn-secondary btn-sm" onclick="showSystemQACapabilities()">能查什么</button>
                    <label class="system-qa-toggle"><input type="checkbox" id="systemQANameToggle" onchange="toggleSystemQANameMode()" ${aiPrivacyMode === 'named' ? 'checked' : ''}> 显示真实姓名</label>
                </div>
                <div class="system-qa-sidebar-block">
                    <div class="system-qa-section-head">
                        <div class="system-qa-section-title">可以这样问</div>
                        <div class="system-qa-prompt-actions">
                            <button class="btn btn-secondary btn-xs" onclick="toggleSystemQAPromptManageMode()">${systemQAPromptManageMode ? '完成' : '管理'}</button>
                        </div>
                    </div>
                    <div id="systemQAPromptManageBar" class="system-qa-manage-bar" style="display:${systemQAPromptManageMode ? 'flex' : 'none'};">
                        <button class="btn btn-primary btn-xs" onclick="addSystemQAPrompt()">新增</button>
                        <button class="btn btn-secondary btn-xs" onclick="restoreDefaultSystemQAPrompts()">恢复默认</button>
                    </div>
                    <div id="systemQAPromptList" class="system-qa-prompt-list"></div>
                </div>
                <div class="system-qa-sidebar-block system-qa-history-block">
                    <div class="system-qa-section-head">
                        <div class="system-qa-section-title">聊天记录</div>
                        <div class="system-qa-prompt-actions">
                            <button id="systemQAHistoryBatchToggle" class="btn btn-secondary btn-xs" onclick="toggleSystemQAHistoryBatchMode()">${systemQAHistoryBatchMode ? '完成' : '批量'}</button>
                        </div>
                    </div>
                    <div id="systemQAHistoryBatchBar" class="system-qa-manage-bar" style="display:${systemQAHistoryBatchMode ? 'flex' : 'none'};">
                        <button class="btn btn-secondary btn-xs" onclick="selectAllSystemQAHistory()">全选</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteSelectedSystemQAConversations()">删除选中</button>
                    </div>
                    <div id="systemQAHistoryList" class="system-qa-history-list"></div>
                </div>
            </aside>

            <section class="system-qa-main">
                <div id="systemQAHelp" class="system-qa-help" style="display:none;">可按下方“回答依据”选择当前系统、已导入知识库或联网搜索。AI 只负责读取和分析，不会自动修改任何数据。知识库/Obsidian 指已经导入到系统资料库的内容，不会实时搜索未导入的 Obsidian 文件，也不会仅凭文件路径自动读取 Word、PDF 或网页正文。</div>
                <div id="aiConfigStatus" class="ai-config-status system-qa-status-hidden"><span style="color:#95a5a6;">● 加载中...</span></div>

                <div id="aiConversationArea" class="system-qa-conversation">
                    <div class="ai-chat-empty">输入问题后发送。生成后可以继续追问，比如“按班级分组”“展开第 3 个学生”“说得简单一点”。</div>
                </div>
                <div class="system-qa-input-area">
                    <textarea id="agentInput" class="system-qa-textarea" rows="1" placeholder="例如：哪些学生需要我这周重点关注？" oninput="autoResizeSystemQAInput(this)" onkeydown="handleSystemQAKeydown(event)"></textarea>
                    <div class="system-qa-toolbar">
                        <div class="system-qa-source-row">
                            <span>依据</span>
                            <label><input type="checkbox" id="sourceSystemData" onchange="toggleAISourceScope('systemData', this.checked)" ${aiSourceScope.systemData ? 'checked' : ''}> 系统</label>
                            <label title="搜索已导入资料库；Obsidian 新内容需先导入/刷新。"><input type="checkbox" id="sourceKnowledgeBase" onchange="toggleAISourceScope('knowledgeBase', this.checked)" ${aiSourceScope.knowledgeBase ? 'checked' : ''}> 资料库</label>
                            <label><input type="checkbox" id="sourceWebSearch" onchange="toggleAISourceScope('webSearch', this.checked)" ${aiSourceScope.webSearch ? 'checked' : ''}> 联网</label>
                            <label class="system-qa-model-label">模型
                                <select id="systemQAModelProvider" class="system-qa-model-select" onchange="setSystemQAModelProvider(this.value)">
                                    <option value="minimax" ${selectedSystemQAModelProvider === 'minimax' ? 'selected' : ''}>MiniMax</option>
                                    <option value="deepseek" ${selectedSystemQAModelProvider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                                </select>
                            </label>
                            <label class="system-qa-model-label">输出
                                <select id="systemQAAnswerLength" class="system-qa-model-select" onchange="setSystemQAAnswerLength(this.value)">
                                    <option value="brief" ${selectedSystemQAAnswerLength !== 'detailed' ? 'selected' : ''}>简洁</option>
                                    <option value="detailed" ${selectedSystemQAAnswerLength === 'detailed' ? 'selected' : ''}>详细</option>
                                </select>
                            </label>
                        </div>
                        <div class="system-qa-input-actions">
                            <button class="system-qa-mini-btn" onclick="toggleSystemQAHelp()" title="查看说明">说明</button>
                            <button class="system-qa-mini-btn" onclick="openSystemQAFullInput()" title="全屏输入">全屏</button>
                            <button class="system-qa-mini-btn" onclick="clearSystemQAInput()" title="清空输入">清空</button>
                            <button class="btn btn-primary btn-sm system-qa-send-btn" id="generateBtn" onclick="runAgentTask()">发送</button>
                        </div>
                    </div>
                </div>
                <div id="agentOutput" class="ai-output-content system-qa-hidden-output">暂无回答。</div>
                <div id="outputActions" style="display:none;"></div>
                <div id="taskRecordInfo" class="ai-task-record" style="display:none;"></div>
            </section>

            <aside class="system-qa-reference-panel">
                <div class="system-qa-reference-head">
                    <div>
                        <div class="system-qa-reference-title">引用依据</div>
                        <div class="system-qa-reference-subtitle">本次回答的来源</div>
                    </div>
                    <button class="system-qa-mini-btn" onclick="clearSystemQARefs()" title="清空当前依据">清空</button>
                </div>
                <div id="contextRefsArea" class="ai-context-refs-area system-qa-context-refs">
                    <div id="contextRefsContent" class="system-qa-reference-empty">发送问题后，这里会显示系统数据、资料库或联网引用。</div>
                </div>
            </aside>
        </div>
    `;

    renderSystemQAConversation();
    renderSystemQAHistory();
    renderSystemQAPrompts();
    loadSystemQAPrompts();
    loadSystemQAConversations();
    loadAIStatus();
}

function normalizeSystemQAPrompts(prompts) {
    const source = Array.isArray(prompts) && prompts.length ? prompts : DEFAULT_SYSTEM_QA_PROMPTS;
    return source
        .filter(item => item && String(item.text || '').trim())
        .map((item, index) => ({
            id: String(item.id || `qa_prompt_${Date.now()}_${index}`),
            text: String(item.text || '').trim(),
            category: String(item.category || '常用'),
            sortOrder: Number(item.sortOrder || (index + 1) * 10),
            isDefault: Boolean(item.isDefault),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || ''
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getSystemQAPrompts() {
    if (systemQAPromptsLoaded && systemQAPrompts.length) return systemQAPrompts;
    if (Array.isArray(data?.aiQuestionPrompts) && data.aiQuestionPrompts.length) return normalizeSystemQAPrompts(data.aiQuestionPrompts);
    return normalizeSystemQAPrompts(DEFAULT_SYSTEM_QA_PROMPTS);
}

function renderSystemQAPrompts() {
    const list = document.getElementById('systemQAPromptList');
    if (!list) return;
    const prompts = getSystemQAPrompts();
    const groups = prompts.reduce((map, prompt) => {
        const key = prompt.category || '常用';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(prompt);
        return map;
    }, new Map());
    list.innerHTML = [...groups.entries()].map(([category, items]) => `
        <div class="system-qa-prompt-group">
            <div class="system-qa-prompt-category">${escapeHtml(category)}</div>
            ${items.map(prompt => `
                <div class="system-qa-prompt-item ${systemQAPromptManageMode ? 'manage' : ''}">
                    <button class="system-qa-chip" data-question="${escapeHtml(prompt.text)}" onclick="fillSystemQAQuestion(this.dataset.question)">${escapeHtml(prompt.text)}</button>
                    <div class="system-qa-prompt-tools" style="display:${systemQAPromptManageMode ? 'flex' : 'none'};">
                        <button class="system-qa-icon-btn" title="编辑" onclick="editSystemQAPrompt('${escapeHtml(prompt.id)}')">改</button>
                        <button class="system-qa-icon-btn danger" title="删除" onclick="deleteSystemQAPrompt('${escapeHtml(prompt.id)}')">删</button>
                    </div>
                </div>
            `).join('')}
            </div>
    `).join('');
}

async function loadSystemQAPrompts() {
    try {
        const response = await fetch('/api/aiQuestionPrompts', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`读取问句失败：${response.status}`);
        const payload = await response.json();
        systemQAPrompts = normalizeSystemQAPrompts(payload.aiQuestionPrompts);
        systemQAPromptsLoaded = true;
        if (data) data.aiQuestionPrompts = systemQAPrompts;
        renderSystemQAPrompts();
    } catch (error) {
        console.warn('读取 AI 问句失败，使用默认问句:', error);
        systemQAPrompts = getSystemQAPrompts();
        renderSystemQAPrompts();
    }
}

async function saveSystemQAPrompts(nextPrompts) {
    systemQAPrompts = normalizeSystemQAPrompts(nextPrompts);
    if (data) data.aiQuestionPrompts = systemQAPrompts;
    renderSystemQAPrompts();
    try {
        await saveCollectionToApi('aiQuestionPrompts', systemQAPrompts);
        showToast('问句已同步');
    } catch (error) {
        console.error('保存 AI 问句失败:', error);
        showToast('问句保存失败，请刷新后重试');
    }
}

function addSystemQAPrompt() {
    const text = window.prompt('新增问句：', '');
    if (!text || !text.trim()) return;
    const prompts = getSystemQAPrompts();
    const maxOrder = prompts.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
    saveSystemQAPrompts([
        ...prompts,
        {
            id: `qa_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.trim(),
            category: '自定义',
            sortOrder: maxOrder + 10,
            isDefault: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ]);
}

function editSystemQAPrompt(id) {
    const prompts = getSystemQAPrompts();
    const current = prompts.find(item => String(item.id) === String(id));
    if (!current) return;
    const text = window.prompt('编辑问句：', current.text);
    if (!text || !text.trim()) return;
    saveSystemQAPrompts(prompts.map(item => String(item.id) === String(id)
        ? { ...item, text: text.trim(), updatedAt: new Date().toISOString() }
        : item
    ));
}

function deleteSystemQAPrompt(id) {
    const prompts = getSystemQAPrompts();
    const current = prompts.find(item => String(item.id) === String(id));
    if (!current) return;
    if (!confirm(`删除这个问句吗？\n\n${current.text}`)) return;
    saveSystemQAPrompts(prompts.filter(item => String(item.id) !== String(id)));
}

function restoreDefaultSystemQAPrompts() {
    if (!confirm('恢复默认问句会覆盖当前自定义问句，确定恢复吗？')) return;
    saveSystemQAPrompts(DEFAULT_SYSTEM_QA_PROMPTS.map(item => ({ ...item, updatedAt: new Date().toISOString() })));
}

function toggleSystemQAPromptManageMode() {
    systemQAPromptManageMode = !systemQAPromptManageMode;
    renderAIWorkspace();
}

function normalizeSystemQAConversations(conversations) {
    return (Array.isArray(conversations) ? conversations : [])
        .filter(item => item && String(item.id || '').trim())
        .map(item => ({
            id: String(item.id),
            title: String(item.title || '新对话'),
            messages: Array.isArray(item.messages) ? item.messages.filter(message => message && message.role && message.content).map(normalizeSystemQAMessage) : [],
            pinned: Boolean(item.pinned),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
        }))
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return String(b.updatedAt).localeCompare(String(a.updatedAt));
        });
}

function normalizeSystemQAMessage(message = {}) {
    return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: String(message.content || ''),
        createdAt: message.createdAt || new Date().toISOString(),
        meta: message.meta && typeof message.meta === 'object' ? message.meta : null
    };
}

function hydrateSystemQAConversationsFromData() {
    if (systemQAConversationsLoaded) return;
    const draft = (() => {
        try { return JSON.parse(localStorage.getItem('aiConversationsDraft') || '[]'); } catch { return []; }
    })();
    systemQAConversations = normalizeSystemQAConversations(data?.aiConversations?.length ? data.aiConversations : draft);
    systemQAConversationsLoaded = true;
}

async function loadSystemQAConversations() {
    try {
        const response = await fetch('/api/aiConversations', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`读取聊天记录失败：${response.status}`);
        const payload = await response.json();
        const loaded = normalizeSystemQAConversations(payload.aiConversations || []);
        systemQAConversationsLoaded = true;
        if (loaded.length) {
            systemQAConversations = loaded;
            if (!currentSystemQAConversationId || !systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
                currentSystemQAConversationId = systemQAConversations[0].id;
            }
            const current = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
            aiConversationMessages = current?.messages || [];
            if (data) data.aiConversations = systemQAConversations;
            renderSystemQAConversation();
            renderSystemQAHistory();
        }
    } catch (error) {
        console.warn('读取 AI 聊天记录失败，使用当前会话:', error);
    }
}

async function saveSystemQAConversations() {
    const normalized = normalizeSystemQAConversations(systemQAConversations);
    systemQAConversations = normalized;
    if (data) data.aiConversations = normalized;
    systemQAConversationSaveQueue = systemQAConversationSaveQueue
        .catch(() => {})
        .then(() => saveCollectionToApi('aiConversations', normalizeSystemQAConversations(systemQAConversations)))
        .catch(error => {
        console.error('保存 AI 聊天记录失败:', error);
        localStorage.setItem('aiConversationsDraft', JSON.stringify(normalized));
        showToast('聊天记录同步失败，已临时保存在本机');
        });
    return systemQAConversationSaveQueue;
}

function ensureSystemQAConversation() {
    if (currentSystemQAConversationId && systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
        const current = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
        aiConversationMessages = current.messages;
        return current;
    }
    const conversation = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    systemQAConversations.unshift(conversation);
    currentSystemQAConversationId = conversation.id;
    aiConversationMessages = conversation.messages;
    return conversation;
}

function syncCurrentSystemQAConversation() {
    const conversation = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
    if (!conversation) return;
    conversation.messages = aiConversationMessages;
    conversation.updatedAt = new Date().toISOString();
    const firstUser = aiConversationMessages.find(item => item.role === 'user');
    conversation.title = firstUser ? firstUser.content.replace(/\s+/g, ' ').slice(0, 20) : '新对话';
}

function renderSystemQAHistory() {
    const list = document.getElementById('systemQAHistoryList');
    if (!list) return;
    const conversations = normalizeSystemQAConversations(systemQAConversations);
    if (!conversations.length) {
        list.innerHTML = '<div class="system-qa-empty-mini">暂无聊天记录</div>';
        return;
    }
    list.innerHTML = conversations.map(item => `
        <div class="system-qa-history-row ${item.id === currentSystemQAConversationId ? 'active' : ''} ${systemQAHistoryBatchMode ? 'batch' : ''}">
            ${systemQAHistoryBatchMode ? `<label class="system-qa-history-check"><input type="checkbox" ${selectedSystemQAConversationIds.has(item.id) ? 'checked' : ''} onchange="toggleSystemQAHistorySelection('${item.id}', this.checked)"></label>` : ''}
            <button class="system-qa-history-item" onclick="${systemQAHistoryBatchMode ? `toggleSystemQAHistorySelection('${item.id}')` : `switchSystemQAConversation('${item.id}')`}">
                <span>${item.pinned ? '置顶 · ' : ''}${escapeHtml(item.title || '新对话')}</span>
                <small>${new Date(item.updatedAt || item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
            </button>
            <div class="system-qa-history-tools" style="display:${systemQAHistoryBatchMode ? 'none' : 'flex'};">
                <div class="system-qa-history-menu-wrap">
                    <button class="system-qa-history-more" title="更多操作" onclick="toggleSystemQAHistoryMenu('${item.id}', event)">⋯</button>
                    ${openSystemQAHistoryMenuId === item.id ? `
                        <div class="system-qa-history-menu" onclick="event.stopPropagation()">
                            <button onclick="pinSystemQAConversationFromMenu('${item.id}')">${item.pinned ? '取消置顶' : '置顶'}</button>
                            <button class="danger" onclick="deleteSystemQAConversationFromMenu('${item.id}')">删除</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function toggleSystemQAHistoryBatchMode() {
    systemQAHistoryBatchMode = !systemQAHistoryBatchMode;
    openSystemQAHistoryMenuId = '';
    if (!systemQAHistoryBatchMode) selectedSystemQAConversationIds.clear();
    const bar = document.getElementById('systemQAHistoryBatchBar');
    if (bar) bar.style.display = systemQAHistoryBatchMode ? 'flex' : 'none';
    const btn = document.getElementById('systemQAHistoryBatchToggle');
    if (btn) btn.textContent = systemQAHistoryBatchMode ? '完成' : '批量';
    renderSystemQAHistory();
}

function toggleSystemQAHistorySelection(id, checked) {
    const nextChecked = typeof checked === 'boolean' ? checked : !selectedSystemQAConversationIds.has(id);
    if (nextChecked) selectedSystemQAConversationIds.add(id);
    else selectedSystemQAConversationIds.delete(id);
    renderSystemQAHistory();
}

function selectAllSystemQAHistory() {
    normalizeSystemQAConversations(systemQAConversations).forEach(item => selectedSystemQAConversationIds.add(item.id));
    renderSystemQAHistory();
}

function deleteSelectedSystemQAConversations() {
    const ids = new Set([...selectedSystemQAConversationIds]);
    if (!ids.size) {
        showToast('请先选择聊天记录');
        return;
    }
    if (!confirm(`删除选中的 ${ids.size} 条聊天记录吗？`)) return;
    systemQAConversations = systemQAConversations.filter(item => !ids.has(item.id));
    selectedSystemQAConversationIds.clear();
    if (!systemQAConversations.length) {
        currentSystemQAConversationId = '';
        ensureSystemQAConversation();
    } else if (!systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
        currentSystemQAConversationId = systemQAConversations[0].id;
    }
    aiConversationMessages = systemQAConversations.find(item => item.id === currentSystemQAConversationId)?.messages || [];
    syncCurrentSystemQAConversation();
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
    showToast('已删除选中的聊天记录');
}

function switchSystemQAConversation(id) {
    const conversation = systemQAConversations.find(item => item.id === id);
    if (!conversation) return;
    openSystemQAHistoryMenuId = '';
    currentSystemQAConversationId = id;
    aiConversationMessages = conversation.messages || [];
    renderSystemQAConversation();
    renderSystemQAHistory();
    const output = document.getElementById('agentOutput');
    const lastAnswer = [...aiConversationMessages].reverse().find(item => item.role === 'assistant');
    if (output) output.innerHTML = lastAnswer ? renderMarkdown(lastAnswer.content || '') : '暂无回答。';
}

function toggleSystemQAConversationPin(id) {
    const conversation = systemQAConversations.find(item => String(item.id) === String(id));
    if (!conversation) return;
    conversation.pinned = !conversation.pinned;
    conversation.updatedAt = new Date().toISOString();
    renderSystemQAHistory();
    saveSystemQAConversations();
}

function toggleSystemQAHistoryMenu(id, event) {
    if (event) event.stopPropagation();
    openSystemQAHistoryMenuId = openSystemQAHistoryMenuId === id ? '' : id;
    renderSystemQAHistory();
}

function pinSystemQAConversationFromMenu(id) {
    openSystemQAHistoryMenuId = '';
    toggleSystemQAConversationPin(id);
}

function deleteSystemQAConversationFromMenu(id) {
    openSystemQAHistoryMenuId = '';
    deleteSystemQAConversation(id);
}

function setSystemQAModelProvider(provider) {
    selectedSystemQAModelProvider = provider === 'deepseek' ? 'deepseek' : 'minimax';
    localStorage.setItem('systemQAModelProvider', selectedSystemQAModelProvider);
    renderSystemQAModelProviderSelect();
}

function setSystemQAAnswerLength(value) {
    selectedSystemQAAnswerLength = value === 'detailed' ? 'detailed' : 'brief';
    localStorage.setItem('systemQAAnswerLength', selectedSystemQAAnswerLength);
}

function renderSystemQAModelProviderSelect() {
    const select = document.getElementById('systemQAModelProvider');
    if (!select) return;
    select.value = selectedSystemQAModelProvider;
    const providerStatus = systemQAAIStatus?.providers?.find(item => item.provider === selectedSystemQAModelProvider);
    if (providerStatus) {
        select.title = providerStatus.enabled ? `${providerStatus.label || selectedSystemQAModelProvider} 已配置：${providerStatus.model || ''}` : `${providerStatus.label || selectedSystemQAModelProvider} 未配置或不可用`;
    }
}

function deleteSystemQAConversation(id) {
    const conversation = systemQAConversations.find(item => String(item.id) === String(id));
    if (!conversation) return;
    if (!confirm(`删除这条聊天记录吗？\n\n${conversation.title || '新对话'}`)) return;
    systemQAConversations = systemQAConversations.filter(item => String(item.id) !== String(id));
    if (currentSystemQAConversationId === id) {
        currentSystemQAConversationId = systemQAConversations[0]?.id || '';
        aiConversationMessages = systemQAConversations[0]?.messages || [];
        if (!currentSystemQAConversationId) ensureSystemQAConversation();
    }
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
}

function renderSystemQAConversation() {
    const area = document.getElementById('aiConversationArea');
    if (!area) return;
    if (!aiConversationMessages.length) {
        area.innerHTML = '<div class="ai-chat-empty">输入问题后发送。生成后可以继续追问，比如“按班级分组”“展开第 3 个学生”“说得简单一点”。</div>';
        return;
    }
    area.innerHTML = aiConversationMessages.slice(-12).map(message => `
        <div class="ai-chat-message ${message.role === 'user' ? 'user' : 'assistant'}">
            <div class="ai-chat-role">${message.role === 'user' ? '我' : 'AI'}</div>
            <div class="ai-chat-bubble">
                ${renderMarkdown(message.content || '')}
                ${message.role === 'assistant' ? renderSystemQAMessageMeta(message) : ''}
            </div>
        </div>
    `).join('');
    area.scrollTop = area.scrollHeight;
}

function renderSystemQAMessageMeta(message = {}) {
    const meta = message.meta || {};
    const modeLabel = getSystemQAModeLabel(meta.mode);
    const sourceLabel = getSystemQASourceLabel(meta.sourceScope);
    const providerLabel = getSystemQAProviderLabel(meta.provider);
    const generatedAt = meta.generatedAt || message.createdAt || '';
    const timeLabel = generatedAt ? new Date(generatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const factsLabel = Array.isArray(meta.queryFactKeys) && meta.queryFactKeys.length ? `精确查询 ${meta.queryFactKeys.length} 项` : '';
    const refsLabel = Number(meta.contextRefsCount || 0) > 0 ? `引用 ${meta.contextRefsCount} 条` : '';
    const isHistorical = generatedAt && (Date.now() - new Date(generatedAt).getTime()) > 12 * 60 * 60 * 1000;
    const parts = [modeLabel, providerLabel, sourceLabel, factsLabel, refsLabel, timeLabel].filter(Boolean);
    if (!parts.length) return '';
    return `
        <div class="system-qa-answer-meta">
            <span>${parts.map(escapeHtml).join(' · ')}</span>
            ${isHistorical ? '<strong>历史回答，可能不是当前数据</strong>' : ''}
        </div>
    `;
}

function getSystemQAModeLabel(mode) {
    if (mode === 'system-facts') return '系统事实';
    if (mode === 'system-safe') return '安全提示';
    if (mode === 'real-ai') return '真实 AI';
    if (mode === 'local-template') return '本地模板';
    if (mode === 'failed') return '查询失败';
    return mode ? String(mode) : '';
}

function getSystemQAProviderLabel(provider) {
    if (!provider) return '';
    if (provider === 'minimax') return 'MiniMax';
    if (provider === 'deepseek') return 'DeepSeek';
    if (provider === 'qwen') return 'Qwen';
    return String(provider);
}

function getSystemQASourceLabel(scope = {}) {
    const labels = [];
    if (scope.systemData) labels.push('系统');
    if (scope.knowledgeBase) labels.push('资料库');
    if (scope.webSearch) labels.push('联网');
    return labels.length ? `依据：${labels.join('/')}` : '';
}

function getSystemQAHistoryText() {
    if (!aiConversationMessages.length) return '';
    return '最近对话上下文：\n' + aiConversationMessages.slice(-8).map(message => {
        const role = message.role === 'user' ? '用户' : 'AI';
        return `${role}：${message.content}`;
    }).join('\n\n');
}

function getSystemQAConversationHistory() {
    return aiConversationMessages
        .slice(-8)
        .map(message => ({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: String(message.content || '').slice(0, 800)
        }));
}

function fillSystemQAQuestion(text) {
    const input = document.getElementById('agentInput');
    if (!input) return;
    input.value = text;
    autoResizeSystemQAInput(input);
    input.focus();
}

function openBusinessReviewFromDashboard() {
    const reviewQuestion = '帮我生成本周经营复盘，重点看课消、欠费、待续费、意向跟进和需要关注的学生。';
    switchTab('ai-workspace');
    setTimeout(() => {
        if (!document.getElementById('agentInput')) renderAIWorkspace();
        startSystemQAConversation();
        setSystemQAAnswerLength('detailed');
        const lengthSelect = document.getElementById('systemQAAnswerLength');
        if (lengthSelect) lengthSelect.value = 'detailed';
        fillSystemQAQuestion(reviewQuestion);
        runAgentTask();
    }, 80);
}

function toggleSystemQANameMode() {
    const checked = document.getElementById('systemQANameToggle')?.checked;
    aiPrivacyMode = checked ? 'named' : 'masked';
}

function startSystemQAConversation() {
    const conversation = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    systemQAConversations.unshift(conversation);
    currentSystemQAConversationId = conversation.id;
    aiConversationMessages = conversation.messages;
    renderSystemQAConversation();
    renderSystemQAHistory();
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '暂无回答。';
    const taskInfo = document.getElementById('taskRecordInfo');
    if (taskInfo) taskInfo.style.display = 'none';
    saveSystemQAConversations();
    showToast('已开始新对话');
}

function refreshSystemQAData() {
    loadAIStatus();
    showToast('已刷新 AI 状态；下次提问会读取最新系统数据');
}

function showSystemQACapabilities() {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = 'AI 对话现在能查什么';
    bodyEl.innerHTML = `
        <div class="system-qa-capability-modal">
            <div class="system-qa-capability-note">AI 对话第一优先级是查准系统数据。命中下列问题时，会直接用后端计算出的事实回答，不让模型自由猜。</div>
            <div class="system-qa-capability-grid">
                <div><strong>学员</strong><span>人数、名单、年级、状态、学校、班级、课时、欠费、首次上课年级</span></div>
                <div><strong>成绩</strong><span>满分、100 分、不及格、高于/低于某分、某学生成绩、按测试名称筛选</span></div>
                <div><strong>班级</strong><span>班级数量、班级成员、上课时间、课次进度、按班级分组</span></div>
                <div><strong>收费</strong><span>欠费、待收款、补缴费用、课时不足、无收费记录风险</span></div>
                <div><strong>考勤/课消</strong><span>本月、上月、指定月份课消，个人出勤/请假统计</span></div>
                <div><strong>资料库</strong><span>已导入资料摘要和原文。未导入 Obsidian 文件、只有路径的资料不会被当作正文。</span></div>
            </div>
            <div class="system-qa-capability-note">不能做的事：AI 对话不会直接新增、修改、删除、发送任何业务数据；联网失败或资料不足时会提示，不应凭空整理。</div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        </div>
    `;
    modal.classList.add('show');
}

function clearSystemQAInput() {
    const input = document.getElementById('agentInput');
    if (input) {
        input.value = '';
        autoResizeSystemQAInput(input);
    }
}

function handleSystemQAKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        runAgentTask();
    }
}

function autoResizeSystemQAInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 160);
    input.style.height = `${Math.max(nextHeight, 42)}px`;
    input.style.overflowY = input.scrollHeight > 160 ? 'auto' : 'hidden';
}

function toggleSystemQAHelp() {
    const help = document.getElementById('systemQAHelp');
    if (!help) return;
    help.style.display = help.style.display === 'none' ? 'block' : 'none';
}

function openSystemQAFullInput() {
    const input = document.getElementById('agentInput');
    const currentValue = input?.value || '';
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = '全屏输入';
    bodyEl.innerHTML = `
        <div class="system-qa-full-input-modal">
            <textarea id="systemQAFullInput" class="system-qa-full-textarea" placeholder="可以在这里粘贴长问题、复杂需求或多行内容。Enter 换行，Cmd/Ctrl + Enter 发送。" onkeydown="handleSystemQAFullInputKeydown(event)">${escapeHtml(currentValue)}</textarea>
            <div class="system-qa-full-tip">全屏输入里 Enter 默认换行；需要发送时点击“发送给 AI”，或按 Cmd/Ctrl + Enter。</div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-secondary" onclick="clearSystemQAFullInput()">清空</button>
                <button type="button" class="btn btn-primary" onclick="sendSystemQAFullInput()">发送给 AI</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
    setTimeout(() => document.getElementById('systemQAFullInput')?.focus(), 30);
}

function clearSystemQAFullInput() {
    const input = document.getElementById('systemQAFullInput');
    if (input) input.value = '';
}

function sendSystemQAFullInput() {
    const fullInput = document.getElementById('systemQAFullInput');
    const mainInput = document.getElementById('agentInput');
    const value = fullInput?.value.trim() || '';
    if (!value) {
        showToast('请输入想问的问题');
        return;
    }
    if (mainInput) {
        mainInput.value = value;
        autoResizeSystemQAInput(mainInput);
    }
    closeModal();
    runAgentTask();
}

function handleSystemQAFullInputKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        sendSystemQAFullInput();
    }
}

function toggleAISourceScope(key, checked) {
    aiSourceScope = {
        ...aiSourceScope,
        [key]: Boolean(checked)
    };
    if (!aiSourceScope.systemData && !aiSourceScope.knowledgeBase && !aiSourceScope.webSearch) {
        aiSourceScope.systemData = true;
        const systemInput = document.getElementById('sourceSystemData');
        if (systemInput) systemInput.checked = true;
        showToast('至少保留一个回答依据');
    }
}

function runAgentTask() {
    const inputEl = document.getElementById('agentInput');
    const output = document.getElementById('agentOutput');
    const btn = document.getElementById('generateBtn');
    const question = inputEl?.value.trim() || '';
    if (!question) {
        showToast('请输入想问的问题');
        return;
    }

    currentAgentId = 'system-agent';
    currentTaskType = 'system-qa';
    currentTaskLabel = '系统数据问答';
    const conversationHistory = getSystemQAConversationHistory();
    aiConversationMessages.push({ role: 'user', content: question, createdAt: new Date().toISOString() });
    syncCurrentSystemQAConversation();
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
    if (inputEl) inputEl.value = '';
    if (inputEl) autoResizeSystemQAInput(inputEl);
    if (btn) { btn.disabled = true; btn.textContent = '查询中...'; }
    if (output) output.innerHTML = '<div class="ai-output-placeholder">正在读取系统数据并回答...</div>';

    fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agent: 'system-agent',
            task: 'system-qa',
            modelProvider: selectedSystemQAModelProvider,
            answerLength: selectedSystemQAAnswerLength,
            privacyMode: aiPrivacyMode,
            sourceScope: aiSourceScope,
            latestQuestion: question,
            conversationHistory,
            userInstruction: question,
            fallbackOnError: true
        })
    })
    .then(async res => {
        const parsed = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parsed.error || parsed.message || 'AI 请求失败');
        return parsed;
    })
    .then(response => {
        const answer = response.result || '';
        aiConversationMessages.push({
            role: 'assistant',
            content: answer,
            createdAt: response.generatedAt || new Date().toISOString(),
            meta: {
                taskId: response.taskId || '',
                mode: response.mode || '',
                provider: response.provider || selectedSystemQAModelProvider,
                answerLength: response.answerLength || selectedSystemQAAnswerLength,
                sourceScope: response.sourceScope || { ...aiSourceScope },
                queryFactKeys: response.queryFactKeys || [],
                contextRefsCount: Array.isArray(response.contextRefs) ? response.contextRefs.length : 0,
                contextSize: response.contextSize || 0,
                elapsedMs: response.elapsedMs || 0,
                generatedAt: response.generatedAt || new Date().toISOString()
            }
        });
        aiConversationMessages = aiConversationMessages.slice(-20);
        syncCurrentSystemQAConversation();
        renderSystemQAConversation();
        renderSystemQAHistory();
        saveSystemQAConversations();
        lastTaskId = response.taskId || '';
        lastTaskMode = response.mode || '';
        lastTaskProvider = response.provider || '';
        if (output) output.innerHTML = `${renderAIRunStatus(response)}<div class="ai-output-text">${renderMarkdown(answer)}</div>`;
        renderContextRefs(response.contextRefs || [], response.mode);
        updateTaskRecordInfo();
        showToast('已根据当前系统数据回答');
    })
    .catch(error => {
        const message = error.message || '查询失败';
        aiConversationMessages.push({
            role: 'assistant',
            content: `查询失败：${message}`,
            createdAt: new Date().toISOString(),
            meta: {
                mode: 'failed',
                provider: selectedSystemQAModelProvider,
                answerLength: selectedSystemQAAnswerLength,
                sourceScope: { ...aiSourceScope },
                generatedAt: new Date().toISOString()
            }
        });
        syncCurrentSystemQAConversation();
        renderSystemQAConversation();
        renderSystemQAHistory();
        saveSystemQAConversations();
        if (output) output.innerHTML = `<div class="ai-output-placeholder">查询失败：${escapeHtml(message)}</div>`;
        showToast('AI 查询失败');
    })
    .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = '发送'; }
    });
}

function copyAgentOutput() {
    const latestAnswer = [...aiConversationMessages].reverse().find(item => item.role === 'assistant' && item.content);
    if (latestAnswer?.content) {
        navigator.clipboard.writeText(latestAnswer.content).then(() => showToast('已复制最新回答')).catch(() => showToast('复制失败'));
        return;
    }
    const output = document.getElementById('agentOutput');
    const text = output?.innerText || '';
    if (!text || text.includes('暂无回答')) {
        showToast('暂无可复制内容');
        return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== 外部跳转 ==========
let currentRelatedType = '';
let currentRelatedId = '';

function jumpToAIAgent(agentId, taskType, relatedType, relatedId) {
    switchTab('ai-workspace');
    setTimeout(() => {
        if (relatedType) currentRelatedType = relatedType;
        if (relatedId) currentRelatedId = relatedId;
        if (agentId) {
            let centerId = 'operations';
            if (agentId === 'learning-agent') centerId = 'operations';
            else if (agentId === 'recruit-agent') centerId = 'content';
            else if (agentId === 'teaching-agent') centerId = 'question-bank';
            else if (agentId === 'biz-agent') centerId = 'content';
            selectWorkCenter(centerId);
        }
        if (taskType) {
            setTimeout(() => {
                selectTask(taskType, agentId, '');
                updateRelatedHint();
            }, 50);
        }
    }, 50);
}

function updateRelatedHint() {
    const hintEl = document.getElementById('relatedObjectHint');
    if (!hintEl) return;
    if (!currentRelatedType || !currentRelatedId) { hintEl.style.display = 'none'; return; }
    const typeLabel = currentRelatedType === 'student' ? '学员' : currentRelatedType === 'prospect' ? '意向学员' : currentRelatedType;
    hintEl.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">📌 已关联: ${escapeHtml(typeLabel)} (ID: ${escapeHtml(currentRelatedId)})</span>`;
    hintEl.style.display = 'block';
}

function clearRelatedHint() {
    currentRelatedType = '';
    currentRelatedId = '';
    const hintEl = document.getElementById('relatedObjectHint');
    if (hintEl) hintEl.style.display = 'none';
}

window.jumpToAIAgent = jumpToAIAgent;
window.selectWorkCenter = selectWorkCenter;
window.selectTask = selectTask;
window.toggleMoreTasks = toggleMoreTasks;
window.runAgentTask = runAgentTask;
window.clearAgentInput = clearAgentInput;
window.clearAgentOutput = clearAgentOutput;
window.copyAgentOutput = copyAgentOutput;
window.copyAgentPlainText = copyAgentPlainText;
window.saveToDrafts = saveToDrafts;
window.addToTodo = addToTodo;
window.regenerateResult = regenerateResult;
window.refreshDrafts = refreshDrafts;
window.refreshAITasks = refreshAITasks;
window.refreshAgentLogs = refreshAgentLogs;
window.openStyleSettings = openStyleSettings;
window.toggleSnapshot = toggleSnapshot;
window.switchRightTab = switchRightTab;
window.fillSystemQAQuestion = fillSystemQAQuestion;
window.openBusinessReviewFromDashboard = openBusinessReviewFromDashboard;
window.startSystemQAConversation = startSystemQAConversation;
window.refreshSystemQAData = refreshSystemQAData;
window.clearSystemQAInput = clearSystemQAInput;
window.toggleSystemQANameMode = toggleSystemQANameMode;
window.handleSystemQAKeydown = handleSystemQAKeydown;
window.switchSystemQAConversation = switchSystemQAConversation;
window.autoResizeSystemQAInput = autoResizeSystemQAInput;
window.toggleSystemQAHelp = toggleSystemQAHelp;
window.openSystemQAFullInput = openSystemQAFullInput;
window.clearSystemQAFullInput = clearSystemQAFullInput;
window.sendSystemQAFullInput = sendSystemQAFullInput;
window.handleSystemQAFullInputKeydown = handleSystemQAFullInputKeydown;
window.addSystemQAPrompt = addSystemQAPrompt;
window.editSystemQAPrompt = editSystemQAPrompt;
window.deleteSystemQAPrompt = deleteSystemQAPrompt;
window.restoreDefaultSystemQAPrompts = restoreDefaultSystemQAPrompts;
window.toggleSystemQAPromptManageMode = toggleSystemQAPromptManageMode;
window.toggleSystemQAConversationPin = toggleSystemQAConversationPin;
window.deleteSystemQAConversation = deleteSystemQAConversation;
window.toggleSystemQAHistoryMenu = toggleSystemQAHistoryMenu;
window.pinSystemQAConversationFromMenu = pinSystemQAConversationFromMenu;
window.deleteSystemQAConversationFromMenu = deleteSystemQAConversationFromMenu;
window.toggleSystemQAHistoryBatchMode = toggleSystemQAHistoryBatchMode;
window.toggleSystemQAHistorySelection = toggleSystemQAHistorySelection;
window.selectAllSystemQAHistory = selectAllSystemQAHistory;
window.deleteSelectedSystemQAConversations = deleteSelectedSystemQAConversations;
window.toggleAISourceScope = toggleAISourceScope;
window.setSystemQAModelProvider = setSystemQAModelProvider;
window.setSystemQAAnswerLength = setSystemQAAnswerLength;

if (!window.__systemQAHistoryMenuClickBound) {
    window.__systemQAHistoryMenuClickBound = true;
    document.addEventListener('click', event => {
        if (!openSystemQAHistoryMenuId) return;
        if (event.target.closest?.('.system-qa-history-menu-wrap')) return;
        openSystemQAHistoryMenuId = '';
        renderSystemQAHistory();
    });
}
