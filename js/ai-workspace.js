// ==================== AI 工作台 Stage 6C ====================

let currentAgentId = 'biz-agent';
let agentLogs = [];

// 全局隐私模式状态
let aiPrivacyMode = 'masked';
let aiPrivacyModeLocked = false;

// 当前任务信息
let lastTaskId = '';
let lastTaskMode = '';
let lastTaskProvider = '';

let currentTaskType = '';
let currentTaskLabel = '';
let aiConversationMessages = [];
let systemQAConversations = [];
let currentSystemQAConversationId = '';
let systemQAConversationsLoaded = false;
let systemQAConversationSaveQueue = Promise.resolve();
let systemQAPrompts = [];
let systemQAPromptsLoaded = false;
let systemQAPromptManageMode = false;
let systemQAHistoryBatchMode = false;
let selectedSystemQAConversationIds = new Set();
let openSystemQAHistoryMenuId = '';
let selectedSystemQAModelProvider = localStorage.getItem('systemQAModelProvider') || 'minimax';
let selectedSystemQAAnswerLength = localStorage.getItem('systemQAAnswerLength') || 'brief';
let systemQAAIStatus = null;
let aiSourceScope = {
    systemData: true,
    knowledgeBase: false,
    webSearch: false
};

const DEFAULT_SYSTEM_QA_PROMPTS = [
    { id: 'qa_prompt_school_student', text: '某个同学是哪个学校的？', category: '学生', sortOrder: 10, isDefault: true },
    { id: 'qa_prompt_school_list', text: '某个学校有哪些学生？', category: '学生', sortOrder: 20, isDefault: true },
    { id: 'qa_prompt_hours_risk', text: '哪些学生课时快不够了？', category: '课时', sortOrder: 30, isDefault: true },
    { id: 'qa_prompt_grade_count', text: '六年级目前有多少在读学员？', category: '学生', sortOrder: 40, isDefault: true },
    { id: 'qa_prompt_score_100', text: '期中考100分的有哪些？', category: '成绩', sortOrder: 50, isDefault: true },
    { id: 'qa_prompt_fee_risk', text: '哪些学生有欠费或需要续费？', category: '收费', sortOrder: 60, isDefault: true },
    { id: 'qa_prompt_focus_students', text: '帮我总结一下最近需要关注的学生', category: '经营', sortOrder: 70, isDefault: true }
];

// ========== Markdown 安全渲染 ==========
function renderMarkdownTables(html) {
    const lines = html.split('\n');
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const header = lines[i];
        const separator = lines[i + 1];
        if (/^\s*\|.+\|\s*$/.test(header) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator || '')) {
            const rows = [];
            const parseCells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
            const headers = parseCells(header);
            i += 2;
            while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
                rows.push(parseCells(lines[i]));
                i += 1;
            }
            i -= 1;
            output.push(`<div class="ai-md-table-wrap"><table class="ai-md-table"><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, index) => `<td>${row[index] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        } else {
            output.push(header);
        }
    }
    return output.join('\n');
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="ai-md-code"><code>$1</code></pre>');
    html = renderMarkdownTables(html);
    html = html.replace(/^### (.+)$/gm, '<h4 class="ai-md-heading ai-md-heading-sm">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="ai-md-heading ai-md-heading-md">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="ai-md-heading ai-md-heading-lg">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^- (.+)$/gm, '<li class="ai-md-li ai-md-li-disc">$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ai-md-li ai-md-li-decimal">$2</li>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul class="ai-md-list">$&</ul>');
    return `<div class="ai-md-content">${html}</div>`;
}

// ========== AI 状态加载 ==========
function loadAIStatus() {
    fetch('/api/ai/status')
        .then(res => res.json())
        .then(info => { updateAIStatusUI(info); })
        .catch(() => { updateAIStatusUI({ mode: 'local-template', enabled: false }); });
}

function updateAIStatusUI(info) {
    systemQAAIStatus = info || null;
    renderSystemQAModelProviderSelect();
    const statusEl = document.getElementById('agentStatus');
    const modeLabelEl = document.getElementById('aiModeLabel');
    const configStatusEl = document.getElementById('aiConfigStatus');
    if (!statusEl || !modeLabelEl) return;
    statusEl.classList.remove('is-real-ai', 'is-local-template');

    if (info.mode === 'real-ai' && info.enabled) {
        statusEl.textContent = '真实 AI';
        statusEl.classList.add('is-real-ai');
        modeLabelEl.textContent = info.provider ? `已启用 · ${info.provider}` : '已启用';
        if (configStatusEl) configStatusEl.innerHTML = `<span class="ai-config-dot is-real">● 真实 AI 已启用</span> · ${escapeHtml(info.provider || '')}`;
    } else if (info.mode === 'local-template') {
        statusEl.textContent = '本地模板';
        statusEl.classList.add('is-local-template');
        modeLabelEl.textContent = info.enabled === false && info.missing?.length > 0 ? '真实 AI 未配置' : '本地模板模式';
        if (configStatusEl) {
            if (info.enabled === false && info.missing?.length > 0) {
                configStatusEl.innerHTML = `<span class="ai-config-dot is-warning">● 当前使用本地模板</span><br><span class="ai-config-missing">缺少配置: ${escapeHtml(info.missing.join(', '))}</span>`;
            } else {
                configStatusEl.innerHTML = `<span class="ai-config-dot is-muted">● 当前使用本地模板</span>`;
            }
        }
    } else {
        statusEl.textContent = '本地模板';
        statusEl.classList.add('is-local-template');
        modeLabelEl.textContent = '未接入真实 AI';
        if (configStatusEl) configStatusEl.innerHTML = `<span class="ai-config-dot is-muted">● 当前使用本地模板</span>`;
    }
}

// ========== 上下文引用 ==========
function renderContextRefs(contextRefs, mode) {
    const area = document.getElementById('contextRefsArea');
    const content = document.getElementById('contextRefsContent');
    if (!area || !content) return;

    const refs = Array.isArray(contextRefs) ? contextRefs : [];
    const factualRefs = refs.filter(ref => !['style', 'style-sample'].includes(ref.refType || ref.type || ''));
    if (refs.length === 0 || factualRefs.length === 0) {
        const label = mode === 'system-facts'
            ? '本次依据：当前系统数据。没有引用资料库或联网内容。'
            : '本次没有引用可作为事实依据的资料库或联网内容。风格样本只影响表达，不作为事实来源。';
        content.innerHTML = `<div class="system-qa-reference-empty">${label}</div>`;
        return;
    }

    const typeLabels = {
        'style': '风格规则',
        'style-sample': '风格样本',
        'source': '资料',
        'web': '联网结果',
        'question': '题库'
    };

    const grouped = {};
    refs.forEach(ref => {
        const type = ref.refType || ref.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(ref);
    });

    let html = '';
    Object.entries(grouped).forEach(([type, refs]) => {
        const label = typeLabels[type] || type;
        const visibleRefs = refs.slice(0, 3);
        const hiddenRefs = refs.slice(3);
        html += `<div class="ai-context-ref-group">
            <div class="ai-context-ref-heading">📂 ${escapeHtml(label)}（${refs.length}条）</div>`;
        visibleRefs.forEach(ref => { html += renderContextRefItem(ref); });
        if (hiddenRefs.length > 0) {
            html += `<details class="ai-context-more">
                <summary>查看其余 ${hiddenRefs.length} 条引用</summary>
                <div class="ai-context-extra-list">${hiddenRefs.map(ref => renderContextRefItem(ref)).join('')}</div>
            </details>`;
        }
        html += '</div>';
    });

    content.innerHTML = html;
}

function clearSystemQARefs() {
    const content = document.getElementById('contextRefsContent');
    if (!content) return;
    content.innerHTML = '<div class="system-qa-reference-empty">已清空当前引用显示。下一次发送问题后会自动更新。</div>';
}

function renderContextRefItem(ref) {
    const titleText = escapeHtml(ref.title || ref.name || '未命名');
    const summaryText = ref.summary ? escapeHtml(ref.summary) : '';
    const hasLongContent = summaryText.length > 100;
    return `<div class="ai-context-ref-item">
        <div class="ai-context-ref-title">${titleText}</div>
        ${summaryText ? `<div class="ai-context-ref-summary">${hasLongContent ? summaryText.substring(0, 100) + '...' : summaryText}</div>` : ''}
    </div>`;
}

// ========== 极简系统问答工作台 ==========
function renderAIWorkspace() {
    const container = document.getElementById('tab-ai-workspace');
    if (!container) return;
    aiPrivacyMode = aiPrivacyMode || 'masked';
    currentAgentId = 'system-agent';
    currentTaskType = 'system-qa';
    currentTaskLabel = '系统数据问答';
    hydrateSystemQAConversationsFromData();
    ensureSystemQAConversation();

    container.innerHTML = `
        <div class="system-qa-shell">
            <aside class="system-qa-sidebar">
                <div class="system-qa-sidebar-head">
                    <div class="system-qa-sidebar-title">AI 对话</div>
                    <button class="btn btn-primary btn-sm" onclick="startSystemQAConversation()">新对话</button>
                </div>
                <div class="system-qa-sidebar-actions">
                    <button class="btn btn-secondary btn-sm" onclick="refreshSystemQAData()">刷新系统数据</button>
                    <button class="btn btn-secondary btn-sm" onclick="showSystemQACapabilities()">能查什么</button>
                    <label class="system-qa-toggle"><input type="checkbox" id="systemQANameToggle" onchange="toggleSystemQANameMode()" ${aiPrivacyMode === 'named' ? 'checked' : ''}> 显示真实姓名</label>
                </div>
                <div class="system-qa-sidebar-block">
                    <div class="system-qa-section-head">
                        <div class="system-qa-section-title">可以这样问</div>
                        <div class="system-qa-prompt-actions">
                            <button class="btn btn-secondary btn-xs" onclick="toggleSystemQAPromptManageMode()">${systemQAPromptManageMode ? '完成' : '管理'}</button>
                        </div>
                    </div>
                    <div id="systemQAPromptManageBar" class="system-qa-manage-bar ${systemQAPromptManageMode ? '' : 'is-hidden'}">
                        <button class="btn btn-primary btn-xs" onclick="addSystemQAPrompt()">新增</button>
                        <button class="btn btn-secondary btn-xs" onclick="restoreDefaultSystemQAPrompts()">恢复默认</button>
                    </div>
                    <div id="systemQAPromptList" class="system-qa-prompt-list"></div>
                </div>
                <div class="system-qa-sidebar-block system-qa-history-block">
                    <div class="system-qa-section-head">
                        <div class="system-qa-section-title">聊天记录</div>
                        <div class="system-qa-prompt-actions">
                            <button id="systemQAHistoryBatchToggle" class="btn btn-secondary btn-xs" onclick="toggleSystemQAHistoryBatchMode()">${systemQAHistoryBatchMode ? '完成' : '批量'}</button>
                        </div>
                    </div>
                    <div id="systemQAHistoryBatchBar" class="system-qa-manage-bar ${systemQAHistoryBatchMode ? '' : 'is-hidden'}">
                        <button class="btn btn-secondary btn-xs" onclick="selectAllSystemQAHistory()">全选</button>
                        <button class="btn btn-danger btn-xs" onclick="deleteSelectedSystemQAConversations()">删除选中</button>
                    </div>
                    <div id="systemQAHistoryList" class="system-qa-history-list"></div>
                </div>
            </aside>

            <section class="system-qa-main">
                <div id="systemQAHelp" class="system-qa-help is-hidden">可按下方“回答依据”选择当前系统、已导入知识库或联网搜索。AI 只负责读取和分析，不会自动修改任何数据。知识库/Obsidian 指已经导入到系统资料库的内容，不会实时搜索未导入的 Obsidian 文件，也不会仅凭文件路径自动读取 Word、PDF 或网页正文。</div>
                <div id="aiConfigStatus" class="ai-config-status system-qa-status-hidden"><span class="ai-config-dot is-muted">● 加载中...</span></div>

                <div id="aiConversationArea" class="system-qa-conversation">
                    <div class="ai-chat-empty">输入问题后发送。生成后可以继续追问，比如“按班级分组”“展开第 3 个学生”“说得简单一点”。</div>
                </div>
                <div class="system-qa-input-area">
                    <textarea id="agentInput" class="system-qa-textarea" rows="1" placeholder="例如：哪些学生需要我这周重点关注？" oninput="autoResizeSystemQAInput(this)" onkeydown="handleSystemQAKeydown(event)"></textarea>
                    <div class="system-qa-toolbar">
                        <div class="system-qa-source-row">
                            <span>依据</span>
                            <label><input type="checkbox" id="sourceSystemData" onchange="toggleAISourceScope('systemData', this.checked)" ${aiSourceScope.systemData ? 'checked' : ''}> 系统</label>
                            <label title="搜索已导入资料库；Obsidian 新内容需先导入/刷新。"><input type="checkbox" id="sourceKnowledgeBase" onchange="toggleAISourceScope('knowledgeBase', this.checked)" ${aiSourceScope.knowledgeBase ? 'checked' : ''}> 资料库</label>
                            <label><input type="checkbox" id="sourceWebSearch" onchange="toggleAISourceScope('webSearch', this.checked)" ${aiSourceScope.webSearch ? 'checked' : ''}> 联网</label>
                            <label class="system-qa-model-label">模型
                                <select id="systemQAModelProvider" class="system-qa-model-select" onchange="setSystemQAModelProvider(this.value)">
                                    <option value="minimax" ${selectedSystemQAModelProvider === 'minimax' ? 'selected' : ''}>MiniMax</option>
                                    <option value="deepseek" ${selectedSystemQAModelProvider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                                </select>
                            </label>
                            <label class="system-qa-model-label">输出
                                <select id="systemQAAnswerLength" class="system-qa-model-select" onchange="setSystemQAAnswerLength(this.value)">
                                    <option value="brief" ${selectedSystemQAAnswerLength !== 'detailed' ? 'selected' : ''}>简洁</option>
                                    <option value="detailed" ${selectedSystemQAAnswerLength === 'detailed' ? 'selected' : ''}>详细</option>
                                </select>
                            </label>
                        </div>
                        <div class="system-qa-input-actions">
                            <button class="system-qa-mini-btn" onclick="toggleSystemQAHelp()" title="查看说明">说明</button>
                            <button class="system-qa-mini-btn" onclick="openSystemQAFullInput()" title="全屏输入">全屏</button>
                            <button class="system-qa-mini-btn" onclick="clearSystemQAInput()" title="清空输入">清空</button>
                            <button class="btn btn-primary btn-sm system-qa-send-btn" id="generateBtn" onclick="runAgentTask()">发送</button>
                        </div>
                    </div>
                </div>
                <div id="agentOutput" class="ai-output-content system-qa-hidden-output">暂无回答。</div>
                <div id="outputActions" class="system-qa-hidden"></div>
                <div id="taskRecordInfo" class="ai-task-record is-hidden"></div>
            </section>

            <aside class="system-qa-reference-panel">
                <div class="system-qa-reference-head">
                    <div>
                        <div class="system-qa-reference-title">引用依据</div>
                        <div class="system-qa-reference-subtitle">本次回答的来源</div>
                    </div>
                    <button class="system-qa-mini-btn" onclick="clearSystemQARefs()" title="清空当前依据">清空</button>
                </div>
                <div id="contextRefsArea" class="ai-context-refs-area system-qa-context-refs">
                    <div id="contextRefsContent" class="system-qa-reference-empty">发送问题后，这里会显示系统数据、资料库或联网引用。</div>
                </div>
            </aside>
        </div>
    `;

    renderSystemQAConversation();
    renderSystemQAHistory();
    renderSystemQAPrompts();
    loadSystemQAPrompts();
    loadSystemQAConversations();
    loadAIStatus();
}

function normalizeSystemQAPrompts(prompts) {
    const source = Array.isArray(prompts) && prompts.length ? prompts : DEFAULT_SYSTEM_QA_PROMPTS;
    return source
        .filter(item => item && String(item.text || '').trim())
        .map((item, index) => ({
            id: String(item.id || `qa_prompt_${Date.now()}_${index}`),
            text: String(item.text || '').trim(),
            category: String(item.category || '常用'),
            sortOrder: Number(item.sortOrder || (index + 1) * 10),
            isDefault: Boolean(item.isDefault),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || ''
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getSystemQAPrompts() {
    if (systemQAPromptsLoaded && systemQAPrompts.length) return systemQAPrompts;
    if (Array.isArray(data?.aiQuestionPrompts) && data.aiQuestionPrompts.length) return normalizeSystemQAPrompts(data.aiQuestionPrompts);
    return normalizeSystemQAPrompts(DEFAULT_SYSTEM_QA_PROMPTS);
}

function renderSystemQAPrompts() {
    const list = document.getElementById('systemQAPromptList');
    if (!list) return;
    const prompts = getSystemQAPrompts();
    const groups = prompts.reduce((map, prompt) => {
        const key = prompt.category || '常用';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(prompt);
        return map;
    }, new Map());
    list.innerHTML = [...groups.entries()].map(([category, items]) => `
        <div class="system-qa-prompt-group">
            <div class="system-qa-prompt-category">${escapeHtml(category)}</div>
            ${items.map(prompt => `
                <div class="system-qa-prompt-item ${systemQAPromptManageMode ? 'manage' : ''}">
                    <button class="system-qa-chip" data-question="${escapeHtml(prompt.text)}" onclick="fillSystemQAQuestion(this.dataset.question)">${escapeHtml(prompt.text)}</button>
                    <div class="system-qa-prompt-tools ${systemQAPromptManageMode ? '' : 'is-hidden'}">
                        <button class="system-qa-icon-btn" title="编辑" onclick="editSystemQAPrompt('${escapeHtml(prompt.id)}')">改</button>
                        <button class="system-qa-icon-btn danger" title="删除" onclick="deleteSystemQAPrompt('${escapeHtml(prompt.id)}')">删</button>
                    </div>
                </div>
            `).join('')}
            </div>
    `).join('');
}

async function loadSystemQAPrompts() {
    try {
        const response = await fetch('/api/aiQuestionPrompts', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`读取问句失败：${response.status}`);
        const payload = await response.json();
        systemQAPrompts = normalizeSystemQAPrompts(payload.aiQuestionPrompts);
        systemQAPromptsLoaded = true;
        if (data) data.aiQuestionPrompts = systemQAPrompts;
        renderSystemQAPrompts();
    } catch (error) {
        console.warn('读取 AI 问句失败，使用默认问句:', error);
        systemQAPrompts = getSystemQAPrompts();
        renderSystemQAPrompts();
    }
}

async function saveSystemQAPrompts(nextPrompts) {
    systemQAPrompts = normalizeSystemQAPrompts(nextPrompts);
    if (data) data.aiQuestionPrompts = systemQAPrompts;
    renderSystemQAPrompts();
    try {
        await saveCollectionToApi('aiQuestionPrompts', systemQAPrompts);
        showToast('问句已同步');
    } catch (error) {
        console.error('保存 AI 问句失败:', error);
        showToast('问句保存失败，请刷新后重试');
    }
}

function addSystemQAPrompt() {
    const text = window.prompt('新增问句：', '');
    if (!text || !text.trim()) return;
    const prompts = getSystemQAPrompts();
    const maxOrder = prompts.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
    saveSystemQAPrompts([
        ...prompts,
        {
            id: `qa_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.trim(),
            category: '自定义',
            sortOrder: maxOrder + 10,
            isDefault: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ]);
}

function editSystemQAPrompt(id) {
    const prompts = getSystemQAPrompts();
    const current = prompts.find(item => String(item.id) === String(id));
    if (!current) return;
    const text = window.prompt('编辑问句：', current.text);
    if (!text || !text.trim()) return;
    saveSystemQAPrompts(prompts.map(item => String(item.id) === String(id)
        ? { ...item, text: text.trim(), updatedAt: new Date().toISOString() }
        : item
    ));
}

function deleteSystemQAPrompt(id) {
    const prompts = getSystemQAPrompts();
    const current = prompts.find(item => String(item.id) === String(id));
    if (!current) return;
    if (!confirm(`删除这个问句吗？\n\n${current.text}`)) return;
    saveSystemQAPrompts(prompts.filter(item => String(item.id) !== String(id)));
}

function restoreDefaultSystemQAPrompts() {
    if (!confirm('恢复默认问句会覆盖当前自定义问句，确定恢复吗？')) return;
    saveSystemQAPrompts(DEFAULT_SYSTEM_QA_PROMPTS.map(item => ({ ...item, updatedAt: new Date().toISOString() })));
}

function toggleSystemQAPromptManageMode() {
    systemQAPromptManageMode = !systemQAPromptManageMode;
    renderAIWorkspace();
}

function normalizeSystemQAConversations(conversations) {
    return (Array.isArray(conversations) ? conversations : [])
        .filter(item => item && String(item.id || '').trim())
        .map(item => ({
            id: String(item.id),
            title: String(item.title || '新对话'),
            messages: Array.isArray(item.messages) ? item.messages.filter(message => message && message.role && message.content).map(normalizeSystemQAMessage) : [],
            pinned: Boolean(item.pinned),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
        }))
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return String(b.updatedAt).localeCompare(String(a.updatedAt));
        });
}

function normalizeSystemQAMessage(message = {}) {
    return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: String(message.content || ''),
        createdAt: message.createdAt || new Date().toISOString(),
        meta: message.meta && typeof message.meta === 'object' ? message.meta : null
    };
}

function hydrateSystemQAConversationsFromData() {
    if (systemQAConversationsLoaded) return;
    const draft = (() => {
        try { return JSON.parse(localStorage.getItem('aiConversationsDraft') || '[]'); } catch { return []; }
    })();
    systemQAConversations = normalizeSystemQAConversations(data?.aiConversations?.length ? data.aiConversations : draft);
    systemQAConversationsLoaded = true;
}

async function loadSystemQAConversations() {
    try {
        const response = await fetch('/api/aiConversations', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`读取聊天记录失败：${response.status}`);
        const payload = await response.json();
        const loaded = normalizeSystemQAConversations(payload.aiConversations || []);
        systemQAConversationsLoaded = true;
        if (loaded.length) {
            systemQAConversations = loaded;
            if (!currentSystemQAConversationId || !systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
                currentSystemQAConversationId = systemQAConversations[0].id;
            }
            const current = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
            aiConversationMessages = current?.messages || [];
            if (data) data.aiConversations = systemQAConversations;
            renderSystemQAConversation();
            renderSystemQAHistory();
        }
    } catch (error) {
        console.warn('读取 AI 聊天记录失败，使用当前会话:', error);
    }
}

async function saveSystemQAConversations() {
    const normalized = normalizeSystemQAConversations(systemQAConversations);
    systemQAConversations = normalized;
    if (data) data.aiConversations = normalized;
    systemQAConversationSaveQueue = systemQAConversationSaveQueue
        .catch(() => {})
        .then(() => saveCollectionToApi('aiConversations', normalizeSystemQAConversations(systemQAConversations)))
        .catch(error => {
        console.error('保存 AI 聊天记录失败:', error);
        localStorage.setItem('aiConversationsDraft', JSON.stringify(normalized));
        showToast('聊天记录同步失败，已临时保存在本机');
        });
    return systemQAConversationSaveQueue;
}

function ensureSystemQAConversation() {
    if (currentSystemQAConversationId && systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
        const current = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
        aiConversationMessages = current.messages;
        return current;
    }
    const conversation = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    systemQAConversations.unshift(conversation);
    currentSystemQAConversationId = conversation.id;
    aiConversationMessages = conversation.messages;
    return conversation;
}

function syncCurrentSystemQAConversation() {
    const conversation = systemQAConversations.find(item => item.id === currentSystemQAConversationId);
    if (!conversation) return;
    conversation.messages = aiConversationMessages;
    conversation.updatedAt = new Date().toISOString();
    const firstUser = aiConversationMessages.find(item => item.role === 'user');
    conversation.title = firstUser ? firstUser.content.replace(/\s+/g, ' ').slice(0, 20) : '新对话';
}

function renderSystemQAHistory() {
    const list = document.getElementById('systemQAHistoryList');
    if (!list) return;
    const conversations = normalizeSystemQAConversations(systemQAConversations);
    if (!conversations.length) {
        list.innerHTML = '<div class="system-qa-empty-mini">暂无聊天记录</div>';
        return;
    }
    list.innerHTML = conversations.map(item => `
        <div class="system-qa-history-row ${item.id === currentSystemQAConversationId ? 'active' : ''} ${systemQAHistoryBatchMode ? 'batch' : ''}">
            ${systemQAHistoryBatchMode ? `<label class="system-qa-history-check"><input type="checkbox" ${selectedSystemQAConversationIds.has(item.id) ? 'checked' : ''} onchange="toggleSystemQAHistorySelection('${item.id}', this.checked)"></label>` : ''}
            <button class="system-qa-history-item" onclick="${systemQAHistoryBatchMode ? `toggleSystemQAHistorySelection('${item.id}')` : `switchSystemQAConversation('${item.id}')`}">
                <span>${item.pinned ? '置顶 · ' : ''}${escapeHtml(item.title || '新对话')}</span>
                <small>${new Date(item.updatedAt || item.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
            </button>
            <div class="system-qa-history-tools ${systemQAHistoryBatchMode ? 'is-hidden' : ''}">
                <div class="system-qa-history-menu-wrap">
                    <button class="system-qa-history-more" title="更多操作" onclick="toggleSystemQAHistoryMenu('${item.id}', event)">⋯</button>
                    ${openSystemQAHistoryMenuId === item.id ? `
                        <div class="system-qa-history-menu" onclick="event.stopPropagation()">
                            <button onclick="pinSystemQAConversationFromMenu('${item.id}')">${item.pinned ? '取消置顶' : '置顶'}</button>
                            <button class="danger" onclick="deleteSystemQAConversationFromMenu('${item.id}')">删除</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function toggleSystemQAHistoryBatchMode() {
    systemQAHistoryBatchMode = !systemQAHistoryBatchMode;
    openSystemQAHistoryMenuId = '';
    if (!systemQAHistoryBatchMode) selectedSystemQAConversationIds.clear();
    const bar = document.getElementById('systemQAHistoryBatchBar');
    if (bar) bar.classList.toggle('is-hidden', !systemQAHistoryBatchMode);
    const btn = document.getElementById('systemQAHistoryBatchToggle');
    if (btn) btn.textContent = systemQAHistoryBatchMode ? '完成' : '批量';
    renderSystemQAHistory();
}

function toggleSystemQAHistorySelection(id, checked) {
    const nextChecked = typeof checked === 'boolean' ? checked : !selectedSystemQAConversationIds.has(id);
    if (nextChecked) selectedSystemQAConversationIds.add(id);
    else selectedSystemQAConversationIds.delete(id);
    renderSystemQAHistory();
}

function selectAllSystemQAHistory() {
    normalizeSystemQAConversations(systemQAConversations).forEach(item => selectedSystemQAConversationIds.add(item.id));
    renderSystemQAHistory();
}

function deleteSelectedSystemQAConversations() {
    const ids = new Set([...selectedSystemQAConversationIds]);
    if (!ids.size) {
        showToast('请先选择聊天记录');
        return;
    }
    if (!confirm(`删除选中的 ${ids.size} 条聊天记录吗？`)) return;
    systemQAConversations = systemQAConversations.filter(item => !ids.has(item.id));
    selectedSystemQAConversationIds.clear();
    if (!systemQAConversations.length) {
        currentSystemQAConversationId = '';
        ensureSystemQAConversation();
    } else if (!systemQAConversations.some(item => item.id === currentSystemQAConversationId)) {
        currentSystemQAConversationId = systemQAConversations[0].id;
    }
    aiConversationMessages = systemQAConversations.find(item => item.id === currentSystemQAConversationId)?.messages || [];
    syncCurrentSystemQAConversation();
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
    showToast('已删除选中的聊天记录');
}

function switchSystemQAConversation(id) {
    const conversation = systemQAConversations.find(item => item.id === id);
    if (!conversation) return;
    openSystemQAHistoryMenuId = '';
    currentSystemQAConversationId = id;
    aiConversationMessages = conversation.messages || [];
    renderSystemQAConversation();
    renderSystemQAHistory();
    const output = document.getElementById('agentOutput');
    const lastAnswer = [...aiConversationMessages].reverse().find(item => item.role === 'assistant');
    if (output) output.innerHTML = lastAnswer ? renderMarkdown(lastAnswer.content || '') : '暂无回答。';
}

function toggleSystemQAConversationPin(id) {
    const conversation = systemQAConversations.find(item => String(item.id) === String(id));
    if (!conversation) return;
    conversation.pinned = !conversation.pinned;
    conversation.updatedAt = new Date().toISOString();
    renderSystemQAHistory();
    saveSystemQAConversations();
}

function toggleSystemQAHistoryMenu(id, event) {
    if (event) event.stopPropagation();
    openSystemQAHistoryMenuId = openSystemQAHistoryMenuId === id ? '' : id;
    renderSystemQAHistory();
}

function pinSystemQAConversationFromMenu(id) {
    openSystemQAHistoryMenuId = '';
    toggleSystemQAConversationPin(id);
}

function deleteSystemQAConversationFromMenu(id) {
    openSystemQAHistoryMenuId = '';
    deleteSystemQAConversation(id);
}

function setSystemQAModelProvider(provider) {
    selectedSystemQAModelProvider = provider === 'deepseek' ? 'deepseek' : 'minimax';
    localStorage.setItem('systemQAModelProvider', selectedSystemQAModelProvider);
    renderSystemQAModelProviderSelect();
}

function setSystemQAAnswerLength(value) {
    selectedSystemQAAnswerLength = value === 'detailed' ? 'detailed' : 'brief';
    localStorage.setItem('systemQAAnswerLength', selectedSystemQAAnswerLength);
}

function renderSystemQAModelProviderSelect() {
    const select = document.getElementById('systemQAModelProvider');
    if (!select) return;
    select.value = selectedSystemQAModelProvider;
    const providerStatus = systemQAAIStatus?.providers?.find(item => item.provider === selectedSystemQAModelProvider);
    if (providerStatus) {
        select.title = providerStatus.enabled ? `${providerStatus.label || selectedSystemQAModelProvider} 已配置：${providerStatus.model || ''}` : `${providerStatus.label || selectedSystemQAModelProvider} 未配置或不可用`;
    }
}

function deleteSystemQAConversation(id) {
    const conversation = systemQAConversations.find(item => String(item.id) === String(id));
    if (!conversation) return;
    if (!confirm(`删除这条聊天记录吗？\n\n${conversation.title || '新对话'}`)) return;
    systemQAConversations = systemQAConversations.filter(item => String(item.id) !== String(id));
    if (currentSystemQAConversationId === id) {
        currentSystemQAConversationId = systemQAConversations[0]?.id || '';
        aiConversationMessages = systemQAConversations[0]?.messages || [];
        if (!currentSystemQAConversationId) ensureSystemQAConversation();
    }
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
}

function renderSystemQAConversation() {
    const area = document.getElementById('aiConversationArea');
    if (!area) return;
    if (!aiConversationMessages.length) {
        area.innerHTML = '<div class="ai-chat-empty">输入问题后发送。生成后可以继续追问，比如“按班级分组”“展开第 3 个学生”“说得简单一点”。</div>';
        return;
    }
    area.innerHTML = aiConversationMessages.slice(-12).map(message => `
        <div class="ai-chat-message ${message.role === 'user' ? 'user' : 'assistant'}">
            <div class="ai-chat-role">${message.role === 'user' ? '我' : 'AI'}</div>
            <div class="ai-chat-bubble">
                ${renderMarkdown(getSystemQAVisibleContent(message))}
                ${message.role === 'assistant' ? renderSystemQAMessageMeta(message) : ''}
            </div>
        </div>
    `).join('');
    area.scrollTop = area.scrollHeight;
}

function getSystemQAVisibleContent(message = {}) {
    const content = String(message.content || '');
    if (
        message.role === 'assistant'
        && (
            content.includes('renderAIRunStatus is not defined')
            || content.includes('updateTaskRecordInfo is not defined')
        )
    ) {
        return '这条历史回答生成时前端显示出错，当前问题已修复。请重新发送上一条问题获取新回答。';
    }
    return content;
}

function renderSystemQAMessageMeta(message = {}) {
    const meta = message.meta || {};
    const modeLabel = getSystemQAModeLabel(meta.mode);
    const sourceLabel = getSystemQASourceLabel(meta.sourceScope);
    const providerLabel = getSystemQAProviderLabel(meta.provider);
    const generatedAt = meta.generatedAt || message.createdAt || '';
    const timeLabel = generatedAt ? new Date(generatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const factsLabel = Array.isArray(meta.queryFactKeys) && meta.queryFactKeys.length ? `精确查询 ${meta.queryFactKeys.length} 项` : '';
    const refsLabel = Number(meta.contextRefsCount || 0) > 0 ? `引用 ${meta.contextRefsCount} 条` : '';
    const isHistorical = generatedAt && (Date.now() - new Date(generatedAt).getTime()) > 12 * 60 * 60 * 1000;
    const parts = [modeLabel, providerLabel, sourceLabel, factsLabel, refsLabel, timeLabel].filter(Boolean);
    if (!parts.length) return '';
    return `
        <div class="system-qa-answer-meta">
            <span>${parts.map(escapeHtml).join(' · ')}</span>
            ${isHistorical ? '<strong>历史回答，可能不是当前数据</strong>' : ''}
        </div>
    `;
}

function renderAIRunStatus(response = {}) {
    const meta = {
        mode: response.mode || '',
        provider: response.provider || selectedSystemQAModelProvider,
        answerLength: response.answerLength || selectedSystemQAAnswerLength,
        sourceScope: response.sourceScope || { ...aiSourceScope },
        queryFactKeys: response.queryFactKeys || [],
        contextRefsCount: Array.isArray(response.contextRefs) ? response.contextRefs.length : 0,
        contextSize: response.contextSize || 0,
        elapsedMs: response.elapsedMs || 0,
        generatedAt: response.generatedAt || new Date().toISOString()
    };
    const modeLabel = getSystemQAModeLabel(meta.mode);
    const providerLabel = getSystemQAProviderLabel(meta.provider);
    const sourceLabel = getSystemQASourceLabel(meta.sourceScope);
    const factsLabel = Array.isArray(meta.queryFactKeys) && meta.queryFactKeys.length ? `精确查询 ${meta.queryFactKeys.length} 项` : '';
    const refsLabel = Number(meta.contextRefsCount || 0) > 0 ? `引用 ${meta.contextRefsCount} 条` : '';
    const parts = [modeLabel, providerLabel, sourceLabel, factsLabel, refsLabel].filter(Boolean);
    if (!parts.length) return '';
    return `<div class="system-qa-run-status">${parts.map(escapeHtml).join(' · ')}</div>`;
}

function updateTaskRecordInfo() {
    const taskInfo = document.getElementById('taskRecordInfo');
    if (!taskInfo) return;
    const parts = [
        lastTaskId ? `任务 ${lastTaskId}` : '',
        getSystemQAModeLabel(lastTaskMode),
        getSystemQAProviderLabel(lastTaskProvider)
    ].filter(Boolean);
    if (!parts.length) {
        taskInfo.classList.add('is-hidden');
        taskInfo.textContent = '';
        return;
    }
    taskInfo.textContent = parts.join(' · ');
    taskInfo.classList.remove('is-hidden');
}

function getSystemQAModeLabel(mode) {
    if (mode === 'system-facts') return '系统事实';
    if (mode === 'system-safe') return '安全提示';
    if (mode === 'real-ai') return '真实 AI';
    if (mode === 'local-template') return '本地模板';
    if (mode === 'failed') return '查询失败';
    return mode ? String(mode) : '';
}

function getSystemQAProviderLabel(provider) {
    if (!provider) return '';
    if (provider === 'minimax') return 'MiniMax';
    if (provider === 'deepseek') return 'DeepSeek';
    if (provider === 'qwen') return 'Qwen';
    return String(provider);
}

function getSystemQASourceLabel(scope = {}) {
    const labels = [];
    if (scope.systemData) labels.push('系统');
    if (scope.knowledgeBase) labels.push('资料库');
    if (scope.webSearch) labels.push('联网');
    return labels.length ? `依据：${labels.join('/')}` : '';
}

function getSystemQAHistoryText() {
    if (!aiConversationMessages.length) return '';
    return '最近对话上下文：\n' + aiConversationMessages.slice(-8).map(message => {
        const role = message.role === 'user' ? '用户' : 'AI';
        return `${role}：${message.content}`;
    }).join('\n\n');
}

function getSystemQAConversationHistory() {
    return aiConversationMessages
        .slice(-8)
        .map(message => ({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: String(message.content || '').slice(0, 800)
        }));
}

function fillSystemQAQuestion(text) {
    const input = document.getElementById('agentInput');
    if (!input) return;
    input.value = text;
    autoResizeSystemQAInput(input);
    input.focus();
}

function openBusinessReviewFromDashboard() {
    const reviewQuestion = '帮我生成本周经营复盘，重点看课消、欠费、待续费、意向跟进和需要关注的学生。';
    switchTab('ai-workspace');
    setTimeout(() => {
        if (!document.getElementById('agentInput')) renderAIWorkspace();
        startSystemQAConversation();
        setSystemQAAnswerLength('detailed');
        const lengthSelect = document.getElementById('systemQAAnswerLength');
        if (lengthSelect) lengthSelect.value = 'detailed';
        fillSystemQAQuestion(reviewQuestion);
        runAgentTask();
    }, 80);
}

function toggleSystemQANameMode() {
    const checked = document.getElementById('systemQANameToggle')?.checked;
    aiPrivacyMode = checked ? 'named' : 'masked';
}

function startSystemQAConversation() {
    const conversation = {
        id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    systemQAConversations.unshift(conversation);
    currentSystemQAConversationId = conversation.id;
    aiConversationMessages = conversation.messages;
    renderSystemQAConversation();
    renderSystemQAHistory();
    const output = document.getElementById('agentOutput');
    if (output) output.innerHTML = '暂无回答。';
    const taskInfo = document.getElementById('taskRecordInfo');
    if (taskInfo) taskInfo.classList.add('is-hidden');
    saveSystemQAConversations();
    showToast('已开始新对话');
}

function refreshSystemQAData() {
    loadAIStatus();
    showToast('已刷新 AI 状态；下次提问会读取最新系统数据');
}

function showSystemQACapabilities() {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = 'AI 对话现在能查什么';
    bodyEl.innerHTML = `
        <div class="system-qa-capability-modal">
            <div class="system-qa-capability-note">AI 对话第一优先级是查准系统数据。命中下列问题时，会直接用后端计算出的事实回答，不让模型自由猜。</div>
            <div class="system-qa-capability-grid">
                <div><strong>学员</strong><span>人数、名单、年级、状态、学校、班级、课时、欠费、首次上课年级</span></div>
                <div><strong>成绩</strong><span>满分、100 分、不及格、高于/低于某分、某学生成绩、按测试名称筛选</span></div>
                <div><strong>班级</strong><span>班级数量、班级成员、上课时间、课次进度、按班级分组</span></div>
                <div><strong>收费</strong><span>欠费、待收款、补缴费用、课时不足、无收费记录风险</span></div>
                <div><strong>考勤/课消</strong><span>本月、上月、指定月份课消，个人出勤/请假统计</span></div>
                <div><strong>资料库</strong><span>已导入资料摘要和原文。未导入 Obsidian 文件、只有路径的资料不会被当作正文。</span></div>
            </div>
            <div class="system-qa-capability-note">不能做的事：AI 对话不会直接新增、修改、删除、发送任何业务数据；联网失败或资料不足时会提示，不应凭空整理。</div>
            <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">关闭</button></div>
        </div>
    `;
    modal.classList.add('show');
}

function clearSystemQAInput() {
    const input = document.getElementById('agentInput');
    if (input) {
        input.value = '';
        autoResizeSystemQAInput(input);
    }
}

function handleSystemQAKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        runAgentTask();
    }
}

function autoResizeSystemQAInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, 160);
    input.style.height = `${Math.max(nextHeight, 42)}px`;
    input.style.overflowY = input.scrollHeight > 160 ? 'auto' : 'hidden';
}

function toggleSystemQAHelp() {
    const help = document.getElementById('systemQAHelp');
    if (!help) return;
    help.classList.toggle('is-hidden');
}

function openSystemQAFullInput() {
    const input = document.getElementById('agentInput');
    const currentValue = input?.value || '';
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = '全屏输入';
    bodyEl.innerHTML = `
        <div class="system-qa-full-input-modal">
            <textarea id="systemQAFullInput" class="system-qa-full-textarea" placeholder="可以在这里粘贴长问题、复杂需求或多行内容。Enter 换行，Cmd/Ctrl + Enter 发送。" onkeydown="handleSystemQAFullInputKeydown(event)">${escapeHtml(currentValue)}</textarea>
            <div class="system-qa-full-tip">全屏输入里 Enter 默认换行；需要发送时点击“发送给 AI”，或按 Cmd/Ctrl + Enter。</div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button type="button" class="btn btn-secondary" onclick="clearSystemQAFullInput()">清空</button>
                <button type="button" class="btn btn-primary" onclick="sendSystemQAFullInput()">发送给 AI</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
    setTimeout(() => document.getElementById('systemQAFullInput')?.focus(), 30);
}

function clearSystemQAFullInput() {
    const input = document.getElementById('systemQAFullInput');
    if (input) input.value = '';
}

function sendSystemQAFullInput() {
    const fullInput = document.getElementById('systemQAFullInput');
    const mainInput = document.getElementById('agentInput');
    const value = fullInput?.value.trim() || '';
    if (!value) {
        showToast('请输入想问的问题');
        return;
    }
    if (mainInput) {
        mainInput.value = value;
        autoResizeSystemQAInput(mainInput);
    }
    closeModal();
    runAgentTask();
}

function handleSystemQAFullInputKeydown(event) {
    if (event.isComposing || event.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        sendSystemQAFullInput();
    }
}

function toggleAISourceScope(key, checked) {
    aiSourceScope = {
        ...aiSourceScope,
        [key]: Boolean(checked)
    };
    if (!aiSourceScope.systemData && !aiSourceScope.knowledgeBase && !aiSourceScope.webSearch) {
        aiSourceScope.systemData = true;
        const systemInput = document.getElementById('sourceSystemData');
        if (systemInput) systemInput.checked = true;
        showToast('至少保留一个回答依据');
    }
}

function runAgentTask() {
    const inputEl = document.getElementById('agentInput');
    const output = document.getElementById('agentOutput');
    const btn = document.getElementById('generateBtn');
    const question = inputEl?.value.trim() || '';
    if (!question) {
        showToast('请输入想问的问题');
        return;
    }

    currentAgentId = 'system-agent';
    currentTaskType = 'system-qa';
    currentTaskLabel = '系统数据问答';
    const conversationHistory = getSystemQAConversationHistory();
    aiConversationMessages.push({ role: 'user', content: question, createdAt: new Date().toISOString() });
    syncCurrentSystemQAConversation();
    renderSystemQAConversation();
    renderSystemQAHistory();
    saveSystemQAConversations();
    if (inputEl) inputEl.value = '';
    if (inputEl) autoResizeSystemQAInput(inputEl);
    if (btn) { btn.disabled = true; btn.textContent = '查询中...'; }
    if (output) output.innerHTML = '<div class="ai-output-placeholder">正在读取系统数据并回答...</div>';

    fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agent: 'system-agent',
            task: 'system-qa',
            modelProvider: selectedSystemQAModelProvider,
            answerLength: selectedSystemQAAnswerLength,
            privacyMode: aiPrivacyMode,
            sourceScope: aiSourceScope,
            latestQuestion: question,
            conversationHistory,
            userInstruction: question,
            fallbackOnError: true
        })
    })
    .then(async res => {
        const parsed = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parsed.error || parsed.message || 'AI 请求失败');
        return parsed;
    })
    .then(response => {
        const answer = response.result || '';
        aiConversationMessages.push({
            role: 'assistant',
            content: answer,
            createdAt: response.generatedAt || new Date().toISOString(),
            meta: {
                taskId: response.taskId || '',
                mode: response.mode || '',
                provider: response.provider || selectedSystemQAModelProvider,
                answerLength: response.answerLength || selectedSystemQAAnswerLength,
                sourceScope: response.sourceScope || { ...aiSourceScope },
                queryFactKeys: response.queryFactKeys || [],
                contextRefsCount: Array.isArray(response.contextRefs) ? response.contextRefs.length : 0,
                contextSize: response.contextSize || 0,
                elapsedMs: response.elapsedMs || 0,
                generatedAt: response.generatedAt || new Date().toISOString()
            }
        });
        aiConversationMessages = aiConversationMessages.slice(-20);
        syncCurrentSystemQAConversation();
        renderSystemQAConversation();
        renderSystemQAHistory();
        saveSystemQAConversations();
        lastTaskId = response.taskId || '';
        lastTaskMode = response.mode || '';
        lastTaskProvider = response.provider || '';
        if (output) output.innerHTML = `${renderAIRunStatus(response)}<div class="ai-output-text">${renderMarkdown(answer)}</div>`;
        renderContextRefs(response.contextRefs || [], response.mode);
        updateTaskRecordInfo();
        showToast('已根据当前系统数据回答');
    })
    .catch(error => {
        const message = error.message || '查询失败';
        aiConversationMessages.push({
            role: 'assistant',
            content: `查询失败：${message}`,
            createdAt: new Date().toISOString(),
            meta: {
                mode: 'failed',
                provider: selectedSystemQAModelProvider,
                answerLength: selectedSystemQAAnswerLength,
                sourceScope: { ...aiSourceScope },
                generatedAt: new Date().toISOString()
            }
        });
        syncCurrentSystemQAConversation();
        renderSystemQAConversation();
        renderSystemQAHistory();
        saveSystemQAConversations();
        if (output) output.innerHTML = `<div class="ai-output-placeholder">查询失败：${escapeHtml(message)}</div>`;
        showToast('AI 查询失败');
    })
    .finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = '发送'; }
    });
}

function copyAgentOutput() {
    const latestAnswer = [...aiConversationMessages].reverse().find(item => item.role === 'assistant' && item.content);
    if (latestAnswer?.content) {
        navigator.clipboard.writeText(latestAnswer.content).then(() => showToast('已复制最新回答')).catch(() => showToast('复制失败'));
        return;
    }
    const output = document.getElementById('agentOutput');
    const text = output?.innerText || '';
    if (!text || text.includes('暂无回答')) {
        showToast('暂无可复制内容');
        return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== 外部跳转 ==========
let currentRelatedType = '';
let currentRelatedId = '';

function jumpToAIAgent(agentId, taskType, relatedType, relatedId) {
    switchTab('ai-workspace');
    setTimeout(() => {
        if (relatedType) currentRelatedType = relatedType;
        if (relatedId) currentRelatedId = relatedId;
        const question = buildAIJumpQuestion(agentId, taskType, relatedType, relatedId);
        if (question && typeof fillSystemQAQuestion === 'function') fillSystemQAQuestion(question);
        if (typeof setSystemQAAnswerLength === 'function') setSystemQAAnswerLength('detailed');
        const lengthSelect = document.getElementById('systemQAAnswerLength');
        if (lengthSelect) lengthSelect.value = 'detailed';
        document.getElementById('agentInput')?.focus();
    }, 50);
}

function buildAIJumpQuestion(agentId, taskType, relatedType, relatedId) {
    if (relatedType === 'prospect') {
        const prospect = (data.prospects || []).find(p => p.id === relatedId);
        if (prospect) {
            return `请根据系统里意向学员${prospect.name || ''}的年级、来源、目前成绩、试课状态、成交状态和备注，生成一段微信跟进话术。要求自然、简洁、有下一步动作。`;
        }
    }
    if (relatedType === 'student') {
        const student = (data.students || []).find(s => s.id === relatedId);
        if (student) {
            return `请根据系统里${student.name || ''}的课时、收费、考勤、成绩和沟通记录，给我一个简洁的跟进建议。`;
        }
    }
    if (taskType === 'follow-reminder' || agentId === 'recruit-agent') {
        return '请根据系统里的意向学员数据，帮我列出最需要跟进的对象和建议话术。';
    }
    if (agentId === 'biz-agent') {
        return '请根据当前系统数据，生成本周经营复盘，重点看课消、欠费、待续费、意向跟进和需要关注的学生。';
    }
    return '请根据当前系统数据，帮我分析下一步最需要处理的事项。';
}

function updateRelatedHint() {
    const hintEl = document.getElementById('relatedObjectHint');
    if (!hintEl) return;
    if (!currentRelatedType || !currentRelatedId) {
        hintEl.classList.add('is-hidden');
        return;
    }
    const typeLabel = currentRelatedType === 'student' ? '学员' : currentRelatedType === 'prospect' ? '意向学员' : currentRelatedType;
    hintEl.innerHTML = `<span class="system-qa-related-hint">📌 已关联: ${escapeHtml(typeLabel)} (ID: ${escapeHtml(currentRelatedId)})</span>`;
    hintEl.classList.remove('is-hidden');
}

function clearRelatedHint() {
    currentRelatedType = '';
    currentRelatedId = '';
    const hintEl = document.getElementById('relatedObjectHint');
    if (hintEl) hintEl.classList.add('is-hidden');
}

window.jumpToAIAgent = jumpToAIAgent;
window.runAgentTask = runAgentTask;
window.copyAgentOutput = copyAgentOutput;
window.fillSystemQAQuestion = fillSystemQAQuestion;
window.openBusinessReviewFromDashboard = openBusinessReviewFromDashboard;
window.startSystemQAConversation = startSystemQAConversation;
window.refreshSystemQAData = refreshSystemQAData;
window.clearSystemQAInput = clearSystemQAInput;
window.toggleSystemQANameMode = toggleSystemQANameMode;
window.handleSystemQAKeydown = handleSystemQAKeydown;
window.switchSystemQAConversation = switchSystemQAConversation;
window.autoResizeSystemQAInput = autoResizeSystemQAInput;
window.toggleSystemQAHelp = toggleSystemQAHelp;
window.openSystemQAFullInput = openSystemQAFullInput;
window.clearSystemQAFullInput = clearSystemQAFullInput;
window.sendSystemQAFullInput = sendSystemQAFullInput;
window.handleSystemQAFullInputKeydown = handleSystemQAFullInputKeydown;
window.addSystemQAPrompt = addSystemQAPrompt;
window.editSystemQAPrompt = editSystemQAPrompt;
window.deleteSystemQAPrompt = deleteSystemQAPrompt;
window.restoreDefaultSystemQAPrompts = restoreDefaultSystemQAPrompts;
window.toggleSystemQAPromptManageMode = toggleSystemQAPromptManageMode;
window.toggleSystemQAConversationPin = toggleSystemQAConversationPin;
window.deleteSystemQAConversation = deleteSystemQAConversation;
window.toggleSystemQAHistoryMenu = toggleSystemQAHistoryMenu;
window.pinSystemQAConversationFromMenu = pinSystemQAConversationFromMenu;
window.deleteSystemQAConversationFromMenu = deleteSystemQAConversationFromMenu;
window.toggleSystemQAHistoryBatchMode = toggleSystemQAHistoryBatchMode;
window.toggleSystemQAHistorySelection = toggleSystemQAHistorySelection;
window.selectAllSystemQAHistory = selectAllSystemQAHistory;
window.deleteSelectedSystemQAConversations = deleteSelectedSystemQAConversations;
window.toggleAISourceScope = toggleAISourceScope;
window.setSystemQAModelProvider = setSystemQAModelProvider;
window.setSystemQAAnswerLength = setSystemQAAnswerLength;
window.renderAIRunStatus = renderAIRunStatus;

if (!window.__systemQAHistoryMenuClickBound) {
    window.__systemQAHistoryMenuClickBound = true;
    document.addEventListener('click', event => {
        if (!openSystemQAHistoryMenuId) return;
        if (event.target.closest?.('.system-qa-history-menu-wrap')) return;
        openSystemQAHistoryMenuId = '';
        renderSystemQAHistory();
    });
}
