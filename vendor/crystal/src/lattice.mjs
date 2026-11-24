// lattice.mjs — where every cell of the crystal stands. Four axes, three of space and one of depth.
//
//   SPACE  the crystal is a real lattice: the places a cell can stand are the points of the face-centred cubic
//          lattice (whole-number points whose three numbers add up to an even number), the lattice of diamond's
//          own carbon frame. A cell drawn as an octahedron on such a point meets its neighbours edge to edge.
//          Which place a cell takes is decided by the memory's geometry: the estate's memory kernel puts a checked
//          step in one of twelve chambers by its digits and words, the twelve chambers are the twelve faces of a
//          dodecahedron, and a cell takes a free place on its own chamber's side. Steps about the same numbers
//          stand together.
//   DEPTH  the fourth axis is the tick at which the cell set: how many rounds of growth it took to reach it. The
//          seed crystal is depth 0, at the centre. A cell never stands nearer the centre than its depth allows, so
//          the crystal grows outwards as it grows deeper. Depth is a count of rounds, drawn as distance; it is not a
//          fourth direction of space.
//
// What is drawn is exactly what happened: a cell for every bond, a shattered cell for every dissolve, a dark cell for
// every step that was never reached, a crown for every crystal that completed, and nothing else. Nothing here decides
// anything: it reads a finished record. Pure and total.
import { evaluate } from '../vendor/climb/src/exact.mjs';
import { embed, chamber } from '../vendor/climb/vendor/memory.mjs';
import { spell } from '../vendor/climb/src/keep.mjs';
import LEFT from '../vendor/climb/src/left.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const list = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (typeof x === 'string' ? x : '');
// the numbers written in a text, without their signs
const numbers = (text) => str(text).match(/[0-9]+(?:[.][0-9]+)?/g) || [];
const RING = 1 / Math.sqrt(5), WIDE = 2 / Math.sqrt(5), TURN = (2 * Math.PI) / 5;
// DIRS → the twelve directions: the face centres of a dodecahedron, numbered as the memory numbers its chambers
// (0 at the top with 1 to 5 around it, 11 at the bottom with 6 to 10 around it), so neighbouring chambers are
// neighbouring directions
export const DIRS = Array.from({ length: 12 }, (_, c) => {
  if (c === 0) return [0, 0, 1];
  if (c === 11) return [0, 0, -1];
  const angle = c <= 5 ? (c - 1) * TURN : (c - 7) * TURN + TURN / 2;
  return [WIDE * Math.cos(angle), WIDE * Math.sin(angle), c <= 5 ? RING : -RING];
});
// chamberOf(text) → the chamber 0..11 the memory puts a step in
export const chamberOf = (text) => chamber(embed(spell(str(text))));

// SITES → every place of the crystal out to shell 12, nearest the centre first: { p: [x, y, z], shell, dir }. The
// shell of a place is half the sum of the sizes of its three numbers, so each shell is the skin of an octahedron:
// the crystal's own shape is a diamond's.
export const REACH = 12;
export const SITES = (() => {
  const out = [];
  for (let x = -2 * REACH; x <= 2 * REACH; x++) for (let y = -2 * REACH; y <= 2 * REACH; y++) for (let z = -2 * REACH; z <= 2 * REACH; z++) {
    const sum = Math.abs(x) + Math.abs(y) + Math.abs(z);
    if ((x + y + z) % 2 !== 0 || sum > 2 * REACH) continue;
    const n = Math.hypot(x, y, z) || 1;
    out.push({ p: [x, y, z], shell: sum / 2, dir: [x / n, y / n, z / n] });
  }
  // nearest the centre first; within a shell, in a fixed order
  return out.sort((a, b) => a.shell - b.shell || a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.p[2] - b.p[2]);
})();
const FIRST = (() => { const at = []; SITES.forEach((s, i) => { if (at[s.shell] === undefined) at[s.shell] = i; }); return at; })();
// floorOf(depth) → the innermost shell a cell of that depth may stand in. It rises quickly at first and slowly
// later, so a crystal a hundred rounds deep still fits: depth 0 is the centre, 1 is shell 1, 8 is shell 3, 99 is 8.
export const floorOf = (depth) => { const d = Math.max(0, Number(depth) || 0); return Math.min(REACH - 2, Math.floor(d === 0 ? 0 : 1 + 2.1 * Math.log(1 + (d - 1) / 2.4))); };
// seat(taken, c, depth) → the number of the free place a cell takes: at or outside its depth's floor, as near that
// floor and as near its chamber's direction as it can be. taken is the set of places in use, and the place is added.
export function seat(taken, c, depth) {
  const d = DIRS[((Number(c) % 12) + 12) % 12], floor = floorOf(depth);
  let best = -1, bestScore = Infinity;
  for (let i = FIRST[floor]; i < SITES.length; i++) {
    const s = SITES[i];
    // a place this far out scores at least its distance from the floor, so once that alone is no better than the
    // best found, nothing further out can be better either (places come nearest first)
    if (s.shell - floor >= bestScore) break;
    if (taken.has(i)) continue;
    const score = (s.shell - floor) + 2.6 * (1 - (s.shell === 0 ? 1 : s.dir[0] * d[0] + s.dir[1] * d[1] + s.dir[2] * d[2]));
    if (score < bestScore) { best = i; bestScore = score; }
  }
  if (best >= 0) taken.add(best);
  return best;
}

// lattice(seed, records) → { cells, links, pulses, span, depth, counts }
//   cells   every cell, in the order it set: { kind, text, value, canon, klass, chamber, depth, at, problem, site, pos }
//           site is the number of its place in SITES and pos that place's point; a cell the crystal has no place
//           left for has site -1 and is not drawn (the count says how many)
//           kind is 'seed' (held before the run), 'bond' (the model got it right), 'home' (a crystal completed: its
//           answer), 'dissolve' (wrong, nothing smaller: it washed away) or 'dark' (never reached)
//   links   which cell stands on which: { from, to, at }, cell numbers, from the support to what was built on it
//   pulses  a cell that was already set being used again, with no model call: { cell, at }
//   span    how many moments there are (every event is one), for the scrub; depth is the deepest shell
export function lattice(seed, records) {
  const cells = [], links = [], pulses = [], taken = new Set(), held = new Map();
  const counts = { seed: 0, bond: 0, set: 0, split: 0, dissolve: 0, dark: 0, home: 0, problems: 0, complete: 0, calls: 0, unplaced: 0 };
  const add = (cell) => {
    const site = seat(taken, cell.chamber, cell.depth);
    if (site < 0) counts.unplaced++;
    cells.push({ ...cell, site, pos: site === -1 ? [0, 0, 0] : SITES[site].p });
    return cells.length - 1;
  };
  for (const fact of list(seed)) {
    const work = str(fact).split(' = ')[0], e = evaluate(work);
    if (e === null || e.ops === 0 || held.has(e.canon)) continue;
    held.set(e.canon, add({ kind: 'seed', text: str(fact), value: str(fact).split(' = ')[1] ?? null, canon: e.canon, klass: null, chamber: chamberOf(fact), depth: 0, at: 0, problem: -1 }));
    counts.seed++;
  }
  let at = 0, deepest = 0;
  for (const [p, rec] of list(records).entries()) {
    const events = list(get(rec, 'events')).filter((e) => e !== null && typeof e === 'object'), mine = new Map();
    if (events.length === 0 && typeof get(rec, 'ask') !== 'string') continue;   // a problem with no calculation grew nothing
    counts.problems++; counts.calls += Number(get(rec, 'calls')) || 0;
    // a cell stands on the cells that made its two numbers, when this problem made them
    const support = (text, to) => { for (const n of new Set(numbers(text))) if (mine.has(n) && mine.get(n) !== to) links.push({ from: mine.get(n), to, at }); };
    const made = (value, i) => { for (const n of numbers(value)) mine.set(n, i); };
    let last = null, tick = 0;
    for (const e of events) {
      at++; tick = Number(e.tick) || tick;
      if (e.kind === 'bond' || e.kind === 'dissolve') {
        const line = e.kind === 'bond' ? `${e.cell} = ${e.value}` : str(e.cell);
        const i = add({ kind: e.kind, text: line, value: e.kind === 'bond' ? str(e.value) : null, canon: str(e.canon), klass: e.klass ?? null, chamber: chamberOf(line), depth: tick, at, problem: p });
        support(e.cell, i);
        if (e.kind === 'bond') { held.set(str(e.canon), i); made(e.value, i); last = i; counts.bond++; } else counts.dissolve++;
      } else if (e.kind === 'set') {
        counts.set++;
        const i = held.get(str(e.canon));
        if (i !== undefined) { pulses.push({ cell: i, at }); made(e.value, i); last = i; }
      } else if (e.kind === 'split') counts.split++;
      deepest = Math.max(deepest, tick);
    }
    if (get(rec, 'complete') === true) {
      counts.complete++; counts.home++; at++;
      const line = `${str(get(rec, 'ask'))} = ${str(get(rec, 'answer'))}`;
      const i = add({ kind: 'home', text: line, value: str(get(rec, 'answer')), canon: null, klass: null, chamber: last === null ? chamberOf(line) : cells[last].chamber, depth: tick + 1, at, problem: p });
      if (last !== null) links.push({ from: last, to: i, at });
      deepest = Math.max(deepest, tick + 1);
    } else {
      // what was never reached: every step still standing undone in what is left
      const x = LEFT.start(str(get(rec, 'left')));
      for (const a of x === null ? [] : LEFT.atoms(x)) { at++; add({ kind: 'dark', text: a.text, value: null, canon: a.canon, klass: null, chamber: chamberOf(a.text), depth: tick + 1, at, problem: p }); counts.dark++; deepest = Math.max(deepest, tick + 1); }
    }
  }
  return { cells, links, pulses, span: at, depth: deepest, counts };
}

export default { DIRS, REACH, SITES, chamberOf, floorOf, seat, lattice };
