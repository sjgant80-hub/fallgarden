// fallgarden · live/physics.mjs — the CPU mirror of organism.mjs's compute shader, step for step and in 32-bit floats,
// so a test (and a real browser, U1c) can prove the GPU runs exactly this law. Two profiles:
//   · 'fallgarden': FallGarden's own forces (kernel PHYS: inverse-square repulsion, Hooke springs, a pull to the centre,
//     damping) with the engine's two stabilisers (a speed limit, a repulsion reach): FallGarden Live's three views
//   · 'anatomy': the private view's organism (Kar pinned at the heart, the organs ringed round him, the brain above,
//     the body below gathered by family), forces.mjs's law in parallel form
// Both add the tide (living.mjs): the slow current that keeps the layout stirring instead of freezing (U1d). It only
// places cells for drawing: positions are never part of any hash or receipt. Claims: live/CLAIMS-living.md (083f92b).
import { TIDE } from './living.mjs';

const f = Math.fround;
const fnv = (s) => { let h = 0x811c9dc5; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const unit = (h) => (h & 0xffff) / 0xffff;

export const PROFILES = Object.freeze({ anatomy: 0, fallgarden: 1 });
export const MODES = Object.freeze({ free: 0, pinned: 1, ring: 2, point: 3, body: 4 });   // 0 = free, so a fresh world holds nothing
// the private view's anatomy (forces.mjs, unchanged numbers)
export const ANATOMY = Object.freeze({
  brain: [0, -950], body: [0, 430], bodyR: 1150,
  ring: Object.freeze({ night: 200, model: 250, grok: 180, library: 180, organ: 210, layer: 300 }),
  charge: Object.freeze({ kar: -1200, night: -180, model: -140, grok: -220, library: -220, organ: -180, layer: -160, memory: -420, index: -380, note: -70, ghost: -24, repo: -22 }),
  keep: 0.6, vmax: 60, reach: 1200, dmin: 1, floor: 0.06, decay: 1 - Math.pow(0.001, 1 / 300),
});
// FallGarden's physics (kernel.mjs PHYS) and the engine's stabilisers (engine.mjs SCALE)
export const FALLGARDEN = Object.freeze({ repel: 3000, rest: 60, spring: 0.03, center: 0.002, damp: 0.85, vmax: 12, reach: 400 });
const BRAIN = new Set(['memory', 'index', 'note', 'ghost']);

/** anatomyOf(role, fam, id) → a cell's physics in the private view: its charge, how it is held, and where it starts. */
export function anatomyOf(role, fam, id) {
  const h = fnv(id), a = unit(h) * Math.PI * 2, j = 8 + (h >>> 16) % 40, r = typeof role === 'string' ? role : 'repo';
  const q = ANATOMY.charge[r] || ANATOMY.charge.repo;
  if (r === 'kar') return { q, mode: MODES.pinned, ax: 0, ay: 0, k: 0, R: 0, home: [0, 0] };
  if (ANATOMY.ring[r]) { const R = ANATOMY.ring[r]; return { q, mode: MODES.ring, ax: 0, ay: 0, k: 0.1, R, home: [Math.cos(a) * R, Math.sin(a) * R] }; }
  if (BRAIN.has(r)) return { q, mode: MODES.point, ax: ANATOMY.brain[0], ay: ANATOMY.brain[1], k: r === 'memory' || r === 'index' ? 0.08 : 0.007, R: 0, home: [ANATOMY.brain[0] + Math.cos(a) * j * 4, ANATOMY.brain[1] + Math.sin(a) * j * 3] };
  const fa = unit(fnv('family:' + (typeof fam === 'string' ? fam : ''))) * Math.PI * 2;
  return { q, mode: MODES.body, ax: ANATOMY.body[0], ay: ANATOMY.body[1], k: 0.05, R: ANATOMY.bodyR,
    home: [ANATOMY.body[0] + Math.cos(fa) * ANATOMY.bodyR + Math.cos(a) * j * 2, ANATOMY.body[1] + Math.sin(fa) * ANATOMY.bodyR * 0.75 + Math.sin(a) * j * 2] };
}
/** tieOf(roleA, roleB) → [rest length, strength] of the spring between two cells (forces.mjs): a note naming a repo is a
 *  long, weak nerve; a tie inside the brain is short; one to Kar is longer; any other a short, firm tie. */
export function tieOf(ra, rb) {
  const ba = BRAIN.has(ra), bb = BRAIN.has(rb);
  if (ba !== bb && (ra === 'repo' || rb === 'repo')) return [260, 0.05];
  if (ba && bb) return [34, 1];
  if (ra === 'kar' || rb === 'kar') return [120, 1];
  return [46, 1];
}
/** besideParent(id, parent, scale) → a new cell's first place: beside its parent, at a spot set by its own id. */
export function besideParent(id, px, py, near = 14, spread = 24) {
  const h = fnv(id), a = unit(h) * Math.PI * 2, d = near + (h >>> 16) % spread;
  return [px + Math.cos(a) * d, py + Math.sin(a) * d];
}
/** heat(alpha, nodes, links) → the temperature after cells or springs are added (forces.mjs: a big change reheats more). */
export function heat(alpha, nodes, links) {
  let a = Number.isFinite(alpha) ? alpha : 1;
  if (nodes > 0) a = Math.max(a, Math.min(1, 0.25 + nodes / 400));
  if (links > 0) a = Math.max(a, Math.min(1, 0.2 + links / 2000));
  return a;
}
/** cool(alpha) → one step cooler, never below the floor, so the anatomy keeps its shape while the tide stirs it. */
export function cool(alpha) { const a = Number.isFinite(alpha) ? alpha : 1; return Math.max(ANATOMY.floor, a + (0 - a) * ANATOMY.decay); }

/** params(profile, { alpha, time, W, H, tide }) → the step's uniforms, exactly as the shader receives them. */
export function params(profile, o = {}) {
  const tideOn = o.tide !== false;
  const base = { alpha: f(Number.isFinite(o.alpha) ? o.alpha : 1), time: f(Number.isFinite(o.time) ? o.time : 0),
    tideAmp: f(tideOn ? TIDE.amp : 0), tideW: f((2 * Math.PI) / TIDE.period), tideK: f(TIDE.scale) };
  if (profile === PROFILES.fallgarden) {
    return { profile, ...base, keep: f(FALLGARDEN.damp), vmax: f(FALLGARDEN.vmax), reach2: f(FALLGARDEN.reach * FALLGARDEN.reach), dmin2: f(0),
      repel: f(FALLGARDEN.repel), rest: f(FALLGARDEN.rest), spring: f(FALLGARDEN.spring), center: f(FALLGARDEN.center), cx: f((o.W || 0) / 2), cy: f((o.H || 0) / 2) };
  }
  return { profile: PROFILES.anatomy, ...base, keep: f(ANATOMY.keep), vmax: f(ANATOMY.vmax), reach2: f(ANATOMY.reach * ANATOMY.reach), dmin2: f(ANATOMY.dmin * ANATOMY.dmin),
    repel: f(0), rest: f(0), spring: f(0), center: f(0), cx: f(0), cy: f(0) };
}

/** createWorld(cap) → the buffers the shader reads, as typed arrays (pos: x, y, vx, vy; phA: q, ax, ay, k; phB: R, mode,
 *  fam, degree), with the springs in compressed rows (off, nbr, tie: rest, strength) and each family's centre (famC). */
export function createWorld(cap = 64) {
  const c = Math.max(1, cap | 0);
  return { n: 0, pos: new Float32Array(c * 4), phA: new Float32Array(c * 4), phB: new Float32Array(c * 4), off: new Uint32Array(c + 1), nbr: new Uint32Array(0), tie: new Float32Array(0), famC: new Float32Array(4) };
}
/** setSprings(world, pairs, ties) → the compressed rows: for each cell, its neighbours and each spring's rest and strength. */
export function setSprings(W, pairs, ties) {
  const n = W.n, m = Math.floor(pairs.length / 2), deg = new Uint32Array(n + 1);
  for (let k = 0; k < m; k++) { const a = pairs[k * 2], b = pairs[k * 2 + 1]; if (a < n && b < n && a !== b) { deg[a + 1]++; deg[b + 1]++; } }
  for (let i = 1; i <= n; i++) deg[i] += deg[i - 1];
  const fill = deg.slice(0, n), nbr = new Uint32Array(deg[n]), tie = new Float32Array(deg[n] * 2);
  for (let k = 0; k < m; k++) {
    const a = pairs[k * 2], b = pairs[k * 2 + 1];
    if (a >= n || b >= n || a === b) continue;
    const r = ties ? ties[k * 2] : 0, s = ties ? ties[k * 2 + 1] : 0;
    tie[fill[a] * 2] = r; tie[fill[a] * 2 + 1] = s; nbr[fill[a]++] = b;
    tie[fill[b] * 2] = r; tie[fill[b] * 2 + 1] = s; nbr[fill[b]++] = a;
  }
  W.off = deg; W.nbr = nbr; W.tie = tie;
  for (let i = 0; i < n; i++) W.phB[i * 4 + 3] = deg[i + 1] - deg[i];
  return W;
}
/** families(world, n) → each family's centre and size this step, from the current positions (the body's tissues). */
export function families(W, nf) {
  const out = new Float32Array(Math.max(1, nf) * 4);
  for (let i = 0; i < W.n; i++) {
    if (W.phB[i * 4 + 1] !== MODES.body) continue;
    const fam = W.phB[i * 4 + 2];
    if (fam < 0 || fam >= nf) continue;
    out[fam * 4] += W.pos[i * 4]; out[fam * 4 + 1] += W.pos[i * 4 + 1]; out[fam * 4 + 2] += 1;
  }
  for (let k = 0; k < nf; k++) if (out[k * 4 + 2] > 0) { out[k * 4] = f(out[k * 4] / out[k * 4 + 2]); out[k * 4 + 1] = f(out[k * 4 + 1] / out[k * 4 + 2]); }
  return out;
}

/** step(world, P) → the next positions, written over world.pos: one parallel step, every cell read from the same start
 *  (the shader's ping-pong), every operation rounded to 32 bits as the GPU does. */
export function step(W, P) {
  const n = W.n, src = W.pos.slice(0, n * 4), out = W.pos;
  for (let i = 0; i < n; i++) {
    const r = P.profile === PROFILES.fallgarden ? cellFallgarden(W, P, src, i) : cellAnatomy(W, P, src, i);
    out[i * 4] = r[0]; out[i * 4 + 1] = r[1]; out[i * 4 + 2] = r[2]; out[i * 4 + 3] = r[3];
  }
  return W;
}
function tideAt(P, x, y) {
  return [f(P.tideAmp * f(Math.sin(f(f(P.time * P.tideW) + f(y * P.tideK))))), f(P.tideAmp * f(Math.cos(f(f(f(P.time * P.tideW) * f(0.9)) + f(x * P.tideK)))))];
}
function cellFallgarden(W, P, src, i) {
  const n = W.n, ax = src[i * 4], ay = src[i * 4 + 1];
  let vx = src[i * 4 + 2], vy = src[i * 4 + 3];
  // four lanes, as the shader sums: lane j % 4, ascending j; then (p0 + p1) + (p2 + p3)
  const px = [0, 0, 0, 0], py = [0, 0, 0, 0];
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const dx = f(src[j * 4] - ax), dy = f(src[j * 4 + 1] - ay), d2 = f(f(f(dx * dx) + f(dy * dy)) + f(0.01));
    if (d2 > P.reach2) continue;
    const dd = f(Math.sqrt(d2)), rep = f(P.repel / d2), q = j % 4;
    px[q] = f(px[q] + f(f(dx / dd) * rep)); py[q] = f(py[q] + f(f(dy / dd) * rep));
  }
  vx = f(vx - f(f(px[0] + px[1]) + f(px[2] + px[3]))); vy = f(vy - f(f(py[0] + py[1]) + f(py[2] + py[3])));
  for (let k = W.off[i]; k < W.off[i + 1]; k++) {
    const j = W.nbr[k], dx = f(src[j * 4] - ax), dy = f(src[j * 4 + 1] - ay), dd = f(f(Math.sqrt(f(f(dx * dx) + f(dy * dy)))) + f(0.01)), s = f(f(dd - P.rest) * P.spring);
    vx = f(vx + f(f(dx / dd) * s)); vy = f(vy + f(f(dy / dd) * s));
  }
  vx = f(vx + f(f(P.cx - ax) * P.center)); vy = f(vy + f(f(P.cy - ay) * P.center));
  const [tx, ty] = tideAt(P, ax, ay);
  vx = f(vx + tx); vy = f(vy + ty);
  vx = f(vx * P.keep); vy = f(vy * P.keep);
  const sp = f(Math.sqrt(f(f(vx * vx) + f(vy * vy))));
  if (sp > P.vmax) { const k = f(P.vmax / sp); vx = f(vx * k); vy = f(vy * k); }
  return [f(ax + vx), f(ay + vy), vx, vy];
}
function cellAnatomy(W, P, src, i) {
  const n = W.n, x = src[i * 4], y = src[i * 4 + 1], q = W.phA, b = W.phB;
  const mode = b[i * 4 + 1], hx = q[i * 4 + 1], hy = q[i * 4 + 2];
  if (mode === MODES.pinned) return [hx, hy, 0, 0];
  let vx = src[i * 4 + 2], vy = src[i * 4 + 3];
  const px = [0, 0, 0, 0], py = [0, 0, 0, 0];   // the shader's four lanes (see cellFallgarden)
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    let dx = f(src[j * 4] - x), dy = f(src[j * 4 + 1] - y), l = f(f(dx * dx) + f(dy * dy));
    if (l >= P.reach2) continue;
    if (l === 0) { dx = f(f(f(((i * 7919) % 13) - 6) * f(1e-3)) + f(1e-4)); dy = f(f(((i * 104729) % 11) - 5) * f(1e-3)); l = f(f(dx * dx) + f(dy * dy)); }
    if (l < P.dmin2) l = f(Math.sqrt(f(P.dmin2 * l)));
    const w = f(f(q[j * 4] * P.alpha) / l), k = j % 4;
    px[k] = f(px[k] + f(dx * w)); py[k] = f(py[k] + f(dy * w));
  }
  vx = f(vx + f(f(px[0] + px[1]) + f(px[2] + px[3]))); vy = f(vy + f(f(py[0] + py[1]) + f(py[2] + py[3])));
  const pvx = src[i * 4 + 2], pvy = src[i * 4 + 3], di = b[i * 4 + 3];
  for (let k = W.off[i]; k < W.off[i + 1]; k++) {
    const j = W.nbr[k], rest = W.tie[k * 2], s = W.tie[k * 2 + 1], dj = b[j * 4 + 3];
    let sx = f(f(src[j * 4] + src[j * 4 + 2]) - f(x + pvx)), sy = f(f(src[j * 4 + 1] + src[j * 4 + 3]) - f(y + pvy));
    if (sx === 0 && sy === 0) { sx = f(1e-3); sy = f(1e-3); }
    const len = f(Math.sqrt(f(f(sx * sx) + f(sy * sy))));
    const ff = f(f(f(f(f(len - rest) / len) * P.alpha) * s) / f(Math.min(di, dj)));
    const bias = f(dj / f(di + dj));
    vx = f(vx + f(f(sx * ff) * bias)); vy = f(vy + f(f(sy * ff) * bias));
  }
  if (mode === MODES.ring) {
    let r = f(Math.sqrt(f(f(x * x) + f(y * y))));
    if (r === 0) r = 1;
    const k = f(f(f(f(b[i * 4] - r) / r) * f(0.1)) * P.alpha);
    vx = f(vx + f(x * k)); vy = f(vy + f(y * k));
  } else if (mode === MODES.point) {
    const k = f(q[i * 4 + 3] * P.alpha);
    vx = f(vx + f(f(hx - x) * k)); vy = f(vy + f(f(hy - y) * k));
  } else if (mode === MODES.body) {
    const dx = f(x - hx), dy = f(f(y - hy) / f(0.7));
    let r = f(Math.sqrt(f(f(dx * dx) + f(dy * dy))));
    if (r === 0) r = 1;
    const lim = f(b[i * 4] * f(0.85));
    if (r > lim) { const k = f(f(f(f(lim - r) / r) * f(0.05)) * P.alpha); vx = f(vx + f(dx * k)); vy = f(vy + f(f(dy * k) * f(0.7))); }
    else { const k = f(f(0.002) * P.alpha); vx = f(vx + f(f(-dx) * k)); vy = f(vy + f(f(f(-dy) * f(0.7)) * k)); }
    const fam = b[i * 4 + 2];
    if (fam >= 0 && fam * 4 + 2 < W.famC.length && W.famC[fam * 4 + 2] > 1) {
      const k = f(f(0.05) * P.alpha);
      vx = f(vx + f(f(W.famC[fam * 4] - x) * k)); vy = f(vy + f(f(W.famC[fam * 4 + 1] - y) * k));
    }
  }
  const [tx, ty] = tideAt(P, x, y);
  vx = f(vx + tx); vy = f(vy + ty);
  vx = f(vx * P.keep); vy = f(vy * P.keep);
  const sp = f(Math.sqrt(f(f(vx * vx) + f(vy * vy))));
  if (sp > P.vmax) { const k = f(P.vmax / sp); vx = f(vx * k); vy = f(vy * k); }
  let nx = f(x + vx), ny = f(y + vy);
  if (!(Math.abs(nx) < 1e7) || !(Math.abs(ny) < 1e7)) { nx = hx; ny = hy; vx = 0; vy = 0; }
  return [nx, ny, vx, vy];
}

/** meanSpeed(world) → the average speed of the free cells, in world units a step (U1d: above 0, below 2). */
export function meanSpeed(W) {
  let s = 0, k = 0;
  for (let i = 0; i < W.n; i++) { if (W.phB[i * 4 + 1] === MODES.pinned) continue; s += Math.hypot(W.pos[i * 4 + 2], W.pos[i * 4 + 3]); k++; }
  return k ? s / k : 0;
}

export default { PROFILES, MODES, ANATOMY, FALLGARDEN, anatomyOf, tieOf, besideParent, heat, cool, params, createWorld, setSprings, families, step, meanSpeed };
