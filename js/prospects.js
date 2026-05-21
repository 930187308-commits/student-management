// ==================== 意向学员 ====================

function renderProspects() {
    const container = document.getElementById('tab-prospects');

    const statusMap = { pending: '待跟进', contacted: '已联系', trial: '试课中', deal: '已成交', lost: '已流失' };

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="prospectSearch" placeholder="搜索姓名/电话..." oninput="renderProspectList()">
                    <select id="prospectStatusFilter" onchange="renderProspectList()">
                        <option value="">全部状态</option>
                        ${Object.entries(statusMap).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-secondary" onclick="downloadProspectTemplate()">下载模板</button>
                    <div class="file-input-wrapper">
                        <button class="btn btn-warning">导入</button>
                        <input type="file" accept=".xlsx,.xls" onchange="importProspects(event)">
                    </div>
                    <button class="btn btn-primary" onclick="openProspectModal()">+ 新增意向</button>
                    <button class="btn btn-secondary btn-sm" onclick="openSourceManager()">渠道管理</button>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>姓名</th><th>电话</th><th>来源</th><th>咨询意向</th><th>试课日期</th><th>试课状态</th><th>成交状态</th><th>录入日期</th><th>操作</th></tr></thead>
                    <tbody id="prospectTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
    renderProspectList();
}

function renderProspectList() {
    const search = document.getElementById('prospectSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('prospectStatusFilter')?.value || '';

    const filtered = (data.prospects || []).filter(p => {
        if (search && !p.name.toLowerCase().includes(search) && !(p.phone || '').includes(search)) return false;
        if (statusFilter && p.trialStatus !== statusFilter) return false;
        return true;
    });

    const statusMap = { pending: '待跟进', contacted: '已联系', trial: '试课中', deal: '已成交', lost: '已流失' };
    const sourceMap = {};
    (data.prospectSources || []).forEach(s => sourceMap[s] = s);

    document.getElementById('prospectTableBody').innerHTML = filtered.map(p => {
        const trialBadge = p.trialStatus === 'trial' ? 'badge-active' : p.trialStatus === 'deal' ? 'badge-success' : 'badge-normal';
        const dealBadge = p.dealStatus === 'deal' ? 'badge-active' : p.dealStatus === 'lost' ? 'badge-danger' : 'badge-normal';
        return `<tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.phone || '-'}</td>
            <td>${sourceMap[p.source] || p.source || '-'}</td>
            <td>${p.intent || '-'}</td>
            <td>${p.trialDate || '-'}</td>
            <td><span class="badge ${trialBadge}">${statusMap[p.trialStatus] || '待跟进'}</span></td>
            <td><span class="badge ${dealBadge}">${p.dealStatus === 'deal' ? '已成交' : p.dealStatus === 'lost' ? '已流失' : '未成交'}</span></td>
            <td>${p.createDate || '-'}</td>
            <td>
                <button class="btn btn-secondary btn-xs" onclick="openProspectModal('${p.id}')">编辑</button>
                <button class="btn btn-success btn-xs" onclick="convertProspect('${p.id}')">转正式</button>
                <button class="btn btn-danger btn-xs" onclick="deleteProspect('${p.id}')">删除</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:#888;">暂无意向学员</td></tr>';
}

function openProspectModal(id = null) {
    currentEditId = id;
    const prospect = id ? (data.prospects || []).find(p => p.id === id) : null;
    const sources = data.prospectSources || ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'];
    const intentOptions = ['补习数学', '提升成绩', '竞赛培训', '小升初', '中考备考', '其他'];
    const statusOptions = ['待跟进', '已联系', '试课中', '已成交', '已流失'];
    const statusValues = ['pending', 'contacted', 'trial', 'deal', 'lost'];

    document.getElementById('modalTitle').textContent = id ? '编辑意向学员' : '新增意向学员';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveProspect(event)">
            <div class="form-row">
                <div class="form-group"><label>姓名 *</label><input type="text" name="name" value="${prospect?.name || ''}" required></div>
                <div class="form-group"><label>电话</label><input type="tel" name="phone" value="${prospect?.phone || ''}"></div>
                <div class="form-group">
                    <label>来源渠道</label>
                    <select name="source">
                        <option value="">请选择</option>
                        ${sources.map((s, i) => `<option value="${s}" ${prospect?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>咨询意向</label>
                    <select name="intent">
                        <option value="">请选择</option>
                        ${intentOptions.map(o => `<option value="${o}" ${prospect?.intent === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>试课日期</label><input type="date" name="trialDate" value="${prospect?.trialDate || ''}"></div>
                <div class="form-group">
                    <label>试课状态</label>
                    <select name="trialStatus">
                        ${statusValues.map((v, i) => `<option value="${v}" ${(prospect?.trialStatus || 'pending') === v ? 'selected' : ''}>${statusOptions[i]}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成交状态</label>
                    <select name="dealStatus">
                        <option value="">未成交</option>
                        <option value="deal" ${prospect?.dealStatus === 'deal' ? 'selected' : ''}>已成交</option>
                        <option value="lost" ${prospect?.dealStatus === 'lost' ? 'selected' : ''}>已流失</option>
                    </select>
                </div>
                <div class="form-group" style="flex:2;"><label>备注</label><input type="text" name="remark" value="${prospect?.remark || ''}"></div>
            </div>
            <input type="hidden" name="id" value="${id || ''}">
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function saveProspect(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.id.value || generateId();
    const prospectData = {
        id,
        name: form.name.value,
        phone: form.phone.value,
        source: form.source.value,
        intent: form.intent.value,
        trialDate: form.trialDate.value,
        trialStatus: form.trialStatus.value,
        dealStatus: form.dealStatus.value,
        remark: form.remark.value,
        createDate: form.id.value ? (data.prospects || []).find(p => p.id === id)?.createDate : new Date().toISOString().split('T')[0]
    };

    if (form.id.value) {
        const idx = (data.prospects || []).findIndex(p => p.id === id);
        if (idx !== -1) data.prospects[idx] = prospectData;
    } else {
        if (!data.prospects) data.prospects = [];
        data.prospects.push(prospectData);
    }
    saveData();
    closeModal();
    showToast('保存成功');
    render();
}

function deleteProspect(id) {
    if (!confirm('确定删除该意向学员？')) return;
    data.prospects = (data.prospects || []).filter(p => p.id !== id);
    saveData();
    showToast('删除成功');
    render();
}

function convertProspect(id) {
    const prospect = (data.prospects || []).find(p => p.id === id);
    if (!prospect) return;
    if (!confirm(`确定将"${prospect.name}"转为正式学员？`)) return;

    // 创建正式学员
    const studentData = {
        id: generateId(),
        name: prospect.name,
        gender: '',
        grade: prospect.intent?.includes('小升初') ? '六年级' : prospect.intent?.includes('中考') ? '初三' : '初一',
        classId: '',
        teacher: '白老师',
        enrollDate: new Date().toISOString().split('T')[0],
        phone: prospect.phone || '',
        emergencyContact: '',
        status: 'active',
        remark: `来源：${prospect.source || ''}，意向：${prospect.intent || ''}`
    };
    data.students.push(studentData);

    // 更新成交状态
    prospect.dealStatus = 'deal';
    saveData();
    showToast('已转为正式学员');
    render();
}

function downloadProspectTemplate() {
    const headers = [['姓名', '电话', '来源', '咨询意向', '试课日期', '试课状态', '成交状态', '备注']];
    const sampleRows = [['张三', '13800138001', '家长推荐', '提升成绩', '2025-10-01', '试课中', '未成交', '数学基础一般']];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '意向学员导入模板');
    XLSX.writeFile(wb, '意向学员导入模板.xlsx');
    showToast('模板已下载');
}

function importProspects(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
            let imported = 0;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;
                const statusMap = { '待跟进': 'pending', '已联系': 'contacted', '试课中': 'trial', '已成交': 'deal', '已流失': 'lost' };
                if (!data.prospects) data.prospects = [];
                data.prospects.push({
                    id: generateId(),
                    name: String(row[0] || '').trim(),
                    phone: String(row[1] || '').trim(),
                    source: String(row[2] || '').trim(),
                    intent: String(row[3] || '').trim(),
                    trialDate: String(row[4] || '').trim(),
                    trialStatus: statusMap[String(row[5] || '').trim()] || 'pending',
                    dealStatus: String(row[6] || '').trim() === '已成交' ? 'deal' : '',
                    remark: String(row[7] || '').trim(),
                    createDate: new Date().toISOString().split('T')[0]
                });
                imported++;
            }
            saveData();
            render();
            showToast(`成功导入 ${imported} 条意向学员`);
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function openSourceManager() {
    document.getElementById('modalTitle').textContent = '渠道管理';
    const sources = data.prospectSources || [];
    const sourceList = sources.map(s => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--hover-bg); border-radius: 6px; margin-bottom: 8px;">
            <span style="flex:1;">${s}</span>
            <button class="btn btn-danger btn-xs" onclick="deleteSource('${s}')">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <input type="text" id="newSourceName" placeholder="新渠道名称" style="flex:1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
            <button class="btn btn-success btn-sm" onclick="addSource()">添加</button>
        </div>
        <div>${sourceList || '<div class="empty-state">暂无渠道</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function addSource() {
    const name = document.getElementById('newSourceName').value.trim();
    if (!name) { showToast('请输入渠道名称'); return; }
    if (!data.prospectSources) data.prospectSources = [];
    if (data.prospectSources.includes(name)) { showToast('该渠道已存在'); return; }
    data.prospectSources.push(name);
    saveData();
    openSourceManager();
    showToast('渠道已添加');
}

function deleteSource(name) {
    if (!confirm('删除该渠道？')) return;
    data.prospectSources = (data.prospectSources || []).filter(s => s !== name);
    saveData();
    openSourceManager();
    showToast('渠道已删除');
}