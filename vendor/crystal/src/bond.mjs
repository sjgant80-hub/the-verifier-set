// bond.mjs — the bond-check: the one thing that can say a cell has bonded. The step watcher of the stack.
//
// A cell is one operation on two numbers (26 × 12). The model is asked the cell and replies. The reply bonds the
// cell when, and only when, the whole reply is ONE statement of that cell's value, in one of three forms:
//
//     26 × 12 = 312          the step, an equals sign, the value
//     312 = 26 × 12          the value, an equals sign, the step
//     312                    the value alone
//
// The step must be the cell itself: the same operation on the same two numbers (the two numbers of a sum or a product
// in either order). The value must be a plain number that is exactly the cell's value. White space at the ends and
// one full stop at the end are let go. Nothing else is: a second line, a second equals sign, a word, a unit, a
// bracket, a third number, or working in place of the value each make the reply no statement at all, and it does not
// bond. So nothing rides into the crystal on a bond: a reply that bonds holds one true line and nothing more.
//
// This is a reader with one fixed shape and no other. It does not use The Climb's line reader, which lets words go
// and reads many lines: that reader is right for a page of working and too generous for a bond. The numbers are
// worked out by The Climb's exact arithmetic (whole-number fractions), never by a model.
//
// It ends: a reply is read once, left to right, and a reply longer than LIMIT characters is refused unread.
// Pure and total: whatever the reply or the cell is, this returns a ruling and never throws. src/fuzz.mjs attacks it.
import { num, same, add, sub, mul, div, pow } from '../vendor/climb/src/exact.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
export const LIMIT = 200;
// the signs a step may be written with, under the operation each stands for
export const SIGNS = { '*': '×xX*', '/': '÷/', '+': '+', '-': '-−', '^': '^' };
const WORK = { '*': mul, '/': div, '+': add, '-': sub, '^': pow };
const opOf = (ch) => Object.keys(SIGNS).find((k) => SIGNS[k].includes(ch));
const digit = (ch) => ch >= '0' && ch <= '9';
const minus = (ch) => ch === '-' || ch === '−';

// literal(s, i) → where the run of digits, commas and points that begins at i ends. Whether that run is a number
// written plainly (12,000 or 0.5, and not 12,00 or 1.2.3) is for the exact arithmetic's own reader to say.
function literal(s, i) {
  let j = i;
  while (digit(s[j]) || s[j] === ',' || s[j] === '.') j++;
  return j;
}
// tokens(s) → the text as numbers { value }, signs { op } and equals signs { eq }, or null when anything else is in
// it. A minus belongs to the number after it only where a number may begin: at the start, after a sign, after an
// equals sign; anywhere else it is the sign for taking away.
function tokens(s) {
  const out = [];
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    const signed = minus(ch) && digit(s[i + 1]) && (out.length === 0 || out[out.length - 1].value === undefined);
    if (digit(ch) || signed) {
      const from = signed ? i + 1 : i, end = literal(s, from), value = num((signed ? '-' : '') + s.slice(from, end));
      if (value === null) return null;
      out.push({ value }); i = end;
    } else if (ch === '=') { out.push({ eq: true }); i++; } else {
      const op = opOf(ch);
      if (op === undefined) return null;
      out.push({ op }); i++;
    }
  }
  return out;
}
// step(toks) → { op, a, b } when the tokens are one operation on two numbers, else null
const step = (t) => (t.length === 3 && t[0].value !== undefined && t[1].op !== undefined && t[2].value !== undefined ? { op: t[1].op, a: t[0].value, b: t[2].value } : null);
// the cell as a step with its exact value, or null when it is not one (or has no value: a division by nothing).
// A power of a number below nothing is not taken as a cell: written plainly, -3^2 means -(3^2), which is two steps.
function cellOf(cell) {
  const text = get(cell, 'text'), toks = typeof text === 'string' ? tokens(text) : null, s = toks === null ? null : step(toks);
  const value = s === null || (s.op === '^' && s.a.n < 0n) ? null : WORK[s.op](s.a, s.b);
  return value === null ? null : { ...s, value };
}
const no = (why) => ({ value: null, why });

// judge(reply, cell) → { value, why }: value is the cell's exact value when the reply bonds it, else null. why is
// 'bonded', or the reason it did not bond: 'not a step' (the cell is not one operation on two numbers), 'too long',
// 'not a statement' (the reply is not one of the three forms), 'another step' (the step written is not the cell),
// 'wrong value'.
export function judge(reply, cell) {
  const want = cellOf(cell);
  if (want === null) return no('not a step');
  const text = (typeof reply === 'string' ? reply : '').trim();
  if (text.length > LIMIT) return no('too long');
  const toks = tokens(text.endsWith('.') ? text.slice(0, -1) : text);
  if (toks === null) return no('not a statement');
  const at = toks.findIndex((t) => t.eq === true), sides = at === -1 ? [toks] : [toks.slice(0, at), toks.slice(at + 1)];
  // the value is the side that is one number; the other side, when there is one, must be the step
  const plain = sides.find((s) => s.length === 1 && s[0].value !== undefined), other = sides.find((s) => s !== plain);
  const said = other === undefined ? null : step(other);
  if (plain === undefined || (other !== undefined && said === null)) return no('not a statement');
  const turned = (want.op === '+' || want.op === '*') && same(said?.a, want.b) && same(said?.b, want.a);
  if (said !== null && !(said.op === want.op && ((same(said.a, want.a) && same(said.b, want.b)) || turned))) return no('another step');
  return same(plain[0].value, want.value) ? { value: want.value, why: 'bonded' } : no('wrong value');
}
// read(reply, cell) → the cell's exact value when the reply bonds it, else null
export const read = (reply, cell) => judge(reply, cell).value;

export default { LIMIT, SIGNS, judge, read };
