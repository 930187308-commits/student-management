// ==================== 数据管理 ====================

function openDataManager() {
    const jsonStr = JSON.stringify(data, null, 2);
    const size = new Blob([jsonStr]).size;
    const sizeStr = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B';

    document.getElementById('modalTitle').textContent = '数据管理';
    document.getElementById('modalBody').innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600;">JSON 数据预览</span>
                <span style="font-size: 12px; color: #888;">数据大小：${sizeStr}</span>
            </div>
            <textarea id="dataJsonPreview" style="width: 100%; height: 300px; font-family: monospace; font-size: 12px; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; resize: vertical; background: var(--input-bg); color: var(--text-primary);" readonly>${jsonStr}</textarea>
        </div>
        <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="copyJsonData()">复制JSON</button>
            <button class="btn btn-success" onclick="saveJsonToFile()">保存到本地文件</button>
            <button class="btn btn-warning" onclick="resetToSampleData()">重置为示例数据</button>
        </div>
        <div style="padding: 16px; background: var(--hover-bg); border-radius: 8px; font-size: 13px;">
            <strong>说明：</strong>JSON 数据包含所有班级、学员、收费、考勤、成绩、沟通记录。
            <br>点击「保存到本地文件」可将数据保存到本地文件夹，方便您查看和备份。
            <br>点击「重置为示例数据」将恢复系统内置的示例数据。
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function resetToSampleData() {
    if (!confirm('确定重置为示例数据？这将覆盖当前所有数据！')) return;
    data = getSampleData();
    saveData();
    closeModal();
    showToast('已重置为示例数据');
    render();
}

function copyJsonData() {
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('已复制到剪贴板');
    }).catch(() => {
        showToast('复制失败，请手动复制');
    });
}

function saveJsonToFile() {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学员管理系统数据_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已保存到本地文件');
}