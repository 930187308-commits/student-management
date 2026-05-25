// ==================== 考勤记录 ====================

let currentAttendanceClassId = null;

function renderAttendance() {
    const container = document.getElementById('tab-attendance');
    const classes = data.classes.filter(c => c.status === 'active');

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <select id="attendanceClassSelect" onchange="loadAttendanceClass(this.value)">
                        <option value="">请选择班级</option>
                        ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="addAttendanceSession()">+ 新增课次</button>
                    <div class="divider"></div>
                    <button class="btn btn-secondary btn-sm" onclick="downloadAttendanceTemplate()">下载模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning btn-sm">导入考勤</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importAttendance(event)">
                    </div>
                </div>
            </div>
            <div id="attendanceContent">
                <div class="empty-state">请先选择班级</div>
            </div>
        </div>
    `;
    container.innerHTML = html;

    if (currentAttendanceClassId) {
        document.getElementById('attendanceClassSelect').value = currentAttendanceClassId;
        loadAttendanceClass(currentAttendanceClassId);
    }
}

function loadAttendanceClass(classId) {
    currentAttendanceClassId = classId;
    const content = document.getElementById('attendanceContent');
    if (!classId) { content.innerHTML = '<div class="empty-state">请先选择班级</div>'; return; }

    const cls = data.classes.find(c => c.id === classId);
    const students = data.students.filter(s => s.classId === classId && s.status === 'active');
    const sessions = data.attendance.filter(a => a.classId === classId).sort((a, b) => a.date.localeCompare(b.date));

    // 获取所有有记录的日期
    const allDates = [...new Set(sessions.map(s => s.date))].sort();

    let tableHtml = '';
    if (students.length === 0) {
        tableHtml = '<div class="empty-state">该班级暂无学员</div>';
    } else if (allDates.length === 0) {
        tableHtml = '<div class="empty-state">暂无考勤记录，请点击"新增课次"添加上课日期</div>';
    } else {
        tableHtml = `
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th style="min-width:80px;">学员</th>
                        ${allDates.map((d, i) => {
                            const sess = sessions.find(s => s.date === d);
                            return `<th style="min-width:60px;">${sess?.sessionName || '第'+(i+1)+'次'}<br><small>${d}</small></th>`;
                        }).join('')}
                        <th style="min-width:50px;">出勤</th>
                        <th style="min-width:50px;">请假</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => {
                        const totalSessions = allDates.length;
                        let present = 0, absent = 0;
                        allDates.forEach(date => {
                            const session = sessions.find(sess => sess.date === date);
                            const status = session?.records?.[s.id];
                            if (status === 1) present++;
                            else if (status === 0) absent++;
                        });
                        return `
                            <tr>
                                <td>${s.name}</td>
                                ${allDates.map((date, i) => {
                                    const session = sessions.find(sess => sess.date === date);
                                    const status = session?.records?.[s.id];
                                    const cls = status === 1 ? 'present' : status === 0 ? 'absent' : '';
                                    return `<td><input type="number" min="0" max="1" value="${status ?? ''}" class="attendance-input ${cls}" data-date="${date}" data-student="${s.id}" onchange="updateAttendance(this)"></td>`;
                                }).join('')}
                                <td><strong>${present}</strong></td>
                                <td><strong style="color:#e74c3c;">${absent}</strong></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 12px; display: flex; gap: 12px; align-items: center;">
                <span style="font-size: 12px; color: #888;">说明：1=正常出勤 0=请假，空=未记录</span>
                <button class="btn btn-secondary btn-sm" onclick="exportAttendance()">导出Excel</button>
            </div>
        `;
    }

    // 显示临时学员
    const tempStudentsSection = sessions.length > 0 && allDates.length > 0 ? renderTemporaryStudentsSection(classId, sessions, allDates) : '';

    content.innerHTML = tableHtml + tempStudentsSection;
}

function renderTemporaryStudentsSection(classId, sessions, allDates) {
    // 收集所有临时学员
    const tempMap = {}; // tempStudentKey -> { studentId, fromClassId, note, dates }
    sessions.forEach(sess => {
        (sess.temporaryStudents || []).forEach(ts => {
            const key = ts.studentId;
            if (!tempMap[key]) {
                tempMap[key] = { studentId: ts.studentId, fromClassId: ts.fromClassId, note: ts.note || '', dates: {} };
            }
            tempMap[key].dates[sess.date] = sess.records?.[ts.studentId];
        });
    });

    const tempStudents = Object.values(tempMap);
    if (tempStudents.length === 0) {
        return `<div style="margin-top: 20px; padding: 12px; background: var(--hover-bg); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #2c3e50;">临时调课学员</strong>
                <button class="btn btn-success btn-sm" onclick="openAddTempStudentModal('${allDates[0]}')">+ 添加临时学员</button>
            </div>
            <div class="empty-state" style="padding: 20px;">暂无临时调课记录</div>
        </div>`;
    }

    return `<div style="margin-top: 20px; padding: 12px; background: var(--hover-bg); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="color: #2c3e50;">临时调课学员 <span style="font-size: 12px; color: #888;">（临时到本班上课）</span></strong>
            <button class="btn btn-success btn-sm" onclick="openAddTempStudentModal('${allDates[0]}')">+ 添加临时学员</button>
        </div>
        <table class="attendance-table">
            <thead>
                <tr>
                    <th style="min-width:80px;">学员</th>
                    <th style="min-width:60px;">来源班级</th>
                    ${allDates.map((d, i) => {
                        const sess = sessions.find(s => s.date === d);
                        return `<th style="min-width:60px;">${sess?.sessionName || '第'+(i+1)+'次'}<br><small>${d}</small></th>`;
                    }).join('')}
                    <th style="min-width:50px;">出勤</th>
                    <th style="min-width:50px;">请假</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${tempStudents.map(ts => {
                    const student = data.students.find(s => s.id === ts.studentId);
                    if (!student) return '';
                    const fromClass = data.classes.find(c => c.id === ts.fromClassId);
                    let present = 0, absent = 0;
                    allDates.forEach(date => {
                        const status = ts.dates[date];
                        if (status === 1) present++;
                        else if (status === 0) absent++;
                    });
                    return `
                        <tr style="background: #fff3cd;">
                            <td><span style="font-weight: 600;">${escapeHtml(student.name)}</span> <span style="font-size: 10px; background: #f39c12; color: white; padding: 1px 4px; border-radius: 3px;">临时</span></td>
                            <td style="font-size: 12px; color: #888;">${escapeHtml(fromClass?.name || '-')}</td>
                            ${allDates.map((date, i) => {
                                const sess = sessions.find(s => s.date === date);
                                const status = ts.dates[date];
                                const cls = status === 1 ? 'present' : status === 0 ? 'absent' : '';
                                return `<td><input type="number" min="0" max="1" value="${status ?? ''}" class="attendance-input ${cls}" data-date="${date}" data-student="${ts.studentId}" data-temp="true" onchange="updateAttendance(this)"></td>`;
                            }).join('')}
                            <td><strong style="color:#27ae60;">${present}</strong></td>
                            <td><strong style="color:#e74c3c;">${absent}</strong></td>
                            <td><button class="btn btn-danger btn-xs" onclick="removeTemporaryStudent('${ts.studentId}')">移除</button></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>`;
}

function openAddTempStudentModal(date) {
    if (!currentAttendanceClassId) { showToast('请先选择班级'); return; }

    document.getElementById('modalTitle').textContent = '添加临时学员';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveTempStudent(event)">
            <input type="hidden" name="date" value="${date}">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>搜索学员 *</label>
                    <input type="text" id="tempStudentSearch" placeholder="输入学员姓名搜索..." autocomplete="off" oninput="filterTempStudentList()" style="width: 100%;">
                    <select id="tempStudentSelect" size="5" style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectTempStudent(this)"></select>
                    <input type="hidden" name="studentId" id="tempStudentId">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>来源班级（自动）</label>
                    <select id="tempFromClassSelect" style="width: 100%;">
                        <option value="">选择学员后自动显示</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>备注</label><input type="text" id="tempNote" placeholder="如：临时调课" style="width: 100%;"></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">添加</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function filterTempStudentList() {
    const input = document.getElementById('tempStudentSearch');
    const select = document.getElementById('tempStudentSelect');
    const fromClassSelect = document.getElementById('tempFromClassSelect');
    const hiddenInput = document.getElementById('tempStudentId');
    const search = input.value.toLowerCase().trim();

    if (search.length === 0) {
        select.style.display = 'none';
        hiddenInput.value = '';
        fromClassSelect.innerHTML = '<option value="">选择学员后自动显示</option>';
        return;
    }

    // 只显示不在当前班级的活跃学员
    const filtered = data.students.filter(s =>
        s.name.toLowerCase().includes(search) &&
        s.classId !== currentAttendanceClassId &&
        s.status === 'active'
    );

    select.innerHTML = filtered.map(s => `<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.grade)}</option>`).join('');

    if (filtered.length > 0) {
        select.style.display = 'block';
        select.size = Math.min(filtered.length, 5);
    } else {
        select.style.display = 'none';
    }
    hiddenInput.value = '';
    fromClassSelect.innerHTML = '<option value="">选择学员后自动显示</option>';
}

function selectTempStudent(select) {
    const hiddenInput = document.getElementById('tempStudentId');
    const searchInput = document.getElementById('tempStudentSearch');
    const fromClassSelect = document.getElementById('tempFromClassSelect');
    const selectedOption = select.options[select.selectedIndex];
    const studentId = select.value;
    hiddenInput.value = studentId;
    searchInput.value = selectedOption.text;
    select.style.display = 'none';

    const student = data.students.find(s => s.id === studentId);
    if (student) {
        const cls = data.classes.find(c => c.id === student.classId);
        fromClassSelect.innerHTML = `<option value="${student.classId || ''}">${escapeHtml(cls?.name || '未分班')}</option>`;
    }
}

function saveTempStudent(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('tempStudentId').value;
    const date = form.date.value;
    const note = document.getElementById('tempNote').value;

    if (!studentId) { showToast('请从下拉列表选择学员'); return; }

    const student = data.students.find(s => s.id === studentId);
    if (!student) { showToast('学员不存在'); return; }

    // 检查是否已在records中（不管是本班还是临时）
    const session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === date);
    if (!session) { showToast('考勤课次不存在'); return; }

    // 如果已在records中有记录，弹出提示
    if (session.records?.[studentId] !== undefined) {
        showToast('该学员已在本班考勤记录中');
        return;
    }

    // 检查temporaryStudents是否已添加过
    const existingTemp = (session.temporaryStudents || []).find(ts => ts.studentId === studentId);
    if (existingTemp) {
        showToast('该临时学员已在本次课中');
        return;
    }

    if (!session.temporaryStudents) session.temporaryStudents = [];
    session.temporaryStudents.push({
        studentId: studentId,
        fromClassId: student.classId || '',
        note: note
    });

    saveData();
    closeModal();
    loadAttendanceClass(currentAttendanceClassId);
    showToast('已添加临时学员');
}

function removeTemporaryStudent(studentId) {
    if (!confirm('确定从本次课移除该临时学员？')) return;

    const session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === document.querySelector('[data-date]')?.dataset.date || '');
    // 找到包含该临时学员的所有session
    data.attendance.forEach(sess => {
        if (sess.classId === currentAttendanceClassId) {
            if (sess.temporaryStudents) {
                sess.temporaryStudents = sess.temporaryStudents.filter(ts => ts.studentId !== studentId);
            }
            delete sess.records?.[studentId];
        }
    });

    saveData();
    loadAttendanceClass(currentAttendanceClassId);
    showToast('已移除临时学员');
}

function addAttendanceSession() {
    if (!currentAttendanceClassId) { showToast('请先选择班级'); return; }

    document.getElementById('modalTitle').textContent = '新增课次';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveAttendanceSession(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>课程名称</label>
                    <input type="text" name="sessionName" placeholder="如：秋季第3课-三角函数" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>上课日期 *</label>
                    <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">添加</button>
            </div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function saveAttendanceSession(e) {
    e.preventDefault();
    const form = e.target;
    const date = form.date.value;
    const sessionName = form.sessionName.value;

    if (data.attendance.some(a => a.classId === currentAttendanceClassId && a.date === date)) {
        showToast('该日期已存在');
        return;
    }

    const records = {}; // 空记录，用户手动填写

    data.attendance.push({
        id: generateId(),
        classId: currentAttendanceClassId,
        date: date,
        sessionName: sessionName,
        records: records
    });

    saveData();
    closeModal();
    loadAttendanceClass(currentAttendanceClassId);
    const count = data.attendance.filter(a => a.classId === currentAttendanceClassId).length;
    showToast(`已添加第${count}次课：${sessionName}`);
}

function updateAttendance(input) {
    const date = input.dataset.date;
    const studentId = input.dataset.student;
    const rawValue = input.value.trim();
    const value = rawValue === '' ? null : parseInt(rawValue, 10);

    // 验证输入
    if (value !== 0 && value !== 1 && value !== null) {
        input.value = '';
        return;
    }

    // 更新样式
    input.className = 'attendance-input';
    if (value === 1) input.classList.add('present');
    else if (value === 0) input.classList.add('absent');

    // 找到对应的考勤记录并更新
    const session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === date);
    if (session) {
        if (value === 1 || value === 0) {
            session.records[studentId] = value;
        } else {
            delete session.records[studentId];
        }
        saveData();
    }
}

function exportAttendance() {
    if (!currentAttendanceClassId) return;

    const cls = data.classes.find(c => c.id === currentAttendanceClassId);
    const students = data.students.filter(s => s.classId === currentAttendanceClassId && s.status === 'active');
    const sessions = data.attendance.filter(a => a.classId === currentAttendanceClassId).sort((a, b) => a.date.localeCompare(b.date));
    const allDates = [...new Set(sessions.map(s => s.date))].sort();

    const headers = ['学员', ...allDates.map((d, i) => `第${i+1}次(${d})`), '出勤次数', '请假次数'];
    const rows = students.map(s => {
        let present = 0, absent = 0;
        const recordValues = allDates.map(date => {
            const session = sessions.find(sess => sess.date === date);
            const status = session?.records?.[s.id];
            if (status === 1) { present++; return '1'; }
            else if (status === 0) { absent++; return '0'; }
            return '';
        });
        return [s.name, ...recordValues, present, absent];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考勤记录');
    XLSX.writeFile(wb, `${cls?.name || '考勤记录'}.xlsx`);
    showToast('导出成功');
}

// 下载考勤导入模板
function downloadAttendanceTemplate() {
    const headers = [['上课日期', '学员姓名', '考勤状态']];
    const sampleRows = [['2025-10-15', '张三', '1'], ['2025-10-15', '李四', '1'], ['2025-10-15', '王五', '0']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考勤导入模板');
    XLSX.writeFile(wb, '考勤导入模板.xlsx');
    showToast('模板已下载');
}

// 导入考勤Excel
function importAttendance(event) {
    if (!currentAttendanceClassId) { showToast('请先选择班级'); return; }

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
                if (!row[0] || !row[1]) continue; // 日期和学员姓名必填

                const date = String(row[0]).trim();
                const studentName = String(row[1]).trim();
                const status = row[2] === 1 || row[2] === '1' ? 1 : (row[2] === 0 || row[2] === '0' ? 0 : null);

                // 查找学员
                const student = data.students.find(s => s.name === studentName && s.classId === currentAttendanceClassId);
                if (!student || status === null) continue;

                // 查找或创建考勤记录
                let session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === date);
                if (!session) {
                    session = { id: generateId(), classId: currentAttendanceClassId, date: date, records: {} };
                    data.attendance.push(session);
                }
                session.records[student.id] = status;
                imported++;
            }

            saveData();
            loadAttendanceClass(currentAttendanceClassId);
            showToast(`成功导入 ${imported} 条考勤记录`);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}
