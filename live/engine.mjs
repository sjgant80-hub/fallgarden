// fallgarden · live/engine.mjs — the renderer. It draws the kernel's state; it never invents any. Two paths:
//   · WebGPU: FallGarden's own forces (kernel PHYS) in a compute shader over every node, nodes / edges / library particles
//     as instanced GPU geometry, positions read back a few times a second for labels and hover
//   · 2D canvas: the same state with kernel.layoutStep on the CPU (capped to the nodes a CPU can lay out), plainer
// The engine owns positions only. What exists, what is lit and what pulses always comes from the state it is given.
import K from './kernel.mjs';

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

export async function webgpuAvailable(force) {
  if (force === false) return false;
  try { return !!(navigator.gpu && (await navigator.gpu.requestAdapter())); } catch { return false; }
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

// ── WebGPU ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SIM_WGSL = /* wgsl */`
struct Params { count: u32, w: f32, h: f32, repel: f32, rest: f32, spring: f32, center: f32, damp: f32, vmax: f32, reach2: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> pin: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> pout: array<vec4f>;
@group(0) @binding(3) var<storage, read> off: array<u32>;
@group(0) @binding(4) var<storage, read> nbr: array<u32>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.count) { return; }
  let a = pin[i].xy;
  var v = pin[i].zw;
  for (var j = 0u; j < P.count; j++) {
    if (j == i) { continue; }
    let d = pin[j].xy - a; let d2 = dot(d, d) + 0.01;
    if (d2 > P.reach2) { continue; }
    let dd = sqrt(d2);
    v -= d / dd * (P.repel / d2);
  }
  for (var k = off[i]; k < off[i + 1u]; k++) {
    let d = pin[nbr[k]].xy - a; let dd = length(d) + 0.01;
    v += d / dd * ((dd - P.rest) * P.spring);
  }
  v += (vec2f(P.w * 0.5, P.h * 0.5) - a) * P.center;
  v *= P.damp;
  let sp = length(v);
  if (sp > P.vmax) { v = v * (P.vmax / sp); }
  pout[i] = vec4f(a + v, v);
}`;
const DRAW_WGSL = /* wgsl */`
struct Cam { sx: f32, sy: f32, ox: f32, oy: f32 };
@group(0) @binding(0) var<uniform> C: Cam;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> sty: array<vec4f>;
@group(0) @binding(3) var<storage, read> glow: array<f32>;
@group(0) @binding(4) var<storage, read> edges: array<u32>;
@group(0) @binding(5) var<storage, read> epulse: array<f32>;
@group(0) @binding(6) var<storage, read> parts: array<vec4f>;
@group(0) @binding(7) var<storage, read> pcol: array<vec4f>;
struct VO { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f };
fn clip(w: vec2f) -> vec4f { return vec4f(w.x * C.sx + C.ox, w.y * C.sy + C.oy, 0.0, 1.0); }
const Q = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
@vertex fn nodeVS(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let s = sty[ii]; let g = glow[ii]; let r = s.w * (1.0 + g * 1.6);
  var o: VO; o.p = clip(pos[ii].xy + Q[vi] * r); o.uv = Q[vi]; o.col = vec4f(s.rgb, g); return o;
}
@fragment fn nodeFS(i: VO) -> @location(0) vec4f {
  let d = length(i.uv); if (d > 1.0) { discard; }
  let core = smoothstep(0.62, 0.48, d); let halo = (1.0 - d) * i.col.a;
  let a = clamp(core + halo, 0.0, 1.0);
  return vec4f(i.col.rgb * a, a);
}
@vertex fn edgeVS(@builtin(vertex_index) vi: u32) -> VO {
  let e = vi / 2u; let n = edges[vi]; let p = epulse[e];
  var o: VO; o.p = clip(pos[n].xy); o.uv = vec2f(0.0);
  o.col = mix(vec4f(0.91, 0.89, 0.86, 0.10), vec4f(0.83, 0.63, 0.32, 0.95), p); return o;
}
@fragment fn edgeFS(i: VO) -> @location(0) vec4f { return vec4f(i.col.rgb * i.col.a, i.col.a); }
@vertex fn partVS(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let q = parts[ii];
  var o: VO; o.p = clip(q.xy + Q[vi] * q.z); o.uv = Q[vi]; o.col = vec4f(pcol[ii].rgb, q.w); return o;
}
@fragment fn partFS(i: VO) -> @location(0) vec4f {
  let d = length(i.uv); if (d > 1.0) { discard; }
  let a = (1.0 - d) * i.col.a; return vec4f(i.col.rgb * a, a);
}`;

async function makeGPU(canvas, overlay) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });
  const S = base(canvas, overlay);
  S.kind = 'webgpu';
  const U = GPUBufferUsage;
  const buf = (size, usage) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage });
  const sim = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: SIM_WGSL }), entryPoint: 'main' } });
  const mod = device.createShaderModule({ code: DRAW_WGSL });
  const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
  const draw = (vs, fs, topology) => device.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: vs }, fragment: { module: mod, entryPoint: fs, targets: [{ format, blend }] }, primitive: { topology } });
  const nodeP = draw('nodeVS', 'nodeFS', 'triangle-list'), edgeP = draw('edgeVS', 'edgeFS', 'line-list'), partP = draw('partVS', 'partFS', 'triangle-list');
  const params = buf(48, U.UNIFORM | U.COPY_DST), cam = buf(16, U.UNIFORM | U.COPY_DST);
  let cap = 0, ecap = 0, pA, pB, styB, glowB, offB, nbrB, edgeB, epB, partB, pcolB, rb, flip = false, reading = false, frame = 0;
  let edgeList = [];
  const PCAP = 1024;
  partB = buf(PCAP * 16, U.STORAGE | U.COPY_DST); pcolB = buf(PCAP * 16, U.STORAGE | U.COPY_DST);
  function alloc(n, e) {
    cap = Math.max(1, n); ecap = Math.max(1, e);
    pA = buf(cap * 16, U.STORAGE | U.COPY_DST | U.COPY_SRC); pB = buf(cap * 16, U.STORAGE | U.COPY_DST | U.COPY_SRC);
    styB = buf(cap * 16, U.STORAGE | U.COPY_DST); glowB = buf(cap * 4, U.STORAGE | U.COPY_DST);
    offB = buf((cap + 1) * 4, U.STORAGE | U.COPY_DST); nbrB = buf(ecap * 2 * 4, U.STORAGE | U.COPY_DST);
    edgeB = buf(ecap * 2 * 4, U.STORAGE | U.COPY_DST); epB = buf(ecap * 4, U.STORAGE | U.COPY_DST);
    rb = device.createBuffer({ size: Math.max(16, cap * 16), usage: U.MAP_READ | U.COPY_DST });
    S.pos = new Float32Array(cap * 4);
  }
  S.reset = (nodeCap, edgeCap) => { alloc(nodeCap, edgeCap); S.ids = []; S.slot = new Map(); edgeList = []; S.particles = []; S.pulseNode.clear(); S.pulseEdge.clear(); S.cam.manual = false; };
  S.sync = (state) => {
    // new nodes → slots, spawned next to their parent; their position goes to both buffers
    for (const n of state.nodes.values()) {
      if (S.slot.has(n.id) || S.ids.length >= cap) continue;
      const i = S.ids.length, parent = n.parent;
      const [x, y] = S.spawnAt(n.id, parent);
      S.ids.push(n.id); S.slot.set(n.id, i);
      S.pos.set([x, y, 0, 0], i * 4);
      const v = new Float32Array([x, y, 0, 0]);
      device.queue.writeBuffer(pA, i * 16, v); device.queue.writeBuffer(pB, i * 16, v);
    }
    const sty = new Float32Array(S.ids.length * 4);
    S.ids.forEach((id, i) => { const st = styleOf(state.nodes.get(id)); sty.set([...st.rgb, st.r], i * 4); });
    if (sty.length) device.queue.writeBuffer(styB, 0, sty);
    if (state.edges.size !== edgeList.length) {
      edgeList = [...state.edges.values()].filter((e) => S.slot.has(e.a) && S.slot.has(e.b)).slice(0, ecap);
      const deg = new Uint32Array(S.ids.length + 1), idx = new Uint32Array(edgeList.length * 2);
      edgeList.forEach((e, k) => { const a = S.slot.get(e.a), b = S.slot.get(e.b); idx[k * 2] = a; idx[k * 2 + 1] = b; deg[a + 1]++; deg[b + 1]++; });
      for (let i = 1; i < deg.length; i++) deg[i] += deg[i - 1];
      const fill = deg.slice(), nb = new Uint32Array(edgeList.length * 2);
      edgeList.forEach((e) => { const a = S.slot.get(e.a), b = S.slot.get(e.b); nb[fill[a]++] = b; nb[fill[b]++] = a; });
      device.queue.writeBuffer(offB, 0, deg); if (nb.length) device.queue.writeBuffer(nbrB, 0, nb); if (idx.length) device.queue.writeBuffer(edgeB, 0, idx);
    }
  };
  S.frame = (state, now, dt) => {
    const n = S.ids.length;
    S.W = canvas.width; S.H = canvas.height;
    device.queue.writeBuffer(params, 0, new Uint32Array([n]));
    device.queue.writeBuffer(params, 4, new Float32Array([S.W, S.H, K.PHYS.repel, K.PHYS.rest, K.PHYS.spring, K.PHYS.center, K.PHYS.damp, SCALE.vmax, SCALE.reach * SCALE.reach, 0, 0]));
    // glow = stage + recent pulses; edge pulses decay over 1.2 s
    const glow = new Float32Array(Math.max(1, n));
    S.ids.forEach((id, i) => { const nd = state.nodes.get(id); const t = S.pulseNode.get(id); glow[i] = Math.max(STAGE_GLOW[nd.stage] || 0, t ? Math.max(0, 1 - (now - t) / 1200) : 0) + (S.hover === id ? 0.8 : 0); });
    device.queue.writeBuffer(glowB, 0, glow);
    const ep = new Float32Array(Math.max(1, edgeList.length));
    edgeList.forEach((e, k) => { const t = S.pulseEdge.get(K.edgeKey(e.a, e.b)); ep[k] = t ? Math.max(0, 1 - (now - t) / 1200) : 0; });
    device.queue.writeBuffer(epB, 0, ep);
    const plist = S.particleList(now).slice(0, PCAP);
    if (plist.length) {
      const pp = new Float32Array(plist.length * 4), pc = new Float32Array(plist.length * 4);
      plist.forEach((q, i) => { pp.set([q[0], q[1], q[2], q[3]], i * 4); pc.set(q[4] ? [0.98, 0.82, 0.45, 1] : [0.84, 0.48, 0.35, 1], i * 4); });
      device.queue.writeBuffer(partB, 0, pp); device.queue.writeBuffer(pcolB, 0, pc);
    }
    S.fit(dt);
    const sx = (2 * S.cam.zoom) / S.W, sy = (-2 * S.cam.zoom) / S.H;
    device.queue.writeBuffer(cam, 0, new Float32Array([sx, sy, -S.cam.x * sx, -S.cam.y * sy]));
    const enc = device.createCommandEncoder();
    const src = flip ? pB : pA, dst = flip ? pA : pB;
    if (n) {
      const cp = enc.beginComputePass();
      cp.setPipeline(sim);
      cp.setBindGroup(0, device.createBindGroup({ layout: sim.getBindGroupLayout(0), entries: [params, src, dst, offB, nbrB].map((b, i) => ({ binding: i, resource: { buffer: b } })) }));
      cp.dispatchWorkgroups(Math.ceil(n / 64));
      cp.end();
    }
    const view = ctx.getCurrentTexture().createView();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.102, g: 0.102, b: 0.118, a: 1 } }] });
    const bg = (pipe, entries) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: entries.map(([binding, buffer]) => ({ binding, resource: { buffer } })) });
    if (edgeList.length) { rp.setPipeline(edgeP); rp.setBindGroup(0, bg(edgeP, [[0, cam], [1, dst], [4, edgeB], [5, epB]])); rp.draw(edgeList.length * 2); }
    if (n) { rp.setPipeline(nodeP); rp.setBindGroup(0, bg(nodeP, [[0, cam], [1, dst], [2, styB], [3, glowB]])); rp.draw(6, n); }
    if (plist.length) { rp.setPipeline(partP); rp.setBindGroup(0, bg(partP, [[0, cam], [6, partB], [7, pcolB]])); rp.draw(6, plist.length); }
    rp.end();
    const readNow = n && !reading && frame % 6 === 0;
    if (readNow) enc.copyBufferToBuffer(dst, 0, rb, 0, n * 16);
    device.queue.submit([enc.finish()]);
    if (readNow) { reading = true; rb.mapAsync(GPUMapMode.READ, 0, n * 16).then(() => { S.pos.set(new Float32Array(rb.getMappedRange(0, n * 16)).slice()); rb.unmap(); reading = false; }).catch(() => { reading = false; }); }
    flip = !flip; frame++;
    drawLabels(S, state);
  };
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
export default { createEngine, webgpuAvailable, styleOf, CPU_CAP, SCALE };
