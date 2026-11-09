#!/usr/bin/env node
// fallgarden · live/tools/snapshot.mjs — writes live/data/estate.json, the committed PUBLIC record the estate replay is
// built from (claim G9: nothing private). Run on Kar's machine; the page and CI only ever read the file it writes.
//   · repos: GitHub's own list of the account's PUBLIC repos (name, created, archived, fork, pages), refused if any is private
//   · Kar's estate map (family, role, depth, links), kept only between public repos
//   · the estate's layers and their key repos (public ones only)
//   · Liveware's public receipts, CI of the recently finished public builds, and the pattern library's nights, with any
//     rule that names a word found only in private repos withheld
// Usage: node live/tools/snapshot.mjs [--map <estate-map.json>] [--ledger <ledger.jsonl>] [--index <estate-index.json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import P from '../vendor/patlib.mjs';

const HOME = homedir();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MAP = arg('--map', join(HOME, '.si-didy', 'patterns', 'feeds', 'estate-map.json'));
const LEDGER = arg('--ledger', join(HOME, '.si-didy', 'patterns', 'ledger.jsonl'));
const INDEX = arg('--index', join(HOME, '.claude', 'projects', 'C--Users-sjgan--claude', 'memory', 'estate-index.json'));
const OWNER = 'sjgant80-hub';
const gh = (path) => JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', path], { encoding: 'utf8', maxBuffer: 1 << 28 })).flat();
const ghOne = (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 1 << 26 }));

// 1 · the public repos, as GitHub itself reports them
const listed = gh(`/users/${OWNER}/repos?per_page=100&type=owner`);
const priv = listed.filter((r) => r.private !== false);
if (priv.length) { console.error('refused: GitHub listed ' + priv.length + ' repo(s) that are not public'); process.exit(1); }
const pub = new Map(listed.map((r) => [r.name, r]));

// 2 · Kar's map and the index's words, public repos only
const map = JSON.parse(readFileSync(MAP, 'utf8'));
const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
const words = new Map((idx.nodes || []).filter((n) => n && pub.has(n.name)).map((n) => [n.name, n]));
// a public repo's own words sometimes name a PRIVATE repo ("Companion SDK for <private>"): every such name is redacted here,
// at the source, so no private name reaches the page (the estate's private-name rule, 2026-10-31: sweep the class)
const PRIVATE = (idx.nodes || []).filter((n) => n && n.private === true && typeof n.name === 'string').map((n) => n.name).sort((a, b) => b.length - a.length);
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRIV_RE = PRIVATE.length ? new RegExp('(^|[^A-Za-z0-9-])(' + PRIVATE.map(esc).join('|') + ')(?![A-Za-z0-9-])', 'gi') : null;
const redact = (t) => (PRIV_RE ? String(t).replace(PRIV_RE, (m, pre) => pre + 'a private repo') : String(t));
const PRIVATE_WORDS = new Set(PRIVATE.map((p) => p.toLowerCase()));
const placed = new Map((map.repos || []).filter((r) => r && pub.has(r.n)).map((r) => [r.n, r]));
const repos = [...pub.values()].map((r) => {
  const m = placed.get(r.name) || {};
  const w = words.get(r.name) || {};
  return {
    n: r.name, created: r.created_at, fam: m.fam || 'unplaced', role: m.role || 'unplaced', depth: m.depth || 'unknown',
    live: !!r.has_pages, archived: !!r.archived, fork: !!r.fork,
    links: (Array.isArray(m.links) ? m.links : []).filter((x) => pub.has(x) && x !== r.name).sort(),
    desc: redact(String(w.desc || r.description || '')).slice(0, 160), topics: Array.isArray(w.topics) ? w.topics.slice(0, 8).map(redact).filter((x) => x !== 'a private repo') : [],
  };
}).sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.n < b.n ? -1 : 1));
const layers = ((map.connect && map.connect.layers) || []).map((l) => ({ name: l.name, what: redact(String(l.what || '')).slice(0, 240), keyRepos: (l.keyRepos || []).filter((x) => pub.has(x)) }));

// 3 · Liveware's public receipts (the proven parts)
const receipts = [];
try {
  for (const f of ghOne(`/repos/${OWNER}/liveware/contents/receipts`).filter((x) => /\.json$/.test(x.name))) {
    const j = JSON.parse(Buffer.from(ghOne(`/repos/${OWNER}/liveware/contents/receipts/${f.name}`).content, 'base64').toString('utf8'));
    receipts.push({ file: f.name, id: String(j.receipt || j.id || j.hash || '').slice(0, 16), test: j.test || j.name || f.name.replace(/\.json$/, ''), at: j.at || j.generated || null });
  }
} catch (e) { console.error('liveware receipts not read: ' + String(e.message).slice(0, 120)); }

// 4 · CI of the recently finished public builds (their latest run on the default branch)
const RECENT = ['liveware', 'ai-first-company', 'fall-kit', 'kardlings', 'break-it', 'living-seed', 'bred-minds', 'seed-laptop', 'watch-dream-remember',
  'bes-inward', 'acg-autopilot', 'kar-passport', 'dex-frontier', 'post-proof', 'witness', 'bot-team-kit', 'kar-voice', 'kar-mind', 'si-didy-loop',
  'konomi-tongue', 'konomi-slm', 'fallforgemint', 'pixelwhisperer', 'fallworld', 'fallkard-forge', 'fallgarden'].filter((n) => pub.has(n));
const ci = [];
for (const n of RECENT) {
  try {
    const runs = ghOne(`/repos/${OWNER}/${n}/actions/runs?per_page=1`).workflow_runs || [];
    if (runs[0]) ci.push({ n, ok: runs[0].conclusion === 'success', conclusion: runs[0].conclusion || runs[0].status, at: runs[0].updated_at, sha: String(runs[0].head_sha).slice(0, 7) });
  } catch { /* a repo with no Actions */ }
}

// 5 · the pattern library's nights: rule keys only when every word in them appears in public repos' own words
const publicWords = new Set(repos.flatMap((r) => P.tokensOf([r.n.replace(/[-_.]/g, ' '), r.desc, r.topics.join(' ')].join(' '))));
const safe = (key) => (String(key).split('=>')[0].split('+').every((t) => publicWords.has(t) && !PRIVATE_WORDS.has(t)) ? key : '(a rule naming a private word)');
const nights = [];
try {
  for (const line of readFileSync(LEDGER, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const e = JSON.parse(line);
    if (!e || e.kind !== 'pattern-night' || e.dry) continue;
    nights.push({ at: e.at, kept: (e.promoted || []).map((p) => ({ rule: safe(p.rule), held: p.held, final: p.final })), dropped: (e.dropped || []).map((d) => ({ rule: safe(d.rule), why: d.why })),
      library: e.library, finalAnswered: e.final && e.final.answered, finalN: e.final && e.final.n, calls7b: e.calls7b, callsClaude: e.callsClaude });
  }
} catch { /* no nights yet */ }

// the last line of defence: refuse to write if any private name is still anywhere in the output
const draft = JSON.stringify({ repos, layers, receipts, ci, nights });
const left = PRIV_RE ? [...draft.matchAll(PRIV_RE)].map((m) => m[2]) : [];
const leftNodes = left.filter((x) => !pub.has(x));
if (leftNodes.length) { console.error('refused: private names still in the snapshot: ' + [...new Set(leftNodes)].slice(0, 5).join(', ')); process.exit(1); }
const out = { v: 1, owner: OWNER, generatedAt: new Date().toISOString(), note: 'Public records only (claim G9); any private repo named in a public repo’s own words is redacted. Written by live/tools/snapshot.mjs.',
  counts: { repos: repos.length, links: repos.reduce((s, r) => s + r.links.length, 0), layers: layers.length, receipts: receipts.length, ci: ci.length, nights: nights.length },
  repos, layers, receipts, ci, nights };
writeFileSync(new URL('../data/estate.json', import.meta.url), JSON.stringify(out));
console.log(JSON.stringify(out.counts));
