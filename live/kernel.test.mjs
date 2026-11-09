// live/kernel.mjs, gated: every rule of FallGarden Live with its exact answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import K, { STAGES, SIM, BANNER, PHYS, NIGHTS, KINDS, hash64, mulberry32, shuffle, emptyState, edgeKey, apply, replay, hashState, sortEvents, linkPairs,
  eventsFromEstate, auditEstate, PROPOSE_K, pairsFor, nightOf, stagesFor, growFromSeed, validProcess, simulate, packetOf, say, layoutStep } from './kernel.mjs';
import P from './vendor/patlib.mjs';

const SNAP = {
  generatedAt: '2026-05-01T00:00:00Z',
  repos: [
    { n: 'alpha', created: '2026-01-01T00:00:00Z', fam: 'x', live: true, links: ['beta'], desc: 'alpha mesh relay', topics: ['mesh'] },
    { n: 'beta', created: '2026-01-02T00:00:00Z', fam: 'y', live: false, links: ['beta', 'alpha'], desc: 'beta page', topics: [] },
    { n: 'gamma', created: '2026-01-03T00:00:00Z', fam: 'x', live: false, links: ['ghost', 'alpha'], desc: 'gamma mesh', topics: [] },
    { n: 'liveware', created: '2026-01-04T00:00:00Z', fam: 'trust-rail', live: true, links: [], desc: 'proof', topics: [] },
  ],
  layers: [{ name: 'L1', keyRepos: ['alpha', 'gamma'] }, { name: 'Empty', keyRepos: ['ghost'] }],
  receipts: [{ id: 'r1', test: 'T1' }, null],
  ci: [{ n: 'alpha', ok: true, at: '2026-02-01T00:00:00Z' }, { n: 'beta', ok: false, at: '2026-02-02T00:00:00Z' }, { n: 'ghost', ok: true, at: '2026-02-03T00:00:00Z' }],
  nights: [{ at: '2026-03-01T00:00:00Z', kept: [{ rule: 'mesh=>x' }], dropped: [{ rule: 'page=>y', why: 'held-out: covers 1, needs 5' }] }],
};

test('the sealed constants', () => {
  assert.deepEqual(STAGES, ['shadow', 'draft', 'assist', 'autonomous']);
  assert.equal(SIM, 'simulation');
  assert.equal(BANNER, 'Simulation of how your build would run, from your described process. Not yet built.');
  assert.deepEqual(PHYS, { repel: 3000, rest: 60, spring: 0.03, center: 0.002, damp: 0.85 });
  assert.equal(NIGHTS, 6); assert.equal(PROPOSE_K, 12);
  assert.deepEqual(KINDS, ['germinate', 'born', 'layer', 'link', 'receipt', 'ci', 'pass', 'drop', 'stage', 'flow']);
  assert.ok(Object.isFrozen(STAGES) && Object.isFrozen(PHYS) && Object.isFrozen(KINDS));
});

test('hash64, mulberry32 and shuffle are fixed functions', () => {
  assert.equal(hash64(''), '811c9dc5' + ((0x01000193 ^ 0x9e3779b9) >>> 0).toString(16).padStart(8, '0'));
  assert.equal(hash64('a'), 'e40c292c' + hash64('a').slice(8));
  assert.notEqual(hash64('a'), hash64('b'));
  assert.notEqual(hash64('ab').slice(8), hash64('ba').slice(8));
  assert.equal(hash64(5), hash64(''));
  assert.match(hash64('anything'), /^[0-9a-f]{16}$/);
  assert.equal(hash64('fallgarden'), hash64('fallgarden'));
  const r = mulberry32(1);
  const first = [r(), r(), r()];
  assert.deepEqual(first, (() => { const q = mulberry32(1); return [q(), q(), q()]; })());
  assert.ok(first.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(first, (() => { const q = mulberry32(2); return [q(), q(), q()]; })());
  assert.deepEqual((() => { const q = mulberry32(-1); return q(); })(), (() => { const q = mulberry32(4294967295); return q(); })(), 'seeds are taken as unsigned 32-bit');
  assert.deepEqual((() => { const q = mulberry32('x'); return q(); })(), (() => { const q = mulberry32(0); return q(); })());
  assert.equal(mulberry32(1)(), 0.6270739405881613);
  const s = shuffle([1, 2, 3, 4, 5, 6], mulberry32(7));
  assert.deepEqual([...s].sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(s, shuffle([1, 2, 3, 4, 5, 6], mulberry32(7)));
  assert.notDeepEqual(s, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(s, [5, 2, 3, 4, 6, 1], 'the exact Fisher-Yates order for seed 7');
  assert.deepEqual(shuffle(['a', 'b', 'c', 'd'], mulberry32(3)), ['b', 'd', 'a', 'c']);
  const used = mulberry32(7); shuffle([1, 2, 3, 4, 5, 6], used);
  assert.equal(used(), 0.4055216880515218, 'a shuffle of six draws exactly five numbers');
  assert.deepEqual(shuffle('x', mulberry32(1)), []);
  assert.deepEqual(shuffle([9], mulberry32(1)), [9]);
});

test('apply: every kind of event, and the ones that are counted but never drawn', () => {
  const s = emptyState();
  apply(s, { t: 'germinate', id: 'core' });
  apply(s, { t: 'born', id: 'a', kind: 'organ', to: 'core', fam: 'x', live: true });
  assert.equal(s.nodes.get('a').stage, 'shadow', 'an organ is born in the shadow stage');
  assert.equal(s.nodes.get('core').stage, null, 'the core has no stage');
  apply(s, { t: 'born', id: 'b', label: 'Bee', layer: 'nope' });
  apply(s, { t: 'layer', id: 'L', label: 'Layer', keys: ['a', 'b', 'missing'] });
  apply(s, { t: 'link', a: 'a', b: 'b', sim: true });
  apply(s, { t: 'flow', a: 'core', b: 'a' }); apply(s, { t: 'flow', a: 'a', b: 'core' });
  apply(s, { t: 'receipt', id: 'b' }); apply(s, { t: 'ci', id: 'a', ok: true }); apply(s, { t: 'ci', id: 'b', ok: 'yes' });
  apply(s, { t: 'stage', id: 'a', stage: 'assist' }); apply(s, { t: 'pass', rule: 'r1' }); apply(s, { t: 'drop', rule: 'r2' });
  assert.equal(s.applied, 13); assert.equal(s.ignored, 0);
  assert.deepEqual(s.nodes.get('core'), { id: 'core', label: 'core', kind: 'core', fam: '', live: false, ci: null, stage: null, receipts: 0, sim: false });
  assert.deepEqual(s.nodes.get('a'), { id: 'a', label: 'a', kind: 'organ', fam: 'x', live: true, ci: 'green', stage: 'assist', receipts: 0, sim: false });
  assert.deepEqual(s.nodes.get('b'), { id: 'b', label: 'Bee', kind: 'repo', fam: '', live: false, ci: 'red', stage: null, receipts: 1, sim: false });
  assert.equal(s.nodes.get('L').kind, 'layer'); assert.equal(s.nodes.get('L').stage, null);
  apply(s, { t: 'layer', id: 'L2', kind: 'organ' }); assert.equal(s.nodes.get('L2').stage, null, 'only a born organ starts in shadow');
  apply(s, { t: 'germinate', id: 'G2', kind: 'organ' }); assert.equal(s.nodes.get('G2').stage, null);
  assert.deepEqual([...s.edges.keys()].sort(), ['L|a', 'L|b', 'a|b', 'a|core']);
  assert.deepEqual(s.edges.get('a|core'), { a: 'a', b: 'core', pulses: 2, sim: false });
  assert.equal(s.edges.get('a|b').sim, true);
  assert.deepEqual(s.library, { kept: ['r1'], dropped: ['r2'] });
  // a node is born once; a re-birth changes nothing but may still add its edge
  apply(s, { t: 'born', id: 'a', kind: 'repo', fam: 'z' });
  assert.equal(s.nodes.get('a').fam, 'x');
  // what cannot be drawn is counted, never drawn
  const before = s.edges.size;
  for (const bad of [{ t: 'born' }, { t: 'link', a: 'a', b: 'ghost' }, { t: 'link', a: 'a', b: 'a' }, { t: 'flow', a: 'x', b: 'y' }, { t: 'receipt', id: 'ghost' },
    { t: 'ci', id: 'ghost', ok: true }, { t: 'stage', id: 'a', stage: 'wizard' }, { t: 'stage', id: 'ghost', stage: 'draft' }, { t: 'pass' }, { t: 'drop', rule: '' }, { t: 'nope' }, null, 5]) apply(s, bad);
  assert.equal(s.ignored, 13); assert.equal(s.applied, 16); assert.equal(s.edges.size, before);
  assert.equal(apply(null, { t: 'pass', rule: 'x' }), null);
  assert.equal(edgeKey('b', 'a'), 'a|b'); assert.equal(edgeKey('a', 'b'), 'a|b');
});

test('a sim mark rides on what the simulation makes', () => {
  const s = emptyState();
  apply(s, { t: 'germinate', id: 'c', sim: true }); apply(s, { t: 'born', id: 'd', sim: true, to: 'c' }); apply(s, { t: 'born', id: 'e', sim: 1, to: 'c' });
  assert.equal(s.nodes.get('c').sim, true); assert.equal(s.edges.get('c|d').sim, true);
  assert.equal(s.nodes.get('e').sim, false, 'only true marks a simulation'); assert.equal(s.edges.get('c|e').sim, false);
});

test('replay and hashState: the structure, never positions', () => {
  const ev = [{ t: 'germinate', id: 'c' }, { t: 'born', id: 'a', to: 'c' }, { t: 'pass', rule: 'r' }];
  assert.equal(replay(ev).applied, 3);
  assert.equal(replay(ev, 1).nodes.size, 1); assert.equal(replay(ev, 0).nodes.size, 0); assert.equal(replay(ev, 99).applied, 3); assert.equal(replay(ev, -4).applied, 0);
  assert.equal(replay(ev, 2.5).applied, 3, 'a step that is not a whole number replays everything');
  assert.equal(replay('x').applied, 0);
  const h = hashState(replay(ev));
  assert.match(h, /^[0-9a-f]{16}$/);
  const s = replay(ev); s.nodes.get('a').x = 99;
  assert.equal(hashState(s), h, 'a position never changes the hash');
  for (const change of [[{ t: 'born', id: 'z' }], [{ t: 'drop', rule: 'q' }], [{ t: 'ci', id: 'a', ok: true }], [{ t: 'stage', id: 'a', stage: 'draft' }]]) {
    assert.notEqual(hashState(replay([...ev, ...change])), h, JSON.stringify(change));
  }
  assert.notEqual(hashState(replay([...ev, { t: 'born', id: 'q' }, { t: 'link', a: 'a', b: 'q' }])), hashState(replay([...ev, { t: 'born', id: 'q' }])), 'a new edge changes the hash');
  const s2 = replay([...ev, { t: 'flow', a: 'a', b: 'c' }]);
  assert.equal(hashState(s2), h, 'a pulse along an existing edge is activity, not structure');
  assert.notEqual(hashState(replay([...ev, { t: 'pass', rule: 'r2' }])), hashState(replay([...ev.slice(0, 2), { t: 'pass', rule: 'r2' }, { t: 'pass', rule: 'r' }])), 'the order rules were kept in counts');
  assert.equal(hashState(null), hash64(''));
  assert.equal(hashState(replay([{ t: 'born', id: 'b' }, { t: 'born', id: 'a' }])), hashState(replay([{ t: 'born', id: 'a' }, { t: 'born', id: 'b' }])), 'node order does not count');
  assert.notEqual(hashState(replay([{ t: 'born', id: 'a', live: true }])), hashState(replay([{ t: 'born', id: 'a' }])));
  assert.notEqual(hashState(replay([{ t: 'born', id: 'a', sim: true }])), hashState(replay([{ t: 'born', id: 'a' }])));
  assert.notEqual(hashState(replay([{ t: 'born', id: 'a', fam: 'q' }])), hashState(replay([{ t: 'born', id: 'a' }])));
  assert.notEqual(hashState(replay([{ t: 'born', id: 'a', kind: 'organ' }])), hashState(replay([{ t: 'born', id: 'a' }])));
});

test('sortEvents: by time, then by kind in the sealed order, then by name', () => {
  const ev = [{ t: 'link', at: '2', a: 'm' }, { t: 'born', at: '2', id: 'z' }, { t: 'born', at: '2', id: 'b' }, { t: 'pass', at: '1', rule: 'r' }, { t: 'germinate', at: '3', id: 'c' }, null];
  assert.deepEqual(sortEvents(ev).map((e) => e.t + ':' + (e.id || e.a || e.rule)), ['pass:r', 'born:b', 'born:z', 'link:m', 'germinate:c']);
  assert.deepEqual(sortEvents('x'), []);
  // every part of the key decides, in order: time, then kind, then name, then input order
  const many = [{ t: 'flow', at: '1', a: 'b' }, { t: 'born', at: '1', id: 'z' }, { t: 'born', at: '0', id: 'y' }, { t: 'flow', at: '1', a: 'a' }, { t: 'born', at: '1', id: 'z', n: 2 }, { t: 'germinate', at: '1', id: 'q' }];
  assert.deepEqual(sortEvents(many).map((e) => e.t + ':' + (e.id || e.a) + (e.n || '')), ['born:y', 'germinate:q', 'born:z', 'born:z2', 'flow:a', 'flow:b']);
  assert.deepEqual(sortEvents([{ t: 'born', at: '1', id: 'b' }, { t: 'born', at: '1', id: 'a' }]).map((e) => e.id), ['a', 'b']);
  assert.deepEqual(sortEvents([{ t: 'born', at: '2', id: 'a' }, { t: 'born', at: '1', id: 'b' }]).map((e) => e.id), ['b', 'a']);
});

test('eventsFromEstate: the public snapshot as a timeline, and audit: every node and link is a real record', () => {
  const ev = eventsFromEstate(SNAP);
  assert.deepEqual(ev.map((e) => e.t + ':' + (e.id || e.a + '|' + e.b || e.rule)), [
    'born:alpha', 'layer:layer:L1', 'born:beta', 'link:alpha|beta', 'born:gamma', 'link:alpha|gamma', 'born:liveware', 'ci:alpha', 'ci:beta',
    'born:pattern-library', 'pass:undefined|undefined', 'drop:undefined|undefined', 'receipt:liveware']);
  const s = replay(ev);
  assert.equal(s.ignored, 0);
  assert.deepEqual([...s.nodes.keys()].sort(), ['alpha', 'beta', 'gamma', 'layer:L1', 'liveware', 'pattern-library']);
  assert.deepEqual([...s.edges.keys()].sort(), ['alpha|beta', 'alpha|gamma', 'alpha|layer:L1', 'gamma|layer:L1']);
  assert.equal(s.nodes.get('alpha').live, true); assert.equal(s.nodes.get('beta').live, false);
  assert.equal(ev.find((e) => e.t === 'drop').why, 'held-out: covers 1, needs 5');
  assert.equal(ev.filter((e) => e.t === 'link').length, 2, 'a coupling recorded on both ends is one edge, and a self-link is none');
  assert.equal(s.nodes.get('alpha').ci, 'green'); assert.equal(s.nodes.get('beta').ci, 'red'); assert.equal(s.nodes.get('liveware').receipts, 1);
  assert.deepEqual(s.library, { kept: ['mesh=>x'], dropped: ['page=>y'] });
  assert.equal(ev.find((e) => e.id === 'alpha').layer, 'layer:L1'); assert.equal(ev.find((e) => e.id === 'beta').layer, '');
  assert.equal(ev.find((e) => e.t === 'link' && e.b === 'gamma').at, '2026-01-03T00:00:00Z', 'a link appears when its later end is built');
  assert.deepEqual(auditEstate(SNAP, ev), { ok: true, bad: [] });
  assert.deepEqual(auditEstate(SNAP, [{ t: 'born', id: 'ghost' }, { t: 'link', a: 'alpha', b: 'liveware' }, { t: 'link', a: 'ghost', b: 'alpha' }, { t: 'layer', id: 'layer:Nope' }, { t: 'born', id: 'pattern-library' }]),
    { ok: false, bad: ['node ghost', 'link alpha|liveware', 'link ghost|alpha', 'layer layer:Nope'] });
  assert.deepEqual(auditEstate(SNAP, [{ t: 'link', a: 'beta', b: 'alpha' }]), { ok: true, bad: [] }, 'a link recorded on either end is real');
  assert.deepEqual(auditEstate(null, 'x'), { ok: true, bad: [] });
  assert.deepEqual(eventsFromEstate(null), []);
  assert.equal(eventsFromEstate({ ...SNAP, nights: [] }).some((e) => e.id === 'pattern-library'), false, 'no nights, no library node');
  assert.equal(eventsFromEstate({ ...SNAP, repos: SNAP.repos.filter((r) => r.n !== 'liveware') }).some((e) => e.t === 'receipt'), false, 'receipts need Liveware');
});

test('linkPairs: every coupling once, sorted, never to itself or outside the set', () => {
  const lk = new Map([['b', ['a', 'b', 'z']], ['a', ['b', 'c']], ['c', ['a']], ['d', null]]);
  assert.deepEqual(linkPairs(['c', 'b', 'a', 'd'], lk), [['a', 'b'], ['a', 'c']]);
  assert.deepEqual(linkPairs(['a', 'b'], lk), [['a', 'b']]);
  assert.deepEqual(linkPairs(['b'], lk), []);
  assert.deepEqual(linkPairs(['a', 'b'], 'not a map'), []);
  assert.deepEqual(linkPairs('x', lk), []);
});

test('stagesFor: an organ climbs one stage per kept rule covering its family, up to autonomous', () => {
  const kept = [{ then: 'x' }, { then: 'x' }, { then: 'y' }, { then: 'x' }, { then: 'x' }, { then: 'x' }];
  assert.deepEqual(stagesFor([{ id: 'o0', fams: ['z'] }, { id: 'o1', fams: ['y'] }, { id: 'o2', fams: ['x', 'y'] }, { id: 'o3', fams: ['x'] }], kept),
    [{ id: 'o0', stage: 'shadow' }, { id: 'o1', stage: 'draft' }, { id: 'o2', stage: 'autonomous' }, { id: 'o3', stage: 'autonomous' }]);
  assert.deepEqual(stagesFor([{ id: 'o', fams: ['x'] }], kept.slice(0, 2)), [{ id: 'o', stage: 'assist' }]);
  assert.deepEqual(stagesFor([{ id: 'o', fams: ['x'] }], [{ then: 'x' }, { then: 'x' }, { then: 'x' }]), [{ id: 'o', stage: 'autonomous' }]);
  assert.deepEqual(stagesFor([{ id: 'o', fams: ['x'] }], 'x'), [{ id: 'o', stage: 'shadow' }]);
});

test('the proposer: single words and pairs, and nothing already tried', () => {
  const tr = [];
  for (let i = 0; i < 6; i++) tr.push({ id: 't' + i, tokens: ['mesh', 'relay', 'kit'], label: 'tools', slice: 'train' });
  tr.push({ id: 'u', tokens: ['page'], label: 'other', slice: 'train' });
  assert.deepEqual(pairsFor(tr, 'tools', 5), [{ when: ['kit', 'mesh'], then: 'tools' }, { when: ['kit', 'relay'], then: 'tools' }, { when: ['mesh', 'relay'], then: 'tools' }]);
  assert.deepEqual(pairsFor(tr, 'tools', 1), [{ when: ['kit', 'mesh'], then: 'tools' }]);
  assert.deepEqual(pairsFor(tr, 'tools', -1), []);
  assert.deepEqual(pairsFor(tr, 'nobody', 5), []);
  assert.deepEqual(pairsFor('x', 'tools', 5), []);
  const counts = [];
  for (let i = 0; i < 9; i++) counts.push({ id: 'c' + i, tokens: ['zeta'], label: 'q', slice: 'train' });
  for (let i = 0; i < 5; i++) counts.push({ id: 'd' + i, tokens: ['alpha'], label: 'q', slice: 'train' });
  counts.push({ id: 'e', tokens: ['zeta', 'alpha'], label: 'q', slice: 'train' }, { id: 'f', tokens: ['alpha', 'zeta', 'zeta'], label: 'other', slice: 'train' });
  assert.deepEqual(pairsFor(counts, 'q', 1), [{ when: ['zeta', 'alpha'], then: 'q' }], 'the most frequent word comes first, not the first in the alphabet');
  // nightOf: everything proposed goes through the gate; tried rules are not proposed again
  const cases = [];
  const add = (sl, n, toks, label) => { for (let i = 0; i < n; i++) cases.push({ id: sl + toks.join('') + label + i, tokens: toks, label, slice: sl }); };
  add('train', 20, ['page'], 'scaffold'); add('train', 6, ['relay'], 'tools'); add('held', 12, ['page'], 'scaffold'); add('held', 6, ['relay'], 'tools'); add('final', 10, ['page'], 'scaffold'); add('final', 4, ['relay'], 'tools');
  const run = nightOf(cases, ['tools'], []);
  assert.deepEqual(run.promoted.map(P.ruleKey), ['relay=>tools']);
  assert.equal(run.promoted[0].prov.source, 'mined');
  const again = nightOf(cases, ['tools'], [], PROPOSE_K, new Set(['relay=>tools']));
  assert.deepEqual(again.promoted, []); assert.deepEqual(again.dropped, []);
  assert.deepEqual(nightOf(cases, ['tools'], [], PROPOSE_K, 'not a set').promoted.map(P.ruleKey), ['relay=>tools']);
  assert.deepEqual(nightOf(cases, [], []), { promoted: [], dropped: [], library: [] });
});

test('growFromSeed: the same seed grows the same company; a different seed grows a different one', () => {
  const big = { ...SNAP, repos: [], layers: [{ name: 'Mesh', keyRepos: [] }, { name: 'Pages', keyRepos: [] }] };
  // a world with a baseline: most repos are scaffold; mesh and page repos say what they are
  for (let i = 0; i < 240; i++) {
    const fam = i % 4 === 0 ? 'mesh' : i % 4 === 1 ? 'page' : 'scaffold';
    big.repos.push({ n: 'r' + i, created: '2026-01-01', fam, desc: fam === 'mesh' ? 'relay mesh node' : fam === 'page' ? 'landing page site' : 'stub wrapper api', topics: [], links: i >= 4 ? ['r' + (i - 4), 'r' + i] : [] });
    const L = big.layers[fam === 'mesh' ? 0 : 1];
    if (fam !== 'scaffold' && L.keyRepos.length < 5) L.keyRepos.push('r' + i);
  }
  const g1 = growFromSeed(1, big), g1b = growFromSeed(1, big), g2 = growFromSeed(2, big);
  assert.equal(hashState(replay(g1.events)), hashState(replay(g1b.events)));
  assert.notEqual(hashState(replay(g1.events)), hashState(replay(g2.events)));
  assert.deepEqual(g1.events, g1b.events);
  const s = replay(g1.events);
  assert.equal(s.ignored, 0);
  assert.ok(['fall-core', 'kar', 'gate', 'library', 'auditor', 'layer:Mesh', 'layer:Pages'].every((id) => s.nodes.has(id)));
  assert.equal(s.nodes.get('fall-core').kind, 'core');
  assert.equal([...s.nodes.values()].filter((n) => n.kind === 'repo').length, 10, 'five repos bud from each layer');
  assert.equal(g1.events[0].t, 'germinate');
  const chosenIds = new Set(g1.events.filter((e) => e.t === 'born' && e.kind === 'repo').map((e) => e.id));
  const links = g1.events.filter((e) => e.t === 'link');
  assert.ok(links.length >= 1, 'chosen repos that couple are linked');
  assert.ok(links.every((e) => chosenIds.has(e.a) && chosenIds.has(e.b) && e.a < e.b), 'only between chosen repos, each once, never to itself');
  assert.equal(g1.detail.length, NIGHTS);
  // G5: every kept rule passes the gate on its night's cases; every dropped one fails it
  for (const d of g1.detail) for (const key of d.kept) assert.ok(s.library.kept.includes(key));
  assert.ok(s.library.kept.length >= 1, 'this world has rules a gate keeps');
  assert.deepEqual(s.library.kept.map((k) => k.split('=>')[1]).every((f) => ['mesh', 'page'].includes(f)), true);
  // the ladder: an organ climbs one stage per kept rule covering its family
  const stages = g1.events.filter((e) => e.t === 'stage');
  assert.ok(stages.every((e) => STAGES.includes(e.stage)));
  assert.ok(stages.some((e) => e.stage !== 'shadow'));
  assert.equal(growFromSeed(1, big, 0).detail.length, 0);
  assert.equal(growFromSeed(1, big, 99).detail.length, 30, 'at most 30 nights');
  assert.equal(growFromSeed(1, big, 'x').detail.length, NIGHTS);
  assert.equal(replay(growFromSeed(1, null).events).ignored, 0);
});

test('simulate: their build, always marked, re-runnable, and it changes when their process does', () => {
  assert.equal(validProcess({ company: 'Co', steps: [{ name: 'a' }] }), true);
  for (const bad of [null, {}, { company: '', steps: [{ name: 'a' }] }, { company: 'Co', steps: [] }, { company: 'Co', steps: [{ name: '' }] }, { company: 'Co', steps: [5] }]) assert.equal(validProcess(bad), false, JSON.stringify(bad));
  assert.deepEqual(simulate({}, 1), { ok: false, why: 'a process needs a company name and at least one named step', events: [] });
  const ex = [];
  for (let i = 0; i < 40; i++) ex.push({ text: 'my landlord deposit flat ' + i, label: 'property' }, { text: 'dismissed by my employer ' + i, label: 'employment' });
  for (let i = 0; i < 80; i++) ex.push({ text: 'a general question about something ' + i, label: 'other' });
  const proc = { company: 'Co', steps: [{ name: 'Intake', who: 'reception' }, { name: 'Triage', decides: ['property', 'employment'] }, { name: 'Open' }], examples: [...ex, { text: '', label: 'x' }, null] };
  const r = simulate(proc, 1), r2 = simulate(proc, 1);
  assert.equal(r.ok, true); assert.equal(r.banner, BANNER); assert.equal(r.examples, 160);
  assert.deepEqual(r.events, r2.events);
  assert.ok(r.events.length > 0 && r.events.every((e) => e.sim === true), 'every event is marked a simulation');
  const s = replay(r.events);
  assert.equal(s.ignored, 0);
  assert.ok([...s.nodes.values()].every((n) => n.sim === true) && [...s.edges.values()].every((e) => e.sim === true));
  assert.equal(s.nodes.get('step:0').label, 'Intake · reception'); assert.equal(s.nodes.get('step:1').label, 'Triage');
  assert.ok(s.edges.has('step:1|their-gate'), 'a deciding step hands its decisions to the gate');
  assert.ok(s.edges.has('step:0|their-core') && s.edges.has('step:0|step:1') && s.edges.has('step:1|step:2'), 'the steps grow from the core in order');
  assert.equal(s.edges.has('step:1|their-core'), false);
  const s0 = replay(simulate(proc, 1, 0).events);
  assert.ok(s0.edges.has('step:0|their-core') && s0.edges.has('step:0|step:1') && s0.edges.has('step:1|step:2'), 'with no night run, the chain still grows step by step');
  assert.equal(s0.edges.has('step:1|their-core'), false);
  assert.equal(s.edges.has('step:0|their-gate'), false);
  assert.ok(s.library.kept.length >= 2);
  assert.notEqual(s.nodes.get('step:1').stage, 'shadow', 'the deciding step climbs as the library covers it');
  const fewer = simulate({ ...proc, steps: proc.steps.slice(0, 2) }, 1);
  assert.notEqual(hashState(replay(fewer.events)), hashState(s));
  assert.equal(simulate(proc, 1, 0).events.filter((e) => e.t === 'pass').length, 0);
  assert.equal(simulate(proc, 1, 'x').ok, true);
  assert.equal(simulate({ company: 'Co', steps: [{ name: 'Only' }] }, 1).library.length, 0, 'no deciding step, no library');
});

test('packetOf and say: the LIGHT line\'s message, and what it means in plain words', () => {
  assert.deepEqual(packetOf({ t: 'born', id: 'a', fam: 'x', to: 'core', layer: 'layer:L', at: '2026', label: 'ignored' }), { k: 'born', id: 'a', fam: 'x', to: 'core', layer: 'layer:L' });
  assert.deepEqual(packetOf({ t: 'ci', id: 'a', ok: true }), { k: 'ci', id: 'a', ok: true });
  assert.deepEqual(packetOf({ t: 'ci', id: 'a', ok: 'yes' }), { k: 'ci', id: 'a', ok: false });
  assert.deepEqual(packetOf({ t: 'pass', rule: 'r', sim: true }), { k: 'pass', rule: 'r', sim: 1 });
  assert.deepEqual(packetOf({ t: 'drop', rule: 'r', why: 'w', sim: 1 }), { k: 'drop', rule: 'r', why: 'w' });
  assert.equal(packetOf({ t: 'nope' }), null); assert.equal(packetOf(null), null);
  const cases = [
    [{ k: 'germinate', id: 'fall-core' }, 'fall-core germinates: the first cell'],
    [{ k: 'born', id: 'a', fam: 'x', to: 'core', layer: 'layer:L' }, 'a is built, in the x family, growing from core, part of L'],
    [{ k: 'born', id: 'a' }, 'a is built'],
    [{ k: 'layer', id: 'layer:Trust rail' }, 'Trust rail forms, a layer of the estate'],
    [{ k: 'link', a: 'a', b: 'b' }, 'a and b are coupled'],
    [{ k: 'flow', a: 'kar', b: 'gate' }, 'kar hands work to gate'],
    [{ k: 'receipt', id: 'liveware', test: 'T11', receipt: 'f63930aa' }, 'liveware publishes a receipt for T11 (f63930aa)'],
    [{ k: 'receipt', id: 'liveware' }, 'liveware publishes a receipt'],
    [{ k: 'ci', id: 'a', ok: true }, "a's checks on GitHub's runner: green"],
    [{ k: 'ci', id: 'a', ok: false }, "a's checks on GitHub's runner: red"],
    [{ k: 'pass', rule: 'r' }, 'the gate keeps a rule: r'],
    [{ k: 'drop', rule: 'r', why: 'w' }, 'the gate drops a rule: r, because w'],
    [{ k: 'drop', rule: 'r' }, 'the gate drops a rule: r'],
    [{ k: 'stage', id: 'a', stage: 'draft' }, 'a climbs to draft'],
    [{ k: 'pass', rule: 'r', sim: 1 }, 'the gate keeps a rule: r (simulation)'],
  ];
  for (const [p, want] of cases) assert.equal(say(p), want);
  assert.equal(say({ k: 'nope' }), ''); assert.equal(say(null), '');
});

test('layoutStep is FallGarden\'s own physics, number for number (the reuse, proven)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const src = html.slice(html.indexOf('function runGraphSim('), html.indexOf('function renderGraph('));
  const runGraphSim = new Function(src + '\nreturn runGraphSim;')();
  const mk = () => [{ x: 10, y: 20, vx: 0, vy: 0 }, { x: 300, y: 40, vx: 0, vy: 0 }, { x: 120, y: 260, vx: 1, vy: -2 }, { x: 121, y: 261, vx: 0, vy: 0 }];
  const links = [{ source: 0, target: 1 }, { source: 2, target: 3 }, { source: 0, target: 9 }];
  const ours = mk(), theirs = mk();
  const step = runGraphSim({ nodes: theirs, links: links.slice(0, 2) }, null, 900, 600);
  for (let i = 0; i < 25; i++) { layoutStep(ours, links, 900, 600); step(); }
  assert.deepEqual(ours, theirs);
  assert.deepEqual(layoutStep('x', null, 1, 1), []);
});

test('the default export carries every part', () => {
  assert.deepEqual(Object.keys(K), ['STAGES', 'SIM', 'BANNER', 'PHYS', 'NIGHTS', 'KINDS', 'hash64', 'mulberry32', 'shuffle', 'emptyState', 'edgeKey', 'apply', 'replay', 'hashState', 'sortEvents', 'linkPairs',
    'eventsFromEstate', 'auditEstate', 'PROPOSE_K', 'pairsFor', 'nightOf', 'stagesFor', 'growFromSeed', 'validProcess', 'simulate', 'packetOf', 'say', 'layoutStep']);
});

test('fuzz: garbage never throws', () => {
  const junk = [null, undefined, 0, NaN, '', 'x', [], [null], {}, { t: 'born' }, { repos: 'x' }, { repos: [null, { n: 5 }] }, { steps: [{}] }, [[]]];
  for (const a of junk) for (const b of junk) {
    apply(emptyState(), a); replay(a, b); hashState(a); sortEvents(a); eventsFromEstate(a); auditEstate(a, b); pairsFor(a, b, 3); nightOf(a, b, a);
    simulate(a, 1); validProcess(a); packetOf(a); say(a); layoutStep(a, b, 1, 1); shuffle(a, mulberry32(1)); hash64(a);
  }
  growFromSeed(1, { repos: [null, { n: 'a' }], layers: [null, { name: 'x', keyRepos: ['a'] }] }, 1);
});
