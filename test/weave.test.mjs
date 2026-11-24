import { test } from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/weave.mjs';
import T from '../src/tasks.mjs';
import C from '../src/cite.mjs';
import F from '../src/formula.mjs';
import L from '../src/logic.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';
import { model, reads, invents, rightSum, wrongSum, rightRule, rightClaim, lineFor, val } from './helpers.mjs';

const DEV = T.set(20261201, 5), by = (tier) => DEV.find((t) => t.tier === tier);
const HOSTILE = [null, undefined, 7, 'x', {}, [], { slots: 5 }, { get id() { throw new Error('no'); } }];
const NOTHING = { unknown: 0, grounded: 0, 'proven against its tests': 0, 'proven within its encoding': 0, proven: 0 };
const total = (f) => Object.values(f).reduce((a, b) => a + b, 0);

test('the problems: twelve to a sheet, one of every kind of thing that can happen, each saying what it is meant to', () => {
  assert.deepEqual(T.SHEET, ['computed', 'cited', 'mixed', 'mixed', 'mixed', 'absent', 'conflict', 'misstated', 'coded', 'coded-cited', 'decided', 'decided-cited']);
  assert.deepEqual(T.TIERS, ['computed', 'cited', 'mixed', 'absent', 'conflict', 'misstated', 'coded', 'coded-cited', 'decided', 'decided-cited']); assert.equal(DEV.length, 60);
  for (let s = 0; s < 5; s++) assert.deepEqual(DEV.filter((t) => t.sheet === s).map((t) => t.tier).sort(), [...T.SHEET].sort());
  assert.equal(new Set(DEV.map((t) => t.id)).size, 60); assert.deepEqual(T.set(20261201, 5), DEV, 'the same seed, the same problems'); assert.notDeepEqual(T.set(20261202, 5).map((t) => t.statement + (t.doc ? t.doc.text : '')), DEV.map((t) => t.statement + (t.doc ? t.doc.text : '')));
  const verdicts = {};
  for (const t of [...DEV, ...T.set(20261202, 12)]) {
    assert.ok(T.sound(t), t.id); assert.match(t.id, new RegExp(`^${t.tier}:\\d+-\\d+$`));
    if (t.tier === 'computed') { assert.deepEqual([t.doc, t.slots, t.expect, t.kind], [null, [], null, null]); assert.equal(t.check.value, val(t.ask)); continue; }
    assert.ok(Object.keys(T.KINDS).includes(t.kind));
    const K = T.KINDS[t.kind];
    if (t.tier === 'coded') {
      assert.deepEqual([t.doc, t.slots, t.expect], [null, [], null]); assert.equal(t.rule.reference, t.ask.replace(/\{(\w+)\}/g, (_, k) => K.letters[k])); assert.equal(F.suite(t.rule).admitted, true);
      assert.equal(val(F.applied(t.rule.reference, t.rule, t.given)), t.check.value, 'the question\'s own figures, in its own rule'); assert.ok(t.statement.endsWith(`It is ${t.rule.words}.`)); for (const [n, v] of Object.entries(t.given)) assert.ok(t.statement.includes(` ${v} `), `${n} ${v}`);
      continue;
    }
    if (t.tier === 'decided') {
      assert.deepEqual([t.doc, t.slots, t.expect], [null, [], null]); assert.deepEqual(t.decide.given, t.decide.full); assert.equal(L.decide(t.decide.claim, { names: t.decide.names, given: t.decide.full }), t.check.value); verdicts[t.check.value] = (verdicts[t.check.value] || 0) + 1;
      assert.ok(Array.isArray(t.decide.given[t.decide.ranged]) && Object.values(t.decide.given).filter(Array.isArray).length === 1, 'one quantity is given only between two figures'); assert.ok(t.statement.includes(`from ${t.decide.given[t.decide.ranged][0]} to ${t.decide.given[t.decide.ranged][1]}`));
      assert.ok(t.statement.endsWith(`Is it certain that ${T.claimWords(t.decide.words, t.decide.relation, t.decide.figure)}?`)); continue;
    }
    assert.ok(t.doc.text.startsWith(K.title)); assert.equal(t.doc.id, t.id);
    // every figure the question needs is stated once by its document, read by the document check itself; except the one that must not be
    for (const s of t.slots) { const st = C.stated({ text: s.text }, t.doc); if (t.expect && t.expect.key === s.key) assert.deepEqual([st.figure, st.why], [null, t.expect.why]); else assert.ok(st.figure !== null, `${t.id} ${s.key}`); }
    if (t.tier === 'decided-cited') {
      const cited = Object.fromEntries(t.slots.map((s) => [K.letters[s.key], C.stated({ text: s.text }, t.doc).figure.text]));
      assert.equal(C.stated({ text: K.slots[K.ranged][0] }, t.doc).why, 'not in the document', 'the quantity the question gives between two figures is not in the document'); assert.deepEqual(Object.keys(t.decide.given), [t.decide.ranged]);
      assert.equal(L.decide(t.decide.claim, { names: t.decide.names, given: { ...cited, ...t.decide.given } }), t.check.value, 'decided on the document\'s own figures'); verdicts[t.check.value] = (verdicts[t.check.value] || 0) + 1; continue;
    }
    if (t.expect === null) { const figures = Object.fromEntries(t.slots.map((s) => [s.key, C.stated({ text: s.text }, t.doc).figure.text])); assert.equal(val(T.asked(t, figures)), t.check.value, 'what the document gives is the finish line'); } else assert.equal(t.check.value, null);
    if (t.tier === 'coded-cited') { assert.equal(F.suite(t.rule).admitted, true); assert.deepEqual(Object.keys(t.rule.names), t.slots.map((s) => K.letters[s.key])); assert.ok(t.statement.endsWith(`It is ${t.rule.words}.`)); }
    if (t.tier === 'cited') { assert.equal(t.slots.length, 1); assert.equal(t.ask, `{${t.slots[0].key}}`); }
    if (t.tier === 'mixed') assert.ok(t.slots.length >= 2 && t.slots.length <= 4);
    if (t.tier === 'misstated') { assert.notEqual(t.check.value, t.check.world); assert.equal(String(t.misstated.document), String(t.misstated.world).split('').reverse().join('')); assert.ok(t.doc.text.includes(` ${t.misstated.document} `)); } else assert.equal(t.check.world, undefined);
    if (t.tier === 'conflict') assert.ok(t.doc.text.includes('By amendment, the '));
    assert.ok(!String(t.check.value).includes('/'), 'every answer ends as a plain decimal');
  }
  assert.deepEqual(Object.keys(verdicts).sort(), ['it depends', 'no', 'yes'], 'all three verdicts come out'); assert.ok(Object.values(verdicts).every((n) => n >= 5), JSON.stringify(verdicts));
  assert.equal(T.set(20261202, 12).length, 144); assert.deepEqual(T.set(1, 0), []); for (const bad of [null, -1, 1.5, 'x']) assert.deepEqual(T.set(1, bad), []);
  assert.equal(T.asked({ ask: '{a} × {b} + {a}' }, { a: '2', b: '3' }), '2 × 3 + 2'); assert.equal(T.asked(null, null), ''); assert.equal(T.sound({ tier: 'computed', ask: 'pizza', doc: null }), false);
  assert.equal(T.claimWords('a times b', 'at least', 5), 'a times b comes to at least 5 pounds'); assert.equal(T.claimWords('a, plus b', 'less than', '9'), 'a, plus b, comes to less than 9 pounds');
  assert.deepEqual(T.letters(by('coded')), T.KINDS[by('coded').kind].letters); assert.deepEqual(T.letters(null), {}); assert.deepEqual(T.letters({ kind: 'nothing' }), {});
  // the twelve rules every attack keeps: every ask of every kind, its tests drawn from one fixed seed
  assert.equal(T.RULES.length, 12); assert.deepEqual(T.RULES.map((r) => r.reference), Object.values(T.KINDS).flatMap((K) => K.asks.map(([, ask]) => ask.replace(/\{(\w+)\}/g, (_, k) => K.letters[k])))); for (const r of T.RULES) { assert.equal(r.seed, 20261212); assert.equal(F.suite(r).admitted, true); assert.equal(rightRule(r.words), r.reference); }
  // the sets are pinned: the same seed makes these problems, to the letter, and each problem carries its seed in its name
  const print = (set) => sha256(JSON.stringify(set)).slice(0, 16);
  assert.deepEqual([print(DEV), print(T.set(20261212, 12)), print(T.set(20261201, 1))], ['e04c9b827512c1b6', '5ba79836208c0d6d', 'c505edd3e56dff37']);
  assert.equal(DEV[0].id, 'mixed:20261201-1'); assert.equal(T.set('x', 1)[0].id.split(':')[1], '0-1'); assert.equal(DEV[59].id.split('-')[1], '60');
  // sound(): the problem says what it means to say, and no more
  const mixed = by('mixed'), absent = by('absent'), mis = by('misstated'), cut = (t, key) => ({ ...t.doc, text: t.doc.text.split('\n').filter((l) => !l.includes(T.KINDS[t.kind].slots[key][0].replace(/^the /, ''))).join('\n') });
  assert.equal(T.sound(mixed), true); assert.equal(T.sound({ ...mixed, doc: cut(mixed, mixed.slots[0].key) }), false, 'a figure the question needs is not in the document'); assert.equal(T.sound({ ...mixed, check: { value: '31/3' } }), false, 'an answer that does not end as a decimal');
  assert.equal(T.sound({ ...mis, check: { ...mis.check, world: mis.check.value } }), false, 'a misstated problem whose document is not wrong'); assert.equal(T.sound({ ...mixed, check: { ...mixed.check, world: mixed.check.value } }), true);
  const other = absent.slots.find((s) => s.key !== absent.expect.key).key;
  assert.equal(T.sound(absent), true); assert.equal(T.sound({ ...absent, expect: { ...absent.expect, key: other } }), false); assert.equal(T.sound({ ...absent, expect: { ...absent.expect, why: 'more than one figure there' } }), false);
  assert.equal(T.sound({ ...absent, doc: cut(absent, other) }), false, 'two figures missing where one was meant'); assert.equal(T.sound({ ...absent, doc: { ...absent.doc, text: `${absent.doc.text}\n9. ${T.KINDS[absent.kind].slots[absent.expect.key][1](50)}` } }), false, 'the figure that was to be missing is there');
  const coded = by('coded'), cc = by('coded-cited'), dd = by('decided'), dc = by('decided-cited');
  assert.equal(T.sound({ ...coded, rule: { ...coded.rule, reference: 'p ÷ (p - p)' } }), false, 'a rule whose tests cannot be made'); assert.equal(T.sound({ ...coded, check: { value: '1/3' } }), false); assert.equal(T.sound({ ...coded, doc: cc.doc }), false);
  assert.equal(T.sound({ ...cc, rule: { ...cc.rule, reference: 'x' } }), false); assert.equal(T.sound({ ...cc, doc: cut(cc, cc.slots[0].key) }), false); assert.equal(T.sound({ ...cc, check: { value: '7/3' } }), false);
  assert.equal(T.sound({ ...dd, check: { value: 'maybe' } }), false); assert.equal(T.sound({ ...dd, doc: dc.doc }), false); assert.equal(T.sound({ ...dc, check: { value: null } }), false); assert.equal(T.sound({ ...dc, doc: cut(dc, dc.slots[0].key) }), false);
  assert.equal(T.sound({ ...dc, doc: { ...dc.doc, text: `${dc.doc.text}\n9. ${T.KINDS[dc.kind].slots[T.KINDS[dc.kind].ranged][1](20)}` } }), false, 'the document states the quantity the question gives between two figures');
  // nothing in a document names a real firm or person: the parties are roles
  for (const t of DEV) if (t.doc) assert.ok(/between the (Supplier and the Buyer|Provider and the Client|Owner and the Hirer)$/.test(t.doc.text.split('\n')[0]));
});

test('weave: figures are cited first, then the calculation is grown on them; the answer is grounded', async () => {
  const t = by('mixed'), m = model(reads, rightSum), r = await W.weave(t, m.call, {});
  assert.deepEqual(r.cites.map((c) => [c.key, c.kind, c.why, c.value]), t.slots.map((s) => [s.key, 'bond', 'bonded', C.stated({ text: s.text }, t.doc).figure.text]));
  assert.equal(r.ask, T.asked(t, Object.fromEntries(r.cites.map((c) => [c.key, c.value])))); assert.deepEqual([r.complete, r.answer, r.home, r.strength, r.refused, r.rule, r.claim], [true, t.check.value, true, 'grounded', null, null, null]);
  assert.equal(r.calls, t.slots.length + r.crystal.calls); assert.equal(r.crystal.complete, true); assert.deepEqual(r.facets, { ...NOTHING, grounded: t.slots.length + r.crystal.events.filter((e) => e.kind === 'bond' || e.kind === 'set').length }, 'every step of a problem that stands on a cited figure is grounded');
  // each cite carries the place in the document it stands
  for (const c of r.cites) { assert.equal(t.doc.text.slice(c.source.start, c.source.end), c.source.text); assert.equal(c.source.doc, t.doc.id); assert.equal(c.said, c.source.line); }
  assert.deepEqual(Object.keys(r), ['id', 'tier', 'sheet', 'kind', 'doc', 'cites', 'rule', 'claim', 'ask', 'crystal', 'complete', 'answer', 'home', 'calls', 'refused', 'strength', 'facets']);
  assert.deepEqual(Object.keys(r.cites[0]), ['key', 'cell', 'value', 'source', 'said', 'carried', 'ms', 'prompt', 'reply', 'kind', 'why']);
  // the model is shown the document once; a figure that bonded stays in the conversation, and the next is asked after it
  const cites = m.seen.filter((s) => s.cite !== undefined); assert.equal(cites.length, t.slots.length); assert.deepEqual(cites.map((s) => s.maxTokens), cites.map(() => 40));
  const base = 1 + 2 * W.SHOTS.length; cites.forEach((s, i) => { assert.equal(s.messages.length, base + 2 * i + 1); assert.equal(s.messages[base].content, `${t.doc.text}\n\nCopy the one line that states ${t.slots[0].text}.`); assert.equal(s.messages.filter((x) => x.content.includes(t.doc.text)).length, 1); });
  assert.deepEqual(r.cites.map((c) => c.carried), t.slots.map((_, i) => i > 0)); assert.deepEqual(m.seen[0].messages[0], { role: 'system', content: W.SYSTEM });
  // a quote is one line: each is asked for with the reply ended at the end of its first line; what the call reports is kept
  for (const s of cites) assert.deepEqual(s.more, { stop: ['\n'] }); assert.deepEqual(r.cites.map((c) => [c.ms, c.prompt, c.reply]), t.slots.map(() => [3, 10, 5]));
  // the sums are asked the way The Crystal asks them, at its own limit
  for (const s of m.seen.filter((x) => x.sum !== undefined)) { assert.equal(s.maxTokens, 24); assert.equal(s.more, undefined); }
  // the limits can be set, and a limit that is not a whole number above nought is not taken
  for (const [given, want] of [[16, 16], [0, 40], [-3, 40], [2.5, 40], ['16', 40], [null, 40]]) { const mm = model(reads, rightSum); await W.weave(t, mm.call, { citeTokens: given, maxTokens: given }); assert.deepEqual([...new Set(mm.seen.filter((s) => s.cite !== undefined).map((s) => s.maxTokens))], [want], String(given)); assert.deepEqual([...new Set(mm.seen.filter((s) => s.sum !== undefined).map((s) => s.maxTokens))], [want === 40 ? 24 : want], String(given)); }
});

test('weave: a rule is written as a formula, run on its tests, and the calculation is the model\'s own formula', async () => {
  const t = by('coded'), m = model(reads, rightSum, (w) => rightRule(w).split(' + ').reverse().join(' + ')), r = await W.weave(t, m.call, {});
  // the model wrote the rule another way round: it passes the tests, and its own formula makes the calculation
  const written = rightRule(t.rule.words).split(' + ').reverse().join(' + ');
  assert.deepEqual([r.rule.said, r.rule.value, r.rule.why, r.rule.passed, r.rule.of], [written, F.shown(F.read(written, Object.keys(t.rule.names)).tree), 'bonded', 4, 4]);
  assert.equal(r.ask, F.applied(written, t.rule, t.given)); assert.deepEqual([r.complete, r.answer, r.home, r.strength, r.refused, r.claim], [true, t.check.value, true, 'proven against its tests', null, null]);
  assert.deepEqual(r.facets, { ...NOTHING, 'proven against its tests': 1 + r.crystal.events.filter((e) => e.kind === 'bond' || e.kind === 'set').length }, 'the rule, and every step worked out from it');
  const asked = m.seen.find((s) => s.rule !== undefined); assert.deepEqual([asked.maxTokens, asked.more, asked.messages.length], [40, { stop: ['\n'] }, 2 + 2 * W.RULE_SHOTS.length]);
  assert.deepEqual(asked.messages[0], { role: 'system', content: W.RULE_SYSTEM }); assert.equal(asked.messages[asked.messages.length - 1].content, `The rule: ${t.rule.words}. Letters: ${W.legend(t.rule.names)}.`); assert.deepEqual(Object.keys(r.rule), ['said', 'ms', 'prompt', 'reply', 'value', 'why', 'passed', 'of']); assert.deepEqual([r.rule.ms, r.rule.prompt, r.rule.reply], [3, 10, 5]);
  // a formula that fails a test: the rule is dark, and there is no answer
  const bad = await W.weave(t, model(reads, rightSum, (w) => rightRule(w).replace('+', '-')).call, {}); assert.deepEqual([bad.rule.why, bad.rule.value, bad.complete, bad.answer, bad.ask, bad.crystal, bad.refused, bad.strength, bad.home], ['fails a test', null, false, null, null, null, { key: 'rule', why: 'fails a test' }, null, false]);
  assert.ok(bad.rule.passed < 4 && bad.rule.of === 4); assert.deepEqual(bad.facets, NOTHING);
  for (const [said, why] of [['none', 'not a formula'], ['', 'not a formula'], ['p × q', 'a letter the rule does not have']]) assert.equal((await W.weave(t, model(reads, rightSum, () => said).call, {})).refused.why, why);
  // with a document: the figures are cited, and go into the formula's letters by the words they were asked for
  const cc = by('coded-cited'), rc = await W.weave(cc, model(reads, rightSum).call, {}), K = T.KINDS[cc.kind];
  assert.equal(rc.ask, F.applied(cc.rule.reference, cc.rule, Object.fromEntries(rc.cites.map((c) => [K.letters[c.key], c.value])))); assert.deepEqual([rc.complete, rc.answer, rc.home, rc.strength], [true, cc.check.value, true, 'grounded']);
  assert.deepEqual(rc.facets, { ...NOTHING, grounded: rc.cites.length + rc.crystal.events.filter((e) => e.kind === 'bond' || e.kind === 'set').length, 'proven against its tests': 1 }, 'the rule is tested; the steps stand on it and on the figures');
  // what the page is told as it grows: the rule's cell, bonded or dark, with the formula and its tests
  const told = [], tell = async (e) => { if (e.stage === 'rule' || e.stage === 'claim') told.push([e.stage, e.kind, e.cell, e.value, e.why]); };
  await W.weave(t, model(reads, rightSum).call, { onEvent: tell }); await W.weave(t, model(reads, rightSum, () => '× ×').call, { onEvent: tell });
  assert.deepEqual(told, [['rule', 'bond', t.rule.words, F.shown(F.read(t.rule.reference, Object.keys(t.rule.names)).tree), 'bonded'], ['rule', 'dark', t.rule.words, null, 'not a formula']]);
  // a figure that is dark comes first: the rule is never asked
  const dark = model(() => 'none', rightSum), rd = await W.weave(cc, dark.call, {}); assert.deepEqual([rd.rule, rd.refused.key, dark.seen.filter((s) => s.rule !== undefined).length], [null, cc.slots[0].key, 0]);
});

test('weave: a claim is written as a comparison, and the solver decides it from what is given', async () => {
  const d = by('decided'), m = model(reads, rightSum), r = await W.weave(d, m.call, {});
  assert.deepEqual([r.claim.said, r.claim.value, r.claim.why, r.claim.claim], [rightClaim(T.claimWords(d.decide.words, d.decide.relation, d.decide.figure)), d.check.value, 'bonded', d.decide.claim]); assert.deepEqual(Object.keys(r.claim), ['said', 'ms', 'prompt', 'reply', 'value', 'why', 'claim', 'least', 'greatest']);
  assert.deepEqual([r.complete, r.answer, r.home, r.strength, r.ask, r.crystal, r.rule, r.calls], [true, d.check.value, true, 'proven within its encoding', null, null, null, 1]); assert.deepEqual(r.facets, { ...NOTHING, 'proven within its encoding': 1 });
  const asked = m.seen.find((s) => s.claim !== undefined); assert.deepEqual([asked.maxTokens, asked.more, asked.messages.length, asked.messages[0].content], [48, { stop: ['\n'] }, 2 + 2 * W.CLAIM_SHOTS.length, W.CLAIM_SYSTEM]);
  assert.equal(asked.messages[asked.messages.length - 1].content, `The claim: ${T.claimWords(d.decide.words, d.decide.relation, d.decide.figure)}. Letters: ${W.legend(d.decide.names)}.`);
  // the least and greatest the solver found, from what the question gives
  const range = L.judge(d.decide.claim, { names: d.decide.names, given: d.decide.full }); assert.deepEqual([r.claim.least, r.claim.greatest], [range.least, range.greatest]);
  // THE LIMIT: a claim written the wrong way round is decided exactly, about the wrong claim. It is not what was asked, and it says what it stands on
  const turned = await W.weave(d, model(reads, rightSum, rightRule, (c) => rightClaim(c).replace(/[≥>]/, '<').replace(/[≤]/, '>')).call, {});
  assert.equal(turned.claim.why, 'bonded'); assert.equal(turned.strength, 'proven within its encoding'); assert.equal(turned.complete, true);
  // a claim that cannot be decided: the claim is dark, and there is no answer
  const n = Object.keys(d.decide.names)[0];
  for (const [said, why] of [['yes', 'not one comparison'], [`${n} - ${n} ≥ 0`, 'a letter used twice'], ['300 ≥ 2', 'the claim names none of the quantities'], ['q ≥ 2', 'a letter the question does not give']]) { const x = await W.weave(d, model(reads, rightSum, rightRule, () => said).call, {}); assert.deepEqual([x.claim.why, x.claim.value, x.complete, x.answer, x.refused, x.strength, x.home], [why, null, false, null, { key: 'claim', why }, null, false], said); assert.deepEqual(x.facets, NOTHING); }
  // with a document: the exact figures are cited, the range is the question's, and the verdict is grounded
  const dc = by('decided-cited'), rc = await W.weave(dc, model(reads, rightSum).call, {});
  assert.deepEqual([rc.complete, rc.answer, rc.home, rc.strength, rc.cites.length], [true, dc.check.value, true, 'grounded', dc.slots.length]); assert.deepEqual(rc.facets, { ...NOTHING, grounded: dc.slots.length + 1 });
  assert.deepEqual([rc.claim.least, rc.claim.greatest], [L.judge(dc.decide.claim, { names: dc.decide.names, given: dc.decide.full }).least, L.judge(dc.decide.claim, { names: dc.decide.names, given: dc.decide.full }).greatest], 'the cited figures are the problem maker\'s own');
  // what the page is told as it grows: the claim's cell, decided or dark, with the verdict
  const told = [], tell = async (e) => { if (e.stage === 'claim' || e.stage === 'rule') told.push([e.stage, e.kind, e.cell, e.value, e.why]); };
  await W.weave(d, model(reads, rightSum).call, { onEvent: tell }); await W.weave(d, model(reads, rightSum, rightRule, () => 'yes').call, { onEvent: tell });
  const words = T.claimWords(d.decide.words, d.decide.relation, d.decide.figure); assert.deepEqual(told, [['claim', 'bond', words, d.check.value, 'bonded'], ['claim', 'dark', words, null, 'not one comparison']]);
  // a figure misread: the claim is decided on what the document says, and only on that
  const dark = await W.weave(dc, model(() => 'none', rightSum).call, {}); assert.deepEqual([dark.claim, dark.complete, dark.refused.key], [null, false, dc.slots[0].key]);
});

test('weave: what counts as coming out as it should', async () => {
  const call = () => model(reads, rightSum).call, sum = by('computed'), ab = by('absent'), co = by('conflict');
  // a problem that reaches an answer other than the one it should have has not come out as it should
  assert.deepEqual(await W.weave(sum, call(), {}).then((r) => [r.complete, r.home]), [true, true]); assert.deepEqual(await W.weave({ ...sum, check: { value: '1' } }, call(), {}).then((r) => [r.complete, r.home]), [true, false]);
  assert.deepEqual(await W.weave({ ...sum, check: {} }, call(), {}).then((r) => [r.complete, r.home]), [true, false]); assert.deepEqual(await W.weave({ ...sum, check: { value: null } }, async () => ({ text: 'x' }), { maxTicks: 2 }).then((r) => [r.complete, r.answer, r.home]), [false, null, false]);
  const d = by('decided'); assert.deepEqual(await W.weave({ ...d, check: { value: d.check.value === 'yes' ? 'no' : 'yes' } }, call(), {}).then((r) => [r.complete, r.home]), [true, false], 'a verdict that is not the question\'s own');
  // a problem that must not be answered: stopped at that figure, for that reason, and no other
  assert.deepEqual(await W.weave(ab, call(), {}).then((r) => [r.complete, r.refused, r.home]), [false, ab.expect, true]);
  const otherKey = ab.slots.find((s) => s.key !== ab.expect.key).key;
  assert.deepEqual(await W.weave({ ...ab, expect: { ...ab.expect, key: otherKey } }, call(), {}).then((r) => [r.complete, r.refused.key, r.home]), [false, ab.expect.key, false]);
  assert.deepEqual(await W.weave({ ...ab, expect: { ...ab.expect, why: 'more than one figure there' } }, call(), {}).then((r) => [r.complete, r.refused.why, r.home]), [false, 'not in the document', false]);
  assert.deepEqual(await W.weave({ ...co, expect: { ...co.expect, why: 'not in the document' } }, call(), {}).then((r) => [r.refused.why, r.home]), ['more than one figure there', false]);
  // a problem with an answer that is not reached, and a problem with none that is answered, have not come out as they should
  assert.deepEqual(await W.weave(by('mixed'), model(() => 'none', rightSum).call, {}).then((r) => [r.complete, r.home]), [false, false]);
  const mixed = by('mixed'); assert.deepEqual(await W.weave({ ...mixed, expect: { key: mixed.slots[0].key, why: 'not in the document' } }, call(), {}).then((r) => [r.complete, r.refused, r.home]), [true, null, false]);
});

test('weave: every kind of problem comes out as it should with a model that reads and writes rightly', async () => {
  const out = await W.run(DEV, model(reads, rightSum).call, { mem: { probes: 12 } }), rec = (tier) => out.records.filter((r) => r.tier === tier);
  assert.equal(out.records.length, 60); assert.ok(out.records.every((r) => r.home), JSON.stringify(out.records.filter((r) => !r.home).map((r) => r.id)));
  for (const r of rec('computed')) assert.deepEqual([r.strength, r.cites, r.facets.grounded, r.doc, r.complete], ['proven', [], 0, null, true]);
  for (const r of rec('cited')) assert.deepEqual([r.strength, r.crystal, r.facets, r.complete, r.calls], ['grounded', null, { ...NOTHING, grounded: 1 }, true, 1]);
  for (const r of [...rec('mixed'), ...rec('misstated'), ...rec('coded-cited'), ...rec('decided-cited')]) assert.deepEqual([r.strength, r.facets.proven, r.complete], ['grounded', 0, true]);
  for (const r of rec('coded')) assert.deepEqual([r.strength, r.facets.grounded, r.facets.proven, r.complete, r.rule.why], ['proven against its tests', 0, 0, true, 'bonded']);
  for (const r of rec('decided')) assert.deepEqual([r.strength, r.facets, r.complete, r.claim.why, r.calls], ['proven within its encoding', { ...NOTHING, 'proven within its encoding': 1 }, true, 'bonded', 1]);
  // a document that misstates a figure: the answer follows the document, is grounded, and is not what is true
  for (const r of rec('misstated')) { const t = DEV.find((x) => x.id === r.id); assert.equal(r.answer, t.check.value); assert.notEqual(r.answer, t.check.world); assert.equal(r.strength, 'grounded'); }
  // a figure the document does not give, or gives two ways: no answer, the reason, and that is the right outcome
  for (const r of [...rec('absent'), ...rec('conflict')]) { const t = DEV.find((x) => x.id === r.id); assert.deepEqual([r.complete, r.answer, r.strength, r.ask, r.crystal, r.home], [false, null, null, null, null, true]); assert.deepEqual(r.refused, t.expect); }
  assert.ok(rec('absent').every((r) => r.refused.why === 'not in the document') && rec('conflict').every((r) => r.refused.why === 'more than one figure there'));
  // only a problem with no document, no rule and no claim is ever proven
  for (const r of out.records) assert.equal(r.strength === 'proven', r.tier === 'computed' && r.complete, r.id);
  assert.equal(out.seeds, 0); assert.ok(out.cited >= 100, String(out.cited));
  // the count of bonds is of bonds: each figure cited, the rule, the claim, each step bonded or set from what was held, and nothing else
  // (counted on a run where every sum is got wrong the first time it is met, so that steps split and dissolve as well)
  const met = new Set(), slow = await W.run(DEV, model(reads, (c) => (met.has(c) ? rightSum(c) : (met.add(c), wrongSum(c)))).call, {}), kinds = (k) => slow.records.reduce((a, r) => a + (r.crystal ? r.crystal.events.filter((e) => e.kind === k).length : 0), 0);
  for (const r of [...out.records, ...slow.records]) assert.equal(total(r.facets), r.cites.filter((c) => c.value !== null).length + (r.rule && r.rule.value !== null ? 1 : 0) + (r.claim && r.claim.value !== null ? 1 : 0) + (r.crystal ? r.crystal.events.filter((e) => e.kind === 'bond' || e.kind === 'set').length : 0), r.id);
  assert.ok(kinds('split') > 100 && kinds('dissolve') > 100 && kinds('set') > 100 && kinds('bond') > 30, 'steps split, dissolve, bond and are set; only the last two are bonds');
  // the arithmetic memory is shared between problems: a step met again is set from what is held, with no call
  const sum = by('computed'), twice = await W.run([sum, { ...sum, id: 'again:1' }], model(reads, rightSum).call, {});
  assert.ok(twice.records[1].calls < twice.records[0].calls && twice.records[1].complete && twice.records[1].crystal.events.some((e) => e.kind === 'set') && !twice.records[0].crystal.events.some((e) => e.kind === 'set'), JSON.stringify(twice.records.map((r) => r.calls)));
  // the same records again from the recorded replies alone
  assert.deepEqual((await W.replay(DEV, out.records, { mem: { probes: 12 } })).records, out.records);
});

test('weave: a reader that makes a figure up is refused, and a problem never completes on a figure the document does not give', async () => {
  const out = await W.run(DEV, model(invents, rightSum).call, {});
  for (const r of out.records.filter((x) => x.tier === 'absent')) { const dark = r.cites.find((c) => c.kind === 'dark'); assert.match(dark.said, / is 50 pounds\.$/); assert.deepEqual([dark.why, dark.value, r.complete, r.home], ['not in the document', null, false, true]); }
  for (const r of out.records.filter((x) => x.tier === 'conflict')) { const dark = r.cites.find((c) => c.kind === 'dark'); assert.deepEqual([dark.why, r.complete, r.home], ['more than one figure there', false, true]); assert.ok(C.figures(dark.said).length === 1, 'it quoted one of the two lines, and the quote was real'); }
  // whatever the reader says, a complete problem's answer is what its document gives
  for (const read of [reads, invents, () => 'none', () => '', (cite, text) => text.split('\n')[1], (cite, text) => (lineFor(cite, text) || 'x').toUpperCase(), (cite, text) => (lineFor(cite, text) || 'x').replace(/\d/, '9')]) for (const sum of [rightSum, wrongSum]) {
    const o = await W.run(DEV.slice(0, 24), model(read, sum).call, {});
    for (const r of o.records) { const t = DEV.find((x) => x.id === r.id); if (r.complete) { assert.equal(r.answer, t.check.value, r.id); assert.equal(r.home, true); assert.notEqual(r.strength, null); } else assert.deepEqual([r.answer, r.strength], [null, null]); assert.ok(r.strength !== 'proven' || t.tier === 'computed'); }
  }
  // a reader that never reads: every problem with a document is dark at its first figure, and says the model found nothing
  const mute = await W.run(DEV, model(() => 'none', rightSum).call, {});
  for (const r of mute.records) { const t = DEV.find((x) => x.id === r.id); if (t.doc === null) { assert.equal(r.home, true); continue; } assert.equal(r.complete, false); assert.ok(['the model says it is not there', 'not in the document', 'more than one figure there'].includes(r.refused.why)); assert.equal(r.home, r.tier === 'absent' || r.tier === 'conflict' ? r.refused.key === t.expect.key && r.refused.why === t.expect.why : false); }
});

test('weave: a figure cited once from a document is held, and is not asked for again', async () => {
  const t = by('mixed'), again = { ...t, id: 'again:1' }, m = model(reads, rightSum), out = await W.run([t, again], m.call, {});
  assert.deepEqual(out.records[1].cites.map((c) => [c.kind, c.why, c.said, c.carried]), t.slots.map(() => ['set', 'held', null, null])); assert.deepEqual(out.records[1].cites.map((c) => c.value), out.records[0].cites.map((c) => c.value));
  assert.deepEqual(out.records[1].cites.map((c) => c.source), out.records[0].cites.map((c) => c.source)); assert.deepEqual([out.records[1].complete, out.records[1].answer, out.records[1].strength], [true, t.check.value, 'grounded']);
  assert.equal(m.seen.filter((s) => s.cite !== undefined).length, t.slots.length, 'asked once each'); assert.equal(out.cited, t.slots.length);
  // a figure that did not bond is not held: the next problem asks for it again
  const first = model((cite, text) => (cite === t.slots[0].text ? 'none' : reads(cite, text)), rightSum), o2 = await W.run([t, again], first.call, {});
  assert.deepEqual(o2.records.map((r) => r.cites[0].kind), ['dark', 'dark']); assert.equal(first.seen.filter((s) => s.cite === t.slots[0].text).length, 2);
  // after a figure that did not bond, the next figure is asked with the document again, in a fresh conversation
  const second = first.seen.filter((s) => s.cite !== undefined)[1]; assert.equal(second.messages.length, 1 + 2 * W.SHOTS.length + 1); assert.ok(second.messages[second.messages.length - 1].content.startsWith(t.doc.text)); assert.equal(o2.records[0].cites[1].carried, false);
  // a rule and a claim are asked for every problem, held or not: a formula or a claim is not a figure of the document
  const cc = by('coded-cited'), rr = model(reads, rightSum), o3 = await W.run([cc, { ...cc, id: 'again:2' }], rr.call, {}); assert.equal(rr.seen.filter((s) => s.rule !== undefined).length, 2); assert.deepEqual(o3.records.map((r) => r.answer), [cc.check.value, cc.check.value]);
});

test('the worked examples and the settings; nothing throws on a broken problem or a broken reply', async () => {
  assert.deepEqual(W.SETTINGS, { citeTokens: 40, ruleTokens: 40, claimTokens: 48, maxTicks: 256, maxTokens: 24 }); assert.equal(W.SHOTS.length, 2); assert.deepEqual(W.LINE_END, ['\n']);
  const doc = { id: 'ex', text: W.SHOTS[0][0].split('\n\nCopy the one line that states ')[0] };
  assert.equal(C.judge(W.SHOTS[0][1], { text: 'the weekly rent' }, doc).why, 'bonded'); assert.equal(C.judge(W.SHOTS[1][1], { text: 'the key deposit' }, doc).why, 'bonded'); assert.equal(W.SHOTS[1][0], 'Copy the one line that states the key deposit.');
  // the model is asked to copy a line. It is never asked whether the figure is there, and never offered a word for "it is not"
  for (const text of [W.SYSTEM, ...W.SHOTS.flat()]) assert.ok(!/\bnone\b|not state|cannot/i.test(text), text);
  // the worked examples for a rule and a claim are right by the checks themselves, and are from no problem
  const names = (u) => Object.fromEntries([...u.matchAll(/([a-z]) = ([^,.]+)/g)].map((m) => [m[1], m[2]]));
  for (const [u, a] of W.RULE_SHOTS) { const words = u.match(/^The rule: (.*)\. Letters/)[1], letters = Object.keys(names(u)); assert.ok(letters.length >= 3); assert.equal(F.read(a, letters).tree !== undefined, true, a); assert.ok(!Object.values(T.KINDS).some((K) => K.asks.some(([, , w]) => w === words))); }
  assert.deepEqual(W.RULE_SHOTS.map(([, a]) => a), ['w × n + k', 'w + f ÷ n - x']); assert.equal(W.CLAIM_SHOTS.length, 4);
  for (const [u, a] of W.CLAIM_SHOTS) { const given = Object.fromEntries(Object.keys(names(u)).map((n) => [n, ['1', '9']])); assert.notEqual(L.judge(a, { names: names(u), given }).value, null, a); }
  assert.deepEqual(W.CLAIM_SHOTS.map(([, a]) => a), ['w × n + k ≥ 300', 'w × n < 900', 'w + f ÷ n > 95', 'w × n - x ≤ 640'], 'one of each relation'); assert.ok(W.CLAIM_SHOTS[0][0].includes('comes to at least 300 pounds'));
  assert.deepEqual(W.CLAIM_SHOTS.map(([u]) => u.match(/^The claim: (.*?) comes to/)[1]), ['the weekly rent times the number of weeks, plus the key deposit,', 'the weekly rent times the number of weeks', 'the weekly rent, plus the cleaning fee divided by the number of weeks,', 'the weekly rent times the number of weeks, less the discount,']);
  assert.deepEqual(W.CLAIM_SHOTS.map(([u]) => u.match(/comes to (.*) pounds/)[1]), ['at least 300', 'less than 900', 'more than 95', 'at most 640']);
  assert.equal(W.CLAIM_SYSTEM, 'You write a claim as a comparison. Use only the letters given, numbers, + - × ÷, brackets, and one of ≥ > ≤ <. Reply with the comparison and nothing else.');
  assert.equal(W.RULE_SYSTEM, 'You write a rule as a formula. Use only the letters given, numbers, + - × ÷ and brackets. Reply with the formula and nothing else.');
  assert.equal(W.legend({ p: 'the unit price', c: 'the order size' }), 'p = the unit price, c = the order size'); assert.equal(W.legend(null), ''); assert.equal(W.legend('x'), '');
  assert.deepEqual(W.writing({ words: 'a times b', names: { a: 'A', b: 'B' } }).slice(-1), [{ role: 'user', content: 'The rule: a times b. Letters: a = A, b = B.' }]); assert.equal(W.writing(null).length, 2 + 2 * W.RULE_SHOTS.length);
  assert.deepEqual(W.claiming({ words: 'a times b', relation: 'at most', figure: '9', names: { a: 'A', b: 'B' } }).slice(-1), [{ role: 'user', content: 'The claim: a times b comes to at most 9 pounds. Letters: a = A, b = B.' }]);
  for (const t of T.set(20261201, 5)) if (t.doc) assert.ok(!t.doc.text.includes('weekly rent') && !t.doc.text.includes('Lease'), 'the example is from no problem');
  assert.deepEqual(W.reading({ text: 'D' }, [], { text: 'q' }).slice(-1), [{ role: 'user', content: 'D\n\nCopy the one line that states q.' }]); assert.deepEqual(W.reading({ text: 'D' }, [[{ text: 'a' }, 'A.']], { text: 'q' }).slice(-3).map((m) => m.content), ['D\n\nCopy the one line that states a.', 'A.', 'Copy the one line that states q.']);
  assert.equal(W.reading({ text: 'D' }, null, { text: 'q' }).length, 2 + 2 * W.SHOTS.length);
  for (const bad of HOSTILE) await assert.doesNotReject(() => W.weave(bad, async () => ({ text: 'x' }), {}));
  for (const reply of [null, undefined, 7, {}, { text: 9 }]) { const r = await W.weave(by('mixed'), async () => reply, {}); assert.deepEqual([r.complete, r.cites[0].kind, r.cites[0].why, r.cites[0].said], [false, 'dark', 'the model says it is not there', '']); }
  for (const tier of ['coded', 'decided']) for (const reply of [null, 7, { text: 9 }]) { const r = await W.weave(by(tier), async () => reply, {}); assert.deepEqual([r.complete, r.refused.key], [false, tier === 'coded' ? 'rule' : 'claim']); }
  const empty = await W.weave(null, async () => ({ text: 'x' }), {}); assert.deepEqual([empty.complete, empty.cites, empty.strength, empty.home, empty.calls], [false, [], null, false, 0]);
  assert.deepEqual((await W.run(null, async () => ({}), null)).records, []); assert.deepEqual((await W.replay([by('cited')], null, null)).records.map((r) => r.complete), [false]);
  for (const rec of [null, 7, {}, { cites: 5 }, { cites: [null, { said: 9 }], crystal: { events: 'x' } }, { rule: 7, claim: 'x' }]) await assert.doesNotReject(() => W.replay([by('mixed'), by('coded'), by('decided')], [rec], {}));
  // a record that has been damaged is replayed from the replies it still holds, in order, and from nothing else in it
  const one = by('cited'), line = lineFor(one.slots[0].text, one.doc.text);
  for (const cites of [[null, 7, 'x', { said: 9 }, { said: line }], [{ said: line, ms: 4 }], [{ said: 9 }, {}, [], { said: line }]]) { const back = await W.replay([one], [{ id: one.id, cites, crystal: { events: [null, 5, { said: 3 }] } }], {}); assert.deepEqual([back.records[0].complete, back.records[0].answer, back.records[0].cites[0].said], [true, one.check.value, line], JSON.stringify(cites)); }
  assert.deepEqual((await W.replay([one], [{ id: one.id, cites: [{ said: 9 }], crystal: null }], {})).records[0].cites.map((c) => [c.why, c.said]), [['the model says it is not there', '']]);
  for (const tier of ['mixed', 'coded', 'coded-cited', 'decided', 'decided-cited']) { const t = by(tier), whole = await W.weave(t, model(reads, rightSum).call, {}), again = await W.replay([t], [{ ...whole, cites: [null, ...whole.cites], crystal: whole.crystal && { ...whole.crystal, events: [7, ...whole.crystal.events] } }], {}); assert.deepEqual(again.records[0], whole, `${tier}: the same record, from its own replies`); }
  // the rule's reply and the claim's come back in their place: after the figures, before the steps
  const cc = by('coded-cited'), rec = await W.weave(cc, model(reads, rightSum).call, {}), seen = []; await W.replay([cc], [rec], {}).then(() => seen.push('ok')); assert.deepEqual(seen, ['ok']);
});
