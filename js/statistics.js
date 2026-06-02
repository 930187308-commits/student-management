// ==================== 统计报表 ====================

let currentReportClassId = '';

function buildLocalReportsSummary() {
    const monthlyConsumption = {};
    data.attendance.forEach(session => {
        const month = session.date.substring(0, 7);
        if (!monthlyConsumption[month]) monthlyConsumption[month] = { amount: 0, sessions: 0 };
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (status === 1) { // 出勤
                monthlyConsumption[month].sessions++;
                const fee = data.fees.find(f => f.studentId === studentId && f.status === 'paid');
                if (fee && fee.pricePerHour) {
                    monthlyConsumption[month].amount += fee.pricePerHour;
                }
            }
        });
    });

    const studentConsumptionSummary = data.students.filter(s => {
        if (s.status !== 'active') return false;
        return true;
    }).map(s => {
        const totalHours = data.fees.filter(f => f.studentId === s.id && f.status === 'paid').reduce((sum, f) => sum + f.hours, 0);
        let usedHours = 0, absentHours = 0;
        data.attendance.forEach(a => {
            if (a.classId !== s.classId) return;
            if (a.records && a.records[s.id] === 1) usedHours++;
            else if (a.records && a.records[s.id] === 0) absentHours++;
        });
        const remainingHours = totalHours - usedHours;
        return {
            id: s.id,
            name: s.name || '',
            grade: s.grade || '',
            classId: s.classId || '',
            totalHours,
            usedHours,
            absentHours,
            remainingHours,
            statusText: remainingHours <= 5 ? '需续费' : '正常'
        };
    });

    const currentQuarter = getCurrentQuarter();
    const thisYear = new Date().getFullYear();
    const quarterStartMonth = (currentQuarter - 1) * 3 + 1;

    const newStudents = data.students.filter(s => {
        if (!s.enrollDate) return false;
        const enroll = new Date(s.enrollDate);
        return enroll.getFullYear() === thisYear && (enroll.getMonth() + 1) >= quarterStartMonth && s.status === 'active';
    });

    const churnedStudents = data.students.filter(s => {
        if (s.status === 'withdrawn' || s.status === 'graduated') return true;
        return false;
    });

    const classAttendanceStats = data.classes.filter(c => c.status === 'active' || c.status === 'forming').map(c => {
        const classStudents = data.students.filter(s => s.classId === c.id && s.status === 'active');
        const classSessions = data.attendance.filter(a => a.classId === c.id);
        let totalPresent = 0, totalAbsent = 0;
        classSessions.forEach(sess => {
            classStudents.forEach(s => {
                const status = sess.records?.[s.id];
                if (status === 1) totalPresent++;
                else if (status === 0) totalAbsent++;
            });
        });
        const total = totalPresent + totalAbsent;
        const rate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
        return { id: c.id, name: c.name, rate, total };
    });

    const sourceDist = {};
    (data.prospects || []).forEach(p => {
        const src = p.source || '其他';
        sourceDist[src] = (sourceDist[src] || 0) + 1;
    });

    const schoolDist = {};
    data.students.filter(s => s.status === 'active').forEach(s => {
        const school = s.school?.trim() || '未填写';
        schoolDist[school] = (schoolDist[school] || 0) + 1;
    });

    return {
        monthlyConsumption: Object.keys(monthlyConsumption).sort().reverse().map(month => ({
            month,
            sessions: monthlyConsumption[month].sessions,
            amount: monthlyConsumption[month].amount
        })),
        studentConsumptionSummary,
        quarterlyStudentDynamics: {
            year: thisYear,
            quarter: currentQuarter,
            newStudents: newStudents.length,
            churnedStudents: churnedStudents.length
        },
        classAttendanceStats,
        sourceDistribution: Object.keys(sourceDist).map(label => ({ label, value: sourceDist[label] })),
        schoolDistribution: Object.keys(schoolDist).map(label => ({ label, value: schoolDist[label] })),
        reportClassOptions: data.classes
            .filter(c => c.status === 'active' || c.status === 'forming')
            .map(c => ({ id: c.id, name: c.name || '' }))
    };
}

function requestReportsSummaryRefresh() {
    if (reportsSummaryLoading || currentTab !== 'reports') return;
    reportsSummaryLoading = true;
    loadReportsSummaryFromApi()
        .then(summary => {
            reportsSummaryCache = summary;
            if (currentTab === 'reports') renderReports();
        })
        .catch(error => {
            console.log('读取后端统计报表失败，使用本地计算:', error);
        })
        .finally(() => {
            reportsSummaryLoading = false;
        });
}

function renderReports() {
    const container = document.getElementById('tab-reports');
    if (!reportsSummaryCache && currentTab === 'reports') {
        requestReportsSummaryRefresh();
    }
    const summary = reportsSummaryCache || buildLocalReportsSummary();
    const monthlyConsumption = summary.monthlyConsumption || [];
    const studentConsumptionSummary = (summary.studentConsumptionSummary || []).filter(s => {
        if (currentReportClassId && s.classId !== currentReportClassId) return false;
        return true;
    });
    const dynamics = summary.quarterlyStudentDynamics || { newStudents: 0, churnedStudents: 0 };
    const classAttendanceStats = summary.classAttendanceStats || [];
    const sourceLabels = (summary.sourceDistribution || []).map(row => row.label);
    const sourceData = (summary.sourceDistribution || []).map(row => row.value);
    const schoolLabels = (summary.schoolDistribution || []).map(row => row.label);
    const schoolData = (summary.schoolDistribution || []).map(row => row.value);
    const reportClassOptions = summary.reportClassOptions || [];

    let html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="card">
                <div class="card-header"><span class="card-title">月课消统计</span><button class="btn btn-secondary btn-sm" onclick="exportMonthlyRevenue()">导出</button></div>
                <div class="table-wrapper">
                    <table><thead><tr><th>月份</th><th>已消课时</th><th>估算课消金额</th></tr></thead><tbody>
                        ${monthlyConsumption.length > 0 ? monthlyConsumption.map(row => `<tr><td>${escapeHtml(row.month)}</td><td><strong style="color:#27ae60;">${row.sessions}</strong></td><td><strong style="color:#27ae60;">¥${Number(row.amount || 0).toLocaleString()}</strong></td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#888;padding:24px;">暂无课消数据</td></tr>'}
                    </tbody></table>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">当季学员动态</span></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: 700; color: #27ae60;">${dynamics.newStudents}</div>
                        <div style="font-size: 13px; color: #888;">当季新增</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 36px; font-weight: 700; color: #e74c3c;">${dynamics.churnedStudents}</div>
                        <div style="font-size: 13px; color: #888;">当季流失</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">班级出勤率对比</span></div>
                <div class="chart-container" style="height: 220px;"><canvas id="attendanceChart"></canvas></div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">意向学员来源分布</span></div>
                <div class="chart-container" style="height: 220px;"><canvas id="sourceChart"></canvas></div>
            </div>

            <div class="card">
                <div class="card-header"><span class="card-title">学员学校分布</span></div>
                <div class="chart-container" style="height: 220px;"><canvas id="schoolChart"></canvas></div>
            </div>

            <div class="card" style="grid-column: 1 / -1;">
                <div class="card-header">
                    <span class="card-title">课消明细（剩余课时）</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select id="reportClassFilter" onchange="switchReportClass(this.value)" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 12px;">
                            <option value="">全部班级</option>
                            ${reportClassOptions.map(c => `<option value="${escapeHtml(c.id)}" ${currentReportClassId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="exportConsumptionSummary()">导出</button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table><thead><tr><th>学员</th><th>年级</th><th>已缴课时</th><th>已消课时</th><th>请假次数</th><th>剩余课时</th><th>状态</th></tr></thead><tbody>
                        ${studentConsumptionSummary.length > 0 ? studentConsumptionSummary.map(s => {
                            const status = s.remainingHours <= 5 ? 'row-warning' : '';
                            const badge = s.remainingHours <= 5 ? 'badge-pending' : 'badge-active';
                            const text = s.statusText || (s.remainingHours <= 5 ? '需续费' : '正常');
                            return `<tr class="${status}"><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.grade)}</td><td>${s.totalHours}</td><td><strong style="color:#27ae60;">${s.usedHours}</strong></td><td><strong style="color:#f39c12;">${s.absentHours}</strong></td><td><strong>${s.remainingHours}</strong></td><td><span class="badge ${badge}">${text}</span></td></tr>`;
                        }).join('') : '<tr><td colspan="7" style="text-align:center;color:#888;padding:24px;">暂无课消数据</td></tr>'}
                    </tbody></table>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;

    // 绘制班级出勤率柱状图
    setTimeout(() => {
        const ctx = document.getElementById('attendanceChart');
        if (ctx && classAttendanceStats.length > 0) {
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: classAttendanceStats.map(c => c.name.length > 8 ? c.name.substring(0, 8) + '...' : c.name),
                    datasets: [{
                        label: '出勤率%',
                        data: classAttendanceStats.map(c => c.rate),
                        backgroundColor: classAttendanceStats.map(c => c.rate >= 80 ? '#27ae60' : c.rate >= 60 ? '#f39c12' : '#e74c3c'),
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            ticks: {
                                font: { size: 12 },
                                callback: function(val, index) {
                                    const label = classAttendanceStats[index].name;
                                    // 按"-"换行，保持可读性
                                    if (label.includes('-')) {
                                        const parts = label.split('-');
                                        return [parts[0], parts.slice(1).join('-')];
                                    }
                                    return label;
                                },
                                maxRotation: 0
                            }
                        },
                        y: { beginAtZero: true, max: 100 }
                    }
                }
            });
        }
    }, 50);

    // 绘制来源分布饼图
    setTimeout(() => {
        const ctx = document.getElementById('sourceChart');
        if (ctx && sourceLabels.length > 0) {
            const colors = ['#3498db', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: sourceLabels,
                    datasets: [{
                        data: sourceData,
                        backgroundColor: sourceLabels.map((_, i) => colors[i % colors.length]),
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
                }
            });
        } else if (ctx) {
            ctx.parentElement.innerHTML = '<div class="empty-state">暂无意向学员数据</div>';
        }
    }, 50);

    // 绘制学校分布饼图
    setTimeout(() => {
        const ctx = document.getElementById('schoolChart');
        if (ctx && schoolLabels.length > 0) {
            const colors = ['#3498db', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: schoolLabels.map(s => escapeHtml(s)),
                    datasets: [{
                        data: schoolData,
                        backgroundColor: schoolLabels.map((_, i) => colors[i % colors.length]),
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } }
                }
            });
        } else if (ctx) {
            ctx.parentElement.innerHTML = '<div class="empty-state">暂无学员学校数据</div>';
        }
    }, 50);
}

function getCurrentQuarter() {
    const month = new Date().getMonth() + 1;
    return Math.ceil(month / 3);
}

function switchReportClass(classId) {
    currentReportClassId = classId;
    renderReports();
}

function exportMonthlyRevenue() {
    const monthlyConsumption = {};
    data.attendance.forEach(session => {
        const month = session.date.substring(0, 7);
        if (!monthlyConsumption[month]) monthlyConsumption[month] = { amount: 0, sessions: 0 };
        Object.entries(session.records || {}).forEach(([studentId, status]) => {
            if (status === 1) {
                monthlyConsumption[month].sessions++;
                const fee = data.fees.find(f => f.studentId === studentId && f.status === 'paid');
                if (fee && fee.pricePerHour) {
                    monthlyConsumption[month].amount += fee.pricePerHour;
                }
            }
        });
    });
    const ws = XLSX.utils.aoa_to_sheet([['月份', '已消课时', '估算课消金额'], ...Object.keys(monthlyConsumption).sort().reverse().map(month => [month, monthlyConsumption[month].sessions, monthlyConsumption[month].amount])]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '课消统计');
    XLSX.writeFile(wb, '课消统计.xlsx');
    showToast('导出成功');
}

function exportClassStats() {
    const classStats = data.classes.filter(c => c.status === 'active').map(c => {
        const count = data.students.filter(s => s.classId === c.id && s.status === 'active').length;
        return [c.name, `${count}/${c.maxStudents}`, (count / c.maxStudents * 100).toFixed(0) + '%'];
    });
    const ws = XLSX.utils.aoa_to_sheet([['班级', '人数/满班', '满班率'], ...classStats]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班级统计');
    XLSX.writeFile(wb, '班级统计.xlsx');
    showToast('导出成功');
}

function exportConsumptionSummary() {
    const filterClassId = currentReportClassId;
    const studentConsumptionSummary = data.students.filter(s => {
        if (s.status !== 'active') return false;
        if (filterClassId && s.classId !== filterClassId) return false;
        return true;
    }).map(s => {
        const totalHours = data.fees.filter(f => f.studentId === s.id && f.status === 'paid').reduce((sum, f) => sum + f.hours, 0);
        let usedHours = 0;
        data.attendance.forEach(a => {
            if (a.classId !== s.classId) return;
            if (a.records && a.records[s.id] === 1) usedHours++;
        });
        return [s.name, s.grade, totalHours, usedHours, totalHours - usedHours, totalHours - usedHours <= 5 ? '需续费' : '正常'];
    });
    const ws = XLSX.utils.aoa_to_sheet([['学员', '年级', '已缴课时', '已消课时', '请假次数', '剩余课时', '状态'], ...studentConsumptionSummary]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '课消统计');
    XLSX.writeFile(wb, '课消统计.xlsx');
    if (studentConsumptionSummary.length === 0) { showToast('当前筛选条件下无数据可导出'); return; }
    showToast('导出成功');
}
