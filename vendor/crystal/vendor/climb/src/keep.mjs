// keep.mjs — what is kept. A step the checker found true ("19 × 19 = 361") is written here once, and a later problem
// that has the same step to do is handed it. Two layers:
//   the map    the estate's own 12-chamber memory kernel (vendor/memory.mjs). A fact is placed by its digits and
//              words, so facts about the same numbers land in the same or a neighbouring chamber, and finding one
//              means looking in a chamber and the five beside it, never scanning everything.
//   the floor  an exact list by key, used for two things only: not storing a fact twice, and MEASURING the map
//              (what was there to be found, against what the map handed back). The loop is served by the map.
// Only checked facts ever enter. Nothing a model said goes in without the checker's ruling. Pure apart from the
// memory object it is handed; deterministic.
import { FallRemember } from '../vendor/memory.mjs';

const str = (x) => (typeof x === 'string' ? x : '');
export const DEFAULTS = { k: 8, probes: 1 };
// the kernel places text by its letters and digits, and signs are neither: spell them so the working can be placed
export const spell = (text) => str(text).replace(/×/g, ' times ').replace(/÷/g, ' over ').replace(/\+/g, ' plus ').replace(/\^/g, ' to the ').replace(/=/g, ' equals ').replace(/(\d)\s+-\s+/g, '$1 minus ').replace(/\s+/g, ' ').trim();

export function create() { return { kernel: new FallRemember(), floor: new Map(), asked: [] }; }

// fold(M, kept, from) → true when a kept line with a fact is new and was written in. kept: { canon, fact }
export function fold(M, kept, from) {
  const canon = str(kept && kept.canon), fact = str(kept && kept.fact);
  if (canon === '' || fact === '' || M.floor.has(canon)) return false;
  const rec = { canon, fact, from: str(from) };
  if (M.kernel.store({ id: canon, text: spell(fact), meta: rec }) === null) return false;
  M.floor.set(canon, rec);
  return true;
}

// near(M, text, opts) → what the map hands back for a text: the facts nearest it, from one chamber and its five
// neighbours (probes 1; 12 probes looks in every chamber), most alike first
export function near(M, text, opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  if (M.kernel.size === 0 || spell(text) === '') return [];
  const got = M.kernel.retrieve(spell(text), { k: o.k - 1, exact: false, probes: o.probes });
  return [got.center, ...got.corners].filter(Boolean).map((r) => r.meta);
}

// lookup(M, canon, text, opts) → the stored fact for one step a problem has to do, if the map finds it, or null.
// Every ask is logged with whether the fact was there to be found (the floor knows) and whether the map found it.
export function lookup(M, canon, text, opts) {
  const there = M.floor.has(canon), hit = near(M, text, opts).find((r) => r.canon === canon) || null;
  M.asked.push({ wanted: there ? 1 : 0, found: hit ? 1 : 0 });
  return hit === null ? null : hit.fact;
}

// stats(M) → what the memory holds and how well the map found what was there to be found
export function stats(M) {
  const wanted = M.asked.reduce((a, x) => a + x.wanted, 0), found = M.asked.reduce((a, x) => a + x.found, 0);
  return { facts: M.floor.size, chambers: M.kernel.distribution(), asks: M.asked.length, wanted, found, recall: wanted === 0 ? null : found / wanted };
}

export default { DEFAULTS, spell, create, fold, near, lookup, stats };
