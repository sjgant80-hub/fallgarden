#!/usr/bin/env node
// fallgarden · live/tools/hashes.mjs — the receipts (claims G1, G2, G3, G7). It recomputes every view's final structure
// hash and round-trips every event's LIGHT packet. With no flag it writes live/receipts.json; with --check (CI) it
// recomputes and fails on any difference from the committed receipts. --gate-log <file> records the kernel's witness
// verdict (CI runs witness itself, separately, and fails if it is not clean).
import { readFileSync, writeFileSync } from 'node:fs';
import K from '../kernel.mjs';
import { prime, encode, decode } from '../vendor/light-codec.mjs';
import { LIGHT_DICT } from '../dict.mjs';

const here = (p) => new URL('../' + p, import.meta.url);
const snap = JSON.parse(readFileSync(here('data/estate.json'), 'utf8'));
const sample = JSON.parse(readFileSync(here('data/sample-process.json'), 'utf8'));
const te = new TextEncoder(), td = new TextDecoder();
const PRIMED = prime(te.encode(LIGHT_DICT));
const light = { packets: 0, json: 0, light: 0, roundtrips: 0 };
function lightOf(events) {
  for (const e of events) {
    const p = K.packetOf(e);
    if (!p) continue;
    const s = JSON.stringify(p), b = te.encode(s), r = encode(b, PRIMED);
    light.packets++; light.json += b.length;
    if (!r.ok) continue;
    light.light += r.bytes.length;
    const d = decode(r.bytes, PRIMED);
    if (d.ok && td.decode(d.bytes) === s) light.roundtrips++;
  }
}
const sum = (events) => { const s = K.replay(events); return { s, hash: K.hashState(s), events: events.length, nodes: s.nodes.size, edges: s.edges.size, ignored: s.ignored }; };

const est = K.eventsFromEstate(snap);
const e = sum(est);
const audit = K.auditEstate(snap, est);
lightOf(est);
const grow = {};
for (const seed of [1, 2, 3]) {
  const g = K.growFromSeed(seed, snap), r = sum(g.events);
  lightOf(g.events);
  grow[seed] = { hash: r.hash, events: r.events, kept: r.s.library.kept.length, dropped: r.s.library.dropped.length, climbed: [...r.s.nodes.values()].filter((n) => n.stage && n.stage !== 'shadow').length, ignored: r.ignored };
}
const sim = K.simulate(sample, 1), sr = sum(sim.events);
lightOf(sim.events);
const minus = sum(K.simulate({ ...sample, steps: sample.steps.slice(0, -1) }, 1).events);
const out = {
  v: 1, snapshot: snap.generatedAt,
  estate: { hash: e.hash, events: e.events, nodes: e.nodes, edges: e.edges, ignored: e.ignored, auditOk: audit.ok },
  grow,
  sim: { sample: { hash: sr.hash, events: sr.events, kept: sr.s.library.kept.length, examples: sim.examples, allMarked: sim.events.every((x) => x.sim === true) }, minusStep: { hash: minus.hash } },
  light,
};
const gi = process.argv.indexOf('--gate-log');
if (gi > 0) {
  const s = readFileSync(process.argv[gi + 1], 'utf8'), j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  out.gate = { total: j.total, killed: j.killed, survived: j.survived.length, ignored: j.ignored.length, clean: j.clean };
}
const problems = [];
if (!audit.ok) problems.push('G4: ' + audit.bad.slice(0, 5).join(', '));
if (e.ignored || Object.values(grow).some((g) => g.ignored) || sr.ignored) problems.push('an event could not be applied to real state');
if (grow[1].hash === grow[2].hash) problems.push('G2: seeds 1 and 2 grew the same company');
if (sr.hash === minus.hash) problems.push('G3: removing a step did not change their build');
if (!out.sim.sample.allMarked) problems.push('G6: a simulated event without the mark');
if (light.roundtrips !== light.packets) problems.push('G7: ' + (light.packets - light.roundtrips) + ' packets did not round-trip');

if (process.argv.includes('--check')) {
  const want = JSON.parse(readFileSync(here('receipts.json'), 'utf8'));
  const strip = (r) => { const c = { ...r }; delete c.gate; return JSON.stringify(c); };
  if (strip(want) !== strip(out)) problems.push('the receipts differ from what this run computed');
  if (problems.length) { console.error('RECEIPTS FAIL\n' + problems.join('\n') + '\nwant ' + strip(want) + '\ngot  ' + strip(out)); process.exit(1); }
  console.log('receipts hold: estate ' + out.estate.hash + ' · seeds ' + [1, 2, 3].map((s) => out.grow[s].hash).join(' ') + ' · sample ' + out.sim.sample.hash + ' · ' + light.roundtrips + '/' + light.packets + ' LIGHT round trips');
} else {
  if (problems.length) { console.error('NOT WRITTEN\n' + problems.join('\n')); process.exit(1); }
  if (gi < 0) { try { const old = JSON.parse(readFileSync(here('receipts.json'), 'utf8')); if (old.gate) out.gate = old.gate; } catch { /* first write */ } }
  writeFileSync(here('receipts.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
}
