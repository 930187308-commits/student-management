// ==================== 首页 ====================

// 待办本地存储键
const TODO_STORAGE_KEY = 'studentManageTodos_v1';

function getTodos() {
    try {
        return JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    } catch { return []; }
}

function saveTodos(todos) {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(text, category) {
    if (!text.trim()) return;
    const todos = getTodos();
    todos.unshift({
        id: Date.now(),
        text: text.trim(),
        category: category || '其他',
        done: false,
        createdAt: new Date().toISOString()
    });
    saveTodos(todos.slice(0, 50));
    renderTodoList();
}

function toggleTodo(id) {
    const todos = getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
    saveTodos(todos);
    renderTodoList();
}

function deleteTodo(id) {
    let todos = getTodos();
    todos = todos.filter(t => t.id !== id);
    saveTodos(todos);
    renderTodoList();
}

function renderTodoList() {
    const container = document.getElementById('todoList');
    if (!container) return;
    const todos = getTodos();
    const activeTodos = todos.filter(t => !t.done).slice(0, 5);
    const doneTodos = todos.filter(t => t.done).slice(0, 3);

    if (todos.length === 0) {
        container.innerHTML = '<div class="todo-empty">暂无待办</div>';
        return;
    }

    let html = '';
    if (activeTodos.length > 0) {
        html += activeTodos.map(t => `
            <div class="todo-item">
                <input type="checkbox" onchange="toggleTodo(${t.id})">
                <span class="todo-text">${escapeHtml(t.text)}</span>
                <span class="todo-cat">${escapeHtml(t.category)}</span>
                <button class="btn btn-xs" onclick="deleteTodo(${t.id})" style="padding:2px 6px;">×</button>
            </div>
        `).join('');
    }
    if (doneTodos.length > 0) {
        html += doneTodos.map(t => `
            <div class="todo-item todo-done">
                <input type="checkbox" checked onchange="toggleTodo(${t.id})">
                <span class="todo-text">${escapeHtml(t.text)}</span>
                <span class="todo-cat">${escapeHtml(t.category)}</span>
                <button class="btn btn-xs" onclick="deleteTodo(${t.id})" style="padding:2px 6px;">×</button>
            </div>
        `).join('');
    }
    container.innerHTML = html;
}

function getTodayWorkData() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const attendance = data.attendance || [];
    const students = data.students || [];
    const fees = data.fees || [];
    const prospects = data.prospects || [];

    const todaySessions = attendance.filter(a => a.date === today);
    const pendingRenewal = students.filter(s => s.status === 'renewalPending').length;
    const unpaidCount = fees.filter(f => f.status === 'pending').length;
    const pendingProspects = prospects.filter(p => p.trialStatus === 'pending' || p.trialStatus === 'contacted').length;

    return {
        todaySessionCount: todaySessions.length,
        pendingRenewal,
        unpaidCount,
        pendingProspects
    };
}

function renderDashboard() {
    const container = document.getElementById('tab-dashboard');
    if (!dashboardSummaryCache && !dashboardSummaryLoading) {
        dashboardSummaryLoading = true;
        loadDashboardSummaryFromApi()
            .then(summary => {
                dashboardSummaryCache = summary;
                renderStats();
                renderDashboard();
            })
            .catch(error => {
                console.log('读取后端首页汇总失败，使用本地计算:', error);
            })
            .finally(() => {
                dashboardSummaryLoading = false;
            });
    }
    const summary = dashboardSummaryCache || buildLocalDashboardSummary();
    const pendingFees = summary.pendingFees || [];
    const classStats = summary.classOverview || [];
    const work = getTodayWorkData();

    let html = '';

    // ===== 今日工作台 =====
    html += `
    <div class="card dashboard-workspace">
        <div class="card-header">
            <span class="card-title">今日工作台</span>
        </div>
        <div class="workspace-body">
            <!-- 工作提醒 -->
            <div class="workspace-reminders">
                <div class="reminder-grid">
                    <div class="reminder-item" onclick="goToAttendanceToday()">
                        <div class="reminder-icon">📋</div>
                        <div class="reminder-num">${getPrivacyVal(work.todaySessionCount)}</div>
                        <div class="reminder-label">今日课次</div>
                    </div>
                    <div class="reminder-item" onclick="switchTab('fees')">
                        <div class="reminder-icon">💰</div>
                        <div class="reminder-num">${getPrivacyVal(work.pendingRenewal)} / ${getPrivacyVal(work.unpaidCount)}</div>
                        <div class="reminder-label">待续费 / 欠费</div>
                    </div>
                    <div class="reminder-item" onclick="switchTab('prospects')">
                        <div class="reminder-icon">👨‍👩‍👧</div>
                        <div class="reminder-num">${getPrivacyVal(work.pendingProspects)}</div>
                        <div class="reminder-label">意向待跟进</div>
                    </div>
                    <div class="reminder-item" onclick="switchTab('ai-workspace')">
                        <div class="reminder-icon">🤖</div>
                        <div class="reminder-num">本地</div>
                        <div class="reminder-label">AI 工作台</div>
                    </div>
                </div>
            </div>

            <!-- 快捷操作 -->
            <div class="workspace-actions">
                <button class="btn btn-primary btn-sm" onclick="switchTab('students'); setTimeout(() => openStudentModal(), 100)">+ 学员</button>
                <button class="btn btn-success btn-sm" onclick="switchTab('fees'); setTimeout(() => openFeeModal(), 100)">+ 缴费</button>
                <button class="btn btn-primary btn-sm" onclick="switchTab('grades'); setTimeout(() => openGradeModal(), 100)">+ 成绩</button>
                <button class="btn btn-secondary btn-sm" onclick="goToAttendanceToday()">考勤</button>
                <button class="btn btn-info btn-sm" onclick="openDataHealthCheck()">体检</button>
                <button class="btn btn-secondary btn-sm" onclick="switchTab('ai-workspace')">AI</button>
            </div>
        </div>
    </div>
    `;

    // ===== 待办/备忘录 =====
    html += `
    <div class="card dashboard-todo">
        <div class="card-header">
            <span class="card-title">待办 / 备忘录</span>
            <button class="btn btn-secondary btn-xs" onclick="toggleTodoForm()" id="todoToggleBtn">+ 添加</button>
        </div>
        <div id="todoForm" style="display:none; margin-bottom: 12px;">
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="todoInput" placeholder="输入待办内容..." style="flex:1; min-width:150px; padding:6px 10px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background:var(--input-bg); color:var(--text-primary);" onkeydown="if(event.key==='Enter')submitTodo()">
                <select id="todoCategory" style="padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; font-size:13px; background:var(--input-bg); color:var(--text-primary);">
                    <option value="教务">教务</option>
                    <option value="招生">招生</option>
                    <option value="续费">续费</option>
                    <option value="其他">其他</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="submitTodo()">添加</button>
            </div>
        </div>
        <div id="todoList"></div>
    </div>
    `;

    // ===== 班级概览 =====
    html += `
    <div class="card">
        <div class="card-header">
            <span class="card-title">班级概览</span>
            <button class="btn btn-primary btn-sm" onclick="openClassModal()">+ 新增班级</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr><th>班级名称</th><th>状态</th><th>年级</th><th>上课时间</th><th>人数/满班</th><th>课次进度</th><th>操作</th></tr></thead>
                <tbody>
                    ${classStats.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">暂无班级</td></tr>' : classStats.map(c => {
                        const classStatus = c.status || 'active';
                        const statusBadge = classStatus === 'active' ? 'badge-active' : classStatus === 'forming' ? 'badge-trial' : 'badge-pending';
                        const statusText = classStatus === 'active' ? '正常' : classStatus === 'forming' ? '组班中' : '已结课';
                        const progressPercent = c.plannedSessions > 0 ? Math.round((c.completedSessions / c.plannedSessions) * 100) : 0;
                        const isNearEnd = classStatus !== 'forming' && c.plannedSessions > 0 && progressPercent >= 90;
                        const isFinished = classStatus === 'finished' || (classStatus === 'active' && progressPercent >= 100);
                        return `
                            <tr style="${isFinished ? 'opacity:0.7;' : ''}${isNearEnd && !isFinished ? 'background:#fff8e6;' : ''}">
                                <td><strong style="color:#3498db;">${escapeHtml(c.name)}</strong></td>
                                <td><span class="badge ${statusBadge}">${statusText}</span></td>
                                <td>${escapeHtml(c.grade) || '-'}</td>
                                <td>${escapeHtml(c.schedule) || '-'}</td>
                                <td>${getPrivacyVal(c.currentCount)}/${getPrivacyVal(c.maxStudents)}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:6px;">
                                        <strong style="color:#27ae60;">${getPrivacyVal(c.completedSessions)}</strong>
                                        <span style="color:#888;font-size:12px;">/ ${getPrivacyVal(c.plannedSessions || 16)}</span>
                                        <span style="font-size:11px;color:${isFinished ? '#e74c3c' : isNearEnd ? '#f39c12' : '#888'};">${isFinished ? '(已结课)' : isNearEnd ? '(接近结课)' : ''}</span>
                                    </div>
                                </td>
                                <td>
                                    <button class="btn btn-secondary btn-xs" onclick="openClassModal('${escapeHtml(c.id)}')">编辑</button>
                                    <button class="btn btn-xs" onclick="switchTab('students'); selectClass('${escapeHtml(c.id)}')">学员</button>
                                    <button class="btn btn-xs" onclick="switchTab('attendance'); loadAttendanceClass('${escapeHtml(c.id)}')">考勤</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    `;

    // ===== 欠费提醒摘要 =====
    const displayFees = pendingFees.slice(0, 3);
    const extraCount = pendingFees.length - 3;
    html += `
    <div class="card">
        <div class="card-header">
            <span class="card-title">欠费提醒</span>
            <button class="btn btn-secondary btn-sm" onclick="switchTab('fees')">去收费记录</button>
        </div>
        ${pendingFees.length === 0 ? '<div class="empty-state">暂无欠费记录</div>' : `
            <table>
                <thead><tr><th>学员</th><th>欠费金额</th><th>操作</th></tr></thead>
                <tbody>
                    ${displayFees.map(f => `<tr class="row-warning"><td>${maskStudentName(f.studentName)}</td><td><strong style="color:#e74c3c;font-size:15px;">${getPrivacyAmount(f.amount)}</strong></td><td><button class="btn btn-success btn-xs" onclick="openFeeModal('${escapeHtml(f.id)}')" style="padding:4px 10px;">去缴费</button></td></tr>`).join('')}
                </tbody>
            </table>
            ${extraCount > 0 ? `<div style="text-align:center;color:#888;font-size:13px;margin-top:8px;">还有 ${getPrivacyVal(extraCount)} 条，去收费记录查看</div>` : ''}
        `}
    </div>
    `;

    container.innerHTML = html;
    renderTodoList();
    updatePrivacyBtnLabel();
}

function submitTodo() {
    const input = document.getElementById('todoInput');
    const catSelect = document.getElementById('todoCategory');
    if (input) {
        addTodo(input.value, catSelect ? catSelect.value : '其他');
        input.value = '';
    }
}

function toggleTodoForm() {
    const form = document.getElementById('todoForm');
    const btn = document.getElementById('todoToggleBtn');
    if (form) {
        const isHidden = form.style.display === 'none';
        form.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? '取消' : '+ 添加';
        if (isHidden) {
            const input = document.getElementById('todoInput');
            if (input) input.focus();
        }
    }
}

function goToAttendanceToday() {
    switchTab('attendance');
    setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('attendanceDateFilter');
        if (dateInput) dateInput.value = today;
        if (typeof loadAttendanceClass === 'function') loadAttendanceClass('');
    }, 50);
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    currentTab = tab;
}

function selectClass(classId) {
    switchTab('students');
    setTimeout(() => {
        const gradeSelect = document.getElementById('studentGradeFilter');
        const classSelect = document.getElementById('studentClassFilter');
        if (!classSelect) return;

        const targetClass = data.classes.find(c => c.id === classId);
        const targetGrade = targetClass?.grade || '';

        if (gradeSelect) {
            if (targetGrade) {
                gradeSelect.value = targetGrade;
            } else {
                gradeSelect.value = '';
            }
            const classes = targetGrade
                ? data.classes.filter(c => c.grade === targetGrade && c.status === 'active')
                : data.classes.filter(c => c.status === 'active');
            classSelect.innerHTML = `<option value="">全部班级</option><option value="__unassigned__">未分班</option>${classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}`;
        }

        classSelect.value = classId;
        renderStudentList();
    }, 50);
}