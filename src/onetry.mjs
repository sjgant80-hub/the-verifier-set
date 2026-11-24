// onetry.mjs — the same model with nothing checking it: the document, the question, one reply. This is what the
// lattice is measured against. It is read generously, so that it loses nothing to the way it writes:
//
//   a problem with an answer   any reply whose LAST number is the right one counts as right, whatever else the reply
//                              says, and however the number is written round ("= 2,340.00.", "£2340", "2340 pounds");
//   a yes-or-no problem        (decided: "is it certain that…") the FIRST of yes, no, it depends, or cannot tell
//                              (which says the same as it depends) is its verdict, and counts as right when it is
//                              the question's own;
//   a problem with none        (the figure is not in the document, or is stated two ways) any reply that says it
//                              cannot tell, or that holds no number at all, counts as right.
//
// The number is read here by a looser rule than the citation check's (cite.mjs), on purpose: that rule refuses what
// it is not sure of, and this reading must not refuse an answer the model gave. Pure and total.
import { num, same } from '../vendor/crystal/vendor/climb/src/exact.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
// room to finish: at 48 tokens about a quarter of its replies were cut off mid-working (an early try, not kept); at
// 192, 4 of the 60 dev replies ran to the limit (data/baseline.json, made before the seal). The system line below,
// with "cannot tell", got 16 of 60 right against 15 of 60 for the same line without it, so it is the one kept: the
// lattice is set against the stronger of the two, though the two are close.
export const SETTINGS = { maxTokens: 192 };
export const SYSTEM = 'You answer a question about a document, or work out a calculation. Give the answer as a number. If the question asks whether something is certain, answer yes, no, or it depends. If the document does not state what is needed, reply: cannot tell';
// asking(task) → the conversation: the system line, then the document (when there is one) and the question
export function asking(task) {
  const doc = str(get(get(task, 'doc'), 'text')), q = str(get(task, 'statement'));
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: doc === '' ? q : `${doc}\n\n${q}` }];
}
// last(reply) → the last number written in the reply, as text (digits, commas, one decimal part), or null
export function last(reply) {
  const all = (str(reply).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((t) => t.replace(/,+$/, '')).filter((t) => num(t) !== null);
  return all.length === 0 ? null : all[all.length - 1];
}
// verdict(reply) → the first verdict the reply gives: 'yes', 'no', 'it depends' (or "cannot tell", "can't tell",
// which say the same), or null when it gives none
export function verdict(reply) {
  const m = /\b(yes|no|it depends|cannot tell|can't tell|can not tell)\b/i.exec(str(reply));
  return m === null ? null : /tell|depends/i.test(m[1]) ? 'it depends' : m[1].toLowerCase();
}
// rule(reply, task) → { right, answered, value }
//   value     the last number in the reply as text, or for a yes-or-no problem the verdict, or null
//   answered  the reply gave an answer (a number, or a verdict), and did not say it cannot tell
//   right     for a problem with an answer: that answer is exactly what the problem's document (or question) gives.
//             for a problem that must not be answered: it did not answer.
export function rule(reply, task) {
  const want = get(get(task, 'check'), 'value'), mustRefuse = (get(task, 'expect') || null) !== null;
  if (get(task, 'decide') !== undefined && get(task, 'decide') !== null) { const v = verdict(reply); return { right: v !== null && v === want, answered: v !== null, value: v }; }
  const value = last(reply), answered = value !== null && !/cannot tell/i.test(str(reply));
  return { right: mustRefuse ? !answered : same(num(value), num(want)), answered, value };
}
// run(tasks, call, opts) → { records: [{ id, tier, said, right, answered, value, ms, prompt, reply }] }, one call a
// problem. opts.done holds records already made, which are ruled on again from their own replies.
export async function run(tasks, call, opts) {
  const prior = new Map((Array.isArray(get(opts, 'done')) ? opts.done : []).map((r) => [get(r, 'id'), r])), records = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const was = prior.get(get(task, 'id')), r = was ? { text: was.said, ms: was.ms, prompt: was.prompt, reply: was.reply } : await call(asking(task), SETTINGS.maxTokens), said = typeof get(r, 'text') === 'string' ? r.text : '';
    const rec = { id: get(task, 'id'), tier: get(task, 'tier'), said, ...rule(said, task), ms: Number(get(r, 'ms')) || 0, prompt: get(r, 'prompt') ?? null, reply: get(r, 'reply') ?? null };
    records.push(rec);
    if (!was && typeof get(opts, 'onDone') === 'function') await opts.onDone(rec);
  }
  return { records };
}
// replay(tasks, records) → the same records ruled on again from their recorded replies, with no model
export const replay = (tasks, records) => run(tasks, async () => ({ text: '' }), { done: (Array.isArray(tasks) ? tasks : []).map((t) => (Array.isArray(records) ? records : []).find((r) => get(r, 'id') === get(t, 'id')) || { id: get(t, 'id'), said: '' }) });

export default { SETTINGS, SYSTEM, asking, last, verdict, rule, run, replay };
