// ==================== 首页 ====================

// 待办本地存储键
const TODO_STORAGE_KEY = 'studentManageTodos_v1';

// ========== 待办数据 ==========
function getTodos() {
    try {
        return JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
    } catch { return []; }
}

function saveTodos(todos) {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(text, category, dateStr) {
    if (!text.trim()) return;
    const todos = getTodos();
    todos.unshift({
        id: Date.now(),
        text: text.trim(),
        category: category || '其他',
        done: false,
        dateStr: dateStr || '',
        createdAt: new Date().toISOString()
    });
    saveTodos(todos.slice(0, 50));
    renderTodoCalendarArea();
}

function toggleTodo(id) {
    const todos = getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
    saveTodos(todos);
    renderTodoCalendarArea();
}

function deleteTodo(id) {
    let todos = getTodos();
    todos = todos.filter(t => t.id !== id);
    saveTodos(todos);
    renderTodoCalendarArea();
}

function getTodosByDate(dateStr) {
    return getTodos().filter(t => t.dateStr === dateStr);
}

function getTodoDates() {
    const todos = getTodos();
    const dates = {};
    todos.forEach(t => {
        if (t.dateStr) dates[t.dateStr] = true;
    });
    return dates;
}

// ========== 小日历渲染 ==========
function renderMiniCalendar(year, month, selectedDate, onSelect) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todoDates = getTodoDates();

    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    const monthName = `${year}年${month + 1}月`;

    let cells = '';
    // 空单元格
    for (let i = 0; i < firstDay; i++) {
        cells += '<div class="mc-cell mc-empty"></div>';
    }
    // 日期单元格
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        const isSelected = selectedDate === dateStr;
        const hasTodo = todoDates[dateStr];
        const classes = [
            'mc-cell',
            isToday ? 'mc-today' : '',
            isSelected ? 'mc-selected' : '',
        ].filter(Boolean).join(' ');
        cells += `<div class="${classes}" onclick="${onSelect}('${dateStr}')" style="cursor:pointer;">
            <span class="mc-day-num">${d}</span>
            ${hasTodo ? '<span class="mc-dot"></span>' : ''}
        </div>`;
    }

    return `
        <div class="mini-calendar">
            <div class="mc-header">
                <button class="btn btn-xs mc-nav" onclick="changeCalMonth(-1)">&lt;</button>
                <span class="mc-month">${monthName}</span>
                <button class="btn btn-xs mc-nav" onclick="changeCalMonth(1)">&gt;</button>
            </div>
            <div class="mc-weekdays">
                ${dayNames.map(d => `<div class="mc-weekday">${d}</div>`).join('')}
            </div>
            <div class="mc-grid">
                ${cells}
            </div>
        </div>
    `;
}

// ========== 待办+日历 区域 ==========
function renderTodoCalendarArea() {
    const container = document.getElementById('todoCalendarArea');
    if (!container) return;

    const todos = getTodos();
    const selectedDate = container.dataset.selectedDate || '';
    const activeTodos = todos.filter(t => !t.done);
    const doneTodos = todos.filter(t => t.done);

    // 左侧：待办列表
    let todoListHtml = '';
    if (activeTodos.length === 0 && doneTodos.length === 0) {
        todoListHtml = '<div class="tc-empty">暂无待办，点击右侧日期添加</div>';
    } else {
        if (activeTodos.length > 0) {
            todoListHtml += activeTodos.slice(0, 8).map(t => `
                <div class="tc-todo-item">
                    <input type="checkbox" onchange="toggleTodo(${t.id})">
                    <span class="tc-todo-text">${escapeHtml(t.text)}</span>
                    <span class="tc-todo-cat">${escapeHtml(t.category)}</span>
                    <button class="btn btn-xs tc-todo-del" onclick="deleteTodo(${t.id})">×</button>
                </div>
            `).join('');
        }
        if (doneTodos.length > 0) {
            todoListHtml += doneTodos.slice(0, 4).map(t => `
                <div class="tc-todo-item tc-todo-done">
                    <input type="checkbox" checked onchange="toggleTodo(${t.id})">
                    <span class="tc-todo-text">${escapeHtml(t.text)}</span>
                    <span class="tc-todo-cat">${escapeHtml(t.category)}</span>
                    <button class="btn btn-xs tc-todo-del" onclick="deleteTodo(${t.id})">×</button>
                </div>
            `).join('');
        }
    }

    // 右侧：选中日期的待办 + 日历
    let rightHtml = '';
    if (selectedDate) {
        const dateTodos = getTodosByDate(selectedDate);
        const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
        rightHtml = `
            <div class="tc-selected-todos">
                <div class="tc-selected-date">${dateLabel}</div>
                ${dateTodos.length === 0 ? '<div class="tc-empty">当天无待办</div>' : dateTodos.map(t => `
                    <div class="tc-todo-item ${t.done ? 'tc-todo-done' : ''}">
                        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo(${t.id})">
                        <span class="tc-todo-text">${escapeHtml(t.text)}</span>
                        <span class="tc-todo-cat">${escapeHtml(t.category)}</span>
                    </div>
                `).join('')}
                <div class="tc-add-date-todo">
                    <input type="text" id="dateTodoInput" placeholder="添加待办事项..." style="flex:1;padding:4px 8px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;background:var(--input-bg);color:var(--text-primary);" onkeydown="if(event.key==='Enter')addDateTodo()">
                    <button class="btn btn-xs btn-primary" onclick="addDateTodo()">+</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="todo-calendar-layout">
            <div class="tc-left">
                <div class="tc-add-row">
                    <input type="text" id="todoInput" placeholder="添加待办事项..." style="flex:1;padding:6px 10px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text-primary);" onkeydown="if(event.key==='Enter')submitTodo()">
                    <select id="todoCategory" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text-primary);">
                        <option value="教务">教务</option>
                        <option value="招生">招生</option>
                        <option value="续费">续费</option>
                        <option value="教学">教学</option>
                        <option value="财务">财务</option>
                        <option value="其他">其他</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="submitTodo()">添加</button>
                </div>
                <div class="tc-todo-list">${todoListHtml}</div>
            </div>
            <div class="tc-right">
                ${rightHtml}
                <div id="miniCalendarContainer"></div>
            </div>
        </div>
    `;

    // 渲染日历
    renderMiniCalendarIntoContainer();
}

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderMiniCalendarIntoContainer() {
    const calContainer = document.getElementById('miniCalendarContainer');
    if (!calContainer) return;
    const selectedDate = document.getElementById('todoCalendarArea')?.dataset.selectedDate || '';
    calContainer.innerHTML = renderMiniCalendar(calYear, calMonth, selectedDate, 'onCalDateSelect');
}

function changeCalMonth(delta) {
    calMonth += delta;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderMiniCalendarIntoContainer();
}

function onCalDateSelect(dateStr) {
    const container = document.getElementById('todoCalendarArea');
    if (container) container.dataset.selectedDate = dateStr;
    renderTodoCalendarArea();
}

function addDateTodo() {
    const input = document.getElementById('dateTodoInput');
    const container = document.getElementById('todoCalendarArea');
    if (!input || !input.value.trim()) return;
    const dateStr = container?.dataset.selectedDate || '';
    const catSelect = document.getElementById('todoCategory');
    addTodo(input.value, catSelect ? catSelect.value : '其他', dateStr);
}

function submitTodo() {
    const input = document.getElementById('todoInput');
    const catSelect = document.getElementById('todoCategory');
    if (input && input.value.trim()) {
        addTodo(input.value, catSelect ? catSelect.value : '其他', '');
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

    // ===== 待办/备忘录 + 日历 =====
    html += `
    <div class="card">
        <div class="card-header">
            <span class="card-title">待办 / 备忘录</span>
        </div>
        <div id="todoCalendarArea" data-selected-date="" class="todo-calendar-wrapper"></div>
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

    container.innerHTML = html;
    renderTodoCalendarArea();
    updatePrivacyBtnLabel();
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