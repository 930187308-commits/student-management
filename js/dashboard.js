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
                    <thead><tr><th>班级名称</th><th>状态</th><th>年级</th><th>上课时间</th><th>人数/满班</th><th>课次进度</th><th>操作</th></tr></thead>
                    <tbody>
                        ${classStats.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">暂无班级</td></tr>' : classStats.map(c => {
                            const statusBadge = c.status === 'active' ? 'badge-active' : c.status === 'forming' ? 'badge-trial' : 'badge-pending';
                            const statusText = c.status === 'active' ? '正常' : c.status === 'forming' ? '组班中' : '已结课';
                            const progressPercent = c.plannedSessions > 0 ? Math.round((c.completedSessions / c.plannedSessions) * 100) : 0;
                            const isNearEnd = c.status !== 'forming' && c.plannedSessions > 0 && progressPercent >= 90;
                            const isFinished = c.status === 'finished' || (c.status === 'active' && progressPercent >= 100);
                            return `
                                <tr style="${isFinished ? 'opacity:0.7;' : ''}${isNearEnd && !isFinished ? 'background:#fff8e6;' : ''}">
                                    <td><strong style="color:#3498db;">${escapeHtml(c.name)}</strong></td>
                                    <td><span class="badge ${statusBadge}">${statusText}</span></td>
                                    <td>${escapeHtml(c.grade) || '-'}</td>
                                    <td>${escapeHtml(c.schedule) || '-'}</td>
                                    <td>${c.currentCount}/${c.maxStudents}</td>
                                    <td>
                                        <div style="display:flex;align-items:center;gap:6px;">
                                            <strong style="color:#27ae60;">${c.completedSessions}</strong>
                                            <span style="color:#888;font-size:12px;">/ ${c.plannedSessions || 16}</span>
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

        <div class="dashboard-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="card">
                <div class="card-header"><span class="card-title">欠费提醒</span></div>
                ${pendingFees.length === 0 ? '<div class="empty-state">暂无欠费记录</div>' : `
                    <table>
                        <thead><tr><th>学员</th><th>欠费金额</th><th>操作</th></tr></thead>
                        <tbody>
                            ${pendingFees.map(f => `<tr class="row-warning"><td>${escapeHtml(f.studentName)}</td><td><strong style="color:#e74c3c;font-size:15px;">¥${f.amount.toLocaleString()}</strong></td><td><button class="btn btn-success btn-xs" onclick="openFeeModal('${escapeHtml(f.id)}')" style="padding:4px 10px;">去缴费</button></td></tr>`).join('')}
                        </tbody>
                    </table>
                `}
            </div>
            <div class="card">
                <div class="card-header"><span class="card-title">快捷操作</span></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn btn-primary" onclick="switchTab('students'); setTimeout(() => openStudentModal(), 100)">新增学员</button>
                    <button class="btn btn-success" onclick="switchTab('fees'); setTimeout(() => openFeeModal(), 100)">新增缴费</button>
                    <button class="btn btn-primary" onclick="switchTab('grades'); setTimeout(() => openGradeModal(), 100)">新增成绩</button>
                    <button class="btn btn-secondary" onclick="switchTab('reports')">查看统计报表</button>
                </div>
            </div>
        </div>
    `;
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
