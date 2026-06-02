const {
    listResource,
    getResource,
    upsertResource,
    deleteResource,
    getKnowledgeSummary
} = require('./knowledge-service');
const { getDb } = require('./db');

const TEST_IDS = {
    source: 'runtime-check-source',
    chunk: 'runtime-check-chunk',
    profile: 'runtime-check-style',
    sample: 'runtime-check-sample',
    question: 'runtime-check-question',
    aiTask: 'runtime-check-ai-task',
    ref: 'runtime-check-context-ref'
};

function cleanup() {
    [
        ['aiContextRefs', TEST_IDS.ref],
        ['questionItems', TEST_IDS.question],
        ['styleSamples', TEST_IDS.sample],
        ['styleProfiles', TEST_IDS.profile],
        ['knowledgeChunks', TEST_IDS.chunk],
        ['knowledgeSources', TEST_IDS.source]
    ].forEach(([resourceName, id]) => {
        try {
            deleteResource(resourceName, id);
        } catch {
            // Ignore missing cleanup records.
        }
    });
    try {
        getDb().prepare('DELETE FROM ai_tasks WHERE id = ?').run(TEST_IDS.aiTask);
    } catch {
        // Ignore missing cleanup records.
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    cleanup();

    const source = upsertResource('knowledgeSources', {
        id: TEST_IDS.source,
        title: '运行检查资料',
        sourceType: 'manual',
        category: 'resource',
        subCategory: 'runtime',
        grade: '初一',
        tags: ['运行检查', '资料库'],
        summary: '用于验证资料库后端表可写可读。',
        rawText: '这是一条运行检查资料。'
    }).item;

    const chunk = upsertResource('knowledgeChunks', {
        id: TEST_IDS.chunk,
        sourceId: source.id,
        chunkIndex: 1,
        title: '运行检查片段',
        content: '资料片段内容',
        tags: '运行检查,片段'
    }).item;

    const profile = upsertResource('styleProfiles', {
        id: TEST_IDS.profile,
        name: '运行检查风格',
        rulesText: '简洁、克制、可复制。',
        forbiddenWords: ['保证提升'],
        preferredPhrases: ['先把基础打稳'],
        platform: 'general',
        isDefault: false
    }).item;

    const sample = upsertResource('styleSamples', {
        id: TEST_IDS.sample,
        profileId: profile.id,
        title: '运行检查样本',
        sampleType: 'article',
        content: '学习规划要先看基础，再看习惯。',
        quality: 'good',
        tags: ['样本']
    }).item;

    const question = upsertResource('questionItems', {
        id: TEST_IDS.question,
        grade: '初一',
        system: '校内',
        chapter: '有理数',
        knowledgePoints: ['有理数加减'],
        questionType: '计算题',
        difficulty: 'basic',
        sourceId: source.id,
        stem: '计算：1 + (-2)',
        answer: '-1',
        solution: '异号相加，取绝对值较大数的符号。',
        errorTags: ['符号错误']
    }).item;

    getDb().prepare(`
        INSERT INTO ai_tasks (id, task_type, title, input_json, output_text, status, related_type, related_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        TEST_IDS.aiTask,
        'runtime-check',
        '运行检查 AI 任务',
        '{}',
        '',
        'done',
        '',
        '',
        new Date().toISOString(),
        new Date().toISOString()
    );

    const ref = upsertResource('aiContextRefs', {
        id: TEST_IDS.ref,
        aiTaskId: TEST_IDS.aiTask,
        refType: 'source',
        refId: source.id,
        title: source.title,
        summary: source.summary
    }).item;

    const sourceAgain = getResource('knowledgeSources', source.id);
    const listedSources = listResource('knowledgeSources', { q: '运行检查' });
    const listedQuestions = listResource('questionItems', { grade: '初一' });
    const summary = getKnowledgeSummary();

    const checks = [
        { name: 'source created', ok: sourceAgain.id === TEST_IDS.source && sourceAgain.tags.includes('资料库') },
        { name: 'chunk created', ok: chunk.sourceId === source.id && chunk.tags.includes('片段') },
        { name: 'profile created', ok: profile.forbiddenWords.includes('保证提升') },
        { name: 'sample created', ok: sample.profileId === profile.id },
        { name: 'question created', ok: question.knowledgePoints.includes('有理数加减') },
        { name: 'context ref created', ok: ref.refId === source.id },
        { name: 'search works', ok: listedSources.some(item => item.id === source.id) },
        { name: 'filter works', ok: listedQuestions.some(item => item.id === question.id) },
        { name: 'summary works', ok: summary.sources >= 1 && summary.questions >= 1 }
    ];

    const failed = checks.filter(check => !check.ok);
    const report = {
        ok: failed.length === 0,
        checkedAt: new Date().toISOString(),
        summary,
        checks
    };
    console.log(JSON.stringify(report, null, 2));

    cleanup();
    assert(failed.length === 0, `知识库运行检查失败：${failed.map(item => item.name).join(', ')}`);
}

try {
    main();
} catch (error) {
    cleanup();
    console.error(error);
    process.exit(1);
}
