// make-page.mjs — build index.html in two steps.
//   1 build()   page/template.html with every kernel inlined byte for byte in its own scope (its import lines rewritten
//               to read the scopes before it, its "export " keywords and default-export line dropped), then the page script
//   2 bake()    run that same page script here, over a stand-in for the page, and write what it renders (every number,
//               table and chart from the published runs) into the HTML. So the page reads the same with scripts off,
//               and nothing ships as a bare placeholder: a value no run has measured reads "not measured yet".
// In the browser the script renders again from the same data. test/page.test.mjs checks index.html is this build exactly.
//   node scripts/make-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// [namespace, file] in dependency order; each module may import only from the ones above it
export const KERNELS = [
  // the house kit (the crystal, the motion) and the house's receipts reader, as vendored
  ['CRYSTAL', 'vendor/house/crystal.js'], ['HOUSE', 'vendor/house/house.js'], ['RECEIPTS', 'vendor/house/receipts.mjs'],
  // The Climb's sealed kernels, then The Crystal's (both as vendored), DocDec's gate, this repository's own, the glass
  ['SHA', 'vendor/crystal/vendor/climb/src/sha256.mjs'], ['STATS', 'vendor/crystal/vendor/climb/vendor/stats.mjs'], ['MEMORY', 'vendor/crystal/vendor/climb/vendor/memory.mjs'], ['EXACT', 'vendor/crystal/vendor/climb/src/exact.mjs'], ['CHECK', 'vendor/crystal/vendor/climb/src/checker.mjs'],
  ['PLAN', 'vendor/crystal/vendor/climb/src/plan.mjs'], ['LEFT', 'vendor/crystal/vendor/climb/src/left.mjs'], ['KEEP', 'vendor/crystal/vendor/climb/src/keep.mjs'],
  ['BOND', 'vendor/crystal/src/bond.mjs'], ['GROW', 'vendor/crystal/src/grow.mjs'], ['LATTICE', 'vendor/crystal/src/lattice.mjs'], ['FUZZ', 'vendor/crystal/src/fuzz.mjs'], ['MEASURE', 'vendor/crystal/src/measure.mjs'], ['DOCDEC', 'vendor/docdec/src/gate.mjs'],
  ['STRENGTH', 'src/strength.mjs'], ['CITE', 'src/cite.mjs'], ['CITEFUZZ', 'src/citefuzz.mjs'], ['FORMULA', 'src/formula.mjs'], ['LOGIC', 'src/logic.mjs'], ['FORMULAFUZZ', 'src/formulafuzz.mjs'], ['LOGICFUZZ', 'src/logicfuzz.mjs'],
  ['TASKS', 'src/tasks.mjs'], ['WEAVE', 'src/weave.mjs'], ['COUNTS', 'src/counts.mjs'], ['ONETRY', 'src/onetry.mjs'], ['CLAIMS', 'src/claims.mjs'],
  ['FACETS', 'src/facets.mjs'], ['SET', 'src/set.mjs'], ['GEM', 'page/gem.js'],
];
// what bake() writes into the page: these ids, and every data-bind. Device, load and run status are the visitor's own.
export const BAKED = ['hsFacet', 'hsReceipts', 'hsClaims', 'status', 'verifierTable', 'claimsTable', 'reads', 'attackTable', 'ruleAttack', 'claimAttack', 'cost', 'walk'];
const LF = (s) => s.split('\r\n').join('\n');
const nsOf = (spec, from) => {
  const name = spec.split('/').pop();
  const hit = KERNELS.find(([, f]) => f.split('/').pop() === name);
  if (!hit) throw new Error(`${from}: cannot inline the import of ${spec}`);
  return hit[0];
};
// rewrite(line, from) → the import line as a read of an earlier scope, or null when the line is not an import
export function rewrite(line, from) {
  let m = line.match(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/);
  if (m) return `const { ${m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^(\w+)\s+as\s+(\w+)$/, '$1: $2')).join(', ')} } = ${nsOf(m[2], from)};`;
  m = line.match(/^import\s+(\w+)\s+from\s+'([^']+)';\s*$/);
  // a kernel imported under its own scope name needs no line: the scope above is already in reach under that name
  if (m) return m[1] === nsOf(m[2], from) ? `// ${m[1]}: the scope above, under the same name` : `const ${m[1]} = ${nsOf(m[2], from)};`;
  return null;
}
// body(src, file) → the module as page code, and the names it exports
export function body(src, file) {
  const names = [...LF(src).matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)].map((m) => m[1]);
  const code = LF(src).split('\n').filter((l) => !l.startsWith('export default ')).map((l) => rewrite(l, file) ?? l).join('\n').replace(/^export /gm, '').trim();
  return { code, names };
}
export function build(root = '.') {
  const read = (p) => LF(readFileSync(`${root}/${p}`, 'utf8'));
  const kernels = KERNELS.map(([ns, file]) => {
    const { code, names } = body(read(file), file);
    return `// ${file}, inlined byte for byte (imports read the scopes above; export removed)\nconst ${ns} = (() => {\n${code}\nreturn { ${names.join(', ')} };\n})();`;
  }).join('\n\n');
  return read('page/template.html').replace('/*HOUSE_CSS*/', () => read('vendor/house/house.css').trim()).replace('/*KERNELS*/', () => kernels).replace('/*APP*/', () => `${read('page/app.js').trim()}\n\n${read('page/house-app.js').trim()}`);
}

const escText = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let runs = 0;
// bake(html, root) → the html with what the page script renders written into it
export async function bake(html, root = '.') {
  const made = new Map(), binds = new Map();
  const initial = {};
  for (const m of html.matchAll(/<input[^>]*\sid="([^"]+)"[^>]*>/g)) initial[m[1]] = (m[0].match(/\svalue="([^"]*)"/) || [, ''])[1];
  for (const m of html.matchAll(/<select[^>]*\sid="([^"]+)"[^>]*>\s*<option value="([^"]*)"/g)) initial[m[1]] = m[2];
  for (const m of html.matchAll(/<textarea[^>]*\sid="([^"]+)"[^>]*>([^<]*)<\/textarea>/g)) initial[m[1]] = m[2];
  const stub = (key, into) => {
    if (into.has(key)) return into.get(key);
    const e = { id: key, _html: null, value: initial[key] ?? '', style: {}, dataset: {}, disabled: false, addEventListener() {}, click() {}, querySelector() { return stub(`${key}/child`, new Map()); } };
    Object.defineProperty(e, 'innerHTML', { get() { return e._html ?? ''; }, set(v) { e._html = String(v); } });
    Object.defineProperty(e, 'textContent', { get() { return e._html ?? ''; }, set(v) { e._html = escText(v); } });
    into.set(key, e);
    return e;
  };
  const doc = {
    documentElement: { dataset: {} }, getElementById: (id) => stub(id, made), addEventListener() {}, createElement: () => stub('created', new Map()),
    querySelectorAll: (sel) => { const m = sel.match(/^\[data-bind="([^"]+)"\]$/); return m ? [stub(m[1], binds)] : []; },
  };
  const g = globalThis, keep = { document: g.document, window: g.window, fetch: g.fetch, ls: Object.getOwnPropertyDescriptor(g, 'localStorage') };
  const local = { getItem: () => null, setItem() {}, removeItem() {} };
  g.document = doc; g.window = g;
  try { Object.defineProperty(g, 'localStorage', { value: local, configurable: true, writable: true }); } catch { /* the script guards every use */ }
  g.fetch = async (p) => { try { const text = readFileSync(`${root}/${p}`, 'utf8'); return { ok: true, json: async () => JSON.parse(text), text: async () => text }; } catch { return { ok: false, json: async () => null, text: async () => '' }; } };
  try {
    const code = html.slice(html.indexOf('<script type="module">') + 22, html.lastIndexOf('</script>'));
    await import('data:text/javascript;base64,' + Buffer.from(`${code}\n// bake ${++runs}`).toString('base64'));
    await g.__verifier.ready;
    if (g.__houseLayer) await g.__houseLayer;                       // the house layer draws after the page script, and is baked with it
  } finally {
    g.document = keep.document; g.window = keep.window; g.fetch = keep.fetch;
    try { if (keep.ls) Object.defineProperty(g, 'localStorage', keep.ls); else delete g.localStorage; } catch { /* leave it */ }
  }
  let out = html;
  const put = (attr, key, value) => {
    const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\s${attr}="${key.replace(/[.$]/g, '\\$&')}"[^>]*>)[^<]*(</\\2>)`, 'g');
    let n = 0;
    out = out.replace(re, (m, open, tag, close) => { n++; return open + value + close; });
    if (n === 0) throw new Error(`bake: no plain-text element on the page for ${attr}="${key}"`);
  };
  for (const id of BAKED) { const e = made.get(id); if (!e || e._html === null) throw new Error(`bake: the script rendered nothing into #${id}`); put('id', id, e._html); }
  for (const [key, e] of binds) if (e._html !== null) put('data-bind', key, e._html);
  return out;
}
export async function page(root = '.') { return bake(build(root), root); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync('index.html', await page());
  console.log('index.html built and baked');
}
