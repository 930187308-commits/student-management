const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = process.env.STUDENT_DATA_DIR || '/Users/bzx/Data/student-ai-console';
const LOG_ROOT = process.env.STUDENT_LOG_DIR || '/Users/bzx/Logs/student-ai-console';
const AI_ENV_FILE = process.env.STUDENT_AI_ENV_FILE || path.join(DATA_ROOT, 'ai.env');

function unquoteEnvValue(value) {
    const trimmed = String(value || '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function loadLocalEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    text.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) return;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = unquoteEnvValue(trimmed.slice(eqIndex + 1));
        if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
        process.env[key] = value;
    });
    return true;
}

const aiEnvFileLoaded = loadLocalEnvFile(AI_ENV_FILE);

const defaultAiProvider = process.env.AI_PROVIDER || 'disabled';
const defaultMinimaxModel = process.env.MINIMAX_MODEL || process.env.AI_MODEL || 'MiniMax-M2.7-highspeed';
const defaultMinimaxBaseUrl = process.env.MINIMAX_BASE_URL || process.env.AI_BASE_URL || 'https://api.minimax.io/v1';
const aiProviders = {
    minimax: {
        provider: 'minimax',
        label: 'MiniMax',
        apiKey: process.env.MINIMAX_API_KEY || process.env.AI_API_KEY || '',
        model: defaultMinimaxModel,
        baseUrl: defaultMinimaxBaseUrl
    },
    deepseek: {
        provider: 'deepseek',
        label: 'DeepSeek',
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.QUESTION_IMPORT_AI_API_KEY || '',
        model: process.env.DEEPSEEK_MODEL || process.env.QUESTION_IMPORT_AI_MODEL || 'deepseek-v4-flash',
        baseUrl: process.env.DEEPSEEK_BASE_URL || process.env.QUESTION_IMPORT_AI_BASE_URL || 'https://api.deepseek.com'
    },
    qwen: {
        provider: 'qwen',
        label: 'Qwen',
        apiKey: process.env.QWEN_API_KEY || '',
        model: process.env.QWEN_MODEL || 'qwen-plus',
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    }
};

const config = {
    env: process.env.STUDENT_CONSOLE_ENV || 'production',
    host: process.env.STUDENT_SERVER_HOST || '0.0.0.0',
    port: Number(process.env.STUDENT_SERVER_PORT || 3000),
    projectRoot: PROJECT_ROOT,
    publicRoot: PROJECT_ROOT,
    dataRoot: DATA_ROOT,
    logRoot: LOG_ROOT,
    dbPath: process.env.STUDENT_DB_PATH || path.join(DATA_ROOT, 'production.sqlite'),
    backupDir: process.env.STUDENT_BACKUP_DIR || path.join(DATA_ROOT, 'backups'),
    maxJsonBytes: Number(process.env.STUDENT_MAX_JSON_BYTES || 10 * 1024 * 1024),
    readFullDataFromSqlite: process.env.STUDENT_READ_FULL_DATA_FROM_SQLITE === '1',
    readFullDataFromSqliteColumns: process.env.STUDENT_READ_FULL_DATA_FROM_SQLITE_COLUMNS === '1',
    ai: {
        provider: defaultAiProvider,
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || '',
        baseUrl: process.env.AI_BASE_URL || '',
        timeoutMs: Number(process.env.AI_TIMEOUT_MS || 60000),
        logFullInput: process.env.AI_LOG_FULL_INPUT === '1',
        envFile: AI_ENV_FILE,
        envFileLoaded: aiEnvFileLoaded,
        providers: aiProviders,
        questionImport: {
            provider: process.env.QUESTION_IMPORT_AI_PROVIDER || '',
            apiKey: process.env.QUESTION_IMPORT_AI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.QWEN_API_KEY || '',
            model: process.env.QUESTION_IMPORT_AI_MODEL || '',
            baseUrl: process.env.QUESTION_IMPORT_AI_BASE_URL || '',
            timeoutMs: Number(process.env.QUESTION_IMPORT_AI_TIMEOUT_MS || 15000)
        }
    }
};

module.exports = config;
