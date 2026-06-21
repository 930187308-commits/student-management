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
    const sessions = data.attendance.filter(a => a.classId === classId).sort((a, b) => a.date.localeCompare(b.date));
    const recordStudentIds = new Set();
    sessions.forEach(sess => Object.keys(sess.records || {}).forEach(id => recordStudentIds.add(id)));
    const students = data.students.filter(s =>
        (s.classId === classId && s.status === 'active') ||
        recordStudentIds.has(s.id)
    );

    // 补齐旧记录缺失的 id
    let patchedSessionIds = false;
    sessions.forEach(sess => {
        if (!sess.id) {
            sess.id = generateId();
            patchedSessionIds = true;
        }
    });
    if (patchedSessionIds) saveAttendanceToApi(data.attendance).catch(error => showToast('考勤保存失败：' + error.message));

    // 获取所有有记录的日期
    const allDates = [...new Set(sessions.map(s => s.date))].sort();

    // 班级基本信息栏
    const classInfoBar = `
        <div style="display: flex; gap: 12px; flex-wrap: wrap; padding: 8px 12px; background: var(--hover-bg); border-radius: 8px; margin-bottom: 12px; font-size: 13px;">
            <div><span style="color:#888;">班级：</span><strong>${escapeHtml(cls?.name || '')}</strong></div>
            <div><span style="color:#888;">上课：</span>${escapeHtml(cls?.schedule || '-')}</div>
            <div><span style="color:#888;">课次：</span><strong style="color:#27ae60;">${sessions.length}</strong><span style="color:#888;">/${cls?.plannedSessions || 16}</span></div>
            <div><span style="color:#888;">学员：</span><strong>${data.students.filter(s => s.classId === classId && s.status === 'active').length}</strong><span style="color:#888;">人</span></div>
        </div>
    `;

    let tableHtml = '';
    if (students.length === 0) {
        tableHtml = '<div class="empty-state" style="padding:24px;text-align:center;color:#888;">暂无学员，请先在班级管理中添加学员。</div>';
    } else if (allDates.length === 0) {
        tableHtml = '<div class="empty-state" style="padding:24px;text-align:center;color:#888;">暂无考勤课次，请先新增课次或导入考勤。</div>';
    } else {
        tableHtml = `
            <div class="attendance-scroll">
            <table class="attendance-table">
                <thead>
                    <tr>
                        <th style="min-width:80px;position:sticky;left:0;background:#fafafa;z-index:2;border-right:1px solid var(--table-border);">学员</th>
                        ${allDates.map((d, i) => {
                            const sess = sessions.find(s => s.date === d);
                            return `<th style="min-width:60px;">
                                <span title="${sess?.sessionName || '第'+(i+1)+'次'}">${sess?.sessionName || '第'+(i+1)+'次'}</span><br>
                                <small>${d}</small>
                                <details class="attendance-session-menu">
                                    <summary title="课次操作">⋯</summary>
                                    <div class="attendance-session-actions">
                                        <button type="button" onclick="openEditAttendanceSession('${sess.id}')">编辑</button>
                                        <button type="button" class="danger" onclick="deleteAttendanceSession('${sess.id}')">删除</button>
                                    </div>
                                </details>
                            </th>`;
                        }).join('')}
                        <th style="min-width:50px;">出勤</th>
                        <th style="min-width:50px;">请假</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(s => {
                        const totalSessions = allDates.length;
                        let present = 0, absent = 0;
                        const joinSession = getStudentJoinSessionForClass(s, classId);
                        const leaveSession = getStudentLeaveSessionForClass(s, classId);
                        const inactiveStatusMap = { inactive: '停课', withdrawn: '退费', graduated: '毕业' };
                        const inactiveLabel = inactiveStatusMap[s.status] || '';
                        const isTransferredOut = s.classId !== classId && recordStudentIds.has(s.id);
                        const isTransferredIn = s.classId === classId && joinSession > 1;
                        const studentMarker = inactiveLabel || (isTransferredOut ? '转出' : '') || (isTransferredIn ? '转入' : '');
                        allDates.forEach(date => {
                            const session = sessions.find(sess => sess.date === date);
                            const status = session?.records?.[s.id];
                            if (status === 1) present++;
                            else if (status === 0) absent++;
                        });
                        return `
                            <tr>
                                <td style="position:sticky;left:0;background:#fafafa;z-index:1;border-right:1px solid var(--table-border);">${escapeHtml(s.name)}${studentMarker ? `<br><span style="font-size:10px;color:#888;">${studentMarker}</span>` : ''}</td>
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
            </div>
            <div style="margin-top: 12px; display: flex; gap: 12px; align-items: center;">
                <span style="font-size: 12px; color: #888;">说明：1=正常出勤 0=请假，空=未记录。停课/转出/转入标记在姓名旁。</span>
                <button class="btn btn-secondary btn-sm" onclick="exportAttendance()">导出Excel</button>
            </div>
        `;
    }

    // 显示临时学员
    const tempStudentsSection = sessions.length > 0 && allDates.length > 0 ? renderTemporaryStudentsSection(classId, sessions, allDates) : '';

    content.innerHTML = classInfoBar + tableHtml + tempStudentsSection;
}

function getStudentJoinSessionForClass(student, classId) {
    if (student.classJoinSessions?.[classId]) return student.classJoinSessions[classId];
    if (student.classId !== classId) return 1;

    const otherClassLastRecords = data.classes
        .filter(c => c.id !== classId)
        .map(c => getLastRecordedSessionIndex(student.id, c.id));
    const lastOtherClassRecord = Math.max(0, ...otherClassLastRecords);
    return lastOtherClassRecord > 0 ? lastOtherClassRecord + 1 : 1;
}

function getStudentLeaveSessionForClass(student, classId) {
    if (student.classLeaveSessions?.[classId]) return student.classLeaveSessions[classId];
    if (student.classId === classId) return Infinity;
    const lastRecord = getLastRecordedSessionIndex(student.id, classId);
    return lastRecord > 0 ? lastRecord : Infinity;
}

function getLastRecordedSessionIndex(studentId, classId) {
    const sessions = data.attendance
        .filter(a => a.classId === classId)
        .sort((a, b) => a.date.localeCompare(b.date));
    let lastIndex = 0;
    sessions.forEach((sess, index) => {
        if (sess.records && sess.records[studentId] !== undefined) {
            lastIndex = index + 1;
        }
    });
    return lastIndex;
}

function renderTemporaryStudentsSection(classId, sessions, allDates) {
    // 收集所有临时学员
    const tempMap = {}; // tempStudentKey -> { studentId, fromClassId, note, dates, isTempHere }
    sessions.forEach(sess => {
        (sess.temporaryStudents || []).forEach(ts => {
            const key = ts.studentId;
            if (!tempMap[key]) {
                tempMap[key] = { studentId: ts.studentId, fromClassId: ts.fromClassId, note: ts.note || '', dates: {}, isTempHere: {} };
            }
            tempMap[key].dates[sess.date] = sess.records?.[ts.studentId];
            tempMap[key].isTempHere[sess.date] = true;
        });
    });

    const tempStudents = Object.values(tempMap);
    if (tempStudents.length === 0) {
        const sessionOptions = sessions.map((sess, i) => `<option value="${sess.date}">${escapeHtml(sess.sessionName || '第'+(i+1)+'次')} - ${sess.date}</option>`).join('');
        return `<div style="margin-top: 20px; padding: 12px; background: var(--hover-bg); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #2c3e50;">临时调课学员</strong>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="tempSessionSelect" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color);">${sessionOptions}</select>
                    <button class="btn btn-success btn-sm" onclick="openAddTempStudentModal(document.getElementById('tempSessionSelect').value)">+ 添加临时学员</button>
                </div>
            </div>
            <div class="empty-state" style="padding: 20px;">暂无临时调课记录</div>
        </div>`;
    }

    return `<div style="margin-top: 20px; padding: 12px; background: var(--hover-bg); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="color: #2c3e50;">临时调课学员 <span style="font-size: 12px; color: #888;">（临时到本班上课）</span></strong>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select id="tempSessionSelect" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color);">${sessions.map((sess, i) => `<option value="${sess.date}">${escapeHtml(sess.sessionName || '第'+(i+1)+'次')} - ${sess.date}</option>`).join('')}</select>
                <button class="btn btn-success btn-sm" onclick="openAddTempStudentModal(document.getElementById('tempSessionSelect').value)">+ 添加临时学员</button>
            </div>
        </div>
        <div class="attendance-scroll">
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
                                const isTempHere = ts.isTempHere[date];
                                if (!isTempHere) {
                                    return `<td style="color: #ccc; text-align: center;">-</td>`;
                                }
                                return `<td>
                                    <input type="number" min="0" max="1" value="${status ?? ''}" class="attendance-input ${cls}" data-date="${date}" data-student="${ts.studentId}" data-temp="true" onchange="updateAttendance(this)">
                                    <br><button class="btn btn-danger btn-xs" style="margin-top:4px;" onclick="removeTemporaryStudent('${ts.studentId}', '${date}')">移除</button>
                                </td>`;
                            }).join('')}
                            <td><strong style="color:#27ae60;">${present}</strong></td>
                            <td><strong style="color:#e74c3c;">${absent}</strong></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    </div>`;
}

function openAddTempStudentModal(date) {
    if (!currentAttendanceClassId) { showToast('请先选择班级'); return; }
    if (!date) { showToast('请选择课次'); return; }

    const session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === date);
    const sessionInfo = session ? `${session.sessionName || date} (${date})` : date;

    document.getElementById('modalTitle').textContent = '添加临时学员 - ' + sessionInfo;
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

async function saveTempStudent(e) {
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

    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    loadAttendanceClass(currentAttendanceClassId);
    showToast('已添加临时学员');
}

async function removeTemporaryStudent(studentId, date) {
    if (!confirm('确定从本次课移除该临时学员？')) return;

    const session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === date);
    if (!session) return;

    if (session.temporaryStudents) {
        session.temporaryStudents = session.temporaryStudents.filter(ts => ts.studentId !== studentId);
    }
    delete session.records?.[studentId];

    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
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

async function saveAttendanceSession(e) {
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

    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    loadAttendanceClass(currentAttendanceClassId);
    const count = data.attendance.filter(a => a.classId === currentAttendanceClassId).length;
    showToast(`已添加第${count}次课：${sessionName}`);
}

function openEditAttendanceSession(sessionId) {
    const session = data.attendance.find(a => a.id === sessionId);
    if (!session) return;

    document.getElementById('modalTitle').textContent = '编辑课次';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveEditAttendanceSession(event, '${sessionId}')">
            <div style="margin-bottom: 12px; padding: 10px; background: #e8f4fd; border-radius: 6px; font-size: 13px; color: #2980b9;">
                编辑课次名称/日期后，学员出勤状态（1/0/空）保持不变。
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>课程名称</label>
                    <input type="text" name="sessionName" value="${escapeHtml(session.sessionName || '')}" placeholder="如：秋季第3课-三角函数" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>上课日期 *</label>
                    <input type="date" name="date" value="${session.date}" required>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
            </div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

async function saveEditAttendanceSession(e, sessionId) {
    e.preventDefault();
    const form = e.target;
    const newDate = form.date.value;
    const newSessionName = form.sessionName.value;

    const session = data.attendance.find(a => a.id === sessionId);
    if (!session) return;

    // 检查日期冲突（同班级已有其他课次）
    if (newDate !== session.date) {
        const exists = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === newDate && a.id !== sessionId);
        if (exists) { showToast('该日期已存在'); return; }
    }

    session.date = newDate;
    session.sessionName = newSessionName;
    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    loadAttendanceClass(currentAttendanceClassId);
    showToast('已保存课次信息');
}

async function deleteAttendanceSession(sessionId) {
    const session = data.attendance.find(a => a.id === sessionId);
    if (!session) return;
    const recordCount = Object.keys(session.records || {}).length;
    if (!confirm(`确定删除「${session.sessionName || session.date}」吗？\n\n将删除该课次所有 ${recordCount} 名学员的考勤记录，此操作不可恢复。`)) return;

    data.attendance = data.attendance.filter(a => a.id !== sessionId);
    await createServerBackup('删除考勤课次前自动备份');
    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    loadAttendanceClass(currentAttendanceClassId);
    showToast('已删除本次考勤');
}

async function updateAttendance(input) {
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
        try {
            await saveAttendanceToApi(data.attendance);
        } catch (error) {
            showToast('保存失败：' + error.message);
        }
    }
}

function exportAttendance() {
    if (!currentAttendanceClassId) return;

    const cls = data.classes.find(c => c.id === currentAttendanceClassId);
    const students = data.students.filter(s => s.classId === currentAttendanceClassId && s.status === 'active');
    const sessions = data.attendance.filter(a => a.classId === currentAttendanceClassId).sort((a, b) => a.date.localeCompare(b.date));
    const allDates = [...new Set(sessions.map(s => s.date))].sort();

    const sessionHeader = ['学员姓名', ...allDates.map((d, i) => {
        const session = sessions.find(sess => sess.date === d);
        return session?.sessionName || `第${i+1}次`;
    }), '出勤次数', '请假次数'];
    const dateHeader = ['上课日期', ...allDates, '', ''];
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

    const ws = XLSX.utils.aoa_to_sheet([sessionHeader, dateHeader, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考勤记录');
    XLSX.writeFile(wb, `${cls?.name || '考勤记录'}.xlsx`);
    showToast('导出成功');
}

// 下载考勤导入模板（含填写说明）
function downloadAttendanceTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['学员姓名', '第1次', '第2次', '第3次', '第4次'],
        ['上课日期', '2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22'],
        ['张三', '1', '1', '0', ''],
        ['李四', '1', '', '1', '1'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考勤数据');

    const instrWs = XLSX.utils.aoa_to_sheet([
        ['考勤导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['第1行', '课次名称', '是', '第1次 / 第2次，也可写课程名'],
        ['第2行', '上课日期', '推荐填写', 'yyyy-mm-dd，如 2026-05-01'],
        ['第1列', '学员姓名', '是', '如：张三'],
        ['考勤状态', '1=正常出勤，0=请假，空值=不记录', '选填', '1 / 0 / 空'],
        [''],
        ['注意事项'],
        ['1. 必须先在系统中选择班级，再导入该班考勤'],
        ['2. 优先按第2行日期匹配课次；日期不存在会自动新建课次'],
        ['3. 如果日期为空，则按当前班级已有课次顺序匹配第N次，不会自动新建'],
        ['4. 学员姓名只在当前班级在读学员中匹配，姓名空格会自动忽略'],
        ['5. 如果已有同学同课次记录，预检查中会提示重复，可选择保留或替换'],
    ]);
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
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

            const checkResult = precheckAttendanceImport(rows);
            showImportPreCheck({
                title: '考勤导入预览',
                checkResult,
                actionLabel: '导入考勤',
                duplicateStrategy: 'skip',
                onConfirm: (strategies) => executeAttendanceImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function parseAttendanceStatus(value) {
    if (value === '' || value == null) return null;
    const text = String(value).trim();
    if (text === '') return null;
    if (text === '1' || text === '出勤' || text === '到课') return 1;
    if (text === '0' || text === '请假' || text === '缺勤') return 0;
    return undefined;
}

function precheckAttendanceImport(rows) {
    const validRows = [];
    const errors = [];
    const warnings = [];
    const duplicates = [];
    const skippedDetails = [];
    const existingSessions = data.attendance
        .filter(a => a.classId === currentAttendanceClassId)
        .sort((a, b) => a.date.localeCompare(b.date));
    const students = data.students.filter(s => s.classId === currentAttendanceClassId && s.status === 'active');
    const seen = new Set();
    let skipped = 0;
    let failed = 0;
    let readCount = 0;

    if (rows.length < 3) {
        return { total: 0, success: 0, dup: 0, fail: 1, skip: 0, errors: [{ row: 1, msg: '考勤宽表至少需要课次行、日期行和学员行' }], warnings: [], skippedDetails: [], validRows: [] };
    }

    const headers = rows[0] || [];
    const dates = rows[1] || [];
    const columnMeta = [];
    for (let col = 1; col < headers.length; col++) {
        const label = String(headers[col] || '').trim();
        if (!label || /出勤|请假|合计|次数/.test(label)) continue;
        const date = normalizeExcelDate(dates[col]);
        const existingByDate = date ? existingSessions.find(s => s.date === date) : null;
        const existingByIndex = !date ? existingSessions[col - 1] : null;
        if (!date && !existingByIndex) {
            warnings.push({ row: 2, msg: `${label} 未填写日期，且系统内没有对应第${col}次课，该列有记录时会失败` });
        }
        columnMeta.push({ col, label, date, existingSession: existingByDate || existingByIndex || null });
    }

    for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx] || [];
        const rowNum = rowIdx + 1;
        if (!row[0]) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写学员姓名' }); continue; }

        const studentName = String(row[0]).trim();
        const matchedStudents = students.filter(s => normalizeNameForMatch(s.name) === normalizeNameForMatch(studentName));
        if (matchedStudents.length === 0) {
            errors.push({ row: rowNum, msg: `学员"${studentName}"不存在于当前班级在读学员` });
            failed++;
            continue;
        }
        if (matchedStudents.length > 1) {
            const names = matchedStudents.map(s => `"${s.name}"`).join('、');
            errors.push({ row: rowNum, msg: `学员"${studentName}"匹配到多个（${names}），请先改名区分` });
            failed++;
            continue;
        }
        const student = matchedStudents[0];

        for (const meta of columnMeta) {
            const status = parseAttendanceStatus(row[meta.col]);
            if (status === null) continue;
            readCount++;
            if (status === undefined) {
                errors.push({ row: rowNum, msg: `${meta.label} 考勤状态"${row[meta.col]}"无效` });
                failed++;
                continue;
            }
            if (!meta.date && !meta.existingSession) {
                errors.push({ row: rowNum, msg: `${meta.label} 未填写日期，且系统内没有对应课次` });
                failed++;
                continue;
            }

            const sessionKey = meta.date || meta.existingSession.date;
            const key = `${student.id}|${sessionKey}`;
            if (seen.has(key)) {
                errors.push({ row: rowNum, msg: `${student.name} 在 ${sessionKey} 重复出现` });
                failed++;
                continue;
            }
            seen.add(key);

            const isDupe = !!(meta.existingSession && meta.existingSession.records && meta.existingSession.records[student.id] !== undefined);
            if (isDupe) {
                duplicates.push({ row: rowNum, msg: `${student.name} / ${sessionKey} / ${meta.label}` });
            }
            validRows.push({ student, status, date: sessionKey, sessionName: meta.label, existingSession: meta.existingSession, isDupe });
        }
    }

    const dup = validRows.filter(v => v.isDupe).length;
    return { total: readCount, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, warnings, duplicates, skippedDetails, validRows };
}

async function executeAttendanceImport(checkResult, strategies = {}) {
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    let imported = 0;
    let replaced = 0;
    let skipped = checkResult.skip || 0;

    for (const v of checkResult.validRows) {
        if (v.isDupe && dupeStrategy === 'skip') { skipped++; continue; }

        let session = data.attendance.find(a => a.classId === currentAttendanceClassId && a.date === v.date);
        if (!session) {
            session = {
                id: generateId(),
                classId: currentAttendanceClassId,
                date: v.date,
                sessionName: v.sessionName,
                records: {}
            };
            data.attendance.push(session);
        } else if (!session.sessionName && v.sessionName) {
            session.sessionName = v.sessionName;
        }

        if (session.records && session.records[v.student.id] !== undefined) replaced++;
        if (!session.records) session.records = {};
        session.records[v.student.id] = v.status;
        imported++;
    }

    try {
        await saveAttendanceToApi(data.attendance);
    } catch (error) {
        showToast('导入保存失败：' + error.message);
        return;
    }
    loadAttendanceClass(currentAttendanceClassId);
    const msg = `导入完成：成功 ${imported} 条${replaced > 0 ? `，替换 ${replaced} 条` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}`;
    showToast(msg);
    showImportResultSummary({
        imported, replaced, skipped, failed: checkResult.fail,
        total: checkResult.total,
        actionLabel: '考勤记录导入',
        failedDetails: checkResult.errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
}
