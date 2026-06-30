// ==================== 数据管理 ====================

function openDataManager() {
    const jsonStr = JSON.stringify(data, null, 2);
    const size = new Blob([jsonStr]).size;
    const sizeStr = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B';

    document.getElementById('modalTitle').textContent = '数据管理';
    document.getElementById('modalBody').innerHTML = `
        <div class="data-manager-modal">
            <section class="data-manager-section">
                <div class="data-manager-section-title">导出</div>
                <div class="data-manager-action-row">
                    <button class="btn btn-secondary" onclick="exportAllStudents()">导出所有学员</button>
                    <button class="btn btn-primary" onclick="exportAllExcel()">一键导出所有Excel</button>
                </div>
            </section>

            <section class="data-manager-section">
                <div class="data-manager-section-title">备份</div>
                <div class="data-manager-action-row">
                    <button class="btn btn-secondary" onclick="openBackupManager()">备份列表</button>
                    <button class="btn btn-success" onclick="createManualServerBackup()">立即创建备份</button>
                </div>
            </section>

            <details class="data-manager-debug">
                <summary>高级 JSON 工具（仅调试使用）</summary>
                <div class="data-manager-debug-head">
                    <span>数据大小：${sizeStr}</span>
                    <div class="data-manager-action-row">
                        <button class="btn btn-secondary btn-sm" onclick="copyJsonData()">复制 JSON</button>
                        <button class="btn btn-success btn-sm" onclick="saveJsonToFile()">保存 JSON</button>
                    </div>
                </div>
                <textarea id="dataJsonPreview" class="data-manager-json-preview" readonly>${jsonStr}</textarea>
            </details>

            <section class="data-manager-danger">
                <div class="data-manager-danger-title">危险操作</div>
                <div class="data-manager-danger-row">
                    <button class="btn btn-danger" onclick="confirmClearAllData()">一键清空所有数据</button>
                    <span>覆盖当前所有数据，删除后无法找回</span>
                </div>
                <div class="data-manager-danger-row">
                    <button class="btn btn-warning" onclick="resetToSampleData()">重置为示例数据</button>
                    <span>用示例数据替换当前所有数据</span>
                </div>
            </section>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function formatOperationLogTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function openOperationLogModal() {
    const logs = [...(data.operationLogs || [])]
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 100);
    const rows = logs.map(log => `
        <tr>
            <td class="operation-log-time">${escapeHtml(formatOperationLogTime(log.createdAt))}</td>
            <td>${escapeHtml(log.module || '-')}</td>
            <td>${escapeHtml(log.targetName || '-')}</td>
            <td>${escapeHtml(log.summary || '-')}</td>
        </tr>
    `).join('');

    document.getElementById('modalTitle').textContent = '操作日志';
    document.getElementById('modalBody').innerHTML = `
        <div class="operation-log-modal">
            <div class="operation-log-note">
                记录核心业务的新增、编辑、删除和系统动作。当前仅用于追溯，撤回仍使用顶部“撤回上一步”。
            </div>
            ${logs.length === 0 ? '<div class="empty-state">暂无操作记录。之后新增、编辑、删除核心数据会自动记录。</div>' : `
                <div class="table-wrapper">
                    <table class="operation-log-table">
                        <thead><tr><th>时间</th><th>模块</th><th>对象</th><th>记录</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `}
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
    document.getElementById('modal').classList.add('show');
}

function getDataHealthReport() {
    const classes = data.classes || [];
    const students = data.students || [];
    const attendance = data.attendance || [];
    const fees = data.fees || [];
    const classIds = new Set(classes.map(c => c.id));
    const studentIds = new Set(students.map(s => s.id));
    const inactiveStudentIds = new Set(students.filter(s => s.status !== 'active' && s.status !== 'renewalPending').map(s => s.id));
    const paidHours = {};
    const pendingHours = {};
    const feeCounts = {};
    const usedHours = {};

    fees.filter(f => f.status === 'paid').forEach(f => {
        paidHours[f.studentId] = (paidHours[f.studentId] || 0) + Number(f.hours || 0);
    });
    fees.forEach(f => {
        feeCounts[f.studentId] = (feeCounts[f.studentId] || 0) + 1;
        if (f.status === 'pending') {
            pendingHours[f.studentId] = (pendingHours[f.studentId] || 0) + Number(f.hours || 0);
        }
    });
    attendance.forEach(session => {
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (status === 1) usedHours[studentId] = (usedHours[studentId] || 0) + 1;
        });
    });
    const getStudentDetail = (student) => {
        const paid = paidHours[student.id] || 0;
        const pending = pendingHours[student.id] || 0;
        const used = usedHours[student.id] || 0;
        const remaining = paid - used;
        const coveredRemaining = paid + pending - used;
        const cls = classes.find(c => c.id === student.classId);
        return {
            ...student,
            paidHours: paid,
            pendingHours: pending,
            usedHours: used,
            remainingHours: remaining,
            coveredRemainingHours: coveredRemaining,
            className: cls?.name || '未分班',
            feeCount: feeCounts[student.id] || 0,
            suggestedHours: Math.max(used - paid - pending, 1)
        };
    };

    const orphanAttendance = attendance.filter(a => a.classId && !classIds.has(a.classId));
    const orphanFees = fees.filter(f => f.studentId && !studentIds.has(f.studentId));
    const inactiveStudentFees = fees.filter(f => inactiveStudentIds.has(f.studentId));
    let unknownRecordRefs = 0;
    attendance.forEach(session => {
        Object.keys(session.records || {}).forEach(studentId => {
            if (!studentIds.has(studentId)) unknownRecordRefs++;
        });
    });
    const emptySessions = attendance.filter(a => Object.keys(a.records || {}).length === 0);
    const negativeRemaining = students.filter(s => (paidHours[s.id] || 0) - (usedHours[s.id] || 0) < 0);
    const missingDebtRecords = students.filter(s => {
        const paid = paidHours[s.id] || 0;
        const pending = pendingHours[s.id] || 0;
        const used = usedHours[s.id] || 0;
        return s.status === 'active' && used > 0 && (feeCounts[s.id] || 0) > 0 && paid + pending < used;
    });
    const activeNoPaid = students.filter(s => s.status === 'active' && (usedHours[s.id] || 0) > 0 && (feeCounts[s.id] || 0) === 0);
    const overCapacity = classes.filter(c => {
        if (c.status !== 'active') return false;
        const count = students.filter(s => s.classId === c.id && s.status === 'active').length;
        return count > Number(c.maxStudents || c.capacity || 10);
    });
    const negativeRemainingDetails = negativeRemaining.map(getStudentDetail)
        .sort((a, b) => a.remainingHours - b.remainingHours);
    const missingDebtDetails = missingDebtRecords.map(getStudentDetail)
        .sort((a, b) => a.coveredRemainingHours - b.coveredRemainingHours);
    const activeNoPaidDetails = activeNoPaid.map(getStudentDetail)
        .sort((a, b) => b.usedHours - a.usedHours || (a.name || '').localeCompare(b.name || '', 'zh-Hans-CN'));

    return {
        orphanAttendance,
        orphanFees,
        unknownRecordRefs,
        emptySessions,
        negativeRemaining,
        missingDebtRecords,
        activeNoPaid,
        overCapacity,
        inactiveStudentFees,
        negativeRemainingDetails,
        missingDebtDetails,
        activeNoPaidDetails
    };
}

async function loadPreferredDataHealthReport() {
    try {
        return await loadDataHealthReportFromApi();
    } catch (error) {
        console.log('读取后端数据体检失败，使用本地计算:', error);
        return getDataHealthReport();
    }
}

async function openDataHealthCheck() {
    document.getElementById('modalTitle').textContent = '数据体检';
    document.getElementById('modalBody').innerHTML = '<div class="modal-loading-text">正在读取数据体检...</div>';
    document.getElementById('modal').classList.add('show');

    const report = await loadPreferredDataHealthReport();
    const safeCleanCount = report.orphanAttendance.length + report.unknownRecordRefs + report.orphanFees.length;
    updateDataHealthBadge(report);
    document.getElementById('modalTitle').textContent = '数据体检';
    document.getElementById('modalBody').innerHTML = `
        <div class="data-health-modal">
            <section class="data-health-section">
                <div class="data-health-section-title is-danger">需处理（可安全清理）</div>
                <div class="data-health-card-grid">
                    <div class="data-health-card is-danger"><span>不存在班级的考勤</span><strong>${report.orphanAttendance.length}</strong><em>条</em></div>
                    <div class="data-health-card is-danger"><span>无关联学员的考勤记录</span><strong>${report.unknownRecordRefs}</strong><em>个</em></div>
                    <div class="data-health-card is-danger"><span>已删学员的收费记录</span><strong>${report.orphanFees.length}</strong><em>条</em></div>
                </div>
            </section>
            <section class="data-health-section">
                <div class="data-health-section-title">提示（不自动处理）</div>
                <div class="data-health-card-grid">
                    <div class="data-health-card"><span>空考勤课次</span><strong>${report.emptySessions.length}</strong><em>条</em></div>
                    <div class="data-health-card is-warning"><span>已缴余额为负</span><strong>${report.negativeRemaining.length}</strong><em>名</em></div>
                    <div class="data-health-card is-warning"><span>课时不足（欠费）</span><strong>${report.missingDebtRecords.length}</strong><em>名</em></div>
                    <div class="data-health-card is-warning"><span>上课无收费记录</span><strong>${report.activeNoPaid.length}</strong><em>名</em></div>
                    <div class="data-health-card"><span>超容量班级</span><strong>${report.overCapacity.length}</strong><em>个</em></div>
                </div>
            </section>
            <div class="data-health-note">
                <strong>说明：</strong>上排红色项（${safeCleanCount} 条）可一键清理，下排橙色项只提示不自动处理。<br>
                「已有收费但课时不足」适合补欠费，「上课无收费记录」适合先建收费记录再补欠费。「已缴余额为负」不建议重复补录。
            </div>
            ${renderFeeHealthDetails(report)}
            ${renderTuitionHealthDetails(report)}
            ${safeCleanCount > 0 ? `<div class="data-health-action-row"><button class="btn btn-danger" onclick="cleanSafeHealthIssues()">清理安全项（${safeCleanCount} 条）</button></div>` : '<div class="data-health-safe-state">暂无需要安全清理的数据</div>'}
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
    `;
}

function getActionableHealthCount(report = getDataHealthReport()) {
    return report.orphanAttendance.length
        + report.unknownRecordRefs
        + report.orphanFees.length
        + report.missingDebtRecords.length
        + report.activeNoPaid.length;
}

function updateDataHealthBadge(report = null) {
    const badge = document.getElementById('dataHealthBadge');
    if (!badge || !data) return;
    const healthReport = report || getDataHealthReport();
    const count = getActionableHealthCount(healthReport);
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('is-hidden');
        badge.title = `有 ${count} 项数据需要处理`;
    } else {
        badge.textContent = '';
        badge.classList.add('is-hidden');
        badge.title = '';
    }
}

function renderTuitionHealthDetails(report) {
    const renderRows = (items, type, showAction = true) => items.map(s => `
        <tr>
            <td>${escapeHtml(s.name || '')}</td>
            <td>${escapeHtml(s.grade || '-')}</td>
            <td>${escapeHtml(s.className || '-')}</td>
            <td>${s.paidHours}</td>
            <td>${s.pendingHours}</td>
            <td>${s.usedHours}</td>
            <td><strong class="${s.coveredRemainingHours < 0 ? 'data-health-negative' : 'data-health-warning'}">${s.coveredRemainingHours}</strong></td>
            ${showAction ? `<td><button class="btn btn-warning btn-xs" onclick="openPendingFeeFromHealth('${s.id}', ${s.suggestedHours}, '${type}')">补录欠费</button></td>` : ''}
        </tr>
    `).join('');

    const section = (title, items, note, type, showAction = true) => `
        <details class="data-health-detail">
            <summary>${title}（${items.length} 名）</summary>
            <div class="data-health-detail-note">${note}</div>
            ${items.length > 0 ? `
                <div class="table-wrapper data-health-table-wrap">
                    <table>
                        <thead><tr><th>学员</th><th>年级</th><th>班级</th><th>已缴课时</th><th>欠费课时</th><th>已消课时</th><th>覆盖后余额</th>${showAction ? '<th>操作</th>' : ''}</tr></thead>
                        <tbody>${renderRows(items, type, showAction)}</tbody>
                    </table>
                </div>
            ` : '<div class="data-health-empty">暂无</div>'}
        </details>
    `;

    return `
        ${section('已有收费但课时不足明细', report.missingDebtDetails, '只显示已经出勤、收费记录不为空，但已缴课时 + 已登记欠费课时仍不足覆盖已消课时的在读学员。', 'missingDebt')}
        ${section('上课无收费记录明细', report.activeNoPaidDetails, '只显示已经有出勤记录、但收费记录里完全没有已缴或欠费记录的在读学员。', 'noFee')}
        ${section('已缴余额为负参考', report.negativeRemainingDetails, '这是纯"已缴课时 - 已消课时"的参考口径。若已登记欠费，首页欠费提醒会继续跟进，这里不建议重复补录。', 'negative', false)}
    `;
}

function renderFeeHealthDetails(report) {
    const orphanRows = (report.orphanFees || []).map(f => `
        <tr>
            <td>${escapeHtml(f.studentName || '-')}</td>
            <td>${f.status === 'paid' ? '已缴' : '欠费'}</td>
            <td>¥${Number(f.amount || 0).toLocaleString()}</td>
            <td>${f.hours || 0}</td>
            <td>${escapeHtml(f.package || '-')}</td>
        </tr>
    `).join('');
    const inactiveRows = (report.inactiveStudentFees || []).map(f => {
        const student = (data.students || []).find(s => s.id === f.studentId);
        const statusText = { inactive: '停课', withdrawn: '退费', graduated: '毕业' }[student?.status] || student?.status || '-';
        return `
            <tr>
                <td>${escapeHtml(f.studentName || student?.name || '-')}</td>
                <td>${escapeHtml(statusText)}</td>
                <td>${f.status === 'paid' ? '已缴' : '欠费'}</td>
                <td>¥${Number(f.amount || 0).toLocaleString()}</td>
                <td>${f.hours || 0}</td>
            </tr>
        `;
    }).join('');

    return `
        <details class="data-health-detail" ${report.orphanFees.length > 0 ? 'open' : ''}>
            <summary>已删除学员的收费记录（${report.orphanFees.length} 条）</summary>
            <div class="data-health-detail-note">这类记录已经找不到对应学员，会影响首页已收/欠费统计，建议通过"清理安全项"删除。</div>
            ${report.orphanFees.length > 0 ? `
                <div class="table-wrapper data-health-table-wrap">
                    <table><thead><tr><th>学员</th><th>状态</th><th>金额</th><th>课时</th><th>套餐</th></tr></thead><tbody>${orphanRows}</tbody></table>
                </div>
            ` : '<div class="data-health-empty">暂无</div>'}
        </details>
        <details class="data-health-detail">
            <summary>非在读学员收费记录参考（${report.inactiveStudentFees.length} 条）</summary>
            <div class="data-health-detail-note">停课/退费/毕业学员的收费记录通常属于历史财务记录，不自动清理；如果只是测试数据，可到收费记录里手动删除。</div>
            ${report.inactiveStudentFees.length > 0 ? `
                <div class="table-wrapper data-health-table-wrap">
                    <table><thead><tr><th>学员</th><th>学员状态</th><th>收费状态</th><th>金额</th><th>课时</th></tr></thead><tbody>${inactiveRows}</tbody></table>
                </div>
            ` : '<div class="data-health-empty">暂无</div>'}
        </details>
    `;
}

function openPendingFeeFromHealth(studentId, suggestedHours = 1, type = 'negative') {
    const student = (data.students || []).find(s => s.id === studentId);
    if (!student) {
        showToast('未找到学员');
        return;
    }
    openFeeModal(null, {
        studentId,
        status: 'pending',
        hours: suggestedHours,
        amount: 0,
        paymentDate: '',
        package: type === 'noFee' ? '待补录欠费' : `欠费补录${suggestedHours}课时`,
        remark: '由数据体检提示生成，请确认金额和课时后保存'
    });
}

async function cleanSafeHealthIssues() {
    let result;
    try {
        result = await cleanSafeHealthIssuesFromApi();
    } catch (error) {
        showToast('清理失败：' + error.message);
        return;
    }
    showToast(`已清理考勤 ${result.removedAttendance} 条，无效学员记录 ${result.removedRecordRefs} 个，收费 ${result.removedFees} 条`);
    openDataHealthCheck();
}

async function openBackupManager() {
    document.getElementById('modalTitle').textContent = '备份列表';
    document.getElementById('modalBody').innerHTML = '<div class="modal-loading-text">正在读取备份列表...</div>';
    document.getElementById('modal').classList.add('show');

    try {
        const backups = await loadServerBackups();
        document.getElementById('modalBody').innerHTML = `
            <div class="backup-manager-modal">
                <div class="backup-manager-toolbar">
                    <button class="btn btn-success btn-sm" onclick="createManualServerBackup()">立即创建备份</button>
                    <button class="btn btn-secondary btn-sm" onclick="openBackupManager()">刷新</button>
                </div>
                <div class="backup-manager-note">
                    恢复备份会覆盖当前系统数据。系统会在恢复前自动再创建一份"恢复前备份"，用于反悔回退。
                </div>
                ${backups.length === 0 ? '<div class="empty-state">暂无服务器备份</div>' : `
                    <div class="table-wrapper backup-table-wrap">
                        <table class="backup-table">
                            <thead><tr><th>时间</th><th>原因</th><th>JSON 文件</th><th>操作</th></tr></thead>
                            <tbody>
                                ${backups.map(b => `
                                    <tr>
                                        <td class="backup-time-cell">${new Date(b.createdAt).toLocaleString()}</td>
                                        <td>${escapeHtml(formatBackupReason(b.reason))}</td>
                                        <td class="backup-file-cell">${escapeHtml((b.jsonBackupPath || '').split('/').pop() || '-')}</td>
                                        <td><button class="btn btn-warning btn-xs" onclick="restoreBackupFromList(${b.id})">恢复</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
    } catch (error) {
        document.getElementById('modalBody').innerHTML = `
            <div class="backup-error-message">读取备份列表失败：${escapeHtml(error.message)}</div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        `;
    }
}

function formatBackupReason(reason) {
    const reasonMap = {
        api: '手动创建备份',
        manual_ui: '手动创建备份',
        manual_cli: '命令行手动备份',
        before_safe_health_cleanup: '数据体检清理前自动备份',
        before_clear_all_data: '一键清空所有数据前自动备份',
        before_reset_sample_data: '重置示例数据前自动备份',
        before_local_backup_import: '导入本地备份前自动备份',
        before_batch_delete_fees: '批量删除收费记录前自动备份',
        before_batch_delete_students: '批量处理学员前自动备份',
        before_batch_delete_prospects: '批量删除意向学员前自动备份',
        before_batch_delete_grades: '批量删除成绩记录前自动备份',
        before_batch_delete_communications: '批量删除沟通记录前自动备份',
        before_json_import: '导入 JSON 前自动备份',
        before_reset_empty: '清空数据前自动备份',
        before_health_cleanup: '数据清理前备份',
        after_health_cleanup: '数据清理后备份',
        verify_backup_api: '备份接口验证'
    };
    if (!reason) return '-';
    if (reasonMap[reason]) return reasonMap[reason];
    const beforeRestore = String(reason).match(/^before_restore_(\d+)$/);
    if (beforeRestore) return `恢复备份 ${beforeRestore[1]} 前自动备份`;
    const restoreBackup = String(reason).match(/^restore_backup_(\d+)$/);
    if (restoreBackup) return `恢复备份 ${restoreBackup[1]}`;
    return reason;
}

async function createManualServerBackup() {
    const backup = await createServerBackup('手动创建备份');
    if (!backup) {
        showToast('创建备份失败');
        return;
    }
    showToast('已创建服务器备份');
    openBackupManager();
}

async function restoreBackupFromList(id) {
    if (!confirm('确定恢复到这个备份吗？当前系统数据会被覆盖。恢复前会自动创建一份当前数据备份。')) return;
    if (!confirm('最后确认：恢复后所有设备都应刷新页面再继续操作。确定恢复？')) return;
    try {
        await restoreServerBackup(id);
        render();
        showToast('已恢复备份');
        openBackupManager();
    } catch (error) {
        showToast('恢复失败：' + error.message);
    }
}

// 一键导出所有Excel文件
function getDataExportSchoolHistory(student = {}) {
    if (typeof getSchoolHistory === 'function') return getSchoolHistory(student);
    const history = student.schoolHistory || {};
    const result = {
        primarySchool: String(history.primarySchool || '').trim(),
        middleSchool: String(history.middleSchool || '').trim(),
        highSchool: String(history.highSchool || '').trim()
    };
    const legacySchool = String(student.school || '').trim();
    if (legacySchool) {
        if (['五年级', '六年级'].includes(student.grade) && !result.primarySchool) result.primarySchool = legacySchool;
        if (['初一', '初二', '初三', '七年级', '八年级', '九年级'].includes(student.grade) && !result.middleSchool) result.middleSchool = legacySchool;
        if (['高一', '高二', '高三'].includes(student.grade) && !result.highSchool) result.highSchool = legacySchool;
    }
    return result;
}

function getDataExportProspectContactLogs(prospect = {}) {
    return (Array.isArray(prospect.contactLogs) ? prospect.contactLogs : [])
        .filter(log => log && typeof log === 'object')
        .map(log => ({ ...log }))
        .sort((a, b) => {
            const left = `${a.contactDate || ''} ${a.updatedAt || a.createdAt || ''}`;
            const right = `${b.contactDate || ''} ${b.updatedAt || b.createdAt || ''}`;
            return right.localeCompare(left);
        });
}

function getDataExportProspectContactStatusLabel(status = '') {
    const map = {
        pending: '待跟进',
        done: '已沟通',
        trialBooked: '已约试课',
        noReply: '未回复',
        closed: '已结束'
    };
    return map[status] || status || '待跟进';
}

function getDataExportProspectContactLogsText(prospect = {}) {
    return getDataExportProspectContactLogs(prospect)
        .map(log => [
            log.contactDate || '',
            log.contactType || '',
            getDataExportProspectContactStatusLabel(log.status),
            log.content || '',
            log.nextAction || ''
        ].filter(Boolean).join(' '))
        .join('\n');
}

function exportAllStudents() {
    const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业', forming: '组班中（旧）' };
    const headers = ['姓名', '性别', '年级', '所在班级', '授课老师', '入班时间', '首次入学', '首次上课年级', '联系电话', '紧急联系人', '小学学校', '初中学校', '高中学校', '状态', '备注'];
    const rows = (data.students || []).map(s => {
        const cls = (data.classes || []).find(c => c.id === s.classId);
        const history = getDataExportSchoolHistory(s);
        return [
            s.name || '',
            s.gender || '',
            s.grade || '',
            cls?.name || '未分班',
            s.teacher || '',
            s.enrollDate || '',
            s.firstEnrollDate || '',
            s.firstEnrollGrade || '',
            s.phone || '',
            s.emergencyContact || '',
            history.primarySchool || '',
            history.middleSchool || '',
            history.highSchool || '',
            statusMap[s.status] || s.status || '',
            s.remark || ''
        ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    formatExcelSheet(ws, [headers, ...rows], { maxWidth: 36 });
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
        formatExcelSheet(feeWs, [feeHeaders, ...feeRows]);
        const feeWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(feeWb, feeWs, '收费记录');
        XLSX.writeFile(feeWb, `收费记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出成绩记录
    if (data.grades && data.grades.length > 0) {
        const gradeHeaders = ['学员', '测试名称', '日期', '类型', '得分', '满分', '排名', '备注', '薄弱点'];
        const gradeRows = data.grades.map(g => [
            g.studentName,
            g.testName,
            g.testDate,
            g.examType === 'school' ? '校内' : '校外',
            g.score,
            g.fullScore,
            g.ranking != null && g.ranking !== '' ? `第${g.ranking}名` : '未知',
            g.remark || '',
            g.weakPoints || ''
        ]);
        const gradeWs = XLSX.utils.aoa_to_sheet([gradeHeaders, ...gradeRows]);
        formatExcelSheet(gradeWs, [gradeHeaders, ...gradeRows]);
        const gradeWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(gradeWb, gradeWs, '成绩记录');
        XLSX.writeFile(gradeWb, `成绩记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出班级学员
    if (data.classes && data.classes.length > 0) {
        data.classes.forEach(cls => {
            const students = data.students.filter(s => s.classId === cls.id);
            if (students.length > 0) {
                const statusMap = { active: '在读', renewalPending: '待续费', inactive: '停课', withdrawn: '退费', graduated: '毕业', forming: '组班中（旧）' };
                const stuHeaders = ['姓名', '性别', '年级', '授课老师', '入班时间', '首次入学', '首次上课年级', '联系电话', '小学学校', '初中学校', '高中学校', '状态', '备注'];
                const stuRows = students.map(s => {
                    const history = getDataExportSchoolHistory(s);
                    return [
                        s.name || '',
                        s.gender || '',
                        s.grade || '',
                        s.teacher || '',
                        s.enrollDate || '',
                        s.firstEnrollDate || '',
                        s.firstEnrollGrade || '',
                        s.phone || '',
                        history.primarySchool || '',
                        history.middleSchool || '',
                        history.highSchool || '',
                        statusMap[s.status] || s.status || '',
                        s.remark || ''
                    ];
                });
                const stuWs = XLSX.utils.aoa_to_sheet([stuHeaders, ...stuRows]);
                formatExcelSheet(stuWs, [stuHeaders, ...stuRows], { maxWidth: 34 });
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
        formatExcelSheet(commWs, [commHeaders, ...commRows], { maxWidth: 36 });
        const commWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(commWb, commWs, '沟通记录');
        XLSX.writeFile(commWb, `沟通记录_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    // 导出意向学员
    if (data.prospects && data.prospects.length > 0) {
        const proHeaders = ['姓名', '年级', '电话', '微信', '来源', '目前成绩', '试课日期', '试课状态', '成交状态', '接触/沟通条数', '最近接触/沟通', '接触/沟通记录', '备注', '录入日期'];
        const proRows = data.prospects.map(p => {
            const logs = getDataExportProspectContactLogs(p);
            const latest = logs[0] || {};
            const latestContact = logs.length
                ? [latest.contactDate || '', latest.contactType || '', getDataExportProspectContactStatusLabel(latest.status)].filter(Boolean).join(' · ')
                : '';
            return [
                p.name || '',
                p.grade || '',
                p.phone || '',
                p.wechat || '',
                p.source || '',
                p.intent || '',
                p.trialDate || '',
                { pending: '待跟进', contacted: '已联系', trial: '试课中', forming: '组班中', deal: '已成交', lost: '已流失' }[p.trialStatus] || '',
                p.dealStatus === 'deal' ? '已成交' : p.dealStatus === 'lost' ? '已流失' : '未成交',
                logs.length,
                latestContact,
                getDataExportProspectContactLogsText(p),
                p.remark || '',
                p.createDate || ''
            ];
        });
        const proWs = XLSX.utils.aoa_to_sheet([proHeaders, ...proRows]);
        formatExcelSheet(proWs, [proHeaders, ...proRows]);
        const proWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(proWb, proWs, '意向学员');
        XLSX.writeFile(proWb, `意向学员_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    showToast('已导出所有Excel文件');
}

// 确认清空所有数据
async function confirmClearAllData() {
    if (!confirm('确定清空所有数据？此操作不可恢复！\n\n请确认：\n1. 已导出所有重要数据\n2. 了解清空后无法找回\n\n点击确定继续。')) return;
    if (!confirm('最后一次确认：清空后所有学员、班级、收费、考勤、成绩、沟通记录都将被删除！')) return;
    await createServerBackup('一键清空所有数据前自动备份');

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
    await saveData();
    closeModal();
    showToast('已清空所有数据');
    render();
}

async function resetToSampleData() {
    if (!confirm('确定重置为示例数据？这将覆盖当前所有数据！')) return;
    await createServerBackup('重置示例数据前自动备份');
    data = getSampleData();
    dataModified = false; // 重置改动标记
    await saveData();
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
