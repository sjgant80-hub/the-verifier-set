// publish.mjs — take a run that a browser tab made (saved from the page) and publish it, after checking it: it must
// be the complete set it says it is, a sealed run must have been made under this repository's seal, every problem
// must come out identically when grown again from its recorded replies with no model, and so must every one of the
// unchecked replies. Nothing is edited: the file is copied as saved.
//   node scripts/publish.mjs <run file> sealed|dev      publish a run
//   node scripts/publish.mjs --check                     check the published runs again, in place (CI does this)
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import W from '../src/weave.mjs';
import O from '../src/onetry.mjs';
import T from '../src/tasks.mjs';

const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const settings = rd('data/settings.json'), pub = rd('data/published.json');
const seed = () => (pub.seed && existsSync(pub.seed) ? rd(pub.seed).facts : []);
const fail = (why) => { console.error(`not published: ${why}`); process.exit(1); };

// check(run, set) → a line of what was checked; exits with the reason if anything is wrong
export async function check(run, set) {
  const s = settings.sets[set];
  if (!s) fail(`there is no set called ${set}`);
  const tasks = T.set(s.seed, s.sheets);
  if (run.set !== set || run.complete !== true) fail(`the run is not the complete ${set} set`);
  if (set === 'sealed') { const seal = hash('SEAL.json'); if (run.sealSha256 !== seal) fail(`the run records seal ${String(run.sealSha256).slice(0, 12)}, this repository's is ${seal.slice(0, 12)}`); }
  const records = run.lattice && run.lattice.records, one = run.onetry && run.onetry.records;
  for (const [name, recs] of [['lattice', records], ['one-reply', one]]) if (!Array.isArray(recs) || recs.length !== tasks.length || !tasks.every((t, i) => recs[i].id === t.id)) fail(`the ${name} records do not cover every problem once, in order`);
  const again = await W.replay(tasks, records, { citeTokens: settings.citeTokens, maxTicks: settings.maxTicks, maxTokens: settings.maxTokens, mem: settings.mem, seed: seed() });
  const differ = again.records.filter((r, i) => JSON.stringify(r) !== JSON.stringify(records[i])).length;
  if (differ) fail(`${differ} problems do not come out identically from their recorded replies`);
  if (JSON.stringify(again.memory) !== JSON.stringify(run.lattice.memory) || again.seeds !== run.lattice.seeds || again.cited !== run.lattice.cited) fail('the memory, the seed and the cited figures do not come out the same');
  const once = await O.replay(tasks, one);
  const off = once.records.filter((r, i) => JSON.stringify(r) !== JSON.stringify(one[i])).length;
  if (off) fail(`${off} unchecked replies are not ruled on the same way from the record`);
  return `${set}: ${run.model}, ${run.gpu}, ${run.seconds} s in ${run.segments} sitting(s), ${run.privacy ? run.privacy.requests : '?'} network requests; ${records.length} problems grown again identically, ${one.length} unchecked replies ruled on again identically`;
}

if (process.argv[1] && process.argv[1].endsWith('publish.mjs')) {
  if (process.argv[2] === '--check') {
    let n = 0;
    for (const set of ['sealed', 'dev']) if (pub[set] && existsSync(pub[set])) { console.log(await check(rd(pub[set]), set)); n++; }
    if (n === 0) console.log('no run is published yet');
  } else {
    const [file, what] = process.argv.slice(2);
    if (!file || !existsSync(file) || !['sealed', 'dev'].includes(what)) fail('usage: node scripts/publish.mjs <file> sealed|dev');
    console.log(await check(rd(file), what));
    const out = `data/runs/${what}.json`;
    copyFileSync(file, out);
    pub[what] = out;
    writeFileSync('data/published.json', JSON.stringify(pub, null, 1) + '\n');
  }
}
