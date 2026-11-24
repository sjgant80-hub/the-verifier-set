// claims.mjs — the verdict on every registered claim, worked out from the recorded sealed run. Pure and total.
// The bars are CLAIMS.md's, word for word in BARS; test/claims.test.mjs checks the file still says each one. A claim
// whose evidence is missing is pending (pass: null), never passed or failed by default. Every bar is tested on
// whole-number counts, so a result that is exactly on a bar is decided exactly.
import { measure, against } from './measure.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
export const NAMES = {
  K1: 'A complete crystal is right', K2: 'Growth always stops', K3: 'The bond-check holds', K4: 'The crystal reaches further than one try',
  K5: 'It reaches where the climb could not', K6: 'Nothing set is grown twice', K7: 'The harness can find a leak',
};
export const BARS = {
  K1: 'no crystal completes with a wrong answer: none, of every sealed problem',
  K2: 'no crystal runs into the limit on rounds, and every crystal that does not complete has a cell that dissolved',
  K3: 'no forged reply bonds, of every forgery made for every cell the sealed run asked the model; no honest reply is refused; the bond-check and the second reader never rule differently on a reply; and nothing throws',
  K4: 'the crystal completes more of the sealed problems than one try gets right, by an exact two-sided McNemar test, p < 0.05',
  K5: 'on the sealed wall-tier problems that carry a calculation, the crystal completes at least one that The Climb did not bring home, and The Climb brings home none that the crystal did not complete',
  K6: 'no cell is asked of the model twice in one problem, and at least 1 cell in 10 of those that set was set from what was already held, with no model call',
  K7: 'the harness that attacks the bond-check finds the leak in every reader that has one planted in it',
};
const pending = (id, why) => ({ id, pass: null, result: `pending: ${why}` });
const rows = (x) => (Array.isArray(x) ? x : null);

// evaluate(F) → [{ id, pass, result }]. F holds: crystals (the sealed run's records), climb (The Climb's own loop on
// the same problems, with no memory: its first pass is one try), fuzz (fuzz.mjs's count over the cells the run
// asked) and teeth (the same harness turned on the planted readers).
export function evaluate(F) {
  const crystals = rows(get(F, 'crystals')), climb = rows(get(F, 'climb')), fuzz = get(F, 'fuzz') || null, teeth = get(F, 'teeth') || null;
  const forged = get(fuzz, 'forged') || {}, honest = get(fuzz, 'honest') || {};
  const m = crystals === null ? null : measure(crystals), out = [];
  if (m === null || m.grown === 0) out.push(pending('K1', 'needs the crystal on the sealed problems'), pending('K2', 'needs the crystal on the sealed problems'));
  else {
    const incomplete = crystals.filter((r) => typeof get(r, 'ask') === 'string' && get(r, 'complete') !== true), stuck = incomplete.filter((r) => !(Array.isArray(r.events) && r.events.some((e) => get(e, 'kind') === 'dissolve'))).length;
    out.push({ id: 'K1', pass: m.wrong === 0, result: `${m.complete} crystals completed, ${m.wrong} of them with a wrong answer` });
    out.push({ id: 'K2', pass: m.capped === 0 && stuck === 0, result: `${m.capped} of ${m.grown} crystals ran into the limit on rounds; ${incomplete.length} did not complete, ${stuck} of them with no dissolved cell; the deepest took ${m.depth.deepest} rounds` });
  }
  out.push(!Number.isInteger(get(fuzz, 'tried')) || fuzz.tried === 0 ? pending('K3', 'needs the attack on the cells of the sealed run') : { id: 'K3', pass: forged.bonded === 0 && honest.refused === 0 && fuzz.split === 0 && fuzz.threw === 0, result: `${forged.bonded} of ${forged.tried} forged replies bonded (${forged.unsound} that would have been false, ${forged.outside} outside the three forms); ${honest.refused} of ${honest.tried} honest replies were refused; the two readers ruled differently on ${fuzz.split} of ${fuzz.tried} replies; ${fuzz.threw} threw. ${fuzz.cells} cells, seed ${fuzz.seed}` });
  {
    // a run that is missing has no problem in both, so nothing is compared and the claim is pending
    const one = against(crystals, climb, (r) => Array.isArray(get(r, 'passes')) && get(r.passes[0], 'home') === true);
    out.push(one.compared === 0 ? pending('K4', 'needs the crystal and one try on the same sealed problems') : { id: 'K4', pass: one.only > one.other && one.p < 0.05, result: `one try ${pct(one.both + one.other, one.compared)}, the crystal ${pct(one.both + one.only, one.compared)} of ${one.compared} problems; ${one.only} only the crystal finished, ${one.other} only the one try, p = ${one.p.toPrecision(3)}` });
    const wall = against(crystals, climb, (r) => Number.isInteger(get(r, 'homeAt')), 'wall');
    out.push(wall.compared === 0 ? pending('K5', 'needs the crystal and The Climb on the sealed wall problems') : { id: 'K5', pass: wall.only >= 1 && wall.other === 0, result: `of ${wall.compared} wall problems that carry a calculation: the crystal completed ${wall.both + wall.only}, The Climb brought home ${wall.both + wall.other}; ${wall.only} only the crystal, ${wall.other} only The Climb` });
  }
  out.push(m === null || m.events.set + m.events.bond === 0 ? pending('K6', 'needs the crystal on the sealed problems') : { id: 'K6', pass: m.repeats === 0 && m.events.set * 10 >= m.events.set + m.events.bond, result: `${m.repeats} cells were asked twice; ${m.events.set} of the ${m.events.set + m.events.bond} cells that set were set from what was held (${pct(m.events.set, m.events.set + m.events.bond)}), and ${m.events.bond} were bonded by the model in ${m.calls} calls` });
  out.push(!Number.isInteger(get(teeth, 'planted')) || teeth.planted === 0 ? pending('K7', 'needs the harness turned on the planted readers') : { id: 'K7', pass: teeth.caught === teeth.planted, result: `${teeth.caught} of ${teeth.planted} planted leaks were found` });
  return out;
}

export default { NAMES, BARS, evaluate };
