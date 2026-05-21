// ==================== 首页 ====================

function renderDashboard() {
    const container = document.getElementById('tab-dashboard');
    const pendingFees = data.fees.filter(f => f.status === 'pending');

    const classStats = data.classes.filter(c => c.status === 'active').map(c => {
        const count = data.students.filter(s => s.classId === c.id && s.status === 'active').length;
        return { ...c, currentCount: count };
    });

    let html = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">班级概览</span>
                <button class="btn btn-primary btn-sm" onclick="openClassModal()">+ 新增班级</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>班级名称</th><th>年级</th><th>上课时间</th><th>人数/满班</th><th>操作</th></tr></thead>
                    <tbody>
                        ${classStats.map(c => `
                            <tr>
                                <td><strong>${c.name}</strong></td>
                                <td>${c.grade}</td>
                                <td>${c.schedule}</td>
                                <td>${c.currentCount}/${c.maxStudents}</td>
                                <td>
                                    <button class="btn btn-secondary btn-xs" onclick="openClassModal('${c.id}')">编辑</button>
                                    <button class="btn btn-xs" onclick="switchTab('students'); selectClass('${c.id}')">查看学员</button>
                                    <button class="btn btn-xs" onclick="switchTab('attendance'); loadAttendanceClass('${c.id}')">考勤</button>
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
                            ${pendingFees.map(f => `<tr class="row-warning"><td>${f.studentName}</td><td><strong style="color:#e74c3c">¥${f.amount.toLocaleString()}</strong></td><td><button class="btn btn-success btn-xs" onclick="openFeeModal('${f.id}')">去缴费</button></td></tr>`).join('')}
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
    setTimeout(() => {
        const selector = document.getElementById('studentClassFilter');
        if (selector) { selector.value = classId; renderStudents(); }
    }, 100);
}