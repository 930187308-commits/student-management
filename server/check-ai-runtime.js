const http = require('node:http');
const config = require('./config');
const { buildAIContext } = require('./ai-service');

function requestJson(pathname, options = {}) {
    const body = options.body ? JSON.stringify(options.body) : null;
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: config.port,
            path: pathname,
            method: options.method || 'GET',
            headers: {
                ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
            }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let parsed = {};
                try {
                    parsed = text ? JSON.parse(text) : {};
                } catch (error) {
                    reject(new Error(`响应不是 JSON: ${text.slice(0, 120)}`));
                    return;
                }
                resolve({ statusCode: res.statusCode, body: parsed });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    const status = await requestJson('/api/ai/status');
    const generated = await requestJson('/api/ai/generate', {
        method: 'POST',
        body: {
            agent: 'biz-agent',
            task: 'weekly-report',
            privacyMode: 'masked',
            userInstruction: '运行检查：生成脱敏经营摘要'
        }
    });
    const tasks = await requestJson('/api/ai/tasks');
    const logs = await requestJson('/api/agent-logs');
    const aliasTasks = [
        'class-consumption',
        'tuition-warning',
        'conversion-script',
        'moment-content',
        'schedule-conflict',
        'exercise-recommend'
    ].map(task => {
        try {
            const context = buildAIContext({
                agent: 'biz-agent',
                task,
                privacyMode: 'masked',
                userInstruction: 'alias runtime check'
            });
            return { task, ok: Boolean(context.taskName && context.dataRange?.length) };
        } catch (error) {
            return { task, ok: false, error: error.message };
        }
    });

    const checks = [
        { name: 'status endpoint', ok: Boolean(status.statusCode === 200 && status.body.mode) },
        { name: 'generate endpoint', ok: Boolean(generated.statusCode === 200 && generated.body.success === true && generated.body.taskId) },
        { name: 'local fallback', ok: generated.body.mode === 'local-template' || generated.body.mode === 'real-ai' },
        { name: 'task recorded', ok: tasks.statusCode === 200 && Array.isArray(tasks.body.tasks) && tasks.body.tasks.some(item => item.id === generated.body.taskId) },
        { name: 'agent log recorded', ok: logs.statusCode === 200 && Array.isArray(logs.body.logs) && logs.body.logs.some(item => item.output?.taskId === generated.body.taskId) },
        { name: 'frontend task aliases supported', ok: aliasTasks.every(item => item.ok) }
    ];
    const failed = checks.filter(check => !check.ok);
    const report = {
        ok: failed.length === 0,
        checkedAt: new Date().toISOString(),
        status: status.body,
        generated: {
            taskId: generated.body.taskId,
            mode: generated.body.mode,
            provider: generated.body.provider,
            warnings: generated.body.warnings || []
        },
        aliasTasks,
        checks
    };
    console.log(JSON.stringify(report, null, 2));
    if (failed.length > 0) process.exit(1);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
