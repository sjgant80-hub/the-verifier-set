// checker.mjs — the ruling. It is code, never a model, and it is the only thing that can say a step is right or that
// a task is finished. It reads a reply line by line. A line such as "14 × 529 = 7406" is a claim: the left side is
// worked out exactly (exact.mjs) and the claim is KEPT if the two sides are the same number and DROPPED if they are
// not. It never says what the right number would have been. The final answer is ruled the same way against the task.
// Pure and total. A line it cannot read as arithmetic is not a claim: it is neither kept nor dropped.
import { evaluate, num, same, show, make, mul, add, pow } from './exact.mjs';

const str = (x) => (typeof x === 'string' ? x : '');
const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
// a bullet or a step label in front of the working is not part of it
const LABEL = /^\s*(?:[-*•]\s+|\(?\d{1,2}[.)]\s+|step\s*\d+\s*[:.)-]\s*)/i;
// what follows the word may open with a colon, an equals sign or markup, never with a minus: that belongs to the number
const ANSWER = /^\W*(?:final\s+)?answer\b[\s:=*]*(.*)$/i;
// side(text) → one side of an equals sign as arithmetic, or null. Words in front of the working are let go only when
// they stand apart from it ("So 23 × 23", "Energy: 0.5 × 14"); a name glued to a number ("v2") is not arithmetic.
function side(text) {
  const t = str(text).replace(/[.;,]\s*$/, '').trim();
  const whole = evaluate(t);
  if (whole !== null) return whole;
  const afterColon = t.includes(':') ? evaluate(t.slice(t.lastIndexOf(':') + 1)) : null;
  if (afterColon !== null) return afterColon;
  const words = t.split(/\s+/);
  let i = 0;
  while (i < words.length && /^[A-Za-z]+$/.test(words[i])) i++;
  return i > 0 ? evaluate(words.slice(i).join(' ')) : null;
}

// claimsOf(text) → every claim in a reply: [{ line, left, right, ok, canon, fact }]. A claim is two readable sides of
// an equals sign with at least one operation between them. fact is "working = number" when one side is a plain number.
export function claimsOf(text) {
  const out = [];
  let above = null;
  for (const [n, raw] of str(text).split('\n').entries()) {
    if (ANSWER.test(raw) || /[≈≠<>]/.test(raw)) { above = null; continue; }
    if (!raw.includes('=')) {
      // working rewritten on the next line with no equals sign: when the two lines come to the same number, the
      // second is a claim about the first. When they do not, nothing was claimed, so nothing is dropped.
      const here = side(raw.replace(LABEL, ''));
      // (two bare numbers that agree are the same number written twice: one spelling, so no claim)
      if (above !== null && here !== null && above.canon !== here.canon && same(above.value, here.value)) {
        const work = above.ops > 0 ? above : here, plain = above.ops > 0 ? here : above;
        out.push({ line: n, left: above.shown, right: here.shown, ok: true, canon: work.canon, fact: plain.ops === 0 ? `${work.shown} = ${show(plain.value)}` : null });
      }
      above = here;
      continue;
    }
    above = null;
    // each side with the side after it: a chain of equals signs is one claim per neighbouring pair
    const sides = raw.replace(LABEL, '').split('=').map(side);
    sides.slice(1).forEach((R, i) => {
      const L = sides[i];
      if (L === null || R === null || L.ops + R.ops === 0) return;
      const okay = same(L.value, R.value);
      // the working is the side with operations in it; the other side is its value
      const work = L.ops > 0 ? L : R, plain = L.ops > 0 ? R : L;
      out.push({ line: n, left: L.shown, right: R.shown, ok: okay, canon: work.canon, fact: okay && plain.ops === 0 ? `${work.shown} = ${show(plain.value)}` : null });
    });
  }
  return out;
}

// answerOf(text) → what the reply gives as its answer: { text, numbers }, from its last "ANSWER:" line, or null
export function answerOf(text) {
  const lines = str(text).split('\n').map((l) => l.match(ANSWER)).filter(Boolean);
  if (lines.length === 0) return null;
  const rest = lines[lines.length - 1][1].replace(/^[:=\s]+/, '').replace(/[.;,\s]+$/, '');
  const last = rest.includes('=') ? rest.slice(rest.lastIndexOf('=') + 1) : rest;
  const one = side(last);
  const numbers = (rest.match(/-?\d[\d,]*(?:\.\d+)?/g) || []).map((x) => num(x.replace(/,(?!\d{3})/g, ''))).filter(Boolean);
  return { text: rest, value: one !== null && one.ops === 0 ? one.value : null, numbers };
}

const int = (s) => { try { return /^-?\d+$/.test(str(s)) ? BigInt(s) : null; } catch { return null; } };
// home(task, answer) → true when the answer is right for the task. Three kinds of finish line, none of them a model:
//   value    the answer is exactly the task's number
//   factors  the answer gives two whole numbers above 1 whose product is the task's number (no stored answer needed)
//   root     the answer x satisfies x³ + b·x = n, worked out here
export function home(task, answer) {
  const c = get(task, 'check') || {}, a = answer || {};
  if (c.type === 'value') return same(get(a, 'value') || null, num(str(c.value)));
  if (c.type === 'factors') {
    const n = int(c.n), ns = (Array.isArray(a.numbers) ? a.numbers : []).filter((f) => f.d === 1n && f.n > 1n);
    return n !== null && ns.length === 2 && ns[0].n * ns[1].n === n;
  }
  if (c.type === 'root') {
    // a number that is missing makes the sum below come to nothing, and nothing is never the same as a number
    return same(add(pow(get(a, 'value') || null, make(3n)), mul(make(int(c.b)), get(a, 'value') || null)), make(int(c.n)));
  }
  return false;
}

// rule(text, task) → the ruling on one reply: which claims are kept, which are dropped, the facts worth remembering,
// the answer it gave, and whether the task is finished
export function rule(text, task) {
  const claims = claimsOf(text), seen = new Set(), kept = [], dropped = [];
  for (const c of claims) {
    const key = `${c.ok}|${c.canon}|${c.right}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (c.ok ? kept : dropped).push(c);
  }
  const answer = answerOf(text);
  return {
    kept: kept.map((c) => ({ text: `${c.left} = ${c.right}`, canon: c.canon, fact: c.fact })),
    dropped: dropped.map((c) => ({ text: `${c.left} = ${c.right}`, canon: c.canon })),
    answer: answer === null ? null : answer.text, home: answer !== null && home(task, answer),
  };
}

export default { claimsOf, answerOf, home, rule };
