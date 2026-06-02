// ==================== 意向学员 ====================

let prospectBatchMode = false;

function renderProspects() {
    const container = document.getElementById('tab-prospects');

    const statusMap = { pending: '待跟进', contacted: '已联系', trial: '试课中', forming: '组班中', deal: '已成交', lost: '已流失' };

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="prospectSearch" placeholder="搜索姓名/微信/电话..." oninput="renderProspectList()">
                    <select id="prospectStatusFilter" onchange="renderProspectList()">
                        <option value="">全部状态</option>
                        <option value="forming">组班中</option>
                        ${Object.entries(statusMap).filter(([k]) => k !== 'forming').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
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
                    <button class="btn btn-secondary btn-sm" onclick="toggleProspectBatchMode()">${prospectBatchMode ? '退出多选' : '多选'}</button>
                    ${prospectBatchMode ? '<button class="btn btn-secondary btn-sm" onclick="exportSelectedProspects()">导出选中</button><button class="btn btn-danger btn-sm" onclick="deleteSelectedProspects()">删除选中</button>' : ''}
                </div>
            </div>
            <div id="prospectCountBar" style="padding: 6px 0; color: #888; font-size: 13px;"></div>
            <div id="prospectBatchBar" style="padding: 6px 0; color: #888; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                ${prospectBatchMode ? `<span>已选择 <strong id="prospectSelectedCount">0</strong> 条</span><button class="btn btn-secondary btn-xs" onclick="toggleAllProspectSelection(this)" style="padding: 2px 8px;">全选</button>` : ''}
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr>${prospectBatchMode ? '<th><input type="checkbox" onchange="toggleAllProspectSelection(this)"></th>' : ''}<th>姓名</th><th>年级</th><th>微信</th><th>来源</th><th>目前成绩</th><th>试课日期</th><th>试课状态</th><th>成交状态</th><th>备注</th><th>录入日期</th><th>操作</th></tr></thead>
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
    const allData = data.prospects || [];
    const filtered = allData.filter(p => {
        if (search && !p.name.toLowerCase().includes(search) && !(p.phone || '').includes(search) && !(p.wechat || '').includes(search)) return false;
        if (statusFilter && p.trialStatus !== statusFilter) return false;
        return true;
    }).sort((a, b) => (b.createDate || '').localeCompare(a.createDate || ''));
    const total = allData.length;
    const current = filtered.length;
    const countBar = document.getElementById('prospectCountBar');
    if (countBar) countBar.textContent = total === current ? `共 ${total} 条` : `当前 ${current} 条 / 共 ${total} 条`;
    if (prospectBatchMode) updateProspectSelectionCount();

    const statusMap = { pending: '待跟进', contacted: '已联系', trial: '试课中', forming: '组班中', deal: '已成交', lost: '已流失' };
    const sourceMap = {};
    (data.prospectSources || []).forEach(s => sourceMap[s] = s);

    document.getElementById('prospectTableBody').innerHTML = filtered.map(p => {
        const trialBadge = p.trialStatus === 'trial' ? 'badge-active' : p.trialStatus === 'forming' ? 'badge-trial' : p.trialStatus === 'deal' ? 'badge-success' : 'badge-normal';
        const dealBadge = p.dealStatus === 'deal' ? 'badge-active' : p.dealStatus === 'lost' ? 'badge-danger' : 'badge-normal';
        const remark = p.remark || '';
        const shortRemark = remark.length > 16 ? `${remark.slice(0, 16)}...` : remark;
        return `<tr>
            ${prospectBatchMode ? `<td><input type="checkbox" class="prospect-select" value="${p.id}" onchange="updateProspectSelectionCount()"></td>` : ''}
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.grade || '-')}</td>
            <td>${escapeHtml(p.wechat || '-')}</td>
            <td>${escapeHtml(sourceMap[p.source] || p.source || '-')}</td>
            <td>${escapeHtml(p.intent || '-')}</td>
            <td>${p.trialDate || '-'}</td>
            <td><span class="badge ${trialBadge}">${statusMap[p.trialStatus] || '待跟进'}</span></td>
            <td><span class="badge ${dealBadge}">${p.dealStatus === 'deal' ? '已成交' : p.dealStatus === 'lost' ? '已流失' : '未成交'}</span></td>
            <td title="${escapeHtml(remark)}" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(shortRemark || '-')}</td>
            <td>${p.createDate || '-'}</td>
            <td>
                <button class="btn btn-secondary btn-xs" onclick="openProspectModal('${p.id}')">编辑</button>
                <button class="btn btn-success btn-xs" onclick="convertProspect('${p.id}')">转正式</button>
                <button class="btn btn-xs" style="background:#9b59b6;color:white;" onclick="jumpToAIAgent('recruit-agent','follow-reminder')">AI 话术</button>
                <button class="btn btn-danger btn-xs" onclick="deleteProspect('${p.id}')">删除</button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="${prospectBatchMode ? 12 : 11}" style="text-align:center;color:#888;">暂无意向学员</td></tr>`;
}

function toggleProspectBatchMode() {
    prospectBatchMode = !prospectBatchMode;
    renderProspects();
}

function getSelectedProspectIds() {
    return Array.from(document.querySelectorAll('.prospect-select:checked')).map(el => el.value);
}

function toggleAllProspectSelection(checkbox) {
    const items = Array.from(document.querySelectorAll('.prospect-select'));
    const shouldCheck = checkbox.type === 'checkbox' ? checkbox.checked : items.some(el => !el.checked);
    items.forEach(el => { el.checked = shouldCheck; });
    if (checkbox.type !== 'checkbox') checkbox.textContent = shouldCheck ? '取消全选' : '全选';
    updateProspectSelectionCount();
}

function updateProspectSelectionCount() {
    const count = getSelectedProspectIds().length;
    const el = document.getElementById('prospectSelectedCount');
    if (el) el.textContent = count;
}

function exportSelectedProspects() {
    const ids = getSelectedProspectIds();
    if (ids.length === 0) { showToast('请先勾选意向学员'); return; }
    const selected = (data.prospects || []).filter(p => ids.includes(p.id));
    const statusMap = { pending: '待跟进', contacted: '已联系', trial: '试课中', forming: '组班中', deal: '已成交', lost: '已流失' };
    const headers = ['姓名', '年级', '电话', '微信', '来源', '目前成绩', '试课日期', '试课状态', '成交状态', '备注', '录入日期'];
    const rows = selected.map(p => [p.name, p.grade || '', p.phone || '', p.wechat || '', p.source || '', p.intent || '', p.trialDate || '', statusMap[p.trialStatus] || '', p.dealStatus === 'deal' ? '已成交' : p.dealStatus === 'lost' ? '已流失' : '未成交', p.remark || '', p.createDate || '']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '选中意向学员');
    XLSX.writeFile(wb, `选中意向学员_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('导出成功');
}

async function deleteSelectedProspects() {
    const ids = getSelectedProspectIds();
    if (ids.length === 0) { showToast('请先勾选意向学员'); return; }
    if (!confirm(`确定删除选中的 ${ids.length} 条意向学员记录吗？此操作不可恢复。`)) return;
    await createServerBackup('批量删除意向学员前自动备份');
    data.prospects = (data.prospects || []).filter(p => !ids.includes(p.id));
    try {
        await saveProspectsToApi(data.prospects);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast(`已删除 ${ids.length} 条意向记录`);
    render();
}

function openProspectModal(id = null) {
    currentEditId = id;
    const prospect = id ? (data.prospects || []).find(p => p.id === id) : null;
    const sources = data.prospectSources || ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'];
    const statusOptions = ['待跟进', '已联系', '试课中', '组班中', '已成交', '已流失'];
    const statusValues = ['pending', 'contacted', 'trial', 'forming', 'deal', 'lost'];
    const formingClasses = data.classes.filter(c => c.status === 'forming');
    const classOptions = formingClasses.map(c => `<option value="${escapeHtml(c.id)}" ${prospect?.classId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

    document.getElementById('modalTitle').textContent = id ? '编辑意向学员' : '新增意向学员';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveProspect(event)">
            <div class="form-row">
                <div class="form-group"><label>姓名 *</label><input type="text" name="name" value="${escapeHtml(prospect?.name || '')}" required></div>
                <div class="form-group">
                    <label>年级</label>
                    <select name="grade">
                        <option value="">请选择</option>
                        ${(data.gradeOptions || ['五年级', '六年级', '初一', '初二', '初三', '新初一']).map(g => `<option value="${escapeHtml(g)}" ${prospect?.grade === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>电话</label><input type="tel" name="phone" value="${escapeHtml(prospect?.phone || '')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>微信</label><input type="text" name="wechat" value="${escapeHtml(prospect?.wechat || '')}" placeholder="微信号或微信昵称"></div>
                <div class="form-group">
                    <label>来源渠道</label>
                    <select name="source">
                        <option value="">请选择</option>
                        ${sources.map((s) => `<option value="${escapeHtml(s)}" ${prospect?.source === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>目前成绩</label>
                    <input type="text" name="intent" value="${escapeHtml(prospect?.intent || '')}" placeholder="如：校内80左右、计算薄弱">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>试课日期</label><input type="date" name="trialDate" value="${prospect?.trialDate || ''}"></div>
                <div class="form-group">
                    <label>试课状态</label>
                    <select name="trialStatus">
                        ${statusValues.map((v, i) => `<option value="${escapeHtml(v)}" ${(prospect?.trialStatus || 'pending') === v ? 'selected' : ''}>${escapeHtml(statusOptions[i])}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>成交状态</label>
                    <select name="dealStatus">
                        <option value="">未成交</option>
                        <option value="deal" ${prospect?.dealStatus === 'deal' ? 'selected' : ''}>已成交</option>
                        <option value="lost" ${prospect?.dealStatus === 'lost' ? 'selected' : ''}>已流失</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>所属组班</label>
                    <select name="classId">
                        <option value="">不分配</option>
                        ${classOptions || '<option value="">无可用组班</option>'}
                    </select>
                </div>
                <div class="form-group" style="flex:2;"><label>备注</label><input type="text" name="remark" value="${escapeHtml(prospect?.remark || '')}"></div>
            </div>
            <input type="hidden" name="id" value="${id || ''}">
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

async function saveProspect(e) {
    e.preventDefault();
    const form = e.target;
    const id = form.id.value || generateId();

    // 脏数据清理：classId 和 trialStatus 关系
    // - 选了 classId → trialStatus 强制为 forming
    // - trialStatus !== forming → classId 清空
    const rawClassId = form.classId?.value || '';
    const rawTrialStatus = form.trialStatus.value;
    const finalTrialStatus = rawClassId ? 'forming' : rawTrialStatus;
    const finalClassId = finalTrialStatus === 'forming' ? rawClassId : '';

    const prospectData = {
        id,
        name: form.name.value,
        grade: form.grade.value,
        phone: form.phone.value,
        wechat: form.wechat.value,
        source: form.source.value,
        intent: form.intent.value,
        trialDate: form.trialDate.value,
        trialStatus: finalTrialStatus,
        dealStatus: form.dealStatus.value,
        classId: finalClassId,
        remark: form.remark.value,
        createDate: form.id.value ? (data.prospects || []).find(p => p.id === id)?.createDate : new Date().toISOString().split('T')[0]
    };

    try {
        await saveCollectionItemToApi('prospects', prospectData);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

async function deleteProspect(id) {
    const prospect = (data.prospects || []).find(p => p.id === id);
    const isDealt = prospect?.dealStatus === 'deal';
    const msg = isDealt
        ? `"${escapeHtml(prospect?.name || '')}"已转正式学员，删除意向记录不会影响正式学员。\n\n确定删除该意向记录？`
        : '确定删除该意向学员？此操作不可恢复。';
    if (!confirm(msg)) return;
    try {
        await deleteCollectionItemFromApi('prospects', id);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast('删除成功');
    render();
}

async function convertProspect(id) {
    const prospect = (data.prospects || []).find(p => p.id === id);
    if (!prospect) return;
    if (!confirm(`确定将"${escapeHtml(prospect.name)}"转为正式学员？`)) return;
    try {
        await convertProspectToStudentFromApi(id);
    } catch (error) {
        showToast('转正式失败：' + error.message);
        return;
    }
    showToast('已转为正式学员');
    render();
}

function downloadProspectTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['姓名', '年级', '电话', '微信', '来源', '目前成绩', '试课日期', '试课状态', '成交状态', '备注'],
        ['张三', '六年级', '13800138001', 'ZhaoSan_2025', '家长推荐', '校内80左右', '2025-10-01', '试课中', '未成交', '计算薄弱'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '意向数据');

    const instrWs = XLSX.utils.aoa_to_sheet([
        ['意向学员导入模板 - 填写说明'],
        ['字段', '说明', '必填', '格式/示例'],
        ['姓名', '意向学员姓名', '是', '如：张三'],
        ['年级', '在读年级', '选填', '五年级 / 六年级 / 初一 等'],
        ['电话', '联系电话', '选填', '如：13800138001'],
        ['微信', '微信号或微信昵称', '选填', '如：ZhaoSan_2025'],
        ['来源', '来源渠道', '选填', '家长推荐 / 朋友圈 / 抖音 / 小红书 / 百度 / 地推 / 其他'],
        ['目前成绩', '当前成绩情况', '选填', '如：校内80左右、计算薄弱'],
        ['试课日期', '计划试课日期', '选填', 'yyyy-mm-dd，如 2025-10-01'],
        ['试课状态', '当前状态', '选填', '待跟进 / 已联系 / 试课中 / 组班中 / 已成交 / 已流失'],
        ['成交状态', '成交状态', '选填', '未成交 / 已成交 / 已流失'],
        ['备注', '补充说明', '选填', '如：数学基础一般'],
        [''],
        ['注意事项'],
        ['1. 日期必须为 yyyy-mm-dd 格式，如 2025-10-01'],
        ['2. 试课状态写"组班中"表示在组班中'],
        ['3. 导入时按姓名匹配，找到则录入，找不到则新建'],
    ]);
    XLSX.utils.book_append_sheet(wb, instrWs, '填写说明');
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
            const checkResult = precheckProspectImport(rows);
            showImportPreCheck({
                title: '意向学员导入预览',
                checkResult,
                actionLabel: '导入意向学员',
                duplicateStrategy: 'skip',
                onConfirm: (strategies) => executeProspectImport(checkResult, strategies)
            });
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsBinaryString(file);
    event.target.value = '';
}

function precheckProspectImport(rows) {
    const statusMap = { 'pending': 'pending', '待跟进': 'pending', 'contacted': 'contacted', '已联系': 'contacted', 'trial': 'trial', '试课中': 'trial', 'forming': 'forming', '组班中': 'forming', 'deal': 'deal', '已成交': 'deal', 'lost': 'lost', '已流失': 'lost' };
    const dealStatusMap = { '': '', 'none': '', '未成交': '', 'deal': 'deal', '已成交': 'deal', 'lost': 'lost', '已流失': 'lost' };
    if (!data.prospects) data.prospects = [];

    const validRows = [];
    const errors = [];
    const duplicates = [];
    const skippedDetails = [];
    let skipped = 0;
    let failed = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        if (!row[0]) { skipped++; skippedDetails.push({ row: rowNum, msg: '未填写姓名' }); continue; }
        const hasNewFormat = row.length > 8;
        const name = String(row[0] || '').trim();
        const phone = String(row[hasNewFormat ? 2 : 1] || '').trim();
        const wechat = hasNewFormat ? String(row[3] || '').trim() : '';
        const trialDateRaw = row[hasNewFormat ? 6 : 4];
        const trialDate = trialDateRaw ? normalizeExcelDate(trialDateRaw) || String(trialDateRaw).trim() : '';

        const trialStatusRaw = String(row[hasNewFormat ? 7 : 5] || '').trim();
        const trialStatus = statusMap[trialStatusRaw];
        if (trialStatusRaw && !trialStatus) {
            errors.push({ row: rowNum, msg: `试课状态"${trialStatusRaw}"无法识别` });
            failed++;
            continue;
        }

        const dealStatusRaw = String(row[hasNewFormat ? 8 : 6] || '').trim();
        if (dealStatusRaw && dealStatusMap[dealStatusRaw] === undefined) {
            errors.push({ row: rowNum, msg: `成交状态"${dealStatusRaw}"无法识别` });
            failed++;
            continue;
        }

        const normName = normalizeNameForMatch(name);
        const isDupe = data.prospects.some(p =>
            normalizeNameForMatch(p.name) === normName &&
            (p.phone === phone || p.wechat === wechat) &&
            (phone || wechat)
        );
        if (isDupe) {
            duplicates.push({ row: rowNum, msg: `${name}${phone ? ` / ${phone}` : ''}${wechat ? ` / ${wechat}` : ''}` });
        }

        validRows.push({ row, hasNewFormat, name, phone, wechat, trialDate, trialStatus: trialStatus || 'pending', dealStatus: dealStatusMap[dealStatusRaw] || '', isDupe });
    }

    const total = Math.max(rows.length - 1, 0);
    const dup = validRows.filter(v => v.isDupe).length;
    return { total, success: validRows.length - dup, dup, fail: failed, skip: skipped, errors, duplicates, skippedDetails, validRows };
}

function buildProspectFromImportRow(v, id, existing = {}) {
    return {
        id,
        name: v.name,
        grade: v.hasNewFormat ? String(v.row[1] || '').trim() : '',
        phone: v.phone,
        wechat: v.wechat,
        source: String(v.row[v.hasNewFormat ? 4 : 2] || '').trim(),
        intent: String(v.row[v.hasNewFormat ? 5 : 3] || '').trim(),
        trialDate: v.trialDate,
        trialStatus: v.trialStatus,
        dealStatus: v.dealStatus,
        remark: String(v.row[v.hasNewFormat ? 9 : 7] || '').trim(),
        classId: existing.classId || '',
        createDate: existing.createDate || new Date().toISOString().split('T')[0]
    };
}

async function executeProspectImport(checkResult, strategies = {}) {
    const dupeStrategy = strategies.duplicateStrategy || 'skip';
    let imported = 0;
    let replaced = 0;
    let skipped = checkResult.skip || 0;

    for (const v of checkResult.validRows) {
        const normName = normalizeNameForMatch(v.name);
        if (v.isDupe) {
            if (dupeStrategy === 'skip') { skipped++; continue; }
            const idx = data.prospects.findIndex(p =>
                normalizeNameForMatch(p.name) === normName &&
                (p.phone === v.phone || p.wechat === v.wechat) &&
                (v.phone || v.wechat)
            );
            if (idx !== -1) {
                data.prospects[idx] = buildProspectFromImportRow(v, data.prospects[idx].id, data.prospects[idx]);
                replaced++;
                imported++;
                continue;
            }
        }
        data.prospects.push(buildProspectFromImportRow(v, generateId()));
        imported++;
    }

    try {
        await saveProspectsToApi(data.prospects);
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
        actionLabel: '意向学员导入',
        failedDetails: checkResult.errors || [],
        skippedDetails: checkResult.skippedDetails || []
    });
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

async function addSource() {
    const name = document.getElementById('newSourceName').value.trim();
    if (!name) { showToast('请输入渠道名称'); return; }
    if (!data.prospectSources) data.prospectSources = [];
    if (data.prospectSources.includes(name)) { showToast('该渠道已存在'); return; }
    data.prospectSources.push(name);
    try {
        await saveProspectSourcesToApi(data.prospectSources);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    openSourceManager();
    showToast('渠道已添加');
}

async function deleteSource(name) {
    if (!confirm('删除该渠道？')) return;
    data.prospectSources = (data.prospectSources || []).filter(s => s !== name);
    try {
        await saveProspectSourcesToApi(data.prospectSources);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    openSourceManager();
    showToast('渠道已删除');
}
