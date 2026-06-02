// ==================== AI 工作台 ====================

let currentAgentId = 'admin-agent';
let agentLogs = [];

// 全局隐私模式状态
let aiPrivacyMode = 'masked'; // 'masked' | 'named'
let aiPrivacyModeLocked = false; // 当全局隐私开启时锁定为脱敏

// 当前任务信息（用于显示）
let lastTaskId = '';
let lastTaskMode = '';
let lastTaskProvider = '';

// ========== 姓名脱敏 ==========

// ========== AI 状态加载 ==========
function loadAIStatus() {
    fetch('/api/ai/status')
        .then(res => res.json())
        .then(info => {
            updateAIStatusUI(info);
        })
        .catch(() => {
            // 接口失败时回退为本地模板
            updateAIStatusUI({ mode: 'local-template', enabled: false });
        });
}

function updateAIStatusUI(info) {
    const statusEl = document.getElementById('agentStatus');
    const modeLabelEl = document.getElementById('aiModeLabel');
    if (!statusEl || !modeLabelEl) return;

    if (info.mode === 'real-ai' && info.enabled) {
        statusEl.textContent = '真实 AI';
        statusEl.style.background = '#27ae60';
        modeLabelEl.textContent = info.provider ? `已启用 · ${info.provider}` : '已启用';
    } else if (info.mode === 'local-template') {
        statusEl.textContent = '本地模板';
        statusEl.style.background = '#95a5a6';
        modeLabelEl.textContent = info.enabled === false ? '真实 AI 未配置' : '本地模板模式';
    } else {
        statusEl.textContent = '本地模板';
        statusEl.style.background = '#95a5a6';
        modeLabelEl.textContent = '未接入真实 AI';
    }
}

// ========== 数据感知函数 ==========
function getAIWorkspaceSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const activeStudents = (data.students || []).filter(s => s.status === 'active');
    const pendingRenewal = (data.students || []).filter(s => s.status === 'renewalPending');
    const prospects = data.prospects || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const communications = data.communications || [];

    const activeStudentCount = activeStudents.length;
    const pendingRenewalCount = pendingRenewal.length;
    const prospectCount = prospects.length;

    const unpaidFees = fees.filter(f => f.status === 'pending');
    const unpaidCount = unpaidFees.length;
    const unpaidAmount = unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0);

    let monthConsumedHours = 0;
    attendance.forEach(session => {
        const sessionDate = session.date || '';
        if (sessionDate >= `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`) {
            const records = session.records || {};
            Object.values(records).forEach(v => { if (v === 1) monthConsumedHours++; });
        }
    });

    const recentComms = communications.filter(c => c.contactDate && c.contactDate >= weekAgo);
    const recentCommCount = recentComms.length;

    return {
        activeStudentCount: activeStudentCount || 0,
        pendingRenewalCount: pendingRenewalCount || 0,
        prospectCount: prospectCount || 0,
        unpaidCount: unpaidCount || 0,
        unpaidAmount: unpaidAmount || 0,
        monthConsumedHours: monthConsumedHours || 0,
        recentCommCount: recentCommCount || 0,
    };
}

// ========== 首页工作台数据（dashboard 用）==========
function getTodayWorkSummary() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const attendance = data.attendance || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const prospects = data.prospects || [];

    // 今日课次
    const todaySessions = attendance.filter(a => a.date === today);
    const todaySessionCount = todaySessions.length;

    // 待续费
    const pendingRenewal = students.filter(s => s.status === 'renewalPending').length;
    const unpaidCount = fees.filter(f => f.status === 'pending').length;

    // 意向学员待跟进
    const pendingProspects = prospects.filter(p =>
        p.trialStatus === 'pending' || p.trialStatus === 'contacted'
    ).length;

    return { todaySessionCount, pendingRenewal, unpaidCount, pendingProspects };
}

// ========== 渲染 AI 工作台 ==========
function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    const summary = getAIWorkspaceSummary();

    container.innerHTML = `
        <div class="ai-workspace-layout">
            <!-- 左侧：Agent 列表 -->
            <div class="card ai-agent-sidebar">
                <div class="ai-agent-sidebar-header">AI Agent</div>
                <div id="agentList">
                    ${renderAgentItem('admin-agent', '教务 Agent', '处理排课、调课、考勤异常等教务工作', true)}
                    ${renderAgentItem('learning-agent', '学情沟通 Agent', '生成学情反馈、续费沟通话术', false)}
                    ${renderAgentItem('recruit-agent', '招生跟进 Agent', '处理试听转化、朋友圈内容生成', false)}
                    ${renderAgentItem('teaching-agent', '教研 Agent', '生成教案、习题推荐、学习路径规划', false)}
                    ${renderAgentItem('biz-agent', '经营分析 Agent', '生成本周经营周报、课消分析', false)}
                </div>
            </div>

            <!-- 右侧：工作区 -->
            <div class="ai-workspace-main">
                <!-- 当前业务快照 -->
                <div class="card ai-snapshot-card">
                    <div class="ai-snapshot-header">
                        <span class="ai-snapshot-title">当前业务快照</span>
                        <span class="ai-snapshot-meta">实时汇总</span>
                    </div>
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
                    <div class="ai-snapshot-footer">
                        <span class="ai-snapshot-comm">近一周沟通</span>
                        <span class="ai-snapshot-comm-num">${getPrivacyVal(summary.recentCommCount)}</span>
                        <span class="ai-snapshot-comm-unit">条</span>
                    </div>
                </div>

                <!-- 当前 Agent 工作区 -->
                <div class="card ai-agent-workspace">
                    <div class="ai-workspace-header">
                        <div>
                            <h3 id="agentTitle" class="ai-agent-name">教务 Agent</h3>
                            <p id="agentDesc" class="ai-agent-desc">处理排课、调课、考勤异常等教务工作</p>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            <span id="agentStatus" class="badge" style="background:#95a5a6;color:white;">本地模板</span>
                            <span id="aiModeLabel" style="font-size:11px;color:var(--text-muted);">未接入真实 AI</span>
                        </div>
                    </div>

                    <div id="agentTaskArea">
                        <div class="ai-form-group">
                            <label class="ai-form-label">任务类型</label>
                            <select id="agentTaskType" onchange="onAgentTaskTypeChange()" class="ai-form-select">
                                <option value="">请选择任务类型</option>
                            </select>
                        </div>

                        <div class="ai-form-group">
                            <label class="ai-form-label">任务描述 / 补充说明</label>
                            <textarea id="agentInput" rows="4" placeholder="描述你的需求，例如：检查六年级培优A班本周考勤异常..." class="ai-form-textarea"></textarea>
                        </div>

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

                        <div id="dataRangeInfo" class="ai-data-range" style="display:none;">
                            <span class="ai-data-range-title">本次读取数据范围</span>
                            <div id="dataRangeContent"></div>
                        </div>

                        <div class="ai-btn-group">
                            <button class="btn btn-primary" onclick="runAgentTask()">生成结果</button>
                            <button class="btn btn-secondary" onclick="clearAgentInput()">清空输入</button>
                            <button class="btn btn-secondary" onclick="clearAgentOutput()">清空</button>
                        </div>

                        <div class="ai-output-area">
                            <div class="ai-output-header">
                                <span class="ai-output-label">生成结果</span>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <span id="outputPrivacyTag" style="font-size:11px;color:var(--text-muted);"></span>
                                    <button class="btn btn-secondary btn-xs" id="copyOutputBtn" onclick="copyAgentOutput()">复制结果</button>
                                </div>
                            </div>
                            <div id="agentOutput" class="ai-output-content">
选择任务类型并填写说明后，点击「生成结果」查看输出。
                            </div>
                            <div id="taskRecordInfo" class="ai-task-record" style="display:none;"></div>
                        </div>
                    </div>
                </div>

                <!-- Agent 日志 -->
                <div class="card ai-log-card">
                    <div class="ai-log-header">
                        <span class="ai-log-title">Agent 日志</span>
                        <button class="btn btn-secondary btn-xs" onclick="refreshAgentLogs()">刷新</button>
                        <button class="btn btn-secondary btn-xs" onclick="clearAgentLogs()">清空</button>
                    </div>
                    <div id="agentLogArea" class="ai-log-content">
                        <div class="ai-log-empty">暂无 Agent 调用记录</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 移动端适配 -->
        <style>
            @media (max-width: 700px) {
                .ai-workspace-layout {
                    grid-template-columns: 1fr !important;
                }
                .ai-agent-sidebar {
                    flex-direction: row !important;
                    overflow-x: auto;
                }
                .ai-agent-sidebar .ai-agent-sidebar-header {
                    writing-mode: horizontal-tb;
                    border-bottom: none;
                    border-right: 1px solid var(--border-color);
                    min-width: 60px;
                    text-align: center;
                }
                #agentList {
                    display: flex;
                    flex-direction: row;
                    overflow-x: auto;
                    gap: 8px;
                    padding: 8px;
                    flex: 1;
                }
                #agentList .agent-item {
                    min-width: 100px;
                    border-left: none !important;
                    border-bottom: 3px solid transparent !important;
                    background: transparent !important;
                }
                #agentList .agent-item.active-mobile {
                    border-bottom-color: #3498db !important;
                    background: var(--hover-bg) !important;
                }
            }
        </style>
    `;

    // Mobile JS adapt
    if (window.innerWidth <= 700) {
        const agentList = document.getElementById('agentList');
        if (agentList) {
            agentList.style.display = 'flex';
            agentList.style.overflowX = 'auto';
            agentList.style.gap = '8px';
            agentList.style.padding = '8px';
            const items = agentList.querySelectorAll('.agent-item');
            items.forEach(item => {
                item.style.minWidth = '100px';
                item.style.borderLeft = 'none';
                item.style.borderBottom = '3px solid transparent';
            });
        }
    }

    // 加载 AI 状态
    loadAIStatus();
    // 加载 Agent 日志
    loadAgentLogsFromServer();
}

function renderAgentItem(id, name, desc, isActive) {
    const activeStyle = isActive
        ? 'background: var(--hover-bg); border-left: 3px solid #3498db;'
        : 'border-left: 3px solid transparent;';
    return `
        <div class="agent-item" onclick="selectAgent('${id}')" data-agent="${id}" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s; ${activeStyle}">
            <div class="agent-item-name">${escapeHtml(name)}</div>
            <div class="agent-item-desc">${escapeHtml(desc)}</div>
        </div>
    `;
}

function selectAgent(agentId) {
    currentAgentId = agentId;
    const agents = {
        'admin-agent': { name: '教务 Agent', desc: '处理排课、调课、考勤异常等教务工作', tasks: [
            { value: 'schedule-conflict', label: '调课冲突检测' },
            { value: 'attendance-anomaly', label: '考勤异常处理' },
            { value: 'class-full-check', label: '班级满班预警' },
            { value: 'renewal-reminder', label: '续费到期提醒' },
        ]},
        'learning-agent': { name: '学情沟通 Agent', desc: '生成学情反馈、续费沟通话术', tasks: [
            { value: 'student-feedback', label: '生成学情反馈' },
            { value: 'renewal-script', label: '生成续费沟通话术' },
            { value: 'parent-greeting', label: '生成家长问候模板' },
        ]},
        'recruit-agent': { name: '招生跟进 Agent', desc: '处理试听转化、跟进话术、招生文案', tasks: [
            { value: 'follow-reminder', label: '意向跟进话术' },
            { value: 'conversion-script', label: '生成转化话术' },
            { value: 'trial-report', label: '生成试听报告' },
            { value: 'moment-content', label: '招生文案', isLater: true },
        ]},
        'teaching-agent': { name: '教研 Agent', desc: '教案、练习题、学习路径', tasks: [
            { value: 'lesson-plan', label: '生成教案', isLater: true },
            { value: 'exercise-recommend', label: '推荐练习题', isLater: true },
            { value: 'learning-path', label: '规划学习路径', isLater: true },
            { value: 'exam-analysis', label: '试卷分析', isLater: true },
        ]},
        'biz-agent': { name: '经营分析 Agent', desc: '生成本周/月经营报告、课消与欠费分析', tasks: [
            { value: 'weekly-report', label: '生成本周经营周报' },
            { value: 'monthly-report', label: '生成本月经营报告' },
            { value: 'class-consumption', label: '班级课消分析' },
            { value: 'tuition-warning', label: '欠费与续费预警汇总' },
        ]},
    };
    const agent = agents[agentId];
    if (!agent) return;

    document.getElementById('agentTitle').textContent = agent.name;
    document.getElementById('agentDesc').textContent = agent.desc;
    document.getElementById('agentStatus').textContent = '本地模板';
    document.getElementById('agentStatus').style.background = '#95a5a6';
    document.getElementById('aiModeLabel').textContent = '未接入真实 AI';

    const taskSelect = document.getElementById('agentTaskType');
    taskSelect.innerHTML = `<option value="">请选择任务类型</option>${agent.tasks.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}`;

    updatePrivacyModeUI();
    updateDataRangeInfo();

    document.querySelectorAll('.agent-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.borderLeft = '3px solid transparent';
        el.classList.remove('active-mobile');
    });
    const selected = document.querySelector(`.agent-item[data-agent="${agentId}"]`);
    if (selected) {
        selected.style.background = 'var(--hover-bg)';
        selected.style.borderLeft = '3px solid #3498db';
        selected.classList.add('active-mobile');
    }

    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择任务类型并填写说明后，点击「生成结果」查看输出。';
}

function onAgentTaskTypeChange() {
    const taskType = document.getElementById('agentTaskType').value;
    const taskPlaceholders = {
        'schedule-conflict': '描述需要检测的班级和时间范围，例如：六年级培优A班本周上课冲突...',
        'attendance-anomaly': '描述考勤异常情况，例如：有哪些学员异常出勤或请假...',
        'class-full-check': '输入班级名称，检查是否有班级接近或达到满班...',
        'renewal-reminder': '输入检查范围，例如：检查未来两周内有哪些学员课时不足...',
        'student-feedback': '选择学员后，描述本次需要反馈的学习内容...',
        'renewal-script': '描述学员情况和续费背景，生成沟通话术...',
        'parent-greeting': '输入节日或主题，生成家长问候模板...',
        'trial-report': '输入试课学员信息和试课表现...',
        'conversion-script': '描述家长顾虑和课程特点，生成针对性话术...',
        'moment-content': '输入今日主题或课程亮点，生成朋友圈招生文案...',
        'follow-reminder': '输入时间范围，检查意向学员跟进情况...',
        'lesson-plan': '输入课程主题、年级、课时数，生成教案...',
        'exercise-recommend': '输入学员年级、薄弱点，推荐练习题...',
        'learning-path': '输入学员当前年级、学习目标，推荐学习路径...',
        'exam-analysis': '输入试卷名称和学员得分，分析薄弱点...',
        'weekly-report': '输入本周日期范围，自动汇总班级情况...',
        'monthly-report': '输入月份，自动生成本月经营报告...',
        'class-consumption': '输入班级名称，分析课消和剩余课时...',
        'tuition-warning': '自动汇总欠费和续费预警学员列表...',
    };
    const input = document.getElementById('agentInput');
    input.placeholder = taskPlaceholders[taskType] || '描述你的需求...';
    updateDataRangeInfo();
}

function updatePrivacyModeUI() {
    const radioMasked = document.querySelector('input[name="aiPrivacyMode"][value="masked"]');
    const radioNamed = document.querySelector('input[name="aiPrivacyMode"][value="named"]');
    if (!radioMasked || !radioNamed) return;

    // 如果是教研 Agent 或经营 Agent，强制脱敏，锁定带姓名选项
    const forceMaskedAgents = ['teaching-agent', 'biz-agent'];
    if (forceMaskedAgents.includes(currentAgentId)) {
        radioMasked.checked = true;
        radioNamed.disabled = true;
        aiPrivacyMode = 'masked';
    } else {
        radioNamed.disabled = false;
        if (aiPrivacyMode === 'named') {
            radioNamed.checked = true;
        } else {
            radioMasked.checked = true;
        }
    }
}

function onPrivacyModeChange() {
    const selected = document.querySelector('input[name="aiPrivacyMode"]:checked');
    aiPrivacyMode = selected ? selected.value : 'masked';
    updateDataRangeInfo();
}

function updateDataRangeInfo() {
    const taskType = document.getElementById('agentTaskType')?.value;
    const rangeInfo = document.getElementById('dataRangeInfo');
    const rangeContent = document.getElementById('dataRangeContent');
    if (!rangeInfo || !rangeContent) return;

    if (!taskType) {
        rangeInfo.style.display = 'none';
        return;
    }

    const agentNames = {
        'admin-agent': '教务 Agent',
        'learning-agent': '学情沟通 Agent',
        'recruit-agent': '招生跟进 Agent',
        'teaching-agent': '教研 Agent',
        'biz-agent': '经营分析 Agent',
    };

    const taskNames = {
        'schedule-conflict': '调课冲突检测',
        'attendance-anomaly': '考勤异常处理',
        'class-full-check': '班级满班预警',
        'renewal-reminder': '续费到期提醒',
        'student-feedback': '生成学情反馈',
        'renewal-script': '生成续费沟通话术',
        'parent-greeting': '生成家长问候模板',
        'trial-report': '生成试听报告',
        'conversion-script': '生成转化话术',
        'moment-content': '生成朋友圈招生文案',
        'follow-reminder': '意向学员跟进提醒',
        'lesson-plan': '生成教案',
        'exercise-recommend': '推荐练习题',
        'learning-path': '规划学习路径',
        'exam-analysis': '试卷分析',
        'weekly-report': '生成本周经营周报',
        'monthly-report': '生成本月经营报告',
        'class-consumption': '班级课消分析',
        'tuition-warning': '欠费与续费预警汇总',
    };

    const range = taskDescriptions[taskType] || '未定义';
    const isNamed = aiPrivacyMode === 'named';

    rangeContent.innerHTML = `
        <div class="ai-data-range-item"><span class="ai-data-range-key">当前 Agent</span><span class="ai-data-range-val">${agentNames[currentAgentId] || ''}</span></div>
        <div class="ai-data-range-item"><span class="ai-data-range-key">当前任务</span><span class="ai-data-range-val">${taskNames[taskType] || ''}</span></div>
        <div class="ai-data-range-item"><span class="ai-data-range-key">读取范围</span><span class="ai-data-range-val">${escapeHtml(range)}</span></div>
        <div class="ai-data-range-item"><span class="ai-data-range-key">隐私模式</span><span class="ai-data-range-val">${isNamed ? '带姓名（已脱敏）' : '脱敏生成'}</span></div>
        <div class="ai-data-range-note">不会读取电话/微信/学校等敏感字段</div>
    `;
    rangeInfo.style.display = 'block';
}

function showPrivacyConfirm(callback) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = '确认带姓名生成';
    bodyEl.innerHTML = `
        <div style="padding: 16px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
            <div style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px;">
                本次将带入学员姓名用于生成文本。
            </div>
            <div style="font-size: 13px; color: var(--text-secondary);">
                系统不会自动修改任何数据。<br>生成内容需要您确认后使用。
            </div>
            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: center;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="executePrivacyConfirm()">继续</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    window._pendingPrivacyCallback = callback;
}

function executePrivacyConfirm() {
    closeModal();
    if (typeof window._pendingPrivacyCallback === 'function') {
        window._pendingPrivacyCallback();
    }
}

// ========== 本地占位内容生成 ==========

function generateAdminAgentContent(taskType, input) {
    const classes = data.classes || [];
    const students = data.students || [];
    const attendance = data.attendance || [];
    const fees = data.fees || [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (taskType === 'schedule-conflict') {
        const inputClass = input.trim();
        let targetClasses = classes.filter(c => c.status === 'active');
        if (inputClass) {
            targetClasses = targetClasses.filter(c => c.name.includes(inputClass));
        }
        if (targetClasses.length === 0) return '未找到相关班级，请检查输入。\n\n当前为本地规则生成，后续接入 AI 后可进行更精准的冲突检测。';

        return `【本地规则】调课冲突检测
━━━━━━━━━━━━━━━━━━
检测范围：${inputClass || '全部在读班级'}
班级数量：${getPrivacyVal(targetClasses.length)} 个

【班级上课时间】
${targetClasses.slice(0, 8).map(c => `• ${c.name}：${c.schedule || '未设置'}`).join('\n') || '暂无班级'}

【冲突检测结果】
未检测到明显时间冲突（本地规则，仅检测同日期同时段）。

【建议】
• 调课前检查两个班级的时间是否重叠
• 确认调课日期学员无其他班级课程

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可结合学员课表进行智能冲突检测。`;
    }

    if (taskType === 'attendance-anomaly') {
        const todaySessions = attendance.filter(a => a.date === today);
        const allStudents = students.filter(s => s.status === 'active');

        let anomalyCount = 0;
        const anomalies = [];
        todaySessions.forEach(session => {
            const cls = classes.find(c => c.id === session.classId);
            const records = session.records || {};
            allStudents.forEach(s => {
                if (s.classId === session.classId && records[s.id] == null) {
                    anomalyCount++;
                    anomalies.push({ student: maskStudentName(s.name), class: cls?.name || '未知班级' });
                }
            });
        });

        return `【本地规则】考勤异常处理
━━━━━━━━━━━━━━━━━━
日期：${today}
今日课次：${getPrivacyVal(todaySessions.length)}

【考勤异常情况】
${anomalyCount === 0 ? '未检测到明显考勤异常。' : `共发现 ${getPrivacyVal(anomalyCount)} 条未录入考勤的学员：\n${anomalies.slice(0, 10).map(a => `• ${a.student}（${a.class}）`).join('\n')}`}

【处理建议】
• 有考勤记录的学员：出勤记 1，请假记 0
• 未分班学员可忽略，不计入异常

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可结合学员历史记录智能判断异常。`;
    }

    if (taskType === 'class-full-check') {
        const inputClass = input.trim();
        let targetClasses = classes.filter(c => c.status === 'active');
        if (inputClass) {
            targetClasses = targetClasses.filter(c => c.name.includes(inputClass));
        }

        const fullClasses = [];
        const nearFullClasses = [];
        targetClasses.forEach(c => {
            const cnt = students.filter(s => s.classId === c.id && s.status === 'active').length;
            if (cnt >= c.maxStudents) {
                fullClasses.push({ name: c.name, current: cnt, max: c.maxStudents });
            } else if (cnt >= c.maxStudents * 0.85) {
                nearFullClasses.push({ name: c.name, current: cnt, max: c.maxStudents });
            }
        });

        return `【本地规则】班级满班预警
━━━━━━━━━━━━━━━━━━
检测班级：${inputClass || '全部在读班级'}

${fullClasses.length > 0 ? `【已满班班级】\n${fullClasses.map(c => `⚠️ ${c.name}：${getPrivacyVal(c.current)}/${getPrivacyVal(c.max)} 已满员`).join('\n')}` : '【已满班班级】无'}
${nearFullClasses.length > 0 ? `【接近满班班级】\n${nearFullClasses.map(c => `⚡ ${c.name}：${getPrivacyVal(c.current)}/${getPrivacyVal(c.max)} 接近满员`).join('\n')}` : '【接近满班班级】无'}
${fullClasses.length === 0 && nearFullClasses.length === 0 ? '各班级尚有余位。' : ''}

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可结合历史报名数据预测满班时间。`;
    }

    if (taskType === 'renewal-reminder') {
        const pendingStudents = students.filter(s => s.status === 'renewalPending');
        const unpaidFees = fees.filter(f => f.status === 'pending');

        return `【本地规则】续费到期提醒
━━━━━━━━━━━━━━━━━━
待续费学员：${getPrivacyVal(pendingStudents.length)} 人
欠费记录：${getPrivacyVal(unpaidFees.length)} 条

${pendingStudents.length > 0 ? `【待续费学员名单】\n${pendingStudents.slice(0, 10).map(s => `• ${maskStudentName(s.name)}（${s.grade || ''}）`).join('\n')}${pendingStudents.length > 10 ? `\n…还有 ${getPrivacyVal(pendingStudents.length - 10)} 人` : ''}` : '【待续费学员名单】无'}

${unpaidFees.length > 0 ? `【欠费记录】\n${unpaidFees.slice(0, 5).map(f => `• ${maskStudentName(f.studentName)}：${getPrivacyAmount(f.amount)}`).join('\n')}${unpaidFees.length > 5 ? `\n…还有 ${getPrivacyVal(unpaidFees.length - 5)} 条` : ''}` : '【欠费记录】无'}

【建议】
1. 及时跟进待续费学员，确认续费意愿
2. 欠费学员优先确认缴费时间
3. 后续接入 AI 可自动生成催费话术

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可自动生成个性化催费方案。`;
    }

    return null;
}

function generateTeachingAgentContent(taskType, input) {
    const students = data.students || [];
    const classes = data.classes || [];
    const grades = data.grades || [];

    if (taskType === 'lesson-plan') {
        const inputLines = input.split('\n');
        const topic = inputLines[0]?.trim() || '[请在输入框填写课程主题]';
        const grade = inputLines[1]?.trim() || '[请填写年级]';
        const hours = inputLines[2]?.trim() || '2';

        return `【本地规则】教案生成模板
━━━━━━━━━━━━━━━━━━
课程主题：${escapeHtml(topic)}
年级：${escapeHtml(grade)}
课时数：${escapeHtml(hours)} 小时

【教学目标】
• 掌握本次课核心知识点
• 能够运用相关方法解题
• 培养逻辑思维能力

【教学重点】
• 重点知识点的讲解与练习
• 易错点的分析与纠正

【教学过程】
1. 导入（5分钟）：回顾上节课内容，引出新课题
2. 知识讲解（40分钟）：系统讲解本次课知识点
3. 例题演练（30分钟）：典型例题分析与练习
4. 课堂总结（10分钟）：梳理本节重点内容
5. 作业布置：根据学生水平布置适量练习

【课后跟进】
• 完成作业情况跟踪
• 薄弱环节针对性辅导

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可根据学员水平定制教案。`;
    }

    if (taskType === 'exercise-recommend') {
        const inputLines = input.split('\n');
        const grade = inputLines[0]?.trim() || '[请填写年级]';
        const weakPoints = inputLines.slice(1).join('\n').trim();

        return `【本地规则】练习题推荐模板
━━━━━━━━━━━━━━━━━━
年级：${escapeHtml(grade)}
薄弱点：${weakPoints ? escapeHtml(weakPoints) : '[根据学员情况自行填写]'}

【推荐练习方向】
• 基础题：巩固基本概念和公式
• 进阶题：提升解题技巧和方法
• 综合题：综合运用多个知识点

【练习建议】
• 每天坚持练习 30 分钟
• 重点攻克薄弱知识点
• 错题及时整理复习

【题目来源建议】
• 学校配套练习册
• 学而思培优教材
• 历年真题卷

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可根据学员历史错题自动推荐针对性练习。`;
    }

    if (taskType === 'learning-path') {
        const inputLines = input.split('\n');
        const currentGrade = inputLines[0]?.trim() || '[请填写当前年级]';
        const goal = inputLines.slice(1).join('\n').trim() || '[请填写学习目标]';

        return `【本地规则】学习路径规划模板
━━━━━━━━━━━━━━━━━━
当前年级：${escapeHtml(currentGrade)}
学习目标：${escapeHtml(goal)}

【阶段一：夯实基础】
• 系统复习当前年级核心知识点
• 查漏补缺，巩固基础

【阶段二：能力提升】
• 掌握解题技巧和方法
• 提升解题速度和准确率

【阶段三：冲刺突破】
• 综合运用知识解决难题
• 针对目标学校进行专项训练

【推荐学习周期】
• 短期目标：1-3 个月
• 中期目标：3-6 个月
• 长期目标：6-12 个月

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可根据学员测评结果生成个性化学习路径。`;
    }

    if (taskType === 'exam-analysis') {
        const inputLines = input.split('\n');
        const examName = inputLines[0]?.trim() || '[请填写试卷名称]';
        const grade = inputLines[1]?.trim() || '[请填写年级]';

        const gradeStudents = students.filter(s => s.grade === grade);
        const gradeGrades = grades.filter(g => gradeStudents.some(s => s.studentId === s.id));

        return `【本地规则】试卷分析模板
━━━━━━━━━━━━━━━━━━
试卷名称：${escapeHtml(examName)}
年级：${escapeHtml(grade)}
本年级学员：${getPrivacyVal(gradeStudents.length)} 人
已有成绩记录：${getPrivacyVal(gradeGrades.length)} 条

【分析维度】
• 各题得分率统计
• 知识点掌握情况
• 易错题分析
• 进步空间评估

【建议】
• 根据成绩分布针对性布置练习
• 对低分段学员加强基础训练
• 整理典型错题供全班复习

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可自动分析试卷得失分原因并生成改进建议。`;
    }

    return null;
}

function generateBizAgentContent(taskType, input) {
    const summary = getAIWorkspaceSummary();
    const students = data.students || [];
    const classes = data.classes || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];

    const pendingStudents = students.filter(s => s.status === 'renewalPending');
    const unpaidFees = fees.filter(f => f.status === 'pending');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let monthDetail = [];
    attendance.forEach(session => {
        const sd = session.date || '';
        const [sy, sm] = sd.split('-').map(Number);
        if (sy === currentYear && sm === currentMonth) {
            const cls = classes.find(c => c.id === session.classId);
            const attended = Object.entries(session.records || {}).filter(([, v]) => v === 1).length;
            monthDetail.push({ class: cls?.name || '未知班级', date: sd, attended });
        }
    });

    if (taskType === 'weekly-report') {
        return `【本地规则】本周经营周报
━━━━━━━━━━━━━━━━━━
日期：${now.toLocaleDateString('zh-CN')}
在读学员：${getPrivacyVal(summary.activeStudentCount)} 人
待续费：${getPrivacyVal(summary.pendingRenewalCount)} 人
欠费记录：${getPrivacyVal(summary.unpaidCount)} 条（${getPrivacyAmount(summary.unpaidAmount)}）
本月课消：${getPrivacyVal(summary.monthConsumedHours)} 课次
近一周沟通：${getPrivacyVal(summary.recentCommCount)} 条

【班级概况】
${classes.filter(c => c.status === 'active').map(c => {
    const cnt = students.filter(s => s.classId === c.id && s.status === 'active').length;
    return `• ${c.name}：${getPrivacyVal(cnt)}/${getPrivacyVal(c.maxStudents)} 人`;
}).join('\n') || '暂无在读班级'}

【待续费学员】
${pendingStudents.length === 0 ? '无' : pendingStudents.slice(0, 5).map(s => `• ${maskStudentName(s.name)}（${s.grade || ''}）`).join('\n')}
${pendingStudents.length > 5 ? `…还有 ${getPrivacyVal(pendingStudents.length - 5)} 人` : ''}

【欠费提醒】
${unpaidFees.length === 0 ? '无欠费记录' : unpaidFees.slice(0, 5).map(f => `• ${maskStudentName(f.studentName)}：${getPrivacyAmount(f.amount)}`).join('\n')}
${unpaidFees.length > 5 ? `…还有 ${getPrivacyVal(unpaidFees.length - 5)} 条` : ''}

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可生成更完整的经营建议。`;
    }

    if (taskType === 'monthly-report') {
        return `【本地规则】本月经营报告
━━━━━━━━━━━━━━━━━━
月份：${currentYear} 年 ${currentMonth} 月
在读学员：${getPrivacyVal(summary.activeStudentCount)} 人
待续费：${getPrivacyVal(summary.pendingRenewalCount)} 人
欠费记录：${getPrivacyVal(summary.unpaidCount)} 条（${getPrivacyAmount(summary.unpaidAmount)}）
本月课消：${getPrivacyVal(summary.monthConsumedHours)} 课次

【本月授课记录】
${monthDetail.length === 0 ? '本月暂无考勤记录' : monthDetail.map(m => `• ${m.class}（${m.date}）：出勤 ${getPrivacyVal(m.attended)} 人`).join('\n')}

【班级状态】
${classes.filter(c => c.status !== 'forming').map(c => {
    const cnt = students.filter(s => s.classId === c.id && s.status === 'active').length;
    const statusText = c.status === 'active' ? '进行中' : c.status === 'finished' ? '已结课' : '组班中';
    return `• ${c.name}：${statusText} ${getPrivacyVal(cnt)}/${getPrivacyVal(c.maxStudents)} 人`;
}).join('\n') || '暂无班级'}

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可生成更完整的月度经营报告。`;
    }

    if (taskType === 'class-consumption') {
        const inputClass = input.trim();
        let targetClass = null;
        if (inputClass) {
            targetClass = classes.find(c => c.name.includes(inputClass));
        }
        if (!targetClass) {
            targetClass = classes.find(c => c.status === 'active');
        }
        if (!targetClass) return '暂无班级数据。\n\n当前为本地规则生成，后续接入 AI 后可生成更完整的课消分析。';

        const clsStudents = students.filter(s => s.classId === targetClass.id && s.status === 'active');
        const clsFees = fees.filter(f => clsStudents.some(s => s.id === f.studentId));
        const paidHours = clsFees.reduce((sum, f) => sum + (f.hours || 0), 0);
        let consumedHours = 0;
        attendance.filter(a => a.classId === targetClass.id).forEach(session => {
            clsStudents.forEach(s => {
                if (session.records && session.records[s.id] === 1) consumedHours++;
            });
        });
        const remaining = paidHours - consumedHours;

        return `【本地规则】班级课消分析
━━━━━━━━━━━━━━━━━━
班级：${targetClass.name}
在读学员：${getPrivacyVal(clsStudents.length)} 人
已缴课时：${getPrivacyVal(paidHours)} 课
已消课时：${getPrivacyVal(consumedHours)} 课
剩余课时：${getPrivacyVal(remaining)} 课

【学员课时余额】
${clsStudents.length === 0 ? '暂无学员' : clsStudents.map(s => {
    const sf = fees.filter(f => f.studentId === s.id);
    const purchased = sf.reduce((sum, f) => sum + (f.hours || 0), 0);
    let consumed = 0;
    attendance.filter(a => a.classId === targetClass.id).forEach(session => {
        if (session.records && session.records[s.id] === 1) consumed++;
    });
    const rem = purchased - consumed;
    const status = rem < 0 ? '余额不足' : rem < 5 ? '建议续费' : '正常';
    return `• ${maskStudentName(s.name)}：已消 ${getPrivacyVal(consumed)} / 已缴 ${getPrivacyVal(purchased)} → 剩余 ${getPrivacyVal(rem)} [${status}]`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可结合学员表现生成针对性建议。`;
    }

    if (taskType === 'tuition-warning') {
        return `【本地规则】欠费与续费预警汇总
━━━━━━━━━━━━━━━━━━
欠费记录：${getPrivacyVal(summary.unpaidCount)} 条（${getPrivacyAmount(summary.unpaidAmount)}）
待续费学员：${getPrivacyVal(summary.pendingRenewalCount)} 人
在读学员总数：${getPrivacyVal(summary.activeStudentCount)} 人

${unpaidFees.length > 0 ? `【欠费明细】\n${unpaidFees.map(f => `• ${maskStudentName(f.studentName)}：欠 ${getPrivacyAmount(f.amount)}（${f.paymentDate || ''}）`).join('\n')}` : '【欠费明细】无欠费记录'}

${pendingStudents.length > 0 ? `【待续费学员】\n${pendingStudents.map(s => `• ${maskStudentName(s.name)}（${s.grade || ''}）`).join('\n')}` : '【待续费学员】无待续费学员'}

【后续建议】
1. 及时跟进欠费家长，确认缴费意愿
2. 课时不足 5 课的学员提前沟通续费
3. 后续接入 AI 可自动生成催费话术和续费方案

━━━━━━━━━━━━━━━━━━
当前为本地规则生成，后续接入 AI 后可自动生成针对性催费话术。`;
    }

    return null;
}

function generateLearningAgentContent(taskType, input) {
    if (taskType === 'student-feedback') {
        const inputLines = input.split('\n');
        const studentName = inputLines[0]?.trim() || '';
        const feedbackContent = inputLines.slice(1).join('\n').trim();

        return `【本地规则】学情反馈模板
━━━━━━━━━━━━━━━━━━
${studentName ? `学员：${escapeHtml(studentName)}` : '学员：[请在输入框填写学员姓名]'}

【家长你好，现反馈近期学习情况】
本次课堂整体表现稳定，知识点的掌握情况良好。
${feedbackContent ? `\n【用户补充信息】\n${escapeHtml(feedbackContent)}` : ''}

【学习建议】
• 建议家长配合督促学员按时完成作业
• 薄弱环节建议针对性练习
• 保持当前学习节奏，及时复习

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可结合成绩、考勤、沟通记录生成针对性学情报告。`;
    }

    if (taskType === 'renewal-script') {
        const inputLines = input.split('\n');
        const studentName = inputLines[0]?.trim() || '';
        const context = inputLines.slice(1).join('\n').trim();

        return `【本地规则】续费沟通话术
━━━━━━━━━━━━━━━━━━
${studentName ? `学员：${escapeHtml(studentName)}` : '学员：[请在输入框填写学员姓名]'}

【开场】
家长您好，我是老师，想跟您沟通一下孩子的续费问题。

【情况说明】
孩子在我们这里学习已有一段时间，整体表现${context || '良好'}。

【续费理由】
• 教学进度稳定，孩子已适应当前班级
• 后续课程衔接紧密，中断会影响学习效果
• 我们的课程性价比高，值得继续

【家长可能顾虑】
• 价格问题 → 可说明当前优惠政策
• 时间安排 → 可调整上课时间
• 学习效果 → 可展示进步记录

${context ? `\n【用户补充背景】\n${escapeHtml(context)}` : ''}

━━━━━━━━━━━━━━━━━━
当前为本地规则话术，后续接入 AI 可根据学员实际课时、成绩、沟通记录生成个性化话术。`;
    }

    if (taskType === 'parent-greeting') {
        const inputText = input.trim() || '平日';
        const festival = inputText.includes('节') ? inputText : `${inputText}问候`;

        return `【本地规则】家长问候模板
━━━━━━━━━━━━━━━━━━
主题：${escapeHtml(festival)}

【问候语模板】
家长您好！${festival}即将来临，在此祝您节日快乐！

孩子这段时间在学习上${['保持稳定', '进步明显', '状态良好'][Math.floor(Math.random() * 3)]}，感谢您一直以来的配合与支持。

如有任何问题，欢迎随时与我沟通。

—— 老师
${new Date().toLocaleDateString('zh-CN')}

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可结合节日、学员表现生成个性化问候。`;
    }

    return null;
}

function generateRecruitAgentContent(taskType, input) {
    const prospects = data.prospects || [];
    const pending = prospects.filter(p => p.trialStatus === 'pending' || p.trialStatus === 'contacted');
    const trial = prospects.filter(p => p.trialStatus === 'trial');
    const deal = prospects.filter(p => p.dealStatus === 'deal');
    const forming = prospects.filter(p => p.trialStatus === 'forming');

    if (taskType === 'trial-report') {
        return `【本地规则】试听报告模板
━━━━━━━━━━━━━━━━━━
试听学员：${input ? escapeHtml(input) : '[请填写试听学员信息]'}

【试听表现】
• 课堂参与度：[待评估]
• 知识掌握度：[待评估]
• 学习态度：[待评估]

【授课老师建议】
根据试听情况，建议：
• [ ] 适合加入基础班
• [ ] 适合加入拔高班
• [ ] 建议一段时间后再试

【家长反馈】
[待沟通]

━━━━━━━━━━━━━━━━━━
当前为本地规则模板，后续接入 AI 可结合试听表现、学员背景生成专业试听报告。`;
    }

    if (taskType === 'conversion-script') {
        return `【本地规则】试听转化话术
━━━━━━━━━━━━━━━━━━
【开场破冰】
家长您好，孩子今天试听感觉怎么样？

【课程价值传递】
我们的课程有以下优势：
• 小班教学，老师能关注到每个孩子
• 体系完整，从基础到拔高全覆盖
• 师资专业，都有多年教学经验

【解决家长顾虑】
• 顾虑价格 → 说明性价比，可提供优惠
• 顾虑时间 → 可调整上课时间
• 顾虑效果 → 可先试读一段时间

【逼单环节】
今天报名可以享受 [优惠内容]，名额有限建议提前锁定。

━━━━━━━━━━━━━━━━━━
当前为本地规则话术，后续接入 AI 可根据家长背景、课程特点生成针对性话术。`;
    }

    if (taskType === 'moment-content') {
        return `【本地规则】朋友圈招生文案
━━━━━━━━━━━━━━━━━━
📣 招生文案模板

【模板一：成果展示型】
学而思培优体系 | 小班教学
孩子数学进步了吗？
我们专注中小学数学，5年教学经验
📍 [地点] | 咨询请私信

【模板二：家长推荐型】
感谢家长推荐！
新老师入职欢迎会圆满结束
新学期班位预定中，欢迎预约试听
📞 [联系方式]

【模板三：活动型】
新学期优惠来啦！
试听免费，报名享折扣
名额有限，先到先得
💬 私信咨询

━━━━━━━━━━━━━━━━━━
当前为本地规则文案，后续接入 AI 可结合时事、课程亮点生成更有吸引力的招生内容。`;
    }

    if (taskType === 'follow-reminder') {
        return `【本地规则】意向学员跟进提醒
━━━━━━━━━━━━━━━━━━
📊 意向学员概况：
• 待跟进：${getPrivacyVal(pending.length)} 人
• 试课中：${getPrivacyVal(trial.length)} 人
• 组班中：${getPrivacyVal(forming.length)} 人
• 已成交：${getPrivacyVal(deal.length)} 人

${pending.length > 0 ? `【待跟进名单】\n${pending.slice(0, 5).map(p => `• ${maskStudentName(p.name)}（${p.grade || ''}）`).join('\n')}${pending.length > 5 ? `\n…还有 ${getPrivacyVal(pending.length - 5)} 人` : ''}` : '【待跟进名单】无待跟进学员'}

${trial.length > 0 ? `【试课中学员】\n${trial.slice(0, 5).map(p => `• ${maskStudentName(p.name)}（${p.grade || ''}）`).join('\n')}${trial.length > 5 ? `\n…还有 ${getPrivacyVal(trial.length - 5)} 人` : ''}` : '【试课中学员】无试课中学员'}

【跟进建议】
1. 待跟进学员建议 3 天内联系
2. 试课结束后及时与家长沟通报读意向
3. 已成交学员做好服务，建立口碑

━━━━━━━━━━━━━━━━━━
当前为本地规则分析，后续接入 AI 可自动生成跟进计划和沟通话术。`;
    }

    return null;
}

// 当前学员/意向学员 id（从外部传入）
let currentRelatedType = '';
let currentRelatedId = '';

// ========== 外部跳转 AI 工作台 ==========
function jumpToAIAgent(agentId, taskType, relatedType, relatedId) {
    switchTab('ai-workspace');
    setTimeout(() => {
        if (agentId) selectAgent(agentId);
        if (taskType) {
            setTimeout(() => {
                const taskSelect = document.getElementById('agentTaskType');
                if (taskSelect) {
                    taskSelect.value = taskType;
                    onAgentTaskTypeChange();
                }
                if (relatedType) currentRelatedType = relatedType;
                if (relatedId) currentRelatedId = relatedId;
                const input = document.getElementById('agentInput');
                if (input && relatedId) input.focus();
            }, 50);
        }
    }, 50);
}

window.jumpToAIAgent = jumpToAIAgent;

// ========== 任务描述映射 ==========
const taskDescriptions = {
    'schedule-conflict': '学员考勤、班级上课时间',
    'attendance-anomaly': '学员考勤、出勤状态',
    'class-full-check': '班级人数、容量',
    'renewal-reminder': '待续费学员、欠费记录',
    'student-feedback': '学员成绩、考勤、课时余额',
    'renewal-script': '学员课时余额、班级进度',
    'parent-greeting': '学员姓名、班级',
    'follow-reminder': '意向学员年级、状态、跟进情况',
    'conversion-script': '课程信息、学员情况',
    'trial-report': '试课学员年级、表现',
    'moment-content': '班级信息、课程特色',
    'lesson-plan': '课程主题、年级',
    'exercise-recommend': '学员年级、薄弱点',
    'learning-path': '学员年级、学习目标',
    'exam-analysis': '试卷名称、学员成绩',
    'weekly-report': '本周新增学员、课消、收费、欠费、待续费',
    'monthly-report': '本月班级进度、课消、收费、欠费',
    'class-consumption': '班级学员课时、已消/已缴',
    'tuition-warning': '欠费记录、待续费学员',
};

// ========== 任务执行 ==========

function runAgentTask() {
    const taskType = document.getElementById('agentTaskType').value;
    const input = document.getElementById('agentInput').value.trim();
    const output = document.getElementById('agentOutput');

    if (!taskType) {
        showToast('请先选择任务类型');
        return;
    }

    const agentNames = {
        'admin-agent': '教务 Agent',
        'learning-agent': '学情沟通 Agent',
        'recruit-agent': '招生跟进 Agent',
        'teaching-agent': '教研 Agent',
        'biz-agent': '经营分析 Agent',
    };

    const taskNames = {
        'schedule-conflict': '调课冲突检测',
        'attendance-anomaly': '考勤异常处理',
        'class-full-check': '班级满班预警',
        'renewal-reminder': '续费到期提醒',
        'student-feedback': '生成学情反馈',
        'renewal-script': '生成续费沟通话术',
        'parent-greeting': '生成家长问候模板',
        'trial-report': '生成试听报告',
        'conversion-script': '生成转化话术',
        'moment-content': '生成朋友圈招生文案',
        'follow-reminder': '意向学员跟进提醒',
        'lesson-plan': '生成教案',
        'exercise-recommend': '推荐练习题',
        'learning-path': '规划学习路径',
        'exam-analysis': '试卷分析',
        'weekly-report': '生成本周经营周报',
        'monthly-report': '生成本月经营报告',
        'class-consumption': '班级课消分析',
        'tuition-warning': '欠费与续费预警汇总',
    };

    // 带姓名且不是强制脱敏 Agent 时，需要二次确认
    const forceMaskedAgents = ['teaching-agent', 'biz-agent'];
    if (aiPrivacyMode === 'named' && !forceMaskedAgents.includes(currentAgentId)) {
        showPrivacyConfirm(() => doRunAgentTask(taskType, input, agentNames, taskNames));
        return;
    }
    doRunAgentTask(taskType, input, agentNames, taskNames);
}

function doRunAgentTask(taskType, input, agentNames, taskNames) {
    const output = document.getElementById('agentOutput');
    const btn = document.querySelector('.ai-btn-group .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '生成中...'; }

    const payload = {
        agent: currentAgentId,
        task: taskType,
        privacyMode: aiPrivacyMode,
        userInstruction: input,
        relatedType: currentRelatedType,
        relatedId: currentRelatedId,
    };

    fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => {
        if (!res.ok) throw new Error('API 请求失败');
        return res.json();
    })
    .then(response => {
        // 显示结果
        output.innerHTML = `<div class="ai-output-text">${escapeHtml(response.result || '')}</div>`;

        // 显示任务记录信息
        lastTaskId = response.taskId || '';
        lastTaskMode = response.mode || 'local-template';
        lastTaskProvider = response.provider || '';
        updateTaskRecordInfo();

        // 更新隐私标签
        const isNamed = aiPrivacyMode === 'named';
        const privacyTag = isNamed
            ? '<span style="font-size:11px;color:#e74c3c;margin-right:6px;">⚠️ 带姓名</span>'
            : '<span style="font-size:11px;color:#888;margin-right:6px;">🔒 脱敏</span>';
        document.getElementById('outputPrivacyTag').innerHTML = privacyTag;

        // 显示警告
        if (response.warnings && response.warnings.length > 0) {
            showToast(response.warnings[0]);
        } else {
            showToast(`${agentNames[currentAgentId]} · ${taskNames[taskType]} 已生成`);
        }

        // 刷新日志
        loadAgentLogsFromServer();
    })
    .catch(() => {
        // 接口失败，回退到本地模板
        output.innerHTML = `<div class="ai-output-placeholder">
<div style="font-size:24px;margin-bottom:8px;">🤖</div>
<div style="font-weight:600;color:var(--text-secondary);margin-bottom:4px;">接口调用失败，已回退本地模板</div>
<div style="color:var(--text-muted);">生成失败，请稍后重试。</div>
</div>`;
        showToast('生成失败，已回退本地模板');
    })
    .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = '生成结果'; }
    });
}

function updateTaskRecordInfo() {
    const el = document.getElementById('taskRecordInfo');
    if (!el) return;
    if (!lastTaskId && !lastTaskMode) {
        el.style.display = 'none';
        return;
    }
    const modeLabel = lastTaskMode === 'real-ai' ? '真实 AI' : '本地模板';
    el.innerHTML = `<span>任务ID: ${escapeHtml(lastTaskId)}</span> · <span>模式: ${escapeHtml(modeLabel)}</span>${lastTaskProvider ? ` · <span>${escapeHtml(lastTaskProvider)}</span>` : ''} · <span>隐私: ${escapeHtml(aiPrivacyMode === 'named' ? '带姓名' : '脱敏')}</span>`;
    el.style.display = 'block';
}

function loadAgentLogsFromServer() {
    fetch('/api/agent-logs')
        .then(res => res.json())
        .then(logs => {
            renderAgentLogsFromServer(logs);
        })
        .catch(() => {
            // 接口失败，使用本地日志
        });
}

function renderAgentLogsFromServer(logs) {
    const logArea = document.getElementById('agentLogArea');
    if (!logArea) return;
    if (!logs || logs.length === 0) {
        logArea.innerHTML = '<div class="ai-log-empty">暂无 Agent 调用记录</div>';
        return;
    }
    logArea.innerHTML = logs.slice(0, 20).map(log => {
        const time = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
        const agent = log.agent || '';
        const action = log.action || '';
        const mode = log.mode || '';
        const success = log.success !== false;
        return `<div class="ai-log-item">[${time}] ${escapeHtml(agent)} · ${escapeHtml(action)} · <span style="color:${success ? '#27ae60' : '#e74c3c'}">${success ? '成功' : '失败'}</span>${mode ? ` · ${escapeHtml(mode)}` : ''}</div>`;
    }).join('');
}

function refreshAgentLogs() {
    loadAgentLogsFromServer();
    showToast('日志已刷新');
}

function clearAgentOutput() {
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '选择任务类型并填写说明后，点击「生成结果」查看输出。';
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
    const text = output.innerText || output.textContent || '';
    if (!text || text === '选择任务类型并填写说明后，点击「生成结果」查看输出。') {
        showToast('暂无可复制内容');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制');
    }).catch(() => {
        showToast('复制失败');
    });
}

function logAgentEvent(msg) {
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    agentLogs.unshift(`[${now}] ${msg}`);
    if (agentLogs.length > 50) agentLogs = agentLogs.slice(0, 50);
    const logArea = document.getElementById('agentLogArea');
    if (logArea) {
        logArea.innerHTML = agentLogs.map(log => `<div class="ai-log-item">${escapeHtml(log)}</div>`).join('');
    }
}

function clearAgentLogs() {
    agentLogs = [];
    const logArea = document.getElementById('agentLogArea');
    if (logArea) logArea.innerHTML = '<div class="ai-log-empty">暂无 Agent 调用记录</div>';
    showToast('日志已清空');
}
