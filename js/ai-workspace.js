// ==================== AI 工作台 ====================

let currentAgentId = 'admin-agent';
let agentLogs = [];

function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 240px 1fr; gap: 16px; min-height: 600px;">
            <!-- 左侧：Agent 列表 -->
            <div class="card" style="padding: 0; overflow: hidden;">
                <div style="padding: 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: #2c3e50;">AI Agent</div>
                <div id="agentList">
                    ${renderAgentItem('admin-agent', '教务 Agent', '处理排课、调课、考勤异常等教务工作', true)}
                    ${renderAgentItem('learning-agent', '学情沟通 Agent', '生成学情反馈、续费沟通话术', false)}
                    ${renderAgentItem('recruit-agent', '招生跟进 Agent', '处理试听转化、朋友圈内容生成', false)}
                    ${renderAgentItem('teaching-agent', '教研 Agent', '生成教案、习题推荐、学习路径规划', false)}
                    ${renderAgentItem('biz-agent', '经营分析 Agent', '生成本周经营周报、课消分析', false)}
                </div>
            </div>

            <!-- 右侧：工作区 -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- 当前 Agent 工作区 -->
                <div class="card" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h3 id="agentTitle" style="margin: 0; color: #2c3e50;">教务 Agent</h3>
                            <p id="agentDesc" style="margin: 4px 0 0; font-size: 13px; color: #888;">处理排课、调课、考勤异常等教务工作</p>
                        </div>
                        <span id="agentStatus" class="badge badge-trial">待接入</span>
                    </div>

                    <div id="agentTaskArea">
                        <!-- 任务类型选择 -->
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 13px; color: #666; margin-bottom: 6px; display: block;">任务类型</label>
                            <select id="agentTaskType" onchange="onAgentTaskTypeChange()" style="width: 100%; max-width: 400px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px;">
                                <option value="">请选择任务类型</option>
                                <option value="schedule-conflict">调课冲突检测</option>
                                <option value="attendance-anomaly">考勤异常处理</option>
                                <option value="class-full-check">班级满班预警</option>
                                <option value="renewal-reminder">续费到期提醒</option>
                            </select>
                        </div>

                        <!-- 输入区 -->
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 13px; color: #666; margin-bottom: 6px; display: block;">任务描述 / 补充说明</label>
                            <textarea id="agentInput" rows="4" placeholder="描述你的需求，例如：检查六年级培优A班本周考勤异常..." style="width: 100%; max-width: 600px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; resize: vertical; box-sizing: border-box;"></textarea>
                        </div>

                        <!-- 生成按钮 -->
                        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px;">
                            <button class="btn btn-primary" onclick="runAgentTask()">
                                生成结果
                            </button>
                            <button class="btn btn-secondary" onclick="clearAgentOutput()">
                                清空
                            </button>
                        </div>

                        <!-- 输出结果区 -->
                        <div style="border-top: 1px solid var(--border-color); padding-top: 16px;">
                            <div style="font-size: 13px; color: #666; margin-bottom: 8px;">生成结果</div>
                            <div id="agentOutput" style="background: var(--hover-bg); border-radius: 8px; padding: 16px; min-height: 120px; font-size: 13px; line-height: 1.8; white-space: pre-wrap; color: #333;">
选择任务类型并填写说明后，点击「生成结果」查看 AI 输出。
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Agent 日志 -->
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600; color: #2c3e50;">Agent 日志</span>
                        <button class="btn btn-secondary btn-xs" onclick="clearAgentLogs()">清空日志</button>
                    </div>
                    <div id="agentLogArea" style="max-height: 160px; overflow-y: auto; font-size: 12px; color: #888; line-height: 1.8;">
                        <div style="color: #ccc;">暂无 Agent 调用记录</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAgentItem(id, name, desc, isActive) {
    const activeStyle = isActive ? 'background: var(--hover-bg); border-left: 3px solid #3498db;' : 'border-left: 3px solid transparent;';
    return `
        <div class="agent-item" onclick="selectAgent('${id}')" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s; ${activeStyle}">
            <div style="font-weight: 600; font-size: 13px; color: #2c3e50;">${name}</div>
            <div style="font-size: 11px; color: #888; margin-top: 4px;">${desc}</div>
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
        'recruit-agent': { name: '招生跟进 Agent', desc: '处理试听转化、朋友圈内容生成', tasks: [
            { value: 'trial-report', label: '生成试听报告' },
            { value: 'conversion-script', label: '生成转化话术' },
            { value: 'moment-content', label: '生成朋友圈招生文案' },
            { value: 'follow-reminder', label: '意向学员跟进提醒' },
        ]},
        'teaching-agent': { name: '教研 Agent', desc: '生成教案、习题推荐、学习路径规划', tasks: [
            { value: 'lesson-plan', label: '生成教案' },
            { value: 'exercise-recommend', label: '推荐练习题' },
            { value: 'learning-path', label: '规划学习路径' },
            { value: 'exam-analysis', label: '试卷分析' },
        ]},
        'biz-agent': { name: '经营分析 Agent', desc: '生成本周经营周报、课消分析', tasks: [
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
    document.getElementById('agentStatus').textContent = '待接入';

    const taskSelect = document.getElementById('agentTaskType');
    taskSelect.innerHTML = `<option value="">请选择任务类型</option>${agent.tasks.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}`;

    // Update agent list highlight
    document.querySelectorAll('.agent-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.borderLeft = '3px solid transparent';
    });
    const selected = document.querySelector(`.agent-item[onclick="selectAgent('${agentId}')"]`);
    if (selected) {
        selected.style.background = 'var(--hover-bg)';
        selected.style.borderLeft = '3px solid #3498db';
    }

    logAgentEvent(`切换到 ${agent.name}`);
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
}

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

    logAgentEvent(`调用 ${agentNames[currentAgentId]} · ${taskNames[taskType]}`);

    output.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">
<div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
<div style="font-size: 14px; font-weight: 600; color: #666; margin-bottom: 4px;">AI Agent 后续接入</div>
<div style="font-size: 13px;">当前任务：${taskNames[taskType]}</div>
<div style="font-size: 13px; margin-top: 8px; color: #aaa;">输入内容已记录，待 Agent API 接入后可生成结果。</div>
${input ? `<div style="margin-top: 12px; text-align: left; background: var(--card-bg); border-radius: 6px; padding: 10px; font-size: 12px; color: #666;">已记录输入：${escapeHtml(input)}</div>` : ''}
<div style="margin-top: 12px; font-size: 11px; color: #ccc;">Agent ID: ${currentAgentId} · Task: ${taskType}</div>
</div>`;

    showToast(`${agentNames[currentAgentId]} · ${taskNames[taskType]} 已记录`);
}

function clearAgentOutput() {
    document.getElementById('agentOutput').innerHTML = '选择任务类型并填写说明后，点击「生成结果」查看 AI 输出。';
    showToast('输出已清空');
}

function logAgentEvent(msg) {
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    agentLogs.unshift(`[${now}] ${msg}`);
    if (agentLogs.length > 50) agentLogs = agentLogs.slice(0, 50);
    const logArea = document.getElementById('agentLogArea');
    if (logArea) {
        logArea.innerHTML = agentLogs.map(log => `<div style="margin-bottom: 2px;">${escapeHtml(log)}</div>`).join('');
    }
}

function clearAgentLogs() {
    agentLogs = [];
    const logArea = document.getElementById('agentLogArea');
    if (logArea) logArea.innerHTML = '<div style="color: #ccc;">暂无 Agent 调用记录</div>';
    showToast('日志已清空');
}