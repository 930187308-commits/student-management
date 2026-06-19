// ==================== 知识库管理 Stage 7C ====================

let knowledgeActiveTab = 'style';
let knowledgeSummary = null;
let questionBankItems = [];
let selectedQuestionIds = new Set();

function getApiList(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[key])) return payload[key];
    return [];
}

function splitInputList(value, separator = /[,，\n]/) {
    return String(value || '').split(separator).map(item => item.trim()).filter(Boolean);
}

// ========== 渲染知识库 ==========
function renderKnowledge() {
    const container = document.getElementById('tab-knowledge');
    if (!container) return;

    container.innerHTML = `
        <div class="knowledge-layout">
            <div class="card knowledge-header">
                <h3 style="margin:0 0 8px 0;font-size:16px;">📚 资料库后台</h3>
                <p style="margin:0;font-size:12px;color:var(--text-muted);">这里不是日常生成入口，而是给 AI 对话提供背景资料：风格库、内容素材、升学资料和题库摘要。平时想让 AI 干活，优先进入「AI 对话」。</p>
                <div style="margin-top:10px;">
                    <button class="btn btn-primary btn-sm" onclick="window.open('question-bank-b.html', '_blank')">打开数学题库</button>
                </div>
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
                <div style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">知识库还没有录入内容</div>
                <div style="font-size:12px;color:var(--text-muted);text-align:left;max-width:400px;margin:0 auto;">
                    <div style="margin-bottom:6px;">1. 可以到下方各 tab 手动新增</div>
                    <div style="margin-bottom:6px;">2. 可以先运行 dry-run 检查 Obsidian 导入：<br><code style="font-size:10px;">npm run knowledge:import-obsidian -- --dry-run</code></div>
                    <div>3. 确认后可让 Codex 执行 apply 写入知识库</div>
                </div>
            </div>

            <div class="card knowledge-obsidian-guide" id="obsidianGuideCard">
                <div style="display:flex;align-items:flex-start;gap:12px;">
                    <div style="font-size:24px;flex-shrink:0;">📦</div>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;margin-bottom:6px;">Obsidian 导入说明</div>
                        <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">
                            Obsidian 是你的素材库，不是业务数据库。导入命令：
                        </div>
                        <div style="background:var(--hover-bg);padding:8px 10px;border-radius:6px;margin-bottom:6px;">
                            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">1. 先 dry-run 预览（不写入）：</div>
                            <code style="font-size:11px;color:#27ae60;">npm run knowledge:import-obsidian -- --dry-run</code>
                        </div>
                        <div style="background:var(--hover-bg);padding:8px 10px;border-radius:6px;margin-bottom:6px;">
                            <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">2. 确认后再 apply（写入知识库）：</div>
                            <code style="font-size:11px;color:#27ae60;">npm run knowledge:import-obsidian -- --apply</code>
                        </div>
                        <div style="font-size:11px;color:var(--text-muted);">
                            默认 Obsidian 路径：<code style="font-size:10px;">/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台</code>
                        </div>
                        <div id="knowledgeImportStatus" style="font-size:11px;color:var(--text-muted);margin-top:8px;">当前知识库状态加载中...</div>
                    </div>
                </div>
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
                    <div style="font-size:11px;color:#856404;">💡 录入提示：默认风格会优先进入 AI 生成上下文。“白老师风格规则”越清楚，公众号、小红书、视频号草稿越接近你的表达方式。</div>
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
                    <div style="font-size:11px;color:#856404;">💡 录入提示：资料越具体，AI 越像真实业务助手。建议资料写清楚来源、适用年级、可信度和可直接使用的结论。</div>
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
                    <div style="font-size:11px;color:#856404;line-height:1.5;">💡 题库工作台：支持手工录入、AI 辅助整理、LaTeX 公式、SVG/图片图形、分类查询、多选组卷、生成测试卷、讲义和举一反三练习。图片公式类题目可先用截图/OCR 得到文字，再把原图链接或 SVG 草图保存在题目里。</div>
                </div>
                <div class="card question-bank-toolbar">
                    <div class="knowledge-section-header">
                        <span>📝 数学题库系统</span>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            <button class="btn btn-primary btn-sm" onclick="openQuestionModal()">+ 新增题目</button>
                            <button class="btn btn-secondary btn-sm" onclick="openQuestionAIModal()">AI 辅助录入</button>
                            <button class="btn btn-secondary btn-sm" onclick="importSampleQuestions()">导入示例题</button>
                        </div>
                    </div>
                    <div style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
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
                        <select id="questionTypeFilter" onchange="loadQuestions()" style="padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <option value="">全部题型</option>
                            <option value="计算题">计算题</option>
                            <option value="应用题">应用题</option>
                            <option value="几何题">几何题</option>
                            <option value="证明题">证明题</option>
                            <option value="选择题">选择题</option>
                            <option value="填空题">填空题</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="clearQuestionFilters()">清空筛选</button>
                    </div>
                </div>
                <div class="question-bank-grid">
                    <div class="card">
                        <div class="question-bank-panel-title">
                            <span>题目列表</span>
                            <span id="questionCountHint">0 题</span>
                        </div>
                        <div id="questionsArea" class="knowledge-list-area question-list-area"></div>
                    </div>
                    <div class="card">
                        <div class="question-bank-panel-title">
                            <span>选题篮</span>
                            <span id="selectedQuestionCount">已选 0 题</span>
                        </div>
                        <div class="question-basket-actions">
                            <button class="btn btn-secondary btn-xs" onclick="selectAllVisibleQuestions()">选中当前筛选</button>
                            <button class="btn btn-secondary btn-xs" onclick="clearSelectedQuestions()">清空</button>
                        </div>
                        <div id="selectedQuestionsArea" class="question-selected-area">暂无选中题目</div>
                    </div>
                    <div class="card">
                        <div class="question-bank-panel-title">
                            <span>输出生成</span>
                            <span>试卷 / 讲义 / 举一反三</span>
                        </div>
                        <div class="question-output-form">
                            <input id="questionOutputTitle" placeholder="标题，例如：六年级分数应用题小测" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                            <select id="questionOutputType" style="width:100%;padding:6px 8px;border:1px solid var(--border-color);border-radius:4px;">
                                <option value="paper">生成测试卷</option>
                                <option value="handout">生成讲义</option>
                                <option value="variants">生成举一反三练习</option>
                            </select>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <button class="btn btn-primary btn-sm" onclick="generateQuestionOutput()">生成输出</button>
                                <button class="btn btn-secondary btn-sm" onclick="copyQuestionOutput()">复制</button>
                                <button class="btn btn-secondary btn-sm" onclick="downloadQuestionOutput()">下载 Markdown</button>
                            </div>
                        </div>
                        <div id="questionOutputArea" class="question-output-area">先从左侧选择题目，再生成测试卷、讲义或举一反三练习。</div>
                    </div>
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
            .question-bank-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.75fr) minmax(260px, 1fr);
                gap: 12px;
                align-items: start;
            }
            .question-bank-panel-title {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid var(--border-color);
                font-size: 13px;
                font-weight: 600;
            }
            .question-list-area {
                max-height: 660px;
            }
            .question-card {
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 10px;
                margin-bottom: 8px;
                background: var(--bg-card);
            }
            .question-card.selected {
                border-color: #3498db;
                box-shadow: 0 0 0 2px rgba(52,152,219,0.12);
            }
            .question-stem-render {
                font-size: 13px;
                line-height: 1.55;
                color: var(--text-primary);
                white-space: pre-wrap;
            }
            .question-formula {
                margin-top: 6px;
                padding: 6px 8px;
                background: var(--hover-bg);
                border-radius: 6px;
                font-family: "SF Mono", Menlo, Consolas, monospace;
                font-size: 12px;
                overflow-x: auto;
            }
            .question-diagram {
                margin-top: 8px;
                padding: 8px;
                border: 1px dashed var(--border-color);
                border-radius: 6px;
                overflow-x: auto;
                background: var(--hover-bg);
            }
            .question-diagram svg {
                max-width: 100%;
                height: auto;
            }
            .question-selected-area {
                max-height: 520px;
                overflow-y: auto;
                padding: 10px 12px;
                font-size: 12px;
                color: var(--text-muted);
            }
            .question-basket-actions {
                display: flex;
                gap: 6px;
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                flex-wrap: wrap;
            }
            .question-selected-item {
                padding: 6px 0;
                border-bottom: 1px solid var(--border-color);
            }
            .question-output-form {
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                border-bottom: 1px solid var(--border-color);
            }
            .question-output-area {
                padding: 12px;
                min-height: 260px;
                max-height: 560px;
                overflow-y: auto;
                white-space: pre-wrap;
                font-size: 12px;
                line-height: 1.6;
                color: var(--text-secondary);
            }
            @media (max-width: 1100px) {
                .question-bank-grid { grid-template-columns: 1fr; }
                .question-list-area, .question-selected-area, .question-output-area { max-height: none; }
            }
            @media (max-width: 700px) {
                .knowledge-stat-grid { grid-template-columns: repeat(2, 1fr); }
                .knowledge-sub-tabs { flex-wrap: wrap; }
                .knowledge-sub-tab { font-size: 12px; padding: 8px; }
                .knowledge-obsidian-guide { padding: 12px; }
                .knowledge-obsidian-guide code { word-break: break-all; }
            }
            @media (max-width: 390px) {
                .knowledge-stat-grid { grid-template-columns: 1fr 1fr; }
            }
        </style>
    `;

    loadKnowledgeSummary();
    loadStyleProfiles();
    loadStyleSamples();
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
            const sourceCount = data.knowledgeCount ?? data.sources ?? 0;
            const styleCount = data.styleProfileCount ?? data.styleProfiles ?? 0;
            const sampleCount = data.styleSampleCount ?? data.styleSamples ?? 0;
            const questionCount = data.questionCount ?? data.questions ?? 0;
            document.getElementById('statKnowledgeCount').textContent = sourceCount;
            document.getElementById('statStyleCount').textContent = styleCount;
            document.getElementById('statSampleCount').textContent = sampleCount;
            document.getElementById('statQuestionCount').textContent = questionCount;
            const importStatus = document.getElementById('knowledgeImportStatus');
            if (importStatus) {
                importStatus.textContent = `当前已导入/录入：资料 ${sourceCount} 条，风格配置 ${styleCount} 个，风格样本 ${sampleCount} 条，题目 ${questionCount} 条。`;
            }

            // 显示空状态提示
            const total = sourceCount + styleCount + sampleCount + questionCount;
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
        .then(payload => renderStyleProfiles(getApiList(payload, 'profiles')))
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
        const defaultBadge = p.isDefault ? '<span class="knowledge-badge knowledge-badge-default">默认</span>' : '';
        const rulesText = p.rulesText || '';
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
        rulesText: document.getElementById('spRules')?.value?.trim() || '',
        forbiddenWords: splitInputList(document.getElementById('spForbidden')?.value, /\n/),
        preferredPhrases: splitInputList(document.getElementById('spPreferred')?.value, /\n/),
        isDefault: document.getElementById('spDefault')?.checked,
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
        .then(payload => {
            const profile = payload.profile || payload;
            openStyleProfileModal(profileId);
            setTimeout(() => {
                document.getElementById('spName').value = profile.name || '';
                document.getElementById('spPlatform').value = profile.platform || 'general';
                document.getElementById('spRules').value = profile.rulesText || '';
                document.getElementById('spForbidden').value = (profile.forbiddenWords || []).join('\n');
                document.getElementById('spPreferred').value = (profile.preferredPhrases || []).join('\n');
                document.getElementById('spDefault').checked = !!profile.isDefault;
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
        .then(payload => {
            let samples = getApiList(payload, 'samples');
            if (typeFilter) samples = samples.filter(item => item.sampleType === typeFilter);
            renderStyleSamples(samples);
        })
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
        const typeLabel = typeLabels[s.sampleType] || s.sampleType || '';
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
        sampleType: document.getElementById('ssType')?.value || 'article',
        content: document.getElementById('ssContent')?.value?.trim() || '',
        quality: document.getElementById('ssQuality')?.value || 'ok',
        tags,
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
        .then(payload => {
            const sample = payload.sample || payload;
            openStyleSampleModal(sampleId);
            setTimeout(() => {
                document.getElementById('ssTitle').value = sample.title || '';
                document.getElementById('ssType').value = sample.sampleType || 'article';
                document.getElementById('ssContent').value = sample.content || '';
                document.getElementById('ssQuality').value = sample.quality || 'ok';
                document.getElementById('ssTags').value = (sample.tags || []).join(', ');
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
        .then(payload => renderKnowledgeSources(getApiList(payload, 'sources')))
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
        const trustLabel = trustLabels[s.trustLevel] || s.trustLevel || '';
        const sourceTypeLabel = sourceTypeLabels[s.sourceType] || s.sourceType || '';

        return `<div class="knowledge-item">
            <div class="knowledge-item-header">
                <div>
                    <div class="knowledge-item-title">${escapeHtml(s.title || '')}</div>
                    <div class="knowledge-item-meta">
                        <span class="knowledge-badge knowledge-badge-source">${escapeHtml(categoryLabel)}</span>
                        <span class="knowledge-badge ${s.trustLevel === 'high' ? 'knowledge-badge-active' : s.trustLevel === 'low' ? 'knowledge-badge-draft' : 'knowledge-badge-archived'}">${escapeHtml(trustLabel)}</span>
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
        sourceType: document.getElementById('ksSourceType')?.value || 'manual',
        category: document.getElementById('ksCategory')?.value || 'resource',
        subCategory: document.getElementById('ksSubCategory')?.value?.trim() || '',
        grade: document.getElementById('ksGrade')?.value || '',
        trustLevel: document.getElementById('ksTrustLevel')?.value || 'unknown',
        tags,
        summary: document.getElementById('ksSummary')?.value?.trim() || '',
        rawText: document.getElementById('ksRawText')?.value?.trim() || '',
        filePath: document.getElementById('ksFilePath')?.value?.trim() || '',
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
        .then(payload => {
            const source = payload.source || payload;
            openSourceModal(sourceId);
            setTimeout(() => {
                document.getElementById('ksTitle').value = source.title || '';
                document.getElementById('ksSourceType').value = source.sourceType || 'manual';
                document.getElementById('ksCategory').value = source.category || 'resource';
                document.getElementById('ksSubCategory').value = source.subCategory || '';
                document.getElementById('ksGrade').value = source.grade || '';
                document.getElementById('ksTrustLevel').value = source.trustLevel || 'unknown';
                document.getElementById('ksSummary').value = source.summary || '';
                document.getElementById('ksRawText').value = source.rawText || '';
                document.getElementById('ksFilePath').value = source.filePath || '';
                document.getElementById('ksTags').value = (source.tags || []).join(', ');
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
    const typeFilter = document.getElementById('questionTypeFilter')?.value || '';
    let url = '/api/questions?';
    const params = [];
    if (search) params.push(`q=${encodeURIComponent(search)}`);
    if (gradeFilter) params.push(`grade=${encodeURIComponent(gradeFilter)}`);
    url += params.join('&');

    fetch(url)
        .then(res => res.json())
        .then(payload => {
            let questions = getApiList(payload, 'questions');
            if (chapterFilter) questions = questions.filter(item => item.chapter === chapterFilter);
            if (difficultyFilter) questions = questions.filter(item => item.difficulty === difficultyFilter);
            if (typeFilter) questions = questions.filter(item => item.questionType === typeFilter);
            questionBankItems = questions;
            renderQuestions(questions);
            renderSelectedQuestions();
        })
        .catch(() => renderQuestions([]));
}

function renderQuestions(questions) {
    const area = document.getElementById('questionsArea');
    if (!area) return;
    const countHint = document.getElementById('questionCountHint');
    if (countHint) countHint.textContent = `${questions?.length || 0} 题`;
    if (!questions || questions.length === 0) {
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📝</div>暂无题目<br><span style="font-size:11px;">可点击「新增题目」「AI 辅助录入」或「导入示例题」开始</span></div>`;
        return;
    }
    area.innerHTML = questions.map(q => {
        const statusBadge = q.status === 'active' ? '<span class="knowledge-badge knowledge-badge-active">已启用</span>' : q.status === 'draft' ? '<span class="knowledge-badge knowledge-badge-draft">草稿</span>' : '<span class="knowledge-badge knowledge-badge-archived">归档</span>';
        const difficultyColors = { '基础': '#27ae60', '中等': '#3498db', '提高': '#f39c12', '压轴': '#e74c3c' };
        const diffColor = difficultyColors[q.difficulty] || '#95a5a6';
        const selected = selectedQuestionIds.has(q.id);
        return `<div class="question-card ${selected ? 'selected' : ''}">
            <div class="knowledge-item-header">
                <div>
                    <label style="display:flex;gap:8px;align-items:flex-start;">
                        <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleQuestionSelection('${escapeHtml(q.id)}')">
                        <span class="knowledge-item-title">${escapeHtml((q.stem || '').substring(0, 60))}${q.stem?.length > 60 ? '...' : ''}</span>
                    </label>
                    <div class="knowledge-item-meta">
                        <span style="font-size:10px;color:var(--text-muted);">${escapeHtml(q.grade || '未填年级')} · ${escapeHtml(q.chapter || '未分章节')} · <span style="color:${diffColor};">${escapeHtml(q.difficulty || '')}</span> · ${escapeHtml(q.questionType || '')} · ${q.score || 0}分 · ${q.estimatedMinutes || 0}分钟</span>
                        ${statusBadge}
                    </div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="editQuestion('${q.id}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteQuestion('${q.id}')">删除</button>
                </div>
            </div>
            <div class="question-stem-render">${renderQuestionText(q.stem || '')}</div>
            ${q.formulaLatex ? `<div class="question-formula">LaTeX：${escapeHtml(q.formulaLatex)}</div>` : ''}
            ${q.diagramSvg ? `<div class="question-diagram">${sanitizeQuestionSvg(q.diagramSvg)}</div>` : ''}
            ${q.imageUrl ? `<div class="knowledge-item-content">图片：${escapeHtml(q.imageUrl)}</div>` : ''}
            ${q.answer ? `<div class="knowledge-item-content"><strong>答案：</strong>${escapeHtml(q.answer.substring(0, 80))}${q.answer.length > 80 ? '...' : ''}</div>` : ''}
            ${(q.knowledgePoints || []).length ? `<div class="knowledge-item-meta" style="margin-top:6px;">${q.knowledgePoints.map(k => `<span class="knowledge-badge knowledge-badge-source">${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
}

function renderQuestionText(text) {
    let html = escapeHtml(text || '');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<span class="question-image-ref">[图片：$1 · $2]</span>');
    html = html.replace(/\\\((.+?)\\\)/g, '<span class="question-formula-inline">$1</span>');
    html = html.replace(/\$\$(.+?)\$\$/gs, '<span class="question-formula-inline">$1</span>');
    return html;
}

function sanitizeQuestionSvg(svg) {
    const value = String(svg || '').trim();
    if (!/^<svg[\s>]/i.test(value)) return `<pre>${escapeHtml(value)}</pre>`;
    return value
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '');
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
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">分值</label>
                    <input type="number" id="qScore" min="0" value="5" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">预计分钟</label>
                    <input type="number" id="qEstimatedMinutes" min="0" value="5" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">变式分组</label>
                    <input type="text" id="qVariantGroup" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="如：分数应用题-单位1">
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">题干 *</label>
                <textarea id="qStem" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="题目内容..."></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">公式 LaTeX（可选）</label>
                <textarea id="qFormulaLatex" rows="2" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="例如：S=\\frac{1}{2}ah 或 x^2+3x+2=0"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">图形 SVG（可选，适合几何草图）</label>
                <textarea id="qDiagramSvg" rows="3" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="<svg width='160' height='100'>...</svg>"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">图片链接 / 本地路径（可选）</label>
                <input type="text" id="qImageUrl" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="可填写图片 URL、本地文件路径或截图存放位置">
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
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">原始输入 / OCR 文本（可选）</label>
                <textarea id="qOriginText" rows="2" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="保留截图 OCR 后的原始文本，方便以后复核"></textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">AI 辅助说明（可选）</label>
                <textarea id="qAiNotes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="AI 对题目分类、易错点、变式方向的建议"></textarea>
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

    const errorTags = splitInputList(document.getElementById('qErrorTags')?.value);

    const payload = {
        grade: document.getElementById('qGrade')?.value || '',
        system: document.getElementById('qSystem')?.value || '校内',
        chapter: document.getElementById('qChapter')?.value?.trim() || '',
        knowledgePoints: splitInputList(document.getElementById('qKnowledgePoints')?.value, /[\/,，]/),
        questionType: document.getElementById('qQuestionType')?.value?.trim() || '',
        difficulty: document.getElementById('qDifficulty')?.value || '基础',
        score: Number(document.getElementById('qScore')?.value || 0),
        estimatedMinutes: Number(document.getElementById('qEstimatedMinutes')?.value || 0),
        variantGroup: document.getElementById('qVariantGroup')?.value?.trim() || '',
        stem: stem,
        formulaLatex: document.getElementById('qFormulaLatex')?.value?.trim() || '',
        diagramSvg: document.getElementById('qDiagramSvg')?.value?.trim() || '',
        imageUrl: document.getElementById('qImageUrl')?.value?.trim() || '',
        answer: document.getElementById('qAnswer')?.value?.trim() || '',
        solution: document.getElementById('qSolution')?.value?.trim() || '',
        commonMistakes: document.getElementById('qCommonMistakes')?.value?.trim() || '',
        errorTags,
        status: document.getElementById('qStatus')?.value || 'draft',
        remark: document.getElementById('qRemark')?.value?.trim() || '',
        originText: document.getElementById('qOriginText')?.value?.trim() || '',
        aiNotes: document.getElementById('qAiNotes')?.value?.trim() || '',
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
        .then(payload => {
            const q = payload.question || payload;
            openQuestionModal(questionId);
            setTimeout(() => {
                document.getElementById('qGrade').value = q.grade || '';
                document.getElementById('qSystem').value = q.system || '校内';
                document.getElementById('qChapter').value = q.chapter || '';
                document.getElementById('qDifficulty').value = q.difficulty || '基础';
                document.getElementById('qQuestionType').value = q.questionType || '';
                document.getElementById('qScore').value = q.score || 5;
                document.getElementById('qEstimatedMinutes').value = q.estimatedMinutes || 5;
                document.getElementById('qVariantGroup').value = q.variantGroup || '';
                document.getElementById('qStem').value = q.stem || '';
                document.getElementById('qFormulaLatex').value = q.formulaLatex || '';
                document.getElementById('qDiagramSvg').value = q.diagramSvg || '';
                document.getElementById('qImageUrl').value = q.imageUrl || '';
                document.getElementById('qAnswer').value = q.answer || '';
                document.getElementById('qSolution').value = q.solution || '';
                document.getElementById('qCommonMistakes').value = q.commonMistakes || '';
                document.getElementById('qStatus').value = q.status || 'draft';
                document.getElementById('qRemark').value = q.remark || '';
                document.getElementById('qOriginText').value = q.originText || '';
                document.getElementById('qAiNotes').value = q.aiNotes || '';
                document.getElementById('qKnowledgePoints').value = (q.knowledgePoints || []).join('/');
                document.getElementById('qErrorTags').value = (q.errorTags || []).join(', ');
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

function toggleQuestionSelection(questionId) {
    if (selectedQuestionIds.has(questionId)) selectedQuestionIds.delete(questionId);
    else selectedQuestionIds.add(questionId);
    renderQuestions(questionBankItems);
    renderSelectedQuestions();
}

function selectAllVisibleQuestions() {
    questionBankItems.forEach(q => selectedQuestionIds.add(q.id));
    renderQuestions(questionBankItems);
    renderSelectedQuestions();
}

function clearSelectedQuestions() {
    selectedQuestionIds = new Set();
    renderQuestions(questionBankItems);
    renderSelectedQuestions();
}

function getSelectedQuestions() {
    const all = questionBankItems.length ? questionBankItems : [];
    return [...selectedQuestionIds].map(id => all.find(q => q.id === id)).filter(Boolean);
}

function renderSelectedQuestions() {
    const countEl = document.getElementById('selectedQuestionCount');
    const area = document.getElementById('selectedQuestionsArea');
    if (countEl) countEl.textContent = `已选 ${selectedQuestionIds.size} 题`;
    if (!area) return;
    const selected = getSelectedQuestions();
    if (selected.length === 0) {
        area.innerHTML = '暂无选中题目';
        return;
    }
    const totalScore = selected.reduce((sum, q) => sum + Number(q.score || 0), 0);
    const totalMinutes = selected.reduce((sum, q) => sum + Number(q.estimatedMinutes || 0), 0);
    area.innerHTML = `<div style="margin-bottom:8px;color:var(--text-secondary);">合计：${selected.length} 题 · ${totalScore} 分 · 约 ${totalMinutes} 分钟</div>` +
        selected.map((q, idx) => `<div class="question-selected-item">
            <div style="display:flex;justify-content:space-between;gap:8px;">
                <span>${idx + 1}. ${escapeHtml((q.stem || '').substring(0, 42))}${(q.stem || '').length > 42 ? '...' : ''}</span>
                <button class="btn btn-secondary btn-xs" onclick="toggleQuestionSelection('${escapeHtml(q.id)}')">移出</button>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">${escapeHtml(q.grade || '')} · ${escapeHtml(q.chapter || '')} · ${escapeHtml(q.difficulty || '')} · ${escapeHtml(q.questionType || '')}</div>
        </div>`).join('');
}

function clearQuestionFilters() {
    ['questionSearchInput', 'questionGradeFilter', 'questionChapterFilter', 'questionDifficultyFilter', 'questionTypeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    loadQuestions();
}

function generateQuestionOutput() {
    const selected = getSelectedQuestions();
    const output = document.getElementById('questionOutputArea');
    if (!output) return;
    if (selected.length === 0) {
        showToast('请先选择题目');
        return;
    }
    const type = document.getElementById('questionOutputType')?.value || 'paper';
    const title = document.getElementById('questionOutputTitle')?.value?.trim() || getDefaultQuestionOutputTitle(type);
    const markdown = buildQuestionOutputMarkdown(type, title, selected);
    output.textContent = markdown;
    showToast('已生成输出');
}

function getDefaultQuestionOutputTitle(type) {
    if (type === 'handout') return '数学专题讲义';
    if (type === 'variants') return '举一反三练习';
    return '数学测试卷';
}

function buildQuestionOutputMarkdown(type, title, questions) {
    const totalScore = questions.reduce((sum, q) => sum + Number(q.score || 0), 0);
    const totalMinutes = questions.reduce((sum, q) => sum + Number(q.estimatedMinutes || 0), 0);
    if (type === 'handout') return buildHandoutMarkdown(title, questions, totalMinutes);
    if (type === 'variants') return buildVariantsMarkdown(title, questions);
    return buildPaperMarkdown(title, questions, totalScore, totalMinutes);
}

function buildPaperMarkdown(title, questions, totalScore, totalMinutes) {
    return [
        `# ${title}`,
        '',
        `总分：${totalScore} 分　建议用时：${totalMinutes} 分钟`,
        '',
        '## 一、题目',
        '',
        ...questions.flatMap((q, idx) => [
            `${idx + 1}.（${q.score || 0}分｜${q.difficulty || '未标难度'}｜${q.chapter || '未分章节'}）${q.stem || ''}`,
            q.formulaLatex ? `公式：${q.formulaLatex}` : '',
            q.imageUrl ? `图片：${q.imageUrl}` : '',
            q.diagramSvg ? '[含 SVG 图形，网页端可查看]' : '',
            ''
        ].filter(Boolean)),
        '---',
        '## 二、答案与解析',
        '',
        ...questions.flatMap((q, idx) => [
            `${idx + 1}. 答案：${q.answer || '待补充'}`,
            `解析：${q.solution || '待补充'}`,
            q.commonMistakes ? `易错点：${q.commonMistakes}` : '',
            ''
        ].filter(Boolean))
    ].join('\n');
}

function buildHandoutMarkdown(title, questions, totalMinutes) {
    const grouped = {};
    questions.forEach(q => {
        const key = q.chapter || '未分章节';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(q);
    });
    const lines = [`# ${title}`, '', `建议讲解时间：${totalMinutes} 分钟`, '', '## 学习目标', '- 识别本专题核心题型。', '- 掌握常见解题步骤。', '- 记录易错点并形成复盘清单。', ''];
    Object.entries(grouped).forEach(([chapter, items]) => {
        lines.push(`## ${chapter}`);
        items.forEach((q, idx) => {
            lines.push('', `### 例题 ${idx + 1}：${(q.knowledgePoints || []).join('、') || q.questionType || '题目'}`);
            lines.push(q.stem || '');
            if (q.formulaLatex) lines.push(`公式：${q.formulaLatex}`);
            if (q.diagramSvg) lines.push('[含 SVG 图形，网页端可查看]');
            lines.push(`答案：${q.answer || '待补充'}`);
            lines.push(`讲解要点：${q.solution || '待补充'}`);
            if (q.commonMistakes) lines.push(`易错提醒：${q.commonMistakes}`);
        });
    });
    lines.push('', '## 课后复盘', '- 哪类题最容易错？', '- 错因是计算、审题、概念，还是步骤表达？', '- 下次复习优先处理哪一个问题？');
    return lines.join('\n');
}

function buildVariantsMarkdown(title, questions) {
    const lines = [`# ${title}`, '', '说明：每道原题后给出 3 个变式方向，供课堂举一反三使用。', ''];
    questions.forEach((q, idx) => {
        const kp = (q.knowledgePoints || []).join('、') || q.chapter || '当前知识点';
        lines.push(`## 原题 ${idx + 1}`);
        lines.push(q.stem || '');
        lines.push(`答案：${q.answer || '待补充'}`);
        lines.push('');
        lines.push('### 变式 1：换数字');
        lines.push(`保留题型和解法，替换关键数字，继续训练「${kp}」。`);
        lines.push('### 变式 2：换问法');
        lines.push('保留情境，改成反向求量或补充条件判断。');
        lines.push('### 变式 3：加一步');
        lines.push(`在原题基础上增加一步计算或一个干扰条件，观察学生是否真正理解「${kp}」。`);
        lines.push('');
    });
    return lines.join('\n');
}

function copyQuestionOutput() {
    const text = document.getElementById('questionOutputArea')?.textContent || '';
    if (!text || text.includes('先从左侧选择题目')) {
        showToast('暂无可复制输出');
        return;
    }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
}

function downloadQuestionOutput() {
    const text = document.getElementById('questionOutputArea')?.textContent || '';
    if (!text || text.includes('先从左侧选择题目')) {
        showToast('暂无可下载输出');
        return;
    }
    const title = document.getElementById('questionOutputTitle')?.value?.trim() || '题库输出';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已下载 Markdown');
}

function inferQuestionDraft(rawText) {
    const text = String(rawText || '').trim();
    const grade = /初一|七年级/.test(text) ? '初一' : /初二|八年级/.test(text) ? '初二' : /初三|九年级|中考/.test(text) ? '初三' : /六年级|小升初/.test(text) ? '六年级' : '';
    const chapter = /几何|三角形|圆|面积|角|线段/.test(text) ? '几何' : /方程|代数|未知数|x/.test(text) ? '代数' : /应用|行程|工程|浓度|利润|比例/.test(text) ? '应用题' : '计算';
    const questionType = /证明/.test(text) ? '证明题' : /选择|A\.|B\.|C\.|D\./.test(text) ? '选择题' : /填空/.test(text) ? '填空题' : chapter === '几何' ? '几何题' : chapter === '应用题' ? '应用题' : '计算题';
    const difficulty = /压轴|综合|证明|分类讨论/.test(text) ? '压轴' : /提高|拓展|变式/.test(text) ? '提高' : /基础|计算/.test(text) ? '基础' : '中等';
    const formula = (text.match(/(?:公式|LaTeX|latex)[:：]?\s*([^\n]+)/i) || [])[1] || '';
    const knowledgePoints = [];
    ['分数', '比例', '方程', '行程', '几何', '面积', '有理数', '一次函数', '二次函数', '圆'].forEach(k => {
        if (text.includes(k)) knowledgePoints.push(k);
    });
    return {
        grade,
        system: grade === '六年级' ? '小升初' : '校内',
        chapter,
        questionType,
        difficulty,
        knowledgePoints,
        formulaLatex: formula,
        stem: text.replace(/答案[:：][\s\S]*$/m, '').trim(),
        answer: (text.match(/答案[:：]\s*([^\n]+)/) || [])[1] || '',
        solution: (text.match(/解析[:：]\s*([\s\S]+)/) || [])[1] || '',
        commonMistakes: '',
        errorTags: [],
        score: difficulty === '压轴' ? 10 : difficulty === '提高' ? 8 : 5,
        estimatedMinutes: difficulty === '压轴' ? 12 : difficulty === '提高' ? 8 : 5,
        status: 'active',
        originText: text,
        aiNotes: '由 AI 辅助录入入口按规则预分类，请保存前人工核对。'
    };
}

function openQuestionAIModal() {
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!modal || !titleEl || !bodyEl) return;
    titleEl.textContent = 'AI 辅助录入题目';
    bodyEl.innerHTML = `
        <div style="max-height:560px;overflow-y:auto;">
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:10px;">把截图 OCR 文本、手打题目、含 LaTeX 的题目粘贴到下面。系统会先做本地结构化预填，并尝试调用真实 AI 生成分类、易错点和变式建议；接口不可用时自动保留本地预填。</div>
            <textarea id="aiQuestionRawText" rows="9" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="例：六年级 分数应用题\\n一项工程，甲单独做需要12天，乙单独做需要18天。两人合作多少天完成？\\n答案：36/5天\\n解析：工作效率相加..."></textarea>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button id="aiQuestionApplyBtn" class="btn btn-primary" onclick="applyAIQuestionDraft()">生成预填并编辑</button>
            </div>
        </div>
    `;
    modal.classList.add('show');
}

async function applyAIQuestionDraft() {
    const raw = document.getElementById('aiQuestionRawText')?.value?.trim();
    if (!raw) {
        showToast('请先粘贴题目文本');
        return;
    }
    const btn = document.getElementById('aiQuestionApplyBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中...';
    }
    const draft = inferQuestionDraft(raw);
    try {
        const res = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent: 'teaching-agent',
                task: 'question-classify',
                userInstruction: raw,
                privacyMode: 'masked',
                fallbackOnError: true
            })
        });
        const response = await res.json().catch(() => ({}));
        if (res.ok && response.result) {
            const modeLabel = response.mode === 'real-ai' ? '真实 AI' : '本地模板';
            draft.aiNotes = `${modeLabel} 分类建议：\n${response.result}`;
        } else if (response.error || response.message) {
            draft.aiNotes = `${draft.aiNotes}\nAI 接口提示：${response.error || response.message}`;
        }
    } catch (error) {
        draft.aiNotes = `${draft.aiNotes}\nAI 接口暂不可用，已使用本地规则预填。`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '生成预填并编辑';
        }
    }
    closeModal();
    openQuestionModal();
    setTimeout(() => fillQuestionModal(draft), 80);
}

function fillQuestionModal(q) {
    document.getElementById('qGrade').value = q.grade || '';
    document.getElementById('qSystem').value = q.system || '校内';
    document.getElementById('qChapter').value = q.chapter || '';
    document.getElementById('qDifficulty').value = q.difficulty || '基础';
    document.getElementById('qQuestionType').value = q.questionType || '';
    document.getElementById('qScore').value = q.score || 5;
    document.getElementById('qEstimatedMinutes').value = q.estimatedMinutes || 5;
    document.getElementById('qVariantGroup').value = q.variantGroup || '';
    document.getElementById('qStem').value = q.stem || '';
    document.getElementById('qFormulaLatex').value = q.formulaLatex || '';
    document.getElementById('qDiagramSvg').value = q.diagramSvg || '';
    document.getElementById('qImageUrl').value = q.imageUrl || '';
    document.getElementById('qAnswer').value = q.answer || '';
    document.getElementById('qSolution').value = q.solution || '';
    document.getElementById('qCommonMistakes').value = q.commonMistakes || '';
    document.getElementById('qStatus').value = q.status || 'active';
    document.getElementById('qRemark').value = q.remark || '';
    document.getElementById('qOriginText').value = q.originText || '';
    document.getElementById('qAiNotes').value = q.aiNotes || '';
    document.getElementById('qKnowledgePoints').value = (q.knowledgePoints || []).join('/');
    document.getElementById('qErrorTags').value = (q.errorTags || []).join(', ');
}

function getSampleQuestions() {
    return [
        {
            id: 'sample-q-fraction-work-01',
            grade: '六年级',
            system: '小升初',
            chapter: '应用题',
            knowledgePoints: ['工程问题', '分数应用题', '单位1'],
            questionType: '应用题',
            difficulty: '中等',
            score: 8,
            estimatedMinutes: 8,
            variantGroup: '工程问题-效率相加',
            stem: '一项工程，甲单独做需要12天完成，乙单独做需要18天完成。两人合作，多少天可以完成？',
            formulaLatex: '1 \\div (\\frac{1}{12}+\\frac{1}{18})',
            answer: '36/5天',
            solution: '甲的效率是1/12，乙的效率是1/18，合作效率为1/12+1/18=5/36，所以合作完成需要36/5天。',
            commonMistakes: '把时间直接相加，或忘记先求工作效率。',
            errorTags: ['单位1', '效率理解'],
            status: 'active',
            remark: '适合小升初分数应用题训练。'
        },
        {
            id: 'sample-q-geometry-svg-01',
            grade: '初一',
            system: '校内',
            chapter: '几何',
            knowledgePoints: ['线段', '面积', '三角形'],
            questionType: '几何题',
            difficulty: '基础',
            score: 6,
            estimatedMinutes: 6,
            variantGroup: '三角形面积-底高',
            stem: '如图，三角形ABC中，BC=8cm，点A到BC的高为5cm，求三角形ABC的面积。',
            formulaLatex: 'S=\\frac{1}{2}ah',
            diagramSvg: '<svg width="180" height="120" viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg"><line x1="25" y1="100" x2="155" y2="100" stroke="#333" stroke-width="2"/><line x1="25" y1="100" x2="80" y2="20" stroke="#333" stroke-width="2"/><line x1="80" y1="20" x2="155" y2="100" stroke="#333" stroke-width="2"/><line x1="80" y1="20" x2="80" y2="100" stroke="#e74c3c" stroke-dasharray="4 3"/><text x="75" y="16" font-size="12">A</text><text x="18" y="112" font-size="12">B</text><text x="158" y="112" font-size="12">C</text><text x="88" y="62" font-size="12" fill="#e74c3c">5</text><text x="82" y="116" font-size="12">8</text></svg>',
            answer: '20平方厘米',
            solution: '三角形面积=底×高÷2=8×5÷2=20平方厘米。',
            commonMistakes: '忘记除以2，或把斜边当作高。',
            errorTags: ['公式套用', '高的识别'],
            status: 'active'
        },
        {
            id: 'sample-q-equation-01',
            grade: '初一',
            system: '校内',
            chapter: '代数',
            knowledgePoints: ['一元一次方程', '移项', '合并同类项'],
            questionType: '计算题',
            difficulty: '基础',
            score: 5,
            estimatedMinutes: 5,
            variantGroup: '一元一次方程-移项',
            stem: '解方程：3x-5=16。',
            formulaLatex: '3x-5=16',
            answer: 'x=7',
            solution: '两边同时加5，得3x=21，两边同时除以3，得x=7。',
            commonMistakes: '移项变号错误，或最后没有除以系数。',
            errorTags: ['移项', '系数处理'],
            status: 'active'
        },
        {
            id: 'sample-q-ratio-01',
            grade: '六年级',
            system: '小升初',
            chapter: '应用题',
            knowledgePoints: ['比例', '行程问题', '相遇问题'],
            questionType: '应用题',
            difficulty: '提高',
            score: 10,
            estimatedMinutes: 10,
            variantGroup: '行程问题-相遇',
            stem: '甲、乙两车同时从相距330千米的两地相向而行，甲车每小时60千米，乙车每小时50千米。几小时后两车相遇？',
            formulaLatex: '330 \\div (60+50)',
            answer: '3小时',
            solution: '相遇时间=总路程÷速度和=330÷(60+50)=3小时。',
            commonMistakes: '相向而行应使用速度和，不是速度差。',
            errorTags: ['速度和', '相遇模型'],
            status: 'active'
        },
        {
            id: 'sample-q-quadratic-factor-01',
            grade: '初三',
            system: '中考',
            chapter: '代数',
            knowledgePoints: ['二次方程', '因式分解'],
            questionType: '计算题',
            difficulty: '中等',
            score: 8,
            estimatedMinutes: 8,
            variantGroup: '二次方程-因式分解',
            stem: '解方程：x²-5x+6=0。',
            formulaLatex: 'x^2-5x+6=0',
            answer: 'x=2或x=3',
            solution: '原方程可化为(x-2)(x-3)=0，所以x=2或x=3。',
            commonMistakes: '因式分解符号错误，或漏写一个根。',
            errorTags: ['因式分解', '漏解'],
            status: 'active'
        }
    ];
}

function importSampleQuestions() {
    const samples = getSampleQuestions();
    let success = 0;
    let failed = 0;
    Promise.all(samples.map(item => fetch(`/api/questions/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    }).then(res => {
        if (!res.ok) throw new Error(item.id);
        success += 1;
    }).catch(() => { failed += 1; }))).then(() => {
        showToast(`示例题导入完成：成功 ${success} 题${failed ? `，失败 ${failed} 题` : ''}`);
        loadQuestions();
        loadKnowledgeSummary();
    });
}

// ========== 辅助函数 ==========
function copyKnowledgeText(btn, itemId) {
    const item = btn.closest('.knowledge-item');
    const contentEl = item?.querySelector('.knowledge-item-content');
    const text = contentEl?.getAttribute('data-full-text') || contentEl?.innerText;
    if (!text) { showToast('无内容可复制'); return; }
    navigator.clipboard.writeText(text).then(() => showToast('已复制')).catch(() => showToast('复制失败'));
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

                    <div class="card" id="knowledgeEmptyHint" style="display:none;padding:16px;text-align:center;">
                        <div style="font-size:28px;margin-bottom:8px;">📭</div>
                        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">资料库还没有可用资料</div>
                        <div style="font-size:12px;color:var(--text-muted);">可以手动新增资料，或先从 Obsidian dry-run 检查后再导入。</div>
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
                        <div id="knowledgeSideImportResult" class="knowledge-side-result" style="display:none;"></div>
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
                padding: 0;
            }
            .knowledge-simple .knowledge-stat-grid {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 0;
            }
            .knowledge-simple .knowledge-stat-item {
                min-height: 58px;
                padding: 11px 14px;
                border-right: 1px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                background: transparent;
                border-radius: 0;
            }
            .knowledge-simple .knowledge-stat-item:last-child {
                border-right: none;
            }
            .knowledge-simple .knowledge-stat-num {
                font-size: 22px;
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
            .knowledge-simple-title-row {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
            }
            .knowledge-guide-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
                gap: 14px;
                align-items: start;
            }
            .knowledge-guide-grid.compact {
                grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
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
            .knowledge-command-box {
                background: var(--hover-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 10px 12px;
            }
            .knowledge-command-box code {
                display: block;
                color: #27ae60;
                font-size: 11px;
                white-space: normal;
                word-break: break-all;
            }
            .knowledge-filter-row {
                padding: 8px 0;
                display: grid;
                grid-template-columns: minmax(180px, 1fr) 150px 150px;
                gap: 8px;
                align-items: center;
            }
            .knowledge-filter-row input,
            .knowledge-filter-row select {
                padding: 7px 8px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background: var(--card-bg);
                color: var(--text-primary);
            }
            .knowledge-source-note {
                font-size: 11px;
                color: var(--text-muted);
                background: var(--hover-bg);
                border-radius: 6px;
                padding: 7px 9px;
                margin-bottom: 8px;
            }
            .knowledge-item-path {
                font-size: 11px;
                color: var(--text-muted);
                margin-top: 6px;
                word-break: break-all;
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
                .knowledge-page-grid,
                .knowledge-simple-title-row,
                .knowledge-guide-grid {
                    grid-template-columns: 1fr;
                    display: grid;
                }
                .knowledge-side-col {
                    position: static;
                }
                .knowledge-import-grid {
                    grid-template-columns: 1fr 1fr;
                }
                .knowledge-simple .knowledge-stat-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .knowledge-simple .knowledge-stat-item:nth-child(2),
                .knowledge-simple .knowledge-stat-item:nth-child(4) {
                    border-right: none;
                }
                .knowledge-simple .knowledge-stat-item:nth-child(1),
                .knowledge-simple .knowledge-stat-item:nth-child(2),
                .knowledge-simple .knowledge-stat-item:nth-child(3),
                .knowledge-simple .knowledge-stat-item:nth-child(4) {
                    border-bottom: 1px solid var(--border-color);
                }
                .knowledge-filter-row {
                    grid-template-columns: 1fr;
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
            if (emptyHint) emptyHint.style.display = total === 0 ? 'block' : 'none';
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
        area.innerHTML = `<div class="knowledge-empty"><div class="knowledge-empty-icon">📄</div>暂无资料<br><span style="font-size:11px;">点击右上角「新增资料」开始录入</span></div>`;
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
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="regenerateKnowledgeSummary('${escapeHtml(s.id)}')">重新摘要</button>
                    <button class="btn btn-secondary btn-xs" onclick="editKnowledgeSource('${escapeHtml(s.id)}')">编辑</button>
                    <button class="btn btn-danger btn-xs" onclick="deleteKnowledgeSource('${escapeHtml(s.id)}')">删除</button>
                </div>
            </div>
            ${tags.length ? `<div class="knowledge-item-meta" style="margin-top:6px;">${tags.slice(0, 8).map(tag => `<span class="knowledge-badge">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
            ${ref ? `<div class="knowledge-item-path">来源：${escapeHtml(ref)}</div>` : ''}
            ${s.summary ? `<div class="knowledge-item-content">${escapeHtml(s.summary.substring(0, 140))}${s.summary.length > 140 ? '...' : ''}</div>` : '<div class="knowledge-item-content" style="color:var(--text-muted);">未填写摘要。只保存路径时，AI 只能知道资料存在，不能理解具体内容。</div>'}
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
        <div style="max-height:560px;overflow-y:auto;">
            <div style="background:var(--hover-bg);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary);line-height:1.6;">
                <div>只填路径不会自动读取文件内容；AI 主要读取摘要和原文内容。</div>
                <div>Obsidian Markdown 可通过导入功能读取正文；PDF、Word、网页链接第一版只作为来源记录。</div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标题 *</label>
                <input type="text" id="ksTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="例如：2026 深圳中考政策变化整理">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">来源类型</label>
                    <select id="ksSourceType" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
                        <option value="manual">手动录入</option>
                        <option value="obsidian">Obsidian</option>
                        <option value="file">本地文件</option>
                        <option value="url">网页链接</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">适用年级</label>
                    <select id="ksGrade" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">
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
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">标签（逗号或换行分隔）</label>
                <input type="text" id="ksTags" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="小升初, 政策, 升学规划">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">来源路径 / 链接</label>
                <input type="text" id="ksSourceRef" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="/Users/.../资料.md 或 https://...">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">摘要（建议填写）</label>
                <textarea id="ksSummary" rows="4" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="写给 AI 看的资料摘要：关键信息、结论、适用场景..."></textarea>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-xs" type="button" onclick="generateSourceSummaryDraft()">AI 生成摘要</button>
                    <button class="btn btn-secondary btn-xs" type="button" onclick="readSourceReferenceDraft()">读取路径/链接并生成摘要</button>
                </div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:13px;font-weight:600;margin-bottom:4px;display:block;">原文 / 关键内容（可选但更有用）</label>
                <textarea id="ksRawText" rows="6" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="粘贴资料正文、关键段落或可被 AI 引用的原文..."></textarea>
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
        <div style="max-height:560px;overflow-y:auto;">
            <div style="background:var(--hover-bg);border:1px solid var(--border-color);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary);line-height:1.6;">
                ${isBatch ? '先预览扫描结果，确认后再写入资料库；写入前会自动备份。' : '导入会读取原文并尝试生成摘要；摘要是草稿，保存后仍可编辑。'}
            </div>
            ${type === 'text' ? `
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">标题</label><input id="kiTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="资料标题"></div>
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">原文</label><textarea id="kiRawText" rows="10" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;resize:vertical;" placeholder="粘贴资料正文..."></textarea></div>
            ` : ''}
            ${type === 'url' ? `
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">网页地址</label><input id="kiUrl" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="https://..."></div>
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">标题（可选）</label><input id="kiTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="不填则尝试读取网页标题"></div>
            ` : ''}
            ${type === 'file' ? `
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">本地文件路径（.md / .txt）</label><input id="kiFilePath" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="/Users/.../资料.md"></div>
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">标题（可选）</label><input id="kiTitle" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="不填则使用文件标题"></div>
            ` : ''}
            ${type === 'folder' ? `
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">文件夹路径</label><input id="kiFolderPath" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="/Users/.../资料文件夹"></div>
            ` : ''}
            ${type === 'obsidian' ? `
                <div style="margin-bottom:10px;"><label style="font-size:13px;font-weight:600;">Obsidian 库路径</label><input id="kiFolderPath" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" value="/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台"></div>
            ` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div><label style="font-size:13px;font-weight:600;">适用年级</label><select id="kiGrade" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;">${gradeOptions}</select></div>
                <div><label style="font-size:13px;font-weight:600;">标签</label><input id="kiTags" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;" placeholder="多个用逗号分隔"></div>
            </div>
            <div id="knowledgeImportPreview" style="display:none;margin:10px 0;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--hover-bg);font-size:12px;color:var(--text-secondary);line-height:1.6;"></div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px;">
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
    box.style.display = 'block';
    box.innerHTML = `
        <div style="font-weight:600;color:var(--text-primary);margin-bottom:6px;">导入预览 / 结果</div>
        <div>扫描 ${summary.total ?? 0} 个文件；新增 ${summary.willCreate ?? summary.created ?? 0} 条；更新 ${summary.willUpdate ?? summary.updated ?? 0} 条；失败 ${summary.failed ?? 0} 条。</div>
        ${data.backup ? `<div>自动备份：${escapeHtml(data.backup.fileName || data.backup.path || '已创建')}</div>` : ''}
        ${preview.length ? `<div style="margin-top:8px;max-height:180px;overflow:auto;">${preview.map(item => `<div>• ${escapeHtml(item.title || '')} <span style="color:var(--text-muted);">(${escapeHtml(item.action || item.relativePath || '')})</span></div>`).join('')}</div>` : ''}
        ${(summary.failedDetails || []).length ? `<details style="margin-top:8px;"><summary>失败明细</summary>${summary.failedDetails.map(item => `<div>${escapeHtml(item)}</div>`).join('')}</details>` : ''}
    `;
}

function renderKnowledgeSideImportResult(data, modeLabel = '预览') {
    const box = document.getElementById('knowledgeSideImportResult');
    if (!box) return;
    const summary = data.summary || {};
    const preview = data.preview || [];
    box.style.display = 'block';
    box.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(modeLabel)}结果</div>
        <div>扫描 ${summary.total ?? 0} 个文件；新增 ${summary.willCreate ?? summary.created ?? 0} 条；更新 ${summary.willUpdate ?? summary.updated ?? 0} 条；失败 ${summary.failed ?? 0} 条。</div>
        ${data.backup ? `<div>已自动备份：${escapeHtml(data.backup.fileName || data.backup.path || '已创建')}</div>` : ''}
        ${preview.length ? `<details style="margin-top:6px;"><summary>查看前 ${preview.length} 条</summary>${preview.slice(0, 20).map(item => `<div>• ${escapeHtml(item.title || '')}</div>`).join('')}</details>` : ''}
        ${(summary.failedDetails || []).length ? `<details style="margin-top:6px;"><summary>失败明细</summary>${summary.failedDetails.map(item => `<div>${escapeHtml(item)}</div>`).join('')}</details>` : ''}
    `;
}

function previewDefaultObsidianImport() {
    const box = document.getElementById('knowledgeSideImportResult');
    if (box) {
        box.style.display = 'block';
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
        box.style.display = 'block';
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
        box.style.display = 'block';
        box.innerHTML = '正在重建资料引用片段...';
    }
    postKnowledgeJson('/api/knowledge/rebuild-chunks', {})
        .then(data => {
            if (box) {
                box.innerHTML = `
                    <div style="font-weight:700;margin-bottom:4px;">引用片段已重建</div>
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
window.loadQuestions = loadQuestions;
window.openQuestionModal = openQuestionModal;
window.saveQuestion = saveQuestion;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;
window.toggleQuestionSelection = toggleQuestionSelection;
window.selectAllVisibleQuestions = selectAllVisibleQuestions;
window.clearSelectedQuestions = clearSelectedQuestions;
window.clearQuestionFilters = clearQuestionFilters;
window.generateQuestionOutput = generateQuestionOutput;
window.copyQuestionOutput = copyQuestionOutput;
window.downloadQuestionOutput = downloadQuestionOutput;
window.openQuestionAIModal = openQuestionAIModal;
window.applyAIQuestionDraft = applyAIQuestionDraft;
window.importSampleQuestions = importSampleQuestions;
window.copyKnowledgeText = copyKnowledgeText;
