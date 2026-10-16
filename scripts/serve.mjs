import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const portArgument = process.argv.indexOf('--port');
const port = Number(portArgument >= 0 ? process.argv[portArgument + 1] : process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const relayOrigin = process.env.RELAY_URL || 'https://mira-relay.raghavraut29.workers.dev';
const relayPath = pathname =>
  pathname === '/config' || pathname === '/health' || pathname === '/upload' || pathname === '/notify' || pathname.startsWith('/footage/');

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (relayPath(pathname)) {
      const headers = { ...request.headers };
      for (const name of ['host', 'connection', 'accept-encoding', 'transfer-encoding', 'content-length']) delete headers[name];
      const init = { method: request.method, headers };
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        init.body = Buffer.concat(chunks);
      }
      try {
        const upstream = await fetch(relayOrigin + request.url, init);
        const body = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
        response.end(body);
      } catch {
        response.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'relay unreachable' }));
      }
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const path = resolve(root, relative);
    const publicFile = relative === 'index.html' || relative === 'styles.css' || relative === 'app.js' || (relative.startsWith('assets/') && path.startsWith(resolve(root, 'assets') + sep));
    if (!path.startsWith(root + sep) || !publicFile || !(await stat(path)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Mira is ready at http://localhost:${port}`));
