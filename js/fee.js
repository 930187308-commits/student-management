// ==================== 收费记录 ====================

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
                <button class="btn btn-success" onclick="openFeeModal()">+ 新增缴费</button>
            </div>
            <div style="display: flex; gap: 24px; margin-bottom: 16px; flex-wrap: wrap;">
                <div><span style="color: #888;">已缴合计：</span><strong style="color: #27ae60;">¥${totalPaid.toLocaleString()}</strong></div>
                <div><span style="color: #888;">欠费合计：</span><strong style="color: #e74c3c;">¥${totalPending.toLocaleString()}</strong></div>
            </div>
            <div class="table-wrapper">
                <table><thead><tr><th>学员</th><th>金额</th><th>单价</th><th>课时</th><th>日期</th><th>套餐</th><th>状态</th><th>操作</th></tr></thead><tbody id="feeTableBody"></tbody></table>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 12px;">
                <button class="btn btn-secondary" onclick="exportFees()">导出Excel</button>
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
    const filtered = data.fees.filter(f => (!search || f.studentName.toLowerCase().includes(search)) && (!status || f.status === status)).sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
    const tbody = document.getElementById('feeTableBody');
    tbody.innerHTML = filtered.map(f => `<tr><td>${escapeHtml(f.studentName)}</td><td>¥${f.amount.toLocaleString()}</td><td>¥${f.pricePerHour}</td><td>${f.hours}</td><td>${f.paymentDate}</td><td>${escapeHtml(f.package)}</td><td><span class="badge ${f.status === 'paid' ? 'badge-paid' : 'badge-pending'}">${f.status === 'paid' ? '已缴' : '欠费'}</span></td><td><button class="btn btn-secondary btn-xs" onclick="openFeeModal('${f.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteFee('${f.id}')">删除</button></td></tr>`).join('');
}

function openFeeModal(id = null) {
    currentEditId = id;
    const fee = id ? data.fees.find(f => f.id === id) : null;
    const existingStudent = fee ? data.students.find(s => s.id === fee.studentId) : null;

    document.getElementById('modalTitle').textContent = id ? '编辑缴费记录' : '新增缴费';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveFee(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>学员 *</label>
                    <input type="text" id="feeStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterFeeStudentList()" style="width: 100%;" value="${existingStudent ? existingStudent.name : ''}">
                    <select id="feeStudentSelect" size="5" required style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectFeeStudent(this)"></select>
                    <input type="hidden" name="studentId" id="feeStudentId" value="${fee?.studentId || ''}">
                </div>
                <div class="form-group"><label>缴费金额 *</label><input type="number" name="amount" value="${fee?.amount || ''}" required min="0"></div>
                <div class="form-group"><label>课时单价</label><input type="number" name="pricePerHour" value="${fee?.pricePerHour || 200}" min="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>购买课时</label><input type="number" name="hours" value="${fee?.hours || ''}" min="0"></div>
                <div class="form-group"><label>缴费日期</label><input type="date" name="paymentDate" value="${fee?.paymentDate || new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label>状态</label><select name="status"><option value="paid" ${(!fee || fee?.status === 'paid') ? 'selected' : ''}>已缴</option><option value="pending" ${fee?.status === 'pending' ? 'selected' : ''}>欠费</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>套餐名称</label><input type="text" name="package" value="${fee?.package || ''}" placeholder="如：秋季班40课时"></div>
                <div class="form-group"><label>付款方式</label><select name="paymentMethod"><option value="微信转账" ${(!fee || fee?.paymentMethod === '微信转账') ? 'selected' : ''}>微信转账</option><option value="支付宝" ${fee?.paymentMethod === '支付宝' ? 'selected' : ''}>支付宝</option><option value="银行转账" ${fee?.paymentMethod === '银行转账' ? 'selected' : ''}>银行转账</option><option value="现金" ${fee?.paymentMethod === '现金' ? 'selected' : ''}>现金</option></select></div>
            </div>
            <div class="form-group"><label>备注</label><textarea name="remark" rows="2">${fee?.remark || ''}</textarea></div>
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

function saveFee(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('feeStudentId').value || form.studentId?.value;
    const student = data.students.find(s => s.id === studentId);
    const feeData = {
        id: currentEditId || generateId(), studentId: studentId, studentName: student?.name || '',
        amount: parseInt(form.amount.value), pricePerHour: parseInt(form.pricePerHour.value),
        hours: parseInt(form.hours.value), paymentDate: form.paymentDate.value, package: form.package.value,
        paymentMethod: form.paymentMethod.value, status: form.status.value, remark: form.remark.value
    };
    if (currentEditId) {
        const index = data.fees.findIndex(f => f.id === currentEditId);
        data.fees[index] = feeData;
    } else {
        data.fees.push(feeData);
    }
    saveData();
    closeModal();
    showToast('保存成功');
    render();
}

function deleteFee(id) {
    if (!confirm('确定删除该缴费记录？')) return;
    data.fees = data.fees.filter(f => f.id !== id);
    saveData();
    showToast('删除成功');
    render();
}

function exportFees() {
    const headers = ['学员', '缴费金额', '课时单价', '购买课时', '缴费日期', '套餐', '付款方式', '状态'];
    const rows = data.fees.map(f => [f.studentName, f.amount, f.pricePerHour, f.hours, f.paymentDate, f.package, f.paymentMethod, f.status === 'paid' ? '已缴' : '欠费']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '收费记录');
    XLSX.writeFile(wb, '收费记录.xlsx');
    showToast('导出成功');
}