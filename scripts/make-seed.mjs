// make-seed.mjs — lay the seed. The seed is every step The Crystal's SEALED run bonded: each cell the model stated
// exactly right there, with its value ("26 × 21 = 546"). The Crystal's run is read from its repository at a commit,
// every step is checked again here by exact arithmetic, and each is kept once. All of them are computed facts, so all
// of them are proven: the seed holds nothing cited.
//   node scripts/make-seed.mjs <path to a checkout of the-crystal> <commit>     write data/seed.json
//   node scripts/make-seed.mjs --check                                          make it again from GitHub and compare
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { evaluate, num, same, show } from '../vendor/crystal/vendor/climb/src/exact.mjs';

const REPO = 'sjgant80-hub/the-crystal', RUN = 'data/runs/sealed.json';
const sha = (b) => createHash('sha256').update(b).digest('hex');
// factsOf(run) → every step the run bonded, once each, in the order the run reached them, each true by exact arithmetic
export function factsOf(run) {
  const seen = new Set(), facts = [];
  for (const rec of (run.crystal && run.crystal.records) || []) for (const e of rec.events || []) {
    if (e.kind !== 'bond') continue;
    const w = evaluate(String(e.cell)), v = num(String(e.value));
    if (w !== null && w.ops === 1 && v !== null && same(w.value, v) && !seen.has(w.canon)) { seen.add(w.canon); facts.push(`${w.shown} = ${show(v)}`); }
  }
  return facts;
}
const build = (bytes, commit) => ({ v: 'the-verifier-set-seed/1', from: `${REPO} ${RUN} at ${commit.slice(0, 7)}`, repo: REPO, commit, runSha256: sha(bytes), facts: factsOf(JSON.parse(bytes.toString('utf8'))) });

if (process.argv[1] && process.argv[1].endsWith('make-seed.mjs')) {
  if (process.argv[2] === '--check') {
    const ours = JSON.parse(readFileSync('data/seed.json', 'utf8'));
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${ours.commit}/${RUN}`);
    if (!r.ok) { console.error(`cannot read The Crystal's sealed run at ${ours.commit}: ${r.status}`); process.exit(1); }
    const same2 = JSON.stringify(build(Buffer.from(await r.arrayBuffer()), ours.commit)) === JSON.stringify(ours);
    console.log(same2 ? `same: ${ours.facts.length} seed steps = every step bonded in ${ours.from}` : 'DIFFERS: data/seed.json is not what The Crystal\'s sealed run gives');
    process.exitCode = same2 ? 0 : 1;
  } else {
    const [from, commitish] = process.argv.slice(2);
    if (!from || !commitish) { console.error('usage: node scripts/make-seed.mjs <path to the-crystal> <commit> | --check'); process.exit(2); }
    const git = (...a) => execFileSync('git', ['-C', from, ...a], { maxBuffer: 256 << 20 });
    const commit = git('rev-parse', commitish).toString('utf8').trim(), seed = build(git('show', `${commit}:${RUN}`), commit);
    writeFileSync('data/seed.json', JSON.stringify(seed, null, 1) + '\n');
    console.log(`data/seed.json: ${seed.facts.length} bonded steps from ${seed.from}`);
  }
}
