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
                <span style="font-size: 12px; color: #888;">说明：1=正常出勤 0=请假</span>
                <button class="btn btn-secondary btn-sm" onclick="exportAttendance()">导出Excel</button>
            </div>
        `;
    }

    content.innerHTML = tableHtml;
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
    const value = parseInt(input.value);

    // 验证输入
    if (value !== 0 && value !== 1 && value !== '') {
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