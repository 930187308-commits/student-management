// ==================== 数据存储 ====================

// 本地服务器同步配置
const SERVER_URL = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
const DATA_ENDPOINT = SERVER_URL + '/data';
const API_COLLECTION_NAMES = [
    'classes',
    'students',
    'prospects',
    'fees',
    'attendance',
    'grades',
    'communications',
    'communicationTopics',
    'prospectSources',
    'classTypes',
    'gradeOptions'
];

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
    classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班'], // 班型可选项
    gradeOptions: ['五年级', '六年级', '初一', '初二', '初三', '新初一'] // 年级可选项
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
let serverDataUpdatedAt = null; // 服务器端数据版本号，防止旧设备整包覆盖新数据
let lastSavedDataSnapshot = null; // 最近一次保存前的数据，用于一步撤回
let undoDataSnapshot = null;
let reportsSummaryCache = null;
let reportsSummaryLoading = false;
let dashboardSummaryCache = null;
let dashboardSummaryLoading = false;

// 存储键名
const STORAGE_KEY = 'studentManagementSystem_v3';

// JSONBin.io 同步配置（保留但默认不使用）
const JSONBIN_COLLECTION_KEY = 'jsonbinCollectionId';
const JSONBIN_MASTER_KEY = 'jsonbinMasterKey';
const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3';

// ========== HTML 转义 ==========

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ========== 隐私隐藏 ==========
let privacyHidden = localStorage.getItem('studentManagePrivacyHidden') === '1';

function getPrivacyVal(val, unit) {
    if (privacyHidden) return '***';
    if (val == null) return '0';
    return unit ? val + unit : val;
}

function getPrivacyAmount(val) {
    if (privacyHidden) return '***';
    if (val == null || val === 0) return '0';
    return '¥' + Number(val).toLocaleString();
}

function maskStudentName(name) {
    if (!name) return '未知';
    const s = String(name);
    if (s.length <= 1) return s + '*';
    return s[0] + '*'.repeat(Math.min(s.length - 1, 2));
}

function togglePrivacy() {
    privacyHidden = !privacyHidden;
    localStorage.setItem('studentManagePrivacyHidden', privacyHidden ? '1' : '0');
    renderStats();
    renderDashboard();
    if (typeof renderAIWorkspace === 'function') renderAIWorkspace();
    updatePrivacyBtnLabel();
    showToast(privacyHidden ? '数据已隐藏' : '数据已显示');
}

function updatePrivacyBtnLabel() {
    const btn = document.getElementById('privacyToggleBtn');
    if (btn) btn.textContent = privacyHidden ? '🔒' : '👁';
}

// ========== 姓名规范化（用于匹配） ==========
// trim；去掉所有空格；中文、数字、字母都保留；其他字符也保留（用户原始显示不受影响）
function normalizeNameForMatch(name) {
    if (!name) return '';
    return String(name).trim().replace(/\s+/g, '');
}

// ========== 普通文本规范化（用于班级名称、上课时间等匹配） ==========
function normalizeTextForMatch(text) {
    if (text == null) return '';
    return String(text).trim().replace(/\s+/g, '');
}

// ========== 日期解析工具 ==========

// 统一将 Excel 日期、字符串日期、Date 对象转为 yyyy-mm-dd 格式
// 兼容：yyyy-mm-dd、yyyy/m/d、Excel 数字日期（如 45323）
function normalizeExcelDate(value) {
    if (!value && value !== 0) return '';
    // 已经是 yyyy-mm-dd 格式字符串
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }
    // yyyy/m/d 或其他 yyyy?mm?dd 格式
    if (typeof value === 'string') {
        const parts = value.trim().split(/[-\/]/);
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }
    }
    // Excel 数字日期
    if (typeof value === 'number' && value > 20000 && value < 60000) {
        try {
            const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
            if (!isNaN(date)) {
                return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
            }
        } catch (e) { /* ignore */ }
    }
    return '';
}

// ========== 本地服务器同步 ==========

// 检查是否配置了本地服务器（默认使用）
function isLocalServerConfigured() {
    return true; // 默认使用本地服务器
}

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

// 从本地服务器加载数据
async function loadFromServer() {
    try {
        const splitData = await loadSplitCollectionsFromServer();
        if (splitData) return splitData;
    } catch (error) {
        console.warn('按模块加载服务器数据失败，尝试整包 /data 兜底:', error);
    }

    try {
        const response = await fetch(DATA_ENDPOINT, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`服务器错误: ${response.status}`);
        }

        const serverData = await response.json();
        serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || null;
        if (serverData && Object.keys(serverData).length > 0) {
            return serverData;
        }
        return null;
    } catch (error) {
        console.error('从本地服务器加载失败:', error);
        return null;
    }
}

async function loadSplitCollectionsFromServer() {
    const metaResponse = await fetch(`${SERVER_URL}/api/meta`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!metaResponse.ok) throw new Error(`读取 meta 失败：${metaResponse.status}`);
    const meta = await metaResponse.json();
    serverDataUpdatedAt = meta.dataUpdatedAt || serverDataUpdatedAt;

    const entries = await Promise.all(API_COLLECTION_NAMES.map(async (collectionName) => {
        const items = await loadCollectionFromApi(collectionName);
        return [collectionName, items];
    }));
    return {
        ...Object.fromEntries(entries),
        lastModified: serverDataUpdatedAt || new Date().toISOString()
    };
}

// 保存数据到本地服务器
async function saveToServer(data) {
    try {
        if (!serverDataUpdatedAt) {
            console.warn('缺少服务器数据版本号，跳过保存以避免覆盖服务器数据');
            showToast('请先刷新页面加载服务器数据');
            return false;
        }

        const response = await fetch(DATA_ENDPOINT, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Base-Data-Updated-At': serverDataUpdatedAt
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            if (response.status === 409 || response.status === 428) {
                const latestVersion = response.headers.get('X-Data-Updated-At');
                if (latestVersion) serverDataUpdatedAt = latestVersion;
                showToast(errorPayload.hint || '服务器数据已更新，请刷新页面');
                return false;
            }
            throw new Error(errorPayload.error || `保存失败: ${response.status}`);
        }
        serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || serverDataUpdatedAt;
        return true;
    } catch (error) {
        console.error('保存到本地服务器失败:', error);
        showToast('保存到服务器失败，请检查网络');
        return false;
    }
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

// 显示本地服务器设置弹窗
function showGistSetupModal() {
    showLocalServerSetupModal();
}

function showLocalServerSetupModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('show');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>本地服务器同步</h3>
                <button class="modal-close" onclick="closeLocalServerSetupModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color: #27ae60; font-size: 13px; margin-bottom: 15px;">✓ 已连接到 Mac Mini 服务器</p>
                <p style="color: #666; font-size: 13px; margin-bottom: 15px;">
                    所有设备连接到同一个 Mac Mini，数据自动同步。<br>
                    服务器地址: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${SERVER_URL}</code>
                </p>
                <p style="color: #999; font-size: 12px;">
                    Mac Mini 需要保持开机状态才能同步数据。
                </p>
            </div>
            <div class="modal-footer">
                <button onclick="closeLocalServerSetupModal()" style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">确定</button>
            </div>
        </div>
    `;
}

function closeLocalServerSetupModal() {
    document.getElementById('modal').classList.remove('show');
}

function saveGistConfig() {
    closeLocalServerSetupModal();
    showToast('使用本地服务器同步');
}

function clearGistConfig() {
    closeLocalServerSetupModal();
    showToast('请刷新页面重新配置');
}

function showGistHelp() {
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>本地服务器同步说明</h3>
                <button class="modal-close" onclick="showLocalServerSetupModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color: #666; font-size: 13px; line-height: 1.8;">
                    本地服务器同步方案：<br><br>
                    1. Mac Mini 作为服务器运行<br>
                    2. 所有设备通过局域网连接<br>
                    3. 数据存储在 Mac Mini 上<br><br>
                    <b>注意：</b>Mac Mini 需要保持开机状态。<br>
                    如果 Mac Mini 关机，设备会使用本地缓存数据。
                </p>
            </div>
            <div class="modal-footer">
                <button onclick="showLocalServerSetupModal()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">返回</button>
            </div>
        </div>
    `;
}

// ========== 初始化 ==========

// 初始化
async function init() {
    await loadData();
    initDarkMode();
    initTabs();
    render();
}

// 加载数据（优先从本地服务器）
async function loadData() {
    // 优先从本地服务器加载
    try {
        const serverData = await loadFromServer();
        if (serverData) {
            data = serverData;
            lastSavedDataSnapshot = cloneData(data);
            updateUndoButton();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            showToast('已加载服务器数据');
            return;
        }
    } catch (e) {
        console.log('服务器加载失败，使用本地数据:', e);
    }

    // 降级到本地存储
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
        lastSavedDataSnapshot = cloneData(data);
        updateUndoButton();
        showToast('使用本地缓存数据');
    }
}

// 从本地存储加载数据
function loadDataFromLocal() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        data = JSON.parse(stored);
        lastSavedDataSnapshot = cloneData(data);
        updateUndoButton();
    }
}

// 保存数据（同时保存到服务器和本地）
async function saveData() {
    if (lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    data.lastModified = new Date().toISOString();

    try {
        await saveAllCollectionsToApi({ skipUndo: true });
        dataModified = false;
    } catch (e) {
        console.log('保存到服务器失败:', e);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        lastSavedDataSnapshot = cloneData(data);
        lastSaveTime = new Date();
        updateAutoSaveIndicator();
        updateUndoButton();
    }
}

async function createServerBackup(reason = 'manual') {
    try {
        const response = await fetch(`${SERVER_URL}/api/backups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) throw new Error(`备份失败：${response.status}`);
        return await response.json();
    } catch (error) {
        console.log('创建服务器备份失败:', error);
        return null;
    }
}

async function loadServerBackups() {
    const response = await fetch(`${SERVER_URL}/api/backups`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`读取备份列表失败：${response.status}`);
    const payload = await response.json();
    return payload.backups || [];
}

async function restoreServerBackup(id) {
    const response = await fetch(`${SERVER_URL}/api/backups/${id}/restore`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `恢复备份失败：${response.status}`);
    }
    const payload = await response.json();
    const restored = payload.data || payload;
    data = restored;
    invalidateReportsSummaryCache();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || restored.lastModified || null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    undoDataSnapshot = null;
    updateUndoButton();
    return payload;
}

async function loadCollectionFromApi(collectionName) {
    const response = await fetch(`${SERVER_URL}/api/${collectionName}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`读取 ${collectionName} 失败：${response.status}`);
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
    return payload[collectionName] || [];
}

function invalidateReportsSummaryCache() {
    reportsSummaryCache = null;
    dashboardSummaryCache = null;
}

async function loadReportsSummaryFromApi() {
    const response = await fetch(`${SERVER_URL}/api/reports/summary`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`读取统计报表失败：${response.status}`);
    return response.json();
}

async function loadDashboardSummaryFromApi() {
    const response = await fetch(`${SERVER_URL}/api/dashboard/summary`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`读取首页统计失败：${response.status}`);
    return response.json();
}

async function loadDataHealthReportFromApi() {
    const response = await fetch(`${SERVER_URL}/api/data-health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`读取数据体检失败：${response.status}`);
    return response.json();
}

async function saveCollectionToApi(collectionName, items) {
    if (lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    const response = await fetch(`${SERVER_URL}/api/${collectionName}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Base-Data-Updated-At': serverDataUpdatedAt || ''
        },
        body: JSON.stringify({ [collectionName]: items })
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `保存 ${collectionName} 失败：${response.status}`);
    }
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
        data[collectionName] = payload[collectionName] || items;
        invalidateReportsSummaryCache();
        data.lastModified = payload.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    dataModified = false;
    updateAutoSaveIndicator();
    updateUndoButton();
    return data[collectionName];
}

async function saveCollectionItemToApi(collectionName, item) {
    if (lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    const method = item && item.id ? 'PUT' : 'POST';
    const url = item && item.id
        ? `${SERVER_URL}/api/${collectionName}/${encodeURIComponent(item.id)}`
        : `${SERVER_URL}/api/${collectionName}`;
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Base-Data-Updated-At': serverDataUpdatedAt || ''
        },
        body: JSON.stringify({ item })
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `保存 ${collectionName} 记录失败：${response.status}`);
    }
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
    data[collectionName] = payload[collectionName] || data[collectionName] || [];
    invalidateReportsSummaryCache();
    data.lastModified = payload.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    dataModified = false;
    updateAutoSaveIndicator();
    updateUndoButton();
    return payload.item;
}

async function deleteCollectionItemFromApi(collectionName, id) {
    if (lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    const response = await fetch(`${SERVER_URL}/api/${collectionName}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'X-Base-Data-Updated-At': serverDataUpdatedAt || ''
        }
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `删除 ${collectionName} 记录失败：${response.status}`);
    }
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
    data[collectionName] = payload[collectionName] || data[collectionName] || [];
    invalidateReportsSummaryCache();
    data.lastModified = payload.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    dataModified = false;
    updateAutoSaveIndicator();
    updateUndoButton();
    return payload.deleted;
}

async function runActionToApi(path, options = {}) {
    if (!options.skipUndo && lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    const method = options.method || 'POST';
    const body = options.body || {};
    const response = await fetch(`${SERVER_URL}${path}`, {
        method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Base-Data-Updated-At': serverDataUpdatedAt || ''
        },
        body: method === 'GET' ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `操作失败：${response.status}`);
    }
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
    (options.collections || []).forEach(collectionName => {
        if (Array.isArray(payload[collectionName])) {
            data[collectionName] = payload[collectionName];
        }
    });
    invalidateReportsSummaryCache();
    data.lastModified = payload.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    dataModified = false;
    updateAutoSaveIndicator();
    updateUndoButton();
    return payload;
}

async function convertProspectToStudentFromApi(id) {
    return runActionToApi(`/api/actions/prospects/${encodeURIComponent(id)}/convert`, {
        collections: ['students', 'prospects']
    });
}

async function archiveClassFromApi(id) {
    return runActionToApi(`/api/actions/classes/${encodeURIComponent(id)}/archive`, {
        collections: ['classes', 'prospects']
    });
}

async function saveClassWithTransitionsToApi(classData, options = {}) {
    return runActionToApi('/api/actions/classes/save', {
        body: { item: classData, options },
        collections: ['classes', 'students', 'prospects']
    });
}

async function unarchiveClassFromApi(id) {
    return runActionToApi(`/api/actions/classes/${encodeURIComponent(id)}/unarchive`, {
        collections: ['classes']
    });
}

async function permanentlyDeleteArchivedClassFromApi(id) {
    return runActionToApi(`/api/actions/classes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        collections: ['classes', 'attendance', 'students', 'prospects']
    });
}

async function cleanSafeHealthIssuesFromApi() {
    return runActionToApi('/api/actions/data-health/clean-safe', {
        collections: ['attendance', 'fees']
    });
}

function getAllCollectionsPayload() {
    return Object.fromEntries(API_COLLECTION_NAMES.map(collectionName => [collectionName, data[collectionName] || []]));
}

async function saveAllCollectionsToApi(options = {}) {
    return saveCollectionsToApi(getAllCollectionsPayload(), options);
}

async function saveCollectionsToApi(collections, options = {}) {
    if (!options.skipUndo && lastSavedDataSnapshot) {
        undoDataSnapshot = cloneData(lastSavedDataSnapshot);
    }
    const response = await fetch(`${SERVER_URL}/api/batch`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Base-Data-Updated-At': serverDataUpdatedAt || ''
        },
        body: JSON.stringify({ collections })
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `批量保存失败：${response.status}`);
    }
    const payload = await response.json();
    serverDataUpdatedAt = response.headers.get('X-Data-Updated-At') || payload.updatedAt || serverDataUpdatedAt;
    Object.keys(collections).forEach(collectionName => {
        data[collectionName] = payload[collectionName] || collections[collectionName];
    });
    invalidateReportsSummaryCache();
    data.lastModified = payload.updatedAt || new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    dataModified = false;
    updateAutoSaveIndicator();
    updateUndoButton();
    return payload;
}

async function loadClassesFromApi() {
    return loadCollectionFromApi('classes');
}

async function saveClassesToApi(classes) {
    return saveCollectionToApi('classes', classes);
}

async function loadStudentsFromApi() {
    return loadCollectionFromApi('students');
}

async function saveStudentsToApi(students) {
    return saveCollectionToApi('students', students);
}

async function loadProspectsFromApi() {
    return loadCollectionFromApi('prospects');
}

async function saveProspectsToApi(prospects) {
    return saveCollectionToApi('prospects', prospects);
}

async function loadFeesFromApi() {
    return loadCollectionFromApi('fees');
}

async function saveFeesToApi(fees) {
    return saveCollectionToApi('fees', fees);
}

async function loadAttendanceFromApi() {
    return loadCollectionFromApi('attendance');
}

async function saveAttendanceToApi(attendance) {
    return saveCollectionToApi('attendance', attendance);
}

async function loadGradesFromApi() {
    return loadCollectionFromApi('grades');
}

async function saveGradesToApi(grades) {
    return saveCollectionToApi('grades', grades);
}

async function loadCommunicationsFromApi() {
    return loadCollectionFromApi('communications');
}

async function saveCommunicationsToApi(communications) {
    return saveCollectionToApi('communications', communications);
}

async function saveCommunicationTopicsToApi(communicationTopics) {
    return saveCollectionToApi('communicationTopics', communicationTopics);
}

async function saveProspectSourcesToApi(prospectSources) {
    return saveCollectionToApi('prospectSources', prospectSources);
}

async function saveClassTypesToApi(classTypes) {
    return saveCollectionToApi('classTypes', classTypes);
}

async function saveGradeOptionsToApi(gradeOptions) {
    return saveCollectionToApi('gradeOptions', gradeOptions);
}

function cloneData(source) {
    return JSON.parse(JSON.stringify(source || {}));
}

function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    if (btn) btn.disabled = !undoDataSnapshot;
}

async function undoLastChange() {
    if (!undoDataSnapshot) {
        showToast('暂无可撤回的修改');
        return;
    }
    if (!confirm('确定撤回最近一次保存的修改吗？')) return;
    const currentSnapshot = cloneData(data);
    data = cloneData(undoDataSnapshot);
    undoDataSnapshot = currentSnapshot;
    data.lastModified = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    lastSavedDataSnapshot = cloneData(data);
    lastSaveTime = new Date();
    updateAutoSaveIndicator();
    updateUndoButton();
    try {
        await saveAllCollectionsToApi({ skipUndo: true });
    } catch (e) {
        console.log('撤回后保存到服务器失败:', e);
    }
    render();
    showToast('已撤回上一步');
}

// 自动保存
function startAutoSave() {
    window.addEventListener('beforeunload', () => {
        if (dataModified) {
            navigator.sendBeacon?.('data:;base64,');
        }
    });
}

function updateAutoSaveIndicator() {
    const indicator = document.getElementById('autosaveIndicator');
    if (indicator) {
        indicator.className = 'autosave-indicator saved';
        indicator.innerHTML = '● 已同步 ' + (lastSaveTime ? lastSaveTime.toLocaleTimeString() : '');
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
    dataModified = false;
    showToast('备份已导出');
}

// 备份导入
function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (backup.data) {
                if (confirm('导入将覆盖当前所有数据，确定继续？')) {
                    await createServerBackup('导入本地备份前自动备份');
                    data = backup.data;
                    dataModified = false;
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
            { id: 'a1', classId: 'c4', date: '2025-09-05', sessionName: '秋季第1课-分数运算', records: { s1: 1, s6: 1 } },
            { id: 'a2', classId: 'c4', date: '2025-09-12', sessionName: '秋季第2课-工程问题', records: { s1: 1, s6: 0 } },
            { id: 'a3', classId: 'c4', date: '2025-09-19', sessionName: '秋季第3课-浓度问题', records: { s1: 1, s6: 1 } },
            { id: 'a4', classId: 'c4', date: '2025-09-26', sessionName: '秋季第4课-行程问题', records: { s1: 0, s6: 1 } },
            { id: 'a5', classId: 'c4', date: '2025-10-03', sessionName: '秋季第5课-几何基础', records: { s1: 1, s6: 1 } },
            { id: 'a6', classId: 'c4', date: '2025-10-10', sessionName: '秋季第6课-几何面积', records: { s1: 1, s6: 1 } },
            { id: 'a7', classId: 'c1', date: '2025-09-04', sessionName: '秋季第1课-有理数运算', records: { s2: 1 } },
            { id: 'a8', classId: 'c1', date: '2025-09-11', sessionName: '秋季第2课-整式加减', records: { s2: 1 } },
            { id: 'a9', classId: 'c1', date: '2025-09-18', sessionName: '秋季第3课-一元一次方程', records: { s2: 0 } },
            { id: 'a10', classId: 'c1', date: '2025-09-25', sessionName: '秋季第4课-方程应用', records: { s2: 1 } },
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
        classTypes: ['基础', '拔高', '奥数', '中考', '自主招生', '短期班'],
        gradeOptions: ['五年级', '六年级', '初一', '初二', '初三', '新初一']
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
            // KPI 卡片只在首页和统计报表显示
            const appMain = document.querySelector('.app-main');
            if (currentTab === 'dashboard' || currentTab === 'reports') {
                appMain.classList.remove('hide-stats');
            } else {
                appMain.classList.add('hide-stats');
            }
            render();
        });
    });
}

// 渲染
function render() {
    renderStats();
    if (typeof updateDataHealthBadge === 'function') updateDataHealthBadge();
    renderDashboard();
    renderClasses();
    renderStudents();
    renderFees();
    renderAttendance();
    renderGrades();
    renderCommunications();
    renderProspects();
    renderReports();
    renderKnowledge();
    renderAIWorkspace();
}

// 渲染统计卡片
function renderStats() {
    if (!dashboardSummaryCache && !dashboardSummaryLoading) {
        dashboardSummaryLoading = true;
        loadDashboardSummaryFromApi()
            .then(summary => {
                dashboardSummaryCache = summary;
                renderStats();
            })
            .catch(error => {
                console.log('读取后端首页统计失败，使用本地计算:', error);
            })
            .finally(() => {
                dashboardSummaryLoading = false;
            });
    }
    const summary = dashboardSummaryCache || buildLocalDashboardSummary();
    const activeStudents = summary.activeStudents;
    const totalClasses = summary.totalClasses;
    const totalRevenue = summary.totalRevenue;
    const pendingAmount = summary.pendingAmount;
    const totalHours = summary.totalHours;
    const usedHours = summary.usedHours;
    const absentHours = summary.absentHours;
    const remainingHours = summary.remainingHours;
    const usageRate = summary.usageRate;

    document.getElementById('statGrid').innerHTML = `
        <div class="stat-card hours-overview-card">
            <div class="hours-ring">
                <div style="position: relative; width: 70px; height: 70px; flex-shrink: 0;">
                    <canvas id="hoursRingChart" width="140" height="140" style="width: 70px; height: 70px;"></canvas>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                        <div style="font-size: 14px; font-weight: 700; color: #2c3e50;">${getPrivacyVal(remainingHours)}</div>
                        <div style="font-size: 9px; color: #888;">剩余</div>
                    </div>
                </div>
                <div>
                    <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${getPrivacyVal(totalHours)}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">总课时</div>
                </div>
            </div>
            <div class="hours-metrics">
                <div class="metric-item">
                    <span class="metric-val" style="color:#27ae60;">${getPrivacyVal(usedHours)}</span>
                    <span class="metric-lbl">已消课时</span>
                </div>
                <div class="metric-item">
                    <span class="metric-val" style="color:#f39c12;">${getPrivacyVal(absentHours)}</span>
                    <span class="metric-lbl">请假课时</span>
                </div>
                <div class="metric-item">
                    <span class="metric-val">${getPrivacyVal(usageRate)}%</span>
                    <span class="metric-lbl">消耗率</span>
                </div>
                <div class="metric-item">
                    <span class="metric-val">${getPrivacyVal(remainingHours)}</span>
                    <span class="metric-lbl">剩余课时</span>
                </div>
            </div>
        </div>
        <div class="stat-card"><div class="value">${getPrivacyVal(activeStudents)}</div><div class="label">在读学员</div></div>
        <div class="stat-card"><div class="value">${getPrivacyVal(totalClasses)}</div><div class="label">班级数量</div></div>
        <div class="stat-card"><div class="value">${getPrivacyAmount(totalRevenue)}</div><div class="label">已收学费</div></div>
        <div class="stat-card"><div class="value">${getPrivacyAmount(pendingAmount)}</div><div class="label">欠费金额</div></div>
    `;

    setTimeout(() => drawHoursRingChart(usedHours, remainingHours), 10);
}

function buildLocalDashboardSummary() {
    const activeStudents = data.students.filter(s => s.status === 'active').length;
    const totalClasses = data.classes.filter(c => c.status === 'active').length;
    const totalRevenue = data.fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
    const pendingAmount = data.fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);
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
    const classOverview = data.classes
        .filter(c => c.status === 'active')
        .map(c => ({
            id: c.id || '',
            name: c.name || '',
            grade: c.grade || '',
            schedule: c.schedule || '',
            currentCount: data.students.filter(s => s.classId === c.id && s.status === 'active').length,
            maxStudents: Number(c.maxStudents || 0),
            plannedSessions: Number(c.plannedSessions || 0),
            completedSessions: data.attendance.filter(a => a.classId === c.id).length
        }));
    const pendingFees = data.fees
        .filter(f => f.status === 'pending')
        .map(f => ({
            id: f.id || '',
            studentName: f.studentName || '',
            amount: Number(f.amount || 0)
        }));
    return { activeStudents, totalClasses, totalRevenue, pendingAmount, totalHours, usedHours, absentHours, remainingHours, usageRate, classOverview, pendingFees };
}

function drawHoursRingChart(used, remaining) {
    const canvas = document.getElementById('hoursRingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = 70, centerY = 70, radius = 58, thickness = 16;

    ctx.clearRect(0, 0, 140, 140);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();

    const total = used + remaining;
    if (total > 0) {
        const usedAngle = (used / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + usedAngle);
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.stroke();

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

// 导入重复记录三选一策略
// 返回 'skip' | 'replace' | 'cancel'
function askDuplicateStrategy(message) {
    const choice = prompt(`${message}\n请输入：1=保留现有并跳过重复，2=替换已有重复，3=取消本次导入`, '1');
    if (choice === '1') return 'skip';
    if (choice === '2') return 'replace';
    return 'cancel';
}

// 导入预检查弹窗（通用）
// checkFn 返回 { total, success, dup, fail, skip, errors[] }
// errors 数组每项为 { row, msg }（row 为 1-based 行号）
// actionLabel 如 "导入收费记录"
// onConfirm 用户确认后执行的回调，签名为 ({ duplicateStrategy, missingStudentStrategy }) => void
// duplicateStrategy 仅在有重复时传递 'skip' | 'replace'
// missingStudentStrategy 仅在有无匹配学员时传递 'skip' | 'create'
function showImportPreCheck({
    title,
    checkResult,
    actionLabel = '导入',
    onConfirm,
    duplicateStrategy = null,
    missingStudentStrategy = null
}) {
    const { total, success, dup, fail, skip, errors, warnings = [], duplicates = [], missingStudents = [], skippedDetails = [] } = checkResult;
    const hasDupe = dup > 0;
    const hasMissingStudents = missingStudents.length > 0;
    let currentDuplicateStrategy = duplicateStrategy;
    let currentMissingStudentStrategy = missingStudentStrategy;

    const buildDetailsSection = ({ title, items, color, bg, border, emptyText = '' }) => {
        if (!items || items.length === 0) return '';
        const list = items.slice(0, 200);
        return `
            <div style="margin-top: 12px; padding: 10px; background: ${bg}; border-radius: 6px; border: 1px solid ${border};">
                <details style="font-size: 12px; color: ${color};">
                    <summary style="cursor: pointer; user-select: none; font-weight: 600;">${title}（${items.length} 条）</summary>
                    <div style="margin-top: 6px; max-height: 180px; overflow-y: auto;">
                        ${list.map(item => `<div style="margin-bottom: 2px;">${item.row ? `第${item.row}行：` : ''}${escapeHtml(item.msg || item.name || emptyText)}</div>`).join('')}
                        ${items.length > list.length ? `<div>还有 ${items.length - list.length} 条未显示</div>` : ''}
                    </div>
                </details>
            </div>
        `;
    };

    let dupeSection = '';
    if (hasDupe) {
        dupeSection = `
            <div style="margin-top: 12px; padding: 10px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffc107;">
                <div style="font-weight: 600; color: #856404; margin-bottom: 6px;">发现重复记录（${dup} 条）</div>
                ${duplicates.length > 0 ? `
                    <details style="margin-bottom: 8px; font-size: 12px; color: #856404;">
                        <summary style="cursor: pointer; user-select: none;">查看重复明细</summary>
                        <div style="margin-top: 6px; max-height: 160px; overflow-y: auto;">
                            ${duplicates.slice(0, 200).map(d => `<div style="margin-bottom: 2px;">第${d.row}行：${escapeHtml(d.msg)}</div>`).join('')}
                            ${duplicates.length > 200 ? `<div>还有 ${duplicates.length - 200} 条未显示</div>` : ''}
                        </div>
                    </details>
                ` : ''}
                <div class="duplicate-strategy-label" style="margin-bottom: 8px; font-size: 13px; color: #856404;">
                    当前策略：<strong>${duplicateStrategy === 'skip' ? '保留现有并跳过' : duplicateStrategy === 'replace' ? '替换已有重复' : '未选择'}</strong>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm duplicate-skip-btn" onclick="this.closest('.import-precheck-modal')._onStrategyChange('skip')" ${duplicateStrategy === 'skip' ? 'style="font-weight:bold;"' : ''}>保留现有</button>
                    <button class="btn btn-secondary btn-sm duplicate-replace-btn" onclick="this.closest('.import-precheck-modal')._onStrategyChange('replace')" ${duplicateStrategy === 'replace' ? 'style="font-weight:bold;"' : ''}>替换已有</button>
                </div>
            </div>
        `;
    }

    let missingStudentSection = '';
    if (hasMissingStudents) {
        const missingList = missingStudents.map(s => ({ row: s.row, msg: s.name }));
        missingStudentSection = `
            <div style="margin-top: 12px; padding: 10px; background: #fff7e6; border-radius: 6px; border: 1px solid #f39c12;">
                <div style="font-weight: 600; color: #8a5a00; margin-bottom: 6px;">系统内无此学员（${missingStudents.length} 条）</div>
                <details style="margin-bottom: 8px; font-size: 12px; color: #8a5a00;">
                    <summary style="cursor: pointer; user-select: none;">查看无匹配明细</summary>
                    <div style="margin-top: 6px; max-height: 160px; overflow-y: auto;">
                        ${missingList.slice(0, 200).map(s => `<div style="margin-bottom: 2px;">第${s.row}行：${escapeHtml(s.msg)}</div>`).join('')}
                        ${missingList.length > 200 ? `<div>还有 ${missingList.length - 200} 条未显示</div>` : ''}
                    </div>
                </details>
                <div class="missing-strategy-label" style="margin-bottom: 8px; font-size: 13px; color: #8a5a00;">
                    当前策略：<strong>${missingStudentStrategy === 'create' ? '自动新建学员后导入' : missingStudentStrategy === 'skip' ? '跳过这些记录' : '未选择'}</strong>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm missing-skip-btn" onclick="this.closest('.import-precheck-modal')._onMissingStudentStrategyChange('skip')" ${missingStudentStrategy === 'skip' ? 'style="font-weight:bold;"' : ''}>跳过</button>
                    <button class="btn btn-secondary btn-sm missing-create-btn" onclick="this.closest('.import-precheck-modal')._onMissingStudentStrategyChange('create')" ${missingStudentStrategy === 'create' ? 'style="font-weight:bold;"' : ''}>自动新建</button>
                </div>
            </div>
        `;
    }

    const warningSection = buildDetailsSection({ title: '提示明细', items: warnings, color: '#9a6308', bg: '#fff7e6', border: '#f5c16c' });
    const errorSection = buildDetailsSection({ title: '失败明细', items: errors, color: '#c0392b', bg: '#fdecea', border: '#e74c3c' });
    const skippedSection = buildDetailsSection({ title: '跳过明细', items: skippedDetails, color: '#666', bg: 'var(--hover-bg)', border: 'var(--border-color)' });

    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="import-precheck-modal">
            <div style="font-size: 14px; line-height: 1.8;">
                <div style="margin-bottom: 8px;">
                    <span style="color: #888;">本次读取：</span><strong>${total}</strong> 条
                </div>
                <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 8px;">
                    <div><span style="color: #27ae60;">可导入</span> <strong style="color: #27ae60;">${success}</strong> 条</div>
                    ${dup > 0 ? `<div><span style="color: #f39c12;">重复</span> <strong style="color: #f39c12;">${dup}</strong> 条</div>` : ''}
                    ${fail > 0 ? `<div><span style="color: #e74c3c;">失败</span> <strong style="color: #e74c3c;">${fail}</strong> 条</div>` : ''}
                    ${skip > 0 ? `<div><span style="color: #888;">跳过</span> <strong>${skip}</strong> 条</div>` : ''}
                </div>
                ${dup === 0 && fail === 0 && !hasMissingStudents ? `<div style="color: #27ae60; font-weight: 600;">✓ 所有数据可正常导入</div>` : ''}
            </div>
            ${dupeSection}
            ${missingStudentSection}
            ${warningSection}
            ${errorSection}
            ${skippedSection}
            <div style="margin-top: 16px; padding: 10px; background: #e8f4fd; border-radius: 6px; font-size: 13px; color: #2980b9;">
                ${hasDupe || hasMissingStudents ? '请先选择需要处理的策略，再确认导入。' : fail > 0 ? '失败记录不影响其他正常数据，可确认导入。' : '点击"确认"后将正式写入数据。'}
            </div>
            <div class="modal-footer" style="margin-top: 16px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-primary" onclick="this.closest('.import-precheck-modal')._onConfirm()">确认${actionLabel}</button>
            </div>
        </div>
    `;

    const modalEl = modal.querySelector('.import-precheck-modal');
    modalEl._onConfirm = () => {
        if (hasDupe && !currentDuplicateStrategy) {
            showToast('请先选择重复处理策略');
            return;
        }
        if (hasMissingStudents && !currentMissingStudentStrategy) {
            showToast('请先选择无匹配学员处理策略');
            return;
        }
        closeModal();
        onConfirm({
            duplicateStrategy: hasDupe ? currentDuplicateStrategy : null,
            missingStudentStrategy: hasMissingStudents ? currentMissingStudentStrategy : null
        });
    };
    modalEl._onStrategyChange = (s) => {
        currentDuplicateStrategy = s;
        const btn1 = modalEl.querySelector('.duplicate-skip-btn');
        const btn2 = modalEl.querySelector('.duplicate-replace-btn');
        if (btn1) btn1.style.fontWeight = s === 'skip' ? 'bold' : '';
        if (btn2) btn2.style.fontWeight = s === 'replace' ? 'bold' : '';
        const strategyLabel = modalEl.querySelector('.duplicate-strategy-label');
        if (strategyLabel) {
            strategyLabel.innerHTML = `当前策略：<strong>${s === 'skip' ? '保留现有并跳过' : '替换已有重复'}</strong>`;
        }
    };
    modalEl._onMissingStudentStrategyChange = (s) => {
        currentMissingStudentStrategy = s;
        const skipBtn = modalEl.querySelector('.missing-skip-btn');
        const createBtn = modalEl.querySelector('.missing-create-btn');
        if (skipBtn) skipBtn.style.fontWeight = s === 'skip' ? 'bold' : '';
        if (createBtn) createBtn.style.fontWeight = s === 'create' ? 'bold' : '';
        const strategyLabel = modalEl.querySelector('.missing-strategy-label');
        if (strategyLabel) {
            strategyLabel.innerHTML = `当前策略：<strong>${s === 'create' ? '自动新建学员后导入' : '跳过这些记录'}</strong>`;
        }
    };

    modal.classList.add('show');
}

// 导入完成结果弹窗摘要
// 调用方式：showImportResultSummary({ imported, replaced, skipped, failed, total, actionLabel })
// failedDetails / skippedDetails 为 { row, msg } 数组，可选
function showImportResultSummary({ imported, replaced, skipped, failed, total, actionLabel = '导入', failedDetails = [], skippedDetails = [] }) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = actionLabel + '结果';

    const buildDetails = (items, color, bg, border, emptyLabel) => {
        if (!items || items.length === 0) return '';
        const list = items.slice(0, 200);
        return `
            <details style="margin-top: 8px; font-size: 12px; color: ${color};">
                <summary style="cursor: pointer; user-select: none; font-weight: 600;">查看明细（${items.length} 条）</summary>
                <div style="margin-top: 6px; max-height: 160px; overflow-y: auto; background: ${bg}; border-radius: 6px; padding: 8px;">
                    ${list.map(item => `<div style="margin-bottom: 2px;">${item.row ? `第${item.row}行：` : ''}${escapeHtml(item.msg || item.name || '')}</div>`).join('')}
                    ${items.length > 200 ? `<div>还有 ${items.length - 200} 条未显示</div>` : ''}
                </div>
            </details>
        `;
    };

    const allSuccess = failed === 0 && skipped === 0;
    const summaryColor = failed > 0 ? '#e74c3c' : allSuccess ? '#27ae60' : '#f39c12';
    const summaryBg = failed > 0 ? '#fdecea' : allSuccess ? '#e8f5e9' : '#fff7e6';

    document.getElementById('modalBody').innerHTML = `
        <div style="text-align: center; padding: 16px 0;">
            <div style="font-size: 48px; margin-bottom: 8px;">${failed > 0 ? '⚠️' : allSuccess ? '✅' : '⚡'}</div>
            <div style="font-size: 16px; font-weight: 600; color: ${summaryColor}; margin-bottom: 4px;">
                ${failed > 0 ? '导入完成（有失败）' : allSuccess ? '全部导入成功' : '导入完成'}
            </div>
            <div style="font-size: 13px; color: #888;">共读取 ${total} 条</div>
        </div>
        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin: 16px 0;">
            <div style="text-align: center; padding: 12px 20px; background: #e8f5e9; border-radius: 8px; min-width: 80px;">
                <div style="font-size: 24px; font-weight: 700; color: #27ae60;">${imported}</div>
                <div style="font-size: 12px; color: #888;">成功</div>
            </div>
            ${replaced > 0 ? `<div style="text-align: center; padding: 12px 20px; background: #fff3e0; border-radius: 8px; min-width: 80px;">
                <div style="font-size: 24px; font-weight: 700; color: #f39c12;">${replaced}</div>
                <div style="font-size: 12px; color: #888;">替换</div>
            </div>` : ''}
            ${skipped > 0 ? `<div style="text-align: center; padding: 12px 20px; background: var(--hover-bg); border-radius: 8px; min-width: 80px;">
                <div style="font-size: 24px; font-weight: 700; color: #888;">${skipped}</div>
                <div style="font-size: 12px; color: #888;">跳过</div>
            </div>` : ''}
            ${failed > 0 ? `<div style="text-align: center; padding: 12px 20px; background: #fdecea; border-radius: 8px; min-width: 80px;">
                <div style="font-size: 24px; font-weight: 700; color: #e74c3c;">${failed}</div>
                <div style="font-size: 12px; color: #888;">失败</div>
            </div>` : ''}
        </div>
        ${failed > 0 && failedDetails.length > 0 ? buildDetails(failedDetails, '#c0392b', '#fdecea', '#e74c3c', '失败明细') : ''}
        ${skipped > 0 && skippedDetails.length > 0 ? buildDetails(skippedDetails, '#666', 'var(--hover-bg)', 'var(--border-color)', '跳过明细') : ''}
        <div class="modal-footer" style="margin-top: 16px;">
            <button type="button" class="btn btn-primary" onclick="closeModal()">关闭</button>
        </div>
    `;
    modal.classList.add('show');
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
