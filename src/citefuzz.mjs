// citefuzz.mjs — the watcher that watches the evidential bond-check (cite.mjs), as fuzz.mjs watches the computational
// one. A leak here is worse than a wrong sum: a figure that is not in the document would be cited as if it were.
//
// Three opinions on every reply, made three ways: how the reply was MADE (a forgery or an honest quote), the
// bond-check (cite.mjs), and a SECOND READER (plainly(), below) written apart from it: it walks the document by hand,
// keeps its own idea of a line, a label, a word and a plain figure, and compares figures as decimal text. A reply the
// three do not agree on is a finding. A third arm is noise: honest quotes with a few characters changed.
//
// Two kinds of place are attacked. Where the document states the thing once (a figure CAN be cited): no forgery may
// bond and no honest quote may be refused. Where it does not state it, states it two ways, or states it in a way
// that cannot be read plainly (nothing can be cited): NOTHING may bond, whatever is replied, the document's own
// lines included.
//
// HARD is a fixed set of places with every awkward way a figure is written (a sign, a leading point, "5 million",
// a range, a figure in brackets, a label of each kind, line ends from another system). It is attacked with every
// corpus, so that the result never rests on the documents a run happened to use.
//
// teeth() turns the harness on readers with one leak planted in each. One of them is DocDec's own span check, as
// vendored: it matches a quote anywhere it finds the letters, so a figure cut out of a longer one gets through.
// Nothing here uses a model. Pure and total: a reader that throws is caught and counted.
import { rng, dec, spell } from '../vendor/crystal/src/fuzz.mjs';
import { findSpan, parseReader } from '../vendor/docdec/src/gate.mjs';
import { judge, stated, quote, figures, lines, STOP, LIMIT } from './cite.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const str = (x) => (typeof x === 'string' ? x : '');
const int = (R, n) => R() % n, pick = (R, xs) => xs[R() % xs.length];

// ── the second reader: its own lines, labels, words and figures ──
const isLetter = (ch) => typeof ch === 'string' && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));
const isDigit = (ch) => typeof ch === 'string' && ch >= '0' && ch <= '9';
const alnum = (ch) => isLetter(ch) || isDigit(ch);
// white space inside a line
const blank = (ch) => typeof ch === 'string' && ch !== '\n' && ch.trim() === '';
// its lines: [from, body, to) for each line that says anything. from is where the line begins on the page; body is
// where what it says begins, a label that opens the line ("3.", "(3)", "12)", "-", "*", "•") stepped over.
function itsLines(text) {
  const out = [];
  let from = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i < text.length && text[i] !== '\n') continue;
    let a = from;
    while (blank(text[a])) a++;
    const d = text[a] === '(' ? a + 1 : a;
    let n = 0;
    while (isDigit(text[d + n])) n++;
    const numbered = n >= 1 && n <= 3 && (text[d + n] === '.' || text[d + n] === ')'), bullet = text[a] === '-' || text[a] === '*' || text[a] === '•';
    let body = numbered ? d + n + 1 : a + 1;
    if ((numbered || bullet) && blank(text[body])) while (blank(text[body])) body++; else body = from;
    if (text.slice(body, i).trim() !== '') out.push([from, body, i]);
    from = i + 1;
  }
  return out;
}
// its words: the runs of letters in a span, lower case
const itsWords = (s) => { const out = []; let w = ''; for (const ch of `${s} `) { if (isLetter(ch)) w += ch.toLowerCase(); else { if (w) out.push(w); w = ''; } } return out; };
// what may touch a plain figure, and the words after one that change what it says: the second reader's own lists
const OPENS = '(£$€', CLOSES = ');:%.,?!', BIG = ['hundred', 'thousand', 'million', 'billion', 'trillion'];
// a whole run of digits, commas and points is a plain number when it is written as one (with commas, only in threes
// after a first group that does not begin with a nought) and is not too long to hold
const plain = (run) => dec(run) !== null && !(run.includes(',') && run[0] === '0');
// its figures in the line [from, to): [start, end) of each. It takes each whole run of digits, commas and points,
// and keeps it when it is a plain number that nothing but white space or an allowed mark touches, with no word after
// it that changes what it says.
function itsFigures(text, from, to) {
  const t = text.slice(from, to), out = [];
  for (let i = 0; t[i] !== undefined; i++) {
    if (!isDigit(t[i])) continue;
    let j = i;
    while (isDigit(t[j]) || ((t[j] === ',' || t[j] === '.') && isDigit(t[j + 1]))) j++;
    let k = j;
    while (blank(t[k])) k++;
    // a word that changes what the figure says counts only after white space: run on to the figure, it already
    // touches it, and the figure is not free
    const free = (i === 0 || blank(t[i - 1]) || OPENS.includes(t[i - 1])) && (j === t.length || blank(t[j]) || CLOSES.includes(t[j]));
    const big = BIG.some((w) => t.slice(k, k + w.length).toLowerCase() === w);
    if (free && !big && plain(t.slice(i, j))) out.push([from + i, from + j]);
    i = j;
  }
  return out;
}
const itsKeys = (cell) => [...new Set(itsWords(str(get(cell, 'text'))).filter((w) => !STOP.includes(w)))];
const holds = (words, keys) => keys.every((k) => words.includes(k));
// what the second reader says the document states about the cell: { text, keys, at: [[from, body, to]], figure }.
// figure is the one figure the lines about it give, as decimal text, or null.
function itsStated(cell, doc) {
  const text = str(get(doc, 'text')), keys = itsKeys(cell);
  if (keys.length === 0) return { text, keys, at: [], figure: null };
  const at = itsLines(text).filter(([, body, to]) => holds(itsWords(text.slice(body, to)), keys)), each = at.map(([, body, to]) => itsFigures(text, body, to));
  const values = new Set(each.flat().map(([a, b]) => spell(dec(text.slice(a, b)))));
  return { text, keys, at, figure: values.size === 1 && each.every((f) => f.length <= 1) ? [...values][0] : null };
}
// its quote: the reply with white space at the ends, one full stop, one matching pair of quote marks and one full
// stop inside them, let go
function itsQuote(reply) {
  let q = str(reply).trim();
  if (q.endsWith('.')) q = q.slice(0, -1);
  for (const [o, c] of [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]) if (q.length >= 2 && q.startsWith(o) && q.endsWith(c)) { q = q.slice(1, -1).trim(); return q.endsWith('.') ? q.slice(0, -1) : q; }
  return q;
}
// a quote may begin at i, or end at i, when that is not inside a word or a number
const begins = (t, i) => !(alnum(t[i]) && alnum(t[i - 1])) && !(isDigit(t[i]) && (t[i - 1] === '.' || t[i - 1] === ',') && isDigit(t[i - 2]));
const ends = (t, i) => !(alnum(t[i - 1]) && alnum(t[i])) && !(isDigit(t[i - 1]) && (t[i] === '.' || t[i] === ',') && isDigit(t[i + 1]));
// plainly(reply, cell, doc) → true when the reply is one honest quote that cites the cell's figure: the second reader
export function plainly(reply, cell, doc) {
  const s = itsStated(cell, doc), q = itsQuote(reply), t = s.text;
  // an empty reply, or "none", holds no figure, so the loop below never finds one in it
  if (s.figure === null || q.length > LIMIT || !holds(itsWords(q), s.keys)) return false;
  for (const [from, body, to] of s.at) for (let p = t.indexOf(q, from); p !== -1 && p + q.length <= to; p = t.indexOf(q, p + 1)) {
    if (begins(t, p) && ends(t, p + q.length) && itsFigures(t, body, to).some(([x, y]) => x >= p && y <= p + q.length)) return true;
  }
  return false;
}
// the second reader's parts, for the tests that hold the two readers side by side
export const SECOND = { lines: itsLines, figures: itsFigures, keys: itsKeys, quote: itsQuote };

// ── a place to attack: a cell and a document ──
// place(cell, doc) → what the harness needs to forge against it, from the document itself (cite.mjs's stated()):
// the line that states it, that line's label, its figure, the lines about it, the other lines; or null when the cell
// is no question of the document
export function place(cell, doc) {
  const s = stated(cell, doc), text = str(get(doc, 'text'));
  if (s.keys === null) return null;
  const all = lines(text), line = s.figure === null ? null : s.at.find((l) => figures(l.text, l.start).length === 1);
  return { cell, doc, keys: s.keys, can: s.figure !== null, why: s.why, line: line ? line.text : null, label: line ? text.slice(line.from, line.start) : '', figure: s.figure ? s.figure.text : null, at: s.figure ? s.figure.start - line.start : -1, about: s.at.map((l) => l.text), others: all.filter((l) => !s.at.some((x) => x.start === l.start)).map((l) => l.text), all: all.map((l) => l.text) };
}
const UP = (s) => s.replace(/[a-z]/, (ch) => ch.toUpperCase()), swapCase = (s) => (s[0] === s[0].toUpperCase() ? s[0].toLowerCase() : s[0].toUpperCase()) + s.slice(1);
const FULL = (v) => [...v].map((ch) => (isDigit(ch) ? String.fromCharCode(0xff10 + Number(ch)) : ch)).join('');
const other = (R, c) => (c.others.length ? pick(R, c.others) : 'Either party may end this agreement in writing.');
const otherFigure = (R, c) => { const f = c.others.flatMap((l) => figures(l).map((x) => x.text)).filter((t) => spell(dec(t)) !== spell(dec(c.figure))); return f.length ? pick(R, f) : String(Number(c.figure.replace(/,/g, '')) + 1 + int(R, 9)); };
const withFigure = (c, f) => c.line.slice(0, c.at) + f + c.line.slice(c.at + c.figure.length);

// FORGERIES → name → [kind, make(R, c)]: every way a reply is forged against a place where a figure CAN be cited.
// 'unsound': a bond would cite a figure, or a place, the document does not give for that thing. 'outside': the right
// line, in a form the check does not allow. make returns null when the place has no such forgery.
export const FORGERIES = {
  'the figure cut short': ['unsound', (R, c) => (c.figure.length < 2 ? null : c.line.slice(0, c.at + 1 + int(R, c.figure.length - 1)))],
  'the figure with its front cut off': ['unsound', (R, c) => (c.figure.length < 2 ? null : c.line.slice(c.at + 1 + int(R, c.figure.length - 1)))],
  'a word cut in two': ['unsound', (R, c) => c.line.slice(1 + int(R, 2))],
  'the figure changed': ['unsound', (R, c) => withFigure(c, String(Number(c.figure.replace(/,/g, '')) + pick(R, [1, -1, 10, 9, 100])))],
  'another line\'s figure in this line': ['unsound', (R, c) => withFigure(c, otherFigure(R, c))],
  'a quote of another line': ['unsound', (R, c) => other(R, c)],
  'two lines stitched': ['unsound', (R, c) => { const o = other(R, c), cut = Math.floor(o.length / 2); return pick(R, [c.line.slice(0, c.at) + o.slice(cut), o.slice(0, cut) + c.line.slice(c.at)]); }],
  'the figure alone': ['unsound', (R, c) => pick(R, [c.figure, c.line.slice(c.at).replace(/\.$/, ''), `${c.figure}.`])],
  'the line with its figure left out': ['unsound', (R, c) => pick(R, [c.line.slice(0, c.at).trim(), c.cell.text, UP(c.cell.text)])],
  'none, when it is there': ['unsound', (R) => pick(R, ['none', 'None.', 'NONE', '', ' '])],
  'the line in other letters': ['unsound', (R, c) => pick(R, [swapCase(c.line), c.line.toUpperCase(), c.line.toLowerCase(), c.line.replace(' ', '  '), c.line.replace(' ', '\u00a0'), withFigure(c, FULL(c.figure)), c.line.replace(/i/, 'í'), c.line.replace(/ /g, '')])],
  'words round the quote': ['unsound', (R, c) => pick(R, [`The document says: ${c.line}`, `${c.line} I think`, `It says "${c.line}"`, `ANSWER: ${c.line}`, `${c.line} (clause)`, `Yes. ${c.line}`])],
  'a second line with it': ['unsound', (R, c) => pick(R, [`${c.line}\n${other(R, c)}`, `${other(R, c)}\n${c.line}`, `${c.line} ${other(R, c)}`, `${c.line}\n${c.line}`])],
  'the figure twice': ['unsound', (R, c) => pick(R, [`${c.line.slice(0, c.at + c.figure.length)} ${c.figure}`, `${c.figure} ${c.line}`])],
  'another clause\'s number on the line': ['unsound', (R, c) => { const l = pick(R, ['99. ', '(98) ', '97) ', '0. ', 'Clause 4. ']); return l === c.label ? null : `${l}${c.line}`; }],
  'the line\'s own number cut in two': ['unsound', (R, c) => (/^\s*\(?\d\d/.test(c.label) ? `${c.label.replace(/^\s*\(?\d/, '')}${c.line}` : null)],
  'quote marks that do not match': ['outside', (R, c) => pick(R, [`"${c.line}`, `${c.line}"`, `"${c.line}'`, `“${c.line}"`, `""${c.line}""`, `${c.line}..`, `${c.line}!`, `${c.line}?`])],
  'too long, or built to break a reader': ['outside', (R, c) => pick(R, [`${c.line}${' '.repeat(LIMIT)}x`, `${c.line} `.repeat(40), 'x'.repeat(5000), `${'('.repeat(600)}${c.line}`, `\u0000${c.line}`, `${c.line}\ud800`, `\u200b${c.line}`, `${c.line}\u200b`])],
};
// honest(R, c) → a reply that IS an honest quote: a run of the line's own words that holds every key word and the
// figure, begun and ended at the edge of a word, sometimes with the line's own label when it begins where the line
// does, with or without quote marks, a full stop, white space at the ends
export function honest(R, c) {
  const L = c.line, low = L.toLowerCase(), need = [...c.keys.map((k) => { const m = low.match(new RegExp(`(^|[^a-z])${k}([^a-z]|$)`)); return [m.index + m[1].length, m.index + m[1].length + k.length]; }), [c.at, c.at + c.figure.length]];
  const first = Math.min(...need.map((n) => n[0])), last = Math.max(...need.map((n) => n[1]));
  const starts = [], stops = [];
  for (let i = 0; i <= first; i++) if (i === 0 || (alnum(L[i]) && begins(L, i))) starts.push(i);
  for (let i = last; i <= L.length; i++) if (i === L.length || (alnum(L[i - 1]) && ends(L, i))) stops.push(i);
  const start = pick(R, starts), core = L.slice(start, pick(R, stops)), [o, cl] = pick(R, [['', ''], ['', ''], ['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']]);
  const label = start === 0 && int(R, 3) === 2 ? c.label : '';
  return `${pick(R, ['', '', ' ', '\n'])}${o}${label}${core}${cl}${pick(R, ['', '', '.'])}${pick(R, ['', '', ' ', '\n'])}`;
}
const STOCK = [...'0123456789', ' ', ' ', '.', ',', '\n', '"', "'", 'a', 'e', 'T', 't', '-', '\u00a0', '\u200b'];
// noise(R, c) → an honest quote with one to three characters dropped, added, changed, swapped or doubled
export function noise(R, c) {
  const t = [...honest(R, c)];
  for (let k = 1 + int(R, 3); k > 0; k--) {
    const i = int(R, t.length + 1), how = int(R, 5);
    if (how === 0) t.splice(i, 1); else if (how === 1) t.splice(i, 0, pick(R, STOCK)); else if (how === 2) t.splice(i, 1, pick(R, STOCK));
    else if (how === 3) t.splice(i, 2, ...t.slice(i, i + 2).reverse()); else t.splice(i, 0, ...t.slice(i, i + 1));
  }
  return t.join('');
}
// tries(R, c) → replies to a place where NOTHING can be cited: the document's own lines (the lines about the cell
// first among them), figures out of it, the cell's own words with a figure. None may bond.
function tries(R, c) {
  const pool = c.about.length > 0 && int(R, 2) === 0 ? c.about : c.all, line = pool.length > 0 ? pick(R, pool) : 'none', loose = c.all.flatMap((l) => l.match(/\d+/g) || []), fig = loose.length > 0 ? pick(R, loose) : '7';
  return pick(R, [line, line.replace(/\.$/, ''), `"${line}"`, fig, `${UP(c.cell.text)} is ${fig} pounds.`, `${UP(c.cell.text)} is ${fig}`, `${c.cell.text} ${fig}`, 'none', c.all.join('\n'), `${line} ${fig}`]);
}

// HARD → places every corpus is attacked with: each awkward way a figure is written, each kind of label, line ends
// from another system. Some can be cited (the figure is plain) and some cannot (it is not): `can` says which, by hand.
const HARD_DOC = { id: 'hard', text: ['Schedule of hard cases', '1. The credit note is -40 pounds.', '2. The scrap rate is .5 per cent.', '3. The budget cap is 5 million pounds.', '4. The notice window is 30-day based.', '5. The bulk price is 1.250,50 euros.', '6. The parcel weight is 5kg.',
  '7. The ceiling is 3 thousand units.', '8. The span is 5-10 days.', '9. The floor is 0,500 units.', '10. The tariff is 12 pounds; the tariff is 12 pounds.', '11. The gate fee is 20 pounds.', '12. Note that the gate fee is 20.00 pounds.', '13. By rule v1.2 the levy is 5 pounds.', '(14) The surcharge is £7.', '- The rebate is 12.5%.', '* The reserve is (1,250.50).', '  15)  The margin is 0.75 of cost.', '• The quota is 007 units.'].join('\n') };
const CRLF_DOC = { id: 'crlf', text: 'Terms\r\n1. The stall fee is 20 pounds.\r\n2. The stall term is 6 months.\r\n' };
export const HARD = [
  ...[['the credit note', false], ['the scrap rate', false], ['the budget cap', false], ['the notice window', false], ['the bulk price', false], ['the parcel weight', false], ['the gate fee', true], ['the levy', true], ['the surcharge', true], ['the rebate', true], ['the reserve', true], ['the ceiling', false], ['the span', false], ['the margin', true], ['the quota', true], ['the floor', false], ['the tariff', false]].map(([text, can]) => ({ cell: { text }, doc: HARD_DOC, can })),
  { cell: { text: 'the stall fee' }, doc: CRLF_DOC, can: true }, { cell: { text: 'the stall term' }, doc: CRLF_DOC, can: true },
];

export const BUDGET = { forged: 54, honest: 12, noise: 36, barred: 40 };
// fuzz(pairs, opts) → the count. pairs: [{ cell, doc }]. opts.seed, opts.budget (replies for each place, by arm),
// opts.read (another reader in the bond-check's place: (reply, cell, doc) → something, or null for no bond).
//   places   how many could be cited from (open) and how many could not (barred)
//   forged   { tried, bonded, unsound, outside, own, rows }   honest { tried, refused }   noise { tried, bonded }
//   barred   { tried, bonded }: replies to places where nothing can be cited; bonded must be 0
//   split    replies on which the bond-check, the second reader and the label did not all agree; threw; found; sample
export function fuzz(pairs, opts) {
  const reader = typeof get(opts, 'read') === 'function' ? opts.read : (reply, cell, doc) => judge(reply, cell, doc).value, R = rng(get(opts, 'seed')), names = Object.keys(FORGERIES);
  const budget = Object.fromEntries(Object.keys(BUDGET).map((k) => { const v = get(get(opts, 'budget'), k); return [k, Number.isInteger(v) && v >= 0 ? v : BUDGET[k]]; }));
  const rows = names.map((name) => ({ name, kind: FORGERIES[name][0], tried: 0, bonded: 0 })), found = [], sample = [];
  const out = { seed: (Number(get(opts, 'seed')) || 0) >>> 0, budget, places: { open: 0, barred: 0 }, tried: 0, forged: { tried: 0, bonded: 0, unsound: 0, outside: 0, own: 0, rows }, honest: { tried: 0, refused: 0 }, noise: { tried: 0, bonded: 0 }, barred: { tried: 0, bonded: 0 }, split: 0, threw: 0, found, sample, clean: false };
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    const c = place(get(pair, 'cell'), get(pair, 'doc'));
    if (c === null) continue;
    out.places[c.can ? 'open' : 'barred']++;
    // the sample is taken from the first place that can be cited from
    const first = c.can && out.places.open === 1;
    const rule = (reply, arm, way, label) => {
      let bond = null;
      try { bond = reader(reply, c.cell, c.doc) !== null; } catch { out.threw++; }
      const second = plainly(reply, c.cell, c.doc), agreed = bond === second && (label === null || label === second);
      out.tried++;
      if (!agreed) { if (bond !== null) out.split++; if (found.length < 12) found.push({ cell: c.cell.text, line: c.line, reply: reply.slice(0, 160), arm, way, bond, second, label }); }
      if (first && sample.filter((s) => s.arm === arm).length < 8) sample.push({ cell: c.cell.text, arm, way, reply: reply.slice(0, 160), bond });
      return bond === true;
    };
    if (!c.can) { for (let i = 0; i < budget.barred; i++) { out.barred.tried++; if (rule(int(R, 4) === 0 ? [...tries(R, c)].reverse().join('') : tries(R, c), 'barred', c.why, false)) out.barred.bonded++; } continue; }
    // every way of forging is tried once on every place, in order, and then ways drawn at random for the rest
    for (let i = 0; i < budget.forged; i++) {
      const k = i < names.length ? i : int(R, names.length), reply = FORGERIES[names[k]][1](R, c);
      if (reply === null) continue;
      // a forgery that has come out as an honest quote of this very line (a line of one word and a figure) is not tried
      if (own(reply, c)) { out.forged.own++; continue; }
      out.forged.tried++; rows[k].tried++;
      if (rule(reply, 'forged', names[k], false)) { out.forged.bonded++; rows[k].bonded++; out.forged[rows[k].kind]++; }
    }
    for (let i = 0; i < budget.honest; i++) { out.honest.tried++; if (!rule(honest(R, c), 'honest', 'honest', true)) out.honest.refused++; }
    for (let i = 0; i < budget.noise; i++) { out.noise.tried++; if (rule(noise(R, c), 'noise', 'noise', null)) out.noise.bonded++; }
  }
  out.clean = out.forged.bonded === 0 && out.honest.refused === 0 && out.barred.bonded === 0 && out.split === 0 && out.threw === 0;
  return out;
}
// own(reply, c) → the reply, made as a forgery, is in fact a run of this line's own words (its own label with it, or
// not) that holds every key word and the figure whole: decided by spelling alone, with neither reader
export function own(reply, c) {
  const q = quote(reply), full = c.label + c.line, at = full.indexOf(q), fig = c.label.length + c.at;
  if (q === '' || at === -1) return false;
  return at <= fig && at + q.length >= fig + c.figure.length && begins(full, at) && ends(full, at + q.length) && c.keys.every((k) => new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(q.toLowerCase()));
}

// ── readers with a leak planted in each ──
const good = (reply, cell, doc) => judge(reply, cell, doc).value;
const lineFigure = (cell, doc) => { const s = stated(cell, doc); return s.figure === null ? null : s.figure.text; };
const whole = (l, q) => l.text === q || l.text === `${q}.`;
export const PLANTED = {
  // DocDec's own check 5, as vendored: the reader's phrase is in the source, wherever the letters are found. Where the
  // document cannot give the figure it takes nothing, so its one leak is the span check. (A reply of "none" has no
  // phrase, and findSpan finds no span for none.)
  'finds the quote wherever its letters are (DocDec\'s span check, as vendored)': (reply, cell, doc) => {
    const r = parseReader(str(reply)), f = lineFigure(cell, doc);
    if (f === null) return null;
    const mine = findSpan(str(get(doc, 'text')), r.phrase) ? figures(r.phrase) : [];
    return mine.length === 1 ? mine[0].text : null;
  },
  'does not mind capitals': (reply, cell, doc) => { const s = stated(cell, doc), q = quote(reply).toLowerCase(); return good(reply, cell, doc) ?? (s.figure !== null && s.at.some((l) => whole({ text: l.text.toLowerCase() }, q)) ? s.figure.text : null); },
  'takes a quote of any line': (reply, cell, doc) => { const f = lineFigure(cell, doc), hit = lines(str(get(doc, 'text'))).find((l) => whole(l, quote(reply))); return good(reply, cell, doc) ?? (f !== null && hit && figures(hit.text).length === 1 ? figures(hit.text)[0].text : null); },
  'does not look for a second figure': (reply, cell, doc) => { const s = stated(cell, doc), hit = s.at.find((l) => whole(l, quote(reply))); return good(reply, cell, doc) ?? (s.why === 'more than one figure there' && hit ? '1' : null); },
  'reads a figure whatever touches it': (reply, cell, doc) => { const s = stated(cell, doc), hit = s.at.find((l) => whole(l, quote(reply))), loose = hit ? hit.text.match(/\d+/g) : null; return good(reply, cell, doc) ?? (s.why === 'no figure there' && loose ? loose[0] : null); },
  'takes the figure when the quote does not say what it is the figure of': (reply, cell, doc) => { const f = lineFigure(cell, doc), q = quote(reply); return good(reply, cell, doc) ?? (f !== null && (q === f || q.startsWith(`${f} `)) ? f : null); },
  'takes the line\'s figure when the quote holds none': (reply, cell, doc) => { const s = stated(cell, doc), q = quote(reply); return good(reply, cell, doc) ?? (s.figure !== null && q !== '' && s.at.some((l) => l.text.startsWith(q)) ? s.figure.text : null); },
  'takes any clause number with the line': (reply, cell, doc) => good(reply, cell, doc) ?? good(quote(reply).replace(/^\(?\d{1,3}[.)]\s+/, ''), cell, doc),
  'reads the first line of the reply only': (reply, cell, doc) => good(str(reply).split('\n')[0], cell, doc),
  'lets words round the quote go': (reply, cell, doc) => good(reply, cell, doc) ?? good(str(reply).replace(/^[A-Za-z ]+: /, ''), cell, doc),
  'refuses everything': () => null,
  'throws on a reply it cannot read': (reply, cell, doc) => { const r = good(reply, cell, doc); if (r === null && /[^\x20-\x7e\n“”‘’]/.test(str(reply))) throw new Error('unreadable'); return r; },
};
// teeth(pairs, opts) → the harness turned on each planted reader, over HARD and the pairs given:
// { planted, caught, rows: [{ name, caught, way, reply }] }
export function teeth(pairs, opts) {
  const all = [...HARD, ...(Array.isArray(pairs) ? pairs : [])];
  const rows = Object.keys(PLANTED).map((name) => {
    const r = fuzz(all, { seed: get(opts, 'seed'), budget: get(opts, 'budget'), read: PLANTED[name] }), first = r.found[0];
    return { name, caught: !r.clean, way: first === undefined ? null : first.way, reply: first === undefined ? null : first.reply };
  });
  return { planted: rows.length, caught: rows.filter((r) => r.caught).length, rows };
}

export default { BUDGET, FORGERIES, PLANTED, HARD, SECOND, plainly, place, honest, noise, own, fuzz, teeth };
