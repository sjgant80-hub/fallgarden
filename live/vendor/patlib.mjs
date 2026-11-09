// si-didy · patlib.mjs — THE PATTERN LIBRARY'S LAW (2026-11-06; Simon's spec "Kar grows it itself, every night, on a 7B").
// A rule reads "WHEN token [AND token] THEN label". It enters the library ONLY through gate(): it must beat the baseline on
// a held-out slice AND on a final-exam slice nobody proposed from, stay inside its competence, score the same twice,
// carry its provenance, and not repeat a rule already there. The 7B only proposes; this file decides. Pure and total:
// garbage in never throws. Sealed before any code: ~/.si-didy/backups/2026-11-06-pattern-library (53cfed8).

export const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your', 'you', 'are', 'its', 'one',
  'all', 'any', 'not', 'but', 'own', 'via', 'per', 'out', 'every', 'each', 'what', 'who', 'how', 'can', 'has', 'have', 'was']);
export const GATE = Object.freeze({
  held: Object.freeze({ cover: 5, prec: 0.8, margin: 0.2 }),
  final: Object.freeze({ cover: 3, prec: 0.8, margin: 0.2 }),
  maxShare: 0.5,
  jaccard: 0.9,
});
export const MAX_7B_CALLS = 6;
export const PROVENANCE = ['source', 'model', 'proposedAt', 'feed', 'trainN'];

const str = (x) => (typeof x === 'string' ? x : '');
const arr = (x) => (Array.isArray(x) ? x : []);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function fnv(s) {
  let h = 0x811c9dc5;
  for (const ch of str(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
export function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (isObj(x)) return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
export function receiptOf(x) { return fnv(canon(x)).toString(16).padStart(8, '0'); }

export function tokensOf(text) {
  return [...new Set(str(text).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];
}
export function sliceOf(id) {
  const m = fnv(id) % 10;
  return m < 6 ? 'train' : m < 8 ? 'held' : 'final';
}
export function makeCase(c) {
  if (!isObj(c) || !str(c.id) || !str(c.label)) return null;
  return { id: c.id, tokens: tokensOf(c.text), label: c.label, slice: sliceOf(c.id) };
}
export function split(cases) {
  const s = { train: [], held: [], final: [] };
  for (const c of arr(cases)) if (isObj(c) && s[c.slice]) s[c.slice].push(c);
  return s;
}
export function majority(cases) {
  const n = new Map();
  for (const c of arr(cases)) if (isObj(c) && str(c.label)) n.set(c.label, (n.get(c.label) || 0) + 1);
  // the most cases first, then the label's own order; labels are distinct keys, so no tie survives the second key
  const ranked = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length ? ranked[0][0] : null;
}

const TOKEN = /^[a-z0-9]{3,}$/;
export function validRule(r) {
  if (!isObj(r) || !Array.isArray(r.when) || !str(r.then)) return false;
  if (r.when.length < 1 || r.when.length > 2) return false;
  if (!r.when.every((t) => TOKEN.test(str(t)))) return false;
  return new Set(r.when).size === r.when.length;
}
export function ruleKey(r) { return [...arr(r && r.when)].sort().join('+') + '=>' + str(r && r.then); }
export function fires(r, c) { return arr(c && c.tokens).length > 0 && arr(r && r.when).every((t) => c.tokens.includes(t)); }
export function score(r, cases, base) {
  const hit = arr(cases).filter((c) => fires(r, c));
  const right = hit.filter((c) => c.label === r.then).length;
  const baseRight = hit.filter((c) => c.label === base).length;
  const cover = hit.length;
  return { cover, right, prec: cover ? right / cover : 0, basePrec: cover ? baseRight / cover : 0 };
}
// With precision >= 0.8 a rule whose label differs from the baseline's always clears the 0.2 margin (the baseline can be
// right on at most the other 0.2), so on real slices the margin bites only when the rule just restates the baseline.
// It is sealed as written, and pinned exactly by testing passes() directly.
export function passes(s, bar) { return s.cover >= bar.cover && s.prec >= bar.prec && s.prec - s.basePrec >= bar.margin; }
function why(name, s, bar) {
  if (s.cover < bar.cover) return name + ': covers ' + s.cover + ', needs ' + bar.cover;
  if (s.prec < bar.prec) return name + ': right ' + s.right + ' of ' + s.cover + ', needs ' + bar.prec;
  return name + ': beats the baseline by ' + (s.prec - s.basePrec).toFixed(3) + ', needs ' + bar.margin;
}
export function jaccard(a, b) {
  const A = new Set(arr(a)), B = new Set(arr(b));
  if (!A.size && !B.size) return 1;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

/** gate(rule, slices, library) → { ok, why, receipt?, scores? }. The ONLY way into the library. */
export function gate(r, slices, library) {
  if (!validRule(r)) return { ok: false, why: 'not a rule: WHEN token [AND token] THEN label' };
  const missing = PROVENANCE.filter((k) => !isObj(r.prov) || r.prov[k] === undefined || r.prov[k] === null || r.prov[k] === '');
  if (missing.length) return { ok: false, why: 'no provenance: ' + missing.join(', ') };
  const S = isObj(slices) ? slices : {};
  const train = arr(S.train), held = arr(S.held), final = arr(S.final);
  const lib = arr(library).filter(validRule);
  const key = ruleKey(r);
  if (lib.some((x) => ruleKey(x) === key)) return { ok: false, why: 'a duplicate of ' + key };
  const mine = train.filter((c) => fires(r, c)).map((c) => c.id);
  const near = lib.find((x) => x.then === r.then && jaccard(mine, train.filter((c) => fires(x, c)).map((c) => c.id)) >= GATE.jaccard);
  if (near) return { ok: false, why: 'a near-duplicate of ' + ruleKey(near) };
  const base = majority(train);
  const h = score(r, held, base);
  if (!passes(h, GATE.held)) return { ok: false, why: why('held-out', h, GATE.held) };
  if (h.cover / held.length > GATE.maxShare) return { ok: false, why: 'outside its competence: fires on ' + h.cover + ' of ' + held.length + ' held-out cases' };
  const f = score(r, final, base);
  if (!passes(f, GATE.final)) return { ok: false, why: why('final exam', f, GATE.final) };
  const once = receiptOf({ key, base, h, f }), twice = receiptOf({ key, base, h: score(r, held, base), f: score(r, final, base) });
  if (once !== twice) return { ok: false, why: 'not deterministic: two scorings differ' };
  return { ok: true, why: 'kept', receipt: once, scores: { base, held: h, final: f } };
}

/** answer(library, case) → the first promoted rule that fires, or 'unknown'. It never guesses. */
export function answer(library, c) {
  const r = arr(library).find((x) => validRule(x) && fires(x, c));
  return r ? { answer: r.then, rule: ruleKey(r), receipt: str(r.receipt) } : { answer: 'unknown', rule: null, receipt: null };
}

/** parseProposals(text, labels) → rules from lines "WHEN a [AND b] THEN label"; only labels the feed knows. */
export function parseProposals(text, labels) {
  const known = new Set(arr(labels));
  const out = [];
  for (const line of str(text).split(/\r?\n/)) {
    const m = /\bWHEN\s+([a-z0-9]+)(?:\s+AND\s+([a-z0-9]+))?\s+THEN\s+([a-z0-9-]+)/i.exec(line);
    if (!m) continue;
    const then = m[3].toLowerCase();
    if (!known.has(then)) continue;
    const r = { when: m[2] ? [m[1].toLowerCase(), m[2].toLowerCase()] : [m[1].toLowerCase()], then };
    if (validRule(r)) out.push(r);
  }
  return out;
}

/** mine(train, label, k) → the k single tokens most precise for label on train (covering >= 5), a deterministic proposer. */
export function mine(train, label, k = 3) {
  const seen = new Map();
  for (const c of arr(train)) for (const t of arr(c && c.tokens)) {
    const e = seen.get(t) || { n: 0, right: 0 };
    e.n++; if (c.label === label) e.right++;
    seen.set(t, e);
  }
  return [...seen].filter(([, e]) => e.n >= 5 && e.right > 0)
    .sort((a, b) => b[1].right / b[1].n - a[1].right / a[1].n || b[1].right - a[1].right || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, k)).map(([t]) => ({ when: [t], then: label }));
}

/** night(cases, proposals, library) → each proposal gated in turn against the growing library; nothing else changes. */
export function night(cases, proposals, library) {
  const slices = split(cases);
  const lib = arr(library).filter(validRule).slice();
  const promoted = [], dropped = [];
  for (const p of arr(proposals)) {
    const g = gate(p, slices, lib);
    if (g.ok) { const r = { ...p, receipt: g.receipt, scores: g.scores }; lib.push(r); promoted.push(r); }
    else dropped.push({ rule: isObj(p) ? ruleKey(p) : String(p), source: isObj(p) && isObj(p.prov) ? str(p.prov.source) : '', why: g.why });
  }
  return { promoted, dropped, library: lib };
}

/** examine(library, cases) → how the library does on a slice: answered, right, and the answers in order (for L3/L7). */
export function examine(library, cases) {
  const answers = arr(cases).map((c) => answer(library, c).answer);
  const answered = answers.filter((a) => a !== 'unknown').length;
  const right = arr(cases).filter((c, i) => answers[i] !== 'unknown' && isObj(c) && answers[i] === c.label).length;
  return { n: answers.length, answered, right, answers };
}

/** share(jobs) → of the jobs, how many a pattern answered and how many were left for a model (L5). */
export function share(jobs) {
  const j = arr(jobs).filter(isObj);
  const pattern = j.filter((x) => x.by === 'pattern').length;
  return { jobs: j.length, pattern, model: j.length - pattern, share: j.length ? pattern / j.length : null };
}

export default { STOP, GATE, MAX_7B_CALLS, PROVENANCE, fnv, canon, receiptOf, tokensOf, sliceOf, makeCase, split, majority,
  validRule, ruleKey, fires, score, passes, jaccard, gate, answer, parseProposals, mine, night, examine, share };
