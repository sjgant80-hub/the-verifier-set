// DocDec v2 · src/gate.mjs — L4, the verifier gate. Pure. The refusal is the product.
//
// An answer leaves only if every check passes, in this order, and each refusal says which check stopped it:
//   1 a source exists                       → else "not in your documents: nothing to search"
//   2 the best source clears the bar        → else "no source clears the grounding bar"
//   3 every content term is supported       → else "the best source does not support '<term>'"
//   4 the reader found an answer in it      → else "the best source does not contain the answer"
//   5 the reader's phrase is IN the source  → else "the reader's phrase is not in the source" (a model never supplies text)
// The answer is the source's own text at character offsets a third party can check.

const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);
const fin = (x) => (typeof x === 'number' && Number.isFinite(x));

// parseReader(raw) → { none:true } | { phrase } — first line, trimmed, outer quotes and ONE trailing full stop removed
export function parseReader(raw) {
  let s = str(raw).split('\n')[0].trim();
  if (s.length >= 2 && /^["'‘“]/.test(s) && /["'’”]$/.test(s)) s = s.slice(1, -1).trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trim();
  if (s.length === 0 || /^none\b/i.test(s)) return { none: true };
  return { phrase: s };
}

// findSpan(passage, phrase) → { start, end, text } in the ORIGINAL passage, or null. Case-insensitive; any run of
// whitespace in either string matches any run in the other. The returned text is the passage's own characters.
export function findSpan(passage, phrase) {
  const p = str(passage), f = str(phrase).trim();
  if (f.length === 0) return null;
  let flat = '';
  const map = [];
  let lastSpace = true;
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (/\s/.test(ch)) { if (!lastSpace) { flat += ' '; map.push(i); } lastSpace = true; }
    else { flat += ch.toLowerCase(); map.push(i); lastSpace = false; }
  }
  const needle = f.toLowerCase().replace(/\s+/g, ' ');
  const at = flat.indexOf(needle);
  if (at < 0) return null;
  const start = map[at], end = map[at + needle.length - 1] + 1;
  return { start, end, text: p.slice(start, end) };
}

// sentenceAround(passage, start, end) → the sentence (by . ! ? boundaries) containing [start, end)
export function sentenceAround(passage, start, end) {
  const p = str(passage);
  if (!fin(start) || !fin(end) || start < 0 || end > p.length || start > end) return null;
  let s = start;
  while (s > 0 && !/[.!?]\s/.test(p.slice(s - 2, s))) s--;
  let e = end;
  while (e < p.length && !/[.!?]/.test(p[e - 1] || '')) e++;
  return { start: s, end: e, text: p.slice(s, e).trim() };
}

// decide(c, opts) — c: { id, text, score, weakest, weakestToken, reader } for the best source (or null).
// opts: { bar, evidence, useReader }. Unset checks are off. Returns { answer, span? } or { refuse:true, why, check }.
export function decide(c, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (!c || typeof c !== 'object' || c.id == null) return { refuse: true, check: 1, why: 'not in your documents: nothing to search' };
  if (fin(o.bar) && !(fin(c.score) && c.score >= o.bar)) return { refuse: true, check: 2, why: 'no source clears the grounding bar' };
  if (fin(o.evidence) && !(fin(c.weakest) && c.weakest >= o.evidence)) {
    return { refuse: true, check: 3, why: `the best source does not support '${str(c.weakestToken).replace(/^##/, '')}'` };
  }
  if (o.useReader !== true) return { answer: c.id };
  const r = parseReader(c.reader);
  if (r.none) return { refuse: true, check: 4, why: 'the best source does not contain the answer' };
  const span = findSpan(c.text, r.phrase);
  if (!span) return { refuse: true, check: 5, why: "the reader's phrase is not in the source" };
  return { answer: c.id, span, sentence: sentenceAround(c.text, span.start, span.end) };
}

// decideTwo(pair, question) — multi-hop: pair { a:{id,title,text}, b:{...}, reader }. The answer must be found word for
// word in one of the two sources, or be yes/no (a verdict, not a span). Each source is cited by its sentence that best
// overlaps the question and answer (chosen by code, never by the model).
export function decideTwo(pair, question) {
  const p = pair && typeof pair === 'object' ? pair : {};
  if (!p.a || !p.b) return { refuse: true, check: 1, why: 'not in your documents: no pair of sources' };
  const r = parseReader(p.reader);
  if (r.none) return { refuse: true, check: 4, why: 'the two sources do not contain the answer' };
  const yn = /^(yes|no)$/i.test(r.phrase);
  const inA = findSpan(p.a.text, r.phrase), inB = findSpan(p.b.text, r.phrase);
  if (!yn && !inA && !inB) return { refuse: true, check: 5, why: "the reader's answer is not in either source" };
  const cite = (src, span) => (span ? sentenceAround(src.text, span.start, span.end) : bestSentence(src.text, `${str(question)} ${r.phrase}`));
  return { answer: yn ? r.phrase.toLowerCase() : (inA || inB).text, verdict: yn, spanIn: inA ? 'a' : (inB ? 'b' : null),
    cites: [{ id: p.a.id, ...cite(p.a, inA) }, { id: p.b.id, ...cite(p.b, inB) }] };
}

const WORD = /[a-z0-9]+/g;
// bestSentence(text, probe) → the sentence of text sharing the most distinct words (3+ letters) with probe; first wins ties
export function bestSentence(text, probe) {
  const t = str(text);
  const want = new Set((str(probe).toLowerCase().match(WORD) || []).filter((w) => w.length >= 3));
  const parts = [];
  const re = /[^.!?]+[.!?]*/g; let m;
  while ((m = re.exec(t)) !== null) { if (m[0].trim().length > 0) parts.push({ start: m.index, end: m.index + m[0].length }); }
  let best = null, bestN = -1;
  for (const s of parts) {
    const words = new Set((t.slice(s.start, s.end).toLowerCase().match(WORD) || []));
    let n = 0; for (const w of want) if (words.has(w)) n++;
    if (n > bestN) { bestN = n; best = s; }
  }
  if (!best) return { start: 0, end: t.length, text: t.trim() };
  return { start: best.start, end: best.end, text: t.slice(best.start, best.end).trim() };
}

// ── SQuAD's official answer normalisation, exact match and F1 ──
export function normalize(s) {
  return str(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
export function em(pred, golds) { const p = normalize(pred); return arr(golds).some((g) => normalize(g) === p) ? 1 : 0; }
export function f1(pred, golds) {
  const pt = normalize(pred).split(' ').filter(Boolean);
  let best = 0;
  for (const g of arr(golds)) {
    const gt = normalize(g).split(' ').filter(Boolean);
    if (pt.length === 0 && gt.length === 0) { best = Math.max(best, 1); continue; } // one side empty: no shared words, 0
    const counts = new Map(); for (const w of gt) counts.set(w, (counts.get(w) || 0) + 1);
    let same = 0; for (const w of pt) { const c = counts.get(w) || 0; if (c > 0) { same++; counts.set(w, c - 1); } }
    if (same === 0) continue;
    const prec = same / pt.length, rec = same / gt.length;
    best = Math.max(best, (2 * prec * rec) / (prec + rec));
  }
  return best;
}

export default { parseReader, findSpan, sentenceAround, decide, decideTwo, bestSentence, normalize, em, f1 };
