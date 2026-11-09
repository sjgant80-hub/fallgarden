// fallgarden · live/kernel.mjs — FALLGARDEN LIVE's law (2026-11-09). One engine for three views, built ON FallGarden:
// its node/link model and its force physics (PHYS = the constants of index.html's runGraphSim, reused, not rebuilt).
//   · YOUR ESTATE  eventsFromEstate(snapshot): a replay of public records only; every node a repo, every edge a link
//   · GROW         growFromSeed(seed, snapshot): fall-core germinates, the estate's layers bud in a seeded order, and the
//                  library grows night by night through the REAL pattern-library gate (vendor/patlib.mjs) on public data
//   · YOUR BUILD   simulate(process, seed): a client's described process grown by the same rules, every piece marked
//                  'simulation', under BANNER
// The state and its hash are pure and deterministic: same records / seed / process → same hash (claims G1-G3). Positions
// are never hashed (a GPU lays them out); the hash is the structure: nodes, edges, stages, library. Total: garbage never
// throws. Sealed before any code: live/CLAIMS.md (6969582).
import P from './vendor/patlib.mjs';

export const STAGES = Object.freeze(['shadow', 'draft', 'assist', 'autonomous']);
export const SIM = 'simulation';
export const BANNER = 'Simulation of how your build would run, from your described process. Not yet built.';
export const PHYS = Object.freeze({ repel: 3000, rest: 60, spring: 0.03, center: 0.002, damp: 0.85 });
export const NIGHTS = 6;
export const KINDS = Object.freeze(['germinate', 'born', 'layer', 'link', 'receipt', 'ci', 'pass', 'drop', 'stage', 'flow']);

const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// ── hashing: two FNV-1a passes with different offsets, 16 hex ───────────────────────────────────────────────────────
export function hash64(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (const ch of str(s)) {
    const c = ch.charCodeAt(0);
    a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
    b ^= c; b = Math.imul(b, 0x01000193) >>> 0; b ^= b >>> 15;
  }
  return a.toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function mulberry32(seed) {
  let t = Number.isSafeInteger(seed) ? seed >>> 0 : 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(list, rng) {
  const a = arr(list).slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// ── the state ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function emptyState() { return { nodes: new Map(), edges: new Map(), library: { kept: [], dropped: [] }, applied: 0, ignored: 0 }; }
export function edgeKey(a, b) { return [str(a), str(b)].sort().join('|'); }
function addEdge(s, a, b, sim) {
  if (!s.nodes.has(a) || !s.nodes.has(b) || a === b) return false;
  const k = edgeKey(a, b);
  if (!s.edges.has(k)) s.edges.set(k, { a: k.split('|')[0], b: k.split('|')[1], pulses: 0, sim: !!sim });
  return true;
}

/** apply(state, event) → the state, changed by one real event (unknown or dangling events are counted, never drawn). */
export function apply(s, ev) {
  if (!isObj(s) || !(s.nodes instanceof Map)) return s;
  const e = isObj(ev) ? ev : {};
  const sim = e.sim === true;
  let ok = true;
  if (e.t === 'germinate' || e.t === 'born' || e.t === 'layer') {
    if (!str(e.id)) ok = false;
    else {
      if (!s.nodes.has(e.id)) s.nodes.set(e.id, { id: e.id, label: str(e.label) || e.id, kind: e.t === 'germinate' ? 'core' : e.t === 'layer' ? 'layer' : str(e.kind) || 'repo',
        fam: str(e.fam), live: e.live === true, ci: null, stage: e.t === 'born' && e.kind === 'organ' ? STAGES[0] : null, receipts: 0, sim });
      for (const k of arr(e.keys)) addEdge(s, e.id, k, sim);
      if (str(e.layer)) addEdge(s, e.id, e.layer, sim);
      if (str(e.to)) addEdge(s, e.id, e.to, sim);
    }
  } else if (e.t === 'link') ok = addEdge(s, e.a, e.b, sim);
  else if (e.t === 'flow') { ok = addEdge(s, e.a, e.b, sim); if (ok) s.edges.get(edgeKey(e.a, e.b)).pulses++; }
  else if (e.t === 'receipt') { const n = s.nodes.get(e.id); if (n) n.receipts++; else ok = false; }
  else if (e.t === 'ci') { const n = s.nodes.get(e.id); if (n) n.ci = e.ok === true ? 'green' : 'red'; else ok = false; }
  else if (e.t === 'stage') { const n = s.nodes.get(e.id); if (n && STAGES.includes(e.stage)) n.stage = e.stage; else ok = false; }
  else if (e.t === 'pass') { if (str(e.rule)) s.library.kept.push(e.rule); else ok = false; }
  else if (e.t === 'drop') { if (str(e.rule)) s.library.dropped.push(e.rule); else ok = false; }
  else ok = false;
  if (ok) s.applied++; else s.ignored++;
  return s;
}
export function replay(events, upto) {
  const s = emptyState();
  const list = arr(events);
  const n = Number.isSafeInteger(upto) ? Math.max(0, Math.min(upto, list.length)) : list.length;
  for (let i = 0; i < n; i++) apply(s, list[i]);
  return s;
}
/** hashState(state) → 16 hex over the structure only (never positions). */
export function hashState(s) {
  if (!isObj(s) || !(s.nodes instanceof Map)) return hash64('');
  // each node as its own JSON line, sorted by the default string order: unique ids, so no comparator to get wrong
  const nodes = [...s.nodes.values()].map((n) => JSON.stringify([n.id, n.kind, n.fam, n.ci, n.stage, n.live, n.sim])).sort();
  const edges = [...s.edges.keys()].sort();
  return hash64(P.canon({ nodes, edges, kept: s.library.kept, dropped: s.library.dropped.length }));
}

// ── YOUR ESTATE: the replay of public records ────────────────────────────────────────────────────────────────────────
const RANK = Object.fromEntries(KINDS.map((k, i) => [k, i]));
// by time, then kind in KINDS order, then name, then input order: one key per event and the default string sort (the
// separator  sorts below every printable character, so the key order is exactly that order)
export function sortEvents(events) {
  const list = arr(events).filter(isObj);
  const byKey = new Map(list.map((e, i) => [[str(e.at), String(RANK[e.t]), str(e.id || e.a || e.rule), String(i).padStart(9, '0')].join(''), e]));
  return [...byKey.keys()].sort().map((k) => byKey.get(k));
}
/** linkPairs(names, linksOf) → every coupling between two of the names once, as [a, b] with a before b, sorted. */
export function linkPairs(names, linksOf) {
  const set = new Set(arr(names));
  const pairs = new Set();
  for (const a of set) for (const b of arr(linksOf instanceof Map ? linksOf.get(a) : null)) if (set.has(b) && b !== a) pairs.add([a, b].sort().join(''));
  return [...pairs].sort().map((p) => p.split(''));
}
export function eventsFromEstate(snap) {
  const S = isObj(snap) ? snap : {};
  const repos = arr(S.repos).filter((r) => isObj(r) && str(r.n));
  const born = new Map(repos.map((r) => [r.n, str(r.created)]));
  const layerOf = new Map();
  for (const l of arr(S.layers)) for (const k of arr(l && l.keyRepos)) if (!layerOf.has(k)) layerOf.set(k, 'layer:' + l.name);
  const ev = [];
  for (const r of repos) ev.push({ t: 'born', at: born.get(r.n), id: r.n, label: r.n, kind: 'repo', fam: str(r.fam), live: r.live === true, layer: layerOf.get(r.n) || '' });
  for (const l of arr(S.layers)) {
    const keys = arr(l && l.keyRepos).filter((k) => born.has(k));
    if (!keys.length) continue;
    const first = keys.map((k) => born.get(k)).sort()[0];
    ev.push({ t: 'layer', at: first, id: 'layer:' + l.name, label: l.name, keys });
  }
  for (const [a, b] of linkPairs(repos.map((r) => r.n), new Map(repos.map((r) => [r.n, arr(r.links)])))) ev.push({ t: 'link', at: [born.get(a), born.get(b)].sort()[1], a, b });
  const at0 = str(S.generatedAt);
  for (const rc of arr(S.receipts)) if (isObj(rc) && born.has('liveware')) ev.push({ t: 'receipt', at: at0, id: 'liveware', receipt: str(rc.id), test: str(rc.test) });
  for (const c of arr(S.ci)) if (isObj(c) && born.has(c.n)) ev.push({ t: 'ci', at: str(c.at), id: c.n, ok: c.ok === true });
  const nights = arr(S.nights).filter(isObj);
  if (nights.length) ev.push({ t: 'born', at: str(nights[0].at), id: 'pattern-library', label: 'pattern library', kind: 'library', fam: 'kar-body' });
  for (const n of nights) {
    for (const k of arr(n.kept)) ev.push({ t: 'pass', at: str(n.at), rule: str(k && k.rule) });
    for (const d of arr(n.dropped)) ev.push({ t: 'drop', at: str(n.at), rule: str(d && d.rule), why: str(d && d.why) });
  }
  return sortEvents(ev);
}
/** audit(snap, events) → G4: every node a snapshot repo (or a layer / the library), every link a snapshot link. */
export function auditEstate(snap, events) {
  const repos = new Map(arr(isObj(snap) ? snap.repos : []).filter((r) => isObj(r) && str(r.n)).map((r) => [r.n, r]));
  const layers = new Set(arr(isObj(snap) ? snap.layers : []).map((l) => 'layer:' + str(l && l.name)));
  const bad = [];
  for (const e of arr(events).filter(isObj)) {
    if (e.t === 'born' && !repos.has(e.id) && e.id !== 'pattern-library') bad.push('node ' + e.id);
    if (e.t === 'layer' && !layers.has(e.id)) bad.push('layer ' + e.id);
    if (e.t === 'link') { const a = repos.get(e.a), b = repos.get(e.b); if (!a || !b || !(arr(a.links).includes(e.b) || arr(b.links).includes(e.a))) bad.push('link ' + e.a + '|' + e.b); }
  }
  return { ok: bad.length === 0, bad };
}

// ── the night: the real pattern-library gate on a sample of cases ───────────────────────────────────────────────────
// the in-browser proposer (no model in a visitor's tab): the k most precise single words per family (patlib.mine), and
// pairs of the family's 8 most frequent words. It only PROPOSES; patlib.gate decides, exactly as on Kar's machine.
export const PROPOSE_K = 12;
export function pairsFor(train, label, k) {
  const tok = new Map();
  for (const c of arr(train)) if (isObj(c) && c.label === label) for (const t of arr(c.tokens)) tok.set(t, (tok.get(t) || 0) + 1);
  const top = [...tok].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map((x) => x[0]);
  const out = [];
  top.forEach((x, i) => top.slice(i + 1).forEach((y) => out.push({ when: [x, y], then: label })));
  return out.slice(0, Math.max(0, k));
}
export function nightOf(cases, labels, library, k = PROPOSE_K, tried = new Set()) {
  const train = P.split(cases).train;
  const proposals = [];
  const prov = { source: 'mined', model: 'none', proposedAt: 'grow', feed: 'estate', trainN: train.length };
  const skip = tried instanceof Set ? tried : new Set();
  for (const l of arr(labels)) for (const r of [...P.mine(train, l, k), ...pairsFor(train, l, k)]) if (!skip.has(P.ruleKey(r))) proposals.push({ ...r, prov });
  return P.night(cases, proposals, library);
}
export function stagesFor(organs, kept) {
  const out = [];
  for (const o of organs) {
    const n = arr(kept).filter((r) => o.fams.includes(r.then)).length;
    out.push({ id: o.id, stage: STAGES[Math.min(STAGES.length - 1, n)] });
  }
  return out;
}

// ── GROW: the Living Company from one seed ──────────────────────────────────────────────────────────────────────────
export function growFromSeed(seed, snap, nights = NIGHTS) {
  const rng = mulberry32(seed);
  const S = isObj(snap) ? snap : {};
  const repos = arr(S.repos).filter((r) => isObj(r) && str(r.n));
  const famOf = new Map(repos.map((r) => [r.n, str(r.fam)]));
  const linksOf = new Map(repos.map((r) => [r.n, arr(r.links)]));
  const ev = [];
  let t = 0;
  const at = () => 'g' + String(t++).padStart(6, '0');
  ev.push({ t: 'germinate', at: at(), id: 'fall-core', label: 'fall-core' });
  for (const [id, label, to] of [['kar', 'Kar · the conductor', 'fall-core'], ['gate', 'the gate', 'kar'], ['library', 'the pattern library', 'gate'], ['auditor', 'the Auditor', 'gate']]) ev.push({ t: 'born', at: at(), id, label, kind: 'organ', to });
  const organs = [];
  const chosen = new Set();
  for (const l of shuffle(arr(S.layers).filter((x) => isObj(x) && arr(x.keyRepos).length), rng)) {
    const id = 'layer:' + l.name;
    const keys = shuffle(arr(l.keyRepos).filter((k) => famOf.has(k)), rng).slice(0, 5);
    organs.push({ id, fams: [...new Set(keys.map((k) => famOf.get(k)))] });
    ev.push({ t: 'born', at: at(), id, label: l.name, kind: 'organ', to: 'fall-core' });
    ev.push({ t: 'flow', at: at(), a: 'kar', b: id });
    for (const k of keys) { ev.push({ t: 'born', at: at(), id: k, label: k, kind: 'repo', fam: famOf.get(k), layer: id }); chosen.add(k); }
  }
  for (const [a, b] of linkPairs([...chosen], linksOf)) ev.push({ t: 'link', at: at(), a, b });
  let library = [];
  const detail = [];
  const tried = new Set();
  const labels = [...new Set(repos.map((r) => str(r.fam)))].sort();
  const n = Number.isSafeInteger(nights) ? Math.max(0, Math.min(nights, 30)) : NIGHTS;
  let prevStage = new Map();
  for (let night = 0; night < n; night++) {
    const sample = shuffle(repos, rng).slice(0, Math.floor(repos.length * 0.85));
    const cases = sample.map((r) => P.makeCase({ id: r.n, text: [r.n.replace(/[-_.]/g, ' '), str(r.desc), arr(r.topics).join(' ')].join(' '), label: r.fam })).filter(Boolean);
    const covered = new Set(library.map((r) => r.then));
    const targets = labels.filter((l) => !covered.has(l));
    const run = nightOf(cases, targets, library, PROPOSE_K, tried);
    for (const d of run.dropped) tried.add(d.rule);
    detail.push({ night, ids: cases.map((c) => c.id), targets, kept: run.promoted.map(P.ruleKey), dropped: run.dropped.map((d) => d.rule) });
    ev.push({ t: 'flow', at: at(), a: 'kar', b: 'gate' });
    for (const r of run.promoted) { ev.push({ t: 'pass', at: at(), rule: P.ruleKey(r) }); ev.push({ t: 'flow', at: at(), a: 'gate', b: 'library' }); }
    for (const d of run.dropped) ev.push({ t: 'drop', at: at(), rule: d.rule, why: d.why });
    library = run.library;
    for (const s of stagesFor(organs, library)) if (prevStage.get(s.id) !== s.stage) { ev.push({ t: 'stage', at: at(), id: s.id, stage: s.stage }); prevStage.set(s.id, s.stage); }
  }
  return { events: ev, library, detail };
}

// ── YOUR BUILD: a client's process, simulated ───────────────────────────────────────────────────────────────────────
export function validProcess(p) {
  return isObj(p) && str(p.company) !== '' && arr(p.steps).length >= 1 && arr(p.steps).every((s) => isObj(s) && str(s.name));
}
export function simulate(proc, seed, nights = 3) {
  if (!validProcess(proc)) return { ok: false, why: 'a process needs a company name and at least one named step', events: [] };
  const rng = mulberry32(seed);
  const ev = [];
  let t = 0;
  const at = () => 's' + String(t++).padStart(6, '0');
  const sim = true;
  ev.push({ t: 'germinate', at: at(), id: 'their-core', label: proc.company + ' · core', sim });
  for (const [id, label, to] of [['their-kar', 'conductor', 'their-core'], ['their-gate', 'their gate', 'their-kar'], ['their-library', 'their library', 'their-gate'], ['their-auditor', 'auditor', 'their-gate']]) ev.push({ t: 'born', at: at(), id, label, kind: 'organ', to, sim });
  const steps = arr(proc.steps);
  const organs = [];
  steps.forEach((s, i) => {
    const id = 'step:' + i;
    ev.push({ t: 'born', at: at(), id, label: s.name + (str(s.who) ? ' · ' + s.who : ''), kind: 'organ', to: i === 0 ? 'their-core' : 'step:' + (i - 1), sim });
    if (arr(s.decides).length) { ev.push({ t: 'link', at: at(), a: id, b: 'their-gate', sim }); organs.push({ id, fams: arr(s.decides).map(str) }); }
  });
  const ex = arr(proc.examples).filter((x) => isObj(x) && str(x.text) && str(x.label));
  const labels = [...new Set(organs.flatMap((o) => o.fams))].sort();
  let library = [];
  const tried = new Set();
  const n = Number.isSafeInteger(nights) ? Math.max(0, Math.min(nights, 10)) : 3;
  const prev = new Map();
  for (let night = 0; night < n; night++) {
    for (let i = 1; i < steps.length; i++) ev.push({ t: 'flow', at: at(), a: 'step:' + (i - 1), b: 'step:' + i, sim });
    const cases = shuffle(ex, rng).map((x) => P.makeCase({ id: 'ex:' + ex.indexOf(x), text: x.text, label: x.label })).filter(Boolean);
    const covered = new Set(library.map((r) => r.then));
    const run = nightOf(cases, labels.filter((l) => !covered.has(l)), library, PROPOSE_K, tried);
    for (const d of run.dropped) tried.add(d.rule);
    for (const r of run.promoted) { ev.push({ t: 'pass', at: at(), rule: P.ruleKey(r), sim }); ev.push({ t: 'flow', at: at(), a: 'their-gate', b: 'their-library', sim }); }
    for (const d of run.dropped) ev.push({ t: 'drop', at: at(), rule: d.rule, why: d.why, sim });
    library = run.library;
    for (const s of stagesFor(organs, library)) if (prev.get(s.id) !== s.stage) { ev.push({ t: 'stage', at: at(), id: s.id, stage: s.stage, sim }); prev.set(s.id, s.stage); }
  }
  return { ok: true, banner: BANNER, events: ev, library, examples: ex.length };
}

// ── the LIGHT stream: each event's packet, and what it says in plain words ──────────────────────────────────────────
export function packetOf(e) {
  if (!isObj(e) || !KINDS.includes(e.t)) return null;
  const p = { k: e.t };
  for (const f of ['id', 'a', 'b', 'fam', 'rule', 'why', 'stage', 'receipt', 'test', 'to', 'layer']) if (str(e[f])) p[f] = e[f];
  if (e.t === 'ci') p.ok = e.ok === true;
  if (e.sim === true) p.sim = 1;
  return p;
}
export function say(p) {
  if (!isObj(p)) return '';
  const tag = p.sim === 1 ? ' (simulation)' : '';
  const s = {
    germinate: () => p.id + ' germinates: the first cell',
    born: () => p.id + ' is built' + (p.fam ? ', in the ' + p.fam + ' family' : '') + (p.to ? ', growing from ' + p.to : '') + (p.layer ? ', part of ' + p.layer.replace(/^layer:/, '') : ''),
    layer: () => p.id.replace(/^layer:/, '') + ' forms, a layer of the estate',
    link: () => p.a + ' and ' + p.b + ' are coupled',
    flow: () => p.a + ' hands work to ' + p.b,
    receipt: () => p.id + ' publishes a receipt' + (p.test ? ' for ' + p.test : '') + (p.receipt ? ' (' + p.receipt + ')' : ''),
    ci: () => p.id + "'s checks on GitHub's runner: " + (p.ok ? 'green' : 'red'),
    pass: () => 'the gate keeps a rule: ' + p.rule,
    drop: () => 'the gate drops a rule: ' + p.rule + (p.why ? ', because ' + p.why : ''),
    stage: () => p.id + ' climbs to ' + p.stage,
  }[p.k];
  return s ? s() + tag : '';
}

// ── layout: FallGarden's own physics (the 2D fallback runs this; the WebGPU shader runs the same constants) ────────
export function layoutStep(nodes, links, W, H) {
  const ns = arr(nodes), ls = arr(links).filter(isObj);
  if (!ns.every(isObj)) return ns;
  ns.forEach((a, i) => {
    for (let j = i + 1; j < ns.length; j++) {
      const b = ns[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2), rep = PHYS.repel / d2;
      const rx = (dx / d) * rep, ry = (dy / d) * rep;
      a.vx -= rx; a.vy -= ry; b.vx += rx; b.vy += ry;
    }
  });
  for (const l of ls) {
    const a = ns[l.source], b = ns[l.target];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01, f = (d - PHYS.rest) * PHYS.spring;
    a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
  }
  for (const n of ns) {
    n.vx += (W / 2 - n.x) * PHYS.center; n.vy += (H / 2 - n.y) * PHYS.center;
    n.vx *= PHYS.damp; n.vy *= PHYS.damp; n.x += n.vx; n.y += n.vy;
  }
  return ns;
}

export default { STAGES, SIM, BANNER, PHYS, NIGHTS, KINDS, hash64, mulberry32, shuffle, emptyState, edgeKey, apply, replay, hashState, sortEvents, linkPairs,
  eventsFromEstate, auditEstate, PROPOSE_K, pairsFor, nightOf, stagesFor, growFromSeed, validProcess, simulate, packetOf, say, layoutStep };
