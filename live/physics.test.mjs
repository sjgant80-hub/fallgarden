// fallgarden · live/physics.test.mjs — the compute shader's CPU mirror: FallGarden's forces exactly, the anatomy forms,
// the same input gives the same layout, nothing is ever NaN, and it stirs without freezing (U1d). It draws only, so it
// is tested here and proven equal to the GPU in a real browser (U1c); it is not claimed mutation-clean.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import K from './kernel.mjs';
import Ph, { PROFILES, MODES, ANATOMY, FALLGARDEN, anatomyOf, tieOf, besideParent, heat, cool, params, createWorld, setSprings, families, step, meanSpeed } from './physics.mjs';

const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

function fallgardenWorld(n, links) {
  const W = createWorld(n);
  W.n = n;
  for (let i = 0; i < n; i++) { const h = fnv('n' + i); W.pos.set([200 + (h % 600), 150 + ((h >>> 10) % 400), 0, 0], i * 4); }
  setSprings(W, new Uint32Array(links.flat()), null);
  return W;
}

test('the FallGarden profile is FallGarden\'s physics: one step equals kernel.layoutStep (no tide, no stabilisers)', () => {
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [0, 5], [6, 7], [8, 9], [9, 10], [11, 0]];
  const W = fallgardenWorld(12, links);
  const nodes = [...Array(12)].map((_, i) => ({ x: W.pos[i * 4], y: W.pos[i * 4 + 1], vx: 0, vy: 0 }));
  const P = { ...params(PROFILES.fallgarden, { W: 1000, H: 700, tide: false }), reach2: Infinity, vmax: Infinity };
  for (let s = 0; s < 5; s++) {
    step(W, P);
    K.layoutStep(nodes, links.map(([a, b]) => ({ source: a, target: b })), 1000, 700);
    for (let i = 0; i < 12; i++) { assert.ok(Math.abs(W.pos[i * 4] - nodes[i].x) < 2e-3, 'x ' + i + ' step ' + s); assert.ok(Math.abs(W.pos[i * 4 + 1] - nodes[i].y) < 2e-3, 'y ' + i + ' step ' + s); }
  }
});

test('the FallGarden profile keeps the engine\'s stabilisers: a speed limit and a repulsion reach', () => {
  const W = createWorld(2); W.n = 2;
  W.pos.set([500, 500, 0, 0, 500.5, 500, 0, 0]);
  setSprings(W, new Uint32Array(0), null);
  const P = params(PROFILES.fallgarden, { W: 1000, H: 1000, tide: false });
  step(W, P);
  assert.ok(Math.hypot(W.pos[2], W.pos[3]) <= FALLGARDEN.vmax + 1e-4, 'no faster than vmax');
  const far = createWorld(2); far.n = 2;
  far.pos.set([0, 0, 0, 0, 1000, 0, 0, 0]);
  setSprings(far, new Uint32Array(0), null);
  step(far, { ...P, center: 0 });
  assert.equal(far.pos[0], 0, 'beyond the reach, no push');
  assert.deepEqual({ ...FALLGARDEN }, { repel: 3000, rest: 60, spring: 0.03, center: 0.002, damp: 0.85, vmax: 12, reach: 400 });
  for (const k of ['repel', 'rest', 'spring', 'center', 'damp']) assert.equal(FALLGARDEN[k], K.PHYS[k], k + ' is the kernel\'s');
});

function anatomyWorld() {
  const cells = [['kar', 'kar', ''], ['night-turn', 'night', ''], ['model:m', 'model', ''], ['grok', 'grok', ''], ['pattern-library', 'library', ''], ['memory', 'memory', ''], ['note:MEMORY', 'index', '']];
  for (let i = 0; i < 40; i++) cells.push(['note:n' + i, 'note', '']);
  for (let i = 0; i < 4; i++) cells.push(['ghost:g' + i, 'ghost', '']);
  for (let i = 0; i < 120; i++) cells.push(['repo' + i, 'repo', 'fam' + (i % 6)]);
  const n = cells.length, W = createWorld(n);
  W.n = n;
  const fams = new Map();
  cells.forEach(([id, role, fam], i) => {
    const a = anatomyOf(role, fam, id);
    if (!fams.has(fam)) fams.set(fam, fams.size);
    W.pos.set([a.home[0], a.home[1], 0, 0], i * 4); W.phA.set([a.q, a.ax, a.ay, a.k], i * 4); W.phB.set([a.R, a.mode, fams.get(fam), 0], i * 4);
  });
  const pairs = [], ties = [];
  const link = (a, b) => { pairs.push(a, b); ties.push(...tieOf(cells[a][1], cells[b][1])); };
  for (let i = 1; i < 7; i++) link(0, i);
  for (let i = 7; i < 47; i++) { link(6, i); if (i > 7) link(i, i - 1); }
  for (let i = 51; i < n; i++) { link(i, 51 + ((i - 51) % 6)); if (i % 9 === 0) link(i, 7 + (i % 40)); }
  link(7, 47);
  setSprings(W, new Uint32Array(pairs), new Float32Array(ties));
  return { W, cells, nf: fams.size };
}
function run(world, steps, alpha0 = 1, t0 = 0) {
  let alpha = alpha0;
  for (let s = 0; s < steps; s++) {
    world.W.famC = families(world.W, world.nf);
    step(world.W, params(PROFILES.anatomy, { alpha, time: t0 + s / 60 }));
    alpha = cool(alpha);
  }
  return alpha;
}

test('the anatomy forms: Kar held at the heart, the brain above, the body below, the organs ringed round him', () => {
  const w = anatomyWorld();
  run(w, 400);
  const { W, cells } = w;
  assert.deepEqual([W.pos[0], W.pos[1]], [0, 0], 'Kar never moves');
  const mean = (role) => { let s = 0, k = 0; cells.forEach((c, i) => { if (c[1] === role) { s += W.pos[i * 4 + 1]; k++; } }); return s / k; };
  assert.ok(mean('note') < -400, 'the brain is above: ' + mean('note'));
  assert.ok(mean('repo') > 100, 'the body is below: ' + mean('repo'));
  for (let i = 1; i < 5; i++) { const r = Math.hypot(W.pos[i * 4], W.pos[i * 4 + 1]); assert.ok(r > 80 && r < 600, cells[i][0] + ' sits round the heart at ' + r); }
});

test('same input, same layout; and never a NaN, even from coincident cells', () => {
  const a = anatomyWorld(), b = anatomyWorld();
  run(a, 120); run(b, 120);
  assert.deepEqual([...a.W.pos], [...b.W.pos]);
  const c = anatomyWorld();
  for (let i = 1; i < c.W.n; i++) c.W.pos.set([5, 5, 0, 0], i * 4);
  run(c, 60);
  for (const v of c.W.pos.subarray(0, c.W.n * 4)) assert.ok(Number.isFinite(v));
  const g = fallgardenWorld(30, [[0, 1], [1, 2]]);
  for (let i = 0; i < 30; i++) g.pos.set([300, 300, 0, 0], i * 4);
  for (let s = 0; s < 50; s++) step(g, params(PROFILES.fallgarden, { W: 600, H: 600, time: s / 60 }));
  for (const v of g.pos.subarray(0, 120)) assert.ok(Number.isFinite(v));
});

test('U1d: after settling it keeps stirring (speed above 0) and stays calm (below 2 units a step)', () => {
  const w = anatomyWorld();
  run(w, 700);
  const speeds = [];
  for (let k = 0; k < 6; k++) { run(w, 50, ANATOMY.floor, 700 / 60 + k); speeds.push(meanSpeed(w.W)); }
  for (const s of speeds) { assert.ok(s > 0.005, 'it stirs: ' + s); assert.ok(s < 2, 'it is calm: ' + s); }
  const still = anatomyWorld();
  let alpha = 1;
  for (let s = 0; s < 700; s++) { still.W.famC = families(still.W, still.nf); step(still.W, params(PROFILES.anatomy, { alpha, time: s / 60, tide: false })); alpha = cool(alpha); }
  const g = fallgardenWorld(60, [...Array(59)].map((_, i) => [i, i + 1]));
  for (let s = 0; s < 600; s++) step(g, params(PROFILES.fallgarden, { W: 1000, H: 700, time: s / 60 }));
  const sg = meanSpeed(g);
  assert.ok(sg > 0.005 && sg < 2, 'the FallGarden profile stirs too: ' + sg);
});

test('the parts: springs in compressed rows, family centres, heat and cool, ties and anatomy', () => {
  const W = createWorld(4); W.n = 4;
  setSprings(W, new Uint32Array([0, 1, 1, 2, 2, 2, 0, 9, 3, 0]), new Float32Array([10, 1, 20, 2, 30, 3, 40, 4, 50, 5]));
  assert.deepEqual([...W.off], [0, 2, 4, 5, 6]);
  assert.deepEqual([...W.nbr], [1, 3, 0, 2, 1, 0]);
  assert.deepEqual([...W.tie], [10, 1, 50, 5, 10, 1, 20, 2, 20, 2, 50, 5]);
  assert.deepEqual([0, 1, 2, 3].map((i) => W.phB[i * 4 + 3]), [2, 2, 1, 1], 'degrees, never a self link or a dangling end');
  W.pos.set([0, 0, 0, 0, 10, 20, 0, 0, 30, 40, 0, 0, 5, 5, 0, 0]);
  W.phB.set([0, MODES.body, 0, 2, 0, MODES.body, 0, 2, 0, MODES.body, 1, 1, 0, MODES.ring, 0, 1]);
  assert.deepEqual([...families(W, 2)], [5, 10, 2, 0, 30, 40, 1, 0]);
  assert.equal(heat(0.1, 400, 0), 1); assert.equal(heat(0.1, 40, 0), 0.35); assert.equal(heat(0.1, 0, 200), 0.30000000000000004); assert.equal(heat(0.9, 1, 1), 0.9); assert.equal(heat(NaN, 0, 0), 1);
  assert.ok(Math.abs(cool(1) - (1 - ANATOMY.decay)) < 1e-12); assert.equal(cool(0.06), 0.06); assert.equal(cool(0.01), 0.06); assert.equal(cool(NaN), 1 - ANATOMY.decay);
  assert.deepEqual(tieOf('note', 'repo'), [260, 0.05]); assert.deepEqual(tieOf('repo', 'ghost'), [260, 0.05]); assert.deepEqual(tieOf('note', 'index'), [34, 1]);
  assert.deepEqual(tieOf('kar', 'night'), [120, 1]); assert.deepEqual(tieOf('repo', 'repo'), [46, 1]); assert.deepEqual(tieOf('kar', 'note'), [120, 1]);
  assert.deepEqual(anatomyOf('kar', '', 'kar'), { q: -1200, mode: MODES.pinned, ax: 0, ay: 0, k: 0, R: 0, home: [0, 0] });
  const o = anatomyOf('library', '', 'pattern-library'); assert.equal(o.mode, MODES.ring); assert.equal(o.R, 180); assert.ok(Math.abs(Math.hypot(...o.home) - 180) < 1e-9);
  const nt = anatomyOf('note', '', 'note:a'); assert.equal(nt.mode, MODES.point); assert.equal(nt.k, 0.007); assert.deepEqual([nt.ax, nt.ay], ANATOMY.brain);
  assert.equal(anatomyOf('index', '', 'note:MEMORY').k, 0.08);
  const rp = anatomyOf('repo', 'scaffold', 'x'); assert.equal(rp.mode, MODES.body); assert.equal(rp.q, -22); assert.equal(rp.R, 1150);
  assert.equal(anatomyOf(undefined, undefined, 'y').q, -22);
  const [bx, by] = besideParent('abc', 100, 200); assert.ok(Math.hypot(bx - 100, by - 200) >= 14 && Math.hypot(bx - 100, by - 200) < 38);
  assert.deepEqual(besideParent('abc', 100, 200), besideParent('abc', 100, 200));
  assert.equal(params(PROFILES.fallgarden, { W: 800, H: 600 }).cx, 400);
  assert.equal(params(PROFILES.anatomy, {}).keep, Math.fround(0.6));
  assert.equal(params(PROFILES.anatomy, { tide: false }).tideAmp, 0);
  assert.deepEqual(Object.keys(Ph), ['PROFILES', 'MODES', 'ANATOMY', 'FALLGARDEN', 'anatomyOf', 'tieOf', 'besideParent', 'heat', 'cool', 'params', 'createWorld', 'setSprings', 'families', 'step', 'meanSpeed']);
});
