// ==================== 知识库管理 Stage 7C ====================

let knowledgeActiveTab = 'style';
let knowledgeSummary = null;

// ========== 渲染知识库 ==========
function renderKnowledge() {
    const container = document.getElementById('tab-knowledge');
    if (!container) return;

    container.innerHTML = `
        <div class="knowledge-layout">
            <div class="card knowledge-header">
                <h3 style="margin:0 0 8px 0;font-size:16px;">📚 知识库管理</h3>
                <p style="margin:0;font-size:12px;color:var(--text-muted);">风格库 · 资料库 · 题库。后续 AI 会读取风格库、资料库、题库摘要进行生成。当前先完成资料录入和管理。</p>
            </div>

            <div class="card knowledge-stats" id="knowledgeStats">
                <div class="knowledge-stat-grid">
                    <div class="knowledge-stat-item">
                        <div class="knowledge-stat-num" id="statKnowledgeCount">-</div>
                        <div class="knowledge-stat-label">资料来源</div>
                    </div>
                    <div class="knowledge-stat-item">
                        <div class="knowledge-stat-num" id="statStyleCount">-</div>
                        <div class="knowledge-stat-label">风格配置</div>
                    </div>
                    <div class="knowledge-stat-item">
                        <div class="knowledge-stat-num" id="statSampleCount">-</div>
                        <div class="knowledge-stat-label">风格样本</div>
                    </div>
                    <div class="knowledge-stat-item">
                        <div class="knowledge-stat-num" id="statQuestionCount">-</div>
                        <div class="knowledge-stat-label">题目数</div>
                    </div>
                </div>
            </div>

            <div class="card" id="knowledgeEmptyHint" style="display:none;padding:16px;text-align:center;">
                <div style="font-size:28px;margin-bottom:8px;">📭</div>
                <div style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;">知识库还没有录入内容</div>
                <div style="font-size:12px;color:var(--text-muted);">AI 目前只能使用临时输入和业务数据。<br>请到下方各标签页录入风格样本、资料或题目。</div>
            </div>

            <div class="card knowledge-tabs-card">
                <div class="knowledge-sub-tabs">
                    <button class="knowledge-sub-tab active" data-ktab="style" onclick="switchKnowledgeTab('style')">🎨 风格库</button>
                    <button class="knowledge-sub-tab" data-ktab="source" onclick="switchKnowledgeTab('source')">📄 资料库</button>
                    <button class="knowledge-sub-tab" data-ktab="question" onclick="switchKnowledgeTab('question')">📝 题库</button>
                </div>
            </div>

            <!-- 风格库 Tab -->
            <div id="ktabStyle" class="knowledge-subtab-content">
                <div class="card" style="padding:10px 12px;background:#fffbe6;border-radius:8px;margin-bottom:8px;">
                    <div style="font-size:11px;color:#856404;">💡 录入提示：可从 Obsidian 的"AI教培工作台/风格库/白老师风格规则.md"复制规则，或从"内容样本.md"复制样本内容。</div>
                </div>
                <div class="card">
                    <div class="knowledge-section-header">
                        <span>🎨 风格配置</span>
                        <button class="btn btn-primary btn-sm" onclick="openStyleProfileModal()">+ 新增风格</button>
                    </div>
                    <div id="styleProfilesArea" class="knowledge-list-area"></div>
                </div>
                <div class="card" style="margin-top:12px;">
                    <div class="knowledge-section-header">
                        <span>📝 风格样本</span>
                        <button class="btn btn-primary btn-sm" onclick="openStyleSampleModal()">+ 新增样本</button>
                    </div>
                    <div style="padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <input type="text" id="sampleSearchInput" placeholder="搜索样本..." oninput="loadStyleSamples()" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                        <select id="sampleTypeFilter" onchange="loadStyleSamples()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部类型</option>
                            <option value="article">文章</option>
                            <option value="note">笔记</option>
                            <option value="script">口播</option>
                            <option value="parent-message">家长沟通</option>
                            <option value="moment">朋友圈</option>
                        </select>
                    </div>
                    <div id="styleSamplesArea" class="knowledge-list-area"></div>
                </div>
            </div>

            <!-- 资料库 Tab -->
            <div id="ktabSource" class="knowledge-subtab-content" style="display:none;">
                <div class="card" style="padding:10px 12px;background:#fffbe6;border-radius:8px;margin-bottom:8px;">
                    <div style="font-size:11px;color:#856404;">💡 录入提示：可从 Obsidian 的"AI教培工作台/资料库/小升初资料.md、中考资料.md、家长常见问题.md"复制摘要进来。</div>
                </div>
                <div class="card">
                    <div class="knowledge-section-header">
                        <span>📄 资料来源</span>
                        <button class="btn btn-primary btn-sm" onclick="openSourceModal()">+ 新增资料</button>
                    </div>
                    <div style="padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <input type="text" id="sourceSearchInput" placeholder="搜索资料..." oninput="loadKnowledgeSources()" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                        <select id="sourceCategoryFilter" onchange="loadKnowledgeSources()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部分类</option>
                            <option value="resource">升学/政策</option>
                            <option value="content">内容素材</option>
                            <option value="style">风格参考</option>
                            <option value="question">题目资料</option>
                        </select>
                        <select id="sourceGradeFilter" onchange="loadKnowledgeSources()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部年级</option>
                            <option value="六年级">六年级</option>
                            <option value="初一">初一</option>
                            <option value="初二">初二</option>
                            <option value="初三">初三</option>
                        </select>
                    </div>
                    <div id="knowledgeSourcesArea" class="knowledge-list-area"></div>
                </div>
            </div>

            <!-- 题库 Tab -->
            <div id="ktabQuestion" class="knowledge-subtab-content" style="display:none;">
                <div class="card" style="padding:10px 12px;background:#fffbe6;border-radius:8px;margin-bottom:8px;">
                    <div style="font-size:11px;color:#856404;">💡 录入提示：可参考 Obsidian 的"AI教培工作台/题库素材/题库标签体系.md"，手工录入或后续支持 Excel 批量导入。</div>
                </div>
                <div class="card">
                    <div class="knowledge-section-header">
                        <span>📝 数学题库 MVP</span>
                        <button class="btn btn-primary btn-sm" onclick="openQuestionModal()">+ 新增题目</button>
                    </div>
                    <p style="font-size:11px;color:var(--text-muted);margin:0 0 8px 0;">当前是题库 MVP，不处理图片公式 OCR。后续支持 Excel 导入。</p>
                    <div style="padding:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                        <input type="text" id="questionSearchInput" placeholder="搜索题目..." oninput="loadQuestions()" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                        <select id="questionGradeFilter" onchange="loadQuestions()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部年级</option>
                            <option value="六年级">六年级</option>
                            <option value="初一">初一</option>
                            <option value="初二">初二</option>
                            <option value="初三">初三</option>
                        </select>
                        <select id="questionChapterFilter" onchange="loadQuestions()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部章节</option>
                            <option value="计算">计算</option>
                            <option value="应用题">应用题</option>
                            <option value="几何">几何</option>
                            <option value="代数">代数</option>
                        </select>
                        <select id="questionDifficultyFilter" onchange="loadQuestions()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部难度</option>
                            <option value="基础">基础</option>
                            <option value="中等">中等</option>
                            <option value="提高">提高</option>
                            <option value="压轴">压轴</option>
                        </select>
                    </div>
                    <div id="questionsArea" class="knowledge-list-area"></div>
                </div>
            </div>
        </div>

        <style>
            .knowledge-layout {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 12px 0;
            }
            .knowledge-header {
                padding: 16px;
            }
            .knowledge-stats {
                padding: 12px;
            }
            .knowledge-stat-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
            }
            .knowledge-stat-item {
                text-align: center;
                padding: 10px 8px;
                background: var(--hover-bg);
                border-radius: 8px;
            }
            .knowledge-stat-num {
                font-size: 22px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .knowledge-stat-label {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 2px;
            }
            .knowledge-tabs-card {
                padding: 0;
            }
            .knowledge-sub-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
            }
            .knowledge-sub-tab {
                flex: 1;
                padding: 10px 12px;
                font-size: 13px;
                cursor: pointer;
                background: none;
                border: none;
                border-bottom: 2px solid transparent;
                color: var(--text-muted);
                transition: all 0.2s;
            }
            .knowledge-sub-tab:hover {
                color: var(--text-primary);
            }
            .knowledge-sub-tab.active {
                color: var(--text-primary);
                border-bottom-color: #3498db;
                font-weight: 600;
            }
            .knowledge-subtab-content {
                display: flex;
                flex-direction: column;
                gap: 0;
            }
            .knowledge-section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border-bottom: 1px solid var(--border-color);
                font-size: 13px;
                font-weight: 600;
            }
            .knowledge-list-area {
                max-height: 500px;
                overflow-y: auto;
                padding: 8px 12px;
            }
            .knowledge-item {
                padding: 10px 0;
                border-bottom: 1px solid var(--border-color);
            }
            .knowledge-item:last-child {
                border-bottom: none;
            }
            .knowledge-item-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 6px;
            }
            .knowledge-item-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-primary);
            }
            .knowledge-item-meta {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                margin-top: 4px;
            }
            .knowledge-badge {
                padding: 1px 6px;
                border-radius: 3px;
                font-size: 10px;
            }
            .knowledge-badge-default {
                background: #27ae60;
                color: white;
            }
            .knowledge-badge-active {
                background: #3498db;
                color: white;
            }
            .knowledge-badge-draft {
                background: #f39c12;
                color: white;
            }
            .knowledge-badge-archived {
                background: #95a5a6;
                color: white;
            }
            .knowledge-badge-high {
                background: #27ae60;
                color: white;
            }
            .knowledge-badge-medium {
                background: #f39c12;
                color: white;
            }
            .knowledge-badge-low {
                background: #e74c3c;
                color: white;
            }
            .knowledge-badge-source {
                background: #9b59b6;
                color: white;
            }
            .knowledge-item-actions {
                display: flex;
                gap: 6px;
                margin-top: 6px;
            }
            .knowledge-item-content {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
                line-height: 1.4;
            }
            .knowledge-empty {
                text-align: center;
                padding: 32px 16px;
                color: var(--text-muted);
                font-size: 13px;
            }
            .knowledge-empty-icon {
                font-size: 32px;
                margin-bottom: 8px;
            }
            @media (max-width: 700px) {
                .knowledge-stat-grid { grid-template-columns: repeat(2, 1fr); }
                .knowledge-sub-tabs { flex-wrap: wrap; }
                .knowledge-sub-tab { font-size: 12px; padding: 8px; }
            }
            @media (max-width: 390px) {
                .knowledge-stat-grid { grid-template-columns: 1fr 1fr; }
            }
        </style>
    `;

    loadKnowledgeSummary();
}

function switchKnowledgeTab(tab) {
    knowledgeActiveTab = tab;
    document.querySelectorAll('.knowledge-sub-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.knowledge-sub-tab[data-ktab="${tab}"]`).classList.add('active');

    document.querySelectorAll('.knowledge-subtab-content').forEach(c => c.style.display = 'none');
    document.getElementById(`ktab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block';

    if (tab === 'style') { loadStyleProfiles(); loadStyleSamples(); }
    else if (tab === 'source') { loadKnowledgeSources(); }
    else if (tab === 'question') { loadQuestions(); }
}

// ========== 知识库摘要 ==========
function loadKnowledgeSummary() {
    fetch('/api/knowledge/summary')
        .then(res => res.json())
        .then(data => {
            knowledgeSummary = data;
            document.getElementById('statKnowledgeCount').textContent = data.knowledgeCount || 0;
            document.getElementById('statStyleCount').textContent = data.styleProfileCount || 0;
            document.getElementById('statSampleCount').textContent = data.styleSampleCount || 0;
            document.getElementById('statQuestionCount').textContent = data.questionCount || 0;

            // 显示空状态提示
            const total = (data.knowledgeCount || 0) + (data.styleProfileCount || 0) + (data.styleSampleCount || 0) + (data.questionCount || 0);
            const emptyHint = document.getElementById('knowledgeEmptyHint');
            if (emptyHint) {
                emptyHint.style.display = total === 0 ? 'block' : 'none';
            }
        })
        .catch(() => {
            document.getElementById('statKnowledgeCount').textContent = '0';
            document.getElementById('statStyleCount').textContent = '0';
            document.getElementById('statSampleCount').textContent = '0';
            document.getElementById('statQuestionCount').textContent = '0';
            const emptyHint = document.getElementById('knowledgeEmptyHint');
            if (emptyHint) emptyHint.style.display = 'block';
        });
}

// ========== 风格库 ==========
function loadStyleProfiles() {
    fetch('/api/style/profiles')
        .then(res => res.json())
        .then(profiles => renderStyleProfiles(profiles))
        .catch(() => renderStyleProfiles([]));
}

function renderStyleProfiles(profiles) {
    const area = document.getElementById('styleProfilesArea');
    if (!area) return;
    if (!profiles || profiles.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">🎨</div>暂无风格配置<br><span style="font-size:11px;">点击右上角「新增风格」开始录入</span></div>`;
        return;
    }
    area.innerHTML = profiles.map(p => {
        const platformBadge = { general: '通用', wechat: '公众号', xiaohongshu: '小红书', video: '视频号', parent: '家长沟通' }[p.platform] || p.platform || '通用';
        const defaultBadge = p.is_default ? '<span class="knowledge-badge knowledge-badge-default">默认</span>' : '';
        const rulesText = p.rules_text || '';
        const rulesShort = rulesText ? escapeHtml(rulesText.substring(0, 80)) + (rulesText.length > 80 ? '...' : '') : '';
        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml(p.name)}</div>
                    <div class="knowledge-item-meta">
                        <span class="knowledge-badge knowledge-badge-source">${escapeHtml(platformBadge)}</span>
                        ${defaultBadge}
                    </div>
                </div>
                <div style="display:flex;gap:4px;">
                    ${rulesText ? `<button class="btn btn-secondary btn-xs" onclick="copyKnowledgeText(this, '${escapeHtml(p.id)}')">复制</button>` : ''}
                    <button class="btn btn-secondary btn-xs" onclick="editStyleProfile('${p.id}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteStyleProfile('${p.id}')">删除</button>
                </div>
            </div>
            ${rulesShort ? `<div class="knowledge-item-content" data-full-text="${escapeHtml(rulesText)}">${rulesShort}</div>` : ''}
        </div>`;
    }).join('');
}

function openStyleProfileModal(profileId) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    const isEdit = !!profileId;
    titleEl.textContent = isEdit ? '编辑风格' : '新增风格';

    const existing = profileId ? null : null;

    bodyEl.innerHTML = `
        <div style="max-height:450px;overflow-y:auto;">
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">风格名称 *</label>
                <input type="text" id="spName" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="例如：白老师风格">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">平台</label>
                <select id="spPlatform" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                    <option value="general">通用</option>
                    <option value="wechat">公众号</option>
                    <option value="xiaohongshu">小红书</option>
                    <option value="video">视频号</option>
                    <option value="parent">家长沟通</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">风格规则</label>
                <textarea id="spRules" rows="4" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="请用白老师风格：真实、清楚、克制、偏实用，不夸张营销。句子尽量短，不堆形容词。"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">禁用词（每行一个）</label>
                <textarea id="spForbidden" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="突飞猛进&#10;保证提升&#10;逆袭&#10;稳赢&#10;名校必备"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">常用表达</label>
                <textarea id="spPreferred" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="家长您好，关于孩子最近的学习情况...&#10;如有疑问随时联系，祝好！"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">
                    <input type="checkbox" id="spDefault" style="margin-right:4px;">设为默认风格
                </label>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="saveStyleProfile('${profileId || ''}')">保存</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
}

function saveStyleProfile(profileId) {
    const name = document.getElementById('spName')?.value?.trim();
    if (!name) { showToast('请填写风格名称'); return; }

    const payload = {
        name: name,
        platform: document.getElementById('spPlatform')?.value || 'general',
        rules_text: document.getElementById('spRules')?.value?.trim() || '',
        forbidden_words_json: JSON.stringify(document.getElementById('spForbidden')?.value?.trim()?.split('\n')?.filter(w => w.trim()) || []),
        preferred_phrases_json: JSON.stringify(document.getElementById('spPreferred')?.value?.trim()?.split('\n')?.filter(w => w.trim()) || []),
        is_default: document.getElementById('spDefault')?.checked ? 1 : 0,
    };

    const method = profileId ? 'PUT' : 'POST';
    const url = profileId ? `/api/style/profiles/${profileId}` : '/api/style/profiles';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => { if (!res.ok) throw new Error('保存失败'); return res.json(); })
    .then(() => {
        closeModal();
        showToast('风格已保存');
        loadStyleProfiles();
        loadKnowledgeSummary();
    })
    .catch(err => { showToast('保存失败'); console.error(err); });
}

function editStyleProfile(profileId) {
    fetch(`/api/style/profiles/${profileId}`)
        .then(res => res.json())
        .then(profile => {
            openStyleProfileModal(profileId);
            setTimeout(() => {
                document.getElementById('spName').value = profile.name || '';
                document.getElementById('spPlatform').value = profile.platform || 'general';
                document.getElementById('spRules').value = profile.rules_text || '';
                try {
                    const forbidden = JSON.parse(profile.forbidden_words_json || '[]');
                    document.getElementById('spForbidden').value = forbidden.join('\n');
                } catch (e) {}
                try {
                    const preferred = JSON.parse(profile.preferred_phrases_json || '[]');
                    document.getElementById('spPreferred').value = preferred.join('\n');
                } catch (e) {}
                document.getElementById('spDefault').checked = !!profile.is_default;
            }, 50);
        })
        .catch(() => showToast('读取失败'));
}

function deleteStyleProfile(profileId) {
    if (!confirm('确定删除该风格吗？')) return;
    fetch(`/api/style/profiles/${profileId}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('删除失败'); return res.json(); })
        .then(() => { showToast('已删除'); loadStyleProfiles(); loadKnowledgeSummary(); })
        .catch(() => showToast('删除失败'));
}

// ========== 风格样本 ==========
function loadStyleSamples() {
    const search = document.getElementById('sampleSearchInput')?.value?.toLowerCase() || '';
    const typeFilter = document.getElementById('sampleTypeFilter')?.value || '';
    let url = '/api/style/samples?';
    const params = [];
    if (search) params.push(`q=${encodeURIComponent(search)}`);
    if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
    url += params.join('&');

    fetch(url)
        .then(res => res.json())
        .then(samples => renderStyleSamples(samples))
        .catch(() => renderStyleSamples([]));
}

function renderStyleSamples(samples) {
    const area = document.getElementById('styleSamplesArea');
    if (!area) return;
    if (!samples || samples.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📝</div>暂无风格样本<br><span style="font-size:11px;">点击右上角「新增样本」开始录入</span></div>`;
        return;
    }
    area.innerHTML = samples.map(s => {
        const typeLabels = { article: '文章', note: '笔记', script: '口播', 'parent-message': '家长沟通', moment: '朋友圈' };
        const qualityLabels = { good: '✅ 好', ok: '⚠️ 一般', avoid: '❌ 避免' };
        const typeLabel = typeLabels[s.sample_type] || s.sample_type || '';
        const qualityLabel = qualityLabels[s.quality] || s.quality || '';
        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml(s.title || '')}</div>
                    <div class="knowledge-item-meta">
                        <span class="knowledge-badge knowledge-badge-source">${escapeHtml(typeLabel)}</span>
                        <span class="knowledge-badge ${s.quality === 'good' ? 'knowledge-badge-active' : s.quality === 'avoid' ? 'knowledge-badge-draft' : 'knowledge-badge-archived'}">${escapeHtml(qualityLabel)}</span>
                    </div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="editStyleSample('${s.id}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteStyleSample('${s.id}')">删除</button>
                </div>
            </div>
            <div class="knowledge-item-content">${escapeHtml((s.content || '').substring(0, 150))}${s.content?.length > 150 ? '...' : ''}</div>
        </div>`;
    }).join('');
}

function openStyleSampleModal(sampleId) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    const isEdit = !!sampleId;
    titleEl.textContent = isEdit ? '编辑样本' : '新增样本';

    bodyEl.innerHTML = `
        <div style="max-height:450px;overflow-y:auto;">
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标题 *</label>
                <input type="text" id="ssTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="样本标题">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">类型</label>
                <select id="ssType" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                    <option value="article">文章</option>
                    <option value="note">笔记</option>
                    <option value="script">口播</option>
                    <option value="parent-message">家长沟通</option>
                    <option value="moment">朋友圈</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">内容</label>
                <textarea id="ssContent" rows="6" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="粘贴样本内容，注意去除学生隐私信息"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">质量</label>
                <select id="ssQuality" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                    <option value="good">✅ 好（推荐风格参考）</option>
                    <option value="ok">⚠️ 一般（普通参考）</option>
                    <option value="avoid">❌ 避免（不符合风格）</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标签（逗号分隔）</label>
                <input type="text" id="ssTags" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="小升初, 数学, 家长沟通">
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="saveStyleSample('${sampleId || ''}')">保存</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
}

function saveStyleSample(sampleId) {
    const title = document.getElementById('ssTitle')?.value?.trim();
    if (!title) { showToast('请填写标题'); return; }

    const tags = document.getElementById('ssTags')?.value?.trim()?.split(',')?.map(t => t.trim())?.filter(t => t) || [];

    const payload = {
        title: title,
        sample_type: document.getElementById('ssType')?.value || 'article',
        content: document.getElementById('ssContent')?.value?.trim() || '',
        quality: document.getElementById('ssQuality')?.value || 'ok',
        tags_json: JSON.stringify(tags),
    };

    const method = sampleId ? 'PUT' : 'POST';
    const url = sampleId ? `/api/style/samples/${sampleId}` : '/api/style/samples';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => { if (!res.ok) throw new Error('保存失败'); return res.json(); })
    .then(() => {
        closeModal();
        showToast('样本已保存');
        loadStyleSamples();
        loadKnowledgeSummary();
    })
    .catch(err => { showToast('保存失败'); console.error(err); });
}

function editStyleSample(sampleId) {
    fetch(`/api/style/samples/${sampleId}`)
        .then(res => res.json())
        .then(sample => {
            openStyleSampleModal(sampleId);
            setTimeout(() => {
                document.getElementById('ssTitle').value = sample.title || '';
                document.getElementById('ssType').value = sample.sample_type || 'article';
                document.getElementById('ssContent').value = sample.content || '';
                document.getElementById('ssQuality').value = sample.quality || 'ok';
                try {
                    const tags = JSON.parse(sample.tags_json || '[]');
                    document.getElementById('ssTags').value = tags.join(', ');
                } catch (e) {}
            }, 50);
        })
        .catch(() => showToast('读取失败'));
}

function deleteStyleSample(sampleId) {
    if (!confirm('确定删除该样本吗？')) return;
    fetch(`/api/style/samples/${sampleId}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('删除失败'); return res.json(); })
        .then(() => { showToast('已删除'); loadStyleSamples(); loadKnowledgeSummary(); })
        .catch(() => showToast('删除失败'));
}

// ========== 资料库 ==========
function loadKnowledgeSources() {
    const search = document.getElementById('sourceSearchInput')?.value?.toLowerCase() || '';
    const categoryFilter = document.getElementById('sourceCategoryFilter')?.value || '';
    const gradeFilter = document.getElementById('sourceGradeFilter')?.value || '';
    let url = '/api/knowledge/sources?';
    const params = [];
    if (search) params.push(`q=${encodeURIComponent(search)}`);
    if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
    if (gradeFilter) params.push(`grade=${encodeURIComponent(gradeFilter)}`);
    url += params.join('&');

    fetch(url)
        .then(res => res.json())
        .then(sources => renderKnowledgeSources(sources))
        .catch(() => renderKnowledgeSources([]));
}

function renderKnowledgeSources(sources) {
    const area = document.getElementById('knowledgeSourcesArea');
    if (!area) return;
    if (!sources || sources.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📄</div>暂无资料<br><span style="font-size:11px;">点击右上角「新增资料」开始录入</span></div>`;
        return;
    }
    area.innerHTML = sources.map(s => {
        const categoryLabels = { resource: '升学/政策', content: '内容素材', style: '风格参考', question: '题目资料' };
        const trustLabels = { high: '✅ 高', medium: '⚠️ 中', low: '❌ 低', unknown: '❓ 未知' };
        const sourceTypeLabels = { manual: '手动', obsidian: 'Obsidian', file: '文件', url: '链接' };
        const categoryLabel = categoryLabels[s.category] || s.category || '';
        const trustLabel = trustLabels[s.trust_level] || s.trust_level || '';
        const sourceTypeLabel = sourceTypeLabels[s.source_type] || s.source_type || '';

        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml(s.title || '')}</div>
                    <div class="knowledge-item-meta">
                        <span class="knowledge-badge knowledge-badge-source">${escapeHtml(categoryLabel)}</span>
                        <span class="knowledge-badge ${s.trust_level === 'high' ? 'knowledge-badge-active' : s.trust_level === 'low' ? 'knowledge-badge-draft' : 'knowledge-badge-archived'}">${escapeHtml(trustLabel)}</span>
                        <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(sourceTypeLabel)}</span>
                    </div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="editKnowledgeSource('${s.id}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteKnowledgeSource('${s.id}')">删除</button>
                </div>
            </div>
            ${s.summary ? `<div class="knowledge-item-content">${escapeHtml(s.summary.substring(0, 100))}${s.summary.length > 100 ? '...' : ''}</div>` : ''}
        </div>`;
    }).join('');
}

function openSourceModal(sourceId) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    const isEdit = !!sourceId;
    titleEl.textContent = isEdit ? '编辑资料' : '新增资料';

    bodyEl.innerHTML = `
        <div style="max-height:500px;overflow-y:auto;">
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标题 *</label>
                <input type="text" id="ksTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="资料标题">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">来源类型</label>
                    <select id="ksSourceType" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="manual">手动录入</option>
                        <option value="obsidian">Obsidian</option>
                        <option value="file">本地文件</option>
                        <option value="url">外部链接</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">分类</label>
                    <select id="ksCategory" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="resource">升学/政策</option>
                        <option value="content">内容素材</option>
                        <option value="style">风格参考</option>
                        <option value="question">题目资料</option>
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">子分类</label>
                    <input type="text" id="ksSubCategory" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="小升初/中考">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">年级</label>
                    <select id="ksGrade" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="">请选择</option>
                        <option value="六年级">六年级</option>
                        <option value="初一">初一</option>
                        <option value="初二">初二</option>
                        <option value="初三">初三</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">可信度</label>
                    <select id="ksTrustLevel" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="unknown">未知</option>
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                    </select>
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标签（逗号分隔）</label>
                <input type="text" id="ksTags" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="政策, 小升初, 数学">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">摘要</label>
                <textarea id="ksSummary" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="资料摘要..."></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">原文短文本</label>
                <textarea id="ksRawText" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="可粘贴关键原文片段..."></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">文件路径 / 来源链接</label>
                <input type="text" id="ksFilePath" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="/Users/bzx/Data/... 或 https://...">
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="saveKnowledgeSource('${sourceId || ''}')">保存</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
}

function saveKnowledgeSource(sourceId) {
    const title = document.getElementById('ksTitle')?.value?.trim();
    if (!title) { showToast('请填写标题'); return; }

    const tags = document.getElementById('ksTags')?.value?.trim()?.split(',')?.map(t => t.trim())?.filter(t => t) || [];

    const payload = {
        title: title,
        source_type: document.getElementById('ksSourceType')?.value || 'manual',
        category: document.getElementById('ksCategory')?.value || 'resource',
        sub_category: document.getElementById('ksSubCategory')?.value?.trim() || '',
        grade: document.getElementById('ksGrade')?.value || '',
        trust_level: document.getElementById('ksTrustLevel')?.value || 'unknown',
        tags_json: JSON.stringify(tags),
        summary: document.getElementById('ksSummary')?.value?.trim() || '',
        raw_text: document.getElementById('ksRawText')?.value?.trim() || '',
        file_path: document.getElementById('ksFilePath')?.value?.trim() || '',
        status: 'active',
    };

    const method = sourceId ? 'PUT' : 'POST';
    const url = sourceId ? `/api/knowledge/sources/${sourceId}` : '/api/knowledge/sources';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => { if (!res.ok) throw new Error('保存失败'); return res.json(); })
    .then(() => {
        closeModal();
        showToast('资料已保存');
        loadKnowledgeSources();
        loadKnowledgeSummary();
    })
    .catch(err => { showToast('保存失败'); console.error(err); });
}

function editKnowledgeSource(sourceId) {
    fetch(`/api/knowledge/sources/${sourceId}`)
        .then(res => res.json())
        .then(source => {
            openSourceModal(sourceId);
            setTimeout(() => {
                document.getElementById('ksTitle').value = source.title || '';
                document.getElementById('ksSourceType').value = source.source_type || 'manual';
                document.getElementById('ksCategory').value = source.category || 'resource';
                document.getElementById('ksSubCategory').value = source.sub_category || '';
                document.getElementById('ksGrade').value = source.grade || '';
                document.getElementById('ksTrustLevel').value = source.trust_level || 'unknown';
                document.getElementById('ksSummary').value = source.summary || '';
                document.getElementById('ksRawText').value = source.raw_text || '';
                document.getElementById('ksFilePath').value = source.file_path || '';
                try {
                    const tags = JSON.parse(source.tags_json || '[]');
                    document.getElementById('ksTags').value = tags.join(', ');
                } catch (e) {}
            }, 50);
        })
        .catch(() => showToast('读取失败'));
}

function deleteKnowledgeSource(sourceId) {
    if (!confirm('确定删除该资料吗？')) return;
    fetch(`/api/knowledge/sources/${sourceId}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('删除失败'); return res.json(); })
        .then(() => { showToast('已删除'); loadKnowledgeSources(); loadKnowledgeSummary(); })
        .catch(() => showToast('删除失败'));
}

// ========== 题库 ==========
function loadQuestions() {
    const search = document.getElementById('questionSearchInput')?.value?.toLowerCase() || '';
    const gradeFilter = document.getElementById('questionGradeFilter')?.value || '';
    const chapterFilter = document.getElementById('questionChapterFilter')?.value || '';
    const difficultyFilter = document.getElementById('questionDifficultyFilter')?.value || '';
    let url = '/api/questions?';
    const params = [];
    if (search) params.push(`q=${encodeURIComponent(search)}`);
    if (gradeFilter) params.push(`grade=${encodeURIComponent(gradeFilter)}`);
    if (chapterFilter) params.push(`chapter=${encodeURIComponent(chapterFilter)}`);
    if (difficultyFilter) params.push(`difficulty=${encodeURIComponent(difficultyFilter)}`);
    url += params.join('&');

    fetch(url)
        .then(res => res.json())
        .then(questions => renderQuestions(questions))
        .catch(() => renderQuestions([]));
}

function renderQuestions(questions) {
    const area = document.getElementById('questionsArea');
    if (!area) return;
    if (!questions || questions.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📝</div>暂无题目<br><span style="font-size:11px;">点击右上角「新增题目」开始录入</span></div>`;
        return;
    }
    area.innerHTML = questions.map(q => {
        const statusBadge = q.status === 'active' ? '<span class="knowledge-badge knowledge-badge-active">已启用</span>' : q.status === 'draft' ? '<span class="knowledge-badge knowledge-badge-draft">草稿</span>' : '<span class="knowledge-badge knowledge-badge-archived">归档</span>';
        const difficultyColors = { '基础': '#27ae60', '中等': '#3498db', '提高': '#f39c12', '压轴': '#e74c3c' };
        const diffColor = difficultyColors[q.difficulty] || '#95a5a6';
        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml((q.stem || '').substring(0, 60))}${q.stem?.length > 60 ? '...' : ''}</div>
                    <div class="knowledge-item-meta">
                        <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(q.grade || '')} · ${escapeHtml(q.chapter || '')} · <span style="color:${diffColor};">${escapeHtml(q.difficulty || '')}</span> · ${escapeHtml(q.question_type || '')}</span>
                        ${statusBadge}
                    </div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="editQuestion('${q.id}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteQuestion('${q.id}')">删除</button>
                </div>
            </div>
            ${q.answer ? `<div class="knowledge-item-content"><strong>答案：</strong>${escapeHtml(q.answer.substring(0, 50))}${q.answer.length > 50 ? '...' : ''}</div>` : ''}
        </div>`;
    }).join('');
}

function openQuestionModal(questionId) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;

    const isEdit = !!questionId;
    titleEl.textContent = isEdit ? '编辑题目' : '新增题目';

    bodyEl.innerHTML = `
        <div style="max-height:550px;overflow-y:auto;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">年级 *</label>
                    <select id="qGrade" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="">请选择</option>
                        <option value="六年级">六年级</option>
                        <option value="初一">初一</option>
                        <option value="初二">初二</option>
                        <option value="初三">初三</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">体系</label>
                    <select id="qSystem" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="校内">校内</option>
                        <option value="小升初">小升初</option>
                        <option value="中考">中考</option>
                        <option value="竞赛">竞赛</option>
                        <option value="机构讲义">机构讲义</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">状态</label>
                    <select id="qStatus" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="draft">草稿</option>
                        <option value="active">已启用</option>
                        <option value="archived">归档</option>
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">章节</label>
                    <input type="text" id="qChapter" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="计算/几何/代数">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">知识点</label>
                    <input type="text" id="qKnowledgePoints" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="分数/方程">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">题型</label>
                    <input type="text" id="qQuestionType" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="填空/选择/解答">
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">难度</label>
                <select id="qDifficulty" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                    <option value="基础">基础</option>
                    <option value="中等">中等</option>
                    <option value="提高">提高</option>
                    <option value="压轴">压轴</option>
                </select>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">题干 *</label>
                <textarea id="qStem" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="题目内容..."></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">答案</label>
                <input type="text" id="qAnswer" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="标准答案">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">解析</label>
                <textarea id="qSolution" rows="2" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="解题思路..."></textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">易错点</label>
                    <input type="text" id="qCommonMistakes" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="常见错误">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">错因标签（逗号分隔）</label>
                    <input type="text" id="qErrorTags" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="计算错误, 概念不清">
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">备注</label>
                <textarea id="qRemark" rows="2" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="补充说明..."></textarea>
            </div>
            <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="saveQuestion('${questionId || ''}')">保存</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
}

function saveQuestion(questionId) {
    const stem = document.getElementById('qStem')?.value?.trim();
    if (!stem) { showToast('请填写题干'); return; }

    const errorTags = document.getElementById('qErrorTags')?.value?.trim()?.split(',')?.map(t => t.trim())?.filter(t => t) || [];

    const payload = {
        grade: document.getElementById('qGrade')?.value || '',
        system: document.getElementById('qSystem')?.value || '校内',
        chapter: document.getElementById('qChapter')?.value?.trim() || '',
        knowledge_points_json: JSON.stringify(document.getElementById('qKnowledgePoints')?.value?.trim()?.split('/')?.map(t => t.trim())?.filter(t => t) || []),
        question_type: document.getElementById('qQuestionType')?.value?.trim() || '',
        difficulty: document.getElementById('qDifficulty')?.value || '基础',
        stem: stem,
        answer: document.getElementById('qAnswer')?.value?.trim() || '',
        solution: document.getElementById('qSolution')?.value?.trim() || '',
        common_mistakes: document.getElementById('qCommonMistakes')?.value?.trim() || '',
        error_tags_json: JSON.stringify(errorTags),
        status: document.getElementById('qStatus')?.value || 'draft',
        remark: document.getElementById('qRemark')?.value?.trim() || '',
    };

    const method = questionId ? 'PUT' : 'POST';
    const url = questionId ? `/api/questions/${questionId}` : '/api/questions';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then(res => { if (!res.ok) throw new Error('保存失败'); return res.json(); })
    .then(() => {
        closeModal();
        showToast('题目已保存');
        loadQuestions();
        loadKnowledgeSummary();
    })
    .catch(err => { showToast('保存失败'); console.error(err); });
}

function editQuestion(questionId) {
    fetch(`/api/questions/${questionId}`)
        .then(res => res.json())
        .then(q => {
            openQuestionModal(questionId);
            setTimeout(() => {
                document.getElementById('qGrade').value = q.grade || '';
                document.getElementById('qSystem').value = q.system || '校内';
                document.getElementById('qChapter').value = q.chapter || '';
                document.getElementById('qDifficulty').value = q.difficulty || '基础';
                document.getElementById('qQuestionType').value = q.question_type || '';
                document.getElementById('qStem').value = q.stem || '';
                document.getElementById('qAnswer').value = q.answer || '';
                document.getElementById('qSolution').value = q.solution || '';
                document.getElementById('qCommonMistakes').value = q.common_mistakes || '';
                document.getElementById('qStatus').value = q.status || 'draft';
                document.getElementById('qRemark').value = q.remark || '';
                try {
                    const kps = JSON.parse(q.knowledge_points_json || '[]');
                    document.getElementById('qKnowledgePoints').value = kps.join('/');
                } catch (e) {}
                try {
                    const tags = JSON.parse(q.error_tags_json || '[]');
                    document.getElementById('qErrorTags').value = tags.join(', ');
                } catch (e) {}
            }, 50);
        })
        .catch(() => showToast('读取失败'));
}

function deleteQuestion(questionId) {
    if (!confirm('确定删除该题目吗？')) return;
    fetch(`/api/questions/${questionId}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('删除失败'); return res.json(); })
        .then(() => { showToast('已删除'); loadQuestions(); loadKnowledgeSummary(); })
        .catch(() => showToast('删除失败'));
}

// ========== 辅助函数 ==========
function copyKnowledgeText(btn, itemId) {
    const item = btn.closest('.knowledge-item');
    const contentEl = item?.querySelector('.knowledge-item-content');
    const text = contentEl?.getAttribute('data-full-text') || contentEl?.innerText;
    if (!text) { showToast('无内容可复制'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

// ========== Window 暴露 ==========
window.switchKnowledgeTab = switchKnowledgeTab;
window.loadStyleProfiles = loadStyleProfiles;
window.loadStyleSamples = loadStyleSamples;
window.openStyleProfileModal = openStyleProfileModal;
window.saveStyleProfile = saveStyleProfile;
window.editStyleProfile = editStyleProfile;
window.deleteStyleProfile = deleteStyleProfile;
window.openStyleSampleModal = openStyleSampleModal;
window.saveStyleSample = saveStyleSample;
window.editStyleSample = editStyleSample;
window.deleteStyleSample = deleteStyleSample;
window.loadKnowledgeSources = loadKnowledgeSources;
window.openSourceModal = openSourceModal;
window.saveKnowledgeSource = saveKnowledgeSource;
window.editKnowledgeSource = editKnowledgeSource;
window.deleteKnowledgeSource = deleteKnowledgeSource;
window.loadQuestions = loadQuestions;
window.openQuestionModal = openQuestionModal;
window.saveQuestion = saveQuestion;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.copyKnowledgeText = copyKnowledgeText;