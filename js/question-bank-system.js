let qbQuestions = [];
let qbFiltered = [];
let qbBasketIds = new Set();
let qbSortMode = 'updated';

const QB_GRADES = ['六年级', '初一', '初二', '初三'];
const QB_CHAPTERS = ['计算', '应用题', '几何', '代数', '函数', '统计概率'];
const QB_TYPES = ['选择题', '填空题', '计算题', '应用题', '几何题', '证明题', '综合题'];
const QB_DIFFICULTIES = ['基础', '中等', '提高', '压轴'];

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toast(message) {
    const el = document.getElementById('qbToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window._qbToastTimer);
    window._qbToastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function uniq(values) {
    return [...new Set(values.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function splitList(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    return String(value || '').split(/[、,，/]/).map(item => item.trim()).filter(Boolean);
}

function optionHtml(items, placeholder, selected = '') {
    return [`<option value="">${escapeHtml(placeholder)}</option>`]
        .concat(items.map(item => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`))
        .join('');
}

function normalizeDifficulty(difficulty) {
    const value = String(difficulty || '').trim();
    if (value === 'basic') return '基础';
    if (value === 'medium') return '中等';
    if (value === 'hard') return '提高';
    return value || '中等';
}

function difficultyWeight(difficulty) {
    return { '基础': 1, '中等': 2, '提高': 3, '压轴': 4 }[normalizeDifficulty(difficulty)] || 2;
}

function difficultyBadgeClass(difficulty) {
    const value = normalizeDifficulty(difficulty);
    if (value === '基础') return 'green';
    if (value === '中等') return 'blue';
    if (value === '提高') return 'orange';
    if (value === '压轴') return 'red';
    return '';
}

async function loadQuestionBank() {
    try {
        const res = await fetch('/api/questions');
        if (!res.ok) throw new Error('题库接口异常');
        const payload = await res.json();
        qbQuestions = (payload.questions || []).map(q => ({ ...q, difficulty: normalizeDifficulty(q.difficulty) }));
        qbQuestions.forEach(q => {
            if (q.id && q.status !== 'archived') qbBasketIds.delete(q.id);
        });
        renderFilterOptions();
        applyFilters();
        renderKpis();
        renderBasket();
    } catch (error) {
        document.getElementById('questionList').innerHTML = `<div class="qb-empty">题库加载失败：${escapeHtml(error.message)}</div>`;
    }
}

function renderFilterOptions() {
    const grades = uniq([...QB_GRADES, ...qbQuestions.map(q => q.grade)]);
    const chapters = uniq([...QB_CHAPTERS, ...qbQuestions.map(q => q.chapter)]);
    const types = uniq([...QB_TYPES, ...qbQuestions.map(q => q.questionType)]);
    const difficulties = uniq([...QB_DIFFICULTIES, ...qbQuestions.map(q => normalizeDifficulty(q.difficulty))]);
    const knowledge = uniq(qbQuestions.flatMap(q => q.knowledgePoints || []));
    setSelectOptions('filterGrade', grades, '全部年级');
    setSelectOptions('filterChapter', chapters, '全部章节');
    setSelectOptions('filterKnowledge', knowledge, '全部知识点');
    setSelectOptions('filterType', types, '全部题型');
    setSelectOptions('filterDifficulty', difficulties, '全部难度');
}

function setSelectOptions(id, items, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = optionHtml(items, placeholder, current);
    if (items.includes(current)) el.value = current;
}

function renderKpis() {
    const active = qbQuestions.filter(q => q.status !== 'archived');
    const withFormula = active.filter(q => q.formulaLatex).length;
    const withDiagram = active.filter(q => q.diagramSvg || q.imageUrl).length;
    const withSolution = active.filter(q => q.solution).length;
    const chapters = uniq(active.map(q => q.chapter)).length;
    const hard = active.filter(q => ['提高', '压轴'].includes(normalizeDifficulty(q.difficulty))).length;
    const kpis = [
        ['总题量', active.length],
        ['章节数', chapters],
        ['含公式', withFormula],
        ['含图形', withDiagram],
        ['有解析', withSolution],
        ['提高/压轴', hard],
    ];
    document.getElementById('qbKpis').innerHTML = kpis.map(([label, num]) => `
        <div class="qb-kpi"><div class="qb-kpi-num">${num}</div><div class="qb-kpi-label">${escapeHtml(label)}</div></div>
    `).join('');
}

function getFilterValues() {
    return {
        search: document.getElementById('filterSearch')?.value.trim().toLowerCase() || '',
        grade: document.getElementById('filterGrade')?.value || '',
        chapter: document.getElementById('filterChapter')?.value || '',
        knowledge: document.getElementById('filterKnowledge')?.value || '',
        type: document.getElementById('filterType')?.value || '',
        difficulty: document.getElementById('filterDifficulty')?.value || '',
        status: document.getElementById('filterStatus')?.value || '',
        formula: document.getElementById('filterFormula')?.checked || false,
        diagram: document.getElementById('filterDiagram')?.checked || false,
        solution: document.getElementById('filterSolution')?.checked || false,
        mistake: document.getElementById('filterMistake')?.checked || false,
    };
}

function applyFilters() {
    const f = getFilterValues();
    qbFiltered = qbQuestions.filter(q => {
        const haystack = [
            q.stem, q.answer, q.solution, q.chapter, q.questionType, q.difficulty,
            ...(q.knowledgePoints || []), ...(q.errorTags || [])
        ].join(' ').toLowerCase();
        if (f.search && !haystack.includes(f.search)) return false;
        if (f.grade && q.grade !== f.grade) return false;
        if (f.chapter && q.chapter !== f.chapter) return false;
        if (f.knowledge && !(q.knowledgePoints || []).includes(f.knowledge)) return false;
        if (f.type && q.questionType !== f.type) return false;
        if (f.difficulty && normalizeDifficulty(q.difficulty) !== f.difficulty) return false;
        if (f.status && q.status !== f.status) return false;
        if (f.formula && !q.formulaLatex) return false;
        if (f.diagram && !(q.diagramSvg || q.imageUrl)) return false;
        if (f.solution && !q.solution) return false;
        if (f.mistake && !q.commonMistakes) return false;
        return true;
    });
    sortQuestionArray(qbFiltered);
    renderQuestions();
}

function sortQuestions(mode) {
    qbSortMode = mode;
    applyFilters();
}

function sortQuestionArray(items) {
    if (qbSortMode === 'difficulty') {
        items.sort((a, b) => difficultyWeight(b.difficulty) - difficultyWeight(a.difficulty));
    } else {
        items.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    }
}

function renderQuestions() {
    document.getElementById('questionCountText').textContent = `${qbFiltered.length} 题`;
    document.getElementById('filterSummary').textContent = buildFilterSummary();
    const list = document.getElementById('questionList');
    if (!qbFiltered.length) {
        list.innerHTML = '<div class="qb-empty">当前筛选下没有题目。可以放宽筛选，或者用 AI 辅助录入补充题目。</div>';
        return;
    }
    list.innerHTML = qbFiltered.map(q => renderQuestionCard(q)).join('');
}

function buildFilterSummary() {
    const f = getFilterValues();
    const parts = [f.grade, f.chapter, f.knowledge, f.type, f.difficulty].filter(Boolean);
    if (f.formula) parts.push('含公式');
    if (f.diagram) parts.push('含图形');
    return parts.length ? parts.join(' / ') : '全部题目';
}

function renderQuestionCard(q) {
    const selected = qbBasketIds.has(q.id);
    const badges = [
        q.grade, q.chapter, q.questionType, normalizeDifficulty(q.difficulty), `${Number(q.score || 0)}分`, `${Number(q.estimatedMinutes || 0)}分钟`
    ].filter(Boolean);
    return `<article class="qb-card ${selected ? 'selected' : ''}">
        <div class="qb-card-top">
            <div style="min-width:0;">
                <div class="qb-card-title">${escapeHtml(q.stem || '未填写题干').slice(0, 90)}${(q.stem || '').length > 90 ? '...' : ''}</div>
                <div class="qb-meta">
                    ${badges.map(item => `<span class="qb-badge ${item === normalizeDifficulty(q.difficulty) ? difficultyBadgeClass(item) : ''}">${escapeHtml(item)}</span>`).join('')}
                    ${q.formulaLatex ? '<span class="qb-badge blue">公式</span>' : ''}
                    ${(q.diagramSvg || q.imageUrl) ? '<span class="qb-badge orange">图形</span>' : ''}
                    ${q.solution ? '<span class="qb-badge green">解析</span>' : ''}
                </div>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">
                <button class="qb-btn small ${selected ? '' : 'primary'}" onclick="toggleBasket('${escapeHtml(q.id)}')">${selected ? '移出' : '加入'}</button>
                <button class="qb-btn small" onclick="openQuestionEditor('${escapeHtml(q.id)}')">编辑</button>
            </div>
        </div>
        <div class="qb-stem">${renderQuestionText(q.stem)}</div>
        ${q.formulaLatex ? `<div class="qb-formula">LaTeX：${escapeHtml(q.formulaLatex)}</div>` : ''}
        ${q.diagramSvg ? `<div class="qb-diagram">${sanitizeSvg(q.diagramSvg)}</div>` : ''}
        ${q.imageUrl ? `<div class="qb-answer">图片/附件：${escapeHtml(q.imageUrl)}</div>` : ''}
        ${(q.knowledgePoints || []).length ? `<div class="qb-meta">${q.knowledgePoints.map(k => `<span class="qb-badge">${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        ${q.answer ? `<div class="qb-answer"><strong>答案：</strong>${escapeHtml(q.answer)}</div>` : ''}
    </article>`;
}

function renderQuestionText(text) {
    return escapeHtml(text).replace(/\\\((.+?)\\\)/g, '<span class="qb-badge blue">$1</span>').replace(/\n/g, '<br>');
}

function sanitizeSvg(svg) {
    const value = String(svg || '').trim();
    if (!/^<svg[\s>]/i.test(value)) return `<pre>${escapeHtml(value)}</pre>`;
    return value
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '');
}

function resetFilters() {
    ['filterSearch', 'filterGrade', 'filterChapter', 'filterKnowledge', 'filterType', 'filterDifficulty', 'filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['filterFormula', 'filterDiagram', 'filterSolution', 'filterMistake'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    applyFilters();
}

function quickFilter(values) {
    resetFilters();
    if (values.grade) document.getElementById('filterGrade').value = values.grade;
    if (values.chapter) document.getElementById('filterChapter').value = values.chapter;
    if (values.difficulty) document.getElementById('filterDifficulty').value = values.difficulty;
    if (values.hasDiagram) document.getElementById('filterDiagram').checked = true;
    applyFilters();
}

function selectFilteredQuestions() {
    qbFiltered.forEach(q => qbBasketIds.add(q.id));
    renderQuestions();
    renderBasket();
    toast(`已加入 ${qbFiltered.length} 题`);
}

function toggleBasket(id) {
    if (qbBasketIds.has(id)) qbBasketIds.delete(id);
    else qbBasketIds.add(id);
    renderQuestions();
    renderBasket();
}

function clearBasket() {
    qbBasketIds.clear();
    renderQuestions();
    renderBasket();
    document.getElementById('outputArea').textContent = '先把题目加入题篮，再生成测试卷、讲义或举一反三练习。';
}

function getBasketQuestions() {
    return [...qbBasketIds].map(id => qbQuestions.find(q => q.id === id)).filter(Boolean);
}

function renderBasket() {
    const items = getBasketQuestions();
    const totalScore = items.reduce((sum, q) => sum + Number(q.score || 0), 0);
    const totalMinutes = items.reduce((sum, q) => sum + Number(q.estimatedMinutes || 0), 0);
    const hardCount = items.filter(q => ['提高', '压轴'].includes(normalizeDifficulty(q.difficulty))).length;
    document.getElementById('basketSummary').innerHTML = [
        ['题数', items.length],
        ['总分', totalScore],
        ['分钟', totalMinutes],
    ].map(([label, num]) => `<div class="qb-mini-stat"><strong>${num}</strong><span>${label}</span></div>`).join('');
    const list = document.getElementById('basketList');
    if (!items.length) {
        list.innerHTML = '<div class="qb-empty">题篮为空。先从左侧筛题并加入。</div>';
        return;
    }
    list.innerHTML = items.map((q, idx) => `
        <div class="qb-basket-item">
            <div style="display:flex;justify-content:space-between;gap:8px;">
                <span>${idx + 1}. ${escapeHtml(q.stem || '').slice(0, 44)}${(q.stem || '').length > 44 ? '...' : ''}</span>
                <button class="qb-btn small" onclick="toggleBasket('${escapeHtml(q.id)}')">移出</button>
            </div>
            <div class="qb-meta">
                <span class="qb-badge">${escapeHtml(q.chapter || '未分章节')}</span>
                <span class="qb-badge ${difficultyBadgeClass(q.difficulty)}">${escapeHtml(normalizeDifficulty(q.difficulty))}</span>
                <span class="qb-badge">${Number(q.score || 0)}分</span>
            </div>
        </div>
    `).join('');
}

function generateOutput() {
    const items = getBasketQuestions();
    if (!items.length) {
        toast('请先加入题目');
        return;
    }
    const type = document.getElementById('outputType').value;
    const title = document.getElementById('paperTitle').value.trim() || '数学专题练习';
    const answerMode = document.getElementById('answerMode').value;
    const output = buildOutput(type, title, items, answerMode);
    document.getElementById('outputArea').textContent = output;
}

function buildOutput(type, title, items, answerMode) {
    if (type === 'handout') return buildHandout(title, items, answerMode);
    if (type === 'variants') return buildVariants(title, items);
    if (type === 'wrongbook') return buildWrongbook(title, items);
    return buildPaper(title, items, answerMode);
}

function buildPaper(title, items, answerMode) {
    const totalScore = items.reduce((sum, q) => sum + Number(q.score || 0), 0);
    const totalMinutes = items.reduce((sum, q) => sum + Number(q.estimatedMinutes || 0), 0);
    const lines = [`# ${title}`, '', `总分：${totalScore} 分`, `建议用时：${totalMinutes} 分钟`, '', '## 题目'];
    items.forEach((q, idx) => {
        lines.push('', `${idx + 1}.（${Number(q.score || 0)}分｜${normalizeDifficulty(q.difficulty)}｜${q.chapter || '未分章节'}）${q.stem || ''}`);
        if (q.formulaLatex) lines.push(`公式：${q.formulaLatex}`);
        if (q.diagramSvg) lines.push('[含图形：请在网页端查看或导出图片]');
        if (q.imageUrl) lines.push(`图片：${q.imageUrl}`);
    });
    if (answerMode === 'teacher') appendAnswerSection(lines, items);
    return lines.join('\n');
}

function buildHandout(title, items, answerMode) {
    const grouped = groupBy(items, q => q.chapter || '未分章节');
    const lines = [`# ${title}`, '', '## 学习目标', '- 梳理本专题核心模型。', '- 通过例题掌握解题步骤。', '- 标记易错点并安排复练。'];
    Object.entries(grouped).forEach(([chapter, qs]) => {
        lines.push('', `## ${chapter}`);
        qs.forEach((q, idx) => {
            lines.push('', `### 例题 ${idx + 1}`, q.stem || '');
            if (q.formulaLatex) lines.push(`公式：${q.formulaLatex}`);
            if (answerMode === 'teacher') {
                lines.push(`答案：${q.answer || '待补充'}`);
                lines.push(`讲解：${q.solution || '待补充'}`);
                if (q.commonMistakes) lines.push(`易错提醒：${q.commonMistakes}`);
            }
        });
    });
    lines.push('', '## 课后复盘', '- 哪一步最容易错？', '- 是审题、计算、概念还是表达问题？', '- 下次复习优先处理哪类题？');
    return lines.join('\n');
}

function buildVariants(title, items) {
    const lines = [`# ${title}`, '', '说明：当前输出为变式设计稿，正式新题需要老师确认或继续调用 AI 生成。'];
    items.forEach((q, idx) => {
        const kp = (q.knowledgePoints || []).join('、') || q.chapter || '当前知识点';
        lines.push('', `## 原题 ${idx + 1}`, q.stem || '', `核心知识点：${kp}`);
        lines.push('### 变式 1：换数字', '保持题型和解法不变，只替换关键数字。');
        lines.push('### 变式 2：换问法', '把直接求量改成反向求量或条件判断。');
        lines.push('### 变式 3：加一步', '增加一个中间量或干扰条件，检验模型是否真正掌握。');
    });
    return lines.join('\n');
}

function buildWrongbook(title, items) {
    const lines = [`# ${title}`, '', '## 错题复练清单'];
    items.forEach((q, idx) => {
        lines.push('', `${idx + 1}. ${q.stem || ''}`);
        lines.push(`错因标签：${(q.errorTags || []).join('、') || '待标注'}`);
        if (q.commonMistakes) lines.push(`易错提醒：${q.commonMistakes}`);
        lines.push('复练记录：第一次 ___ / 第二次 ___ / 第三次 ___');
    });
    return lines.join('\n');
}

function appendAnswerSection(lines, items) {
    lines.push('', '---', '', '## 答案与解析');
    items.forEach((q, idx) => {
        lines.push('', `${idx + 1}. 答案：${q.answer || '待补充'}`);
        lines.push(`解析：${q.solution || '待补充'}`);
        if (q.commonMistakes) lines.push(`易错点：${q.commonMistakes}`);
    });
}

function groupBy(items, fn) {
    return items.reduce((acc, item) => {
        const key = fn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
}

function copyOutput() {
    const text = document.getElementById('outputArea').textContent || '';
    if (!text || text.includes('先把题目')) return toast('暂无可复制内容');
    navigator.clipboard.writeText(text).then(() => toast('已复制')).catch(() => toast('复制失败'));
}

function downloadOutput() {
    const text = document.getElementById('outputArea').textContent || '';
    if (!text || text.includes('先把题目')) return toast('暂无可下载内容');
    const title = document.getElementById('paperTitle').value.trim() || '题库输出';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function openQuestionEditor(id = '') {
    const q = id ? qbQuestions.find(item => item.id === id) : null;
    openModal(id ? '编辑题目' : '新增题目', renderEditorForm(q));
}

function renderEditorForm(q = {}) {
    q = q || {};
    return `<div>
        <div class="qb-form-grid">
            ${fieldSelect('年级', 'editGrade', QB_GRADES, q.grade || '')}
            ${fieldSelect('体系', 'editSystem', ['校内', '小升初', '中考', '竞赛', '机构讲义'], q.system || '校内')}
            ${fieldSelect('状态', 'editStatus', ['draft', 'active', 'archived'], q.status || 'active', { draft: '草稿', active: '已启用', archived: '归档' })}
        </div>
        <div class="qb-form-grid">
            ${fieldInput('章节', 'editChapter', q.chapter || '', '如：几何/代数/应用题')}
            ${fieldInput('知识点', 'editKnowledge', (q.knowledgePoints || []).join('、'), '多个用顿号或逗号分隔')}
            ${fieldInput('题型', 'editType', q.questionType || '', '如：应用题/几何题')}
        </div>
        <div class="qb-form-grid">
            ${fieldSelect('难度', 'editDifficulty', QB_DIFFICULTIES, normalizeDifficulty(q.difficulty || '中等'))}
            ${fieldInput('分值', 'editScore', q.score || 5, '', 'number')}
            ${fieldInput('预计分钟', 'editMinutes', q.estimatedMinutes || 5, '', 'number')}
        </div>
        ${fieldTextarea('题干', 'editStem', q.stem || '', '题目内容', 4)}
        <div class="qb-form-grid two">
            ${fieldTextarea('公式 LaTeX', 'editFormula', q.formulaLatex || '', '例如：S=\\frac{1}{2}ah', 3)}
            ${fieldTextarea('图形 SVG', 'editDiagram', q.diagramSvg || '', '<svg>...</svg>', 3)}
        </div>
        ${fieldInput('图片/附件路径', 'editImage', q.imageUrl || '', '图片 URL、本地路径、截图来源')}
        <div class="qb-form-grid two">
            ${fieldTextarea('答案', 'editAnswer', q.answer || '', '标准答案', 3)}
            ${fieldTextarea('解析', 'editSolution', q.solution || '', '解题步骤', 3)}
        </div>
        <div class="qb-form-grid two">
            ${fieldTextarea('易错点', 'editMistakes', q.commonMistakes || '', '常见错误', 2)}
            ${fieldTextarea('错因标签', 'editErrorTags', (q.errorTags || []).join('、'), '多个用顿号或逗号分隔', 2)}
        </div>
        <div class="qb-form-grid two">
            ${fieldInput('变式分组', 'editVariant', q.variantGroup || '', '如：分数应用题-单位1')}
            ${fieldInput('来源说明', 'editSourceName', q.sourceName || '', '如：某机构讲义/自编/真题')}
        </div>
        ${fieldTextarea('原始输入/OCR', 'editOrigin', q.originText || '', '保留原始文本，方便复核', 2)}
        ${fieldTextarea('AI 辅助说明', 'editAiNotes', q.aiNotes || '', 'AI 分类、讲法、变式建议', 3)}
        <div class="qb-actions" style="justify-content:center;margin-top:14px;">
            <button class="qb-btn" onclick="closeQbModal()">取消</button>
            <button class="qb-btn primary" onclick="saveQuestionFromEditor('${escapeHtml(q.id || '')}')">保存题目</button>
        </div>
    </div>`;
}

function fieldInput(label, id, value = '', placeholder = '', type = 'text') {
    return `<div class="qb-field"><label>${escapeHtml(label)}</label><input class="qb-input" id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></div>`;
}

function fieldTextarea(label, id, value = '', placeholder = '', rows = 3) {
    return `<div class="qb-field"><label>${escapeHtml(label)}</label><textarea class="qb-textarea" id="${id}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></div>`;
}

function fieldSelect(label, id, values, selected = '', labels = {}) {
    return `<div class="qb-field"><label>${escapeHtml(label)}</label><select class="qb-select" id="${id}">${values.map(v => `<option value="${escapeHtml(v)}" ${v === selected ? 'selected' : ''}>${escapeHtml(labels[v] || v)}</option>`).join('')}</select></div>`;
}

async function saveQuestionFromEditor(id = '') {
    const stem = document.getElementById('editStem').value.trim();
    if (!stem) return toast('题干不能为空');
    const payload = {
        grade: valueOf('editGrade'),
        system: valueOf('editSystem'),
        chapter: valueOf('editChapter'),
        knowledgePoints: splitList(valueOf('editKnowledge')),
        questionType: valueOf('editType'),
        difficulty: valueOf('editDifficulty'),
        score: Number(valueOf('editScore') || 0),
        estimatedMinutes: Number(valueOf('editMinutes') || 0),
        stem,
        formulaLatex: valueOf('editFormula'),
        diagramSvg: valueOf('editDiagram'),
        imageUrl: valueOf('editImage'),
        answer: valueOf('editAnswer'),
        solution: valueOf('editSolution'),
        commonMistakes: valueOf('editMistakes'),
        errorTags: splitList(valueOf('editErrorTags')),
        variantGroup: valueOf('editVariant'),
        sourceName: valueOf('editSourceName'),
        originText: valueOf('editOrigin'),
        aiNotes: valueOf('editAiNotes'),
        status: valueOf('editStatus') || 'active',
    };
    const res = await fetch(id ? `/api/questions/${encodeURIComponent(id)}` : '/api/questions', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) return toast('保存失败');
    closeQbModal();
    await loadQuestionBank();
    toast('题目已保存');
}

function valueOf(id) {
    return document.getElementById(id)?.value.trim() || '';
}

function openIntakeModal() {
    openModal('AI 辅助录入题目', `<div>
        <div style="font-size:13px;color:var(--qb-muted);line-height:1.6;margin-bottom:10px;">粘贴 OCR 文本、截图识别结果或手打题。系统会先本地预填字段，再调用真实 AI 生成分类和易错点建议，最后进入编辑弹窗由你确认保存。</div>
        <textarea class="qb-textarea" id="intakeText" rows="10" placeholder="例：六年级 分数应用题&#10;一桶水，第一次用去1/4，第二次用去1/3，还剩15升，原来有多少升？&#10;答案：36升&#10;解析：..."></textarea>
        <div class="qb-actions" style="justify-content:center;margin-top:12px;">
            <button class="qb-btn" onclick="closeQbModal()">取消</button>
            <button class="qb-btn primary" id="intakeApplyBtn" onclick="applyIntake()">生成预填</button>
        </div>
    </div>`);
}

async function applyIntake() {
    const raw = document.getElementById('intakeText').value.trim();
    if (!raw) return toast('请先粘贴题目文本');
    const btn = document.getElementById('intakeApplyBtn');
    btn.disabled = true;
    btn.textContent = '生成中...';
    const draft = inferDraft(raw);
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
            draft.aiNotes = `${response.mode === 'real-ai' ? '真实 AI' : '本地模板'} 分类建议：\n${response.result}`;
        }
    } catch {
        draft.aiNotes = `${draft.aiNotes}\nAI 接口暂不可用，已使用本地预填。`;
    }
    closeQbModal();
    openQuestionEditor();
    setTimeout(() => fillEditor(draft), 80);
}

function inferDraft(text) {
    const grade = /初一|七年级/.test(text) ? '初一' : /初二|八年级/.test(text) ? '初二' : /初三|九年级|中考/.test(text) ? '初三' : /六年级|小升初/.test(text) ? '六年级' : '六年级';
    const chapter = /几何|三角形|圆|面积|角|线段/.test(text) ? '几何' : /函数/.test(text) ? '函数' : /方程|代数|未知数|x/.test(text) ? '代数' : /应用|行程|工程|浓度|利润|比例/.test(text) ? '应用题' : '计算';
    const questionType = /证明/.test(text) ? '证明题' : /选择|A\.|B\.|C\.|D\./.test(text) ? '选择题' : /填空/.test(text) ? '填空题' : chapter === '几何' ? '几何题' : chapter === '应用题' ? '应用题' : '计算题';
    const difficulty = /压轴|综合|分类讨论/.test(text) ? '压轴' : /提高|拓展|变式/.test(text) ? '提高' : /基础/.test(text) ? '基础' : '中等';
    const knowledgePoints = ['分数', '比例', '方程', '行程', '工程', '几何', '面积', '函数', '圆'].filter(k => text.includes(k));
    return {
        grade,
        system: grade === '六年级' ? '小升初' : '校内',
        chapter,
        questionType,
        difficulty,
        knowledgePoints,
        score: difficulty === '压轴' ? 10 : difficulty === '提高' ? 8 : 5,
        estimatedMinutes: difficulty === '压轴' ? 12 : difficulty === '提高' ? 8 : 5,
        stem: text.replace(/答案[:：][\s\S]*$/m, '').trim(),
        answer: (text.match(/答案[:：]\s*([^\n]+)/) || [])[1] || '',
        solution: (text.match(/解析[:：]\s*([\s\S]+)/) || [])[1] || '',
        originText: text,
        status: 'active',
        aiNotes: '本地规则已完成初步分类，请保存前人工核对。'
    };
}

function fillEditor(q) {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
    set('editGrade', q.grade);
    set('editSystem', q.system);
    set('editChapter', q.chapter);
    set('editKnowledge', (q.knowledgePoints || []).join('、'));
    set('editType', q.questionType);
    set('editDifficulty', q.difficulty);
    set('editScore', q.score);
    set('editMinutes', q.estimatedMinutes);
    set('editStem', q.stem);
    set('editAnswer', q.answer);
    set('editSolution', q.solution);
    set('editOrigin', q.originText);
    set('editAiNotes', q.aiNotes);
    set('editStatus', q.status);
}

function openModal(title, bodyHtml) {
    document.getElementById('qbModalTitle').textContent = title;
    document.getElementById('qbModalBody').innerHTML = bodyHtml;
    document.getElementById('qbModal').classList.add('show');
}

function closeQbModal() {
    document.getElementById('qbModal').classList.remove('show');
}

function qbScrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function qbFocusIntake() {
    openIntakeModal();
}

document.addEventListener('DOMContentLoaded', loadQuestionBank);
