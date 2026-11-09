// fallgarden · live/engine.test.mjs — U5: the detector says "no WebGPU" in every case it should, so the page falls back to
// the plainer 2D engine and says so; and the organism's look keeps a failure red (U4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import E, { webgpuAvailable, lookOf } from './engine.mjs';

test('U5: every branch of the detector', async () => {
  assert.equal(await webgpuAvailable(false, { gpu: { requestAdapter: async () => ({}) } }), false, 'forced off (?gpu=0)');
  assert.equal(await webgpuAvailable(undefined, undefined), false, 'no navigator');
  assert.equal(await webgpuAvailable(undefined, null), false);
  assert.equal(await webgpuAvailable(undefined, {}), false, 'no navigator.gpu');
  assert.equal(await webgpuAvailable(undefined, { gpu: { requestAdapter: async () => null } }), false, 'requestAdapter gives nothing');
  assert.equal(await webgpuAvailable(undefined, { gpu: { requestAdapter: async () => { throw new Error('denied'); } } }), false, 'requestAdapter throws');
  assert.equal(await webgpuAvailable(undefined, { gpu: { requestAdapter: () => { throw new Error('sync'); } } }), false);
  assert.equal(await webgpuAvailable(undefined, { gpu: { requestAdapter: async () => ({ name: 'a real adapter' }) } }), true, 'a real adapter');
  assert.equal(await webgpuAvailable(true, { gpu: { requestAdapter: async () => ({}) } }), true);
});

test('U5: the page names its fallback and carries no video', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8'), app = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  assert.ok(!/<video|<source[^>]+video|\.mp4|\.webm/i.test(html), 'no video in the page');
  assert.ok(app.includes('No WebGPU here: the same real state on a plainer 2D canvas'), 'the fallback says what it is');
  assert.ok(app.includes("qs.get('gpu') === '0' ? false : undefined"), '?gpu=0 forces the fallback');
});

test('U4: in the organism a failure is red, never its family or organ colour; a simulation keeps its own blue', () => {
  const red = [1.0, 0.3, 0.24];
  assert.deepEqual(lookOf({ id: 'r', kind: 'repo', fam: 'trust', ci: 'red' }).rgb, red);
  assert.deepEqual(lookOf({ id: 'kar', kind: 'organ', run: 'failed' }).rgb, red);
  assert.deepEqual(lookOf({ id: 'gate', kind: 'organ', ci: 'red' }).rgb, red);
  assert.notDeepEqual(lookOf({ id: 'r', kind: 'repo', fam: 'trust', ci: 'green' }).rgb, red);
  assert.notDeepEqual(lookOf({ id: 'r', kind: 'repo', fam: 'trust' }).rgb, red);
  assert.deepEqual(lookOf({ id: 's', kind: 'organ', sim: true }).rgb, [0.55, 0.68, 0.90]);
  assert.ok(lookOf({ id: 'r', kind: 'repo' }, 64).r > lookOf({ id: 'r', kind: 'repo' }, 0).r, 'larger the more it is linked');
  assert.ok(lookOf({ id: 'x', kind: 'organ', stage: 'autonomous' }).glow > lookOf({ id: 'x', kind: 'organ', stage: 'shadow' }).glow, 'brighter as it climbs');
  assert.deepEqual(Object.keys(E), ['createEngine', 'webgpuAvailable', 'styleOf', 'lookOf', 'CPU_CAP', 'SCALE']);
});
