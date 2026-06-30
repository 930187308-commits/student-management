// ==================== 学员管理 ====================

let currentStudentTab = 'active'; // active / renewalPending / inactive
let studentBatchMode = false;
let studentListFilters = { grade: '', classId: '', search: '' };

const STUDENT_DEFAULT_GRADES = ['五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];
const STUDENT_GRADE_UPGRADE_MAP = {
    '五年级': '六年级',
    '六年级': '初一',
    '初一': '初二',
    '初二': '初三',
    '高一': '高二',
    '高二': '高三'
};

function getStudentGradeOptions(currentGrade = '') {
    const options = [...new Set([...(data.gradeOptions || []), ...STUDENT_DEFAULT_GRADES, currentGrade].filter(Boolean))]
        .filter(g => g !== '新初一');
    return options.length ? options : STUDENT_DEFAULT_GRADES;
}

function getGradeSchoolStage(grade = '') {
    if (['五年级', '六年级'].includes(grade)) return 'primary';
    if (['初一', '初二', '初三', '七年级', '八年级', '九年级'].includes(grade)) return 'middle';
    if (['高一', '高二', '高三'].includes(grade)) return 'high';
    return '';
}

function getSchoolHistory(student = {}) {
    const history = student.schoolHistory || {};
    const result = {
        primarySchool: String(history.primarySchool || '').trim(),
        middleSchool: String(history.middleSchool || '').trim(),
        highSchool: String(history.highSchool || '').trim()
    };
    const legacySchool = String(student.school || '').trim();
    const stage = getGradeSchoolStage(student.grade || '');
    if (legacySchool) {
        if (stage === 'primary' && !result.primarySchool) result.primarySchool = legacySchool;
        if (stage === 'middle' && !result.middleSchool) result.middleSchool = legacySchool;
        if (stage === 'high' && !result.highSchool) result.highSchool = legacySchool;
    }
    return result;
}

function getCurrentStageSchool(student = {}) {
    const history = getSchoolHistory(student);
    const stage = getGradeSchoolStage(student.grade || '');
    if (stage === 'primary') return { stage, stageText: '小学', school: history.primarySchool || '' };
    if (stage === 'middle') return { stage, stageText: '初中', school: history.middleSchool || '' };
    if (stage === 'high') return { stage, stageText: '高中', school: history.highSchool || '' };
    return { stage: '', stageText: '未判断', school: '' };
}

function getLegacySchoolFromHistory(grade, schoolHistory, fallback = '') {
    const stageInfo = getCurrentStageSchool({ grade, schoolHistory, school: fallback });
    return stageInfo.school || fallback || '';
}

function getCommunicationStatusText(status = '') {
    const map = { pending: '待沟通', done: '已完成' };
    return map[status] || status || '已记录';
}

function syncStudentListFiltersFromDom() {
    studentListFilters = {
        grade: document.getElementById('studentGradeFilter')?.value || '',
        classId: document.getElementById('studentClassFilter')?.value || '',
        search: document.getElementById('studentSearchInput')?.value || ''
    };
}

function renderStudents() {
    const container = document.getElementById('tab-students');
    const grades = [...new Set(data.classes.map(c => c.grade))];

    let html = `
        <div class="two-col">
            <div class="left-panel">
                <div class="student-panel-header">
                    <div class="student-tab-actions">
                        <button class="btn btn-sm ${currentStudentTab === 'active' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentTab('active')">在读</button>
                        <button class="btn btn-sm ${currentStudentTab === 'renewalPending' ? 'btn-warning' : 'btn-secondary'}" onclick="switchStudentTab('renewalPending')">待续费</button>
                        <button class="btn btn-sm ${currentStudentTab === 'inactive' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentTab('inactive')">非在读</button>
                    </div>
                    <button class="student-add-pill" onclick="openStudentModal()">+ 新增</button>
                </div>

                <div class="student-filter-row">
                    <select id="studentGradeFilter" class="student-filter-control" onchange="onGradeFilterChange()">
                        <option value="">全部年级</option>
                        ${grades.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                    <select id="studentClassFilter" class="student-filter-control" onchange="renderStudentList()">
                        <option value="">全部班级</option>
                    </select>
                </div>
                <input type="text" id="studentSearchInput" class="student-filter-control student-search-control" placeholder="搜索学员姓名..." oninput="renderStudentList()">

                <div id="studentCountBar" class="student-count-bar"></div>
                <div class="student-list" id="studentList"></div>
                <div class="student-panel-actions">
                    <button class="btn btn-secondary student-panel-action-btn" onclick="downloadStudentTemplate()">下载模板</button>
                    <div class="file-input-wrapper student-panel-file-action">
                        <button class="btn btn-warning student-panel-action-btn">导入</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importStudents(event)">
                    </div>
                    <button class="btn btn-secondary btn-sm student-panel-action-btn" onclick="toggleStudentBatchMode()">${studentBatchMode ? '退出多选' : '多选'}</button>
                    <button class="btn btn-secondary btn-sm student-panel-action-btn" onclick="openGradeUpgradePreview()">升年级预览</button>
                </div>
                ${studentBatchMode ? `<div id="studentBatchBar" class="student-batch-bar">
                    <span>已选择 <strong id="studentSelectedCount">0</strong> 条</span>
                    <button class="btn btn-secondary btn-xs" onclick="toggleAllStudentSelection(this)">全选</button>
                </div>` : ''}
                ${studentBatchMode ? `<div class="student-batch-actions">
                    <button class="btn btn-secondary btn-sm student-panel-action-btn" onclick="exportSelectedStudents()">导出选中</button>
                    <button class="btn btn-danger btn-sm student-panel-action-btn" onclick="deleteSelectedStudents()">删除选中</button>
                </div>` : ''}
            </div>
            <div class="student-panel-resizer" id="studentPanelResizer" title="拖动调整学员列表宽度"></div>
            <div class="right-panel" id="studentDetail">
                <div class="empty-state">请选择左侧学员查看详情</div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    initStudentPanelResize();
    const gradeSelect = document.getElementById('studentGradeFilter');
    const searchInput = document.getElementById('studentSearchInput');
    if (gradeSelect) gradeSelect.value = studentListFilters.grade || '';
    if (searchInput) searchInput.value = studentListFilters.search || '';
    onGradeFilterChange(studentListFilters.classId || '');
    if (currentStudentId && data.students.some(s => s.id === currentStudentId)) {
        renderStudentDetail();
    } else {
        currentStudentId = null;
    }
}

function initStudentPanelResize() {
    const layout = document.querySelector('#tab-students .two-col');
    const resizer = document.getElementById('studentPanelResizer');
    if (!layout || !resizer) return;

    const minWidth = 240;
    const maxWidth = 420;
    const storageKey = 'studentManageStudentPanelWidth';

    const applyWidth = (width) => {
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
        layout.style.setProperty('--student-panel-width', `${nextWidth}px`);
        return nextWidth;
    };

    const savedWidth = Number(localStorage.getItem(storageKey));
    if (savedWidth) {
        const normalizedWidth = applyWidth(savedWidth);
        if (normalizedWidth !== savedWidth) {
            localStorage.setItem(storageKey, String(normalizedWidth));
        }
    }

    resizer.addEventListener('pointerdown', (event) => {
        if (window.matchMedia('(max-width: 860px)').matches) return;
        event.preventDefault();
        resizer.setPointerCapture(event.pointerId);
        document.body.classList.add('student-panel-resizing');

        const handleMove = (moveEvent) => {
            const left = layout.getBoundingClientRect().left;
            applyWidth(moveEvent.clientX - left);
        };

        const finishResize = (upEvent) => {
            const left = layout.getBoundingClientRect().left;
            const finalWidth = applyWidth(upEvent.clientX - left);
            localStorage.setItem(storageKey, String(finalWidth));
            document.body.classList.remove('student-panel-resizing');
            if (resizer.hasPointerCapture(upEvent.pointerId)) {
                resizer.releasePointerCapture(upEvent.pointerId);
            }
            resizer.removeEventListener('pointermove', handleMove);
            resizer.removeEventListener('pointerup', finishResize);
            resizer.removeEventListener('pointercancel', finishResize);
        };

        resizer.addEventListener('pointermove', handleMove);
        resizer.addEventListener('pointerup', finishResize);
        resizer.addEventListener('pointercancel', finishResize);
    });
}

function switchStudentTab(tab) {
    syncStudentListFiltersFromDom();
    currentStudentTab = tab;
    renderStudents();
}

function onGradeFilterChange(preferredClassId = '') {
    const grade = document.getElementById('studentGradeFilter').value;
    const classSelect = document.getElementById('studentClassFilter');
    const classes = grade ? data.classes.filter(c => c.grade === grade && c.status === 'active') : data.classes.filter(c => c.status === 'active');
    classSelect.innerHTML = `<option value="">全部班级</option><option value="__unassigned__">未分班</option>${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
    const targetClassId = preferredClassId || studentListFilters.classId || '';
    if ([...classSelect.options].some(option => option.value === targetClassId)) {
        classSelect.value = targetClassId;
    } else {
        classSelect.value = '';
    }
    syncStudentListFiltersFromDom();
    renderStudentList();
}

function renderStudentList() {
    syncStudentListFiltersFromDom();
    const grade = document.getElementById('studentGradeFilter')?.value || '';
    const classId = document.getElementById('studentClassFilter')?.value || '';
    const search = document.getElementById('studentSearchInput')?.value?.toLowerCase() || '';

    const tabStudents = data.students.filter(s => {
        if (currentStudentTab === 'active' && s.status !== 'active') return false;
        if (currentStudentTab === 'renewalPending' && s.status !== 'renewalPending') return false;
        if (currentStudentTab === 'inactive' && (s.status === 'active' || s.status === 'renewalPending' || !s.status)) return false;
        return true;
    });

    const filteredBeforeSearch = tabStudents.filter(s => {
        if (grade && s.grade !== grade) return false;
        if (classId === '__unassigned__' && s.classId) return false;
        if (classId && classId !== '__unassigned__' && s.classId !== classId) return false;
        return true;
    });

    const filtered = filteredBeforeSearch.filter(s => {
        if (search && !s.name.toLowerCase().includes(search)) return false;
        return true;
    }).sort((a, b) => {
        const aTime = a.createdAt || a.enrollDate || '';
        const bTime = b.createdAt || b.enrollDate || '';
        if (bTime > aTime) return 1;
        if (bTime < aTime) return -1;
        return (a.name || '').localeCompare(b.name || '');
    });

    const countBar = document.getElementById('studentCountBar');
    if (countBar) {
        const filterLabel = grade || (classId ? '当前筛选' : '');
        if (search) {
            countBar.textContent = `当前 ${filtered.length} 名 / 筛选前 ${filteredBeforeSearch.length} 名`;
        } else if (filterLabel) {
            countBar.textContent = `${filterLabel}：${filtered.length} 名 / 本栏共 ${tabStudents.length} 名`;
        } else {
            countBar.textContent = `当前 ${filtered.length} 名 / 本栏共 ${tabStudents.length} 名`;
        }
    }

    const list = document.getElementById('studentList');
    list.innerHTML = filtered.map(s => {
        const cls = data.classes.find(c => c.id === s.classId);
        const statusMap = { active: '在读', forming: '组班中（旧）', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业' };
        const statusText = statusMap[s.status] || s.status;
        const mutedClass = (s.status === 'inactive' || s.status === 'withdrawn' || s.status === 'graduated') ? ' is-muted' : '';
        const badgeClass = s.status === 'renewalPending' ? 'is-renewal' : s.status === 'active' ? 'is-active' : 'is-other';
        return `<div class="student-item ${currentStudentId === s.id ? 'active' : ''}${mutedClass}" onclick="selectStudent('${s.id}')">
            <div class="student-item-main">
                <div class="student-item-title">
                    ${studentBatchMode ? `<input type="checkbox" class="student-select" value="${s.id}" onclick="event.stopPropagation(); updateStudentSelectionCount()">` : ''}
                    <div class="name">${escapeHtml(s.name)}</div>
                </div>
                <span class="student-status-badge ${badgeClass}">${statusText}</span>
            </div>
            <div class="student-list-info">${escapeHtml(s.grade)} · ${escapeHtml(cls?.name) || '未分班'}</div>
        </div>`;
    }).join('');
    if (studentBatchMode) updateStudentSelectionCount();
}

function toggleStudentBatchMode() {
    studentBatchMode = !studentBatchMode;
    renderStudents();
}

function updateStudentSelectionCount() {
    const count = getSelectedStudentIds().length;
    const el = document.getElementById('studentSelectedCount');
    if (el) el.textContent = count;
}

function getSelectedStudentIds() {
    return Array.from(document.querySelectorAll('.student-select:checked')).map(el => el.value);
}

function toggleAllStudentSelection(button) {
    const items = Array.from(document.querySelectorAll('.student-select'));
    const shouldCheck = items.some(el => !el.checked);
    items.forEach(el => { el.checked = shouldCheck; });
    if (button) button.textContent = shouldCheck ? '取消全选' : '全选';
    updateStudentSelectionCount();
}

function selectStudent(id) {
    syncStudentListFiltersFromDom();
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
let currentStudentGradeChart = null;

function openStudentAIQuestion(studentId, type) {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;
    const name = student.name || '';
    const question = type === 'renewal'
        ? `请根据系统里${name}的课时、收费、考勤、成绩和沟通记录，帮我生成一段给家长的续费沟通话术。要求语气自然，不要太硬。`
        : `请根据系统里${name}的成绩、考勤、课时和沟通记录，帮我生成一段给家长的学情反馈。要求先说结论，再说表现、问题和下一步建议。`;
    switchTab('ai-workspace');
    setTimeout(() => {
        if (typeof fillSystemQAQuestion === 'function') fillSystemQAQuestion(question);
        const lengthSelect = document.getElementById('systemQAAnswerLength');
        if (typeof setSystemQAAnswerLength === 'function') setSystemQAAnswerLength('detailed');
        if (lengthSelect) lengthSelect.value = 'detailed';
        document.getElementById('agentInput')?.focus();
    }, 100);
}

function openStudentDetailFromRecord(studentId = '', studentName = '') {
    let targetId = studentId;
    if (!targetId && studentName) {
        const normalizedName = normalizeNameForMatch(studentName);
        const matched = (data.students || []).find(s => normalizeNameForMatch(s.name) === normalizedName);
        targetId = matched?.id || '';
    }
    if (!targetId) {
        showToast('未找到对应学员');
        return;
    }
    switchTab('students');
    setTimeout(() => selectStudent(targetId), 80);
}

function openStudentFeeQuick(studentId, mode = 'edit') {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;
    const pendingFee = (data.fees || [])
        .filter(f => f.studentId === studentId && f.status === 'pending')
        .sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || '')))[0];
    const latestFee = (data.fees || [])
        .filter(f => f.studentId === studentId)
        .sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || '')))[0];
    if (typeof openFeeModal !== 'function') return;
    if (mode === 'new') {
        openFeeModal(null, { studentId, status: 'paid' });
        return;
    }
    openFeeModal(pendingFee?.id || latestFee?.id || null, { studentId, status: pendingFee ? 'pending' : 'paid' });
}

function openStudentFeeManager(studentId) {
    const student = (data.students || []).find(s => s.id === studentId);
    if (!student) {
        showToast('未找到对应学员');
        return;
    }
    switchTab('fees');
    setTimeout(() => {
        const search = document.getElementById('feeSearch');
        const statusFilter = document.getElementById('feeStatusFilter');
        if (search) search.value = student.name || '';
        if (statusFilter) statusFilter.value = '';
        if (typeof renderFeeTable === 'function') renderFeeTable();
        search?.focus();
    }, 80);
}

function openStudentGradeQuick(studentId, mode = 'edit') {
    const latestGrade = (data.grades || [])
        .filter(g => g.studentId === studentId)
        .sort((a, b) => String(b.testDate || '').localeCompare(String(a.testDate || '')))[0];
    if (typeof openGradeModal !== 'function') return;
    openGradeModal(mode === 'new' ? null : latestGrade?.id || null, { studentId });
}

function openStudentGradeManager(studentId) {
    const student = (data.students || []).find(s => s.id === studentId);
    if (!student) {
        showToast('未找到对应学员');
        return;
    }
    switchTab('grades');
    setTimeout(() => {
        const search = document.getElementById('gradeSearch');
        const gradeFilter = document.getElementById('gradeGradeFilter');
        const classFilter = document.getElementById('gradeClassFilter');
        if (search) search.value = student.name || '';
        if (gradeFilter) gradeFilter.value = '';
        if (classFilter) classFilter.value = '';
        if (typeof renderGradeTable === 'function') renderGradeTable();
        search?.focus();
    }, 80);
}

function openStudentCommQuick(studentId, mode = 'edit') {
    const latestComm = (data.communications || [])
        .filter(c => c.studentId === studentId)
        .sort((a, b) => {
            const pendingRank = (item) => item.status === 'pending' ? 0 : 1;
            const rankDiff = pendingRank(a) - pendingRank(b);
            if (rankDiff !== 0) return rankDiff;
            return String(b.contactDate || '').localeCompare(String(a.contactDate || ''));
        })[0];
    if (typeof openCommModal !== 'function') return;
    openCommModal(mode === 'new' ? null : latestComm?.id || null, { studentId });
}

function openStudentCommManager(studentId) {
    const student = (data.students || []).find(s => s.id === studentId);
    if (!student) {
        showToast('未找到对应学员');
        return;
    }
    switchTab('communications');
    setTimeout(() => {
        const search = document.getElementById('commSearch');
        const statusFilter = document.getElementById('commStatusFilter');
        if (search) search.value = student.name || '';
        if (statusFilter) statusFilter.value = '';
        if (typeof renderCommTable === 'function') renderCommTable();
        search?.focus();
    }, 80);
}

function getStudentTimelineEvents(student) {
    if (!student) return [];
    const events = [];
    const studentId = String(student.id);
    const classMap = new Map((data.classes || []).map(c => [String(c.id), c]));

    (data.fees || []).filter(f => String(f.studentId) === studentId).forEach(f => {
        events.push({
            date: f.paymentDate || '',
            type: f.status === 'pending' ? '欠费' : '收费',
            tone: f.status === 'pending' ? 'risk' : 'good',
            title: `${f.status === 'pending' ? '欠费' : '缴费'} ¥${Number(f.amount || 0).toLocaleString()} · ${Number(f.hours || 0)}课时`,
            detail: f.remark || f.package || ''
        });
    });

    (data.grades || []).filter(g => String(g.studentId) === studentId).forEach(g => {
        events.push({
            date: g.testDate || '',
            type: '成绩',
            tone: Number(g.score || 0) >= 90 ? 'good' : Number(g.score || 0) >= 70 ? 'warn' : 'risk',
            title: `${g.testName || '未命名测试'} · ${g.score ?? '-'}/${g.fullScore ?? '-'}`,
            detail: g.weakPoints ? `薄弱点：${g.weakPoints}` : ''
        });
    });

    (data.communications || []).filter(c => String(c.studentId) === studentId).forEach(c => {
        events.push({
            date: c.contactDate || '',
            type: '沟通',
            tone: c.status === 'pending' ? 'warn' : 'normal',
            title: `${getCommunicationStatusText(c.status)} · ${c.contactType || '沟通'}`,
            detail: c.content || c.followUp || ''
        });
    });

    (data.attendance || []).forEach(session => {
        const status = session.records ? session.records[student.id] : undefined;
        if (status !== 1 && status !== 0) return;
        const cls = classMap.get(String(session.classId));
        events.push({
            date: session.date || '',
            type: '考勤',
            tone: status === 1 ? 'good' : 'warn',
            title: `${status === 1 ? '出勤' : '请假'} · ${cls?.name || '未知班级'}`,
            detail: session.sessionName || session.name || ''
        });
    });

    (data.operationLogs || [])
        .filter(log => String(log.studentId || '') === studentId || (log.targetType === 'students' && String(log.targetId || '') === studentId))
        .forEach(log => {
            events.push({
                date: log.createdAt || '',
                type: '操作',
                tone: 'normal',
                title: log.summary || `${log.module || '操作'} · ${log.targetName || student.name}`,
                detail: log.canUndo ? '可回退' : '已记录'
            });
        });

    return events
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 10);
}

function renderStudentTimeline(events) {
    if (!events || events.length === 0) {
        return '<div class="student-detail-muted student-timeline-empty">暂无时间线记录</div>';
    }
    return `
        <div class="student-timeline-list">
            ${events.map(event => `
                <div class="student-timeline-row is-${escapeHtml(event.tone || 'normal')}">
                    <div class="student-timeline-date">${escapeHtml(formatTimelineDate(event.date))}</div>
                    <div class="student-timeline-type">${escapeHtml(event.type || '-')}</div>
                    <div class="student-timeline-main">
                        <b>${escapeHtml(event.title || '-')}</b>
                        ${event.detail ? `<span>${escapeHtml(event.detail)}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function formatTimelineDate(value) {
    if (!value) return '-';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function renderStudentDetail() {
    if (!currentStudentId) return;
    const student = data.students.find(s => s.id === currentStudentId);
    if (!student) return;

    const cls = data.classes.find(c => c.id === student.classId);
    const schoolHistory = getSchoolHistory(student);
    const currentSchool = getCurrentStageSchool(student);
    const studentFees = data.fees.filter(f => f.studentId === student.id).sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || '')));
    const studentGrades = data.grades.filter(g => g.studentId === student.id).sort((a, b) => String(a.testDate || '').localeCompare(String(b.testDate || '')));
    const displayStudentGrades = [...studentGrades].sort((a, b) => String(b.testDate || '').localeCompare(String(a.testDate || '')));
    const studentComms = data.communications.filter(c => c.studentId === student.id).sort((a, b) => String(b.contactDate || '').localeCompare(String(a.contactDate || '')));

    // 按类型筛选成绩
    const schoolGrades = studentGrades.filter(g => g.examType === 'school');
    const externalGrades = studentGrades.filter(g => g.examType === 'external');
    const displayGrades = currentStudentGradeTab === 'all' ? studentGrades :
                          currentStudentGradeTab === 'school' ? schoolGrades : externalGrades;

    // 计算课时统计
    const totalPaidHours = studentFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.hours, 0);
    const totalPaidAmount = studentFees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
    const pendingFees = studentFees.filter(f => f.status === 'pending');
    const pendingFeeAmount = pendingFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const latestGrade = displayStudentGrades[0];
    const latestComm = studentComms[0];
    const latestFee = studentFees[0];
    const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业', forming: '组班中（旧）' };
    const statusText = statusMap[student.status] || student.status || '-';

    // 计算已消课时和请假课时
    let usedHours = 0, absentHours = 0;
    data.attendance.forEach(a => {
        if (a.records && a.records[student.id] === 1) usedHours++;
        else if (a.records && a.records[student.id] === 0) absentHours++;
    });
    const remainingHours = totalPaidHours - usedHours;
    const usageRate = totalPaidHours > 0 ? Math.round((usedHours / totalPaidHours) * 100) : 0;
    const riskNotes = [
        totalPaidHours === 0 && usedHours > 0 ? '已上课但没有已缴课时记录' : '',
        remainingHours < 0 ? `课时余额为负：${remainingHours}` : '',
        remainingHours >= 0 && remainingHours <= 2 && totalPaidHours > 0 ? `剩余课时较少：${remainingHours}` : '',
        pendingFeeAmount > 0 ? `有欠费记录：¥${pendingFeeAmount.toLocaleString()}` : '',
        student.status === 'renewalPending' ? '当前状态为待续费' : ''
    ].filter(Boolean);
    const hoursHeadline = totalPaidHours === 0 && usedHours === 0 ? '暂无收费记录' : `剩余 ${remainingHours} 课时`;
    const latestFeeText = latestFee
        ? `${escapeHtml(latestFee.paymentDate || '-')} · ${latestFee.status === 'paid' ? '已缴' : '欠费'} · ${Number(latestFee.hours || 0)} 课时`
        : '暂无收费记录';
    const latestScore = latestGrade ? Number(latestGrade.score || 0) : null;
    const fullScore = latestGrade ? Number(latestGrade.fullScore || 100) : 100;
    const scoreRate = latestScore !== null && fullScore > 0 ? Math.round((latestScore / fullScore) * 100) : null;
    const learningJudge = scoreRate === null
        ? { text: '暂无成绩', tone: 'muted', note: '先补录一次基准成绩' }
        : scoreRate >= 90
            ? { text: '学习稳定', tone: 'good', note: latestGrade.weakPoints ? `关注：${latestGrade.weakPoints}` : '保持当前节奏' }
            : scoreRate >= 70
                ? { text: '需要巩固', tone: 'warn', note: latestGrade.weakPoints ? `薄弱：${latestGrade.weakPoints}` : '建议补充薄弱点' }
                : { text: '重点关注', tone: 'risk', note: latestGrade.weakPoints ? `薄弱：${latestGrade.weakPoints}` : '建议尽快跟进' };
    const hourJudge = pendingFeeAmount > 0 || remainingHours < 0
        ? { text: '需处理', tone: 'risk', note: pendingFeeAmount > 0 ? `欠费 ¥${pendingFeeAmount.toLocaleString()}` : `余额 ${remainingHours}` }
        : totalPaidHours > 0 && remainingHours <= 2
            ? { text: '快不足', tone: 'warn', note: `剩余 ${remainingHours} 课时` }
            : totalPaidHours === 0 && usedHours > 0
                ? { text: '缺收费', tone: 'risk', note: '已上课但无已缴课时' }
                : { text: '正常', tone: 'good', note: `剩余 ${remainingHours} 课时` };
    const latestCommTime = latestComm?.contactDate
        ? Date.parse(`${latestComm.contactDate}T00:00:00`)
        : NaN;
    const daysSinceComm = Number.isFinite(latestCommTime)
        ? Math.floor((Date.now() - latestCommTime) / 86400000)
        : null;
    const commJudge = daysSinceComm === null
        ? { text: '暂无沟通', tone: 'muted', note: '必要时补一条记录' }
        : daysSinceComm > 30
            ? { text: '久未沟通', tone: 'warn', note: `${daysSinceComm} 天前` }
            : { text: '正常', tone: 'good', note: `${Math.max(daysSinceComm, 0)} 天前` };
    const schoolOptions = [
        { label: '小学', value: schoolHistory.primarySchool || '-' },
        { label: '初中', value: schoolHistory.middleSchool || '-' },
        { label: '高中', value: schoolHistory.highSchool || '-' }
    ];
    const schoolOptionsHtml = schoolOptions.map(item => {
        const display = `${item.label} · ${item.value || '-'}`;
        return `<button type="button" data-school="${escapeHtml(display)}" onclick="setStudentDetailSchoolDisplay(this)">${escapeHtml(display)}</button>`;
    }).join('');
    const currentSchoolDisplay = `${currentSchool.stageText} · ${currentSchool.school || '-'}`;
    const timelineEvents = getStudentTimelineEvents(student);

    const detail = document.getElementById('studentDetail');
    if (currentStudentGradeChart && typeof currentStudentGradeChart.destroy === 'function') {
        currentStudentGradeChart.destroy();
        currentStudentGradeChart = null;
    }

    let chartHtml = '';
    if (displayGrades.length >= 2) {
        chartHtml = `
            <div class="student-grade-chart-block">
                <div class="student-grade-chart-title">${escapeHtml(student.name)} · 成绩趋势</div>
                <div class="chart-container"><canvas id="gradeChart"></canvas></div>
            </div>
        `;
    }

    detail.innerHTML = `
        <div class="student-detail-header">
            <div>
                <h3>${escapeHtml(student.name)} <span class="badge ${student.status === 'renewalPending' ? 'badge-renewal' : student.status === 'active' ? 'badge-active' : 'badge-normal'}">${escapeHtml(statusText)}</span></h3>
                <p>${escapeHtml(student.grade)} · ${escapeHtml(cls?.name) || '未分班'} · ${escapeHtml(student.teacher || '白老师')}</p>
            </div>
            <div class="student-detail-actions">
                <button class="btn btn-secondary btn-sm" onclick="openStudentModal('${student.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${student.id}')">删除</button>
                <button class="btn btn-sm btn-ai-feedback" onclick="openStudentAIQuestion('${student.id}', 'feedback')">AI 学情反馈</button>
                <button class="btn btn-sm btn-ai-renewal" onclick="openStudentAIQuestion('${student.id}', 'renewal')">AI 续费话术</button>
            </div>
        </div>

        <div class="student-detail-summary-grid">
            <div class="student-detail-card clickable-card ${riskNotes.length ? 'is-risk' : ''}" role="button" tabindex="0" title="点击处理该学员收费/欠费" onclick="openStudentFeeQuick('${student.id}')" onkeydown="if(event.key==='Enter')openStudentFeeQuick('${student.id}')">
                <div class="student-detail-card-title">
                    <span>课时与收费</span>
                    <span class="student-detail-card-title-actions">
                        ${riskNotes.length ? '<span class="badge badge-pending">需处理</span>' : '<span class="badge badge-active">正常</span>'}
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentFeeManager('${student.id}')">管理</button>
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentFeeQuick('${student.id}', 'new')">+ 新增</button>
                    </span>
                </div>
                <div class="student-detail-big">${escapeHtml(hoursHeadline)}</div>
                <div class="student-detail-metrics">
                    <div><span>已缴</span><b>${totalPaidHours}</b></div>
                    <div><span>已消</span><b>${usedHours}</b></div>
                    <div><span>请假</span><b>${absentHours}</b></div>
                    <div><span>欠费</span><b>¥${pendingFeeAmount.toLocaleString()}</b></div>
                </div>
                <div class="student-detail-muted">最近收费：${latestFeeText}</div>
                <div class="student-card-note is-${hourJudge.tone}">${escapeHtml(hourJudge.text)} · ${escapeHtml(hourJudge.note)}</div>
            </div>

            <div class="student-detail-card clickable-card" role="button" tabindex="0" title="点击查看或新增该学员成绩" onclick="openStudentGradeQuick('${student.id}')" onkeydown="if(event.key==='Enter')openStudentGradeQuick('${student.id}')">
                <div class="student-detail-card-title">
                    <span>最近成绩</span>
                    <span class="student-detail-card-title-actions">
                        ${latestGrade ? `<span class="badge badge-normal">${escapeHtml(latestGrade.testName || '测试')}</span>` : '<span class="badge badge-normal">暂无</span>'}
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentGradeManager('${student.id}')">管理</button>
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentGradeQuick('${student.id}', 'new')">+ 新增</button>
                    </span>
                </div>
                ${latestGrade ? `
                    <div class="student-detail-big">${escapeHtml(latestGrade.score ?? '-')}/${escapeHtml(latestGrade.fullScore ?? '-')}</div>
                    <div class="student-detail-line">日期：${escapeHtml(latestGrade.testDate || '-')}</div>
                    <div class="student-detail-muted">薄弱点：${escapeHtml(latestGrade.weakPoints || '暂无')}</div>
                    <div class="student-card-note is-${learningJudge.tone}">${escapeHtml(learningJudge.text)} · ${escapeHtml(learningJudge.note)}</div>
                ` : `
                    <div class="student-detail-muted">暂无成绩记录</div>
                    <div class="student-card-note is-${learningJudge.tone}">${escapeHtml(learningJudge.text)} · ${escapeHtml(learningJudge.note)}</div>
                `}
            </div>

            <div class="student-detail-card clickable-card" role="button" tabindex="0" title="点击查看或补充该学员沟通记录" onclick="openStudentCommQuick('${student.id}')" onkeydown="if(event.key==='Enter')openStudentCommQuick('${student.id}')">
                <div class="student-detail-card-title">
                    <span>最近沟通</span>
                    <span class="student-detail-card-title-actions">
                        ${latestComm ? `<span class="badge badge-normal">${escapeHtml(getCommunicationStatusText(latestComm.status))}</span>` : '<span class="badge badge-normal">暂无</span>'}
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentCommManager('${student.id}')">管理</button>
                        <button type="button" class="student-card-mini-action" onclick="event.stopPropagation(); openStudentCommQuick('${student.id}', 'new')">+ 新增</button>
                    </span>
                </div>
                ${latestComm ? `
                    <div class="student-detail-line">${escapeHtml(latestComm.contactDate || '-')} · ${escapeHtml(getCommunicationStatusText(latestComm.status))}</div>
                    <div class="student-detail-muted">${escapeHtml(latestComm.content || latestComm.followUp || '-')}</div>
                    <div class="student-card-note is-${commJudge.tone}">${escapeHtml(commJudge.text)} · ${escapeHtml(commJudge.note)}</div>
                ` : `
                    <div class="student-detail-muted">暂无沟通记录</div>
                    <div class="student-card-note is-${commJudge.tone}">${escapeHtml(commJudge.text)} · ${escapeHtml(commJudge.note)}</div>
                `}
            </div>
        </div>

        <div class="student-detail-info-row">
            <div class="student-detail-info-card">
                <div class="student-detail-card-title">基础信息</div>
                <div class="student-detail-info-grid">
                    <div class="student-detail-info-item"><span>性别</span><b>${escapeHtml(student.gender || '-')}</b></div>
                    <div class="student-detail-info-item"><span>授课老师</span><b>${escapeHtml(student.teacher || '白老师')}</b></div>
                    <div class="student-detail-info-item"><span>联系电话</span><b>${escapeHtml(student.phone || '-')}</b></div>
                    <details class="student-detail-info-item student-school-picker">
                        <summary>
                            <span><span>当前就读</span><b id="studentDetailCurrentSchool">${escapeHtml(currentSchoolDisplay)}</b></span>
                            <em>切换</em>
                        </summary>
                        <div class="student-school-popover">${schoolOptionsHtml}</div>
                    </details>
                </div>
            </div>

            <div class="student-detail-info-card">
                <div class="student-detail-card-title">入班记录</div>
                <div class="student-detail-info-grid">
                    <div class="student-detail-info-item"><span>入班时间</span><b>${escapeHtml(student.enrollDate || '-')}</b></div>
                    <div class="student-detail-info-item"><span>首次上课年级</span><b>${escapeHtml(student.firstEnrollGrade || '-')}</b></div>
                    <div class="student-detail-info-item"><span>当前状态</span><b>${escapeHtml(statusText)}</b></div>
                    <div class="student-detail-info-item"><span>备注</span><b>${escapeHtml(student.remark || '-')}</b></div>
                </div>
            </div>
        </div>

        ${riskNotes.length ? `<div class="student-detail-risk-line">${riskNotes.map(note => `<span>${escapeHtml(note)}</span>`).join('')}</div>` : ''}

        <details class="student-record-section student-timeline-panel">
            <summary class="student-record-title">
                <span>最近时间线 (${timelineEvents.length})</span><em>⌄</em>
                <small>收费 / 成绩 / 沟通 / 考勤 / 操作</small>
            </summary>
            ${renderStudentTimeline(timelineEvents)}
        </details>

        <!-- 沟通记录 -->
        <details class="student-record-section student-comm-collapse">
            <summary class="student-record-title">
                <span>沟通记录 (${studentComms.length})</span><em>⌄</em>
            </summary>
            ${studentComms.length === 0 ? '<div class="student-detail-muted student-comm-empty">暂无沟通记录</div>' : `
                <div class="student-detail-timeline">
                    ${studentComms.slice(0, 8).map(c => `
                        <div class="student-detail-timeline-item">
                            <div class="student-detail-timeline-date">${escapeHtml(c.contactDate || '-')} · ${escapeHtml(getCommunicationStatusText(c.status))}</div>
                            <div>${escapeHtml(c.content || '-')}</div>
                            ${c.followUp ? `<div class="student-detail-muted">跟进：${escapeHtml(c.followUp)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        </details>

        <!-- 成绩记录 -->
        <details class="student-record-section student-grade-records" open>
            <summary class="student-record-title student-grade-record-title">
                <span>成绩记录 (${studentGrades.length})</span><em>⌄</em>
                <div class="student-grade-filter-actions">
                    <button class="btn btn-xs ${currentStudentGradeTab === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="event.preventDefault(); event.stopPropagation(); switchStudentGradeTab('all')">全部</button>
                    <button class="btn btn-xs ${currentStudentGradeTab === 'school' ? 'btn-primary' : 'btn-secondary'}" onclick="event.preventDefault(); event.stopPropagation(); switchStudentGradeTab('school')">校内</button>
                    <button class="btn btn-xs ${currentStudentGradeTab === 'external' ? 'btn-primary' : 'btn-secondary'}" onclick="event.preventDefault(); event.stopPropagation(); switchStudentGradeTab('external')">校外</button>
                </div>
            </summary>
            ${displayGrades.length === 0 ? '<div class="empty-state student-record-empty">暂无记录</div>' : `
                <div class="student-grade-list">
                    ${[...displayGrades].sort((a, b) => String(b.testDate || '').localeCompare(String(a.testDate || ''))).map(g => `
                        <div class="student-grade-row">
                            <div class="student-grade-main">
                                <b>${escapeHtml(g.testName || '未命名测试')}</b>
                                <span>${escapeHtml(g.testDate || '-')}</span>
                            </div>
                            <span class="badge ${g.examType === 'school' ? 'badge-active' : 'badge-normal'}">${g.examType === 'school' ? '校内' : '校外'}</span>
                            <span class="badge ${g.score >= 90 ? 'badge-active' : g.score >= 70 ? 'badge-trial' : 'badge-pending'}">${escapeHtml(g.score ?? '-')}/${escapeHtml(g.fullScore ?? '-')}</span>
                            <span>${g.ranking != null && g.ranking !== '' ? '第'+escapeHtml(g.ranking)+'名' : '排名未知'}</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </details>

        ${chartHtml}
    `;

    // 渲染成绩趋势图
    if (displayGrades.length >= 2) {
        setTimeout(() => {
            const ctx = document.getElementById('gradeChart');
            if (ctx) {
                currentStudentGradeChart = new Chart(ctx, {
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

function setStudentDetailSchoolDisplay(button) {
    const text = button?.dataset?.school || '-';
    const target = document.getElementById('studentDetailCurrentSchool');
    if (target) target.textContent = text;
    const picker = button.closest('.student-school-picker');
    if (picker) picker.removeAttribute('open');
}

function openStudentModal(id = null) {
    currentEditId = id;
    const student = id ? data.students.find(s => s.id === id) : null;
    const classOptions = data.classes.filter(c => c.status === 'active').map(c => `<option value="${c.id}" ${student?.classId === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    const schoolHistory = getSchoolHistory(student || {});
    const gradeOptions = getStudentGradeOptions(student?.grade);

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
                        ${gradeOptions.map(g => `<option value="${escapeHtml(g)}" ${student?.grade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
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
                <div class="form-group">
                    <label>首次上课年级</label>
                    <select name="firstEnrollGrade">
                        <option value="">未填写</option>
                        ${getStudentGradeOptions(student?.firstEnrollGrade || student?.grade).map(g => `<option value="${escapeHtml(g)}" ${student?.firstEnrollGrade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>小学学校</label><input type="text" name="primarySchool" value="${escapeHtml(schoolHistory.primarySchool)}" placeholder="如：XX小学" list="schoolDatalist" autocomplete="off"></div>
                <div class="form-group"><label>初中学校</label><input type="text" name="middleSchool" value="${escapeHtml(schoolHistory.middleSchool)}" placeholder="如：XX中学" list="schoolDatalist" autocomplete="off"></div>
                <div class="form-group"><label>高中学校</label><input type="text" name="highSchool" value="${escapeHtml(schoolHistory.highSchool)}" placeholder="如：XX高中" list="schoolDatalist" autocomplete="off"></div>
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
                <div class="form-group form-group-wide"><label>备注</label><input type="text" name="remark" value="${escapeHtml(student?.remark || '')}" placeholder="学员备注信息"></div>
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

    const schoolHistory = {
        primarySchool: form.primarySchool.value.trim(),
        middleSchool: form.middleSchool.value.trim(),
        highSchool: form.highSchool.value.trim()
    };
    const firstEnrollGrade = form.firstEnrollGrade.value || (!currentEditId ? form.grade.value : existingStudent?.firstEnrollGrade || '');
    const legacySchool = getLegacySchoolFromHistory(form.grade.value, schoolHistory, '');

    const studentData = {
        id: currentEditId || generateId(),
        name: form.name.value, gender: form.gender.value, grade: form.grade.value,
        classId: form.classId.value, teacher: form.teacher.value, enrollDate: form.enrollDate.value,
        firstEnrollDate: form.firstEnrollDate.value || existingStudent?.firstEnrollDate || form.enrollDate.value,
        firstEnrollGrade,
        phone: form.phone.value, emergencyContact: form.emergencyContact.value,
        status: form.status.value, followUpStatus: form.followUpStatus?.value || '', remark: form.remark.value,
        schoolHistory,
        school: legacySchool,
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
    const schools = [...new Set((data.students || []).flatMap(s => {
        const history = getSchoolHistory(s);
        return [history.primarySchool, history.middleSchool, history.highSchool, s.school].filter(Boolean);
    }))];
    datalist.innerHTML = schools.map(s => `<option value="${escapeHtml(s)}">`).join('');
}

function openGradeUpgradePreview() {
    const students = data.students || [];
    const gradeOptions = getStudentGradeOptions();
    document.getElementById('modalTitle').textContent = '升年级预览';
    document.getElementById('modalBody').innerHTML = `
        <div class="grade-upgrade-note">
            只会更新勾选学员的当前年级，不修改首次上课年级、班级关系、班级年级或学员状态。确认前会自动创建服务器备份。
        </div>
        <div class="table-wrapper grade-upgrade-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th><input type="checkbox" onchange="toggleAllGradeUpgradeRows(this)" checked></th>
                        <th>学员</th>
                        <th>状态</th>
                        <th>当前年级</th>
                        <th>目标年级</th>
                        <th>首次上课年级</th>
                        <th>当前就读阶段学校</th>
                        <th>当前班级</th>
                        <th>处理状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(student => {
                        const targetGrade = STUDENT_GRADE_UPGRADE_MAP[student.grade] || '';
                        const cls = (data.classes || []).find(c => c.id === student.classId);
                        const school = getCurrentStageSchool(student);
                        const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业' };
                        return `
                            <tr>
                                <td><input type="checkbox" class="grade-upgrade-row" data-student-id="${student.id}" ${targetGrade ? 'checked' : ''}></td>
                                <td>${escapeHtml(student.name || '')}</td>
                                <td>${escapeHtml(statusMap[student.status] || student.status || '-')}</td>
                                <td>${escapeHtml(student.grade || '-')}</td>
                                <td>
                                    <select class="grade-upgrade-target" data-student-id="${student.id}">
                                        <option value="">手动处理</option>
                                        ${gradeOptions.map(g => `<option value="${escapeHtml(g)}" ${targetGrade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                                    </select>
                                </td>
                                <td>${escapeHtml(student.firstEnrollGrade || '-')}</td>
                                <td>${escapeHtml(school.stageText)} · ${escapeHtml(school.school || '-')}</td>
                                <td>${escapeHtml(cls?.name || '未分班')}</td>
                                <td><span class="badge ${targetGrade ? 'badge-active' : 'badge-pending'}">${targetGrade ? '可升级' : '需手动处理'}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button type="button" class="btn btn-primary" onclick="applyGradeUpgrade()">确认升级勾选学员</button>
        </div>
    `;
    document.getElementById('modal').classList.add('show');
}

function toggleAllGradeUpgradeRows(master) {
    document.querySelectorAll('.grade-upgrade-row').forEach(row => {
        const target = document.querySelector(`.grade-upgrade-target[data-student-id="${row.dataset.studentId}"]`)?.value || '';
        row.checked = Boolean(master.checked && target);
    });
}

async function applyGradeUpgrade() {
    const updates = [];
    document.querySelectorAll('.grade-upgrade-row:checked').forEach(row => {
        const studentId = row.dataset.studentId;
        const targetGrade = document.querySelector(`.grade-upgrade-target[data-student-id="${studentId}"]`)?.value || '';
        const student = (data.students || []).find(s => s.id === studentId);
        if (student && targetGrade && targetGrade !== student.grade) {
            updates.push({ student, targetGrade });
        }
    });
    if (updates.length === 0) {
        showToast('没有可升级的学员');
        return;
    }
    if (!confirm(`确认升级 ${updates.length} 名学员的当前年级吗？\n\n此操作不会修改首次上课年级、班级关系和学员状态。`)) return;
    await createServerBackup('升年级前自动备份');
    updates.forEach(({ student, targetGrade }) => {
        const existingHistory = getSchoolHistory(student);
        student.grade = targetGrade;
        student.schoolHistory = existingHistory;
        student.school = getLegacySchoolFromHistory(student.grade, student.schoolHistory, '');
    });
    try {
        await saveStudentsToApi(data.students);
    } catch (error) {
        showToast('升年级保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast(`已升级 ${updates.length} 名学员`);
    render();
}

async function deleteStudent(id) {
    const student = data.students.find(s => s.id === id);
    if (!student) return;

    // 在读状态：改为停课
    if (student.status === 'active' || student.status === 'renewalPending') {
        if (!confirm('确定将该学员改为停课状态？停课后可在“非在读学员”中编辑状态恢复。')) return;
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
    const headers = ['姓名', '性别', '年级', '所在班级', '授课老师', '入班时间', '首次入学', '首次上课年级', '联系电话', '紧急联系人', '小学学校', '初中学校', '高中学校', '状态', '备注'];
    const rows = students.map(s => {
        const cls = (data.classes || []).find(c => c.id === s.classId);
        const history = getSchoolHistory(s);
        return [s.name || '', s.gender || '', s.grade || '', cls?.name || '未分班', s.teacher || '', s.enrollDate || '', s.firstEnrollDate || '', s.firstEnrollGrade || '', s.phone || '', s.emergencyContact || '', history.primarySchool || '', history.middleSchool || '', history.highSchool || '', statusMap[s.status] || s.status || '', s.remark || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    formatExcelSheet(ws, [headers, ...rows], { maxWidth: 36 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '选中学员');
    XLSX.writeFile(wb, filename);
    showToast('导出成功');
}

// 下载学员导入模板（含填写说明）
function downloadStudentTemplate() {
    const templateRows = [
        ['姓名', '性别', '年级', '班级名称', '授课老师', '入班时间', '首次入学', '首次上课年级', '联系电话', '紧急联系人', '状态', '备注', '小学学校', '初中学校', '高中学校'],
        ['张三', '男', '六年级', '六年级奥数-周五18:00', '白老师', '2025-09-01', '2025-09-01', '六年级', '13800138001', '13900139001', 'active', '数学基础扎实', 'XX小学', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    formatExcelSheet(ws, templateRows, { maxWidth: 36 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '学员数据');

    const instructionRows = [
        ['学员导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['姓名', '学员真实姓名', '是', '如：张三'],
        ['性别', '男或女', '选填', '男 / 女'],
        ['年级', '当前年级', '选填', '五年级 / 六年级 / 初一 等'],
        ['班级名称', '班级名称，匹配已有班级', '选填', '如：六年级培优A班'],
        ['授课老师', '授课老师姓名', '选填', '如：白老师'],
        ['入班时间', '报名/入班日期', '选填', 'yyyy-mm-dd，如 2025-09-01'],
        ['首次入学', '第一次来上课日期', '选填', 'yyyy-mm-dd，如 2025-09-01'],
        ['首次上课年级', '第一次来上课时的年级，只做历史记录', '选填', '如：六年级'],
        ['联系电话', '家长电话', '选填', '如：13800138001'],
        ['紧急联系人', '紧急联系人', '选填', '如：13900139001'],
        ['状态', '在读状态', '选填', 'active（默认在读）/ inactive / renewalPending / withdrawn / graduated / 在读 / 停课 / 待续费 / 已退费 / 已毕业'],
        ['备注', '补充说明', '选填', '如：数学基础扎实'],
        ['小学学校', '小学阶段学校', '选填', '如：XX小学'],
        ['初中学校', '初中阶段学校', '选填', '如：XX中学'],
        ['高中学校', '高中阶段学校', '选填', '如：XX高中'],
        [''],
        ['注意事项'],
        ['1. 日期必须为 yyyy-mm-dd 格式，如 2025-09-01'],
        ['2. 班级名称如不匹配现有班级，会以"未分班"状态导入'],
        ['3. 状态：active/在读=正常在读，inactive/停课，renewalPending/待续费，withdrawn/已退费，graduated/已毕业，无法识别会导入失败并跳过'],
        ['4. 当前学校不用填写，系统会根据当前年级自动显示小学/初中/高中对应学校'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instructionRows);
    formatExcelSheet(instrWs, instructionRows, { autoFilter: false, maxWidth: 50 });
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
    const headers = (rows[0] || []).map(h => String(h || '').trim());
    const idx = (names, fallback) => {
        for (const name of names) {
            const found = headers.indexOf(name);
            if (found !== -1) return found;
        }
        return fallback;
    };
    const indexes = {
        name: idx(['姓名'], 0),
        gender: idx(['性别'], 1),
        grade: idx(['年级'], 2),
        className: idx(['班级名称', '所在班级'], 3),
        teacher: idx(['授课老师'], 4),
        enrollDate: idx(['入班时间'], 5),
        firstEnrollDate: idx(['首次入学', '首次入学时间'], -1),
        firstEnrollGrade: idx(['首次上课年级'], -1),
        phone: idx(['联系电话'], headers.includes('首次上课年级') ? 8 : 6),
        emergencyContact: idx(['紧急联系人'], headers.includes('首次上课年级') ? 9 : 7),
        status: idx(['状态'], headers.includes('首次上课年级') ? 10 : 8),
        remark: idx(['备注'], headers.includes('首次上课年级') ? 11 : 9),
        legacySchool: idx(['就读学校'], 10),
        primarySchool: idx(['小学学校'], -1),
        middleSchool: idx(['初中学校'], -1),
        highSchool: idx(['高中学校'], -1)
    };
    const getCell = (row, key) => indexes[key] >= 0 ? row[indexes[key]] : '';
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
        if (!getCell(row, 'name')) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写学员姓名' }); continue; }

        const name = String(getCell(row, 'name')).trim();
        const phone = String(getCell(row, 'phone') || '').trim();
        const rawStatus = String(getCell(row, 'status') || '').trim().toLowerCase();
        if (rawStatus && !statusMap[rawStatus]) {
            errors.push({ row: rowNum, msg: `状态"${rawStatus}"无法识别` });
            failed++;
            continue;
        }

        const grade = String(getCell(row, 'grade') || '六年级').trim();
        const className = String(getCell(row, 'className') || '').trim();
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
        const schoolHistory = {
            primarySchool: String(getCell(row, 'primarySchool') || '').trim(),
            middleSchool: String(getCell(row, 'middleSchool') || '').trim(),
            highSchool: String(getCell(row, 'highSchool') || '').trim()
        };
        const legacySchool = String(getCell(row, 'legacySchool') || '').trim();
        const normalizedHistory = getSchoolHistory({ grade, schoolHistory, school: legacySchool });
        validRows.push({
            row,
            cls,
            name,
            phone,
            grade,
            gender: String(getCell(row, 'gender') || '男').trim(),
            teacher: String(getCell(row, 'teacher') || '白老师').trim(),
            enrollDateRaw: getCell(row, 'enrollDate'),
            firstEnrollDateRaw: getCell(row, 'firstEnrollDate'),
            firstEnrollGrade: String(getCell(row, 'firstEnrollGrade') || '').trim(),
            emergencyContact: String(getCell(row, 'emergencyContact') || '').trim(),
            remark: String(getCell(row, 'remark') || '').trim(),
            schoolHistory: normalizedHistory,
            legacySchool,
            rawStatus,
            status: statusMap[rawStatus] || 'active',
            isDupe
        });
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
                const enrollDate = normalizeExcelDate(v.enrollDateRaw) || String(v.enrollDateRaw || '').trim() || existing.enrollDate || '';
                const firstEnrollDate = normalizeExcelDate(v.firstEnrollDateRaw) || String(v.firstEnrollDateRaw || '').trim() || existing.firstEnrollDate || enrollDate;
                const firstEnrollGrade = v.firstEnrollGrade || existing.firstEnrollGrade || '';
                const schoolHistory = {
                    ...getSchoolHistory(existing),
                    ...Object.fromEntries(Object.entries(v.schoolHistory || {}).filter(([, value]) => value))
                };
                data.students[idx] = {
                    id: existing.id,
                    name: v.name,
                    gender: v.gender || existing.gender || '男',
                    grade: v.grade || existing.grade || '六年级',
                    classId: v.cls?.id || existing.classId || '',
                    teacher: v.teacher || existing.teacher || '白老师',
                    enrollDate,
                    firstEnrollDate,
                    firstEnrollGrade,
                    phone: v.phone,
                    emergencyContact: v.emergencyContact,
                    status: v.status,
                    remark: v.remark,
                    schoolHistory,
                    school: getLegacySchoolFromHistory(v.grade || existing.grade, schoolHistory, existing.school || v.legacySchool || ''),
                    classJoinSessions: existing.classJoinSessions || (v.cls?.id ? { [v.cls.id]: 1 } : {}),
                    classLeaveSessions: existing.classLeaveSessions || {},
                    createdAt: existing.createdAt || new Date().toISOString()
                };
                replaced++;
                imported++;
                continue;
            }
        }

        const enrollDate = normalizeExcelDate(v.enrollDateRaw) || String(v.enrollDateRaw || '').trim() || new Date().toISOString().split('T')[0];
        const firstEnrollDate = normalizeExcelDate(v.firstEnrollDateRaw) || String(v.firstEnrollDateRaw || '').trim() || enrollDate;
        const firstEnrollGrade = v.firstEnrollGrade || v.grade;
        data.students.push({
            id: generateId(),
            name: v.name,
            gender: v.gender || '男',
            grade: v.grade || '六年级',
            classId: v.cls?.id || '',
            teacher: v.teacher || '白老师',
            enrollDate,
            firstEnrollDate,
            firstEnrollGrade,
            phone: v.phone,
            emergencyContact: v.emergencyContact,
            status: v.status,
            remark: v.remark,
            schoolHistory: v.schoolHistory,
            school: getLegacySchoolFromHistory(v.grade || '六年级', v.schoolHistory, v.legacySchool || ''),
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
    const msg = `导入完成：成功 ${imported} 名${replaced > 0 ? `，替换 ${replaced} 条` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}${checkResult.fail > 0 ? `，失败 ${checkResult.fail} 条` : ''}`;
    showToast(msg);
    showImportResultSummary({
        imported, replaced, skipped, failed: checkResult.fail, total: checkResult.total,
        actionLabel: '学员导入',
        failedDetails: checkResult.errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
}
