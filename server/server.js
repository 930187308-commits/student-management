const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const config = require('./config');
const { openDatabase, getData, setData, createBackup, getMeta } = require('./db');

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

openDatabase();

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Accept'
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

    if (req.method === 'POST' && pathname === '/api/backups') {
        const backup = createBackup('api');
        sendJson(res, 201, backup);
        return true;
    }

    if (pathname === '/data' || pathname === '/api/data') {
        if (req.method === 'GET') {
            sendJson(res, 200, getData());
            return true;
        }

        if (req.method === 'PUT') {
            const rawBody = await readRequestBody(req);
            const parsed = JSON.parse(rawBody || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                sendJson(res, 400, { error: '数据必须是对象' });
                return true;
            }
            const saved = setData(parsed, 'api_put');
            sendJson(res, 200, saved);
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
            sendJson(res, 500, { error: error.message || 'Internal server error' });
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
