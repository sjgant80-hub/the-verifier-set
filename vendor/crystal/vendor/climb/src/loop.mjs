// loop.mjs — the climb, and the two plainer loops it is measured against. One PASS is: the model writes working and
// an answer; the checker (checker.mjs, code) rules on it. What happens between passes is the only difference:
//
//   climb   the checker's ruling goes back in: which steps are right, which are wrong (never with the right value),
//           and what is LEFT TO DO. The checker holds the calculation the problem asks for (left.mjs), crosses off
//           each part the model got right, and replaces a wrong step by a split into smaller steps (plan.mjs). So
//           every pass starts from a smaller problem than the last. True steps are written to the memory, and a
//           step a problem has to do that the memory already holds is crossed off before the model is asked. It
//           stops when the answer is right, or when it has stalled (the same reply to the same ruling).
//   retry   the model is told only that its answer is not right, and tries again. Same number of chances at the
//           finish line as the climb, with no steps checked and no memory. Stops when the answer is right.
//   naive   nobody checks anything. The model is asked to re-read its own working and correct it. This is plain
//           recursion: a model reviewing its own output. It stops when its answer stops changing.
//
// One pass of retry is also the single-pass baseline: the model, cold, once.
// A problem's passes are one growing conversation, so the browser can reuse what it already computed for the earlier
// turns. The prompts and worked examples are fixed here; the examples are invented and come from no task set.
import { rule, claimsOf } from './checker.mjs';
import { evaluate, num } from './exact.mjs';
import { split } from './plan.mjs';
import LEFT from './left.mjs';
import MEM from './keep.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
export const SETTINGS = { depth: 8, maxTokens: 128 };
export const SYSTEM = 'You work out calculations one small step at a time. Write each step on its own line as: working = number. Use only numbers and the signs + - × ÷. Do not write units. End with a line: ANSWER: number';
export const RETRY = 'That answer is not right. Try again, one small step per line, and end with ANSWER: number';
export const REVIEW = 'Check your working line by line, correct any mistake, and end with ANSWER: number';

// whole(c) → the part of a reply that was finished: a reply cut off at the length limit loses its last line, which
// may be half a number
const whole = (c) => (get(c, 'cut') === true ? c.text.split('\n').slice(0, -1).join('\n') : c.text);

// judge(text, task, x) → the checker's whole reading of one reply. On top of the ruling (kept, dropped, answer,
// home) it gives: used, the true lines that crossed a part of the calculation off; left, what is left of the
// calculation x afterwards (null for a problem that carries none); and splits, for such a problem only, a smaller-
// step line for each of its first three wrong steps that has one.
export function judge(text, task, x) {
  const r = rule(text, task), used = [], splits = [];
  let at = x === undefined ? null : x;
  if (at === null) {
    for (const d of r.dropped.slice(0, 3)) { const s = split(d.text.split(' = ')[0]); if (s !== null) splits.push(s); }
    return { ...r, used: r.kept.map((k) => k.text), splits, left: null };
  }
  for (const c of claimsOf(text)) {
    const a = evaluate(c.left), b = evaluate(c.right), work = a.ops > 0 ? c.left : c.right;
    if (!c.ok) { const w = LEFT.wrong(at, work); if (w !== null) at = w.left; continue; }
    // (the line is true, so its two sides are one value)
    const got = a.ops > 0 && b.ops > 0 ? LEFT.rewrite(at, c.left, c.right) : LEFT.cross(at, work, a.value);
    if (got !== null) { at = got.left; used.push(`${c.left} = ${c.right}`); }
  }
  return { ...r, used, splits, left: at };
}
// recall(M, x, asked, mem) → the memory is asked for every step that could be done next, each once per problem; a
// step it holds is crossed off, which can open new steps, so it asks until nothing more comes back
function recall(M, x, asked, mem) {
  const served = [];
  let at = x, again = M !== null && x !== null;
  while (again) {
    again = false;
    for (const a of LEFT.atoms(at)) {
      if (asked.has(a.canon)) continue;
      asked.add(a.canon);
      const fact = MEM.lookup(M, a.canon, a.text, mem), parts = fact === null ? [] : fact.split(' = ');
      const got = fact === null ? null : LEFT.cross(at, parts[0], num(parts[1]));
      if (got !== null) { at = got.left; served.push(fact); again = true; break; }
    }
  }
  return { left: at, served };
}
const leftOf = (x) => (x === null ? null : LEFT.left(x));
const done = (x) => x !== null && LEFT.ops(x) === 0;

// ruling(j, served, x) → the checker's message after a pass that did not finish, from its reading j of the reply,
// the facts the memory served, and what is left. It never gives a right value for a wrong step.
export function ruling(j, served, x) {
  const lines = [];
  if (j.used.length) lines.push(`Right: ${j.used.join('; ')}`);
  if (j.dropped.length) lines.push(`Wrong: ${j.dropped.map((d) => d.text).join('; ')}`);
  for (const s of j.splits) lines.push(`Smaller steps: ${s}`);
  if (j.kept.length + j.dropped.length === 0) lines.push('No step could be checked. Write each step as: working = number');
  if (served.length) lines.push(`Already checked, you can use these: ${served.join('; ')}`);
  if (x !== null) lines.push(done(x) ? 'Every step is done. Give the result of the last step as the answer.' : `Left to do: ${LEFT.left(x)}`);
  else if (!j.dropped.length) lines.push(j.answer === null ? 'There was no ANSWER line.' : 'The answer is not right yet.');
  lines.push('One step per line, then ANSWER: number');
  return lines.join('\n');
}
// the worked examples: two plain ones, and one that shows a wrong step being split and put right. The ruling in it
// is the one this file gives that reply.
const SHOWN = { statement: 'A current of 12 A flows through a 45 Ω resistor. Power = current × current × resistance. How many watts?', ask: '12 × 12 × 45', check: { type: 'value', value: '6480' } };
const SLIP = '12 × 12 = 144\n144 × 45 = 6380\nANSWER: 6380', TOLD = judge(SLIP, SHOWN, LEFT.start(SHOWN.ask));
export const SHOTS = [
  ['A 6 kg box moves at 12 m/s. Kinetic energy = 0.5 × mass × speed × speed. How many joules?', '12 × 12 = 144\n0.5 × 6 = 3\n3 × 144 = 432\nANSWER: 432'],
  ['Work out 34 × 7 + 15 × 8.', '34 × 7 = 238\n15 × 8 = 120\n238 + 120 = 358\nANSWER: 358'],
  [SHOWN.statement, SLIP],
  [ruling(TOLD, [], TOLD.left), '144 × 40 = 5760\n144 × 5 = 720\n5760 + 720 = 6480\nANSWER: 6480'],
];

// opening(statement, facts, x) → the conversation a problem starts with. When the memory already held steps of it,
// they are named, with what is left to do.
export function opening(statement, facts, x) {
  const served = Array.isArray(facts) ? facts : [], at = x === undefined ? null : x;
  const given = served.length === 0 ? '' : `\nAlready checked, you can use these: ${served.join('; ')}${at === null ? '' : done(at) ? '\nEvery step is done. Give the result of the last step as the answer.' : `\nLeft to do: ${LEFT.left(at)}`}`;
  return [{ role: 'system', content: SYSTEM }, ...SHOTS.flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }]), { role: 'user', content: `${statement}${given}` }];
}

// caller(ask) → a call that remembers: the same conversation is asked of the model once, however many loops need it
export function caller(ask) {
  const memo = new Map();
  return async (messages, maxTokens) => {
    const key = JSON.stringify([messages, maxTokens]);
    if (memo.has(key)) return { ...memo.get(key), cached: true };
    const r = await ask(messages, maxTokens);
    const c = { text: typeof get(r, 'text') === 'string' ? r.text : '', ms: Number(get(r, 'ms')) || 0, ttft: get(r, 'ttft') ?? null, prompt: get(r, 'prompt') ?? null, reply: get(r, 'reply') ?? null, cut: get(r, 'cut') === true };
    memo.set(key, c);
    return { ...c, cached: false };
  };
}
const row = (c, r, extra) => ({ said: c.text, ms: c.ms, ttft: c.ttft, prompt: c.prompt, reply: c.reply, cached: c.cached === true, cut: c.cut === true, kept: r.kept.map((x) => x.text), dropped: r.dropped.map((x) => x.text), answer: r.answer, home: r.home, ...extra });
const base = (task, arm) => ({ id: get(task, 'id'), arm, tier: get(task, 'tier'), family: get(task, 'family'), sheet: get(task, 'sheet') });
const depthOf = (opts) => { const d = get(opts, 'depth'); return Number.isInteger(d) && d > 0 && d <= 12 ? d : SETTINGS.depth; };
const tokensOf = (opts) => { const t = get(opts, 'maxTokens'); return Number.isInteger(t) && t > 0 ? t : SETTINGS.maxTokens; };
const homeAt = (passes) => { const i = passes.findIndex((p) => p.home); return i < 0 ? null : i + 1; };
// opts.onPass(pass, n) is told of each pass as it is recorded, so a page can show a climb while it happens
const tell = async (opts, passes) => { const f = get(opts, 'onPass'); if (typeof f === 'function') await f(passes[passes.length - 1], passes.length); };

// climb(task, call, opts) → the record of one problem's climb. opts.memory is the run's memory, or null for a climb
// with no memory between problems. Each pass records what was served to it, which lines crossed something off, and
// what was left to do after it.
export async function climb(task, call, opts) {
  const M = get(opts, 'memory') || null, depth = depthOf(opts), maxTokens = tokensOf(opts), mem = get(opts, 'mem'), passes = [], asked = new Set();
  const first = recall(M, LEFT.start(get(task, 'ask')), asked, mem);
  const messages = opening(get(task, 'statement'), first.served, first.left);
  let x = first.left, served = first.served, told = null, stalled = false;
  for (let d = 1; d <= depth; d++) {
    const c = await call(messages, maxTokens), j = judge(whole(c), task, x);
    if (M) for (const k of j.kept) MEM.fold(M, k, get(task, 'id'));
    const next = j.home ? { left: j.left, served: [] } : recall(M, j.left, asked, mem);
    x = next.left;
    passes.push(row(c, j, { used: j.used, served, left: leftOf(x) }));
    await tell(opts, passes);
    if (j.home) break;
    const say = ruling(j, next.served, x);
    // the same reply to the same ruling: with a model that always picks its likeliest word, the next pass would repeat it
    if (say === told && c.text === passes[d - 2].said) { stalled = true; break; }
    told = say; served = next.served;
    messages.push({ role: 'assistant', content: c.text }, { role: 'user', content: say });
  }
  return { ...base(task, M ? 'climb' : 'climb-alone'), passes, homeAt: homeAt(passes), stalled };
}

// retry(task, call, opts) → told only "not right", up to the same number of passes
export async function retry(task, call, opts) {
  const depth = depthOf(opts), maxTokens = tokensOf(opts), passes = [], messages = opening(get(task, 'statement'), []);
  let stalled = false;
  for (let d = 1; d <= depth; d++) {
    const c = await call(messages, maxTokens), r = rule(whole(c), task);
    passes.push(row(c, r, { served: [] }));
    await tell(opts, passes);
    if (r.home) break;
    if (d > 1 && c.text === passes[d - 2].said) { stalled = true; break; }
    messages.push({ role: 'assistant', content: c.text }, { role: 'user', content: RETRY });
  }
  return { ...base(task, 'retry'), passes, homeAt: homeAt(passes), stalled };
}

// naive(task, call, opts) → the model reviews its own working with no checker; the rulings are recorded for scoring
// only and never shown to it. It stops when its answer is the same two passes running.
export async function naive(task, call, opts) {
  const depth = depthOf(opts), maxTokens = tokensOf(opts), passes = [], messages = opening(get(task, 'statement'), []);
  for (let d = 1; d <= depth; d++) {
    const c = await call(messages, maxTokens), r = rule(whole(c), task);
    passes.push(row(c, r, { served: [] }));
    await tell(opts, passes);
    if (d > 1 && r.answer !== null && r.answer === passes[d - 2].answer) break;
    messages.push({ role: 'assistant', content: c.text }, { role: 'user', content: REVIEW });
  }
  return { ...base(task, 'naive'), passes, homeAt: homeAt(passes), stalled: false };
}
export const ARMS = { climb, 'climb-alone': climb, retry, naive };

// a call that hands back a record's own replies in order, in place of a model
const recorded = (rec) => {
  const said = Array.isArray(get(rec, 'passes')) ? rec.passes : [];
  let at = 0;
  return async () => { const p = said[at++] || {}; return { text: typeof p.said === 'string' ? p.said : '', ms: Number(p.ms) || 0, ttft: p.ttft ?? null, prompt: p.prompt ?? null, reply: p.reply ?? null, cached: p.cached === true, cut: p.cut === true }; };
};
// run(tasks, arm, call, opts) → every problem's record for one loop, worked through in order. The climb's memory
// starts empty and lasts the whole run. opts.done holds records already made (a run picked up after the tab was
// closed): those problems are decided again from their own replies, which rebuilds the memory, and the model is asked
// only for the rest. onDone(record, memory) is called after each problem the model worked.
export async function run(tasks, arm, call, opts) {
  const M = arm === 'climb' ? MEM.create() : null, records = [];
  const prior = new Map((Array.isArray(get(opts, 'done')) ? opts.done : []).map((r) => [get(r, 'id'), r]));
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const was = prior.get(get(task, 'id'));
    const rec = await ARMS[arm](task, was ? recorded(was) : call, { ...(opts || {}), memory: M });
    records.push(rec);
    if (!was && typeof get(opts, 'onDone') === 'function') await opts.onDone(rec, M);
  }
  return { arm, records, memory: M ? MEM.stats(M) : null };
}
// replay(tasks, arm, records, opts) → the same loop decided again from the recorded replies, in order, with no model
export async function replay(tasks, arm, records, opts) {
  const byId = new Map((Array.isArray(records) ? records : []).map((r) => [get(r, 'id'), r]));
  const all = (Array.isArray(tasks) ? tasks : []).map((t) => byId.get(get(t, 'id')) || { id: get(t, 'id'), passes: [] });
  return run(tasks, arm, recorded(null), { ...(opts || {}), done: all });
}

export default { SETTINGS, SYSTEM, SHOTS, RETRY, REVIEW, opening, judge, ruling, caller, climb, retry, naive, ARMS, run, replay };
