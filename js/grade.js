// ==================== 成绩记录 ====================

function renderGrades() {
    const container = document.getElementById('tab-grades');

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="gradeSearch" placeholder="搜索学员姓名...">
                    <select id="gradeClassFilter">
                        <option value="">全部班级</option>
                        ${data.classes.filter(c => c.status === 'active').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-success" onclick="openGradeModal()">+ 新增成绩</button>
                    <div class="divider"></div>
                    <button class="btn btn-secondary" onclick="downloadGradeTemplate()">下载导入模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning">导入Excel</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importGrades(event)">
                    </div>
                </div>
            </div>
            <div id="gradeCountBar" style="padding: 6px 0; color: #888; font-size: 13px;"></div>
            <div class="table-wrapper">
                <table><thead><tr><th>学员</th><th>测试名称</th><th style="white-space:nowrap;">日期</th><th>类型</th><th>得分</th><th>排名</th><th>备注</th><th>薄弱点</th><th>操作</th></tr></thead><tbody id="gradeTableBody"></tbody></table>
            </div>
            <div style="margin-top: 16px;">
                <button class="btn btn-secondary" onclick="exportGrades()">导出Excel</button>
            </div>
        </div>
    `;
    container.innerHTML = html;
    document.getElementById('gradeSearch').addEventListener('input', renderGradeTable);
    document.getElementById('gradeClassFilter').addEventListener('change', renderGradeTable);
    renderGradeTable();
}

function renderGradeTable() {
    const search = document.getElementById('gradeSearch')?.value?.toLowerCase() || '';
    const classId = document.getElementById('gradeClassFilter')?.value || '';
    const allData = data.grades || [];
    const filtered = allData.filter(g => (!search || g.studentName.toLowerCase().includes(search)) && (!classId || g.classId === classId)).sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''));
    const total = allData.length;
    const current = filtered.length;
    const countBar = document.getElementById('gradeCountBar');
    if (countBar) countBar.textContent = total === current ? `共 ${total} 条` : `当前 ${current} 条 / 共 ${total} 条`;

    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = filtered.map(g => `<tr><td>${escapeHtml(g.studentName)}</td><td>${escapeHtml(g.testName)}</td><td style="white-space:nowrap;">${g.testDate || '-'}</td><td><span class="badge ${g.examType === 'school' ? 'badge-active' : 'badge-normal'}">${g.examType === 'school' ? '校内' : '校外'}</span></td><td><span class="badge ${g.score >= 90 ? 'badge-active' : g.score >= 70 ? 'badge-trial' : 'badge-pending'}">${g.score}/${g.fullScore}</span></td><td>${g.ranking != null && g.ranking !== '' ? '第'+g.ranking+'名' : '未知'}</td><td>${escapeHtml(g.remark || '-')}</td><td>${escapeHtml(g.weakPoints || '-')}</td><td><button class="btn btn-secondary btn-xs" onclick="openGradeModal('${g.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteGrade('${g.id}')">删除</button></td></tr>`).join('');
}

function openGradeModal(id = null) {
    currentEditId = id;
    const grade = id ? data.grades.find(g => g.id === id) : null;
    const existingStudent = grade ? data.students.find(s => s.id === grade.studentId) : null;

    document.getElementById('modalTitle').textContent = id ? '编辑成绩' : '新增成绩';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveGrade(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>学员 *</label>
                    <input type="text" id="gradeStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterGradeStudentList()" style="width: 100%;" value="${existingStudent ? escapeHtml(existingStudent.name) : ''}">
                    <select id="gradeStudentSelect" size="5" style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectGradeStudent(this)"></select>
                    <input type="hidden" name="studentId" id="gradeStudentId" value="${grade?.studentId || ''}">
                </div>
                <div class="form-group"><label>测试名称 *</label><input type="text" name="testName" value="${escapeHtml(grade?.testName || '')}" required></div>
                <div class="form-group"><label>测试日期</label><input type="date" name="testDate" value="${grade?.testDate || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>得分 *</label><input type="number" name="score" value="${grade?.score || ''}" required min="0"></div>
                <div class="form-group"><label>满分</label><input type="number" name="fullScore" value="${grade?.fullScore || 100}" min="0"></div>
                <div class="form-group"><label>班级排名</label><input type="number" name="ranking" value="${grade?.ranking || ''}" min="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成绩类型</label>
                    <select name="examType">
                        <option value="external" ${(!grade || grade?.examType === 'external') ? 'selected' : ''}>校外成绩</option>
                        <option value="school" ${grade?.examType === 'school' ? 'selected' : ''}>校内成绩</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2;"><label>薄弱点</label><input type="text" name="weakPoints" value="${escapeHtml(grade?.weakPoints || '')}" placeholder="如：计算准确性、几何证明题"></div>
            </div>
            <div class="form-group"><label>备注</label><textarea name="remark" rows="2">${escapeHtml(grade?.remark || '')}</textarea></div>
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

function saveGrade(e) {
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
    if (currentEditId) {
        const index = data.grades.findIndex(g => g.id === currentEditId);
        data.grades[index] = gradeData;
    } else {
        data.grades.push(gradeData);
    }
    saveData();
    closeModal();
    showToast('保存成功');
    render();
}

function deleteGrade(id) {
    if (!confirm('确定删除该成绩记录？')) return;
    data.grades = data.grades.filter(g => g.id !== id);
    saveData();
    showToast('删除成功');
    render();
}

// 下载成绩导入模板（含填写说明）
function downloadGradeTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['学员姓名 *', '测试名称 *', '测试日期 *', '得分 *', '满分', '班级排名', '成绩类型', '薄弱点', '备注'],
        ['张三', '期中数学测试', '2025-10-15', '85', '100', '5', '校内', '计算准确性', ''],
        ['李四', '奥数杯赛模拟', '2025-11-20', '78', '100', '8', '校外', '数论', '获得二等奖'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩数据');

    const instrWs = XLSX.utils.aoa_to_sheet([
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
    ]);
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

            const validRows = [];
            let skipped = 0, failed = 0;
            const errors = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0] || !row[1] || row[3] === undefined) { skipped++; continue; }

                const studentName = String(row[0]).trim();
                const student = data.students.find(s => s.name === studentName);
                if (!student) { errors.push(`第${i+1}行: 学员"${studentName}"不存在`); failed++; continue; }

                const testDate = normalizeExcelDate(row[2]);
                if (!testDate) { errors.push(`第${i+1}行: 日期无法识别`); failed++; continue; }

                const testName = String(row[1]).trim();

                const isDupe = data.grades.some(g =>
                    g.studentId === student.id &&
                    g.testName === testName &&
                    g.testDate === testDate
                );

                validRows.push({ row, student, testDate, testName, isDupe });
            }

            const hasDupe = validRows.some(v => v.isDupe);
            let dupeStrategy = 'skip';
            if (hasDupe) {
                const choice = confirm('发现重复记录：\n\n- 确定：保留现有记录，跳过重复\n- 取消：用导入记录覆盖重复\n\n按"确定"保留现有，按"取消"替换重复。');
                dupeStrategy = choice ? 'skip' : 'replace';
            }

            let imported = 0, replaced = 0;
            for (const v of validRows) {
                if (v.isDupe) {
                    if (dupeStrategy === 'skip') { skipped++; continue; }
                    const idx = data.grades.findIndex(g =>
                        g.studentId === v.student.id &&
                        g.testName === v.testName &&
                        g.testDate === v.testDate
                    );
                    if (idx !== -1) {
                        const rankingRaw = v.row[5];
                        const ranking = rankingRaw === undefined || rankingRaw === '' || rankingRaw === null ? null : parseInt(rankingRaw, 10);
                        data.grades[idx] = {
                            id: data.grades[idx].id,
                            studentId: v.student.id,
                            studentName: v.student.name,
                            classId: v.student.classId,
                            testName: v.testName,
                            testDate: v.testDate,
                            score: parseInt(v.row[3]) || 0,
                            fullScore: parseInt(v.row[4]) || 100,
                            ranking: ranking,
                            examType: String(v.row[6] || '校外成绩').trim() === '校内' ? 'school' : 'external',
                            weakPoints: String(v.row[7] || '').trim(),
                            remark: String(v.row[8] || '').trim()
                        };
                        replaced++;
                        imported++;
                        continue;
                    }
                }
                const rankingRaw = v.row[5];
                const ranking = rankingRaw === undefined || rankingRaw === '' || rankingRaw === null ? null : parseInt(rankingRaw, 10);
                data.grades.push({
                    id: generateId(),
                    studentId: v.student.id,
                    studentName: v.student.name,
                    classId: v.student.classId,
                    testName: v.testName,
                    testDate: v.testDate,
                    score: parseInt(v.row[3]) || 0,
                    fullScore: parseInt(v.row[4]) || 100,
                    ranking: ranking,
                    examType: String(v.row[6] || '校外成绩').trim() === '校内' ? 'school' : 'external',
                    weakPoints: String(v.row[7] || '').trim(),
                    remark: String(v.row[8] || '').trim()
                });
                imported++;
            }

            saveData();
            render();
            const msg = `导入完成：成功 ${imported} 条${replaced > 0 ? `，替换 ${replaced} 条` : ''}${failed > 0 ? `，失败 ${failed} 条` : ''}${skipped > 0 ? `，跳过 ${skipped} 条` : ''}`;
            showToast(msg);
            if (errors.length > 0) console.log('导入错误:', errors);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function exportGrades() {
    const headers = ['学员', '测试名称', '测试日期', '得分', '满分', '班级排名', '备注', '薄弱点'];
    const rows = data.grades.map(g => [g.studentName, g.testName, g.testDate, g.score, g.fullScore, g.ranking != null && g.ranking !== '' ? `第${g.ranking}名` : '未知', g.remark || '', g.weakPoints || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩记录');
    XLSX.writeFile(wb, '成绩记录.xlsx');
    showToast('导出成功');
}