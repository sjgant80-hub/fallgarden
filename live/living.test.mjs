// fallgarden · live/living.test.mjs — the Living Visual's law against its claims (live/CLAIMS-living.md, sealed 083f92b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import L, { BREATH, TIDE, MASS, TRIP, FLOOR, CHARACTERS, breath, tide, characterOf, depthOf, isFailed, visibility, massOf, moteAt,
  createActivity, packetFor, effectsOf, guardEffects, labelPlan, fitRobust } from './living.mjs';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, a + ' ≠ ' + b);

test('U2: the motion without an event is stated, and frozen', () => {
  assert.deepEqual({ ...BREATH }, { period: 6, amp: 0.06, speed: 1400 });
  assert.deepEqual({ ...TIDE }, { amp: 0.06, period: 23, scale: 0.003 });
  assert.deepEqual({ ...MASS }, { perRule: 96, cap: 4096, fade: 2.4, bud: 0.9 });
  assert.deepEqual({ ...TRIP }, { base: 1.6, min: 0.55 });
  assert.equal(FLOOR, 0.55);
  assert.deepEqual([...CHARACTERS], ['plain', 'heart', 'conductor', 'gate', 'auditor', 'library', 'night']);
  for (const x of [BREATH, TIDE, MASS, TRIP, CHARACTERS]) assert.ok(Object.isFrozen(x));
});

test('the breath: a wave from the heart, 1 at rest, at most 1 + amp, period 6 s', () => {
  assert.equal(breath(0, 0), 1);
  close(breath(3, 0), 1.06);                       // the crest, half a period in
  close(breath(1.5, 0), 1 + 0.06 * 0.5);           // a quarter period: sin²(π/4) = 0.5
  close(breath(6, 0), 1, 1e-12);                   // a full period: back to rest
  close(breath(3, 1400), 1 + 0.06 * Math.sin(Math.PI * (2 / 6)) ** 2, 1e-12);   // 1,400 units out, the wave arrives 1 s later
  close(breath(3, -1400), breath(3, 1400), 1e-12);  // distance, not direction
  close(breath(4.5, 0), 1 + 0.06 * 0.5);
  for (const t of [0, 0.7, 2.2, 3, 4.9, 100]) { const b = breath(t, 333); assert.ok(b >= 1 && b <= 1.06 + 1e-12, String(b)); }
  for (const bad of [NaN, Infinity, 'x', undefined]) { assert.equal(breath(bad, 0), 1); assert.equal(breath(0, bad), 1); }
});

test('the tide: a smooth, slow current, small, and nothing for garbage', () => {
  const w = (2 * Math.PI) / 23;
  const [a, b] = tide(100, 200, 5);
  close(a, 0.06 * Math.sin(5 * w + 200 * 0.003));
  close(b, 0.06 * Math.cos(5 * w * 0.9 + 100 * 0.003));
  assert.deepEqual(tide(0, 0, 0), [0, 0.06]);
  for (const t of [0, 1, 7, 50]) for (const x of [-900, 0, 900]) { const [u, v] = tide(x, -x, t); assert.ok(Math.hypot(u, v) <= 0.06 * Math.SQRT2 + 1e-12); }
  for (const bad of [NaN, 'x', undefined, Infinity]) { assert.deepEqual(tide(bad, 0, 0), [0, 0]); assert.deepEqual(tide(0, bad, 0), [0, 0]); assert.deepEqual(tide(0, 0, bad), [0, 0]); }
});

test('each organ\'s character, from its own id and kind', () => {
  const cases = [
    [{ id: 'fall-core', kind: 'core' }, 'heart'], [{ id: 'their-core', kind: 'core' }, 'heart'],
    [{ id: 'kar', kind: 'organ' }, 'conductor'], [{ id: 'their-kar', kind: 'organ' }, 'conductor'], [{ id: 'kar', role: 'kar' }, 'conductor'],
    [{ id: 'gate', kind: 'organ' }, 'gate'], [{ id: 'their-gate', kind: 'organ' }, 'gate'],
    [{ id: 'auditor', kind: 'organ' }, 'auditor'], [{ id: 'their-auditor', kind: 'organ' }, 'auditor'],
    [{ id: 'pattern-library', kind: 'library' }, 'library'], [{ id: 'library', kind: 'organ' }, 'library'], [{ id: 'their-library', kind: 'organ' }, 'library'],
    [{ id: 'x', role: 'library' }, 'library'], [{ id: 'organ:dream-bridge', role: 'night' }, 'night'],
    [{ id: 'layer:Trust rail', kind: 'organ' }, 'plain'], [{ id: 'witness', kind: 'repo' }, 'plain'], [{ id: 'kar2' }, 'plain'],
    [null, 'plain'], ['kar', 'plain'], [[], 'plain'], [{}, 'plain'],
  ];
  for (const [n, c] of cases) assert.equal(characterOf(n), c, JSON.stringify(n));
  assert.equal(characterOf({ id: 'kar', kind: 'core' }), 'heart', 'the core first');
  assert.equal(characterOf({ id: 'gate', kind: 'library' }), 'gate', 'the gate before the library');
  assert.equal(characterOf({ id: 'auditor', role: 'library' }), 'auditor');
  assert.equal(characterOf({ id: 'library', role: 'night' }), 'library', 'the library before the night');
  assert.equal(characterOf({ id: 7, kind: 3, role: 4 }), 'plain');
});

test('depth: the heart in front, the organs just behind, the body and the brain spread over bands', () => {
  assert.equal(depthOf({ id: 'kar', role: 'kar' }), 0);
  assert.equal(depthOf({ id: 'fall-core', kind: 'core' }), 0);
  for (const n of [{ id: 'gate', kind: 'organ' }, { id: 'pattern-library', kind: 'library' }, { id: 'layer:x', kind: 'layer' }, { id: 'organ:x', kind: 'organ' },
    { id: 'model:m', role: 'model' }, { id: 'grok', role: 'grok' }, { id: 'memory', role: 'memory' }, { id: 'note:MEMORY', role: 'index' }, { id: 'n', role: 'night' }, { id: 'c', role: 'core' }]) assert.equal(depthOf(n), 0.08, n.id);
  const h = (s) => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return (x & 0xffff) / 0xffff; };
  close(depthOf({ id: 'note:a', role: 'note' }), 0.3 + h('note:a') * 0.3);
  close(depthOf({ id: 'ghost:a', role: 'ghost' }), 0.55 + h('ghost:a') * 0.3);
  close(depthOf({ id: 'witness', kind: 'repo' }), 0.18 + h('witness') * 0.4);
  close(depthOf({ id: 'witness', role: 'repo', kind: 'organ' }), 0.18 + h('witness') * 0.4);   // the role wins over the kind
  close(depthOf({ id: 'witness' }), 0.18 + h('witness') * 0.4);
  close(depthOf({ id: 'note:a', kind: 'note' }), 0.3 + h('note:a') * 0.3);   // a kind stands in for a missing role
  assert.equal(depthOf({ id: 'witness' }), depthOf({ id: 'witness' }), 'the same node always at the same depth');
  assert.notEqual(depthOf({ id: 'a' }), depthOf({ id: 'b' }));
  for (let i = 0; i < 200; i++) { const d = depthOf({ id: 'r' + i }); assert.ok(d >= 0.18 && d <= 0.58 + 1e-12); }
  assert.equal(depthOf(null), 0.5); assert.equal(depthOf('x'), 0.5);
});

test('U4: a failure is a red CI result or a failed run, and it is never dimmed below the floor', () => {
  assert.equal(isFailed({ ci: 'red' }), true); assert.equal(isFailed({ run: 'failed' }), true);
  assert.equal(isFailed({ ci: 'green', run: 'ok' }), false); assert.equal(isFailed({ run: 'running' }), false); assert.equal(isFailed(null), false); assert.equal(isFailed('red'), false);
  assert.equal(visibility(0.13, true), 0.55); assert.equal(visibility(0.13, false), 0.13);
  assert.equal(visibility(0.9, true), 0.9); assert.equal(visibility(1, false), 1);
  assert.equal(visibility(2, false), 1.5, 'at most 1.5 (a focused cell)'); assert.equal(visibility(-1, false), 0);
  assert.equal(visibility(NaN, true), 0.55); assert.equal(visibility(undefined, false), 0);
  assert.equal(visibility(0.13, 'yes'), 0.13, 'only a real true counts');
});

test('U3: the mass holds perRule motes per kept rule, up to the cap; the motes spread evenly on a sphere', () => {
  assert.equal(massOf(0), 0); assert.equal(massOf(1), 96); assert.equal(massOf(10), 960);
  assert.equal(massOf(42), 4032); assert.equal(massOf(43), 4096); assert.equal(massOf(10000), 4096);
  for (const bad of [-3, 1.5, NaN, '3', null]) assert.equal(massOf(bad), 0);
  const n = 24;
  for (let k = 0; k < n; k++) { const [x, y, z] = moteAt(k, n); close(Math.hypot(x, y, z), 1, 1e-12); }
  const [x0, y0, z0] = moteAt(0, 4);
  close(y0, 0.75); close(x0, Math.sqrt(1 - 0.5625)); close(z0, 0);
  const [x1, y1, z1] = moteAt(1, 4);
  close(y1, 0.25); close(x1, Math.cos(2.399963229728653) * Math.sqrt(1 - 0.0625)); close(z1, Math.sin(2.399963229728653) * Math.sqrt(1 - 0.0625));
  close(moteAt(3, 4)[1], -0.75);
  assert.deepEqual(moteAt(0, 1).map((v) => Math.round(v * 1e9) / 1e9), [1, 0, 0]);
  for (const [k, m] of [[4, 4], [-1, 4], [0, 0], [1.5, 4], [0, 'x']]) assert.deepEqual(moteAt(k, m), [0, 0, 0]);
});

test('activity: counts the hand-offs along each edge among the last span events', () => {
  const a = createActivity(3);
  assert.equal(a.of('x', 'y'), 0); assert.equal(a.size, 0);
  a.see({ t: 'flow', a: 'x', b: 'y' }); assert.equal(a.of('x', 'y'), 1); assert.equal(a.of('y', 'x'), 1, 'either way round');
  a.see({ t: 'flow', a: 'y', b: 'x' }); assert.equal(a.of('x', 'y'), 2);
  a.see({ t: 'ci', id: 'x' }); assert.equal(a.size, 3);
  a.see({ t: 'flow', a: 'x', b: 'z' }); assert.equal(a.of('x', 'y'), 1, 'the oldest left the window'); assert.equal(a.of('x', 'z'), 1); assert.equal(a.size, 3);
  a.see(null); assert.equal(a.of('x', 'y'), 0, 'gone entirely'); assert.equal(a.size, 3);
  a.see({ t: 'flow', a: 'x' }); a.see({ t: 'flow', a: 'x', b: 'z' }); assert.equal(a.of('x', 'z'), 1);
  a.see({ t: 'link', a: 'x', b: 'z' }); assert.equal(a.of('x', 'z'), 1, 'a link is not a hand-off');
  const d = createActivity(); for (let i = 0; i < 240; i++) d.see({ t: 'flow', a: 'p', b: 'q' });
  assert.equal(d.of('p', 'q'), 240); d.see({ t: 'flow', a: 'p', b: 'q' }); assert.equal(d.of('p', 'q'), 240, 'the default span is 240');
  for (const bad of [0, -2, 1.5, 'x']) { const b = createActivity(bad); for (let i = 0; i < 241; i++) b.see({ t: 'flow', a: 'p', b: 'q' }); assert.equal(b.of('p', 'q'), 240, String(bad)); }
});

test('a packet: faster and brighter the more the edge has carried lately', () => {
  assert.deepEqual(packetFor(0), { dur: 1.6, bright: 0.8 });
  const p1 = packetFor(1); close(p1.dur, 1.6 / 1.5); close(p1.bright, 1.05);
  const p3 = packetFor(3); close(p3.dur, 0.8); close(p3.bright, 1.3);
  const p15 = packetFor(15); close(p15.dur, 0.55, 1e-12); close(p15.bright, 1.8);
  assert.equal(packetFor(1e6).dur, 0.55); assert.equal(packetFor(1e6).bright, 2);
  close(packetFor(7).dur, 1.6 / 2.5); close(packetFor(63).bright, 2);
  for (const bad of [-1, 2.5, NaN, 'x']) assert.deepEqual(packetFor(bad), { dur: 1.6, bright: 0.8 });
});

const ids = new Set(['kar', 'gate', 'library', 'auditor', 'witness', 'layer:Trust rail', 'fall-core', 'organ:dream-bridge', 'r1', 'r2']);
const chars = { kar: 'conductor', gate: 'gate', library: 'library', auditor: 'auditor', 'fall-core': 'heart', 'organ:dream-bridge': 'night' };
const ctx = (over = {}) => ({ has: (id) => ids.has(id), character: (id) => chars[id] || 'plain', parent: (id) => (id === 'r2' ? 'r1' : undefined), activity: () => 0, judge: 'gate', heart: 'kar', ...over });

test('U2: every effect carries its cause, the event\'s own index and kind', () => {
  const all = [
    { t: 'flow', a: 'kar', b: 'gate' }, { t: 'link', a: 'r1', b: 'r2' }, { t: 'born', id: 'r2' }, { t: 'germinate', id: 'fall-core' }, { t: 'ci', id: 'witness', ok: true },
    { t: 'run', id: 'organ:dream-bridge', state: 'running' }, { t: 'receipt', id: 'witness' }, { t: 'stage', id: 'layer:Trust rail', stage: 'draft' }, { t: 'pass', rule: 'a→b' }, { t: 'drop', rule: 'c→d' },
  ];
  all.forEach((e, i) => {
    const fx = effectsOf(e, i + 7, ctx());
    assert.ok(fx.length > 0, e.t);
    for (const f of fx) assert.deepEqual(f.cause, { i: i + 7, t: e.t });
  });
});

test('U2: a hand-off is a packet, a conductor\'s hand-off fires a routing line, Kar handing cases to the gate starts the night', () => {
  assert.deepEqual(effectsOf({ t: 'flow', a: 'r1', b: 'r2' }, 0, ctx()), [{ fx: 'packet', a: 'r1', b: 'r2', dur: 1.6, bright: 0.8, tint: null, cause: { i: 0, t: 'flow' } }]);
  assert.deepEqual(effectsOf({ t: 'flow', a: 'kar', b: 'witness' }, 1, ctx({ activity: (a, b) => (a === 'kar' && b === 'witness' ? 3 : 0), tint: () => [1, 2, 3] })).map((f) => [f.fx, f.dur, f.bright, f.tint]),
    [['packet', 0.8, 1.3, [1, 2, 3]], ['fire', undefined, undefined, undefined]]);
  assert.deepEqual(effectsOf({ t: 'flow', a: 'kar', b: 'gate' }, 2, ctx()).map((f) => f.fx), ['packet', 'fire', 'night']);
  assert.equal(effectsOf({ t: 'flow', a: 'kar', b: 'gate' }, 2, ctx())[2].on, true);
  assert.deepEqual(effectsOf({ t: 'flow', a: 'gate', b: 'kar' }, 2, ctx()).map((f) => f.fx), ['packet'], 'only from the conductor');
  assert.deepEqual(effectsOf({ t: 'flow', a: 'gate', b: 'library' }, 2, ctx()).map((f) => f.fx), ['packet']);
  assert.deepEqual(effectsOf({ t: 'flow', a: 'kar', b: 'nope' }, 3, ctx()), [], 'both ends must be drawn');
  assert.deepEqual(effectsOf({ t: 'flow', a: 'nope', b: 'kar' }, 3, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'flow', a: 'kar', b: 'kar' }, 3, ctx()), [], 'never to itself');
  assert.deepEqual(effectsOf({ t: 'link', a: 'r1', b: 'r2' }, 4, ctx()), [{ fx: 'tie', a: 'r1', b: 'r2', cause: { i: 4, t: 'link' } }]);
  assert.deepEqual(effectsOf({ t: 'link', a: 'r1', b: 'zz' }, 4, ctx()), []); assert.deepEqual(effectsOf({ t: 'link', a: 'zz', b: 'r1' }, 4, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'link', a: 'r1', b: 'r1' }, 4, ctx()), []);
});

test('U2: growth buds from its parent; the seed germinates', () => {
  assert.deepEqual(effectsOf({ t: 'born', id: 'gate', to: 'kar' }, 0, ctx()), [{ fx: 'bud', id: 'gate', parent: 'kar', cause: { i: 0, t: 'born' } }]);
  assert.equal(effectsOf({ t: 'born', id: 'witness', layer: 'layer:Trust rail' }, 0, ctx())[0].parent, 'layer:Trust rail');
  assert.equal(effectsOf({ t: 'born', id: 'witness', to: 'kar', layer: 'layer:Trust rail' }, 0, ctx())[0].parent, 'kar', 'to before layer');
  assert.equal(effectsOf({ t: 'born', id: 'witness', to: 'gone', layer: 'layer:Trust rail' }, 0, ctx())[0].parent, 'layer:Trust rail', 'a parent not drawn is skipped');
  assert.equal(effectsOf({ t: 'born', id: 'r2' }, 0, ctx())[0].parent, 'r1', 'else the page\'s own parent');
  assert.equal(effectsOf({ t: 'born', id: 'r2', to: 'r2' }, 0, ctx())[0].parent, 'r1', 'never its own parent');
  assert.equal(effectsOf({ t: 'born', id: 'r1' }, 0, ctx())[0].parent, null);
  assert.equal(effectsOf({ t: 'born', id: 'r1' }, 0, ctx({ parent: 'no' }))[0].parent, null);
  assert.deepEqual(effectsOf({ t: 'layer', id: 'layer:Trust rail' }, 5, ctx()), [{ fx: 'bud', id: 'layer:Trust rail', parent: null, cause: { i: 5, t: 'layer' } }]);
  assert.deepEqual(effectsOf({ t: 'born', id: 'nope', to: 'kar' }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'germinate', id: 'fall-core' }, 0, ctx()), [{ fx: 'germinate', id: 'fall-core', cause: { i: 0, t: 'germinate' } }]);
  assert.deepEqual(effectsOf({ t: 'germinate', id: 'nope' }, 0, ctx()), []);
});

test('U2 + U4: results ring green or fail red; a running organ breathes; a night organ marks the night', () => {
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 0, ctx()), [{ fx: 'ring', id: 'witness', tint: 'green', cause: { i: 0, t: 'ci' } }]);
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: false }, 0, ctx()), [{ fx: 'fail', id: 'witness', cause: { i: 0, t: 'ci' } }]);
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: 'true' }, 0, ctx()).map((f) => f.fx), ['fail'], 'only a real true is green');
  assert.deepEqual(effectsOf({ t: 'ci', id: 'nope', ok: true }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'run', id: 'witness', state: 'running' }, 0, ctx()).map((f) => f.fx), ['breathe']);
  assert.deepEqual(effectsOf({ t: 'run', id: 'witness', state: 'ok' }, 0, ctx()).map((f) => [f.fx, f.tint]), [['ring', 'green']]);
  assert.deepEqual(effectsOf({ t: 'run', id: 'witness', state: 'failed' }, 0, ctx()).map((f) => f.fx), ['fail']);
  assert.deepEqual(effectsOf({ t: 'run', id: 'witness', state: 'odd' }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'run', id: 'organ:dream-bridge', state: 'running' }, 0, ctx()).map((f) => [f.fx, f.on]), [['breathe', undefined], ['night', true]]);
  assert.deepEqual(effectsOf({ t: 'run', id: 'organ:dream-bridge', state: 'ok' }, 0, ctx()).map((f) => [f.fx, f.on]), [['ring', undefined], ['night', false]]);
  assert.deepEqual(effectsOf({ t: 'run', id: 'organ:dream-bridge', state: 'failed' }, 0, ctx()).map((f) => [f.fx, f.on]), [['fail', undefined], ['night', false]]);
  assert.deepEqual(effectsOf({ t: 'run', id: 'organ:dream-bridge', state: 'odd' }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'run', id: 'nope', state: 'running' }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'receipt', id: 'witness' }, 0, ctx()), [{ fx: 'ring', id: 'witness', tint: 'gold', cause: { i: 0, t: 'receipt' } }]);
  assert.deepEqual(effectsOf({ t: 'receipt', id: 'nope' }, 0, ctx()), []);
  assert.deepEqual(effectsOf({ t: 'stage', id: 'layer:Trust rail', stage: 'assist' }, 0, ctx()), [{ fx: 'bloom', id: 'layer:Trust rail', stage: 'assist', cause: { i: 0, t: 'stage' } }]);
  assert.deepEqual(effectsOf({ t: 'stage', id: 'layer:Trust rail' }, 0, ctx()), []); assert.deepEqual(effectsOf({ t: 'stage', id: 'nope', stage: 'assist' }, 0, ctx()), []);
});

test('U3: a kept rule adds motes and opens the gate; a dropped rule fades and the gate refuses', () => {
  assert.deepEqual(effectsOf({ t: 'pass', rule: 'a→b' }, 3, ctx()), [{ fx: 'mote', kept: true, rule: 'a→b', cause: { i: 3, t: 'pass' } }, { fx: 'judge', id: 'gate', ok: true, cause: { i: 3, t: 'pass' } }]);
  assert.deepEqual(effectsOf({ t: 'drop', rule: 'c→d' }, 4, ctx()), [{ fx: 'mote', kept: false, rule: 'c→d', cause: { i: 4, t: 'drop' } }, { fx: 'judge', id: 'gate', ok: false, cause: { i: 4, t: 'drop' } }]);
  assert.deepEqual(effectsOf({ t: 'pass', rule: 'a→b' }, 3, ctx({ judge: 'nope' })).map((f) => f.fx), ['mote'], 'no judge drawn, no judging');
  assert.deepEqual(effectsOf({ t: 'pass', rule: 'a→b' }, 3, ctx({ judge: undefined })).map((f) => f.fx), ['mote']);
  assert.deepEqual(effectsOf({ t: 'pass' }, 3, ctx()), []); assert.deepEqual(effectsOf({ t: 'drop', rule: 5 }, 3, ctx()), []);
});

test('U2: a live event makes the heart beat once; a replayed one does not; garbage makes nothing', () => {
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 9, ctx({ live: true })).map((f) => [f.fx, f.id]), [['ring', 'witness'], ['beat', 'kar']]);
  assert.equal(effectsOf({ t: 'ci', id: 'witness', ok: true }, 9, ctx({ live: true }))[1].cause.i, 9);
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 9, ctx({ live: 'yes' })).map((f) => f.fx), ['ring']);
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 9, ctx({ live: true, heart: 'nope' })).map((f) => f.fx), ['ring']);
  assert.deepEqual(effectsOf({ t: 'ci', id: 'nope', ok: true }, 9, ctx({ live: true })), [], 'no effect, no beat');
  for (const e of [{ t: 'unknown', id: 'kar' }, { t: 'beat' }, {}, null, 'flow', [], { t: 'flow' }]) assert.deepEqual(effectsOf(e, 0, ctx({ live: true })), [], JSON.stringify(e));
  for (const i of [-1, 1.5, NaN, '3', undefined]) assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, i, ctx()), [], String(i));
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 0, null), [], 'no context: nothing is drawn, so nothing happens');
  assert.deepEqual(effectsOf({ t: 'ci', id: 'witness', ok: true }, 0, { has: () => 'yes' }), [], 'has must answer true');
  assert.deepEqual(effectsOf({ t: 'ci', id: '', ok: true }, 0, { has: () => true }), [], 'an empty id is never drawn');
  assert.deepEqual(effectsOf({ t: 'flow', a: 'kar', b: 'gate' }, 0, { has: () => true }).map((f) => f.fx), ['packet'], 'no characters given: plain');
});

test('the guardian: one shield flare per refused request newer than the last seen, caused by its entry in the guard log', () => {
  const log = [{ n: 1, at: 'x', why: 'another site' }, { n: 2, at: 'y', why: 'only GET' }, { n: 3, at: 'z', why: 'not this machine' }];
  assert.deepEqual(guardEffects(log), [
    { fx: 'shield', why: 'another site', cause: { i: 1, t: 'guard' } }, { fx: 'shield', why: 'only GET', cause: { i: 2, t: 'guard' } }, { fx: 'shield', why: 'not this machine', cause: { i: 3, t: 'guard' } }]);
  assert.deepEqual(guardEffects(log, 2).map((f) => f.cause.i), [3], 'only the new ones');
  assert.deepEqual(guardEffects(log, 3), []);
  assert.deepEqual(guardEffects(log, 1.5).map((f) => f.cause.i), [1, 2, 3], 'a seen that is not a count counts as none');
  assert.deepEqual(guardEffects([{ n: 4, why: '' }, { n: 'x', why: 'a' }, { n: 1.5, why: 'a' }, null, { why: 'a' }]), [], 'no reason or no count, no flare');
  assert.deepEqual(guardEffects('log'), []); assert.deepEqual(guardEffects(null, 0), []);
});

test('the label plan: lit first, then the hubs, then the largest on screen; no two overlap; they fade in with size', () => {
  const lit = new Set(['lit']);
  const cands = [
    { id: 'tiny', x: 900, y: 300, r: 3 }, { id: 'mid', x: 100, y: 100, r: 6, label: 'mid' }, { id: 'big', x: 505, y: 298, r: 8, label: 'big' },
    { id: 'kar', x: 300, y: 300, r: 10, hub: true, label: 'Kar' }, { id: 'wide', x: 120, y: 100, r: 5, label: 'a-very-long-label-name' },
    { id: 'lit', x: 500, y: 300, r: 1, label: 'lit' }, { id: 'nan', x: NaN, y: 1, r: 9 }, null, { x: 1, y: 1, r: 9 },
  ];
  const plan = labelPlan(cands, lit);
  assert.deepEqual(plan.map((p) => [p.id, p.x, p.y]), [['lit', 500, 305], ['kar', 300, 314], ['mid', 100, 110]]);
  assert.deepEqual(plan.slice(0, 2).map((p) => p.alpha), [1, 1]);
  close(plan[2].alpha, 0.85);
  assert.equal(labelPlan(cands, lit, 2).length, 2);
  assert.deepEqual(labelPlan([cands[1], { id: 'w', x: 180, y: 100, r: 5, label: 'a-very-long-label-name' }]).map((p) => p.id), ['mid']);
  assert.equal(labelPlan([{ id: 'r', x: 0, y: 0, r: 20 }])[0].alpha, 1);
  assert.equal(labelPlan([{ id: 'r', x: 0, y: 0, r: 4.5 }]).length, 1);
  assert.equal(labelPlan([{ id: 'r', x: 0, y: 0, r: 4.4 }]).length, 0);
  assert.equal(labelPlan([{ id: 'h', x: 0, y: 0, r: 1, hub: true }]).length, 1, 'a hub is named however small');
  assert.equal(labelPlan([{ id: 'h', x: 0, y: 0, r: 1, hub: 'yes' }]).length, 0, 'only a real true is a hub');
  const long = [{ id: 'long', x: 1000, y: 0, r: 30, label: 'x'.repeat(40) }, { id: 'next', x: 1135, y: 0, r: 29, label: 'abc' }];
  assert.deepEqual(labelPlan(long).map((p) => p.id), ['long', 'next']);
  assert.deepEqual(labelPlan([{ id: 'a', x: 0, y: 0, r: 9 }, { id: 'b', x: 0, y: 0, r: 9 }]).map((p) => p.id), ['a']);
  assert.deepEqual(labelPlan([{ id: 'b', x: 0, y: 0, r: 9 }, { id: 'a', x: 0, y: 0, r: 9, hub: true }]).map((p) => p.id), ['a'], 'a hub before a larger plain one');
  assert.deepEqual(labelPlan([{ id: 'b', x: 0, y: 0, r: 9 }, { id: 'a', x: 0, y: 0, r: 30 }]).map((p) => p.id), ['a', 'b'], 'the larger first (their rows differ, so both)');
  assert.deepEqual(labelPlan(null), []);
  assert.deepEqual(labelPlan([{ id: 'x', x: 0, y: 0, r: 1 }], 'not a set'), []);
  assert.deepEqual(labelPlan([{ id: 'x', x: 0, y: 0, r: 1 }], new Set(['x']), 0), []);
});

test('fitRobust: the camera frames the organism, not its farthest stray cell', () => {
  const pts = [];
  for (let i = 0; i <= 100; i++) pts.push(i, -i, 0, 0);
  pts.push(10000, 5000, 0, 0, NaN, 1, 0, 0);
  const p = new Float32Array(pts);
  assert.deepEqual(fitRobust(p, 103, 0), { cx: 5000, cy: 2450, w: 10000, h: 5100 });
  assert.deepEqual(fitRobust(p, 103), { cx: 50.5, cy: -49.5, w: 97, h: 97 });
  assert.deepEqual(fitRobust(p, 103, 0.5), { cx: 51, cy: -49, w: 0, h: 0 });
  assert.deepEqual(fitRobust(p, 5, 0.25), { cx: 2, cy: -2, w: 2, h: 2 });
  assert.deepEqual(fitRobust([5, 6, 0, 0], 1), { cx: 5, cy: 6, w: 0, h: 0 });
  assert.deepEqual(fitRobust(p, 103, -1), { cx: 5000, cy: 2450, w: 10000, h: 5100 });
  assert.deepEqual(fitRobust(p, 999, 0), { cx: 5000, cy: 2450, w: 10000, h: 5100 }, 'never past the end');
  assert.equal(fitRobust(p, 0), null); assert.equal(fitRobust(null, 3), null); assert.equal(fitRobust(new Float32Array([NaN, NaN, 0, 0]), 1), null);
  assert.equal(fitRobust(p, 'x'), null);
});

test('the default export carries every part, and garbage never throws', () => {
  assert.deepEqual(Object.keys(L), ['BREATH', 'TIDE', 'MASS', 'TRIP', 'FLOOR', 'CHARACTERS', 'breath', 'tide', 'characterOf', 'depthOf', 'isFailed', 'visibility', 'massOf', 'moteAt',
    'createActivity', 'packetFor', 'effectsOf', 'guardEffects', 'labelPlan', 'fitRobust']);
  const junk = [undefined, null, 0, -1, NaN, '', 'x', [], {}, [1, 2], { t: 'flow' }, new Set(), () => 1];
  for (const a of junk) for (const b of junk) {
    breath(a, b); tide(a, b, a); characterOf(a); depthOf(a); isFailed(a); visibility(a, b); massOf(a); moteAt(a, b); packetFor(a);
    effectsOf(a, 0, b); effectsOf({ t: 'flow', a: 'kar', b: 'gate' }, 0, b); guardEffects(a, b); labelPlan(a, b, b); fitRobust(a, b, b);
    const act = createActivity(a); act.see(b); act.of(a, b);
  }
});
