// live/vendor/*: every vendored file is byte for byte what SOURCES.json pins; nothing in vendor/ is unpinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(readFileSync(new URL('live/vendor/SOURCES.json', root), 'utf8'));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

test('every vendored file matches its pinned SHA-256', () => {
  for (const f of sources.files) assert.equal(sha(readFileSync(new URL(f.path, root))), f.sha256, f.path);
});
test('nothing in vendor/ is unpinned', () => {
  const pinned = new Set(sources.files.map((f) => f.path));
  for (const name of readdirSync(new URL('live/vendor/', root))) if (name !== 'SOURCES.json') assert.ok(pinned.has('live/vendor/' + name), name + ' is not pinned');
});
test('the LIGHT codec is the one konomi-tongue pinned', () => {
  assert.equal(sources.files.find((f) => f.path === 'live/vendor/light-codec.mjs').sha256, '4f018272a05989fe8fbd0f675e0460b35365710a174a88dbf628165ef21f431d');
});
test('the check catches a single changed byte', () => {
  const buf = Buffer.from(readFileSync(new URL('live/vendor/patlib.mjs', root)));
  buf[10] ^= 1;
  assert.notEqual(sha(buf), sources.files.find((f) => f.path === 'live/vendor/patlib.mjs').sha256);
});
test('the page has no video, and carries the banner and the receipts it claims', () => {
  const html = readFileSync(new URL('live/index.html', root), 'utf8');
  assert.equal(/<video/i.test(html), false, 'G8: no video');
  const app = readFileSync(new URL('live/app.mjs', root), 'utf8');
  assert.match(app, /\$\('bannertext'\)\.textContent = K\.BANNER;/, 'G6: the banner text is the kernel\'s BANNER');
  assert.match(app, /\$\('banner'\)\.style\.display = view === 'build' \? 'block' : 'none';/, 'G6: the banner shows whenever Your build is open');
  assert.match(html, /connect-src 'self'/, 'the page talks to nothing but itself');
});
test('P2: nothing private lives in this public repo, and the private tab is hidden until this machine\'s own server answers', () => {
  const html = readFileSync(new URL('live/index.html', root), 'utf8');
  const app = readFileSync(new URL('live/app.mjs', root), 'utf8');
  assert.match(html, /<button id="v-private" aria-pressed="false" hidden /, 'the tab is hidden by default');
  assert.match(app, /\$\('v-private'\)\.hidden = !S\.private;/);
  assert.match(app, /S\.private = !!\(j && j\.ok === true && j\.server === 'garden-live'\)/, 'only the local garden-live server can reveal it');
  assert.equal((app.match(/fetch\('\.\/private\//g) || []).length, 4, 'private data is only ever fetched by relative path (hello, the snapshot, the events, the poll), from whatever served this page');
  assert.equal(/https?:\/\/[^'"]*private/.test(app), false, 'never from an absolute address');
  const snap = JSON.parse(readFileSync(new URL('live/data/estate.json', root), 'utf8'));
  assert.equal(snap.repos.some((r) => r.private === true), false, 'the public snapshot holds no private repo');
  assert.equal(readdirSync(new URL('live/', root)).includes('private'), false, 'no private folder in the repo');
});
