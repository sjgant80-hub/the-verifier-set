// serve.mjs: a static server for previewing the page on this machine (127.0.0.1 only). Nothing is cached, so an
// edited file is the file the browser gets.
//   node scripts/serve.mjs [folder] [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/plain; charset=utf-8' };
const root = resolve(process.argv[2] || process.cwd()), port = Number(process.argv[3] || process.env.PORT || 8817);
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(b); }
  catch { res.writeHead(404).end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
