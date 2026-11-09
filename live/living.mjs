// fallgarden · live/living.mjs — THE LIVING VISUAL's law (2026-11-09). What each real event makes the organism do, the
// character of each organ, how deep each cell sits, how many motes the library holds, and the only two things that move
// without an event: the breath (a slow wave from the heart) and the tide (a slow current that keeps the layout from
// freezing). Pure and total: garbage never throws. The renderer (organism.mjs) draws what this decides and nothing else.
// Claims: live/CLAIMS-living.md (sealed 083f92b). Vendored byte for byte into the private live view.

const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const fnv = (s) => { let h = 0x811c9dc5; const t = str(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const unit = (h) => (h & 0xffff) / 0xffff;

// ── the motion without an event (U2): stated here, stated on the page ──────────────────────────────────────────────
/** the breath: every cell swells by up to amp of its radius, a wave leaving the heart every period seconds at speed. */
export const BREATH = Object.freeze({ period: 6, amp: 0.06, speed: 1400 });
/** the tide: a slow current of amp world units a step, turning every period seconds, its waves scale per world unit. */
export const TIDE = Object.freeze({ amp: 0.06, period: 23, scale: 0.003 });
/** the library: motes per kept rule, the most it holds, how long a dropped rule's red mote takes to fade, a bud's flight. */
export const MASS = Object.freeze({ perRule: 96, cap: 4096, fade: 2.4, bud: 0.9 });
/** a packet's trip in seconds: base when an edge is quiet, never below min however busy. */
export const TRIP = Object.freeze({ base: 1.6, min: 0.55 });
/** U4: hovering dims the rest, but never a failed cell below this. */
export const FLOOR = 0.55;
export const CHARACTERS = Object.freeze(['plain', 'heart', 'conductor', 'gate', 'auditor', 'library', 'night']);

/** breath(t, dist) → the radius scale of a cell dist world units from the heart at t seconds: 1 at rest, at most 1 + amp. */
export function breath(t, dist) {
  if (!Number.isFinite(t) || !Number.isFinite(dist)) return 1;
  const phase = (t - Math.abs(dist) / BREATH.speed) / BREATH.period;
  return 1 + BREATH.amp * Math.sin(Math.PI * phase) ** 2;
}
/** tide(x, y, t) → the current's push on a cell at (x, y), t seconds: smooth in space, so a region sways together. */
export function tide(x, y, t) {
  if (![x, y, t].every(Number.isFinite)) return [0, 0];
  const w = (2 * Math.PI) / TIDE.period;
  return [TIDE.amp * Math.sin(t * w + y * TIDE.scale), TIDE.amp * Math.cos(t * w * 0.9 + x * TIDE.scale)];
}

// ── each organ's character, each cell's depth ──────────────────────────────────────────────────────────────────────
/** characterOf(node) → how an organ shows itself, from its own id and kind: the seed's core beats, the conductor fires
 *  routing lines, the gate opens and the auditor watches when they judge, the library is a mass, a night organ breathes. */
export function characterOf(n) {
  if (!isObj(n)) return 'plain';
  const id = str(n.id), kind = str(n.kind), role = str(n.role);
  if (kind === 'core') return 'heart';
  if (id === 'kar' || id === 'their-kar') return 'conductor';
  if (id === 'gate' || id === 'their-gate') return 'gate';
  if (id === 'auditor' || id === 'their-auditor') return 'auditor';
  if (kind === 'library' || role === 'library' || id === 'library' || id === 'their-library') return 'library';
  if (role === 'night') return 'night';
  return 'plain';
}
const NEAR = new Set(['organ', 'layer', 'model', 'grok', 'memory', 'index', 'night', 'library', 'core']);
/** depthOf(node) → how far back it sits, 0 (front) to 1: the heart and conductor in front, the organs just behind, then
 *  the body and the brain spread over a band each (by id, so the same node always sits at the same depth). */
export function depthOf(n) {
  if (!isObj(n)) return 0.5;
  const c = characterOf(n);
  if (c === 'heart' || c === 'conductor') return 0;
  const role = str(n.role) || str(n.kind), h = unit(fnv(str(n.id)));
  if (c !== 'plain' || NEAR.has(role)) return 0.08;
  if (role === 'note') return 0.3 + h * 0.3;
  if (role === 'ghost') return 0.55 + h * 0.3;
  return 0.18 + h * 0.4;
}

// ── failure shows (U4) ──────────────────────────────────────────────────────────────────────────────────────────────
/** isFailed(node) → a red CI result or a run that failed. */
export function isFailed(n) { return isObj(n) && (n.ci === 'red' || n.run === 'failed'); }
/** visibility(alpha, failed) → the alpha a cell is drawn with: a failed cell never below FLOOR. */
export function visibility(alpha, failed) {
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1.5, alpha)) : 0;
  return failed === true ? Math.max(FLOOR, a) : a;
}

// ── the library as a mass (U3) ──────────────────────────────────────────────────────────────────────────────────────
/** massOf(kept) → the motes the library holds for this many kept rules. */
export function massOf(kept) { return Number.isSafeInteger(kept) ? Math.min(MASS.cap, Math.max(0, kept) * MASS.perRule) : 0; }
/** moteAt(k, n) → mote k of n on a sphere of radius 1 (a Fibonacci lattice: evenly spread, the same every run). */
export function moteAt(k, n) {
  if (!Number.isSafeInteger(k) || !Number.isSafeInteger(n) || n < 1 || k < 0 || k >= n) return [0, 0, 0];
  const y = 1 - (2 * (k + 0.5)) / n, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

// ── activity: how busy each edge has been (U2: a packet's speed and brightness) ─────────────────────────────────────
/** createActivity(span) → counts the hand-offs along each edge among the last `span` events seen. */
export function createActivity(span = 240) {
  const cap = Number.isSafeInteger(span) && span > 0 ? span : 240;
  const q = [], c = new Map();
  const key = (a, b) => [str(a), str(b)].sort().join('|');
  return {
    see(e) {
      q.push(isObj(e) && e.t === 'flow' && str(e.a) && str(e.b) ? key(e.a, e.b) : '');
      if (q[q.length - 1]) c.set(q[q.length - 1], (c.get(q[q.length - 1]) || 0) + 1);
      if (q.length > cap) { const k = q.shift(); if (k) c.set(k, c.get(k) - 1); }
    },
    of(a, b) { return c.get(key(a, b)) || 0; },
    get size() { return q.length; },
  };
}
/** packetFor(count) → { dur, bright }: an edge that has carried more work lately carries it faster and brighter. */
export function packetFor(count) {
  const n = Number.isSafeInteger(count) ? Math.max(0, count) : 0, l = Math.log2(1 + n);
  return { dur: Math.max(TRIP.min, TRIP.base / (1 + l * 0.5)), bright: Math.min(2, 0.8 + 0.25 * l) };
}

// ── what each real event makes the organism do (U2) ────────────────────────────────────────────────────────────────
/** effectsOf(event, i, ctx) → the effects of event number i, each carrying { cause: { i, t } }. No event, no effect;
 *  an event the law does not know makes none. ctx: { has(id), character(id), parent(id), activity(a, b), tint(e),
 *  judge (the id of the gate or library that judges rules), heart (the id that beats), live (a live event) }. */
export function effectsOf(ev, i, ctx) {
  if (!isObj(ev) || !Number.isSafeInteger(i) || i < 0) return [];
  const C = isObj(ctx) ? ctx : {};
  const has = (id) => (typeof C.has === 'function' ? C.has(id) === true : false) && str(id) !== '';
  const ch = (id) => (typeof C.character === 'function' ? str(C.character(id)) : 'plain');
  const tint = typeof C.tint === 'function' ? C.tint(ev) : null;
  const cause = { i, t: str(ev.t) }, out = [];
  const put = (fx) => { out.push({ ...fx, cause }); };
  const e = ev;
  if (e.t === 'flow') {
    if (has(e.a) && has(e.b) && e.a !== e.b) {
      const p = packetFor(typeof C.activity === 'function' ? C.activity(e.a, e.b) : 0);
      put({ fx: 'packet', a: e.a, b: e.b, dur: p.dur, bright: p.bright, tint });
      if (ch(e.a) === 'conductor') put({ fx: 'fire', a: e.a, b: e.b });
      if (ch(e.a) === 'conductor' && ch(e.b) === 'gate') put({ fx: 'night', on: true });
    }
  } else if (e.t === 'link') {
    if (has(e.a) && has(e.b) && e.a !== e.b) put({ fx: 'tie', a: e.a, b: e.b });
  } else if (e.t === 'born' || e.t === 'layer') {
    if (has(e.id)) {
      const cand = [str(e.to), str(e.layer), typeof C.parent === 'function' ? str(C.parent(e.id)) : ''];
      const parent = cand.find((p) => p !== '' && p !== e.id && has(p));
      put({ fx: 'bud', id: e.id, parent: parent === undefined ? null : parent });
    }
  } else if (e.t === 'germinate') {
    if (has(e.id)) put({ fx: 'germinate', id: e.id });
  } else if (e.t === 'ci') {
    if (has(e.id)) put(e.ok === true ? { fx: 'ring', id: e.id, tint: 'green' } : { fx: 'fail', id: e.id });
  } else if (e.t === 'run') {
    if (has(e.id)) {
      if (e.state === 'running') put({ fx: 'breathe', id: e.id });
      else if (e.state === 'ok') put({ fx: 'ring', id: e.id, tint: 'green' });
      else if (e.state === 'failed') put({ fx: 'fail', id: e.id });
      if (ch(e.id) === 'night' && (e.state === 'running' || e.state === 'ok' || e.state === 'failed')) put({ fx: 'night', on: e.state === 'running' });
    }
  } else if (e.t === 'receipt') {
    if (has(e.id)) put({ fx: 'ring', id: e.id, tint: 'gold' });
  } else if (e.t === 'stage') {
    if (has(e.id) && str(e.stage)) put({ fx: 'bloom', id: e.id, stage: e.stage });
  } else if (e.t === 'pass' || e.t === 'drop') {
    if (str(e.rule)) {
      put({ fx: 'mote', kept: e.t === 'pass', rule: e.rule });
      if (has(C.judge)) put({ fx: 'judge', id: C.judge, ok: e.t === 'pass' });
    }
  }
  if (out.length && C.live === true && has(C.heart)) put({ fx: 'beat', id: C.heart });
  return out;
}

/** guardEffects(entries, seen) → the guardian's shield, one flare for each request the guard refused that is newer than
 *  `seen` (entries: the guard's own log, [{ n, at, why }], n counting from 1). It comes from that log, not the kernel. */
export function guardEffects(entries, seen = 0) {
  const s = Number.isSafeInteger(seen) ? seen : 0;
  return arr(entries).filter((g) => isObj(g) && Number.isSafeInteger(g.n) && g.n > s && str(g.why))
    .map((g) => ({ fx: 'shield', why: g.why, cause: { i: g.n, t: 'guard' } }));
}

// ── names on screen, and the camera ────────────────────────────────────────────────────────────────────────────────
/** labelPlan(cands, lit, max) → which labels to draw, in order, as [{ id, x, y, alpha }]. A lit node is always named; a
 *  hub (an organ, the heart) always; any other once it is large enough on screen (it fades in as you zoom). Two labels
 *  never overlap, except a lit one. cands: [{ id, x, y, r (radius in px), hub, label }] in screen pixels. */
export function labelPlan(cands, lit, max = 140) {
  const L = lit instanceof Set ? lit : new Set();
  const rank = (c) => (L.has(c.id) ? 0 : c.hub === true ? 1 : 2);
  const ok = arr(cands).filter((c) => isObj(c) && str(c.id) && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    && (L.has(c.id) || c.hub === true || c.r >= 4.5));
  // the most important first: lit, then hubs, then the largest on screen; a tie by id, so every frame agrees
  const keyed = new Map(ok.map((c) => [rank(c) + '\u0001' + String(Math.round(9999 - Math.min(9999, c.r * 100))).padStart(4, '0') + '\u0001' + c.id, c]));
  const used = new Set(), out = [];
  for (const k of [...keyed.keys()].sort()) {
    if (out.length >= max) break;
    const c = keyed.get(k);
    const w = Math.min(220, 7 * str(c.label || c.id).length), x0 = Math.floor((c.x - w / 2) / 40), x1 = Math.floor((c.x + w / 2) / 40), row = Math.floor((c.y + c.r + 4) / 16);
    const cells = [];
    for (let x = x0; x <= x1; x++) cells.push(x + ',' + row);
    if (!L.has(c.id) && cells.some((z) => used.has(z))) continue;
    for (const z of cells) used.add(z);
    out.push({ id: c.id, x: c.x, y: c.y + c.r + 4, alpha: L.has(c.id) || c.hub === true ? 1 : Math.min(1, (c.r - 4.5) / 3 + 0.35) });
  }
  return out;
}
/** fitRobust(pos, n, q) → the box from the q to the 1 − q quantile of the drawn positions on each axis (stride 4), so
 *  one stray cell never shrinks the whole organism to a dot; null when none is finite. (my-estate-graph's view.mjs,
 *  moved here unchanged so both surfaces frame alike.) */
export function fitRobust(pos, n, q = 0.02) {
  const p = pos && typeof pos.length === 'number' ? pos : [];
  const k = Math.min(typeof n === 'number' ? n : 0, Math.floor(p.length / 4)), xs = [], ys = [];
  for (let i = 0; i < k; i++) { const x = p[i * 4], y = p[i * 4 + 1]; if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); } }
  if (!xs.length) return null;
  const num = (a, b) => a - b;
  xs.sort(num); ys.sort(num);
  const at = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
  const x0 = at(xs, q), x1 = at(xs, 1 - q), y0 = at(ys, q), y1 = at(ys, 1 - q);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

export default { BREATH, TIDE, MASS, TRIP, FLOOR, CHARACTERS, breath, tide, characterOf, depthOf, isFailed, visibility, massOf, moteAt,
  createActivity, packetFor, effectsOf, guardEffects, labelPlan, fitRobust };
