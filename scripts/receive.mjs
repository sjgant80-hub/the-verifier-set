// receive.mjs: a builder's tool. Takes a run that a browser tab on this machine made and writes it to disk, so it
// can be checked and published (scripts/publish.mjs). It listens on 127.0.0.1 only, accepts one kind of request
// (POST /save?name=<letters>), from the page's own local address only, and writes only into data/runs/ under the
// name incoming-<name>.json. It publishes nothing.
//   node scripts/receive.mjs [folder] [port] [page origin]
import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || process.cwd()), port = Number(process.argv[3] || 8819), origin = process.argv[4] || 'http://localhost:8817';
createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), name = url.searchParams.get('name') || '';
  res.setHeader('access-control-allow-origin', origin);
  if (req.method !== 'POST' || url.pathname !== '/save' || !/^[a-z0-9-]{1,40}$/.test(name) || req.headers.origin !== origin) { res.writeHead(400).end('no'); return; }
  const parts = [];
  let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 64 * 1024 * 1024) req.destroy(); else parts.push(c); });
  req.on('end', () => {
    try {
      const text = Buffer.concat(parts).toString('utf8');
      JSON.parse(text);                                             // a run is JSON, or it is not written
      mkdirSync(resolve(root, 'data/runs'), { recursive: true });
      writeFileSync(resolve(root, 'data/runs', `incoming-${name}.json`), text);
      res.writeHead(200).end(`saved ${text.length}`);
      console.log(`saved incoming-${name}.json (${text.length} characters)`);
    } catch (e) { res.writeHead(400).end('not JSON'); }
  });
}).listen(port, '127.0.0.1', () => console.log(`receiving on http://127.0.0.1:${port} for ${origin}`));
