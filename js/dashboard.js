// ==================== 首页 ====================

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

    let html = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">班级概览</span>
                <button class="btn btn-primary btn-sm" onclick="openClassModal()">+ 新增班级</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>班级名称</th><th>年级</th><th>上课时间</th><th>人数/满班</th><th>计划课次</th><th>已进行课次</th><th>操作</th></tr></thead>
                    <tbody>
                        ${classStats.map(c => `
                            <tr>
                                <td><strong>${escapeHtml(c.name)}</strong></td>
                                <td>${escapeHtml(c.grade)}</td>
                                <td>${escapeHtml(c.schedule)}</td>
                                <td>${c.currentCount}/${c.maxStudents}</td>
                                <td>${c.plannedSessions || 16}</td>
                                <td><strong style="color:#27ae60;">${c.completedSessions}</strong></td>
                                <td>
                                    <button class="btn btn-secondary btn-xs" onclick="openClassModal('${escapeHtml(c.id)}')">编辑</button>
                                    <button class="btn btn-xs" onclick="switchTab('students'); selectClass('${escapeHtml(c.id)}')">查看学员</button>
                                    <button class="btn btn-xs" onclick="switchTab('attendance'); loadAttendanceClass('${escapeHtml(c.id)}')">考勤</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="card">
                <div class="card-header"><span class="card-title">欠费提醒</span></div>
                ${pendingFees.length === 0 ? '<div class="empty-state">暂无欠费记录</div>' : `
                    <table>
                        <thead><tr><th>学员</th><th>欠费金额</th><th>操作</th></tr></thead>
                        <tbody>
                            ${pendingFees.map(f => `<tr class="row-warning"><td>${escapeHtml(f.studentName)}</td><td><strong style="color:#e74c3c">¥${f.amount.toLocaleString()}</strong></td><td><button class="btn btn-success btn-xs" onclick="openFeeModal('${escapeHtml(f.id)}')">去缴费</button></td></tr>`).join('')}
                        </tbody>
                    </table>
                `}
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">快捷操作</span></div>
                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                    <button class="btn btn-primary" onclick="switchTab('students'); setTimeout(() => openStudentModal(), 100)">+ 新增学员</button>
                    <button class="btn btn-success" onclick="switchTab('fees'); setTimeout(() => openFeeModal(), 100)">+ 新增缴费</button>
                    <button class="btn btn-primary" onclick="switchTab('grades'); setTimeout(() => openGradeModal(), 100)">+ 新增成绩</button>
                    <button class="btn btn-secondary" onclick="switchTab('reports')">查看统计报表</button>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
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

        // 同步年级下拉（这样班级列表才包含目标班级）
        if (gradeSelect) {
            if (targetGrade) {
                gradeSelect.value = targetGrade;
            } else {
                gradeSelect.value = '';
            }
            // 按年级过滤班级
            const classes = targetGrade
                ? data.classes.filter(c => c.grade === targetGrade && c.status === 'active')
                : data.classes.filter(c => c.status === 'active');
            classSelect.innerHTML = `<option value="">全部班级</option><option value="__unassigned__">未分班</option>${classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}`;
        }

        classSelect.value = classId;
        renderStudentList();
    }, 50);
}
