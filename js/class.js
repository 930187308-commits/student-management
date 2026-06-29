// ==================== 班级管理 ====================

let expandedClassIds = new Set();
let expandedArchivedClassIds = new Set();

function isCurrentClassStudent(student) {
    return student && (student.status === 'active' || student.status === 'renewalPending' || !student.status);
}

function renderClasses() {
    const container = document.getElementById('tab-classes');
    const visibleClasses = (data.classes || []).filter(c => !c.archived);
    const grades = [...new Set(visibleClasses.map(c => c.grade))];
    const currentGradeFilter = document.getElementById('classGradeFilter')?.value || '';
    const currentStatusFilter = document.getElementById('classStatusFilter')?.value || '';

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <select id="classGradeFilter" onchange="renderClasses()">
                        <option value="">全部年级</option>
                        ${grades.map(g => `<option value="${g}" ${currentGradeFilter === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                    <select id="classStatusFilter" onchange="renderClasses()">
                        <option value="">全部状态</option>
                        <option value="active" ${currentStatusFilter === 'active' ? 'selected' : ''}>正常</option>
                        <option value="forming" ${currentStatusFilter === 'forming' ? 'selected' : ''}>组班中</option>
                        <option value="finished" ${currentStatusFilter === 'finished' ? 'selected' : ''}>已结课</option>
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-primary btn-sm" onclick="openClassModal()">+ 新增班级</button>
                    <button class="btn btn-secondary btn-sm" onclick="openClassTypeManager()">管理班型</button>
                    <button class="btn btn-secondary btn-sm" onclick="openGradeManager()">管理年级</button>
                    <button class="btn btn-secondary btn-sm" onclick="openArchivedClassManager()">归档班级</button>
                    <div class="divider"></div>
                    <button class="btn btn-secondary btn-sm" onclick="downloadClassTemplate()">下载模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning btn-sm">导入</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importClasses(event)">
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th class="class-expand-col"></th><th>班级名称</th><th>年级</th><th>班型</th><th>上课时间</th><th>人数/满班</th><th>满班率</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${visibleClasses.filter(c => {
                            return (!currentGradeFilter || c.grade === currentGradeFilter) && (!currentStatusFilter || c.status === currentStatusFilter);
                        }).map(c => {
                            const count = c.status === 'forming'
                                ? (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length
                                : data.students.filter(s => s.classId === c.id && isCurrentClassStudent(s)).length;
                            const fillRate = Math.round((count / c.maxStudents) * 100);
                            const isExpanded = expandedClassIds.has(c.id);
                            return `
                                <tr class="class-summary-row">
                                    <td class="class-expand-cell">
                                        <button class="class-expand-toggle" onclick="toggleClassExpand('${c.id}')" aria-label="${isExpanded ? '收起班级' : '展开班级'}">
                                            ${isExpanded ? '▼' : '▶'}
                                        </button>
                                    </td>
                                    <td><strong class="class-name-link" onclick="toggleClassExpand('${c.id}')">${c.name}</strong></td>
                                    <td>${c.grade}</td>
                                    <td>${c.classType}</td>
                                    <td>${c.schedule}</td>
                                    <td>${count}/${c.maxStudents}</td>
                                    <td><span class="badge ${fillRate >= 80 ? 'badge-active' : fillRate >= 50 ? 'badge-normal' : 'badge-trial'}">${fillRate}%</span></td>
                                    <td><span class="badge ${c.status === 'active' ? 'badge-active' : c.status === 'forming' ? 'badge-trial' : 'badge-pending'}">${c.status === 'active' ? '正常' : c.status === 'forming' ? '组班中' : '已结课'}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-xs" onclick="openClassModal('${c.id}')">编辑</button>
                                        <button class="btn btn-primary btn-xs" onclick="openClassAttendance('${c.id}')">考勤</button>
                                        <button class="btn btn-danger btn-xs" onclick="archiveClass('${c.id}')">归档</button>
                                    </td>
                                </tr>
                                ${isExpanded ? `
                                    <tr>
                                        <td colspan="9" class="class-expanded-cell">
                                            <div class="class-expanded-head">
                                                <strong class="class-expanded-title">${c.status === 'forming' ? '组班成员' : '班级学员列表'}</strong>
                                                <div class="class-expanded-actions">
                                                    <button class="btn btn-success btn-sm" onclick="openClassMemberManager('${c.id}')">管理成员</button>
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="switchToStudentTab(); setTimeout(() => { const s = document.getElementById('studentClassFilter'); if(s) s.value='${c.id}'; renderStudentList(); }, 100)">查看全部学员</button>` : ''}
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="openClassGrades('${c.id}')">本班成绩</button>` : ''}
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="openClassBusinessReminder('${c.id}')">AI 续费提醒</button>` : ''}
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="exportClassStudents('${c.id}')">导出学员</button>` : ''}
                                                </div>
                                            </div>
                                            ${count === 0 && c.status !== 'forming' ? '<div class="empty-state class-empty-state">该班级暂无在读或待续费学员</div>' : ''}
                                            ${c.status !== 'forming' && data.students.filter(s => s.classId === c.id && isCurrentClassStudent(s)).length > 0 ? `
                                                <div class="class-member-list">
                                                    ${data.students.filter(s => s.classId === c.id && isCurrentClassStudent(s)).map(s => `
                                                        <span class="class-member-chip ${s.status === 'renewalPending' ? 'is-renewal' : 'is-active'}" onclick="openStudentDetailFromRecord('${s.id}')">
                                                            <span class="class-member-dot"></span>
                                                            ${escapeHtml(s.name)}
                                                            ${s.status === 'renewalPending' ? '<span class="class-member-status">待续费</span>' : ''}
                                                            ${s.school ? `<span class="class-member-meta">(${escapeHtml(s.school)})</span>` : ''}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            ${c.status === 'forming' && (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length > 0 ? `
                                                <div class="class-member-list">
                                                    ${(data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').map(p => `
                                                        <span class="class-member-chip class-prospect-chip">
                                                            <span class="class-member-dot"></span>
                                                            ${escapeHtml(p.name)}
                                                            ${p.grade ? `<span class="class-member-meta">(${escapeHtml(p.grade)})</span>` : ''}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            ${c.status === 'forming' && (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length === 0 ? '<div class="empty-state class-empty-state">该组班暂无意向学员</div>' : ''}
                                        </td>
                                    </tr>
                                ` : ''}
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

function toggleClassExpand(classId) {
    if (expandedClassIds.has(classId)) {
        expandedClassIds.delete(classId);
    } else {
        expandedClassIds.add(classId);
    }
    renderClasses();
}

function exportClassStudents(classId) {
    const cls = data.classes.find(c => c.id === classId);
    const students = data.students.filter(s => s.classId === classId && isCurrentClassStudent(s));
    if (students.length === 0) { showToast('该班级无学员'); return; }
    const headers = ['姓名', '性别', '年级', '授课老师', '联系电话', '就读学校', '状态', '备注'];
    const statusMap = { active: '在读', renewalPending: '待续费' };
    const rows = students.map(s => [s.name, s.gender, s.grade, s.teacher, s.phone || '', s.school || '', statusMap[s.status] || '在读', s.remark || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    formatExcelSheet(ws, [headers, ...rows], { maxWidth: 32 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级学员');
    XLSX.writeFile(wb, `${cls?.name || '班级学员'}.xlsx`);
    showToast('导出成功');
}

function switchToStudentTab() {
    document.querySelector('[data-tab="students"]').click();
}

function openClassAttendance(classId) {
    switchTab('attendance');
    setTimeout(() => {
        const select = document.getElementById('attendanceClassSelect');
        if (select) select.value = classId;
        if (typeof loadAttendanceClass === 'function') loadAttendanceClass(classId);
    }, 100);
}

function openClassGrades(classId) {
    switchTab('grades');
    setTimeout(() => {
        const classFilter = document.getElementById('gradeClassFilter');
        if (classFilter) classFilter.value = classId;
        if (typeof renderGradeTable === 'function') renderGradeTable();
    }, 100);
}

function openClassBusinessReminder(classId) {
    const cls = (data.classes || []).find(c => c.id === classId);
    if (!cls) return;
    const question = `请根据系统里“${cls.name}”这个班的学员、课时、收费、成绩和沟通记录，生成本班经营与续费提醒。请按：优先处理学生、原因、建议动作输出。`;
    switchTab('ai-workspace');
    setTimeout(() => {
        if (typeof fillSystemQAQuestion === 'function') fillSystemQAQuestion(question);
        if (typeof setSystemQAAnswerLength === 'function') setSystemQAAnswerLength('detailed');
        const lengthSelect = document.getElementById('systemQAAnswerLength');
        if (lengthSelect) lengthSelect.value = 'detailed';
        document.getElementById('agentInput')?.focus();
    }, 100);
}

function openClassTypeManager() {
    document.getElementById('modalTitle').textContent = '班型管理';
    const typeList = (data.classTypes || []).map((t, idx) => `
        <div class="simple-manager-row">
            <span class="simple-manager-name">${escapeHtml(t)}</span>
            <button class="btn btn-danger btn-xs" onclick="deleteClassTypeByIdx(${idx})">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="simple-manager-form">
            <input type="text" id="newClassTypeName" class="simple-manager-input" placeholder="新班型名称">
            <button class="btn btn-success btn-sm" onclick="addClassType()">添加</button>
        </div>
        <div class="simple-manager-list">${typeList || '<div class="simple-manager-empty">暂无班型</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

async function addClassType() {
    const name = document.getElementById('newClassTypeName').value.trim();
    if (!name) { showToast('请输入班型名称'); return; }
    if (!data.classTypes) data.classTypes = [];
    if (data.classTypes.includes(name)) { showToast('该班型已存在'); return; }
    data.classTypes.push(name);
    try {
        await saveClassTypesToApi(data.classTypes);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    openClassTypeManager();
    showToast('班型已添加');
}

async function deleteClassTypeByIdx(idx) {
    if (!confirm('删除该班型？')) return;
    data.classTypes.splice(idx, 1);
    try {
        await saveClassTypesToApi(data.classTypes);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    openClassTypeManager();
    showToast('班型已删除');
}

function openGradeManager() {
    document.getElementById('modalTitle').textContent = '年级管理';
    const grades = getGradeOptions();
    const gradeList = grades.map(g => `
        <div class="simple-manager-row">
            <span class="simple-manager-name">${escapeHtml(g)}</span>
            <button class="btn btn-danger btn-xs" data-grade="${escapeHtml(g)}" onclick="deleteGradeByName(this.dataset.grade)">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div class="simple-manager-form">
            <input type="text" id="newGradeName" class="simple-manager-input" placeholder="新年级名称">
            <button class="btn btn-success btn-sm" onclick="addGrade()">添加</button>
        </div>
        <div class="simple-manager-list">${gradeList || '<div class="simple-manager-empty">暂无年级</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

async function addGrade() {
    const name = document.getElementById('newGradeName').value.trim();
    if (!name) { showToast('请输入年级名称'); return; }
    if (!data.gradeOptions) data.gradeOptions = ['五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];
    if (data.gradeOptions.includes(name)) { showToast('该年级已存在'); return; }
    data.gradeOptions.push(name);
    try {
        await saveGradeOptionsToApi(data.gradeOptions);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    openGradeManager();
    showToast('年级已添加');
}

async function deleteGradeByName(name) {
    if (!confirm('删除该年级？')) return;
    data.gradeOptions = (data.gradeOptions || []).filter(g => g !== name);
    try {
        await saveGradeOptionsToApi(data.gradeOptions);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    openGradeManager();
    showToast('年级已删除');
}

function getGradeOptions() {
    return [...new Set([...(data.gradeOptions || []), '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'])]
        .filter(g => g !== '新初一');
}

function openClassModal(id = null) {
    currentEditId = id;
    const cls = id ? data.classes.find(c => c.id === id) : null;

    document.getElementById('modalTitle').textContent = id ? '编辑班级' : '新增班级';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveClass(event)">
            <div class="form-row">
                <div class="form-group"><label>班级名称 *</label><input type="text" name="name" value="${cls?.name || ''}" required placeholder="如：初一基础-周四18:00"></div>
                <div class="form-group">
                    <label>年级</label>
                    <select name="grade">
                        ${getGradeOptions().map(g => `<option value="${g}" ${cls?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>班型</label>
                    <input type="text" name="classType" value="${cls?.classType || ''}" placeholder="如：基础、拔高、奥数" list="classTypeList">
                    <datalist id="classTypeList">
                        ${(data.classTypes || []).map(t => `<option value="${t}">`).join('')}
                    </datalist>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>上课时间</label><input type="text" name="schedule" value="${cls?.schedule || ''}" placeholder="如：周四 18:00-20:00"></div>
                <div class="form-group"><label>学期</label><input type="text" name="semester" value="${cls?.semester || '2025秋季'}"></div>
                <div class="form-group"><label>满班人数</label><input type="number" name="maxStudents" value="${cls?.maxStudents || 10}" min="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>状态</label>
                    <select name="status">
                        <option value="forming" ${cls?.status === 'forming' ? 'selected' : ''}>组班中</option>
                        <option value="active" ${(!cls || cls?.status === 'active') ? 'selected' : ''}>正常</option>
                        <option value="finished" ${cls?.status === 'finished' ? 'selected' : ''}>已结课</option>
                    </select>
                </div>
                <div class="form-group"><label>本学期计划课次</label><input type="number" name="plannedSessions" value="${cls?.plannedSessions || 16}" min="1" placeholder="如：16"></div>
                <div class="form-group" style="flex:2;"><label>暑假排课</label><input type="text" name="summerSchedule" value="${cls?.summerSchedule || ''}" placeholder="如：周一至周五上午"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

async function saveClass(e) {
    e.preventDefault();
    const form = e.target;
    const isNew = !currentEditId;
    const oldClass = isNew ? null : data.classes.find(c => c.id === currentEditId);
    const oldStatus = oldClass?.status;
    const newStatus = form.status.value;
    const statusChangedToFinished = !isNew && oldStatus !== 'finished' && newStatus === 'finished';

    const classData = {
        id: currentEditId || generateId(),
        name: form.name.value, grade: form.grade.value, classType: form.classType.value,
        schedule: form.schedule.value, semester: form.semester.value,
        maxStudents: parseInt(form.maxStudents.value), status: newStatus,
        plannedSessions: parseInt(form.plannedSessions?.value || 16),
        summerSchedule: form.summerSchedule.value,
        archived: oldClass?.archived || false,
        archivedAt: oldClass?.archivedAt
    };
    if (!classData.archived) delete classData.archivedAt;

    const markStudentsRenewalPending = statusChangedToFinished ? shouldMarkClassStudentsRenewalPending(currentEditId) : false;

    try {
        await saveClassWithTransitionsToApi(classData, { markStudentsRenewalPending });
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

async function archiveClass(id) {
    const cls = data.classes.find(c => c.id === id);
    if (!cls) return;
    if (cls.archived) {
        showToast('该班级已归档');
        return;
    }
    if (cls.status === 'active') {
        showToast('正常上课班级不能直接归档，请先将状态改为“已结课”或“组班中”');
        return;
    }
    if (!confirm(`确定归档班级“${cls.name}”吗？\n\n归档后会从班级主列表移到“归档班级”，历史考勤和学员轨迹会保留。班级状态不会自动改为已结课。`)) return;
    try {
        await archiveClassFromApi(id);
    } catch (error) {
        showToast('归档失败：' + error.message);
        return;
    }
    showToast('班级已归档');
    render();
}

function shouldMarkClassStudentsRenewalPending(classId) {
    const activeStudents = (data.students || []).filter(s =>
        s.classId === classId && (s.status === 'active' || s.status === 'renewalPending' || !s.status)
    );
    if (activeStudents.length === 0) return false;
    const names = activeStudents.slice(0, 8).map(s => s.name).join('、');
    const more = activeStudents.length > 8 ? `等 ${activeStudents.length} 人` : `${activeStudents.length} 人`;
    if (!confirm(`这个班级还有 ${more} 在读/待续费学员：${names}\n\n是否同步把他们改为“待续费”？\n\n选择“确定”：批量改为待续费，方便后续续班和续费沟通。\n选择“取消”：保持当前学员状态不变。`)) {
        return false;
    }
    return true;
}

function openArchivedClassManager() {
    const search = document.getElementById('archivedClassSearch')?.value?.toLowerCase()?.trim() || '';
    const archivedClasses = (data.classes || [])
        .filter(c => c.archived)
        .filter(c => {
            if (!search) return true;
            return [c.name, c.grade, c.classType, c.schedule, c.semester, c.status]
                .some(value => String(value || '').toLowerCase().includes(search));
        })
        .sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')));
    const totalArchived = (data.classes || []).filter(c => c.archived).length;
    document.getElementById('modalTitle').textContent = '归档班级管理';
    document.getElementById('modalBody').innerHTML = `
        <div style="line-height:1.7;font-size:14px;">
            <div style="padding:10px;background:#fff3cd;border-radius:8px;color:#856404;margin-bottom:12px;">
                归档班级用于保留历史考勤、收费和学员学习轨迹。只有确认是测试数据或误建班级时，才建议彻底删除。
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
                <input id="archivedClassSearch" type="text" placeholder="搜索班级名称、年级、班型、时间..." value="${escapeHtml(search)}" oninput="openArchivedClassManager()" style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:6px;">
                <span style="color:#888;font-size:13px;white-space:nowrap;">${archivedClasses.length}/${totalArchived} 个</span>
            </div>
            ${archivedClasses.length === 0 ? `<div class="empty-state">${totalArchived === 0 ? '暂无已归档班级' : '没有匹配的归档班级'}</div>` : `
                <div class="table-wrapper" style="max-height:420px;overflow:auto;">
                    <table>
                        <thead><tr><th style="width:40px;"></th><th>班级名称</th><th>状态</th><th>年级</th><th>上课时间</th><th>历史考勤</th><th>关联学员</th><th>归档时间</th><th>操作</th></tr></thead>
                        <tbody>
                            ${archivedClasses.map(c => {
                                const attendanceCount = (data.attendance || []).filter(a => a.classId === c.id).length;
                                const archivedStudents = getArchivedClassStudents(c.id);
                                const isExpanded = expandedArchivedClassIds.has(c.id);
                                return `
                                    <tr>
                                        <td style="text-align:center;">
                                            <button onclick="toggleArchivedClassExpand('${c.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:#666;padding:4px;">
                                                ${isExpanded ? '▼' : '▶'}
                                            </button>
                                        </td>
                                        <td>${escapeHtml(c.name || '')}</td>
                                        <td><span class="badge ${c.status === 'active' ? 'badge-active' : c.status === 'forming' ? 'badge-trial' : 'badge-pending'}">${c.status === 'active' ? '正常' : c.status === 'forming' ? '组班中' : '已结课'}</span></td>
                                        <td>${escapeHtml(c.grade || '')}</td>
                                        <td>${escapeHtml(c.schedule || '')}</td>
                                        <td>${attendanceCount}</td>
                                        <td>${archivedStudents.length}</td>
                                        <td style="white-space:nowrap;">${c.archivedAt ? new Date(c.archivedAt).toLocaleString() : '-'}</td>
                                        <td>
                                            <button class="btn btn-secondary btn-xs" onclick="unarchiveClass('${c.id}')">放回列表</button>
                                            <button class="btn btn-danger btn-xs" onclick="permanentlyDeleteArchivedClass('${c.id}')">彻底删除</button>
                                        </td>
                                    </tr>
                                    ${isExpanded ? `
                                        <tr>
                                            <td colspan="9" style="padding:14px;background:var(--bg-card);">
                                                ${renderArchivedClassStudentList(c.id)}
                                            </td>
                                        </tr>
                                    ` : ''}
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
    const searchInput = document.getElementById('archivedClassSearch');
    if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
}

function toggleArchivedClassExpand(classId) {
    if (expandedArchivedClassIds.has(classId)) {
        expandedArchivedClassIds.delete(classId);
    } else {
        expandedArchivedClassIds.add(classId);
    }
    openArchivedClassManager();
}

function createArchivedClassStudentSnapshot(classId) {
    const ids = new Set();
    (data.students || []).forEach(s => {
        if ((s.classId === classId && isCurrentClassStudent(s)) || studentHasClassHistory(s, classId)) ids.add(String(s.id));
    });
    (data.attendance || []).filter(a => a.classId === classId).forEach(session => {
        Object.keys(session.records || {}).forEach(studentId => ids.add(studentId));
    });
    return [...ids].map(id => {
        const student = (data.students || []).find(s => s.id === id);
        return {
            id,
            name: student?.name || `未知学员(${id})`,
            grade: student?.grade || '',
            school: student?.school || '',
            status: student?.status || ''
        };
    });
}

function studentHasClassHistory(student, classId) {
    return Boolean(
        student &&
        (
            student.classJoinSessions?.[classId] !== undefined ||
            student.classLeaveSessions?.[classId] !== undefined
        )
    );
}

function getArchivedClassStudents(classId) {
    const cls = (data.classes || []).find(c => c.id === classId);
    const snapshot = Array.isArray(cls?.archivedStudentSnapshot) ? cls.archivedStudentSnapshot : [];
    const snapshotById = new Map(snapshot.map(s => [String(s.id), s]));
    const ids = new Set(snapshot.map(s => String(s.id)));
    (data.students || []).forEach(s => {
        if (s.classId === classId || studentHasClassHistory(s, classId)) ids.add(String(s.id));
    });
    (data.attendance || []).filter(a => a.classId === classId).forEach(session => {
        Object.keys(session.records || {}).forEach(studentId => ids.add(String(studentId)));
    });
    return [...ids].map(id => {
        const snap = snapshotById.get(id);
        const student = (data.students || []).find(s => String(s.id) === id);
        const attendanceCount = (data.attendance || []).filter(a => a.classId === classId && a.records && a.records[id] !== undefined).length;
        const presentCount = (data.attendance || []).filter(a => a.classId === classId && a.records && a.records[id] === 1).length;
        return {
            id,
            name: snap?.name || student?.name || `未知学员(${id})`,
            grade: snap?.grade || student?.grade || '',
            school: snap?.school || student?.school || '',
            status: snap?.status || student?.status || '',
            currentStatus: student?.status || '',
            attendanceCount,
            presentCount
        };
    }).sort((a, b) => (b.attendanceCount - a.attendanceCount) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function renderArchivedClassStudentList(classId) {
    const students = getArchivedClassStudents(classId);
    if (students.length === 0) {
        return '<div class="empty-state" style="padding:16px;">暂无关联学员或考勤记录</div>';
    }
    const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业' };
    return `
        <div style="font-weight:600;margin-bottom:10px;">历史学员 / 上课记录</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${students.map(s => `
                <span style="padding:6px 12px;background:var(--hover-bg);border-radius:16px;font-size:13px;display:flex;align-items:center;gap:6px;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${s.status === 'active' ? '#27ae60' : s.status === 'renewalPending' ? '#f39c12' : '#95a5a6'};"></span>
                    ${escapeHtml(s.name)}
                    ${s.grade ? `<span style="font-size:11px;color:#888;">${escapeHtml(s.grade)}</span>` : ''}
                    <span style="font-size:11px;color:#888;">${statusMap[s.status] || s.status || '未知状态'}</span>
                    <span style="font-size:11px;color:#888;">记录 ${s.attendanceCount} / 出勤 ${s.presentCount}</span>
                </span>
            `).join('')}
        </div>
    `;
}

async function unarchiveClass(classId) {
    const cls = (data.classes || []).find(c => c.id === classId);
    if (!cls) return;
    if (!cls.archived) {
        showToast('该班级已经在主列表');
        return;
    }
    if (!confirm(`确定把“${cls.name}”放回班级主列表吗？`)) return;
    try {
        await unarchiveClassFromApi(classId);
    } catch (error) {
        showToast('取消归档失败：' + error.message);
        return;
    }
    showToast('已放回班级主列表');
    openArchivedClassManager();
    render();
}

async function permanentlyDeleteArchivedClass(classId) {
    const cls = (data.classes || []).find(c => c.id === classId);
    if (!cls) return;
    if (!cls.archived) {
        showToast('只能彻底删除已归档班级');
        return;
    }
    const attendanceCount = (data.attendance || []).filter(a => a.classId === classId).length;
    const studentCount = (data.students || []).filter(s => s.classId === classId).length;
    const prospectCount = (data.prospects || []).filter(p => p.classId === classId).length;
    if (!confirm(`确定彻底删除归档班级“${cls.name}”吗？\n\n将同时清理：\n- 该班级资料\n- 该班级考勤课次 ${attendanceCount} 条\n- 学员/意向学员中的班级关联 ${studentCount + prospectCount} 条\n\n此操作适合清理测试数据。真实历史班级不建议删除。`)) return;
    if (!confirm('最后确认：彻底删除后只能通过服务器备份恢复。确定继续？')) return;
    try {
        await permanentlyDeleteArchivedClassFromApi(classId);
    } catch (error) {
        showToast('彻底删除失败：' + error.message);
        return;
    }
    showToast('已彻底删除归档班级及相关测试数据');
    openArchivedClassManager();
    render();
}

// 班级导入模板下载（含填写说明）
function downloadClassTemplate() {
    const templateRows = [
        ['班级名称', '年级', '班型', '上课时间', '学期', '满班人数', '状态', '计划课次', '暑假排课'],
        ['初一基础-周四18:00', '初一', '基础', '周四 18:00-20:00', '2025秋季', '10', 'active', '16', '周一至周五上午'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    formatExcelSheet(ws, templateRows, { maxWidth: 34 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级数据');

    const instructionRows = [
        ['班级导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['班级名称', '班级完整名称', '是', '如：初一基础-周四18:00'],
        ['年级', '年级', '选填', '五年级 / 六年级 / 初一 等'],
        ['班型', '班型分类', '选填', '基础 / 拔高 / 奥数 / 中考 等'],
        ['上课时间', '周几几点', '选填', '如：周四 18:00-20:00'],
        ['学期', '学期名称', '选填', '如：2025秋季，默认2025秋季'],
        ['满班人数', '最大人数', '选填', '数字，默认 10'],
        ['状态', '班级状态', '选填', 'active（默认正常）/ forming / finished / 正常 / 组班中 / 已结课'],
        ['计划课次', '本学期计划课次', '选填', '数字，默认 16'],
        ['暑假排课', '暑假排课安排', '选填', '如：周一至周五上午'],
        [''],
        ['注意事项'],
        ['1. 状态：active/正常=进行中，forming/组班中=组班中，finished/已结课=已结课，无法识别会导入失败并跳过'],
        ['2. 计划课次用于首页显示计划课次/已进行课次'],
        ['3. 旧模板（无计划课次列）导入时计划课次默认为 16'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instructionRows);
    formatExcelSheet(instrWs, instructionRows, { autoFilter: false, maxWidth: 46 });
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
    XLSX.writeFile(wb, '班级导入模板.xlsx');
    showToast('模板已下载');
}

// 导入班级Excel（兼容旧模板：旧模板无计划课次列）
function importClasses(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            const checkResult = precheckClassImport(rows);
            showImportPreCheck({
                title: '班级导入预览',
                checkResult,
                actionLabel: '导入班级',
                duplicateStrategy: 'skip',
                onConfirm: (strategies) => executeClassImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function precheckClassImport(rows) {
    const statusMap = { 'active': 'active', '正常': 'active', 'forming': 'forming', '组班中': 'forming', 'finished': 'finished', '已结课': 'finished' };
    const validRows = [];
    const errors = [];
    const duplicates = [];
    const skippedDetails = [];
    let skipped = 0;
    let failed = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        if (!row[0]) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写班级名称' }); continue; }

        const row7 = row[7];
        const isNewFormat = row7 !== undefined && row7 !== null && String(row7).trim() !== '' && !isNaN(Number(row7));
        const name = String(row[0]).trim();
        const schedule = String(row[3] || '').trim();
        const rawStatus = String(row[6] || '').trim().toLowerCase();
        if (rawStatus && !statusMap[rawStatus]) {
            errors.push({ row: rowNum, msg: `状态"${rawStatus}"无法识别` });
            failed++;
            continue;
        }

        const isDupe = data.classes.some(c =>
            normalizeTextForMatch(c.name) === normalizeTextForMatch(name) &&
            normalizeTextForMatch(c.schedule) === normalizeTextForMatch(schedule)
        );
        if (isDupe) {
            duplicates.push({ row: rowNum, msg: `${name} / ${schedule || '上课时间空'}` });
        }

        validRows.push({ row, isNewFormat, name, schedule, status: statusMap[rawStatus] || 'active', isDupe });
    }

    const total = Math.max(rows.length - 1, 0);
    const dup = validRows.filter(v => v.isDupe).length;
    return { total, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, duplicates, skippedDetails, validRows };
}

async function executeClassImport(checkResult, strategies = {}) {
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    let imported = 0;
    let replaced = 0;
    let skipped = checkResult.skip || 0;

    for (const v of checkResult.validRows) {
        if (v.isDupe) {
            if (dupeStrategy === 'skip') { skipped++; continue; }
            const idx = data.classes.findIndex(c =>
                normalizeTextForMatch(c.name) === normalizeTextForMatch(v.name) &&
                normalizeTextForMatch(c.schedule) === normalizeTextForMatch(v.schedule)
            );
            if (idx !== -1) {
                data.classes[idx] = {
                    id: data.classes[idx].id,
                    name: v.name,
                    grade: String(v.row[1] || '初一').trim(),
                    classType: String(v.row[2] || '基础').trim(),
                    schedule: v.schedule,
                    semester: String(v.row[4] || '2025秋季').trim(),
                    maxStudents: parseInt(v.row[5]) || 10,
                    status: v.status,
                    plannedSessions: v.isNewFormat ? parseInt(v.row[7]) : (data.classes[idx].plannedSessions || 16),
                    summerSchedule: v.isNewFormat ? String(v.row[8] || '').trim() : String(v.row[7] || '').trim()
                };
                replaced++;
                imported++;
                continue;
            }
        }
        data.classes.push({
            id: generateId(),
            name: v.name,
            grade: String(v.row[1] || '初一').trim(),
            classType: String(v.row[2] || '基础').trim(),
            schedule: v.schedule,
            semester: String(v.row[4] || '2025秋季').trim(),
            maxStudents: parseInt(v.row[5]) || 10,
            status: v.status,
            plannedSessions: v.isNewFormat ? parseInt(v.row[7]) : 16,
            summerSchedule: v.isNewFormat ? String(v.row[8] || '').trim() : String(v.row[7] || '').trim()
        });
        imported++;
    }

    try {
        await saveClassesToApi(data.classes);
    } catch (error) {
        showToast('导入保存失败：' + error.message);
        return;
    }
    render();
    const msg = `导入完成：成功 ${imported} 个${replaced > 0 ? `，替换 ${replaced} 个` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}${failed > 0 ? `，失败 ${failed} 条` : ''}`;
    showToast(msg);
    showImportResultSummary({
        imported, replaced, skipped, failed,
        total: checkResult.total,
        actionLabel: '班级导入',
        failedDetails: checkResult.errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
}

function openClassMemberManager(classId) {
    const cls = data.classes.find(c => c.id === classId);
    if (!cls) return;

    if (cls.status === 'forming') {
        // 组班中：从意向学员中拉入/移出
        const formingProspects = (data.prospects || []).filter(p => p.trialStatus === 'forming');
        const inClass = formingProspects.filter(p => p.classId === classId);
        const notInClass = formingProspects.filter(p => p.classId !== classId);
        const sameGrade = notInClass.filter(p => p.grade === cls.grade);
        const otherGrade = notInClass.filter(p => p.grade !== cls.grade);

        document.getElementById('modalTitle').textContent = '管理组班成员';
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom: 16px;">
                <input type="text" id="memberSearchInput" placeholder="搜索意向学员姓名..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 8px;">已在组班 (${inClass.length}人)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">
                    ${inClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可移出成员</div>' : inClass.map(p => `
                        <span style="padding: 6px 12px; background: #fff3cd; border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                            ${escapeHtml(p.name)}
                            <button onclick="removeProspectFromClass('${p.id}', '${classId}')" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 12px; padding: 0 2px;">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div id="notInClassSection">
                <div style="font-weight: 600; margin-bottom: 8px;">可选意向学员 (点击加入组班)</div>
                <div id="memberSameGrade" style="margin-bottom: 12px;">
                    ${sameGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #27ae60; font-size: 13px;">同年级 (${sameGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${sameGrade.map(p => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addProspectToClass('${p.id}', '${classId}')">${escapeHtml(p.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : ''}
                </div>
                <div id="memberOtherGrade">
                    ${otherGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #888; font-size: 13px;">其他年级 (${otherGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${otherGrade.map(p => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addProspectToClass('${p.id}', '${classId}')">${escapeHtml(p.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : ''}
                </div>
                ${notInClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可加入成员</div>' : ''}
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
        document.getElementById('memberSearchInput').addEventListener('input', (e) => filterClassMemberList(classId, 'forming'));
    } else {
        // 正常/已结课班级：班内展示在读和待续费，拉入仍只从在读学员中选择
        const inClass = data.students.filter(s => s.classId === classId && isCurrentClassStudent(s));
        const notInClass = data.students.filter(s => s.classId !== classId && s.status === 'active');
        const sameGrade = notInClass.filter(s => s.grade === cls.grade);
        const otherGrade = notInClass.filter(s => s.grade !== cls.grade);

        document.getElementById('modalTitle').textContent = '管理班级成员';
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom: 16px;">
                <input type="text" id="memberSearchInput" placeholder="搜索学员姓名..." style="width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 8px;">班级成员 (${inClass.length}人)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">
                    ${inClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无成员</div>' : inClass.map(s => `
                        <span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${s.status === 'renewalPending' ? '#f39c12' : '#27ae60'};"></span>
                            ${escapeHtml(s.name)}
                            ${s.status === 'renewalPending' ? '<span style="font-size: 11px; color: #f39c12;">待续费</span>' : ''}
                            <button onclick="removeStudentFromClass('${s.id}', '${classId}')" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 12px; padding: 0 2px;">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div id="notInClassSection">
                <div id="memberSameGrade" style="margin-bottom: 12px;">
                    ${sameGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #27ae60; font-size: 13px;">同年级 (${sameGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${sameGrade.map(s => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addStudentToClass('${s.id}', '${classId}')">${escapeHtml(s.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : ''}
                </div>
                <div id="memberOtherGrade">
                    ${otherGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #888; font-size: 13px;">其他年级 (${otherGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${otherGrade.map(s => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addStudentToClass('${s.id}', '${classId}')">${escapeHtml(s.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : ''}
                </div>
                ${notInClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可加入学员</div>' : ''}
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
        document.getElementById('memberSearchInput').addEventListener('input', (e) => filterClassMemberList(classId, 'active'));
    }
    document.getElementById('modal').classList.add('show');
}

function filterClassMemberList(classId, mode) {
    const search = document.getElementById('memberSearchInput')?.value?.toLowerCase()?.trim() || '';
    const cls = data.classes.find(c => c.id === classId);
    const section = document.getElementById('notInClassSection');
    if (!section) return;

    if (mode === 'forming') {
        const formingProspects = (data.prospects || []).filter(p => p.trialStatus === 'forming');
        const notInClass = formingProspects.filter(p => p.classId !== classId);
        let sameGrade = notInClass.filter(p => p.grade === cls?.grade);
        let otherGrade = notInClass.filter(p => p.grade !== cls?.grade);

        if (search) {
            sameGrade = sameGrade.filter(p => p.name.toLowerCase().includes(search));
            otherGrade = otherGrade.filter(p => p.name.toLowerCase().includes(search));
        }

        const sameEl = document.getElementById('memberSameGrade');
        const otherEl = document.getElementById('memberOtherGrade');
        if (sameEl) {
            sameEl.innerHTML = sameGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #27ae60; font-size: 13px;">${search ? '符合条件' : '同年级'} (${sameGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${sameGrade.map(p => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addProspectToClass('${p.id}', '${classId}')">${escapeHtml(p.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : (search ? `<div style="color:#888;font-size:13px;margin-bottom:8px;">无符合条件学员</div>` : '');
        }
        if (otherEl) {
            otherEl.innerHTML = otherGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #888; font-size: 13px;">${search ? '符合条件' : '其他年级'} (${otherGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${otherGrade.map(p => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addProspectToClass('${p.id}', '${classId}')">${escapeHtml(p.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : '';
        }
    } else {
        const notInClass = data.students.filter(s => s.classId !== classId && s.status === 'active');
        const cls = data.classes.find(c => c.id === classId);
        let sameGrade = notInClass.filter(s => s.grade === cls?.grade);
        let otherGrade = notInClass.filter(s => s.grade !== cls?.grade);

        if (search) {
            sameGrade = sameGrade.filter(s => s.name.toLowerCase().includes(search));
            otherGrade = otherGrade.filter(s => s.name.toLowerCase().includes(search));
        }

        const sameEl = document.getElementById('memberSameGrade');
        const otherEl = document.getElementById('memberOtherGrade');
        if (sameEl) {
            sameEl.innerHTML = sameGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #27ae60; font-size: 13px;">${search ? '符合条件' : '同年级'} (${sameGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${sameGrade.map(s => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addStudentToClass('${s.id}', '${classId}')">${escapeHtml(s.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : (search ? `<div style="color:#888;font-size:13px;margin-bottom:8px;">无符合条件学员</div>` : '');
        }
        if (otherEl) {
            otherEl.innerHTML = otherGrade.length > 0 ? `<div style="font-weight: 600; margin-bottom: 8px; color: #888; font-size: 13px;">${search ? '符合条件' : '其他年级'} (${otherGrade.length}人)</div><div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 160px; overflow-y: auto;">${otherGrade.map(s => `<span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addStudentToClass('${s.id}', '${classId}')">${escapeHtml(s.name)}<span style="color:#27ae60; font-size: 12px;">+</span></span>`).join('')}</div>` : '';
        }
    }
}

async function addStudentToClass(studentId, classId) {
    const s = data.students.find(st => st.id === studentId);
    if (s) {
        const oldClassId = s.classId;
        s.classJoinSessions = s.classJoinSessions || {};
        s.classLeaveSessions = s.classLeaveSessions || {};
        if (oldClassId && oldClassId !== classId) {
            const oldClassLastRecord = getClassStudentLastRecordedSessionIndex(studentId, oldClassId);
            if (oldClassLastRecord > 0) {
                s.classLeaveSessions[oldClassId] = oldClassLastRecord;
            }
        }
        if (!oldClassId || oldClassId === classId || getClassStudentLastRecordedSessionIndex(studentId, oldClassId) > 0) {
            const newClassSessionCount = data.attendance.filter(a => a.classId === classId).length;
            s.classJoinSessions[classId] = Math.max(newClassSessionCount + 1, 1);
        }
        delete s.classLeaveSessions[classId];
        s.classId = classId;
    }
    try {
        await saveStudentsToApi(data.students);
    } catch (error) {
        showToast('加入班级失败：' + error.message);
        return;
    }
    openClassMemberManager(classId);
    showToast('已加入班级');
}

async function removeStudentFromClass(studentId, classId) {
    const s = data.students.find(st => st.id === studentId);
    if (s) {
        s.classLeaveSessions = s.classLeaveSessions || {};
        const lastRecord = getClassStudentLastRecordedSessionIndex(studentId, classId);
        if (lastRecord > 0) {
            s.classLeaveSessions[classId] = lastRecord;
        }
        s.classId = '';
    }
    try {
        await saveStudentsToApi(data.students);
    } catch (error) {
        showToast('移出班级失败：' + error.message);
        return;
    }
    openClassMemberManager(classId);
    showToast('已移出班级');
}

function getClassStudentLastRecordedSessionIndex(studentId, classId) {
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

async function addProspectToClass(prospectId, classId) {
    const p = (data.prospects || []).find(pt => pt.id === prospectId);
    if (p) { p.classId = classId; p.trialStatus = 'forming'; }
    try {
        await saveProspectsToApi(data.prospects);
    } catch (error) {
        showToast('加入组班失败：' + error.message);
        return;
    }
    openClassMemberManager(classId);
    showToast('已加入组班');
}

async function removeProspectFromClass(prospectId, classId) {
    const p = (data.prospects || []).find(pt => pt.id === prospectId);
    if (p) { p.classId = ''; }
    try {
        await saveProspectsToApi(data.prospects);
    } catch (error) {
        showToast('移出组班失败：' + error.message);
        return;
    }
    openClassMemberManager(classId);
    showToast('已移出组班');
}
