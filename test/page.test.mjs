import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, page, KERNELS, BAKED, rewrite, body } from '../scripts/make-page.mjs';
import { model, reads, rightSum, wrongSum } from './helpers.mjs';

const root = new URL('..', import.meta.url);
const ROOT = fileURLToPath(root).replace(/[\\/]$/, '');
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const LF = (s) => s.split('\r\n').join('\n');
const html = LF(read('index.html'));
const visible = html.slice(html.indexOf('<body>'), html.indexOf('<script type="module">'));

test('index.html is exactly the build of page/ and the kernels, baked from the published runs', async () => {
  const built = await page(ROOT);
  // on a difference, say where it is: the whole page is too long for a readable diff
  let i = 0; while (i < html.length && html[i] === built[i]) i++;
  assert.equal(html.length === built.length && i === html.length, true, `index.html and the build first differ at character ${i} of ${html.length} (built ${built.length}):\nINDEX: ${JSON.stringify(html.slice(Math.max(0, i - 160), i + 240))}\nBUILT: ${JSON.stringify(built.slice(Math.max(0, i - 160), i + 240))}`);
});

test('every kernel is inlined byte for byte, its imports read from the scopes above it', () => {
  for (const [ns, file] of KERNELS) {
    const { code } = body(read(file), file);
    assert.ok(html.includes(`const ${ns} = (() => {\n${code}\n`), `${file} is not inlined as built`);
    for (const line of LF(read(file)).split('\n')) {
      if (line.startsWith('import ')) assert.ok(rewrite(line, file), `${file}: an import the page cannot inline: ${line}`);
      else if (!line.startsWith('export default ')) assert.ok(code.includes(line.replace(/^export /, '')), `${file}: a line changed: ${line}`);
    }
  }
  // no two kernels share a file name, or an import by name could not tell them apart
  assert.equal(new Set(KERNELS.map(([, f]) => f.split('/').pop())).size, KERNELS.length);
  // what is vendored comes first, as vendored; this repository's own kernels follow; the glass comes last
  const own = KERNELS.findIndex(([, f]) => f.startsWith('src/')); assert.ok(KERNELS.slice(0, own).every(([, f]) => f.startsWith('vendor/'))); assert.ok(KERNELS.slice(own, -1).every(([, f]) => f.startsWith('src/')));
  assert.deepEqual(KERNELS[KERNELS.length - 1], ['GEM', 'page/gem.js']); assert.deepEqual(readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.mjs')).sort(), KERNELS.filter(([, f]) => f.startsWith('src/')).map(([, f]) => f.slice(4)).sort(), 'every kernel of this repository is on the page');
});

test('the page code runs: the inlined kernels decide as the modules do', async () => {
  const built = build(ROOT);
  const kernels = built.slice(built.indexOf('<script type="module">') + 22, built.indexOf('// app.js'));
  const mod = await import('data:text/javascript;base64,' + Buffer.from(kernels + '\nexport { EXACT, BOND, GROW, FUZZ, STRENGTH, CITE, CITEFUZZ, FORMULA, LOGIC, FORMULAFUZZ, LOGICFUZZ, TASKS, WEAVE, COUNTS, ONETRY, CLAIMS, FACETS, SET, GEM };').toString('base64'));
  const imp = async (f) => (await import(`../src/${f}.mjs`)).default, [W, T, C, CF, M, O, CL, FA, SET, S, FX, LX, FF, LF] = await Promise.all(['weave', 'tasks', 'cite', 'citefuzz', 'counts', 'onetry', 'claims', 'facets', 'set', 'strength', 'formula', 'logic', 'formulafuzz', 'logicfuzz'].map(imp));
  const tasks = T.set(20261201, 2); assert.deepEqual(mod.TASKS.set(20261201, 2), tasks);
  let n = 0; const sum = (c) => (n++ % 4 === 0 ? wrongSum(c) : rightSum(c)), a = await mod.WEAVE.run(tasks, model(reads, sum).call, { seed: ['21 × 21 = 441'] });
  n = 0; const b = await W.run(tasks, model(reads, sum).call, { seed: ['21 × 21 = 441'] });
  assert.deepEqual(a, b); for (const s of ['grounded', 'proven', 'proven against its tests', 'proven within its encoding']) assert.ok(a.records.some((r) => r.strength === s), s); assert.ok(a.records.some((r) => r.refused !== null));
  for (const rule of T.RULES.slice(0, 4)) for (const reply of [rule.reference, 'p × c', 'none', '']) assert.deepEqual(mod.FORMULA.judge(reply, rule), FX.judge(reply, rule), reply);
  for (const q of LF.HARD.slice(0, 6)) for (const reply of [q.claim, 'p ≥ 1', 'yes']) assert.deepEqual(mod.LOGIC.judge(reply, q), LX.judge(reply, q), reply);
  assert.deepEqual(mod.FORMULAFUZZ.fuzz(T.RULES.slice(0, 2), { seed: 5 }), FF.fuzz(T.RULES.slice(0, 2), { seed: 5 })); assert.deepEqual(mod.LOGICFUZZ.fuzz(LF.HARD.slice(0, 4), { seed: 5, random: 5 }), LF.fuzz(LF.HARD.slice(0, 4), { seed: 5, random: 5 }));
  assert.deepEqual(mod.FACETS.lattice(['21 × 21 = 441'], a.records, tasks), FA.lattice(['21 × 21 = 441'], b.records, tasks)); assert.deepEqual(mod.COUNTS.measure(a.records, tasks), M.measure(b.records, tasks));
  const pairs = tasks.filter((t) => t.doc).flatMap((t) => t.slots.map((s) => ({ cell: { text: s.text }, doc: t.doc }))).slice(0, 8);
  assert.deepEqual(mod.CITEFUZZ.fuzz(pairs, { seed: 5 }), CF.fuzz(pairs, { seed: 5 })); assert.deepEqual(mod.CITEFUZZ.teeth(pairs, { seed: 5 }), CF.teeth(pairs, { seed: 5 }));
  const doc = { id: 'd', text: 'The unit price is 126 pounds.\nThe order size is 12 crates.' };
  for (const reply of ['The unit price is 126 pounds.', 'The unit price is 12', '126', 'none', '']) assert.deepEqual(mod.CITE.judge(reply, { text: 'the unit price' }, doc), C.judge(reply, { text: 'the unit price' }, doc), reply);
  const one = await O.run(tasks, async () => ({ text: 'It is 5.' }), {}), F0 = { records: b.records, tasks, onetry: one, fuzz: CF.fuzz(pairs, { seed: 5 }), teeth: CF.teeth(pairs, { seed: 5 }) };
  assert.deepEqual(mod.CLAIMS.evaluate(F0), CL.evaluate(F0)); assert.deepEqual(mod.CLAIMS.evaluate(null).map((v) => v.pass), new Array(12).fill(null)); assert.deepEqual(mod.ONETRY.rule('It is 5.', tasks[0]), O.rule('It is 5.', tasks[0]));
  assert.deepEqual(mod.SET.verifiers({ m: M.measure(b.records, tasks) }), SET.verifiers({ m: M.measure(b.records, tasks) })); assert.deepEqual(mod.STRENGTH.label([{ type: 'cited' }, { type: 'computed', on: [0] }]), S.label([{ type: 'cited' }, { type: 'computed', on: [0] }]));
  assert.equal(mod.GEM.stone().count, 24); assert.equal(typeof mod.GEM.createGem, 'function'); assert.ok(mod.GEM.sizeOf('cite') > mod.GEM.sizeOf('seed') && mod.GEM.sizeOf('cite') < mod.GEM.sizeOf('bond'));
});

test('nothing ships as a bare placeholder: every fill target is baked, and an unmeasured value says so', () => {
  assert.ok(!/>\s*…\s*</.test(visible), 'an element whose whole content is an ellipsis is on the page');
  for (const id of BAKED) assert.ok(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id}"[^>]*>`).test(visible), `#${id} is on the page`);
  const tpl = read('page/template.html');
  for (const k of [...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1])) {
    const key = k.replace(/[.$]/g, '\\$&'), inTpl = tpl.match(new RegExp(`data-bind="${key}"[^>]*>([^<]*)<`))[1];
    const m = visible.match(new RegExp(`data-bind="${key}"[^>]*>([\\s\\S]*?)</(?:span|b|p|td)>`));
    assert.ok(m, `data-bind="${k}" is on the built page`);
    if (m[1] === inTpl) assert.match(m[1], /not measured yet/, `data-bind="${k}" was not baked and does not say it is unmeasured`);
  }
});

test('every id and binding the page script uses is on the page, and every binding is filled by the script', () => {
  const tpl = read('page/template.html'), app = read('page/app.js');
  const ids = new Set([...tpl.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(m[1]), `#${m[1]} is used by the script but not on the page`);
  const bound = new Set([...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]));
  const set = new Set([...app.matchAll(/bind\('([^']+)'/g)].map((m) => m[1]));
  for (const k of bound) assert.ok(set.has(k), `data-bind="${k}" is never filled`);
  for (const k of set) assert.ok(bound.has(k), `the script fills "${k}", which is not on the page`);
  for (const k of [...BAKED.map((id) => `id="${id}"`), ...[...bound].map((b) => `data-bind="${b}"`)]) assert.match(tpl, new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${k.replace(/[.$]/g, '\\$&')}[^>]*>[^<]*</\\1>`), `${k} must hold plain text in the template`);
  const seen = new Map(); for (const m of tpl.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  assert.deepEqual([...seen].filter(([, n]) => n > 1).map(([id]) => id), [], 'no two elements share an id');
});

test('the page says what it is and how to use it, in the house identity, with no private symbols and no price list', () => {
  const tpl = read('page/template.html');
  for (const h of ['id="top"', 'id="start"', 'id="how"', 'id="set"', 'id="numbers"', 'id="limits"', 'id="blueprint"', 'id="buyers"', 'id="gem"']) assert.ok(tpl.includes(h), h);
  for (const mark of ['#02070c', "'Fraunces'", "'Hanken Grotesk'", "'JetBrains Mono'", 'It refuses to <em>lie.</em>', "Don't trust us.", 'Re-run it.', 'Nothing leaves your browser.', 'What this does not prove', 'grounded, not proven', 'Powered by the Konomi architecture, created by Thomas Frumkin.', '<canvas id="crystal"', 'id="hsReceipts"', 'id="hsClaims"', '<details class="honest ']) assert.ok(tpl.includes(mark), mark);
  // the fonts are the house kit's, served from this page: no font host is called
  const kit = read('vendor/house/house.css');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic|googletagmanager|analytics/.test(tpl + kit)); const fonts = [...kit.matchAll(/url\('([^']+\.woff2)'\)/g)].map((m) => m[1]); assert.equal(fonts.length, 4); for (const f of fonts) assert.ok(readFileSync(new URL(f, root)).length > 10000, f);
  const shape = ['to', 'rus'].join('');
  for (const f of ['page/template.html', 'page/app.js', 'page/gem.js', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', ...readdirSync(new URL('src/', root)).map((x) => `src/${x}`), ...readdirSync(new URL('scripts/', root)).map((x) => `scripts/${x}`)]) {
    const text = read(f);
    assert.ok(!/[\u25ca\u03ba\u03c6]/.test(text), `${f}: a private symbol`); assert.ok(!text.toLowerCase().includes(shape), `${f}: the private shape-word`);
  }
  assert.ok(/supplied by <a href="https:\/\/www\.ai-nativesolutions\.com">AI Native Solutions<\/a>/i.test(tpl)); assert.ok(/agreed per deployment, in each deployment's agreement/.test(tpl));
  assert.ok(!/[$£€]\s?\d/.test(tpl), 'no price is on the page');
});

test('the table of checks is on the page: four in the design, four built, each with what it put out; and each harness\'s attack', async () => {
  const SET = (await import('../src/set.mjs')).default, CF = (await import('../src/citefuzz.mjs')).default, table = visible.slice(visible.indexOf('id="verifierTable"'), visible.indexOf('</section>', visible.indexOf('id="verifierTable"')));
  let at = 0;
  for (const v of SET.VERIFIERS) { const i = table.indexOf(`<b>${v.name}</b>`, at); assert.ok(i > at, `${v.name} is in the table, in order`); at = i; assert.ok(table.includes(v.strength)); }
  assert.equal((table.match(/not built/g) || []).length, 0, 'nothing is listed as not built'); assert.equal((table.match(/class="pass">built</g) || []).length, 4);
  assert.equal((table.match(/planted leaks its harness found<\/span><br><b class="num">12 of 12 \(100\.0%\)<\/b>/g) || []).length, 4, 'every harness, twelve planted readers each');
  assert.ok(/different rules that bonded<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table)); assert.ok(/claims its solver and second procedure decided differently<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table)); assert.ok(/the limit: formulas built from the tests that bonded<\/span><br><b class="num">(\d+) of \1 \(100\.0%\)<\/b>/.test(table));
  assert.ok(/forged quotes that bonded<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table)); assert.ok(/replies that bonded where nothing can be cited<\/span><br><b class="num">0 of \d+ \(0\.0%\)<\/b>/.test(table));
  const attack = visible.slice(visible.indexOf('id="attackTable"'), visible.indexOf('</details>', visible.indexOf('id="attackTable"')));
  for (const name of [...Object.keys(CF.FORGERIES), ...Object.keys(CF.PLANTED)]) assert.ok(attack.includes(name.replace(/'/g, '&#39;')), name);
  assert.ok(attack.includes('It found 12 of 12.')); assert.ok(attack.includes(`${CF.HARD.length} hard cases kept for every attack`)); assert.ok(!attack.includes('Replies the three opinions did not agree on')); assert.ok(!/class="num fail"/.test(attack));
  // the formula check's attack, with its limit shown, and the solver's
  const FF = (await import('../src/formulafuzz.mjs')).default, LF = (await import('../src/logicfuzz.mjs')).default, part = (id) => visible.slice(visible.indexOf(`id="${id}"`), visible.indexOf('</details>', visible.indexOf(`id="${id}"`)));
  const rules = part('ruleAttack'), claims_ = part('claimAttack');
  for (const name of [...Object.keys(FF.FORGERIES), ...Object.keys(FF.PLANTED)]) assert.ok(rules.includes(name.replace(/'/g, '&#39;')), name); assert.ok(rules.includes('It found 12 of 12.') && rules.includes('The limit, shown:') && !/class="num fail"/.test(rules));
  for (const name of [...Object.keys(LF.FORGERIES), ...Object.keys(LF.PLANTED)]) assert.ok(claims_.includes(name.replace(/'/g, '&#39;')), name); assert.ok(claims_.includes('It found 12 of 12.') && claims_.includes('They differed on 0 of') && !/class="num fail"/.test(claims_));
  // the claims are on the page, each with its registered bar
  const CL = (await import('../src/claims.mjs')).default, claims = visible.slice(visible.indexOf('id="claimsTable"'), visible.indexOf('</table>', visible.indexOf('id="claimsTable"')));
  for (const [id, bar] of Object.entries(CL.BARS)) { assert.ok(claims.includes(`<b>${id}</b> ${CL.NAMES[id].replace(/'/g, '&#39;')}`), id); assert.ok(claims.includes(bar.replace(/'/g, '&#39;').replace(/</g, '&lt;')), `${id} bar`); }
});

test('no private repository name is in anything this repository ships (checked by hash: the names are not listed here)', () => {
  const banned = new Set(JSON.parse(read('data/private-names.sha256.json')).sha256);
  assert.ok(banned.size >= 50);
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const files = ['index.html', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', 'sw.js', 'manifest.webmanifest', 'data/published.json', 'data/settings.json', 'vendor/PROVENANCE.json'];
  for (const dir of ['src', 'scripts', 'test', 'page', 'genome', 'vendor/crystal/src', 'vendor/crystal/vendor/climb/src', 'vendor/crystal/vendor/climb/vendor', 'vendor/docdec/src', '.github/workflows']) for (const f of readdirSync(new URL(`${dir}/`, root))) files.push(`${dir}/${f}`);
  const seen = new Set();
  for (const f of files) for (const tok of read(f).toLowerCase().match(/[a-z0-9_]+(?:-[a-z0-9_]*)*/g) || []) {
    if (seen.has(tok)) continue;
    seen.add(tok);
    const parts = tok.split('-');
    for (let i = 0; i < parts.length; i++) for (let k = i + 1; k <= parts.length; k++) { const run = parts.slice(i, k).join('-'); if (run.length >= 5) assert.ok(!banned.has(sha(run)), `${f} carries a private repository name (a ${run.length}-letter run in "${tok.slice(0, 4)}…")`); }
  }
});

test('the page meets the house standard: the ship gate, and the kit it vendors is the house kit', async () => {
  const STANDARD = (await import('../vendor/house/standard.mjs')).default;
  const r = STANDARD.check(html);
  assert.equal(r.pass, true, r.rules.filter((x) => !x.pass).map((x) => `${x.id} ${x.name}: ${x.why}`).join(' | '));
  assert.ok(r.measured.viewWords <= 1250 && r.measured.longest <= 45, 'no wall of text greets a visitor');
  // every word the page had before the rebuild is still on it: the old sections sit behind a click, none was dropped
  for (const id of ['start', 'how', 'set', 'numbers', 'limits', 'blueprint', 'buyers', 'paper']) assert.ok(new RegExp(`<details class="honest reveal" id="${id}"`).test(html), `the ${id} section is on the page, folded`);
  for (const f of ['house.css', 'crystal.js', 'house.js', 'receipts.mjs', 'standard.mjs']) assert.ok(read(`vendor/house/${f}`).length > 500, f);
});
