import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(root, 'apps/web/dist/tobu-finance/browser');
const apiPort = Number(process.env.PORT || 4000);
const webPort = Number(process.env.WEB_PORT || 4200);
if (apiPort === webPort) throw new Error('PORT and WEB_PORT must differ');
if ([apiPort, webPort].some((port) => !Number.isInteger(port) || port < 1024 || port > 65535)) throw new Error('Invalid PORT/WEB_PORT');
const api = spawn(process.execPath, [resolve(root, 'apps/api/dist/src/server.js')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(apiPort) }
});
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (/^\/(api(?:\/|$)|health(?:\/|$)|ready$|openapi\.json$|docs(?:\/|$))/.test(path)) {
        const upstream = request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: req.headers }, (response) => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
        });
        upstream.on('error', () => {
            if (!res.headersSent) res.writeHead(502);
            res.end('API unavailable');
        });
        req.on('aborted', () => upstream.destroy());
        req.pipe(upstream);
        return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405).end();
        return;
    }
    try {
        let target = resolve(web, '.' + decodeURIComponent(path));
        if (!target.startsWith(web + sep) && target !== web) {
            res.writeHead(403).end();
            return;
        }
        try {
            if (!(await stat(target)).isFile()) target = resolve(web, 'index.html');
        } catch {
            if (extname(path)) {
                res.writeHead(404).end();
                return;
            }
            target = resolve(web, 'index.html');
        }
        const body = await readFile(target);
        res.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
        res.writeHead(400).end();
    }
});
let closing = false;
function close(code = 0) {
    if (closing) return;
    closing = true;
    server.close();
    server.closeAllConnections();
    api.kill('SIGTERM');
    const timeout = setTimeout(() => process.exit(code || 1), 6000);
    if (api.exitCode !== null || api.signalCode !== null) {
        clearTimeout(timeout);
        process.exit(code);
    }
    api.once('exit', () => {
        clearTimeout(timeout);
        process.exit(code);
    });
}
api.on('error', (error) => {
    console.error(error.message);
    close(1);
});
api.on('exit', (code) => {
    if (!closing) close(code || 1);
});
server.on('error', (error) => {
    console.error(error.message);
    close(1);
});
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
server.listen(webPort, '127.0.0.1', () => console.log(`Built web + API proxy on http://localhost:${webPort}`));
