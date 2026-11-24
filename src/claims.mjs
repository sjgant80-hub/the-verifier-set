// claims.mjs — the verdict on every registered claim, worked out from the recorded sealed run. Pure and total.
// The bars are CLAIMS.md's, word for word in BARS; test/claims.test.mjs checks the file still says each one. A claim
// whose evidence is missing is pending (pass: null), never passed or failed by default. Every bar is tested on
// whole-number counts, so a result that is exactly on a bar is decided exactly.
import { measure, against } from './counts.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
export const NAMES = {
  S1: 'Every answer is labelled with what it stands on', S2: 'An answer is what its document gives', S3: 'Nothing is cited that is not there', S4: 'The citation check holds', S5: 'The harnesses can find a leak',
  S6: 'The small model can read', S7: 'Checked beats unchecked', S8: 'A wrong source gives a wrong answer, and it is labelled', S9: 'The formula check holds', S10: 'The solver holds',
  S11: 'The small model can write a rule', S12: 'The small model can write a claim',
};
export const BARS = {
  S1: 'every sealed answer is labelled with the weakest kind of bond it stands on: none is labelled stronger, so grounded is never called proven; and every answer to a problem with no document, no rule and no claim is labelled proven',
  S2: 'no sealed problem whose bonds are all cited figures and exact steps reaches an answer other than the one its own document gives: none',
  S3: 'no sealed problem whose document does not state a needed figure, or states it two ways, reaches an answer; and at least 9 in 10 of them stop at that figure with the right reason',
  S4: 'no forged quote bonds, of every forgery made for every figure the sealed run asked for and for the fixed set of hard cases; no honest quote is refused; nothing bonds where the document cannot be cited; the bond-check and the second reader never rule differently on a reply; and nothing throws',
  S5: 'the harness that attacks each of the three checks this build adds finds the leak in every reader, runner and solver that has one planted in it',
  S6: 'of the figures that are in their documents, the model\'s quote bonds at least 8 in 10',
  S7: 'the lattice brings more of the sealed problems out as they should come out than the same model does in one unchecked reply, by an exact two-sided McNemar test, p < 0.05',
  S8: 'every sealed problem whose document misstates a figure, and that reaches an answer, gives the document\'s answer and not the true one, and is labelled grounded',
  S9: 'no formula that is a different rule bonds, of every forgery made for every rule the sealed problems asked for and for the twelve rules every attack keeps; no honest formula is refused; no rule\'s tests let a near-miss through; the check and the second runner never rule differently on a reply; and nothing throws',
  S10: 'on every claim the sealed run\'s model wrote, every sealed question\'s own claim, and every claim made to trip a solver for those questions and for the hard ones, the solver and a second procedure written apart from it give the same verdict or both refuse; and nothing throws',
  S11: 'of the rules the sealed problems asked for, the model\'s formula passes the rule\'s tests at least 7 in 10',
  S12: 'of the claims the sealed problems asked for, the model\'s comparison is decided and its verdict is the question\'s own at least 7 in 10',
};
const pending = (id, why) => ({ id, pass: null, result: `pending: ${why}` });
const counted = (x, k) => Number.isInteger(get(x, k)) && x[k] > 0;

// evaluate(F) → [{ id, pass, result }]. F holds: records (the sealed run's problems, from weave.mjs), tasks (the sealed
// problems), onetry (the one-try records for the same problems), fuzz and teeth (citefuzz.mjs's counts), formulas
// and formulaTeeth (formulafuzz.mjs's), logic and logicTeeth (logicfuzz.mjs's).
export function evaluate(F) {
  const records = Array.isArray(get(F, 'records')) ? F.records : null, tasks = Array.isArray(get(F, 'tasks')) ? F.tasks : [], fuzz = get(F, 'fuzz') || null;
  const m = records === null || records.length === 0 ? null : measure(records, tasks), out = [];
  const forged = get(fuzz, 'forged') || {}, honest = get(fuzz, 'honest') || {}, barred = get(fuzz, 'barred') || {};
  if (m === null) out.push(pending('S1', 'needs the sealed run'), pending('S2', 'needs the sealed run'), pending('S3', 'needs the sealed run'));
  else {
    const a = m.answers, plain = m.tiers.computed, answered = a.proven + a['proven within its encoding'] + a['proven against its tests'] + a.grounded + a.other;
    out.push({ id: 'S1', pass: a.collapsed === 0 && a.other === 0 && a.proven === plain.answered, result: `${answered} problems reached an answer: ${a.grounded} grounded, ${a['proven against its tests']} proven against its tests, ${a['proven within its encoding']} proven within its encoding, ${a.proven} proven, ${a.other} none of these. ${a.collapsed} were labelled stronger than what they stand on; ${plain.answered} problems with no document, rule or claim were answered` });
    out.push({ id: 'S2', pass: m.wrong === 0, result: `${m.wrong} answers that stand only on cited figures and exact steps were not what the problem's own document gives` });
    const must = m.tiers.absent.problems + m.tiers.conflict.problems, got = m.tiers.absent.answered + m.tiers.conflict.answered, right = m.tiers.absent.home + m.tiers.conflict.home;
    out.push(must === 0 ? pending('S3', 'needs sealed problems that must not be answered') : { id: 'S3', pass: got === 0 && right * 10 >= must * 9, result: `${got} of ${must} problems that must not be answered reached an answer; ${right} stopped at the right figure with the right reason (${pct(right, must)})` });
  }
  out.push(!counted(fuzz, 'tried') ? pending('S4', 'needs the attack on the figures the sealed run asked for') : { id: 'S4', pass: forged.bonded === 0 && honest.refused === 0 && barred.bonded === 0 && fuzz.split === 0 && fuzz.threw === 0, result: `${forged.bonded} of ${forged.tried} forged quotes bonded (${forged.unsound} that would have cited a figure wrongly, ${forged.outside} outside the allowed form); ${honest.refused} of ${honest.tried} honest quotes were refused; ${barred.bonded} of ${barred.tried} replies bonded where nothing can be cited; the two readers ruled differently on ${fuzz.split} of ${fuzz.tried} replies; ${fuzz.threw} threw. ${get(get(fuzz, 'places'), 'open')} places that can be cited and ${get(get(fuzz, 'places'), 'barred')} that cannot, seed ${fuzz.seed}` });
  const teeth = [['the citation check', get(F, 'teeth')], ['the formula check', get(F, 'formulaTeeth')], ['the solver', get(F, 'logicTeeth')]];
  out.push(teeth.some(([, t]) => !counted(t, 'planted')) ? pending('S5', 'needs each harness turned on its planted readers') : { id: 'S5', pass: teeth.every(([, t]) => t.caught === t.planted), result: teeth.map(([what, t]) => `${what}: ${t.caught} of ${t.planted} planted leaks found`).join('; ') });
  out.push(m === null || m.reads.there === 0 ? pending('S6', 'needs the sealed run') : { id: 'S6', pass: m.reads.bonded * 10 >= m.reads.there * 8, result: `${m.reads.bonded} of ${m.reads.there} figures that were in their documents were quoted so that they bonded (${pct(m.reads.bonded, m.reads.there)})` });
  const one = against(records, get(get(F, 'onetry'), 'records'));
  out.push(one.compared === 0 ? pending('S7', 'needs the sealed run and one unchecked reply on the same problems') : { id: 'S7', pass: Math.sign(one.only - one.other) === 1 && one.p < 0.05, result: `one unchecked reply ${pct(one.both + one.other, one.compared)}, the lattice ${pct(one.both + one.only, one.compared)} of ${one.compared} problems; ${one.only} only the lattice, ${one.other} only the one reply, p = ${one.p.toPrecision(3)}` });
  const ms = get(m, 'misstated') || { answered: 0 };
  out.push(m === null || ms.answered === 0 ? pending('S8', 'needs sealed problems with a misstated figure that reached an answer') : { id: 'S8', pass: ms.followDocument === ms.answered && ms.differFromWorld === ms.answered && ms.grounded === ms.answered, result: `${ms.answered} of ${ms.problems} such problems reached an answer: ${ms.followDocument} gave the document's answer, ${ms.differFromWorld} differ from the true one, ${ms.grounded} are labelled grounded` });
  const ff = get(F, 'formulas') || null, ffg = get(ff, 'forged') || {}, ffh = get(ff, 'honest') || {}, lim = get(ff, 'limit') || {};
  out.push(!counted(ff, 'tried') ? pending('S9', 'needs the attack on the rules the sealed problems asked for') : { id: 'S9', pass: ffg.bonded === 0 && ffh.refused === 0 && ff.weak === 0 && ff.split === 0 && ff.threw === 0, result: `${ffg.bonded} of ${ffg.tried} formulas that are a different rule bonded (${ffg.unsound} different rules, ${ffg.outside} outside the allowed form); ${ffh.refused} of ${ffh.tried} honest formulas were refused; ${ff.weak} near-misses passed a rule's tests; the two runners ruled differently on ${ff.split} of ${ff.tried} replies; ${ff.threw} threw. ${ff.places} rules, seed ${ff.seed}. The limit, counted apart: ${lim.bonded} of ${lim.tried} formulas built from the tests themselves bonded, as passing the tests allows` });
  const lf = get(F, 'logic') || null;
  out.push(!counted(lf, 'tried') ? pending('S10', 'needs the attack on the claims of the sealed problems') : { id: 'S10', pass: lf.split === 0 && lf.threw === 0, result: `${lf.agreed} of ${lf.tried} claims had one verdict from both, or were refused by both (${get(get(lf, 'verdicts'), 'yes')} yes, ${get(get(lf, 'verdicts'), 'no')} no, ${get(get(lf, 'verdicts'), 'it depends')} it depends, ${lf.refused} refused); they differed on ${lf.split}; ${lf.threw} threw. ${lf.places} questions, seed ${lf.seed}` });
  out.push(m === null || m.rules.asked === 0 ? pending('S11', 'needs the sealed run') : { id: 'S11', pass: m.rules.bonded * 10 >= m.rules.asked * 7, result: `${m.rules.bonded} of ${m.rules.asked} formulas the model wrote passed their rule's tests (${pct(m.rules.bonded, m.rules.asked)})` });
  out.push(m === null || m.claims.asked === 0 ? pending('S12', 'needs the sealed run') : { id: 'S12', pass: m.claims.matched * 10 >= m.claims.asked * 7, result: `${m.claims.matched} of ${m.claims.asked} claims the model wrote were decided with the question's own verdict (${pct(m.claims.matched, m.claims.asked)}); ${m.claims.bonded - m.claims.matched} were decided with another verdict, and are labelled as such` });
  return out;
}

export default { NAMES, BARS, evaluate };
