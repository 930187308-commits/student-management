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
            <textarea id="dataJsonPreview" style="width: 100%; height: 200px; font-family: monospace; font-size: 12px; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; resize: vertical; background: var(--input-bg); color: var(--text-primary);" readonly>${jsonStr}</textarea>
        </div>
        <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
	            <button class="btn btn-secondary" onclick="copyJsonData()">复制JSON</button>
	            <button class="btn btn-success" onclick="saveJsonToFile()">保存JSON</button>
	            <button class="btn btn-secondary" onclick="exportAllStudents()">一键导出所有学员</button>
	            <button class="btn btn-primary" onclick="exportAllExcel()">一键导出所有Excel</button>
        </div>
        <div style="margin-bottom: 16px;">
            <button class="btn btn-danger" onclick="confirmClearAllData()">一键清空所有数据</button>
        </div>
        <div style="margin-bottom: 16px;">
            <button class="btn btn-warning" onclick="resetToSampleData()">重置为示例数据</button>
        </div>
        <div style="padding: 16px; background: var(--hover-bg); border-radius: 8px; font-size: 13px;">
            <strong>说明：</strong>JSON 数据包含所有班级、学员、收费、考勤、成绩、沟通记录。
            <br>「一键导出所有Excel」会下载所有数据的 Excel 文件（收费、考勤、成绩、班级学员等）。
            <br>「一键清空所有数据」将删除本地所有数据，且 <strong style="color:#e74c3c;">无法找回</strong>，清空前请确认已导出所有文件。
            <br>「重置为示例数据」将恢复系统内置的示例数据。
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

// 一键导出所有Excel文件
function exportAllStudents() {
    const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业', forming: '组班中（旧）' };
    const headers = ['姓名', '性别', '年级', '所在班级', '授课老师', '入班时间', '首次入学', '联系电话', '紧急联系人', '就读学校', '状态', '跟进状态', '备注'];
    const rows = (data.students || []).map(s => {
        const cls = (data.classes || []).find(c => c.id === s.classId);
        return [
            s.name || '',
            s.gender || '',
            s.grade || '',
            cls?.name || '未分班',
            s.teacher || '',
            s.enrollDate || '',
            s.firstEnrollDate || '',
            s.phone || '',
            s.emergencyContact || '',
            s.school || '',
            statusMap[s.status] || s.status || '',
            s.followUpStatus || '',
            s.remark || ''
        ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '所有学员');
    XLSX.writeFile(wb, `所有学员_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('所有学员已导出');
}

function exportAllExcel() {
    // 导出收费记录
    if (data.fees && data.fees.length > 0) {
        const feeHeaders = ['学员', '金额', '单价', '课时', '缴费日期', '套餐', '缴费方式', '状态', '备注'];
        const feeRows = data.fees.map(f => [f.studentName, f.amount, f.pricePerHour, f.hours, f.paymentDate, f.package, f.paymentMethod, f.status === 'paid' ? '已缴' : '欠费', f.remark || '']);
        const feeWs = XLSX.utils.aoa_to_sheet([feeHeaders, ...feeRows]);
        const feeWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(feeWb, feeWs, '收费记录');
        XLSX.writeFile(feeWb, `收费记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出成绩记录
    if (data.grades && data.grades.length > 0) {
        const gradeHeaders = ['学员', '测试名称', '日期', '类型', '得分', '满分', '排名', '薄弱点', '备注'];
        const gradeRows = data.grades.map(g => [g.studentName, g.testName, g.testDate, g.examType === 'school' ? '校内' : '校外', g.score, g.fullScore, `第${g.ranking}名`, g.weakPoints || '', g.remark || '']);
        const gradeWs = XLSX.utils.aoa_to_sheet([gradeHeaders, ...gradeRows]);
        const gradeWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(gradeWb, gradeWs, '成绩记录');
        XLSX.writeFile(gradeWb, `成绩记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出班级学员
    if (data.classes && data.classes.length > 0) {
        data.classes.forEach(cls => {
            const students = data.students.filter(s => s.classId === cls.id);
            if (students.length > 0) {
                const stuHeaders = ['姓名', '性别', '年级', '授课老师', '联系电话', '就读学校', '状态', '备注'];
                const stuRows = students.map(s => [s.name, s.gender, s.grade, s.teacher, s.phone || '', s.school || '', s.status === 'active' ? '在读' : s.status, s.remark || '']);
                const stuWs = XLSX.utils.aoa_to_sheet([stuHeaders, ...stuRows]);
                const stuWb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(stuWb, stuWs, cls.name);
                XLSX.writeFile(stuWb, `班级学员_${cls.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
            }
        });
    }

    // 导出沟通记录
    if (data.communications && data.communications.length > 0) {
        const commHeaders = ['学员', '主题', '日期', '方式', '沟通对象', '状态', '内容', '后续跟进'];
        const commRows = data.communications.map(c => {
            const topic = (data.communicationTopics || []).find(t => t.id === c.topicId);
            return [c.studentName, topic?.name || '', c.contactDate, c.contactType, c.contactPerson, c.status === 'pending' ? '待沟通' : '已完成', c.content, c.followUp || ''];
        });
        const commWs = XLSX.utils.aoa_to_sheet([commHeaders, ...commRows]);
        const commWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(commWb, commWs, '沟通记录');
        XLSX.writeFile(commWb, `沟通记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出意向学员
    if (data.prospects && data.prospects.length > 0) {
        const proHeaders = ['姓名', '年级', '电话', '微信', '来源', '目前成绩', '试课日期', '试课状态', '成交状态', '备注', '录入日期'];
        const proRows = data.prospects.map(p => [p.name, p.grade || '', p.phone || '', p.wechat || '', p.source || '', p.intent || '', p.trialDate || '', { pending: '待跟进', contacted: '已联系', trial: '试课中', forming: '组班中', deal: '已成交', lost: '已流失' }[p.trialStatus] || '', p.dealStatus === 'deal' ? '已成交' : p.dealStatus === 'lost' ? '已流失' : '未成交', p.remark || '', p.createDate || '']);
        const proWs = XLSX.utils.aoa_to_sheet([proHeaders, ...proRows]);
        const proWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(proWb, proWs, '意向学员');
        XLSX.writeFile(proWb, `意向学员_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    showToast('已导出所有Excel文件');
}

// 确认清空所有数据
function confirmClearAllData() {
    if (!confirm('确定清空所有数据？此操作不可恢复！\n\n请确认：\n1. 已导出所有重要数据\n2. 了解清空后无法找回\n\n点击确定继续。')) return;
    if (!confirm('最后一次确认：清空后所有学员、班级、收费、考勤、成绩、沟通记录都将被删除！')) return;

    // 清空所有数据
    data = {
        classes: [],
        students: [],
        fees: [],
        attendance: [],
        grades: [],
        communications: [],
        communicationTopics: [
            { id: 't1', name: '续费沟通', color: '#27ae60' },
            { id: 't2', name: '学情反馈', color: '#3498db' },
            { id: 't3', name: '请假沟通', color: '#f39c12' },
            { id: 't4', name: '投诉处理', color: '#e74c3c' },
            { id: 't5', name: '其他', color: '#95a5a6' }
        ],
        prospects: [],
        prospectSources: ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'],
        classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班']
    };
    dataModified = false; // 重置改动标记
    saveData();
    closeModal();
    showToast('已清空所有数据');
    render();
}

function resetToSampleData() {
    if (!confirm('确定重置为示例数据？这将覆盖当前所有数据！')) return;
    data = getSampleData();
    dataModified = false; // 重置改动标记
    saveData();
    closeModal();
    showToast('已重置为示例数据');
    render();
}

function copyJsonData() {
    const jsonStr = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        dataModified = false; // 复制后重置改动标记
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
    dataModified = false; // 保存后重置改动标记
    showToast('已保存到本地文件');
}
