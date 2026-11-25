// house-app.js — the house layer. It adds nothing to what this build proves: it waits for the page script above to
// finish, reads what that script worked out from the sealed run (with the house's receipts reader, vendored), and
// shows it as receipts, a claim stack and a crystal whose lit faces are this build's claims.
window.__houseLayer = (async () => {
  await window.__verifier.ready;
  const KEYS = {"ids":["status","verifierTable","claimsTable","reads","attackTable","ruleAttack","claimAttack","cost","walk"],"binds":["n.cited","n.proven","n.grounded","n.tested","n.encoded","n.refused","n.home","h.none","h.seed","h.law","h.source","l.misstated","bp.seed","bp.strength","bp.cite","bp.ways","bp.citefuzz","bp.formula","bp.ruleways","bp.formulafuzz","bp.logic","bp.claimways","bp.logicfuzz","bp.weave","bp.facets","bp.counts","b.what","b.cost","b.versus","b.refused","b.rules","b.reads","b.board"]};
  const el = (id) => document.getElementById(id), safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const drawn = [...KEYS.ids.map((id) => el(id)), ...KEYS.binds.flatMap((k) => [...document.querySelectorAll(`[data-bind="${k}"]`)])].map((e) => (e && typeof e.innerHTML === 'string' ? e.innerHTML : '')).join(' ');
  const html = `<body>${drawn}</body>`, claims = RECEIPTS.claims(html), head = RECEIPTS.headline('the-verifier-set', html), more = RECEIPTS.extra('the-verifier-set', html);
  const src = '<a class="src" href="data/runs/sealed.json">receipt: the sealed run ↗</a>', passed = claims.filter((c) => c.pass === true).length, failed = claims.filter((c) => c.pass === false);
  const stats = [];
  if (head) stats.push(`<div class="stat reveal"><div class="n"><span class="was">${safe(head.was)}</span><span class="arrow">→</span><span class="now">${safe(head.now)}</span></div><div class="lab"><b>Of ${head.of} sealed problems.</b> ${safe(head.label[0].toUpperCase() + head.label.slice(1))}.</div>${src}</div>`);
  for (const x of more) stats.push(`<div class="stat reveal"><div class="n">${x.after !== undefined ? `<span class="was">${safe(x.value)}</span><span class="arrow">→</span><span class="now">${safe(x.after)}</span>` : `<span class="now">${safe(x.value)}</span><span class="was" style="font-size:.42em"> /${x.of.toLocaleString('en')}</span>`}</div><div class="lab"><b>${safe(x.label[0].toUpperCase() + x.label.slice(1))}.</b> Of ${x.of.toLocaleString('en')}.</div>${src}</div>`);
  if (claims.length) stats.push(`<div class="stat reveal"><div class="n"><span class="now">${passed}</span><span class="was" style="font-size:.42em"> /${claims.length}</span>${failed.length ? ` <span class="bad" style="font-size:.5em">−${failed.length}</span>` : ''}</div><div class="lab"><b>Pre-registered claims passed.</b> ${failed.length ? `${failed.map((c) => c.id).join(', ')} failed and ${failed.length === 1 ? 'is' : 'are'} kept on the page, in red.` : 'A claim that fails stays on the page, in red.'}</div>${src}</div>`);
  el('hsReceipts').innerHTML = stats.join('') || '<div class="stat"><div class="n"><span class="wait">—</span></div><div class="lab">The sealed run. <span class="tag gd">sealing now</span></div></div>';
  el('hsClaims').innerHTML = claims.map((c) => `<div class="srow ${c.pass === false ? 'red' : c.pass === null ? 'gold' : ''}"><div class="d">${c.id}</div><div class="nm"><b>${safe(c.name)}</b><span>${safe(c.result)}</span>${c.pass === true ? '<span class="tag cy">pass</span>' : c.pass === false ? '<span class="tag rd">fail · kept</span>' : '<span class="tag gd">sealing now</span>'}</div></div>`).join('') || '<div class="srow gold"><div class="d">—</div><div class="nm"><span>the sealed run is not published yet</span><span class="tag gd">sealing now</span></div></div>';
  const rest = `${passed} of ${claims.length} claims passed${failed.length ? ` · ${failed.length} failed and kept` : ''} · point at a face`;
  el('hsFacet').innerHTML = rest;
  const crystal = CRYSTAL.mount(el('crystal'), { energy: 0.9 });
  if (crystal) {
    crystal.setFaces(Array.from({ length: 32 }, (_, i) => (claims[i] ? (claims[i].pass === true ? 1 : claims[i].pass === false ? 3 : 2) : 0)));
    crystal.onHover((i) => { const c = claims[i]; el('hsFacet').innerHTML = c ? `<b>${c.id} ${safe(c.name)}</b> · ${c.pass === true ? 'pass' : c.pass === false ? 'FAIL, kept' : 'sealing now'} · ${safe(c.result)}` : rest; });
    crystal.onPick(() => { const s = el('claims'); if (s && s.scrollIntoView) s.scrollIntoView({ behavior: 'smooth' }); });
    HOUSE.bindScroll(crystal, 0.9);
  }
  HOUSE.reveal(document); HOUSE.light(document);
})();
