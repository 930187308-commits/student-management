// ==================== 学员管理 ====================

let currentStudentTab = 'active'; // active / renewalPending / inactive
let studentBatchMode = false;

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
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="toggleStudentBatchMode()">${studentBatchMode ? '退出多选' : '多选'}</button>
                </div>
                ${studentBatchMode ? `<div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="exportSelectedStudents()">导出选中</button>
                    <button class="btn btn-danger btn-sm" style="flex:1;" onclick="deleteSelectedStudents()">删除选中</button>
                </div>` : ''}
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
                <div style="display:flex; align-items:center; gap:6px;">
                    ${studentBatchMode ? `<input type="checkbox" class="student-select" value="${s.id}" onclick="event.stopPropagation()">` : ''}
                    <div class="name" style="font-weight: 600; font-size: 14px;">${escapeHtml(s.name)}</div>
                </div>
                <span class="badge" style="${badgeColor} font-size: 10px;">${statusText}</span>
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">${escapeHtml(s.grade)} · ${escapeHtml(cls?.name) || '未分班'}</div>
        </div>`;
    }).join('');
}

function toggleStudentBatchMode() {
    studentBatchMode = !studentBatchMode;
    renderStudents();
}

function getSelectedStudentIds() {
    return Array.from(document.querySelectorAll('.student-select:checked')).map(el => el.value);
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

async function saveStudent(e) {
    e.preventDefault();
    const form = e.target;
    const existingStudent = currentEditId ? data.students.find(s => s.id === currentEditId) : null;

    // 同名检查（normalize后），排除自己
    const normName = normalizeNameForMatch(form.name.value);
    const dupStudents = data.students.filter(s =>
        s.id !== currentEditId && normalizeNameForMatch(s.name) === normName
    );
    if (dupStudents.length > 0) {
        const dupNames = dupStudents.map(s => `"${s.name}"`).join('、');
        if (!confirm(`系统中已存在同名学员（${dupNames}），请确认是否继续创建？`)) return;
    }

    const classJoinSessions = { ...(existingStudent?.classJoinSessions || {}) };
    const classLeaveSessions = { ...(existingStudent?.classLeaveSessions || {}) };
    if (existingStudent?.classId && existingStudent.classId !== form.classId.value) {
        const oldClassLastRecord = getStudentLastRecordedSessionIndex(existingStudent.id, existingStudent.classId);
        if (oldClassLastRecord > 0) {
            classLeaveSessions[existingStudent.classId] = oldClassLastRecord;
        }
        if (form.classId.value && oldClassLastRecord > 0) {
            const newClassSessionCount = data.attendance.filter(a => a.classId === form.classId.value).length;
            classJoinSessions[form.classId.value] = Math.max(newClassSessionCount + 1, 1);
            delete classLeaveSessions[form.classId.value];
        }
    } else if (!currentEditId && form.classId.value) {
        classJoinSessions[form.classId.value] = 1;
    }

    const studentData = {
        id: currentEditId || generateId(),
        name: form.name.value, gender: form.gender.value, grade: form.grade.value,
        classId: form.classId.value, teacher: form.teacher.value, enrollDate: form.enrollDate.value,
        firstEnrollDate: form.firstEnrollDate.value || existingStudent?.firstEnrollDate || form.enrollDate.value,
        phone: form.phone.value, emergencyContact: form.emergencyContact.value,
        status: form.status.value, followUpStatus: form.followUpStatus?.value || '', remark: form.remark.value, school: form.school.value,
        classJoinSessions,
        classLeaveSessions,
        createdAt: currentEditId ? existingStudent?.createdAt : new Date().toISOString()
    };
    try {
        await saveCollectionItemToApi('students', studentData);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

function getStudentLastRecordedSessionIndex(studentId, classId) {
    const sessions = data.attendance
        .filter(a => a.classId === classId)
        .sort((a, b) => a.date.localeCompare(b.date));
    let lastIndex = 0;
    sessions.forEach((session, index) => {
        if (session.records && session.records[studentId] !== undefined) {
            lastIndex = index + 1;
        }
    });
    return lastIndex;
}

function updateSchoolDatalist() {
    const datalist = document.getElementById('schoolDatalist');
    if (!datalist) return;
    const schools = [...new Set((data.students || []).map(s => s.school).filter(Boolean))];
    datalist.innerHTML = schools.map(s => `<option value="${escapeHtml(s)}">`).join('');
}

async function deleteStudent(id) {
    const student = data.students.find(s => s.id === id);
    if (!student) return;

    // 在读状态：改为停课
    if (student.status === 'active' || student.status === 'renewalPending') {
        if (!confirm('确定将该学员改为停课状态？删除操作不可恢复。')) return;
        student.status = 'inactive';
        student._archivedAt = new Date().toISOString();
        if (currentStudentId === id) currentStudentId = null;
        try {
            await saveCollectionItemToApi('students', student);
        } catch (error) {
            showToast('保存失败：' + error.message);
            return;
        }
        showToast('已改为停课状态');
        render();
        return;
    }

    // 非在读状态：允许物理删除
    if (!confirm('该学员已是非在读状态，确定彻底删除该学员记录吗？此操作不可恢复。')) return;
    const pendingFeeSummary = getPendingFeeSummary([student]);
    if (pendingFeeSummary.count > 0 && !confirm(`该学员还有欠费记录：\n\n${formatPendingFeeSummary(pendingFeeSummary)}\n\n确定仍然彻底删除学员吗？收费记录不会自动删除，后续会在数据体检中提示清理。`)) return;
    await createServerBackup('删除非在读学员前自动备份');
    if (currentStudentId === id) currentStudentId = null;
    try {
        await deleteCollectionItemFromApi('students', id);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast('已删除学员');
    render();
}

function exportSelectedStudents() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) { showToast('请先勾选学员'); return; }
    const selected = (data.students || []).filter(s => ids.includes(s.id));
    exportStudentRows(selected, `选中学员_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteSelectedStudents() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) { showToast('请先勾选学员'); return; }
    const selected = (data.students || []).filter(s => ids.includes(s.id));
    const activeLike = selected.filter(s => s.status === 'active' || s.status === 'renewalPending');
    const inactiveLike = selected.filter(s => s.status !== 'active' && s.status !== 'renewalPending');
    const pendingFeeSummary = getPendingFeeSummary(inactiveLike);
    const message = [
        `确定处理选中的 ${ids.length} 名学员吗？`,
        activeLike.length ? `${activeLike.length} 名在读/待续费学员会改为停课。` : '',
        inactiveLike.length ? `${inactiveLike.length} 名非在读学员会被彻底删除。` : '',
        pendingFeeSummary.count > 0 ? `其中 ${pendingFeeSummary.studentCount} 名待彻底删除学员仍有欠费记录：${pendingFeeSummary.count} 条，${pendingFeeSummary.hours} 课时，¥${pendingFeeSummary.amount.toLocaleString()}。` : '',
        '此操作会立即保存。'
    ].filter(Boolean).join('\n');
    if (!confirm(message)) return;
    if (pendingFeeSummary.count > 0 && !confirm(`再次确认：待彻底删除的学员中仍有欠费记录。\n\n${formatPendingFeeSummary(pendingFeeSummary)}\n\n确定继续吗？`)) return;
    await createServerBackup('批量处理学员前自动备份');
    activeLike.forEach(s => {
        s.status = 'inactive';
        s._archivedAt = new Date().toISOString();
    });
    const deleteIds = new Set(inactiveLike.map(s => s.id));
    data.students = (data.students || []).filter(s => !deleteIds.has(s.id));
    if (ids.includes(currentStudentId)) currentStudentId = null;
    try {
        await saveStudentsToApi(data.students);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    showToast(`已处理 ${ids.length} 名学员`);
    render();
}

function getPendingFeeSummary(students) {
    const studentIds = new Set((students || []).map(s => s.id));
    const pendingFees = (data.fees || []).filter(f => studentIds.has(f.studentId) && f.status === 'pending');
    const studentNames = [...new Set(pendingFees.map(f => f.studentName || (students.find(s => s.id === f.studentId)?.name) || '未命名学员'))];
    return {
        count: pendingFees.length,
        studentCount: studentNames.length,
        studentNames,
        amount: pendingFees.reduce((sum, f) => sum + Number(f.amount || 0), 0),
        hours: pendingFees.reduce((sum, f) => sum + Number(f.hours || 0), 0)
    };
}

function formatPendingFeeSummary(summary) {
    const names = summary.studentNames.slice(0, 8).join('、');
    const more = summary.studentNames.length > 8 ? `等 ${summary.studentNames.length} 人` : `${summary.studentNames.length} 人`;
    return [
        `涉及学员：${names || '-'}${summary.studentNames.length > 8 ? `（${more}）` : ''}`,
        `欠费记录：${summary.count} 条`,
        `欠费课时：${summary.hours}`,
        `欠费金额：¥${summary.amount.toLocaleString()}`
    ].join('\n');
}

function exportStudentRows(students, filename) {
    const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业', forming: '组班中（旧）' };
    const headers = ['姓名', '性别', '年级', '所在班级', '授课老师', '入班时间', '首次入学', '联系电话', '紧急联系人', '就读学校', '状态', '备注'];
    const rows = students.map(s => {
        const cls = (data.classes || []).find(c => c.id === s.classId);
        return [s.name || '', s.gender || '', s.grade || '', cls?.name || '未分班', s.teacher || '', s.enrollDate || '', s.firstEnrollDate || '', s.phone || '', s.emergencyContact || '', s.school || '', statusMap[s.status] || s.status || '', s.remark || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '选中学员');
    XLSX.writeFile(wb, filename);
    showToast('导出成功');
}

// 下载学员导入模板（含填写说明）
function downloadStudentTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['姓名', '性别', '年级', '班级名称', '授课老师', '入班时间', '联系电话', '紧急联系人', '状态', '备注', '就读学校'],
        ['张三', '男', '六年级', '六年级奥数-周五18:00', '白老师', '2025-09-01', '13800138001', '13900139001', 'active', '数学基础扎实', 'XX小学'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学员数据');

    const instrWs = XLSX.utils.aoa_to_sheet([
        ['学员导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['姓名', '学员真实姓名', '是', '如：张三'],
        ['性别', '男或女', '选填', '男 / 女'],
        ['年级', '当前年级', '选填', '五年级 / 六年级 / 初一 等'],
        ['班级名称', '班级名称，匹配已有班级', '选填', '如：六年级培优A班'],
        ['授课老师', '授课老师姓名', '选填', '如：白老师'],
        ['入班时间', '报名/入班日期', '选填', 'yyyy-mm-dd，如 2025-09-01'],
        ['联系电话', '家长电话', '选填', '如：13800138001'],
        ['紧急联系人', '紧急联系人', '选填', '如：13900139001'],
        ['状态', '在读状态', '选填', 'active（默认在读）/ inactive / renewalPending / withdrawn / graduated / 在读 / 停课 / 待续费 / 已退费 / 已毕业'],
        ['备注', '补充说明', '选填', '如：数学基础扎实'],
        ['就读学校', '就读学校', '选填', '如：XX小学'],
        [''],
        ['注意事项'],
        ['1. 日期必须为 yyyy-mm-dd 格式，如 2025-09-01'],
        ['2. 班级名称如不匹配现有班级，会以"未分班"状态导入'],
        ['3. 状态：active/在读=正常在读，inactive/停课，renewalPending/待续费，withdrawn/已退费，graduated/已毕业，无法识别会导入失败并跳过'],
    ]);
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
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

            const checkResult = precheckStudentImport(rows);
            showImportPreCheck({
                title: '学员导入预览',
                checkResult,
                actionLabel: '导入学员',
                duplicateStrategy: 'skip',
                onConfirm: (strategies) => executeStudentImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function precheckStudentImport(rows) {
    const statusMap = { '在读': 'active', 'active': 'active', '停课': 'inactive', 'inactive': 'inactive', '待续费': 'renewalPending', 'renewalpending': 'renewalPending', '已退费': 'withdrawn', 'withdrawn': 'withdrawn', '已毕业': 'graduated', 'graduated': 'graduated' };
    const validRows = [];
    const errors = [];
    const warnings = [];
    const duplicates = [];
    const skippedDetails = [];
    let skipped = 0;
    let failed = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        if (!row[0]) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写学员姓名' }); continue; }

        const name = String(row[0]).trim();
        const phone = String(row[6] || '').trim();
        const rawStatus = String(row[8] || '').trim().toLowerCase();
        if (rawStatus && !statusMap[rawStatus]) {
            errors.push({ row: rowNum, msg: `状态"${rawStatus}"无法识别` });
            failed++;
            continue;
        }

        const className = String(row[3] || '').trim();
        const normalizedClassName = normalizeTextForMatch(className);
        const cls = className ? data.classes.find(c =>
            normalizeTextForMatch(c.name) === normalizedClassName ||
            normalizeTextForMatch(`${c.name}${c.schedule || ''}`) === normalizedClassName ||
            normalizeTextForMatch(`${c.name}-${c.schedule || ''}`) === normalizedClassName
        ) : null;
        if (className && !cls) {
            warnings.push({ row: rowNum, msg: `班级"${className}"不存在，将按未分班导入` });
        }

        const normName = normalizeNameForMatch(name);
        const isDupe = data.students.some(s => normalizeNameForMatch(s.name) === normName && (phone ? s.phone === phone : true));
        if (isDupe) {
            duplicates.push({ row: rowNum, msg: `${name}${phone ? ` / ${phone}` : ''}` });
        }
        validRows.push({ row, cls, name, phone, rawStatus, status: statusMap[rawStatus] || 'active', isDupe });
    }

    const total = Math.max(rows.length - 1, 0);
    const dup = validRows.filter(v => v.isDupe).length;
    return { total, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, warnings, duplicates, skippedDetails, validRows };
}

async function executeStudentImport(checkResult, strategies = {}) {
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    let imported = 0;
    let replaced = 0;
    let skipped = checkResult.skip || 0;

    for (const v of checkResult.validRows) {
        const normName = normalizeNameForMatch(v.name);
        if (v.isDupe) {
            if (dupeStrategy === 'skip') { skipped++; continue; }
            const idx = data.students.findIndex(s => normalizeNameForMatch(s.name) === normName && (v.phone ? s.phone === v.phone : true));
            if (idx !== -1) {
                const existing = data.students[idx];
                const enrollDate = normalizeExcelDate(v.row[5]) || String(v.row[5] || '').trim() || existing.enrollDate || '';
                data.students[idx] = {
                    id: existing.id,
                    name: v.name,
                    gender: String(v.row[1] || existing.gender || '男').trim(),
                    grade: String(v.row[2] || existing.grade || '六年级').trim(),
                    classId: v.cls?.id || existing.classId || '',
                    teacher: String(v.row[4] || existing.teacher || '白老师').trim(),
                    enrollDate,
                    firstEnrollDate: existing.firstEnrollDate || enrollDate,
                    phone: v.phone,
                    emergencyContact: String(v.row[7] || '').trim(),
                    status: v.status,
                    remark: String(v.row[9] || '').trim(),
                    school: String(v.row[10] || '').trim(),
                    classJoinSessions: existing.classJoinSessions || (v.cls?.id ? { [v.cls.id]: 1 } : {}),
                    classLeaveSessions: existing.classLeaveSessions || {},
                    createdAt: existing.createdAt || new Date().toISOString()
                };
                replaced++;
                imported++;
                continue;
            }
        }

        const enrollDate = normalizeExcelDate(v.row[5]) || String(v.row[5] || '').trim() || new Date().toISOString().split('T')[0];
        data.students.push({
            id: generateId(),
            name: v.name,
            gender: String(v.row[1] || '男').trim(),
            grade: String(v.row[2] || '六年级').trim(),
            classId: v.cls?.id || '',
            teacher: String(v.row[4] || '白老师').trim(),
            enrollDate,
            firstEnrollDate: enrollDate,
            phone: v.phone,
            emergencyContact: String(v.row[7] || '').trim(),
            status: v.status,
            remark: String(v.row[9] || '').trim(),
            school: String(v.row[10] || '').trim(),
            classJoinSessions: v.cls?.id ? { [v.cls.id]: 1 } : {},
            classLeaveSessions: {},
            createdAt: new Date().toISOString()
        });
        imported++;
    }

    try {
        await saveStudentsToApi(data.students);
    } catch (error) {
        showToast('导入保存失败：' + error.message);
        return;
    }
    render();
    const msg = `成功导入 ${imported} 名${replaced > 0 ? `，替换 ${replaced} 条` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}`;
    showToast(msg);
}
