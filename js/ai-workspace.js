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

// ========== Markdown 安全渲染 ==========
function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto;margin:8px 0;font-size:12px;line-height:1.4;"><code>$1</code></pre>');
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:var(--text-primary);">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin:14px 0 8px;font-size:16px;font-weight:600;color:var(--text-primary);">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 style="margin:16px 0 10px;font-size:18px;font-weight:600;color:var(--text-primary);">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:disc;">$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0 4px 16px;list-style:decimal;">$2</li>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul style="margin:8px 0;padding-left:0;">$&</ul>');
    return html;
}

// ========== AI 状态加载 ==========
function loadAIStatus() {
    fetch('/api/ai/status')
        .then(res => res.json())
        .then(info => { updateAIStatusUI(info); })
        .catch(() => { updateAIStatusUI({ mode: 'local-template', enabled: false }); });
}

function updateAIStatusUI(info) {
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

                    <!-- 任务描述 -->
                    <div class="ai-form-group">
                        <label class="ai-form-label">任务描述 / 补充说明
                            <button class="btn btn-secondary btn-xs" onclick="toggleAdvancedOptions()" style="margin-left:8px;">高级选项</button>
                            <button class="btn btn-secondary btn-xs" onclick="fillExampleInput()" style="margin-left:4px;">填入示例</button>
                        </label>
                        <textarea id="agentInput" rows="5" placeholder="选择任务卡片后在此输入具体需求..." class="ai-form-textarea" style="resize:vertical;"></textarea>
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
                        <button class="btn btn-primary" id="generateBtn" onclick="runAgentTask()">生成结果</button>
                        <button class="btn btn-secondary" onclick="previewContextRefs()">🔍 预览引用</button>
                        <button class="btn btn-secondary" onclick="clearAgentInput()">清空输入</button>
                        <button class="btn btn-secondary" onclick="clearAgentOutput()">清空</button>
                    </div>

                    <!-- 输出区 -->
                    <div class="ai-output-area">
                        <div id="aiWarnings" class="ai-warnings" style="display:none;"></div>
                        <div class="ai-output-header">
                            <span class="ai-output-label">生成结果</span>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <span id="outputPrivacyTag" style="font-size:11px;color:var(--text-muted);"></span>
                                <button class="btn btn-secondary btn-xs" onclick="copyAgentOutput()">复制全文</button>
                            </div>
                        </div>
                        <div id="agentOutput" class="ai-output-content">
选择左侧任务卡片或输入需求，点击「生成结果」查看输出。
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
                                <option value="content">内容</option>
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
    if (centerId === 'content') {
        contentModeGroup.style.display = 'block';
        document.getElementById('contentModeSelect').value = '';
    } else {
        contentModeGroup.style.display = 'none';
    }

    // 清空输出
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择左侧任务卡片或输入需求，点击「生成结果」查看输出。';
    document.getElementById('outputActions').style.display = 'none';
    document.getElementById('advancedOptionsArea').style.display = 'none';
    document.getElementById('noTaskWarning').style.display = 'none';
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
        'question-bank-plan': '年级：六年级\n章节：小升初综合\n知识点：分数、比例、行程、几何',
        'resource-brief': '资料方向：2026武汉小升初政策变化',
        'research-plan': '资料主题：初中数学竞赛入门',
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
        <div class="ai-data-range-item"><span class="ai-data-range-key">隐私模式</span><span class="ai-data-range-val">${aiPrivacyMode === 'named' ? '带姓名（已脱敏）' : '脱敏生成'}</span></div>
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

    const taskNames = getTaskNames();
    const agentNames = { 'admin-agent': '教务 Agent', 'learning-agent': '学情沟通 Agent', 'recruit-agent': '招生跟进 Agent', 'teaching-agent': '教研 Agent', 'biz-agent': '经营分析 Agent' };

    const forceMaskedAgents = ['teaching-agent', 'biz-agent'];
    if (aiPrivacyMode === 'named' && !forceMaskedAgents.includes(currentAgentId)) {
        showPrivacyConfirm(() => doRunAgentTask(input, agentNames, taskNames));
        return;
    }
    doRunAgentTask(input, agentNames, taskNames);
}

function doRunAgentTask(input, agentNames, taskNames) {
    const output = document.getElementById('agentOutput');
    const btn = document.getElementById('generateBtn');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }

    const advancedText = collectAdvancedOptions();
    const styleNote = getStyleNote();
    const contentModeNote = getContentModeNote();
    const finalInput = [input, advancedText, contentModeNote, styleNote].filter(Boolean).join('\n\n');

    const payload = {
        agent: currentAgentId,
        task: currentTaskType,
        privacyMode: aiPrivacyMode,
        userInstruction: finalInput,
        relatedType: currentRelatedType,
        relatedId: currentRelatedId,
    };

    fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => { if (!res.ok) throw new Error('API 请求失败'); return res.json(); })
    .then(response => {
        clearTimeout(window._aiGenerateTimeout);
        lastTaskId = response.taskId || '';
        lastTaskMode = response.mode || 'local-template';
        lastTaskProvider = response.provider || '';
        updateTaskRecordInfo();

        const warningsEl = document.getElementById('aiWarnings');
        if (warningsEl) {
            warningsEl.innerHTML = response.warnings?.map(w => `<span>⚠️ ${escapeHtml(w)}</span>`).join('') || '';
            warningsEl.style.display = response.warnings?.length > 0 ? 'block' : 'none';
        }

        const hasContextRefs = response.contextRefs && response.contextRefs.length > 0;
        const modeNote = response.mode === 'real-ai'
            ? `<div style="font-size:12px;margin-bottom:8px;">
                <span style="color:#27ae60;">✅ 真实 AI</span>
                <span style="color:${hasContextRefs ? '#27ae60' : '#f39c12'};margin-left:8px;">· ${hasContextRefs ? '已引用知识库' : '未引用知识库'}</span>
               </div>`
            : '<div style="font-size:12px;color:#888;margin-bottom:8px;">📋 本次由本地模板生成，真实 AI 尚未启用。</div>';
        output.innerHTML = `<div class="ai-output-text">${renderMarkdown(response.result || '')}</div>${modeNote}`;

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
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">接口调用失败，已回退本地模板</div>
<div style="color:var(--text-muted);">${escapeHtml(err.message || '生成失败')}</div>
</div>`;
        showToast('生成失败，已回退本地模板');
    })
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = '生成结果'; } });

    window._aiGenerateTimeout = setTimeout(() => {
        const btn = document.getElementById('generateBtn');
        if (btn && !btn.disabled) return;
        if (btn) { btn.disabled = true; btn.textContent = '生成较慢，请稍后...'; }
        output.innerHTML = `<div class="ai-output-placeholder">
<div style="font-size:24px;margin-bottom:8px;">⏳</div>
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">生成时间较长</div>
<div style="color:var(--text-muted);">超过30秒未返回结果，请稍后重试或使用本地模板。</div>
</div>`;
        showToast('生成超时，可稍后重试');
    }, 30000);
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
    const input = document.getElementById('agentInput');
    if (input) input.value = '';
    runAgentTask();
}

function copyAgentPlainText() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const text = output.innerText || '';
    if (!text || text.includes('选择左侧任务卡片')) { showToast('暂无可复制内容'); return; }
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
        const centerBadge = draft.center ? `<span style="background:#3498db;color:white;padding:1px 4px;border-radius:3px;font-size:9px;margin-left:4px;">${WORK_CENTERS[draft.center]?.name || draft.center}</span>` : '';
        return `<div class="ai-log-item" style="padding:8px 0;border-bottom:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:12px;font-weight:600;">${escapeHtml(draft.title || draft.task)}${centerBadge}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${time} · ${modeTag}</div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="continueFromDraft('${draft.id}')">继续</button>
                    <button class="btn btn-secondary btn-xs" onclick="copyDraft('${draft.id}')">复制</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteDraft('${draft.id}')">删除</button>
                </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml((draft.content || '').substring(0, 80))}</div>
        </div>`;
    }).join('');
}

function filterDrafts() {
    const search = document.getElementById('draftSearchInput')?.value?.toLowerCase() || '';
    const centerFilter = document.getElementById('draftCenterFilter')?.value || '';
    try {
        let drafts = JSON.parse(localStorage.getItem('ai_drafts') || '[]');
        if (search) drafts = drafts.filter(d => (d.title || '').toLowerCase().includes(search) || (d.content || '').toLowerCase().includes(search));
        if (centerFilter) drafts = drafts.filter(d => d.center === centerFilter);
        renderDrafts(drafts);
    } catch (e) { renderDrafts([]); }
}

function saveToDrafts() {
    const output = document.getElementById('agentOutput');
    if (!output) return;
    const content = output.innerText || '';
    if (!content || content.includes('选择左侧任务卡片')) { showToast('暂无可保存内容'); return; }

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
            const input = document.getElementById('agentInput');
            if (input) input.value = draft.content.substring(0, 500);
            showToast('已填入输入框，可继续编辑');
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
    if (!content || content.includes('选择左侧任务卡片')) { showToast('暂无可加入待办的内容'); return; }

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
        .then(logs => { renderAgentLogsFromServer(logs); })
        .catch(() => {});
}

function renderAgentLogsFromServer(logs) {
    const logArea = document.getElementById('agentLogArea');
    if (!logArea) return;
    if (!logs || logs.length === 0) { logArea.innerHTML = '<div class="ai-log-empty">暂无 Agent 调用记录</div>'; return; }
    logArea.innerHTML = logs.slice(0, 20).map(log => {
        const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const mode = log.mode === 'real-ai' ? '<span style="color:#27ae60;">真实 AI</span>' : '<span style="color:#888;">本地模板</span>';
        const success = log.success !== false;
        const statusBadge = success ? '<span style="color:#27ae60;font-size:11px;font-weight:600;">成功</span>' : '<span style="color:#e74c3c;font-size:11px;font-weight:600;">失败</span>';
        return `<div class="ai-log-item" style="margin-bottom:4px;padding:4px 0;border-bottom:1px solid var(--border-color);">[${time}] ${escapeHtml(log.agent || '')} · ${escapeHtml(log.action || '')} · ${mode} · ${statusBadge}</div>`;
    }).join('');
}

function refreshAgentLogs() { loadAgentLogsFromServer(); showToast('日志已刷新'); }

function loadAITasksFromServer() {
    fetch('/api/ai/tasks')
        .then(res => res.json())
        .then(tasks => { renderAITasksList(tasks); })
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
        const mode = task.mode === 'real-ai' ? '<span style="color:#27ae60;font-size:11px;">真实 AI</span>' : '<span style="color:#888;font-size:11px;">本地模板</span>';
        return `<div class="ai-log-item">[${time}] ${escapeHtml(title)} · ${statusBadge} · ${mode}</div>`;
    }).join('');
}

function refreshAITasks() { loadAITasksFromServer(); showToast('记录已刷新'); }

function clearAgentOutput() {
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择左侧任务卡片或输入需求，点击「生成结果」查看输出。';
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
    if (!text || text.includes('选择左侧任务卡片')) { showToast('暂无可复制内容'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== 上下文引用 ==========
function renderContextRefs(contextRefs, mode) {
    const area = document.getElementById('contextRefsArea');
    const content = document.getElementById('contextRefsContent');
    if (!area || !content) return;

    if (!contextRefs || contextRefs.length === 0) {
        area.style.display = 'block';
        content.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">本次未引用知识库资料，仅使用当前输入和业务数据。</div>';
        return;
    }

    const typeLabels = {
        'style': '风格规则',
        'style-sample': '风格样本',
        'source': '资料',
        'question': '题库'
    };

    const grouped = {};
    contextRefs.forEach(ref => {
        const type = ref.refType || ref.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(ref);
    });

    let html = '';
    Object.entries(grouped).forEach(([type, refs]) => {
        const label = typeLabels[type] || type;
        html += `<div style="margin-bottom:10px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;font-weight:600;">📂 ${escapeHtml(label)}（${refs.length}条）</div>`;
        refs.forEach((ref, idx) => {
            const refId = `ctx-ref-${type}-${idx}`;
            const titleText = escapeHtml(ref.title || ref.name || '未命名');
            const summaryText = ref.summary ? escapeHtml(ref.summary) : '';
            const hasLongContent = summaryText.length > 80;

            html += `<div style="font-size:12px;padding:6px 8px;background:var(--card-bg);border-radius:4px;margin-bottom:4px;">
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:2px;">${titleText}</div>
                ${summaryText ? `<div style="font-size:11px;color:var(--text-muted);line-height:1.4;">${hasLongContent ? summaryText.substring(0, 80) + '...' : summaryText}</div>` : ''}
            </div>`;
        });
        html += '</div>';
    });

    content.innerHTML = html;
    area.style.display = 'block';
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
        userInstruction: input || '(空)',
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

        if (!data.refs || data.refs.length === 0) {
            html += `<div style="text-align:center;padding:24px;color:var(--text-muted);">
                <div style="font-size:32px;margin-bottom:8px;">📭</div>
                <div style="font-size:13px;">知识库暂无可引用资料</div>
                <div style="font-size:12px;margin-top:4px;">可先到知识库录入风格样本或资料</div>
            </div>`;
        } else {
            const grouped = {};
            data.refs.forEach(ref => {
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