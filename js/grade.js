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
            <div class="table-wrapper">
                <table><thead><tr><th>学员</th><th>测试名称</th><th>日期</th><th>类型</th><th>得分</th><th>排名</th><th>薄弱点</th><th>操作</th></tr></thead><tbody id="gradeTableBody"></tbody></table>
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
    const filtered = data.grades.filter(g => (!search || g.studentName.toLowerCase().includes(search)) && (!classId || g.classId === classId));

    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = filtered.map(g => `<tr><td>${escapeHtml(g.studentName)}</td><td>${escapeHtml(g.testName)}</td><td>${g.testDate}</td><td><span class="badge ${g.examType === 'school' ? 'badge-active' : 'badge-normal'}">${g.examType === 'school' ? '校内' : '校外'}</span></td><td><span class="badge ${g.score >= 90 ? 'badge-active' : g.score >= 70 ? 'badge-trial' : 'badge-pending'}">${g.score}/${g.fullScore}</span></td><td>第${g.ranking}名</td><td>${escapeHtml(g.weakPoints || '-')}</td><td><button class="btn btn-secondary btn-xs" onclick="openGradeModal('${g.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteGrade('${g.id}')">删除</button></td></tr>`).join('');
}

function openGradeModal(id = null) {
    currentEditId = id;
    const grade = id ? data.grades.find(g => g.id === id) : null;
    const studentOptions = data.students.filter(s => s.status === 'active').map(s => `<option value="${s.id}" ${grade?.studentId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    document.getElementById('modalTitle').textContent = id ? '编辑成绩' : '新增成绩';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveGrade(event)">
            <div class="form-row">
                <div class="form-group"><label>学员 *</label><select name="studentId" required><option value="">请选择学员</option>${studentOptions}</select></div>
                <div class="form-group"><label>测试名称 *</label><input type="text" name="testName" value="${grade?.testName || ''}" required></div>
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
                <div class="form-group" style="flex:2;"><label>薄弱点</label><input type="text" name="weakPoints" value="${grade?.weakPoints || ''}" placeholder="如：计算准确性、几何证明题"></div>
            </div>
            <div class="form-group"><label>备注</label><textarea name="remark" rows="2">${grade?.remark || ''}</textarea></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function saveGrade(e) {
    e.preventDefault();
    const form = e.target;
    const student = data.students.find(s => s.id === form.studentId.value);
    const gradeData = {
        id: currentEditId || generateId(), studentId: form.studentId.value, studentName: student?.name || '',
        classId: student?.classId || '', testName: form.testName.value, testDate: form.testDate.value,
        score: parseInt(form.score.value), fullScore: parseInt(form.fullScore.value),
        ranking: parseInt(form.ranking.value), examType: form.examType.value,
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

// 下载成绩导入模板
function downloadGradeTemplate() {
    const headers = [['学员姓名', '测试名称', '测试日期', '得分', '满分', '班级排名', '成绩类型', '薄弱点', '备注']];
    const sampleRows = [['张三', '期中测试', '2025-10-15', '85', '100', '5', '校外成绩', '计算准确性', '']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩导入模板');
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

            // 跳过表头，从第二行开始
            let imported = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0] || !row[1] || !row[3]) continue; // 学员名、测试名、得分必填

                const studentName = String(row[0]).trim();
                const student = data.students.find(s => s.name === studentName);
                if (!student) continue;

                const gradeData = {
                    id: generateId(),
                    studentId: student.id,
                    studentName: student.name,
                    classId: student.classId,
                    testName: String(row[1]).trim(),
                    testDate: String(row[2] || new Date().toISOString().split('T')[0]),
                    score: parseInt(row[3]) || 0,
                    fullScore: parseInt(row[4]) || 100,
                    ranking: parseInt(row[5]) || 0,
                    examType: String(row[6] || 'external').trim() === '校内' ? 'school' : 'external',
                    weakPoints: String(row[7] || '').trim(),
                    remark: String(row[8] || '').trim()
                };
                data.grades.push(gradeData);
                imported++;
            }

            saveData();
            render();
            showToast(`成功导入 ${imported} 条成绩记录`);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function exportGrades() {
    const headers = ['学员', '测试名称', '测试日期', '得分', '满分', '班级排名', '薄弱点', '备注'];
    const rows = data.grades.map(g => [g.studentName, g.testName, g.testDate, g.score, g.fullScore, `第${g.ranking}名`, g.weakPoints || '', g.remark || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成绩记录');
    XLSX.writeFile(wb, '成绩记录.xlsx');
    showToast('导出成功');
}