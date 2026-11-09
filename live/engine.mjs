// fallgarden · live/engine.mjs — the renderer. It draws the kernel's state; it never invents any. Two paths:
//   · WebGPU: the living organism (organism.mjs, 2026-11-09): FallGarden's own forces (kernel PHYS) in a compute shader
//     over every node, every frame; bloom, depth, packets of light, organs with character, the library as a mass; every
//     motion but the breath and the tide is caused by a real event (live/CLAIMS-living.md)
//   · 2D canvas: the same state with kernel.layoutStep on the CPU (capped to the nodes a CPU can lay out), plainer
// The engine owns positions only. What exists, what is lit and what pulses always comes from the state it is given.
import K from './kernel.mjs';
import Lv from './living.mjs';
import Ph from './physics.mjs';
import { createOrganism } from './organism.mjs';

const COLORS = {
  core: [0.95, 0.85, 0.55], organ: [0.48, 0.61, 0.49], layer: [0.83, 0.63, 0.32], library: [0.95, 0.75, 0.40], repo: [0.57, 0.55, 0.50],
  green: [0.48, 0.80, 0.52], red: [0.84, 0.48, 0.35], sim: [0.55, 0.68, 0.90],
};
const STAGE_GLOW = { shadow: 0, draft: 0.25, assist: 0.55, autonomous: 0.9 };
// FallGarden's forces were tuned for a vault of notes. At estate scale (1,700+ nodes) the summed repulsion outruns its gentle
// pull to the centre, so the RENDERER (never the kernel, whose layoutStep stays FallGarden's exact physics) adds two
// stabilisers: a speed limit per step, and repulsion that acts only within a reach. The page says so.
export const SCALE = Object.freeze({ vmax: 12, reach: 400 });
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export const styleOf = (n) => {
  const base = n.sim ? COLORS.sim : n.run === 'failed' || n.ci === 'red' ? COLORS.red : n.ci === 'green' ? COLORS.green : COLORS[n.kind] || COLORS.repo;
  const r = n.kind === 'core' ? 9 : n.kind === 'layer' ? 7 : n.kind === 'organ' || n.kind === 'library' ? 6.5 : 3.2;
  return { rgb: base, r, glow: Math.max(STAGE_GLOW[n.stage] || 0, n.run === 'running' ? 0.95 : 0) };
};

/** webgpuAvailable(force, nav) → is there a real WebGPU adapter here (U5)? false when forced off, when the browser has no
 *  navigator.gpu, and when requestAdapter gives nothing or throws. */
export async function webgpuAvailable(force, nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (force === false) return false;
  try { return !!(nav && nav.gpu && (await nav.gpu.requestAdapter())); } catch { return false; }
}

// ── the common part: slots, spawn positions, pulses and particles ─────────────────────────────────────────────────
function base(canvas, overlay) {
  return {
    canvas, overlay, ids: [], slot: new Map(), pos: new Float32Array(0), pulseNode: new Map(), pulseEdge: new Map(), particles: [],
    cam: { x: 0, y: 0, zoom: 0.6, target: null }, hover: null, W: 1, H: 1, labels: true,
    spawnAt(id, parent) {
      const h = fnv(id), a = ((h & 0xffff) / 0xffff) * Math.PI * 2, d = 18 + ((h >>> 16) % 30);
      const p = parent !== undefined && this.slot.has(parent) ? this.slot.get(parent) : -1;
      const px = p >= 0 ? this.pos[p * 4] : this.W / 2, py = p >= 0 ? this.pos[p * 4 + 1] : this.H / 2;
      return [px + Math.cos(a) * d, py + Math.sin(a) * d];
    },
    toWorld(cx, cy) { return [(cx - this.W / 2) / this.cam.zoom + this.cam.x, (cy - this.H / 2) / this.cam.zoom + this.cam.y]; },
    nearest(cx, cy) {
      const [wx, wy] = this.toWorld(cx, cy);
      let best = null, bd = (14 / this.cam.zoom) ** 2;
      for (let i = 0; i < this.ids.length; i++) { const dx = this.pos[i * 4] - wx, dy = this.pos[i * 4 + 1] - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = this.ids[i]; } }
      return best;
    },
    fit(dt) {
      if (!this.ids.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < this.ids.length; i++) { const x = this.pos[i * 4], y = this.pos[i * 4 + 1]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (!Number.isFinite(x0)) return;
      const z = Math.min(2.2, 0.9 * Math.min(this.W / Math.max(60, x1 - x0), this.H / Math.max(60, y1 - y0)));
      const k = Math.min(1, dt * 2.5);
      if (!this.cam.manual) { this.cam.x += ((x0 + x1) / 2 - this.cam.x) * k; this.cam.y += ((y0 + y1) / 2 - this.cam.y) * k; this.cam.zoom += (z - this.cam.zoom) * k; }
    },
    pulse(ev, now) {
      if (ev.t === 'flow' || ev.t === 'link') this.pulseEdge.set(K.edgeKey(ev.a, ev.b), now);
      if (ev.id) this.pulseNode.set(ev.id, now);
      if ((ev.t === 'pass' || ev.t === 'drop') && this.libraryId) {
        const h = fnv(String(ev.rule)), kept = ev.t === 'pass';
        this.particles.push({ born: now, kept, a: ((h & 0xffff) / 0xffff) * Math.PI * 2, r: (kept ? 16 : 26) + ((h >>> 16) % 22), spin: kept ? 0.15 : 0.6 });
        if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
      }
    },
    particleList(now) {
      const p = this.libraryId !== undefined && this.slot.has(this.libraryId) ? this.slot.get(this.libraryId) : -1;
      if (p < 0) return [];
      const cx = this.pos[p * 4], cy = this.pos[p * 4 + 1], out = [];
      for (const q of this.particles) {
        const age = (now - q.born) / 1000;
        const alpha = q.kept ? Math.min(1, age * 2) : Math.max(0, 1 - age / 1.8);
        if (alpha <= 0.01) continue;
        const a = q.a + age * q.spin;
        out.push([cx + Math.cos(a) * q.r, cy + Math.sin(a) * q.r, q.kept ? 3.2 : 2.2, alpha, q.kept]);
      }
      return out;
    },
  };
}

// ── WebGPU: the living organism (organism.mjs, the FallGarden profile) ─────────────────────────────────────────────
// The Living Visual (2026-11-09, live/CLAIMS-living.md): the same state, drawn as an organism. FallGarden's forces run
// in a compute shader every frame (physics.mjs is their law, U1c); every packet, flare, bud and mote is the effect of
// one real event (living.effectsOf, U2); the library is a mass (U3); a failure is red (U4).
const FAMILY = [[0.42, 0.62, 0.98], [0.36, 0.82, 0.7], [0.95, 0.62, 0.42], [0.72, 0.52, 0.98], [0.38, 0.76, 0.95], [0.96, 0.78, 0.42],
  [0.55, 0.85, 0.45], [0.95, 0.52, 0.66], [0.4, 0.7, 0.66], [0.82, 0.72, 0.6], [0.68, 0.48, 0.78], [0.48, 0.6, 0.84]];
const LOOK = { heart: [1.0, 0.86, 0.55], conductor: [1.0, 0.84, 0.52], gate: [0.55, 0.9, 1.0], auditor: [0.8, 0.65, 1.0], library: [1.0, 0.8, 0.36], night: [1.0, 0.66, 0.32], layer: [0.95, 0.62, 0.32], organ: [0.42, 0.86, 0.72] };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** lookOf(node, degree) → how a cell looks in the organism: a simulation in its own blue, a failure red, a repo in its
 *  family's colour (green-tinted when its CI is green), each organ in its character's colour, brighter as it climbs. */
export function lookOf(n, degree = 0) {
  const ch = Lv.characterOf(n), kind = n.kind;
  const base = n.sim ? COLORS.sim : ch !== 'plain' ? LOOK[ch] : kind === 'layer' ? LOOK.layer : kind === 'organ' ? LOOK.organ : mixc(FAMILY[fnv(String(n.fam || '')) % FAMILY.length], [1, 1, 1], 0.15);
  const rgb = Lv.isFailed(n) ? [1.0, 0.3, 0.24] : n.ci === 'green' && kind === 'repo' ? mixc(base, COLORS.green, 0.45) : base;
  const r = ch === 'heart' ? 15 : ch === 'conductor' ? 13 : ch === 'library' ? 11 : ch === 'gate' || ch === 'auditor' ? 10 : kind === 'layer' ? 10 : kind === 'organ' ? 9 : 7 + Math.min(9, 1.4 * Math.sqrt(Math.max(0, degree)));
  const glow = (ch === 'heart' || ch === 'conductor' ? 1 : ch !== 'plain' ? 0.9 : kind === 'layer' ? 0.75 : kind === 'organ' ? 0.7 : 0.42) + (STAGE_GLOW[n.stage] || 0) * 0.5;
  return { rgb, r, glow };
}
async function makeGPU(canvas, overlay) {
  const R = await createOrganism(canvas, overlay, { profile: 'fallgarden' });
  if (!R) throw new Error('no WebGPU adapter');
  const S = { kind: 'webgpu', R, ids: [], slot: new Map(), cam: R.cam, labels: true, libraryId: undefined, hidden: 0, pending: [], activity: Lv.createActivity(), keys: new Set(), pairs: [], weights: [], state: null, hoverId: null };
  Object.defineProperty(S, 'pos', { get: () => R.pos });
  Object.defineProperty(S, 'W', { get: () => R.W });
  Object.defineProperty(S, 'H', { get: () => R.H });
  Object.defineProperty(S, 'hover', {
    get: () => S.hoverId,
    set: (id) => {
      if (id === S.hoverId) return;
      S.hoverId = id;
      if (!id || !S.state || !S.slot.has(id)) { R.setLit(null, -1); return; }
      const lit = new Set([id]);
      for (const e of S.state.edges.values()) { if (e.a === id) lit.add(e.b); else if (e.b === id) lit.add(e.a); }
      R.setLit(lit, S.slot.get(id));
    },
  });
  R.labelFn = (v) => (v.label.length > 34 ? v.label.slice(0, 32) + '…' : v.label) + (v.stage && v.stage !== 'shadow' ? ' · ' + v.stage : '');
  S.reset = () => { R.clear(); S.ids = []; S.slot = new Map(); S.keys = new Set(); S.pairs = []; S.weights = []; S.pending = []; S.activity = Lv.createActivity(); S.hoverId = null; };
  const ctxOf = (state) => ({
    has: (id) => S.slot.has(id), character: (id) => Lv.characterOf(state.nodes.get(id)), parent: (id) => { const n = state.nodes.get(id); return n ? n.parent : undefined; },
    activity: (a, b) => S.activity.of(a, b), tint: (e) => (e.sim === true ? COLORS.sim : null),
    judge: ['gate', 'their-gate'].find((g) => S.slot.has(g)) || S.libraryId, heart: ['fall-core', 'their-core'].find((g) => S.slot.has(g)), live: false,
  });
  S.sync = (state) => {
    S.state = state;
    const deg = new Map();
    for (const e of state.edges.values()) { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); }
    for (const n of state.nodes.values()) if (!S.slot.has(n.id)) { S.slot.set(n.id, S.ids.length); S.ids.push(n.id); }
    const list = S.ids.map((id, i) => {
      const n = state.nodes.get(id), look = lookOf(n, deg.get(id) || 0);
      let home = null;
      if (i >= R.n) {
        const p = n.parent !== undefined && S.slot.has(n.parent) && S.slot.get(n.parent) < R.n ? S.slot.get(n.parent) : -1;
        home = p >= 0 ? Ph.besideParent(id, R.pos[p * 4], R.pos[p * 4 + 1], 18, 30) : Ph.besideParent(id, R.W / 2, R.H / 2, 18, 30);
      }
      return { id, role: n.kind, hub: n.kind !== 'repo', color: look.rgb, r: look.r, glow: look.glow, flags: n.run === 'running' ? 4 : 0, label: n.label, stage: n.stage,
        z: Lv.depthOf(n), character: Lv.characterOf(n), failed: Lv.isFailed(n), phys: {}, home };
    });
    R.setNodes(list, performance.now());
    if (state.edges.size !== S.keys.size) {
      let added = 0;
      for (const [key, e] of state.edges) {
        if (S.keys.has(key) || !S.slot.has(e.a) || !S.slot.has(e.b)) continue;
        S.keys.add(key); S.pairs.push(S.slot.get(e.a), S.slot.get(e.b));
        const ka = state.nodes.get(e.a).kind, kb = state.nodes.get(e.b).kind;
        S.weights.push(ka === 'repo' && kb === 'repo' ? 0.1 : ka === 'layer' || kb === 'layer' ? 0.09 : 0.16); added++;
      }
      if (added) R.setEdges(new Uint32Array(S.pairs), new Float32Array(S.weights), null);
    }
    const ctx = ctxOf(state);
    for (const p of S.pending.splice(0)) R.play(Lv.effectsOf(p.ev, p.i, ctx), p.now);
    // a jump on the timeline replays quietly: the mass is then set from the kernel's own count of kept rules (U3)
    if (R.motes !== Lv.massOf(state.library.kept.length)) R.setMass(state.library.kept.length);
  };
  S.pulse = (ev, now, i) => { S.activity.see(ev); if (Number.isSafeInteger(i)) S.pending.push({ ev, i, now }); };
  S.frame = (state, now) => { R.labelsOn = S.labels; R.frame(now); };
  S.nearest = (cx, cy) => { const i = R.pick(cx / R.dpr, cy / R.dpr); return i >= 0 ? S.ids[i] : null; };
  S.pointer = (x, y) => R.pointer(x, y);
  S.highlight = (ids) => { const lit = new Set((ids || []).filter((id) => S.slot.has(id))); R.setLit(lit.size ? lit : null, lit.size ? S.slot.get([...lit][0]) : -1); };
  S.toWorld = (cx, cy) => [(cx - R.W / 2) / R.cam.zoom + R.cam.x, (cy - R.H / 2) / R.cam.zoom + R.cam.y];
  return S;
}

// ── 2D canvas: the honest fallback ─────────────────────────────────────────────────────────────────────────────────
export const CPU_CAP = 700;
function make2D(canvas, overlay) {
  const S = base(canvas, overlay);
  S.kind = 'canvas2d';
  const g = canvas.getContext('2d');
  let nodes = [], links = [];
  S.reset = () => { S.ids = []; S.slot = new Map(); nodes = []; links = []; S.particles = []; S.pulseNode.clear(); S.pulseEdge.clear(); S.pos = new Float32Array(CPU_CAP * 4); S.cam.manual = false; S.hidden = 0; };
  S.sync = (state) => {
    S.hidden = 0;
    for (const n of state.nodes.values()) {
      if (S.slot.has(n.id)) continue;
      // the CPU lays out at most CPU_CAP nodes: the scaffold repos are the ones left out (the page says how many)
      if (S.ids.length >= CPU_CAP || (state.nodes.size > CPU_CAP && n.kind === 'repo' && n.fam === 'scaffold')) { S.hidden++; continue; }
      const [x, y] = S.spawnAt(n.id, n.parent);
      S.slot.set(n.id, S.ids.length); S.ids.push(n.id); nodes.push({ x, y, vx: 0, vy: 0 });
    }
    links = [...state.edges.values()].filter((e) => S.slot.has(e.a) && S.slot.has(e.b)).map((e) => ({ source: S.slot.get(e.a), target: S.slot.get(e.b), key: K.edgeKey(e.a, e.b) }));
  };
  S.frame = (state, now, dt) => {
    S.W = canvas.width; S.H = canvas.height;
    const before = nodes.map((p) => [p.x, p.y]);
    K.layoutStep(nodes, links, S.W, S.H);
    nodes.forEach((p, i) => {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > SCALE.vmax) { p.vx *= SCALE.vmax / sp; p.vy *= SCALE.vmax / sp; p.x = before[i][0] + p.vx; p.y = before[i][1] + p.vy; }
      S.pos.set([p.x, p.y, p.vx, p.vy], i * 4);
    });
    S.fit(dt);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, S.W, S.H);
    g.setTransform(S.cam.zoom, 0, 0, S.cam.zoom, S.W / 2 - S.cam.x * S.cam.zoom, S.H / 2 - S.cam.y * S.cam.zoom);
    g.lineWidth = 1 / S.cam.zoom;
    for (const l of links) {
      const t = S.pulseEdge.get(l.key), p = t ? Math.max(0, 1 - (now - t) / 1200) : 0;
      g.strokeStyle = p > 0 ? `rgba(212,160,82,${0.2 + p * 0.75})` : 'rgba(232,228,219,0.10)';
      const a = nodes[l.source], b = nodes[l.target]; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    S.ids.forEach((id, i) => {
      const nd = state.nodes.get(id), st = styleOf(nd), t = S.pulseNode.get(id);
      const gl = Math.max(st.glow, t ? Math.max(0, 1 - (now - t) / 1200) : 0) + (S.hover === id ? 0.8 : 0);
      const [r, gg, b] = st.rgb.map((c) => Math.round(c * 255));
      if (gl > 0) { g.fillStyle = `rgba(${r},${gg},${b},${0.25 * gl})`; g.beginPath(); g.arc(nodes[i].x, nodes[i].y, st.r * (1 + gl * 1.6), 0, 7); g.fill(); }
      g.fillStyle = `rgb(${r},${gg},${b})`; g.beginPath(); g.arc(nodes[i].x, nodes[i].y, st.r * 0.6, 0, 7); g.fill();
    });
    for (const q of S.particleList(now)) { g.fillStyle = q[4] ? `rgba(250,209,115,${q[3]})` : `rgba(214,122,90,${q[3]})`; g.beginPath(); g.arc(q[0], q[1], q[2] * 0.6, 0, 7); g.fill(); }
    drawLabels(S, state);
  };
  return S;
}

// labels for the organs, layers and the hovered node, on the overlay canvas
function drawLabels(S, state) {
  const o = S.overlay, g = o.getContext('2d');
  if (o.width !== S.W || o.height !== S.H) { o.width = S.W; o.height = S.H; }
  g.clearRect(0, 0, o.width, o.height);
  if (!S.labels) return;
  g.font = `${Math.round(11 * (window.devicePixelRatio || 1))}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  S.ids.forEach((id, i) => {
    const n = state.nodes.get(id);
    if (!n || (n.kind === 'repo' && S.hover !== id)) return;
    const x = (S.pos[i * 4] - S.cam.x) * S.cam.zoom + S.W / 2, y = (S.pos[i * 4 + 1] - S.cam.y) * S.cam.zoom + S.H / 2;
    if (!Number.isFinite(x) || x < -50 || y < -20 || x > S.W + 50 || y > S.H + 20) return;
    g.fillStyle = S.hover === id ? '#e8e4db' : n.kind === 'layer' ? 'rgba(212,160,82,0.9)' : 'rgba(232,228,219,0.75)';
    g.fillText((n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label) + (n.stage && n.stage !== 'shadow' ? ' · ' + n.stage : ''), x, y - 12 * (window.devicePixelRatio || 1));
  });
}

export async function createEngine(canvas, overlay, opts = {}) {
  if (await webgpuAvailable(opts.gpu)) { try { return await makeGPU(canvas, overlay); } catch (e) { console.warn('WebGPU failed, using the 2D canvas:', e); } }
  return make2D(canvas, overlay);
}
export default { createEngine, webgpuAvailable, styleOf, lookOf, CPU_CAP, SCALE };
