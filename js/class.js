// ==================== 班级管理 ====================

let expandedClassId = null;

function renderClasses() {
    const container = document.getElementById('tab-classes');
    const grades = [...new Set(data.classes.map(c => c.grade))];

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <select id="classGradeFilter" onchange="renderClasses()">
                        <option value="">全部年级</option>
                        ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                    <select id="classStatusFilter" onchange="renderClasses()">
                        <option value="">全部状态</option>
                        <option value="active">正常</option>
                        <option value="forming">组班中</option>
                        <option value="finished">已结课</option>
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-secondary btn-sm" onclick="openClassTypeManager()">管理班型</button>
                    <button class="btn btn-secondary btn-sm" onclick="openGradeManager()">管理年级</button>
                    <button class="btn btn-primary" onclick="openClassModal()">+ 新增班级</button>
                    <div class="divider"></div>
                    <button class="btn btn-secondary" onclick="downloadClassTemplate()">下载导入模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning">导入班级</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importClasses(event)">
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th style="width: 40px;"></th><th>班级名称</th><th>年级</th><th>班型</th><th>上课时间</th><th>人数/满班</th><th>满班率</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
                        ${data.classes.filter(c => {
                            const gradeFilter = document.getElementById('classGradeFilter')?.value || '';
                            const statusFilter = document.getElementById('classStatusFilter')?.value || '';
                            return (!gradeFilter || c.grade === gradeFilter) && (!statusFilter || c.status === statusFilter);
                        }).map(c => {
                            const count = c.status === 'forming'
                                ? (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length
                                : data.students.filter(s => s.classId === c.id && s.status === 'active').length;
                            const fillRate = Math.round((count / c.maxStudents) * 100);
                            const isExpanded = expandedClassId === c.id;
                            return `
                                <tr style="background: var(--hover-bg);">
                                    <td style="text-align: center;">
                                        <button onclick="toggleClassExpand('${c.id}')" style="background: none; border: none; cursor: pointer; font-size: 14px; color: #666; padding: 4px;">
                                            ${isExpanded ? '▼' : '▶'}
                                        </button>
                                    </td>
                                    <td><strong style="cursor: pointer; color: #3498db;" onclick="toggleClassExpand('${c.id}')">${c.name}</strong></td>
                                    <td>${c.grade}</td>
                                    <td>${c.classType}</td>
                                    <td>${c.schedule}</td>
                                    <td>${count}/${c.maxStudents}</td>
                                    <td><span class="badge ${fillRate >= 80 ? 'badge-active' : fillRate >= 50 ? 'badge-normal' : 'badge-trial'}">${fillRate}%</span></td>
                                    <td><span class="badge ${c.status === 'active' ? 'badge-active' : c.status === 'forming' ? 'badge-trial' : 'badge-pending'}">${c.status === 'active' ? '正常' : c.status === 'forming' ? '组班中' : '已结课'}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-xs" onclick="openClassModal('${c.id}')">编辑</button>
                                        <button class="btn btn-danger btn-xs" onclick="deleteClass('${c.id}')">删除</button>
                                    </td>
                                </tr>
                                ${isExpanded ? `
                                    <tr>
                                        <td colspan="9" style="padding: 16px; background: var(--bg-card); border-bottom: 1px solid var(--table-border);">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                                <strong style="color: #2c3e50;">${c.status === 'forming' ? '组班成员' : '班级学员列表'}</strong>
                                                <div style="display: flex; gap: 8px;">
                                                    <button class="btn btn-success btn-sm" onclick="openClassMemberManager('${c.id}')">管理成员</button>
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="switchToStudentTab(); setTimeout(() => { const s = document.getElementById('studentClassFilter'); if(s) s.value='${c.id}'; renderStudentList(); }, 100)">查看全部学员</button>` : ''}
                                                    ${c.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="exportClassStudents('${c.id}')">导出学员</button>` : ''}
                                                </div>
                                            </div>
                                            ${count === 0 && c.status !== 'forming' ? '<div class="empty-state" style="padding: 20px;">该班级暂无在读学员</div>' : ''}
                                            ${c.status === 'active' && data.students.filter(s => s.classId === c.id && s.status === 'active').length > 0 ? `
                                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                                    ${data.students.filter(s => s.classId === c.id && s.status === 'active').map(s => `
                                                        <span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #27ae60;"></span>
                                                            ${escapeHtml(s.name)}
                                                            ${s.school ? `<span style="font-size: 11px; color: #888;">(${escapeHtml(s.school)})</span>` : ''}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            ${c.status === 'forming' && (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length > 0 ? `
                                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                                    ${(data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').map(p => `
                                                        <span style="padding: 6px 12px; background: #fff3cd; border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #f39c12;"></span>
                                                            ${escapeHtml(p.name)}
                                                            ${p.grade ? `<span style="font-size: 11px; color: #888;">(${escapeHtml(p.grade)})</span>` : ''}
                                                        </span>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            ${c.status === 'forming' && (data.prospects || []).filter(p => p.classId === c.id && p.trialStatus === 'forming').length === 0 ? '<div class="empty-state" style="padding: 20px;">该组班暂无意向学员</div>' : ''}
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
    expandedClassId = expandedClassId === classId ? null : classId;
    renderClasses();
}

function exportClassStudents(classId) {
    const cls = data.classes.find(c => c.id === classId);
    const students = data.students.filter(s => s.classId === classId && s.status === 'active');
    if (students.length === 0) { showToast('该班级无学员'); return; }
    const headers = ['姓名', '性别', '年级', '授课老师', '联系电话', '就读学校', '状态', '备注'];
    const rows = students.map(s => [s.name, s.gender, s.grade, s.teacher, s.phone || '', s.school || '', s.status === 'active' ? '在读' : s.status, s.remark || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级学员');
    XLSX.writeFile(wb, `${cls?.name || '班级学员'}.xlsx`);
    showToast('导出成功');
}

function switchToStudentTab() {
    document.querySelector('[data-tab="students"]').click();
}

function openClassTypeManager() {
    document.getElementById('modalTitle').textContent = '班型管理';
    const typeList = (data.classTypes || []).map((t, idx) => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--hover-bg); border-radius: 6px; margin-bottom: 8px;">
            <span style="flex:1;">${escapeHtml(t)}</span>
            <button class="btn btn-danger btn-xs" onclick="deleteClassTypeByIdx(${idx})">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <input type="text" id="newClassTypeName" placeholder="新班型名称" style="flex:1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
            <button class="btn btn-success btn-sm" onclick="addClassType()">添加</button>
        </div>
        <div>${typeList || '<div class="empty-state">暂无班型</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function addClassType() {
    const name = document.getElementById('newClassTypeName').value.trim();
    if (!name) { showToast('请输入班型名称'); return; }
    if (!data.classTypes) data.classTypes = [];
    if (data.classTypes.includes(name)) { showToast('该班型已存在'); return; }
    data.classTypes.push(name);
    saveData();
    openClassTypeManager();
    showToast('班型已添加');
}

function deleteClassTypeByIdx(idx) {
    if (!confirm('删除该班型？')) return;
    data.classTypes.splice(idx, 1);
    saveData();
    openClassTypeManager();
    showToast('班型已删除');
}

function openGradeManager() {
    document.getElementById('modalTitle').textContent = '年级管理';
    const grades = (data.gradeOptions || ['五年级', '六年级', '初一', '初二', '初三', '新初一']);
    const gradeList = grades.map((g, idx) => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--hover-bg); border-radius: 6px; margin-bottom: 8px;">
            <span style="flex:1;">${escapeHtml(g)}</span>
            <button class="btn btn-danger btn-xs" onclick="deleteGradeByIdx(${idx})">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <input type="text" id="newGradeName" placeholder="新年级名称" style="flex:1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
            <button class="btn btn-success btn-sm" onclick="addGrade()">添加</button>
        </div>
        <div>${gradeList || '<div class="empty-state">暂无年级</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function addGrade() {
    const name = document.getElementById('newGradeName').value.trim();
    if (!name) { showToast('请输入年级名称'); return; }
    if (!data.gradeOptions) data.gradeOptions = ['五年级', '六年级', '初一', '初二', '初三', '新初一'];
    if (data.gradeOptions.includes(name)) { showToast('该年级已存在'); return; }
    data.gradeOptions.push(name);
    saveData();
    openGradeManager();
    showToast('年级已添加');
}

function deleteGradeByIdx(idx) {
    if (!confirm('删除该年级？')) return;
    data.gradeOptions.splice(idx, 1);
    saveData();
    openGradeManager();
    showToast('年级已删除');
}

function getGradeOptions() {
    return data.gradeOptions || ['五年级', '六年级', '初一', '初二', '初三', '新初一'];
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

function saveClass(e) {
    e.preventDefault();
    const form = e.target;
    const classData = {
        id: currentEditId || generateId(),
        name: form.name.value, grade: form.grade.value, classType: form.classType.value,
        schedule: form.schedule.value, semester: form.semester.value,
        maxStudents: parseInt(form.maxStudents.value), status: form.status.value,
        plannedSessions: parseInt(form.plannedSessions?.value || 16),
        summerSchedule: form.summerSchedule.value
    };
    if (currentEditId) {
        const index = data.classes.findIndex(c => c.id === currentEditId);
        data.classes[index] = classData;
    } else {
        data.classes.push(classData);
    }
    saveData();
    closeModal();
    showToast('保存成功');
    render();
}

function deleteClass(id) {
    if (!confirm('删除班级后，班级下学员将变为"未分班"状态。确定删除？')) return;
    data.classes = data.classes.filter(c => c.id !== id);
    data.students.forEach(s => { if (s.classId === id) s.classId = ''; });
    saveData();
    showToast('删除成功');
    render();
}

// 班级导入模板下载（含计划课次）
function downloadClassTemplate() {
    const headers = [['班级名称', '年级', '班型', '上课时间', '学期', '满班人数', '状态', '计划课次', '暑假排课']];
    const sampleRows = [['初一基础-周四18:00', '初一', '基础', '周四 18:00-20:00', '2025秋季', '10', 'active', '16', '周一至周五上午']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级导入模板');
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

            let imported = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue; // 班级名称必填

                // 兼容旧模板：row[7] 是否为数字（计划课次），决定新模板还是旧模板
                const row7 = row[7];
                const isNewFormat = row7 !== undefined && row7 !== null && String(row7).trim() !== '' && !isNaN(Number(row7));

                const classData = {
                    id: generateId(),
                    name: String(row[0]).trim(),
                    grade: String(row[1] || '初一').trim(),
                    classType: String(row[2] || '基础').trim(),
                    schedule: String(row[3] || '').trim(),
                    semester: String(row[4] || '2025秋季').trim(),
                    maxStudents: parseInt(row[5]) || 10,
                    status: String(row[6] || 'active').trim(),
                    plannedSessions: isNewFormat ? parseInt(row7) : 16,
                    summerSchedule: isNewFormat ? String(row[8] || '').trim() : String(row7 || '').trim()
                };
                data.classes.push(classData);
                imported++;
            }

            saveData();
            render();
            showToast(`成功导入 ${imported} 个班级`);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function openClassMemberManager(classId) {
    const cls = data.classes.find(c => c.id === classId);
    if (!cls) return;

    if (cls.status === 'forming') {
        // 组班中：从意向学员中拉入/移出
        const formingProspects = (data.prospects || []).filter(p => p.trialStatus === 'forming');
        const inClass = formingProspects.filter(p => p.classId === classId);
        const notInClass = formingProspects.filter(p => p.classId !== classId);

        document.getElementById('modalTitle').textContent = '管理组班成员';
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 8px;">已在组班 (${inClass.length}人)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 200px; overflow-y: auto;">
                    ${inClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可移出成员</div>' : inClass.map(p => `
                        <span style="padding: 6px 12px; background: #fff3cd; border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                            ${escapeHtml(p.name)}
                            <button onclick="removeProspectFromClass('${p.id}', '${classId}')" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 12px; padding: 0 2px;">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div>
                <div style="font-weight: 600; margin-bottom: 8px;">可选意向学员 (点击加入组班)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 200px; overflow-y: auto;">
                    ${notInClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可加入成员</div>' : notInClass.map(p => `
                        <span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addProspectToClass('${p.id}', '${classId}')">
                            ${escapeHtml(p.name)}
                            <span style="color:#27ae60; font-size: 12px;">+</span>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
    } else {
        // 正常班级：从正式学员中拉入/移出
        const inClass = data.students.filter(s => s.classId === classId && s.status === 'active');
        const notInClass = data.students.filter(s => s.classId !== classId && s.status === 'active');

        document.getElementById('modalTitle').textContent = '管理班级成员';
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 8px;">班级成员 (${inClass.length}人)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 200px; overflow-y: auto;">
                    ${inClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无成员</div>' : inClass.map(s => `
                        <span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                            ${escapeHtml(s.name)}
                            <button onclick="removeStudentFromClass('${s.id}', '${classId}')" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 12px; padding: 0 2px;">×</button>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div>
                <div style="font-weight: 600; margin-bottom: 8px;">可选在读学员 (点击加入班级)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 200px; overflow-y: auto;">
                    ${notInClass.length === 0 ? '<div style="color:#888;font-size:13px;">暂无可加入学员</div>' : notInClass.map(s => `
                        <span style="padding: 6px 12px; background: var(--hover-bg); border-radius: 16px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="addStudentToClass('${s.id}', '${classId}')">
                            ${escapeHtml(s.name)}
                            <span style="color:#27ae60; font-size: 12px;">+</span>
                        </span>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
    }
    document.getElementById('modal').classList.add('show');
}

function addStudentToClass(studentId, classId) {
    const s = data.students.find(st => st.id === studentId);
    if (s) s.classId = classId;
    saveData();
    openClassMemberManager(classId);
    showToast('已加入班级');
}

function removeStudentFromClass(studentId, classId) {
    const s = data.students.find(st => st.id === studentId);
    if (s) s.classId = '';
    saveData();
    openClassMemberManager(classId);
    showToast('已移出班级');
}

function addProspectToClass(prospectId, classId) {
    const p = (data.prospects || []).find(pt => pt.id === prospectId);
    if (p) { p.classId = classId; p.trialStatus = 'forming'; }
    saveData();
    openClassMemberManager(classId);
    showToast('已加入组班');
}

function removeProspectFromClass(prospectId, classId) {
    const p = (data.prospects || []).find(pt => pt.id === prospectId);
    if (p) { p.classId = ''; p.trialStatus = 'pending'; }
    saveData();
    openClassMemberManager(classId);
    showToast('已移出组班');
}

