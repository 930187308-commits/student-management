// ==================== 知识库管理 Stage 7C ====================

function getApiList(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[key])) return payload[key];
    return [];
}

function splitInputList(value, separator = /[,，\n]/) {
    return String(value || '').split(separator).map(item => item.trim()).filter(Boolean);
}

// ========== 资料库极简版覆盖入口 ==========
function isVisibleKnowledgeSource(source) {
    return !['question', 'style'].includes(String(source?.category || '').toLowerCase());
}

function sourceReference(source) {
    return source?.sourceUrl || source?.filePath || '';
}

function sourceTypeLabel(type) {
    return {
        manual: '手动录入',
        obsidian: 'Obsidian',
        file: '本地文件',
        url: '网页链接'
    }[type] || type || '手动录入';
}

function sourceContentState(source) {
    return {
        hasSummary: Boolean(String(source?.summary || '').trim()),
        hasRawText: Boolean(String(source?.rawText || '').trim())
    };
}

function renderKnowledge() {
    const container = document.getElementById('tab-knowledge');
    if (!container) return;

    container.innerHTML = `
        <div class="knowledge-layout knowledge-simple">
            <div class="knowledge-page-grid">
                <main class="knowledge-main-col">
                    <div class="card knowledge-stats" id="knowledgeStats">
                        <div class="knowledge-stat-grid">
                            <div class="knowledge-stat-item">
                                <div class="knowledge-stat-num" id="statKnowledgeCount">-</div>
                                <div class="knowledge-stat-label">资料总数</div>
                            </div>
                            <div class="knowledge-stat-item">
                                <div class="knowledge-stat-num" id="statObsidianCount">-</div>
                                <div class="knowledge-stat-label">Obsidian</div>
                            </div>
                            <div class="knowledge-stat-item">
                                <div class="knowledge-stat-num" id="statSummaryCount">-</div>
                                <div class="knowledge-stat-label">有摘要</div>
                            </div>
                            <div class="knowledge-stat-item">
                                <div class="knowledge-stat-num" id="statRawTextCount">-</div>
                                <div class="knowledge-stat-label">有原文</div>
                            </div>
                            <div class="knowledge-stat-item">
                                <div class="knowledge-stat-num" id="statChunkCount">-</div>
                                <div class="knowledge-stat-label">引用片段</div>
                            </div>
                        </div>
                    </div>

                    <div class="knowledge-import-grid">
                        <button class="knowledge-import-card" onclick="openKnowledgeImportModal('text')">
                            <strong>粘贴原文</strong>
                            <span>复制资料正文，自动生成摘要后保存。</span>
                        </button>
                        <button class="knowledge-import-card" onclick="openKnowledgeImportModal('url')">
                            <strong>网页地址</strong>
                            <span>尝试读取网页正文，并生成资料摘要。</span>
                        </button>
                        <button class="knowledge-import-card" onclick="openKnowledgeImportModal('file')">
                            <strong>本地文件</strong>
                            <span>读取 .md / .txt 文件，Word/PDF 后续再做。</span>
                        </button>
                        <button class="knowledge-import-card" onclick="openKnowledgeImportModal('folder')">
                            <strong>文件夹 / Obsidian</strong>
                            <span>批量导入 .md / .txt，支持先预览再写入。</span>
                        </button>
                    </div>

                    <div class="card">
                        <div class="knowledge-section-header">
                            <span>资料列表</span>
                            <button class="btn btn-primary btn-sm" onclick="openSourceModal()">+ 新增资料</button>
                        </div>
                        <div class="knowledge-filter-row">
                            <input type="text" id="sourceSearchInput" placeholder="搜索标题、摘要、标签..." oninput="loadKnowledgeSources()">
                            <select id="sourceTypeFilter" onchange="loadKnowledgeSources()">
                                <option value="">全部来源</option>
                                <option value="manual">手动录入</option>
                                <option value="obsidian">Obsidian</option>
                                <option value="file">本地文件</option>
                                <option value="url">网页链接</option>
                            </select>
                            <select id="sourceGradeFilter" onchange="loadKnowledgeSources()">
                                <option value="">全部年级</option>
                                <option value="五年级">五年级</option>
                                <option value="六年级">六年级</option>
                                <option value="初一">初一</option>
                                <option value="初二">初二</option>
                                <option value="初三">初三</option>
                                <option value="高一">高一</option>
                                <option value="高二">高二</option>
                                <option value="高三">高三</option>
                            </select>
                        </div>
                        <div class="knowledge-source-note">资料路径/链接用于追溯来源；AI 能理解的是已经保存到系统里的摘要和原文内容。</div>
                        <div id="knowledgeSourcesArea" class="knowledge-list-area"></div>
                    </div>

                    <div class="card knowledge-empty-hint is-hidden" id="knowledgeEmptyHint">
                        <div class="knowledge-empty-hint-icon">📭</div>
                        <div class="knowledge-empty-hint-title">资料库还没有可用资料</div>
                        <div class="knowledge-empty-hint-text">可以手动新增资料，或先从 Obsidian dry-run 检查后再导入。</div>
                    </div>
                </main>

                <aside class="knowledge-side-col">
                    <div class="card knowledge-side-card" id="obsidianGuideCard">
                        <div class="knowledge-side-title">资料怎么进入 AI</div>
                        <p>AI 读取的是资料库里保存的摘要和原文。</p>
                        <p>只保存路径/链接，只能追溯来源，不能让 AI 自动理解正文。</p>
                        <p>Obsidian 是资料原库；修改 Obsidian 后，需要重新导入到资料库。</p>
                        <div class="knowledge-bound-path">
                            <div>当前默认绑定</div>
                            <code>/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台</code>
                            <span>如果后续更换位置，可用「文件夹 / Obsidian」导入手动指定路径。</span>
                        </div>
                        <div class="knowledge-side-actions">
                            <button class="btn btn-secondary btn-xs" onclick="previewDefaultObsidianImport()">检查 Obsidian</button>
                            <button class="btn btn-primary btn-xs" onclick="applyDefaultObsidianImport()">执行导入</button>
                            <button class="btn btn-secondary btn-xs" onclick="rebuildKnowledgeChunks()">重建引用片段</button>
                        </div>
                        <div id="knowledgeImportStatus" class="knowledge-side-status">当前知识库状态加载中...</div>
                        <div id="knowledgeSideImportResult" class="knowledge-side-result is-hidden"></div>
                    </div>
                    <div class="card knowledge-side-card">
                        <div class="knowledge-side-title">推荐使用方式</div>
                        <ol>
                            <li>短资料：粘贴原文。</li>
                            <li>网页资料：先尝试网页导入。</li>
                            <li>本地资料：优先用 .md / .txt。</li>
                            <li>Obsidian：先预览，再确认导入。</li>
                        </ol>
                    </div>
                </aside>
            </div>
        </div>

        <style>
            .knowledge-page-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 300px;
                gap: 14px;
                align-items: start;
            }
            .knowledge-main-col {
                display: flex;
                flex-direction: column;
                gap: 12px;
                min-width: 0;
            }
            .knowledge-side-col {
                display: flex;
                flex-direction: column;
                gap: 12px;
                position: sticky;
                top: 12px;
            }
            .knowledge-side-card {
                padding: 14px;
            }
            .knowledge-side-title {
                font-size: 13px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .knowledge-side-card p,
            .knowledge-side-card li {
                font-size: 12px;
                line-height: 1.55;
                color: var(--text-secondary);
                margin: 0 0 7px 0;
            }
            .knowledge-side-card ol {
                margin: 0;
                padding-left: 18px;
            }
            .knowledge-side-status {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid var(--border-color);
                font-size: 11px;
                line-height: 1.45;
                color: var(--text-muted);
            }
            .knowledge-side-actions {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                margin-top: 10px;
            }
            .knowledge-side-result {
                margin-top: 8px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--hover-bg);
                padding: 8px 9px;
                color: var(--text-secondary);
                font-size: 11px;
                line-height: 1.5;
                max-height: 180px;
                overflow: auto;
            }
            .knowledge-side-result.is-hidden {
                display: none;
            }
            .knowledge-result-title {
                font-weight: 700;
                margin-bottom: 4px;
                color: var(--text-primary);
            }
            .knowledge-result-preview-list {
                margin-top: 8px;
                max-height: 180px;
                overflow: auto;
            }
            .knowledge-result-muted {
                color: var(--text-muted);
            }
            .knowledge-result-details {
                margin-top: 8px;
            }
            .knowledge-bound-path {
                margin-top: 10px;
                padding: 8px 9px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--hover-bg);
                font-size: 11px;
                line-height: 1.45;
                color: var(--text-secondary);
            }
            .knowledge-bound-path div {
                font-weight: 700;
                color: var(--text-primary);
                margin-bottom: 4px;
            }
            .knowledge-bound-path code {
                display: block;
                color: #1f7a4d;
                word-break: break-all;
                white-space: normal;
                margin-bottom: 5px;
            }
            .knowledge-bound-path span {
                color: var(--text-muted);
            }
            .knowledge-simple .knowledge-stats {
                padding: 10px;
            }
            .knowledge-simple .knowledge-stat-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
                gap: 8px;
            }
            .knowledge-simple .knowledge-stat-item {
                min-height: 52px;
                padding: 9px 11px;
                border: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                background: var(--hover-bg);
                border-radius: 8px;
            }
            .knowledge-simple .knowledge-stat-num {
                font-size: 20px;
                line-height: 1;
                font-weight: 750;
                color: var(--primary-color);
                order: 2;
            }
            .knowledge-simple .knowledge-stat-label {
                font-size: 12px;
                color: var(--text-secondary);
                white-space: nowrap;
                order: 1;
            }
            .knowledge-import-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 10px;
            }
            .knowledge-import-card {
                text-align: left;
                border: 1px solid var(--border-color);
                background: var(--card-bg);
                color: var(--text-primary);
                border-radius: 8px;
                padding: 13px 14px;
                cursor: pointer;
                min-height: 86px;
                transition: border-color 0.15s, transform 0.15s, background 0.15s;
            }
            .knowledge-import-card:hover {
                border-color: var(--primary-color);
                background: var(--hover-bg);
                transform: translateY(-1px);
            }
            .knowledge-import-card strong {
                display: block;
                font-size: 14px;
                margin-bottom: 7px;
            }
            .knowledge-import-card span {
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                line-height: 1.45;
            }
            .knowledge-filter-row {
                padding: 8px 0;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 8px;
                align-items: center;
            }
            .knowledge-filter-row input,
            .knowledge-filter-row select {
                padding: 8px 10px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--card-bg);
                color: var(--text-primary);
            }
            .knowledge-modal-scroll {
                max-height: 560px;
                overflow-y: auto;
            }
            .knowledge-modal-note {
                background: var(--hover-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 10px 12px;
                margin-bottom: 12px;
                font-size: 12px;
                color: var(--text-secondary);
                line-height: 1.6;
            }
            .knowledge-modal-field {
                margin-bottom: 12px;
            }
            .knowledge-modal-field label {
                display: block;
                font-size: 12px;
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: 4px;
            }
            .knowledge-modal-control {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--input-bg);
                color: var(--text-primary);
                font-size: 13px;
            }
            .knowledge-modal-control:focus {
                outline: none;
                border-color: var(--primary-color);
            }
            textarea.knowledge-modal-control {
                resize: vertical;
            }
            .knowledge-modal-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-bottom: 12px;
            }
            .knowledge-modal-inline-actions {
                margin-top: 6px;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .knowledge-modal-actions {
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 16px;
            }
            .knowledge-source-note {
                font-size: 11px;
                color: var(--text-muted);
                background: var(--hover-bg);
                border-radius: 6px;
                padding: 7px 9px;
                margin-bottom: 8px;
            }
            .knowledge-import-preview {
                margin: 10px 0;
                padding: 10px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--hover-bg);
                font-size: 12px;
                color: var(--text-secondary);
                line-height: 1.6;
            }
            .knowledge-import-preview.is-hidden {
                display: none;
            }
            .knowledge-empty-hint {
                padding: 16px;
                text-align: center;
            }
            .knowledge-empty-hint.is-hidden {
                display: none;
            }
            .knowledge-empty-hint-icon {
                font-size: 28px;
                margin-bottom: 8px;
            }
            .knowledge-empty-hint-title {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 8px;
            }
            .knowledge-empty-hint-text {
                font-size: 12px;
                color: var(--text-muted);
            }
            .knowledge-empty-tip {
                font-size: 11px;
                color: var(--text-muted);
            }
            .knowledge-list-area {
                max-height: min(58vh, 640px);
                overflow-y: auto;
                padding-right: 4px;
                display: flex;
                flex-direction: column;
                gap: 9px;
            }
            .knowledge-item {
                border: 1px solid var(--border-color);
                border-radius: 9px;
                background: var(--bg-card);
                padding: 10px 11px;
            }
            .knowledge-item-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 10px;
            }
            .knowledge-item-title {
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 700;
                line-height: 1.35;
            }
            .knowledge-item-meta {
                display: flex;
                align-items: center;
                gap: 5px;
                flex-wrap: wrap;
                margin-top: 5px;
            }
            .knowledge-item-content {
                margin-top: 7px;
                color: var(--text-secondary);
                font-size: 12px;
                line-height: 1.5;
            }
            .knowledge-badge {
                border-radius: 999px;
                padding: 2px 7px;
                border: 1px solid var(--border-color);
                color: var(--text-muted);
                font-size: 10px;
                line-height: 1.35;
            }
            .knowledge-badge-source {
                color: var(--primary-color);
            }
            .knowledge-item-path {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 6px;
                word-break: break-all;
            }
            .knowledge-tag-row {
                margin-top: 6px;
            }
            .knowledge-item-muted {
                color: var(--text-muted);
            }
            .knowledge-item-menu {
                position: relative;
                flex-shrink: 0;
            }
            .knowledge-item-menu summary {
                list-style: none;
                border: 1px solid var(--border-color);
                border-radius: 999px;
                width: 28px;
                height: 28px;
                padding: 0;
                background: var(--hover-bg);
                color: var(--text-secondary);
                font-size: 18px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            .knowledge-item-menu summary::-webkit-details-marker {
                display: none;
            }
            .knowledge-item-menu[open] summary {
                border-color: var(--primary-color);
                color: var(--primary-color);
                background: rgba(52, 152, 219, 0.08);
            }
            .knowledge-item-menu-popover {
                position: absolute;
                right: 0;
                top: calc(100% + 6px);
                z-index: 30;
                min-width: 110px;
                padding: 5px;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: var(--bg-card);
                box-shadow: 0 10px 24px var(--shadow);
            }
            .knowledge-item-menu-popover button {
                display: block;
                width: 100%;
                border: 0;
                border-radius: 6px;
                padding: 7px 8px;
                background: transparent;
                color: var(--text-primary);
                text-align: left;
                font-size: 12px;
                cursor: pointer;
            }
            .knowledge-item-menu-popover button:hover {
                background: var(--hover-bg);
            }
            .knowledge-item-menu-popover button.danger {
                color: #e74c3c;
            }
            .knowledge-state-badge {
                font-size: 10px;
                border-radius: 999px;
                padding: 2px 7px;
                border: 1px solid var(--border-color);
                color: var(--text-muted);
            }
            .knowledge-state-badge.ok {
                color: #1f7a4d;
                border-color: rgba(39, 174, 96, 0.28);
                background: rgba(39, 174, 96, 0.08);
            }
            .knowledge-state-badge.warn {
                color: #9a6a00;
                border-color: rgba(243, 156, 18, 0.28);
                background: rgba(243, 156, 18, 0.08);
            }
            @media (max-width: 760px) {
                .knowledge-page-grid {
                    grid-template-columns: 1fr;
                    display: grid;
                }
                .knowledge-side-col {
                    position: static;
                }
                .knowledge-import-grid {
                    grid-template-columns: 1fr 1fr;
                }
                .knowledge-filter-row {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
            @media (max-width: 480px) {
                .knowledge-import-grid {
                    grid-template-columns: 1fr;
                }
                .knowledge-simple .knowledge-stat-item {
                    padding: 10px 11px;
                }
                .knowledge-simple .knowledge-stat-num {
                    font-size: 19px;
                }
            }
        </style>
    `;

    loadKnowledgeSummary();
    loadKnowledgeSources();
}

function loadKnowledgeSummary() {
    Promise.all([
        fetch('/api/knowledge/sources').then(res => res.json()),
        fetch('/api/knowledge/summary').then(res => res.json()).catch(() => ({}))
    ])
        .then(([payload, summary]) => {
            const sources = getApiList(payload, 'sources').filter(isVisibleKnowledgeSource);
            const total = sources.length;
            const obsidian = sources.filter(item => item.sourceType === 'obsidian').length;
            const withSummary = sources.filter(item => sourceContentState(item).hasSummary).length;
            const withRawText = sources.filter(item => sourceContentState(item).hasRawText).length;
            const chunks = Number(summary?.chunks || 0);
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            setText('statKnowledgeCount', total);
            setText('statObsidianCount', obsidian);
            setText('statSummaryCount', withSummary);
            setText('statRawTextCount', withRawText);
            setText('statChunkCount', chunks);
            const importStatus = document.getElementById('knowledgeImportStatus');
            if (importStatus) {
                importStatus.textContent = `当前可引用资料 ${total} 条，其中 Obsidian ${obsidian} 条，有摘要 ${withSummary} 条，有原文 ${withRawText} 条，已生成引用片段 ${chunks} 条。`;
            }
            const emptyHint = document.getElementById('knowledgeEmptyHint');
            if (emptyHint) emptyHint.classList.toggle('is-hidden', total !== 0);
        })
        .catch(() => {
            ['statKnowledgeCount', 'statObsidianCount', 'statSummaryCount', 'statRawTextCount', 'statChunkCount'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
        });
}

function loadKnowledgeSources() {
    const search = document.getElementById('sourceSearchInput')?.value?.toLowerCase() || '';
    const sourceTypeFilter = document.getElementById('sourceTypeFilter')?.value || '';
    const gradeFilter = document.getElementById('sourceGradeFilter')?.value || '';
    const params = [];
    if (search) params.push(`q=${encodeURIComponent(search)}`);
    if (gradeFilter) params.push(`grade=${encodeURIComponent(gradeFilter)}`);

    fetch(`/api/knowledge/sources${params.length ? `?${params.join('&')}` : ''}`)
        .then(res => res.json())
        .then(payload => {
            let sources = getApiList(payload, 'sources').filter(isVisibleKnowledgeSource);
            if (sourceTypeFilter) {
                sources = sources.filter(item => item.sourceType === sourceTypeFilter);
            }
            renderKnowledgeSources(sources);
        })
        .catch(() => renderKnowledgeSources([]));
}

function renderKnowledgeSources(sources) {
    const area = document.getElementById('knowledgeSourcesArea');
    if (!area) return;
    if (!sources || sources.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📄</div>暂无资料<br><span class="knowledge-empty-tip">点击右上角「新增资料」开始录入</span></div>`;
        return;
    }
    area.innerHTML = sources.map(s => {
        const state = sourceContentState(s);
        const ref = sourceReference(s);
        const tags = Array.isArray(s.tags) ? s.tags : [];
        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml(s.title || '')}</div>
                    <div class="knowledge-item-meta">
                        <span class="knowledge-badge knowledge-badge-source">${escapeHtml(sourceTypeLabel(s.sourceType))}</span>
                        ${s.grade ? `<span class="knowledge-badge">${escapeHtml(s.grade)}</span>` : ''}
                        <span class="knowledge-state-badge ${state.hasSummary ? 'ok' : 'warn'}">${state.hasSummary ? '有摘要' : '无摘要'}</span>
                        <span class="knowledge-state-badge ${state.hasRawText ? 'ok' : 'warn'}">${state.hasRawText ? '有原文' : '无原文'}</span>
                    </div>
                </div>
                <details class="knowledge-item-menu">
                    <summary title="资料操作" aria-label="资料操作">⋯</summary>
                    <div class="knowledge-item-menu-popover">
                        <button type="button" onclick="regenerateKnowledgeSummary('${escapeHtml(s.id)}')">重新摘要</button>
                        <button type="button" onclick="editKnowledgeSource('${escapeHtml(s.id)}')">编辑</button>
                        <button type="button" class="danger" onclick="deleteKnowledgeSource('${escapeHtml(s.id)}')">删除</button>
                    </div>
                </details>
            </div>
            ${tags.length ? `<div class="knowledge-item-meta knowledge-tag-row">${tags.slice(0, 8).map(tag => `<span class="knowledge-badge">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            ${ref ? `<div class="knowledge-item-path">来源：${escapeHtml(ref)}</div>` : ''}
            ${s.summary ? `<div class="knowledge-item-content">${escapeHtml(s.summary.substring(0, 140))}${s.summary.length > 140 ? '...' : ''}</div>` : '<div class="knowledge-item-content knowledge-item-muted">未填写摘要。只保存路径时，AI 只能知道资料存在，不能理解具体内容。</div>'}
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
        <div class="knowledge-modal-scroll">
            <div class="knowledge-modal-note">
                <div>只填路径不会自动读取文件内容；AI 主要读取摘要和原文内容。</div>
                <div>Obsidian Markdown 可通过导入功能读取正文；PDF、Word、网页链接第一版只作为来源记录。</div>
            </div>
            <div class="knowledge-modal-field">
                <label>标题 *</label>
                <input type="text" id="ksTitle" class="knowledge-modal-control" placeholder="例如：2026 深圳中考政策变化整理">
            </div>
            <div class="knowledge-modal-grid">
                <div class="knowledge-modal-field">
                    <label>来源类型</label>
                    <select id="ksSourceType" class="knowledge-modal-control">
                        <option value="manual">手动录入</option>
                        <option value="obsidian">Obsidian</option>
                        <option value="file">本地文件</option>
                        <option value="url">网页链接</option>
                    </select>
                </div>
                <div class="knowledge-modal-field">
                    <label>适用年级</label>
                    <select id="ksGrade" class="knowledge-modal-control">
                        <option value="">不限</option>
                        <option value="五年级">五年级</option>
                        <option value="六年级">六年级</option>
                        <option value="初一">初一</option>
                        <option value="初二">初二</option>
                        <option value="初三">初三</option>
                        <option value="高一">高一</option>
                        <option value="高二">高二</option>
                        <option value="高三">高三</option>
                    </select>
                </div>
            </div>
            <div class="knowledge-modal-field">
                <label>标签（逗号或换行分隔）</label>
                <input type="text" id="ksTags" class="knowledge-modal-control" placeholder="小升初, 政策, 升学规划">
            </div>
            <div class="knowledge-modal-field">
                <label>来源路径 / 链接</label>
                <input type="text" id="ksSourceRef" class="knowledge-modal-control" placeholder="/Users/.../资料.md 或 https://...">
            </div>
            <div class="knowledge-modal-field">
                <label>摘要（建议填写）</label>
                <textarea id="ksSummary" rows="4" class="knowledge-modal-control" placeholder="写给 AI 看的资料摘要：关键信息、结论、适用场景..."></textarea>
                <div class="knowledge-modal-inline-actions">
                    <button class="btn btn-secondary btn-xs" type="button" onclick="generateSourceSummaryDraft()">AI 生成摘要</button>
                    <button class="btn btn-secondary btn-xs" type="button" onclick="readSourceReferenceDraft()">读取路径/链接并生成摘要</button>
                </div>
            </div>
            <div class="knowledge-modal-field">
                <label>原文 / 关键内容（可选但更有用）</label>
                <textarea id="ksRawText" rows="6" class="knowledge-modal-control" placeholder="粘贴资料正文、关键段落或可被 AI 引用的原文..."></textarea>
            </div>
            <div class="knowledge-modal-actions">
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

    const sourceType = document.getElementById('ksSourceType')?.value || 'manual';
    const ref = document.getElementById('ksSourceRef')?.value?.trim() || '';
    const payload = {
        title,
        sourceType,
        category: 'resource',
        subCategory: '',
        grade: document.getElementById('ksGrade')?.value || '',
        trustLevel: 'unknown',
        tags: splitInputList(document.getElementById('ksTags')?.value || ''),
        summary: document.getElementById('ksSummary')?.value?.trim() || '',
        rawText: document.getElementById('ksRawText')?.value?.trim() || '',
        filePath: ref,
        sourceUrl: sourceType === 'url' ? ref : '',
        status: 'active'
    };

    const method = sourceId ? 'PUT' : 'POST';
    const url = sourceId ? `/api/knowledge/sources/${sourceId}` : '/api/knowledge/sources';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        .then(payload => {
            const source = payload.source || payload;
            openSourceModal(sourceId);
            setTimeout(() => {
                document.getElementById('ksTitle').value = source.title || '';
                document.getElementById('ksSourceType').value = source.sourceType || 'manual';
                document.getElementById('ksGrade').value = source.grade || '';
                document.getElementById('ksSummary').value = source.summary || '';
                document.getElementById('ksRawText').value = source.rawText || '';
                document.getElementById('ksSourceRef').value = sourceReference(source);
                document.getElementById('ksTags').value = (source.tags || []).join(', ');
            }, 50);
        })
        .catch(() => showToast('读取失败'));
}

function deleteKnowledgeSource(sourceId) {
    if (!confirm('确定删除该资料吗？删除后 AI 将不能再引用这条资料。')) return;
    fetch(`/api/knowledge/sources/${sourceId}`, { method: 'DELETE' })
        .then(res => { if (!res.ok) throw new Error('删除失败'); return res.json(); })
        .then(() => { showToast('已删除'); loadKnowledgeSources(); loadKnowledgeSummary(); })
        .catch(() => showToast('删除失败'));
}

function postKnowledgeJson(url, payload) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    }).then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || '请求失败');
        return data;
    });
}

function sourceFormPayload() {
    const sourceType = document.getElementById('ksSourceType')?.value || 'manual';
    const ref = document.getElementById('ksSourceRef')?.value?.trim() || '';
    return {
        title: document.getElementById('ksTitle')?.value?.trim() || '',
        sourceType,
        grade: document.getElementById('ksGrade')?.value || '',
        tags: splitInputList(document.getElementById('ksTags')?.value || ''),
        sourceUrl: sourceType === 'url' ? ref : '',
        filePath: sourceType === 'url' ? '' : ref,
        url: sourceType === 'url' ? ref : '',
        rawText: document.getElementById('ksRawText')?.value?.trim() || '',
        summary: document.getElementById('ksSummary')?.value?.trim() || ''
    };
}

function fillSourceDraft(draft) {
    if (draft.title && !document.getElementById('ksTitle')?.value?.trim()) {
        document.getElementById('ksTitle').value = draft.title;
    }
    if (draft.sourceType) document.getElementById('ksSourceType').value = draft.sourceType;
    if (draft.sourceUrl) document.getElementById('ksSourceRef').value = draft.sourceUrl;
    if (draft.filePath) document.getElementById('ksSourceRef').value = draft.filePath;
    if (draft.rawText) document.getElementById('ksRawText').value = draft.rawText;
    if (draft.summary) document.getElementById('ksSummary').value = draft.summary;
}

function generateSourceSummaryDraft() {
    const payload = sourceFormPayload();
    if (!payload.rawText) {
        showToast('请先粘贴原文，或先读取路径/链接');
        return;
    }
    const btnText = 'AI 生成摘要';
    showToast('正在生成摘要...');
    postKnowledgeJson('/api/knowledge/summarize', {
        title: payload.title,
        rawText: payload.rawText
    }).then(data => {
        document.getElementById('ksSummary').value = data.summary || '';
        showToast(data.summary ? '摘要已生成，可修改后保存' : 'AI 摘要生成失败，可手动填写');
    }).catch(error => showToast(error.message || btnText + '失败'));
}

function readSourceReferenceDraft() {
    const payload = sourceFormPayload();
    if (!payload.sourceType || payload.sourceType === 'manual') {
        showToast('请选择网页链接或本地文件来源');
        return;
    }
    const ref = payload.sourceUrl || payload.filePath || payload.url;
    if (!ref) {
        showToast('请先填写路径或链接');
        return;
    }
    const url = payload.sourceType === 'url' ? '/api/knowledge/draft-url' : '/api/knowledge/draft-file';
    showToast('正在读取资料并生成摘要...');
    postKnowledgeJson(url, payload)
        .then(data => {
            fillSourceDraft(data);
            showToast('已读取资料，摘要可修改后保存');
        })
        .catch(error => showToast(error.message || '读取失败'));
}

function regenerateKnowledgeSummary(sourceId) {
    fetch(`/api/knowledge/sources/${sourceId}`)
        .then(res => res.json())
        .then(payload => {
            const source = payload.source || payload;
            if (!source.rawText) {
                showToast('这条资料没有原文，无法重新生成摘要');
                return;
            }
            showToast('正在重新生成摘要...');
            return postKnowledgeJson('/api/knowledge/summarize', {
                title: source.title,
                rawText: source.rawText
            }).then(data => {
                if (!data.summary) {
                    showToast('摘要生成失败');
                    return;
                }
                return fetch(`/api/knowledge/sources/${sourceId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ summary: data.summary })
                }).then(res => {
                    if (!res.ok) throw new Error('保存摘要失败');
                    showToast('摘要已更新');
                    loadKnowledgeSources();
                    loadKnowledgeSummary();
                });
            });
        })
        .catch(error => showToast(error.message || '重新摘要失败'));
}

function openKnowledgeImportModal(type) {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    const titles = {
        text: '粘贴原文导入',
        url: '网页地址导入',
        file: '本地文件导入',
        folder: '文件夹批量导入',
        obsidian: 'Obsidian 库导入'
    };
    titleEl.textContent = titles[type] || '导入资料';
    const gradeOptions = ['不限', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三']
        .map(item => `<option value="${item === '不限' ? '' : item}">${item}</option>`).join('');
    const isBatch = type === 'folder' || type === 'obsidian';
    bodyEl.innerHTML = `
        <div class="knowledge-modal-scroll">
            <div class="knowledge-modal-note">
                ${isBatch ? '先预览扫描结果，确认后再写入资料库；写入前会自动备份。' : '导入会读取原文并尝试生成摘要；摘要是草稿，保存后仍可编辑。'}
            </div>
            ${type === 'text' ? `
                <div class="knowledge-modal-field"><label>标题</label><input id="kiTitle" class="knowledge-modal-control" placeholder="资料标题"></div>
                <div class="knowledge-modal-field"><label>原文</label><textarea id="kiRawText" rows="10" class="knowledge-modal-control" placeholder="粘贴资料正文..."></textarea></div>
            ` : ''}
            ${type === 'url' ? `
                <div class="knowledge-modal-field"><label>网页地址</label><input id="kiUrl" class="knowledge-modal-control" placeholder="https://..."></div>
                <div class="knowledge-modal-field"><label>标题（可选）</label><input id="kiTitle" class="knowledge-modal-control" placeholder="不填则尝试读取网页标题"></div>
            ` : ''}
            ${type === 'file' ? `
                <div class="knowledge-modal-field"><label>本地文件路径（.md / .txt）</label><input id="kiFilePath" class="knowledge-modal-control" placeholder="/Users/.../资料.md"></div>
                <div class="knowledge-modal-field"><label>标题（可选）</label><input id="kiTitle" class="knowledge-modal-control" placeholder="不填则使用文件标题"></div>
            ` : ''}
            ${type === 'folder' ? `
                <div class="knowledge-modal-field"><label>文件夹路径</label><input id="kiFolderPath" class="knowledge-modal-control" placeholder="/Users/.../资料文件夹"></div>
            ` : ''}
            ${type === 'obsidian' ? `
                <div class="knowledge-modal-field"><label>Obsidian 库路径</label><input id="kiFolderPath" class="knowledge-modal-control" value="/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台"></div>
            ` : ''}
            <div class="knowledge-modal-grid">
                <div class="knowledge-modal-field"><label>适用年级</label><select id="kiGrade" class="knowledge-modal-control">${gradeOptions}</select></div>
                <div class="knowledge-modal-field"><label>标签</label><input id="kiTags" class="knowledge-modal-control" placeholder="多个用逗号分隔"></div>
            </div>
            <div id="knowledgeImportPreview" class="knowledge-import-preview is-hidden"></div>
            <div class="knowledge-modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                ${isBatch ? `<button class="btn btn-secondary" onclick="previewKnowledgeBatchImport('${type}')">预览</button><button class="btn btn-primary" onclick="applyKnowledgeBatchImport('${type}')">确认导入</button>` : `<button class="btn btn-primary" onclick="submitKnowledgeSingleImport('${type}')">导入并生成摘要</button>`}
            </div>
        </div>
    `;
    modal.classList.add('show');
}

function knowledgeImportCommonPayload() {
    return {
        title: document.getElementById('kiTitle')?.value?.trim() || '',
        rawText: document.getElementById('kiRawText')?.value?.trim() || '',
        url: document.getElementById('kiUrl')?.value?.trim() || '',
        filePath: document.getElementById('kiFilePath')?.value?.trim() || '',
        folderPath: document.getElementById('kiFolderPath')?.value?.trim() || '',
        vaultPath: document.getElementById('kiFolderPath')?.value?.trim() || '',
        grade: document.getElementById('kiGrade')?.value || '',
        tags: splitInputList(document.getElementById('kiTags')?.value || '')
    };
}

function submitKnowledgeSingleImport(type) {
    const endpoint = {
        text: '/api/knowledge/import-text',
        url: '/api/knowledge/import-url',
        file: '/api/knowledge/import-file'
    }[type];
    if (!endpoint) return;
    showToast('正在导入资料...');
    postKnowledgeJson(endpoint, knowledgeImportCommonPayload())
        .then(() => {
            closeModal();
            showToast('资料已导入');
            loadKnowledgeSources();
            loadKnowledgeSummary();
        })
        .catch(error => showToast(error.message || '导入失败'));
}

function previewKnowledgeBatchImport(type) {
    const endpoint = type === 'obsidian' ? '/api/knowledge/import-obsidian' : '/api/knowledge/import-folder';
    postKnowledgeJson(endpoint, { ...knowledgeImportCommonPayload(), mode: 'dry-run' })
        .then(renderKnowledgeImportPreview)
        .catch(error => showToast(error.message || '预览失败'));
}

function applyKnowledgeBatchImport(type) {
    const endpoint = type === 'obsidian' ? '/api/knowledge/import-obsidian' : '/api/knowledge/import-folder';
    showToast('正在导入，文件较多时会稍慢...');
    postKnowledgeJson(endpoint, { ...knowledgeImportCommonPayload(), mode: 'apply' })
        .then(data => {
            renderKnowledgeImportPreview(data);
            showToast('批量导入完成');
            loadKnowledgeSources();
            loadKnowledgeSummary();
        })
        .catch(error => showToast(error.message || '导入失败'));
}

function renderKnowledgeImportPreview(data) {
    const box = document.getElementById('knowledgeImportPreview');
    if (!box) return;
    const summary = data.summary || {};
    const preview = data.preview || [];
    box.classList.remove('is-hidden');
    box.innerHTML = `
        <div class="knowledge-result-title">导入预览 / 结果</div>
        <div>扫描 ${summary.total ?? 0} 个文件；新增 ${summary.willCreate ?? summary.created ?? 0} 条；更新 ${summary.willUpdate ?? summary.updated ?? 0} 条；失败 ${summary.failed ?? 0} 条。</div>
        ${data.backup ? `<div>自动备份：${escapeHtml(data.backup.fileName || data.backup.path || '已创建')}</div>` : ''}
        ${preview.length ? `<div class="knowledge-result-preview-list">${preview.map(item => `<div>• ${escapeHtml(item.title || '')} <span class="knowledge-result-muted">(${escapeHtml(item.action || item.relativePath || '')})</span></div>`).join('')}</div>` : ''}
        ${(summary.failedDetails || []).length ? `<details class="knowledge-result-details"><summary>失败明细</summary>${summary.failedDetails.map(item => `<div>${escapeHtml(item)}</div>`).join('')}</details>` : ''}
    `;
}

function renderKnowledgeSideImportResult(data, modeLabel = '预览') {
    const box = document.getElementById('knowledgeSideImportResult');
    if (!box) return;
    const summary = data.summary || {};
    const preview = data.preview || [];
    box.classList.remove('is-hidden');
    box.innerHTML = `
        <div class="knowledge-result-title">${escapeHtml(modeLabel)}结果</div>
        <div>扫描 ${summary.total ?? 0} 个文件；新增 ${summary.willCreate ?? summary.created ?? 0} 条；更新 ${summary.willUpdate ?? summary.updated ?? 0} 条；失败 ${summary.failed ?? 0} 条。</div>
        ${data.backup ? `<div>已自动备份：${escapeHtml(data.backup.fileName || data.backup.path || '已创建')}</div>` : ''}
        ${preview.length ? `<details class="knowledge-result-details"><summary>查看前 ${preview.length} 条</summary>${preview.slice(0, 20).map(item => `<div>• ${escapeHtml(item.title || '')}</div>`).join('')}</details>` : ''}
        ${(summary.failedDetails || []).length ? `<details class="knowledge-result-details"><summary>失败明细</summary>${summary.failedDetails.map(item => `<div>${escapeHtml(item)}</div>`).join('')}</details>` : ''}
    `;
}

function previewDefaultObsidianImport() {
    const box = document.getElementById('knowledgeSideImportResult');
    if (box) {
        box.classList.remove('is-hidden');
        box.innerHTML = '正在检查 Obsidian 资料库...';
    }
    postKnowledgeJson('/api/knowledge/import-obsidian', { mode: 'dry-run' })
        .then(data => renderKnowledgeSideImportResult(data, '预览'))
        .catch(error => {
            if (box) box.innerHTML = `检查失败：${escapeHtml(error.message || '未知错误')}`;
            showToast(error.message || '检查失败');
        });
}

function applyDefaultObsidianImport() {
    if (!confirm('将从默认 Obsidian 库导入 .md 文件，写入前会自动备份。确定继续吗？')) return;
    const box = document.getElementById('knowledgeSideImportResult');
    if (box) {
        box.classList.remove('is-hidden');
        box.innerHTML = '正在导入 Obsidian 资料库，文件较多时会稍慢...';
    }
    postKnowledgeJson('/api/knowledge/import-obsidian', { mode: 'apply' })
        .then(data => {
            renderKnowledgeSideImportResult(data, '导入');
            showToast('Obsidian 导入完成');
            loadKnowledgeSources();
            loadKnowledgeSummary();
        })
        .catch(error => {
            if (box) box.innerHTML = `导入失败：${escapeHtml(error.message || '未知错误')}`;
            showToast(error.message || '导入失败');
        });
}

function rebuildKnowledgeChunks() {
    const box = document.getElementById('knowledgeSideImportResult');
    if (box) {
        box.classList.remove('is-hidden');
        box.innerHTML = '正在重建资料引用片段...';
    }
    postKnowledgeJson('/api/knowledge/rebuild-chunks', {})
        .then(data => {
            if (box) {
                box.innerHTML = `
                    <div class="knowledge-result-title">引用片段已重建</div>
                    <div>处理资料 ${data.sources ?? 0} 条，生成引用片段 ${data.chunks ?? 0} 条。</div>
                `;
            }
            showToast('引用片段已重建');
            loadKnowledgeSummary();
        })
        .catch(error => {
            if (box) box.innerHTML = `重建失败：${escapeHtml(error.message || '未知错误')}`;
            showToast(error.message || '重建失败');
        });
}

// ========== Window 暴露 ==========
window.loadKnowledgeSources = loadKnowledgeSources;
window.openSourceModal = openSourceModal;
window.saveKnowledgeSource = saveKnowledgeSource;
window.editKnowledgeSource = editKnowledgeSource;
window.deleteKnowledgeSource = deleteKnowledgeSource;
window.generateSourceSummaryDraft = generateSourceSummaryDraft;
window.readSourceReferenceDraft = readSourceReferenceDraft;
window.regenerateKnowledgeSummary = regenerateKnowledgeSummary;
window.openKnowledgeImportModal = openKnowledgeImportModal;
window.submitKnowledgeSingleImport = submitKnowledgeSingleImport;
window.previewKnowledgeBatchImport = previewKnowledgeBatchImport;
window.applyKnowledgeBatchImport = applyKnowledgeBatchImport;
window.previewDefaultObsidianImport = previewDefaultObsidianImport;
window.applyDefaultObsidianImport = applyDefaultObsidianImport;
window.rebuildKnowledgeChunks = rebuildKnowledgeChunks;
