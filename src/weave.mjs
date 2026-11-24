// weave.mjs — one crystal from four kinds of bond. The growth law of this build.
//
// A problem may need figures from a document, a rule, a claim, and a calculation. It is grown in stages, and each
// stage has its own check:
//
//   CITE     every figure the question needs is a cited cell ("the unit price"). The model is shown the document
//            and asked to copy the one line that states it. It is never asked WHETHER the document states it:
//            offered the word "none", this model said none of a third of the figures that were there (the dev
//            problems, data/bench.json). Whether a figure is there is for cite.mjs to rule, on the document itself.
//            A figure cited before from the same document is set from what is held, with no call. A figure that
//            does not bond is DARK, with the reason: a cited cell has nothing smaller to split into.
//   RULE     for a coded problem: the model is given the rule in words and a letter for each quantity, and asked to
//            write it as a formula. formula.mjs runs the formula on the rule's tests. If it passes them all, the
//            figures are put in its letters' places and that is the calculation. If not, the rule is dark.
//   CLAIM    for a decided problem: the model is given the claim in words and the letters, and asked to write it as
//            a comparison. logic.mjs decides it from what is given (the figures cited, and the one the question gives
//            between two figures). The verdict is the answer: yes, no, or it depends.
//   COMPUTE  with the calculation known (the question's own, or the one the model's formula makes), it is grown as
//            The Crystal grows one (vendor/crystal): set, bond, split, dissolve, cell by cell, each reply ruled on by
//            The Crystal's bond-check.
//
// If any stage is dark there is no answer: the record says which cell, and why. For a document that does not state
// a figure, or states it two ways, that IS the right outcome, and it is counted as one.
//
// Every bond carries its kind, and by THE LAW (strength.mjs) every facet is as strong as the weakest bond beneath it:
// a figure cited is GROUNDED, a formula that passed its tests is PROVEN AGAINST ITS TESTS, a claim the solver decided
// is PROVEN WITHIN ITS ENCODING, a step worked out is PROVEN by itself, and each is no stronger than what it stands on.
//
// It ends: each figure, the rule and the claim are asked once; the calculation ends as The Crystal's does. Pure apart
// from the memory it is handed; deterministic; nothing here throws on a reply.
import { num, show } from '../vendor/crystal/vendor/climb/src/exact.mjs';
import { sha256 } from '../vendor/crystal/vendor/climb/src/sha256.mjs';
import { grow, seeded } from '../vendor/crystal/src/grow.mjs';
import KEEP from '../vendor/crystal/vendor/climb/src/keep.mjs';
import { judge, terms } from './cite.mjs';
import { judge as tested, applied } from './formula.mjs';
import { judge as decided } from './logic.mjs';
import { label, weakest, tally } from './strength.mjs';
import { asked, claimWords } from './tasks.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
export const SETTINGS = { citeTokens: 40, ruleTokens: 40, claimTokens: 48, maxTicks: 256, maxTokens: 24 };
export const SYSTEM = 'You copy one line from a document. Reply with that line exactly as it is written in the document, letter for letter, and nothing else.';
// a quote is one line, and so is a formula or a claim: each reply is ended at the end of its first line
export const LINE_END = ['\n'];
// one worked example, invented, from no problem set: two lines copied
const EXAMPLE = 'Lease between the Landlord and the Tenant\n1. The weekly rent is 85 pounds.\n2. Either party may end this lease in writing.\n3. The key deposit is 40 pounds.';
const question = (cell) => `Copy the one line that states ${cell.text}.`;
export const SHOTS = [[`${EXAMPLE}\n\n${question({ text: 'the weekly rent' })}`, 'The weekly rent is 85 pounds.'], [question({ text: 'the key deposit' }), 'The key deposit is 40 pounds.']];
// the letters of a rule or a claim, as the model is shown them: "p = the unit price, c = the order size"
export const legend = (names) => Object.entries(names !== null && typeof names === 'object' ? names : {}).map(([n, w]) => `${n} = ${w}`).join(', ');
const LEASE = { w: 'the weekly rent', n: 'the number of weeks', k: 'the key deposit' }, CLEAN = { w: 'the weekly rent', n: 'the number of weeks', f: 'the cleaning fee', x: 'the discount' };
export const RULE_SYSTEM = 'You write a rule as a formula. Use only the letters given, numbers, + - × ÷ and brackets. Reply with the formula and nothing else.';
// two worked examples, invented: a sum of a product, and a division
export const RULE_SHOTS = [[`The rule: the weekly rent times the number of weeks, plus the key deposit. Letters: ${legend(LEASE)}.`, 'w × n + k'], [`The rule: the weekly rent, plus the cleaning fee divided by the number of weeks, less the discount. Letters: ${legend(CLEAN)}.`, 'w + f ÷ n - x']];
export const CLAIM_SYSTEM = 'You write a claim as a comparison. Use only the letters given, numbers, + - × ÷, brackets, and one of ≥ > ≤ <. Reply with the comparison and nothing else.';
// four worked examples, invented, one for each way a claim can compare
export const CLAIM_SHOTS = [
  [`The claim: ${claimWords('the weekly rent times the number of weeks, plus the key deposit', 'at least', 300)}. Letters: ${legend(LEASE)}.`, 'w × n + k ≥ 300'],
  [`The claim: ${claimWords('the weekly rent times the number of weeks', 'less than', 900)}. Letters: ${legend({ w: LEASE.w, n: LEASE.n })}.`, 'w × n < 900'],
  [`The claim: ${claimWords('the weekly rent, plus the cleaning fee divided by the number of weeks', 'more than', 95)}. Letters: ${legend({ w: CLEAN.w, n: CLEAN.n, f: CLEAN.f })}.`, 'w + f ÷ n > 95'],
  [`The claim: ${claimWords('the weekly rent times the number of weeks, less the discount', 'at most', 640)}. Letters: ${legend({ w: CLEAN.w, n: CLEAN.n, x: CLEAN.x })}.`, 'w × n - x ≤ 640'],
];
const talk = (system, shots, last) => [{ role: 'system', content: system }, ...shots.flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }]), { role: 'user', content: last }];
// writing(rule) → the conversation that asks for a rule as a formula
export const writing = (rule) => talk(RULE_SYSTEM, RULE_SHOTS, `The rule: ${get(rule, 'words')}. Letters: ${legend(get(rule, 'names'))}.`);
// claiming(d) → the conversation that asks for a claim as a comparison
export const claiming = (d) => talk(CLAIM_SYSTEM, CLAIM_SHOTS, `The claim: ${claimWords(String(get(d, 'words')), get(d, 'relation'), get(d, 'figure'))}. Letters: ${legend(get(d, 'names'))}.`);
// reading(doc, held, cell) → the conversation for one cited cell: the system line, the example, the document with
// the first figure asked of it, every figure of this document that has bonded with the reply that bonded it, the cell
export function reading(doc, held, cell) {
  const said = Array.isArray(held) ? held : [], turns = [...SHOTS, ...said.map(([c, reply], i) => [i === 0 ? `${doc.text}\n\n${question(c)}` : question(c), reply]), [said.length === 0 ? `${doc.text}\n\n${question(cell)}` : question(cell), null]];
  return [{ role: 'system', content: SYSTEM }, ...turns.flatMap(([u, a]) => (a === null ? [{ role: 'user', content: u }] : [{ role: 'user', content: u }, { role: 'assistant', content: a }]))];
}
const cap = (opts, k) => { const v = get(opts, k); return Number.isInteger(v) && v > 0 ? v : SETTINGS[k]; };
// a call's reply, kept: { said, ms, prompt, reply }
const kept = (r) => ({ said: typeof get(r, 'text') === 'string' ? r.text : '', ms: Number(get(r, 'ms')) || 0, prompt: get(r, 'prompt') ?? null, reply: get(r, 'reply') ?? null });

// weave(task, call, opts) → the record of one problem.
//   cites    one for each figure the question needs, in order: { key, cell, value, source, said, carried, ms, prompt,
//            reply, kind, why }. kind is 'set' (held already), 'bond' or 'dark'. value is the figure as text.
//   rule     for a coded problem: { said, value (the formula, written one way), why, passed, of, ms, prompt, reply }
//   claim    for a decided problem: { said, value (the verdict), why, claim, least, greatest, ms, prompt, reply }
//   ask      the calculation with the figures in place, or null when there is none to grow
//   crystal  The Crystal's own record of the calculation (its events), or null when there is none
//   complete an answer was reached; answer is it. refused: { key, why } the first cell that is dark, when one is
//   strength how true the answer is, by THE LAW, or null when there is no answer
//   facets   how many bonds of each strength the problem's crystal holds, by THE LAW
// opts.memory is the arithmetic memory shared between problems; opts.cited the figures already cited (a Map).
export async function weave(task, call, opts) {
  const doc = get(task, 'doc') || null, slots = Array.isArray(get(task, 'slots')) ? task.slots : [], cited = get(opts, 'cited') instanceof Map ? opts.cited : new Map(), tell = get(opts, 'onEvent');
  const rec = { id: get(task, 'id'), tier: get(task, 'tier'), sheet: get(task, 'sheet'), kind: get(task, 'kind') ?? null, doc: get(doc, 'id') ?? null, cites: [], rule: null, claim: null, ask: null, crystal: null, complete: false, answer: null, home: false, calls: 0, refused: null, strength: null, facets: null };
  const figures = {}, held = [];
  let carried = false;
  for (const slot of slots) {
    const cell = { text: get(slot, 'text') }, key = `${sha256(get(doc, 'text') ?? '')}|${(terms(cell) || []).join(' ')}`, base = { key: get(slot, 'key'), cell: cell.text, value: null, source: null, said: null, carried: null, ms: 0, prompt: null, reply: null };
    let c;
    if (cited.has(key)) c = { ...base, kind: 'set', why: 'held', value: cited.get(key).value, source: cited.get(key).source };
    else {
      const r = kept(await call(reading(doc, held, cell), cap(opts, 'citeTokens'), { stop: LINE_END })), j = judge(r.said, cell, doc);
      rec.calls++;
      c = { ...base, ...r, kind: j.value === null ? 'dark' : 'bond', why: j.why, value: j.value === null ? null : show(j.value), source: j.source, carried };
      carried = j.value !== null;
      if (j.value !== null) { held.push([cell, r.said]); cited.set(key, { value: c.value, source: c.source }); }
    }
    rec.cites.push(c);
    if (c.value !== null) figures[c.key] = c.value; else if (rec.refused === null) rec.refused = { key: c.key, why: c.why };
    if (typeof tell === 'function') await tell({ stage: 'cite', ...c }, rec);
  }
  // the figures cited, by the letter the rule or the claim gives each one (the letter whose words are the cell's)
  const lettered = (names) => Object.fromEntries(rec.cites.filter((c) => c.value !== null).map((c) => [Object.keys(names).find((n) => names[n] === c.cell), c.value]).filter(([n]) => n !== undefined));
  const rule = get(task, 'rule') || null, claim = get(task, 'decide') || null;
  if (rec.refused === null && rule !== null) {
    const r = kept(await call(writing(rule), cap(opts, 'ruleTokens'), { stop: LINE_END })), j = tested(r.said, rule);
    rec.calls++;
    rec.rule = { ...r, value: j.value, why: j.why, passed: j.passed, of: j.of };
    if (typeof tell === 'function') await tell({ stage: 'rule', cell: String(get(rule, 'words')), kind: j.value === null ? 'dark' : 'bond', ...rec.rule }, rec);
    if (j.value === null) rec.refused = { key: 'rule', why: j.why };
    else rec.ask = applied(j.value, rule, { ...(get(task, 'given') || {}), ...lettered(rule.names) });
  } else if (rec.refused === null && claim !== null) {
    const r = kept(await call(claiming(claim), cap(opts, 'claimTokens'), { stop: LINE_END })), j = decided(r.said, { names: claim.names, given: { ...claim.given, ...lettered(claim.names) } });
    rec.calls++;
    rec.claim = { ...r, value: j.value, why: j.why, claim: j.claim, least: j.least, greatest: j.greatest };
    if (typeof tell === 'function') await tell({ stage: 'claim', cell: claimWords(String(claim.words), claim.relation, claim.figure), kind: j.value === null ? 'dark' : 'bond', ...rec.claim }, rec);
    if (j.value === null) rec.refused = { key: 'claim', why: j.why };
    else { rec.complete = true; rec.answer = j.value; }
  } else if (rec.refused === null) rec.ask = asked(task, figures);
  if (rec.refused === null && rec.ask !== null) {
    if (num(rec.ask) !== null) { rec.complete = true; rec.answer = show(num(rec.ask)); }
    else {
      rec.crystal = await grow({ id: rec.id, tier: rec.tier, family: rec.kind, sheet: rec.sheet, ask: rec.ask, check: { type: 'value', value: get(get(task, 'check'), 'value') } }, call, { memory: get(opts, 'memory') || null, mem: get(opts, 'mem'), maxTicks: cap(opts, 'maxTicks'), maxTokens: cap(opts, 'maxTokens'), onEvent: typeof tell === 'function' ? (e) => tell({ stage: 'compute', ...e }, rec) : undefined });
      rec.calls += rec.crystal.calls; rec.complete = rec.crystal.complete; rec.answer = rec.crystal.answer;
    }
  }
  // THE LAW, on this problem's own bonds: each cited figure, the rule, the claim (standing on the figures), then each
  // step worked out (standing on the figures and the rule)
  const roots = rec.cites.filter((c) => c.value !== null).map(() => ({ type: 'cited', on: [] })), under = roots.map((_, i) => i);
  const ruled = rec.rule !== null && rec.rule.value !== null ? [{ type: 'executed', on: [] }] : [], claimed = rec.claim !== null && rec.claim.value !== null ? [{ type: 'logical', on: under }] : [];
  const below = [...under, ...ruled.map((_, i) => roots.length + i)], steps = rec.crystal === null ? [] : rec.crystal.events.filter((e) => e.kind === 'bond' || e.kind === 'set');
  const labels = label([...roots, ...ruled, ...claimed, ...steps.map(() => ({ type: 'computed', on: below }))]);
  rec.facets = tally(labels);
  rec.strength = rec.complete ? weakest(labels.map((l) => l.strength)) : null;
  const want = get(get(task, 'check'), 'value'), expect = get(task, 'expect') || null;
  rec.home = expect === null ? rec.complete && typeof want === 'string' && rec.answer === want : !rec.complete && rec.refused !== null && rec.refused.key === expect.key && rec.refused.why === expect.why;
  return rec;
}

// a call that hands back a record's own replies in order (the cited ones, the rule's, the claim's, then the
// calculation's), in place of a model
const recorded = (rec) => {
  const said = [...(Array.isArray(get(rec, 'cites')) ? rec.cites : []), get(rec, 'rule'), get(rec, 'claim'), ...(Array.isArray(get(get(rec, 'crystal'), 'events')) ? rec.crystal.events : [])].filter((e) => e !== null && typeof e === 'object' && typeof e.said === 'string');
  let at = 0;
  return async () => { const e = said[at++] || {}; return { text: typeof e.said === 'string' ? e.said : '', ms: Number(e.ms) || 0, prompt: e.prompt ?? null, reply: e.reply ?? null }; };
};
// run(tasks, call, opts) → every problem's record, grown in order on one memory (it starts as opts.seed, the steps
// The Crystal's sealed run checked) and one store of cited figures. opts.done holds records already made: those are
// grown again from their own replies, and the model is asked only for the rest.
export async function run(tasks, call, opts) {
  const M = seeded(get(opts, 'seed')), seeds = KEEP.stats(M).facts, cited = new Map(), records = [];
  const prior = new Map((Array.isArray(get(opts, 'done')) ? opts.done : []).map((r) => [get(r, 'id'), r]));
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const was = prior.get(get(task, 'id'));
    const rec = await weave(task, was ? recorded(was) : call, { ...opts, memory: M, cited, onEvent: was ? undefined : get(opts, 'onEvent') });
    records.push(rec);
    if (!was && typeof get(opts, 'onDone') === 'function') await opts.onDone(rec, M);
  }
  return { records, seeds, memory: KEEP.stats(M), cited: cited.size };
}
// replay(tasks, records, opts) → the same records grown again from the recorded replies, with no model
export async function replay(tasks, records, opts) {
  const byId = new Map((Array.isArray(records) ? records : []).map((r) => [get(r, 'id'), r]));
  const all = (Array.isArray(tasks) ? tasks : []).map((t) => byId.get(get(t, 'id')) || { id: get(t, 'id'), cites: [] });
  return run(tasks, recorded(null), { ...opts, done: all, onEvent: undefined, onDone: undefined });
}

export default { SETTINGS, SYSTEM, LINE_END, SHOTS, RULE_SYSTEM, RULE_SHOTS, CLAIM_SYSTEM, CLAIM_SHOTS, legend, writing, claiming, reading, weave, run, replay };
