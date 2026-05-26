// ==================== 学员管理 ====================

let currentStudentTab = 'active'; // active / renewalPending / inactive

function renderStudents() {
    const container = document.getElementById('tab-students');
    const grades = [...new Set(data.classes.map(c => c.grade))];

    let html = `
        <div class="two-col">
            <div class="left-panel">
                <!-- Tab切换 -->
                <div style="display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap;">
                    <button class="btn btn-sm ${currentStudentTab === 'active' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentTab('active')">在读学员</button>
                    <button class="btn btn-sm ${currentStudentTab === 'renewalPending' ? 'btn-warning' : 'btn-secondary'}" onclick="switchStudentTab('renewalPending')">待续费</button>
                    <button class="btn btn-sm ${currentStudentTab === 'inactive' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentTab('inactive')">非在读</button>
                </div>

                <!-- 年级班级同一行 -->
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <select id="studentGradeFilter" onchange="onGradeFilterChange()" style="flex:1;">
                        <option value="">全部年级</option>
                        ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                    <select id="studentClassFilter" onchange="renderStudentList()" style="flex:1;">
                        <option value="">全部班级</option>
                    </select>
                </div>
                <input type="text" id="studentSearchInput" placeholder="搜索学员姓名..." oninput="renderStudentList()" style="margin-bottom: 8px; width: 100%;">

                <div class="student-list" id="studentList"></div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button class="btn btn-secondary" style="flex:1;" onclick="downloadStudentTemplate()">下载模板</button>
                    <div class="file-input-wrapper" style="flex:1;">
                        <button class="btn btn-warning" style="width:100%;">导入</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importStudents(event)">
                    </div>
                </div>
                <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" onclick="openStudentModal()">+ 新增学员</button>
            </div>
            <div class="right-panel" id="studentDetail">
                <div class="empty-state">请选择左侧学员查看详情</div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    onGradeFilterChange();
}

function switchStudentTab(tab) {
    currentStudentTab = tab;
    renderStudents();
}

function onGradeFilterChange() {
    const grade = document.getElementById('studentGradeFilter').value;
    const classSelect = document.getElementById('studentClassFilter');
    const classes = grade ? data.classes.filter(c => c.grade === grade && c.status === 'active') : data.classes.filter(c => c.status === 'active');
    classSelect.innerHTML = `<option value="">全部班级</option><option value="__unassigned__">未分班</option>${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
    renderStudentList();
}

function renderStudentList() {
    const grade = document.getElementById('studentGradeFilter')?.value || '';
    const classId = document.getElementById('studentClassFilter')?.value || '';
    const search = document.getElementById('studentSearchInput')?.value?.toLowerCase() || '';

    const filtered = data.students.filter(s => {
        // Tab筛选
        if (currentStudentTab === 'active' && s.status !== 'active') return false;
        if (currentStudentTab === 'renewalPending' && s.status !== 'renewalPending') return false;
        if (currentStudentTab === 'inactive' && (s.status === 'active' || s.status === 'renewalPending' || !s.status)) return false;

        if (grade && s.grade !== grade) return false;
        if (classId === '__unassigned__' && s.classId) return false;
        if (classId && classId !== '__unassigned__' && s.classId !== classId) return false;
        if (search && !s.name.toLowerCase().includes(search)) return false;
        return true;
    }).sort((a, b) => {
        const aTime = a.createdAt || a.enrollDate || '';
        const bTime = b.createdAt || b.enrollDate || '';
        if (bTime > aTime) return 1;
        if (bTime < aTime) return -1;
        return (a.name || '').localeCompare(b.name || '');
    });

    const list = document.getElementById('studentList');
    list.innerHTML = filtered.map(s => {
        const cls = data.classes.find(c => c.id === s.classId);
        const statusMap = { active: '在读', forming: '组班中（旧）', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业' };
        const statusText = statusMap[s.status] || s.status;
        const statusClass = (s.status === 'inactive' || s.status === 'withdrawn' || s.status === 'graduated') ? 'style="opacity: 0.6;"' : '';
        const badgeColor = s.status === 'renewalPending' ? 'background:#f39c12;color:white;' : s.status === 'active' ? 'background:#d4edda;color:#155724;' : 'background:#e8f4fd;color:#666;';
        return `<div class="student-item ${currentStudentId === s.id ? 'active' : ''}" onclick="selectStudent('${s.id}')" ${statusClass}>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="name" style="font-weight: 600; font-size: 14px;">${escapeHtml(s.name)}</div>
                <span class="badge" style="${badgeColor} font-size: 10px;">${statusText}</span>
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">${escapeHtml(s.grade)} · ${escapeHtml(cls?.name) || '未分班'}</div>
        </div>`;
    }).join('');
}

function selectStudent(id) {
    currentStudentId = id;
    currentStudentGradeTab = 'all';
    renderStudentList();
    renderStudentDetail();
}

function switchStudentGradeTab(tab) {
    currentStudentGradeTab = tab;
    renderStudentDetail();
}

let currentStudentGradeTab = 'all'; // all / school / external

function renderStudentDetail() {
    if (!currentStudentId) return;
    const student = data.students.find(s => s.id === currentStudentId);
    if (!student) return;

    const cls = data.classes.find(c => c.id === student.classId);
    const studentFees = data.fees.filter(f => f.studentId === student.id);
    const studentGrades = data.grades.filter(g => g.studentId === student.id).sort((a, b) => a.testDate.localeCompare(b.testDate));
    const studentComms = data.communications.filter(c => c.studentId === student.id);

    // 按类型筛选成绩
    const schoolGrades = studentGrades.filter(g => g.examType === 'school');
    const externalGrades = studentGrades.filter(g => g.examType === 'external');
    const displayGrades = currentStudentGradeTab === 'all' ? studentGrades :
                          currentStudentGradeTab === 'school' ? schoolGrades : externalGrades;

    // 计算课时统计
    const totalPaidHours = studentFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.hours, 0);
    const totalPaidAmount = studentFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);

    // 计算已消课时和请假课时
    let usedHours = 0, absentHours = 0;
    data.attendance.forEach(a => {
        if (a.records && a.records[student.id] === 1) usedHours++;
        else if (a.records && a.records[student.id] === 0) absentHours++;
    });
    const remainingHours = totalPaidHours - usedHours;
    const usageRate = totalPaidHours > 0 ? Math.round((usedHours / totalPaidHours) * 100) : 0;

    const detail = document.getElementById('studentDetail');
    let chartHtml = '';
    if (displayGrades.length >= 2) {
        chartHtml = `
            <div style="margin-top: 24px;">
                <div style="font-weight: 600; color: #2c3e50; margin-bottom: 12px;">成绩趋势</div>
                <div class="chart-container"><canvas id="gradeChart"></canvas></div>
            </div>
        `;
    }

    detail.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
                <h3 style="font-size: 20px; color: #2c3e50;">${escapeHtml(student.name)}</h3>
                <p style="color: #888; font-size: 13px; margin-top: 4px;">${escapeHtml(student.grade)} · ${escapeHtml(cls?.name) || '未分班'}</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="openStudentModal('${student.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${student.id}')">删除</button>
            </div>
        </div>

        <!-- 课时进度条 -->
        <div style="margin-bottom: 20px; padding: 16px; background: var(--hover-bg); border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 13px; color: #888;">课时消耗进度</span>
                <span style="font-size: 13px; font-weight: 600;">${usageRate}%</span>
            </div>
            <div style="height: 12px; background: #eee; border-radius: 6px; overflow: hidden;">
                <div style="height: 100%; width: ${usageRate}%; background: linear-gradient(90deg, #27ae60, #2ecc71); border-radius: 6px; transition: width 0.3s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px;">
                <span>已消 <strong style="color:#27ae60">${usedHours}</strong> 课时</span>
                <span>请假 <strong style="color:#f39c12">${absentHours}</strong> 课时</span>
                <span>剩余 <strong style="color:#3498db">${remainingHours}</strong> 课时</span>
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item"><div class="label">已缴课时</div><div class="value">${totalPaidHours} 课时 <span style="font-size:12px;color:#888;">¥${totalPaidAmount.toLocaleString()}</span></div></div>
            <div class="detail-item"><div class="label">性别</div><div class="value">${escapeHtml(student.gender)}</div></div>
            <div class="detail-item"><div class="label">授课老师</div><div class="value">${escapeHtml(student.teacher)}</div></div>
            <div class="detail-item"><div class="label">就读学校</div><div class="value">${escapeHtml(student.school) || '-'}</div></div>
            <div class="detail-item"><div class="label">入班时间</div><div class="value">${student.enrollDate}</div></div>
            <div class="detail-item"><div class="label">首次入学</div><div class="value">${student.firstEnrollDate || '-'}</div></div>
            <div class="detail-item"><div class="label">联系电话</div><div class="value">${escapeHtml(student.phone) || '-'}</div></div>
        </div>

        ${student.remark ? `<div style="margin-top: 16px; padding: 12px; background: var(--hover-bg); border-radius: 8px;"><div class="label">备注</div><div class="value">${escapeHtml(student.remark)}</div></div>` : ''}

        <!-- 成绩记录 -->
        <div style="margin-top: 24px;">
            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span>成绩记录 (${studentGrades.length})</span>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-xs ${currentStudentGradeTab === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentGradeTab('all')">全部</button>
                    <button class="btn btn-xs ${currentStudentGradeTab === 'school' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentGradeTab('school')">校内</button>
                    <button class="btn btn-xs ${currentStudentGradeTab === 'external' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentGradeTab('external')">校外</button>
                </div>
            </div>
            ${displayGrades.length === 0 ? '<div class="empty-state" style="padding: 20px;">暂无记录</div>' : `
                <div class="table-wrapper">
                    <table>
                        <thead><tr><th>测试</th><th>日期</th><th>类型</th><th>得分</th><th>排名</th></tr></thead>
                        <tbody>
                            ${displayGrades.map(g => `<tr><td>${escapeHtml(g.testName)}</td><td>${g.testDate}</td><td><span class="badge ${g.examType === 'school' ? 'badge-active' : 'badge-normal'}">${g.examType === 'school' ? '校内' : '校外'}</span></td><td><span class="badge ${g.score >= 90 ? 'badge-active' : g.score >= 70 ? 'badge-trial' : 'badge-pending'}">${g.score}/${g.fullScore}</span></td><td>${g.ranking != null && g.ranking !== '' ? '第'+g.ranking+'名' : '未知'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>

        ${chartHtml}
    `;

    // 渲染成绩趋势图
    if (displayGrades.length >= 2) {
        setTimeout(() => {
            const ctx = document.getElementById('gradeChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: displayGrades.map(g => g.testName),
                        datasets: [{
                            label: '得分',
                            data: displayGrades.map(g => g.score),
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: false, min: 60, max: 100 } }
                    }
                });
            }
        }, 50);
    }
}

function openStudentModal(id = null) {
    currentEditId = id;
    const student = id ? data.students.find(s => s.id === id) : null;
    const classOptions = data.classes.filter(c => c.status === 'active').map(c => `<option value="${c.id}" ${student?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

    document.getElementById('modalTitle').textContent = id ? '编辑学员' : '新增学员';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveStudent(event)">
            <div class="form-row">
                <div class="form-group"><label>姓名 *</label><input type="text" name="name" value="${escapeHtml(student?.name || '')}" required></div>
                <div class="form-group">
                    <label>性别</label>
                    <select name="gender">
                        <option value="男" ${(!student || student?.gender === '男') ? 'selected' : ''}>男</option>
                        <option value="女" ${student?.gender === '女' ? 'selected' : ''}>女</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>年级</label>
                    <select name="grade">
                        ${(data.gradeOptions || ['五年级', '六年级', '初一', '初二', '初三', '新初一']).map(g => `<option value="${escapeHtml(g)}" ${student?.grade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>所在班级</label><select name="classId"><option value="">未分班</option>${classOptions}</select></div>
                <div class="form-group"><label>授课老师</label><input type="text" name="teacher" value="${escapeHtml(student?.teacher || '白老师')}"></div>
                <div class="form-group"><label>入班时间</label><input type="date" name="enrollDate" value="${student?.enrollDate || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>联系电话</label><input type="tel" name="phone" value="${escapeHtml(student?.phone || '')}"></div>
                <div class="form-group"><label>紧急联系人</label><input type="tel" name="emergencyContact" value="${escapeHtml(student?.emergencyContact || '')}"></div>
                <div class="form-group"><label>首次入学时间</label><input type="date" name="firstEnrollDate" value="${student?.firstEnrollDate || student?.enrollDate || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>就读学校</label><input type="text" name="school" value="${escapeHtml(student?.school || '')}" placeholder="如：XX小学" list="schoolDatalist" autocomplete="off"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>状态</label>
                    <select name="status">
                        <option value="active" ${(!student || student?.status === 'active') ? 'selected' : ''}>在读</option>
                        <option value="renewalPending" ${student?.status === 'renewalPending' ? 'selected' : ''}>待续费</option>
                        <option value="inactive" ${student?.status === 'inactive' ? 'selected' : ''}>已停课</option>
                        <option value="graduated" ${student?.status === 'graduated' ? 'selected' : ''}>已毕业</option>
                        <option value="withdrawn" ${student?.status === 'withdrawn' ? 'selected' : ''}>已退费</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>跟进状态</label>
                    <select name="followUpStatus">
                        <option value="">无</option>
                        <option value="pending" ${student?.followUpStatus === 'pending' ? 'selected' : ''}>待跟进</option>
                        <option value="contacted" ${student?.followUpStatus === 'contacted' ? 'selected' : ''}>已联系</option>
                        <option value="converted" ${student?.followUpStatus === 'converted' ? 'selected' : ''}>已转化</option>
                        <option value="lost" ${student?.followUpStatus === 'lost' ? 'selected' : ''}>已流失</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2;"><label>备注</label><input type="text" name="remark" value="${escapeHtml(student?.remark || '')}" placeholder="学员备注信息"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
            <datalist id="schoolDatalist"></datalist>
        </form>
    `;
    updateSchoolDatalist();
    document.getElementById('modal').classList.add('show');
}

function saveStudent(e) {
    e.preventDefault();
    const form = e.target;
    const existingStudent = currentEditId ? data.students.find(s => s.id === currentEditId) : null;
    const studentData = {
        id: currentEditId || generateId(),
        name: form.name.value, gender: form.gender.value, grade: form.grade.value,
        classId: form.classId.value, teacher: form.teacher.value, enrollDate: form.enrollDate.value,
        firstEnrollDate: form.firstEnrollDate.value || existingStudent?.firstEnrollDate || form.enrollDate.value,
        phone: form.phone.value, emergencyContact: form.emergencyContact.value,
        status: form.status.value, followUpStatus: form.followUpStatus?.value || '', remark: form.remark.value, school: form.school.value,
        createdAt: currentEditId ? existingStudent?.createdAt : new Date().toISOString()
    };
    if (currentEditId) {
        const index = data.students.findIndex(s => s.id === currentEditId);
        data.students[index] = studentData;
    } else {
        data.students.push(studentData);
    }
    saveData();
    closeModal();
    showToast('保存成功');
    render();
}

function updateSchoolDatalist() {
    const datalist = document.getElementById('schoolDatalist');
    if (!datalist) return;
    const schools = [...new Set((data.students || []).map(s => s.school).filter(Boolean))];
    datalist.innerHTML = schools.map(s => `<option value="${escapeHtml(s)}">`).join('');
}

function deleteStudent(id) {
    const student = data.students.find(s => s.id === id);
    if (!student) return;

    // 在读状态：改为停课
    if (student.status === 'active' || student.status === 'renewalPending') {
        if (!confirm('确定将该学员改为停课状态？删除操作不可恢复。')) return;
        student.status = 'inactive';
        student._archivedAt = new Date().toISOString();
        if (currentStudentId === id) currentStudentId = null;
        saveData();
        showToast('已改为停课状态');
        render();
        return;
    }

    // 非在读状态：允许物理删除
    if (!confirm('该学员已是非在读状态，确定彻底删除该学员记录吗？此操作不可恢复。')) return;
    data.students = data.students.filter(s => s.id !== id);
    if (currentStudentId === id) currentStudentId = null;
    saveData();
    showToast('已删除学员');
    render();
}

// 下载学员导入模板
function downloadStudentTemplate() {
    const headers = [['姓名', '性别', '年级', '班级名称', '授课老师', '入班时间', '联系电话', '紧急联系人', '状态', '备注', '就读学校']];
    const sampleRows = [['张三', '男', '六年级', '六年级奥数-周五18:00', '白老师', '2025-09-01', '13800138001', '13900139001', 'active', '数学基础扎实', 'XX小学']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学员导入模板');
    XLSX.writeFile(wb, '学员导入模板.xlsx');
    showToast('模板已下载');
}

// 导入学员Excel
function importStudents(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            let imported = 0, skipped = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) { skipped++; continue; } // 姓名必填

                // 通过班级名称查找班级ID
                const className = String(row[3] || '').trim();
                const cls = data.classes.find(c => c.name === className);

                const studentData = {
                    id: generateId(),
                    name: String(row[0]).trim(),
                    gender: String(row[1] || '男').trim(),
                    grade: String(row[2] || '六年级').trim(),
                    classId: cls?.id || '',
                    teacher: String(row[4] || '白老师').trim(),
                    enrollDate: String(row[5] || new Date().toISOString().split('T')[0]).trim(),
                    phone: String(row[6] || '').trim(),
                    emergencyContact: String(row[7] || '').trim(),
                    status: String(row[8] || 'active').trim(),
                    remark: String(row[9] || '').trim(),
                    school: String(row[10] || '').trim()
                };
                data.students.push(studentData);
                imported++;
            }

            saveData();
            render();
            showToast(`导入完成：成功 ${imported} 名${skipped > 0 ? `，跳过 ${skipped} 行` : ''}`);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}