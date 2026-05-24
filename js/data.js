// ==================== 数据存储 ====================

// 全局数据对象
let data = {
    classes: [],
    students: [],
    fees: [],
    attendance: [], // { id, classId, date, records: { studentId: 1|0 } }
    grades: [],
    communications: [],
    communicationTopics: [
        { id: 't1', name: '续费沟通', color: '#27ae60' },
        { id: 't2', name: '学情反馈', color: '#3498db' },
        { id: 't3', name: '请假沟通', color: '#f39c12' },
        { id: 't4', name: '投诉处理', color: '#e74c3c' },
        { id: 't5', name: '其他', color: '#95a5a6' }
    ],
    prospects: [], // 意向学员: { id, name, phone, source, intent, trialDate, trialStatus, dealStatus, remark, createDate }
    prospectSources: ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'], // 意向来源渠道
    classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班'] // 班型可选项
};

// 全局状态
let currentTab = 'dashboard';
let currentEditId = null;
let currentStudentId = null;
let editingCell = null;
let autoSaveTimer = null;
let lastSaveTime = null;
let lastCloudSaveTime = null; // 记录上次云端保存时间，用于节流
let dataModified = false; // 追踪数据是否有改动

// 存储键名
const STORAGE_KEY = 'studentManagementSystem_v3';

// JSONBin.io 同步配置
const JSONBIN_COLLECTION_KEY = 'jsonbinCollectionId';
const JSONBIN_MASTER_KEY = 'jsonbinMasterKey';
const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3';

// ========== JSONBin API 操作 ==========

// 检查是否配置了 JSONBin
function isJsonBinConfigured() {
    return localStorage.getItem(JSONBIN_COLLECTION_KEY) && localStorage.getItem(JSONBIN_MASTER_KEY);
}

// 兼容旧的 Gist 配置（保留但默认不使用）
function isGistConfigured() {
    const token = localStorage.getItem('gistToken');
    const gistId = localStorage.getItem('gistId');
    return token && gistId;
}

// 从 JSONBin 加载数据
async function loadFromJsonBin() {
    const collectionId = localStorage.getItem(JSONBIN_COLLECTION_KEY);
    const masterKey = localStorage.getItem(JSONBIN_MASTER_KEY);

    try {
        const response = await fetch(`${JSONBIN_API_BASE}/c/${collectionId}/latest`, {
            headers: {
                'X-Master-Key': masterKey,
                'X-Bin-Versioning': 'false'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // 404 可能是 Collection 空的，返回 null 让调用方处理
                return null;
            }
            throw new Error(`JSONBin API 错误: ${response.status}`);
        }

        const result = await response.json();
        return result.record;
    } catch (error) {
        console.error('从 JSONBin 加载失败:', error);
        throw error;
    }
}

// 保存数据到 JSONBin
async function saveToJsonBin(data) {
    const collectionId = localStorage.getItem(JSONBIN_COLLECTION_KEY);
    const masterKey = localStorage.getItem(JSONBIN_MASTER_KEY);

    // 添加时间戳
    const dataWithTimestamp = {
        ...data,
        lastModified: new Date().toISOString()
    };

    try {
        const response = await fetch(`${JSONBIN_API_BASE}/c/${collectionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': masterKey,
                'X-Bin-Versioning': 'false'
            },
            body: JSON.stringify(dataWithTimestamp)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`保存失败: ${response.status} - ${errorText}`);
        }

        // 保存成功，更新本地备份
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        localStorage.removeItem('pendingSync');

        return true;
    } catch (error) {
        console.error('保存到 JSONBin 失败:', error);
        throw error;
    }
}

// 标记本地数据待同步
function markPendingSync() {
    localStorage.setItem('pendingSync', 'true');
}

// 尝试同步待同步的数据
async function trySyncPendingData() {
    if (!isJsonBinConfigured()) return false;
    if (!localStorage.getItem('pendingSync')) return false;

    try {
        await saveToJsonBin(data);
        showToast('已同步到云端');
        return true;
    } catch (error) {
        console.error('同步待同步数据失败:', error);
        return false;
    }
}

// 显示 JSONBin 设置弹窗
function showGistSetupModal() {
    showJsonBinSetupModal();
}

function showJsonBinSetupModal() {
    const collectionId = localStorage.getItem(JSONBIN_COLLECTION_KEY) || '';
    const masterKey = localStorage.getItem(JSONBIN_MASTER_KEY) || '';
    const isConfigured = collectionId && masterKey;

    const modal = document.getElementById('modal');
    modal.classList.add('show');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>云端同步设置</h3>
                <button class="modal-close" onclick="closeJsonBinSetupModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${isConfigured ? '<p style="color: #27ae60; font-size: 13px; margin-bottom: 15px;">✓ 已配置云端同步</p>' : '<p style="color: #666; font-size: 13px; margin-bottom: 15px;">设置 JSONBin.io 以实现多设备数据同步。国内直接访问，不需要 VPN。</p>'}
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Collection ID</label>
                    <input type="text" id="jsonbinCollectionInput" placeholder="例如: 6652a9b5ad1adafc279e1234"
                        value="${collectionId}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <p style="color: #999; font-size: 11px; margin-top: 5px;">
                        Collection ID 是创建 Collection 后获得，格式类似：6652a9b5ad1adafc279e1234
                    </p>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 500;">Master Key</label>
                    <input type="password" id="jsonbinMasterKeyInput" placeholder="例如: $2a$10$xxxxxx"
                        value="${masterKey}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <p style="color: #999; font-size: 11px; margin-top: 5px;">
                        Master Key 用于读写你的 Collection，在创建页面可以看到
                    </p>
                </div>
                <div style="margin-bottom: 15px;">
                    <button onclick="showJsonBinHelp()" style="background: #f5f5f5; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        📖 如何获取 Collection ID 和 Master Key？
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                ${isConfigured ? '<button onclick="clearJsonBinConfig()" style="padding: 8px 16px; margin-right: 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">解除同步</button>' : ''}
                <button onclick="closeJsonBinSetupModal()" style="padding: 8px 16px; margin-right: 10px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                <button onclick="saveJsonBinConfig()" style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
            </div>
        </div>
    `;
}

// 关闭设置弹窗
function closeJsonBinSetupModal() {
    document.getElementById('modal').classList.remove('show');
}

// 显示帮助信息
function showJsonBinHelp() {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>如何获取 JSONBin 配置</h3>
                <button class="modal-close" onclick="showJsonBinSetupModal()">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                <h4>第一步：注册 JSONBin.io</h4>
                <ol style="color: #666; font-size: 13px; line-height: 1.8;">
                    <li>访问 <a href="https://jsonbin.io" target="_blank">jsonbin.io</a> 并登录（可以用 Google 账号）</li>
                    <li>登录后进入控制台</li>
                </ol>

                <h4 style="margin-top: 20px;">第二步：创建 Collection</h4>
                <ol style="color: #666; font-size: 13px; line-height: 1.8;">
                    <li>点击 "Create a Collection" 或 "New Collection"</li>
                    <li>Name 填写：<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">student-management</code></li>
                    <li>Visibility 选择：<b>Private</b>（私有）</li>
                    <li>点击创建</li>
                    <li>创建完成后，你会看到：<br>
                        <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">Collection ID: <b style="color: #e74c3c;">6652a9b5ad1adafc279e1234</b></code><br>
                        <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">Master Key: <b style="color: #e74c3c;">$2a$10$xxxxxxxx</b></code>
                    </li>
                    <li><b style="color: #e74c3c;">复制这两个值</b>，Master Key 只显示一次！</li>
                </ol>

                <h4 style="margin-top: 20px;">第三步：回到这里填写</h4>
                <p style="color: #666; font-size: 13px;">
                    填入 Collection ID 和 Master Key 后点击"保存"即可。
                </p>
            </div>
            <div class="modal-footer">
                <button onclick="showJsonBinSetupModal()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">返回设置</button>
            </div>
        </div>
    `;
}

// 保存 JSONBin 配置
function saveJsonBinConfig() {
    const collectionId = document.getElementById('jsonbinCollectionInput').value.trim();
    const masterKey = document.getElementById('jsonbinMasterKeyInput').value.trim();

    if (!collectionId) {
        alert('请输入 Collection ID');
        return;
    }
    if (!masterKey) {
        alert('请输入 Master Key');
        return;
    }

    localStorage.setItem(JSONBIN_COLLECTION_KEY, collectionId);
    localStorage.setItem(JSONBIN_MASTER_KEY, masterKey);

    // 清除旧的 Gist 配置（如果有）
    localStorage.removeItem('gistToken');
    localStorage.removeItem('gistId');

    closeJsonBinSetupModal();
    showToast('云端配置已保存');

    // 重新加载数据
    init();
}

// 清除 JSONBin 配置
function clearJsonBinConfig() {
    if (!confirm('确定要解除云端同步吗？解除后数据将只保存在本地。')) return;

    localStorage.removeItem(JSONBIN_COLLECTION_KEY);
    localStorage.removeItem(JSONBIN_MASTER_KEY);
    localStorage.removeItem('pendingSync');

    closeJsonBinSetupModal();
    showToast('已解除云端同步');
    updateJsonBinSyncButton();
    updateAutoSaveIndicator();
}

// 兼容旧的 Gist 弹窗
function showGistSetupModal() {
    showJsonBinSetupModal();
}

function closeGistSetupModal() {
    closeJsonBinSetupModal();
}

function saveGistConfig() {
    saveJsonBinConfig();
}

function clearGistConfig() {
    clearJsonBinConfig();
}

function showGistHelp() {
    showJsonBinHelp();
}

// ========== 初始化 ==========

// 初始化
async function init() {
    await loadData();

    // 只有在数据完全为空（没有任何班级）时才加载示例数据
    // 不要仅因为 classes.length === 0 就加载示例数据，可能是有其他原因
    const hasAnyData = data.classes?.length > 0 ||
                       data.students?.length > 0 ||
                       data.fees?.length > 0 ||
                       data.attendance?.length > 0 ||
                       data.grades?.length > 0;

    if (!hasAnyData) {
        data = getSampleData();
        await saveData();
    }

    initDarkMode();
    initTabs();
    render();
    startAutoSave();
}

// 加载数据（支持 JSONBin 同步）
async function loadData() {
    // 如果配置了 JSONBin，优先从 JSONBin 加载
    if (isJsonBinConfigured()) {
        try {
            showToast('正在从云端加载...', 5000);
            const cloudData = await loadFromJsonBin();
            if (cloudData) {
                const localData = localStorage.getItem(STORAGE_KEY);
                const localPending = localStorage.getItem('pendingSync');

                // 如果本地有待同步数据
                if (localPending && localData) {
                    const localObj = JSON.parse(localData);
                    const cloudTime = new Date(cloudData.lastModified || 0).getTime();
                    const localTime = new Date(localObj.lastModified || 0).getTime();

                    // 比较所有数据的最后修改时间
                    const cloudMaxTime = Math.max(cloudTime,
                        ...(cloudData.grades?.map(g => new Date(g.testDate).getTime()) || [0]),
                        ...(cloudData.communications?.map(c => new Date(c.contactDate).getTime()) || [0]));
                    const localMaxTime = Math.max(localTime,
                        ...(localObj.grades?.map(g => new Date(g.testDate).getTime()) || [0]),
                        ...(localObj.communications?.map(c => new Date(c.contactDate).getTime()) || [0]));

                    // 如果本地数据更新（检查关键数据的时间戳）
                    if (localMaxTime > cloudMaxTime + 5000) { // 5秒容差
                        data = localObj;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        showToast('使用本地最新数据');

                        // 尝试同步到云端
                        if (!lastCloudSaveTime || (Date.now() - lastCloudSaveTime) >= SAVE_COOLDOWN_MS) {
                            try {
                                await saveToJsonBin(data);
                                lastCloudSaveTime = Date.now();
                                localStorage.removeItem('pendingSync');
                                showToast('本地数据已同步到云端');
                            } catch (e) {
                                // 保持 pendingSync 标记，下次再试
                            }
                        }
                    } else {
                        // 云端数据更新，使用云端数据
                        data = cloudData;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        localStorage.removeItem('pendingSync');
                        showToast('已加载云端最新数据');
                    }
                } else if (localData) {
                    // 本地有数据但没有待同步标记，比较时间
                    const localObj = JSON.parse(localData);
                    const cloudTime = new Date(cloudData.lastModified || 0).getTime();
                    const localTime = new Date(localObj.lastModified || 0).getTime();

                    if (localTime > cloudTime + 5000) {
                        // 本地数据更新，但之前同步失败了
                        data = localObj;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        showToast('使用本地最新数据');

                        // 尝试同步
                        if (!lastCloudSaveTime || (Date.now() - lastCloudSaveTime) >= SAVE_COOLDOWN_MS) {
                            try {
                                await saveToJsonBin(data);
                                lastCloudSaveTime = Date.now();
                            } catch (e) {
                                localStorage.setItem('pendingSync', 'true');
                            }
                        }
                    } else {
                        // 使用云端数据
                        data = cloudData;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        showToast('已加载云端数据');
                    }
                } else {
                    // 没有本地数据，直接使用云端
                    data = cloudData;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    showToast('已加载云端数据');
                }
            } else {
                // 云端是空的，加载本地数据并尝试创建
                loadDataFromLocal();
                showToast('云端暂无数据，将使用本地数据', 3000);
            }
        } catch (error) {
            console.error('从 JSONBin 加载失败，尝试本地数据:', error);
            loadDataFromLocal();
            showToast('云端加载失败，使用本地数据', 3000);
        }
    } else if (isGistConfigured()) {
        // 兼容旧的 Gist 配置
        try {
            showToast('正在从云端加载...', 5000);
            const gistData = await loadFromGist();
            if (gistData) {
                data = gistData;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                showToast('已加载云端数据');
            } else {
                loadDataFromLocal();
                showToast('云端暂无数据', 3000);
            }
        } catch (error) {
            console.error('从 Gist 加载失败，尝试本地数据:', error);
            loadDataFromLocal();
            showToast('云端加载失败，使用本地数据', 3000);
        }
    } else {
        // 未配置云端，使用本地数据
        loadDataFromLocal();
    }

    // 兼容旧数据格式
    if (data.attendances && !data.attendance) {
        data.attendance = data.attendances;
        delete data.attendances;
    }
    // 确保 communicationTopics 存在
    if (!data.communicationTopics) {
        data.communicationTopics = [
            { id: 't1', name: '续费沟通', color: '#27ae60' },
            { id: 't2', name: '学情反馈', color: '#3498db' },
            { id: 't3', name: '请假沟通', color: '#f39c12' },
            { id: 't4', name: '投诉处理', color: '#e74c3c' },
            { id: 't5', name: '其他', color: '#95a5a6' }
        ];
    }
    // 确保 prospectSources 存在
    if (!data.prospectSources) {
        data.prospectSources = ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'];
    }
    // 确保 classTypes 存在
    if (!data.classTypes) {
        data.classTypes = ['基础', '拔高', '奥数', '中考', '自主招生', '短期班'];
    }
    // 兼容旧版 grades 数据（添加 examType 字段）
    if (data.grades) {
        data.grades.forEach(g => { if (!g.examType) g.examType = 'external'; });
    }

    // 如果是首次使用（没有数据），初始化为空结构
    if (!data.classes) data.classes = [];
    if (!data.students) data.students = [];
    if (!data.fees) data.fees = [];
    if (!data.attendance) data.attendance = [];
    if (!data.grades) data.grades = [];
    if (!data.communications) data.communications = [];
    if (!data.prospects) data.prospects = [];
}

// 从本地存储加载数据
function loadDataFromLocal() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
    }
}

// 保存数据（支持 JSONBin 同步）
async function saveData() {
    // 添加时间戳
    data.lastModified = new Date().toISOString();

    // 总是先保存到本地（不管是否在冷却期）
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSaveTime = new Date();

    // 节流：检查是否在保存冷却期内
    if (lastCloudSaveTime && (Date.now() - lastCloudSaveTime) < SAVE_COOLDOWN_MS) {
        // 在冷却期内，只保存本地，不调用云端 API
        updateAutoSaveIndicator();
        return;
    }

    if (isJsonBinConfigured()) {
        try {
            await saveToJsonBin(data);
            lastCloudSaveTime = Date.now(); // 更新最后保存时间
            updateAutoSaveIndicator();
            dataModified = false;
            localStorage.removeItem('pendingSync');
        } catch (error) {
            console.error('保存到 JSONBin 失败，保存到本地:', error);
            // 保存失败，标记待同步
            localStorage.setItem('pendingSync', 'true');
            updateAutoSaveIndicator();
            showToast('网络不稳定，数据已保存在本地', 3000);
            dataModified = true;
        }
    } else if (isGistConfigured()) {
        // 兼容旧的 Gist 配置
        try {
            await saveToGist(data);
            lastCloudSaveTime = Date.now();
            updateAutoSaveIndicator();
            dataModified = false;
            localStorage.removeItem('pendingSync');
        } catch (error) {
            console.error('保存到 Gist 失败，保存到本地:', error);
            localStorage.setItem('pendingSync', 'true');
            updateAutoSaveIndicator();
            showToast('网络不稳定，数据已保存在本地', 3000);
            dataModified = true;
        }
    } else {
        updateAutoSaveIndicator();
        dataModified = true;
    }
}

// 自动保存（节流版）
function startAutoSave() {
    // 每60秒自动保存（节流，避免 API 频率限制）
    autoSaveTimer = setInterval(() => {
        saveData(); // fire and forget
    }, 60000);

    // 页面离开前保存
    window.addEventListener('beforeunload', (e) => {
        if (dataModified) {
            // 同步保存（阻塞确保完成）
            navigator.sendBeacon?.('data:;base64,');
            e.preventDefault();
            e.returnValue = '您有未导出的改动，关闭前建议导出备份。';
            return e.returnValue;
        }
    });

    // 页面可见性变化时不再保存，避免频繁触发 API
}

function updateAutoSaveIndicator() {
    const indicator = document.getElementById('autosaveIndicator');
    if (indicator) {
        const pending = localStorage.getItem('pendingSync');
        if (pending) {
            indicator.className = 'autosave-indicator pending';
            indicator.innerHTML = '⚠️ 待同步';
        } else {
            indicator.className = 'autosave-indicator saved';
            indicator.innerHTML = '● 已保存 ' + (lastSaveTime ? lastSaveTime.toLocaleTimeString() : '');
        }
    }
    // 更新同步按钮状态
    updateJsonBinSyncButton();
}

function updateJsonBinSyncButton() {
    const btn = document.getElementById('gistSyncBtn');
    if (!btn) return;

    const pending = localStorage.getItem('pendingSync');
    if (pending) {
        btn.className = 'btn btn-warning btn-sm';
        btn.innerHTML = '☁️ 待同步';
    } else if (isJsonBinConfigured() || isGistConfigured()) {
        btn.className = 'btn btn-success btn-sm';
        btn.innerHTML = '☁️ 已同步';
    } else {
        btn.className = 'btn btn-info btn-sm';
        btn.innerHTML = '☁️ 同步';
    }
}

// 备份导出
function exportBackup() {
    const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: data
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `学员管理系统备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dataModified = false; // 导出后重置改动标记
    showToast('备份已导出');
}

// 备份导入
function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (backup.data) {
                if (confirm('导入将覆盖当前所有数据，确定继续？')) {
                    data = backup.data;
                    dataModified = false; // 导入后重置改动标记
                    saveData();
                    render();
                    showToast('导入成功');
                }
            } else {
                showToast('文件格式不正确');
            }
        } catch (err) {
            showToast('导入失败：' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// 示例数据
function getSampleData() {
    return {
        classes: [
            { id: 'c1', name: '初一基础-周四18:00', grade: '初一', classType: '基础', schedule: '周四 18:00-20:00', semester: '2025秋季', maxStudents: 10, status: 'active', summerSchedule: '周一至周五上午' },
            { id: 'c2', name: '初一拔高-周六09:00', grade: '初一', classType: '拔高', schedule: '周六 09:00-11:00', semester: '2025秋季', maxStudents: 10, status: 'active', summerSchedule: '周一至周五下午' },
            { id: 'c3', name: '六年级基础-周三18:00', grade: '六年级', classType: '基础', schedule: '周三 18:00-20:00', semester: '2025秋季', maxStudents: 10, status: 'active', summerSchedule: '周一至周五上午' },
            { id: 'c4', name: '六年级奥数-周五18:00', grade: '六年级', classType: '奥数', schedule: '周五 18:00-20:00', semester: '2025秋季', maxStudents: 8, status: 'active', summerSchedule: '周一至周五下午' },
            { id: 'c5', name: '六年级拔高-周六14:00', grade: '六年级', classType: '拔高', schedule: '周六 14:00-16:00', semester: '2025秋季', maxStudents: 10, status: 'forming', summerSchedule: '周一至周五上午' },
            { id: 'c6', name: '中考冲刺-周日10:00', grade: '初三', classType: '中考', schedule: '周日 10:00-12:00', semester: '2025秋季', maxStudents: 12, status: 'active', summerSchedule: '' }
        ],
        students: [
            { id: 's1', name: '张三', gender: '男', grade: '六年级', classId: 'c4', teacher: '白老师', enrollDate: '2025-03-15', phone: '13800138001', emergencyContact: '13900139001', status: 'active', remark: '数学基础扎实，思维活跃。', school: '市一小' },
            { id: 's2', name: '李四', gender: '女', grade: '初一', classId: 'c1', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138002', emergencyContact: '13900139002', status: 'active', remark: '需要加强计算准确性。', school: '外国语中学' },
            { id: 's3', name: '王五', gender: '男', grade: '六年级', classId: 'c5', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138003', emergencyContact: '13900139003', status: 'active', remark: '课堂参与度高。', school: '市一小' },
            { id: 's4', name: '赵六', gender: '女', grade: '初一', classId: 'c2', teacher: '白老师', enrollDate: '2025-03-01', phone: '13800138004', emergencyContact: '13900139004', status: 'renewalPending', remark: '接受能力强，进步明显。', school: '外国语中学' },
            { id: 's5', name: '钱七', gender: '男', grade: '六年级', classId: 'c3', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138005', emergencyContact: '13900139005', status: 'active', remark: '基础较薄弱，需多关注。', school: '区实验小学' },
            { id: 's6', name: '孙八', gender: '女', grade: '六年级', classId: 'c4', teacher: '白老师', enrollDate: '2025-03-15', phone: '13800138006', emergencyContact: '13900139006', status: 'active', remark: '认真细心。', school: '市一小' },
            { id: 's7', name: '周九', gender: '男', grade: '初一', classId: 'c1', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138007', emergencyContact: '13900139007', status: 'inactive', remark: '因生病暂停课。', school: '外国语中学' },
            { id: 's8', name: '吴十', gender: '女', grade: '六年级', classId: 'c3', teacher: '白老师', enrollDate: '2025-03-01', phone: '13800138008', emergencyContact: '13900139008', status: 'active', remark: '作文写得好，数学需加强。', school: '区实验小学' },
            { id: 's9', name: '郑十一', gender: '男', grade: '初三', classId: 'c6', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138009', emergencyContact: '13900139009', status: 'renewalPending', remark: '中考目标重点高中。', school: '市中学' },
            { id: 's10', name: '陈十二', gender: '女', grade: '初一', classId: 'c2', teacher: '白老师', enrollDate: '2025-09-01', phone: '13800138010', emergencyContact: '13900139010', status: 'withdrawn', remark: '因搬迁已退费。', school: '外国语中学' }
        ],
        fees: [
            { id: 'f1', studentId: 's1', studentName: '张三', amount: 8000, pricePerHour: 200, hours: 40, paymentDate: '2025-09-01', package: '秋季班40课时', paymentMethod: '微信转账', status: 'paid', remark: '' },
            { id: 'f2', studentId: 's2', studentName: '李四', amount: 6000, pricePerHour: 200, hours: 30, paymentDate: '2025-09-01', package: '秋季班30课时', paymentMethod: '支付宝', status: 'paid', remark: '' },
            { id: 'f3', studentId: 's3', studentName: '王五', amount: 8000, pricePerHour: 200, hours: 40, paymentDate: '2025-09-01', package: '秋季班40课时', paymentMethod: '微信转账', status: 'paid', remark: '' },
            { id: 'f4', studentId: 's4', studentName: '赵六', amount: 6000, pricePerHour: 200, hours: 30, paymentDate: '2025-03-01', package: '春季班30课时', paymentMethod: '银行转账', status: 'paid', remark: '' },
            { id: 'f5', studentId: 's5', studentName: '钱七', amount: 6000, pricePerHour: 200, hours: 30, paymentDate: '2025-09-01', package: '秋季班30课时', paymentMethod: '支付宝', status: 'pending', remark: '欠费2000' },
            { id: 'f6', studentId: 's6', studentName: '孙八', amount: 8000, pricePerHour: 200, hours: 40, paymentDate: '2025-09-01', package: '秋季班40课时', paymentMethod: '微信转账', status: 'paid', remark: '' },
            { id: 'f7', studentId: 's8', studentName: '吴十', amount: 6000, pricePerHour: 200, hours: 30, paymentDate: '2025-09-01', package: '秋季班30课时', paymentMethod: '支付宝', status: 'pending', remark: '欠费1000' },
            { id: 'f8', studentId: 's9', studentName: '郑十一', amount: 12000, pricePerHour: 250, hours: 48, paymentDate: '2025-09-01', package: '秋季班48课时', paymentMethod: '银行转账', status: 'paid', remark: '' }
        ],
        attendance: [
            // 六年级奥数班 - 6次课
            { id: 'a1', classId: 'c4', date: '2025-09-05', sessionName: '秋季第1课-分数运算', records: { s1: 1, s6: 1 } },
            { id: 'a2', classId: 'c4', date: '2025-09-12', sessionName: '秋季第2课-工程问题', records: { s1: 1, s6: 0 } },
            { id: 'a3', classId: 'c4', date: '2025-09-19', sessionName: '秋季第3课-浓度问题', records: { s1: 1, s6: 1 } },
            { id: 'a4', classId: 'c4', date: '2025-09-26', sessionName: '秋季第4课-行程问题', records: { s1: 0, s6: 1 } },
            { id: 'a5', classId: 'c4', date: '2025-10-03', sessionName: '秋季第5课-几何基础', records: { s1: 1, s6: 1 } },
            { id: 'a6', classId: 'c4', date: '2025-10-10', sessionName: '秋季第6课-几何面积', records: { s1: 1, s6: 1 } },
            // 初一基础班 - 4次课
            { id: 'a7', classId: 'c1', date: '2025-09-04', sessionName: '秋季第1课-有理数运算', records: { s2: 1 } },
            { id: 'a8', classId: 'c1', date: '2025-09-11', sessionName: '秋季第2课-整式加减', records: { s2: 1 } },
            { id: 'a9', classId: 'c1', date: '2025-09-18', sessionName: '秋季第3课-一元一次方程', records: { s2: 0 } },
            { id: 'a10', classId: 'c1', date: '2025-09-25', sessionName: '秋季第4课-方程应用', records: { s2: 1 } },
            // 六年级基础班 - 3次课
            { id: 'a11', classId: 'c3', date: '2025-09-03', sessionName: '秋季第1课-比和比例', records: { s5: 1, s8: 1 } },
            { id: 'a12', classId: 'c3', date: '2025-09-10', sessionName: '秋季第2课-百分数', records: { s5: 1, s8: 0 } },
            { id: 'a13', classId: 'c3', date: '2025-09-17', sessionName: '秋季第3课-经济问题', records: { s5: 1, s8: 1 } }
        ],
        grades: [
            { id: 'g1', studentId: 's1', studentName: '张三', classId: 'c4', testName: '数学期中测试', testDate: '2025-10-15', score: 88, fullScore: 100, ranking: 3, examType: 'school', weakPoints: '几何证明题', remark: '' },
            { id: 'g2', studentId: 's1', studentName: '张三', classId: 'c4', testName: '数学期末测试', testDate: '2025-12-15', score: 92, fullScore: 100, ranking: 2, examType: 'school', weakPoints: '辅助线构造', remark: '' },
            { id: 'g3', studentId: 's1', studentName: '张三', classId: 'c4', testName: '奥数杯赛模拟', testDate: '2025-11-20', score: 78, fullScore: 100, ranking: 5, examType: 'external', weakPoints: '数论', remark: '获得二等奖' },
            { id: 'g4', studentId: 's2', studentName: '李四', classId: 'c1', testName: '数学期中测试', testDate: '2025-10-20', score: 75, fullScore: 100, ranking: 8, examType: 'school', weakPoints: '计算准确性', remark: '需加强练习' },
            { id: 'g5', studentId: 's2', studentName: '李四', classId: 'c1', testName: '秋季第一次测', testDate: '2025-11-10', score: 82, fullScore: 100, ranking: 5, examType: 'external', weakPoints: '', remark: '进步明显' },
            { id: 'g6', studentId: 's3', studentName: '王五', classId: 'c5', testName: '数学期中测试', testDate: '2025-10-15', score: 85, fullScore: 100, ranking: 5, examType: 'school', weakPoints: '行程问题', remark: '' },
            { id: 'g7', studentId: 's4', studentName: '赵六', classId: 'c2', testName: '数学期中测试', testDate: '2025-10-18', score: 90, fullScore: 100, ranking: 3, examType: 'school', weakPoints: '', remark: '表现优秀' },
            { id: 'g8', studentId: 's5', studentName: '钱七', classId: 'c3', testName: '数学期中测试', testDate: '2025-10-15', score: 68, fullScore: 100, ranking: 12, examType: 'school', weakPoints: '分数运算、应用题', remark: '需重点关注' },
            { id: 'g9', studentId: 's9', studentName: '郑十一', classId: 'c6', testName: '中考一模', testDate: '2025-11-01', score: 118, fullScore: 120, ranking: 15, examType: 'school', weakPoints: '函数综合', remark: '' }
        ],
        communications: [
            { id: 'cm1', studentId: 's4', studentName: '赵六', topicId: 't1', contactDate: '2025-10-20', contactType: '电话', contactPerson: '赵六妈妈', teacher: '白老师', status: 'done', content: '沟通续费问题，家长表示12月再续。', followUp: '12月初联系' },
            { id: 'cm2', studentId: 's5', studentName: '钱七', topicId: 't2', contactDate: '2025-10-18', contactType: '微信', contactPerson: '钱七爸爸', teacher: '白老师', status: 'done', content: '学情反馈：分数运算错误率较高，需加强练习。', followUp: '下次课前布置分数练习题' },
            { id: 'cm3', studentId: 's9', studentName: '郑十一', topicId: 't2', contactDate: '2025-10-25', contactType: '电话', contactPerson: '郑十一妈妈', teacher: '白老师', status: 'pending', content: '期中考试分析，中考一模成绩需加强函数部分。', followUp: '制定函数专项训练计划' },
            { id: 'cm4', studentId: 's1', studentName: '张三', topicId: 't1', contactDate: '2025-10-28', contactType: '微信', contactPerson: '张三爸爸', teacher: '白老师', status: 'done', content: '已确认续报寒假班。', followUp: '' },
            { id: 'cm5', studentId: 's2', studentName: '李四', topicId: 't3', contactDate: '2025-10-22', contactType: '微信', contactPerson: '李四妈妈', teacher: '白老师', status: 'done', content: '下周四请假一次。', followUp: '补课安排在周五' }
        ],
        communicationTopics: [
            { id: 't1', name: '续费沟通', color: '#27ae60' },
            { id: 't2', name: '学情反馈', color: '#3498db' },
            { id: 't3', name: '请假沟通', color: '#f39c12' },
            { id: 't4', name: '投诉处理', color: '#e74c3c' },
            { id: 't5', name: '其他', color: '#95a5a6' }
        ],
        prospects: [
            { id: 'p1', name: '刘十三', phone: '13900139013', source: '家长推荐', intent: '提升成绩', trialDate: '2025-11-05', trialStatus: 'trial', dealStatus: '', remark: '同班同学家长推荐', createDate: '2025-10-28' },
            { id: 'p2', name: '黄十四', phone: '13900139014', source: '抖音', intent: '小升初', trialDate: '2025-11-08', trialStatus: 'contacted', dealStatus: '', remark: '抖音看到广告', createDate: '2025-10-30' },
            { id: 'p3', name: '杨十五', phone: '13900139015', source: '小红书', intent: '竞赛培训', trialDate: '2025-11-10', trialStatus: 'pending', dealStatus: '', remark: '想参加数学竞赛', createDate: '2025-11-01' },
            { id: 'p4', name: '林十六', phone: '13900139016', source: '朋友圈', intent: '补习数学', trialDate: '', trialStatus: 'pending', dealStatus: '', remark: '朋友家孩子在我们这上课', createDate: '2025-11-02' },
            { id: 'p5', name: '徐十七', phone: '13900139017', source: '地推', intent: '中考备考', trialDate: '2025-11-15', trialStatus: 'deal', dealStatus: 'deal', remark: '已缴费，11月开始上课', createDate: '2025-10-20' },
            { id: 'p6', name: '马十八', phone: '13900139018', source: '百度', intent: '提升成绩', trialDate: '', trialStatus: 'lost', dealStatus: 'lost', remark: '考虑其他机构', createDate: '2025-10-15' }
        ],
        prospectSources: ['家长推荐', '朋友圈', '抖音', '小红书', '百度', '地推', '其他'],
        classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班']
    };
}

// 初始化标签页
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            document.getElementById('tab-' + currentTab).classList.add('active');
            render();
        });
    });
}

// 渲染
function render() {
    renderStats();
    renderDashboard();
    renderClasses();
    renderStudents();
    renderFees();
    renderAttendance();
    renderGrades();
    renderCommunications();
    renderProspects();
    renderReports();
}

// 渲染统计卡片
function renderStats() {
    const activeStudents = data.students.filter(s => s.status === 'active').length;
    const totalClasses = data.classes.filter(c => c.status === 'active').length;
    const totalRevenue = data.fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
    const pendingAmount = data.fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);

    // 计算课消统计
    let totalHours = 0, usedHours = 0, absentHours = 0;
    data.students.filter(s => s.status === 'active').forEach(s => {
        const studentFees = data.fees.filter(f => f.studentId === s.id && f.status === 'paid');
        const studentTotalHours = studentFees.reduce((sum, f) => sum + f.hours, 0);
        totalHours += studentTotalHours;
        data.attendance.forEach(a => {
            if (a.records && a.records[s.id] === 1) usedHours++;
            else if (a.records && a.records[s.id] === 0) absentHours++;
        });
    });
    const remainingHours = totalHours - usedHours;
    const usageRate = totalHours > 0 ? Math.round((usedHours / totalHours) * 100) : 0;

    document.getElementById('statGrid').innerHTML = `
        <div class="stat-card" style="display: flex; align-items: center; gap: 40px; padding: 10px 14px; grid-column: span 2;">
            <div style="position: relative; width: 70px; height: 70px; flex-shrink: 0;">
                <canvas id="hoursRingChart" width="140" height="140" style="width: 70px; height: 70px;"></canvas>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: #2c3e50;">${remainingHours}</div>
                    <div style="font-size: 9px; color: #888;">剩余</div>
                </div>
            </div>
            <div style="flex: 1; display: flex; align-items: center; gap: 40px;">
                <div><span style="color: #888; font-size: 11px; display: block;">总课时</span><strong style="font-size: 22px;">${totalHours}</strong></div>
                <div><span style="color: #888; font-size: 11px; display: block;">已消</span><strong style="font-size: 22px; color: #27ae60;">${usedHours}</strong></div>
                <div><span style="color: #888; font-size: 11px; display: block;">请假</span><strong style="font-size: 22px; color: #f39c12;">${absentHours}</strong></div>
                <div><span style="color: #888; font-size: 11px; display: block;">消耗率</span><strong style="font-size: 22px;">${usageRate}%</strong></div>
            </div>
        </div>
        <div class="stat-card" style="padding: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;"><div class="value" style="font-size: 26px;">${activeStudents}</div><div class="label" style="font-size: 12px;">在读学员</div></div>
        <div class="stat-card" style="padding: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;"><div class="value" style="font-size: 26px;">${totalClasses}</div><div class="label" style="font-size: 12px;">班级数量</div></div>
        <div class="stat-card" style="padding: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;"><div class="value" style="font-size: 26px;">¥${totalRevenue.toLocaleString()}</div><div class="label" style="font-size: 12px;">已收学费</div></div>
        <div class="stat-card" style="padding: 8px; text-align: center; display: flex; flex-direction: column; justify-content: center;"><div class="value" style="font-size: 26px;">¥${pendingAmount.toLocaleString()}</div><div class="label" style="font-size: 12px;">欠费金额</div></div>
    `;

    // 绘制环形图
    setTimeout(() => drawHoursRingChart(usedHours, remainingHours), 10);
}

function drawHoursRingChart(used, remaining) {
    const canvas = document.getElementById('hoursRingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // 使用双倍分辨率画布解决模糊问题
    const centerX = 70, centerY = 70, radius = 58, thickness = 16;

    ctx.clearRect(0, 0, 140, 140);

    // 底色环
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 已消课时弧度
    const total = used + remaining;
    if (total > 0) {
        const usedAngle = (used / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + usedAngle);
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 剩余弧度
        if (remaining > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -Math.PI / 2 + usedAngle, Math.PI * 1.5);
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }
}

// 生成ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Toast提示
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// 夜间模式切换
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
    document.querySelector('.theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

// 初始化夜间模式
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.querySelector('.theme-toggle').textContent = '☀️';
    }
}

// 通用
function closeModal() {
    document.getElementById('modal').classList.remove('show');
    currentEditId = null;
}

document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });