// grow.mjs — the growth law of the crystal. One local rule, applied to every cell.
//
// A calculation is grown one CELL at a time. A cell is one operation on two numbers that the calculation needs next
// (26 × 12). Every cell meets the same law, and the law is the whole engine:
//
//   SET       the cell is already held, checked: it joins without the model being asked. Nothing set is grown twice.
//   BOND      the model is asked the cell and its whole reply is one plain statement of the cell's value, exactly
//             right (bond.mjs rules on that, and nothing else can): the cell bonds, with the model's value.
//   SPLIT     the model is wrong and the cell can be made smaller (The Climb's planner): smaller cells take its place.
//   DISSOLVE  the model is wrong and there is nothing smaller: the cell washes away. Whatever needed it stays dark.
//
// A TICK asks every cell that is ready at the same moment. Cells of one tick share no number, so they do not depend
// on each other and could be asked side by side; on one small GPU they are fed one after another, and the record says
// how many were ready at once. The ticks are the fourth axis: depth.
//
// Two things follow from the law alone, and the tests hold them to it:
//   SOUND      a crystal is complete only when every step from the problem down to single cells has bonded, and a bond
//              is exact arithmetic on a value the model wrote. So a complete crystal's answer is right. There is no
//              way to finish with a wrong one, and a right answer with no bonds under it is not a crystal.
//   IT ENDS    a cell is asked at most once in a problem. Asked and wrong, it is split once into strictly smaller
//              cells or it dissolves; met again, it dissolves unasked. So growth always stops.
//
// The context the model sees is the crystal too: only bonded cells stay in the conversation. A wrong reply is dropped
// from it, so a later cell never reads a false step, and a conversation that only grows lets the GPU keep its work.
// The Climb's sealed kernels do the arithmetic, the reading and the splitting (vendor/climb). Pure apart from the
// memory it is handed; deterministic; nothing here throws on a reply, whatever the reply is.
import { evaluate, show, num, same } from '../vendor/climb/src/exact.mjs';
import { home } from '../vendor/climb/src/checker.mjs';
import { judge } from './bond.mjs';
import LEFT from '../vendor/climb/src/left.mjs';
import KEEP from '../vendor/climb/src/keep.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
export const SETTINGS = { maxTicks: 256, maxTokens: 24 };
// a step the model got wrong is split the same way when it is met again, this many times at most; then it dissolves
export const AGAIN = 8;
export const SYSTEM = 'You work out one small calculation. Reply with the calculation and its value on one line, as: working = number. Nothing else.';
// the worked examples: invented, each true, from no problem set
export const SHOTS = [['26 × 12', '26 × 12 = 312'], ['450 + 37', '450 + 37 = 487'], ['7 × 8', '7 × 8 = 56'], ['300 × 40', '300 × 40 = 12000'], ['96 ÷ 2', '96 ÷ 2 = 48']];

// klass(text) → the kind of step a cell is, by the size of its two numbers. Used to say where the crystal bonded and
// where it washed away; it changes nothing in the law.
export function klass(text) {
  const e = evaluate(typeof text === 'string' ? text : '');
  if (e === null || e.ops !== 1) return 'other';
  const [a, b] = e.tree.args.map((x) => x.value), whole = (v) => v.d === 1n && v.n >= 0n;
  const digits = (v) => String(v.n).replace(/0+$/, '').length, len = (v) => String(v.n).length;
  if (e.tree.op === '*') {
    if ([a, b].some((v) => v.n === 1n && v.d === 2n)) return 'half';
    if (!whole(a) || !whole(b)) return 'other';
    const most = Math.max(digits(a), digits(b)), least = Math.min(digits(a), digits(b));
    if (most <= 1) return len(a) === 1 && len(b) === 1 ? 'digit × digit' : 'digit × digit, with noughts';
    if (least <= 1) return most === 2 ? 'two digits × one' : 'three or more digits × one';
    return 'long product';
  }
  if (!whole(a) || !whole(b)) return 'other';
  if (e.tree.op === '+') {
    if (len(a) === 1 && len(b) === 1) return 'digit + digit';
    const A = String(a.n).padStart(len(b), '0'), B = String(b.n).padStart(len(a), '0');
    return [...A].some((d, i) => d !== '0' && B[i] !== '0') ? 'sum, places overlap' : 'sum, places apart';
  }
  return e.tree.op === '-' ? 'difference' : e.tree.op === '/' ? 'division' : 'other';
}

// finer(text) → smaller working for a cell that The Climb's planner has nothing smaller for: taking away, and
// numbers below nothing. The planner takes a number away one place at a time and stops there; this takes one place
// away digit against digit, borrowing ten where the digit above is the smaller (1240 - 70 is 1100 + (14 - 7) × 10),
// turns a taking-away that goes below nothing round (231 - 551 is -(551 - 231)), and takes the sign out of a product
// (7 × -55 is -(7 × 55)). null when there is nothing smaller. What it returns is working,
// never a result, and the law only uses it after checking that it comes to exactly what the cell comes to.
export function finer(text) {
  const e = evaluate(typeof text === 'string' ? text : '');
  if (e === null || e.ops !== 1) return null;
  const [a, b] = e.tree.args.map((x) => x.value), bare = (v) => show(v).replace('-', '');
  // a product with a number below nothing in it: the sign is taken outside
  if (e.tree.op === '*' && (a.n < 0n || b.n < 0n)) { const plain = `${bare(a)} × ${bare(b)}`; return (a.n < 0n) === (b.n < 0n) ? plain : `-(${plain})`; }
  if (e.tree.op !== '-') return null;
  if (a.d !== 1n || b.d !== 1n || a.n <= 0n || b.n <= 0n) return null;
  if (a.n < b.n) return `-(${b.n} - ${a.n})`;
  const s = String(b.n);
  if (/[1-9]/.test(s.slice(1))) return null;                  // more than one place: the planner's own split comes first
  const unit = 10n ** BigInt(s.length - 1), db = b.n / unit, da = (a.n / unit) % 10n;
  const top = da >= db ? da : 10n + da, rest = a.n - top * unit;
  if (rest === 0n && unit === 1n) return null;                 // a fact: a digit, or a teen, less a digit
  const digits = `(${top} - ${db})${unit === 1n ? '' : ` × ${unit}`}`;
  return rest === 0n ? digits : `${rest} + ${digits}`;
}

// frontier(x, dead) → the cells of one tick: single steps of the calculation as it stands that share no number with
// each other, leaving out any that have dissolved. Inside each product and each sum the plain numbers are paired off,
// each number in at most one pair; a division or a power of two plain numbers is a cell by itself. A step that
// stands in more than one place is one cell. Only steps The Climb's own reading lists as ready are returned.
export function frontier(x, dead) {
  const gone = dead instanceof Set ? dead : new Set(), ready = new Map(LEFT.atoms(x).map((c) => [c.canon, c])), out = new Map();
  if (ready.size === 0) return [];
  const cellOf = (text) => { const e = evaluate(text), cell = e === null ? undefined : ready.get(e.canon); return cell === undefined || gone.has(cell.canon) ? null : cell; };
  const pair = (nums, text) => {
    const used = new Set();
    nums.forEach((p, i) => {
      if (used.has(i)) return;
      const j = nums.findIndex((q, k) => k > i && !used.has(k) && cellOf(text(p, q)) !== null);
      if (j === -1) return;
      const cell = cellOf(text(p, nums[j]));
      used.add(i); used.add(j); out.set(cell.canon, cell);
    });
  };
  const walk = (n) => {
    if (n.op === 'n') return;
    if (n.op === '*') { pair(n.items.filter((i) => i.op === 'n'), (p, q) => `${show(p.value)} × ${show(q.value)}`); n.items.forEach(walk); return; }
    if (n.op === '+') {
      pair(n.terms.filter((t) => t.node.op === 'n'), (p, q) => { const u = show(p.node.value), v = show(q.node.value); return p.neg === q.neg ? `${u} + ${v}` : p.neg ? `${v} - ${u}` : `${u} - ${v}`; });
      n.terms.forEach((t) => walk(t.node));
      return;
    }
    const cell = n.args.every((k) => k.op === 'n') ? cellOf(`${show(n.args[0].value)} ${n.op === '/' ? '÷' : '^'} ${show(n.args[1].value)}`) : null;
    if (cell !== null) out.set(cell.canon, cell);
    n.args.forEach(walk);
  };
  walk(x);
  return [...out.values()];
}

// asking(bonded, cell) → the conversation for one cell: the system line, the examples, every cell that has bonded in
// this problem with the reply that bonded it, then the cell
export function asking(bonded, cell) {
  const turns = [...SHOTS, ...(Array.isArray(bonded) ? bonded : [])].flatMap(([u, a]) => [{ role: 'user', content: u }, { role: 'assistant', content: a }]);
  return [{ role: 'system', content: SYSTEM }, ...turns, { role: 'user', content: cell.text }];
}

// smaller(x, cell) → the calculation with the cell replaced, wherever it stands, by smaller working, and the line
// that says so: { left, into }. The Climb's planner is asked first, then finer(). null when there is nothing
// smaller. Working that holds the cell itself (4 × 100 as 4 × 1 × 100) is not smaller, and is refused.
export function smaller(x, cell) {
  const w = LEFT.wrong(x, get(cell, 'text')), way = w !== null && w.split !== null ? w.split.split(' = ')[1] : finer(get(cell, 'text'));
  const inside = typeof way === 'string' ? LEFT.start(way) : null;
  if (inside === null || LEFT.atoms(inside).some((a) => a.canon === cell.canon)) return null;
  // for as long as the cell still stands somewhere as a step to do, and never more often than it could stand
  let at = x, did = false;
  for (let guard = 0; guard < 64 && LEFT.atoms(at).some((a) => a.canon === cell.canon); guard++) { const r = LEFT.rewrite(at, cell.text, way); if (r === null) break; at = r.left; did = true; }
  return did ? { left: at, into: `${cell.text} = ${way}` } : null;
}

const cap = (opts, k) => { const v = get(opts, k); return Number.isInteger(v) && v > 0 ? v : SETTINGS[k]; };
// grow(task, call, opts) → the record of one crystal. opts.memory is a memory shared with other crystals (or none);
// opts.onEvent(event, record) is told of each event as it happens.
export async function grow(task, call, opts) {
  const M = get(opts, 'memory') || null, mem = get(opts, 'mem'), maxTicks = cap(opts, 'maxTicks'), maxTokens = cap(opts, 'maxTokens'), tell = get(opts, 'onEvent');
  const rec = { id: get(task, 'id'), tier: get(task, 'tier'), family: get(task, 'family'), sheet: get(task, 'sheet'), ask: get(task, 'ask') ?? null, events: [], ticks: 0, calls: 0, complete: false, answer: null, home: false, left: null, capped: false };
  let x = LEFT.start(rec.ask);
  if (x === null) return rec;                                  // a problem with no calculation to hold has nothing to grow
  const set = new Map(), asked = new Set(), again = new Map(), dead = new Set(), bonded = [];
  let carried = false;
  const note = async (e) => { rec.events.push({ ...e, left: LEFT.left(x) }); if (typeof tell === 'function') await tell(rec.events[rec.events.length - 1], rec); };
  for (let tick = 1; tick <= maxTicks; tick++) {
    const cells = frontier(x, dead);
    if (cells.length === 0) break;
    rec.ticks = tick;
    for (const cell of cells) {
      // a cell earlier in this tick was split, and this one stood on a number that is no longer there: it waits
      if (!LEFT.atoms(x).some((a) => a.canon === cell.canon)) continue;
      const base = { tick, cell: cell.text, canon: cell.canon, klass: klass(cell.text), value: null, into: null, said: null, why: null, carried: null, ms: 0, prompt: null, reply: null };
      // SET: held already, by this crystal or by the memory
      const fact = set.has(cell.canon) ? set.get(cell.canon) : M ? KEEP.lookup(M, cell.canon, cell.text, mem) : null;
      const held = fact === null ? null : LEFT.cross(x, cell.text, num(fact.split(' = ')[1]));
      if (held !== null) { x = held.left; set.set(cell.canon, fact); await note({ ...base, kind: 'set', value: fact.split(' = ')[1] }); continue; }
      // met before and not bonded: asked again it would say the same thing, so it is not asked. If it was split
      // then, it is split the same way now (a few times at most); if it dissolved then, it dissolves now.
      if (asked.has(cell.canon)) {
        const s = (again.get(cell.canon) || 0) < AGAIN ? smaller(x, cell) : null;
        again.set(cell.canon, (again.get(cell.canon) || 0) + 1);
        if (s !== null) { x = s.left; await note({ ...base, kind: 'split', into: s.into }); } else { dead.add(cell.canon); await note({ ...base, kind: 'dissolve' }); }
        continue;
      }
      asked.add(cell.canon);
      const c = await call(asking(bonded, cell), maxTokens), said = typeof get(c, 'text') === 'string' ? c.text : '';
      rec.calls++;
      // the bond-check rules on the reply (bond.mjs); carried says the conversation was the last one, one turn longer
      const { value, why } = judge(said, cell), got = value === null ? null : LEFT.cross(x, cell.text, value);
      const told = { ...base, said, why, carried, ms: Number(get(c, 'ms')) || 0, prompt: get(c, 'prompt') ?? null, reply: get(c, 'reply') ?? null };
      carried = got !== null;
      if (got !== null) {
        // BOND
        const line = `${cell.text} = ${show(value)}`;
        x = got.left; set.set(cell.canon, line); bonded.push([cell.text, said]);
        if (M) KEEP.fold(M, { canon: cell.canon, fact: line }, rec.id);
        await note({ ...told, kind: 'bond', value: show(value) });
        continue;
      }
      // SPLIT, or DISSOLVE when there is nothing smaller
      const s = smaller(x, cell);
      if (s !== null) { x = s.left; await note({ ...told, kind: 'split', into: s.into }); } else { dead.add(cell.canon); await note({ ...told, kind: 'dissolve' }); }
    }
    if (tick === maxTicks && frontier(x, dead).length > 0) rec.capped = true;
  }
  rec.complete = LEFT.ops(x) === 0;
  rec.left = LEFT.left(x);
  rec.answer = rec.complete ? rec.left : null;
  rec.home = rec.complete && home(task, { value: x.value, numbers: [] });
  return rec;
}

// a call that hands back a record's own replies in order, in place of a model
const recorded = (rec) => {
  const said = (Array.isArray(get(rec, 'events')) ? rec.events : []).filter((e) => e !== null && typeof e === 'object' && typeof e.said === 'string');
  let at = 0;
  return async () => { const e = said[at++] || {}; return { text: typeof e.said === 'string' ? e.said : '', ms: Number(e.ms) || 0, prompt: e.prompt ?? null, reply: e.reply ?? null }; };
};
// seeded(facts) → a memory holding the seed crystal: facts checked before this run began (The Climb's sealed run)
export function seeded(facts) {
  const M = KEEP.create();
  for (const f of Array.isArray(facts) ? facts : []) {
    const text = typeof f === 'string' ? f : '', e = evaluate(text.split(' = ')[0] || ''), v = num(text.split(' = ')[1] || '');
    // a seed is taken only when it is true: the seed crystal is checked again as it is laid
    if (e !== null && e.ops > 0 && v !== null && same(e.value, v)) KEEP.fold(M, { canon: e.canon, fact: `${e.shown} = ${show(v)}` }, 'seed');
  }
  return M;
}
// run(tasks, call, opts) → every problem's crystal, grown in order on one memory that starts as the seed crystal
// (opts.seed). opts.done holds records already made: those are grown again from their own replies, which rebuilds the
// memory, and the model is asked only for the rest. onDone(record, memory) is called after each problem the model worked.
export async function run(tasks, call, opts) {
  const M = seeded(get(opts, 'seed')), seeds = KEEP.stats(M).facts, records = [];
  const prior = new Map((Array.isArray(get(opts, 'done')) ? opts.done : []).map((r) => [get(r, 'id'), r]));
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const was = prior.get(get(task, 'id'));
    const rec = await grow(task, was ? recorded(was) : call, { ...(opts || {}), memory: M, onEvent: was ? undefined : get(opts, 'onEvent') });
    records.push(rec);
    if (!was && typeof get(opts, 'onDone') === 'function') await opts.onDone(rec, M);
  }
  return { records, seeds, memory: KEEP.stats(M) };
}
// replay(tasks, records, opts) → the same crystals grown again from the recorded replies, with no model
export async function replay(tasks, records, opts) {
  const byId = new Map((Array.isArray(records) ? records : []).map((r) => [get(r, 'id'), r]));
  const all = (Array.isArray(tasks) ? tasks : []).map((t) => byId.get(get(t, 'id')) || { id: get(t, 'id'), events: [] });
  return run(tasks, recorded(null), { ...(opts || {}), done: all, onEvent: undefined, onDone: undefined });
}

export default { SETTINGS, AGAIN, SYSTEM, SHOTS, klass, finer, smaller, frontier, asking, grow, seeded, run, replay };
