const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const CHECKS = [
    {
        name: 'SQLite raw /data runtime',
        script: 'server/check-sqlite-runtime.js'
    },
    {
        name: 'SQLite field coverage',
        script: 'server/check-sqlite-field-coverage.js'
    },
    {
        name: 'SQLite field/read parity',
        script: 'server/check-sqlite-field-read-parity.js'
    },
    {
        name: 'Attendance record read parity',
        script: 'server/check-attendance-record-read-parity.js'
    },
    {
        name: 'SQLite column read parity',
        script: 'server/check-sqlite-column-read-runtime.js'
    },
    {
        name: 'SQLite metrics parity',
        script: 'server/check-sqlite-metrics-runtime.js'
    },
    {
        name: 'Reports summary parity',
        script: 'server/check-reports-summary-runtime.js'
    },
    {
        name: 'Dashboard summary parity',
        script: 'server/check-dashboard-summary-runtime.js'
    },
    {
        name: 'Data health parity',
        script: 'server/check-data-health-runtime.js'
    },
    {
        name: 'Collection API parity',
        script: 'server/check-collection-api-runtime.js'
    },
    {
        name: 'Single item API runtime',
        script: 'server/check-single-item-api-runtime.js'
    },
    {
        name: 'Action API runtime',
        script: 'server/check-action-api-runtime.js'
    },
    {
        name: 'AI API runtime',
        script: 'server/check-ai-runtime.js'
    },
    {
        name: 'AI system QA runtime',
        script: 'server/check-ai-system-qa-runtime.js'
    },
    {
        name: 'Knowledge library runtime',
        script: 'server/check-knowledge-runtime.js'
    }
];

function runCheck(check) {
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, [check.script], {
        cwd: PROJECT_ROOT,
        env: process.env,
        encoding: 'utf8',
        timeout: 60_000
    });
    const durationMs = Date.now() - startedAt;

    if (result.status !== 0) {
        return {
            ok: false,
            name: check.name,
            script: check.script,
            durationMs,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            error: result.error ? result.error.message : ''
        };
    }

    return {
        ok: true,
        name: check.name,
        script: check.script,
        durationMs
    };
}

function main() {
    const results = CHECKS.map(runCheck);
    const failed = results.filter(result => !result.ok);
    const report = {
        ok: failed.length === 0,
        checkedAt: new Date().toISOString(),
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        results: results.map(result => ({
            ok: result.ok,
            name: result.name,
            script: result.script,
            durationMs: result.durationMs
        }))
    };

    console.log(JSON.stringify(report, null, 2));

    if (failed.length > 0) {
        failed.forEach(result => {
            console.error(`\n[FAILED] ${result.name} (${result.script})`);
            if (result.error) console.error(result.error);
            if (result.stdout) console.error(result.stdout);
            if (result.stderr) console.error(result.stderr);
        });
        process.exit(1);
    }
}

main();
