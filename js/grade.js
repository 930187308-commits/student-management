// ==================== 成绩记录 ====================

let gradeBatchMode = false;

function renderGrades() {
    const container = document.getElementById('tab-grades');
    const gradeOptions = data.gradeOptions || [...new Set((data.students || []).map(s => s.grade).filter(Boolean))];

    let html = `
        <div class="card record-card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="gradeSearch" placeholder="搜索学员姓名...">
                    <select id="gradeGradeFilter">
                        <option value="">全部年级</option>
                        ${gradeOptions.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                    </select>
                    <select id="gradeClassFilter">
                        <option value="">全部班级</option>
                        ${data.classes.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-success" onclick="openGradeModal()">+ 新增成绩</button>
                    <div class="divider"></div>
                    <button class="btn btn-secondary btn-sm" onclick="downloadGradeTemplate()">下载模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning btn-sm">导入</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importGrades(event)">
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="toggleGradeBatchMode()">${gradeBatchMode ? '退出多选' : '多选'}</button>
                </div>
            </div>
            <div id="gradeCountBar" class="record-meta-bar"></div>
            <div id="gradeBatchBar" class="record-batch-bar">
                ${gradeBatchMode ? `<span>已选择 <strong id="gradeSelectedCount">0</strong> 条</span><button class="btn btn-secondary btn-xs record-batch-toggle" onclick="toggleAllGradeSelection(this)">全选</button>` : ''}
            </div>
            <div class="table-wrapper">
                <table><thead><tr>${gradeBatchMode ? '<th><input type="checkbox" onchange="toggleAllGradeSelection(this)"></th>' : ''}<th>学员</th><th>测试名称</th><th class="record-date-cell">日期</th><th>类型</th><th>得分</th><th>排名</th><th>备注</th><th>薄弱点</th><th>操作</th></tr></thead><tbody id="gradeTableBody"></tbody></table>
            </div>
            <div class="record-footer-actions">
                <button class="btn btn-secondary" onclick="exportGrades()">导出Excel</button>
                ${gradeBatchMode ? '<button class="btn btn-secondary" onclick="exportSelectedGrades()">导出选中</button><button class="btn btn-danger" onclick="deleteSelectedGrades()">删除选中</button>' : ''}
            </div>
        </div>
    `;
    container.innerHTML = html;
    document.getElementById('gradeSearch').addEventListener('input', renderGradeTable);
    document.getElementById('gradeGradeFilter').addEventListener('change', renderGradeTable);
    document.getElementById('gradeClassFilter').addEventListener('change', renderGradeTable);
    renderGradeTable();
}

function renderGradeTable() {
    const search = document.getElementById('gradeSearch')?.value?.toLowerCase() || '';
    const gradeFilter = document.getElementById('gradeGradeFilter')?.value || '';
    const classId = document.getElementById('gradeClassFilter')?.value || '';
    const allData = data.grades || [];
    const filtered = allData.filter(g => {
        const student = getGradeRecordStudent(g);
        if (search && !g.studentName.toLowerCase().includes(search)) return false;
        if (gradeFilter && student?.grade !== gradeFilter) return false;
        if (classId && g.classId !== classId) return false;
        return true;
    }).sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''));
    const total = allData.length;
    const current = filtered.length;
    const countBar = document.getElementById('gradeCountBar');
    if (countBar) countBar.textContent = total === current ? `共 ${total} 条` : `当前 ${current} 条 / 共 ${total} 条`;
    if (gradeBatchMode) updateGradeSelectionCount();

    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = filtered.length > 0
        ? filtered.map(g => {
            const student = getGradeRecordStudent(g);
            const studentId = student?.id || g.studentId || '';
            return `<tr>${gradeBatchMode ? `<td><input type="checkbox" class="grade-select" value="${g.id}" onchange="updateGradeSelectionCount()"></td>` : ''}<td><button type="button" class="record-link-btn" onclick="openStudentDetailFromRecord('${escapeHtml(studentId)}', '${escapeHtml(g.studentName)}')">${escapeHtml(g.studentName)}</button></td><td>${escapeHtml(g.testName)}</td><td class="record-date-cell">${g.testDate || '-'}</td><td><span class="badge ${g.examType === 'school' ? 'badge-active' : 'badge-normal'}">${g.examType === 'school' ? '校内' : '校外'}</span></td><td><span class="badge ${g.score >= 90 ? 'badge-active' : g.score >= 70 ? 'badge-trial' : 'badge-pending'}">${g.score}/${g.fullScore}</span></td><td>${g.ranking != null && g.ranking !== '' ? '第'+g.ranking+'名' : '未知'}</td><td>${escapeHtml(g.remark || '-')}</td><td>${escapeHtml(g.weakPoints || '-')}</td><td><button class="btn btn-primary btn-xs" onclick="openStudentAIQuestion('${escapeHtml(studentId)}', 'feedback')">反馈</button><button class="btn btn-secondary btn-xs" onclick="openGradeModal('${g.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteGrade('${g.id}')">删除</button></td></tr>`;
        }).join('')
        : `<tr><td colspan="${gradeBatchMode ? 10 : 9}" class="record-empty-row">暂无成绩记录</td></tr>`;
}

function getGradeRecordStudent(gradeRecord) {
    return (data.students || []).find(s => s.id === gradeRecord.studentId) ||
        (data.students || []).find(s => normalizeNameForMatch(s.name) === normalizeNameForMatch(gradeRecord.studentName));
}

function toggleGradeBatchMode() {
    gradeBatchMode = !gradeBatchMode;
    renderGrades();
}

function openGradeModal(id = null, defaults = {}) {
    currentEditId = id;
    const grade = id ? data.grades.find(g => g.id === id) : null;
    const selectedStudentId = grade?.studentId || defaults.studentId || '';
    const existingStudent = selectedStudentId ? data.students.find(s => s.id === selectedStudentId) : null;
    const defaultExamType = grade?.examType || defaults.examType || 'external';

    document.getElementById('modalTitle').textContent = id ? '编辑成绩' : '新增成绩';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveGrade(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>学员 *</label>
                    <input type="text" id="gradeStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterGradeStudentList()" style="width: 100%;" value="${existingStudent ? escapeHtml(existingStudent.name) : ''}">
                    <select id="gradeStudentSelect" size="5" style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectGradeStudent(this)"></select>
                    <input type="hidden" name="studentId" id="gradeStudentId" value="${selectedStudentId}">
                </div>
                <div class="form-group"><label>测试名称 *</label><input type="text" name="testName" value="${escapeHtml(grade?.testName ?? defaults.testName ?? '')}" required></div>
                <div class="form-group"><label>测试日期</label><input type="date" name="testDate" value="${grade?.testDate ?? defaults.testDate ?? new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>得分 *</label><input type="number" name="score" value="${grade?.score ?? defaults.score ?? ''}" required min="0"></div>
                <div class="form-group"><label>满分</label><input type="number" name="fullScore" value="${grade?.fullScore ?? defaults.fullScore ?? 100}" min="0"></div>
                <div class="form-group"><label>班级排名</label><input type="number" name="ranking" value="${grade?.ranking ?? defaults.ranking ?? ''}" min="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成绩类型</label>
                    <select name="examType">
                        <option value="external" ${defaultExamType === 'external' ? 'selected' : ''}>校外成绩</option>
                        <option value="school" ${defaultExamType === 'school' ? 'selected' : ''}>校内成绩</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2;"><label>薄弱点</label><input type="text" name="weakPoints" value="${escapeHtml(grade?.weakPoints ?? defaults.weakPoints ?? '')}" placeholder="如：计算准确性、几何证明题"></div>
            </div>
            <div class="form-group"><label>备注</label><textarea name="remark" rows="2">${escapeHtml(grade?.remark ?? defaults.remark ?? '')}</textarea></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function filterGradeStudentList() {
    const input = document.getElementById('gradeStudentSearch');
    const select = document.getElementById('gradeStudentSelect');
    const search = input.value.toLowerCase().trim();
    const hiddenInput = document.getElementById('gradeStudentId');

    if (search.length === 0) {
        select.style.display = 'none';
        hiddenInput.value = '';
        return;
    }

    const filtered = data.students.filter(s => s.name.toLowerCase().includes(search));
    select.innerHTML = filtered.map(s => `<option value="${s.id}">${escapeHtml(s.name)} · ${escapeHtml(s.grade)}</option>`).join('');

    if (filtered.length > 0) {
        select.style.display = 'block';
        select.size = Math.min(filtered.length, 5);
    } else {
        select.style.display = 'none';
    }
    hiddenInput.value = '';
}

function selectGradeStudent(select) {
    const hiddenInput = document.getElementById('gradeStudentId');
    const searchInput = document.getElementById('gradeStudentSearch');
    const selectedOption = select.options[select.selectedIndex];
    hiddenInput.value = select.value;
    searchInput.value = selectedOption.text;
    select.style.display = 'none';
}

async function saveGrade(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('gradeStudentId').value || form.studentId?.value;
    const student = data.students.find(s => s.id === studentId);
    if (!studentId || !student) { showToast('请从下拉列表选择学员'); return; }
    const rankingVal = form.ranking.value.trim();
    const ranking = rankingVal === '' ? null : parseInt(rankingVal, 10);
    const gradeData = {
        id: currentEditId || generateId(), studentId: studentId, studentName: student?.name || '',
        classId: student?.classId || '', testName: form.testName.value, testDate: form.testDate.value,
        score: parseInt(form.score.value), fullScore: parseInt(form.fullScore.value),
        ranking: ranking, examType: form.examType.value,
        weakPoints: form.weakPoints.value, remark: form.remark.value
    };
    try {
        await saveCollectionItemToApi('grades', gradeData);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

async function deleteGrade(id) {
    if (!confirm('确定删除该成绩记录？')) return;
    try {
        await deleteCollectionItemFromApi('grades', id);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast('删除成功');
    render();
}

// 下载成绩导入模板（含填写说明）
function downloadGradeTemplate() {
    const templateRows = [
        ['学员姓名 *', '测试名称 *', '测试日期 *', '得分 *', '满分', '班级排名', '成绩类型', '薄弱点', '备注'],
        ['张三', '期中数学测试', '2025-10-15', '85', '100', '5', '校内', '计算准确性', ''],
        ['李四', '奥数杯赛模拟', '2025-11-20', '78', '100', '8', '校外', '数论', '获得二等奖'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateRows);
    formatExcelSheet(ws, templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩数据');

    const instructionRows = [
        ['成绩导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['学员姓名', '学员真实姓名', '是', '如：张三'],
        ['测试名称', '本次测试名称', '是', '如：期中数学测试'],
        ['测试日期', '考试日期', '是', 'yyyy-mm-dd，如 2025-10-15'],
        ['得分', '本次得分', '是', '数字，如 85'],
        ['满分', '满分值', '选填', '数字，默认 100'],
        ['班级排名', '班级内排名', '选填', '数字，如 5'],
        ['成绩类型', '校内或校外', '选填', '校内 / 校外，默认校外'],
        ['薄弱点', '薄弱知识点', '选填', '如：计算准确性'],
        ['备注', '补充说明', '选填', '如：获得二等奖'],
        [''],
        ['注意事项'],
        ['1. 日期必须为 yyyy-mm-dd 格式，如 2025-10-15'],
        ['2. 成绩类型写"校内"表示校内成绩，"校外"或不填表示校外成绩'],
        ['3. 导入时通过学员姓名匹配，找到则更新，找不到则跳过'],
    ];
    const instrWs = XLSX.utils.aoa_to_sheet(instructionRows);
    formatExcelSheet(instrWs, instructionRows, { autoFilter: false, maxWidth: 42 });
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
    XLSX.writeFile(wb, '成绩导入模板.xlsx');
    showToast('模板已下载');
}

// 导入成绩Excel
function importGrades(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            const checkResult = precheckGradeImport(rows);
            showImportPreCheck({
                title: '成绩导入预览',
                checkResult,
                actionLabel: '导入成绩',
                duplicateStrategy: 'skip',
                onConfirm: (strategies) => executeGradeImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function precheckGradeImport(rows) {
    const validRows = [];
    const errors = [];
    const duplicates = [];
    const skippedDetails = [];
    let skipped = 0;
    let failed = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        if (!row[0] || !row[1] || row[3] === undefined) {
            skipped++;
            skippedDetails.push({ row: rowNum, msg: '缺少学员、测试名称或得分' });
            continue;
        }

        const studentName = String(row[0]).trim();
        const matchedStudents = data.students.filter(s => normalizeNameForMatch(s.name) === normalizeNameForMatch(studentName));
        if (matchedStudents.length === 0) { errors.push({ row: rowNum, msg: `学员"${studentName}"不存在` }); failed++; continue; }
        if (matchedStudents.length > 1) {
            const names = matchedStudents.map(s => `"${s.name}"`).join('、');
            errors.push({ row: rowNum, msg: `学员"${studentName}"匹配到多个（${names}），请先改名区分` });
            failed++;
            continue;
        }

        const testDate = normalizeExcelDate(row[2]);
        if (!testDate) { errors.push({ row: rowNum, msg: '日期无法识别' }); failed++; continue; }

        const student = matchedStudents[0];
        const testName = String(row[1]).trim();
        const isDupe = data.grades.some(g =>
            g.studentId === student.id &&
            g.testName === testName &&
            g.testDate === testDate
        );
        if (isDupe) {
            duplicates.push({ row: rowNum, msg: `${student.name} / ${testName} / ${testDate}` });
        }

        validRows.push({ row, student, testDate, testName, isDupe });
    }

    const total = Math.max(rows.length - 1, 0);
    const dup = validRows.filter(v => v.isDupe).length;
    return { total, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, duplicates, skippedDetails, validRows };
}

function buildGradeFromImportRow(v, id) {
    const rankingRaw = v.row[5];
    const ranking = rankingRaw === undefined || rankingRaw === '' || rankingRaw === null ? null : parseInt(rankingRaw, 10);
    return {
        id,
        studentId: v.student.id,
        studentName: v.student.name,
        classId: v.student.classId,
        testName: v.testName,
        testDate: v.testDate,
        score: parseInt(v.row[3]) || 0,
        fullScore: parseInt(v.row[4]) || 100,
        ranking,
        examType: String(v.row[6] || '校外成绩').trim() === '校内' ? 'school' : 'external',
        weakPoints: String(v.row[7] || '').trim(),
        remark: String(v.row[8] || '').trim()
    };
}

async function executeGradeImport(checkResult, strategies = {}) {
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    let imported = 0;
    let replaced = 0;
    let skipped = checkResult.skip || 0;

    for (const v of checkResult.validRows) {
        if (v.isDupe) {
            if (dupeStrategy === 'skip') { skipped++; continue; }
            const idx = data.grades.findIndex(g =>
                g.studentId === v.student.id &&
                g.testName === v.testName &&
                g.testDate === v.testDate
            );
            if (idx !== -1) {
                data.grades[idx] = buildGradeFromImportRow(v, data.grades[idx].id);
                replaced++;
                imported++;
                continue;
            }
        }
        data.grades.push(buildGradeFromImportRow(v, generateId()));
        imported++;
    }

    try {
        await saveGradesToApi(data.grades);
    } catch (error) {
        showToast('导入保存失败：' + error.message);
        return;
    }
    render();
    const msg = `导入完成：成功 ${imported} 条${replaced > 0 ? `，替换 ${replaced} 条` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}${checkResult.fail > 0 ? `，失败 ${checkResult.fail} 条` : ''}`;
    showToast(msg);
    showImportResultSummary({
        imported, replaced, skipped, failed: checkResult.fail,
        total: checkResult.total,
        actionLabel: '成绩记录导入',
        failedDetails: checkResult.errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
}

function exportGrades() {
    exportGradeRows(data.grades || [], '成绩记录.xlsx');
}

function getSelectedGradeIds() {
    return Array.from(document.querySelectorAll('.grade-select:checked')).map(el => el.value);
}

function toggleAllGradeSelection(checkbox) {
    const items = Array.from(document.querySelectorAll('.grade-select'));
    const shouldCheck = checkbox.type === 'checkbox' ? checkbox.checked : items.some(el => !el.checked);
    items.forEach(el => { el.checked = shouldCheck; });
    if (checkbox.type !== 'checkbox') checkbox.textContent = shouldCheck ? '取消全选' : '全选';
    updateGradeSelectionCount();
}

function updateGradeSelectionCount() {
    const count = getSelectedGradeIds().length;
    const el = document.getElementById('gradeSelectedCount');
    if (el) el.textContent = count;
}

function exportSelectedGrades() {
    const ids = getSelectedGradeIds();
    if (ids.length === 0) { showToast('请先勾选成绩记录'); return; }
    const selected = (data.grades || []).filter(g => ids.includes(g.id));
    exportGradeRows(selected, `选中成绩记录_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteSelectedGrades() {
    const ids = getSelectedGradeIds();
    if (ids.length === 0) { showToast('请先勾选成绩记录'); return; }
    if (!confirm(`确定删除选中的 ${ids.length} 条成绩记录吗？此操作不可恢复。`)) return;
    await createServerBackup('批量删除成绩记录前自动备份');
    data.grades = (data.grades || []).filter(g => !ids.includes(g.id));
    try {
        await saveGradesToApi(data.grades);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast(`已删除 ${ids.length} 条成绩记录`);
    render();
}

function exportGradeRows(grades, filename) {
    const headers = ['学员', '测试名称', '测试日期', '得分', '满分', '班级排名', '备注', '薄弱点'];
    const rows = grades.map(g => [g.studentName, g.testName, g.testDate, g.score, g.fullScore, g.ranking != null && g.ranking !== '' ? `第${g.ranking}名` : '未知', g.remark || '', g.weakPoints || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    formatExcelSheet(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩记录');
    XLSX.writeFile(wb, filename);
    showToast('导出成功');
}
