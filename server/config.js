const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = process.env.STUDENT_DATA_DIR || '/Users/bzx/Data/student-ai-console';
const LOG_ROOT = process.env.STUDENT_LOG_DIR || '/Users/bzx/Logs/student-ai-console';

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
        provider: process.env.AI_PROVIDER || 'disabled',
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL || '',
        baseUrl: process.env.AI_BASE_URL || '',
        timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30000),
        logFullInput: process.env.AI_LOG_FULL_INPUT === '1'
    }
};

module.exports = config;
