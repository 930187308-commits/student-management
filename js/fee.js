// ==================== 收费记录 ====================

let feeBatchMode = false;

function renderFees() {
    const container = document.getElementById('tab-fees');
    const totalPaid = data.fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
    const totalPending = data.fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="feeSearch" placeholder="搜索学员姓名...">
                    <select id="feeStatusFilter"><option value="">全部状态</option><option value="paid">已缴</option><option value="pending">欠费</option></select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-success" onclick="openFeeModal()">+ 新增缴费</button>
                    <div class="divider"></div>
	                    <button class="btn btn-secondary btn-sm" onclick="downloadFeeTemplate()">下载模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning btn-sm">导入</button>
	                        <input type="file" accept=".xlsx,.xls" onchange="importFees(event)">
	                    </div>
	                    <button class="btn btn-secondary btn-sm" onclick="toggleFeeBatchMode()">${feeBatchMode ? '退出多选' : '多选'}</button>
	                </div>
	            </div>
            <div id="feeCountBar" style="padding: 6px 0; color: #888; font-size: 13px;"></div>
            <div id="feeBatchBar" style="padding: 6px 0; color: #888; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                ${feeBatchMode ? `<span>已选择 <strong id="feeSelectedCount">0</strong> 条</span><button class="btn btn-secondary btn-xs" onclick="toggleAllFeeSelection(this)" style="padding: 2px 8px;">全选</button>` : ''}
            </div>
            <div style="display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap;">
                <div><span style="color: #888;">已缴合计：</span><strong style="color: #27ae60;">¥${totalPaid.toLocaleString()}</strong></div>
                <div><span style="color: #888;">欠费合计：</span><strong style="color: #e74c3c;">¥${totalPending.toLocaleString()}</strong></div>
            </div>
            <div class="table-wrapper">
	                <table><thead><tr>${feeBatchMode ? '<th><input type="checkbox" onchange="toggleAllFeeSelection(this)"></th>' : ''}<th>学员</th><th>金额</th><th>单价</th><th>课时</th><th>日期</th><th>套餐</th><th>状态</th><th>操作</th></tr></thead><tbody id="feeTableBody"></tbody></table>
	            </div>
	            <div style="margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
	                <button class="btn btn-secondary" onclick="exportFees()">导出Excel</button>
	                ${feeBatchMode ? '<button class="btn btn-secondary" onclick="exportSelectedFees()">导出选中</button><button class="btn btn-danger" onclick="deleteSelectedFees()">删除选中</button>' : ''}
	            </div>
        </div>
    `;
    container.innerHTML = html;
    document.getElementById('feeSearch').addEventListener('input', renderFeeTable);
    document.getElementById('feeStatusFilter').addEventListener('change', renderFeeTable);
    renderFeeTable();
}

function renderFeeTable() {
    const search = document.getElementById('feeSearch')?.value?.toLowerCase() || '';
    const status = document.getElementById('feeStatusFilter')?.value || '';
    const allData = data.fees || [];
    const filtered = allData.filter(f => (!search || f.studentName.toLowerCase().includes(search)) && (!status || f.status === status)).sort((a, b) => {
        const statusRank = (item) => item.status === 'pending' ? 0 : 1;
        const rankDiff = statusRank(a) - statusRank(b);
        if (rankDiff !== 0) return rankDiff;
        return String(b.paymentDate || '').localeCompare(String(a.paymentDate || ''));
    });
    const total = allData.length;
    const current = filtered.length;
    const countBar = document.getElementById('feeCountBar');
    if (countBar) countBar.textContent = total === current ? `共 ${total} 条` : `当前 ${current} 条 / 共 ${total} 条`;
    if (feeBatchMode) updateFeeSelectionCount();
    const tbody = document.getElementById('feeTableBody');
    tbody.innerHTML = filtered.length > 0
        ? filtered.map(f => `<tr>${feeBatchMode ? `<td><input type="checkbox" class="fee-select" value="${f.id}" onchange="updateFeeSelectionCount()"></td>` : ''}<td><button type="button" class="record-link-btn" onclick="openStudentDetailFromRecord('${escapeHtml(f.studentId || '')}', '${escapeHtml(f.studentName)}')">${escapeHtml(f.studentName)}</button></td><td>¥${Number(f.amount || 0).toLocaleString()}</td><td>¥${f.pricePerHour}</td><td>${f.hours}</td><td>${f.paymentDate || '-'}</td><td>${escapeHtml(f.package)}</td><td><span class="badge ${f.status === 'paid' ? 'badge-paid' : 'badge-pending'}">${f.status === 'paid' ? '已缴' : '欠费'}</span></td><td><button class="btn btn-secondary btn-xs" onclick="openFeeModal('${f.id}')">编辑</button>${f.status === 'pending' ? `<button class="btn btn-success btn-xs" onclick="markFeePaid('${f.id}')">转已缴</button><button class="btn btn-primary btn-xs" onclick="openStudentAIQuestion('${escapeHtml(f.studentId || '')}', 'renewal')">话术</button>` : ''}<button class="btn btn-danger btn-xs" onclick="deleteFee('${f.id}')">删除</button></td></tr>`).join('')
        : `<tr><td colspan="${feeBatchMode ? 9 : 8}" style="text-align:center;color:#888;padding:24px;">暂无收费记录</td></tr>`;
}

function toggleFeeBatchMode() {
    feeBatchMode = !feeBatchMode;
    renderFees();
}

function openFeeModal(id = null, defaults = {}) {
    currentEditId = id;
    const fee = id ? data.fees.find(f => f.id === id) : null;
    const selectedStudentId = fee?.studentId || defaults.studentId || '';
    const existingStudent = selectedStudentId ? data.students.find(s => s.id === selectedStudentId) : null;
    const defaultStatus = fee?.status || defaults.status || 'paid';

    document.getElementById('modalTitle').textContent = id ? '编辑缴费记录' : '新增缴费';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveFee(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>学员 *</label>
                    <input type="text" id="feeStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterFeeStudentList()" style="width: 100%;" value="${existingStudent ? escapeHtml(existingStudent.name) : ''}">
                    <select id="feeStudentSelect" size="5" style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectFeeStudent(this)"></select>
                    <input type="hidden" name="studentId" id="feeStudentId" value="${selectedStudentId}">
                </div>
                <div class="form-group"><label>缴费金额 *</label><input type="number" name="amount" value="${fee?.amount ?? defaults.amount ?? ''}" required min="0"></div>
                <div class="form-group"><label>课时单价</label><input type="number" name="pricePerHour" value="${fee?.pricePerHour ?? defaults.pricePerHour ?? 200}" min="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>购买课时</label><input type="number" name="hours" value="${fee?.hours ?? defaults.hours ?? ''}" min="0"></div>
                <div class="form-group"><label>缴费日期</label><input type="date" name="paymentDate" value="${fee?.paymentDate ?? defaults.paymentDate ?? new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label>状态</label><select name="status"><option value="paid" ${defaultStatus === 'paid' ? 'selected' : ''}>已缴</option><option value="pending" ${defaultStatus === 'pending' ? 'selected' : ''}>欠费</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>套餐名称</label><input type="text" name="package" value="${escapeHtml(fee?.package ?? defaults.package ?? '')}" placeholder="如：秋季班40课时"></div>
                <div class="form-group"><label>付款方式</label><select name="paymentMethod"><option value="微信转账" ${(!fee && !defaults.paymentMethod) || fee?.paymentMethod === '微信转账' || defaults.paymentMethod === '微信转账' ? 'selected' : ''}>微信转账</option><option value="支付宝" ${fee?.paymentMethod === '支付宝' || defaults.paymentMethod === '支付宝' ? 'selected' : ''}>支付宝</option><option value="银行转账" ${fee?.paymentMethod === '银行转账' || defaults.paymentMethod === '银行转账' ? 'selected' : ''}>银行转账</option><option value="现金" ${fee?.paymentMethod === '现金' || defaults.paymentMethod === '现金' ? 'selected' : ''}>现金</option></select></div>
            </div>
            <div class="form-group"><label>备注</label><textarea name="remark" rows="2">${escapeHtml(fee?.remark ?? defaults.remark ?? '')}</textarea></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function filterFeeStudentList() {
    const input = document.getElementById('feeStudentSearch');
    const select = document.getElementById('feeStudentSelect');
    const search = input.value.toLowerCase().trim();
    const hiddenInput = document.getElementById('feeStudentId');

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

function selectFeeStudent(select) {
    const hiddenInput = document.getElementById('feeStudentId');
    const searchInput = document.getElementById('feeStudentSearch');
    const selectedOption = select.options[select.selectedIndex];
    hiddenInput.value = select.value;
    searchInput.value = selectedOption.text;
    select.style.display = 'none';
}

async function saveFee(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('feeStudentId').value || form.studentId?.value;
    const student = data.students.find(s => s.id === studentId);
    if (!studentId || !student) { showToast('请从下拉列表选择学员'); return; }
    const feeData = {
        id: currentEditId || generateId(), studentId: studentId, studentName: student?.name || '',
        amount: parseInt(form.amount.value), pricePerHour: parseInt(form.pricePerHour.value),
        hours: parseInt(form.hours.value), paymentDate: form.paymentDate.value, package: form.package.value,
        paymentMethod: form.paymentMethod.value, status: form.status.value, remark: form.remark.value
    };
    try {
        await saveCollectionItemToApi('fees', feeData);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

async function deleteFee(id) {
    if (!confirm('确定删除该缴费记录？')) return;
    try {
        await deleteCollectionItemFromApi('fees', id);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast('删除成功');
    render();
}

async function markFeePaid(id) {
    const fee = (data.fees || []).find(f => f.id === id);
    if (!fee) return;
    if (!confirm(`确定将“${fee.studentName || '该学员'}”这条欠费记录标记为已缴吗？`)) return;
    const updatedFee = {
        ...fee,
        status: 'paid',
        paymentDate: fee.paymentDate || new Date().toISOString().split('T')[0]
    };
    try {
        await saveCollectionItemToApi('fees', updatedFee);
    } catch (error) {
        showToast('更新失败：' + error.message);
        return;
    }
    showToast('已转为已缴');
    render();
}

function exportFees() {
    exportFeeRows(data.fees || [], '收费记录.xlsx');
}

function getSelectedFeeIds() {
    return Array.from(document.querySelectorAll('.fee-select:checked')).map(el => el.value);
}

function toggleAllFeeSelection(checkbox) {
    const items = Array.from(document.querySelectorAll('.fee-select'));
    const shouldCheck = checkbox.type === 'checkbox' ? checkbox.checked : items.some(el => !el.checked);
    items.forEach(el => { el.checked = shouldCheck; });
    if (checkbox.type !== 'checkbox') checkbox.textContent = shouldCheck ? '取消全选' : '全选';
    updateFeeSelectionCount();
}

function updateFeeSelectionCount() {
    const count = getSelectedFeeIds().length;
    const el = document.getElementById('feeSelectedCount');
    if (el) el.textContent = count;
}

function exportSelectedFees() {
    const ids = getSelectedFeeIds();
    if (ids.length === 0) { showToast('请先勾选收费记录'); return; }
    const selected = (data.fees || []).filter(f => ids.includes(f.id));
    exportFeeRows(selected, `选中收费记录_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteSelectedFees() {
    const ids = getSelectedFeeIds();
    if (ids.length === 0) { showToast('请先勾选收费记录'); return; }
    if (!confirm(`确定删除选中的 ${ids.length} 条收费记录吗？此操作不可恢复。`)) return;
    await createServerBackup('批量删除收费记录前自动备份');
    data.fees = (data.fees || []).filter(f => !ids.includes(f.id));
    try {
        await saveFeesToApi(data.fees);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast(`已删除 ${ids.length} 条收费记录`);
    render();
}

function exportFeeRows(fees, filename) {
    const headers = ['学员', '缴费金额', '课时单价', '购买课时', '缴费日期', '套餐', '付款方式', '状态'];
    const rows = fees.map(f => [f.studentName, f.amount, f.pricePerHour, f.hours, f.paymentDate, f.package, f.paymentMethod, f.status === 'paid' ? '已缴' : '欠费']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '收费记录');
    XLSX.writeFile(wb, filename);
    showToast('导出成功');
}

function downloadFeeTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['学员姓名 *', '缴费金额 *', '课时单价', '购买课时', '缴费日期', '套餐', '付款方式', '状态', '备注'],
        ['张三', '8000', '200', '40', '2025-10-01', '秋季班40课时', '微信转账', '已缴', ''],
        ['李四', '6000', '200', '30', '2025-10-01', '秋季班30课时', '支付宝', '已缴', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '收费数据');

    const instrWs = XLSX.utils.aoa_to_sheet([
        ['收费记录导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['学员姓名', '学员真实姓名', '是', '如：张三'],
        ['缴费金额', '本次缴费总金额（元）', '是', '数字，如 8000'],
        ['课时单价', '每个课时单价（元）', '选填', '数字，默认 200'],
        ['购买课时', '本次购买课时数', '选填', '数字，如 40'],
        ['缴费日期', '实际缴费日期', '选填', 'yyyy-mm-dd，如 2025-10-01，留空表示未知'],
        ['套餐', '套餐名称', '选填', '如：秋季班40课时'],
        ['付款方式', '付款渠道', '选填', '微信转账 / 支付宝 / 银行转账 / 现金'],
        ['状态', '是否已缴', '选填', '已缴 / 欠费 / paid / pending（默认已缴）'],
        ['备注', '补充说明', '选填', '如：老学员续费'],
        [''],
        ['注意事项'],
        ['1. 日期必须为 yyyy-mm-dd 格式，如 2025-10-01，留空则不记录日期'],
        ['2. 状态：已缴/paid=已缴费，欠费/pending=未缴费，无法识别会导入失败并跳过'],
        ['3. 导入时通过学员姓名匹配，找到则录入，找不到则跳过'],
        ['4. 金额和课时须为数字，异常值会被跳过'],
    ]);
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
    XLSX.writeFile(wb, '收费记录导入模板.xlsx');
    showToast('模板已下载');
}

function importFees(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            const checkResult = precheckFeeImport(rows);

            // 弹窗预检查，用户确认后再执行实际写入
            showImportPreCheck({
                title: '收费记录导入预览',
                checkResult,
                actionLabel: '导入收费记录',
                duplicateStrategy: 'skip',
                missingStudentStrategy: checkResult.missingStudents.length > 0 ? null : 'skip',
                onConfirm: (strategies) => executeFeeImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

// 预检查：分析每一行，不写入任何数据
// 返回 { total, success, dup, fail, skip, errors[], rowsData[] }
function precheckFeeImport(rows) {
    const validRows = [];
    let skipped = 0, failed = 0;
    const errors = [];
    const duplicates = [];
    const missingStudents = [];
    const skippedDetails = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        if (!row[0]) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写学员姓名' }); continue; }

        const studentName = String(row[0]).trim();
        const amount = parseFloat(row[1]);
        if (isNaN(amount)) { errors.push({ row: rowNum, msg: '金额无效' }); failed++; continue; }

        const paymentDateRaw = row[4];
        let paymentDate = paymentDateRaw ? normalizeExcelDate(paymentDateRaw) : '';
        if (!paymentDate) {
            if (paymentDateRaw) { errors.push({ row: rowNum, msg: '缴费日期无法识别' }); failed++; continue; }
        }

        const statusRaw = String(row[7] || '').trim().toLowerCase();
        let status = 'paid';
        if (statusRaw === '') {
            status = 'paid';
        } else if (['已缴', 'paid', '欠费', 'pending'].includes(statusRaw)) {
            status = (statusRaw === '欠费' || statusRaw === 'pending') ? 'pending' : 'paid';
        } else {
            errors.push({ row: rowNum, msg: `状态"${statusRaw}"无法识别` }); failed++; continue;
        }

        const packageName = String(row[5] || '').trim();
        const normName = normalizeNameForMatch(studentName);
        const matchedStudents = data.students.filter(s => normalizeNameForMatch(s.name) === normName);

        if (matchedStudents.length > 1) {
            const names = matchedStudents.map(s => `"${s.name}"`).join('、');
            errors.push({ row: rowNum, msg: `学员"${studentName}"匹配到多个（${names}），无法确定，请先改名区分` });
            failed++;
            continue;
        }

        if (matchedStudents.length === 0) {
            missingStudents.push({ row: rowNum, name: studentName });
            validRows.push({
                row,
                student: null,
                studentName,
                amount,
                paymentDate,
                packageName,
                status,
                isDupe: false,
                missingStudent: true
            });
            continue;
        }

        const student = matchedStudents[0];
        const isDupe = data.fees.some(f =>
            f.studentId === student.id &&
            f.paymentDate === paymentDate &&
            f.amount === amount &&
            f.package === packageName
        );
        if (isDupe) {
            duplicates.push({ row: rowNum, msg: `${student.name} / ${paymentDate || '日期空'} / ¥${amount} / ${packageName || '套餐空'}` });
        }

        validRows.push({ row, student, amount, paymentDate, packageName, status, isDupe });
    }

    const total = Math.max(rows.length - 1, 0);
    const dup = validRows.filter(v => v.isDupe).length;
    return { total, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, duplicates, skippedDetails, validRows, missingStudents };
}

// 确认导入后实际执行写入
async function executeFeeImport(checkResult, strategies = {}) {
    const { validRows, errors } = checkResult;
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    const missingStudentStrategy = strategies.missingStudentStrategy || 'skip';
    let imported = 0, replaced = 0, newStudents = 0;

    for (const v of validRows) {
        let student = v.student;
        if (v.missingStudent) {
            if (missingStudentStrategy === 'skip') continue;
            student = {
                id: generateId(),
                name: v.studentName,
                gender: '',
                grade: '',
                classId: '',
                teacher: '',
                enrollDate: '',
                firstEnrollDate: '',
                phone: '',
                emergencyContact: '',
                status: 'active',
                followUpStatus: '',
                remark: '由收费记录导入自动创建',
                school: '',
                createdAt: new Date().toISOString()
            };
            data.students.push(student);
            newStudents++;
        }

        if (v.isDupe) {
            if (dupeStrategy === 'skip') { continue; }
            const idx = data.fees.findIndex(f =>
                f.studentId === student.id &&
                f.paymentDate === v.paymentDate &&
                f.amount === v.amount &&
                f.package === v.packageName
            );
            if (idx !== -1) {
                data.fees[idx] = {
                    id: data.fees[idx].id,
                    studentId: student.id,
                    studentName: student.name,
                    amount: v.amount,
                    pricePerHour: parseFloat(v.row[2]) || 200,
                    hours: parseInt(v.row[3]) || 0,
                    paymentDate: v.paymentDate,
                    package: v.packageName,
                    paymentMethod: String(v.row[6] || '').trim(),
                    status: v.status,
                    remark: String(v.row[8] || '').trim()
                };
                replaced++;
                imported++;
                continue;
            }
        }
        data.fees.push({
            id: generateId(),
            studentId: student.id,
            studentName: student.name,
            amount: v.amount,
            pricePerHour: parseFloat(v.row[2]) || 200,
            hours: parseInt(v.row[3]) || 0,
            paymentDate: v.paymentDate,
            package: v.packageName,
            paymentMethod: String(v.row[6] || '').trim(),
            status: v.status,
            remark: String(v.row[8] || '').trim()
        });
        imported++;
    }

    try {
        if (newStudents > 0) {
            await saveCollectionsToApi({ students: data.students, fees: data.fees });
        } else {
            await saveFeesToApi(data.fees);
        }
    } catch (error) {
        showToast('导入保存失败：' + error.message);
        return;
    }
    render();
    const msg = `导入完成：成功 ${imported} 条${replaced > 0 ? `，替换 ${replaced} 条` : ''}${newStudents > 0 ? `，新建学员 ${newStudents} 名` : ''}${checkResult.fail > 0 ? `，失败 ${checkResult.fail} 条` : ''}`;
    showToast(msg);
    showImportResultSummary({
        imported, replaced, skipped, failed: checkResult.fail, total: checkResult.total, newStudents,
        actionLabel: '收费记录导入',
        failedDetails: errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
    if (errors.length > 0) console.log('导入错误:', errors);
}
