const B = (() => {
    const STORE_KEY = 'math-question-bank-b-state-v1';
    const ASIDE_KEY = 'math-question-bank-b-aside-collapsed';
    const state = {
        view: 'import',
        questions: [],
        candidates: [],
        basket: [],
        paperDraft: [],
        paperDraftExcluded: [],
        paperHistory: [],
        paperLibrary: [],
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
        lastImportRawText: ''
    };

    const grades = ['六年级', '初一', '初二', '初三'];
    const chapters = ['计算', '应用题', '代数', '几何', '函数', '统计概率'];
    const types = ['选择题', '填空题', '计算题', '应用题', '几何题', '证明题', '综合题'];
    const difficulties = ['基础', '中等', '提高', '压轴'];
    const help = {
        import: ['导入中心', '资料先进入候选题池，AI 辅助拆题，不自动进入正式题库。', [['生成候选题', 'B.createImport()', 'primary'], ['待确认题池', "B.switchView('candidates')", '']]],
        candidates: ['待确认题池', '左右对照原文与结构化字段，人工确认后才进入题库 B。', [['批量标记', 'B.batchMark()', ''], ['正式题库', "B.switchView('bank')", 'primary']]],
        bank: ['正式题库', '题库 B 的正式题目池，可筛选、编辑、归档并加入题篮。', [['新增题目', 'B.openQuestionEditor()', 'primary'], ['质量体检', "B.switchView('quality')", '']]],
        compose: ['组卷输出', '题篮、结构检查、试卷画布和多格式导出放在同一屏，减少来回切换。', [['继续选题', "B.switchView('bank')", ''], ['生成输出', 'B.generateOutput()', 'primary'], ['网页打印/PDF', 'B.printPdf()', '']]],
        papers: ['试卷库', '按导入批次保存整套试卷，方便以后整卷调出、组卷和打印。', [['正式题库', "B.switchView('bank')", ''], ['组卷输出', "B.switchView('compose')", 'primary']]],
        quality: ['质量体检', '集中处理缺答案、缺解析、缺知识点、缺来源、疑似公式损坏、重复和图形问题。', [['刷新体检', 'B.renderQuality()', ''], ['正式题库', "B.switchView('bank')", '']]],
        docs: ['设计文档', '题库 B 的使用说明、边界、质量规则和后续规划。', [['导入中心', "B.switchView('import')", ''], ['组卷输出', "B.switchView('compose')", '']]]
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
    function save() {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            questions: state.questions,
            candidates: state.candidates,
            basket: state.basket,
            paperDraft: state.paperDraft,
            paperDraftExcluded: state.paperDraftExcluded,
            paperHistory: state.paperHistory,
            paperLibrary: state.paperLibrary
        }));
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
    function sourceLabel(source = {}) {
        return [source.year, source.region || source.districtOrSchool, source.examName || source.sourceType, source.note].filter(Boolean).join(' ') || '未标来源';
    }
    function hasSourceInfo(q = {}) {
        const label = String(q.sourceName || sourceLabel(q.source) || '').trim();
        return Boolean(label && label !== '未标来源');
    }
    function sourceWithQuestionNo(q = {}) {
        return [q.sourceName || sourceLabel(q.source), q.source?.questionNo ? `原第 ${q.source.questionNo} 题` : ''].filter(Boolean).join(' · ');
    }
    function paperTitle(source = {}, fileName = '') {
        return source.examName || source.note || fileName || [source.year, source.region || source.districtOrSchool, source.grade, source.sourceType].filter(Boolean).join(' ') || '未命名试卷';
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
    function extractImageUrl(text) {
        const m = String(text || '').match(/(?:图片|图|image|img)\s*[:：]\s*(\S+)/i);
        return m ? m[1].trim() : '';
    }
    function extractImageUrls(text) {
        const urls = [];
        const re = /(?:图片|图|image|img)\s*[:：]\s*(\S+)/ig;
        let m;
        while ((m = re.exec(String(text || '')))) {
            const url = m[1]?.trim();
            if (url && !urls.includes(url)) urls.push(url);
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
            if (!url) continue;
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
        const titleLine = lines.find(line => /数学|试卷|测试|期末|期中|真题|专题|练习/.test(line) && !/^(?:第\s*)?\d{1,3}\s*[.．、)]/.test(line));
        const yearMatch = String(text || '').match(/(20\d{2})(?:\s*[-—~至]\s*20\d{2})?/);
        const gradeMatch = String(text || '').match(/六年级|初一|七年级|初二|八年级|初三|九年级/);
        const regionMatch = String(text || '').match(/(北京|上海|天津|重庆|广东|深圳|广州|佛山|东莞|江苏|浙江|杭州|南京|成都|武汉|长沙|西安|郑州|山东|福建|厦门|福州|河北|河南|湖北|湖南|四川|陕西|辽宁|沈阳|大连|青岛|苏州|无锡|南山|福田|罗湖|宝安|龙岗|龙华|光明|坪山|盐田)(?:市|区|省)?/);
        if (!meta.year && yearMatch) meta.year = yearMatch[1];
        if (gradeMatch && (!meta.grade || meta.grade === '六年级')) meta.grade = gradeMatch[0] === '七年级' ? '初一' : gradeMatch[0] === '八年级' ? '初二' : gradeMatch[0] === '九年级' ? '初三' : gradeMatch[0];
        if (!meta.region && regionMatch) meta.region = regionMatch[0];
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
        if ($('bOutputTitle') && source.examName && $('bOutputTitle').value === '数学题库 B 专题练习') $('bOutputTitle').value = source.examName;
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
        const aiProvider = providerOverride || value('bImportAIProvider') || 'qwen';
        const answerMode = value('bAnswerMode') || 'auto';
        const res = await fetch('/api/question-import/ai-parse', {
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
        const res = await fetch('/api/question-import/batches', {
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
        let nextSource = parsedByServer?.paperMeta ? { ...source, ...parsedByServer.paperMeta } : parsePaperMeta(fullText, source);
        let candidates = [];
        const warnings = [...importWarnings];
        if (parsedByServer?.candidates?.length) {
            candidates = parsedByServer.candidates.map(item => candidateFromParsed(item, nextSource));
            warnings.push(...(parsedByServer.warnings || []));
            if (parsedByServer.fallbackUsed && value('bImportAIProvider') !== 'rules') {
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
                    setStatus(value('bImportAIProvider') === 'rules' ? `本地规则拆题 ${index + 1}/${files.length}` : `AI 解析 ${index + 1}/${files.length}`);
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
                setStatus(value('bImportAIProvider') === 'rules' ? '本地规则拆题' : 'AI 分块解析，整卷可能需要 1-2 分钟');
                const parsed = await parseImportUnit(fullText, baseSource, fileName, warnings);
                firstSource = parsed.source;
                createPaperFromImport(parsed.source, parsed.candidates, fileName);
                createdCandidates.push(...parsed.candidates);
                state.lastImportRawText = fullText || '';
            }
            setStatus('生成候选题');
            applySourceToForm(firstSource);
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
    }
    function applyAsideState() {
        const collapsed = localStorage.getItem(ASIDE_KEY) === '1';
        document.querySelector('.b-shell')?.classList.toggle('aside-collapsed', collapsed);
        $('bAside')?.classList.toggle('collapsed', collapsed);
        if ($('bAsideToggle')) $('bAsideToggle').textContent = collapsed ? '展开' : '收起';
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
        const current = Number.parseFloat(getComputedStyle(shell).getPropertyValue('--b-outline-width')) || 210;
        const onMove = moveEvent => {
            const next = Math.min(340, Math.max(150, current + moveEvent.clientX - startX));
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
    function applyOutlineWidth() {
        const saved = Number(localStorage.getItem('qb-b-outline-width') || 0);
        if (!saved) return;
        document.querySelector('.b-compose-workbench')?.style.setProperty('--b-outline-width', `${Math.min(340, Math.max(150, saved))}px`);
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
        $('bCandidateReview').innerHTML = `<div class="b-grid" style="grid-template-columns:1fr 1fr;">
            <div>
                ${candidateReviewNotice(c)}
                <label>原文 / 上下文</label><div class="b-box">${textWithMath(c.rawText)}</div>
                <label style="margin-top:10px;">解析状态</label><div class="b-tags">${candidateReviewTags(c)}</div>
                ${(c.importWarnings || []).length ? `<label>导入批次提示</label><div class="b-tags">${c.importWarnings.map(w => `<span class="b-tag orange">${html(w)}</span>`).join('')}</div>` : ''}
                <label>来源</label><div class="b-box">${html(sourceLabel(c.source))}</div>
                ${questionImages(c).length ? `<label>图片预览</label>${renderRoleImages(c)}` : ''}
            </div>
            <div class="b-form b-review-form">
                <div class="b-row three"><div><label>原试卷题号</label><input id="bCandQuestionNo" value="${html(c.source?.questionNo || '')}"></div><div><label>年级</label><select id="bCandGrade">${grades.map(g => `<option ${g === c.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div><div><label>章节</label><input id="bCandChapter" value="${html(c.chapter)}"></div></div>
                <div class="b-row three"><div><label>题型</label><input id="bCandType" value="${html(c.questionType)}"></div><div><label>难度</label><select id="bCandDifficulty">${difficulties.map(d => `<option ${d === c.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div><label>分值</label><input id="bCandScore" type="number" min="0" step="1" value="${html(c.score || 5)}"></div></div>
                <div><label>题干</label><textarea id="bCandStem" rows="7">${html(c.stem)}</textarea></div>
                <div class="b-row"><div><label>知识点</label><input id="bCandKnowledge" value="${html((c.knowledgePoints || []).join('、'))}"></div><div><label>答案</label><textarea id="bCandAnswer" rows="4">${html(c.answer)}</textarea></div></div>
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
                <div><label>解析</label><textarea id="bCandSolution" rows="6">${html(c.solution)}</textarea></div>
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
        toast('已确认入库到题库 B');
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
            aiNotes: '题库 B 人工确认入库。',
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
        if (!state.filtered.length) {
            list.innerHTML = '<div class="b-empty">当前筛选下没有题目。</div>';
            updateFilteredSelectButton();
            return;
        }
        list.innerHTML = state.filtered.map(q => renderQuestionCard(q)).join('');
        updateFilteredSelectButton();
        queueMathTypeset(list);
    }
    function renderQuestionCard(q) {
        const selected = state.basket.includes(q.id);
        const checked = state.selectedQuestions.has(q.id);
        const highlighted = state.highlightedQuestionId === q.id;
        return `<article class="b-card selectable ${selected ? 'selected' : ''} ${highlighted ? 'highlighted' : ''} ${imageSizeClass(q)}" id="bqCard-${html(q.id)}">
            <div class="b-card-check"><input type="checkbox" ${checked ? 'checked' : ''} onchange="B.toggleQuestionSelection('${q.id}', this.checked)"></div>
            <div>
            <div class="b-card-top"><div><div class="b-card-title">${html(q.stem).slice(0, 92)}${q.stem.length > 92 ? '...' : ''}</div><div class="b-tags">${[q.internalNo, q.source?.questionNo ? `原第 ${q.source.questionNo} 题` : '', q.grade, q.chapter, q.questionType, q.difficulty, `${q.score}分`].filter(Boolean).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}${questionHasFormula(q) ? '<span class="b-tag blue">公式</span>' : ''}${questionHasImage(q) ? '<span class="b-tag orange">图形</span>' : ''}${qualityFlags(q).map(x => `<span class="b-tag red">${html(x)}</span>`).join('')}</div></div><div class="b-actions"><button class="b-btn small ${selected ? '' : 'primary'}" onclick="B.toggleBasket('${q.id}')">${selected ? '移出' : '加入'}</button><button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">编辑</button>${!q.answer ? `<button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">补答案</button>` : ''}${!q.solution ? `<button class="b-btn small" onclick="B.openQuestionEditor('${q.id}')">补解析</button>` : ''}</div></div>
            <div class="b-stem">${renderText(q.stem)}</div>
            ${q.diagramSvg ? `<div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div>` : ''}
            ${renderRoleImages(q)}
            ${questionHasImage(q) ? `<div class="b-image-size-control">图形大小 <select onchange="B.setQuestionImageSize('${q.id}', this.value)"><option value="small" ${q.imageSize === 'small' ? 'selected' : ''}>小</option><option value="medium" ${!q.imageSize || q.imageSize === 'medium' ? 'selected' : ''}>中</option><option value="large" ${q.imageSize === 'large' ? 'selected' : ''}>大</option></select></div>` : ''}
            <div class="b-tags">${(q.knowledgePoints || []).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}</div>
            <div class="b-stem" style="font-size:12px;color:var(--muted);">来源：${html(q.sourceName || sourceLabel(q.source))}</div>
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
        state.paperDraft = state.paperDraft.filter(item => ['heading', 'text', 'pageBreak', 'table', 'image'].includes(item.type) || stale.has(item.id));
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
    function setOutputType(type) {
        const el = $('bOutputType');
        if (el) el.value = type;
        document.querySelectorAll('[data-output-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.outputType === type));
        if (type === 'answerEdit') setOutputMode('answerOnly');
        refreshOutput();
    }
    function setOutputMode(mode) {
        const el = $('bOutputMode');
        if (el) el.value = mode;
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
        const el = $(`bPaperItem-${index}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.querySelectorAll('.b-paper-item').forEach(item => item.classList.remove('active'));
        el?.classList.add('active');
    }
    function renderOutputOutline() {
        const el = $('bOutputOutline');
        if (!el) return;
        const items = draftItems();
        let questionIndex = 0;
        const rows = [`<button class="b-outline-item active" onclick="B.scrollDraftItem(-1)">标题区</button>`];
        items.forEach((item, index) => {
            if (item.type === 'heading') rows.push(`<button class="b-outline-item" onclick="B.scrollDraftItem(${index})">${html(item.title || '未命名栏目')}</button>`);
            else if (item.type === 'text') rows.push(`<button class="b-outline-item sub" onclick="B.scrollDraftItem(${index})"><span class="b-outline-no">讲</span><span>${html(String(item.text || '讲义说明').slice(0, 12))}</span></button>`);
            else if (item.type === 'pageBreak') rows.push(`<button class="b-outline-item sub" onclick="B.scrollDraftItem(${index})"><span class="b-outline-no">页</span><span>分页</span></button>`);
            else if (item.type === 'table') rows.push(`<button class="b-outline-item sub" onclick="B.scrollDraftItem(${index})"><span class="b-outline-no">表</span><span>${html(item.title || '表格')}</span></button>`);
            else if (item.type === 'image') rows.push(`<button class="b-outline-item sub" onclick="B.scrollDraftItem(${index})"><span class="b-outline-no">图</span><span>${html(item.caption || '图片')}</span></button>`);
            else if (item.type === 'question') {
                questionIndex += 1;
                rows.push(`<button class="b-outline-item sub" onclick="B.scrollDraftItem(${index})"><span class="b-outline-no">${questionIndex}</span><span>${html((item.question?.stem || '题目').slice(0, 13))}</span></button>`);
            }
        });
        rows.push(`<button class="b-outline-item" onclick="B.setOutputType('answerEdit')">答案解析</button>`);
        el.innerHTML = rows.join('');
    }
    function renderPaperDraft() {
        const el = $('bPaperDraftList');
        renderOutputOutline();
        if (!el) return;
        const items = draftItems();
        let questionIndex = 0;
        el.innerHTML = items.length ? items.map((item, index) => {
            if (item.type === 'heading') return `<article class="b-basket-mini"><div class="b-basket-mini-title">标题：${html(item.title)}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftHeading(${index})">编辑</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'text') return `<article class="b-basket-mini"><div class="b-basket-mini-title">说明：${html(String(item.text || '').slice(0, 70))}${String(item.text || '').length > 70 ? '...' : ''}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftText(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'pageBreak') return `<article class="b-basket-mini"><div class="b-basket-mini-title">分页</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'table') return `<article class="b-basket-mini"><div class="b-basket-mini-title">表格：${html(item.title || '未命名表格')}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftTable(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            if (item.type === 'image') return `<article class="b-basket-mini"><div class="b-basket-mini-title">图片：${html(item.caption || item.url || '图片')}</div><div class="b-actions" style="justify-content:flex-start;"><button class="b-btn small" onclick="B.editDraftImage(${index})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移除</button></div></article>`;
            const q = item.question;
            questionIndex += 1;
            return `<article class="b-basket-mini"><div class="b-basket-mini-title">${questionIndex}. ${textWithMath(String(q.stem || '').slice(0, 70))}${q.stem.length > 70 ? '...' : ''}</div><div class="b-actions" style="justify-content:flex-start;"><span class="b-tag">${html(q.questionType || '未标题型')}</span><button class="b-btn small" onclick="B.editDraftQuestion(${index})">临时编辑</button><button class="b-btn small" onclick="B.configureAnswerArea(${index})">答题区</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${index}, 1)">下移</button><button class="b-btn small red" onclick="B.removeDraftItem(${index})">移出本卷</button></div></article>`;
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
    function insertDraftHeading() {
        const title = window.prompt('输入标题，例如：一、选择题', '一、选择题');
        if (!title) return;
        ensurePaperDraftFromBasket();
        state.paperDraft.push({ type: 'heading', title: title.trim() });
        save();
        renderPaperDraft();
        refreshOutput();
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
    function insertDraftText() {
        const text = window.prompt('输入本次输出的说明文字，例如：方法提示、例题说明、课前提醒', '方法提示：');
        if (!text) return;
        ensurePaperDraftFromBasket();
        state.paperDraft.push({ type: 'text', text: text.trim() });
        save();
        renderPaperDraft();
        refreshOutput();
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
    function insertPageBreak() {
        ensurePaperDraftFromBasket();
        state.paperDraft.push({ type: 'pageBreak' });
        save();
        renderPaperDraft();
        refreshOutput();
    }
    function insertDraftTable() {
        const title = window.prompt('表格标题', '课堂记录表');
        if (!title) return;
        ensurePaperDraftFromBasket();
        state.paperDraft.push({ type: 'table', title: title.trim(), rows: [['要点', '记录'], ['方法', '']] });
        save();
        renderPaperDraft();
        refreshOutput();
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
    function insertDraftImage() {
        const url = window.prompt('图片链接或本地附件 URL', '');
        if (!url) return;
        const caption = window.prompt('图片说明', '配图') || '';
        ensurePaperDraftFromBasket();
        state.paperDraft.push({ type: 'image', url: url.trim(), caption: caption.trim() });
        save();
        renderPaperDraft();
        refreshOutput();
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
    function configureAnswerArea(index) {
        const item = state.paperDraft[index];
        if (!item || item.type !== 'question') return;
        const area = item.answerArea || {};
        openModal('设置本题答题区', `<div class="b-form">
            <div class="b-alert success"><span>单题设置优先于右侧“答题区设置”的全局规则。</span></div>
            <label><input id="bDraftAnswerOverride" type="checkbox" ${area.override ? 'checked' : ''}> 启用单题设置</label>
            <label><input id="bDraftAnswerEnabled" type="checkbox" ${area.enabled !== false ? 'checked' : ''}> 显示答题区</label>
            <div class="b-row"><div><label>样式</label><select id="bDraftAnswerStyle"><option value="inherit" ${!area.style || area.style === 'inherit' ? 'selected' : ''}>跟随全局</option><option value="underline" ${area.style === 'underline' ? 'selected' : ''}>填空横线</option><option value="lines" ${area.style === 'lines' ? 'selected' : ''}>解答横线</option><option value="blank" ${area.style === 'blank' ? 'selected' : ''}>空白区域</option></select></div><div><label>行数</label><input id="bDraftAnswerRows" type="number" min="1" max="20" value="${html(area.rows || '')}" placeholder="留空按全局"></div></div>
            <label><input id="bDraftForceNextPage" type="checkbox" ${area.forceNextPage ? 'checked' : ''}> 本题从下一页开始</label>
            <div class="b-actions"><button class="b-btn" onclick="B.closeModal()">取消</button><button class="b-btn primary" onclick="B.saveAnswerAreaConfig(${index})">保存</button></div>
        </div>`);
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
        const query = value('bPaperSearch').toLowerCase();
        const papers = state.paperLibrary.filter(paper => {
            const hay = [paper.title, paper.year, paper.grade, paper.region, paper.sourceType, paper.fileName].join(' ').toLowerCase();
            return !query || hay.includes(query);
        });
        if ($('bPaperCount')) $('bPaperCount').textContent = `${papers.length} 套`;
        const list = $('bPaperList');
        if (!list) return;
        list.innerHTML = papers.length ? papers.map(paper => {
            const questions = paperQuestions(paper);
            return `<article class="b-card">
                <div class="b-card-top">
                    <div><div class="b-card-title">${html(paper.title)}</div><div class="b-tags">${[paper.year, paper.grade, paper.region, paper.sourceType, paper.fileName, `${questions.length} 道已入库`].filter(Boolean).map(x => `<span class="b-tag">${html(x)}</span>`).join('')}</div></div>
                    <div class="b-actions"><button class="b-btn small primary" onclick="B.loadPaperToBasket('${paper.id}')">整卷加入</button><button class="b-btn small" onclick="B.printPaper('${paper.id}')">打印整卷</button><button class="b-btn small red" onclick="B.deletePaper('${paper.id}')">删除记录</button></div>
                </div>
            </article>`;
        }).join('') : '<div class="b-empty">暂无试卷。导入整卷后会自动生成试卷记录。</div>';
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
        if ($('bOutputTitle')) $('bOutputTitle').value = paper.title || '数学题库 B 输出';
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
            <button class="b-btn small primary" onclick="B.addQuestionToDraft('${q.id}')">加入本卷</button>
            <button class="b-btn small" onclick="B.toggleBasket('${q.id}')">加入题篮</button>
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
    function generateAiOutline() {
        const items = basketItems();
        if (!items.length) return toast('请先加入题篮');
        const byType = Object.entries(items.reduce((acc, q) => {
            const key = q.questionType || '练习';
            (acc[key] = acc[key] || []).push(q);
            return acc;
        }, {}));
        const htmlRows = byType.map(([type, qs], index) => `<div class="b-output-card"><div class="b-output-card-title">${['知识梳理', '例题', '变式', '练习'][index] || type}</div><div class="b-output-card-meta">${qs.map(q => q.source?.questionNo ? `原${q.source.questionNo}` : q.internalNo).filter(Boolean).join('、') || `${qs.length}题`}</div><button class="b-btn small primary" onclick="B.applyAiOutline()">加入本卷</button></div>`).join('');
        if ($('bAiOutline')) $('bAiOutline').innerHTML = htmlRows || '<div class="b-empty">暂无建议。</div>';
    }
    function applyAiOutline() {
        const items = basketItems();
        if (!items.length) return toast('请先加入题篮');
        state.paperDraft = [];
        const sections = [
            ['一、知识梳理', items.filter(q => /填空|计算/.test(q.questionType || '')).slice(0, 1)],
            ['二、例题与训练', items.filter(q => /选择|应用|几何|综合|证明/.test(q.questionType || ''))],
            ['三、课后练习', items.filter(q => /填空|计算/.test(q.questionType || '')).slice(1)]
        ].filter(([, qs]) => qs.length);
        sections.forEach(([title, qs]) => {
            state.paperDraft.push({ type: 'heading', title });
            if (/知识梳理/.test(title)) state.paperDraft.push({ type: 'text', text: '方法提示：先找同高、等底、比例或转化关系，再列式比较。' });
            qs.forEach(q => state.paperDraft.push({ type: 'question', id: q.id }));
        });
        save();
        renderAll();
        refreshOutput();
        toast('已按讲义结构整理本卷');
    }
    function checkDraftQuality() {
        const qs = draftQuestions();
        const problems = [];
        if (!qs.length) problems.push('本卷还没有题目');
        if (qs.some(q => !q.answer)) problems.push('存在缺答案题');
        if (qs.some(q => /如图|下图|图中/.test(q.stem || '') && !questionHasImage(q))) problems.push('存在含图但无附件题');
        const difficulties = qs.map(q => q.difficulty).filter(Boolean);
        if (difficulties.includes('压轴') && difficulties[0] === '压轴') problems.push('压轴题位置偏前');
        $('bDraftQuality').innerHTML = problems.length ? `<div class="b-tags">${problems.map(p => `<span class="b-tag orange">${html(p)}</span>`).join('')}</div>` : '<div class="b-tag green">本卷常规检查通过</div>';
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
        el.innerHTML = items.length ? items.map((q, i) => `<article class="b-basket-mini" draggable="true" ondragstart="B.startBasketDrag(event, ${i})" ondragover="B.allowBasketDrop(event)" ondrop="B.dropBasketItem(event, ${i})">
            <div class="b-basket-mini-title">${i + 1}. ${textWithMath(String(q.stem || '').slice(0, 86))}${q.stem.length > 86 ? '...' : ''}</div>
            <div class="b-actions" style="justify-content:flex-start;"><span class="b-tag">${html(q.chapter || '未标章节')}</span><button class="b-btn small" onclick="B.moveBasketItem(${i}, -1)">上移</button><button class="b-btn small" onclick="B.moveBasketItem(${i}, 1)">下移</button><button class="b-btn small" onclick="B.toggleBasket('${q.id}')">移出</button></div>
        </article>`).join('') : '<div class="b-empty">题篮为空。去正式题库加入题目。</div>';
        queueMathTypeset(el);
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
    function goComposeFromBasket() {
        closeBasketDrawer();
        switchView('compose');
    }
    function outputOptions() {
        return {
            showScore: $('bShowScore')?.checked ?? true,
            showDifficulty: $('bShowDifficulty')?.checked ?? true,
            showTags: $('bShowTags')?.checked,
            showSource: $('bShowSource')?.checked,
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
        if (config.style === 'underline') return '<div class="b-answer-area"><span class="b-fill-underline"></span></div>';
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
        const lines = [`# ${title}`, '', mode === 'answerOnly' ? '答案版' : `姓名：__________　总分：${totalScore} 分`, ''];
        if (type === 'handout') lines.push('## 学习目标', '- 梳理核心模型。', '- 通过例题掌握步骤。', '');
        if (type === 'variants') lines.push('说明：以下为举一反三练习草稿，变式需老师最终确认。', '');
        if (type === 'wrongbook') lines.push('## 错题复练清单', '');
        let questionIndex = 0;
        items.forEach((item) => {
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
        if (/^(?:https?:|data:|blob:|file:)/i.test(value)) return value;
        if (value.startsWith('/Users/')) return `file://${value}`;
        return value;
    }
    function questionImages(q = {}) {
        const images = Array.isArray(q.images) ? q.images.map(item => typeof item === 'string' ? item : item?.url).filter(Boolean) : [];
        if (!images.length && q.imageUrl) images.push(q.imageUrl);
        return [...new Set(images)];
    }
    function normalizedImageItems(q = {}) {
        const items = Array.isArray(q.images) ? q.images.map((item, index) => {
            if (typeof item === 'string') return { url: item, role: '', order: index + 1 };
            return { url: item?.url || '', role: item?.role || '', optionLabel: item?.optionLabel || '', order: item?.order || index + 1 };
        }).filter(item => item.url) : [];
        if (!items.length && q.imageUrl) items.push({ url: q.imageUrl, role: 'stem', order: 1 });
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
    function renderRoleImages(q = {}) {
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
        return `<div class="b-image-role-grid">${groups.map(group => `<div class="b-image-role-item"><div class="b-mini-note">${labels[group.role] || '图片'}</div>${group.urls.map((url, index) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="${labels[group.role] || '图片'}${index + 1}">`).join('')}</div>`).join('')}</div>`;
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
                <div class="b-teacher-block"><strong>解析：</strong>${formulaForHtml(cleanSolutionForOutput(q.solution) || '待补充')}${imageItemsByRole(q, 'solution').map((url, imageIndex) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="解析图片${imageIndex + 1}">`).join('')}</div>
            </section>`;
        }
        const questionText = parsed.options.length ? parsed.intro : stemWithFillBlank(q);
        const remainingImages = parsed.options.length ? stemImages : stemImages;
        const optionGrid = parsed.options.length ? `<div class="b-option-grid">${parsed.options.map(option => `<div class="b-option-item"><span class="b-option-label">${html(option.label)}.</span>${formulaForHtml(option.text)}${option.image ? `<img class="b-question-image" src="${html(imageSrc(option.image))}" alt="选项${html(option.label)}图片">` : ''}</div>`).join('')}</div>` : '';
        const extras = `${q.diagramSvg ? `<div class="b-box b-diagram">${sanitizeSvg(q.diagramSvg)}</div>` : ''}${remainingImages.map((url, imageIndex) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="题目图片${imageIndex + 1}">`).join('')}`;
        const solutionImages = imageItemsByRole(q, 'solution');
        const answerArea = renderAnswerArea(q, opts);
        const breakStyle = answerAreaConfig(q, opts).forceNextPage ? ' style="break-before:page;page-break-before:always;"' : '';
        return `<section class="b-preview-question ${imageSizeClass(q)}"${breakStyle}>
            ${opts.showSource ? `<p class="b-source-line">来源：${html(sourceWithQuestionNo(q))}</p>` : ''}
            <p class="b-question-line"><span class="b-question-no">${index + 1}.</span>${meta} ${formulaForHtml(questionText)}</p>
            ${extras}
            ${optionGrid}
            ${opts.showTags && q.knowledgePoints?.length ? `<p class="b-mini-note">知识点：${q.knowledgePoints.map(html).join('、')}</p>` : ''}
            ${opts.mode === 'teacher' ? `<div class="b-teacher-block"><strong>答案：</strong>${formulaForHtml(q.answer || '待补充')}<br><strong>解析：</strong>${formulaForHtml(cleanSolutionForOutput(q.solution) || '待补充')}${solutionImages.map((url, imageIndex) => `<img class="b-question-image" src="${html(imageSrc(url))}" alt="解析图片${imageIndex + 1}">`).join('')}</div>` : ''}
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
            const tools = `<div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftQuestion(${itemIndex})">临时编辑</button><button class="b-btn small" onclick="B.configureAnswerArea(${itemIndex})">答题区</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移出</button></div>`;
            if (item.type === 'heading') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}"><h2 class="b-paper-section-title b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftHeadingInline(${itemIndex}, this.textContent)" onblur="B.updateDraftHeadingFromInline(${itemIndex}, this.textContent)">${html(item.title)}</h2><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftHeading(${itemIndex})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            if (item.type === 'text') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}"><p class="b-handout-note b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftTextInline(${itemIndex}, this.innerText)" onblur="B.updateDraftTextFromInline(${itemIndex}, this.innerText)">${formulaForHtml(item.text || '')}</p><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftText(${itemIndex})">编辑</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            if (item.type === 'pageBreak') {
                pageNumber += 1;
                return `<div class="b-paper-item" id="bPaperItem-${itemIndex}"><div class="b-page-break-line" data-next-page="${pageNumber}">分页控制：导出时从这里进入下一页</div><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, -1)">上移</button><button class="b-btn small" onclick="B.moveDraftItem(${itemIndex}, 1)">下移</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            }
            if (item.type === 'table') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}"><table class="b-draft-table"><caption>${html(item.title || '')}</caption>${(item.rows || []).map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</table><div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftTable(${itemIndex})">编辑</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            if (item.type === 'image') return `<div class="b-paper-item" id="bPaperItem-${itemIndex}"><img class="b-question-image" src="${html(imageSrc(item.url))}" alt="${html(item.caption || '本卷图片')}">${item.caption ? `<p class="b-mini-note">${html(item.caption)}</p>` : ''}<div class="b-paper-inline-tools"><button class="b-btn small" onclick="B.editDraftImage(${itemIndex})">编辑</button><button class="b-btn small" onclick="B.removeDraftItem(${itemIndex})">移除</button></div></div>`;
            const htmlBlock = renderQuestionForOutput(item.question, questionIndex, { ...opts, mode, type, draftItem: item });
            questionIndex += 1;
            return `<div class="b-paper-item ${imageSizeClass(item.question)}" id="bPaperItem-${itemIndex}">${htmlBlock}${tools}</div>`;
        }).join('');
        const meta = mode === 'answerOnly' ? '答案版' : `姓名：__________　班级：__________　得分：__________${opts.showScore ? `　总分：${totalScore} 分` : ''}`;
        const intro = type === 'handout' ? '<h2 class="b-paper-section-title">一、知识梳理</h2><p class="b-handout-note">方法提示：先明确模型，再对应例题和变式训练。</p>' : '';
        return `<h1 id="bPaperItem--1" class="b-editable" contenteditable="true" spellcheck="false" oninput="B.syncDraftTitleInline(this.textContent)" onblur="B.updateDraftTitleFromInline(this.textContent)" title="直接修改标题">${html(title)}</h1><p class="b-paper-meta">${meta}</p>${intro}<div class="b-paper-questions">${body}</div><div class="b-page-footer">第 1 页 / 预览分页</div>`;
    }
    function generateOutput() {
        if (!basketItems().length) return toast('请先加入题篮');
        const el = $('bOutput');
        el.dataset.markdown = buildMarkdown();
        el.innerHTML = buildPreviewHtml();
        queueMathTypeset(el);
    }
    function refreshOutput() {
        const el = $('bOutput');
        if (!el) return;
        if (!basketItems().length) {
            el.dataset.markdown = '';
            el.innerHTML = '先把题目加入题篮，预览会自动生成。';
            return;
        }
        ensurePaperDraftFromBasket();
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
        const simpleFractions = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘', '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };
        function sup(value) {
            return String(value || '').split('').map(ch => superscripts[ch] || ch).join('');
        }
        return String(text || '')
            .replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => simpleFractions[`${a}/${b}`] || `${a}⁄${b}`)
            .replace(/\\sqrt(?:\[[^\]]+\])?\{([^{}]+)\}/g, '√($1)')
            .replace(/([A-Za-z0-9)])\^\{?([0-9+\-n]+)\}?/g, (_, base, exp) => `${base}${sup(exp)}`)
            .replace(/\b([1-9])\/([1-9])\b/g, (m) => simpleFractions[m] || m)
            .replace(/\\times/g, '×')
            .replace(/\\cdot/g, '·')
            .replace(/\\div/g, '÷')
            .replace(/\\leq?/g, '≤')
            .replace(/\\geq?/g, '≥')
            .replace(/\\pi/g, 'π')
            .replace(/\\left|\\right/g, '')
            .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
            .replace(/[{}]/g, '');
    }
    function xml(v) {
        return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    function docxRun(text, opts = {}) {
        const props = [opts.bold ? '<w:b/>' : '', opts.size ? `<w:sz w:val="${opts.size}"/>` : '', opts.color ? `<w:color w:val="${opts.color}"/>` : ''].join('');
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
            for (let i = 0; i < answerImages.length; i += 1) parts.push(await docxImageAsset(answerImages[i], media, rels, `解析图${i + 1}`, { width: 190, height: 95 }));
            return parts.join('');
        }
        parts.push(docxParagraph(`${index + 1}. ${metaParts.length ? `（${metaParts.join('｜')}）` : ''}${formulaForDocxText(parsed.options.length ? parsed.intro : stemWithFillBlank(q))}`, { after: 60 }));
        if (diagramData) parts.push(await docxImageAsset(diagramData, media, rels, 'SVG 图形'));
        for (let i = 0; i < stemImages.length; i += 1) parts.push(await docxImageAsset(stemImages[i], media, rels, `题干图${i + 1}`));
        if (parsed.options.length) {
            const cells = [];
            for (const option of parsed.options) {
                const cellParts = [docxParagraph(`${option.label}. ${formulaForDocxText(option.text)}`, { after: 20 })];
                if (option.image) cellParts.push(await docxImageAsset(option.image, media, rels, `选项${option.label}图片`, { width: 120, height: 70 }));
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
            for (let i = 0; i < solutionImages.length; i += 1) parts.push(await docxImageAsset(solutionImages[i], media, rels, `解析图${i + 1}`, { width: 190, height: 95 }));
        }
        if (opts.mode === 'student') {
            const config = answerAreaConfig(q, opts);
            if (config.enabled) {
                if (config.style === 'underline') parts.push(docxParagraph('答：________________', { after: 70 }));
                else if (config.style === 'blank') parts.push(docxParagraph(Array.from({ length: Math.max(2, Number(config.rows || 4)) }, () => '').join('\n'), { after: 80, line: 360 }));
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
        const body = [docxParagraph(title, { align: 'center', bold: true, size: 32, after: 80 }), docxParagraph(mode === 'answerOnly' ? '答案版' : `姓名：__________    总分：${totalScore} 分`, { align: 'center', size: 20, color: '667085', after: 160 })];
        let questionIndex = 0;
        for (const item of items) {
            if (item.type === 'heading') {
                body.push(docxParagraph(item.title, { bold: true, size: 26, after: 80, keep: true }));
            } else if (item.type === 'text') {
                body.push(docxParagraph(formulaForDocxText(item.text || ''), { after: 80 }));
            } else if (item.type === 'pageBreak') {
                body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
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
            if (item.type === 'heading') return `<h2 class="b-paper-section-title">${html(item.title)}</h2>`;
            if (item.type === 'text') return `<p class="b-handout-note">${formulaForHtml(item.text || '')}</p>`;
            if (item.type === 'pageBreak') return '<div class="b-page-break-line" style="break-after:page;page-break-after:always;"></div>';
            if (item.type === 'table') return `<table class="b-draft-table"><caption>${html(item.title || '')}</caption>${(item.rows || []).map(row => `<tr>${row.map(cell => `<td>${html(cell)}</td>`).join('')}</tr>`).join('')}</table>`;
            if (item.type === 'image') return `<img class="b-question-image" src="${html(imageSrc(item.url))}" alt="${html(item.caption || '本卷图片')}">${item.caption ? `<p class="b-mini-note">${html(item.caption)}</p>` : ''}`;
            const block = renderQuestionForOutput(item.question, questionIndex, { ...opts, mode, type, draftItem: item });
            questionIndex += 1;
            return block;
        }).join('\n');
        return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${html(title)}</title><script>window.MathJax={tex:{inlineMath:[['\\\\(','\\\\)'],['$','$']],displayMath:[['\\\\[','\\\\]']],processEscapes:true},svg:{fontCache:'global'}};<\/script><script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script><style>@page{size:${opts.paperSize};margin:13mm 14mm}body{font-family:"Times New Roman","SimSun",serif;color:#111827;line-height:1.48;font-size:${opts.paperFontSize}pt}h1{text-align:center;margin:0 0 7pt;font-size:18pt}.b-paper-meta{text-align:center;color:#667085;font-size:9.5pt;margin:0 0 10pt}.b-paper-section-title{font-size:13pt;margin:8pt 0 4pt}.b-handout-note{margin:4pt 0 7pt;white-space:pre-wrap}.b-preview-question{${opts.keepQuestionTogether ? 'break-inside:avoid;' : ''}margin:5pt 0 7pt}.b-question-line{margin:0;line-height:1.5}.b-question-no{font-weight:800;margin-right:3pt}.b-question-meta{color:#667085;font-size:9pt;margin-right:4pt}.b-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2pt 8pt;margin:3pt 0 2pt 18pt}.b-option-item{border:0;padding:1pt;min-height:18pt}.b-option-label{font-weight:800;margin-right:4pt}.b-img-size-small{--question-image-height:90pt;--question-image-width:160pt}.b-img-size-medium{--question-image-height:150pt;--question-image-width:260pt}.b-img-size-large{--question-image-height:220pt;--question-image-width:380pt}.b-question-image,img{max-width:min(100%,var(--question-image-width,260pt));max-height:var(--question-image-height,150pt);object-fit:contain}.b-option-item img{display:block;margin-top:2pt;max-height:105pt}.b-mini-note,.source,.tags,.b-source-line{font-size:8.5pt;color:#667085;margin:2pt 0}.b-teacher-block{margin:4pt 0 0 18pt}.b-box{border:1px dashed #cbd5e1;padding:6pt}.b-answer-area{margin:4pt 0 4pt 18pt}.b-answer-lines{display:grid;gap:8pt;padding-top:3pt}.b-answer-line{border-bottom:1px solid #cbd5e1;height:14pt}.b-answer-blank{border:1px dashed #d0d5dd;border-radius:5pt;background:#fff}.b-fill-underline{display:inline-block;min-width:86pt;border-bottom:1px solid #111827;height:1em}.b-page-break-line{break-after:page;page-break-after:always}.b-draft-table{width:100%;border-collapse:collapse;margin:5pt 0}.b-draft-table td{border:1px solid #cbd5e1;padding:5pt}.b-draft-table caption{text-align:left;font-weight:700;margin-bottom:3pt}mjx-container{max-width:100%;overflow-x:auto;overflow-y:hidden}</style></head><body><h1>${html(title)}</h1><p class="b-paper-meta">${mode === 'answerOnly' ? '答案版' : `姓名：__________　班级：__________　得分：__________${opts.showScore ? `　总分：${totalScore} 分` : ''}`}</p>${body}</body></html>`;
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
        download(`${safeFile(value('bOutputTitle') || '题库B输出')}.md`, 'text/markdown;charset=utf-8', buildMarkdown());
    }
    function downloadHtml() {
        if (!basketItems().length) return toast('请先加入题篮');
        download(`${safeFile(value('bOutputTitle') || '题库B输出')}.html`, 'text/html;charset=utf-8', buildHtmlDoc());
    }
    async function downloadWord() {
        if (!basketItems().length) return toast('请先加入题篮');
        try {
            toast('正在生成 Word DOCX...');
            downloadBlob(`${safeFile(value('bOutputTitle') || '题库B输出')}.docx`, await buildDocxBlob());
            toast('已生成 Word DOCX');
        } catch (error) {
            toast(error?.message || 'Word 生成失败，请检查图片或公式');
        }
    }
    function safeFile(name) {
        return String(name || '题库B输出').replace(/[\\\\/:*?"<>|]/g, '_').slice(0, 80);
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
        $('bQuality').innerHTML = checks.map(flag => {
            const items = flag === '疑似重复题' ? dupes : activeQuestions.filter(q => qualityFlags(q).includes(flag));
            return `<article class="b-doc"><h3>${html(flag)} <span class="b-tag ${items.length ? 'red' : 'green'}">${items.length}</span></h3><p>${items.length ? '点击题号可跳到正式题库定位。' : '暂无问题。'}</p><div class="b-quality-list">${items.map(q => `<button class="b-quality-item" onclick="B.locateQuestion('${q.id}')">${html(q.internalNo || q.id)} · ${html(q.chapter || '未标章节')} · ${html(q.stem).slice(0, 46)}${q.stem.length > 46 ? '...' : ''}</button>`).join('')}</div></article>`;
        }).join('');
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
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        toast('已保存到题库 B');
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
        const base = { source: { sourceType: '自编', year: '2026', region: '深圳', examName: '数学题库 B 内置例题' }, sourceName: '数学题库 B 内置例题', status: 'active', aiNotes: '题库 B 初始化例题。' };
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
    function seedSamples() {
        const existing = new Set(state.questions.map(q => q.internalNo));
        const next = examples().filter(q => !existing.has(q.internalNo));
        state.questions.unshift(...next);
        save();
        renderAll();
        toast(next.length ? `已补齐 ${next.length} 道题库 B 例题` : '题库 B 例题已存在');
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
    }
    function init() {
        load();
        applyAsideState();
        ['bOutputTitle', 'bOutputType', 'bOutputMode', 'bShowScore', 'bShowDifficulty', 'bShowTags', 'bShowSource', 'bShowAnswerArea', 'bAnswerAutoByType', 'bFillBlankStyle', 'bSolutionRows', 'bPaperSize', 'bPaperFontSize', 'bKeepQuestionTogether', 'bWordKeepPage', 'bPdfKeepPage'].forEach(idName => {
            const el = $(idName);
            if (!el) return;
            el.addEventListener(el.tagName === 'INPUT' && el.type !== 'checkbox' ? 'input' : 'change', refreshOutput);
        });
        renderAll();
        switchView('import');
    }
    document.addEventListener('DOMContentLoaded', init);
    return {
        switchView, createImport, compareImportModels, seedSamples, reviewCandidate, acceptCandidate, ignoreCandidate, deleteCandidate,
        toggleCandidate, toggleAllCandidates, selectAllCandidates, batchDelete, batchIgnore, batchMark, applyBatchMark,
        batchAcceptCandidates,
        renderBank, toggleQuestionSelection, selectFilteredQuestions, toggleFilteredQuestionSelection, clearQuestionSelection, batchAddSelectedToBasket,
        batchArchiveSelected, batchMarkQuestions, applyQuestionBatchMark, locateQuestion,
        setQuestionImageSize,
        uploadCandidateImage, uploadQuestionImage,
        addFilteredToBasket, toggleBasket, clearBasket, generateOutput, copyMarkdown, copyPlain,
        printPdf, downloadWord, downloadHtml, downloadMd, renderQuality, openQuestionEditor, saveQuestion,
        closeModal, quickFilter, toggleAside, openBasketDrawer, closeBasketDrawer, goComposeFromBasket,
        openHelpDrawer, closeHelpDrawer, closeAllDrawers,
        moveBasketItem, startBasketDrag, allowBasketDrop, dropBasketItem,
        renderPapers, loadPaperToBasket, printPaper, deletePaper,
        setOutputType, setOutputMode, switchOutputTab, scrollDraftItem, renderOutputSide, renderOutputHistory,
        toggleFinderExtra, expandQuestionKeywords, toggleSortMenu, setOutputSort, setOutputFilter, setOutputRange, setHistorySort,
        addQuestionToDraft, clearOutputPaperFilter, previewPaperQuestions,
        savePaperHistory, openHistoryDraft, duplicateHistoryDraft, exportHistoryDraft, deleteHistoryDraft,
        generateAiOutline, applyAiOutline, checkDraftQuality,
        insertDraftHeading, editDraftHeading, insertDraftText, editDraftText, insertPageBreak, insertDraftTable, editDraftTable, insertDraftImage, editDraftImage,
        editDraftTitle, updateDraftTitleFromInline, syncDraftTitleInline, updateDraftHeadingFromInline, syncDraftHeadingInline, updateDraftTextFromInline, syncDraftTextInline,
        editDraftQuestion, saveDraftQuestionEdit, configureAnswerArea, saveAnswerAreaConfig,
        removeDraftItem, moveDraftItem, groupDraftByType,
        startOutlineResize,
        useLastImportText, copyLastImportText
    };
})();
