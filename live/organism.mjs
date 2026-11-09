// fallgarden · live/organism.mjs — THE LIVING VISUAL's renderer (2026-11-09; claims live/CLAIMS-living.md, sealed 083f92b).
// One full-screen WebGPU organism over the SAME real state. Every frame:
//   · the layout runs in a compute shader (physics.mjs is its law, mirrored in 32-bit floats: U1c), never stopping
//   · cells breathe (living.BREATH, a slow wave from the heart) and sit at real depths in perspective, the pointer
//     tilting the eye; the faint dust behind is background, not data
//   · every packet, routing line, flare, ring, bud and library mote is the effect of one real event (living.effectsOf),
//     logged with that event's index (U2); a failure is red and never dimmed below the floor (U4)
//   · the library is a mass of motes: kept rules × MASS.perRule (U3); it pulses and churns during a night
//   · HDR, bloom (5 down, 4 up), ACES tone map, vignette; names on a 2D overlay
// It draws state; it never invents it. Written once in FallGarden Live; vendored byte for byte into the private view.
import Lv from './living.mjs';
import Ph from './physics.mjs';

const HDR = 'rgba16float', MAX_SPRITES = 20000, MAX_RINGS = 1024, MAX_MOTES = Lv.MASS.cap, MAX_RED = 2048, DUST = 1600, AMBIENT_CYCLE = 20, AMBIENT_TRIP = 3.6;
export const TIMING = Object.freeze({ AMBIENT_CYCLE, AMBIENT_TRIP, LIVE_TRIP: Lv.TRIP.base });
/** depth: a cell at depth z is drawn 1/(1 + persp·z) as large and as far from the centre; the pointer tilts the eye. */
export const DEPTH = Object.freeze({ persp: 0.32, tilt: 30 });
const CHAR = Object.freeze({ plain: 0, heart: 1, conductor: 2, gate: 3, auditor: 4, library: 5, night: 6 });
const TINT = Object.freeze({ green: [0.36, 0.96, 0.52], red: [1.0, 0.3, 0.24], gold: [1.0, 0.82, 0.42], white: [0.92, 0.94, 1.0], fire: [1.0, 0.9, 0.62], bud: [0.7, 0.95, 0.8], guard: [0.5, 0.82, 1.0] });
const tintOf = (t, fb) => (Array.isArray(t) && t.length >= 3 ? t : TINT[t] || fb || TINT.white);
const B = Lv.BREATH, BUD = Lv.MASS.bud;

const COMMON = /* wgsl */`
struct Cam { center: vec2f, scale: vec2f, time: f32, px: f32, dim: f32, hover: f32, tilt: vec2f, res: vec2f, origin: vec2f, persp: f32, night: f32 };
@group(0) @binding(0) var<uniform> cam: Cam;
fn persp(z: f32) -> f32 { return 1.0 / (1.0 + cam.persp * z); }
fn proj(w: vec2f, z: f32) -> vec2f { let k = persp(z); return (w - cam.center) * cam.scale * k + cam.tilt * (1.0 - k); }
fn breath(p: vec2f) -> f32 { let ph = (cam.time - length(p - cam.origin) / ${B.speed.toFixed(1)}) / ${B.period.toFixed(1)}; let s = sin(3.14159265 * ph); return 1.0 + ${B.amp} * s * s; }
fn ease(t: f32) -> f32 { let p = clamp(t, 0.0, 1.0); return select(1.0 - pow(-2.0 * p + 2.0, 2.0) / 2.0, 2.0 * p * p, p < 0.5); }
fn corner(vi: u32) -> vec2f { var q = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)); return q[vi]; }
fn pxToClip(v: vec2f) -> vec2f { return v * vec2f(2.0, -2.0) / cam.res; }
`;
// where a cell is drawn: a bud is still growing out of its parent
const CELL = /* wgsl */`
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(4) var<storage, read> nd: array<vec4f>;
@group(0) @binding(5) var<storage, read> nd2: array<vec4f>;
fn cellPos(i: u32) -> vec2f {
  let N = nd[i]; let P = nd2[i];
  if (N.w < ${BUD.toFixed(2)} && P.x >= 0.0) { return mix(pos[u32(P.x)].xy, pos[i].xy, ease(N.w / ${BUD.toFixed(2)})); }
  return pos[i].xy;
}
fn cellZ(i: u32) -> f32 { return nd[i].x; }
`;
const NODES = COMMON + CELL + /* wgsl */`
@group(0) @binding(2) var<storage, read> sty: array<vec4f>;
@group(0) @binding(3) var<storage, read> fx: array<vec4f>;
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f, @location(2) e: vec4f, @location(3) rpx: f32, @location(4) c: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let S = sty[ii]; let F = fx[ii]; let N = nd[ii]; let N2 = nd2[ii];
  let flags = u32(F.w);
  let p = cellPos(ii);
  let run = select(1.0, 1.0 + 0.3 * sin(cam.time * 3.4 + f32(ii)), (flags & 4u) != 0u);
  var grow = 1.0;
  if (N.w < ${BUD.toFixed(2)}) { let t = clamp(N.w / ${BUD.toFixed(2)}, 0.0, 1.0); grow = t * (1.0 + 0.45 * sin(t * 3.14159265)); }
  let k = persp(N.x);
  let r = max(S.w * breath(p) * run * grow * (1.0 + 0.3 * N.z), cam.px * 1.3 / k);
  let charExt = select(0.0, 2.8, N.y >= 2.0 && N.y != 5.0);   // room for an organ's shape; a plain cell keeps a tight quad
  let ext = r * max(2.2 + 2.8 * F.x, charExt + 1.4);
  let q = corner(vi);
  var o: O;
  o.p = vec4f(proj(p, N.x) + q * ext * cam.scale * k, 0.0, 1.0);
  o.uv = q * ext / r; o.col = S.rgb; o.e = F; o.rpx = r * k / cam.px; o.c = vec4f(N.y, N.z, N2.y, N2.z);
  return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f {
  let d = length(i.uv);
  let aa = 1.4 / max(i.rpx, 1.0);
  let flags = u32(i.e.w);
  var core = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  if ((flags & 1u) != 0u) { core = core * smoothstep(0.5 - aa, 0.72, d) * 0.8; }
  var halo = exp(-d * d * 0.9) * i.e.x * 0.5;
  var ring = 0.0;
  if ((flags & 2u) != 0u) { ring = (1.0 - smoothstep(0.0, aa * 2.0, abs(d - 1.55))) * 0.7; }
  var col = i.col;
  let energy = i.c.y;
  // a failure: red, and a red halo that flares when it happens and fades, never gone (U4)
  if ((flags & 8u) != 0u) { col = vec3f(1.0, 0.3, 0.24); halo = halo + exp(-d * d * 0.55) * (0.35 + 1.4 * exp(-i.c.z * 0.6)); }
  var shape = 0.0;
  let ch = i.c.x;
  if (ch == 2.0) {        // the conductor: routing rays, bright when it hands out work
    let a = atan2(i.uv.y, i.uv.x);
    shape = pow(abs(cos(a * 3.0)), 36.0) * smoothstep(1.15, 1.5, d) * (1.0 - smoothstep(2.2, 3.6, d)) * (0.22 + 1.9 * energy);
  } else if (ch == 3.0) { // the gate: an aperture that opens green or red when it judges
    let dd = abs(i.uv.x) + abs(i.uv.y);
    shape = (1.0 - smoothstep(0.0, 0.14 + aa, abs(dd - 1.75))) * (0.32 + 2.0 * energy);
    col = mix(col, select(vec3f(1.0, 0.3, 0.24), vec3f(0.36, 0.96, 0.52), i.c.w > 0.0), min(1.0, energy * 1.4));
  } else if (ch == 4.0) { // the auditor: a watching eye; the iris widens when it judges
    let w = 1.0 - pow(i.uv.x / 2.0, 2.0);
    let lid = (1.0 - smoothstep(0.0, 0.1 + aa, abs(abs(i.uv.y) - 0.8 * max(w, 0.0)))) * step(abs(i.uv.x), 2.0);
    let iris = 1.0 - smoothstep(0.3 + 0.3 * energy, 0.42 + 0.3 * energy, d);
    shape = lid * (0.3 + 1.5 * energy) + iris * energy * 1.2;
  } else if (ch == 6.0) { // a night organ: a crescent
    let d1 = length(i.uv - vec2f(0.5, -0.2));
    shape = (1.0 - smoothstep(1.55, 1.7 + aa, d)) * smoothstep(1.25, 1.4, d1) * (0.28 + energy);
  } else if (ch == 1.0) { // the heart: it swells on every beat
    halo = halo + exp(-d * d * 0.5) * energy * 1.2;
  }
  let lit = 1.0 + i.e.z * 1.1;
  let fog = clamp(i.c.x * 0.0, 0.0, 0.0);
  var c = col * (core + halo + ring + shape) * lit * i.e.y;
  return vec4f(c, 0.0);
}`;
const EDGES = COMMON + CELL + /* wgsl */`
@group(0) @binding(2) var<storage, read> sty: array<vec4f>;
@group(0) @binding(3) var<storage, read> fx: array<vec4f>;
@group(0) @binding(6) var<storage, read> ed: array<vec2u>;
@group(0) @binding(7) var<storage, read> ew: array<f32>;
struct O { @builtin(position) p: vec4f, @location(0) v: f32, @location(1) col: vec3f, @location(2) a: f32, @location(3) wpx: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let E = ed[ii];
  let A = proj(cellPos(E.x), cellZ(E.x)) * cam.res * 0.5; let Bv = proj(cellPos(E.y), cellZ(E.y)) * cam.res * 0.5;
  let lit = cam.hover >= 0.0 && (f32(E.x) == cam.hover || f32(E.y) == cam.hover);
  let wpx = select(1.1, 2.0, lit);
  let d = Bv - A + vec2f(1e-5, 0.0);
  let n = normalize(vec2f(-d.y, d.x));
  let q = corner(vi);
  let t = q.x * 0.5 + 0.5;
  var o: O;
  o.p = vec4f((mix(A, Bv, t) + n * q.y * (wpx * 0.5 + 1.0)) / (cam.res * 0.5), 0.0, 1.0);
  o.v = q.y * (wpx * 0.5 + 1.0); o.wpx = wpx;
  o.col = mix(sty[E.x].rgb, sty[E.y].rgb, t);
  let fade = min(fx[E.x].y, fx[E.y].y);
  let depth = 1.0 - 0.3 * (cellZ(E.x) + cellZ(E.y)) * 0.5;
  o.a = ew[ii] * fade * depth * select(select(1.0, 0.22, cam.dim > 0.5), 7.0, lit);
  return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f {
  let a = (1.0 - smoothstep(i.wpx * 0.5 - 0.5, i.wpx * 0.5 + 0.8, abs(i.v))) * i.a;
  return vec4f(i.col * a, 0.0);
}`;
// a travelling light: along the bent path between two cells, at t (already eased), as one sprite of a trail
const SPRITES = COMMON + CELL + /* wgsl */`
struct Sp { a: vec4f, b: vec4f };
@group(0) @binding(8) var<storage, read> sp: array<Sp>;
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f, @location(2) a: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let s = sp[ii]; let q = corner(vi);
  let ia = u32(s.a.x); let ib = u32(s.a.y);
  let A = cellPos(ia); let Bp = cellPos(ib);
  let d = Bp - A; let len = max(length(d), 1e-3); let n = vec2f(-d.y, d.x) / len;
  let e = s.a.z;
  let w = A + d * e + n * sin(3.14159265 * e) * min(60.0, len * 0.12);
  let z = mix(cellZ(ia), cellZ(ib), e);
  var o: O;
  o.p = vec4f(proj(w, z) + pxToClip(q * s.a.w * 3.0), 0.0, 1.0);
  o.uv = q * 3.0; o.col = s.b.rgb; o.a = s.b.w;
  return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f {
  let d2 = dot(i.uv, i.uv);
  return vec4f(i.col * (exp(-d2 * 3.2) * 1.6 + exp(-d2 * 0.45) * 0.28) * i.a, 0.0);
}`;
const RINGS = COMMON + CELL + /* wgsl */`
struct Rg { a: vec4f, b: vec4f };
@group(0) @binding(9) var<storage, read> rg: array<Rg>;
struct O { @builtin(position) p: vec4f, @location(0) px: vec2f, @location(1) col: vec3f, @location(2) e: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let r = rg[ii]; let q = corner(vi); let i = u32(r.a.x); let ext = r.a.y + r.a.w + 3.0;
  var o: O;
  o.p = vec4f(proj(cellPos(i), cellZ(i)) + pxToClip(q * ext), 0.0, 1.0);
  o.px = q * ext; o.col = r.b.rgb; o.e = vec3f(r.a.y, r.a.w, r.a.z);
  return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f {
  let d = length(i.px);
  let ring = 1.0 - smoothstep(0.0, i.e.y, abs(d - i.e.x));
  return vec4f(i.col * ring * i.e.z * 1.3, 0.0);
}`;
// the library's mass: mote k of the kept rules sits on a sphere round the library (a fixed lattice, so the mass only
// ever densifies); a new mote flies in from the judge; a dropped rule's red mote sits at the rim and fades
const MOTES = COMMON + CELL + /* wgsl */`
struct Mass { lib: f32, judge: f32, count: f32, radius: f32, spin: f32, pulse: f32, fade: f32, pad: f32 };
@group(0) @binding(10) var<storage, read> mo: array<vec4f>;
@group(0) @binding(11) var<uniform> M: Mass;
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f, @location(2) a: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let m = mo[ii]; let q = corner(vi);
  let lib = u32(M.lib);
  let c = cellPos(lib); let z0 = cellZ(lib);
  let kept = m.z > 0.0;
  let idx = (u32(m.x) * 2477u) % ${MAX_MOTES}u;
  let y = 1.0 - 2.0 * (f32(idx) + 0.5) / ${MAX_MOTES}.0; let rr = sqrt(max(0.0, 1.0 - y * y)); let ang = f32(idx) * 2.399963229728653 + M.spin;
  var s = vec3f(cos(ang) * rr, y, sin(ang) * rr);
  let age = cam.time - m.y;
  var R = M.radius * (1.0 + 0.08 * M.pulse * sin(cam.time * 5.0)) * breath(c);
  if (!kept) { R = R * 1.25; }
  var w = c + vec2f(s.x, s.y * 0.92 + s.z * 0.2) * R;
  if (kept && age < ${BUD.toFixed(2)} && M.judge >= 0.0) { w = mix(cellPos(u32(M.judge)), w, ease(age / ${BUD.toFixed(2)})); }
  let z = z0 + s.z * 0.12;
  var o: O;
  let size = select(2.2, 2.6, !kept) * (1.0 + 0.35 * M.pulse);
  o.p = vec4f(proj(w, z) + pxToClip(q * size * 2.4), 0.0, 1.0);
  o.uv = q * 2.4;
  o.col = select(vec3f(1.0, 0.3, 0.24), mix(vec3f(1.0, 0.78, 0.36), vec3f(1.0, 0.92, 0.7), m.w), kept);
  let front = 0.55 + 0.45 * (1.0 - (s.z * 0.5 + 0.5));
  o.a = select(max(0.0, 1.0 - age / M.fade), (0.45 + 0.4 * M.pulse) * front * min(1.0, age * 3.0 + 0.2), kept);
  return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f { let d2 = dot(i.uv, i.uv); return vec4f(i.col * (exp(-d2 * 3.0) * 1.3 + exp(-d2 * 0.6) * 0.2) * i.a, 0.0); }`;
const DUSTW = COMMON + /* wgsl */`
@group(0) @binding(12) var<storage, read> du: array<vec4f>;
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) a: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> O {
  let d = du[ii]; let q = corner(vi);
  var o: O; o.p = vec4f(proj(d.xy, d.z) + pxToClip(q * 2.2), 0.0, 1.0); o.uv = q * 2.2; o.a = d.w; return o;
}
@fragment fn fs(i: O) -> @location(0) vec4f { let d2 = dot(i.uv, i.uv); return vec4f(vec3f(0.35, 0.5, 0.75) * exp(-d2 * 2.2) * i.a, 0.0); }`;
const POST = /* wgsl */`
struct P { texel: vec2f, mode: f32, k: f32, time: f32, pad: f32, pad2: vec2f };
@group(0) @binding(0) var<uniform> u: P;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var base: texture_2d<f32>;
struct O { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> O {
  var v = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: O; o.p = vec4f(v[vi], 0.0, 1.0); o.uv = vec2f(v[vi].x * 0.5 + 0.5, 0.5 - v[vi].y * 0.5); return o;
}
fn tap(uv: vec2f) -> vec3f { return textureSampleLevel(src, smp, uv, 0.0).rgb; }
@fragment fn down(i: O) -> @location(0) vec4f {
  let h = u.texel * 0.5;
  var c = tap(i.uv) * 4.0 + tap(i.uv - h) + tap(i.uv + h) + tap(i.uv + vec2f(h.x, -h.y)) + tap(i.uv - vec2f(h.x, -h.y));
  c = c / 8.0;
  if (u.mode > 0.5) { let l = max(c.r, max(c.g, c.b)); c = c * smoothstep(u.k, u.k + 0.6, l); }
  return vec4f(c, 1.0);
}
@fragment fn up(i: O) -> @location(0) vec4f {
  let h = u.texel * 0.5;
  var c = tap(i.uv + vec2f(-h.x * 2.0, 0.0)) + tap(i.uv + vec2f(-h.x, h.y)) * 2.0 + tap(i.uv + vec2f(0.0, h.y * 2.0)) + tap(i.uv + vec2f(h.x, h.y)) * 2.0
    + tap(i.uv + vec2f(h.x * 2.0, 0.0)) + tap(i.uv + vec2f(h.x, -h.y)) * 2.0 + tap(i.uv + vec2f(0.0, -h.y * 2.0)) + tap(i.uv + vec2f(-h.x, -h.y)) * 2.0;
  return vec4f(c / 12.0, 1.0);
}
fn aces(x: vec3f) -> vec3f { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
fn hash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453); }
@fragment fn comp(i: O) -> @location(0) vec4f {
  let scene = textureSampleLevel(base, smp, i.uv, 0.0).rgb;
  let bloom = tap(i.uv);
  let q = i.uv - vec2f(0.5);
  let deep = mix(vec3f(0.012, 0.026, 0.05), vec3f(0.003, 0.005, 0.014), smoothstep(0.0, 0.8, length(q * vec2f(0.9, 1.2))));
  var c = deep + scene + bloom * u.k;
  c = aces(c * 1.05);
  c = c * (1.0 - 0.38 * smoothstep(0.35, 0.95, length(q * vec2f(1.0, 0.85))));
  c = c + (hash(i.uv * 1024.0 + u.time) - 0.5) / 255.0;
  return vec4f(pow(c, vec3f(1.0 / 2.2)), 1.0);
}`;
// the layout: physics.mjs's step, on the GPU, every cell at once; repulsion in tiles of 64 through workgroup memory
const SIM = /* wgsl */`
struct P { n: u32, profile: u32, nfam: u32, pad0: u32, alpha: f32, keep: f32, vmax: f32, reach2: f32, dmin2: f32, time: f32, tideAmp: f32, tideW: f32,
  tideK: f32, repel: f32, rest: f32, spring: f32, center: f32, cx: f32, cy: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> U: P;
@group(0) @binding(1) var<storage, read> pin: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> pout: array<vec4f>;
@group(0) @binding(3) var<storage, read> phA: array<vec4f>;
@group(0) @binding(4) var<storage, read> phB: array<vec4f>;
@group(0) @binding(5) var<storage, read> off: array<u32>;
@group(0) @binding(6) var<storage, read> nbr: array<u32>;
@group(0) @binding(7) var<storage, read> tie: array<vec2f>;
@group(0) @binding(8) var<storage, read> famC: array<vec4f>;
var<workgroup> tile: array<vec4f, 64>;
var<workgroup> part: array<vec2f, 64>;
fn tideAt(x: f32, y: f32) -> vec2f { return vec2f(U.tideAmp * sin(U.time * U.tideW + y * U.tideK), U.tideAmp * cos(U.time * U.tideW * 0.9 + x * U.tideK)); }
// four lanes per cell: lane q sums the pairs j with j % 4 == q, in ascending j; the cell then adds its four partial sums
// as (p0 + p1) + (p2 + p3). physics.mjs sums in exactly this order (U1c). Four times the threads, so the GPU is kept busy.
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) l: vec3u, @builtin(workgroup_id) wg: vec3u) {
  let i = wg.x * 16u + l.x / 4u; let q = l.x % 4u; let on = i < U.n;
  var me = vec4f(0.0); var A = vec4f(0.0); var Bq = vec4f(0.0);
  if (on) { me = pin[i]; A = phA[i]; Bq = phB[i]; }
  let mode = u32(Bq.y);
  var v = me.zw; var f = vec2f(0.0);
  let n = U.n; let prof = U.profile; let reach2 = U.reach2; let dmin2 = U.dmin2; let alpha = U.alpha; let repel = U.repel;
  for (var base = 0u; base < n; base = base + 64u) {
    let j = base + l.x;
    if (j < n) { tile[l.x] = vec4f(pin[j].xy, phA[j].x, 0.0); } else { tile[l.x] = vec4f(0.0); }
    workgroupBarrier();
    let m = min(64u, n - base);
    if (on && prof == 1u) {
      for (var t = q; t < m; t = t + 4u) {
        if (base + t == i) { continue; }
        let o = tile[t]; let dx = o.x - me.x; let dy = o.y - me.y;
        let d2 = dx * dx + dy * dy + 0.01;
        if (d2 > reach2) { continue; }
        let dd = sqrt(d2); let rep = repel / d2;
        f = vec2f(f.x + (dx / dd) * rep, f.y + (dy / dd) * rep);
      }
    } else if (on) {
      for (var t = q; t < m; t = t + 4u) {
        if (base + t == i) { continue; }
        let o = tile[t]; var dx = o.x - me.x; var dy = o.y - me.y;
        var l2 = dx * dx + dy * dy;
        if (l2 >= reach2) { continue; }
        if (l2 == 0.0) { dx = (f32((i * 7919u) % 13u) - 6.0) * 1e-3 + 1e-4; dy = (f32((i * 104729u) % 11u) - 5.0) * 1e-3; l2 = dx * dx + dy * dy; }
        if (l2 < dmin2) { l2 = sqrt(dmin2 * l2); }
        let w = (o.z * alpha) / l2;
        f = vec2f(f.x + dx * w, f.y + dy * w);
      }
    }
    workgroupBarrier();
  }
  part[l.x] = f;
  workgroupBarrier();
  if (!on || q != 0u) { return; }
  let c = l.x;
  f = (part[c] + part[c + 1u]) + (part[c + 2u] + part[c + 3u]);
  if (U.profile == 1u) {
    v = vec2f(v.x - f.x, v.y - f.y);
    for (var k = off[i]; k < off[i + 1u]; k = k + 1u) {
      let j = nbr[k]; let dx = pin[j].x - me.x; let dy = pin[j].y - me.y;
      let dd = sqrt(dx * dx + dy * dy) + 0.01; let s = (dd - U.rest) * U.spring;
      v = vec2f(v.x + (dx / dd) * s, v.y + (dy / dd) * s);
    }
    v = vec2f(v.x + (U.cx - me.x) * U.center, v.y + (U.cy - me.y) * U.center);
    v = v + tideAt(me.x, me.y);
    v = v * U.keep;
    let sp = sqrt(v.x * v.x + v.y * v.y);
    if (sp > U.vmax) { v = v * (U.vmax / sp); }
    pout[i] = vec4f(me.x + v.x, me.y + v.y, v.x, v.y);
    return;
  }
  if (mode == 1u) { pout[i] = vec4f(A.y, A.z, 0.0, 0.0); return; }
  v = vec2f(v.x + f.x, v.y + f.y);
  let di = Bq.w;
  for (var k = off[i]; k < off[i + 1u]; k = k + 1u) {
    let j = nbr[k]; let tt = tie[k]; let dj = phB[j].w;
    var sx = (pin[j].x + pin[j].z) - (me.x + me.z); var sy = (pin[j].y + pin[j].w) - (me.y + me.w);
    if (sx == 0.0 && sy == 0.0) { sx = 1e-3; sy = 1e-3; }
    let len = sqrt(sx * sx + sy * sy);
    let ff = ((((len - tt.x) / len) * U.alpha) * tt.y) / min(di, dj);
    let bias = dj / (di + dj);
    v = vec2f(v.x + (sx * ff) * bias, v.y + (sy * ff) * bias);
  }
  if (mode == 2u) {
    var r = sqrt(me.x * me.x + me.y * me.y); if (r == 0.0) { r = 1.0; }
    let k = (((Bq.x - r) / r) * 0.1) * U.alpha;
    v = vec2f(v.x + me.x * k, v.y + me.y * k);
  } else if (mode == 3u) {
    let k = A.w * U.alpha;
    v = vec2f(v.x + (A.y - me.x) * k, v.y + (A.z - me.y) * k);
  } else if (mode == 4u) {
    let dx = me.x - A.y; let dy = (me.y - A.z) / 0.7;
    var r = sqrt(dx * dx + dy * dy); if (r == 0.0) { r = 1.0; }
    let lim = Bq.x * 0.85;
    if (r > lim) { let k = (((lim - r) / r) * 0.05) * U.alpha; v = vec2f(v.x + dx * k, v.y + (dy * k) * 0.7); }
    else { let k = 0.002 * U.alpha; v = vec2f(v.x + (-dx) * k, v.y + ((-dy) * 0.7) * k); }
    let fam = u32(Bq.z);
    if (fam < U.nfam) { let fc = famC[fam]; if (fc.z > 1.0) { let k = 0.05 * U.alpha; v = vec2f(v.x + (fc.x - me.x) * k, v.y + (fc.y - me.y) * k); } }
  }
  v = v + tideAt(me.x, me.y);
  v = v * U.keep;
  let sp = sqrt(v.x * v.x + v.y * v.y);
  if (sp > U.vmax) { v = v * (U.vmax / sp); }
  var nx = me.x + v.x; var ny = me.y + v.y;
  if (!(abs(nx) < 1e7) || !(abs(ny) < 1e7)) { nx = A.y; ny = A.z; v = vec2f(0.0); }
  pout[i] = vec4f(nx, ny, v.x, v.y);
}`;

/** createOrganism(canvas, overlay, opts) → the renderer, or null when this browser has no WebGPU (the page then draws the
 *  same state with its 2D engine, U5). opts: { gpu (false: never), profile ('anatomy' | 'fallgarden') }. */
export async function createOrganism(canvas, overlay, opts = {}) {
  if (opts.gpu === false || typeof navigator === 'undefined' || !navigator.gpu) return null;
  let adapter = null;
  try { adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); } catch { adapter = null; }
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'opaque' });
  const g2 = overlay.getContext('2d');
  const U = GPUBufferUsage;
  const info = (adapter.info && (adapter.info.description || adapter.info.vendor + ' ' + adapter.info.architecture)) || 'WebGPU';
  const profile = opts.profile === 'fallgarden' ? Ph.PROFILES.fallgarden : Ph.PROFILES.anatomy;
  let lost = null;
  device.lost.then((l) => { lost = l.message || 'the GPU device was lost'; });

  const camBuf = device.createBuffer({ size: 80, usage: U.UNIFORM | U.COPY_DST });
  const massBuf = device.createBuffer({ size: 32, usage: U.UNIFORM | U.COPY_DST });
  const simBuf = device.createBuffer({ size: 80, usage: U.UNIFORM | U.COPY_DST });
  const mod = (code) => device.createShaderModule({ code });
  const add = { color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } };
  const scenePipe = (code) => { const m = mod(code); return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: 'vs' }, fragment: { module: m, entryPoint: 'fs', targets: [{ format: HDR, blend: add }] }, primitive: { topology: 'triangle-list' } }); };
  const pNodes = scenePipe(NODES), pEdges = scenePipe(EDGES), pSprites = scenePipe(SPRITES), pRings = scenePipe(RINGS), pMotes = scenePipe(MOTES), pDust = scenePipe(DUSTW);
  const pSim = device.createComputePipeline({ layout: 'auto', compute: { module: mod(SIM), entryPoint: 'main' } });
  const post = mod(POST);
  const postPipe = (entry, fmt, blend) => device.createRenderPipeline({ layout: 'auto', vertex: { module: post, entryPoint: 'vs' }, fragment: { module: post, entryPoint: entry, targets: [{ format: fmt, ...(blend ? { blend } : {}) }] }, primitive: { topology: 'triangle-list' } });
  const pDown = postPipe('down', HDR), pUp = postPipe('up', HDR, add), pComp = postPipe('comp', format);
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

  // ── the organism's data ───────────────────────────────────────────────────────────────────────────────────────────
  const R = {
    kind: 'webgpu', info, profile: profile === Ph.PROFILES.fallgarden ? 'fallgarden' : 'anatomy', n: 0, m: 0, ids: [], meta: [], index: new Map(),
    pos: new Float32Array(0), sty: new Float32Array(0), fx: new Float32Array(0), nd: new Float32Array(0), nd2: new Float32Array(0),
    born: new Float64Array(0), failAt: new Float64Array(0), energy: new Float32Array(0), judgeSign: new Float32Array(0), parent: new Int32Array(0),
    lit: null, hover: -1, focus: -1, lights: [], rings: [], ambient: [], effectLog: [], cam: { x: 0, y: -120, zoom: 0.35, manual: false, glide: null },
    W: 1, H: 1, dpr: 1, frames: [], spriteCount: 0, ambientLive: 0, labelsOn: true, inset: { right: 0, top: 0, bottom: 0 },
    world: Ph.createWorld(64), alpha: 1, steps: 0, paused: false, nf: 1, tilt: [0, 0], tiltTo: [0, 0], heart: -1, library: -1, judge: -1,
    warm: 0, massResets: 0, motes: 0, red: [], moteBorn: [], night: { on: false, until: 0, open: false }, spin: 0, dust: null, labelFn: null,
  };
  let cap = 0, ecap = 0, flip = false, reading = false, frame = 0;
  const bufs = {};
  let groups = null, simGroups = null, targets = null;
  const S_RW = U.STORAGE | U.COPY_DST;
  const make = (size, usage) => device.createBuffer({ size: Math.max(64, Math.ceil(size / 256) * 256), usage });
  const set = (name, size, usage) => { const b = bufs[name]; if (b && b.size >= size) return b; if (b) b.destroy(); bufs[name] = make(size * 2, usage); groups = null; simGroups = null; return bufs[name]; };
  function grow(k) {
    if (k <= cap && bufs.pA) return;
    const c = Math.max(k, cap * 2, 256);
    const enc = device.createCommandEncoder();
    const old = [bufs.pA, bufs.pB];
    const pA = make(c * 16, S_RW | U.COPY_SRC), pB = make(c * 16, S_RW | U.COPY_SRC);
    if (old[0] && cap) { enc.copyBufferToBuffer(old[0], 0, pA, 0, cap * 16); enc.copyBufferToBuffer(old[1], 0, pB, 0, cap * 16); }
    device.queue.submit([enc.finish()]);
    device.queue.onSubmittedWorkDone().then(() => { for (const b of old) if (b) b.destroy(); });
    bufs.pA = pA; bufs.pB = pB;
    bufs.rb = device.createBuffer({ size: c * 16, usage: U.MAP_READ | U.COPY_DST });
    const ext = (a, T) => { const b = new T(c * (a.length / Math.max(1, cap) || 4)); b.set(a); return b; };
    R.pos = ext(R.pos, Float32Array); R.sty = ext(R.sty, Float32Array); R.fx = ext(R.fx, Float32Array); R.nd = ext(R.nd, Float32Array); R.nd2 = ext(R.nd2, Float32Array);
    const b1 = (a, T) => { const b = new T(c); b.set(a); return b; };
    R.born = b1(R.born, Float64Array); R.failAt = b1(R.failAt, Float64Array); R.energy = b1(R.energy, Float32Array); R.judgeSign = b1(R.judgeSign, Float32Array); R.parent = b1(R.parent, Int32Array);
    const w = Ph.createWorld(c); w.n = R.world.n; w.pos.set(R.world.pos); w.phA.set(R.world.phA); w.phB.set(R.world.phB); w.off = R.world.off; w.nbr = R.world.nbr; w.tie = R.world.tie; w.famC = R.world.famC; R.world = w;
    cap = c; groups = null; simGroups = null;
    for (const [name, per] of [['sty', 16], ['fx', 16], ['nd', 16], ['nd2', 16], ['phA', 16], ['phB', 16]]) set(name, c * per, S_RW | U.COPY_SRC);
    set('off', (c + 1) * 4, S_RW);
  }

  /** setNodes(list, now) → the cells, in the physics' order: [{ id, role, hub, color, r, glow, flags, label, z, character,
   *  failed, phys: { q, mode, ax, ay, k, R, fam }, home: [x, y] }]. A new cell starts at its home, already grown; a bud
   *  effect (a real birth) then grows it out of its parent. */
  R.setNodes = (list, now) => {
    const k = list.length, t = typeof now === 'number' ? now : performance.now();
    grow(k);
    const wpos = [];
    for (let i = R.n; i < k; i++) {
      const h = list[i].home || [0, 0];
      R.pos.set([h[0], h[1], 0, 0], i * 4); R.world.pos.set([h[0], h[1], 0, 0], i * 4);
      R.born[i] = t - 1e6; R.failAt[i] = -1e9; R.energy[i] = 0; R.judgeSign[i] = 0; R.parent[i] = -1;
      wpos.push(i);
    }
    if (wpos.length) {
      const a = wpos[0], b = wpos[wpos.length - 1] + 1;
      device.queue.writeBuffer(bufs.pA, a * 16, R.pos, a * 4, (b - a) * 4); device.queue.writeBuffer(bufs.pB, a * 16, R.pos, a * 4, (b - a) * 4);
      R.alpha = Ph.heat(R.alpha, wpos.length, 0); R.warm = 0;
    }
    R.n = k; R.world.n = k; R.ids = list.map((x) => x.id); R.meta = list; R.index = new Map(list.map((x, i) => [x.id, i]));
    const fams = new Map();
    R.heart = -1; R.library = -1; R.judge = -1;
    let conductor = -1;
    for (let i = 0; i < k; i++) {
      const v = list[i], p = v.phys || {};
      R.sty.set([v.color[0], v.color[1], v.color[2], v.r], i * 4);
      const fam = typeof p.fam === 'string' ? p.fam : '';
      if (!fams.has(fam)) fams.set(fam, fams.size);
      R.world.phA.set([p.q || 0, p.ax || 0, p.ay || 0, p.k || 0], i * 4);
      R.world.phB[i * 4] = p.R || 0; R.world.phB[i * 4 + 1] = p.mode || 0; R.world.phB[i * 4 + 2] = fams.get(fam);
      const c = CHAR[v.character] || 0;
      R.nd[i * 4] = Number.isFinite(v.z) ? v.z : 0.3; R.nd[i * 4 + 1] = c;
      if (c === CHAR.heart && R.heart < 0) R.heart = i;
      if (c === CHAR.conductor && conductor < 0) conductor = i;
      if (c === CHAR.library && R.library < 0) R.library = i;
      if (c === CHAR.gate && R.judge < 0) R.judge = i;
    }
    if (R.heart < 0) R.heart = conductor;
    R.nf = Math.max(1, fams.size);
    device.queue.writeBuffer(bufs.sty, 0, R.sty, 0, k * 4);
    device.queue.writeBuffer(bufs.phA, 0, R.world.phA, 0, k * 4); device.queue.writeBuffer(bufs.phB, 0, R.world.phB, 0, k * 4);
  };
  /** setEdges(pairs, weights, ties) → the vessels (index pairs, how strongly each is drawn) and their springs (rest,
   *  strength per pair; the FallGarden profile uses its own constants). */
  R.setEdges = (pairs, weights, ties) => {
    R.m = weights.length;
    if (R.m > ecap) { ecap = Math.max(R.m, ecap * 2, 1024); set('ed', ecap * 8, S_RW); set('ew', ecap * 4, S_RW); }
    if (R.m) { device.queue.writeBuffer(bufs.ed, 0, pairs); device.queue.writeBuffer(bufs.ew, 0, weights); }
    Ph.setSprings(R.world, pairs, ties || null);
    set('off', (Math.max(cap, R.n) + 1) * 4, S_RW); set('nbr', Math.max(16, R.world.nbr.byteLength), S_RW); set('tie', Math.max(16, R.world.tie.byteLength), S_RW);
    device.queue.writeBuffer(bufs.off, 0, R.world.off);
    if (R.world.nbr.length) { device.queue.writeBuffer(bufs.nbr, 0, R.world.nbr); device.queue.writeBuffer(bufs.tie, 0, R.world.tie); }
    device.queue.writeBuffer(bufs.phB, 0, R.world.phB, 0, R.n * 4);
    R.alpha = Ph.heat(R.alpha, 0, R.m);
  };
  R.clear = () => {
    R.setNodes([], performance.now()); R.n = 0; R.world.n = 0; R.m = 0; R.lights = []; R.rings = []; R.ambient = []; R.effectLog = [];
    R.motes = 0; R.moteBorn = []; R.red = []; R.night = { on: false, until: 0, open: false }; R.alpha = 1; R.cam.manual = false; R.cam.glide = null; R.focus = -1; R.lit = null; R.dust = null; R.fitCache = null;
    // a clear starts from nothing, so the same events after a clear always draw the same frames (Build Broadcast's B4)
    Object.assign(R.cam, { x: 0, y: -120, zoom: 0.35 }); R.tilt = [0, 0]; R.tiltTo = [0, 0]; R.spin = 0; R.warm = 0; R.steps = 0; frame = 0; flip = false; last = null; stepNow = false;
  };
  R.setLit = (lit, hover) => { R.lit = lit instanceof Set && lit.size ? lit : null; R.hover = typeof hover === 'number' ? hover : -1; };
  R.setAmbient = (items) => { R.ambient = Array.isArray(items) ? items : []; };
  R.pointer = (x, y) => { const w = R.W / R.dpr, h = R.H / R.dpr; R.tiltTo = [Number.isFinite(x) ? ((x / w) - 0.5) * 2 * DEPTH.tilt * R.dpr : 0, Number.isFinite(y) ? ((y / h) - 0.5) * 2 * DEPTH.tilt * R.dpr : 0]; };
  const kOf = (i) => 1 / (1 + DEPTH.persp * R.nd[i * 4]);
  /** screenOf(i) → where cell i is drawn, in CSS pixels (perspective and tilt included: labels and picking agree with it). */
  R.screenOf = (i, now = performance.now()) => {
    const k = kOf(i), bud = budAt(i, now);
    return [(((bud[0] - R.cam.x) * R.cam.zoom * k + R.tilt[0] * (1 - k)) + R.W / 2) / R.dpr, (((bud[1] - R.cam.y) * R.cam.zoom * k + R.tilt[1] * (1 - k)) + R.H / 2) / R.dpr];
  };
  R.pick = (cx, cy) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < R.n; i++) {
      const [x, y] = R.screenOf(i), dx = x - cx, dy = y - cy, d = dx * dx + dy * dy;
      const reach = Math.max((R.sty[i * 4 + 3] * 1.6 * R.cam.zoom * kOf(i)) / R.dpr, 9);
      if (d < reach * reach && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  R.glideTo = (i, zoom) => { if (i >= 0 && i < R.n) { R.cam.manual = true; R.cam.glide = { x: R.pos[i * 4], y: R.pos[i * 4 + 1], zoom: zoom || Math.max(R.cam.zoom, 1.4) }; } };
  R.fitNow = () => { R.cam.manual = false; R.cam.glide = null; };
  R.resize = () => {
    R.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(canvas.clientWidth * R.dpr)), h = Math.max(2, Math.round(canvas.clientHeight * R.dpr));
    if (w === R.W && h === R.H && targets) return;
    R.W = w; R.H = h; canvas.width = w; canvas.height = h; overlay.width = w; overlay.height = h;
    if (targets) for (const t of targets.list) t.destroy();
    const tex = (tw, th) => device.createTexture({ size: [Math.max(1, tw), Math.max(1, th)], format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const hdr = tex(w, h), mips = [];
    for (let k = 1; k <= 5; k++) mips.push(tex(w >> k, h >> k));
    const ub = (texel, mode, k) => { const b = device.createBuffer({ size: 32, usage: U.UNIFORM | U.COPY_DST }); device.queue.writeBuffer(b, 0, new Float32Array([texel[0], texel[1], mode, k, 0, 0, 0, 0])); return b; };
    const pg = (pipe, u, srcTex) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: u } }, { binding: 1, resource: srcTex.createView() }, { binding: 2, resource: sampler }] });
    const down = [], up = [];
    let src = hdr;
    mips.forEach((dst, k) => { down.push({ dst, group: pg(pDown, ub([1 / src.width, 1 / src.height], k === 0 ? 1 : 0, 0.85), src) }); src = dst; });
    for (let k = mips.length - 1; k > 0; k--) up.push({ dst: mips[k - 1], group: pg(pUp, ub([1 / mips[k].width, 1 / mips[k].height], 0, 0), mips[k]) });
    const compU = device.createBuffer({ size: 32, usage: U.UNIFORM | U.COPY_DST });
    const comp = device.createBindGroup({ layout: pComp.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: compU } }, { binding: 1, resource: mips[0].createView() }, { binding: 2, resource: sampler }, { binding: 3, resource: hdr.createView() }] });
    targets = { hdr, mips, down, up, comp, compU, list: [hdr, ...mips] };
  };

  // ── the effects of real events (U2), each logged with its cause ──────────────────────────────────────────────────
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const light = (ia, ib, o) => { if (ia >= 0 && ib >= 0 && ia !== ib) R.lights.push({ ia, ib, t0: o.t0, dur: o.dur, tint: o.tint, bright: o.bright, trail: o.trail || 9, size: o.size || 2.6 }); if (R.lights.length > 3000) R.lights.splice(0, R.lights.length - 3000); };
  const ring = (i, tint, big = 1, t0 = performance.now(), dur = 1700) => { if (i >= 0) R.rings.push({ i, t0, dur, tint, big }); if (R.rings.length > MAX_RINGS) R.rings.splice(0, R.rings.length - MAX_RINGS); };
  R.ring = ring;
  R.light = (ia, ib, tint, bright = 1) => light(ia, ib, { t0: performance.now(), dur: Lv.TRIP.base * 1000, tint, bright });
  function budAt(i, now = performance.now()) {
    const age = (now - R.born[i]) / 1000, p = R.parent[i];
    if (age < BUD && p >= 0) { const e = ease(age / BUD); return [R.pos[p * 4] + (R.pos[i * 4] - R.pos[p * 4]) * e, R.pos[p * 4 + 1] + (R.pos[i * 4 + 1] - R.pos[p * 4 + 1]) * e]; }
    return [R.pos[i * 4], R.pos[i * 4 + 1]];
  }
  /** play(effects, now) → draw each effect of a real event (living.effectsOf), resolving ids to cells; every one drawn is
   *  logged with its cause, so the log can be checked against the events (U2). */
  R.play = (effects, now = performance.now()) => {
    for (const fx of Array.isArray(effects) ? effects : []) {
      const at = (id) => (R.index.has(id) ? R.index.get(id) : -1);
      let drawn = true;
      switch (fx.fx) {
        case 'packet': light(at(fx.a), at(fx.b), { t0: now, dur: (fx.dur || Lv.TRIP.base) * 1000, tint: tintOf(fx.tint, TINT.white), bright: fx.bright || 1 }); drawn = at(fx.a) >= 0 && at(fx.b) >= 0; break;
        case 'fire': light(at(fx.a), at(fx.b), { t0: now, dur: 380, tint: TINT.fire, bright: 2.2, trail: 18, size: 2.2 }); if (at(fx.a) >= 0) R.energy[at(fx.a)] = 1; drawn = at(fx.a) >= 0 && at(fx.b) >= 0; break;
        case 'tie': light(at(fx.a), at(fx.b), { t0: now, dur: 900, tint: TINT.white, bright: 0.45, trail: 5, size: 1.8 }); drawn = at(fx.a) >= 0 && at(fx.b) >= 0; break;
        case 'bud': { const i = at(fx.id), p = at(fx.parent); if (i < 0) { drawn = false; break; } R.born[i] = now; R.parent[i] = p; if (p >= 0) light(p, i, { t0: now, dur: BUD * 1000, tint: R.meta[i] ? R.meta[i].color : TINT.bud, bright: 0.9, trail: 14, size: 2.0 }); break; }
        case 'germinate': { const i = at(fx.id); if (i < 0) { drawn = false; break; } R.born[i] = now; R.parent[i] = -1; const c = R.meta[i] ? R.meta[i].color : TINT.gold; ring(i, c, 0.6, now); ring(i, c, 1.1, now + 260); ring(i, c, 1.7, now + 520); R.energy[i] = 1; break; }
        case 'ring': { const i = at(fx.id); if (i < 0) { drawn = false; break; } ring(i, tintOf(fx.tint), 1, now); break; }
        case 'fail': { const i = at(fx.id); if (i < 0) { drawn = false; break; } R.failAt[i] = now; ring(i, TINT.red, 1.3, now, 2200); break; }
        case 'breathe': { const i = at(fx.id); if (i < 0) { drawn = false; break; } ring(i, tintOf(fx.tint, TINT.gold), 0.5, now); break; }
        case 'bloom': { const i = at(fx.id); if (i < 0) { drawn = false; break; } ring(i, TINT.gold, 1.5, now, 2000); R.energy[i] = 1; break; }
        case 'mote': if (fx.kept) { if (R.motes < MAX_MOTES) { const k = Math.min(MAX_MOTES, R.motes + Lv.MASS.perRule); for (let j = R.motes; j < k; j++) R.moteBorn[j] = now; R.motes = k; } }
          else { R.red.push({ k: (Math.imul(R.red.length + 1, 2654435761) >>> 0) % MAX_MOTES, born: now }); if (R.red.length > MAX_RED) R.red.splice(0, R.red.length - MAX_RED); }
          if (R.night.on && !R.night.open) R.night.until = Math.max(R.night.until, now + 1500);
          drawn = R.library >= 0; break;
        case 'judge': { const i = at(fx.id); if (i < 0) { drawn = false; break; } R.energy[i] = 1; R.judgeSign[i] = fx.ok ? 1 : -1; if (R.night.on && !R.night.open) R.night.until = Math.max(R.night.until, now + 1500); break; }
        case 'night': R.night = fx.on ? { on: true, until: fx.cause && fx.cause.t === 'run' ? Infinity : now + 2500, open: !!(fx.cause && fx.cause.t === 'run') } : { on: false, until: now, open: false }; break;
        case 'beat': { const i = at(fx.id); if (i < 0) { drawn = false; break; } R.energy[i] = Math.max(R.energy[i], 0.7); ring(i, TINT.gold, 0.25, now); break; }
        case 'shield': {   // the guardian: a membrane round the whole organism flares when the guard refuses a request
          const i = R.heart, b = Lv.fitRobust(R.pos, R.n, 0.015);
          if (i < 0 || !b) { drawn = false; break; }
          R.rings.push({ i, t0: now, dur: 1800, tint: TINT.guard, big: 0, world: Math.max(b.w, b.h) * 0.62 });
          break;
        }
        default: drawn = false;
      }
      if (drawn) { R.effectLog.push({ fx: fx.fx, cause: fx.cause, at: now }); if (R.effectLog.length > 50000) R.effectLog.splice(0, R.effectLog.length - 50000); }
    }
  };
  /** setMass(kept) → the library's motes for this many kept rules, already settled (a jump on the timeline). */
  R.setMass = (kept) => { R.motes = Lv.massOf(kept); R.moteBorn = new Array(R.motes).fill(-1e9); R.red = []; R.massResets++; };

  // ── every frame: physics, camera, each cell's light, the travelling lights, the mass, then the passes ────────────
  const sprites = new Float32Array(MAX_SPRITES * 8), rings = new Float32Array(MAX_RINGS * 8), moteData = new Float32Array((MAX_MOTES + MAX_RED) * 4);
  function camera(dt) {
    const c = R.cam;
    R.tilt[0] += (R.tiltTo[0] - R.tilt[0]) * Math.min(1, dt * 3); R.tilt[1] += (R.tiltTo[1] - R.tilt[1]) * Math.min(1, dt * 3);
    if (c.glide) { const k = Math.min(1, dt * 3.2); c.x += (c.glide.x - c.x) * k; c.y += (c.glide.y - c.y) * k; c.zoom += (c.glide.zoom - c.zoom) * k; if (Math.abs(c.glide.x - c.x) + Math.abs(c.glide.y - c.y) < 0.5) c.glide = null; return; }
    if (c.manual) return;
    if (!R.fitCache || frame % 10 === 0) R.fitCache = Lv.fitRobust(R.pos, R.n, 0.015);   // the robust fit sorts every position: every 10th frame is plenty for a camera that eases
    const b = R.fitCache;
    if (!b) return;
    const inR = R.inset.right * R.dpr, inT = R.inset.top * R.dpr, inB = R.inset.bottom * R.dpr, fw = Math.max(100, R.W - inR), fh = Math.max(100, R.H - inT - inB);
    const z = Math.min(3, 0.9 * Math.min(fw / Math.max(200, b.w), fh / Math.max(200, b.h))), k = Math.min(1, dt * 1.6);
    const tx = b.cx + inR / 2 / z, ty = b.cy + (inB - inT) / 2 / z;
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.zoom += (z - c.zoom) * k;
    if (!R.dust && R.n > 8) makeDust(b);
  }
  function makeDust(b) {
    const d = new Float32Array(DUST * 4), span = Math.max(b.w, b.h) * 1.6 + 800;
    let h = 0x9e3779b9;
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0; return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
    for (let i = 0; i < DUST; i++) d.set([b.cx + (rnd() - 0.5) * span * 2, b.cy + (rnd() - 0.5) * span * 1.4, 0.7 + rnd() * 0.3, 0.05 + rnd() * 0.12], i * 4);
    set('du', DUST * 16, S_RW); device.queue.writeBuffer(bufs.du, 0, d); R.dust = { n: DUST }; groups = null;
  }
  function cells(now, dt) {
    const dim = !!R.lit, decay = Math.exp(-dt * 2.2);
    for (let i = 0; i < R.n; i++) {
      const v = R.meta[i], age = (now - R.born[i]) / 1000, fade = Math.min(1, Math.max(0, age) / 1.1 + (age > 5 ? 1 : 0));
      const lit = dim && R.lit.has(v.id) ? 1 : 0;
      const failed = v.failed === true;
      const a = Lv.visibility(fade * (dim ? (lit ? 1 : 0.13) : 1) * (i === R.focus ? 1.3 : 1), failed);
      R.fx[i * 4] = v.glow + (age >= 0 && age < 1.6 ? (1.6 - age) * 0.9 : 0); R.fx[i * 4 + 1] = a; R.fx[i * 4 + 2] = lit || i === R.focus ? 1 : 0; R.fx[i * 4 + 3] = (v.flags | 0) | (failed ? 8 : 0);
      R.energy[i] *= decay;
      R.nd[i * 4 + 2] = R.energy[i]; R.nd[i * 4 + 3] = Math.max(0, age);
      R.nd2[i * 4] = R.parent[i]; R.nd2[i * 4 + 1] = Math.max(0, (now - R.failAt[i]) / 1000); R.nd2[i * 4 + 2] = R.judgeSign[i]; R.nd2[i * 4 + 3] = 0;
    }
    if (R.n) { device.queue.writeBuffer(bufs.fx, 0, R.fx, 0, R.n * 4); device.queue.writeBuffer(bufs.nd, 0, R.nd, 0, R.n * 4); device.queue.writeBuffer(bufs.nd2, 0, R.nd2, 0, R.n * 4); }
  }
  function trip(ia, ib, p, at, size, alpha, tint, trail) {
    let k = at;
    for (let s = 0; s < trail && k < MAX_SPRITES; s++) {
      const q = p - s * 0.028;
      if (q < 0) break;
      sprites.set([ia, ib, ease(Math.min(1, q)), size * (1 - s / (trail + 1)), tint[0], tint[1], tint[2], alpha * Math.pow(1 - s / trail, 1.6)], k * 8);
      k++;
    }
    return k;
  }
  function travelling(now) {
    let k = 0;
    const live = [];
    for (const L of R.lights) {
      const p = (now - L.t0) / L.dur;
      if (p >= 1) { if (L.trail >= 9 && L.trail < 14) ring(L.ib, L.tint, 0.6, now); continue; }
      if (p >= 0 && L.ia < R.n && L.ib < R.n) k = trip(L.ia, L.ib, p, k, L.size * R.dpr * L.bright, L.bright, L.tint, L.trail);
      live.push(L);
    }
    R.lights = live;
    const t = now / 1000, cyc = t / AMBIENT_CYCLE;
    let on = 0;
    for (const a of R.ambient) {
      const start = (Math.floor(cyc - a.phase) + a.phase) * AMBIENT_CYCLE, p = (t - start) / AMBIENT_TRIP;
      if (p < 0 || p >= 1 || a.ia >= R.n || a.ib >= R.n || a.ia < 0 || a.ib < 0) continue;
      k = trip(a.ia, a.ib, p, k, 1.7 * R.dpr, 0.42, a.tint, 6);
      on++;
    }
    R.spriteCount = k; R.ambientLive = on;
    if (k) device.queue.writeBuffer(bufs.sp, 0, sprites, 0, k * 8);
    let r = 0;
    R.rings = R.rings.filter((g) => now - g.t0 < g.dur);
    for (const g of R.rings) {
      if (g.i >= R.n || r >= MAX_RINGS || now < g.t0) continue;
      const p = (now - g.t0) / g.dur;
      const rpx = g.world ? g.world * R.cam.zoom * (0.96 + 0.08 * ease(p)) : R.sty[g.i * 4 + 3] * R.cam.zoom * kOf(g.i) + (6 + 46 * g.big) * R.dpr * ease(p);
      rings.set([g.i, rpx, (1 - p) * (1 - p) * (g.world ? 0.9 : 1.1), (g.world ? 7 : 1.6) * R.dpr, g.tint[0], g.tint[1], g.tint[2], 0], r * 8);
      r++;
    }
    if (r) device.queue.writeBuffer(bufs.rg, 0, rings, 0, r * 8);
    return [k, r];
  }
  function mass(now, dt) {
    if (R.library < 0) return 0;
    const t = now / 1000;
    const nightOn = R.night.on && now < R.night.until;
    R.spin += dt * (nightOn ? 0.6 : 0);
    R.red = R.red.filter((m) => now - m.born < Lv.MASS.fade * 1000);
    let k = 0;
    for (let j = 0; j < R.motes; j++) { moteData.set([j, (R.moteBorn[j] || -1e9) / 1000, 1, ((j * 7) % 13) / 13], k * 4); k++; }
    for (const m of R.red) { moteData.set([m.k, m.born / 1000, -1, 0], k * 4); k++; }
    if (k) device.queue.writeBuffer(bufs.mo, 0, moteData, 0, k * 4);
    const libR = R.sty[R.library * 4 + 3] || 8;
    device.queue.writeBuffer(massBuf, 0, new Float32Array([R.library, R.judge, R.motes, libR * 2 + 3.2 * Math.sqrt(Math.max(1, R.motes)), R.spin, nightOn ? 1 : 0, Lv.MASS.fade, 0]));
    return k;
  }
  function makeGroups() {
    const g = (pipe, entries) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: entries.map(([binding, buffer]) => ({ binding, resource: { buffer } })) });
    set('sp', MAX_SPRITES * 32, S_RW); set('rg', MAX_RINGS * 32, S_RW); set('mo', (MAX_MOTES + MAX_RED) * 16, S_RW);
    if (!bufs.ed) { set('ed', 1024 * 8, S_RW); set('ew', 1024 * 4, S_RW); ecap = Math.max(ecap, 1024); }
    if (!bufs.nbr) { set('nbr', 64, S_RW); set('tie', 64, S_RW); }
    if (!bufs.famC) set('famC', 64 * 16, S_RW);
    if (!bufs.du) set('du', 64, S_RW);
    const per = (p) => [[0, camBuf], [1, p], [2, bufs.sty], [3, bufs.fx], [4, bufs.nd], [5, bufs.nd2]];
    groups = [bufs.pA, bufs.pB].map((p) => ({
      nodes: g(pNodes, per(p)),
      edges: g(pEdges, [...per(p), [6, bufs.ed], [7, bufs.ew]]),
      sprites: g(pSprites, [[0, camBuf], [1, p], [4, bufs.nd], [5, bufs.nd2], [8, bufs.sp]]),
      rings: g(pRings, [[0, camBuf], [1, p], [4, bufs.nd], [5, bufs.nd2], [9, bufs.rg]]),
      motes: g(pMotes, [[0, camBuf], [1, p], [4, bufs.nd], [5, bufs.nd2], [10, bufs.mo], [11, massBuf]]),
      dust: g(pDust, [[0, camBuf], [12, bufs.du]]),
    }));
    const sg = (src, dst) => g(pSim, [[0, simBuf], [1, src], [2, dst], [3, bufs.phA], [4, bufs.phB], [5, bufs.off], [6, bufs.nbr], [7, bufs.tie], [8, bufs.famC]]);
    simGroups = [sg(bufs.pA, bufs.pB), sg(bufs.pB, bufs.pA)];
  }
  function simParams(alpha, time) {
    const P = Ph.params(profile, { alpha, time, W: R.W, H: R.H });
    const u = new ArrayBuffer(80), dv = new DataView(u);
    dv.setUint32(0, R.n, true); dv.setUint32(4, profile, true); dv.setUint32(8, R.nf, true);
    [P.alpha, P.keep, P.vmax, P.reach2, P.dmin2, P.time, P.tideAmp, P.tideW, P.tideK, P.repel, P.rest, P.spring, P.center, P.cx, P.cy, 0].forEach((x, i) => dv.setFloat32(16 + i * 4, x, true));
    return { u, P };
  }
  function uploadFamilies() {
    if (profile !== Ph.PROFILES.anatomy || !R.n) return;
    R.world.pos.set(R.pos.subarray(0, R.n * 4));
    R.world.famC = Ph.families(R.world, R.nf);
    set('famC', Math.max(64, R.world.famC.byteLength), S_RW);
    device.queue.writeBuffer(bufs.famC, 0, R.world.famC);
  }
  /** one physics step on the GPU, as its own submission (its uniforms are its own) */
  function simStep(alpha, time) {
    const { u } = simParams(alpha, time);
    device.queue.writeBuffer(simBuf, 0, u);
    const enc = device.createCommandEncoder(), cp = enc.beginComputePass();
    cp.setPipeline(pSim); cp.setBindGroup(0, simGroups[flip ? 1 : 0]); cp.dispatchWorkgroups(Math.ceil(R.n / 16)); cp.end();
    device.queue.submit([enc.finish()]);
    flip = !flip; R.steps++;
  }
  const current = () => (flip ? bufs.pB : bufs.pA);   // the buffer the last step wrote (pB after an even step count's odd step)
  function readback() {
    if (reading || !R.n) return;
    reading = true;
    const n = R.n, enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(current(), 0, bufs.rb, 0, n * 16);
    device.queue.submit([enc.finish()]);
    const rb = bufs.rb;
    pendingRead = rb.mapAsync(GPUMapMode.READ, 0, n * 16).then(() => { const a = new Float32Array(rb.getMappedRange(0, n * 16)); R.pos.set(a.subarray(0, Math.min(a.length, R.n * 4))); rb.unmap(); reading = false; }).catch(() => { reading = false; });
  }
  let pendingRead = null;
  /** idle() → once the GPU has finished every frame sent and the last position read has landed: a recorder that awaits
   *  this after each frame draws every frame from the same positions every time (Build Broadcast's B4). */
  R.idle = async () => { await device.queue.onSubmittedWorkDone(); if (pendingRead) await pendingRead; };
  function labels(now) {
    g2.clearRect(0, 0, R.W, R.H);
    if (!R.labelsOn || !R.n) return;
    const cands = [];
    const x1 = R.W / R.dpr + 40, y1 = R.H / R.dpr + 40;
    const lit = R.lit || new Set(R.focus >= 0 ? [R.ids[R.focus]] : []);
    for (let i = 0; i < R.n; i++) {
      const v = R.meta[i], r = (R.sty[i * 4 + 3] * R.cam.zoom * kOf(i)) / R.dpr;
      if (r < 4.5 && v.hub !== true && !lit.has(v.id)) continue;   // too small to be named (labelPlan's own rule), so skip early
      const [x, y] = R.screenOf(i, now);
      if (x < -40 || x > x1 || y < -40 || y > y1) continue;
      cands.push({ id: v.id, x, y, r, hub: v.hub === true, label: v.label });
    }
    const plan = Lv.labelPlan(cands, lit, 160);
    g2.save(); g2.scale(R.dpr, R.dpr); g2.textAlign = 'center'; g2.textBaseline = 'top';
    for (const p of plan) {
      const v = R.meta[R.index.get(p.id)];
      g2.font = (v.hub ? '600 13px ' : '11.5px ') + 'Inter, system-ui, sans-serif';
      g2.globalAlpha = p.alpha * (R.lit && !R.lit.has(p.id) ? 0.25 : 1);
      g2.lineWidth = 3; g2.strokeStyle = 'rgba(4,5,10,0.82)'; g2.lineJoin = 'round';
      const c = v.failed ? TINT.red : v.color;
      g2.fillStyle = v.hub || v.failed ? `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})` : 'rgba(225,228,236,0.92)';
      const text = typeof R.labelFn === 'function' ? R.labelFn(v) : v.label;
      g2.strokeText(text, p.x, p.y); g2.fillText(text, p.x, p.y);
    }
    g2.restore();
  }
  let last = performance.now(), stepNow = false;
  R.frame = (now) => {
    if (lost) return;
    const dt = last === null ? 0 : Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    R.frames.push(now); while (R.frames.length && now - R.frames[0] > 2000) R.frames.shift();
    R.resize(); camera(dt);
    if (!bufs.pA) grow(64);
    if (!groups || !simGroups) makeGroups();
    if (R.n && !R.paused) {
      if (frame % 6 === 0) uploadFamilies();
      const k = profile === Ph.PROFILES.anatomy ? (R.alpha > 0.3 ? 4 : R.alpha > 0.12 ? 2 : 1) : R.warm < 900 ? 2 : 1;
      R.warm += k;
      for (let s = 0; s < k - 1; s++) { simStep(R.alpha, now / 1000); if (profile === Ph.PROFILES.anatomy) R.alpha = Ph.cool(R.alpha); }
      stepNow = true;   // the last step of the frame goes in the frame's own command buffer, before the drawing
    }
    cells(now, dt);
    const [ns, nr] = travelling(now);
    const nm = mass(now, dt);
    const o = R.heart >= 0 ? budAt(R.heart) : [R.cam.x, R.cam.y];
    device.queue.writeBuffer(camBuf, 0, new Float32Array([R.cam.x, R.cam.y, (2 * R.cam.zoom) / R.W, (-2 * R.cam.zoom) / R.H, now / 1000, 1 / R.cam.zoom, R.lit ? 1 : 0, R.hover,
      (R.tilt[0] * 2) / R.W, (-R.tilt[1] * 2) / R.H, R.W, R.H, o[0], o[1], DEPTH.persp, R.night.on && now < R.night.until ? 1 : 0]));
    const enc = device.createCommandEncoder();
    if (stepNow) {
      stepNow = false;
      device.queue.writeBuffer(simBuf, 0, simParams(R.alpha, now / 1000).u);
      const cp = enc.beginComputePass(); cp.setPipeline(pSim); cp.setBindGroup(0, simGroups[flip ? 1 : 0]); cp.dispatchWorkgroups(Math.ceil(R.n / 16)); cp.end();
      flip = !flip; R.steps++;
      if (profile === Ph.PROFILES.anatomy) R.alpha = Ph.cool(R.alpha);
    }
    const G = groups[flip ? 1 : 0];   // draw from the buffer the last step wrote (groups[1] reads pB)
    const scene = enc.beginRenderPass({ colorAttachments: [{ view: targets.hdr.createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    if (R.dust) { scene.setPipeline(pDust); scene.setBindGroup(0, G.dust); scene.draw(6, R.dust.n); }
    if (R.m && R.n) { scene.setPipeline(pEdges); scene.setBindGroup(0, G.edges); scene.draw(6, R.m); }
    if (R.n) { scene.setPipeline(pNodes); scene.setBindGroup(0, G.nodes); scene.draw(6, R.n); }
    if (nm && R.n) { scene.setPipeline(pMotes); scene.setBindGroup(0, G.motes); scene.draw(6, nm); }
    if (ns && R.n) { scene.setPipeline(pSprites); scene.setBindGroup(0, G.sprites); scene.draw(6, ns); }
    if (nr && R.n) { scene.setPipeline(pRings); scene.setBindGroup(0, G.rings); scene.draw(6, nr); }
    scene.end();
    for (const d of targets.down) { const p = enc.beginRenderPass({ colorAttachments: [{ view: d.dst.createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }] }); p.setPipeline(pDown); p.setBindGroup(0, d.group); p.draw(3); p.end(); }
    for (const u of targets.up) { const p = enc.beginRenderPass({ colorAttachments: [{ view: u.dst.createView(), loadOp: 'load', storeOp: 'store' }] }); p.setPipeline(pUp); p.setBindGroup(0, u.group); p.draw(3); p.end(); }
    device.queue.writeBuffer(targets.compU, 0, new Float32Array([1 / R.W, 1 / R.H, 0, 0.62, now / 1000, 0, 0, 0]));
    const out = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }] });
    out.setPipeline(pComp); out.setBindGroup(0, targets.comp); out.draw(3); out.end();
    device.queue.submit([enc.finish()]);
    if (frame % 3 === 0) readback();
    frame++;
    labels(now);
  };
  /** bench(frames) → the real cost of a whole frame (physics, drawing, CPU and GPU together): back to back, waiting for
   *  the GPU each time (U1a). */
  R.bench = async (frames = 120) => {
    const ms = [];
    for (let i = 0; i < frames; i++) { const a = performance.now(); R.frame(a); await device.queue.onSubmittedWorkDone(); ms.push(performance.now() - a); }
    ms.sort((x, y) => x - y);
    return { frames, medianMs: ms[frames >> 1], p95Ms: ms[Math.floor(frames * 0.95)], sustainableFps: 1000 / ms[frames >> 1], canvas: R.W + 'x' + R.H, nodes: R.n, edges: R.m, motes: R.motes, sprites: R.spriteCount, dust: R.dust ? R.dust.n : 0 };
  };
  /** physicsCheck(steps) → U1c: run `steps` steps on the GPU and the same steps in physics.mjs from the same start, and
   *  report the largest difference in any position (world units). The frame loop's own physics waits meanwhile. */
  R.physicsCheck = async (steps = 60) => {
    R.paused = true;
    try {
      while (reading) await new Promise((r) => setTimeout(r, 5));
      await device.queue.onSubmittedWorkDone();
      const n = R.n, take = async () => { const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(current(), 0, bufs.rb, 0, n * 16); device.queue.submit([enc.finish()]); await bufs.rb.mapAsync(GPUMapMode.READ, 0, n * 16); const a = new Float32Array(bufs.rb.getMappedRange(0, n * 16)).slice(); bufs.rb.unmap(); return a; };
      const start = await take();
      const W = Ph.createWorld(n); W.n = n; W.pos.set(start); W.phA.set(R.world.phA.subarray(0, n * 4)); W.phB.set(R.world.phB.subarray(0, n * 4)); W.off = R.world.off; W.nbr = R.world.nbr; W.tie = R.world.tie; W.famC = R.world.famC;
      const alpha = R.alpha, t0 = performance.now() / 1000;
      for (let s = 0; s < steps; s++) simStep(alpha, t0 + s / 60);
      await device.queue.onSubmittedWorkDone();
      const gpu = await take();
      for (let s = 0; s < steps; s++) Ph.step(W, Ph.params(profile, { alpha, time: t0 + s / 60, W: R.W, H: R.H }));
      let maxDiff = 0, maxPos = 0, moved = 0;
      for (let i = 0; i < n; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(gpu[i * 4] - W.pos[i * 4]), Math.abs(gpu[i * 4 + 1] - W.pos[i * 4 + 1]));
        maxPos = Math.max(maxPos, Math.abs(gpu[i * 4]), Math.abs(gpu[i * 4 + 1]));
        moved = Math.max(moved, Math.hypot(gpu[i * 4] - start[i * 4], gpu[i * 4 + 1] - start[i * 4 + 1]));
      }
      return { steps, nodes: n, profile: R.profile, alpha, maxDiff, maxPos, maxMoved: moved };
    } finally { R.paused = false; }
  };
  /** readStyle() → each cell's colour as the GPU holds it (U4: read from the renderer's own buffer). */
  R.readStyle = async () => {
    const n = R.n, b = device.createBuffer({ size: Math.max(16, n * 16), usage: U.MAP_READ | U.COPY_DST }), enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(bufs.sty, 0, b, 0, n * 16); device.queue.submit([enc.finish()]);
    await b.mapAsync(GPUMapMode.READ); const a = new Float32Array(b.getMappedRange()).slice(0, n * 4); b.unmap(); b.destroy();
    return a;
  };
  R.stats = () => {
    let s = 0, k = 0;
    for (let i = 0; i < R.n; i++) { if (R.world.phB[i * 4 + 1] === Ph.MODES.pinned) continue; s += Math.hypot(R.pos[i * 4 + 2], R.pos[i * 4 + 3]); k++; }
    return { nodes: R.n, edges: R.m, lights: R.lights.length, sprites: R.spriteCount, ambient: R.ambient.length, ambientLive: R.ambientLive, motes: R.motes, red: R.red.length,
      fps: R.frames.length > 1 ? ((R.frames.length - 1) * 1000) / (R.frames[R.frames.length - 1] - R.frames[0]) : 0, gpu: info, lost, steps: R.steps, alpha: R.alpha, meanSpeed: k ? s / k : 0, effects: R.effectLog.length };
  };
  R.resize();
  return R;
}

export default { createOrganism, TIMING, DEPTH };
