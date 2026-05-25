// ==================== 沟通记录 ====================

function renderCommunications() {
    const container = document.getElementById('tab-communications');

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="search-bar">
                    <input type="text" id="commSearch" placeholder="搜索学员姓名...">
                    <select id="commStatusFilter" onchange="renderCommTable">
                        <option value="">全部状态</option>
                        <option value="pending">待沟通</option>
                        <option value="done">已完成</option>
                    </select>
                </div>
                <div class="toolbar">
                    <button class="btn btn-secondary btn-sm" onclick="openTopicManager()">管理主题</button>
                    <button class="btn btn-primary" onclick="openCommModal()">+ 新增沟通</button>
                </div>
            </div>
            <div class="table-wrapper">
                <table><thead><tr><th>主题</th><th>学员</th><th>日期</th><th>方式</th><th>状态</th><th>沟通对象</th><th>操作</th></tr></thead><tbody id="commTableBody"></tbody></table>
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
    const filtered = data.communications.filter(c => {
        if (search && !c.studentName.toLowerCase().includes(search)) return false;
        if (statusFilter && c.status !== statusFilter) return false;
        return true;
    }).sort((a, b) => (b.contactDate || '').localeCompare(a.contactDate || ''));
    document.getElementById('commTableBody').innerHTML = filtered.map(c => {
        const topic = (data.communicationTopics || []).find(t => t.id === c.topicId);
        const statusBadge = c.status === 'pending' ? 'badge-pending' : 'badge-active';
        const statusText = c.status === 'pending' ? '待沟通' : '已完成';
        return `<tr>
            <td>${topic ? `<span class="badge" style="background:${escapeHtml(topic.color)};color:white;">${escapeHtml(topic.name)}</span>` : '-'}</td>
            <td>${escapeHtml(c.studentName)}</td>
            <td>${c.contactDate}</td>
            <td>${escapeHtml(c.contactType)}</td>
            <td><span class="badge ${statusBadge}">${statusText}</span></td>
            <td>${escapeHtml(c.contactPerson)}</td>
            <td><button class="btn btn-secondary btn-xs" onclick="openCommModal('${c.id}')">编辑</button><button class="btn btn-danger btn-xs" onclick="deleteComm('${c.id}')">删除</button></td>
        </tr>`;
    }).join('');
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

function addTopic() {
    const name = document.getElementById('newTopicName').value.trim();
    const color = document.getElementById('newTopicColor').value;
    if (!name) { showToast('请输入主题名称'); return; }
    data.communicationTopics.push({ id: generateId(), name, color });
    saveData();
    openTopicManager();
    showToast('主题已添加');
}

function editTopic(id) {
    const topic = (data.communicationTopics || []).find(t => t.id === id);
    if (!topic) return;
    const newName = prompt('修改主题名称：', topic.name);
    if (!newName || newName === topic.name) return;
    const newColor = prompt('修改颜色(输入hex如 #3498db)：', topic.color);
    topic.name = newName.trim();
    if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) topic.color = newColor;
    saveData();
    openTopicManager();
    showToast('主题已修改');
}

function deleteTopic(id) {
    if (!confirm('删除该主题？')) return;
    data.communicationTopics = (data.communicationTopics || []).filter(t => t.id !== id);
    saveData();
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
                    <input type="text" id="commStudentSearch" placeholder="搜索学员姓名..." autocomplete="off" oninput="filterCommStudentList()" style="width: 100%;" value="${existingStudent ? existingStudent.name : ''}">
                    <select id="commStudentSelect" size="5" required style="width: 100%; display: none; max-height: 150px; overflow-y: auto;" onclick="selectCommStudent(this)"></select>
                    <input type="hidden" name="studentId" id="commStudentId" value="${comm?.studentId || ''}">
                </div>
                <div class="form-group"><label>沟通主题</label><select name="topicId"><option value="">无</option>${topicOptions}</select></div>
                <div class="form-group"><label>沟通日期</label><input type="date" name="contactDate" value="${comm?.contactDate || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>沟通方式</label><select name="contactType"><option value="电话" ${comm?.contactType === '电话' ? 'selected' : ''}>电话</option><option value="微信" ${comm?.contactType === '微信' ? 'selected' : ''}>微信</option><option value="面谈" ${comm?.contactType === '面谈' ? 'selected' : ''}>面谈</option><option value="家长会" ${comm?.contactType === '家长会' ? 'selected' : ''}>家长会</option></select></div>
                <div class="form-group"><label>沟通对象</label><input type="text" name="contactPerson" value="${comm?.contactPerson || ''}" placeholder="如：张三妈妈"></div>
                <div class="form-group"><label>状态</label><select name="status"><option value="pending" ${(!comm || comm?.status === 'pending') ? 'selected' : ''}>待沟通</option><option value="done" ${comm?.status === 'done' ? 'selected' : ''}>已完成</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>授课老师</label><input type="text" name="teacher" value="${comm?.teacher || '白老师'}"></div>
            </div>
            <div class="form-group"><label>沟通内容</label><textarea name="content" rows="4">${comm?.content || ''}</textarea></div>
            <div class="form-group"><label>后续跟进</label><textarea name="followUp" rows="2">${comm?.followUp || ''}</textarea></div>
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

function saveComm(e) {
    e.preventDefault();
    const form = e.target;
    const studentId = document.getElementById('commStudentId').value || form.studentId?.value;
    const student = data.students.find(s => s.id === studentId);
    const commData = {
        id: currentEditId || generateId(), studentId: studentId, studentName: student?.name || '',
        topicId: form.topicId.value, contactDate: form.contactDate.value, contactType: form.contactType.value,
        contactPerson: form.contactPerson.value, teacher: form.teacher.value,
        status: form.status.value,
        content: form.content.value, followUp: form.followUp.value
    };
    if (currentEditId) {
        const index = data.communications.findIndex(c => c.id === currentEditId);
        data.communications[index] = commData;
    } else {
        data.communications.push(commData);
    }
    saveData();
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

function deleteComm(id) {
    if (!confirm('确定删除该沟通记录？')) return;
    data.communications = data.communications.filter(c => c.id !== id);
    saveData();
    showToast('删除成功');
    render();
}