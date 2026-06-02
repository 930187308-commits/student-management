const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const config = require('./config');
const { openDatabase, getData, getDataFromEntityTables, getDataFromEntityColumns, getDataUpdatedAt, setData, getCollection, setCollection, upsertCollectionItem, deleteCollectionItem, createBackup, listBackups, restoreBackup, getMeta } = require('./db');
const { createReconciliationReport } = require('./reconcile-sqlite-split');
const { createSqliteMetricsReport, createReportsSummary, createDashboardSummary } = require('./sqlite-metrics');
const { createDataHealthReport } = require('./data-health');
const { convertProspectToStudent, saveClassWithTransitions, finishClass, archiveClass, unarchiveClass, permanentlyDeleteArchivedClass, cleanSafeDataHealthIssues } = require('./actions');
const { getAiStatus, generateAIResponse, listAITasks, listAgentLogs } = require('./ai-service');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const SAMPLE_STUDENT_IDS = new Set(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']);
const SAMPLE_STUDENT_NAMES = new Set(['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '陈十二']);
const API_COLLECTIONS = new Set([
    'classes',
    'students',
    'prospects',
    'fees',
    'attendance',
    'grades',
    'communications',
    'communicationTopics',
    'prospectSources',
    'classTypes',
    'gradeOptions'
]);
const API_ITEM_COLLECTIONS = new Set([
    'classes',
    'students',
    'prospects',
    'fees',
    'attendance',
    'grades',
    'communications'
]);

openDatabase();

function sendJson(res, status, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Accept,X-Base-Data-Updated-At',
        'Access-Control-Expose-Headers': 'X-Data-Updated-At',
        ...extraHeaders
    });
    res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(text),
        'Access-Control-Allow-Origin': '*'
    });
    res.end(text);
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > config.maxJsonBytes) {
                reject(new Error('请求体过大'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function ensureClientDataVersion(req, res) {
    const currentUpdatedAt = getDataUpdatedAt();
    const baseUpdatedAt = req.headers['x-base-data-updated-at'];
    if (currentUpdatedAt && !baseUpdatedAt) {
        sendJson(res, 428, {
            error: '缺少数据版本号，已拒绝覆盖服务器数据',
            hint: '请刷新页面后重试。'
        }, {
            'X-Data-Updated-At': currentUpdatedAt
        });
        return false;
    }
    if (currentUpdatedAt && baseUpdatedAt !== currentUpdatedAt) {
        sendJson(res, 409, {
            error: '服务器数据已被其他设备更新，已拒绝覆盖',
            hint: '请刷新页面加载最新数据后，再重新修改。',
            serverUpdatedAt: currentUpdatedAt,
            clientBaseUpdatedAt: baseUpdatedAt
        }, {
            'X-Data-Updated-At': currentUpdatedAt
        });
        return false;
    }
    return true;
}

function isLikelyBuiltInSampleData(payload) {
    if (config.env === 'development') return false;
    if (!payload || !Array.isArray(payload.students) || !Array.isArray(payload.classes)) return false;
    if (payload.students.length !== SAMPLE_STUDENT_IDS.size) return false;
    if (payload.classes.length < 6) return false;

    const ids = new Set(payload.students.map((student) => student.id));
    const names = new Set(payload.students.map((student) => student.name));
    return [...SAMPLE_STUDENT_IDS].every((id) => ids.has(id)) &&
        [...SAMPLE_STUDENT_NAMES].every((name) => names.has(name));
}

function resolveStaticPath(urlPath) {
    const decodedPath = decodeURIComponent(urlPath);
    const cleanPath = decodedPath === '/' ? '/index.html' : decodedPath;
    const firstSegment = cleanPath.split('/').filter(Boolean)[0] || 'index.html';
    const allowedRootFiles = new Set(['index.html', 'favicon.ico']);
    const allowedDirs = new Set(['css', 'js']);

    if (
        firstSegment.startsWith('.') ||
        (!allowedRootFiles.has(firstSegment) && !allowedDirs.has(firstSegment))
    ) {
        return null;
    }

    const filePath = path.resolve(config.publicRoot, `.${cleanPath}`);
    if (!filePath.startsWith(config.publicRoot)) {
        return null;
    }
    return filePath;
}

function serveStatic(req, res, pathname) {
    const filePath = resolveStaticPath(pathname);
    if (!filePath) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            sendText(res, 404, 'Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Content-Length': stat.size
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

async function handleApi(req, res, pathname) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
            ok: true,
            service: 'student-ai-console',
            env: config.env,
            time: new Date().toISOString()
        });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/meta') {
        sendJson(res, 200, getMeta());
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/sqlite/status') {
        const report = createReconciliationReport();
        sendJson(res, 200, {
            readFullDataFromSqlite: config.readFullDataFromSqlite,
            readFullDataFromSqliteColumns: config.readFullDataFromSqliteColumns,
            ok: report.migrationStatus === 'all_tables_match_snapshot',
            migrationStatus: report.migrationStatus,
            healthMismatches: (report.healthComparison || []).filter(row => row.status !== 'match').length,
            report
        });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/sqlite/metrics') {
        sendJson(res, 200, createSqliteMetricsReport());
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/reports/summary') {
        sendJson(res, 200, createReportsSummary());
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/dashboard/summary') {
        sendJson(res, 200, createDashboardSummary());
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/data-health') {
        sendJson(res, 200, createDataHealthReport());
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/status') {
        sendJson(res, 200, getAiStatus());
        return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/generate') {
        const rawBody = await readRequestBody(req).catch(() => '');
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const result = await generateAIResponse(parsed);
        sendJson(res, 200, result);
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/tasks') {
        sendJson(res, 200, { tasks: listAITasks(50) });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/agent-logs') {
        sendJson(res, 200, { logs: listAgentLogs(50) });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/data-sqlite') {
        sendJson(res, 200, getDataFromEntityTables(), {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/data-sqlite-columns') {
        sendJson(res, 200, getDataFromEntityColumns(), {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    if (req.method === 'PUT' && pathname === '/api/batch') {
        const currentUpdatedAt = getDataUpdatedAt();
        const baseUpdatedAt = req.headers['x-base-data-updated-at'];
        if (currentUpdatedAt && !baseUpdatedAt) {
            sendJson(res, 428, {
                error: '缺少数据版本号，已拒绝覆盖服务器数据',
                hint: '请刷新页面后重试。'
            }, {
                'X-Data-Updated-At': currentUpdatedAt
            });
            return true;
        }
        if (currentUpdatedAt && baseUpdatedAt !== currentUpdatedAt) {
            sendJson(res, 409, {
                error: '服务器数据已被其他设备更新，已拒绝覆盖',
                hint: '请刷新页面加载最新数据后，再重新修改。',
                serverUpdatedAt: currentUpdatedAt,
                clientBaseUpdatedAt: baseUpdatedAt
            }, {
                'X-Data-Updated-At': currentUpdatedAt
            });
            return true;
        }

        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody || '{}');
        const updates = parsed.collections || parsed;
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            sendJson(res, 400, { error: '批量保存内容必须是对象' });
            return true;
        }

        const invalidKeys = Object.keys(updates).filter((key) => !API_COLLECTIONS.has(key));
        if (invalidKeys.length > 0) {
            sendJson(res, 400, { error: `不支持的集合：${invalidKeys.join(', ')}` });
            return true;
        }
        const invalidCollections = Object.entries(updates).filter(([, value]) => !Array.isArray(value));
        if (invalidCollections.length > 0) {
            sendJson(res, 400, { error: `${invalidCollections.map(([key]) => key).join(', ')} 必须是数组` });
            return true;
        }

        const saved = setData({
            ...getData(),
            ...updates,
            lastModified: new Date().toISOString()
        }, `api_batch_${Object.keys(updates).join('_')}`);
        const responsePayload = { updatedAt: getDataUpdatedAt() || null };
        Object.keys(updates).forEach((key) => {
            responsePayload[key] = saved[key];
        });
        sendJson(res, 200, responsePayload, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/backups') {
        sendJson(res, 200, { backups: listBackups(80) });
        return true;
    }

    if (req.method === 'POST' && pathname === '/api/backups') {
        const rawBody = await readRequestBody(req).catch(() => '');
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const backup = createBackup(parsed.reason || 'api');
        sendJson(res, 201, backup);
        return true;
    }

    const restoreMatch = pathname.match(/^\/api\/backups\/(\d+)\/restore$/);
    if (req.method === 'POST' && restoreMatch) {
        const result = restoreBackup(Number(restoreMatch[1]));
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const convertProspectMatch = pathname.match(/^\/api\/actions\/prospects\/([^/]+)\/convert$/);
    if (req.method === 'POST' && convertProspectMatch) {
        if (!ensureClientDataVersion(req, res)) return true;
        const rawBody = await readRequestBody(req).catch(() => '');
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const result = convertProspectToStudent(decodeURIComponent(convertProspectMatch[1]), parsed);
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const finishClassMatch = pathname.match(/^\/api\/actions\/classes\/([^/]+)\/finish$/);
    if (req.method === 'POST' && finishClassMatch) {
        if (!ensureClientDataVersion(req, res)) return true;
        const rawBody = await readRequestBody(req).catch(() => '');
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const result = finishClass(decodeURIComponent(finishClassMatch[1]), parsed);
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    if ((req.method === 'POST' || req.method === 'PUT') && pathname === '/api/actions/classes/save') {
        if (!ensureClientDataVersion(req, res)) return true;
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody || '{}');
        const result = saveClassWithTransitions(parsed.item || parsed.class || parsed, parsed.options || parsed);
        sendJson(res, result.created ? 201 : 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const archiveClassMatch = pathname.match(/^\/api\/actions\/classes\/([^/]+)\/archive$/);
    if (req.method === 'POST' && archiveClassMatch) {
        if (!ensureClientDataVersion(req, res)) return true;
        const result = archiveClass(decodeURIComponent(archiveClassMatch[1]));
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const unarchiveClassMatch = pathname.match(/^\/api\/actions\/classes\/([^/]+)\/unarchive$/);
    if (req.method === 'POST' && unarchiveClassMatch) {
        if (!ensureClientDataVersion(req, res)) return true;
        const result = unarchiveClass(decodeURIComponent(unarchiveClassMatch[1]));
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const deleteArchivedClassMatch = pathname.match(/^\/api\/actions\/classes\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteArchivedClassMatch) {
        if (!ensureClientDataVersion(req, res)) return true;
        const result = permanentlyDeleteArchivedClass(decodeURIComponent(deleteArchivedClassMatch[1]));
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    if (req.method === 'POST' && pathname === '/api/actions/data-health/clean-safe') {
        const rawBody = await readRequestBody(req).catch(() => '');
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        if (!parsed.dryRun && !ensureClientDataVersion(req, res)) return true;
        const result = cleanSafeDataHealthIssues(parsed);
        sendJson(res, 200, result, {
            'X-Data-Updated-At': getDataUpdatedAt() || ''
        });
        return true;
    }

    const collectionMatch = pathname.match(/^\/api\/(classes|students|prospects|fees|attendance|grades|communications|communicationTopics|prospectSources|classTypes|gradeOptions)$/);
    if (collectionMatch) {
        const collectionName = collectionMatch[1];
        if (req.method === 'GET') {
            sendJson(res, 200, {
                [collectionName]: getCollection(collectionName),
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }

        if (req.method === 'POST') {
            if (!API_ITEM_COLLECTIONS.has(collectionName)) {
                sendJson(res, 400, { error: `${collectionName} 不支持单条记录新增` });
                return true;
            }
            if (!ensureClientDataVersion(req, res)) return true;

            const rawBody = await readRequestBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            const item = parsed.item || parsed[collectionName.slice(0, -1)] || parsed;
            const result = upsertCollectionItem(collectionName, item, `api_post_${collectionName}`);
            sendJson(res, result.created ? 201 : 200, {
                item: result.item,
                [collectionName]: result.collection,
                created: result.created,
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }

        if (req.method === 'PUT') {
            if (!ensureClientDataVersion(req, res)) return true;

            const rawBody = await readRequestBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            const items = Array.isArray(parsed) ? parsed : parsed[collectionName];
            if (!Array.isArray(items)) {
                sendJson(res, 400, { error: `${collectionName} 必须是数组` });
                return true;
            }

            const saved = setCollection(collectionName, items, `api_put_${collectionName}`);
            sendJson(res, 200, {
                [collectionName]: saved[collectionName],
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }
    }

    const itemMatch = pathname.match(/^\/api\/(classes|students|prospects|fees|attendance|grades|communications)\/([^/]+)$/);
    if (itemMatch) {
        const collectionName = itemMatch[1];
        const itemId = decodeURIComponent(itemMatch[2]);

        if (req.method === 'GET') {
            const item = getCollection(collectionName).find(current => String(current.id) === itemId);
            if (!item) {
                sendJson(res, 404, { error: '记录不存在' });
                return true;
            }
            sendJson(res, 200, {
                item,
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
            if (!ensureClientDataVersion(req, res)) return true;

            const rawBody = await readRequestBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            const existing = getCollection(collectionName).find(current => String(current.id) === itemId);
            if (!existing && req.method === 'PATCH') {
                sendJson(res, 404, { error: '记录不存在' });
                return true;
            }
            const bodyItem = parsed.item || parsed[collectionName.slice(0, -1)] || parsed;
            const item = req.method === 'PATCH'
                ? { ...existing, ...bodyItem, id: itemId }
                : { ...bodyItem, id: itemId };
            const result = upsertCollectionItem(collectionName, item, `api_${req.method.toLowerCase()}_${collectionName}_${itemId}`);
            sendJson(res, result.created ? 201 : 200, {
                item: result.item,
                [collectionName]: result.collection,
                created: result.created,
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }

        if (req.method === 'DELETE') {
            if (!ensureClientDataVersion(req, res)) return true;

            const result = deleteCollectionItem(collectionName, itemId, `api_delete_${collectionName}_${itemId}`);
            sendJson(res, 200, {
                deleted: result.deleted,
                [collectionName]: result.collection,
                updatedAt: getDataUpdatedAt() || null
            }, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }
    }

    if (pathname === '/data' || pathname === '/api/data') {
        if (req.method === 'GET') {
            const data = config.readFullDataFromSqliteColumns
                ? getDataFromEntityColumns()
                : config.readFullDataFromSqlite
                    ? getDataFromEntityTables()
                    : getData();
            sendJson(res, 200, data, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }

        if (req.method === 'PUT') {
            const currentUpdatedAt = getDataUpdatedAt();
            const baseUpdatedAt = req.headers['x-base-data-updated-at'];
            if (currentUpdatedAt && !baseUpdatedAt) {
                sendJson(res, 428, {
                    error: '缺少数据版本号，已拒绝覆盖服务器数据',
                    hint: '请刷新页面后重试。'
                }, {
                    'X-Data-Updated-At': currentUpdatedAt
                });
                return true;
            }
            if (currentUpdatedAt && baseUpdatedAt !== currentUpdatedAt) {
                sendJson(res, 409, {
                    error: '服务器数据已被其他设备更新，已拒绝覆盖',
                    hint: '请刷新页面加载最新数据后，再重新修改。',
                    serverUpdatedAt: currentUpdatedAt,
                    clientBaseUpdatedAt: baseUpdatedAt
                }, {
                    'X-Data-Updated-At': currentUpdatedAt
                });
                return true;
            }
            const rawBody = await readRequestBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                sendJson(res, 400, { error: '数据必须是对象' });
                return true;
            }
            if (isLikelyBuiltInSampleData(parsed)) {
                sendJson(res, 409, {
                    error: '生产服务器拒绝写入内置示例数据',
                    hint: '请刷新页面使用最新前端，或使用 server/import-json.js 明确导入测试数据。'
                });
                return true;
            }
            const saved = setData(parsed, 'api_put');
            sendJson(res, 200, saved, {
                'X-Data-Updated-At': getDataUpdatedAt() || ''
            });
            return true;
        }
    }

    return false;
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const handled = await handleApi(req, res, url.pathname);
        if (handled) return;

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendJson(res, 405, { error: 'Method not allowed' });
            return;
        }
        serveStatic(req, res, url.pathname);
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            sendJson(res, error.statusCode || 500, { error: error.message || 'Internal server error' });
        } else {
            res.end();
        }
    }
});

server.listen(config.port, config.host, () => {
    console.log(`Student AI Console running at http://${config.host}:${config.port}`);
    console.log(`Database: ${config.dbPath}`);
    console.log(`Backups: ${config.backupDir}`);
});
