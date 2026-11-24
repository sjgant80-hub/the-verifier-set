// exact.mjs — exact arithmetic: the ground the checker stands on. Every number is a fraction of two whole numbers
// (BigInt), so nothing is rounded and "equal" means equal. A line of working is read as an expression and worked out
// here, by code, never by a model. Pure and total: text that is not arithmetic gives null, and nothing throws.
//
//   evaluate('0.5 × 14 × 23²')  →  { value: 3703/1, canon: '*(0.5,14,^(23,2))', ops: 3, shown: '0.5 × 14 × 23^2' }
//
// What it reads: whole numbers and decimals (thousands commas allowed), + - × ÷ ^, brackets, a leading minus, the
// signs people and models write for those (x * · ÷ / − ² ³ ½ ¼ ¾), and a unit after a number, which is dropped.
// What it refuses: letters, implied multiplication such as 2(3), unbalanced brackets, division by zero, numbers
// past a size limit. Refusing is safe: a line this cannot read is simply not a claim, so it is never kept or dropped.

const LIMIT = 10n ** 60n;          // no fraction may have a part longer than this
const MAX_EXPONENT = 64n, MAX_TOKENS = 200, MAX_DEPTH = 24, MAX_DIGITS = 40;
const abs = (a) => (a < 0n ? -a : a);
const gcd = (a, b) => { a = abs(a); b = abs(b); while (b !== 0n) { const t = a % b; a = b; b = t; } return a; };

// make(n, d) → the fraction n/d in lowest terms with d above zero, or null (d is zero, or a part is past the limit)
export function make(n, d = 1n) {
  if (typeof n !== 'bigint' || typeof d !== 'bigint' || d === 0n) return null;
  const g = gcd(n, d), sign = d < 0n ? -1n : 1n;
  const num = (sign * n) / g, den = (sign * d) / g;
  return abs(num) > LIMIT || den > LIMIT ? null : { n: num, d: den };
}
const ok = (f) => f !== null && typeof f === 'object' && typeof f.n === 'bigint' && typeof f.d === 'bigint';
export const add = (a, b) => (ok(a) && ok(b) ? make(a.n * b.d + b.n * a.d, a.d * b.d) : null);
export const sub = (a, b) => (ok(a) && ok(b) ? make(a.n * b.d - b.n * a.d, a.d * b.d) : null);
export const mul = (a, b) => (ok(a) && ok(b) ? make(a.n * b.n, a.d * b.d) : null);
export const div = (a, b) => (ok(a) && ok(b) ? make(a.n * b.d, a.d * b.n) : null);
// pow(a, e) → a to a whole-number power e (negative allowed when a is not zero); null past the exponent limit
export function pow(a, e) {
  if (!ok(a) || !ok(e) || e.d !== 1n || abs(e.n) > MAX_EXPONENT) return null;
  let out = make(1n), base = e.n < 0n ? make(a.d, a.n) : a;
  for (let i = 0n; i < abs(e.n) && out !== null; i++) out = mul(out, base);
  return out;
}
// same(a, b) → true when both are fractions and they are the same number
export const same = (a, b) => ok(a) && ok(b) && a.n === b.n && a.d === b.d;

// num(text) → a plain number as a fraction, or null: 3703, 1,776, 0.5, .5, -12
export function num(text) {
  const s = typeof text === 'string' ? text.trim() : '';
  const m = s.match(/^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d+))?$/);
  if (!m || (m[2] === undefined && m[3] === undefined)) return null;
  const whole = (m[2] || '0').split(',').join(''), part = m[3] || '';
  if (whole.length + part.length > MAX_DIGITS) return null;
  const f = make(BigInt(whole + part), 10n ** BigInt(part.length));
  return f === null ? null : (m[1] === '-' ? make(-f.n, f.d) : f);
}
// show(f) → the fraction as people write it: 3703, 0.5 or, when it does not end as a decimal, 1/3
export function show(f) {
  if (!ok(f)) return '';
  if (f.d === 1n) return String(f.n);
  let d = f.d, places = 0;
  while (d % 10n === 0n) { d /= 10n; places++; }
  let twos = 0, fives = 0;
  while (d % 2n === 0n) { d /= 2n; twos++; }
  while (d % 5n === 0n) { d /= 5n; fives++; }
  if (d !== 1n) return `${f.n}/${f.d}`;
  places += Math.max(twos, fives);
  const scaled = (abs(f.n) * 10n ** BigInt(places)) / f.d, digits = String(scaled).padStart(places + 1, '0');
  return `${f.n < 0n ? '-' : ''}${digits.slice(0, digits.length - places)}.${digits.slice(digits.length - places)}`;
}

// a unit written after a number is dropped (the number is what is being claimed)
const UNITS = /(\d|\))\s*(?:kg\s*[·*.]?\s*m\/s|m\/s\s*\^\s*2|m\/s²|m\/s|kg|joules?|newtons?|met(?:re|er)s?|seconds?|watts?|volts?|amps?|amperes?|ohms?|pascals?|J|N|W|V|A|Ω|Pa|m|s)(?![A-Za-z0-9^²])/g;
// tokens(text) → the expression as a list of tokens, or null when anything in it is not arithmetic
export function tokens(text) {
  if (typeof text !== 'string' || text.length > 400) return null;
  let s = text.replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/½/g, '(1/2)').replace(/¼/g, '(1/4)').replace(/¾/g, '(3/4)');
  s = s.replace(UNITS, '$1').replace(UNITS, '$1');
  s = s.replace(/([\d)])\s*[xX]\s*(?=[\d(.-])/g, '$1*');
  const out = [], re = /\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+|[-+*/^()])/y;
  let at = 0;
  while (at < s.length) {
    re.lastIndex = at;
    const m = re.exec(s);
    if (!m) return /^\s*$/.test(s.slice(at)) ? out : null;
    out.push(m[1]); at = re.lastIndex;
    if (out.length > MAX_TOKENS) return null;
  }
  return out;
}

const OPS = { '+': add, '-': sub, '*': mul, '/': div, '^': pow };
const node = (op, args, value) => (value === null ? null : { op, args, value });
// a recursive-descent reader over the tokens: sums of products of powers, with brackets and a leading minus
function read(toks) {
  let i = 0, depth = 0;
  const peek = () => toks[i];
  function atom() {
    const t = toks[i];
    if (t === '(') {
      if (++depth > MAX_DEPTH) return null;
      i++;
      const e = sum();
      if (e === null || toks[i] !== ')') return null;
      i++; depth--;
      return e;
    }
    const v = t === undefined ? null : num(t);
    if (v === null) return null;
    i++;
    return { op: 'n', args: [], value: v };
  }
  function unary() {
    if (peek() === '-') { i++; const u = unary(); return u === null ? null : node('neg', [u], sub(make(0n), u.value)); }
    return power();
  }
  function power() {
    const base = atom();
    if (base === null || peek() !== '^') return base;
    i++;
    const e = unary();
    return e === null ? null : node('^', [base, e], pow(base.value, e.value));
  }
  function chain(next, ops) {
    let left = next();
    while (left !== null && ops.includes(peek())) {
      const op = toks[i++], right = next();
      left = right === null ? null : node(op, [left, right], OPS[op](left.value, right.value));
    }
    return left;
  }
  const product = () => chain(unary, ['*', '/']);
  const sum = () => chain(product, ['+', '-']);
  const tree = sum();
  return tree !== null && i === toks.length ? tree : null;
}
// canon(tree) → one spelling for every way of writing the same working: 14 × 23 and 23 × 14 are the same key
function canon(t) {
  if (t.op === 'n') return show(t.value);
  if (t.op === '+' || t.op === '*') {
    const flat = (x) => (x.op === t.op ? x.args.flatMap(flat) : [canon(x)]);
    return `${t.op}(${flat(t).sort().join(',')})`;
  }
  return `${t.op}(${t.args.map(canon).join(',')})`;
}
// a minus in front of a plain number makes a negative number, not a step of working
const count = (t) => (t.op === 'n' || (t.op === 'neg' && t.args[0].op === 'n') ? 0 : 1 + t.args.reduce((a, x) => a + count(x), 0));

// evaluate(text) → { value, canon, ops, shown, tree } for a piece of arithmetic, or null when it is not one. ops
// counts the operations in it, so a bare number has ops 0. shown is the working written one plain way (units and
// commas gone). tree is its shape: { op, args, value } with op 'n' for a number.
export function evaluate(text) {
  const toks = tokens(text);
  if (toks === null || toks.length === 0) return null;
  const tree = read(toks);
  if (tree === null) return null;
  const SIGN = { '*': ' × ', '/': ' ÷ ', '+': ' + ', '-': ' - ' };
  const shown = toks.map((t, k) => (t === '-' && (k === 0 || '(+-*/^'.includes(toks[k - 1])) ? '-' : SIGN[t] || ('()^'.includes(t) ? t : show(num(t))))).join('');
  return { value: tree.value, canon: canon(tree), ops: count(tree), shown, tree };
}

export default { make, add, sub, mul, div, pow, same, num, show, tokens, evaluate };
