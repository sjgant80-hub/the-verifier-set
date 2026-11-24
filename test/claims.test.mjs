import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import CL from '../src/claims.mjs';
import M from '../src/counts.mjs';
import O from '../src/onetry.mjs';
import W from '../src/weave.mjs';
import T from '../src/tasks.mjs';
import { model, reads, invents, rightSum, wrongSum, rightRule, rightClaim, lineFor } from './helpers.mjs';

const DEV = T.set(20261201, 5);
const by = (v) => Object.fromEntries(v.map((x) => [x.id, x]));
const FUZZ = () => ({ seed: 9, tried: 4000, places: { open: 30, barred: 4 }, forged: { tried: 1500, bonded: 0, unsound: 0, outside: 0 }, honest: { tried: 360, refused: 0 }, barred: { tried: 160, bonded: 0 }, split: 0, threw: 0 });
const FORMULAS = () => ({ seed: 9, places: 24, weak: 0, tried: 1800, forged: { tried: 1000, bonded: 0, unsound: 0, outside: 0 }, honest: { tried: 288, refused: 0 }, limit: { tried: 24, bonded: 24 }, split: 0, threw: 0 });
const LOGIC = () => ({ seed: 9, places: 30, tried: 700, agreed: 700, refused: 300, verdicts: { yes: 150, no: 150, 'it depends': 100 }, split: 0, threw: 0 });
const TEETH = () => ({ teeth: { planted: 12, caught: 12 }, formulaTeeth: { planted: 12, caught: 12 }, logicTeeth: { planted: 12, caught: 12 } });
// a reader that reads rightly five times in six: it miscopies the figure of every sixth figure it is asked
const mostly = () => { let n = 0; return (cite, text) => { const line = lineFor(cite, text); return line === null ? 'none' : ++n % 6 === 0 ? line.replace(/\d/, '9') + ' x' : line; }; };
// one unchecked reply: right on computed and cited problems, a made-up number or a wrong verdict everywhere else
const guess = (task) => (task.tier === 'computed' || task.tier === 'cited' ? `The answer is ${task.check.value}.` : task.decide ? (task.check.value === 'yes' ? 'No.' : 'Yes.') : 'It is 4321 pounds.');
const asked = (m) => DEV.find((t) => m[1].content.endsWith(t.statement) && (t.doc === null || m[1].content.startsWith(t.doc.text)));
const good = async () => { const run = await W.run(DEV, model(reads, rightSum).call, {}); const one = await O.run(DEV, async (m) => ({ text: guess(asked(m)), ms: 4 }), {}); return { records: run.records, tasks: DEV, onetry: one, fuzz: FUZZ(), formulas: FORMULAS(), logic: LOGIC(), ...TEETH() }; };

test('every bar is the one CLAIMS.md registered, and every claim has a name', () => {
  assert.deepEqual(Object.keys(CL.BARS), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']); assert.deepEqual(Object.keys(CL.NAMES), Object.keys(CL.BARS));
  if (existsSync(new URL('../CLAIMS.md', import.meta.url))) { const md = readFileSync(new URL('../CLAIMS.md', import.meta.url), 'utf8'); for (const [id, bar] of Object.entries(CL.BARS)) { assert.ok(md.includes(bar), `${id}: ${bar}`); assert.ok(md.includes(`| ${id} | ${CL.NAMES[id]} |`), id); } }
});

test('without the evidence every claim is pending, never passed or failed', async () => {
  for (const F of [null, undefined, {}, { records: [] }, { records: 'x', onetry: 7 }]) { const v = CL.evaluate(F); assert.deepEqual(v.map((x) => x.id), Object.keys(CL.BARS)); assert.ok(v.every((x) => x.pass === null && x.result.startsWith('pending: ')), JSON.stringify(F)); }
  const G = await good(), only = by(CL.evaluate({ records: G.records, tasks: G.tasks }));
  assert.deepEqual(Object.values(only).map((x) => x.pass), [true, true, true, null, null, true, null, true, null, null, true, true]);
  assert.deepEqual([only.S4.result, only.S5.result, only.S7.result, only.S9.result, only.S10.result], ['pending: needs the attack on the figures the sealed run asked for', 'pending: needs each harness turned on its planted readers', 'pending: needs the sealed run and one unchecked reply on the same problems', 'pending: needs the attack on the rules the sealed problems asked for', 'pending: needs the attack on the claims of the sealed problems']);
  for (const a of [{ tried: 0 }, { tried: 'x' }, {}, null, 7]) { assert.equal(by(CL.evaluate({ ...G, fuzz: a })).S4.pass, null); assert.equal(by(CL.evaluate({ ...G, formulas: a })).S9.pass, null); assert.equal(by(CL.evaluate({ ...G, logic: a })).S10.pass, null); }
  for (const k of ['teeth', 'formulaTeeth', 'logicTeeth']) for (const t of [{ planted: 0 }, { planted: 'x' }, {}, null]) assert.equal(by(CL.evaluate({ ...G, [k]: t })).S5.pass, null, `${k} ${JSON.stringify(t)}`);
  const noRefusals = by(CL.evaluate({ ...G, records: G.records.filter((r) => r.tier !== 'absent' && r.tier !== 'conflict') })); assert.deepEqual([noRefusals.S3.pass, noRefusals.S3.result], [null, 'pending: needs sealed problems that must not be answered']);
  assert.equal(by(CL.evaluate({ ...G, records: G.records.filter((r) => r.tier !== 'misstated') })).S8.pass, null); assert.equal(by(CL.evaluate({ ...G, onetry: { records: [{ id: 'other', right: true }] } })).S7.pass, null);
  const plain = by(CL.evaluate({ ...G, records: G.records.filter((r) => r.tier === 'computed') })); assert.deepEqual([plain.S6.pass, plain.S11.pass, plain.S12.pass], [null, null, null], 'no figure was there to read, and no rule or claim was asked');
});

test('the verdicts on a run where the lattice works', async () => {
  const G = await good(), v = by(CL.evaluate(G));
  assert.deepEqual(Object.values(v).map((x) => x.pass), new Array(12).fill(true));
  assert.equal(v.S1.result, '50 problems reached an answer: 35 grounded, 5 proven against its tests, 5 proven within its encoding, 5 proven, 0 none of these. 0 were labelled stronger than what they stand on; 5 problems with no document, rule or claim were answered');
  assert.equal(v.S2.result, '0 answers that stand only on cited figures and exact steps were not what the problem\'s own document gives'); assert.equal(v.S3.result, '0 of 10 problems that must not be answered reached an answer; 10 stopped at the right figure with the right reason (100.0%)');
  assert.equal(v.S4.result, '0 of 1500 forged quotes bonded (0 that would have cited a figure wrongly, 0 outside the allowed form); 0 of 360 honest quotes were refused; 0 of 160 replies bonded where nothing can be cited; the two readers ruled differently on 0 of 4000 replies; 0 threw. 30 places that can be cited and 4 that cannot, seed 9');
  assert.equal(v.S5.result, 'the citation check: 12 of 12 planted leaks found; the formula check: 12 of 12 planted leaks found; the solver: 12 of 12 planted leaks found'); assert.match(v.S6.result, /^(\d+) of \1 figures that were in their documents were quoted so that they bonded \(100\.0%\)$/);
  assert.match(v.S7.result, /^one unchecked reply 16\.7%, the lattice 100\.0% of 60 problems; 50 only the lattice, 0 only the one reply, p = /); assert.equal(v.S8.result, '5 of 5 such problems reached an answer: 5 gave the document\'s answer, 5 differ from the true one, 5 are labelled grounded');
  assert.equal(v.S9.result, '0 of 1000 formulas that are a different rule bonded (0 different rules, 0 outside the allowed form); 0 of 288 honest formulas were refused; 0 near-misses passed a rule\'s tests; the two runners ruled differently on 0 of 1800 replies; 0 threw. 24 rules, seed 9. The limit, counted apart: 24 of 24 formulas built from the tests themselves bonded, as passing the tests allows');
  assert.equal(v.S10.result, '700 of 700 claims had one verdict from both, or were refused by both (150 yes, 150 no, 100 it depends, 300 refused); they differed on 0; 0 threw. 30 questions, seed 9');
  assert.equal(v.S11.result, '10 of 10 formulas the model wrote passed their rule\'s tests (100.0%)'); assert.equal(v.S12.result, '10 of 10 claims the model wrote were decided with the question\'s own verdict (100.0%); 0 were decided with another verdict, and are labelled as such');
});

test('each bar, at and just past its edge', async () => {
  const G = await good(), put = (change) => { const F = { ...G, records: G.records.map((r) => ({ ...r, cites: r.cites.map((c) => ({ ...c })), rule: r.rule && { ...r.rule }, claim: r.claim && { ...r.claim } })), fuzz: FUZZ(), formulas: FORMULAS(), logic: LOGIC(), ...TEETH(), onetry: { records: G.onetry.records.map((r) => ({ ...r })) } }; change(F); return by(CL.evaluate(F)); };
  const first = (F, tier) => F.records.find((r) => r.tier === tier);
  // S1: a grounded answer called proven, an answer of no strength, a plain problem not proven, a tested or decided answer called proven
  for (const [tier, s] of [['mixed', 'proven'], ['cited', 'unknown'], ['computed', 'grounded'], ['coded', 'proven'], ['decided', 'proven'], ['coded-cited', 'proven against its tests'], ['decided-cited', 'proven within its encoding'], ['decided', 'proven against its tests']]) assert.equal(put((F) => { first(F, tier).strength = s; }).S1.pass, false, `${tier} ${s}`);
  // S2: one answer that is not the document's; a wrong answer from a formula, or a wrong verdict, is counted apart
  assert.equal(put((F) => { first(F, 'mixed').answer = '1'; }).S2.pass, false); assert.equal(put((F) => { first(F, 'mixed').answer = '1'; }).S2.result, '1 answers that stand only on cited figures and exact steps were not what the problem\'s own document gives');
  assert.equal(put((F) => { first(F, 'coded').answer = '1'; }).S2.pass, true); assert.equal(put((F) => { first(F, 'decided').answer = 'maybe'; }).S2.pass, true);
  // S3: one answered that must not be; nine in ten stopped rightly is the bar, exactly
  assert.equal(put((F) => { const r = first(F, 'absent'); r.complete = true; r.answer = '5'; r.strength = 'grounded'; }).S3.pass, false);
  assert.equal(put((F) => { first(F, 'absent').home = false; }).S3.pass, true, '9 of 10'); assert.equal(put((F) => { first(F, 'absent').home = false; first(F, 'conflict').home = false; }).S3.pass, false, '8 of 10');
  // S4, S5, S9, S10
  for (const change of [(F) => { F.fuzz.forged.bonded = 1; }, (F) => { F.fuzz.honest.refused = 1; }, (F) => { F.fuzz.barred.bonded = 1; }, (F) => { F.fuzz.split = 1; }, (F) => { F.fuzz.threw = 1; }, (F) => { delete F.fuzz.forged; }, (F) => { delete F.fuzz.barred; }]) assert.equal(put(change).S4.pass, false);
  for (const k of ['teeth', 'formulaTeeth', 'logicTeeth']) assert.equal(put((F) => { F[k].caught = 11; }).S5.pass, false, k); assert.equal(put((F) => { F.teeth = { planted: 1, caught: 1 }; }).S5.pass, true);
  for (const change of [(F) => { F.formulas.forged.bonded = 1; }, (F) => { F.formulas.honest.refused = 1; }, (F) => { F.formulas.weak = 1; }, (F) => { F.formulas.split = 1; }, (F) => { F.formulas.threw = 1; }, (F) => { delete F.formulas.forged; }]) assert.equal(put(change).S9.pass, false);
  assert.equal(put((F) => { F.formulas.limit.bonded = 3; }).S9.pass, true, 'the limit is counted, and is no leak'); for (const change of [(F) => { F.logic.split = 1; }, (F) => { F.logic.threw = 1; }]) assert.equal(put(change).S10.pass, false);
  // S6: eight in ten of the figures that were there, exactly
  const reader = async (read) => by(CL.evaluate({ ...G, records: (await W.run(DEV, model(read, rightSum).call, {})).records }));
  const m45 = await reader(mostly()); assert.match(m45.S6.result, / \(8\d\.\d%\)$/); assert.equal(m45.S6.pass, true);
  let n = 0; const third = await reader((cite, text) => { const line = lineFor(cite, text); return line === null ? 'none' : ++n % 3 === 0 ? 'none' : line; }); assert.equal(third.S6.pass, false);
  const edge = (bonded, there) => by(CL.evaluate({ records: [{ id: 'a', tier: 'cited', complete: false, cites: [...Array.from({ length: bonded }, () => ({ key: 'k', kind: 'bond', why: 'bonded', value: '1' })), ...Array.from({ length: there - bonded }, () => ({ key: 'k', kind: 'dark', why: 'x', value: null }))] }], tasks: [] })).S6.pass;
  assert.equal(edge(8, 10), true); assert.equal(edge(79, 100), false); assert.equal(edge(4, 5), true); assert.equal(edge(7, 9), false);
  // S11 and S12: seven in ten, exactly
  const rules = (ok, all) => by(CL.evaluate({ records: Array.from({ length: all }, (_, i) => ({ id: `r${i}`, tier: 'coded', cites: [], rule: { why: i < ok ? 'bonded' : 'fails a test', value: i < ok ? 'p' : null } })), tasks: [] })).S11.pass;
  assert.equal(rules(7, 10), true); assert.equal(rules(69, 100), false); assert.equal(rules(14, 20), true); assert.equal(rules(6, 9), false);
  const claims = (ok, decided, all) => by(CL.evaluate({ records: Array.from({ length: all }, (_, i) => ({ id: `c${i}`, tier: 'decided', cites: [], claim: { why: i < decided ? 'bonded' : 'not one comparison', value: i < ok ? 'yes' : i < decided ? 'no' : null } })), tasks: Array.from({ length: all }, (_, i) => ({ id: `c${i}`, check: { value: 'yes' } })) })).S12;
  assert.equal(claims(7, 10, 10).pass, true); assert.equal(claims(6, 10, 10).pass, false, 'decided, but with another verdict, is not a match'); assert.equal(claims(69, 100, 100).pass, false); assert.match(claims(7, 9, 10).result, /^7 of 10 claims .* 2 were decided with another verdict/);
  // S7: more than one unchecked reply, by the test
  assert.equal(put((F) => { F.onetry.records.forEach((r, i) => { r.right = F.records[i].home; }); }).S7.pass, false, 'the same'); assert.equal(put((F) => { F.onetry.records.forEach((r) => { r.right = true; }); F.records.slice(0, 6).forEach((r) => { r.home = false; }); }).S7.pass, false, 'the one reply did better');
  assert.equal(put((F) => { F.onetry.records.forEach((r, i) => { r.right = i >= 5; }); }).S7.pass, false, 'five more is not enough for the test'); assert.equal(put((F) => { F.onetry.records.forEach((r, i) => { r.right = i >= 6; }); }).S7.pass, true, 'six more, none lost');
  // S8: an answer on a misstated document that is the true one, or is called proven
  assert.equal(put((F) => { const r = first(F, 'misstated'); r.answer = G.tasks.find((t) => t.id === r.id).check.world; }).S8.pass, false); assert.equal(put((F) => { first(F, 'misstated').strength = 'proven'; }).S8.pass, false);
});

test('measure: the counts are counts of what happened', async () => {
  const run = await W.run(DEV, model(invents, rightSum).call, {}), m = M.measure(run.records, DEV), all = run.records.flatMap((r) => r.cites);
  assert.equal(m.problems, 60); assert.deepEqual(Object.keys(m.tiers), T.TIERS); assert.equal(Object.values(m.tiers).reduce((a, t) => a + t.problems, 0), 60); assert.equal(m.home, run.records.filter((r) => r.home).length);
  assert.deepEqual(m.tiers.absent, { problems: 5, answered: 0, home: 5 }); assert.deepEqual(m.tiers.conflict, { problems: 5, answered: 0, home: 5 }); assert.deepEqual(m.tiers.computed, { problems: 5, answered: 5, home: 5 }); assert.deepEqual(m.tiers.decided, { problems: 5, answered: 5, home: 5 });
  assert.deepEqual([m.cites.asked, m.cites.bonded, m.cites.dark, m.cites.set], [all.length, all.filter((c) => c.kind === 'bond').length, all.filter((c) => c.kind === 'dark').length, 0]);
  assert.deepEqual(m.cites.whys, { bonded: m.cites.bonded, 'not in the document': 5, 'more than one figure there': 5 }); assert.equal(Object.values(m.cites.whys).reduce((a, b) => a + b, 0), m.cites.asked);
  // the figures that were not there: the reader that makes things up offered a quote every time, and none bonded
  assert.deepEqual(m.madeUp, { notThere: 10, saidNone: 0, offered: 10, bonded: 0 }); assert.deepEqual([m.reads.there, m.reads.bonded, m.reads.share], [m.cites.asked - 10, m.cites.asked - 10, 1]);
  const honest = M.measure((await W.run(DEV, model(reads, rightSum).call, {})).records, DEV); assert.deepEqual(honest.madeUp, { notThere: 10, saidNone: 5, offered: 5, bonded: 0 }, 'it says none where the figure is absent, and quotes one of the two lines where they disagree');
  assert.deepEqual(m.answers, { grounded: 35, 'proven against its tests': 5, 'proven within its encoding': 5, proven: 5, other: 0, collapsed: 0 }); assert.deepEqual([m.wrong, m.wrongTested, m.wrongEncoded], [0, 0, 0]); assert.deepEqual(m.misstated, { problems: 5, answered: 5, followDocument: 5, differFromWorld: 5, grounded: 5 });
  assert.deepEqual(m.rules, { asked: 10, bonded: 10, whys: { bonded: 10 } }); assert.deepEqual(m.claims, { asked: 10, bonded: 10, matched: 10, whys: { bonded: 10 } });
  for (const s of ['unknown', 'grounded', 'proven against its tests', 'proven within its encoding', 'proven']) assert.equal(m.facets[s], run.records.reduce((a, r) => a + r.facets[s], 0), s); assert.ok(m.facets.grounded > 100 && m.facets.proven >= 5 && m.facets['proven against its tests'] > 5 && m.facets['proven within its encoding'] === 5);
  assert.equal(m.calls, run.records.reduce((a, r) => a + r.calls, 0)); assert.equal(m.steps.grown, run.records.filter((r) => r.crystal !== null).length); assert.ok(m.seconds > 0);
  assert.deepEqual(m.cites.carried, { calls: all.filter((c) => c.carried === true).length, ms: 3, fresh: 3 });
  // a model that writes a rule wrongly, and a claim wrongly: the rule is dark; the claim is decided, with another verdict, and counted as such
  const off = await W.run(DEV, model(reads, rightSum, (w) => rightRule(w).replace(/ [×+÷-] /, ' - '), (c) => rightClaim(c).replace(/[≥>]/, '<').replace('≤', '>')).call, {}), mo = M.measure(off.records, DEV);
  assert.deepEqual([mo.rules.asked, mo.rules.bonded, mo.rules.whys], [10, 0, { 'fails a test': 10 }]); assert.equal(mo.claims.asked, 10); assert.equal(mo.claims.bonded, 10); assert.ok(mo.claims.matched < 10, String(mo.claims.matched)); assert.equal(mo.wrongEncoded, 10 - mo.claims.matched); assert.equal(mo.wrong, 0);
  assert.equal(mo.answers.collapsed, 0, 'a wrong verdict is still labelled with what it stands on'); assert.equal(mo.tiers.coded.answered, 0);
  // a figure set from what was held is counted apart and is not a call
  const twice = await W.run([DEV.find((t) => t.tier === 'mixed'), { ...DEV.find((t) => t.tier === 'mixed'), id: 'again:1' }], model(reads, rightSum).call, {}), m2 = M.measure(twice.records, DEV);
  assert.equal(m2.cites.set, twice.records[1].cites.length); assert.equal(m2.cites.asked, twice.records[0].cites.length);
  // what is not a record is not counted; a wrong or collapsed answer is counted, never hidden
  assert.deepEqual([M.measure([null, 7, 'x'], DEV).problems, M.measure(null, null).problems, M.measure([{}], []).problems], [0, 0, 1]);
  const bad = M.measure([{ id: DEV[0].id, tier: 'mixed', complete: true, answer: 'nope', strength: 'proven', cites: [{ key: 'a', kind: 'bond', value: '5', why: 'bonded' }] }, { id: 'zz', tier: 'odd', complete: true, answer: '1', strength: 'weird', cites: [] }, { id: 'yy', complete: true, answer: '2', strength: 'collapsed', cites: [] }], DEV);
  assert.deepEqual([bad.wrong, bad.answers.proven, bad.answers.other, bad.answers.collapsed], [3, 1, 2, 3]);
  for (const junk of [null, 7, {}, { cites: 5 }, { cites: [null, 3, { kind: 'bond' }], crystal: 9, facets: 'x', rule: 7, claim: [] }]) assert.doesNotThrow(() => M.measure([junk], [junk]));
  // what is in a record's list of figures and is not a figure is not counted; nor is a calculation that is not one
  const cite = (ms, carried) => ({ key: 'k', kind: 'bond', why: 'bonded', value: '1', ms, carried }), odd = M.measure([{ id: 'a', tier: 'cited', cites: [null, 7, 'x', cite(500, false)], crystal: 7 }, { id: 'b', crystal: 'x' }, { id: 'c', crystal: null }, { id: 'd', crystal: { events: [] } }], []);
  assert.deepEqual([odd.cites.asked, odd.cites.bonded, odd.cites.dark, odd.reads, odd.steps.problems, odd.seconds], [1, 1, 0, { there: 1, bonded: 1, share: 1 }, 1, 0.5]);
  // the time of the rule's call and the claim's is counted; a cell with no reason recorded says so
  assert.equal(M.measure([{ id: 'a', rule: { ms: 1500, why: 'bonded', value: 'p' }, claim: { ms: 500, value: null } }], []).seconds, 2); assert.deepEqual(M.measure([{ id: 'a', claim: { value: null } }], []).claims.whys, { 'not recorded': 1 });
  // what an answer must be labelled: grounded on a figure; tested on a rule; within its encoding on a claim; else proven
  for (const [r, owed] of [[{ cites: [{ value: '5' }] }, 'grounded'], [{ cites: [{ value: '5' }], rule: { value: 'p' } }, 'grounded'], [{ cites: [{ value: null }], rule: { value: 'p' } }, 'proven against its tests'], [{ claim: { value: 'yes' } }, 'proven within its encoding'], [{ rule: { value: null }, claim: { value: 'no' } }, 'proven within its encoding'], [{ rule: { value: null } }, 'proven'], [{}, 'proven']]) {
    assert.equal(M.measure([{ id: 'a', complete: true, answer: 'x', strength: owed, ...r }], []).answers.collapsed, 0, owed); assert.equal(M.measure([{ id: 'a', complete: true, answer: 'x', strength: owed === 'proven' ? 'grounded' : 'proven', ...r }], []).answers.collapsed, 1, owed);
  }
  // an answer that stands on a cited figure is only so when a figure was in fact cited: one that did not bond is no footing
  for (const value of [null, undefined]) assert.deepEqual(M.measure([{ id: 'a', tier: 'computed', complete: true, strength: 'proven', answer: '1', cites: [{ key: 'k', kind: 'dark', why: 'x', value }] }], []).answers.collapsed, 0);
  // a share of nothing is not a share; the time is the time of every call, the figures' with the steps'
  assert.equal(M.measure([], DEV).reads.share, null); assert.equal(M.measure([{ id: 'a', cites: [] }], []).reads.share, null); assert.ok(Math.abs(m.seconds - (m.cites.asked * 0.003 + (m.rules.asked + m.claims.asked) * 0.003 + m.steps.seconds)) < 1e-9 && m.steps.seconds > 0, String(m.seconds));
  // the middle time of the calls that carried a conversation on, and of those that began one: the middle one, the lower of two
  const timed = (list) => M.measure([{ id: 'a', cites: list }], []).cites.carried;
  assert.deepEqual(timed([cite(9, true), cite(1, true), cite(2, true), cite(40, false), cite(30, false), cite(20, false), cite(10, false)]), { calls: 3, ms: 2, fresh: 20 }); assert.deepEqual(timed([cite(4, true), cite(8, true)]), { calls: 2, ms: 4, fresh: null }); assert.deepEqual(timed([]), { calls: 0, ms: null, fresh: null });
});

test('one unchecked reply: read generously, and a problem that must not be answered is right only when it declines', async () => {
  const t = DEV.find((x) => x.tier === 'mixed'), no = DEV.find((x) => x.tier === 'absent'), plain = DEV.find((x) => x.tier === 'computed'), d = DEV.find((x) => x.tier === 'decided');
  assert.deepEqual(O.rule(`The answer is ${t.check.value} pounds.`, t), { right: true, answered: true, value: t.check.value }); assert.deepEqual(O.rule(`26 × 12 = 312, so ${t.check.value}`, t).right, true, 'its last figure');
  assert.deepEqual(O.rule(`${t.check.value} or 5`, t), { right: false, answered: true, value: '5' }); assert.deepEqual(O.rule('cannot tell', t), { right: false, answered: false, value: null }); assert.equal(O.rule(`${Number(t.check.value).toLocaleString('en-GB')}`, t).right, true, 'with commas');
  // however the number is written round, it is read: this reading must never refuse an answer the model gave
  for (const how of [(v) => `Total=${v}.`, (v) => `£${v}`, (v) => `**${v}**`, (v) => `= ${Number(v).toLocaleString('en-GB')}.00,`, (v) => `x=${v}kg`, (v) => `-${v}`, (v) => `The 3 figures give ${v}`, (v) => `cannot tell, but perhaps ${v}`]) assert.equal(O.rule(how(t.check.value), t).right, true, how(t.check.value));
  assert.deepEqual([O.last('a 12 b 3,400.50, c'), O.last('1,2'), O.last('7 and 1,2'), O.last('none'), O.last(`${'9'.repeat(41)}`), O.last('5,,')], ['3,400.50', null, '7', null, null, '5']); for (const bad of [null, undefined, 7, {}]) assert.equal(O.last(bad), null);
  assert.deepEqual(O.rule('cannot tell', no), { right: true, answered: false, value: null }); assert.deepEqual(O.rule('It is 4321 pounds.', no), { right: false, answered: true, value: '4321' }); assert.equal(O.rule('', no).right, true);
  // a problem that must not be answered: saying it cannot tell is right, whatever numbers the saying holds; a number with no such words is an answer
  assert.deepEqual(O.rule('Cannot tell from clause 3.', no), { right: true, answered: false, value: '3' }); assert.deepEqual(O.rule('CANNOT TELL', no), { right: true, answered: false, value: null }); assert.deepEqual(O.rule('Clause 3 does not say.', no), { right: false, answered: true, value: '3' }); assert.deepEqual(O.rule('I can not say.', no), { right: true, answered: false, value: null });
  // a yes-or-no problem: its first verdict, read generously; cannot tell says the same as it depends
  const want = d.check.value, wrongWay = want === 'yes' ? 'no' : 'yes';
  assert.deepEqual(O.rule(`${want === 'it depends' ? 'It depends' : want[0].toUpperCase() + want.slice(1)}, because 1,000 pounds is less.`, d), { right: true, answered: true, value: want }); assert.deepEqual(O.rule(`${wrongWay}.`, d), { right: false, answered: true, value: wrongWay });
  assert.deepEqual(O.rule('The order costs 312 pounds.', d), { right: false, answered: false, value: null }, 'a number is no verdict'); assert.deepEqual(O.rule('', d), { right: false, answered: false, value: null });
  for (const [reply, v] of [['Yes', 'yes'], ['no.', 'no'], ['IT DEPENDS on the term', 'it depends'], ['I cannot tell.', 'it depends'], ["I can't tell", 'it depends'], ['can not tell', 'it depends'], ['No, yes', 'no'], ['yes, no', 'yes'], ['nobody knows', null], ['yesterday', null], ['It depends. Yes.', 'it depends']]) assert.equal(O.verdict(reply), v, reply);
  for (const bad of [null, undefined, 7, {}]) assert.equal(O.verdict(bad), null);
  for (const bad of [null, undefined, 7, {}]) { assert.deepEqual(O.rule(bad, t), { right: false, answered: false, value: null }); assert.doesNotThrow(() => O.rule('5', bad)); assert.equal(O.rule('5', bad).right, false); assert.equal(O.rule(null, bad).right, false); }
  assert.equal(O.rule('5', { check: { value: 5 } }).right, false, 'what the problem gives is text; a problem without it has no right answer'); assert.equal(O.rule('', { check: {} }).right, false); assert.equal(O.rule('yes', { decide: null, check: { value: 'yes' } }).right, false, 'not a yes-or-no problem: a verdict is no number');
  assert.deepEqual(O.asking(t), [{ role: 'system', content: O.SYSTEM }, { role: 'user', content: `${t.doc.text}\n\n${t.statement}` }]); assert.deepEqual(O.asking(plain)[1], { role: 'user', content: plain.statement }); assert.equal(O.asking(null).length, 2); assert.deepEqual(O.SETTINGS, { maxTokens: 192 });
  assert.ok(O.SYSTEM.includes('cannot tell') && O.SYSTEM.includes('yes, no, or it depends'));
  const seen = [], out = await O.run(DEV, async (m, max) => { seen.push(max); return { text: 'It is 4321 pounds.', ms: 7, prompt: 100, reply: 6 }; }, {});
  assert.equal(out.records.length, 60); assert.deepEqual(seen, new Array(60).fill(192)); assert.deepEqual([out.records[0].ms, out.records[0].prompt, out.records[0].reply, out.records[0].said], [7, 100, 6, 'It is 4321 pounds.']); assert.equal((await O.run(DEV.slice(0, 1), async () => ({ text: 5, ms: 'x' }), {})).records[0].ms, 0);
  assert.deepEqual(Object.keys(out.records[0]), ['id', 'tier', 'said', 'right', 'answered', 'value', 'ms', 'prompt', 'reply']); assert.equal(out.records.filter((r) => r.right).length, 0);
  assert.deepEqual((await O.replay(DEV, out.records)).records, out.records); assert.deepEqual((await O.replay(DEV, null)).records.map((r) => r.said), new Array(60).fill(''));
  // records already made are not asked for again
  let calls = 0; const more = await O.run(DEV, async () => { calls++; return { text: 'cannot tell' }; }, { done: out.records.slice(0, 30) }); assert.equal(calls, 30); assert.deepEqual(more.records.slice(0, 30), out.records.slice(0, 30));
  // against(): the lattice and the one reply on the same problems
  const a = M.against([{ id: 'a', home: true }, { id: 'b', home: true }, { id: 'c', home: false }, { id: 'd', home: false }, { id: 'e', home: true }], [{ id: 'a', right: true }, { id: 'b', right: false }, { id: 'c', right: true }, { id: 'd', right: false }]);
  assert.deepEqual([a.both, a.only, a.other, a.neither, a.compared, a.p], [1, 1, 1, 1, 4, 1]); assert.deepEqual(M.against(null, null).compared, 0);
});
