const B = (() => {
    const STORE_KEY = 'math-question-bank-b-state-v1';
    const ASIDE_KEY = 'math-question-bank-b-aside-collapsed';
    const MAIN_NAV_KEY = 'math-question-bank-main-nav-collapsed';
    const OUTPUT_SIDE_WIDTH_KEY = 'qb-b-output-side-width';
    const state = {
        view: 'import',
        questions: [],
        candidates: [],
        basket: [],
        paperDraft: [],
        paperDraftExcluded: [],
        paperHistory: [],
        paperLibrary: [],
        paperMetaHidden: false,
        paperMetaText: '',
        outputTab: 'questions',
        outputSort: '综合排序',
        outputFilters: {
            questions: { range: '正式题库', year: '', grade: '', type: '', difficulty: '' },
            papers: { year: '', region: '', type: '' },
            history: { date: '', grade: '', type: '', sort: '日期↓' }
        },
        selectedCandidates: new Set(),
        selectedQuestions: new Set(),
        activeCandidateId: '',
        highlightedQuestionId: '',
        filtered: [],
        lastImportRawText: '',
        lastImportSummary: null,
        bankDensity: 'compact',
        bankFilterSchemes: [],
        expandedPaperId: '',
        activeDraftIndex: -1,
        activeInsertMenuIndex: -1,
        activeAnswerMenuIndex: -1,
        activeImageDraftIndex: -1,
        activeAnswerStyleIndex: -1,
        outputSettingsOpen: false,
        outlineDisplayMode: 'number',
        lastNonAnswerOutputMode: 'student',
        lastAiOutlineSuggestion: null,
        aiPanelLoading: false,
        aiPanelError: '',
        aiProvider: 'qwen',
        undoStack: [],
        lastUndoSnapshot: null,
        suspendUndo: false,
        undoReady: false,
        selectedDraftIndices: new Set(),
        lastDraftSelectionIndex: -1,
        activeDraftContextMenu: null,
        expandedOutputAnswers: new Set(),
        activeBankImageId: '',
        handoutScaffoldApplied: false,
        collapsedHeadings: new Set(),
        imageResize: null
    };

    const grades = ['六年级', '初一', '初二', '初三'];
    const chapters = ['计算', '应用题', '代数', '几何', '函数', '统计概率'];
    const types = ['选择题', '填空题', '计算题', '应用题', '几何题', '证明题', '综合题'];
    const difficulties = ['基础', '中等', '提高', '压轴'];
    const help = {
        import: ['导入中心', '资料先进入候选题池，AI 辅助拆题，不自动进入正式题库。', [['生成候选题', 'B.createImport()', 'primary'], ['待确认题池', "B.switchView('candidates')", '']]],
        candidates: ['待确认题池', '左右对照原文与结构化字段，人工确认后才进入正式题库。', [['批量标记', 'B.batchMark()', ''], ['正式题库', "B.switchView('bank')", 'primary']]],
        bank: ['正式题库', '正式题目池，可筛选、编辑、归档并加入题篮。', [['新增题目', 'B.openQuestionEditor()', 'primary'], ['质量体检', "B.switchView('quality')", '']]],
        compose: ['组卷输出', '题篮、结构检查、试卷画布和多格式导出放在同一屏，减少来回切换。', [['继续选题', "B.switchView('bank')", ''], ['生成输出', 'B.generateOutput()', 'primary'], ['网页打印/PDF', 'B.printPdf()', '']]],
        papers: ['试卷库', '按导入批次保存整套试卷，方便以后整卷调出、组卷和打印。', [['正式题库', "B.switchView('bank')", ''], ['组卷输出', "B.switchView('compose')", 'primary']]],
        quality: ['质量体检', '集中处理缺答案、缺解析、缺知识点、缺来源、疑似公式损坏、重复和图形问题。', [['刷新体检', 'B.renderQuality()', ''], ['正式题库', "B.switchView('bank')", '']]],
        docs: ['说明与报告', '数学题库的使用说明、质量规则、模块评估和后续规划。', [['导入中心', "B.switchView('import')", ''], ['组卷输出', "B.switchView('compose')", '']]]
    };

    function $(id) { return document.getElementById(id); }
    function value(id) { return ($(id)?.value || '').trim(); }
    function html(v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function queueMathTypeset(root = document.body) {
        if (!window.MathJax?.typesetPromise || !root) return;
        clearTimeout(window._bMathTimer);
        window._bMathTimer = setTimeout(() => {
            window.MathJax.typesetPromise([root]).catch(() => {});
        }, 30);
    }
    function hasMathSignal(text) {
        return /\\\(|\\\[|\\frac|\\sqrt|\\times|\\div|\\leq|\\geq|[√π÷×≤≥]|(?:\d+\s+)?\d+\/\d+|[A-Za-z0-9)]\^[{(]?[A-Za-z0-9+\-]+/.test(String(text || ''));
    }
    function questionHasFormula(q = {}) {
        return Boolean(q.formulaLatex || hasMathSignal([q.stem, q.answer, q.solution].join(' ')));
    }
    function questionHasImage(q = {}) {
        return Boolean(q.diagramSvg || q.imageUrl || (Array.isArray(q.images) && q.images.length));
    }
    function formalNameText(text = '') {
        return String(text || '')
            .replace(/数学题库\s*B/g, '数学题库')
            .replace(/题库\s*B/g, '数学题库')
            .replace(/题库B/g, '数学题库')
            .replace(/数学题库\s+数学题库/g, '数学题库')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    function normalizeStoredFormalNames() {
        let changed = false;
        const seen = new WeakSet();
        const visit = value => {
            if (!value || typeof value !== 'object' || seen.has(value)) return;
            seen.add(value);
            Object.keys(value).forEach(key => {
                const current = value[key];
                if (typeof current === 'string') {
                    const next = formalNameText(current);
                    if (next !== current) {
                        value[key] = next;
                        changed = true;
                    }
                    return;
                }
                if (Array.isArray(current) || (current && typeof current === 'object')) visit(current);
            });
        };
        [state.questions, state.candidates, state.paperDraft, state.paperHistory, state.paperLibrary, state.lastImportSummary].forEach(visit);
        if (state.paperMetaText) {
            const next = formalNameText(state.paperMetaText);
            if (next !== state.paperMetaText) {
                state.paperMetaText = next;
                changed = true;
            }
        }
        return changed;
    }
    function inlineMath(expr) {
        return `\\(${String(expr || '').trim()}\\)`;
    }
    function textWithMath(text) {
        const mathBlocks = [];
        let escaped = html(text).replace(/\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g, (match) => {
            const token = `@@MATH_${mathBlocks.length}@@`;
            mathBlocks.push(match);
            return token;
        });
        escaped = escaped
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => inlineMath(`\\frac{${a}}{${b}}`))
            .replace(/\\sqrt(?:\[([^{}\]]+)\])?\{([^{}]+)\}/g, (_, deg, body) => inlineMath(deg ? `\\sqrt[${deg}]{${body}}` : `\\sqrt{${body}}`))
            .replace(/√\s*([A-Za-z0-9一-龥.]+|\([^()]+\))/g, (_, body) => inlineMath(`\\sqrt{${body.replace(/[()]/g, '')}}`))
            .replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, whole, a, b) => inlineMath(`${whole}\\frac{${a}}{${b}}`))
            .replace(/(?<![\w{}\\])(\d+)\/(\d+)(?![\w{}])/g, (_, a, b) => inlineMath(`\\frac{${a}}{${b}}`))
            .replace(/([A-Za-z0-9)])\^(\{[^{}]+\}|[A-Za-z0-9+\-]+)/g, (_, base, exp) => inlineMath(`${base}^${exp}`))
            .replace(/\\times/g, '×')
            .replace(/\\div/g, '÷')
            .replace(/\\leq?/g, '≤')
            .replace(/\\geq?/g, '≥')
            .replace(/\\pi/g, 'π');
        mathBlocks.forEach((block, index) => { escaped = escaped.replace(`@@MATH_${index}@@`, block); });
        return escaped.replace(/\n/g, '<br>');
    }
    function splitList(v) {
        return String(v || '').split(/[、,，/]/).map(x => x.trim()).filter(Boolean);
    }
    function normalizeAnswerText(answer = '') {
        let value = String(answer || '').trim().replace(/^答案\s*[:：]\s*/, '').replace(/^故选\s*[:：]?\s*/i, '').trim();
        const letters = value.match(/^([A-D](?:\s*[、,，/]\s*[A-D])*)\s*[。．.]?$/i);
        if (letters) return letters[1].toUpperCase().replace(/\s*[、,，/]\s*/g, '、');
        const compactLetters = value.match(/^([A-D]{2,4})\s*[。．.]?$/i);
        if (compactLetters) return compactLetters[1].toUpperCase().split('').join('、');
        return value;
    }
    function uniq(items) {
        return [...new Set(items.filter(Boolean))];
    }
    function id(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }
    function toast(message) {
        const el = $('bToast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(window._bToastTimer);
        window._bToastTimer = setTimeout(() => el.classList.remove('show'), 1800);
    }
    function copyText(text, successMessage = '已复制') {
        const value = String(text || '');
        if (!value) return toast('暂无可复制内容');
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(value).then(() => toast(successMessage)).catch(() => fallbackCopyText(value, successMessage));
        } else {
            fallbackCopyText(value, successMessage);
        }
    }
    function fallbackCopyText(text, successMessage = '已复制') {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        try {
            document.execCommand('copy');
            toast(successMessage);
        } catch {
            toast('复制失败');
        } finally {
            area.remove();
        }
    }
    function persistableState() {
        return {
            questions: state.questions,
            candidates: state.candidates,
            basket: state.basket,
            paperDraft: state.paperDraft,
            paperDraftExcluded: state.paperDraftExcluded,
            paperHistory: state.paperHistory,
            paperLibrary: state.paperLibrary,
            paperMetaHidden: state.paperMetaHidden,
            paperMetaText: state.paperMetaText,
            lastImportRawText: state.lastImportRawText,
            lastImportSummary: state.lastImportSummary,
            bankDensity: state.bankDensity,
            bankFilterSchemes: state.bankFilterSchemes,
            expandedPaperId: state.expandedPaperId,
            aiProvider: state.aiProvider
        };
    }
    function serializeSnapshot(snapshot = persistableState()) {
        return JSON.stringify(snapshot);
    }
    function syncUndoButton() {
        const btn = $('undoToggle');
        if (!btn) return;
        btn.disabled = !state.undoStack.length;
        btn.title = state.undoStack.length ? `撤回：${state.undoStack[state.undoStack.length - 1].label || '上一步'}` : '暂无可撤回操作';
    }
    function save() {
        const snapshot = persistableState();
        const serialized = serializeSnapshot(snapshot);
        if (state.undoReady && !state.suspendUndo && state.lastUndoSnapshot && serializeSnapshot(state.lastUndoSnapshot) !== serialized) {
            state.undoStack.push({ label: '上一步', snapshot: JSON.parse(serializeSnapshot(state.lastUndoSnapshot)) });
            state.undoStack = state.undoStack.slice(-30);
            syncUndoButton();
        }
        localStorage.setItem(STORE_KEY, serialized);
        state.lastUndoSnapshot = JSON.parse(serialized);
    }
    function load() {
        const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        state.questions = Array.isArray(data.questions) ? data.questions : [];
        state.candidates = Array.isArray(data.candidates) ? data.candidates : [];
        state.basket = Array.isArray(data.basket) ? data.basket : [];
        state.paperDraft = Array.isArray(data.paperDraft) ? data.paperDraft : [];
        state.paperDraftExcluded = Array.isArray(data.paperDraftExcluded) ? data.paperDraftExcluded : [];
        state.paperHistory = Array.isArray(data.paperHistory) ? data.paperHistory : [];
        state.paperLibrary = Array.isArray(data.paperLibrary) ? data.paperLibrary : [];
        state.paperMetaHidden = Boolean(data.paperMetaHidden);
        state.paperMetaText = data.paperMetaText || '';
        state.lastImportRawText = data.lastImportRawText || '';
        state.lastImportSummary = data.lastImportSummary || null;
        state.bankDensity = 'compact';
        state.bankFilterSchemes = Array.isArray(data.bankFilterSchemes) ? data.bankFilterSchemes : [];
        state.expandedPaperId = data.expandedPaperId || '';
        state.aiProvider = data.aiProvider || value('bImportAIProvider') || 'qwen';
        state.lastUndoSnapshot = JSON.parse(serializeSnapshot(persistableState()));
        state.undoReady = true;
        if (normalizeStoredFormalNames()) save();
    }
    function restorePersistedSnapshot(snapshot = {}) {
        state.questions = Array.isArray(snapshot.questions) ? snapshot.questions : [];
        state.candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
        state.basket = Array.isArray(snapshot.basket) ? snapshot.basket : [];
        state.paperDraft = Array.isArray(snapshot.paperDraft) ? snapshot.paperDraft : [];
        state.paperDraftExcluded = Array.isArray(snapshot.paperDraftExcluded) ? snapshot.paperDraftExcluded : [];
        state.paperHistory = Array.isArray(snapshot.paperHistory) ? snapshot.paperHistory : [];
        state.paperLibrary = Array.isArray(snapshot.paperLibrary) ? snapshot.paperLibrary : [];
        state.paperMetaHidden = Boolean(snapshot.paperMetaHidden);
        state.paperMetaText = snapshot.paperMetaText || '';
        state.lastImportRawText = snapshot.lastImportRawText || '';
        state.lastImportSummary = snapshot.lastImportSummary || null;
        state.bankDensity = 'compact';
        state.bankFilterSchemes = Array.isArray(snapshot.bankFilterSchemes) ? snapshot.bankFilterSchemes : [];
        state.expandedPaperId = snapshot.expandedPaperId || '';
        state.aiProvider = snapshot.aiProvider || state.aiProvider || 'qwen';
        state.selectedCandidates.clear();
        state.selectedQuestions.clear();
        state.selectedDraftIndices.clear();
    }
    function undoLastAction() {
        const item = state.undoStack.pop();
        if (!item?.snapshot) return toast('暂无可撤回操作');
        state.suspendUndo = true;
        restorePersistedSnapshot(item.snapshot);
        localStorage.setItem(STORE_KEY, serializeSnapshot(persistableState()));
        state.lastUndoSnapshot = JSON.parse(serializeSnapshot(persistableState()));
        state.suspendUndo = false;
        renderAll();
        syncOutputTabs();
        syncAiProviderControls();
        syncUndoButton();
        toast(`已撤回${item.label ? `：${item.label}` : ''}`);
    }
    function sourceFromForm() {
        return {
            sourceType: value('bSourceType'),
            year: value('bYear'),
            grade: value('bGrade'),
            region: value('bRegion'),
            districtOrSchool: value('bSchool'),
            examName: value('bExam'),
            note: value('bNote')
        };
    }
    function providerLabel(provider = state.aiProvider) {
        return { qwen: 'Qwen 千问 qwen-plus', deepseek: 'DeepSeek v4-flash', global: '全局模型', rules: '本地规则' }[provider] || provider || '未选择';
    }
    function syncAiProviderControls() {
        ['bImportAIProvider', 'bOutputAIProvider'].forEach(idName => {
            const el = $(idName);
            if (el && el.value !== state.aiProvider) el.value = state.aiProvider;
        });
        if ($('bAiProviderStatus')) {
            $('bAiProviderStatus').textContent = `当前用于导入解析和 AI 输出：${providerLabel()}`;
        }
    }
    function setAiProvider(provider = '') {
        state.aiProvider = provider || 'qwen';
        syncAiProviderControls();
        save();
        toast(`已切换为 ${providerLabel()}`);
    }
    function previewImportMetaFromInputs() {
        const files = selectedImportFiles();
        const fileText = files.map(file => file.name).join('\n');
        const rawText = value('bRawText');
        const text = [fileText, rawText].filter(Boolean).join('\n');
        if (!text.trim()) return;
        const next = parsePaperMeta(text, sourceFromForm());
        applySourceToForm(next);
    }
    function sourceLabel(source = {}) {
        return formalNameText([source.year, source.region || source.districtOrSchool, source.examName || source.sourceType, source.note].filter(Boolean).join(' ')) || '未标来源';
    }
    function hasSourceInfo(q = {}) {
        const label = String(q.sourceName || sourceLabel(q.source) || '').trim();
        return Boolean(label && label !== '未标来源');
    }
    function sourceWithQuestionNo(q = {}) {
        return [q.sourceName || sourceLabel(q.source), q.source?.questionNo ? `原第 ${q.source.questionNo} 题` : ''].filter(Boolean).join(' · ');
    }
    function paperTitle(source = {}, fileName = '') {
        return formalNameText(source.examName || source.note || fileName || [source.year, source.region || source.districtOrSchool, source.grade, source.sourceType].filter(Boolean).join(' ')) || '未命名试卷';
    }
    function createPaperFromImport(source = {}, candidates = [], fileName = '') {
        if (!candidates.length) return null;
        const paperId = id('bpaper');
        const title = paperTitle(source, fileName);
        candidates.forEach((candidate, index) => {
            candidate.source = {
                ...(candidate.source || {}),
                ...source,
                paperId,
                paperTitle: title,
                questionNo: candidate.source?.questionNo || candidate.questionNo || String(index + 1),
                paperOrder: Number(candidate.source?.paperOrder || index + 1)
            };
            candidate.sourceName = sourceLabel(candidate.source);
        });
        const paper = {
            id: paperId,
            title,
            year: source.year || '',
            grade: source.grade || '',
            region: source.region || source.districtOrSchool || '',
            sourceType: source.sourceType || '',
            fileName,
            candidateIds: candidates.map(c => c.id),
            questionIds: [],
            questionOrder: candidates.map((c, index) => ({ candidateId: c.id, questionNo: c.source?.questionNo || String(index + 1), paperOrder: c.source?.paperOrder || index + 1 })),
            createdAt: new Date().toISOString()
        };
        state.paperLibrary.unshift(paper);
        return paper;
    }
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    async function uploadImageAsset(file, targetInputId) {
        if (!file) return;
        const res = await fetch('/api/question-bank-assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileBase64: await fileToBase64(file)
            })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || '图片上传失败');
        const input = $(targetInputId);
        if (input) input.value = payload.url || '';
        toast('图片已保存到题库附件');
        return payload.url || '';
    }
    function uploadCandidateImage(file, targetInputId = 'bCandStemImage') {
        uploadImageAsset(file, targetInputId).catch(error => toast(error.message || '图片上传失败'));
    }
    function uploadQuestionImage(file, targetInputId = '') {
        uploadImageAsset(file, targetInputId || ($('bEditStemImage') ? 'bEditStemImage' : 'bEditImage')).catch(error => toast(error.message || '图片上传失败'));
    }
    function normalizeDifficulty(v) {
        return difficulties.includes(v) ? v : '中等';
    }
    function questionNoFromText(text) {
        const m = String(text || '').trim().match(/^(?:第\s*)?(\d{1,3})\s*(?:[．、)]|\.(?!\d))/);
        return m ? (m[1] || '') : '';
    }
    function stripLeadingQuestionNo(text) {
        return String(text || '').replace(/^\s*(?:第\s*)?\d{1,3}\s*(?:[．、)]|\.(?!\d))\s*/, '').trim();
    }
    function hasMultipleQuestionStarts(text) {
        const lines = String(text || '').replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
        return lines.filter(line => /^(?:第\s*)?\d{1,3}\s*(?:[．、)]|\.(?!\d))/.test(line)).length > 1;
    }
    function extractScore(text, difficulty = '') {
        const value = String(text || '');
        const m = value.match(/[（(\[]\s*(\d{1,2})\s*分\s*[）)\]]|本题\s*(\d{1,2})\s*分|(?:^|[，,。；;\s])(\d{1,2})\s*分(?:[，,。；;\s]|$)/);
        if (m) return Number(m[1] || m[2] || m[3]);
        return difficulty === '压轴' ? 12 : difficulty === '提高' ? 8 : 5;
    }
    function isImageReference(url) {
        const value = String(url || '').trim();
        if (!value) return false;
        return /^(?:https?:|data:image\/|blob:|file:)/i.test(value)
            || value.startsWith('/question-bank-assets/')
            || value.startsWith('/api/question-bank-assets')
            || value.startsWith('/Users/')
            || /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(value);
    }
    function extractImageUrl(text) {
        const m = String(text || '').match(/(?:图片|图|image|img)\s*[:：]\s*(\S+)/i);
        const url = m ? m[1].trim() : '';
        return isImageReference(url) ? url : '';
    }
    function extractImageUrls(text) {
        const urls = [];
        const re = /(?:图片|图|image|img)\s*[:：]\s*(\S+)/ig;
        let m;
        while ((m = re.exec(String(text || '')))) {
            const url = m[1]?.trim();
            if (isImageReference(url) && !urls.includes(url)) urls.push(url);
        }
        return urls;
    }
    function roleFromImageLabel(label = '') {
        const value = String(label || '').toUpperCase();
        if (/解析|答案/.test(value)) return 'solution';
        const option = value.match(/[ABCD]/)?.[0];
        if (option) return `option-${option}`;
        return 'stem';
    }
    function extractImageItems(text) {
        const items = [];
        const re = /(?:^|\n|[；;。]\s*|\s)((?:题干|解析|答案|[ABCD])?\s*(?:图片|图|image|img))\s*[:：]\s*(\S+)/ig;
        let m;
        while ((m = re.exec(String(text || '')))) {
            const url = m[2]?.trim();
            if (!isImageReference(url)) continue;
            const role = roleFromImageLabel(m[1]);
            if (items.some(item => item.url === url && item.role === role)) continue;
            items.push({ url, role, optionLabel: role.startsWith('option-') ? role.slice(-1) : '', order: items.length + 1 });
        }
        return items;
    }
    function removeImageLines(text) {
        return String(text || '').replace(/^\s*(?:(?:题干|解析|答案|[ABCD])?\s*(?:图片|图|image|img))\s*[:：]\s*\S+\s*$/gim, '').trim();
    }
    function stripInlineMeta(text) {
        let value = String(text || '').replace(/\r/g, '\n');
        const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length > 1 && /数学|试卷|测试|期末|期中|真题|专题|练习|验收卷|评价卷/.test(lines[0]) && lines.slice(1).some(line => /^(?:第\s*)?\d{1,3}\s*[.．、)]/.test(line))) {
            value = lines.slice(1).join('\n');
        }
        return value
            .replace(/^\s*(?:图片|图|image|img)\s*[:：]\s*\S+\s*$/gim, '')
            .replace(/^\s*(?:第\s*)?\d{1,3}\s*[.．、)]\s*/, '')
            .replace(/[（(\[]\s*\d{1,2}\s*分\s*[）)\]]/g, '')
            .replace(/本题\s*\d{1,2}\s*分/g, '')
            .trim();
    }
    function parsePaperMeta(text, source = {}) {
        const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
        const meta = { ...source };
        const allText = String(text || '');
        const titleLine = lines.find(line => /数学|试卷|测试|期末|期中|真题|专题|练习/.test(line) && !/^(?:第\s*)?\d{1,3}\s*[.．、)]/.test(line));
        const yearMatch = allText.match(/(20\d{2})(?:\s*[-—~至]\s*20\d{2})?/);
        const gradeMatch = allText.match(/六年级|初一|七年级|初二|八年级|初三|九年级/);
        const provinceMatch = allText.match(/(广东|江苏|浙江|山东|福建|河北|河南|湖北|湖南|四川|陕西|辽宁)(?:省)?/);
        const cityMatch = allText.match(/(深圳|广州|佛山|东莞|杭州|南京|成都|武汉|长沙|西安|郑州|厦门|福州|沈阳|大连|青岛|苏州|无锡|北京|上海|天津|重庆)(?:市)?/);
        const districtMatch = allText.match(/(南山|福田|罗湖|宝安|龙岗|龙华|光明|坪山|盐田|天河|越秀|海珠|番禺|黄埔|朝阳|海淀|西城|东城|浦东|闵行|徐汇|宝山|余杭|萧山)(?:区)?/);
        const schoolMatch = allText.match(/([\u4e00-\u9fa5]{2,}(?:小学|中学|学校|实验学校|外国语学校|附属学校|附中))/);
        const regionParts = [];
        if (provinceMatch?.[1] && provinceMatch[1] !== cityMatch?.[1]) regionParts.push(provinceMatch[1]);
        if (cityMatch?.[1]) regionParts.push(cityMatch[1]);
        if (!meta.year && yearMatch) meta.year = yearMatch[1];
        if (gradeMatch && (!meta.grade || meta.grade === '六年级')) meta.grade = gradeMatch[0] === '七年级' ? '初一' : gradeMatch[0] === '八年级' ? '初二' : gradeMatch[0] === '九年级' ? '初三' : gradeMatch[0];
        if (regionParts.length && (!meta.region || String(meta.region).length < regionParts.join('').length)) meta.region = regionParts.join('');
        if (!meta.region && provinceMatch) meta.region = provinceMatch[1];
        if (!meta.districtOrSchool && districtMatch) meta.districtOrSchool = `${districtMatch[1]}区`;
        if ((!meta.districtOrSchool || /区$/.test(meta.districtOrSchool)) && schoolMatch) meta.districtOrSchool = schoolMatch[1];
        if (!meta.examName && titleLine) meta.examName = titleLine.replace(/^\s*[\-—=]+|[\-—=]+\s*$/g, '').trim();
        if (!meta.title && meta.examName) meta.title = meta.examName;
        if (!meta.examName && meta.title) meta.examName = meta.title;
        return meta;
    }
    function applySourceToForm(source = {}) {
        [['bYear', source.year], ['bGrade', source.grade], ['bRegion', source.region], ['bSchool', source.districtOrSchool], ['bExam', source.examName]].forEach(([idName, next]) => {
            const el = $(idName);
            if (el && next && (!el.value || (idName === 'bGrade' && el.value === '六年级'))) el.value = next;
        });
        if ($('bOutputTitle') && source.examName && $('bOutputTitle').value === '数学题库专题练习') $('bOutputTitle').value = source.examName;
    }
    function splitAnswerSection(text, answerMode = value('bAnswerMode') || 'auto') {
        if (answerMode === 'inline') return { questionText: String(text || ''), answerText: '' };
        const lines = String(text || '').replace(/\r/g, '\n').split('\n');
        const index = lines.findIndex(line => {
            const value = line.trim();
            return /^\s*(?:参考答案(?:与(?:试题)?解析)?|答案与解析|答案解析|试题解析)\s*[:：]?/.test(value)
                || /^\s*答案\s*[:：]?\s*$/.test(value)
                || /^\s*答案\s*[:：]\s*\d{1,3}\s*[.．、)]/.test(value);
        });
        if (index < 0) return { questionText: String(text || ''), answerText: '' };
        return { questionText: lines.slice(0, index).join('\n'), answerText: lines.slice(index).join('\n') };
    }
    function parseNumberedFinalSection(text, { normalizeAnswer = false } = {}) {
        const map = {};
        const normalized = String(text || '')
            .replace(/^\s*(?:参考答案|答案与解析|答案解析|答案|解析|解答|讲解)\s*[:：]?/gm, '')
            .replace(/([^\d])(\d{1,3})\s*[.．、)]/g, '$1\n$2.')
            .replace(/^(\d{1,3})\s*[.．、)]/gm, '$1.');
        const re = /(?:^|\n)\s*(\d{1,3})\s*[.．、)]\s*([\s\S]*?)(?=\n\s*\d{1,3}\s*[.．、)]|$)/g;
        let m;
        while ((m = re.exec(normalized))) {
            const value = m[2].trim();
            if (!value) continue;
            map[m[1]] = normalizeAnswer ? normalizeAnswerText(value) : value;
        }
        return map;
    }
    function parseDetailedAnswerMap(answerText) {
        const map = {};
        const normalized = String(answerText || '').replace(/\r/g, '\n');
        const re = /(?:^|\n)\s*(\d{1,3})\s*[．、)](?!\d)\s*([\s\S]*?)(?=\n\s*\d{1,3}\s*[．、)](?!\d)|$)/g;
        let match;
        while ((match = re.exec(normalized))) {
            const questionNo = match[1];
            const block = match[2].trim();
            if (!questionNo) continue;
            const answerMatch = block.match(/【答案】\s*([\s\S]*?)(?=\n?【(?:分析|解答|点评|考点|解析)】|$)/);
            const solutionMatch = block.match(/【(?:解答|解析)】\s*([\s\S]*?)(?=\n?【(?:点评|考点|答案|分析)】|$)/);
            if (!answerMatch && !solutionMatch) continue;
            map[questionNo] = {
                answer: answerMatch ? normalizeAnswerText(answerMatch[1]) : '',
                solution: solutionMatch ? solutionMatch[1].trim() : '',
                rawText: block
            };
        }
        return map;
    }
    function parseAnswerMap(answerText) {
        const raw = String(answerText || '').replace(/\r/g, '\n');
        const solutionHeader = raw.match(/\n\s*(?:解析|解答|讲解)\s*[:：]?(?=\s*(?:\n|\d{1,3}\s*[.．、)]))/);
        const answerPart = solutionHeader ? raw.slice(0, solutionHeader.index) : raw;
        const solutionPart = solutionHeader ? raw.slice(solutionHeader.index).replace(/^\s*(?:解析|解答|讲解)\s*[:：]?/m, '') : '';
        const answers = parseNumberedFinalSection(answerPart, { normalizeAnswer: true });
        const solutions = parseNumberedFinalSection(solutionPart);
        const detailed = parseDetailedAnswerMap(raw);
        const keys = new Set([...Object.keys(answers), ...Object.keys(solutions), ...Object.keys(detailed)]);
        const map = {};
        keys.forEach(key => {
            map[key] = {
                answer: answers[key] || detailed[key]?.answer || '',
                solution: solutions[key] || detailed[key]?.solution || '',
                rawText: detailed[key]?.rawText || ''
            };
        });
        return map;
    }
    function infer(text, source = {}) {
        const grade = source.grade || (/初一|七年级/.test(text) ? '初一' : /初二|八年级/.test(text) ? '初二' : /初三|九年级|中考/.test(text) ? '初三' : /六年级|小升初/.test(text) ? '六年级' : '');
        const chapter = /圆|三角形|几何|角|面积|平行|相似|四边形|长方形|正方形|坐标|规律摆图形|图形|周长|轴对称|中心对称|视线|观察物体|正方体展开图|展开图|logo/i.test(text) ? '几何' : /函数|图像/.test(text) ? '函数' : /概率|统计|频率/.test(text) ? '统计概率' : /方程|不等式|代数|x/.test(text) ? '代数' : /应用|利润|行程|工程|浓度|比例|身份证|编码规则|设备尺寸|产品说明书|游客|预订酒店/.test(text) ? '应用题' : '计算';
        const questionType = /证明|求证/.test(text) ? '证明题' : /A[.．、]|B[.．、]|C[.．、]|D[.．、]|（\s*　*\s*）/.test(text) ? '选择题' : /计算题|我会算|脱式计算|解方程|直接写出得数/.test(text) ? '计算题' : /____|填空|　|(?:是|为|等于|填|写出)\s*$/.test(text.trim()) ? '填空题' : /综合|（1）|\(1\)|解答以下问题/.test(text) ? '综合题' : chapter === '几何' ? '几何题' : /求|设/.test(text) && chapter === '应用题' ? '应用题' : '计算题';
        const difficulty = /压轴|综合|分类讨论/.test(text) ? '压轴' : /提高|拓展|相似/.test(text) ? '提高' : /基础/.test(text) ? '基础' : '中等';
        const knowledgePoints = ['分数', '比例', '方程', '不等式', '函数', '几何', '三角形', '圆', '概率', '统计', '根式', '面积'].filter(k => text.includes(k));
        if (/\\frac|(?:^|[^\w])\d+\/\d+(?:$|[^\w])|[¼½¾⅓⅔⅕⅖⅗⅘]/.test(text) && !knowledgePoints.includes('分数')) knowledgePoints.push('分数');
        if (/图形|观察/.test(text) && chapter === '几何' && !knowledgePoints.includes('图形')) knowledgePoints.push('图形');
        if (/\\sqrt|√/.test(text) && !knowledgePoints.includes('根式')) knowledgePoints.push('根式');
        if (/[xX]\s*[+\-*/=]|方程|解方程/.test(text) && !knowledgePoints.includes('方程')) knowledgePoints.push('方程');
        return { grade, chapter, questionType, difficulty, knowledgePoints };
    }
    function parseCandidate(raw, source = {}, keyedAnswer = {}) {
        const answerMatch = raw.match(/(?:参考答案|答案)[:：]\s*([\s\S]*?)(?=\n\s*(?:解析|解答|讲解)[:：]|$)/);
        const solutionMatch = raw.match(/(?:解析|解答|讲解)[:：]\s*([\s\S]*)$/);
        const stem = removeImageLines(stripInlineMeta(raw.replace(/(?:参考答案|答案)[:：][\s\S]*$/m, '').trim() || raw.trim()));
        const cleanForInfer = removeImageLines(raw);
        const inf = infer(cleanForInfer, source);
        const score = extractScore(raw, inf.difficulty);
        const imageItems = extractImageItems(raw);
        const imageUrls = imageItems.map(item => item.url);
        const imageUrl = imageUrls[0] || extractImageUrl(raw);
        const questionNo = questionNoFromText(raw);
        const answer = normalizeAnswerText(answerMatch ? answerMatch[1].trim() : (keyedAnswer.answer || ''));
        const solution = solutionMatch ? solutionMatch[1].trim() : (keyedAnswer.solution || '');
        const warnings = [];
        if (!stem) warnings.push('缺题干');
        if (!inf.grade) warnings.push('缺年级');
        if (!inf.chapter) warnings.push('缺章节');
        if (!answer) warnings.push('缺答案');
        if (!solution) warnings.push('缺解析');
        if (hasMultipleQuestionStarts(raw)) warnings.push('疑似合并多题');
        if (/[□�]/.test(raw)) warnings.push('疑似公式损坏');
        if (/如图|图中|下图/.test(raw) && !imageUrl) warnings.push('含图但无附件');
        return withCandidateParseStatus({
            id: id('bcand'),
            rawText: raw,
            stem,
            answer,
            solution,
            source: { ...source, questionNo: source.questionNo || questionNo },
            status: 'pending',
            warnings,
            ...inf,
            score,
            imageUrl,
            images: imageItems.length ? imageItems : imageUrls.map((url, index) => ({ url, role: 'stem', order: index + 1 }))
        }, false);
    }
    function candidateParseStatus(candidate = {}, usedAI = false, fallbackMessage = '') {
        const warnings = Array.isArray(candidate.aiParseWarnings)
            ? candidate.aiParseWarnings
            : Array.isArray(candidate.warnings) ? candidate.warnings : [];
        if (!usedAI) {
            return {
                parseStatus: fallbackMessage ? 'local-fallback' : (candidate.parseStatus || 'local-rules'),
                parseStatusLabel: fallbackMessage ? '本地规则兜底' : (candidate.parseStatusLabel || '本地规则'),
                fieldWarnings: uniq([...(candidate.fieldWarnings || []), ...warnings, ...(fallbackMessage ? [fallbackMessage] : [])])
            };
        }
        const lowConfidence = warnings.length || !candidate.answer || !candidate.solution || !candidate.chapter;
        return {
            parseStatus: candidate.parseStatus || (lowConfidence ? 'ai-partial' : 'ai-success'),
            parseStatusLabel: candidate.parseStatusLabel || (lowConfidence ? 'AI 已解析，需复核' : 'AI 成功'),
            fieldWarnings: uniq([...(candidate.fieldWarnings || []), ...warnings])
        };
    }
    function withCandidateParseStatus(candidate = {}, usedAI = false, fallbackMessage = '') {
        const status = candidateParseStatus(candidate, usedAI, fallbackMessage);
        return {
            ...candidate,
            ...status,
            aiParseWarnings: uniq([...(candidate.aiParseWarnings || []), ...(status.fieldWarnings || [])]),
            warnings: uniq([...(candidate.warnings || []), ...(status.fieldWarnings || [])])
        };
    }
    function candidateFromParsed(item = {}, source = {}) {
        const mergedSource = { ...source, ...(item.source || {}), questionNo: item.questionNo || item.source?.questionNo || '' };
        const raw = item.rawText || item.stem || '';
        const fallback = parseCandidate(raw, mergedSource, { answer: item.answer, solution: item.solution });
        const score = Number(item.score || fallback.score || 5);
        const usedAI = Boolean(item.parseStatus && !['local-rules', 'local-fallback'].includes(item.parseStatus)) || Boolean(item.usedAI);
        const itemWarnings = uniq([...(item.fieldWarnings || []), ...(item.aiParseWarnings || []), ...(item.warnings || [])]);
        const mergedWarnings = item.parseStatus ? itemWarnings : uniq([...(fallback.warnings || []), ...itemWarnings]);
        return withCandidateParseStatus({
            ...fallback,
            rawText: item.rawText || fallback.rawText,
            stem: stripLeadingQuestionNo(item.stem || fallback.stem),
            answer: normalizeAnswerText(item.answer || fallback.answer),
            solution: item.solution || fallback.solution,
            grade: item.grade || fallback.grade,
            chapter: item.chapter || fallback.chapter,
            questionType: item.questionType || fallback.questionType,
            difficulty: normalizeDifficulty(item.difficulty || fallback.difficulty),
            knowledgePoints: Array.isArray(item.knowledgePoints) && item.knowledgePoints.length ? item.knowledgePoints : fallback.knowledgePoints,
            score,
            imageUrl: item.imageUrl || fallback.imageUrl,
            images: Array.isArray(item.images) ? item.images : (fallback.images || []),
            source: mergedSource,
            warnings: mergedWarnings,
            aiParseWarnings: item.aiParseWarnings || item.warnings || [],
            answerConfidence: Number(item.answerConfidence || fallback.answerConfidence || 0),
            parseStatus: item.parseStatus || fallback.parseStatus,
            parseStatusLabel: item.parseStatusLabel || fallback.parseStatusLabel,
            fieldWarnings: item.fieldWarnings || mergedWarnings || []
        }, usedAI);
    }
    async function parseWithServerAI(fullText, source, fileName = '', providerOverride = '') {
        const aiProvider = providerOverride || state.aiProvider || value('bImportAIProvider') || 'qwen';
        const answerMode = value('bAnswerMode') || 'auto';
        const res = await fetch(`${apiBase()}/api/question-import/ai-parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawText: fullText, fileName, source, answerMode, parseMode: aiProvider === 'rules' ? 'rules-only' : 'ai-first', aiProvider, provider: aiProvider })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'AI 解析失败');
        return payload;
    }
    function selectedImportFiles() {
        return Array.from($('bImportFile')?.files || []);
    }
    async function extractImportFile(file, source, rawText = '') {
        if (!file) return { fullText: rawText, fileName: '', warnings: [] };
        const res = await fetch(`${apiBase()}/api/question-import/batches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputType: value('bImportType'),
                fileName: file.name,
                fileBase64: await fileToBase64(file),
                rawText,
                source,
                answerMode: value('bAnswerMode') || 'auto'
            })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || '文件导入失败');
        const fullText = payload.batch?.rawText || rawText || (payload.batch?.candidates || []).map(c => c.rawText).join('\n');
        const warnings = payload.batch?.summary?.warnings || payload.batch?.warnings || [];
        if (!(payload.batch?.candidates || []).length && warnings.length && !fullText) throw new Error(warnings.join('；'));
        return { fullText, fileName: file.name, warnings };
    }
    async function getImportTextForParsing(source) {
        const files = selectedImportFiles();
        const rawText = value('bRawText');
        if (!files.length && !rawText) throw new Error('请先选择文件或粘贴文本');
        if (!files.length) return { fullText: rawText, source, fileName: '' };
        const parts = [];
        for (let index = 0; index < files.length; index += 1) {
            const item = await extractImportFile(files[index], source, index === 0 ? rawText : '');
            parts.push(item.fullText || '');
        }
        return { fullText: parts.join('\n\n'), source, fileName: files.map(file => file.name).join(' + ') };
    }
    function candidatesFromParsedOrRules(fullText, source, parsedByServer = null, importWarnings = []) {
        const localSource = parsePaperMeta(fullText, source);
        let nextSource = parsedByServer?.paperMeta ? parsePaperMeta(fullText, { ...localSource, ...parsedByServer.paperMeta }) : localSource;
        let candidates = [];
        const warnings = [...importWarnings];
        if (parsedByServer?.candidates?.length) {
            candidates = parsedByServer.candidates.map(item => candidateFromParsed(item, nextSource));
            warnings.push(...(parsedByServer.warnings || []));
            if (parsedByServer.fallbackUsed && state.aiProvider !== 'rules') {
                warnings.push(parsedByServer.usedAI
                    ? '部分题目 AI 未完成，本次已用本地规则补齐'
                    : 'AI 解析未完成，本次已使用本地规则结果');
            }
        } else {
            const blocks = splitText(fullText);
            const answerMap = parseAnswerMap(splitAnswerSection(fullText).answerText);
            candidates = blocks.map((block, index) => {
                const questionNo = questionNoFromText(block) || String(index + 1);
                return parseCandidate(block, { ...nextSource, questionNo, paperOrder: index + 1 }, answerMap[questionNo] || {});
            });
        }
        if (warnings.length) {
            candidates.forEach(c => { c.importWarnings = uniq([...(c.importWarnings || []), ...warnings]); });
        }
        return { source: nextSource, candidates, warnings };
    }
    async function parseImportUnit(fullText, source, fileName = '', warnings = []) {
        let parsedByServer = null;
        try {
            parsedByServer = await parseWithServerAI(fullText, source, fileName);
        } catch (error) {
            warnings.push(`AI 解析接口不可用，已使用前端规则：${error.message}`);
        }
        return candidatesFromParsedOrRules(fullText, source, parsedByServer, warnings);
    }
    function compareModelResults(qwen = {}, deepseek = {}) {
        const qwenItems = qwen.candidates || [];
        const deepseekItems = deepseek.candidates || [];
        const qwenMap = new Map(qwenItems.map(c => [String(c.questionNo || ''), c]));
        const deepseekMap = new Map(deepseekItems.map(c => [String(c.questionNo || ''), c]));
        const keys = uniq([...qwenMap.keys(), ...deepseekMap.keys()].filter(Boolean)).sort((a, b) => Number(a) - Number(b));
        const differences = [];
        keys.forEach(key => {
            const a = qwenMap.get(key);
            const b = deepseekMap.get(key);
            const issues = [];
            if (!a || !b) issues.push('题号缺失');
            if (a && b && normalizeAnswerText(a.answer) !== normalizeAnswerText(b.answer)) issues.push('答案不同');
            if (a && b && Number(a.score || 0) !== Number(b.score || 0)) issues.push('分值不同');
            if (a && b && Boolean(a.solution) !== Boolean(b.solution)) issues.push('解析缺失不同');
            if (a && b && String(a.stem || '').replace(/\s+/g, '').slice(0, 80) !== String(b.stem || '').replace(/\s+/g, '').slice(0, 80)) issues.push('题干差异');
            const warningA = [...(a?.warnings || []), ...(a?.aiParseWarnings || [])].filter(Boolean).join('；');
            const warningB = [...(b?.warnings || []), ...(b?.aiParseWarnings || [])].filter(Boolean).join('；');
            if (warningA !== warningB) issues.push('警告不同');
            if (issues.length) {
                differences.push({
                    questionNo: key,
                    issues,
                    qwen: a,
                    deepseek: b
                });
            }
        });
        const score = (payload, items) => {
            const warnings = (payload.warnings || []).length;
            return items.length * 4
                - items.filter(c => !c.answer).length * 3
                - items.filter(c => !c.solution).length * 2
                - items.filter(c => !Number(c.score)).length * 2
                - (payload.fallbackUsed ? 5 : 0)
                - warnings;
        };
        return {
            qwen: {
                count: qwenItems.length,
                missingAnswer: qwenItems.filter(c => !c.answer).length,
                missingSolution: qwenItems.filter(c => !c.solution).length,
                missingScore: qwenItems.filter(c => !Number(c.score)).length,
                fallbackUsed: Boolean(qwen.fallbackUsed),
                warnings: qwen.warnings || [],
                score: score(qwen, qwenItems)
            },
            deepseek: {
                count: deepseekItems.length,
                missingAnswer: deepseekItems.filter(c => !c.answer).length,
                missingSolution: deepseekItems.filter(c => !c.solution).length,
                missingScore: deepseekItems.filter(c => !Number(c.score)).length,
                fallbackUsed: Boolean(deepseek.fallbackUsed),
                warnings: deepseek.warnings || [],
                score: score(deepseek, deepseekItems)
            },
            differences
        };
    }
    function renderModelCompareResult(result) {
        const el = $('bModelCompareResult');
        if (!el) return;
        const recommended = result.qwen.score >= result.deepseek.score ? 'Qwen 千问' : 'DeepSeek';
        const rows = [
            ['Qwen 千问', result.qwen],
            ['DeepSeek', result.deepseek]
        ].map(([name, item]) => `<tr><td>${name}</td><td>${item.count}</td><td>${item.missingAnswer}</td><td>${item.missingSolution}</td><td>${item.missingScore}</td><td>${item.fallbackUsed ? '是' : '否'}</td><td>${item.warnings.length}</td></tr>`).join('');
        const diffHtml = result.differences.length
            ? result.differences.slice(0, 20).map(diff => `<article class="b-doc">
                <h3>第 ${html(diff.questionNo)} 题 <span class="b-tag orange">${diff.issues.map(html).join('、')}</span></h3>
                <p><strong>Qwen：</strong>答案 ${html(diff.qwen?.answer || '缺')}；分值 ${html(diff.qwen?.score || '缺')}；${html((diff.qwen?.warnings || diff.qwen?.aiParseWarnings || []).join('；'))}</p>
                <p><strong>DeepSeek：</strong>答案 ${html(diff.deepseek?.answer || '缺')}；分值 ${html(diff.deepseek?.score || '缺')}；${html((diff.deepseek?.warnings || diff.deepseek?.aiParseWarnings || []).join('；'))}</p>
            </article>`).join('')
            : '<div class="b-empty">两个模型结构结果一致，没有发现需要重点复核的差异题。</div>';
        el.style.display = 'block';
        el.innerHTML = `<div class="b-alert"><strong>模型对比完成，建议本次使用：${recommended}</strong><span>差异题 ${result.differences.length} 道。差异题建议人工重点复核。</span></div>
            <div class="b-box" style="margin-top:10px;overflow:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr><th>模型</th><th>题数</th><th>缺答案</th><th>缺解析</th><th>缺分值</th><th>回退</th><th>批次警告</th></tr></thead><tbody>${rows}</tbody></table></div>
            <div class="b-doc-grid" style="margin-top:12px;">${diffHtml}</div>`;
    }
    async function compareImportModels() {
        const button = $('bCompareBtn');
        const statusEl = $('bImportStatus');
        const startedAt = Date.now();
        const setStatus = text => {
            const seconds = Math.round((Date.now() - startedAt) / 1000);
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = `${text}${seconds ? ` · 已用 ${seconds} 秒` : ''}`;
            }
            if (button) button.textContent = seconds ? `模型对比中 (${seconds}s)` : '模型对比中';
        };
        button.disabled = true;
        let timer = setInterval(() => setStatus('模型对比解析中，整卷可能需要数分钟'), 1000);
        try {
            setStatus('准备同一份导入文本');
            const source = sourceFromForm();
            const { fullText, fileName } = await getImportTextForParsing(source);
            setStatus('正在调用 Qwen 与 DeepSeek');
            const [qwen, deepseek] = await Promise.all([
                parseWithServerAI(fullText, source, fileName, 'qwen'),
                parseWithServerAI(fullText, source, fileName, 'deepseek')
            ]);
            const result = compareModelResults(qwen, deepseek);
            renderModelCompareResult(result);
            setStatus(`模型对比完成：差异题 ${result.differences.length} 道`);
            toast('模型对比完成');
        } catch (error) {
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = `模型对比失败：${error.message || '未知错误'}`;
            }
            toast(error.message || '模型对比失败');
        } finally {
            clearInterval(timer);
            button.disabled = false;
            button.textContent = '模型对比解析';
        }
    }
    function splitText(text) {
        const clean = splitAnswerSection(String(text || '')).questionText.replace(/\r/g, '\n').trim();
        if (!clean) return [];
        const lines = clean.split(/\n+/).map(x => x.trim()).filter(Boolean);
        const blocks = [];
        let cur = [];
        let started = false;
        const boundary = /^(?:第\s*)?\d{1,3}\s*(?:[．、)]|\.(?!\d))|^\d{1,3}\s*[★☆]*$|^例题\s*\d+/;
        lines
            .filter(line => !/^[一二三四五六七八九十]+[、．.]\s*(?:我会|选择题|填空题|计算题|应用题|解答题|解决问题|证明题|作图题|判断题)/.test(line))
            .forEach(line => {
            if (boundary.test(line)) {
                if (cur.length && started) blocks.push(cur.join('\n'));
                cur = [line];
                started = true;
            } else {
                if (!started) return;
                cur.push(line);
            }
        });
        if (cur.length) blocks.push(cur.join('\n'));
        return blocks.filter(x => x.length >= 6);
    }
    async function createImport() {
        const button = $('bImportBtn');
        const statusEl = $('bImportStatus');
        const files = selectedImportFiles();
        const rawText = value('bRawText');
        if (!files.length && !rawText) return toast('请先选择文件或粘贴文本');
        const startedAt = Date.now();
        let timer = null;
        let statusText = '准备导入';
        const setStatus = (text) => {
            statusText = text;
            const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.textContent = `${statusText}${seconds ? ` · 已用 ${seconds} 秒` : ''}`;
            }
            if (button) button.textContent = seconds ? `${text} (${seconds}s)` : text;
        };
        button.disabled = true;
        setStatus('准备导入');
        timer = setInterval(() => setStatus(statusText), 1000);
        try {
            const baseSource = sourceFromForm();
            const multiMode = value('bMultiFileMode') || 'separate';
            const createdCandidates = [];
            let firstSource = baseSource;
            if (files.length > 1 && multiMode === 'separate') {
                for (let index = 0; index < files.length; index += 1) {
                    const file = files[index];
                    setStatus(`提取文档文本 ${index + 1}/${files.length}`);
                    const extracted = await extractImportFile(file, baseSource, index === 0 ? rawText : '');
                    setStatus(state.aiProvider === 'rules' ? `本地规则拆题 ${index + 1}/${files.length}` : `AI 解析 ${index + 1}/${files.length}`);
                    const parsed = await parseImportUnit(extracted.fullText, baseSource, extracted.fileName, extracted.warnings);
                    if (index === 0) firstSource = parsed.source;
                    createPaperFromImport(parsed.source, parsed.candidates, extracted.fileName);
                    createdCandidates.push(...parsed.candidates);
                    state.lastImportRawText = [state.lastImportRawText, `【文件：${extracted.fileName}】\n${extracted.fullText || ''}`].filter(Boolean).join('\n\n');
                }
            } else {
                let fullText = rawText;
                let fileName = '';
                let warnings = [];
                if (files.length) {
                    setStatus('提取文档文本');
                    const parts = [];
                    for (let index = 0; index < files.length; index += 1) {
                        const extracted = await extractImportFile(files[index], baseSource, index === 0 ? rawText : '');
                        fileName = files.map(file => file.name).join(' + ');
                        warnings.push(...(extracted.warnings || []));
                        parts.push(extracted.fullText || '');
                    }
                    fullText = parts.join('\n\n');
                }
                setStatus(state.aiProvider === 'rules' ? '本地规则拆题' : 'AI 分块解析，整卷可能需要 1-2 分钟');
                const parsed = await parseImportUnit(fullText, baseSource, fileName, warnings);
                firstSource = parsed.source;
                createPaperFromImport(parsed.source, parsed.candidates, fileName);
                createdCandidates.push(...parsed.candidates);
                state.lastImportRawText = fullText || '';
            }
            setStatus('生成候选题');
            applySourceToForm(firstSource);
            state.lastImportSummary = buildImportSummary(createdCandidates, files, firstSource);
            state.candidates.unshift(...createdCandidates);
            $('bRawText').value = '';
            if ($('bImportFile')) $('bImportFile').value = '';
            save();
            renderAll();
            switchView('candidates');
            setStatus(`已生成 ${createdCandidates.length} 道候选题`);
            toast(`已生成 ${createdCandidates.length} 道候选题`);
        } catch (error) {
            setStatus('导入失败');
            toast(error.message || '导入失败');
        } finally {
            if (timer) clearInterval(timer);
            button.disabled = false;
            button.textContent = '生成候选题';
            if (statusEl && !/^已生成|导入失败/.test(statusText)) statusEl.style.display = 'none';
        }
    }
    function buildImportSummary(candidates = [], files = [], source = {}) {
        const warnings = uniq(candidates.flatMap(c => [...(c.importWarnings || []), ...(c.aiParseWarnings || []), ...(c.warnings || [])].filter(Boolean)));
        return {
            fileCount: files.length || 0,
            fileNames: files.map(file => file.name),
            candidateCount: candidates.length,
            aiSuccess: candidates.filter(c => c.parseStatus === 'ai-success').length,
            aiPartial: candidates.filter(c => c.parseStatus === 'ai-partial').length,
            localFallback: candidates.filter(c => /local|fallback|rules/.test(c.parseStatus || '')).length,
            missingAnswer: candidates.filter(c => !c.answer).length,
            missingSolution: candidates.filter(c => !c.solution).length,
            missingImage: candidates.filter(c => /如图|图中|下图/.test(c.stem || '') && !questionHasImage(c)).length,
            sourceTitle: paperTitle(source, files.map(file => file.name).join(' + ')),
            warnings: warnings.slice(0, 6),
            createdAt: new Date().toISOString()
        };
    }
    function renderImportBatchStatus() {
        const el = $('bImportBatchStatus');
        if (!el) return;
        const s = state.lastImportSummary;
        if (!s) {
            el.innerHTML = '<h3>本次导入状态</h3><p>导入后这里会显示文件数、AI 成功、规则兜底和需要复核的字段。</p>';
            return;
        }
        const stats = [
            ['文件', s.fileCount || (s.fileNames || []).length || '文本'],
            ['候选题', s.candidateCount],
            ['AI 成功', s.aiSuccess],
            ['部分成功', s.aiPartial],
            ['规则兜底', s.localFallback],
            ['缺答案', s.missingAnswer],
            ['缺解析', s.missingSolution],
            ['含图缺附件', s.missingImage]
        ];
        el.innerHTML = `<h3>本次导入状态</h3>
            <p>${html(s.sourceTitle || '未命名资料')} · ${html((s.createdAt || '').slice(0, 10))}</p>
            <div class="b-tags">${stats.map(([label, value]) => `<span class="b-tag ${Number(value) > 0 && /兜底|缺/.test(label) ? 'orange' : ''}">${html(label)} ${html(value)}</span>`).join('')}</div>
            ${(s.warnings || []).length ? `<p>${s.warnings.map(html).join('；')}</p>` : '<p>暂无批次级警告。</p>'}`;
    }
    function renderImportNeedsReview(warnings = [], rawText = '', fileName = '') {
        const preview = String(rawText || '').trim().slice(0, 1800);
        const hasText = Boolean(preview);
        $('bCandidateReview').innerHTML = `<div class="b-alert warning"><strong>文件需要人工处理</strong><span>${warnings.map(html).join('；') || '当前文件无法可靠切题。'}</span></div>
            <div class="b-doc" style="margin-top:12px;">
                <h3>建议处理方式</h3>
                <p>这类 PDF 常见问题是版面分栏、答案解析穿插、扫描图片或复制顺序混乱。为了避免生成乱码题，系统没有把它放入候选题池。</p>
                <div class="b-actions" style="justify-content:flex-start;margin-top:10px;">
                    <button class="b-btn primary" onclick="B.useLastImportText()">把提取文本放回导入框</button>
                    <button class="b-btn" onclick="B.copyLastImportText()">复制提取文本</button>
                    <button class="b-btn" onclick="B.switchView('import')">回到导入中心</button>
                </div>
            </div>
            <div class="b-doc" style="margin-top:12px;">
                <h3>${html(fileName || '提取文本预览')}</h3>
                ${hasText ? `<div class="b-box" style="max-height:360px;overflow:auto;white-space:pre-wrap;">${html(preview)}${String(rawText || '').length > preview.length ? '\n\n……（仅显示前 1800 字）' : ''}</div>` : '<p>没有提取到可用文本。建议先用 OCR 工具识别为连续文本，再粘贴到导入中心。</p>'}
            </div>`;
    }
    function useLastImportText() {
        switchView('import');
        if ($('bImportType')) $('bImportType').value = 'text';
        if ($('bRawText')) {
            $('bRawText').value = state.lastImportRawText || '';
            $('bRawText').focus();
        }
        toast(state.lastImportRawText ? '已放回导入框，可整理后重新生成' : '没有可用提取文本');
    }
    function copyLastImportText() {
        copyText(state.lastImportRawText || '', '已复制提取文本');
    }
    function switchView(view) {
        state.view = view;
        document.querySelector('.b-shell')?.classList.toggle('compose-mode', view === 'compose');
        document.querySelectorAll('.b-view').forEach(el => el.classList.toggle('active', el.id === `bView-${view}`));
        document.querySelectorAll('.b-nav button[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
        document.querySelectorAll('.b-flow-step').forEach(el => el.classList.toggle('active', el.dataset.flow === view));
        const h = help[view] || help.import;
        $('bTitle').textContent = h[0];
        $('bSubtitle').textContent = h[1];
        $('bHelpTitle').textContent = h[0];
        $('bHelpText').textContent = h[1];
        $('bHelpActions').innerHTML = h[2].map(([label, action, kind]) => `<button class="b-btn ${kind}" onclick="${action}">${html(label)}</button>`).join('');
        if (view === 'quality') renderQuality();
        if (view === 'compose') {
            applyOutlineWidth();
            syncOutputTabs();
            ensurePaperDraftFromBasket();
            renderBasket();
            renderPaperDraft();
            renderOutputSide();
            refreshOutput();
        }
        if (view === 'papers') renderPapers();
        queueMathTypeset($(`bView-${view}`));
    }
    function renderKpis() {
        const qs = state.questions.filter(q => q.status !== 'archived');
        const checks = [
            ['正式题', qs.length],
            ['待确认', state.candidates.filter(c => c.status === 'pending').length],
            ['题篮', state.basket.length],
            ['缺答案', qs.filter(q => !q.answer).length],
            ['缺解析', qs.filter(q => !q.solution).length],
            ['含图题', qs.filter(questionHasImage).length],
            ['含公式', qs.filter(questionHasFormula).length]
        ];
        const markup = checks.map(([label, n]) => `<div class="b-kpi"><strong>${n}</strong><span>${html(label)}</span></div>`).join('');
        if ($('bAsideKpis')) $('bAsideKpis').innerHTML = markup;
        if ($('bKpis')) $('bKpis').innerHTML = markup;
        if ($('bRailBasketBadge')) $('bRailBasketBadge').textContent = String(state.basket.length);
        syncUndoButton();
    }
    function applyAsideState() {
        const collapsed = localStorage.getItem(ASIDE_KEY) === '1';
        document.querySelector('.b-shell')?.classList.toggle('aside-collapsed', collapsed);
        $('bAside')?.classList.toggle('collapsed', collapsed);
        if ($('bAsideToggle')) $('bAsideToggle').textContent = collapsed ? '展开' : '收起';
    }
    function applyMainNavState() {
        const collapsed = localStorage.getItem(MAIN_NAV_KEY) === '1';
        document.querySelector('.b-shell')?.classList.toggle('nav-collapsed', collapsed);
        const btn = $('bMainNavToggle');
        if (btn) {
            btn.textContent = collapsed ? '›' : '‹';
            btn.title = collapsed ? '展开左侧模块' : '折叠左侧模块';
        }
    }
    function toggleMainNav() {
        const next = !(localStorage.getItem(MAIN_NAV_KEY) === '1');
        localStorage.setItem(MAIN_NAV_KEY, next ? '1' : '0');
        applyMainNavState();
    }
    function toggleAside() {
        const next = !(localStorage.getItem(ASIDE_KEY) === '1');
        localStorage.setItem(ASIDE_KEY, next ? '1' : '0');
        applyAsideState();
    }
    function startOutlineResize(event) {
        event.preventDefault();
        const shell = document.querySelector('.b-compose-workbench');
        if (!shell) return;
        const startX = event.clientX;
        const current = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--b-outline-width')) || 190;
        const onMove = moveEvent => {
            const next = Math.min(340, Math.max(44, current + moveEvent.clientX - startX));
            shell.style.setProperty('--b-outline-width', `${next}px`);
            localStorage.setItem('qb-b-outline-width', String(Math.round(next)));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    function startBankResize(event) {
        event.preventDefault();
        const grid = $('bBankGrid');
        if (!grid) return;
        const startX = event.clientX;
        const current = Number.parseFloat(getComputedStyle(grid).getPropertyValue('--b-bank-filter-width')) || 300;
        const onMove = moveEvent => {
            const next = Math.min(460, Math.max(145, current + moveEvent.clientX - startX));
            grid.style.setProperty('--b-bank-filter-width', `${next}px`);
            localStorage.setItem('qb-bank-filter-width', String(Math.round(next)));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    function startOutputSideResize(event) {
        event.preventDefault();
        const shell = document.querySelector('.b-compose-workbench');
        if (!shell) return;
        const startX = event.clientX;
        const current = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--b-output-side-width')) || 320;
        const onMove = moveEvent => {
            const next = Math.min(520, Math.max(280, current - (moveEvent.clientX - startX)));
            shell.style.setProperty('--b-output-side-width', `${next}px`);
            localStorage.setItem(OUTPUT_SIDE_WIDTH_KEY, String(Math.round(next)));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    function applyOutlineWidth() {
        const saved = Number(localStorage.getItem('qb-b-outline-width') || 0);
        if (!saved) return;
        document.querySelector('.b-compose-workbench')?.style.setProperty('--b-outline-width', `${Math.min(340, Math.max(44, saved))}px`);
    }
    function applyOutputSideWidth() {
        const saved = Number(localStorage.getItem(OUTPUT_SIDE_WIDTH_KEY) || 0);
        if (!saved) return;
        document.querySelector('.b-compose-workbench')?.style.setProperty('--b-output-side-width', `${Math.min(520, Math.max(280, saved))}px`);
    }
    function applyBankFilterWidth() {
        const saved = Number(localStorage.getItem('qb-bank-filter-width') || 0);
        if (!saved) return;
        $('bBankGrid')?.style.setProperty('--b-bank-filter-width', `${Math.min(460, Math.max(145, saved))}px`);
    }
    function renderCandidates() {
        $('bCandidateCount').textContent = `${state.candidates.length} 题`;
        $('bCandidateSelected').textContent = `已选 ${state.selectedCandidates.size}`;
        updateCandidateSelectButton();
        const list = $('bCandidateList');
        if (!state.candidates.length) {
            list.innerHTML = '<div class="b-empty">暂无候选题。请先到导入中心生成。</div>';
            return;
        }
        list.innerHTML = state.candidates.map((c, index) => `<article class="b-card selectable ${state.activeCandidateId === c.id ? 'selected' : ''}">
            <div class="b-card-check"><input type="checkbox" ${state.selectedCandidates.has(c.id) ? 'checked' : ''} onchange="B.toggleCandidate('${c.id}', this.checked)"></div>
            <div>
            <div class="b-card-top">
                <div>
                    <div class="b-card-title">${html(c.source?.questionNo ? `原第 ${c.source.questionNo} 题` : `候选 ${index + 1}`)}</div>
                    <div class="b-tags">${candidateSummaryTags(c).map(tag => `<span class="b-tag ${tag.kind || ''}">${html(tag.label)}</span>`).join('')}</div>
                </div>
                <button class="b-btn small primary" onclick="B.reviewCandidate('${c.id}')">校对</button>
            </div>
            <div class="b-stem compact">${textWithMath(candidateSummaryText(c))}</div>
            </div>
        </article>`).join('');
        queueMathTypeset(list);
    }
    function candidateSummaryText(c = {}) {
        const text = String(c.stem || c.rawText || '').replace(/\s+/g, ' ').trim();
        return text.length > 72 ? `${text.slice(0, 72)}...` : text || '待补题干';
    }
    function candidateSummaryTags(c = {}) {
        const tags = [
            { label: c.status === 'pending' ? '待确认' : c.status },
            c.parseStatusLabel ? { label: c.parseStatusLabel, kind: c.parseStatus === 'ai-success' ? 'green' : c.parseStatus === 'ai-partial' ? 'orange' : 'red' } : null,
            c.questionType ? { label: c.questionType } : null,
            c.score ? { label: `${c.score}分` } : null,
            c.answer ? { label: '有答案', kind: 'green' } : { label: '缺答案', kind: 'red' },
            questionImages(c).length ? { label: '含图', kind: 'orange' } : null,
            hasMathSignal([c.stem, c.answer, c.solution].join(' ')) ? { label: '含公式', kind: 'blue' } : null
        ].filter(Boolean);
        const reviewWarnings = (c.fieldWarnings || c.aiParseWarnings || c.warnings || [])
            .filter(Boolean)
            .filter(w => !/^第\s*\d+/.test(w))
            .slice(0, 2)
            .map(w => ({ label: w, kind: 'red' }));
        return [...tags, ...reviewWarnings];
    }
    function reviewCandidate(candidateId) {
        state.activeCandidateId = candidateId;
        const c = state.candidates.find(x => x.id === candidateId);
        if (!c) return;
        $('bCandidateReview').innerHTML = `<div class="b-review-shell">
            <div>
                ${candidateReviewNotice(c)}
                <section class="b-review-section">
                    <h3>原文 / 原始抽取</h3>
                    <div class="b-box">${textWithMath(c.rawText || c.originText || c.stem || '暂无原文')}</div>
                </section>
                <section class="b-review-section">
                    <h3>解析状态</h3>
                    <div class="b-tags">${candidateReviewTags(c)}</div>
                    ${(c.importWarnings || []).length ? `<div class="b-tags">${c.importWarnings.map(w => `<span class="b-tag orange">${html(w)}</span>`).join('')}</div>` : ''}
                </section>
                <section class="b-review-section">
                    <h3>来源信息</h3>
                    <div class="b-box">${html(sourceLabel(c.source))}</div>
                </section>
                ${questionImages(c).length ? `<section class="b-review-section"><h3>图片附件</h3>${renderRoleImages(c)}</section>` : ''}
            </div>
            <div class="b-form b-review-form">
                <section class="b-review-section">
                    <h3>结构化结果</h3>
                <div class="b-row three"><div><label>原试卷题号</label><input id="bCandQuestionNo" value="${html(c.source?.questionNo || '')}"></div><div><label>年级</label><select id="bCandGrade">${grades.map(g => `<option ${g === c.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div><div><label>章节</label><input id="bCandChapter" value="${html(c.chapter)}"></div></div>
                <div class="b-row three"><div><label>题型</label><input id="bCandType" value="${html(c.questionType)}"></div><div><label>难度</label><select id="bCandDifficulty">${difficulties.map(d => `<option ${d === c.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div><label>分值</label><input id="bCandScore" type="number" min="0" step="1" value="${html(c.score || 5)}"></div></div>
                <div><label>题干</label><textarea id="bCandStem" rows="7">${html(c.stem)}</textarea></div>
                <div class="b-row"><div><label>知识点</label><input id="bCandKnowledge" value="${html((c.knowledgePoints || []).join('、'))}"></div><div><label>答案</label><textarea id="bCandAnswer" rows="4">${html(c.answer)}</textarea></div></div>
                </section>
                <section class="b-review-section">
                    <h3>图片归属</h3>
                <div class="b-row three">
                    <div><label>题干图</label><input id="bCandStemImage" value="${html(firstImageByRole(c, 'stem') || c.imageUrl || '')}" placeholder="上传或粘贴链接/路径"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandStemImage')"></div>
                    <div><label>A 图</label><input id="bCandOptionAImage" value="${html(firstImageByRole(c, 'option-A'))}" placeholder="选项 A 图片"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandOptionAImage')"></div>
                    <div><label>B 图</label><input id="bCandOptionBImage" value="${html(firstImageByRole(c, 'option-B'))}" placeholder="选项 B 图片"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandOptionBImage')"></div>
                </div>
                <div class="b-row three">
                    <div><label>C 图</label><input id="bCandOptionCImage" value="${html(firstImageByRole(c, 'option-C'))}" placeholder="选项 C 图片"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandOptionCImage')"></div>
                    <div><label>D 图</label><input id="bCandOptionDImage" value="${html(firstImageByRole(c, 'option-D'))}" placeholder="选项 D 图片"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandOptionDImage')"></div>
                    <div><label>解析图</label><input id="bCandSolutionImage" value="${html(firstImageByRole(c, 'solution'))}" placeholder="教师版解析图片"><input type="file" accept="image/*" onchange="B.uploadCandidateImage(this.files[0], 'bCandSolutionImage')"></div>
                </div>
                <input id="bCandImage" type="hidden" value="${html(c.imageUrl || '')}">
                </section>
                <section class="b-review-section">
                    <h3>解析</h3>
                <div><label>解析</label><textarea id="bCandSolution" rows="6">${html(c.solution)}</textarea></div>
                </section>
                <div class="b-actions" style="justify-content:flex-start;"><button class="b-btn" onclick="B.ignoreCandidate('${c.id}')">忽略</button><button class="b-btn red" onclick="B.deleteCandidate('${c.id}')">删除</button><button class="b-btn primary" onclick="B.acceptCandidate('${c.id}')">确认入库</button></div>
            </div>
        </div>`;
        renderCandidates();
        queueMathTypeset($('bCandidateReview'));
    }
    function candidateReviewNotice(c = {}) {
        if (['local-fallback', 'local-rules'].includes(c.parseStatus)) {
            return `<div class="b-alert warning"><strong>${html(c.parseStatusLabel || '本地规则兜底')}</strong><span>这道题没有完整使用 AI 结构化解析，建议重点复核题干、答案、解析、图片和公式。</span></div>`;
        }
        if (c.parseStatus === 'ai-partial') {
            return '<div class="b-alert warning"><strong>AI 部分成功</strong><span>部分字段置信度较低，请按红色标签复核。</span></div>';
        }
        return '<div class="b-alert success"><strong>AI 成功</strong><span>仍需人工确认后才会进入正式题库。</span></div>';
    }
    function candidateReviewTags(c = {}) {
        const warnings = uniq([...(c.fieldWarnings || []), ...(c.aiParseWarnings || []), ...(c.warnings || [])]);
        const status = `<span class="b-tag ${c.parseStatus === 'ai-success' ? 'green' : c.parseStatus === 'ai-partial' ? 'orange' : 'red'}">${html(c.parseStatusLabel || '待复核')}</span>`;
        return status + (warnings.length ? warnings.map(w => `<span class="b-tag red">${html(w)}</span>`).join('') : '<span class="b-tag green">暂无字段警告</span>');
    }
    function readCandidateEditor(c) {
        const next = {
            ...c,
            grade: value('bCandGrade'),
            chapter: value('bCandChapter'),
            questionType: value('bCandType'),
            difficulty: normalizeDifficulty(value('bCandDifficulty')),
            knowledgePoints: splitList(value('bCandKnowledge')),
            stem: value('bCandStem'),
            answer: normalizeAnswerText(value('bCandAnswer')),
            solution: value('bCandSolution'),
            score: Number(value('bCandScore') || c.score || 5),
            imageUrl: value('bCandStemImage') || value('bCandImage'),
            images: buildRoleImagesFromCandidateEditor(c)
        };
        next.source = { ...(c.source || {}), questionNo: value('bCandQuestionNo') || c.source?.questionNo || questionNoFromText(next.rawText || next.stem) };
        return next;
    }
    function acceptCandidate(candidateId) {
        const c = state.candidates.find(x => x.id === candidateId);
        if (!c) return;
        const next = readCandidateEditor(c);
        if (!next.stem || !next.grade || !next.chapter) return toast('确认入库需要题干、年级、章节');
        const question = toQuestion(next);
        state.questions.unshift(question);
        attachQuestionToPaper(question, next);
        state.candidates = state.candidates.filter(x => x.id !== candidateId);
        state.selectedCandidates.delete(candidateId);
        state.activeCandidateId = '';
        $('bCandidateReview').innerHTML = '<div class="b-empty">已确认入库。继续选择下一道候选题。</div>';
        save();
        renderAll();
        toast('已确认入库到正式题库');
    }
    function nextInternalNo(offset = 0) {
        const nums = state.questions
            .map(q => String(q.internalNo || '').match(/^B-(\d+)$/)?.[1])
            .filter(Boolean)
            .map(Number)
            .filter(Number.isFinite);
        const base = nums.length ? Math.max(...nums) : state.questions.filter(q => /^B-/.test(q.internalNo || '')).length;
        return `B-${String(base + offset + 1).padStart(5, '0')}`;
    }
    function batchAcceptCandidates() {
        const selected = state.candidates.filter(c => state.selectedCandidates.has(c.id) && c.status === 'pending');
        if (!selected.length) return toast('请先选择待确认题');
        const ready = selected.filter(c => c.stem && c.grade && c.chapter);
        const skipped = selected.length - ready.length;
        const questions = ready.map((c, index) => toQuestion(c, index));
        state.questions.unshift(...questions);
        questions.forEach((question, index) => attachQuestionToPaper(question, ready[index]));
        const acceptedIds = new Set(ready.map(c => c.id));
        state.candidates = state.candidates.filter(c => !acceptedIds.has(c.id));
        ready.forEach(c => state.selectedCandidates.delete(c.id));
        if (state.activeCandidateId && acceptedIds.has(state.activeCandidateId)) {
            state.activeCandidateId = '';
            $('bCandidateReview').innerHTML = '<div class="b-empty">已批量入库。继续选择下一道候选题。</div>';
        }
        save();
        renderAll();
        toast(`已入库 ${ready.length} 道${skipped ? `，跳过 ${skipped} 道缺字段题` : ''}`);
    }
    function toQuestion(c, offset = 0) {
        return {
            id: id('bq'),
            internalNo: c.internalNo || nextInternalNo(offset),
            grade: c.grade,
            system: c.grade === '六年级' ? '小升初' : '校内',
            chapter: c.chapter,
            knowledgePoints: c.knowledgePoints || [],
            subKnowledgePoint: c.subKnowledgePoint || '',
            questionType: c.questionType,
            difficulty: normalizeDifficulty(c.difficulty),
            score: Number(c.score || (c.difficulty === '压轴' ? 12 : c.difficulty === '提高' ? 8 : 5)),
            stem: c.stem,
            answer: normalizeAnswerText(c.answer || ''),
            solution: c.solution || '',
            formulaLatex: c.formulaLatex || extractFormula(c.stem),
            diagramSvg: c.diagramSvg || '',
            imageUrl: c.imageUrl || '',
            images: c.images || (c.imageUrl ? [{ url: c.imageUrl, role: 'stem', order: 1 }] : []),
            imageSize: c.imageSize || 'medium',
            commonMistakes: c.commonMistakes || '',
            errorTags: c.errorTags || [],
            source: c.source || {},
            sourceName: c.sourceName || sourceLabel(c.source),
            aiNotes: '正式题库人工确认入库。',
            originText: c.rawText || c.stem,
            status: 'active',
            createdAt: new Date().toISOString()
        };
    }
    function attachQuestionToPaper(question, candidate = {}) {
        const paperId = candidate.source?.paperId || question.source?.paperId;
        if (!paperId) return;
        const paper = state.paperLibrary.find(item => item.id === paperId);
        if (!paper) return;
        paper.questionIds = uniq([...(paper.questionIds || []), question.id]);
        const order = Number(candidate.source?.paperOrder || question.source?.paperOrder || paper.questionIds.length);
        paper.questionOrder = [
            ...(paper.questionOrder || []).filter(item => item.questionId !== question.id),
            {
                questionId: question.id,
                candidateId: candidate.id || '',
                questionNo: candidate.source?.questionNo || question.source?.questionNo || '',
                paperOrder: order
            }
        ];
    }
    function extractFormula(text) {
        const m = String(text || '').match(/\\\((.+?)\\\)/);
        return m ? m[1] : '';
    }
    function ignoreCandidate(candidateId) {
        const c = state.candidates.find(x => x.id === candidateId);
        if (c) c.status = 'ignored';
        save();
        renderAll();
    }
    function deleteCandidate(candidateId) {
        state.candidates = state.candidates.filter(x => x.id !== candidateId);
        state.selectedCandidates.delete(candidateId);
        save();
        renderAll();
    }
    function toggleCandidate(candidateId, checked) {
        if (checked) state.selectedCandidates.add(candidateId);
        else state.selectedCandidates.delete(candidateId);
        renderCandidates();
    }
    function selectableCandidates() {
        return state.candidates.filter(c => c.status === 'pending');
    }
    function candidateSelectionComplete() {
        const items = selectableCandidates();
        return items.length > 0 && items.every(c => state.selectedCandidates.has(c.id));
    }
    function updateCandidateSelectButton() {
        const button = $('bSelectCandidatesBtn');
        if (button) button.textContent = candidateSelectionComplete() ? '取消当前全选' : '全选待确认';
    }
    function toggleAllCandidates() {
        const items = selectableCandidates();
        if (!items.length) return toast('暂无待确认候选题');
        if (candidateSelectionComplete()) {
            items.forEach(c => state.selectedCandidates.delete(c.id));
        } else {
            items.forEach(c => state.selectedCandidates.add(c.id));
        }
        renderCandidates();
    }
    function selectAllCandidates(checked) {
        state.selectedCandidates.clear();
        if (checked) state.candidates.filter(c => c.status === 'pending').forEach(c => state.selectedCandidates.add(c.id));
        renderCandidates();
    }
    function batchDelete() {
        state.candidates = state.candidates.filter(c => !state.selectedCandidates.has(c.id));
        state.selectedCandidates.clear();
        save();
        renderAll();
        toast('已批量删除');
    }
    function batchIgnore() {
        state.candidates.forEach(c => { if (state.selectedCandidates.has(c.id)) c.status = 'ignored'; });
        state.selectedCandidates.clear();
        save();
        renderAll();
        toast('已批量忽略');
    }
    function batchMark() {
        const ids = [...state.selectedCandidates];
        if (!ids.length) return toast('请先选择候选题');
        openModal('批量标记候选题', `<div class="b-form">
            <div class="b-row"><div><label>年级</label><select id="bBatchGrade"><option value="">不变</option>${grades.map(g => `<option>${g}</option>`).join('')}</select></div><div><label>章节</label><input id="bBatchChapter" placeholder="如：几何"></div></div>
            <div><label>知识点</label><input id="bBatchKnowledge" placeholder="多个用顿号"></div>
            <div class="b-actions"><button class="b-btn" onclick="B.closeModal()">取消</button><button class="b-btn primary" onclick="B.applyBatchMark()">应用</button></div>
        </div>`);
    }
    function applyBatchMark() {
        state.candidates.forEach(c => {
            if (!state.selectedCandidates.has(c.id)) return;
            if (value('bBatchGrade')) c.grade = value('bBatchGrade');
            if (value('bBatchChapter')) c.chapter = value('bBatchChapter');
            if (value('bBatchKnowledge')) c.knowledgePoints = splitList(value('bBatchKnowledge'));
        });
        state.selectedCandidates.clear();
        closeModal();
        save();
        renderAll();
        toast('已批量标记');
    }
    function renderBankOptions() {
        setOptions('bFilterGrade', ['全部年级', ...grades, ...uniq(state.questions.map(q => q.grade))]);
        setOptions('bFilterYear', ['全部年份', ...uniq(state.questions.map(q => q.source?.year || q.year).filter(Boolean)).sort((a, b) => String(b).localeCompare(String(a)))]);
        setOptions('bFilterChapter', ['全部章节', ...chapters, ...uniq(state.questions.map(q => q.chapter))]);
        setOptions('bFilterType', ['全部题型', ...types, ...uniq(state.questions.map(q => q.questionType))]);
        setOptions('bFilterDifficulty', ['全部难度', ...difficulties]);
        renderBankFilterSchemes();
    }
    function setOptions(idName, items) {
        const el = $(idName);
        if (!el) return;
        const old = el.value;
        el.innerHTML = items.map((x, i) => `<option value="${i ? html(x) : ''}">${html(x)}</option>`).join('');
        if ([...el.options].some(o => o.value === old)) el.value = old;
    }
    function getFilteredQuestions() {
        const search = value('bFilterSearch').toLowerCase();
        return state.questions.filter(q => {
            const hay = [q.internalNo, q.stem, q.answer, q.solution, q.grade, q.chapter, q.questionType, q.difficulty, q.sourceName, ...(q.knowledgePoints || [])].join(' ').toLowerCase();
            if (search && !hay.includes(search)) return false;
            if (value('bFilterGrade') && q.grade !== value('bFilterGrade')) return false;
            if (value('bFilterYear') && String(q.source?.year || q.year || '') !== value('bFilterYear')) return false;
            if (value('bFilterChapter') && q.chapter !== value('bFilterChapter')) return false;
            if (value('bFilterType') && q.questionType !== value('bFilterType')) return false;
            if (value('bFilterDifficulty') && q.difficulty !== value('bFilterDifficulty')) return false;
            if ($('bFilterFormula')?.checked && !questionHasFormula(q)) return false;
            if ($('bFilterDiagram')?.checked && !questionHasImage(q)) return false;
            return q.status !== 'archived';
        });
    }
    function renderBank() {
        renderBankOptions();
        state.filtered = getFilteredQuestions();
        $('bQuestionCount').textContent = `${state.filtered.length} 题`;
        if ($('bQuestionSelected')) $('bQuestionSelected').textContent = `已选 ${state.selectedQuestions.size}`;
        const list = $('bQuestionList');
        list?.classList.toggle('compact', state.bankDensity === 'compact');
        if (!state.filtered.length) {
            list.innerHTML = '<div class="b-empty">当前筛选下没有题目。</div>';
            updateFilteredSelectButton();
            return;
        }
        list.innerHTML = state.filtered.map(q => renderQuestionCard(q)).join('');
        updateFilteredSelectButton();
        queueMathTypeset(list);
    }
    function currentBankFilterSnapshot() {
        return {
            search: value('bFilterSearch'),
            grade: value('bFilterGrade'),
            year: value('bFilterYear'),
            chapter: value('bFilterChapter'),
            type: value('bFilterType'),
            difficulty: value('bFilterDifficulty'),
            formula: Boolean($('bFilterFormula')?.checked),
            diagram: Boolean($('bFilterDiagram')?.checked)
        };
    }
    function bankFilterLabel(filter = {}) {
        const parts = [filter.grade, filter.year, filter.chapter, filter.type, filter.difficulty, filter.formula ? '含公式' : '', filter.diagram ? '含图' : '', filter.search].filter(Boolean);
        return parts.join(' · ') || '全部题目';
    }
    function saveBankFilterScheme() {
        const filter = currentBankFilterSnapshot();
        const label = window.prompt('给这组筛选起个名字', bankFilterLabel(filter));
        if (!label) return;
        state.bankFilterSchemes = [{ id: id('scheme'), label, filter }, ...state.bankFilterSchemes.filter(item => item.label !== label)].slice(0, 8);
        save();
        renderBankFilterSchemes();
        toast('已保存筛选方案');
    }
    function applyBankFilterScheme(schemeId) {
        const scheme = state.bankFilterSchemes.find(item => item.id === schemeId);
        if (!scheme) return;
        const filter = scheme.filter || {};
        const set = (idName, next) => { const el = $(idName); if (el) el.value = next || ''; };
        set('bFilterSearch', filter.search);
        set('bFilterGrade', filter.grade);
        set('bFilterYear', filter.year);
        set('bFilterChapter', filter.chapter);
        set('bFilterType', filter.type);
        set('bFilterDifficulty', filter.difficulty);
        if ($('bFilterFormula')) $('bFilterFormula').checked = Boolean(filter.formula);
        if ($('bFilterDiagram')) $('bFilterDiagram').checked = Boolean(filter.diagram);
        renderBank();
    }
    function renderBankFilterSchemes() {
        const el = $('bBankFilterSchemes');
        if (!el) return;
        el.innerHTML = state.bankFilterSchemes.length
            ? state.bankFilterSchemes.map(item => `<button class="b-finder-chip" type="button" onclick="B.applyBankFilterScheme('${item.id}')">${html(item.label)}</button>`).join('')
            : '<span class="b-tag">可保存常用筛选</span>';
    }
    function toggleBankDensity() {
        state.bankDensity = state.bankDensity === 'compact' ? 'expanded' : 'compact';
        save();
        renderBank();
    }
    function renderQuestionCard(q) {
        const selected = state.basket.includes(q.id);
        const checked = state.selectedQuestions.has(q.id);
        const highlighted = state.highlightedQuestionId === q.id;
        const answer = q.answer || '待补充';
        const solution = cleanSolutionForOutput(q.solution) || '待补充';
        const source = sourceLabel(q.source) || q.sourceName || '';
        return `<article class="b-card selectable ${selected ? 'selected' : ''} ${highlighted ? 'highlighted' : ''} ${imageSizeClass(q)}" id="bqCard-${html(q.id)}">
            <div class="b-card-check"><input type="checkbox" ${checked ? 'checked' : ''} onchange="B.toggleQuestionSelection('${q.id}', this.checked)"></div>
            <div>
            <div class="b-card-top"><div><div class="b-card-title">${html(q.stem).slice(0, 92)}${q.stem.length > 92 ? '...' : ''}</div><div class="b-tags">${[q.internalNo, q.source?.questionNo ? `原第 ${q.source.questionNo} 题` : '', q.grade, q.chapter, q.questionType, q.difficulty, `${q.score}分`].filter(Boolean).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}${questionHasFormula(q) ? '<span class="b-tag blue">公式</span>' : ''}${questionHasImage(q) ? '<span class="b-tag orange">图形</span>' : ''}${qualityFlags(q).map(x => `<span class="b-tag red">${html(x)}</span>`).join('')}</div></div><div class="b-actions"><button class="b-btn small ${selected ? '' : 'primary'}" onclick="B.toggleBasket('${q.id}')">${selected ? '移出' : '加入'}</button><button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">编辑</button>${!q.answer ? `<button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">补答案</button>` : ''}${!q.solution ? `<button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">补解析</button>` : ''}</div></div>
            ${questionHasImage(q) ? `<div class="b-card-image-preview" onclick="B.selectQuestionImage('${html(q.id)}')">${q.diagramSvg ? renderQuestionBankMedia(`<div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div>`, q, 'SVG 图形') : ''}${renderRoleImages(q, { bankQuestionId: q.id })}</div>` : ''}
            <details class="b-fold"><summary>显示答案</summary><div class="b-inline-answer-content"><strong>答案：</strong>${formulaForHtml(answer)}<br><strong>解析：</strong>${formulaForHtml(solution)}${imageItemsByRole(q, 'solution').map((url, imageIndex) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="解析图${imageIndex + 1}">`).join('')}</div></details>
            <details class="b-fold"><summary>查看题干 / 来源</summary>
                <div class="b-stem">${renderText(q.stem)}</div>
                ${q.diagramSvg ? renderQuestionBankMedia(`<div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div>`, q, 'SVG 图形') : ''}
                ${renderRoleImages(q, { bankQuestionId: q.id })}
                ${questionHasImage(q) ? `<div class="b-image-size-control">图形大小 <select onchange="B.setQuestionImageSize('${q.id}', this.value)"><option value="small" ${q.imageSize === 'small' ? 'selected' : ''}>小</option><option value="medium" ${!q.imageSize || q.imageSize === 'medium' ? 'selected' : ''}>中</option><option value="large" ${q.imageSize === 'large' ? 'selected' : ''}>大</option>${q.imageSize === 'custom' ? '<option value="custom" selected>自定义</option>' : ''}</select></div>` : ''}
                <div class="b-tags">${(q.knowledgePoints || []).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}</div>
                <div class="b-stem" style="font-size:12px;color:var(--muted);">来源：${html(source)}</div>
            </details>
            </div>
        </article>`;
    }
    function imageSizeClass(q = {}) {
        const size = ['small', 'medium', 'large'].includes(q.imageSize) ? q.imageSize : 'medium';
        return `b-img-size-${size}`;
    }
    function setQuestionImageSize(questionId, size = 'medium') {
        const q = state.questions.find(item => item.id === questionId);
        if (!q) return;
        q.imageSize = ['small', 'medium', 'large'].includes(size) ? size : 'medium';
        delete q.imageWidth;
        delete q.imageHeight;
        save();
        renderBank();
        refreshOutput();
    }
    function toggleQuestionSelection(questionId, checked) {
        if (checked) state.selectedQuestions.add(questionId);
        else state.selectedQuestions.delete(questionId);
        if ($('bQuestionSelected')) $('bQuestionSelected').textContent = `已选 ${state.selectedQuestions.size}`;
    }
    function selectFilteredQuestions(checked = true) {
        if (checked) getFilteredQuestions().forEach(q => state.selectedQuestions.add(q.id));
        renderBank();
    }
    function filteredSelectionComplete() {
        const filtered = getFilteredQuestions();
        return filtered.length > 0 && filtered.every(q => state.selectedQuestions.has(q.id));
    }
    function updateFilteredSelectButton() {
        const button = $('bSelectFilteredBtn');
        if (button) button.textContent = filteredSelectionComplete() ? '取消当前全选' : '全选当前筛选';
    }
    function toggleFilteredQuestionSelection() {
        const filtered = getFilteredQuestions();
        if (!filtered.length) return toast('当前筛选下没有题目');
        if (filteredSelectionComplete()) filtered.forEach(q => state.selectedQuestions.delete(q.id));
        else filtered.forEach(q => state.selectedQuestions.add(q.id));
        renderBank();
    }
    function clearQuestionSelection() {
        state.selectedQuestions.clear();
        renderBank();
    }
    function selectedQuestionItems() {
        return [...state.selectedQuestions].map(questionId => state.questions.find(q => q.id === questionId)).filter(Boolean);
    }
    function batchAddSelectedToBasket() {
        const items = selectedQuestionItems();
        if (!items.length) return toast('请先选择正式题');
        items.forEach(q => {
            if (!state.basket.includes(q.id)) state.basket.push(q.id);
            state.paperDraftExcluded = state.paperDraftExcluded.filter(id => id !== q.id);
        });
        save();
        renderAll();
        refreshOutput();
        toast(`已加入 ${items.length} 道题到题篮`);
    }
    function batchArchiveSelected() {
        const items = selectedQuestionItems();
        if (!items.length) return toast('请先选择正式题');
        items.forEach(q => { q.status = 'archived'; });
        state.selectedQuestions.clear();
        save();
        renderAll();
        toast(`已归档 ${items.length} 道题`);
    }
    function batchMarkQuestions() {
        if (!state.selectedQuestions.size) return toast('请先选择正式题');
        openModal('批量标记正式题', `<div class="b-form">
            <div class="b-row three"><div><label>章节</label><input id="bQBatchChapter" placeholder="不填则不变"></div><div><label>难度</label><select id="bQBatchDifficulty"><option value="">不变</option>${difficulties.map(d => `<option>${d}</option>`).join('')}</select></div><div><label>分值</label><input id="bQBatchScore" type="number" min="0" step="1" placeholder="不变"></div></div>
            <div><label>知识点</label><input id="bQBatchKnowledge" placeholder="多个用顿号；不填则不变"></div>
            <div class="b-actions"><button class="b-btn" onclick="B.closeModal()">取消</button><button class="b-btn primary" onclick="B.applyQuestionBatchMark()">应用</button></div>
        </div>`);
    }
    function applyQuestionBatchMark() {
        selectedQuestionItems().forEach(q => {
            if (value('bQBatchChapter')) q.chapter = value('bQBatchChapter');
            if (value('bQBatchDifficulty')) q.difficulty = normalizeDifficulty(value('bQBatchDifficulty'));
            if (value('bQBatchScore')) q.score = Number(value('bQBatchScore'));
            if (value('bQBatchKnowledge')) q.knowledgePoints = splitList(value('bQBatchKnowledge'));
        });
        state.selectedQuestions.clear();
        closeModal();
        save();
        renderAll();
        toast('已批量标记正式题');
    }
    function renderText(text) {
        return textWithMath(text);
    }
    function sanitizeSvg(svg) {
        const v = String(svg || '').trim();
        if (!/^<svg[\s>]/i.test(v)) return html(v);
        return v.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
    }
    function toggleBasket(questionId) {
        if (state.basket.includes(questionId)) {
            state.basket = state.basket.filter(x => x !== questionId);
            state.paperDraftExcluded = state.paperDraftExcluded.filter(x => x !== questionId);
        } else {
            state.basket.push(questionId);
            state.paperDraftExcluded = state.paperDraftExcluded.filter(x => x !== questionId);
        }
        save();
        renderAll();
        refreshOutput();
    }
    function addFilteredToBasket() {
        getFilteredQuestions().forEach(q => {
            if (!state.basket.includes(q.id)) state.basket.push(q.id);
            state.paperDraftExcluded = state.paperDraftExcluded.filter(id => id !== q.id);
        });
        save();
        renderAll();
        switchView('compose');
        refreshOutput();
    }
    function clearBasket() {
        state.basket = [];
        state.paperDraft = [];
        state.paperDraftExcluded = [];
        save();
        renderAll();
        refreshOutput();
        renderBasketDrawer();
    }
    function basketItems() {
        return state.basket.map(questionId => state.questions.find(q => q.id === questionId)).filter(Boolean);
    }
    function draftQuestionIds() {
        return state.paperDraft.filter(item => item.type === 'question').map(item => item.id);
    }
    function ensurePaperDraftFromBasket() {
        const current = draftQuestionIds();
        const excluded = new Set(state.paperDraftExcluded || []);
        const missing = state.basket.filter(questionId => !current.includes(questionId) && !excluded.has(questionId));
        const stale = new Set(state.basket);
        state.paperDraft = state.paperDraft.filter(item => ['heading', 'text', 'pageBreak', 'blank', 'table', 'image'].includes(item.type) || stale.has(item.id));
        missing.forEach(questionId => state.paperDraft.push({ type: 'question', id: questionId }));
        if (!state.paperDraft.length && state.basket.length) {
            const included = state.basket.filter(questionId => !excluded.has(questionId));
            state.paperDraft = included.map(questionId => ({ type: 'question', id: questionId }));
        }
    }
    function draftItems() {
        ensurePaperDraftFromBasket();
        return state.paperDraft.map(item => {
            if (item.type === 'heading') return item;
            if (item.type === 'text') return item;
            if (item.type === 'pageBreak') return item;
            if (item.type === 'blank') return item;
            if (item.type === 'table') return item;
            if (item.type === 'image') return item;
            const question = state.questions.find(q => q.id === item.id);
            return question ? { ...item, type: 'question', question: { ...question, ...(item.override || {}) } } : null;
        }).filter(Boolean);
    }
    function draftQuestions() {
        return draftItems().filter(item => item.type === 'question').map(item => item.question);
    }
    function outputTypeLabel(type = value('bOutputType')) {
        return { quiz: '小测卷', exam: '正式试卷', handout: '专题讲义', homework: '作业', answerEdit: '答案编辑', paper: '小测卷', variants: '专题讲义', wrongbook: '作业' }[type] || '小测卷';
    }
    function outputModeLabel(mode = value('bOutputMode')) {
        return { student: '学生版', teacher: '教师版', answerOnly: '答案版' }[mode] || '学生版';
    }
    function draftTitle() {
        return value('bOutputTitle') || `${outputTypeLabel()} ${new Date().toISOString().slice(0, 10)}`;
    }
    function ensureHandoutScaffold() {
        if (state.handoutScaffoldApplied) return;
        ensurePaperDraftFromBasket();
        const hasHandoutStructure = state.paperDraft.some(item =>
            (item.type === 'heading' && /知识梳理|讲义/.test(item.title || '')) ||
            (item.type === 'text' && /方法提示|知识梳理/.test(item.text || ''))
        );
        if (hasHandoutStructure) {
            state.handoutScaffoldApplied = true;
            return;
        }
        state.paperDraft.unshift(
            { type: 'heading', title: '一、知识梳理' },
            { type: 'text', text: '方法提示：先明确模型，再对应例题和变式训练。' }
        );
        state.handoutScaffoldApplied = true;
        save();
    }
    function setOutputType(type) {
        const el = $('bOutputType');
        const currentMode = value('bOutputMode') || 'student';
        if (currentMode !== 'answerOnly') state.lastNonAnswerOutputMode = currentMode;
        if (el) el.value = type;
        document.querySelectorAll('[data-output-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputType === type));
        if (type === 'handout') ensureHandoutScaffold();
        if (type === 'answerEdit') {
            setOutputMode('answerOnly', { remember: false });
        } else if (currentMode === 'answerOnly') {
            setOutputMode(state.lastNonAnswerOutputMode || 'student', { remember: false });
        }
        renderPaperDraft();
        refreshOutput();
    }
    function setOutputMode(mode, options = {}) {
        const el = $('bOutputMode');
        if (el) el.value = mode;
        if (mode !== 'answerOnly' && options.remember !== false) state.lastNonAnswerOutputMode = mode;
        document.querySelectorAll('[data-output-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputMode === mode));
        refreshOutput();
    }
    function syncOutputTabs() {
        const type = value('bOutputType') || 'quiz';
        const mode = value('bOutputMode') || 'student';
        document.querySelectorAll('[data-output-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputType === type));
        document.querySelectorAll('[data-output-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputMode === mode));
    }
    function scrollDraftItem(index) {
        state.activeDraftIndex = Number(index);
        const el = $(`bPaperItem-${index}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.querySelectorAll('.b-paper-item').forEach(item => item.classList.remove('active'));
        el?.classList.add('active');
    }
    function visibleDraftIndices() {
        return draftItems().map((_, index) => index).filter(index => !isDraftItemHiddenInEditor(index));
    }
    function selectDraftOutline(event, index) {
        const n = Number(index);
        if (!Number.isFinite(n)) return;
        const additive = Boolean(event?.metaKey || event?.ctrlKey);
        const ranged = Boolean(event?.shiftKey && state.lastDraftSelectionIndex >= 0);
        if (ranged) {
            const visible = visibleDraftIndices();
            const start = visible.indexOf(state.lastDraftSelectionIndex);
            const end = visible.indexOf(n);
            if (start >= 0 && end >= 0) {
                const [from, to] = start < end ? [start, end] : [end, start];
                if (!additive) state.selectedDraftIndices.clear();
                visible.slice(from, to + 1).forEach(itemIndex => state.selectedDraftIndices.add(itemIndex));
            }
        } else if (additive) {
            if (state.selectedDraftIndices.has(n)) state.selectedDraftIndices.delete(n);
            else state.selectedDraftIndices.add(n);
            state.lastDraftSelectionIndex = n;
        } else {
            state.selectedDraftIndices = new Set([n]);
            state.lastDraftSelectionIndex = n;
        }
        scrollDraftItem(n);
        renderOutputOutline();
    }
    function collapsedHeadingIndexFor(index) {
        for (let i = Number(index) - 1; i >= 0; i -= 1) {
            const item = state.paperDraft[i];
            if (item?.type === 'heading') return state.collapsedHeadings.has(i) ? i : -1;
        }
        return -1;
    }
    function isDraftItemHiddenInEditor(index) {
        return collapsedHeadingIndexFor(index) >= 0;
    }
    function toggleDraftHeadingCollapse(index) {
        const n = Number(index);
        if (!Number.isFinite(n)) return;
        if (state.collapsedHeadings.has(n)) state.collapsedHeadings.delete(n);
        else state.collapsedHeadings.add(n);
        renderOutputOutline();
        refreshOutput();
    }
    function toggleOutlineDisplayMode(event) {
        event?.stopPropagation?.();
        state.outlineDisplayMode = state.outlineDisplayMode === 'number' ? 'content' : 'number';
        renderOutputOutline();
    }
    function selectedDraftArray(fallbackIndex = -1) {
        const fallback = Number(fallbackIndex);
        const values = [...state.selectedDraftIndices].filter(index => Number.isFinite(index) && state.paperDraft[index]);
        if (values.length) return values;
        return Number.isFinite(fallback) && state.paperDraft[fallback] ? [fallback] : [];
    }
    function contextMenuHtml() {
        const menu = state.activeDraftContextMenu;
        if (!menu) return '';
        const item = state.paperDraft[menu.index];
        if (!item) return '';
        const style = `left:${Math.round(menu.x)}px;top:${Math.round(menu.y)}px;`;
        if (item.type === 'heading') {
            return `<div class="b-context-menu" style="${style}" onclick="event.stopPropagation()">
                <button class="red" onclick="B.removeDraftHeadingOnly(${menu.index})">移除标题</button>
                <button class="red" onclick="B.removeDraftHeadingSection(${menu.index})">移除标题下内容</button>
            </div>`;
        }
        const count = selectedDraftArray(menu.index).length;
        return `<div class="b-context-menu" style="${style}" onclick="event.stopPropagation()">
            <button class="red" onclick="B.removeSelectedDraftItems(${menu.index})">移除${count > 1 ? `选中 ${count} 项` : '当前项'}</button>
        </div>`;
    }
    function showDraftContextMenu(event, index) {
        event.preventDefault();
        event.stopPropagation();
        const n = Number(index);
        if (!state.selectedDraftIndices.has(n)) {
            state.selectedDraftIndices = new Set([n]);
            state.lastDraftSelectionIndex = n;
        }
        state.activeDraftContextMenu = { index: n, x: event.clientX, y: event.clientY };
        renderOutputOutline();
    }
    function hideDraftContextMenu() {
        if (!state.activeDraftContextMenu) return;
        state.activeDraftContextMenu = null;
        renderOutputOutline();
    }
    function removeDraftIndices(indices = []) {
        const uniqueIndices = [...new Set(indices.map(Number).filter(index => Number.isFinite(index) && state.paperDraft[index]))].sort((a, b) => b - a);
        uniqueIndices.forEach(index => {
            const [removed] = state.paperDraft.splice(index, 1);
            if (removed?.type === 'question' && removed.id) {
                state.paperDraftExcluded = uniq([...(state.paperDraftExcluded || []), removed.id]);
            }
        });
        state.selectedDraftIndices.clear();
        state.activeDraftContextMenu = null;
        state.collapsedHeadings.clear();
        save();
        renderPaperDraft();
        refreshOutput();
        if (uniqueIndices.length) toast(`已移除 ${uniqueIndices.length} 项`);
    }
    function removeSelectedDraftItems(fallbackIndex) {
        removeDraftIndices(selectedDraftArray(fallbackIndex));
    }
    function removeDraftHeadingOnly(index) {
        removeDraftIndices([index]);
    }
    function removeDraftHeadingSection(index) {
        const n = Number(index);
        if (!state.paperDraft[n] || state.paperDraft[n].type !== 'heading') return;
        const indices = [];
        for (let i = n + 1; i < state.paperDraft.length; i += 1) {
            if (state.paperDraft[i]?.type === 'heading') break;
            indices.push(i);
        }
        removeDraftIndices(indices);
    }
    function renderOutputOutline() {
        const el = $('bOutputOutline');
        if (!el) return;
        const items = draftItems();
        let questionIndex = 0;
        const modeText = state.outlineDisplayMode === 'number' ? '题号' : '内容';
        el.classList.toggle('number-mode', state.outlineDisplayMode === 'number');
        const rows = [`<div class="b-outline-item root active" onclick="B.scrollDraftItem(-1)"><span>标题区</span><button class="b-outline-mode" onclick="B.toggleOutlineDisplayMode(event)">${modeText}</button></div>`];
        items.forEach((item, index) => {
            if (isDraftItemHiddenInEditor(index)) return;
            const selected = state.selectedDraftIndices.has(index) ? ' selected' : '';
            const dragAttrs = `draggable="true" ondragstart="B.startDraftDrag(event, ${index})" ondragover="B.allowDraftDrop(event)" ondrop="B.dropDraftItem(event, ${index})" oncontextmenu="B.showDraftContextMenu(event, ${index})"`;
            const click = `onclick="B.selectDraftOutline(event, ${index})"`;
            if (item.type === 'heading') {
                const collapsed = state.collapsedHeadings.has(index);
                rows.push(`<div class="b-outline-item heading${selected}" ${dragAttrs} ${click}><span class="b-outline-title">${html(item.title || '未命名栏目')}</span><button class="b-outline-toggle" title="${collapsed ? '展开' : '折叠'}" onclick="event.stopPropagation();B.toggleDraftHeadingCollapse(${index})">${collapsed ? '▸' : '▾'}</button></div>`);
            }
            else if (item.type === 'text') rows.push(`<div class="b-outline-item sub${selected}" ${dragAttrs} ${click}><span class="b-outline-no">讲</span><span>${html(state.outlineDisplayMode === 'number' ? '说明' : String(item.text || '讲义说明').slice(0, 12))}</span></div>`);
            else if (item.type === 'pageBreak') rows.push(`<div class="b-outline-item sub${selected}" ${dragAttrs} ${click}><span class="b-outline-no">页</span><span>分页</span></div>`);
            else if (item.type === 'blank') rows.push(`<div class="b-outline-item sub${selected}" ${dragAttrs} ${click}><span class="b-outline-no">空</span><span>${Number(item.rows || 4)} 行空白</span></div>`);
            else if (item.type === 'table') rows.push(`<div class="b-outline-item sub${selected}" ${dragAttrs} ${click}><span class="b-outline-no">表</span><span>${html(state.outlineDisplayMode === 'number' ? '表格' : item.title || '表格')}</span></div>`);
            else if (item.type === 'image') rows.push(`<div class="b-outline-item sub${selected}" ${dragAttrs} ${click}><span class="b-outline-no">图</span><span>${html(state.outlineDisplayMode === 'number' ? '图片' : item.caption || '图片')}</span></div>`);
            else if (item.type === 'question') {
                questionIndex += 1;
                const label = state.outlineDisplayMode === 'number' ? '' : `<span>${html((item.question?.stem || '题目').slice(0, 13))}</span>`;
                const questionClass = state.outlineDisplayMode === 'number' ? ' question-number' : '';
                rows.push(`<div class="b-outline-item sub${questionClass}${selected}" ${dragAttrs} ${click}><span class="b-outline-no">${questionIndex}</span>${label}</div>`);
            }
        });
        rows.push(contextMenuHtml());
        el.innerHTML = rows.join('');
    }
    function answerAreaPopover(index) {
        const item = state.paperDraft[index] || {};
        const area = item.answerArea || {};
        const activeStyle = area.override ? (!area.enabled ? 'none' : area.style === 'blank' ? 'blank' : 'underline') : '';
        const rows = Number(area.rows || (activeStyle === 'underline' ? 1 : 4));
        const styleButton = (key, label) => `<button class="${activeStyle === key ? 'active' : ''}" onclick="event.stopPropagation();B.chooseAnswerAreaStyle(${index}, '${key}')">${label}</button>`;
        const rowButton = row => `<button class="${rows === row ? 'active' : ''}" onclick="event.stopPropagation();B.setAnswerAreaRows(${index}, ${row})">${row} 行</button>`;
        const showRows = state.activeAnswerStyleIndex === index && ['underline', 'blank'].includes(activeStyle);
        return `<div class="b-answer-popover" onclick="event.stopPropagation()">
            <div class="b-answer-style-list">
                ${styleButton('none', '不显示')}
                ${styleButton('underline', '横线')}
                ${styleButton('blank', '空白')}
            </div>
            ${showRows ? `<div class="b-answer-row-list">${[1, 2, 3, 4, 6, 8].map(rowButton).join('')}</div>` : ''}
        </div>`;
    }
    function draftInlineTools(index, kind = 'item') {
        return `<div class="b-paper-insert-tools">
            <button class="b-btn small" onclick="B.insertPageBreak(${index})">插入分页</button>
            ${kind === 'question' ? `<span class="b-answer-menu-wrap"><button class="b-btn small b-answer-menu-btn ${state.activeAnswerMenuIndex === index ? 'active' : ''}" onclick="event.stopPropagation();B.toggleAnswerAreaMenu(${index})">答题区</button>${state.activeAnswerMenuIndex === index ? answerAreaPopover(index) : ''}</span>` : ''}
        </div>`;
    }
    function renderPaperDraft() {
        const el = $('bPaperDraftList');
        renderOutputOutline();
        if (!el) return;
        const items = draftItems();
        let questionIndex = 0;
        el.innerHTML = items.length ? items.map((item, index) => {
            if (item.type === 'heading') return `<article class="b-basket-mini"><div class="b-basket-mini-title">标题：${html(item.title)}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftHeading(${index})">编辑</button>${draftInlineTools(index)}<button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'text') return `<article class="b-basket-mini"><div class="b-basket-mini-title">说明：${html(String(item.text || '').slice(0, 70))}${String(item.text || '').length > 70 ? '...' : ''}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftText(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'pageBreak') return `<article class="b-basket-mini"><div class="b-basket-mini-title">分页</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'blank') return `<article class="b-basket-mini"><div class="b-basket-mini-title">${Number(item.rows || 4)} 行空白</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.setDraftBlankRows(${index})">设置行数</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'table') return `<article class="b-basket-mini"><div class="b-basket-mini-title">表格：${html(item.title || '未命名表格')}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftTable(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'image') return `<article class="b-basket-mini"><div class="b-basket-mini-title">图片：${html(item.caption || item.url || '图片')}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftImage(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            const q = item.question;
            questionIndex += 1;
            return `<article class="b-basket-mini"><div class="b-basket-mini-title">${questionIndex}. ${textWithMath(String(q.stem || '').slice(0, 70))}${q.stem.length > 70 ? '...' : ''}</div><div class="b-actions" style="justify-content:flex-start;"><span class="b-tag">${html(q.questionType || '未标题型')}</span><button class="b-btn small" onclick="B.editDraftQuestion(${index})">临时编辑</button>${draftInlineTools(index, 'question')}<button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移出本卷</button></div></article>`;
        }).join('') : '<div class="b-empty">题篮为空，本卷草稿会在加入题目后生成。</div>';
        queueMathTypeset(el);
    }
    function editDraftTitle() {
        const title = window.prompt('修改本卷标题', draftTitle());
        if (!title) return;
        const el = $('bOutputTitle');
        if (el) el.value = title.trim();
        save();
        refreshOutput();
    }
    function updateDraftTitleFromInline(text = '') {
        const title = String(text || '').trim();
        if (!title) return refreshOutput();
        const el = $('bOutputTitle');
        if (el) el.value = title;
        save();
        refreshOutput();
    }
    function syncDraftTitleInline(text = '') {
        const title = String(text || '').trim();
        if (!title) return;
        const el = $('bOutputTitle');
        if (el) el.value = title;
    }
    function updatePaperMetaFromInline(text = '') {
        const next = String(text || '').trim();
        state.paperMetaText = next;
        state.paperMetaHidden = !next;
        save();
        refreshOutput();
    }
    function hidePaperMeta() {
        state.paperMetaHidden = true;
        save();
        refreshOutput();
    }
    function showPaperMeta() {
        state.paperMetaHidden = false;
        save();
        refreshOutput();
    }
    function syncPaperMetaButton() {
        const btn = $('bPaperMetaToggle');
        if (!btn) return;
        btn.textContent = state.paperMetaHidden ? '显示信息栏' : '隐藏信息栏';
        btn.classList.toggle('active', !state.paperMetaHidden);
    }
    function togglePaperMeta() {
        state.paperMetaHidden = !state.paperMetaHidden;
        save();
        refreshOutput();
    }
    function syncLeftExportSettings() {
        $('bLeftExportSettings')?.classList.toggle('show', state.outputSettingsOpen);
        const btn = $('bExportSettingsToggle');
        if (btn) {
            btn.classList.toggle('active', state.outputSettingsOpen);
            btn.textContent = state.outputSettingsOpen ? '收起设置' : '导出设置';
        }
    }
    function toggleLeftExportSettings() {
        state.outputSettingsOpen = !state.outputSettingsOpen;
        syncLeftExportSettings();
    }
    function defaultInsertIndex(position = 'after') {
        const index = Number(state.activeDraftIndex);
        if (Number.isFinite(index) && index >= 0 && index < state.paperDraft.length) return position === 'before' ? index : index + 1;
        return state.paperDraft.length;
    }
    function insertDraftItem(item, position = 'after') {
        ensurePaperDraftFromBasket();
        const index = defaultInsertIndex(position);
        state.paperDraft.splice(index, 0, item);
        state.activeDraftIndex = index;
        state.activeInsertMenuIndex = -1;
        state.activeAnswerMenuIndex = -1;
        save();
        renderPaperDraft();
        refreshOutput();
        requestAnimationFrame(() => scrollDraftItem(index));
    }
    function insertDraftMenu(index) {
        const nextIndex = Number(index);
        state.activeDraftIndex = nextIndex;
        state.activeInsertMenuIndex = state.activeInsertMenuIndex === nextIndex ? -1 : nextIndex;
        state.activeAnswerMenuIndex = -1;
        renderPaperDraft();
        refreshOutput();
        requestAnimationFrame(() => scrollDraftItem(nextIndex));
    }
    function insertDraftHeading(position = 'after') {
        const title = window.prompt('输入标题，例如：一、选择题', '一、选择题');
        if (!title) return;
        insertDraftItem({ type: 'heading', title: title.trim() }, position);
    }
    function editDraftHeading(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'heading') return;
        const title = window.prompt('修改标题', item.title || '');
        if (!title) return;
        item.title = title.trim();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function updateDraftHeadingFromInline(index, text = '') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'heading') return;
        const title = String(text || '').trim();
        if (!title) return refreshOutput();
        item.title = title;
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function syncDraftHeadingInline(index, text = '') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'heading') return;
        const title = String(text || '').trim();
        if (title) item.title = title;
    }
    function insertDraftText(position = 'after') {
        const text = window.prompt('输入本次输出的说明文字，例如：方法提示、例题说明、课前提醒', '方法提示：');
        if (!text) return;
        insertDraftItem({ type: 'text', text: text.trim() }, position);
    }
    function editDraftText(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'text') return;
        const text = window.prompt('修改说明文字', item.text || '');
        if (!text) return;
        item.text = text.trim();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function updateDraftTextFromInline(index, text = '') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'text') return;
        item.text = String(text || '').trim();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function syncDraftTextInline(index, text = '') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'text') return;
        item.text = String(text || '').trim();
    }
    function insertAfterDraftIndex(afterIndex, item) {
        ensurePaperDraftFromBasket();
        const index = Number(afterIndex);
        const position = Number.isFinite(index) && index >= 0 ? Math.min(state.paperDraft.length, index + 1) : state.paperDraft.length;
        state.paperDraft.splice(position, 0, item);
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function insertPageBreak(afterIndex) {
        insertAfterDraftIndex(afterIndex, { type: 'pageBreak' });
    }
    function insertPageBreakBefore(index) {
        state.activeDraftIndex = Number(index);
        insertDraftItem({ type: 'pageBreak' }, 'before');
    }
    function insertDraftBlank(afterIndex, rows = 4) {
        insertAfterDraftIndex(afterIndex, { type: 'blank', rows: Number(rows) || 4 });
    }
    function setDraftBlankRows(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'blank') return;
        const rows = Number(window.prompt('空白行数', String(item.rows || 4)));
        if (!Number.isFinite(rows) || rows < 1) return;
        item.rows = Math.min(20, Math.max(1, Math.round(rows)));
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function insertDraftTable(position = 'after') {
        const title = window.prompt('表格标题', '课堂记录表');
        if (!title) return;
        insertDraftItem({ type: 'table', title: title.trim(), rows: [['要点', '记录'], ['方法', '']] }, position);
    }
    function editDraftTable(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'table') return;
        const title = window.prompt('修改表格标题', item.title || '');
        if (!title) return;
        item.title = title.trim();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function insertDraftImage(position = 'after') {
        const url = window.prompt('图片链接或本地附件 URL', '');
        if (!url) return;
        const caption = window.prompt('图片说明', '配图') || '';
        insertDraftItem({ type: 'image', url: url.trim(), caption: caption.trim() }, position);
    }
    function editDraftImage(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'image') return;
        const url = window.prompt('修改图片链接或本地附件 URL', item.url || '');
        if (!url) return;
        item.url = url.trim();
        item.caption = (window.prompt('修改图片说明', item.caption || '配图') || '').trim();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function draftQuestionData(item = {}) {
        if (!item.question) return {};
        return { ...item.question, ...(item.override || {}) };
    }
    function editDraftQuestion(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const q = draftItems()[index]?.question || state.questions.find(x => x.id === item.id);
        if (!q) return;
        openModal('临时编辑本卷题目', `<div class="b-form">
            <div class="b-alert success"><span>这里的修改只影响当前本卷草稿，不回写正式题库。</span></div>
            <div><label>题干</label><textarea id="bDraftStem" rows="6">${html(item.override?.stem ?? q.stem ?? '')}</textarea></div>
            <div class="b-row"><div><label>答案</label><textarea id="bDraftAnswer" rows="3">${html(item.override?.answer ?? q.answer ?? '')}</textarea></div><div><label>解析</label><textarea id="bDraftSolution" rows="3">${html(item.override?.solution ?? q.solution ?? '')}</textarea></div></div>
            <div class="b-actions"><button class="b-btn" onclick="B.closeModal()">取消</button><button class="b-btn primary" onclick="B.saveDraftQuestionEdit(${index})">保存到本卷</button></div>
        </div>`);
    }
    function saveDraftQuestionEdit(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        item.override = {
            ...(item.override || {}),
            stem: value('bDraftStem'),
            answer: normalizeAnswerText(value('bDraftAnswer')),
            solution: value('bDraftSolution')
        };
        closeModal();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function setDraftQuestionImageSize(index, size) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const next = ['small', 'medium', 'large'].includes(size) ? size : '';
        item.override = { ...(item.override || {}) };
        if (next) item.override.imageSize = next;
        else delete item.override.imageSize;
        save();
        renderPaperDraft();
        refreshOutput();
        toast(next ? `本卷中已改为${next === 'small' ? '小图' : next === 'large' ? '大图' : '中图'}` : '已恢复默认图片大小');
    }
    function startDraftImageResize(event, index) {
        event.preventDefault();
        event.stopPropagation();
        const item = state.paperDraft[index];
        const target = event.currentTarget?.closest('.b-resizable-figure');
        if (!item || item.type !== 'question' || !target) return;
        state.activeImageDraftIndex = Number(index);
        const rect = target.getBoundingClientRect();
        const start = {
            x: event.clientX,
            y: event.clientY,
            width: rect.width,
            height: rect.height
        };
        state.imageResize = { index, target, start };
        const onMove = moveEvent => {
            let nextWidth = start.width + moveEvent.clientX - start.x;
            let nextHeight = start.height + moveEvent.clientY - start.y;
            if (moveEvent.shiftKey) {
                const ratio = start.width / Math.max(1, start.height);
                const dominant = Math.abs(moveEvent.clientX - start.x) >= Math.abs(moveEvent.clientY - start.y)
                    ? nextWidth
                    : (start.height + moveEvent.clientY - start.y) * ratio;
                nextWidth = dominant;
                nextHeight = dominant / ratio;
            }
            nextWidth = clampNumber(nextWidth, 90, 720);
            nextHeight = clampNumber(nextHeight, 50, 520);
            target.style.width = `${Math.round(nextWidth)}px`;
            target.style.height = `${Math.round(nextHeight)}px`;
        };
        const onUp = () => {
            const current = state.imageResize;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            state.imageResize = null;
            if (!current?.target) return;
            const nextRect = current.target.getBoundingClientRect();
            item.override = {
                ...(item.override || {}),
                imageWidth: Math.round(clampNumber(nextRect.width, 90, 720)),
                imageHeight: Math.round(clampNumber(nextRect.height, 50, 520))
            };
            save();
            refreshOutput();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    function selectDraftImage(index) {
        state.activeImageDraftIndex = Number(index);
        state.activeDraftIndex = Number(index);
        document.querySelectorAll('.b-paper-item').forEach(item => item.classList.remove('active'));
        $(`bPaperItem-${index}`)?.classList.add('active');
        document.querySelectorAll('.b-resizable-figure').forEach(item => item.classList.remove('is-selected'));
        $(`bPaperItem-${index}`)?.querySelectorAll('.b-resizable-figure').forEach(item => item.classList.add('is-selected'));
    }
    function selectQuestionImage(questionId) {
        state.activeBankImageId = questionId;
        document.querySelectorAll('.b-card-image-preview .b-resizable-figure').forEach(item => item.classList.remove('is-selected'));
        document.querySelectorAll(`#bqCard-${CSS.escape(questionId)} .b-card-image-preview .b-resizable-figure`).forEach(item => item.classList.add('is-selected'));
    }
    function startQuestionImageResize(event, questionId) {
        event.preventDefault();
        event.stopPropagation();
        const q = state.questions.find(item => item.id === questionId);
        const target = event.currentTarget?.closest('.b-resizable-figure');
        if (!q || !target) return;
        state.activeBankImageId = questionId;
        const rect = target.getBoundingClientRect();
        const start = {
            x: event.clientX,
            y: event.clientY,
            width: rect.width,
            height: rect.height
        };
        const onMove = moveEvent => {
            let nextWidth = start.width + moveEvent.clientX - start.x;
            let nextHeight = start.height + moveEvent.clientY - start.y;
            if (moveEvent.shiftKey) {
                const ratio = start.width / Math.max(1, start.height);
                const dominant = Math.abs(moveEvent.clientX - start.x) >= Math.abs(moveEvent.clientY - start.y)
                    ? nextWidth
                    : (start.height + moveEvent.clientY - start.y) * ratio;
                nextWidth = dominant;
                nextHeight = dominant / ratio;
            }
            nextWidth = clampNumber(nextWidth, 90, 720);
            nextHeight = clampNumber(nextHeight, 50, 520);
            target.style.width = `${Math.round(nextWidth)}px`;
            target.style.height = `${Math.round(nextHeight)}px`;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const nextRect = target.getBoundingClientRect();
            q.imageWidth = Math.round(clampNumber(nextRect.width, 90, 720));
            q.imageHeight = Math.round(clampNumber(nextRect.height, 50, 520));
            q.imageSize = 'custom';
            save();
            renderBank();
            refreshOutput();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    function configureAnswerArea(index) {
        toggleAnswerAreaMenu(index);
    }
    function toggleAnswerAreaMenu(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        state.activeAnswerMenuIndex = state.activeAnswerMenuIndex === index ? -1 : index;
        state.activeAnswerStyleIndex = state.activeAnswerMenuIndex === index ? index : -1;
        state.activeInsertMenuIndex = -1;
        renderPaperDraft();
        refreshOutput();
    }
    function chooseAnswerAreaStyle(index, style = 'none') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const previous = item.answerArea || {};
        if (style === 'none') {
            item.answerArea = { override: true, enabled: false, style: 'blank', rows: 0, forceNextPage: false };
            state.activeAnswerMenuIndex = -1;
            state.activeAnswerStyleIndex = -1;
            save();
            renderPaperDraft();
            refreshOutput();
            toast('已关闭本题答题区');
            return;
        }
        const rows = Number(previous.rows || (style === 'underline' ? 1 : 4));
        item.answerArea = {
            override: true,
            enabled: true,
            style,
            rows: Math.min(8, Math.max(1, rows)),
            forceNextPage: previous.forceNextPage || false
        };
        state.activeAnswerMenuIndex = index;
        state.activeAnswerStyleIndex = index;
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function setAnswerAreaRows(index, rows) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const current = item.answerArea || {};
        item.answerArea = {
            override: true,
            enabled: true,
            style: current.style === 'blank' ? 'blank' : 'underline',
            rows: Math.min(8, Math.max(1, Number(rows) || 1)),
            forceNextPage: current.forceNextPage || false
        };
        state.activeAnswerMenuIndex = -1;
        state.activeAnswerStyleIndex = -1;
        save();
        renderPaperDraft();
        refreshOutput();
        toast(`已设置 ${item.answerArea.rows} 行答题区`);
    }
    function setAnswerAreaPreset(index, preset = '') {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const previous = item.answerArea || {};
        const next = { override: true, enabled: true, style: 'lines', rows: 6, forceNextPage: false };
        if (preset === 'none') {
            next.enabled = false;
            next.rows = 0;
        } else if (preset === 'underline') {
            next.style = 'underline';
            next.rows = 1;
        } else if (preset === 'blank') {
            next.style = 'blank';
            next.rows = 4;
        } else if (preset === 'nextPage') {
            Object.assign(next, previous.override ? previous : { style: 'lines', rows: 6 });
            next.override = true;
            next.enabled = previous.enabled !== false;
            next.forceNextPage = !previous.forceNextPage;
        } else {
            const rows = Number(preset);
            next.style = 'lines';
            next.rows = Number.isFinite(rows) && rows > 0 ? rows : 6;
        }
        item.answerArea = next;
        state.activeAnswerMenuIndex = -1;
        save();
        renderPaperDraft();
        refreshOutput();
        toast(preset === 'none' ? '已关闭本题答题区' : preset === 'nextPage' ? (next.forceNextPage ? '本题将从下一页开始' : '已取消下一页开始') : '已更新本题答题区');
    }
    function saveAnswerAreaConfig(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        item.answerArea = {
            override: $('bDraftAnswerOverride')?.checked || false,
            enabled: $('bDraftAnswerEnabled')?.checked !== false,
            style: value('bDraftAnswerStyle') || 'inherit',
            rows: Number(value('bDraftAnswerRows') || 0) || null,
            forceNextPage: $('bDraftForceNextPage')?.checked || false
        };
        closeModal();
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function setDraftAnswerRows(index, rows) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const value = Number(rows);
        if (!Number.isFinite(value)) return;
        item.answerArea = {
            ...(item.answerArea || {}),
            override: true,
            enabled: value > 0,
            style: value === 1 ? 'underline' : 'lines',
            rows: value > 0 ? value : 0
        };
        save();
        renderPaperDraft();
        refreshOutput();
        toast(value > 0 ? `已设置 ${value} 行答题区` : '已关闭本题答题区');
    }
    function removeDraftItem(index) {
        const [removed] = state.paperDraft.splice(index, 1);
        if (removed?.type === 'question' && removed.id) {
            state.paperDraftExcluded = uniq([...(state.paperDraftExcluded || []), removed.id]);
        }
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function moveDraftItem(index, delta) {
        const next = index + delta;
        if (next < 0 || next >= state.paperDraft.length) return;
        const [item] = state.paperDraft.splice(index, 1);
        state.paperDraft.splice(next, 0, item);
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function startDraftDrag(event, index) {
        event.dataTransfer?.setData('text/plain', String(index));
        event.currentTarget?.classList.add('dragging');
    }
    function allowDraftDrop(event) {
        event.preventDefault();
    }
    function dropDraftItem(event, targetIndex) {
        event.preventDefault();
        const from = Number(event.dataTransfer?.getData('text/plain'));
        document.querySelectorAll('.b-outline-item.dragging').forEach(el => el.classList.remove('dragging'));
        if (!Number.isFinite(from) || from === targetIndex || from < 0 || from >= state.paperDraft.length) return;
        const [item] = state.paperDraft.splice(from, 1);
        state.paperDraft.splice(targetIndex, 0, item);
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function groupDraftByType() {
        const questions = basketItems();
        if (!questions.length) return toast('请先加入题篮');
        state.paperDraftExcluded = [];
        const order = ['选择题', '填空题', '计算题', '应用题', '几何题', '证明题', '综合题'];
        const groups = order.map(type => [type, questions.filter(q => q.questionType === type)]).filter(([, qs]) => qs.length);
        const rest = questions.filter(q => !order.includes(q.questionType || ''));
        if (rest.length) groups.push(['其他题', rest]);
        state.paperDraft = [];
        groups.forEach(([type, qs], index) => {
            state.paperDraft.push({ type: 'heading', title: `${['一', '二', '三', '四', '五', '六', '七'][index] || index + 1}、${type}` });
            qs.forEach(q => state.paperDraft.push({ type: 'question', id: q.id }));
        });
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function paperQuestionSortValue(q = {}, paper = {}) {
        const explicit = (paper.questionOrder || []).find(item => item.questionId === q.id || item.candidateId === q.source?.candidateId);
        const paperOrder = Number(q.source?.paperOrder || explicit?.paperOrder || 0);
        if (Number.isFinite(paperOrder) && paperOrder > 0) return paperOrder;
        const no = String(q.source?.questionNo || explicit?.questionNo || '').match(/\d+/)?.[0];
        const parsedNo = Number(no || 0);
        return Number.isFinite(parsedNo) && parsedNo > 0 ? parsedNo : Number.MAX_SAFE_INTEGER;
    }
    function paperQuestions(paper = {}) {
        const ids = new Set(paper.questionIds || []);
        const sourceMatches = state.questions.filter(q => q.source?.paperId === paper.id).map(q => q.id);
        sourceMatches.forEach(questionId => ids.add(questionId));
        return [...ids]
            .map(questionId => state.questions.find(q => q.id === questionId))
            .filter(Boolean)
            .sort((a, b) => paperQuestionSortValue(a, paper) - paperQuestionSortValue(b, paper));
    }
    function renderPapers() {
        renderPaperFilterOptions();
        const query = value('bPaperSearch').toLowerCase();
        const year = value('bPaperYearFilter');
        const grade = value('bPaperGradeFilter');
        const region = value('bPaperRegionFilter');
        const type = value('bPaperTypeFilter');
        const sort = value('bPaperSortFilter') || 'recent';
        let papers = state.paperLibrary.filter(paper => {
            const hay = [paper.title, paper.year, paper.grade, paper.region, paper.sourceType, paper.fileName].join(' ').toLowerCase();
            if (query && !hay.includes(query)) return false;
            if (year && String(paper.year || '') !== year) return false;
            if (grade && String(paper.grade || '') !== grade) return false;
            if (region && String(paper.region || '') !== region) return false;
            if (type && String(paper.sourceType || '') !== type) return false;
            return true;
        });
        papers = sortPapers(papers, sort);
        if ($('bPaperCount')) $('bPaperCount').textContent = `${papers.length} 套`;
        const list = $('bPaperList');
        if (!list) return;
        list.innerHTML = papers.length ? papers.map(paper => {
            const questions = paperQuestions(paper);
            const expanded = state.expandedPaperId === paper.id;
            const detail = expanded ? renderPaperDetail(paper, questions) : '';
            return `<article class="b-card">
                <div class="b-card-top">
                    <div><div class="b-card-title">${html(paper.title)}</div><div class="b-tags">${[paper.year, paper.grade, paper.region, paper.sourceType, paper.fileName, `${questions.length} 道已入库`].filter(Boolean).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}</div></div>
                    <div class="b-actions"><button class="b-btn small" onclick="B.togglePaperDetail('${paper.id}')">${expanded ? '收起详情' : '查看详情'}</button><button class="b-btn small primary" onclick="B.loadPaperToBasket('${paper.id}')">整卷加入本卷</button><button class="b-btn small" onclick="B.printPaper('${paper.id}')">按原题号打印</button><button class="b-btn small red" onclick="B.deletePaper('${paper.id}')">删除记录</button></div>
                </div>
                ${detail}
            </article>`;
        }).join('') : '<div class="b-empty">暂无试卷。导入整卷后会自动生成试卷记录。</div>';
    }
    function togglePaperDetail(paperId) {
        state.expandedPaperId = state.expandedPaperId === paperId ? '' : paperId;
        save();
        renderPapers();
    }
    function renderPaperDetail(paper = {}, questions = []) {
        const typeDist = group(questions, q => q.questionType || '未标题型');
        const flags = questions.flatMap(q => qualityFlags(q));
        const flagDist = group(flags.map(flag => ({ flag })), item => item.flag);
        const canPrint = questions.length > 0 && !questions.some(q => !q.stem);
        const rows = questions.map((q, index) => {
            const no = q.source?.questionNo || index + 1;
            const stem = String(q.stem || '').replace(/\s+/g, ' ').trim();
            const meta = [q.questionType, q.difficulty, q.score ? `${q.score}分` : '', questionHasImage(q) ? '含图' : '', questionHasFormula(q) ? '含公式' : ''].filter(Boolean).join(' · ');
            return `<div class="b-paper-question-row">
                <span class="b-paper-question-no">${html(no)}</span>
                <div>
                    <div class="b-paper-question-title">${html(stem.slice(0, 72))}${stem.length > 72 ? '...' : ''}</div>
                    <div class="b-paper-question-meta">${html(meta || '未标注')}</div>
                </div>
                <button class="b-btn small primary" onclick="B.addQuestionToDraft('${q.id}')">加入本卷</button>
            </div>`;
        }).join('');
        return `<div class="b-paper-detail">
            <div class="b-paper-quality">
                <div><strong>${questions.length}</strong>已入库题目</div>
                <div><strong>${Object.keys(flagDist).length ? flags.length : 0}</strong>质量提示</div>
                <div><strong>${canPrint ? '可以' : '需复核'}</strong>整卷输出</div>
            </div>
            <div class="b-tags">${Object.entries(typeDist).map(([key, count]) => `<span class="b-tag">${html(key)} ${count}</span>`).join('') || '<span class="b-tag">暂无题型分布</span>'}</div>
            <div class="b-tags">${Object.entries(flagDist).map(([key, count]) => `<span class="b-tag orange">${html(key)} ${count}</span>`).join('') || '<span class="b-tag green">暂无明显质量问题</span>'}</div>
            <p class="b-mini-note">整卷加入本卷：进入组卷输出，可继续编辑和加讲义内容；按原题号打印：按原试卷顺序进入打印流程。</p>
            <div class="b-paper-question-list">
                <div class="b-paper-question-head"><span>题号</span><span>本卷题目</span><button class="b-btn small primary" onclick="B.loadPaperToBasket('${paper.id}')">整卷加入</button></div>
                ${rows || '<div class="b-empty">这套试卷还没有入库题目。</div>'}
            </div>
        </div>`;
    }
    function sortPapers(papers = [], sort = 'recent') {
        if (sort === 'yearDesc') return [...papers].sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));
        if (sort === 'title') return [...papers].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
        if (sort === 'countDesc') return [...papers].sort((a, b) => paperQuestions(b).length - paperQuestions(a).length);
        return [...papers].sort((a, b) => String(b.createdAt || b.id || '').localeCompare(String(a.createdAt || a.id || '')));
    }
    function renderPaperFilterOptions() {
        setOptions('bPaperYearFilter', ['全部年份', ...uniq(state.paperLibrary.map(p => p.year)).sort((a, b) => String(b).localeCompare(String(a)))]);
        setOptions('bPaperGradeFilter', ['全部年级', ...uniq(state.paperLibrary.map(p => p.grade))]);
        setOptions('bPaperRegionFilter', ['全部地区', ...uniq(state.paperLibrary.map(p => p.region))]);
        setOptions('bPaperTypeFilter', ['全部类型', ...uniq(state.paperLibrary.map(p => p.sourceType))]);
    }
    function clearPaperFilters() {
        ['bPaperSearch', 'bPaperYearFilter', 'bPaperGradeFilter', 'bPaperRegionFilter', 'bPaperTypeFilter'].forEach(idName => {
            const el = $(idName);
            if (el) el.value = '';
        });
        renderPapers();
    }
    function deletePaper(paperId) {
        const paper = state.paperLibrary.find(item => item.id === paperId);
        if (!paper) return;
        if (!window.confirm(`删除试卷记录“${paper.title}”？不会删除正式题库题目。`)) return;
        state.paperLibrary = state.paperLibrary.filter(item => item.id !== paperId);
        save();
        renderAll();
        toast('已删除试卷记录');
    }
    function loadPaperToBasket(paperId) {
        const paper = state.paperLibrary.find(item => item.id === paperId);
        if (!paper) return toast('没有找到这套试卷');
        const questions = paperQuestions(paper);
        if (!questions.length) return toast('这套试卷还没有确认入库的题目');
        state.basket = questions.map(q => q.id);
        state.paperDraft = questions.map(q => ({ type: 'question', id: q.id }));
        state.paperDraftExcluded = [];
        if ($('bOutputTitle')) $('bOutputTitle').value = paper.title || '数学题库输出';
        save();
        renderAll();
        switchView('compose');
        toast(`已调出 ${questions.length} 道题`);
    }
    function printPaper(paperId) {
        loadPaperToBasket(paperId);
        setTimeout(printPdf, 200);
    }
    function switchOutputTab(tab) {
        state.outputTab = tab;
        document.querySelectorAll('[data-output-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputTab === tab));
        document.querySelectorAll('.b-side-tab').forEach(el => el.classList.toggle('active', el.id === `bOutputTab-${tab}`));
        renderOutputSide();
    }
    function chipHtml(items = [], active = '', group = '') {
        const unique = ['全部', ...uniq(items.filter(Boolean))];
        return unique.map((item, index) => {
            const value = index === 0 ? '' : item;
            const isActive = index === 0 ? !active : item === active;
            const action = group ? ` onclick="B.setOutputFilter('${group}', '${html(value)}')"` : '';
            return `<button class="b-finder-chip ${isActive ? 'active' : ''}" type="button"${action}>${html(item)}</button>`;
        }).join('');
    }
    function setOutputFilter(group, filterValue = '') {
        const [scope, key] = String(group || '').split('.');
        if (!scope || !key || !state.outputFilters[scope]) return;
        state.outputFilters[scope][key] = filterValue;
        if (scope === 'questions') renderOutputQuestionFinder();
        if (scope === 'papers') renderOutputPaperFinder();
        if (scope === 'history') renderOutputHistory();
    }
    function setHistorySort(sort = '日期↓') {
        state.outputFilters.history.sort = sort;
        renderOutputHistory();
    }
    function setOutputRange(range = '正式题库') {
        state.outputFilters.questions.range = range;
        renderOutputQuestionFinder();
    }
    function toggleOutputCardAnswer(questionId) {
        if (state.expandedOutputAnswers.has(questionId)) state.expandedOutputAnswers.delete(questionId);
        else state.expandedOutputAnswers.add(questionId);
        renderOutputQuestionFinder();
    }
    function outputQuestionPreview(q = {}) {
        if (!questionHasImage(q)) return '';
        const images = normalizedImageItems(q).slice(0, 2);
        const diagram = q.diagramSvg ? `<div class="b-output-card-image"><div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div></div>` : '';
        const imageHtml = images.map((item, index) => `<img class="b-question-image" src="${html(imageSrc(item.url))}" alt="题目图片${index + 1}">`).join('');
        return `<div class="b-output-card-preview">${diagram}${imageHtml}</div>`;
    }
    function outputQuestionAnswer(q = {}) {
        if (!state.expandedOutputAnswers.has(q.id)) return '';
        return `<div class="b-inline-answer-content"><strong>答案：</strong>${formulaForHtml(q.answer || '待补充')}<br><strong>解析：</strong>${formulaForHtml(cleanSolutionForOutput(q.solution) || '待补充')}</div>`;
    }
    function renderOutputSide() {
        renderOutputQuestionFinder();
        renderOutputPaperFinder();
        renderOutputHistory();
    }
    function renderOutputQuestionFinder() {
        if (!$('bOutputQuestionResults')) return;
        const filters = state.outputFilters.questions;
        $('bOutputYearChips').innerHTML = chipHtml(state.questions.map(q => q.source?.year || q.year), filters.year, 'questions.year');
        $('bOutputGradeChips').innerHTML = chipHtml(state.questions.map(q => q.grade), filters.grade, 'questions.grade');
        $('bOutputTypeChips').innerHTML = chipHtml(state.questions.map(q => q.questionType), filters.type, 'questions.type');
        $('bOutputDifficultyChips').innerHTML = chipHtml(state.questions.map(q => q.difficulty), filters.difficulty, 'questions.difficulty');
        if ($('bOutputRangeChips')) {
            const ranges = ['正式题库', '试卷题目', '待确认', 'AI 相似'];
            $('bOutputRangeChips').innerHTML = ranges.map(range => `<button class="b-finder-chip ${filters.range === range ? 'active' : ''}" type="button" onclick="B.setOutputRange('${range}')">${range}</button>`).join('');
        }
        const search = value('bOutputQuestionSearch').toLowerCase();
        if (filters.range === '待确认') {
            let candidates = state.candidates.filter(c => c.status !== 'accepted' && c.status !== 'ignored');
            if (search) candidates = candidates.filter(c => [c.stem, c.rawText, c.answer, c.solution, c.chapter, c.questionType, c.difficulty].join(' ').toLowerCase().includes(search));
            $('bOutputQuestionCount').textContent = `共 ${candidates.length} 道候选题`;
            $('bOutputQuestionResults').innerHTML = candidates.slice(0, 20).map(c => `<article class="b-output-card">
                <div class="b-output-card-title">${textWithMath(String(c.stem || c.rawText || '').slice(0, 46))}${String(c.stem || c.rawText || '').length > 46 ? '...' : ''}</div>
                <div class="b-output-card-meta">${[c.source?.year, c.grade, c.questionType, c.difficulty, c.parseStatus].filter(Boolean).map(html).join(' · ')}</div>
                <button class="b-btn small primary" onclick="B.switchView('candidates');B.reviewCandidate('${c.id}')">去校对</button>
            </article>`).join('') || '<div class="b-empty">没有待确认候选题。</div>';
            queueMathTypeset($('bOutputQuestionResults'));
            return;
        }
        let items = state.questions.filter(q => q.status !== 'archived');
        if (filters.range === '试卷题目') items = items.filter(q => q.source?.paperId);
        if (filters.range === 'AI 相似') {
            items = items.filter(q => questionHasFormula(q) || questionHasImage(q) || (q.knowledgePoints || []).some(k => search && k.toLowerCase().includes(search)));
        }
        if (filters.year) items = items.filter(q => String(q.source?.year || q.year || '') === filters.year);
        if (filters.grade) items = items.filter(q => q.grade === filters.grade);
        if (filters.type) items = items.filter(q => q.questionType === filters.type);
        if (filters.difficulty) items = items.filter(q => q.difficulty === filters.difficulty);
        if (search) {
            items = items.filter(q => [q.stem, q.answer, q.solution, q.chapter, q.questionType, q.difficulty, q.sourceName, ...(q.knowledgePoints || [])].join(' ').toLowerCase().includes(search));
        }
        items = sortOutputQuestions(items).slice(0, 20);
        $('bOutputQuestionCount').textContent = `共 ${items.length} 道题`;
        $('bOutputQuestionResults').innerHTML = items.length ? items.map(q => `<article class="b-output-card">
            <div class="b-output-card-title">${textWithMath(String(q.stem || '').slice(0, 46))}${String(q.stem || '').length > 46 ? '...' : ''}</div>
            <div class="b-output-card-meta">${[q.source?.year, q.region, q.chapter, q.difficulty, questionHasImage(q) ? '含图' : ''].filter(Boolean).map(html).join(' · ')}</div>
            ${outputQuestionPreview(q)}
            ${outputQuestionAnswer(q)}
            <button class="b-btn small primary" onclick="B.addQuestionToDraft('${q.id}')">加入本卷</button>
            <button class="b-btn small" onclick="B.toggleBasket('${q.id}')">加入题篮</button>
            <button class="b-btn small" onclick="B.toggleOutputCardAnswer('${q.id}')">${state.expandedOutputAnswers.has(q.id) ? '收起答案' : '显示答案'}</button>
            <button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">预览/编辑</button>
        </article>`).join('') : '<div class="b-empty">没有找到题目。</div>';
        queueMathTypeset($('bOutputQuestionResults'));
    }
    function sortOutputQuestions(items = []) {
        const rankDifficulty = { 基础: 1, 中等: 2, 提高: 3, 压轴: 4 };
        if (state.outputSort === '难度') return [...items].sort((a, b) => (rankDifficulty[a.difficulty] || 9) - (rankDifficulty[b.difficulty] || 9));
        if (state.outputSort === '时间') return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        if (state.outputSort === '使用次数') return [...items].sort((a, b) => Number(b.useCount || 0) - Number(a.useCount || 0));
        return [...items].sort((a, b) => Number(a.score || 0) - Number(b.score || 0));
    }
    function setOutputSort(sort) {
        state.outputSort = sort;
        if ($('bSortMenu')) $('bSortMenu').style.display = 'none';
        renderOutputQuestionFinder();
    }
    function toggleSortMenu() {
        const el = $('bSortMenu');
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
    function toggleFinderExtra(idName) {
        $(idName)?.classList.toggle('collapsed');
    }
    function expandQuestionKeywords() {
        const current = value('bOutputQuestionSearch');
        if ($('bOutputQuestionSearch') && current && !/模型|方法/.test(current)) $('bOutputQuestionSearch').value = `${current} 模型 方法 变式 易错`;
        renderOutputQuestionFinder();
    }
    function addQuestionToDraft(questionId) {
        const q = state.questions.find(item => item.id === questionId);
        if (!q) return;
        if (!state.basket.includes(questionId)) state.basket.push(questionId);
        ensurePaperDraftFromBasket();
        if (!draftQuestionIds().includes(questionId)) state.paperDraft.push({ type: 'question', id: questionId });
        state.paperDraftExcluded = state.paperDraftExcluded.filter(id => id !== questionId);
        save();
        renderAll();
        refreshOutput();
        toast('已加入本卷');
    }
    function renderOutputPaperFinder() {
        if (!$('bOutputPaperResults')) return;
        const filters = state.outputFilters.papers;
        $('bPaperYearChips').innerHTML = chipHtml(state.paperLibrary.map(p => p.year), filters.year, 'papers.year');
        $('bPaperRegionChips').innerHTML = chipHtml(state.paperLibrary.map(p => p.region), filters.region, 'papers.region');
        $('bPaperTypeChips').innerHTML = chipHtml(state.paperLibrary.map(p => p.sourceType), filters.type, 'papers.type');
        const search = value('bOutputPaperSearch').toLowerCase();
        const papers = state.paperLibrary.filter(p => {
            const hay = [p.title, p.year, p.grade, p.region, p.sourceType, p.fileName].join(' ').toLowerCase();
            if (search && !hay.includes(search)) return false;
            if (filters.year && String(p.year || '') !== filters.year) return false;
            if (filters.region && String(p.region || '') !== filters.region) return false;
            if (filters.type && String(p.sourceType || '') !== filters.type) return false;
            return true;
        }).slice(0, 12);
        $('bOutputPaperResults').innerHTML = papers.length ? papers.map(paper => {
            const count = paperQuestions(paper).length;
            return `<article class="b-output-card">
                <div class="b-output-card-title">${html(paper.title)}</div>
                <div class="b-output-card-meta">${count}题 · ${html(paper.grade || '')} · ${html(paper.createdAt ? paper.createdAt.slice(0, 10) : '')}</div>
                <button class="b-btn small" onclick="B.previewPaperQuestions('${paper.id}')">查看题目</button>
                <button class="b-btn small primary" onclick="B.loadPaperToBasket('${paper.id}')">整卷加入</button>
                <button class="b-btn small red" onclick="B.deletePaper('${paper.id}')">删除记录</button>
            </article>`;
        }).join('') : '<div class="b-empty">暂无试卷记录。</div>';
    }
    function clearOutputPaperFilter() {
        if ($('bOutputPaperSearch')) $('bOutputPaperSearch').value = '';
        renderOutputPaperFinder();
    }
    function previewPaperQuestions(paperId) {
        const paper = state.paperLibrary.find(item => item.id === paperId);
        if (!paper) return;
        const questions = paperQuestions(paper);
        openModal('原卷题目', `<div class="b-form">${questions.map((q, index) => `<article class="b-card"><div class="b-card-top"><div><strong>${index + 1}. ${html(q.stem).slice(0, 80)}</strong><div class="b-tags"><span class="b-tag">${html(q.questionType || '')}</span><span class="b-tag">原第 ${html(q.source?.questionNo || index + 1)} 题</span></div></div><button class="b-btn small primary" onclick="B.addQuestionToDraft('${q.id}')">加入本卷</button></div></article>`).join('') || '<div class="b-empty">这套试卷还没有入库题目。</div>'}</div>`);
    }
    function renderOutputHistory() {
        if (!$('bHistoryList')) return;
        const filters = state.outputFilters.history;
        $('bHistoryGradeChips').innerHTML = chipHtml(state.paperHistory.map(h => h.grade), filters.grade, 'history.grade');
        $('bHistoryTypeChips').innerHTML = chipHtml(state.paperHistory.map(h => outputTypeLabel(h.type)), filters.type, 'history.type');
        if ($('bHistoryDateChips')) {
            const labels = [['', '最近'], ['week', '本周'], ['month', '本月'], ['older', '更早']];
            $('bHistoryDateChips').innerHTML = labels.map(([value, label]) => `<button class="b-finder-chip ${filters.date === value ? 'active' : ''}" type="button" onclick="B.setOutputFilter('history.date', '${value}')">${label}</button>`).join('');
        }
        if ($('bHistorySortChips')) {
            $('bHistorySortChips').innerHTML = ['日期↓', '名称', '题量'].map(sort => `<button class="b-finder-chip ${filters.sort === sort ? 'active' : ''}" type="button" onclick="B.setHistorySort('${sort}')">${sort}</button>`).join('');
        }
        const search = value('bHistorySearch').toLowerCase();
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        const items = [...state.paperHistory]
            .filter(h => {
                if (search && ![h.title, h.type, h.grade].join(' ').toLowerCase().includes(search)) return false;
                if (filters.grade && h.grade !== filters.grade) return false;
                if (filters.type && outputTypeLabel(h.type) !== filters.type) return false;
                const t = new Date(h.updatedAt || h.createdAt || 0);
                const age = now - t;
                if (filters.date === 'week' && age > 7 * dayMs) return false;
                if (filters.date === 'month' && age > 31 * dayMs) return false;
                if (filters.date === 'older' && age <= 31 * dayMs) return false;
                return true;
            })
            .sort((a, b) => {
                if (filters.sort === '名称') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN');
                if (filters.sort === '题量') return (b.items?.filter(x => x.type === 'question').length || 0) - (a.items?.filter(x => x.type === 'question').length || 0);
                return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
            });
        $('bHistoryList').innerHTML = items.length ? items.map(item => `<article class="b-output-card">
            <div class="b-output-card-title">${html(item.title)}</div>
            <div class="b-output-card-meta">${outputTypeLabel(item.type)} · ${item.items?.filter(x => x.type === 'question').length || 0}题 · ${html((item.updatedAt || '').slice(0, 10))}</div>
            <button class="b-btn small primary" onclick="B.openHistoryDraft('${item.id}')">打开</button>
            <button class="b-btn small" onclick="B.duplicateHistoryDraft('${item.id}')">复制</button>
            <button class="b-btn small" onclick="B.exportHistoryDraft('${item.id}')">导出</button>
            <button class="b-btn small red" onclick="B.deleteHistoryDraft('${item.id}')">删除记录</button>
        </article>`).join('') : '<div class="b-empty">暂无历史组卷。保存本卷后会显示在这里。</div>';
    }
    function currentDraftSnapshot() {
        const questions = draftQuestions();
        return {
            id: id('bhistory'),
            title: draftTitle(),
            type: value('bOutputType') || 'quiz',
            mode: value('bOutputMode') || 'student',
            grade: questions.find(q => q.grade)?.grade || '',
            items: JSON.parse(JSON.stringify(state.paperDraft || [])),
            basket: [...state.basket],
            options: outputOptions(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
    function savePaperHistory() {
        const snapshot = currentDraftSnapshot();
        const existingIndex = state.paperHistory.findIndex(item => item.title === snapshot.title);
        if (existingIndex >= 0) {
            snapshot.id = state.paperHistory[existingIndex].id;
            snapshot.createdAt = state.paperHistory[existingIndex].createdAt || snapshot.createdAt;
            state.paperHistory.splice(existingIndex, 1, snapshot);
        } else {
            state.paperHistory.unshift(snapshot);
        }
        save();
        renderOutputHistory();
        toast('已保存到历史组卷');
    }
    function restoreDraftSnapshot(snapshot = {}, copy = false) {
        if (!snapshot.items?.length) return toast('这个历史记录没有本卷内容');
        state.paperDraft = JSON.parse(JSON.stringify(snapshot.items));
        state.basket = Array.isArray(snapshot.basket) ? [...snapshot.basket] : state.paperDraft.filter(item => item.type === 'question').map(item => item.id);
        state.paperDraftExcluded = [];
        if ($('bOutputTitle')) $('bOutputTitle').value = copy ? `${snapshot.title} 副本` : snapshot.title;
        setOutputType(snapshot.type || 'quiz');
        setOutputMode(snapshot.mode || 'student');
        save();
        renderAll();
        refreshOutput();
        switchView('compose');
    }
    function openHistoryDraft(historyId) {
        const item = state.paperHistory.find(h => h.id === historyId);
        if (!item) return;
        restoreDraftSnapshot(item, false);
        toast('已打开历史组卷');
    }
    function duplicateHistoryDraft(historyId) {
        const item = state.paperHistory.find(h => h.id === historyId);
        if (!item) return;
        restoreDraftSnapshot(item, true);
        savePaperHistory();
    }
    function exportHistoryDraft(historyId) {
        const item = state.paperHistory.find(h => h.id === historyId);
        if (!item) return;
        restoreDraftSnapshot(item, false);
        setTimeout(downloadHtml, 60);
    }
    function deleteHistoryDraft(historyId) {
        const item = state.paperHistory.find(h => h.id === historyId);
        if (!item) return;
        if (!window.confirm(`删除历史组卷“${item.title}”？`)) return;
        state.paperHistory = state.paperHistory.filter(h => h.id !== historyId);
        save();
        renderOutputHistory();
        toast('已删除历史组卷');
    }
    function questionRefText(q = {}, index = 0) {
        return q.source?.questionNo ? `原${q.source.questionNo}` : (q.internalNo || q.id || `第${index + 1}题`);
    }
    function compactQuestionForAi(q = {}, index = 0) {
        return {
            id: q.id,
            ref: questionRefText(q, index),
            type: q.questionType || '',
            difficulty: q.difficulty || '',
            chapter: q.chapter || '',
            knowledgePoints: q.knowledgePoints || [],
            score: q.score || '',
            stem: String(q.stem || '').replace(/\s+/g, ' ').slice(0, 90),
            answer: String(q.answer || '').replace(/\s+/g, ' ').slice(0, 60),
            hasImage: questionHasImage(q)
        };
    }
    function localAiOutlineSuggestion(items = basketItems()) {
        const calc = items.filter(q => /填空|计算/.test(q.questionType || ''));
        const core = items.filter(q => /选择|应用|几何|综合|证明/.test(q.questionType || ''));
        const sections = [
            { title: '一、知识梳理', note: '方法提示：先明确模型、公式或转化关系，再进入例题。', questionIds: calc.slice(0, 1).map(q => q.id) },
            { title: '二、例题与训练', note: '建议按基础到提高排列，讲一题后配一题变式。', questionIds: core.map(q => q.id) },
            { title: '三、课后练习', note: '保留独立练习题，用于课堂后半段或课后巩固。', questionIds: calc.slice(1).map(q => q.id) }
        ].filter(section => section.note || section.questionIds.length);
        return { source: 'local', sections, warnings: ['当前展示为本地结构建议。'] };
    }
    function apiBase() {
        return window.location.protocol === 'file:' ? 'http://localhost:3000' : '';
    }
    function extractJsonFromText(text = '') {
        const raw = String(text || '').trim();
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : raw;
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
    }
    function findQuestionIdByRef(ref = '', items = []) {
        const text = String(ref || '').trim();
        if (!text) return '';
        const cleaned = text.replace(/^原第?/, '').replace(/题$/, '');
        const found = items.find((q, index) => q.id === text || q.internalNo === text || String(q.source?.questionNo || '') === cleaned || String(index + 1) === cleaned);
        return found?.id || '';
    }
    function normalizeAiOutlineSuggestion(aiText = '', items = []) {
        const parsed = extractJsonFromText(aiText);
        if (parsed?.sections?.length) {
            const sections = parsed.sections.map(section => {
                const refs = section.questionIds || section.questionRefs || section.questions || [];
                const questionIds = refs.map(ref => typeof ref === 'object' ? (ref.id || ref.ref || ref.no) : ref)
                    .map(ref => findQuestionIdByRef(ref, items))
                    .filter(Boolean);
                return {
                    title: section.title || section.name || '未命名模块',
                    note: section.note || section.description || section.text || '',
                    questionIds: [...new Set(questionIds)]
                };
            }).filter(section => section.title || section.note || section.questionIds.length);
            if (sections.length) return { source: 'ai', rawText: aiText, sections, warnings: [] };
        }
        const fallback = localAiOutlineSuggestion(items);
        fallback.source = 'ai-text';
        fallback.rawText = aiText;
        fallback.warnings = ['AI 返回了文本建议，系统已用本地规则匹配题号。'];
        return fallback;
    }
    function aiOutlineHtml(suggestion = state.lastAiOutlineSuggestion) {
        if (state.aiPanelLoading) return '<div class="b-empty">AI 正在分析题篮和本卷结构...</div>';
        if (!suggestion) return '<div class="b-empty">生成后会在这里显示结构建议。</div>';
        const warnings = [...(suggestion.warnings || []), state.aiPanelError].filter(Boolean);
        const sourceTag = suggestion.source === 'ai' ? '<span class="b-tag green">AI 建议</span>' : suggestion.source === 'ai-text' ? '<span class="b-tag orange">AI 文本 + 本地匹配</span>' : '<span class="b-tag">本地建议</span>';
        const rows = (suggestion.sections || []).map(section => {
            const refs = (section.questionIds || []).map(id => {
                const q = state.questions.find(item => item.id === id) || {};
                return questionRefText(q);
            }).filter(Boolean).join('、') || '无指定题号';
            return `<div class="b-output-card"><div class="b-output-card-title">${html(section.title)}</div><div class="b-output-card-meta">${html(section.note || '无说明')}</div><div class="b-tags"><span class="b-tag">${html(refs)}</span></div></div>`;
        }).join('');
        const raw = suggestion.rawText ? `<details class="b-mini-note"><summary>查看 AI 原文</summary><pre style="white-space:pre-wrap;margin:6px 0 0;">${html(suggestion.rawText)}</pre></details>` : '';
        return `${sourceTag}${warnings.length ? `<div class="b-tags">${warnings.map(item => `<span class="b-tag orange">${html(item)}</span>`).join('')}</div>` : ''}${rows || '<div class="b-empty">暂无可加入的结构。</div>'}${raw}`;
    }
    function renderAiOutlineSuggestion() {
        if ($('bAiOutline')) $('bAiOutline').innerHTML = aiOutlineHtml();
    }
    async function requestOutputAi(task, instruction) {
        const items = basketItems();
        const draft = draftItems().slice(0, 40).map((item, index) => ({
            index: index + 1,
            type: item.type,
            title: item.title || '',
            text: item.text ? String(item.text).slice(0, 80) : '',
            questionId: item.id || ''
        }));
        const payload = {
            agent: 'teaching-agent',
            task,
            answerLength: 'detailed',
            modelProvider: state.aiProvider || value('bImportAIProvider') || '',
            latestQuestion: instruction,
            input: JSON.stringify({
                outputType: value('bOutputType') || 'quiz',
                outputMode: value('bOutputMode') || 'student',
                questions: items.map(compactQuestionForAi),
                draft,
                stats: {
                    count: items.length,
                    types: group(items, q => q.questionType),
                    difficulties: group(items, q => q.difficulty),
                    chapters: group(items, q => q.chapter)
                }
            })
        };
        const res = await fetch(`${apiBase()}/api/ai/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'AI 调用失败');
        return data;
    }
    async function generateAiOutline() {
        const items = basketItems();
        if (!items.length) return toast('请先加入题篮');
        state.aiPanelLoading = true;
        state.aiPanelError = '';
        state.lastAiOutlineSuggestion = null;
        renderAiOutlineSuggestion();
        const local = localAiOutlineSuggestion(items);
        try {
            const instruction = '请根据题篮题目和当前本卷草稿，生成讲义/练习结构建议。请优先输出 JSON：{"sections":[{"title":"一、知识梳理","note":"说明","questionRefs":["原1","B-001"]}]}，再补充简短理由。';
            const data = await requestOutputAi('lesson-plan', instruction);
            const suggestion = normalizeAiOutlineSuggestion(data.result || data.outputText || '', items);
            suggestion.provider = data.provider || '';
            suggestion.mode = data.mode || '';
            if (data.mode === 'local-template') {
                suggestion.warnings = [...(suggestion.warnings || []), '真实 AI 未启用或不可用，已显示本地/模板建议。'];
            }
            if (Array.isArray(data.warnings)) suggestion.warnings = [...(suggestion.warnings || []), ...data.warnings];
            state.lastAiOutlineSuggestion = suggestion;
        } catch (err) {
            state.lastAiOutlineSuggestion = local;
            state.aiPanelError = `AI 暂不可用：${err.message || err}`;
        } finally {
            state.aiPanelLoading = false;
            renderAiOutlineSuggestion();
        }
    }
    function applyAiOutline() {
        const suggestion = state.lastAiOutlineSuggestion || localAiOutlineSuggestion(basketItems());
        if (!suggestion.sections?.length) return toast('请先生成大纲');
        const existing = new Set(state.paperDraft.filter(item => item.type === 'question').map(item => item.id));
        suggestion.sections.forEach(section => {
            state.paperDraft.push({ type: 'heading', title: section.title || '未命名模块' });
            if (section.note) state.paperDraft.push({ type: 'text', text: section.note });
            (section.questionIds || []).forEach(questionId => {
                if (existing.has(questionId)) return;
                state.paperDraft.push({ type: 'question', id: questionId });
                existing.add(questionId);
            });
        });
        save();
        renderAll();
        refreshOutput();
        toast('已把大纲建议加入本卷草稿');
    }
    async function checkDraftQuality() {
        const qs = draftQuestions();
        const problems = [];
        if (!qs.length) problems.push('本卷还没有题目');
        if (qs.some(q => !q.answer)) problems.push('存在缺答案题');
        if (qs.some(q => /如图|下图|图中/.test(q.stem || '') && !questionHasImage(q))) problems.push('存在含图但无附件题');
        const difficulties = qs.map(q => q.difficulty).filter(Boolean);
        if (difficulties.includes('压轴') && difficulties[0] === '压轴') problems.push('压轴题位置偏前');
        const localHtml = problems.length ? `<div class="b-tags">${problems.map(p => `<span class="b-tag orange">${html(p)}</span>`).join('')}</div>` : '<div class="b-tag green">本卷常规检查通过</div>';
        if ($('bDraftQuality')) $('bDraftQuality').innerHTML = `${localHtml}<div class="b-empty">AI 正在补充质量建议...</div>`;
        try {
            const data = await requestOutputAi('exam-analysis', '请检查当前本卷质量，重点看难度递进、题型比例、图片断页、答案解析完整性。用 3-5 条短建议回答。');
            const warning = data.mode === 'local-template' ? '<span class="b-tag orange">真实 AI 未启用，以下为模板建议</span>' : '<span class="b-tag green">AI 建议</span>';
            if ($('bDraftQuality')) $('bDraftQuality').innerHTML = `${localHtml}<div class="b-tags">${warning}</div><div class="b-output-card-meta">${html(data.result || '').replace(/\n/g, '<br>')}</div>`;
        } catch (err) {
            if ($('bDraftQuality')) $('bDraftQuality').innerHTML = `${localHtml}<div class="b-tag orange">AI 暂不可用：${html(err.message || err)}</div>`;
        }
    }
    function group(items, fn) {
        return items.reduce((acc, item) => {
            const key = fn(item) || '未标注';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
    function renderMiniDist(title, data) {
        return `<div class="b-doc"><h3>${html(title)}</h3><div class="b-tags">${Object.entries(data).map(([k, n]) => `<span class="b-tag">${html(k)} · ${n}</span>`).join('') || '<span class="b-tag">暂无</span>'}</div></div>`;
    }
    function renderBasket() {
        const items = basketItems();
        const totalScore = items.reduce((s, q) => s + Number(q.score || 0), 0);
        if ($('bBasketStats')) $('bBasketStats').innerHTML = [['题数', items.length], ['总分', totalScore]].map(([l, n]) => `<div class="b-kpi"><strong>${n}</strong><span>${l}</span></div>`).join('');
        if ($('bBasketList')) $('bBasketList').innerHTML = items.length ? items.map((q, i) => `<article class="b-card"><div class="b-card-top"><div>${i + 1}. ${textWithMath(String(q.stem || '').slice(0, 70))}${q.stem.length > 70 ? '...' : ''}</div><button class="b-btn small" onclick="B.toggleBasket('${q.id}')">移出</button></div><div class="b-tags"><span class="b-tag">${html(q.chapter)}</span><span class="b-tag">${html(q.difficulty)}</span><span class="b-tag">${q.score}分</span></div></article>`).join('') : '<div class="b-empty">题篮为空。</div>';
        if ($('bBasketStructure')) $('bBasketStructure').innerHTML = items.length ? `<div class="b-health">${renderMiniDist('年级分布', group(items, q => q.grade))}${renderMiniDist('章节分布', group(items, q => q.chapter))}${renderMiniDist('难度分布', group(items, q => q.difficulty))}${renderMiniDist('题型分布', group(items, q => q.questionType))}</div>` : '<div class="b-empty">加入题目后显示结构统计。</div>';
        renderBasketDrawer();
        queueMathTypeset($('bBasketList'));
    }
    function renderBasketDrawer() {
        const el = $('bBasketDrawerBody');
        if (!el) return;
        const items = basketItems();
        const allAction = items.length ? `<div class="b-actions" style="justify-content:flex-start;margin-bottom:10px;"><button class="b-btn small primary" onclick="B.addAllBasketToDraft()">全部加入本卷</button></div>` : '';
        el.innerHTML = items.length ? allAction + items.map((q, i) => `<article class="b-basket-mini" draggable="true" ondragstart="B.startBasketDrag(event, ${i})" ondragover="B.allowBasketDrop(event)" ondrop="B.dropBasketItem(event, ${i})">
            <div class="b-basket-mini-title">${i + 1}. ${textWithMath(String(q.stem || '').slice(0, 86))}${q.stem.length > 86 ? '...' : ''}</div>
            <div class="b-actions" style="justify-content:flex-start;"><span class="b-tag">${html(q.chapter || '未标章节')}</span><button class="b-btn small primary" onclick="B.addBasketQuestionToDraft('${q.id}')">加入本卷</button><button class="b-btn small" onclick="B.moveBasketItem(${i}, -1)">上移</button><button class="b-btn small" onclick="B.moveBasketItem(${i}, 1)">下移</button><button class="b-btn small" onclick="B.toggleBasket('${q.id}')">移出</button></div>
        </article>`).join('') : '<div class="b-empty">题篮为空。去正式题库加入题目。</div>';
        queueMathTypeset(el);
    }
    function addBasketQuestionToDraft(questionId) {
        addQuestionToDraft(questionId);
        closeBasketDrawer();
    }
    function addAllBasketToDraft() {
        const ids = state.basket.filter(Boolean);
        if (!ids.length) return toast('题篮为空');
        ensurePaperDraftFromBasket();
        ids.forEach(questionId => {
            if (!draftQuestionIds().includes(questionId)) state.paperDraft.push({ type: 'question', id: questionId });
            state.paperDraftExcluded = state.paperDraftExcluded.filter(id => id !== questionId);
        });
        save();
        renderAll();
        refreshOutput();
        closeBasketDrawer();
        switchView('compose');
        toast(`已加入 ${ids.length} 道题到本卷`);
    }
    function moveBasketItem(index, delta) {
        const next = index + delta;
        if (next < 0 || next >= state.basket.length) return;
        const [item] = state.basket.splice(index, 1);
        state.basket.splice(next, 0, item);
        save();
        renderAll();
        refreshOutput();
    }
    function startBasketDrag(event, index) {
        event.dataTransfer?.setData('text/plain', String(index));
        event.currentTarget?.classList.add('dragging');
    }
    function allowBasketDrop(event) {
        event.preventDefault();
    }
    function dropBasketItem(event, targetIndex) {
        event.preventDefault();
        const from = Number(event.dataTransfer?.getData('text/plain'));
        document.querySelectorAll('.b-basket-mini.dragging').forEach(el => el.classList.remove('dragging'));
        if (!Number.isFinite(from) || from === targetIndex || from < 0 || from >= state.basket.length) return;
        const [item] = state.basket.splice(from, 1);
        state.basket.splice(targetIndex, 0, item);
        save();
        renderAll();
        refreshOutput();
    }
    function openBasketDrawer() {
        renderBasketDrawer();
        $('bBasketBackdrop')?.classList.add('show');
        $('bBasketDrawer')?.classList.add('show');
    }
    function closeBasketDrawer() {
        $('bBasketBackdrop')?.classList.remove('show');
        $('bBasketDrawer')?.classList.remove('show');
    }
    function openHelpDrawer() {
        $('bBasketBackdrop')?.classList.add('show');
        $('bHelpDrawer')?.classList.add('show');
    }
    function closeHelpDrawer() {
        $('bBasketBackdrop')?.classList.remove('show');
        $('bHelpDrawer')?.classList.remove('show');
    }
    function closeAllDrawers() {
        closeBasketDrawer();
        closeHelpDrawer();
    }
    function closeInlineMenus() {
        if (state.activeInsertMenuIndex < 0 && state.activeAnswerMenuIndex < 0 && state.activeAnswerStyleIndex < 0) return;
        state.activeInsertMenuIndex = -1;
        state.activeAnswerMenuIndex = -1;
        state.activeAnswerStyleIndex = -1;
        renderPaperDraft();
        generateOutput();
    }
    function goComposeFromBasket() {
        closeBasketDrawer();
        switchView('compose');
    }
    function outputOptions() {
        return {
            showScore: $('bShowScore')?.checked || false,
            showDifficulty: $('bShowDifficulty')?.checked || false,
            showTags: $('bShowTags')?.checked || false,
            showSource: $('bShowSource')?.checked || false,
            showAnswerArea: $('bShowAnswerArea')?.checked || false,
            answerAutoByType: $('bAnswerAutoByType')?.checked !== false,
            fillBlankStyle: value('bFillBlankStyle') || 'underline',
            solutionRows: Number(value('bSolutionRows') || 6),
            keepQuestionTogether: $('bKeepQuestionTogether')?.checked !== false,
            paperSize: value('bPaperSize') || 'A4',
            paperFontSize: value('bPaperFontSize') || '10.5',
            wordKeepPage: $('bWordKeepPage')?.checked !== false,
            pdfKeepPage: $('bPdfKeepPage')?.checked !== false
        };
    }
    function questionLine(q, index, opts) {
        return renderQuestionForMarkdown(q, index, opts);
    }
    function cleanStemForOutput(stem) {
        return String(stem || '')
            .split(/\n/)
            .filter(line => !/^\s*(?:参考答案|答案|解析|解答|讲解)\s*[:：]/.test(line))
            .join('\n')
            .trim();
    }
    function questionNeedsFillBlank(q = {}) {
        const stem = outputStemText(q);
        if ((q.questionType || '').includes('填空')) return true;
        if (/A[.．、]|B[.．、]|C[.．、]|D[.．、]|（\s*　*\s*）/.test(stem)) return false;
        const answer = String(q.answer || '').trim();
        return Boolean(answer && answer.length <= 30 && /(?:是|为|等于|填|写出|：|:)\s*$/.test(stem));
    }
    function questionIsChoice(q = {}) {
        const stem = outputStemText(q);
        return (q.questionType || '').includes('选择') || /A[.．、].+B[.．、]/s.test(stem);
    }
    function defaultAnswerAreaByType(q = {}, opts = {}) {
        if (!opts.showAnswerArea) return { enabled: false, style: 'lines', rows: opts.solutionRows || 6 };
        if (!opts.answerAutoByType) return { enabled: true, style: 'lines', rows: opts.solutionRows || 6 };
        if (questionIsChoice(q)) return { enabled: false, style: 'lines', rows: 0 };
        if (questionNeedsFillBlank(q)) return { enabled: true, style: opts.fillBlankStyle === 'blank' ? 'blank' : 'underline', rows: 1 };
        const questionType = q.questionType || '';
        const rows = /几何|证明|综合|压轴/.test(questionType) ? Math.max(8, opts.solutionRows || 6) : (opts.solutionRows || 6);
        return { enabled: true, style: 'lines', rows };
    }
    function stemWithFillBlank(q = {}) {
        const stem = outputStemText(q);
        if (questionNeedsFillBlank(q) && !/_{3,}|＿{3,}|____|填空线/.test(stem)) {
            return `${stem} ________`;
        }
        return stem;
    }
    function answerAreaConfig(q = {}, opts = {}) {
        const area = opts.draftItem?.answerArea || {};
        const defaults = defaultAnswerAreaByType(q, opts);
        const style = area.override && area.style && area.style !== 'inherit' ? area.style : defaults.style;
        const rows = area.override && area.rows ? area.rows : (style === 'underline' ? 1 : defaults.rows);
        const enabled = area.override ? area.enabled !== false : defaults.enabled;
        return { enabled, style, rows, forceNextPage: area.forceNextPage || false };
    }
    function renderAnswerArea(q = {}, opts = {}) {
        if (opts.mode !== 'student') return '';
        const config = answerAreaConfig(q, opts);
        if (!config.enabled) return '';
        if (config.style === 'underline') {
            const lines = Array.from({ length: Math.max(1, Number(config.rows || 1)) }, () => '<div class="b-answer-line"></div>').join('');
            return `<div class="b-answer-area"><div class="b-answer-lines">${lines}</div></div>`;
        }
        if (config.style === 'blank') return `<div class="b-answer-area b-answer-blank" style="min-height:${Math.max(36, Number(config.rows || 4) * 18)}px"></div>`;
        const lines = Array.from({ length: Math.max(1, Number(config.rows || 6)) }, () => '<div class="b-answer-line"></div>').join('');
        return `<div class="b-answer-area"><div class="b-answer-lines">${lines}</div></div>`;
    }
    function buildMarkdown() {
        const items = draftItems();
        const title = draftTitle();
        const mode = value('bOutputMode') || 'student';
        const type = value('bOutputType') || 'paper';
        const opts = outputOptions();
        const questions = draftQuestions();
        const totalScore = questions.reduce((s, q) => s + Number(q.score || 0), 0);
        const defaultMeta = mode === 'answerOnly' ? '答案版' : `姓名：__________　总分：${totalScore} 分`;
        const lines = [`# ${title}`, ''];
        if (!state.paperMetaHidden) lines.push(state.paperMetaText || defaultMeta, '');
        if (type === 'variants') lines.push('说明：以下为举一反三练习草稿，变式需老师最终确认。', '');
        if (type === 'wrongbook') lines.push('## 错题复练清单', '');
        let questionIndex = 0;
        items.forEach((item) => {
            if (mode === 'answerOnly' && ['pageBreak', 'blank'].includes(item.type)) return;
            if (item.type === 'heading') {
                lines.push(`## ${item.title}`, '');
                return;
            }
            if (item.type === 'text') {
                lines.push(String(item.text || '').trim(), '');
                return;
            }
            if (item.type === 'pageBreak') {
                lines.push('--- 分页 ---', '');
                return;
            }
            if (item.type === 'blank') {
                lines.push(...Array.from({ length: Math.max(1, Number(item.rows || 4)) }, () => ''), '');
                return;
            }
            if (item.type === 'table') {
                lines.push(`表格：${item.title || ''}`, ...(item.rows || []).map(row => row.join(' | ')), '');
                return;
            }
            if (item.type === 'image') {
                lines.push(`![${item.caption || '图片'}](${imageSrc(item.url)})`, '');
                return;
            }
            lines.push(questionLine(item.question, questionIndex, { ...opts, mode, type, draftItem: item }));
            questionIndex += 1;
            if (type === 'variants') lines.push('变式 1：换数字。', '变式 2：换问法。', '变式 3：加一步。', '');
            lines.push('');
        });
        return lines.filter(line => line !== undefined).join('\n');
    }
    function imageSrc(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (!isImageReference(value)) return '';
        if (/^(?:https?:|data:|blob:|file:)/i.test(value)) return value;
        if (value.startsWith('/Users/')) return `file://${value}`;
        if (value.startsWith('/')) {
            const origin = /^https?:$/i.test(window.location.protocol) ? window.location.origin : 'http://localhost:3000';
            return `${origin}${value}`;
        }
        return value;
    }
    function questionImages(q = {}) {
        const images = Array.isArray(q.images) ? q.images.map(item => typeof item === 'string' ? item : item?.url).filter(isImageReference) : [];
        if (!images.length && isImageReference(q.imageUrl)) images.push(q.imageUrl);
        return [...new Set(images)];
    }
    function normalizedImageItems(q = {}) {
        const items = Array.isArray(q.images) ? q.images.map((item, index) => {
            if (typeof item === 'string') return { url: item, role: '', order: index + 1 };
            return { url: item?.url || '', role: item?.role || '', optionLabel: item?.optionLabel || '', order: item?.order || index + 1 };
        }).filter(item => isImageReference(item.url)) : [];
        if (!items.length && isImageReference(q.imageUrl)) items.push({ url: q.imageUrl, role: 'stem', order: 1 });
        return items;
    }
    function imageItemsByRole(q = {}, role = '') {
        return normalizedImageItems(q).filter(item => item.role === role || (!item.role && role === 'stem')).map(item => item.url);
    }
    function optionImageEntries(q = {}) {
        return ['A', 'B', 'C', 'D']
            .map(label => ({ label, image: imageItemsByRole(q, `option-${label}`)[0] || '' }))
            .filter(item => item.image);
    }
    function firstImageByRole(q = {}, role = '') {
        return imageItemsByRole(q, role)[0] || '';
    }
    function buildRoleImagesFromEditor(existing = {}) {
        const rows = [
            ['bEditStemImage', 'stem', ''],
            ['bEditOptionAImage', 'option-A', 'A'],
            ['bEditOptionBImage', 'option-B', 'B'],
            ['bEditOptionCImage', 'option-C', 'C'],
            ['bEditOptionDImage', 'option-D', 'D'],
            ['bEditSolutionImage', 'solution', '']
        ];
        const items = rows.map(([idName, role, optionLabel], index) => ({ url: value(idName), role, optionLabel, order: index + 1 })).filter(item => item.url);
        if (!items.length && value('bEditImage')) items.push({ url: value('bEditImage'), role: 'stem', optionLabel: '', order: 1 });
        return items.length ? items : (existing.images || []);
    }
    function buildRoleImagesFromCandidateEditor(existing = {}) {
        const rows = [
            ['bCandStemImage', 'stem', ''],
            ['bCandOptionAImage', 'option-A', 'A'],
            ['bCandOptionBImage', 'option-B', 'B'],
            ['bCandOptionCImage', 'option-C', 'C'],
            ['bCandOptionDImage', 'option-D', 'D'],
            ['bCandSolutionImage', 'solution', '']
        ];
        const items = rows.map(([idName, role, optionLabel], index) => ({ url: value(idName), role, optionLabel, order: index + 1 })).filter(item => item.url);
        if (!items.length && value('bCandImage')) items.push({ url: value('bCandImage'), role: 'stem', optionLabel: '', order: 1 });
        return items.length ? items : (existing.images || []);
    }
    function renderImages(q = {}, alt = '题目图片') {
        return questionImages(q).map((url, index) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="${alt}${index + 1}">`).join('');
    }
    function renderQuestionBankMedia(innerHtml, q = {}, label = '图片') {
        const selected = state.activeBankImageId === q.id;
        const handle = `<span class="b-resize-handle" title="拖动调整正式题图片大小" onmousedown="B.startQuestionImageResize(event, '${html(q.id)}')"></span>`;
        return `<div class="b-resizable-figure is-resizable ${selected ? 'is-selected' : ''}"${outputMediaStyle(q)} aria-label="${html(label)}" onclick="event.stopPropagation();B.selectQuestionImage('${html(q.id)}')">${innerHtml}${handle}</div>`;
    }
    function renderRoleImages(q = {}, opts = {}) {
        let items = normalizedImageItems(q);
        if (!items.length) return '';
        const hasOptionRoles = items.some(item => /^option-[A-D]$/.test(item.role || ''));
        if (!hasOptionRoles) {
            const parsed = parseChoiceStem(outputStemText(q), []);
            const rawImages = questionImages(q);
            if (parsed.options.length && rawImages.length === parsed.options.length) {
                items = parsed.options.map((option, index) => ({ url: rawImages[index], role: `option-${option.label}`, optionLabel: option.label, order: index + 1 }));
            }
        }
        const labels = { stem: '题干图', 'option-A': 'A 图', 'option-B': 'B 图', 'option-C': 'C 图', 'option-D': 'D 图', solution: '解析图' };
        const groups = ['stem', 'option-A', 'option-B', 'option-C', 'option-D', 'solution']
            .map(role => ({ role, urls: items.filter(item => (item.role || 'stem') === role).map(item => item.url) }))
            .filter(group => group.urls.length);
        return `<div class="b-image-role-grid">${groups.map(group => `<div class="b-image-role-item"><div class="b-mini-note">${labels[group.role] || '图片'}</div>${group.urls.map((url, index) => {
            const image = `<img class="b-question-image" src="${html(imageSrc(url))}" alt="${labels[group.role] || '图片'}${index + 1}">`;
            return opts.bankQuestionId ? renderQuestionBankMedia(image, q, labels[group.role] || '图片') : image;
        }).join('')}</div>`).join('')}</div>`;
    }
    function outputStemText(q = {}) {
        return cleanStemForOutput(q.stem || '').replace(/^\s*(?:图片|图|image|img)\s*[:：]\s*\S+\s*$/gim, '').trim();
    }
    function cleanSolutionForOutput(solution = '') {
        return removeImageLines(solution).trim();
    }
    function parseChoiceStem(stem, images = []) {
        const text = String(stem || '').replace(/^\s*(?:图片|图|image|img)\s*[:：]\s*\S+\s*$/gim, '').trim();
        const re = /(^|[^A-Za-z0-9一-龥])([A-D])[ \t　]*[.．、][ \t　]*/g;
        const matches = [];
        let match;
        while ((match = re.exec(text))) {
            matches.push({ label: match[2], markerStart: match.index + match[1].length, contentStart: re.lastIndex });
        }
        const expected = ['A', 'B', 'C', 'D'];
        const consecutive = matches.every((item, index) => item.label === expected[index]);
        if (matches.length < 2 || matches[0]?.label !== 'A' || !consecutive) return { intro: text, options: [], usedImageCount: 0 };
        const intro = text.slice(0, matches[0].markerStart).trim();
        const options = matches.map((item, index) => {
            const next = matches[index + 1]?.markerStart ?? text.length;
            const labelText = text.slice(item.contentStart, next).trim();
            return {
                label: item.label,
                text: labelText,
                image: images[index] || ''
            };
        });
        return { intro, options, usedImageCount: Math.min(images.length, options.length) };
    }
    function clampNumber(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) return min;
        return Math.min(max, Math.max(min, num));
    }
    function outputImageSize(q = {}, fallback = {}) {
        const width = Number(q.imageWidth || 0);
        const height = Number(q.imageHeight || 0);
        if (width > 0 && height > 0) {
            return {
                width: clampNumber(width, 90, 720),
                height: clampNumber(height, 50, 520)
            };
        }
        if (fallback.width && fallback.height) return fallback;
        if (q.imageSize === 'small') return { width: 220, height: 130 };
        if (q.imageSize === 'large') return { width: 560, height: 320 };
        return { width: 360, height: 220 };
    }
    function outputMediaStyle(q = {}, fallback = {}) {
        const size = outputImageSize(q, fallback);
        if (!size.width || !size.height) return '';
        return ` style="width:${Math.round(size.width)}px;height:${Math.round(size.height)}px"`;
    }
    function renderOutputMedia(innerHtml, q = {}, opts = {}, label = '图片') {
        const interactive = Boolean(opts.interactive && Number.isFinite(Number(opts.draftIndex)));
        const draftIndex = Number(opts.draftIndex);
        const selected = interactive && state.activeImageDraftIndex === draftIndex;
        const handle = interactive ? `<span class="b-resize-handle" title="拖动调整本卷图片大小" onmousedown="B.startDraftImageResize(event, ${Number(opts.draftIndex)})"></span>` : '';
        return `<div class="b-resizable-figure ${interactive ? 'is-resizable' : ''} ${selected ? 'is-selected' : ''}"${outputMediaStyle(q)} aria-label="${html(label)}" ${interactive ? `onclick="event.stopPropagation();B.selectDraftImage(${draftIndex})"` : ''}>${innerHtml}${handle}</div>`;
    }
    function renderQuestionForOutput(q, index, opts = {}) {
        const allImages = questionImages(q);
        const roleItems = normalizedImageItems(q);
        const hasRoles = roleItems.some(item => item.role);
        const hasOptionRoles = roleItems.some(item => /^option-[A-D]$/.test(item.role || ''));
        const tempParsed = parseChoiceStem(stemWithFillBlank(q), []);
        const optionLabels = tempParsed.options.map(option => option.label);
        let stemImages = hasRoles ? imageItemsByRole(q, 'stem') : [];
        let optionImages = hasOptionRoles ? optionLabels.map(label => imageItemsByRole(q, `option-${label}`)[0] || '') : [];
        if (!hasRoles && !hasOptionRoles) {
            if (tempParsed.options.length && allImages.length === tempParsed.options.length) optionImages = allImages;
            else if (tempParsed.options.length && allImages.length > tempParsed.options.length) {
                stemImages = allImages.slice(0, allImages.length - tempParsed.options.length);
                optionImages = allImages.slice(-tempParsed.options.length);
            } else stemImages = allImages;
        }
        const parsed = parseChoiceStem(stemWithFillBlank(q), optionImages);
        if (!parsed.options.length && hasOptionRoles) {
            parsed.options = optionImageEntries(q).map(item => ({ label: item.label, text: '', image: item.image }));
        }
        const metaParts = [opts.showScore ? `${q.score}分` : '', opts.showDifficulty ? html(q.difficulty) : ''].filter(Boolean);
        const meta = metaParts.length ? `<span class="b-question-meta">${metaParts.join(' | ')}</span>` : '';
        if (opts.mode === 'answerOnly') {
            return `<section class="b-preview-question b-answer-only ${imageSizeClass(q)}">
                ${opts.showSource ? `<p class="b-source-line">来源：${html(sourceWithQuestionNo(q))}</p>` : ''}
                <p class="b-question-line"><span class="b-question-no">${index + 1}.</span><strong>答案：</strong>${formulaForHtml(q.answer || '待补充')}</p>
                <div class="b-teacher-block"><strong>解析：</strong>${formulaForHtml(cleanSolutionForOutput(q.solution) || '待补充')}${imageItemsByRole(q, 'solution').map((url, imageIndex) => renderOutputMedia(`<img class="b-question-image" src="${html(imageSrc(url))}" alt="解析图片${imageIndex + 1}">`, q, opts, `解析图片${imageIndex + 1}`)).join('')}</div>
            </section>`;
        }
        const questionText = parsed.options.length ? parsed.intro : stemWithFillBlank(q);
        const remainingImages = parsed.options.length ? stemImages : stemImages;
        const optionGrid = parsed.options.length ? `<div class="b-option-grid">${parsed.options.map(option => `<div class="b-option-item"><span class="b-option-label">${html(option.label)}.</span>${formulaForHtml(option.text)}${option.image ? renderOutputMedia(`<img class="b-question-image" src="${html(imageSrc(option.image))}" alt="选项${html(option.label)}图片">`, q, opts, `选项${html(option.label)}图片`) : ''}</div>`).join('')}</div>` : '';
        const extras = `${q.diagramSvg ? renderOutputMedia(`<div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div>`, q, opts, 'SVG 图形') : ''}${remainingImages.map((url, imageIndex) => renderOutputMedia(`<img class="b-question-image" src="${html(imageSrc(url))}" alt="题目图片${imageIndex + 1}">`, q, opts, `题目图片${imageIndex + 1}`)).join('')}`;
        const solutionImages = imageItemsByRole(q, 'solution');
        const answerArea = renderAnswerArea(q, opts);
        const breakStyle = answerAreaConfig(q, opts).forceNextPage ? ' style="break-before:page;page-break-before:always;"' : '';
        return `<section class="b-preview-question ${imageSizeClass(q)}"${breakStyle}>
            ${opts.showSource ? `<p class="b-source-line">来源：${html(sourceWithQuestionNo(q))}</p>` : ''}
            <p class="b-question-line"><span class="b-question-no">${index + 1}.</span>${meta} ${formulaForHtml(questionText)}</p>
            ${extras}
            ${optionGrid}
            ${opts.showTags && q.knowledgePoints?.length ? `<p class="b-mini-note">知识点：${q.knowledgePoints.map(html).join('、')}</p>` : ''}
            ${opts.mode === 'teacher' ? `<div class="b-teacher-block"><strong>答案：</strong>${formulaForHtml(q.answer || '待补充')}<br><strong>解析：</strong>${formulaForHtml(cleanSolutionForOutput(q.solution) || '待补充')}${solutionImages.map((url, imageIndex) => renderOutputMedia(`<img class="b-question-image" src="${html(imageSrc(url))}" alt="解析图片${imageIndex + 1}">`, q, opts, `解析图片${imageIndex + 1}`)).join('')}</div>` : ''}
            ${answerArea}
            ${opts.type === 'variants' ? '<p class="b-mini-note">变式 1：换数字。　变式 2：换问法。　变式 3：加一步。</p>' : ''}
        </section>`;
    }
    function renderQuestionForMarkdown(q, index, opts = {}) {
        const markdownImage = (label, url) => `![${label}](${imageSrc(url)})`;
        const allImages = questionImages(q);
        const roleItems = normalizedImageItems(q);
        const hasRoles = roleItems.some(item => item.role);
        const hasOptionRoles = roleItems.some(item => /^option-[A-D]$/.test(item.role || ''));
        const tempParsed = parseChoiceStem(stemWithFillBlank(q), []);
        const optionLabels = tempParsed.options.map(option => option.label);
        let stemImages = hasRoles ? imageItemsByRole(q, 'stem') : [];
        let optionImages = hasOptionRoles ? optionLabels.map(label => imageItemsByRole(q, `option-${label}`)[0] || '') : [];
        if (!hasRoles && !hasOptionRoles) {
            if (tempParsed.options.length && allImages.length === tempParsed.options.length) optionImages = allImages;
            else if (tempParsed.options.length && allImages.length > tempParsed.options.length) {
                stemImages = allImages.slice(0, allImages.length - tempParsed.options.length);
                optionImages = allImages.slice(-tempParsed.options.length);
            } else stemImages = allImages;
        }
        const parsed = parseChoiceStem(stemWithFillBlank(q), optionImages);
        if (!parsed.options.length && hasOptionRoles) {
            parsed.options = optionImageEntries(q).map(item => ({ label: item.label, text: '', image: item.image }));
        }
        const metaParts = [opts.showScore ? `${q.score}分` : '', opts.showDifficulty ? q.difficulty : ''].filter(Boolean);
        const meta = metaParts.length ? `（${metaParts.join('｜')}）` : '';
        if (opts.mode === 'answerOnly') {
            const lines = [`${index + 1}. 答案：${q.answer || '待补充'}`, `解析：${cleanSolutionForOutput(q.solution) || '待补充'}`];
            imageItemsByRole(q, 'solution').forEach((url, imageIndex) => lines.push(markdownImage(`解析图${imageIndex + 1}`, url)));
            if (opts.showSource) lines.unshift(`来源：${sourceWithQuestionNo(q)}`);
            return lines.join('\n');
        }
        const lines = [`${index + 1}.${meta}${parsed.options.length ? parsed.intro : stemWithFillBlank(q)}`];
        stemImages.forEach((url, imageIndex) => lines.push(markdownImage(`题干图${imageIndex + 1}`, url)));
        if (parsed.options.length) {
            parsed.options.forEach(option => {
                lines.push(`${option.label}. ${option.text}`);
                if (option.image) lines.push(markdownImage(`${option.label}图`, option.image));
            });
        }
        if (q.formulaLatex) lines.push(`公式：${q.formulaLatex}`);
        if (q.diagramSvg && !allImages.length) lines.push('[含 SVG 图形：请查看 HTML 或打印版]');
        if (opts.showTags && q.knowledgePoints?.length) lines.push(`知识点：${q.knowledgePoints.join('、')}`);
        if (opts.showSource) lines.unshift(`来源：${sourceWithQuestionNo(q)}`);
        if (opts.mode === 'teacher') {
            lines.push(`答案：${q.answer || '待补充'}`, `解析：${cleanSolutionForOutput(q.solution) || '待补充'}`);
            imageItemsByRole(q, 'solution').forEach((url, imageIndex) => lines.push(markdownImage(`解析图${imageIndex + 1}`, url)));
            if (q.commonMistakes) lines.push(`易错点：${q.commonMistakes}`);
        }
        if (opts.mode === 'student' && answerAreaConfig(q, opts).enabled) {
            const config = answerAreaConfig(q, opts);
            lines.push(config.style === 'underline' ? '答：________' : Array.from({ length: Math.max(1, Number(config.rows || 6)) }, () => '____________________________').join('\n'));
        }
        return lines.filter(Boolean).join('\n');
    }
    function draftInsertPopover(index) {
        if (state.activeInsertMenuIndex !== index) return '';
        return `<div class="b-insert-popover" onclick="event.stopPropagation()">
            <button onclick="B.insertDraftHeading('before')">标题</button>
            <button onclick="B.insertDraftText('before')">说明</button>
            <button onclick="B.insertDraftTable('before')">表格</button>
            <button onclick="B.insertDraftImage('before')">图片</button>
        </div>`;
    }
    function buildPreviewHtml() {
        const items = draftItems();
        const title = draftTitle();
        const mode = value('bOutputMode') || 'student';
        const type = value('bOutputType') || 'paper';
        const opts = outputOptions();
        const questions = draftQuestions();
        const totalScore = questions.reduce((s, q) => s + Number(q.score || 0), 0);
        let questionIndex = 0;
        let pageNumber = 1;
        const body = items.map((item, itemIndex) => {
            if (mode === 'answerOnly' && ['pageBreak', 'blank'].includes(item.type)) return '';
            if (isDraftItemHiddenInEditor(itemIndex)) return '';
            const addButton = `<button class="b-paper-add ${state.activeInsertMenuIndex === itemIndex ? 'active' : ''}" title="在此上方插入" onclick="event.stopPropagation();B.insertDraftMenu(${itemIndex})">+</button>${draftInsertPopover(itemIndex)}`;
            const itemTools = `<button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button>${draftInlineTools(itemIndex, item.type === 'question' ? 'question' : 'item')}<button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移出</button>`;
            const tools = `<div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftQuestion(${itemIndex})">临时编辑</button>${itemTools}</div>`;
            if (item.type === 'heading') {
                return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<div class="b-heading-row"><h2 class="b-paper-section-title b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftHeadingInline(${itemIndex}, this.textContent)" onblur="B.updateDraftHeadingFromInline(${itemIndex}, this.textContent)">${html(item.title)}</h2></div><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftHeading(${itemIndex})">编辑</button>${itemTools}</div></div>`;
            }
            if (item.type === 'text') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<p class="b-handout-note b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftTextInline(${itemIndex}, this.innerText)" onblur="B.updateDraftTextFromInline(${itemIndex}, this.innerText)">${formulaForHtml(item.text || '')}</p><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftText(${itemIndex})">编辑</button>${itemTools}</div></div>`;
            if (item.type === 'pageBreak') {
                pageNumber += 1;
                return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<div class="b-page-break-line" data-next-page="${pageNumber}">固定分页：第 ${pageNumber} 页开始</div><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            }
            if (item.type === 'blank') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<div class="b-draft-blank" style="height:${Math.max(24, Number(item.rows || 4) * 18)}px">${Number(item.rows || 4)} 行空白</div><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.setDraftBlankRows(${itemIndex})">设置</button>${itemTools}</div></div>`;
            if (item.type === 'table') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<table class="b-draft-table"><caption>${html(item.title || '')}</caption>${(item.rows || []).map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</table><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftTable(${itemIndex})">编辑</button>${itemTools}</div></div>`;
            if (item.type === 'image') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}<img class="b-question-image" src="${html(imageSrc(item.url))}" alt="${html(item.caption || '本卷图片')}">${item.caption ? `<p class="b-mini-note">${html(item.caption)}</p>` : ''}<div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftImage(${itemIndex})">编辑</button>${itemTools}</div></div>`;
            const htmlBlock = renderQuestionForOutput(item.question, questionIndex, { ...opts, mode, type, draftItem: item, draftIndex: itemIndex, interactive: true });
            questionIndex += 1;
            return `<div class="b-paper-item ${imageSizeClass(item.question)}" id="bPaperItem-${itemIndex}" onclick="B.scrollDraftItem(${itemIndex})">${addButton}${htmlBlock}${tools}</div>`;
        }).join('');
        const defaultMeta = mode === 'answerOnly' ? '答案版' : `姓名：__________　班级：__________　得分：__________${opts.showScore ? `　总分：${totalScore} 分` : ''}`;
        const meta = state.paperMetaText || defaultMeta;
        const metaHtml = state.paperMetaHidden ? '' : `<div class="b-paper-meta-row" id="bPaperMetaRow"><p class="b-paper-meta b-editable" contenteditable="true" spellcheck="false" onblur="B.updatePaperMetaFromInline(this.textContent)">${html(meta)}</p><button class="b-btn small" onclick="B.hidePaperMeta()">删除</button></div>`;
        const intro = '';
        return `<h1 id="bPaperItem--1" class="b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftTitleInline(this.textContent)" onblur="B.updateDraftTitleFromInline(this.textContent)" title="直接修改标题">${html(title)}</h1>${metaHtml}${intro}<div class="b-paper-questions">${body}</div><div class="b-page-footer">第 1 页 / 预览分页</div>`;
    }
    function clearAutoPageGuides() {
        document.querySelectorAll('.b-auto-page-break-line').forEach(el => el.remove());
    }
    function queueAutoPageGuides() {
        clearTimeout(window._bAutoPageTimer);
        window._bAutoPageTimer = setTimeout(renderAutoPageGuides, 180);
    }
    function renderAutoPageGuides() {
        const output = $('bOutput');
        if (!output || (value('bOutputMode') || 'student') === 'answerOnly') return clearAutoPageGuides();
        clearAutoPageGuides();
        const items = [...output.querySelectorAll('.b-paper-item')];
        if (!items.length) return;
        const style = getComputedStyle(output);
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const paperHeight = Math.max(880, output.clientWidth * 1.414);
        const contentPageHeight = Math.max(760, paperHeight - paddingTop - paddingBottom);
        let page = 1;
        let nextLimit = paddingTop + contentPageHeight;
        const breaks = [];
        items.forEach(item => {
            const manualLine = item.querySelector('.b-page-break-line');
            if (manualLine) {
                const manualPage = Number(manualLine.dataset.nextPage || 0);
                page = Number.isFinite(manualPage) && manualPage > page ? manualPage : page + 1;
                nextLimit = item.offsetTop + contentPageHeight;
                return;
            }
            const bottom = item.offsetTop + item.offsetHeight;
            if (bottom > nextLimit) {
                page += 1;
                breaks.push({ before: item, page });
                nextLimit += contentPageHeight;
                while (bottom > nextLimit) {
                    page += 1;
                    nextLimit += contentPageHeight;
                }
            }
        });
        breaks.forEach(({ before, page }) => {
            const line = document.createElement('div');
            line.className = 'b-auto-page-break-line';
            line.dataset.label = `自动分页：第 ${page} 页开始`;
            before.parentNode?.insertBefore(line, before);
        });
    }
    function generateOutput() {
        if (!basketItems().length && !state.paperDraft.length) return toast('请先加入题篮');
        const el = $('bOutput');
        el.dataset.markdown = buildMarkdown();
        el.innerHTML = buildPreviewHtml();
        syncPaperMetaButton();
        syncLeftExportSettings();
        queueMathTypeset(el);
        queueAutoPageGuides();
    }
    function refreshOutput() {
        const el = $('bOutput');
        if (!el) return;
        if (!basketItems().length && !state.paperDraft.length) {
            el.dataset.markdown = '';
            el.innerHTML = '先把题目加入题篮，预览会自动生成。';
            clearAutoPageGuides();
            syncPaperMetaButton();
            syncLeftExportSettings();
            return;
        }
        if (basketItems().length) ensurePaperDraftFromBasket();
        renderPaperDraft();
        generateOutput();
    }
    function copyMarkdown() {
        const text = $('bOutput').dataset.markdown || $('bOutput').textContent || '';
        if (!text || text.includes('先把题目')) return toast('暂无可复制内容');
        copyText(text, '已复制 Markdown');
    }
    function copyPlain() {
        const text = ($('bOutput').dataset.markdown || $('bOutput').textContent || '').replace(/^#+\s*/gm, '').replace(/^- /gm, '').trim();
        if (!text || text.includes('先把题目')) return toast('暂无可复制内容');
        copyText(text, '已复制纯文本');
    }
    function formulaForHtml(text) {
        return textWithMath(text);
    }
    function formulaForDocxText(text) {
        const superscripts = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ' };
        function sup(value) {
            return String(value || '').split('').map(ch => superscripts[ch] || ch).join('');
        }
        return String(text || '')
            .replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, a, b) => `(${formulaForDocxText(a)})/(${formulaForDocxText(b)})`)
            .replace(/\\(?:dfrac|tfrac|frac)\s*\(([^()]+)\)\s*\(([^()]+)\)/g, (_, a, b) => `(${formulaForDocxText(a)})/(${formulaForDocxText(b)})`)
            .replace(/\\sqrt(?:\[[^\]]+\])?\s*\{([^{}]+)\}/g, (_, a) => `√(${formulaForDocxText(a)})`)
            .replace(/\\sqrt\s*\(([^()]+)\)/g, (_, a) => `√(${formulaForDocxText(a)})`)
            .replace(/\\sqrt\s+([A-Za-z0-9.]+)/g, '√($1)')
            .replace(/([A-Za-z0-9)])\^\{([0-9+\-n]+)\}/g, (_, base, exp) => `${base}${sup(exp)}`)
            .replace(/([A-Za-z0-9)])\^([0-9n])/g, (_, base, exp) => `${base}${sup(exp)}`)
            .replace(/√\(([^()\s]+)\)/g, '√$1')
            .replace(/\\times/g, '×')
            .replace(/\\cdot/g, '·')
            .replace(/\\div/g, '÷')
            .replace(/\\leq?/g, '≤')
            .replace(/\\geq?/g, '≥')
            .replace(/\\pi/g, 'π')
            .replace(/\\angle/g, '∠')
            .replace(/\\triangle/g, '△')
            .replace(/\\parallel/g, '∥')
            .replace(/\\perp/g, '⊥')
            .replace(/\\circ/g, '°')
            .replace(/([0-9])\^°/g, '$1°')
            .replace(/\\left|\\right/g, '')
            .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
            .replace(/\\([A-Za-z]+)/g, '$1')
            .replace(/[{}]/g, '');
    }
    function xml(v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    function docxRun(text, opts = {}) {
        const props = ['<w:rFonts w:ascii="Cambria Math" w:eastAsia="SimSun" w:hAnsi="Cambria Math"/>', opts.bold ? '<w:b/>' : '', opts.size ? `<w:sz w:val="${opts.size}"/>` : '', opts.color ? `<w:color w:val="${opts.color}"/>` : ''].join('');
        return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
    }
    function docxParagraph(text = '', opts = {}) {
        const align = opts.align ? `<w:jc w:val="${opts.align}"/>` : '';
        const spacing = `<w:spacing w:after="${opts.after ?? 80}" w:line="${opts.line ?? 300}" w:lineRule="auto"/>`;
        const pPr = `<w:pPr>${align}${spacing}${opts.keep ? '<w:keepNext/>' : ''}</w:pPr>`;
        const lines = String(text || '').split(/\n/);
        const runs = lines.map((line, index) => `${index ? '<w:r><w:br/></w:r>' : ''}${docxRun(line, opts)}`).join('');
        return `<w:p>${pPr}${runs || docxRun('', opts)}</w:p>`;
    }
    function docxImage(relId, label = '图片', width = 360, height = 180) {
        const cx = Math.round(width * 9525);
        const cy = Math.round(height * 9525);
        return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${relId.replace(/\D/g, '') || 1}" name="${xml(label)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${xml(label)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    function dataUrlToBytes(dataUrl) {
        const match = String(dataUrl || '').match(/^data:([^;,]+)?((?:;[^,]+)*),(.*)$/);
        if (!match) return null;
        const mime = match[1] || 'application/octet-stream';
        const meta = match[2] || '';
        const encoded = match[3] || '';
        let bytes;
        if (/;base64/i.test(meta)) {
            const binary = atob(encoded);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        } else {
            bytes = new TextEncoder().encode(decodeURIComponent(encoded));
        }
        return { bytes, mime };
    }
    function imageExtFromMime(mime = '', fallback = '.png') {
        if (/svg/i.test(mime)) return '.svg';
        if (/jpe?g/i.test(mime)) return '.jpg';
        if (/webp/i.test(mime)) return '.webp';
        if (/gif/i.test(mime)) return '.gif';
        if (/png/i.test(mime)) return '.png';
        return fallback;
    }
    async function docxImageAsset(url, media, rels, label, size = {}) {
        const src = imageSrc(url);
        if (!src) return '';
        const fallback = () => docxParagraph(`${label || '图片'}未能嵌入：${src}`, { size: 18, color: '667085', after: 40 });
        let bytes = null;
        let mime = '';
        let ext = (src.match(/\.(png|jpe?g|gif|webp|svg)(?:[?#]|$)/i)?.[0] || '.png').replace(/[?#].*$/, '');
        if (/^data:/i.test(src)) {
            const parsed = dataUrlToBytes(src);
            if (!parsed) return fallback();
            bytes = parsed.bytes;
            mime = parsed.mime;
            ext = imageExtFromMime(mime, ext);
        } else {
            try {
                const res = await fetch(src);
                if (!res.ok) return fallback();
                const blob = await res.blob();
                bytes = new Uint8Array(await blob.arrayBuffer());
                mime = blob.type || '';
                ext = imageExtFromMime(mime, ext);
            } catch {
                return fallback();
            }
        }
        const index = media.length + 1;
        const fileName = `image${index}${ext.startsWith('.') ? ext : `.${ext}`}`;
        const relId = `rId${index}`;
        media.push({ name: `word/media/${fileName}`, bytes });
        rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/>`);
        return docxImage(relId, label, size.width || 360, size.height || 180);
    }
    function docxOutputImageSize(q = {}, fallback = {}) {
        const size = outputImageSize(q, fallback);
        return {
            width: Math.round(clampNumber(size.width || 360, 80, 560)),
            height: Math.round(clampNumber(size.height || 180, 50, 360))
        };
    }
    async function docxQuestionXml(q, index, opts, media, rels) {
        const allImages = questionImages(q);
        const roleItems = normalizedImageItems(q);
        const hasRoles = roleItems.some(item => item.role);
        const hasOptionRoles = roleItems.some(item => /^option-[A-D]$/.test(item.role || ''));
        const tempParsed = parseChoiceStem(stemWithFillBlank(q), []);
        const optionLabels = tempParsed.options.map(option => option.label);
        let stemImages = hasRoles ? imageItemsByRole(q, 'stem') : [];
        let optionImages = hasOptionRoles ? optionLabels.map(label => imageItemsByRole(q, `option-${label}`)[0] || '') : [];
        if (!hasRoles && !hasOptionRoles) {
            if (tempParsed.options.length && allImages.length === tempParsed.options.length) optionImages = allImages;
            else if (tempParsed.options.length && allImages.length > tempParsed.options.length) {
                stemImages = allImages.slice(0, allImages.length - tempParsed.options.length);
                optionImages = allImages.slice(-tempParsed.options.length);
            } else stemImages = allImages;
        }
        const parsed = parseChoiceStem(stemWithFillBlank(q), optionImages);
        if (!parsed.options.length && hasOptionRoles) {
            parsed.options = optionImageEntries(q).map(item => ({ label: item.label, text: '', image: item.image }));
        }
        const diagramData = q.diagramSvg ? svgData(q.diagramSvg) : '';
        const metaParts = [opts.showScore ? `${q.score}分` : '', opts.showDifficulty ? q.difficulty : ''].filter(Boolean);
        const parts = [];
        if (opts.showSource) parts.push(docxParagraph(`来源：${sourceWithQuestionNo(q)}`, { size: 18, color: '667085', after: 30 }));
        if (opts.mode === 'answerOnly') {
            parts.push(docxParagraph(`${index + 1}. 答案：${formulaForDocxText(q.answer || '待补充')}`, { after: 40 }));
            parts.push(docxParagraph(`解析：${formulaForDocxText(cleanSolutionForOutput(q.solution) || '待补充')}`, { after: 50 }));
            const answerImages = imageItemsByRole(q, 'solution');
            for (let i = 0; i < answerImages.length; i += 1) parts.push(await docxImageAsset(answerImages[i], media, rels, `解析图${i + 1}`, docxOutputImageSize(q, { width: 190, height: 95 })));
            return parts.join('');
        }
        parts.push(docxParagraph(`${index + 1}. ${metaParts.length ? `（${metaParts.join('｜')}）` : ''}${formulaForDocxText(parsed.options.length ? parsed.intro : stemWithFillBlank(q))}`, { after: 60 }));
        if (diagramData) parts.push(await docxImageAsset(diagramData, media, rels, 'SVG 图形', docxOutputImageSize(q)));
        for (let i = 0; i < stemImages.length; i += 1) parts.push(await docxImageAsset(stemImages[i], media, rels, `题干图${i + 1}`, docxOutputImageSize(q)));
        if (parsed.options.length) {
            const cells = [];
            for (const option of parsed.options) {
                const cellParts = [docxParagraph(`${option.label}. ${formulaForDocxText(option.text)}`, { after: 20 })];
                if (option.image) cellParts.push(await docxImageAsset(option.image, media, rels, `选项${option.label}图片`, docxOutputImageSize(q, { width: 120, height: 70 })));
                cells.push(`<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${cellParts.join('')}</w:tc>`);
            }
            const rows = [];
            for (let i = 0; i < cells.length; i += 2) rows.push(`<w:tr>${cells[i]}${cells[i + 1] || '<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p/></w:tc>'}</w:tr>`);
            parts.push(`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${rows.join('')}</w:tbl>`);
        }
        if (opts.showTags && q.knowledgePoints?.length) parts.push(docxParagraph(`知识点：${q.knowledgePoints.join('、')}`, { size: 18, color: '667085', after: 30 }));
        if (opts.mode === 'teacher') {
            parts.push(docxParagraph(`答案：${formulaForDocxText(q.answer || '待补充')}\n解析：${formulaForDocxText(cleanSolutionForOutput(q.solution) || '待补充')}`, { after: 50 }));
            const solutionImages = imageItemsByRole(q, 'solution');
            for (let i = 0; i < solutionImages.length; i += 1) parts.push(await docxImageAsset(solutionImages[i], media, rels, `解析图${i + 1}`, docxOutputImageSize(q, { width: 190, height: 95 })));
        }
        if (opts.mode === 'student') {
            const config = answerAreaConfig(q, opts);
            if (config.enabled) {
                if (config.style === 'underline') parts.push(docxParagraph('答：________________', { after: 70 }));
                else if (config.style === 'blank') parts.push(docxParagraph(Array.from({ length: Math.max(2, Number(config.rows || 4)) }, () => ' ').join('\n'), { after: 80, line: 360 }));
                else parts.push(docxParagraph(Array.from({ length: Math.max(1, Number(config.rows || 6)) }, () => '________________________________________').join('\n'), { after: 80, line: 360 }));
            }
        }
        return parts.join('');
    }
    function crc32(bytes) {
        let table = window._bCrcTable;
        if (!table) {
            table = window._bCrcTable = Array.from({ length: 256 }, (_, n) => {
                let c = n;
                for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
                return c >>> 0;
            });
        }
        let crc = -1;
        bytes.forEach(byte => { crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]; });
        return (crc ^ -1) >>> 0;
    }
    function zipStore(files) {
        const encoder = new TextEncoder();
        const chunks = [];
        const central = [];
        let offset = 0;
        function u16(n) { return [n & 255, (n >>> 8) & 255]; }
        function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
        function concatBytes(parts) {
            const total = parts.reduce((sum, part) => sum + part.length, 0);
            const out = new Uint8Array(total);
            let cursor = 0;
            parts.forEach(part => {
                out.set(part, cursor);
                cursor += part.length;
            });
            return out;
        }
        files.forEach(file => {
            const nameBytes = encoder.encode(file.name);
            const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.bytes;
            const crc = crc32(data);
            const localHeader = new Uint8Array([0x50,0x4b,0x03,0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)]);
            const local = concatBytes([localHeader, nameBytes, data]);
            chunks.push(local);
            central.push({ nameBytes, crc, size: data.length, offset });
            offset += local.length;
        });
        const centralStart = offset;
        central.forEach(entry => {
            const centralHeader = new Uint8Array([0x50,0x4b,0x01,0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(entry.crc), ...u32(entry.size), ...u32(entry.size), ...u16(entry.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(entry.offset)]);
            const chunk = concatBytes([centralHeader, entry.nameBytes]);
            chunks.push(chunk);
            offset += chunk.length;
        });
        const centralSize = offset - centralStart;
        chunks.push(new Uint8Array([0x50,0x4b,0x05,0x06, ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(centralSize), ...u32(centralStart), ...u16(0)]));
        return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
    async function buildDocxBlob() {
        const items = draftItems();
        const title = draftTitle();
        const mode = value('bOutputMode') || 'student';
        const opts = outputOptions();
        const questions = draftQuestions();
        const totalScore = questions.reduce((s, q) => s + Number(q.score || 0), 0);
        const media = [];
        const rels = [];
        const body = [docxParagraph(title, { align: 'center', bold: true, size: 32, after: 80 })];
        const defaultMeta = mode === 'answerOnly' ? '答案版' : `姓名：__________    总分：${totalScore} 分`;
        if (!state.paperMetaHidden) body.push(docxParagraph(state.paperMetaText || defaultMeta, { align: 'center', size: 20, color: '667085', after: 160 }));
        let questionIndex = 0;
        for (const item of items) {
            if (item.type === 'heading') {
                body.push(docxParagraph(item.title, { bold: true, size: 26, after: 80, keep: true }));
            } else if (item.type === 'text') {
                body.push(docxParagraph(formulaForDocxText(item.text || ''), { after: 80 }));
            } else if (item.type === 'pageBreak') {
                if (mode !== 'answerOnly') body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
            } else if (item.type === 'blank') {
                if (mode !== 'answerOnly') body.push(docxParagraph(Array.from({ length: Math.max(1, Number(item.rows || 4)) }, () => ' ').join('\n'), { after: 80, line: 360 }));
            } else if (item.type === 'table') {
                body.push(docxParagraph(item.title || '表格', { bold: true, after: 40 }));
                const rows = (item.rows || []).map(row => `<w:tr>${row.map(cell => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${docxParagraph(cell, { after: 20 })}</w:tc>`).join('')}</w:tr>`).join('');
                body.push(`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/></w:tblBorders></w:tblPr>${rows}</w:tbl>`);
            } else if (item.type === 'image') {
                body.push(await docxImageAsset(item.url, media, rels, item.caption || '本卷图片'));
                if (item.caption) body.push(docxParagraph(item.caption, { size: 18, color: '667085', after: 60 }));
            } else {
                body.push(await docxQuestionXml(item.question, questionIndex, { ...opts, mode, draftItem: item }, media, rels));
                questionIndex += 1;
            }
        }
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="737" w:right="794" w:bottom="737" w:left="794" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`;
        const files = [
            { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
            { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
            { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` },
            { name: 'word/document.xml', data: documentXml },
            ...media
        ];
        return zipStore(files);
    }
    function svgData(svg) {
        const clean = sanitizeSvg(svg);
        return /^<svg[\s>]/i.test(clean) ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}` : '';
    }
    function buildHtmlDoc() {
        const items = draftItems();
        const title = draftTitle();
        const mode = value('bOutputMode') || 'student';
        const type = value('bOutputType') || 'paper';
        const opts = outputOptions();
        const questions = draftQuestions();
        const totalScore = questions.reduce((s, q) => s + Number(q.score || 0), 0);
        let questionIndex = 0;
        const body = items.map(item => {
            if (mode === 'answerOnly' && ['pageBreak', 'blank'].includes(item.type)) return '';
            if (item.type === 'heading') return `<h2 class="b-paper-section-title">${html(item.title)}</h2>`;
            if (item.type === 'text') return `<p class="b-handout-note">${formulaForHtml(item.text || '')}</p>`;
            if (item.type === 'pageBreak') return '<div class="b-page-break-line" style="break-after:page;page-break-after:always;"></div>';
            if (item.type === 'blank') return `<div class="b-draft-blank" style="height:${Math.max(24, Number(item.rows || 4) * 18)}px"></div>`;
            if (item.type === 'table') return `<table class="b-draft-table"><caption>${html(item.title || '')}</caption>${(item.rows || []).map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</table>`;
            if (item.type === 'image') return `<img class="b-question-image" src="${html(imageSrc(item.url))}" alt="${html(item.caption || '本卷图片')}">${item.caption ? `<p class="b-mini-note">${html(item.caption)}</p>` : ''}`;
            const block = renderQuestionForOutput(item.question, questionIndex, { ...opts, mode, type, draftItem: item });
            questionIndex += 1;
            return block;
        }).join('\n');
        const defaultMeta = mode === 'answerOnly' ? '答案版' : `姓名：__________　班级：__________　得分：__________${opts.showScore ? `　总分：${totalScore} 分` : ''}`;
        const metaHtml = state.paperMetaHidden ? '' : `<p class="b-paper-meta">${html(state.paperMetaText || defaultMeta)}</p>`;
        return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${html(title)}</title><script>window.MathJax={tex:{inlineMath:[['\\\\(','\\\\)'],['$','$']],displayMath:[['\\\\[','\\\\]']],processEscapes:true},svg:{fontCache:'global'}};<\/script><script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script><style>@page{size:${opts.paperSize};margin:13mm 14mm}body{font-family:"Times New Roman","SimSun",serif;color:#111827;line-height:1.48;font-size:${opts.paperFontSize}pt}h1{text-align:center;margin:0 0 7pt;font-size:18pt}.b-paper-meta{text-align:center;color:#667085;font-size:9.5pt;margin:0 0 10pt}.b-paper-section-title{font-size:13pt;margin:8pt 0 4pt}.b-handout-note{margin:4pt 0 7pt;white-space:pre-wrap}.b-preview-question{${opts.keepQuestionTogether ? 'break-inside:avoid;' : ''}margin:5pt 0 7pt}.b-question-line{margin:0;line-height:1.5}.b-question-no{font-weight:800;margin-right:3pt}.b-question-meta{color:#667085;font-size:9pt;margin-right:4pt}.b-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2pt 8pt;margin:3pt 0 2pt 18pt}.b-option-item{border:0;padding:1pt;min-height:18pt}.b-option-label{font-weight:800;margin-right:4pt}.b-img-size-small{--question-image-height:90pt;--question-image-width:160pt}.b-img-size-medium{--question-image-height:150pt;--question-image-width:260pt}.b-img-size-large{--question-image-height:220pt;--question-image-width:380pt}.b-resizable-figure{display:inline-block;max-width:100%;vertical-align:top;margin-top:4pt}.b-resizable-figure .b-question-image,.b-resizable-figure .b-diagram{width:100%;height:100%;max-width:none;max-height:none}.b-resizable-figure .b-diagram svg{width:100%;height:100%;max-width:none;max-height:none}.b-question-image,img{max-width:min(100%,var(--question-image-width,260pt));max-height:var(--question-image-height,150pt);object-fit:contain}.b-option-item img{display:block;margin-top:2pt;max-height:105pt}.b-mini-note,.source,.tags,.b-source-line{font-size:8.5pt;color:#667085;margin:2pt 0}.b-teacher-block{margin:4pt 0 0 18pt}.b-box{border:1px dashed #cbd5e1;padding:6pt}.b-answer-area{margin:4pt 0 4pt 18pt}.b-answer-lines{display:grid;gap:8pt;padding-top:3pt}.b-answer-line{border-bottom:1px solid #cbd5e1;height:14pt}.b-answer-blank{border:0;border-radius:0;background:transparent}.b-draft-blank{height:72px}.b-fill-underline{display:inline-block;min-width:86pt;border-bottom:1px solid #111827;height:1em}.b-page-break-line{break-after:page;page-break-after:always}.b-draft-table{width:100%;border-collapse:collapse;margin:5pt 0}.b-draft-table td{border:1px solid #cbd5e1;padding:5pt}.b-draft-table caption{text-align:left;font-weight:700;margin-bottom:3pt}mjx-container{max-width:none;overflow:visible}</style></head><body><h1>${html(title)}</h1>${metaHtml}${body}</body></html>`;
    }
    function download(name, type, content) {
        const blob = new Blob([content], { type });
        downloadBlob(name, blob);
    }
    function downloadBlob(name, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function downloadMd() {
        if (!basketItems().length) return toast('请先加入题篮');
        download(`${safeFile(value('bOutputTitle') || '数学题库输出')}.md`, 'text/markdown;charset=utf-8', buildMarkdown());
    }
    function downloadHtml() {
        if (!basketItems().length) return toast('请先加入题篮');
        downloadHtmlWithEmbeddedImages().catch(error => {
            toast(error?.message || 'HTML 生成失败');
        });
    }
    async function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    async function embedHtmlImages(htmlDoc) {
        const srcs = [...new Set(Array.from(htmlDoc.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)).map(match => match[1]).filter(src => /^https?:|^file:|^blob:/i.test(src)))];
        if (!srcs.length) return htmlDoc;
        const replacements = new Map();
        await Promise.all(srcs.map(async src => {
            try {
                const res = await fetch(src);
                if (!res.ok) return;
                replacements.set(src, await blobToDataUrl(await res.blob()));
            } catch {
                // Keep the original link if the image cannot be fetched.
            }
        }));
        let next = htmlDoc;
        replacements.forEach((dataUrl, src) => {
            next = next.split(`src="${src}"`).join(`src="${dataUrl}"`);
        });
        return next;
    }
    async function downloadHtmlWithEmbeddedImages() {
        if (!basketItems().length) return toast('请先加入题篮');
        toast('正在生成 HTML...');
        download(`${safeFile(value('bOutputTitle') || '数学题库输出')}.html`, 'text/html;charset=utf-8', await embedHtmlImages(buildHtmlDoc()));
        toast('已生成 HTML');
    }
    async function downloadWord() {
        if (!basketItems().length) return toast('请先加入题篮');
        try {
            toast('正在生成 Word DOCX...');
            downloadBlob(`${safeFile(value('bOutputTitle') || '数学题库输出')}.docx`, await buildDocxBlob());
            toast('已生成 Word DOCX');
        } catch (error) {
            toast(error?.message || 'Word 生成失败，请检查图片或公式');
        }
    }
    function safeFile(name) {
        return String(name || '数学题库输出').replace(/[\\\\/:*?"<>|]/g, '_').slice(0, 80);
    }
    function printPdf() {
        if (!basketItems().length) return toast('请先加入题篮');
        const w = window.open('', '_blank');
        if (!w) return toast('浏览器阻止了打印窗口');
        w.document.open();
        w.document.write(buildHtmlDoc());
        w.document.close();
        setTimeout(() => w.print(), 250);
    }
    function qualityFlags(q) {
        const flags = [];
        if (!q.answer) flags.push('缺答案');
        if (!q.solution) flags.push('缺解析');
        if (!(q.knowledgePoints || []).length) flags.push('缺知识点');
        if (!hasSourceInfo(q)) flags.push('缺来源');
        if (hasMultipleQuestionStarts(q.stem)) flags.push('疑似合并多题');
        if (/[□�]/.test([q.stem, q.formulaLatex, q.solution].join(' '))) flags.push('疑似公式损坏');
        if (/如图|图中|下图/.test(q.stem || '') && !questionHasImage(q)) flags.push('含图但无附件');
        return flags;
    }
    function renderQuality() {
        const checks = ['缺答案', '缺解析', '缺知识点', '缺来源', '疑似合并多题', '疑似公式损坏', '含图但无附件', '疑似重复题'];
        const activeQuestions = state.questions.filter(q => q.status !== 'archived');
        const dupes = findDuplicates(activeQuestions);
        const latest = state.lastImportSummary;
        const importReport = latest ? `<article class="b-doc"><h3>本次导入质量报告 <span class="b-tag blue">${html((latest.createdAt || '').slice(0, 10))}</span></h3>
            <p>${html(latest.sourceTitle || '未命名资料')}：候选 ${html(latest.candidateCount)} 题，AI 成功 ${html(latest.aiSuccess)}，规则兜底 ${html(latest.localFallback)}，缺答案 ${html(latest.missingAnswer)}，缺解析 ${html(latest.missingSolution)}。</p>
            ${(latest.warnings || []).length ? `<div class="b-tags">${latest.warnings.map(w => `<span class="b-tag orange">${html(w)}</span>`).join('')}</div>` : '<p>暂无批次级警告。</p>'}
        </article>` : '';
        $('bQuality').innerHTML = importReport + checks.map(flag => {
            const items = flag === '疑似重复题' ? dupes : activeQuestions.filter(q => qualityFlags(q).includes(flag));
            const actions = items.length ? `<div class="b-actions" style="justify-content:flex-start;margin:6px 0;">
                <button class="b-btn small primary" onclick="B.locateQuestion('${items[0].id}')">定位第一题</button>
                ${flag === '缺知识点' ? '<button class="b-btn small" onclick="B.autoFillMissingKnowledge()">按章节补知识点</button>' : ''}
                ${flag === '缺来源' ? '<button class="b-btn small" onclick="B.autoFillMissingSource()">按导入信息补来源</button>' : ''}
            </div>` : '';
            return `<article class="b-doc"><h3>${html(flag)} <span class="b-tag ${items.length ? 'red' : 'green'}">${items.length}</span></h3><p>${items.length ? '点击题号可跳到正式题库定位。' : '暂无问题。'}</p>${actions}<div class="b-quality-list">${items.map(q => `<button class="b-quality-item" onclick="B.locateQuestion('${q.id}')">${html(q.internalNo || q.id)} · ${html(q.chapter || '未标章节')} · ${html(q.stem).slice(0, 46)}${q.stem.length > 46 ? '...' : ''}</button>`).join('')}</div></article>`;
        }).join('');
    }
    function autoFillMissingKnowledge() {
        let count = 0;
        state.questions.forEach(q => {
            if (q.status === 'archived' || (q.knowledgePoints || []).length) return;
            q.knowledgePoints = [q.chapter || q.questionType || '待复核知识点'];
            count += 1;
        });
        save();
        renderAll();
        toast(`已补 ${count} 道题的知识点，建议复核`);
    }
    function autoFillMissingSource() {
        let count = 0;
        state.questions.forEach(q => {
            if (q.status === 'archived' || hasSourceInfo(q)) return;
            q.sourceName = q.sourceName || '数学题库自建题';
            q.source = { ...(q.source || {}), sourceType: q.source?.sourceType || '自建题' };
            count += 1;
        });
        save();
        renderAll();
        toast(`已补 ${count} 道题的来源标签，建议复核`);
    }
    function resetBankFilters() {
        ['bFilterGrade', 'bFilterYear', 'bFilterChapter', 'bFilterType', 'bFilterDifficulty'].forEach(idName => {
            const el = $(idName);
            if (el) el.value = '';
        });
        ['bFilterFormula', 'bFilterDiagram'].forEach(idName => {
            const el = $(idName);
            if (el) el.checked = false;
        });
        if ($('bFilterSearch')) $('bFilterSearch').value = '';
    }
    function locateQuestion(questionId) {
        const q = state.questions.find(item => item.id === questionId);
        if (!q) return toast('没有找到这道题');
        state.highlightedQuestionId = questionId;
        switchView('bank');
        setTimeout(() => {
            resetBankFilters();
            if ($('bFilterSearch')) $('bFilterSearch').value = q.internalNo || q.stem.slice(0, 16);
            renderBank();
            setTimeout(() => {
                const card = $(`bqCard-${questionId}`);
                if (card) {
                    card.querySelectorAll('details.b-fold').forEach(detail => { detail.open = true; });
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 0);
        }, 0);
    }
    function findDuplicates(items = state.questions) {
        const map = new Map();
        const out = [];
        items.forEach(q => {
            const key = String(q.stem || '').replace(/\s+/g, '').slice(0, 50);
            if (key.length > 18 && map.has(key)) out.push(q);
            else map.set(key, q.id);
        });
        return out;
    }
    function openQuestionEditor(questionId = '') {
        const q = questionId ? state.questions.find(x => x.id === questionId) : {};
        openModal(questionId ? '编辑正式题' : '新增正式题', `<div class="b-form">
            <div class="b-row three"><div><label>内部编号</label><input id="bEditNo" value="${html(q.internalNo || '')}" placeholder="B-00001"></div><div><label>原试卷题号</label><input id="bEditQuestionNo" value="${html(q.source?.questionNo || '')}"></div><div><label>状态</label><select id="bEditStatus"><option value="active" ${q.status !== 'archived' ? 'selected' : ''}>已启用</option><option value="archived" ${q.status === 'archived' ? 'selected' : ''}>归档</option></select></div></div>
            <div class="b-row three"><div><label>年级</label><select id="bEditGrade">${grades.map(g => `<option ${g === q.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div><div><label>章节</label><input id="bEditChapter" value="${html(q.chapter || '')}"></div><div><label>题型</label><input id="bEditType" value="${html(q.questionType || '')}"></div></div>
            <div class="b-row three"><div><label>难度</label><select id="bEditDifficulty">${difficulties.map(d => `<option ${d === q.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div><label>分值</label><input id="bEditScore" type="number" min="0" step="1" value="${html(q.score || 5)}"></div><div><label>图形大小</label><select id="bEditImageSize"><option value="small" ${q.imageSize === 'small' ? 'selected' : ''}>小</option><option value="medium" ${!q.imageSize || q.imageSize === 'medium' ? 'selected' : ''}>中</option><option value="large" ${q.imageSize === 'large' ? 'selected' : ''}>大</option></select></div></div>
            <div class="b-row three">
                <div><label>题干图</label><input id="bEditStemImage" value="${html(firstImageByRole(q, 'stem') || q.imageUrl || '')}" placeholder="上传或粘贴链接/路径"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditStemImage')"></div>
                <div><label>A 图</label><input id="bEditOptionAImage" value="${html(firstImageByRole(q, 'option-A'))}" placeholder="选项 A 图片"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditOptionAImage')"></div>
                <div><label>B 图</label><input id="bEditOptionBImage" value="${html(firstImageByRole(q, 'option-B'))}" placeholder="选项 B 图片"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditOptionBImage')"></div>
            </div>
            <div class="b-row three">
                <div><label>C 图</label><input id="bEditOptionCImage" value="${html(firstImageByRole(q, 'option-C'))}" placeholder="选项 C 图片"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditOptionCImage')"></div>
                <div><label>D 图</label><input id="bEditOptionDImage" value="${html(firstImageByRole(q, 'option-D'))}" placeholder="选项 D 图片"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditOptionDImage')"></div>
                <div><label>解析图</label><input id="bEditSolutionImage" value="${html(firstImageByRole(q, 'solution'))}" placeholder="教师版解析图片"><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0], 'bEditSolutionImage')"></div>
            </div>
            <input id="bEditImage" type="hidden" value="${html(q.imageUrl || '')}">
            <div><label>上传图片</label><input type="file" accept="image/*" onchange="B.uploadQuestionImage(this.files[0])"></div>
            <div><label>知识点</label><input id="bEditKnowledge" value="${html((q.knowledgePoints || []).join('、'))}"></div>
            <div><label>题干</label><textarea id="bEditStem" rows="5">${html(q.stem || '')}</textarea></div>
            <details class="b-advanced-fields"><summary>高级字段：LaTeX 公式 / SVG 图形</summary>
                <div class="b-mini-note">LaTeX 用于手动补充公式文本；SVG 用于保存可缩放几何图。日常编辑可不填，题干和图片上传才是主要入口。</div>
                <div class="b-row"><div><label>LaTeX 公式</label><textarea id="bEditFormula" rows="3">${html(q.formulaLatex || '')}</textarea></div><div><label>SVG 图形</label><textarea id="bEditSvg" rows="3">${html(q.diagramSvg || '')}</textarea></div></div>
            </details>
            <div class="b-row"><div><label>答案</label><textarea id="bEditAnswer" rows="3">${html(q.answer || '')}</textarea></div><div><label>解析</label><textarea id="bEditSolution" rows="3">${html(q.solution || '')}</textarea></div></div>
            <div class="b-row"><div><label>易错点</label><textarea id="bEditMistake" rows="2">${html(q.commonMistakes || '')}</textarea></div><div><label>来源</label><input id="bEditSource" value="${html(q.sourceName || sourceLabel(q.source))}"></div></div>
            <div class="b-actions"><button class="b-btn" onclick="B.closeModal()">取消</button><button class="b-btn primary" onclick="B.saveQuestion('${questionId}')">保存</button></div>
        </div>`);
    }
    function saveQuestion(questionId = '') {
        const stem = value('bEditStem');
        if (!stem) return toast('题干不能为空');
        const existing = questionId ? state.questions.find(q => q.id === questionId) : null;
        const sourceName = value('bEditSource');
        const q = {
            ...(existing || {}),
            id: questionId || id('bq'),
            internalNo: value('bEditNo') || (existing?.internalNo || nextInternalNo()),
            grade: value('bEditGrade'),
            chapter: value('bEditChapter'),
            questionType: value('bEditType'),
            difficulty: normalizeDifficulty(value('bEditDifficulty')),
            score: Number(value('bEditScore') || existing?.score || 5),
            knowledgePoints: splitList(value('bEditKnowledge')),
            stem,
            formulaLatex: value('bEditFormula'),
            diagramSvg: value('bEditSvg'),
            imageUrl: value('bEditStemImage') || value('bEditImage'),
            images: buildRoleImagesFromEditor(existing || {}),
            imageSize: value('bEditImageSize') || existing?.imageSize || 'medium',
            answer: normalizeAnswerText(value('bEditAnswer')),
            solution: value('bEditSolution'),
            commonMistakes: value('bEditMistake'),
            sourceName,
            source: { ...(existing?.source || { sourceType: '自编' }), examName: sourceName || existing?.source?.examName || '', questionNo: value('bEditQuestionNo') },
            status: value('bEditStatus')
        };
        if (existing) Object.assign(existing, q);
        else state.questions.unshift(q);
        closeModal();
        save();
        renderAll();
        toast('已保存到正式题库');
    }
    function quickFilter(grade = '', chapter = '', diagram = false) {
        switchView('bank');
        setTimeout(() => {
            resetBankFilters();
            if ($('bFilterGrade')) $('bFilterGrade').value = grade;
            if ($('bFilterChapter')) $('bFilterChapter').value = chapter;
            if ($('bFilterDiagram')) $('bFilterDiagram').checked = diagram;
            renderBank();
            toast([grade, chapter, diagram ? '含图题' : ''].filter(Boolean).join(' · ') || '已打开正式题库');
        }, 0);
    }
    function examples() {
        const tri = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 150"><path d="M35 125 L130 25 L225 125 Z" fill="#fff" stroke="#111827" stroke-width="3"/><path d="M130 25 L130 125" stroke="#2364e8" stroke-width="2" stroke-dasharray="5 4"/><text x="25" y="140">A</text><text x="124" y="20">C</text><text x="226" y="140">B</text></svg>';
        const circle = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160"><circle cx="88" cy="82" r="55" fill="#fff" stroke="#111827" stroke-width="3"/><line x1="88" y1="82" x2="143" y2="82" stroke="#2364e8" stroke-width="3"/><text x="100" y="74">60°</text></svg>';
        const base = { source: { sourceType: '自编', year: '2026', region: '深圳', examName: '数学题库内置例题' }, sourceName: '数学题库内置例题', status: 'active', aiNotes: '数学题库初始化例题。' };
        return [
            ['B-DEMO-001', '六年级', '计算', '计算题', '基础', ['分数'], '计算：\\(\\frac{3}{4}+\\frac{5}{6}\\times\\frac{9}{10}-\\frac{1}{3}\\)。', '\\frac{3}{4}+\\frac{5}{6}\\times\\frac{9}{10}-\\frac{1}{3}', '', '7/6', '先算乘法，再通分相加减。'],
            ['B-DEMO-002', '六年级', '应用题', '应用题', '中等', ['比例', '百分数'], '原价 80 元，先降价 20%，再提价 25%，现价是多少？', '80(1-20\\%)(1+25\\%)', '', '80 元', '降价后为 64 元，再提价为 80 元。'],
            ['B-DEMO-003', '初一', '代数', '应用题', '中等', ['一元一次方程'], '某文具店购进一批笔记本，按每本 8 元出售可盈利 120 元，按每本 7 元出售则亏损 30 元。求这批笔记本共有多少本。', '8x-C=120, 7x-C=-30', '', '150 本', '两式相减得 x=150。'],
            ['B-DEMO-004', '初一', '几何', '几何题', '基础', ['三角形面积'], '如图，△ABC 中 AB=12，高为 7，求面积。', 'S=\\frac{1}{2}ah', tri, '42', 'S=1/2×12×7=42。'],
            ['B-DEMO-005', '初一', '几何', '填空题', '提高', ['圆', '扇形'], '如图，半径为 6，圆心角 60°，扇形面积为 ____。', 'S=\\frac{60}{360}\\pi r^2', circle, '6π', 'S=60/360×π×36=6π。'],
            ['B-DEMO-006', '初二', '函数', '选择题', '中等', ['一次函数'], '函数 \\(y=2x+1\\) 经过 P(a,9)，a 的值为（ ）。A.3 B.4 C.5 D.17', 'y=2x+1', '', 'B', '9=2a+1，a=4。'],
            ['B-DEMO-007', '初二', '代数', '计算题', '基础', ['二次根式'], '化简：\\(\\sqrt{50}-2\\sqrt{8}+\\sqrt{18}\\)。', '\\sqrt{50}-2\\sqrt{8}+\\sqrt{18}', '', '4√2', '5√2-4√2+3√2=4√2。'],
            ['B-DEMO-008', '初二', '几何', '证明题', '中等', ['平行线', '角'], '已知 AB ∥ CD，∠1=∠2。求证：BE ∥ DF。', 'AB \\parallel CD, \\angle1=\\angle2', '', '证明见解析', '∵同位角相等，∴两直线平行。'],
            ['B-DEMO-009', '初三', '统计概率', '选择题', '中等', ['概率'], '袋中有 2 个红球、1 个白球，放回摸两次，两次红球概率为（ ）。A.1/9 B.2/9 C.4/9 D.2/3', 'P=\\frac{2}{3}\\times\\frac{2}{3}', '', 'C', '独立事件相乘。'],
            ['B-DEMO-010', '初三', '函数', '综合题', '提高', ['二次函数'], '已知 \\(y=x^2-4x+1\\)。求顶点坐标及 \\(-1\\le x\\le3\\) 的最小值。', 'y=(x-2)^2-3', '', '(2,-3)，最小值 -3', '配方后顶点在区间内。'],
            ['B-DEMO-011', '初三', '代数', '填空题', '提高', ['不等式'], '若 \\(2x-a\\le6\\) 的解集为 \\(x\\le5\\)，则 a=____。', 'x\\le\\frac{a+6}{2}', '', '4', '(a+6)/2=5。'],
            ['B-DEMO-012', '初三', '几何', '综合题', '压轴', ['相似三角形'], '在 △ABC 中，DE ∥ BC，AD:DB=2:1，若 △ADE 面积为 12，求四边形 DBCE 面积。', '\\frac{S_{ADE}}{S_{ABC}}=(\\frac{2}{3})^2', tri, '15', '面积比 4:9，所以 ABC 面积 27，差为 15。']
        ].map(([internalNo, grade, chapter, questionType, difficulty, knowledgePoints, stem, formulaLatex, diagramSvg, answer, solution], idx) => ({ ...base, id: `b-demo-${idx + 1}`, internalNo, grade, system: grade === '六年级' ? '小升初' : '校内', chapter, questionType, difficulty, knowledgePoints, stem, formulaLatex, diagramSvg, answer, solution, commonMistakes: '注意题目条件和符号边界。', errorTags: [], score: difficulty === '压轴' ? 12 : difficulty === '提高' ? 8 : 5 }));
    }
    function commentExamples() {
        const tri = '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150" viewBox="0 0 260 150"><path d="M35 125 L130 25 L225 125 Z" fill="#fff" stroke="#111827" stroke-width="4"/><path d="M130 25 L130 125" stroke="#2364e8" stroke-width="3" stroke-dasharray="8 6"/><text x="25" y="140">A</text><text x="124" y="20">C</text><text x="226" y="140">B</text></svg>';
        const baseSource = {
            sourceType: '批注样例',
            year: '2026',
            grade: '六年级',
            region: '广东深圳',
            districtOrSchool: '本地 file 页面',
            examName: '数学题库批注样例-七类题型',
            note: '用于批注各种题型、公式、图形、答案版和输出排版'
        };
        const sourceName = sourceLabel(baseSource);
        const rows = [
            ['B-COMMENT-001', '1', '代数', '选择题', '中等', 4, ['平方根', '选择题排版'], '【批注样例-选择题】若 \\(x^2=9\\)，则 \\(x\\) 的值可能是（ ）。\nA. 3\nB. -3\nC. 3或-3\nD. 9', 'C', '平方等于9的数有两个，分别是3和-3。', '', []],
            ['B-COMMENT-002', '2', '计算', '填空题', '中等', 3, ['根式', '填空横线'], '【批注样例-填空题】化简：\\(\\sqrt{50}-2\\sqrt{8}+\\sqrt{18}\\)=____。', '4√2', '\\(\\sqrt{50}=5\\sqrt2\\)，\\(2\\sqrt8=4\\sqrt2\\)，\\(\\sqrt{18}=3\\sqrt2\\)，所以结果为 \\(4\\sqrt2\\)。', '', []],
            ['B-COMMENT-003', '3', '计算', '计算题', '中等', 5, ['分数计算', '公式显示'], '【批注样例-计算题】计算：\\(\\frac{3}{4}+\\frac{5}{6}\\times\\frac{9}{10}-\\frac{1}{3}\\)。', '7/6', '先算乘法，\\(\\frac{5}{6}\\times\\frac{9}{10}=\\frac34\\)，再计算 \\(\\frac34+\\frac34-\\frac13=\\frac76\\)。', '', []],
            ['B-COMMENT-004', '4', '应用题', '应用题', '中等', 6, ['方程应用', '利润问题'], '【批注样例-应用题】某文具店购进一批笔记本，按每本8元出售可盈利120元，按每本7元出售则亏损30元。求这批笔记本共有多少本。', '150本', '设共有 \\(x\\) 本，两种售价相差1元，总利润相差150元，所以 \\(x=150\\)。', '', []],
            ['B-COMMENT-005', '5', '几何', '几何题', '中等', 5, ['三角形面积', '题干图'], '【批注样例-几何题】如图，△ABC中AB=12，高为7，求面积。', '42', '三角形面积=底×高÷2，\\(12\\times7\\div2=42\\)。', tri, [{ role: 'stem', order: 1, url: `data:image/svg+xml;utf8,${encodeURIComponent(tri)}` }]],
            ['B-COMMENT-006', '6', '几何', '证明题', '中等', 6, ['平行线', '角关系'], '【批注样例-证明题】已知AB∥CD，∠1=∠2。求证：BE∥DF。', '证明见解析', '因为AB∥CD，所以对应角相等；又因为∠1=∠2，可推出BE与DF对应角相等，因此BE∥DF。', '', []],
            ['B-COMMENT-007', '7', '函数', '综合题', '压轴', 10, ['二次函数', '综合题'], '【批注样例-综合题】已知函数 \\(y=x^2-4x+1\\)。解答以下问题：（1）求顶点坐标；（2）求当 \\(-1\\le x\\le3\\) 时函数的最小值。', '（1）(2,-3)；（2）-3', '配方得 \\(y=(x-2)^2-3\\)，顶点为(2,-3)。因为2在区间内，所以最小值为-3。', '', []]
        ];
        return rows.map(([internalNo, questionNo, chapter, questionType, difficulty, score, knowledgePoints, stem, answer, solution, diagramSvg, images], idx) => ({
            id: `b-comment-${idx + 1}`,
            internalNo,
            grade: '六年级',
            system: '小升初',
            chapter,
            knowledgePoints,
            subKnowledgePoint: '',
            questionType,
            difficulty,
            score,
            stem,
            answer,
            solution,
            formulaLatex: extractFormula(stem),
            diagramSvg,
            imageUrl: images[0]?.url || '',
            images,
            imageSize: idx === 4 ? 'small' : 'medium',
            commonMistakes: '',
            errorTags: [],
            source: { ...baseSource, questionNo, paperOrder: Number(questionNo) },
            sourceName,
            aiNotes: 'file 页面批注样例，人工插入。',
            originText: stem,
            status: 'active',
            createdAt: '2026-06-22T00:00:00.000Z'
        }));
    }
    function ensureFileCommentSamples() {
        if (location.protocol !== 'file:') return false;
        const existing = new Set(state.questions.map(q => q.internalNo));
        const next = commentExamples().filter(q => !existing.has(q.internalNo));
        if (!next.length) return false;
        state.questions.unshift(...next);
        const paperId = 'paper-comment-samples-2026';
        state.paperLibrary = state.paperLibrary.filter(paper => paper.id !== paperId);
        state.paperLibrary.unshift({
            id: paperId,
            title: '数学题库批注样例-七类题型',
            year: '2026',
            grade: '六年级',
            region: '广东深圳',
            sourceType: '批注样例',
            fileName: 'file页面批注样例',
            importedAt: '2026-06-22T00:00:00.000Z',
            questionIds: next.map(q => q.id),
            candidateIds: [],
            questionOrder: next.map((q, index) => ({ questionId: q.id, questionNo: String(index + 1), paperOrder: index + 1 })),
            warnings: ['用于批注测试，不是真实试卷']
        });
        save();
        return true;
    }
    function ensureDemoPaperRecord() {
        const demoQuestions = state.questions
            .filter(q => /^B-DEMO-\d+/.test(q.internalNo || ''))
            .sort((a, b) => String(a.internalNo || '').localeCompare(String(b.internalNo || ''), undefined, { numeric: true }));
        if (!demoQuestions.length) return false;
        const paperId = 'paper-demo-samples-2026';
        const title = '数学题库内置例题-12题综合样卷';
        demoQuestions.forEach((q, index) => {
            q.source = {
                ...(q.source || {}),
                paperId,
                sourceType: '内置例题',
                year: q.source?.year || '2026',
                grade: q.grade || q.source?.grade || '',
                region: q.source?.region || '深圳',
                examName: title,
                questionNo: String(index + 1),
                paperOrder: index + 1
            };
            q.sourceName = sourceLabel(q.source);
        });
        state.paperLibrary = state.paperLibrary.filter(paper => paper.id !== paperId);
        state.paperLibrary.unshift({
            id: paperId,
            title,
            year: '2026',
            grade: '六年级-初三',
            region: '深圳',
            sourceType: '内置例题',
            fileName: '系统样例',
            importedAt: new Date().toISOString(),
            questionIds: demoQuestions.map(q => q.id),
            candidateIds: [],
            questionOrder: demoQuestions.map((q, index) => ({
                questionId: q.id,
                questionNo: String(index + 1),
                paperOrder: index + 1
            })),
            warnings: ['系统样例，用于验证试卷库查看详情和整卷加入流程']
        });
        return true;
    }
    function seedSamples() {
        const existing = new Set(state.questions.map(q => q.internalNo));
        const next = examples().filter(q => !existing.has(q.internalNo));
        state.questions.unshift(...next);
        const paperReady = ensureDemoPaperRecord();
        save();
        renderAll();
        toast(next.length ? `已补齐 ${next.length} 道数学题库例题，并生成样例试卷` : paperReady ? '数学题库例题已存在，已刷新样例试卷' : '数学题库例题已存在');
    }
    function openModal(title, body) {
        $('bModalTitle').textContent = title;
        $('bModalBody').innerHTML = body;
        $('bModal').classList.add('show');
        queueMathTypeset($('bModalBody'));
    }
    function closeModal() {
        $('bModal').classList.remove('show');
    }
    function renderAll() {
        renderKpis();
        renderCandidates();
        renderBank();
        renderBasket();
        renderPaperDraft();
        renderPapers();
        renderOutputSide();
        renderQuality();
        renderImportBatchStatus();
    }
    function init() {
        load();
        const addedCommentSamples = ensureFileCommentSamples();
        applyAsideState();
        applyMainNavState();
        applyOutlineWidth();
        applyOutputSideWidth();
        applyBankFilterWidth();
        syncAiProviderControls();
        ['bOutputTitle', 'bOutputType', 'bOutputMode', 'bShowScore', 'bShowDifficulty', 'bShowTags', 'bShowSource', 'bShowAnswerArea', 'bAnswerAutoByType', 'bFillBlankStyle', 'bSolutionRows', 'bPaperSize', 'bPaperFontSize', 'bKeepQuestionTogether', 'bWordKeepPage', 'bPdfKeepPage'].forEach(idName => {
            const el = $(idName);
            if (!el) return;
            el.addEventListener(el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change', refreshOutput);
        });
        $('bRawText')?.addEventListener('input', () => {
            clearTimeout(window._bImportMetaTimer);
            window._bImportMetaTimer = setTimeout(previewImportMetaFromInputs, 350);
        });
        $('bImportFile')?.addEventListener('change', previewImportMetaFromInputs);
        document.addEventListener('click', event => {
            if (event.target.closest?.('.b-insert-popover, .b-paper-add, .b-answer-popover, .b-answer-menu-btn, .b-resize-handle, .b-resizable-figure, .b-left-settings-panel, #bExportSettingsToggle, .b-context-menu')) return;
            hideDraftContextMenu();
            closeInlineMenus();
        });
        renderAll();
        syncPaperMetaButton();
        syncLeftExportSettings();
        syncAiProviderControls();
        syncUndoButton();
        switchView(addedCommentSamples ? 'bank' : 'import');
        if (addedCommentSamples) toast('已补齐 7 道 file 页面批注样例题');
    }
    document.addEventListener('DOMContentLoaded', init);
    return {
        switchView, createImport, compareImportModels, seedSamples, reviewCandidate, acceptCandidate, ignoreCandidate, deleteCandidate,
        setAiProvider, undoLastAction,
        toggleCandidate, toggleAllCandidates, selectAllCandidates, batchDelete, batchIgnore, batchMark, applyBatchMark,
        batchAcceptCandidates,
        renderBank, toggleQuestionSelection, selectFilteredQuestions, toggleFilteredQuestionSelection, clearQuestionSelection, batchAddSelectedToBasket,
        batchArchiveSelected, batchMarkQuestions, applyQuestionBatchMark, locateQuestion,
        setQuestionImageSize, toggleBankDensity, saveBankFilterScheme, applyBankFilterScheme,
        uploadCandidateImage, uploadQuestionImage,
        addFilteredToBasket, toggleBasket, clearBasket, generateOutput, copyMarkdown, copyPlain,
        printPdf, downloadWord, downloadHtml, downloadMd, renderQuality, openQuestionEditor, saveQuestion,
        closeModal, quickFilter, toggleAside, toggleMainNav, openBasketDrawer, closeBasketDrawer, goComposeFromBasket,
        openHelpDrawer, closeHelpDrawer, closeAllDrawers,
        moveBasketItem, startBasketDrag, allowBasketDrop, dropBasketItem, addBasketQuestionToDraft, addAllBasketToDraft,
        renderPapers, clearPaperFilters, loadPaperToBasket, printPaper, deletePaper, togglePaperDetail,
        setOutputType, setOutputMode, switchOutputTab, scrollDraftItem, renderOutputSide, renderOutputHistory,
        toggleFinderExtra, expandQuestionKeywords, toggleSortMenu, setOutputSort, setOutputFilter, setOutputRange, setHistorySort,
        toggleOutputCardAnswer,
        addQuestionToDraft, clearOutputPaperFilter, previewPaperQuestions,
        savePaperHistory, openHistoryDraft, duplicateHistoryDraft, exportHistoryDraft, deleteHistoryDraft,
        generateAiOutline, applyAiOutline, checkDraftQuality,
        insertDraftMenu, insertDraftHeading, editDraftHeading, insertDraftText, editDraftText, insertPageBreak, insertPageBreakBefore, insertDraftBlank, setDraftBlankRows, insertDraftTable, editDraftTable, insertDraftImage, editDraftImage,
        editDraftTitle, updateDraftTitleFromInline, syncDraftTitleInline, updateDraftHeadingFromInline, syncDraftHeadingInline, updateDraftTextFromInline, syncDraftTextInline,
        updatePaperMetaFromInline, hidePaperMeta, showPaperMeta, togglePaperMeta, toggleLeftExportSettings,
        editDraftQuestion, saveDraftQuestionEdit, setDraftQuestionImageSize, startDraftImageResize, selectDraftImage, configureAnswerArea, toggleAnswerAreaMenu, chooseAnswerAreaStyle, setAnswerAreaRows, setAnswerAreaPreset, saveAnswerAreaConfig, setDraftAnswerRows,
        selectQuestionImage, startQuestionImageResize,
        removeDraftItem, moveDraftItem, groupDraftByType,
        selectDraftOutline, toggleOutlineDisplayMode, showDraftContextMenu, hideDraftContextMenu, removeSelectedDraftItems, removeDraftHeadingOnly, removeDraftHeadingSection,
        startOutlineResize, startBankResize, startOutputSideResize, startDraftDrag, allowDraftDrop, dropDraftItem, toggleDraftHeadingCollapse,
        autoFillMissingKnowledge, autoFillMissingSource,
        useLastImportText, copyLastImportText
    };
})();
