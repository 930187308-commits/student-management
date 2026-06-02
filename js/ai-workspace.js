// ==================== AI 工作台 ====================

let currentAgentId = 'admin-agent';
let agentLogs = [];

// ==================== 数据感知函数（不接后端，基于本地 data）====================

function getAIWorkspaceSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const activeStudents = (data.students || []).filter(s => s.status === 'active' || s.status === 'pending');
    const pendingRenewal = (data.students || []).filter(s => s.status === 'pending');
    const prospects = data.prospects || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];
    const communications = data.communications || [];

    // 在读学员数
    const activeStudentCount = activeStudents.length;

    // 待续费学员数
    const pendingRenewalCount = pendingRenewal.length;

    // 意向学员数
    const prospectCount = prospects.length;

    // 欠费记录数和欠费金额
    const unpaidFees = fees.filter(f => f.status === 'unpaid');
    const unpaidCount = unpaidFees.length;
    const unpaidAmount = unpaidFees.reduce((sum, f) => sum + (f.amount || 0), 0);

    // 本月已消课时（attendance 中本月所有 records 里的 1 的总和）
    let monthConsumedHours = 0;
    attendance.forEach(session => {
        const sessionDate = session.date || '';
        if (sessionDate >= `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`) {
            const records = session.records || {};
            Object.values(records).forEach(v => { if (v === 1) monthConsumedHours++; });
        }
    });

    // 最近一周新增沟通记录数
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

// ==================== 渲染 AI 工作台 ====================

function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    const summary = getAIWorkspaceSummary();

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 240px 1fr; gap: 16px; min-height: 600px;">
            <!-- 左侧：Agent 列表 -->
            <div class="card" style="padding: 0; overflow: hidden;">
                <div style="padding: 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-primary);">AI Agent</div>
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
                <!-- 当前业务快照 -->
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600; color: var(--text-primary);">当前业务快照</span>
                        <span style="font-size: 11px; color: var(--text-muted);">实时汇总</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #3498db;">${summary.activeStudentCount}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">在读学员</div>
                        </div>
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #f39c12;">${summary.pendingRenewalCount}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">待续费</div>
                        </div>
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #9b59b6;">${summary.prospectCount}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">意向学员</div>
                        </div>
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #e74c3c;">${summary.unpaidCount}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">欠费记录</div>
                        </div>
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #e74c3c;">¥${(summary.unpaidAmount || 0).toLocaleString()}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">欠费金额</div>
                        </div>
                        <div style="background: var(--hover-bg); border-radius: 8px; padding: 12px; text-align: center;">
                            <div style="font-size: 22px; font-weight: 700; color: #27ae60;">${summary.monthConsumedHours}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">本月课消</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; text-align: center;">
                        <div style="display: inline-block; background: var(--hover-bg); border-radius: 8px; padding: 8px 16px;">
                            <span style="font-size: 13px; color: var(--text-muted);">近一周沟通</span>
                            <span style="font-size: 15px; font-weight: 700; color: #3498db; margin-left: 8px;">${summary.recentCommCount}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">条</span>
                        </div>
                    </div>
                </div>

                <!-- 当前 Agent 工作区 -->
                <div class="card" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div>
                            <h3 id="agentTitle" style="margin: 0; color: var(--text-primary);">教务 Agent</h3>
                            <p id="agentDesc" style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted);">处理排课、调课、考勤异常等教务工作</p>
                        </div>
                        <span id="agentStatus" class="badge badge-trial">待接入</span>
                    </div>

                    <div id="agentTaskArea">
                        <!-- 任务类型选择 -->
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; display: block;">任务类型</label>
                            <select id="agentTaskType" onchange="onAgentTaskTypeChange()" style="width: 100%; max-width: 400px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; background: var(--input-bg); color: var(--text-primary);">
                                <option value="">请选择任务类型</option>
                                <option value="schedule-conflict">调课冲突检测</option>
                                <option value="attendance-anomaly">考勤异常处理</option>
                                <option value="class-full-check">班级满班预警</option>
                                <option value="renewal-reminder">续费到期提醒</option>
                            </select>
                        </div>

                        <!-- 输入区 -->
                        <div style="margin-bottom: 16px;">
                            <label style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; display: block;">任务描述 / 补充说明</label>
                            <textarea id="agentInput" rows="4" placeholder="描述你的需求，例如：检查六年级培优A班本周考勤异常..." style="width: 100%; max-width: 600px; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 13px; resize: vertical; box-sizing: border-box; background: var(--input-bg); color: var(--text-primary);"></textarea>
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
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">生成结果</div>
                            <div id="agentOutput" style="background: var(--hover-bg); border-radius: 8px; padding: 16px; min-height: 120px; font-size: 13px; line-height: 1.8; white-space: pre-wrap; color: var(--text-primary);">
选择任务类型并填写说明后，点击「生成结果」查看 AI 输出。
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Agent 日志 -->
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600; color: var(--text-primary);">Agent 日志</span>
                        <button class="btn btn-secondary btn-xs" onclick="clearAgentLogs()">清空日志</button>
                    </div>
                    <div id="agentLogArea" style="max-height: 160px; overflow-y: auto; font-size: 12px; color: var(--text-muted); line-height: 1.8;">
                        <div style="color: var(--text-muted); opacity: 0.5;">暂无 Agent 调用记录</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 移动端适配 -->
        <style>
            @media (max-width: 700px) {
                #tab-ai-workspace .grid-2col {
                    grid-template-columns: 1fr !important;
                }
                #tab-ai-workspace .card:first-child .agent-list-card {
                    display: flex;
                    overflow-x: auto;
                    gap: 8px;
                    padding: 8px;
                }
                #tab-ai-workspace .agent-item {
                    min-width: 120px;
                    border-left: none !important;
                    border-bottom: 3px solid transparent;
                    background: transparent !important;
                }
                #tab-ai-workspace .agent-item.active-mobile {
                    border-bottom-color: #3498db !important;
                    background: var(--hover-bg) !important;
                }
            }
        </style>
    `;

    // Mobile: convert left sidebar to horizontal scroll
    if (window.innerWidth <= 700) {
        const agentList = document.getElementById('agentList');
        if (agentList) {
            agentList.style.display = 'flex';
            agentList.style.overflowX = 'auto';
            agentList.style.gap = '8px';
            agentList.style.padding = '8px';
            const items = agentList.querySelectorAll('.agent-item');
            items.forEach(item => {
                item.style.minWidth = '120px';
                item.style.borderLeft = 'none';
                item.style.borderBottom = '3px solid transparent';
            });
        }
    }
}

function renderAgentItem(id, name, desc, isActive) {
    const activeStyle = isActive
        ? 'background: var(--hover-bg); border-left: 3px solid #3498db;'
        : 'border-left: 3px solid transparent;';
    return `
        <div class="agent-item" onclick="selectAgent('${id}')" data-agent="${id}" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s; ${activeStyle}">
            <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${escapeHtml(name)}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(desc)}</div>
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
        el.classList.remove('active-mobile');
    });
    const selected = document.querySelector(`.agent-item[data-agent="${agentId}"]`);
    if (selected) {
        selected.style.background = 'var(--hover-bg)';
        selected.style.borderLeft = '3px solid #3498db';
        selected.classList.add('active-mobile');
    }

    // Clear output when switching agents
    const output = document.getElementById('agentOutput');
    if (output) {
        output.innerHTML = '选择任务类型并填写说明后，点击「生成结果」查看 AI 输出。';
    }
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

// ==================== 本地占位内容生成 ====================

function generateBizAgentContent(taskType, input) {
    const summary = getAIWorkspaceSummary();
    const students = data.students || [];
    const classes = data.classes || [];
    const fees = data.fees || [];
    const attendance = data.attendance || [];

    const pendingStudents = students.filter(s => s.status === 'pending');
    const activeStudents = students.filter(s => s.status === 'active');
    const unpaidFees = fees.filter(f => f.status === 'unpaid');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 本月课消明细
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
        return `【本地占位分析】本週經營週報
━━━━━━━━━━━━━━━━━━
📅 日期：${now.toLocaleDateString('zh-CN')}
👨‍🎓 在讀學員：${summary.activeStudentCount} 人
⏳ 待續費：${summary.pendingRenewalCount} 人
💰 欠費記錄：${summary.unpaidCount} 條（¥${(summary.unpaidAmount || 0).toLocaleString()}）
📚 本月課消：${summary.monthConsumedHours} 課次
💬 近一週溝通：${summary.recentCommCount} 條

【班級概覽】
${classes.filter(c => c.status === 'active').map(c => {
    const cnt = (data.students || []).filter(s => s.classId === c.id && s.status === 'active').length;
    return `• ${c.name}：${cnt}/${c.maxStudents} 人`;
}).join('\n') || '暫無在讀班級'}

【待續費學員】
${pendingStudents.length === 0 ? '無' : pendingStudents.slice(0, 5).map(s => `• ${s.name}（${s.grade || ''}）`).join('\n')}
${pendingStudents.length > 5 ? `…還有 ${pendingStudents.length - 5} 人` : ''}

【欠費提醒】
${unpaidFees.length === 0 ? '無欠費記錄' : unpaidFees.slice(0, 5).map(f => `• ${f.studentName || '未知'}：¥${(f.amount || 0).toLocaleString()}`).join('\n')}
${unpaidFees.length > 5 ? `…還有 ${unpaidFees.length - 5} 條` : ''}

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位分析，後續接入 AI 後可生成更完整的經營建議。`;
    }

    if (taskType === 'monthly-report') {
        return `【本地占位分析】本月經營報告
━━━━━━━━━━━━━━━━━━
📅 月份：${currentYear} 年 ${currentMonth} 月
👨‍🎓 在讀學員：${summary.activeStudentCount} 人
⏳ 待續費：${summary.pendingRenewalCount} 人
💰 欠費記錄：${summary.unpaidCount} 條（¥${(summary.unpaidAmount || 0).toLocaleString()}）
📚 本月課消：${summary.monthConsumedHours} 課次

【本月授課記錄】
${monthDetail.length === 0 ? '本月暫無考勤記錄' : monthDetail.map(m => `• ${m.class}（${m.date}）：出勤 ${m.attended} 人`).join('\n')}

【班級狀態】
${classes.filter(c => c.status !== 'forming').map(c => {
    const cnt = (data.students || []).filter(s => s.classId === c.id && s.status === 'active').length;
    return `• ${c.name}：${c.status === 'active' ? '進行中' : c.status === 'completed' ? '已結課' : '組班中'} ${cnt}/${c.maxStudents} 人`;
}).join('\n') || '暫無班級'}

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位分析，後續接入 AI 後可生成更完整的月度經營報告。`;
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
        if (!targetClass) return '暫無班級數據';

        const clsStudents = students.filter(s => s.classId === targetClass.id && (s.status === 'active' || s.status === 'pending'));
        const clsFees = fees.filter(f => clsStudents.some(s => s.id === f.studentId));
        const paidHours = clsFees.reduce((sum, f) => sum + (f.hours || 0), 0);
        let consumedHours = 0;
        attendance.filter(a => a.classId === targetClass.id).forEach(session => {
            clsStudents.forEach(s => {
                if (session.records && session.records[s.id] === 1) consumedHours++;
            });
        });
        const remaining = paidHours - consumedHours;

        return `【本地占位分析】班級課消分析
━━━━━━━━━━━━━━━━━━
📚 班級：${targetClass.name}
👨‍🎓 在讀學員：${clsStudents.length} 人
💰 已繳課時：${paidHours} 課
📉 已消課時：${consumedHours} 課
📈 剩餘課時：${remaining} 課

【學員課時餘額】
${clsStudents.length === 0 ? '暫無學員' : clsStudents.map(s => {
    const sf = fees.filter(f => f.studentId === s.id);
    const purchased = sf.reduce((sum, f) => sum + (f.hours || 0), 0);
    let consumed = 0;
    attendance.filter(a => a.classId === targetClass.id).forEach(session => {
        if (session.records && session.records[s.id] === 1) consumed++;
    });
    const rem = purchased - consumed;
    const status = rem < 0 ? '⚠️ 餘額不足' : rem < 5 ? '⚡ 建議續費' : '✓ 正常';
    return `• ${s.name}：已消 ${consumed} / 已繳 ${purchased} → 剩餘 ${rem} ${status}`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位分析，後續接入 AI 後可結合學員表現生成針對性建議。`;
    }

    if (taskType === 'tuition-warning') {
        return `【本地占位分析】欠費與續費預警匯總
━━━━━━━━━━━━━━━━━━
💰 欠費記錄：${summary.unpaidCount} 條（共 ¥${(summary.unpaidAmount || 0).toLocaleString()}）
⏳ 待續費學員：${summary.pendingRenewalCount} 人
👨‍🎓 在讀學員總數：${summary.activeStudentCount} 人

${unpaidFees.length > 0 ? `【欠費明細】
${unpaidFees.map(f => `• ${f.studentName || '未知'}：欠 ¥${(f.amount || 0).toLocaleString()}（${f.paymentDate || ''}）`).join('\n')}` : '【欠費明細】無欠費記錄 ✓'}

${pendingStudents.length > 0 ? `【待續費學員】
${pendingStudents.map(s => `• ${s.name}（${s.grade || ''}）`).join('\n')}` : '【待續費學員】無待續費學員 ✓'}

【後續建議】
1. 及時跟進欠費家長，確認繳費意願
2. 課時不足 5 課的學員提前溝通續費
3. 後續接入 AI 可自動生成催費話術和續費方案

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位分析，後續接入 AI 後可自動生成針對性催費話術。`;
    }

    return null;
}

function generateLearningAgentContent(taskType, input) {
    const summary = getAIWorkspaceSummary();

    if (taskType === 'student-feedback') {
        const inputLines = input.split('\n');
        const studentName = inputLines[0]?.trim() || '';
        const feedbackContent = inputLines.slice(1).join('\n').trim();

        return `【本地占位分析】學情反饋模板
━━━━━━━━━━━━━━━━━━
${studentName ? `📋 學員：${escapeHtml(studentName)}` : '📋 學員：[請在輸入框填寫學員姓名]'}

【家長你好，現反饋近期學習情況】
本次課堂整體表現穩定，知識點掌握情況良好。
${feedbackContent ? `\n【用戶補充信息】\n${escapeHtml(feedbackContent)}` : ''}

【學習建議】
• 建議家長配合督促學員按時完成作業
• 薄弱環節建議針對性練習
• 保持當前學習節奏，及時複習

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位模板，後續接入 AI 可結合成績、考勤、溝通記錄生成針對性學情報告。`;
    }

    if (taskType === 'renewal-script') {
        const inputLines = input.split('\n');
        const studentName = inputLines[0]?.trim() || '';
        const context = inputLines.slice(1).join('\n').trim();

        return `【本地占位分析】續費溝通話術
━━━━━━━━━━━━━━━━━━
${studentName ? `📋 學員：${escapeHtml(studentName)}` : '📋 學員：[請在輸入框填寫學員姓名]'}

【開場】
家長您好，我是 ${data.students?.[0]?.teacher || '老師'}，想跟您溝通一下孩子的續費問題。

【情況說明】
孩子在我們這裡學習已有一段時間，整體表現${context || '良好'}。

【續費理由】
• 教學進度穩定，孩子已適應當前班級
• 後續課程銜接緊密，中斷會影響學習效果
• 我們的課程性價比高，值得繼續

【家長可能顧慮】
• 價格問題 → 可說明當前優惠政策
• 時間安排 → 可調整上課時間
• 學習效果 → 可展示進步記錄

${context ? `\n【用戶補充背景】\n${escapeHtml(context)}` : ''}

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位話術，後續接入 AI 可根據學員實際課時、成績、溝通記錄生成個性化話術。`;
    }

    if (taskType === 'parent-greeting') {
        const inputText = input.trim() || '平日';
        const festival = inputText.includes('節') ? inputText : `${inputText}問候`;

        return `【本地占位分析】家長問候模板
━━━━━━━━━━━━━━━━━━
🎉 主題：${escapeHtml(festival)}

【問候語模板】
家長您好！${festival}即將來臨，在此祝您節日快樂！

孩子這段時間在學習上${['保持穩定', '進步明顯', '狀態良好'][Math.floor(Math.random() * 3)]}，感謝您一直以來的配合與支持。

如有任何問題，歡迎隨時與我溝通。

—— ${data.students?.[0]?.teacher || '老師'}
${new Date().toLocaleDateString('zh-CN')}

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位模板，後續接入 AI 可結合節日、學員表現生成個性化問候。`;
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
        return `【本地占位分析】試聽報告模板
━━━━━━━━━━━━━━━━━━
📋 試課學員：${input ? escapeHtml(input) : '[請填寫試課學員信息]'}

【試課表現】
• 課堂參與度：[待評估]
• 知識掌握度：[待評估]
• 學習態度：[待評估]

【授課老師建議】
根據試課情況，建議：
• [ ] 適合加入基礎班
• [ ] 適合加入拔高班
• [ ] 建議一段時間後再試

【家長反饋】
[待溝通]

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位模板，後續接入 AI 可結合試課表現、學員背景生成專業試聽報告。`;
    }

    if (taskType === 'conversion-script') {
        return `【本地占位分析】試聽轉化話術
━━━━━━━━━━━━━━━━━━
【開場破冰】
家長您好，孩子今天試課感覺怎麼樣？

【課程價值傳遞】
我們的課程有以下優勢：
• 小班教學，老師能關注到每個孩子
• 體系完整，從基礎到拔高全覆盖
• 師資專業，都有多年教學經驗

【解決家長顧慮】
• 顧慮價格 → 說明性價比，可提供優惠
• 顧慮時間 → 可調整上課時間
• 顧慮效果 → 可先試讀一段時間

【逼單環節】
今天報名可以享受 [優惠內容]，名額有限建議提前鎖定。

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位話術，後續接入 AI 可根據家長背景、課程特點生成針對性話術。`;
    }

    if (taskType === 'moment-content') {
        return `【本地占位分析】朋友圈招生文案
━━━━━━━━━━━━━━━━━━
📣 招生文案模板

【模板一：成果展示型】
🎓 學而思培優體系 | 小班教學
孩子數學進步了嗎？
我們專注中小學數學，5年教學經驗
📍 [地點] | 咨詢請私信

【模板二：家長推薦型】
📢 感謝家長推薦！
新老師入職歡迎會圓滿結束
新學期班位預定中，歡迎預約試聽
📞 [聯繫方式]

【模板三：活動型】
🎁 新學期優惠來啦！
試聽免費，報名享折扣
名額有限，先到先得
💬 私信咨詢

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位文案，後續接入 AI 可結合時事、課程亮點生成更有吸引力的招生內容。`;
    }

    if (taskType === 'follow-reminder') {
        return `【本地占位分析】意向學員跟進提醒
━━━━━━━━━━━━━━━━━━
📊 意向學員概況：
• 待跟進：${pending.length} 人
• 試課中：${trial.length} 人
• 組班中：${forming.length} 人
• 已成交：${deal.length} 人

${pending.length > 0 ? `【待跟進名單】
${pending.slice(0, 5).map(p => `• ${p.name || '未知'}（${p.grade || ''}）`).join('\n')}
${pending.length > 5 ? `…還有 ${pending.length - 5} 人` : ''}` : '【待跟進名單】無待跟進學員 ✓'}

${trial.length > 0 ? `【試課中學員】
${trial.slice(0, 5).map(p => `• ${p.name || '未知'}（${p.grade || ''}）`).join('\n')}
${trial.length > 5 ? `…還有 ${trial.length - 5} 人` : ''}` : '【試課中學員】無試課中學員 ✓'}

【跟進建議】
1. 待跟進學員建議 3 天內聯繫
2. 試課結束後及時與家長溝通報讀意向
3. 已成交學員做好服務，建立口碑

━━━━━━━━━━━━━━━━━━
⚠️ 本內容為本地占位分析，後續接入 AI 可自動生成跟進計劃和溝通話術。`;
    }

    return null;
}

// ==================== 任務執行 ====================

function runAgentTask() {
    const taskType = document.getElementById('agentTaskType').value;
    const input = document.getElementById('agentInput').value.trim();
    const output = document.getElementById('agentOutput');

    if (!taskType) {
        showToast('請先選擇任務類型');
        return;
    }

    const agentNames = {
        'admin-agent': '教務 Agent',
        'learning-agent': '學情溝通 Agent',
        'recruit-agent': '招生跟進 Agent',
        'teaching-agent': '教研 Agent',
        'biz-agent': '經營分析 Agent',
    };

    const taskNames = {
        'schedule-conflict': '調課衝突檢測',
        'attendance-anomaly': '考勤異常處理',
        'class-full-check': '班級滿班預警',
        'renewal-reminder': '續費到期提醒',
        'student-feedback': '生成學情反饋',
        'renewal-script': '生成續費溝通話術',
        'parent-greeting': '生成家長問候模板',
        'trial-report': '生成試聽報告',
        'conversion-script': '生成轉化話術',
        'moment-content': '生成朋友圈招生文案',
        'follow-reminder': '意向學員跟進提醒',
        'lesson-plan': '生成教案',
        'exercise-recommend': '推薦練習題',
        'learning-path': '規劃學習路徑',
        'exam-analysis': '試卷分析',
        'weekly-report': '生成本週經營週報',
        'monthly-report': '生成本月經營報告',
        'class-consumption': '班級課消分析',
        'tuition-warning': '欠費與續費預警匯總',
    };

    // 只在點擊生成時記錄日誌
    logAgentEvent(`調用 ${agentNames[currentAgentId]} · ${taskNames[taskType]}`);

    // 嘗試生成本地占位內容
    let localContent = null;
    if (currentAgentId === 'biz-agent') {
        localContent = generateBizAgentContent(taskType, input);
    } else if (currentAgentId === 'learning-agent') {
        localContent = generateLearningAgentContent(taskType, input);
    } else if (currentAgentId === 'recruit-agent') {
        localContent = generateRecruitAgentContent(taskType, input);
    }

    if (localContent) {
        output.innerHTML = `<div style="white-space: pre-wrap; font-size: 13px; line-height: 1.8; color: var(--text-primary);">${escapeHtml(localContent)}</div>`;
        showToast(`${agentNames[currentAgentId]} · ${taskNames[taskType]} 已生成（本地占位）`);
    } else {
        // 其餘 Agent 顯示通用占位
        output.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">
<div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
<div style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">AI Agent 後續接入</div>
<div style="font-size: 13px;">當前任務：${taskNames[taskType]}</div>
<div style="font-size: 13px; margin-top: 8px; opacity: 0.7;">輸入內容已記錄，待 Agent API 接入後可生成結果。</div>
${input ? `<div style="margin-top: 12px; text-align: left; background: var(--hover-bg); border-radius: 6px; padding: 10px; font-size: 12px; color: var(--text-secondary);">已記錄輸入：${escapeHtml(input)}</div>` : ''}
<div style="margin-top: 12px; font-size: 11px; opacity: 0.5;">Agent ID: ${currentAgentId} · Task: ${taskType}</div>
</div>`;
        showToast(`${agentNames[currentAgentId]} · ${taskNames[taskType]} 已記錄`);
    }
}

function clearAgentOutput() {
    document.getElementById('agentOutput').innerHTML = '選擇任務類型並填寫說明後，點擊「生成結果」查看 AI 輸出。';
    showToast('輸出已清空');
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
    if (logArea) logArea.innerHTML = '<div style="color: var(--text-muted); opacity: 0.5;">暫無 Agent 調用記錄</div>';
    showToast('日誌已清空');
}