const { generateAIResponse } = require('./ai-service');

const TEST_CASES = [
    {
        name: 'capability list',
        question: '能查什么？',
        expect: /学员[\s\S]*班级[\s\S]*收费[\s\S]*考勤/
    },
    {
        name: 'active grade count',
        question: '六年级有多少在读学员？',
        expect: /六年级在读学员共\s*\d+\s*人/
    },
    {
        name: 'advice question should not become student list',
        question: '我要给小学6年级的学生开小升初的家长会，该怎么开？',
        expect: /家长会|小升初|流程|建议|准备/,
        reject: /在读学员共|学员共\s*\d+\s*人|当前系统|系统摘要|系统数据|名在读学员|个班级|田恩慧|李远森|张雨泽/
    },
    {
        name: 'advice can use system summary when explicitly requested',
        question: '结合我的系统数据，我要给小学6年级的学生开小升初家长会，该怎么开？',
        expect: /家长会|小升初|六年级|系统|数据|班级/
    },
    {
        name: 'exact score with test filter',
        question: '期中考100分的有哪些？',
        expect: /共找到\s*6\s*条100分成绩记录/
    },
    {
        name: 'exact score without test filter',
        question: '考100分的有哪些？',
        expect: /共找到\s*\d+\s*条100分成绩记录/
    },
    {
        name: 'below passing score',
        question: '不及格的有哪些？',
        expect: /不及格成绩记录/
    },
    {
        name: 'student school',
        question: '李远森是哪个学校的？',
        expect: /李远森[\s\S]*学校|天誉实验学校/
    },
    {
        name: 'student fee and hours',
        question: '李远森的课时余额是多少？',
        expect: /剩余\s*-?\d+/
    },
    {
        name: 'student grades',
        question: '李远森的成绩怎么样？',
        expect: /该学生成绩记录|期中/
    },
    {
        name: 'student communication should not become passing-score query',
        question: '李远森沟通过什么？',
        expect: /沟通记录/,
        reject: /不低于60分|成绩记录/
    },
    {
        name: 'class members',
        question: '六创-周六上午9点有哪些学生？',
        expect: /共\s*\d+\s*名学员/
    },
    {
        name: 'class progress',
        question: '六创-周六上午9点课次进度怎么样？',
        expect: /已登记/
    },
    {
        name: 'previous month consumption',
        question: '上个月课消怎么样？',
        expect: /\d{4}-\d{2}\s*课消概览/
    },
    {
        name: 'previous month class consumption',
        question: '六创-周六上午9点上个月课消怎么样？',
        expect: /\d{4}-\d{2}\s*六创-周六上午9点\s*课消概览/
    },
    {
        name: 'current month consumption',
        question: '本月课消情况怎么样？',
        expect: /\d{4}-\d{2}\s*课消概览/
    },
    {
        name: 'student previous month attendance',
        question: '李远森上个月出勤几次？',
        expect: /李远森[\s\S]*\d{4}-\d{2}[\s\S]*出勤/
    },
    {
        name: 'paid fee summary',
        question: '上个月收费多少？',
        expect: /\d{4}-\d{2}\s*已缴收费共\s*\d+/
    },
    {
        name: 'business review',
        question: '本月经营复盘',
        expect: /经营复盘摘要[\s\S]*在读[\s\S]*欠费/
    },
    {
        name: 'weekly business review detailed',
        question: '帮我生成本周经营复盘，重点看课消、欠费、待续费、意向跟进和需要关注的学生。',
        expect: /经营复盘摘要[\s\S]*(优先关注|建议动作)[\s\S]*意向/,
        extra: { answerLength: 'detailed' }
    },
    {
        name: 'teacher priority action list',
        question: '本周我先处理谁？',
        expect: /需要关注|优先关注|剩余课时|欠费/
    },
    {
        name: 'pending fees',
        question: '哪些学生有欠费？',
        expect: /待收款|欠费/
    },
    {
        name: 'risk students',
        question: '哪些学生课时快不够了？',
        expect: /需要关注|剩余课时/
    },
    {
        name: 'prospects',
        question: '意向学员有哪些？',
        expect: /意向学员记录/
    },
    {
        name: 'grade prospects',
        question: '六年级意向学员有哪些？',
        expect: /意向学员记录[\s\S]*六年级|暂无匹配记录/
    },
    {
        name: 'unsupported boundary',
        question: '哪些东西查不到？',
        expect: /目前不能可靠查询[\s\S]*未导入/
    }
];

async function ask(question, extra = {}) {
    return generateAIResponse({
        agent: 'system-agent',
        task: 'system-qa',
        latestQuestion: question,
        userInstruction: question,
        privacyMode: 'named',
        answerLength: 'brief',
        sourceScope: { systemData: true, knowledgeBase: false, webSearch: false },
        modelProvider: 'minimax',
        fallbackOnError: true,
        ...extra
    });
}

async function main() {
    const results = [];
    for (const test of TEST_CASES) {
        const response = await ask(test.question, test.extra || {});
        const result = String(response.result || '');
        const ok = test.expect.test(result) && !(test.reject && test.reject.test(result));
        results.push({
            ok,
            name: test.name,
            question: test.question,
            mode: response.mode,
            queryFactKeys: response.queryFactKeys || [],
            preview: result.split('\n').slice(0, 4).join('\n')
        });
    }

    const followResponse = await ask('按班级分组', {
        conversationHistory: [
            { role: 'user', content: '考100分的有哪些？' },
            { role: 'assistant', content: '上一轮系统回答' }
        ]
    });
    const followText = String(followResponse.result || '');
    results.push({
        ok: /六创|六培/.test(followText),
        name: 'follow-up group by class',
        question: '考100分的有哪些？ -> 按班级分组',
        mode: followResponse.mode,
        queryFactKeys: followResponse.queryFactKeys || [],
        preview: followText.split('\n').slice(0, 5).join('\n')
    });

    const failed = results.filter(item => !item.ok);
    const report = {
        ok: failed.length === 0,
        checkedAt: new Date().toISOString(),
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        results
    };
    console.log(JSON.stringify(report, null, 2));
    if (failed.length) process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
