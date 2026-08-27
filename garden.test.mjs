// garden.test.mjs — the link engine's law, falsifiable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNote, hasNote, buildIndex, buildGraphData } from './garden.mjs';

const files = (o) => new Map(Object.entries(o).map(([p, body]) => [p, { body }]));
const seeded = () => { let s = 42; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

test('RESOLVE — exact beats suffix, .md is implied, misses are null not guesses', () => {
  const f = files({ 'a.md': '', 'deep/b.md': '', 'b.md': '' });
  assert.equal(resolveNote(f, 'a'), 'a.md');
  assert.equal(resolveNote(f, 'a.md'), 'a.md');
  assert.equal(resolveNote(f, 'b'), 'b.md', 'exact root match wins over deep/b.md');
  const g = files({ 'deep/c.md': '' });
  assert.equal(resolveNote(g, 'c'), 'deep/c.md', 'suffix match reaches into folders');
  assert.equal(resolveNote(g, 'zz'), null);
});

test('HASNOTE — exact, suffix, and miss', () => {
  const f = files({ 'x/y.md': '' });
  assert.equal(hasNote(f, 'x/y.md'), true);
  assert.equal(hasNote(f, 'y.md'), true, 'suffix /y.md');
  assert.equal(hasNote(f, 'z.md'), false);
});

test('INDEX — the verbatim 2-char-chunk law ("hello" → he,ll — the locked live behavior)', () => {
  const idx = buildIndex(files({ 'n.md': 'hello' }));
  assert.ok(idx.has('he') && idx.has('ll'), 'bigram chunks are the index keys');
  assert.ok(!idx.has('hello'), 'whole words are NOT keys — that is the locked behavior, said plainly');
  assert.ok(idx.get('he').has('n.md'));
});

test('GRAPH — links resolve and count degree at BOTH ends; self-links dropped; tags become nodes', () => {
  const g = buildGraphData(files({ 'a.md': 'see [[b]] and [[a]] #tag1', 'b.md': 'plain' }), true, seeded());
  const a = g.nodes.find((n) => n.id === 'a.md'), b = g.nodes.find((n) => n.id === 'b.md');
  const tag = g.nodes.find((n) => n.id === '#tag1');
  assert.ok(a && b && tag);
  assert.equal(a.degree, 1, 'the self-link [[a]] never counts');
  assert.equal(b.degree, 1, 'the target end counts too');
  assert.equal(g.links.length, 2, 'one note-link + one tag-link');
  const g2 = buildGraphData(files({ 'a.md': 'see [[b]] #tag1', 'b.md': '' }), false, seeded());
  assert.ok(!g2.nodes.some((n) => n.kind === 'tag'), 'includeTags=false keeps tags out');
  assert.equal(g2.links.length, 1);
});

test('GRAPH — a dangling [[link]] adds no edge; label strips folder and .md', () => {
  const g = buildGraphData(files({ 'deep/n.md': '[[nowhere]]' }), true, seeded());
  assert.equal(g.links.length, 0);
  assert.equal(g.nodes[0].label, 'n');
});
