import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import LAT from '../src/facets.mjs';
import SET from '../src/set.mjs';
import S from '../src/strength.mjs';
import W from '../src/weave.mjs';
import M from '../src/counts.mjs';
import T from '../src/tasks.mjs';
import CF from '../src/citefuzz.mjs';
import FF from '../src/formulafuzz.mjs';
import LF from '../src/logicfuzz.mjs';
import F from '../vendor/crystal/src/fuzz.mjs';
import B from '../vendor/crystal/src/bond.mjs';
import C from '../src/cite.mjs';
import FX from '../src/formula.mjs';
import LX from '../src/logic.mjs';
import { model, reads, rightSum, wrongSum, rightRule, rightClaim } from './helpers.mjs';

const DEV = T.set(20261201, 5), by = (tier) => DEV.find((t) => t.tier === tier);
const emit = (rows, type) => Object.fromEntries(rows.find((r) => r.type === type).emits.map((e) => [e.label, e.value]));

test('one labelled lattice: every facet carries the kind of bond that made it and how true it is', async () => {
  const tasks = [by('computed'), by('mixed'), by('cited'), by('absent')];
  const out = await W.run(tasks, model(reads, rightSum).call, {}), L = LAT.lattice(['21 × 21 = 441'], out.records, tasks);
  const of = (p) => L.cells.filter((c) => c.problem === p);
  // the seed and a problem with no document: computed, proven, hard
  assert.deepEqual(of(-1).map((c) => [c.kind, c.type, c.strength, c.soft, c.material]), [['seed', 'computed', 'proven', false, 0]]); for (const c of of(0)) assert.deepEqual([c.type, c.strength, c.soft, c.material, c.says], ['computed', 'proven', false, 0, 'Proven: exact arithmetic all the way down.']);
  assert.deepEqual(of(0).map((c) => c.kind), [...out.records[0].crystal.events.filter((e) => e.kind === 'bond').map(() => 'bond'), 'home']);
  // a problem that cites: its figures are cited cells, and every step and the answer above them is grounded and soft
  const mixed = of(1), n = tasks[1].slots.length;
  assert.deepEqual(mixed.slice(0, n).map((c) => [c.kind, c.type, c.strength, c.soft, c.material]), tasks[1].slots.map(() => ['cite', 'cited', 'grounded', true, 1]));
  assert.deepEqual(mixed.slice(0, n).map((c) => c.text), out.records[1].cites.map((c) => `${c.cell} = ${c.value}`)); assert.deepEqual(mixed.slice(0, n).map((c) => c.source), out.records[1].cites.map((c) => c.source));
  for (const c of mixed.slice(n)) { assert.deepEqual([c.type, c.strength, c.soft, c.material, c.source], ['computed', 'grounded', true, 1, null]); assert.equal(c.says, 'Grounded, not proven: it is, or it stands on, a step that was found word for word in a source. It can be no truer than that.'); }
  assert.equal(mixed[mixed.length - 1].kind, 'home'); assert.equal(mixed[mixed.length - 1].text, `${tasks[1].statement} = ${tasks[1].check.value}`);
  // the steps stand on the figures: a link runs from a cited cell to the first step that uses its number
  const idx = (c) => L.cells.indexOf(c); assert.ok(L.links.some((l) => l.from === idx(mixed[0]) && L.cells[l.to].problem === 1 && L.cells[l.to].type === 'computed'));
  // a figure cited alone is a crystal of one cited cell and its answer, both grounded
  assert.deepEqual(of(2).map((c) => [c.kind, c.strength]), [['cite', 'grounded'], ['home', 'grounded']]);
  // a figure that is not there: a shattered cell with the reason on it, no answer, and nothing bonded for it
  const dark = of(3).filter((c) => c.kind === 'dissolve'); assert.equal(dark.length, 1); assert.equal(dark[0].text, `${out.records[3].cites.find((c) => c.kind === 'dark').cell}: not in the document`); assert.deepEqual([dark[0].type, dark[0].strength, dark[0].soft, dark[0].material, dark[0].says], [null, null, false, 0, null]);
  assert.ok(!of(3).some((c) => c.kind === 'home')); assert.ok(of(3).filter((c) => c.kind === 'cite').length === tasks[3].slots.length - 1);
  // the counts: cited cells apart from steps, each strength apart
  const cells = L.cells; assert.equal(L.counts.cited, cells.filter((c) => c.kind === 'cite').length); assert.equal(L.counts.bond, cells.filter((c) => c.kind === 'bond').length); assert.equal(L.counts.grounded, cells.filter((c) => c.strength === 'grounded').length);
  assert.equal(L.counts.proven, cells.filter((c) => c.strength === 'proven').length); assert.equal(L.counts.grounded + L.counts.proven, cells.filter((c) => ['seed', 'bond', 'cite', 'home'].includes(c.kind)).length); assert.equal(L.counts.problems, 4); assert.equal(L.counts.complete, 3);
  assert.equal(new Set(cells.map((c) => c.site)).size, cells.length, 'every cell has a place of its own');
  // depth is the round a facet set in: the figures are a problem's first round, and each step stands one round above where The Crystal grew it
  assert.deepEqual(of(0).map((c) => c.depth), [...out.records[0].crystal.events.map((e) => e.tick), out.records[0].crystal.events.length + 1]); assert.deepEqual(mixed.slice(0, n).map((c) => c.depth), tasks[1].slots.map(() => 1));
  assert.deepEqual(mixed.slice(n, -1).map((c) => c.depth), out.records[1].crystal.events.map((e) => e.tick + 1)); assert.ok(out.records[0].crystal.events.length >= 2 && of(0)[1].depth === 2);
  // the answer is named by its question; with no problem to name it, by its calculation; with neither, by its record
  const home = (rs, ts) => LAT.lattice([], rs, ts).cells.filter((c) => c.kind === 'home').map((c) => c.text);
  assert.deepEqual(home(out.records.slice(0, 2), tasks.slice(0, 2)), [`${tasks[0].statement} = ${tasks[0].check.value}`, `${tasks[1].statement} = ${tasks[1].check.value}`]); assert.deepEqual(home(out.records.slice(0, 2), []), [`${tasks[0].ask} = ${tasks[0].check.value}`, `${out.records[1].ask} = ${tasks[1].check.value}`]);
  assert.deepEqual(home(out.records.slice(0, 2).map((r) => ({ ...r, ask: null })), []), [`${tasks[0].id} = ${tasks[0].check.value}`, `${tasks[1].id} = ${tasks[1].check.value}`]); assert.notEqual(out.records[1].ask, tasks[1].statement);
  // what is in a record's steps and is not a step is passed over: the lattice is the lattice of the steps that are there
  const dirty = out.records.map((r) => ({ ...r, cites: [null, 7, ...r.cites], crystal: r.crystal && { ...r.crystal, events: [null, 7, 'x', ...r.crystal.events] } }));
  assert.deepEqual(LAT.lattice(['21 × 21 = 441'], dirty, tasks), L);
});

test('the rule and the claim on the glass: each its own kind of cell, of its own material, and what stands on it no stronger', async () => {
  const tasks = [by('coded'), by('coded-cited'), by('decided'), by('decided-cited')], out = await W.run(tasks, model(reads, rightSum).call, {}), L = LAT.lattice([], out.records, tasks), of = (p) => L.cells.filter((c) => c.problem === p);
  const row = (c) => [c.kind, c.type, c.strength, c.material, c.soft];
  // coded: the rule is tested, and every step worked out from it, and the answer, are proven against its tests
  const coded = of(0); assert.deepEqual(row(coded[0]), ['rule', 'executed', 'proven against its tests', 2, false]); assert.equal(coded[0].text, `rule = ${out.records[0].rule.value}`); assert.equal(coded[0].depth, 1);
  for (const c of coded.slice(1)) assert.deepEqual(row(c), [c.kind, 'computed', 'proven against its tests', 2, false]); assert.equal(coded[1].depth, 2); assert.equal(coded[coded.length - 1].kind, 'home');
  assert.equal(coded[1].says, 'Proven against its tests, not proven: it is, or it stands on, a step that passed every test it was given. It can be no truer than that.');
  // coded-cited: the figures are grounded, the rule tested, and everything worked out from both is grounded
  const cc = of(1), n = tasks[1].slots.length; assert.deepEqual(cc.slice(0, n).map(row), tasks[1].slots.map(() => ['cite', 'cited', 'grounded', 1, true])); assert.deepEqual(row(cc[n]), ['rule', 'executed', 'proven against its tests', 2, false]); assert.equal(cc[n].depth, 2);
  for (const c of cc.slice(n + 1)) assert.deepEqual([c.type, c.strength, c.material], ['computed', 'grounded', 1]); assert.equal(cc[n + 1].depth, 3);
  // decided: the claim is decided within its encoding, and so is the answer; decided-cited: grounded on its figures
  const dd = of(2); assert.deepEqual(dd.map(row), [['claim', 'logical', 'proven within its encoding', 3, false], ['home', 'computed', 'proven within its encoding', 3, false]]); assert.equal(dd[0].text, `${out.records[2].claim.claim}? = ${out.records[2].answer}`); assert.equal(dd[1].text, `${tasks[2].statement} = ${tasks[2].check.value}`);
  const dc = of(3), m = tasks[3].slots.length; assert.deepEqual(dc.map(row), [...tasks[3].slots.map(() => ['cite', 'cited', 'grounded', 1, true]), ['claim', 'logical', 'grounded', 1, true], ['home', 'computed', 'grounded', 1, true]]); assert.equal(dc[m].depth, 2);
  assert.deepEqual([L.counts.cited, L.counts.rules, L.counts.claims], [tasks[1].slots.length + m, 2, 2]); assert.equal(L.counts.bond, L.cells.filter((c) => c.kind === 'bond').length);
  for (const s of S.ORDER) assert.equal(L.counts[s], L.cells.filter((c) => c.strength === s).length, s); assert.deepEqual(LAT.MATERIAL, { proven: 0, grounded: 1, 'proven against its tests': 2, 'proven within its encoding': 3 });
  // a rule that failed, and a claim that could not be decided: shattered cells with the reason, nothing above them
  const bad = await W.run(tasks.slice(0, 3), model(reads, rightSum, () => '× ×', () => 'yes').call, {}), B2 = LAT.lattice([], bad.records, tasks.slice(0, 3));
  assert.deepEqual(B2.cells.filter((c) => c.kind === 'dissolve').map((c) => [c.text, c.strength, c.material]), [['rule: not a formula', null, 0], ['rule: not a formula', null, 0], ['claim: not one comparison', null, 0]]); assert.ok(!B2.cells.some((c) => c.kind === 'home'));
  // a model that wrote a claim the wrong way round: decided, about the wrong claim, and labelled exactly as a right one is
  const turned = await W.run([tasks[2]], model(reads, rightSum, rightRule, (c) => rightClaim(c).replace(/[≥>]/, '<').replace('≤', '>')).call, {}), T2 = LAT.lattice([], turned.records, [tasks[2]]);
  assert.deepEqual(T2.cells.map((c) => c.strength), ['proven within its encoding', 'proven within its encoding']);
});

test('the law holds on the whole dev set, whatever the model says: no facet stands stronger than what is under it', async () => {
  for (const [read, sum, rule] of [[reads, rightSum, rightRule], [reads, wrongSum, rightRule], [() => 'none', rightSum, () => 'none'], [reads, rightSum, (w) => rightRule(w).replace(/ [×+] /, ' - ')]]) {
    const out = await W.run(DEV, model(read, sum, rule).call, {}), L = LAT.lattice([], out.records, DEV);
    for (const c of L.cells) {
      const r = out.records[c.problem], cites = r.cites.some((x) => x.value !== null), ruled = r.rule !== null && r.rule.value !== null, claimed = r.claim !== null && r.claim.value !== null;
      if (c.strength !== null) assert.equal(c.strength, c.kind === 'rule' ? 'proven against its tests' : c.kind === 'cite' ? 'grounded' : cites ? 'grounded' : ruled ? 'proven against its tests' : claimed ? 'proven within its encoding' : 'proven', `${r.id} ${c.text}`);
      assert.equal(c.soft, c.strength === 'grounded'); assert.equal(c.material, LAT.MATERIAL[c.strength] ?? 0); assert.ok(c.strength === null || S.ORDER.includes(c.strength));
    }
    assert.equal(L.counts.cited, out.records.reduce((a, r) => a + r.cites.filter((c) => c.kind === 'bond').length, 0));
    assert.deepEqual(LAT.lattice([], (await W.replay(DEV, out.records, {})).records, DEV), L, 'the same run again is the same lattice');
  }
  // a figure held from an earlier problem is not a second cell: it pulses on the cell that holds it
  const t = by('mixed'), twice = await W.run([t, { ...t, id: 'again:1' }], model(reads, rightSum).call, {}), L2 = LAT.lattice([], twice.records, [t, { ...t, id: 'again:1' }]);
  assert.equal(L2.counts.cited, t.slots.length); assert.ok(L2.pulses.length >= t.slots.length); assert.ok(L2.cells.filter((c) => c.problem === 1).every((c) => c.strength === 'grounded' || c.strength === null));
  for (const bad of [null, undefined, 7, 'x', {}, [null, 7, {}, { cites: 5, crystal: 9, rule: 7, claim: 'x' }, { cites: [null, { value: '5' }, { value: null }], rule: { value: null }, claim: { value: 'yes' } }]]) assert.doesNotThrow(() => LAT.lattice(bad, bad, bad));
  assert.deepEqual(LAT.lattice(null, null, null).cells, []);
});

test('the verifier set: four kinds of check in the design, four built, each with its watcher and its limit', async () => {
  assert.deepEqual(SET.VERIFIERS.map((v) => [v.type, v.name, v.status, v.strength]), [['computed', 'Computational', 'built', 'proven'], ['cited', 'Evidential', 'built', 'grounded'], ['logical', 'Logical', 'built', 'proven within its encoding'], ['executed', 'Executable', 'built', 'proven against its tests']]);
  assert.deepEqual(SET.VERIFIERS.map((v) => v.type).sort(), Object.keys(S.TYPES).sort()); for (const v of SET.VERIFIERS) { assert.equal(v.strength, S.TYPES[v.type].strength); assert.deepEqual(Object.keys(v), ['type', 'name', 'asks', 'check', 'floor', 'strength', 'no', 'watcher', 'ends', 'status']); }
  // every check names a file that is there, and its watcher too
  for (const v of SET.VERIFIERS) for (const f of [v.check, v.watcher]) assert.doesNotThrow(() => readFileSync(new URL(`../${f}`, import.meta.url)), f);
  assert.equal(SET.VERIFIERS[0].ends, `one reply, ${B.LIMIT} characters at most; attacked with ${F.BUDGET.forged + F.BUDGET.honest + F.BUDGET.noise} replies a step`); assert.equal(SET.VERIFIERS[0].ends, 'one reply, 200 characters at most; attacked with 108 replies a step');
  assert.equal(SET.VERIFIERS[1].ends, `one quote, ${C.LIMIT} characters at most, asked once; attacked with up to ${CF.BUDGET.forged + CF.BUDGET.honest + CF.BUDGET.noise} replies a figure`); assert.equal(SET.VERIFIERS[1].ends, 'one quote, 300 characters at most, asked once; attacked with up to 102 replies a figure');
  assert.equal(SET.VERIFIERS[2].ends, `one comparison, ${LX.LIMIT} characters at most, each quantity once; a small exact solver, not a general one; attacked with ${LF.BUDGET.claims} claims a question`); assert.equal(SET.VERIFIERS[2].ends, 'one comparison, 140 characters at most, each quantity once; a small exact solver, not a general one; attacked with 24 claims a question');
  assert.equal(SET.VERIFIERS[3].ends, `one formula, ${FX.LIMIT} characters at most, four signs and brackets; at least ${FX.DRAW.least} tests a rule; attacked with ${FF.BUDGET.forged + FF.BUDGET.honest + FF.BUDGET.noise} replies a rule`); assert.equal(SET.VERIFIERS[3].ends, 'one formula, 120 characters at most, four signs and brackets; at least 4 tests a rule; attacked with 78 replies a rule');
  // with nothing measured, every check says so and none says nought
  for (const F0 of [null, undefined, {}, 7, { m: 5, sums: 'x', cites: [], sumTeeth: 3, rules: 'x', claims: 7 }]) { const rows = SET.verifiers(F0); assert.deepEqual(rows.map((r) => r.emits.length), [5, 7, 5, 8]); for (const r of rows) for (const e of r.emits) assert.equal(e.value, null, `${r.type} ${e.label}`); assert.deepEqual(rows.map(({ emits, ...v }) => v), SET.VERIFIERS); }
  // with a run and every attack, each puts out its own counts
  const out = await W.run(DEV, model(reads, wrongSumOnce(), (w) => (w.includes('divided') ? 'none' : rightRule(w)), (c) => (c.includes('less than') ? rightClaim(c).replace('<', '>') : rightClaim(c))).call, {}), m = M.measure(out.records, DEV);
  const steps = [...new Set(out.records.flatMap((r) => (r.crystal ? r.crystal.events.filter((e) => typeof e.said === 'string').map((e) => e.cell) : [])))], pairs = DEV.filter((t) => t.doc).flatMap((t) => t.slots.map((s) => ({ cell: { text: s.text }, doc: t.doc })));
  const sums = F.fuzz(steps.slice(0, 10), { seed: 3 }), cites = CF.fuzz(pairs.slice(0, 12), { seed: 3 }), rules = FF.fuzz(T.RULES.slice(0, 3), { seed: 3 }), claims = LF.fuzz(LF.HARD.slice(0, 4), { seed: 3 });
  const rows = SET.verifiers({ m, sums, cites, rules, claims, sumTeeth: F.teeth([], { seed: 3 }), citeTeeth: CF.teeth(pairs.slice(0, 12), { seed: 3 }), ruleTeeth: { planted: 12, caught: 12 }, claimTeeth: { planted: 12, caught: 11 } });
  assert.deepEqual(emit(rows, 'computed'), { 'steps the model stated that bonded': `${m.steps.events.bond} of ${m.steps.asked} (${((m.steps.events.bond / m.steps.asked) * 100).toFixed(1)}%)`, 'forged replies that bonded': `0 of ${sums.forged.tried} (0.0%)`, 'honest replies refused': `0 of ${sums.honest.tried} (0.0%)`, 'replies its two readers ruled differently on': `0 of ${sums.tried} (0.0%)`, 'planted leaks its harness found': '12 of 12 (100.0%)' });
  assert.ok(m.steps.events.bond < m.steps.asked, 'the stand-in got one sum wrong, so the two counts differ');
  assert.deepEqual(emit(rows, 'cited'), { 'figures the model quoted that bonded': `${m.cites.bonded} of ${m.cites.asked} (${((m.cites.bonded / m.cites.asked) * 100).toFixed(1)}%)`, 'figures not cited, by the reason': 'more than one figure there 5, not in the document 5', 'forged quotes that bonded': `0 of ${cites.forged.tried} (0.0%)`, 'honest quotes refused': `0 of ${cites.honest.tried} (0.0%)`,
    'replies that bonded where nothing can be cited': `0 of ${cites.barred.tried}${cites.barred.tried ? ' (0.0%)' : ''}`, 'replies its two readers ruled differently on': `0 of ${cites.tried} (0.0%)`, 'planted leaks its harness found': '12 of 12 (100.0%)' });
  assert.deepEqual(emit(rows, 'logical'), { 'claims the model wrote that were decided': `${m.claims.bonded} of ${m.claims.asked} (100.0%)`, 'of those, with the question\'s own verdict': `${m.claims.matched} of ${m.claims.bonded} (${((m.claims.matched / m.claims.bonded) * 100).toFixed(1)}%)`, 'claims not decided, by the reason': 'none', 'claims its solver and second procedure decided differently': `0 of ${claims.tried} (0.0%)`, 'planted leaks its harness found': '11 of 12 (91.7%)' });
  assert.ok(m.claims.matched < m.claims.bonded, 'the stand-in wrote every "less than" claim the wrong way round');
  assert.deepEqual(emit(rows, 'executed'), { 'formulas the model wrote that passed their tests': `${m.rules.bonded} of ${m.rules.asked} (${((m.rules.bonded / m.rules.asked) * 100).toFixed(1)}%)`, 'formulas refused, by the reason': `not a formula ${m.rules.asked - m.rules.bonded}`, 'different rules that bonded': `0 of ${rules.forged.tried} (0.0%)`, 'honest formulas refused': `0 of ${rules.honest.tried} (0.0%)`, 'near-misses a rule\'s tests let through': '0', 'replies its two runners ruled differently on': `0 of ${rules.tried} (0.0%)`, 'the limit: formulas built from the tests that bonded': '3 of 3 (100.0%)', 'planted leaks its harness found': '12 of 12 (100.0%)' });
  assert.ok(m.rules.bonded < m.rules.asked, 'the stand-in could not write the division rules');
  assert.equal(emit(SET.verifiers({ m: M.measure((await W.run(DEV.filter((t) => t.tier === 'cited'), model(reads, rightSum).call, {})).records, DEV) }), 'cited')['figures not cited, by the reason'], 'none');
  assert.equal(emit(SET.verifiers({ citeTeeth: { caught: 3 } }), 'cited')['planted leaks its harness found'], null); assert.equal(emit(SET.verifiers({ sums: { tried: 0, split: 0, forged: { tried: 0, bonded: 0 } } }), 'computed')['forged replies that bonded'], '0 of 0');
  assert.equal(emit(SET.verifiers({ rules: { weak: 2 } }), 'executed')['near-misses a rule\'s tests let through'], '2'); assert.equal(emit(SET.verifiers({ rules: { weak: 'x' } }), 'executed')['near-misses a rule\'s tests let through'], null);
});
// a stand-in that gets its first sum wrong and every other right
function wrongSumOnce() { let n = 0; return (c) => (n++ === 0 ? wrongSum(c) : rightSum(c)); }
