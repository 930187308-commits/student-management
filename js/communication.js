// ==================== 沟通记录 ====================

let communicationBatchMode = false;

function renderCommunications() {
    const container = document.getElementById('tab-communications');

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="commSearch" placeholder="搜索学员姓名...">
                    <select id="commStatusFilter" onchange="renderCommTable()">
                        <option value="">全部状态</option>
                        <option value="pending">待沟通</option>
                        <option value="done">已完成</option>
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-secondary btn-sm" onclick="openTopicManager()">管理主题</button>
                    <button class="btn btn-primary" onclick="openCommModal()">+ 新增沟通</button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleCommunicationBatchMode()">${communicationBatchMode ? '退出多选' : '多选'}</button>
                    ${communicationBatchMode ? '<button class="btn btn-secondary btn-sm" onclick="exportSelectedCommunications()">导出选中</button><button class="btn btn-danger btn-sm" onclick="deleteSelectedCommunications()">删除选中</button>' : ''}
                </div>
            </div>
            <div id="commCountBar" style="padding: 6px 0; color: #888; font-size: 13px;"></div>
            <div id="commBatchBar" style="padding: 6px 0; color: #888; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                ${communicationBatchMode ? `<span>已选择 <strong id="commSelectedCount">0</strong> 条</span><button class="btn btn-secondary btn-xs" onclick="toggleAllCommunicationSelection(this)" style="padding: 2px 8px;">全选</button>` : ''}
            </div>
            <div class="table-wrapper">
                <table><thead><tr>${communicationBatchMode ? '<th><input type="checkbox" onchange="toggleAllCommunicationSelection(this)"></th>' : ''}<th>主题</th><th>学员</th><th>日期</th><th>方式</th><th>状态</th><th>沟通对象</th><th>操作</th></tr></thead><tbody id="commTableBody"></tbody></table>
            </div>
        </div>
    `;
    container.innerHTML = html;
    document.getElementById('commSearch').addEventListener('input', renderCommTable);
    document.getElementById('commStatusFilter').addEventListener('change', renderCommTable);
    renderCommTable();
}

function renderCommTable() {
    const search = document.getElementById('commSearch')?.value?.toLowerCase() || '';
    const statusFilter = document.getElementById('commStatusFilter')?.value || '';
    const allData = data.communications || [];
    const filtered = allData.filter(c => {
        if (search && !c.studentName.toLowerCase().includes(search)) return false;
        if (statusFilter && c.status !== statusFilter) return false;
        return true;
    }).sort((a, b) => (b.contactDate || '').localeCompare(a.contactDate || ''));
    const total = allData.length;
    const current = filtered.length;
    const countBar = document.getElementById('commCountBar');
    if (countBar) countBar.textContent = total === current ? `共 ${total} 条` : `当前 ${current} 条 / 共 ${total} 条`;
    if (communicationBatchMode) updateCommunicationSelectionCount();
    document.getElementById('commTableBody').innerHTML = filtered.map(c => {
        const topic = (data.communicationTopics || []).find(t => t.id === c.topicId);
        const statusBadge = c.status === 'pending' ? 'badge-pending' : 'badge-active';
        const statusText = c.status === 'pending' ? '待沟通' : '已完成';
        return `<tr>
            ${communicationBatchMode ? `<td><input type="checkbox" class="communication-select" value="${c.id}" onchange="updateCommunicationSelectionCount()"></td>` : ''}
            <td>${topic ? `<span class="badge" style="background:${escapeHtml(topic.color)};color:white;">${escapeHtml(topic.name)}</span>` : '-'}</td>
            <td>${escapeHtml(c.studentName)}</td>
            <td>${c.contactDate || '-'}</td>
            <td>${escapeHtml(c.contactType)}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
            <td>${escapeHtml(c.contactPerson)}</td>
            <td><button class="btn btn-secondary btn-xs" onclick="openCommModal('${c.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteComm('${c.id}')">删除</button></td>
        </tr>`;
    }).join('') || `<tr><td colspan="${communicationBatchMode ? 8 : 7}" style="text-align:center;color:#888;padding:24px;">暂无沟通记录</td></tr>`;
}

function toggleCommunicationBatchMode() {
    communicationBatchMode = !communicationBatchMode;
    renderCommunications();
}

function getSelectedCommunicationIds() {
    return Array.from(document.querySelectorAll('.communication-select:checked')).map(el => el.value);
}

function toggleAllCommunicationSelection(checkbox) {
    const items = Array.from(document.querySelectorAll('.communication-select'));
    const shouldCheck = checkbox.type === 'checkbox' ? checkbox.checked : items.some(el => !el.checked);
    items.forEach(el => { el.checked = shouldCheck; });
    if (checkbox.type !== 'checkbox') checkbox.textContent = shouldCheck ? '取消全选' : '全选';
    updateCommunicationSelectionCount();
}

function updateCommunicationSelectionCount() {
    const count = getSelectedCommunicationIds().length;
    const el = document.getElementById('commSelectedCount');
    if (el) el.textContent = count;
}

function exportSelectedCommunications() {
    const ids = getSelectedCommunicationIds();
    if (ids.length === 0) { showToast('请先勾选沟通记录'); return; }
    const selected = (data.communications || []).filter(c => ids.includes(c.id));
    exportCommunicationRows(selected, `选中沟通记录_${new Date().toISOString().split('T')[0]}.xlsx`);
}

async function deleteSelectedCommunications() {
    const ids = getSelectedCommunicationIds();
    if (ids.length === 0) { showToast('请先勾选沟通记录'); return; }
    if (!confirm(`确定删除选中的 ${ids.length} 条沟通记录吗？此操作不可恢复。`)) return;
    await createServerBackup('批量删除沟通记录前自动备份');
    data.communications = (data.communications || []).filter(c => !ids.includes(c.id));
    try {
        await saveCommunicationsToApi(data.communications);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast(`已删除 ${ids.length} 条沟通记录`);
    render();
}

function exportCommunicationRows(comms, filename) {
    const headers = ['学员', '主题', '日期', '方式', '沟通对象', '状态', '内容', '后续跟进'];
    const rows = comms.map(c => {
        const topic = (data.communicationTopics || []).find(t => t.id === c.topicId);
        return [c.studentName, topic?.name || '', c.contactDate, c.contactType, c.contactPerson, c.status === 'pending' ? '待沟通' : '已完成', c.content, c.followUp || ''];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '沟通记录');
    XLSX.writeFile(wb, filename);
    showToast('导出成功');
}

function openTopicManager() {
    document.getElementById('modalTitle').textContent = '沟通主题管理';
    const topicList = (data.communicationTopics || []).map(t => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--hover-bg); border-radius: 6px; margin-bottom: 8px;">
            <span class="badge" style="background:${t.color};color:white;">${t.name}</span>
            <button class="btn btn-secondary btn-xs" onclick="editTopic('${t.id}')" style="margin-left: auto;">编辑</button>
            <button class="btn btn-danger btn-xs" onclick="deleteTopic('${t.id}')">删除</button>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom: 16px;">
            <input type="text" id="newTopicName" placeholder="新主题名称" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; width: 200px;">
            <input type="color" id="newTopicColor" value="#3498db" style="width: 40px; height: 36px; border: none; cursor: pointer;">
            <button class="btn btn-success btn-sm" onclick="addTopic()" style="margin-left: 8px;">添加</button>
        </div>
        <div>${topicList || '<div class="empty-state">暂无主题</div>'}</div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

async function addTopic() {
    const name = document.getElementById('newTopicName').value.trim();
    const color = document.getElementById('newTopicColor').value;
    if (!name) { showToast('请输入主题名称'); return; }
    data.communicationTopics.push({ id: generateId(), name, color });
    try {
        await saveCommunicationTopicsToApi(data.communicationTopics);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    openTopicManager();
    showToast('主题已添加');
}

async function editTopic(id) {
    const topic = (data.communicationTopics || []).find(t => t.id === id);
    if (!topic) return;
    const newName = prompt('修改主题名称：', topic.name);
    if (!newName || newName === topic.name) return;
    const newColor = prompt('修改颜色(输入hex如 #3498db)：', topic.color);
    topic.name = newName.trim();
    if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) topic.color = newColor;
    try {
        await saveCommunicationTopicsToApi(data.communicationTopics);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    openTopicManager();
    showToast('主题已修改');
}

async function deleteTopic(id) {
    if (!confirm('删除该主题？')) return;
    data.communicationTopics = (data.communicationTopics || []).filter(t => t.id !== id);
    try {
        await saveCommunicationTopicsToApi(data.communicationTopics);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    openTopicManager();
    showToast('主题已删除');
}

function openCommModal(id = null) {
    currentEditId = id;
    const comm = id ? data.communications.find(c => c.id === id) : null;
    const topicOptions = (data.communicationTopics || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    const existingStudent = comm ? data.students.find(s => s.id === comm.studentId) : null;

    document.getElementById('modalTitle').textContent = id ? '编辑沟通' : '新增沟通';
    document.getElementById('modalBody').innerHTML = `
        <form onsubmit="saveComm(event)">
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label>学员 *</label>
                    <input type="text" id="commStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterCommStudentList()" style="width: 100%;" value="${existingStudent ? escapeHtml(existingStudent.name) : ''}">
                    <select id="commStudentSelect" size="5" style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectCommStudent(this)"></select>
                    <input type="hidden" name="studentId" id="commStudentId" value="${comm?.studentId || ''}">
                </div>
                <div class="form-group"><label>沟通主题</label><select name="topicId"><option value="">无</option>${topicOptions}</select></div>
                <div class="form-group"><label>沟通日期</label><input type="date" name="contactDate" value="${comm?.contactDate || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>沟通方式</label><select name="contactType"><option value="电话" ${comm?.contactType === '电话' ? 'selected' : ''}>电话</option><option value="微信" ${comm?.contactType === '微信' ? 'selected' : ''}>微信</option><option value="面谈" ${comm?.contactType === '面谈' ? 'selected' : ''}>面谈</option><option value="家长会" ${comm?.contactType === '家长会' ? 'selected' : ''}>家长会</option></select></div>
                <div class="form-group"><label>沟通对象</label><input type="text" name="contactPerson" value="${escapeHtml(comm?.contactPerson || '')}" placeholder="如：张三妈妈"></div>
                <div class="form-group"><label>状态</label><select name="status"><option value="pending" ${(!comm || comm?.status === 'pending') ? 'selected' : ''}>待沟通</option><option value="done" ${comm?.status === 'done' ? 'selected' : ''}>已完成</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>授课老师</label><input type="text" name="teacher" value="${comm?.teacher || '白老师'}"></div>
            </div>
            <div class="form-group"><label>沟通内容</label><textarea name="content" rows="4">${escapeHtml(comm?.content || '')}</textarea></div>
            <div class="form-group"><label>后续跟进</label><textarea name="followUp" rows="2">${escapeHtml(comm?.followUp || '')}</textarea></div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button><button type="submit" class="btn btn-primary">保存</button></div>
        </form>
    `;
    document.getElementById('modal').classList.add('show');
}

function filterCommStudentList() {
    const input = document.getElementById('commStudentSearch');
    const select = document.getElementById('commStudentSelect');
    const search = input.value.toLowerCase().trim();
    const hiddenInput = document.getElementById('commStudentId');

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

function selectCommStudent(select) {
    const hiddenInput = document.getElementById('commStudentId');
    const searchInput = document.getElementById('commStudentSearch');
    const selectedOption = select.options[select.selectedIndex];
    hiddenInput.value = select.value;
    searchInput.value = selectedOption.text;
    select.style.display = 'none';
}

async function saveComm(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('commStudentId').value || form.studentId?.value;
    const student = data.students.find(s => s.id === studentId);
    if (!studentId || !student) { showToast('请从下拉列表选择学员'); return; }
    const commData = {
        id: currentEditId || generateId(), studentId: studentId, studentName: student?.name || '',
        topicId: form.topicId.value, contactDate: form.contactDate.value, contactType: form.contactType.value,
        contactPerson: form.contactPerson.value, teacher: form.teacher.value,
        status: form.status.value,
        content: form.content.value, followUp: form.followUp.value
    };
    try {
        await saveCollectionItemToApi('communications', commData);
    } catch (error) {
        showToast('保存失败：' + error.message);
        return;
    }
    closeModal();
    showToast('保存成功');
    render();
}

function openCommDetail(id) {
    const comm = data.communications.find(c => c.id === id);
    const topic = (data.communicationTopics || []).find(t => t.id === comm.topicId);
    document.getElementById('modalTitle').textContent = '沟通详情';
    document.getElementById('modalBody').innerHTML = `
        <div class="detail-grid">
            ${topic ? `<div class="detail-item"><div class="label">主题</div><div class="value"><span class="badge" style="background:${escapeHtml(topic.color)};color:white;">${escapeHtml(topic.name)}</span></div></div>` : ''}
            <div class="detail-item"><div class="label">学员</div><div class="value">${escapeHtml(comm.studentName)}</div></div>
            <div class="detail-item"><div class="label">日期</div><div class="value">${comm.contactDate}</div></div>
            <div class="detail-item"><div class="label">方式</div><div class="value">${escapeHtml(comm.contactType)}</div></div>
            <div class="detail-item"><div class="label">沟通对象</div><div class="value">${escapeHtml(comm.contactPerson)}</div></div>
        </div>
        <div style="margin-top: 16px;"><div class="label">沟通内容</div><div style="padding: 12px; background: var(--hover-bg); border-radius: 8px; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(comm.content)}</div></div>
        ${comm.followUp ? `<div style="margin-top: 16px;"><div class="label">后续跟进</div><div style="padding: 12px; background: #fff3cd; border-radius: 8px; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(comm.followUp)}</div></div>` : ''}
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

async function deleteComm(id) {
    if (!confirm('确定删除该沟通记录？')) return;
    try {
        await deleteCollectionItemFromApi('communications', id);
    } catch (error) {
        showToast('删除失败：' + error.message);
        return;
    }
    showToast('删除成功');
    render();
}
