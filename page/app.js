// app.js — the page. The kernels above it are the gated code, inlined byte for byte; this file shows what they
// compute, drives the model in the tab, and hands each record to the glass. Every number it writes is a count of
// what happened in a recorded run, through COUNTS and CLAIMS, or a count of an attack made on this page.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bind = (k, html) => { for (const el of document.querySelectorAll(`[data-bind="${k}"]`)) el.innerHTML = html; };
const getJSON = async (p) => { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch { return null; } };
const NM = '<span class="pend">not measured yet</span>';
const WEBLLM = 'https://esm.run/@mlc-ai/web-llm@0.2.79', MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const S = { data: null, engine: null, gpu: null, canRun: false, busy: false, gem: null, L: null, time: 0, target: 0, local: null, view: 'published' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const tasksOf = (set) => { const s = S.data.settings.sets[set]; return s ? TASKS.set(s.seed, s.sheets) : []; };
const seedFacts = () => (S.data.seed && Array.isArray(S.data.seed.facts) ? S.data.seed.facts : []);
const recordsOf = (run, part) => (run && run[part] && Array.isArray(run[part].records) ? run[part].records : []);
const covers = (run, part, tasks) => { const ids = new Set(recordsOf(run, part).map((r) => r.id)); return tasks.length > 0 && tasks.every((t) => ids.has(t.id)); };
const sourceOf = (run) => (run ? `Llama 3.2 1B, 4-bit, in a browser tab (WebLLM 0.2.79), ${esc(run.gpu || 'GPU not reported')}, ${String(run.at).slice(0, 10)}` : 'not measured yet');
// the run the page is showing: the visitor's own once they have made one, else the published sealed run, else the dev run
const shown = () => (S.view === 'mine' && S.local ? { run: S.local, what: `your run on this device (${S.local.set} set)` } : S.data.runs.sealed ? { run: S.data.runs.sealed, what: 'the published sealed run' } : S.data.runs.dev ? { run: S.data.runs.dev, what: 'the published dev run (the problems the build was tuned on)' } : { run: null, what: null });
// what a run put to the model: every step of a sum, and every figure with its document
const askedSteps = (records) => [...new Set(records.flatMap((r) => (r.crystal && r.crystal.events ? r.crystal.events : []).filter((e) => typeof e.said === 'string').map((e) => e.cell)))];
const askedFigures = (records, tasks) => { const byId = new Map(tasks.map((t) => [t.id, t])); return records.flatMap((r) => (byId.get(r.id) && byId.get(r.id).doc ? r.cites.filter((c) => c.kind !== 'set').map((c) => ({ cell: { text: c.cell }, doc: byId.get(r.id).doc })) : [])); };
// every rule and every claim a run asked for (or, with no run, that the dev problems ask for): the rule as the
// problem holds it; for a claim, the question's own claim and the model's, both on the question's own figures
const ruled = (records, tasks) => { const asked = new Set(records.filter((r) => r.rule).map((r) => r.id)); return tasks.filter((t) => t.rule && (records.length === 0 || asked.has(t.id))).map((t) => t.rule); };
const questioned = (records, tasks) => { const byId = new Map(records.map((r) => [r.id, r])); return tasks.filter((t) => t.decide && (records.length === 0 || (byId.get(t.id) && byId.get(t.id).claim))).flatMap((t) => { const q = { names: t.decide.names, given: t.decide.full }, said = byId.get(t.id) && byId.get(t.id).claim ? String(byId.get(t.id).claim.said).trim() : ''; return [{ ...q, claim: t.decide.claim }, ...(said ? [{ ...q, claim: said }] : [])]; }); };
// every attack, with the seed and budgets the settings fixed; worked out once for each set of places
const memo = new Map();
const opts = () => { const f = S.data.settings.fuzz || {}; return { seed: f.seed, sums: { seed: f.seed, budget: f.sums }, cites: { seed: f.seed, budget: f.cites }, rules: { seed: f.seed, budget: f.rules }, claims: { seed: f.seed, budget: f.claims } }; };
const attackOf = (key, steps, figures, rules, questions) => { if (!memo.has(key)) memo.set(key, { sums: FUZZ.fuzz(steps.length ? steps : FUZZ.EVERY, opts().sums), cites: CITEFUZZ.fuzz([...CITEFUZZ.HARD, ...figures], opts().cites), rules: FORMULAFUZZ.fuzz([...TASKS.RULES, ...rules], opts().rules), claims: LOGICFUZZ.fuzz([...LOGICFUZZ.HARD, ...questions], opts().claims) }); return memo.get(key); };
// the harnesses turned on their planted readers: the citation one on two dozen dev figures, the formula one on four
// of the kept rules (one of each shape: a product, a division, two steps, three), the solver's on its hard questions
const teethOf = () => { if (!memo.has('teeth')) { const dev = tasksOf('dev'); memo.set('teeth', { sums: FUZZ.teeth([], opts().sums), cites: CITEFUZZ.teeth(dev.filter((t) => t.doc).flatMap((t) => t.slots.map((s) => ({ cell: { text: s.text }, doc: t.doc }))).slice(0, 24), opts().cites), rules: FORMULAFUZZ.teeth(TASKS.RULES.filter((_, i) => i % 3 === 0), opts().rules), claims: LOGICFUZZ.teeth(questioned([], dev).slice(0, 12), opts().claims) }); } return memo.get('teeth'); };

// ── the glass ──
function show(L, jump) {
  S.L = L;
  if (S.gem) S.gem.setLattice(L);
  S.target = L.span + 2;
  if (jump) S.time = S.target;
  if (S.gem) S.gem.setTime(S.time);
}
function tick() {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
  if (!S.gem || !S.L || Math.abs(S.target - S.time) < 0.001) return;
  const gap = S.target - S.time, step = Math.sign(gap) * Math.min(Math.abs(gap), Math.max(0.04, Math.abs(gap) * 0.02));
  S.time += step; S.gem.setTime(S.time);
  if (!S.scrubbing) $('scrub').value = String(Math.round((1000 * Math.min(S.time, S.L.span)) / Math.max(1, S.L.span)));
}
function play() { if (!S.L) return; S.time = 0; S.target = S.L.span + 2; if (S.gem) S.gem.setTime(0); }
function tip(e) {
  if (!S.gem) return;
  const r = e.target.getBoundingClientRect(), hit = S.gem.pick(e.clientX - r.left, e.clientY - r.top), t = $('tip');
  if (!hit) { t.style.transform = 'translate(-999px,-999px)'; return; }
  const c = hit.cell, what = { seed: 'held before the run began', bond: 'worked out by the model, checked by exact arithmetic', cite: 'quoted by the model from the document', rule: 'a rule the model wrote as a formula, run on the rule\'s tests', claim: 'a claim the model wrote down, decided by the solver', home: 'the answer', dissolve: 'did not bond', dark: 'never reached' }[c.kind];
  t.innerHTML = `<b>${esc(c.text)}</b><br>${what}${c.depth ? ` · round ${c.depth}` : ''}${c.says ? `<br><span class="${['pass', 'soft', 'tested', 'encoded'][c.material] || 'pass'}">${esc(c.says)}</span>` : ''}${c.source ? `<br>In the document, characters ${c.source.start} to ${c.source.end}: “${esc(c.source.text)}”` : ''}`;
  t.style.transform = `translate(${Math.min(e.clientX + 14, innerWidth - 300)}px, ${e.clientY + 14}px)`;
}

// the comparison the way of asking rests on (data/bench.json): each way's replies ruled on again here, by the check itself
function benchLine(b) {
  const ways = b && Array.isArray(b.ways) ? b.ways : [], docOf = new Map(Object.entries(b && b.docs && typeof b.docs === 'object' ? b.docs : {}).map(([id, text]) => [id, { text: String(text) }]));
  const count = (name) => {
    const w = ways.find((x) => x.name === name), c = { there: 0, bonded: 0, none: 0 };
    for (const r of w && Array.isArray(w.rows) ? w.rows : []) {
      const doc = docOf.get(r.problem), cell = { text: r.cell };
      if (!doc || CITE.stated(cell, doc).figure === null) continue;
      const why = CITE.judge(String(r.said ?? ''), cell, doc).why;
      c.there++; if (why === 'bonded') c.bonded++; if (why === 'the model says it is not there') c.none++;
    }
    return c;
  };
  const off = count('offered'), copy = count('copy only');
  if (off.there === 0 || copy.there !== off.there) return 'The comparison that led to this is not published yet.';
  return `Why: on ${off.there} figures that were in their documents (dev problems, before the seal), the same model was asked both ways. Offered the word "none", it said none of ${off.none} of them, and its copy bonded for ${off.bonded}. Asked only to copy, its copy bonded for ${copy.bonded}.`;
}
// the comparison the unchecked reply rests on (data/baseline.json): each way's replies ruled on again here, by the
// same reading the page gives every unchecked reply
function baselineLine(b) {
  const ways = b && Array.isArray(b.ways) ? b.ways : [], asked = b && b.asked && typeof b.asked === 'object' ? b.asked : {};
  const count = (name) => {
    const w = ways.find((x) => x.name === name), c = { n: 0, right: 0, cut: 0 };
    for (const r of w && Array.isArray(w.rows) ? w.rows : []) {
      const q = asked[r.problem];
      if (!q) continue;
      const task = { check: { value: q.want }, expect: q.decline ? { key: 'x' } : null, decide: q.verdict ? {} : null };
      c.n++; if (ONETRY.rule(String(r.said ?? ''), task).right) c.right++; if (r.finish === 'length') c.cut++;
    }
    return c;
  };
  const may = count('may decline'), not = count('not told it may decline');
  if (may.n === 0 || not.n !== may.n) return 'The comparison that chose how the unchecked reply is asked is not published yet.';
  return `The unchecked reply is asked the stronger of two ways, chosen on the ${may.n} dev problems before the seal: told it may reply "cannot tell", it got ${may.right} right; not told, ${not.right}. With room for ${esc(String(ways[0].maxTokens))} tokens, ${may.cut} of its ${may.n} replies ran to the limit.`;
}

// ── what the record says ──
function ledger(m, L) {
  bind('n.cited', m ? String(m.cites.bonded) : NM); bind('n.proven', m ? String(L.counts.proven) : NM); bind('n.grounded', m ? String(L.counts.grounded) : NM);
  bind('n.tested', m ? String(L.counts['proven against its tests']) : NM); bind('n.encoded', m ? String(L.counts['proven within its encoding']) : NM);
  bind('n.refused', m ? String(m.cites.dark) : NM); bind('n.home', m ? `${m.home} of ${m.problems}` : NM);
}
function render() {
  const { run, what } = shown(), records = recordsOf(run, 'lattice'), tasks = run ? tasksOf(run.set) : [], seed = seedFacts();
  const L = FACETS.lattice(seed, records, tasks), m = records.length ? COUNTS.measure(records, tasks) : null, G = S.data.gates && S.data.gates.files ? S.data.gates.files : {};
  ledger(m, L);
  $('status').innerHTML = run ? `Showing ${esc(what)}: ${sourceOf(run)}.` : `No run has been made and recorded yet. ${seed.length ? `The glass shows the seed: ${seed.length} steps The Crystal's sealed run checked, all proven.` : 'Press the button to grow one here.'}`;
  bind('h.seed', seed.length ? `It starts from ${seed.length} steps already checked, from ${esc(S.data.seed.from)}.` : 'The seed is not laid yet: The Crystal\'s sealed run has to be published first.');
  bind('h.law', m ? `In ${esc(what)}: of the answers, ${m.answers.grounded} are grounded, ${m.answers['proven against its tests']} proven against their tests, ${m.answers['proven within its encoding']} proven within their encoding and ${m.answers.proven} proven; ${m.answers.collapsed} were labelled stronger than what they stand on. The crystal holds ${m.facets.grounded} grounded bonds, ${m.facets['proven against its tests']} proven against tests, ${m.facets['proven within its encoding']} proven within an encoding and ${m.facets.proven} proven.` : 'The law is tested on every push; the run that counts it on the model is not made yet.');
  bind('h.source', run ? `From ${esc(what)}: ${sourceOf(run)}; ${run.seconds} s in ${run.segments} sitting${run.segments === 1 ? '' : 's'}; ${run.privacy ? run.privacy.requests : '?'} network requests while it worked.` : 'The sealed run has not been made yet. The claims below are registered and waiting.');
  const one = recordsOf(run, 'onetry'), right = one.filter((r) => r.right).length, answeredAnyway = one.filter((r) => (r.tier === 'absent' || r.tier === 'conflict') && r.answered).length, mustRefuse = one.filter((r) => r.tier === 'absent' || r.tier === 'conflict').length;
  $('reads').innerHTML = m ? `<p>Of ${m.reads.there} figures that were in their documents, the model's quote bonded ${m.reads.bonded} (${m.reads.there ? ((100 * m.reads.bonded) / m.reads.there).toFixed(1) : '0'}%). Of ${m.madeUp.notThere} figures that could not be cited (not stated, or stated two ways), the model offered a quote ${m.madeUp.offered} times (it is asked to copy a line, and is never asked whether the figure is there: that is for the check to say); <b class="${m.madeUp.bonded ? 'fail' : 'pass'}">${m.madeUp.bonded} of those bonded</b>.</p><table><thead><tr><th>why a figure did not bond</th><th>times</th></tr></thead><tbody>${Object.entries(m.cites.whys).filter(([k]) => k !== 'bonded').sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join('') || '<tr><td>every figure asked for bonded</td><td class="num">0</td></tr>'}</tbody></table><p>Of ${m.rules.asked} rules the model was asked to write as a formula, ${m.rules.bonded} passed their tests. Of ${m.claims.asked} claims it was asked to write down, ${m.claims.bonded} could be decided, and ${m.claims.matched} of those gave the question's own verdict; <b class="${m.claims.bonded - m.claims.matched ? 'soft' : 'pass'}">${m.claims.bonded - m.claims.matched} were decided exactly, about a claim the model wrote down wrongly</b>, and carry the label that says so.</p><table><thead><tr><th>why a rule or a claim did not bond</th><th>times</th></tr></thead><tbody>${[...Object.entries(m.rules.whys).map(([k, n]) => [`rule: ${k}`, n]), ...Object.entries(m.claims.whys).map(([k, n]) => [`claim: ${k}`, n])].filter(([k]) => !k.endsWith('bonded')).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join('') || '<tr><td>every rule and claim asked for bonded</td><td class="num">0</td></tr>'}</tbody></table><table><thead><tr><th>kind of problem</th><th>problems</th><th>reached an answer</th><th>came out as it should</th></tr></thead><tbody>${TASKS.TIERS.map((t) => `<tr><td>${esc(t)}</td><td class="num">${m.tiers[t].problems}</td><td class="num">${m.tiers[t].answered}</td><td class="num">${m.tiers[t].home}</td></tr>`).join('')}</tbody></table><p class="small">For "absent" and "conflict" the right outcome is no answer, stopped at the right figure for the right reason. From ${esc(what)}.</p>` : NM;
  $('cost').innerHTML = m ? `<p>${m.calls} model calls for ${m.problems} problems (${(m.calls / m.problems).toFixed(1)} each), ${m.seconds.toFixed(0)} s of model time: ${m.cites.asked} to cite figures, ${m.rules.asked} to write rules, ${m.claims.asked} to write claims and ${m.steps.asked} to work out steps. ${one.length ? `One unchecked reply to each of the same problems, read generously, got ${right} of ${one.length} right; on the ${mustRefuse} problems that have no answer it gave a number ${answeredAnyway} times.` : 'The one unchecked reply is not recorded for this run.'} The lattice brought ${m.home} of ${m.problems} out as they should come out.</p><p class="small">${baselineLine(S.data.baseline)}</p>` : NM;
  bind('l.misstated', m && m.misstated.problems ? `In ${esc(what)}, ${m.misstated.problems} problems had a document that misstates a figure: ${m.misstated.answered} were answered, ${m.misstated.followDocument} with the document's figure, and ${m.misstated.differFromWorld} of those answers are not the true one. All ${m.misstated.grounded} are labelled grounded.` : 'That case is in the problem set and is not measured yet.');
  const gate = (files) => { const got = files.map((f) => G[f]); if (got.some((g) => !g)) return '<span class="pend">built; its mutation gate is not recorded yet</span>'; const k = got.reduce((a, g) => a + g.killed, 0), n = got.reduce((a, g) => a + g.total, 0), ig = got.reduce((a, g) => a + (g.ignored || 0), 0); return got.every((g) => g.clean === true) ? `<span class="pass">built, gated ${k}/${n}${ig ? ` (${ig} equivalent, with the reason written down)` : ''}</span>` : `<span class="fail">built, gate not clean: ${k}/${n}</span>`; };
  bind('bp.strength', gate(['src/strength.mjs'])); bind('bp.cite', gate(['src/cite.mjs'])); bind('bp.citefuzz', gate(['src/citefuzz.mjs'])); bind('bp.weave', gate(['src/weave.mjs', 'src/tasks.mjs'])); bind('bp.facets', gate(['src/facets.mjs', 'src/set.mjs'])); bind('bp.counts', gate(['src/counts.mjs', 'src/claims.mjs', 'src/onetry.mjs']));
  bind('bp.formula', gate(['src/formula.mjs'])); bind('bp.formulafuzz', gate(['src/formulafuzz.mjs'])); bind('bp.logic', gate(['src/logic.mjs'])); bind('bp.logicfuzz', gate(['src/logicfuzz.mjs']));
  bind('bp.ways', `${Object.keys(CITEFUZZ.FORGERIES).length} ways of forging a quote, honest quotes, noise, ${CITEFUZZ.HARD.length} hard cases kept for every attack, places where nothing can be cited, a second reader, and ${Object.keys(CITEFUZZ.PLANTED).length} leaky readers it must catch`);
  bind('bp.ruleways', `${Object.keys(FORMULAFUZZ.FORGERIES).length} ways of forging a formula, honest rewrites, noise, the ${TASKS.RULES.length} rules kept for every attack, a check that no rule's tests let a near-miss through, a second runner, and ${Object.keys(FORMULAFUZZ.PLANTED).length} leaky runners it must catch`);
  bind('bp.claimways', `${Object.keys(LOGICFUZZ.FORGERIES).length} ways of making a claim to trip a solver or to be refused, ${LOGICFUZZ.HARD.length} hard questions kept for every attack, a second procedure that works out every corner, and ${Object.keys(LOGICFUZZ.PLANTED).length} leaky solvers it must catch`);
  bind('h.none', benchLine(S.data.bench));
  bind('bp.seed', S.data.provenance ? `the-crystal at ${esc(String(S.data.provenance.crystal.commit).slice(0, 7))}, ${S.data.provenance.crystal.files.length} files, each with the hash its seal gives it` : NM);
  bind('b.what', m ? `In ${esc(what)}, ${m.home} of ${m.problems} problems came out as they should; ${m.wrong} answers that stand on cited figures and exact steps were other than what their document gives.` : 'The result is not measured yet.');
  bind('b.cost', m ? `${(m.calls / m.problems).toFixed(1)} small calls per problem in ${esc(what)}.` : 'The cost is not measured yet.');
  bind('b.versus', m && one.length ? `In ${esc(what)}, the same model in one unchecked reply got ${right} of ${one.length} problems right, and on the ${mustRefuse} with no answer it gave a number ${answeredAnyway} times. With the checks, ${m.home} of ${m.problems} came out as they should, and none of those ${mustRefuse} was answered.` : 'The comparison is not measured yet.');
  bind('b.refused', m ? `In ${esc(what)}: ${m.cites.dark} of ${m.cites.asked} figures asked for did not bond, ${m.madeUp.notThere} of them because the document could not give them.` : 'The count is not measured yet.');
  bind('b.reads', m ? `In ${esc(what)} its quote bonded for ${m.reads.bonded} of ${m.reads.there} figures that were there.` : 'Not measured yet.');
  bind('b.board', m ? `In ${esc(what)}: ${m.home} of ${m.problems} came out as they should, ${m.wrong} answers that stand on cited figures were not what the document gives, and ${m.answers.collapsed} answers were labelled stronger than what they stand on.` : 'The result is not measured yet.');
  bind('b.rules', m ? `In ${esc(what)} its formula passed the rule's tests for ${m.rules.bonded} of ${m.rules.asked} rules, and its claim gave the question's own verdict for ${m.claims.matched} of ${m.claims.asked} claims.` : 'Not measured yet.');
  const w = S.data.walk;
  $('walk').innerHTML = w ? `<h3>A simulated buyer walk</h3><p class="small">${esc(w.note)}</p>${w.personas.map((p) => `<details><summary>${esc(p.who)}: ${esc(p.verdict)}</summary><ul>${p.gaps.map((g) => `<li>${esc(g.gap)} → ${esc(g.fix)}</li>`).join('')}</ul></details>`).join('')}` : '';
  return L;
}
// the attacks and what hangs on them: the table of checks, the claims, the attack table. Slow enough (a second or
// two) that the page draws first and this follows; until it has, the page shows what was baked in at build time.
function renderAttack() {
  const { run, what } = shown(), records = recordsOf(run, 'lattice'), tasks = run ? tasksOf(run.set) : [], m = records.length ? COUNTS.measure(records, tasks) : null, dev = tasksOf('dev');
  const steps = askedSteps(records), figures = records.length ? askedFigures(records, tasks) : askedPlaces('dev'), rules = ruled(records, records.length ? tasks : dev), questions = questioned(records, records.length ? tasks : dev);
  const A = attackOf(`${run ? run.set + run.at : 'none'}`, steps, figures, rules, questions), T = teethOf(), cell = (v) => (v === null ? NM : esc(v)), hue = { computed: 'pass', cited: 'soft', executed: 'tested', logical: 'encoded' };
  $('verifierTable').innerHTML = `<table><thead><tr><th>the check</th><th>what it asks, and what it stands on</th><th>what a bond proves</th><th>what it put out</th></tr></thead><tbody>${SET.verifiers({ m, sums: A.sums, cites: A.cites, rules: A.rules, claims: A.claims, sumTeeth: T.sums, citeTeeth: T.cites, ruleTeeth: T.rules, claimTeeth: T.claims }).map((v) => `<tr><td><b>${esc(v.name)}</b><br><span class="small">${esc(v.check)} · <span class="${v.status === 'built' ? 'pass' : 'pend'}">${esc(v.status)}</span></span></td><td>${esc(v.asks)}<br><span class="small">Stands on: ${esc(v.floor)}. When it cannot: ${esc(v.no)}. Attacked by ${esc(v.watcher)}. Its limit: ${esc(v.ends)}.</span></td><td><span class="${hue[v.type]}">${esc(v.strength)}</span></td><td>${v.emits.map((e) => `<span class="small">${esc(e.label)}</span><br><b class="num">${cell(e.value)}</b>`).join('<br>')}</td></tr>`).join('')}</tbody></table><p class="small">${m ? `The model's counts are from ${esc(what)}.` : 'The model\'s counts are not measured until a run is recorded.'} The attacks are worked out on this page each time it loads, on ${records.length ? 'every step, figure, rule and claim that run asked for' : 'what the dev problems ask for'}: ${A.sums.tried + A.cites.tried + A.rules.tried + A.claims.tried} replies, seed ${A.cites.seed}.</p>`;
  // the claims: judged on the published sealed run only
  const sealed = S.data.runs.sealed, sr = recordsOf(sealed, 'lattice'), st = sealed ? tasksOf('sealed') : [], SA = sr.length ? attackOf(`sealed${sealed.at}`, askedSteps(sr), askedFigures(sr, st), ruled(sr, st), questioned(sr, st)) : null;
  const V = CLAIMS.evaluate({ records: sr.length ? sr : null, tasks: st, onetry: sealed ? sealed.onetry : null, fuzz: SA && SA.cites, formulas: SA && SA.rules, logic: SA && SA.claims, teeth: SA && T.cites, formulaTeeth: SA && T.rules, logicTeeth: SA && T.claims });
  const badge = (v) => (v.pass === true ? '<span class="pass">PASS</span>' : v.pass === false ? '<span class="fail">FAIL</span>' : '<span class="pend">NOT MEASURED YET</span>');
  $('claimsTable').innerHTML = `<table><thead><tr><th>claim</th><th>the bar, registered before the run</th><th>on the sealed run</th><th></th></tr></thead><tbody>${V.map((v) => `<tr><td><b>${v.id}</b> ${esc(CLAIMS.NAMES[v.id])}</td><td>${esc(CLAIMS.BARS[v.id])}</td><td>${esc(v.result.replace(/^pending: /, 'Not measured yet: '))}</td><td>${badge(v)}</td></tr>`).join('')}</tbody></table>`;
  $('attackTable').innerHTML = citeAttack(A.cites, T.cites, records.length ? `every figure ${esc(what)} asked for` : 'the figures the dev problems ask for');
  $('ruleAttack').innerHTML = ruleAttack(A.rules, T.rules, records.length ? `every rule ${esc(what)} asked for` : 'the rules the dev problems ask for');
  $('claimAttack').innerHTML = claimAttack(A.claims, T.claims, records.length ? `every claim ${esc(what)} asked for, as the question wrote it and as the model did` : 'the claims the dev problems ask for');
}
// one harness's planted readers: how many it found, and the first reply that gave each away
const plantedTable = (t, what, first) => `<h3>Can the harness find a leak at all?</h3><p>The same harness was turned on ${t.planted} ${what}s that each have one leak planted in them. <b class="${t.caught === t.planted ? 'pass' : 'fail'}">It found ${t.caught} of ${t.planted}.</b>${first}</p><table><thead><tr><th>the planted ${what}</th><th>found</th><th>the first reply that gave it away</th></tr></thead><tbody>${t.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="${r.caught ? 'pass' : 'fail'}">${r.caught ? 'yes' : 'NO'}</td><td>${r.reply === null ? '' : `<code>${esc(JSON.stringify(r.reply))}</code> <span class="small">(${esc(r.way)})</span>`}</td></tr>`).join('')}</tbody></table>`;
const sampleTable = (rows, head) => `<h3>Some of what it tried</h3><table><thead><tr><th>made as</th><th>${head}</th><th>bonded</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.arm === 'forged' ? x.way : x.arm)}</td><td><code>${esc(JSON.stringify(x.reply))}</code></td><td>${x.bond ? 'yes' : 'no'}</td></tr>`).join('')}</tbody></table>`;
const forgedTable = (rows, what, wrong) => `<table><thead><tr><th>how the ${what} was forged</th><th>a bond would be</th><th>tried</th><th>bonded</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.kind === 'unsound' ? wrong : 'outside the allowed form'}</td><td class="num">${r.tried}</td><td class="num${r.bonded ? ' fail' : ''}">${r.bonded}</td></tr>`).join('')}</tbody></table>`;
// the citation check, attacked
function citeAttack(fz, t, on) {
  return `<p>${fz.tried} replies were put to the citation check, on ${fz.places.open} figures that can be cited and ${fz.places.barred} that cannot (${on}, and ${CITEFUZZ.HARD.length} hard cases kept for every attack: a figure with a sign, a leading point, a word like million after it, a range, a label of each kind), from seed ${fz.seed}. <b class="${fz.forged.bonded ? 'fail' : 'pass'}">${fz.forged.bonded} of ${fz.forged.tried} forged quotes bonded.</b> <b class="${fz.honest.refused ? 'fail' : 'pass'}">${fz.honest.refused} of ${fz.honest.tried} honest quotes were refused.</b> <b class="${fz.barred.bonded ? 'fail' : 'pass'}">${fz.barred.bonded} of ${fz.barred.tried} replies bonded where nothing can be cited.</b> The check and the second reader ruled differently on <b class="${fz.split ? 'fail' : 'pass'}">${fz.split}</b> replies, and ${fz.threw} threw. ${fz.noise.bonded} of ${fz.noise.tried} noise replies bonded, each because the noise had left an honest quote: both readers said so.</p>${forgedTable(fz.forged.rows, 'quote', 'a figure cited wrongly')}${fz.found.length ? `<p class="fail">Replies the three opinions did not agree on:</p><ul>${fz.found.map((f) => `<li><code>${esc(f.cell)}</code> ← <code>${esc(JSON.stringify(f.reply))}</code> (${esc(f.way)}): check ${f.bond}, second reader ${f.second}</li>`).join('')}</ul>` : ''}${sampleTable(fz.sample, `the reply, to "${esc(fz.sample.length ? fz.sample[0].cell : '')}"`)}${plantedTable(t, 'reader', ' The first is DocDec\'s own span check, exactly as it shipped.')}`;
}
// the formula check, attacked, with its limit shown
function ruleAttack(fz, t, on) {
  return `<p>${fz.tried} formulas were put to the formula check, on ${fz.places} rules (${on}, and the ${TASKS.RULES.length} rules kept for every attack), from seed ${fz.seed}. <b class="${fz.forged.bonded ? 'fail' : 'pass'}">${fz.forged.bonded} of ${fz.forged.tried} formulas that are a different rule bonded.</b> <b class="${fz.honest.refused ? 'fail' : 'pass'}">${fz.honest.refused} of ${fz.honest.tried} honest formulas were refused.</b> <b class="${fz.weak ? 'fail' : 'pass'}">${fz.weak} near-misses passed a rule's tests.</b> The check and the second runner ruled differently on <b class="${fz.split ? 'fail' : 'pass'}">${fz.split}</b> replies, and ${fz.threw} threw.</p><p><b class="tested">The limit, shown: ${fz.limit.bonded} of ${fz.limit.tried} formulas built from a rule's own tests bonded.</b> Each is the rule plus a product that is nought at every test, so it passes every test and is a different rule everywhere else. That is what "proven against its tests" means, and why it is not "proven".</p>${forgedTable(fz.forged.rows, 'formula', 'a different rule passed')}${fz.found.length ? `<p class="fail">Replies the three opinions did not agree on:</p><ul>${fz.found.map((f) => `<li><code>${esc(f.rule)}</code> ← <code>${esc(JSON.stringify(f.reply))}</code> (${esc(f.way)}): check ${f.bond}, second runner ${f.second}</li>`).join('')}</ul>` : ''}${sampleTable(fz.sample, `the formula, for "${esc(fz.sample.length ? fz.sample[0].rule : '')}"`)}${plantedTable(t, 'runner', '')}`;
}
// the solver, attacked
function claimAttack(fz, t, on) {
  return `<p>${fz.tried} claims were put to the solver, on ${fz.places} questions (${on}, and ${LOGICFUZZ.HARD.length} hard questions kept for every attack: ranges across nought, a quantity that takes away, a division by a range below nought, decimals a float cannot hold), from seed ${fz.seed}. A second procedure, written apart, worked out every corner of every range. <b class="${fz.split ? 'fail' : 'pass'}">They differed on ${fz.split} of ${fz.tried}.</b> Both gave yes ${fz.verdicts.yes} times, no ${fz.verdicts.no}, it depends ${fz.verdicts['it depends']}, and both refused ${fz.refused}; ${fz.threw} threw.</p><table><thead><tr><th>how the claim was made</th><th>both must</th><th>tried</th><th>differed</th></tr></thead><tbody>${fz.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.label === 'decide' ? 'give one verdict' : 'refuse it'}</td><td class="num">${r.tried}</td><td class="num${r.split ? ' fail' : ''}">${r.split}</td></tr>`).join('')}</tbody></table>${fz.found.length ? `<p class="fail">Claims the two did not agree on:</p><ul>${fz.found.map((f) => `<li><code>${esc(JSON.stringify(f.reply))}</code> (${esc(f.way)}): solver ${esc(f.solver)}, second procedure ${esc(f.second)}</li>`).join('')}</ul>` : ''}<h3>Some of what it tried</h3><table><thead><tr><th>made as</th><th>the claim</th><th>verdict</th></tr></thead><tbody>${fz.sample.map((x) => `<tr><td>${esc(x.way)}</td><td><code>${esc(x.reply)}</code></td><td>${x.verdict === null ? 'refused' : esc(x.verdict)}</td></tr>`).join('')}</tbody></table>${plantedTable(t, 'solver', '')}`;
}
const askedPlaces = (set) => tasksOf(set).filter((t) => t.doc).flatMap((t) => t.slots.map((s) => ({ cell: { text: s.text }, doc: t.doc })));

// ── the model in the tab ──
async function device() {
  if (typeof navigator === 'undefined' || !navigator.gpu) { $('device').innerHTML = '<span class="fail">This browser has no WebGPU, so the model cannot run here.</span> The record still plays, and steps 3 to 5 still work.'; return; }
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) throw new Error('no adapter');
    const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {});
    S.gpu = [info.vendor, info.architecture].filter(Boolean).join(' ') || 'WebGPU'; S.canRun = true;
    $('device').innerHTML = `<span class="pass">WebGPU is available</span> (${esc(S.gpu)}).`;
  } catch { $('device').innerHTML = '<span class="fail">WebGPU did not start on this device.</span> The record still plays.'; }
}
async function load(out) {
  if (S.engine) return true;
  if (!S.canRun) { out.innerHTML = '<span class="fail">No WebGPU on this device, so the model cannot run here.</span>'; return false; }
  try {
    const webllm = await import(WEBLLM);
    S.engine = await webllm.CreateMLCEngine(MODEL, { initProgressCallback: (p) => { out.textContent = p.text; } });
    out.textContent = 'The model is loaded and running on this device.';
    return true;
  } catch (e) { out.innerHTML = `<span class="fail">The model did not load:</span> ${esc(e && e.message)}`; return false; }
}
// more.stop ends the reply at a mark (a quote is asked for as one line, and ends at the end of that line)
async function ask(messages, maxTokens, more) {
  const t0 = performance.now(), stop = more && Array.isArray(more.stop) ? { stop: more.stop } : {};
  const r = await S.engine.chat.completions.create({ messages, temperature: 0, max_tokens: maxTokens, ...stop });
  const u = r.usage || {};
  return { text: r.choices[0].message.content || '', ms: performance.now() - t0, prompt: u.prompt_tokens ?? null, reply: u.completion_tokens ?? null };
}
const setBusy = (b) => { S.busy = b; if (S.gem) S.gem.setBusy(b); for (const id of ['grow', 'run']) $(id).disabled = b; };
const growOpts = () => { const st = S.data.settings; return { citeTokens: st.citeTokens, ruleTokens: st.ruleTokens, claimTokens: st.claimTokens, maxTicks: st.maxTicks, maxTokens: st.maxTokens, mem: st.mem, seed: seedFacts() }; };

// grow the sample problems in front of the visitor: each facet on the glass as it sets
async function growLive() {
  if (S.busy || !(await load($('status')))) return;
  setBusy(true);
  const tasks = tasksOf('sample'), seed = seedFacts(), done = [];
  let calls = 0;
  const onEvent = (e, rec) => {
    if (typeof e.said === 'string') calls++;
    show(FACETS.lattice(seed, [...done, rec], tasks), false);
    $('status').textContent = `Live on this device: problem ${done.length + 1} of ${tasks.length}, ${calls} model calls. ${e.stage === 'cite' ? (e.kind === 'dark' ? `${e.cell}: ${e.why}` : `${e.cell} = ${e.value}, quoted from the document (grounded)`) : e.stage === 'rule' ? (e.kind === 'dark' ? `the rule: ${e.why}` : `the rule as a formula: ${e.value}, passed ${e.passed} of ${e.of} tests`) : e.stage === 'claim' ? (e.kind === 'dark' ? `the claim: ${e.why}` : `the claim ${e.claim}: ${e.value}, decided by the solver`) : e.kind === 'bond' ? `${e.cell} = ${e.value} ✓` : e.kind === 'split' ? `${e.cell}: ${e.why || 'met again'}, split` : e.kind === 'dissolve' ? `${e.cell}: ${e.why || 'met again'}, dissolved` : `${e.cell} was already set`}`;
  };
  try {
    const out = await WEAVE.run(tasks, ask, { ...growOpts(), onEvent, onDone: (rec) => { done.push(rec); ledger(COUNTS.measure(done, tasks), FACETS.lattice(seed, done, tasks)); } });
    const m = COUNTS.measure(out.records, tasks), L = FACETS.lattice(seed, out.records, tasks);
    show(L, false); ledger(m, L);
    $('status').innerHTML = `<b>Grown live on this device</b> (${esc(S.gpu || 'WebGPU')}): ${m.home} of ${m.problems} problems came out as they should; ${m.answers.grounded} answers grounded, ${m.answers.proven} proven, ${m.cites.dark} figures could not be cited; ${m.calls} model calls.`;
  } catch (e) { $('status').innerHTML = `<span class="fail">It stopped:</span> ${esc(e && e.message)}`; }
  setBusy(false);
}

// ── the measurement: every problem through the lattice, then one unchecked reply to each, saved as it goes ──
const sealCache = {};
async function sealHash() {
  if (sealCache.v === undefined) { try { const r = await fetch('SEAL.json'); sealCache.v = r.ok ? SHA.sha256((await r.text()).split('\r\n').join('\n')) : ''; } catch { sealCache.v = ''; } }
  return sealCache.v || null;
}
const runKey = (set) => `verifier-set-run-${set}`;
async function runSet({ set = 'sample', ui = true } = {}) {
  const tasks = tasksOf(set), key = runKey(set), seed = seedFacts();
  let R = store.get(key);
  if (!R || R.set !== set || R.complete) R = { v: 'the-verifier-set-run/1', venue: 'tab (WebLLM 0.2.79, WebGPU)', model: MODEL, gpu: S.gpu, ua: navigator.userAgent, set, sealSha256: await sealHash(), at: new Date().toISOString(), seconds: 0, segments: 0, privacy: { requests: 0 }, lattice: { records: [], seeds: 0, memory: null, cited: 0 }, onetry: { records: [] }, complete: false };
  R.segments++;
  if (ui) { S.local = R; S.view = 'mine'; }
  const before = performance.getEntriesByType('resource').length, baseReq = R.privacy.requests || 0, t0 = Date.now(), base = R.seconds, total = tasks.length * 2;
  const note = async (part) => {
    R.seconds = base + Math.round((Date.now() - t0) / 1000); R.privacy = { requests: baseReq + performance.getEntriesByType('resource').length - before }; store.set(key, R);
    const n = R.lattice.records.length + R.onetry.records.length;
    if (ui) { $('runOut').textContent = `${n} of ${total} (${part}) · ${R.seconds} s`; if (n % 4 === 0) show(FACETS.lattice(seed, R.lattice.records, tasks), false); }
  };
  if (!covers(R, 'lattice', tasks)) {
    const done = R.lattice.records.slice();
    R.lattice.records = done;
    const out = await WEAVE.run(tasks, ask, { ...growOpts(), done, onDone: async (rec) => { R.lattice.records.push(rec); await note('the lattice'); } });
    R.lattice = { records: out.records, seeds: out.seeds, memory: out.memory, cited: out.cited };
  }
  if (!covers(R, 'onetry', tasks)) {
    const done = R.onetry.records.slice();
    R.onetry.records = done;
    const out = await ONETRY.run(tasks, ask, { done, onDone: async (rec) => { R.onetry.records.push(rec); await note('one unchecked reply'); } });
    R.onetry = { records: out.records };
  }
  R.complete = covers(R, 'lattice', tasks) && covers(R, 'onetry', tasks);
  await note('done');
  return R;
}
async function runUI() {
  if (S.busy || !(await load($('runOut')))) return;
  setBusy(true);
  try {
    const R = await runSet({ set: $('runWhich').value || 'sample', ui: true });
    window.__verifierRun = R;
    show(render(), true); renderAttack();
    $('runOut').innerHTML = `<b>Done</b> in ${R.segments} sitting${R.segments === 1 ? '' : 's'}, ${R.seconds} s; ${R.privacy.requests} network requests while it ran. The page now shows this device's numbers.`;
    $('save').disabled = false;
  } catch (e) { $('runOut').innerHTML = `<span class="fail">It stopped:</span> ${esc(e && e.message)}. Press Run it to carry on from where it saved.`; }
  setBusy(false);
}
function save() {
  if (!S.local) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.local)], { type: 'application/json' }));
  a.download = `the-verifier-set-${S.local.set}-${String(S.local.at).slice(0, 10)}.json`;
  a.click();
}
// the published run, grown again from its recorded replies with no model
async function rejudge() {
  const { run, what } = shown();
  if (!run) { $('rejudgeOut').innerHTML = NM; return; }
  const tasks = tasksOf(run.set), again = await WEAVE.replay(tasks, recordsOf(run, 'lattice'), growOpts()), one = await ONETRY.replay(tasks, recordsOf(run, 'onetry'));
  const same = again.records.filter((r, i) => JSON.stringify(r) === JSON.stringify(run.lattice.records[i])).length, n = run.lattice.records.length, same1 = one.records.filter((r, i) => JSON.stringify(r) === JSON.stringify(run.onetry.records[i])).length;
  $('rejudgeOut').innerHTML = `${same} of ${n} problems of ${esc(what)} came out identically ${same === n ? '<span class="pass">✓</span>' : '<span class="fail">✗</span>'}, and ${same1} of ${run.onetry.records.length} unchecked replies were ruled on the same way. Both checks, the splitter, the memory and the strength law ran for real; only the model's replies came from the record.`;
}
// a new attack each press: the same places, a seed taken from the clock, so it is not the attack the page was built with
function attackUI() {
  const { run, what } = shown(), records = recordsOf(run, 'lattice'), tasks = run ? tasksOf(run.set) : [], dev = tasksOf('dev'), steps = askedSteps(records), figures = records.length ? askedFigures(records, tasks) : askedPlaces('dev'), seed = Date.now() % 4294967296, o = opts();
  const A = FUZZ.fuzz(steps.length ? steps : FUZZ.EVERY, { ...o.sums, seed }), B = CITEFUZZ.fuzz([...CITEFUZZ.HARD, ...figures], { ...o.cites, seed }), Rf = FORMULAFUZZ.fuzz([...TASKS.RULES, ...ruled(records, records.length ? tasks : dev)], { ...o.rules, seed }), Lf = LOGICFUZZ.fuzz([...LOGICFUZZ.HARD, ...questioned(records, records.length ? tasks : dev)], { ...o.claims, seed, random: 40 });
  const bad = A.forged.bonded + B.forged.bonded + B.barred.bonded + Rf.forged.bonded, refused = A.honest.refused + B.honest.refused + Rf.honest.refused, split = A.split + B.split + Rf.split + Lf.split + Rf.weak, first = [...B.found.map((f) => `${f.cell} ← ${JSON.stringify(f.reply)}`), ...Rf.found.map((f) => `${f.rule} ← ${JSON.stringify(f.reply)}`), ...Lf.found.map((f) => JSON.stringify(f.reply))][0];
  $('attackOut').innerHTML = `Seed ${B.seed}, made just now${records.length ? `, on what ${esc(what)} asked for` : ''}: ${A.tried} replies to the arithmetic check, ${B.tried} to the citation check, ${Rf.tried} to the formula check and ${Lf.tried} claims to the solver (${Lf.places - LOGICFUZZ.HARD.length - questioned(records, records.length ? tasks : dev).length} of its questions made at random). <span class="${bad ? 'fail' : 'pass'}">${bad} forged replies bonded</span>; <span class="${refused ? 'fail' : 'pass'}">${refused} honest replies refused</span>; the two readers of each check differed on <span class="${split ? 'fail' : 'pass'}">${split}</span>; ${A.threw + B.threw + Rf.threw + Lf.threw} threw. ${Rf.limit.bonded} formulas built from their rule's tests bonded: the limit.${first ? ` First disagreement: ${esc(first)}.` : ''}`;
}
// the citation check on the visitor's own document: they play the model
function tryIt() {
  const doc = { id: 'yours', text: $('tryDoc').value }, cell = { text: $('tryCell').value }, j = CITE.judge($('tryQuote').value, cell, doc), s = CITE.stated(cell, doc), second = CITEFUZZ.plainly($('tryQuote').value, cell, doc);
  const says = s.figure === null ? ` The document itself cannot give this figure: ${esc(s.why)}.` : ` The document gives it once, as ${esc(s.figure.text)}.`;
  $('tryOut').innerHTML = j.value !== null
    ? `<span class="soft">Bonded: grounded.</span> The figure is ${esc(EXACT.show(j.value))}, read from characters ${j.source.start} to ${j.source.end} of your document: “${esc(j.source.text)}”. It is as true as your document, and no truer. The second reader agrees: ${second ? 'yes' : '<span class="fail">NO</span>'}.`
    : `<span class="fail">Not bonded:</span> ${esc(j.why)}.${says} The second reader agrees: ${second ? '<span class="fail">NO</span>' : 'yes'}.`;
}

// ── start ──
const ready = (async function start() {
  const [settings, published, gates, provenance] = await Promise.all(['data/settings.json', 'data/published.json', 'data/gates.json', 'vendor/PROVENANCE.json'].map(getJSON));
  const P = published || {}, runs = {};
  for (const k of ['sealed', 'dev']) runs[k] = P[k] ? await getJSON(P[k]) : null;
  S.data = { settings: settings || { ...WEAVE.SETTINGS, mem: {}, sets: {}, fuzz: {} }, runs, gates, provenance, seed: P.seed ? await getJSON(P.seed) : null, bench: P.bench ? await getJSON(P.bench) : null, baseline: P.baseline ? await getJSON(P.baseline) : null, walk: P.walk ? await getJSON(P.walk) : null, seal: await sealHash() };
  const saved = store.get(runKey('sealed')) || store.get(runKey('dev')) || store.get(runKey('sample'));
  S.local = saved && saved.lattice ? saved : null;
  const canvas = $('gem');
  try { S.gem = typeof canvas.getContext === 'function' ? GEM.createGem(canvas) : null; } catch (e) { S.gem = null; $('status').innerHTML = `<span class="fail">The glass could not start on this device (${esc(e && e.message)}).</span> The numbers below still read.`; }
  show(render(), false);
  play();
  $('grow').addEventListener('click', growLive);
  $('play').addEventListener('click', () => { show(render(), false); play(); });
  $('run').addEventListener('click', runUI);
  $('save').addEventListener('click', save);
  $('rejudge').addEventListener('click', rejudge);
  $('attack').addEventListener('click', attackUI);
  $('try').addEventListener('click', tryIt);
  $('scrub').addEventListener('input', (e) => { S.scrubbing = true; if (S.L) { S.target = S.time = (S.L.span * Number(e.target.value)) / 1000 + (e.target.value === '1000' ? 2 : 0); if (S.gem) S.gem.setTime(S.time); } });
  $('scrub').addEventListener('change', () => { S.scrubbing = false; });
  canvas.addEventListener('pointermove', tip);
  canvas.addEventListener('pointerleave', () => { $('tip').style.transform = 'translate(-999px,-999px)'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !S.busy && !(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(e.target.tagName))) growLive(); });
  tick();
  device();
  if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof location !== 'undefined' && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // the attacks follow the first paint
  await new Promise((r) => setTimeout(r, 30));
  renderAttack();
})();
window.__verifier = { ready, S, runSet, load, render, renderAttack, show, play, rejudge, attackUI, tryIt, tasksOf };
