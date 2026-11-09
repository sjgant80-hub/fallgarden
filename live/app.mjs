// fallgarden · live/app.mjs — the page's glue. It loads a view's events, plays them through the kernel's state one at a
// time, hands that state to the engine to draw, codes each event's message with LIGHT for the stream, and shows the
// structure hash beside the receipt CI recomputed. It decides nothing itself: the kernel does.
import K from './kernel.mjs';
import { prime, encode, decode } from './vendor/light-codec.mjs';
import { LIGHT_DICT } from './dict.mjs';
import { createEngine, CPU_CAP } from './engine.mjs';
import { mintCase, sourcesOf } from './vendor/mintcase.mjs';

const $ = (id) => document.getElementById(id);
const te = new TextEncoder(), td = new TextDecoder();
const PRIMED = prime(te.encode(LIGHT_DICT));
const qs = new URLSearchParams(location.search);
const VIEWS = {
  estate: { title: 'A company growing itself, and every node is real.', caption: 'My estate, replayed from its public records: every repo a node, every coupling an edge, every CI result and receipt as it happened. Same records, same hash, every run. Press play, or drag the timeline.', speed: 90 },
  grow: { title: 'One seed. The same company, every time.', caption: 'fall-core germinates, the organs bud, and every night the library grows through the real gate: a rule stays only if it beats a baseline on cases it never saw. Change the seed, get a different company. Same seed, the identical one.', speed: 60 },
  build: { title: 'Your build, simulated from your own process.', caption: 'Watch it run before you pay. Your steps become organs; your example cases go through the same gate. Every piece of it is a simulation, and says so.', speed: 24 },
};

const S = { view: 'estate', events: [], k: 0, playing: false, acc: 0, state: K.emptyState(), engine: null, snap: null, receipts: null, sample: null,
  stream: [], bytes: { json: 0, light: 0 }, rate: [], dirty: true, worker: null, reqId: 0, lastHash: 0, finalHash: null, receiptKey: null };

// ── LIGHT: the message of an event, coded and decodable ─────────────────────────────────────────────────────────────
const braille = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(0x2800 + u8[i]); return s; };
function code(ev) {
  const p = K.packetOf(ev);
  if (!p) return null;
  const json = te.encode(JSON.stringify(p));
  const r = encode(json, PRIMED);
  return r.ok ? { p, json: json.length, light: r.bytes } : null;
}
function pushStream(ev) {
  const c = code(ev);
  if (!c) return;
  S.bytes.json += c.json; S.bytes.light += c.light.length;
  S.stream.push({ ev, c });
  S.rate.push(performance.now());
}
function renderStream() {
  const box = $('lines');
  const from = Math.max(0, S.stream.length - 160);
  const frag = document.createDocumentFragment();
  for (let i = from; i < S.stream.length; i++) {
    const d = document.createElement('div');
    d.textContent = braille(S.stream[i].c.light);
    d.dataset.i = String(i);
    if (S.stream[i].ev.sim === true) d.className = 'sim';
    frag.appendChild(d);
  }
  box.replaceChildren(frag);
  box.scrollTop = box.scrollHeight;
  const now = performance.now();
  S.rate = S.rate.filter((t) => now - t < 1000);
  $('c-n').textContent = S.stream.length.toLocaleString();
  $('c-json').textContent = S.bytes.json.toLocaleString();
  $('c-light').textContent = S.bytes.light.toLocaleString();
  $('c-ratio').textContent = S.bytes.light ? (S.bytes.json / S.bytes.light).toFixed(2) + '×' : '–';
  $('c-rate').textContent = String(S.rate.length);
}
$('lines').addEventListener('click', (e) => {
  const el = e.target.closest('div[data-i]');
  if (!el) return;
  document.querySelectorAll('#lines .sel').forEach((x) => x.classList.remove('sel'));
  el.classList.add('sel');
  const item = S.stream[Number(el.dataset.i)];
  const out = decode(item.c.light, PRIMED);
  const box = $('decoded');
  box.replaceChildren();
  const k = document.createElement('span'); k.className = 'k'; k.textContent = 'decoded · ' + item.c.light.length + ' LIGHT bytes · ' + item.c.json + ' as JSON · ';
  const msg = document.createElement('span');
  if (!out.ok) { msg.textContent = 'refused: ' + out.why; box.append(k, msg); return; }
  const text = td.decode(out.bytes), same = text === JSON.stringify(item.c.p);
  msg.textContent = K.say(JSON.parse(text)) + (same ? '  ✓ exactly the message sent' : '  ✗ differs from the message sent');
  box.append(k, msg);
});

// ── views ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function ask(msg) {
  return new Promise((resolve) => {
    if (!S.worker) S.worker = new Worker(new URL('./grow-worker.mjs', import.meta.url), { type: 'module' });
    const id = ++S.reqId;
    const on = (e) => { if (e.data && e.data.id === id) { S.worker.removeEventListener('message', on); resolve(e.data); } };
    S.worker.addEventListener('message', on);
    S.worker.postMessage({ ...msg, id });
  });
}
// where a new node first appears (drawing only, never the hash): beside its parent organ, else its layer, else the first
// node of its own family, so families gather into readable clusters instead of all starting in the middle
const famFirst = new Map();
function parentOf(ev, state) {
  if (ev.to) return ev.to;
  if (ev.layer && state.nodes.has(ev.layer)) return ev.layer;
  if (ev.fam) { if (!famFirst.has(ev.fam)) { famFirst.set(ev.fam, ev.id); return undefined; } return famFirst.get(ev.fam); }
  return undefined;
}
function load(events, receiptKey) {
  famFirst.clear();
  S.events = events; S.k = 0; S.acc = 0; S.state = K.emptyState(); S.stream = []; S.bytes = { json: 0, light: 0 }; S.finalHash = null; S.receiptKey = receiptKey;
  const fin = K.replay(events);
  S.engine.reset(fin.nodes.size + 4, fin.edges.size + 4);
  $('scrub').max = String(events.length); $('scrub').value = '0';
  $('decoded').innerHTML = '<span class="k">decoded</span> · click any line to turn its LIGHT bytes back into the message and read it in plain words.';
  S.dirty = true; updateChips(true); renderStream(); engineNote();
}
function applyUpTo(k, stream) {
  const now = performance.now();
  while (S.k < k && S.k < S.events.length) {
    const ev = S.events[S.k++];
    const parent = (ev.t === 'born' || ev.t === 'layer' || ev.t === 'germinate') ? parentOf(ev, S.state) : undefined;
    K.apply(S.state, ev);
    if (parent !== undefined && S.state.nodes.has(ev.id)) S.state.nodes.get(ev.id).parent = parent;
    if (ev.t === 'born' && ev.kind === 'library') S.engine.libraryId = ev.id;
    if (stream) { S.engine.pulse(ev, now); pushStream(ev); }
    S.dirty = true;
  }
}
function seekTo(k) {
  const target = Math.max(0, Math.min(k, S.events.length));
  if (target < S.k) {
    const evs = S.events, key = S.receiptKey;
    const lib = S.engine.libraryId;
    load(evs, key); S.engine.libraryId = lib;
  }
  // a jump replays silently, then streams the last few events so the strip still shows where you are
  const quiet = Math.max(S.k, target - 40);
  applyUpTo(quiet, false);
  applyUpTo(target, true);
}
async function setView(view) {
  S.view = view; S.playing = false; $('play').textContent = '▶ Play';
  for (const v of ['estate', 'grow', 'build']) $('v-' + v).setAttribute('aria-pressed', String(v === view));
  $('title').textContent = VIEWS[view].title; $('caption').textContent = VIEWS[view].caption; $('speed').value = String(VIEWS[view].speed);
  $('seedbox').hidden = view !== 'grow';
  $('buildform').classList.toggle('on', view === 'build');
  $('banner').style.display = view === 'build' ? 'block' : 'none';
  $('bannertext').textContent = K.BANNER;
  S.engine.libraryId = view === 'grow' ? 'library' : view === 'build' ? 'their-library' : undefined;
  if (view === 'estate') { load(K.eventsFromEstate(S.snap), 'estate'); return; }
  if (view === 'grow') { await grow(); return; }
  await simulateFromForm();
}
async function grow() {
  const seed = Math.max(0, Math.min(4294967295, Math.floor(Number($('seed').value) || 0)));
  $('engine').textContent = 'growing from seed ' + seed + ' (the gate runs in a worker)…';
  const r = await ask({ mode: 'grow', seed });
  if (!r.ok) { $('engine').textContent = 'growing failed: ' + r.why; return; }
  S.engine.libraryId = 'library';
  load(r.events, 'grow:' + seed);
}

// ── your build: the form ────────────────────────────────────────────────────────────────────────────────────────────
function fillForm(p) {
  $('company').value = p.company;
  $('steps').value = p.steps.map((s) => [s.name, s.who || '', (s.decides || []).join(', ')].join(' | ').replace(/( \| )+$/, '')).join('\n');
  $('examples').value = p.examples.map((x) => x.label + ': ' + x.text).join('\n');
}
function readForm() {
  const steps = $('steps').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, who, decides] = l.split('|').map((x) => (x || '').trim());
    return { name, who, decides: decides ? decides.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) : [] };
  });
  const examples = $('examples').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(':');
    return i > 0 ? { label: l.slice(0, i).trim().toLowerCase(), text: l.slice(i + 1).trim() } : null;
  }).filter(Boolean);
  return { company: $('company').value.trim(), steps, examples };
}
async function simulateFromForm() {
  const proc = readForm();
  $('builderr').textContent = '';
  if (!K.validProcess(proc)) { $('builderr').textContent = 'Give the company a name and at least one step with a name.'; return; }
  $('engine').textContent = 'growing their build (a simulation)…';
  const r = await ask({ mode: 'sim', process: proc, seed: 1 });
  if (!r.ok) { $('builderr').textContent = r.why; return; }
  S.engine.libraryId = 'their-library';
  const same = S.sample && JSON.stringify(proc) === JSON.stringify(normalised(S.sample));
  load(r.events, same ? 'sim:sample' : null);
  if (r.examples < 20) $('builderr').textContent = 'With ' + r.examples + ' example cases the gate has little to learn from; a few dozen per decision lets it keep rules.';
}
const normalised = (p) => ({ company: p.company, steps: p.steps.map((s) => ({ name: s.name, who: s.who || '', decides: s.decides || [] })), examples: p.examples.map((x) => ({ label: x.label, text: x.text })) });

// ── chips, notes, results ───────────────────────────────────────────────────────────────────────────────────────────
function updateChips(force) {
  const now = performance.now();
  if (!force && now - S.lastHash < 250) return;
  S.lastHash = now;
  const h = K.hashState(S.state);
  $('hash').textContent = h;
  $('stepinfo').textContent = S.k.toLocaleString() + ' / ' + S.events.length.toLocaleString();
  $('scrub').value = String(S.k);
  const chip = $('receiptchip');
  chip.classList.remove('ok', 'bad');
  const want = receiptFor(S.receiptKey);
  if (S.k < S.events.length) { $('receipt').textContent = want ? 'at the end' : S.view === 'build' ? 'your own process: no receipt' : '—'; return; }
  if (!want) { $('receipt').textContent = S.view === 'build' ? 'your own process: no receipt' : 'none for this seed'; return; }
  const ok = want === h;
  chip.classList.add(ok ? 'ok' : 'bad');
  $('receipt').textContent = ok ? '✓ matches CI' : '✗ differs from CI';
}
function receiptFor(key) {
  const R = S.receipts;
  if (!R || !key) return null;
  if (key === 'estate') return R.estate && R.estate.hash;
  if (key === 'sim:sample') return R.sim && R.sim.sample && R.sim.sample.hash;
  if (key.startsWith('grow:')) { const g = R.grow && R.grow[key.slice(5)]; return g ? g.hash : null; }
  return null;
}
function engineNote() {
  const e = S.engine;
  const hidden = e.kind === 'canvas2d' && e.hidden ? ' · this 2D view lays out ' + e.ids.length.toLocaleString() + ' nodes; the ' + e.hidden.toLocaleString() + ' scaffold repos are left out (the GPU view draws every node)' : '';
  $('engine').textContent = (e.kind === 'webgpu' ? 'WebGPU: FallGarden\'s forces on your GPU, every node' : 'No WebGPU here: the same real state on a 2D canvas') + hidden;
}
function fillFacts() {
  const c = S.snap.counts;
  $('s-repos').textContent = c.repos.toLocaleString(); $('s-links').textContent = c.links.toLocaleString(); $('s-ci').textContent = String(c.ci); $('s-receipts').textContent = String(c.receipts);
  $('s-date').textContent = String(S.snap.generatedAt).slice(0, 10);
  const R = S.receipts, ul = $('results');
  ul.replaceChildren();
  const li = (t) => { const x = document.createElement('li'); x.textContent = t; ul.appendChild(x); };
  if (!R) { li('receipts.json did not load.'); return; }
  li(`Your estate: ${R.estate.events.toLocaleString()} events build ${R.estate.nodes.toLocaleString()} nodes and ${R.estate.edges.toLocaleString()} edges; final hash ${R.estate.hash}, recomputed by CI.`);
  for (const [seed, g] of Object.entries(R.grow)) li(`Seed ${seed}: ${g.events} events; the gate kept ${g.kept} rule${g.kept === 1 ? '' : 's'} and dropped ${g.dropped.toLocaleString()}; ${g.climbed} organ${g.climbed === 1 ? '' : 's'} climbed; hash ${g.hash}.`);
  li(`The example law firm: the gate kept ${R.sim.sample.kept} rules from ${R.sim.sample.examples} synthetic enquiries; hash ${R.sim.sample.hash}. With one step removed, the hash is ${R.sim.minusStep.hash}.`);
  li(`LIGHT: all ${R.light.packets.toLocaleString()} packets across the three views round-trip exactly; ${R.light.json.toLocaleString()} bytes as JSON, ${R.light.light.toLocaleString()} as LIGHT (${(R.light.json / R.light.light).toFixed(2)}× smaller).`);
  if (R.gate) li(`The kernel's mutation gate: ${R.gate.killed} of ${R.gate.total} deliberately broken copies caught, ${R.gate.survived} survived, ${R.gate.ignored} baselined.`);
}
function fillBlueprint() {
  const B = [
    ['kernel.mjs', 'The law: events, the state they build, the structure hash, the estate replay, growth from a seed, the simulation, each event\'s message and its plain words, and FallGarden\'s physics.', S.receipts && S.receipts.gate ? `mutation gate: ${S.receipts.gate.killed}/${S.receipts.gate.total} caught, ${S.receipts.gate.ignored} baselined; tests in CI` : 'mutation-gated in CI'],
    ['vendor/patlib.mjs', 'The pattern library\'s gate, byte for byte from Kar\'s body: held-out win, final exam, competence, determinism, provenance, no duplicate.', 'witness 70/70 where it was built; its SHA-256 is pinned in vendor/SOURCES.json and checked by the tests'],
    ['vendor/light-codec.mjs', 'LIGHT, the lossless context-mixing codec from konomi-tongue, byte for byte.', 'SHA-256 pinned; every packet round-trips in CI'],
    ['dict.mjs', 'The shared dictionary the stream is coded with, so a line decodes the same in your tab and on the runner.', 'used by the page and by tools/hashes.mjs'],
    ['data/estate.json', 'The public snapshot: repos and creation dates as GitHub lists them, Kar\'s map, layers, Liveware\'s receipts, recent CI, the library\'s nights.', 'written by tools/snapshot.mjs, which refuses to write anything private'],
    ['data/sample-process.json', 'The example law firm for Your build. Its enquiries are synthetic, written from templates by tools/sample.mjs.', 'labelled synthetic in the file and on the page'],
    ['engine.mjs', 'The renderer: a WGSL compute shader runs FallGarden\'s forces over every node; nodes, edges and library particles are GPU instances. The fallback is a 2D canvas.', 'draws state; never invents it'],
    ['grow-worker.mjs', 'Runs the growth and the simulation off the main thread, so the gate\'s work never freezes the page.', 'same kernel as CI'],
    ['vendor/mintcase.mjs + vendor/basis.json', 'The cost case for one process, byte for byte from Liveware: staff time today, the two rented routes and owning it, from sourced figures and your own inputs.', 'witness 21/0 in Liveware; SHA-256 pinned here'],
    ['tools/hashes.mjs', 'Recomputes every view\'s final hash and every packet\'s round trip; with --check it fails the build on any difference.', 'runs on GitHub\'s runner on every push'],
  ];
  const box = $('organs');
  box.replaceChildren();
  for (const [f, what, gate] of B) {
    const c = document.createElement('div'); c.className = 'card';
    const h = document.createElement('h3'); h.textContent = f;
    const p = document.createElement('p'); p.textContent = what;
    const g = document.createElement('p'); g.style.marginTop = '6px'; g.style.color = 'var(--sage)'; g.textContent = gate;
    c.append(h, p, g); box.appendChild(c);
  }
}

// ── for business: the cost case, computed by vendor/mintcase.mjs (Liveware's, byte for byte) from the sourced basis ──
const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');
function renderCost() {
  const basis = S.basis, box = $('c-head');
  if (!basis) { box.textContent = 'The sourced basis did not load; reload the page.'; return; }
  const v = (id) => Number($(id).value);
  const r = mintCase(basis, { hoursPerWeek: v('c-hours'), share: v('c-share') / 100, seats: v('c-seats'), casesPerWeek: v('c-cases'), years: v('c-years') });
  if (!r.ok) { box.textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const n = r.inputs.years, yrs = n + (n === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  box.textContent = `This process costs you ${gbp(r.perYear.today)} a year in staff time today. Owning it: ${gbp(r.perYear.own)} a year, which is ${gbp(r.savingPerYear)} a year back and ${gbp(r.savingOver)} over ${yrs}.`;
  const rows = [
    ['Today', 'Your team does all of it.', 'today'],
    ['Rent AI assistant seats', `Microsoft 365 Copilot for ${r.inputs.seats} people (${gbp(r.lines.seats)} a year). It helps each person; the work, and the staff time, stay.`, 'rentSeats'],
    ['Call a cloud AI on every case', `Takes the same share off, billed per case at Claude Sonnet 5 API rates (${gbp(r.lines.api)} a year at your volume), and every case leaves your building.`, 'cloudApi'],
    ['Own it (mint-a-department)', `Takes the same share off on a machine you already have, for about ${gbp(r.lines.power)} a year of electricity, always on. No seats, no meter, nothing leaves.`, 'own'],
  ];
  const tb = $('c-table').querySelector('tbody');
  tb.replaceChildren();
  for (const [route, what, k] of rows) {
    const tr = document.createElement('tr');
    for (const [txt, bold] of [[route, true], [what, false], [gbp(r.perYear[k]), false], [gbp(r.over[k]), false]]) { const td = document.createElement('td'); if (bold) { const b = document.createElement('b'); b.textContent = txt; td.appendChild(b); } else td.textContent = txt; tr.appendChild(td); }
    tb.appendChild(tr);
  }
  $('c-note').textContent = `Owning beats the cloud route by ${gbp(r.versusCloudOver)} over ${yrs} at this volume. At low volumes the per-case bill is small, and the real difference is that nothing leaves your building. Staff time is a floor: the UK median wage, with on-costs left out.`;
  $('c-board').textContent = `Pick one process. Today it costs ${gbp(r.perYear.today)} a year in staff time, a floor at the UK median wage. If an owned system takes off the share you estimate, that is ${gbp(r.savingPerYear)} a year back, on hardware you already have, with nothing leaving the building. The fee is agreed in a baseline agreement and is due only on a receipt that shows the system beat your current way on your own data. Watch the process run in Your build first, then decide on evidence.`;
}
function fillSources() {
  const ul = $('c-src');
  ul.replaceChildren();
  for (const s of sourcesOf(S.basis || {})) {
    const li = document.createElement('li'); li.textContent = s.what + (s.source ? ': ' : '');
    if (s.source) { const a = document.createElement('a'); a.href = s.source; a.target = '_blank'; a.rel = 'noopener'; try { a.textContent = new URL(s.source).hostname; } catch { a.textContent = s.source; } li.appendChild(a); }
    ul.appendChild(li);
  }
}

// ── the loop and the controls ───────────────────────────────────────────────────────────────────────────────────────
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [$('gl'), $('overlay')]) { c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr); }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing && S.k < S.events.length) {
    S.acc += dt * Number($('speed').value);
    const n = Math.floor(S.acc);
    if (n > 0) { S.acc -= n; applyUpTo(S.k + n, true); }
  } else if (S.playing) { S.playing = false; $('play').textContent = '▶ Play'; }
  if (S.dirty) { S.engine.sync(S.state); S.dirty = false; renderStream(); updateChips(S.k >= S.events.length); engineNote(); }
  S.engine.frame(S.state, now, dt);
  requestAnimationFrame(frame);
}
function wire() {
  $('v-estate').onclick = () => setView('estate'); $('v-grow').onclick = () => setView('grow'); $('v-build').onclick = () => setView('build');
  $('play').onclick = () => { if (S.k >= S.events.length) seekTo(0); S.playing = !S.playing; $('play').textContent = S.playing ? '❚❚ Pause' : '▶ Play'; };
  $('rerun').onclick = () => { seekTo(0); S.playing = true; $('play').textContent = '❚❚ Pause'; };
  $('scrub').oninput = () => { S.playing = false; $('play').textContent = '▶ Play'; seekTo(Number($('scrub').value)); };
  $('seed').onchange = () => grow();
  $('simulate').onclick = () => simulateFromForm();
  $('loadsample').onclick = () => { fillForm(S.sample); simulateFromForm(); };
  $('fit').onclick = () => { S.engine.cam.manual = false; };
  const stage = $('stage'), tip = $('tip');
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: S.engine.cam.x, cy: S.engine.cam.y }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('pointermove', (e) => {
    const dpr = $('gl').width / $('gl').clientWidth;
    if (drag) { S.engine.cam.manual = true; S.engine.cam.x = drag.cx - ((e.clientX - drag.x) * dpr) / S.engine.cam.zoom; S.engine.cam.y = drag.cy - ((e.clientY - drag.y) * dpr) / S.engine.cam.zoom; return; }
    const r = stage.getBoundingClientRect();
    const id = S.engine.nearest((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
    S.engine.hover = id;
    const n = id && S.state.nodes.get(id);
    if (!n) { tip.style.display = 'none'; return; }
    tip.replaceChildren();
    const k = document.createElement('div'); k.className = 'k'; k.textContent = n.sim ? 'simulation · ' + n.kind : n.kind + (n.fam ? ' · ' + n.fam : '');
    const t = document.createElement('div'); t.textContent = n.label;
    const m = document.createElement('div'); m.className = 'k';
    m.textContent = [n.ci ? 'CI ' + n.ci : '', n.stage ? 'stage ' + n.stage : '', n.receipts ? n.receipts + ' receipt' + (n.receipts > 1 ? 's' : '') : '', n.live ? 'live page' : ''].filter(Boolean).join(' · ');
    tip.append(k, t, m);
    if (S.view === 'estate' && n.kind === 'repo') { const a = document.createElement('div'); a.className = 'k'; a.textContent = 'click to open github.com/sjgant80-hub/' + n.id; tip.appendChild(a); }
    tip.style.left = Math.min(r.width - 330, e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; tip.style.display = 'block';
  });
  stage.addEventListener('pointerleave', () => { tip.style.display = 'none'; S.engine.hover = null; });
  stage.addEventListener('click', (e) => {
    if (S.view !== 'estate' || !S.engine.hover) return;
    const n = S.state.nodes.get(S.engine.hover);
    if (n && n.kind === 'repo') window.open('https://github.com/sjgant80-hub/' + encodeURIComponent(n.id), '_blank', 'noopener');
  });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); S.engine.cam.manual = true; S.engine.cam.zoom = Math.max(0.05, Math.min(8, S.engine.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: false });
  window.addEventListener('resize', resize);
}

async function main() {
  resize();
  const [snap, receipts, sample, basis] = await Promise.all([
    fetch('./data/estate.json').then((r) => r.json()),
    fetch('./receipts.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('./data/sample-process.json').then((r) => r.json()),
    fetch('./vendor/basis.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  S.snap = snap; S.receipts = receipts; S.sample = sample; S.basis = basis;
  fillSources(); renderCost();
  for (const id of ['c-hours', 'c-share', 'c-seats', 'c-cases', 'c-years']) $(id).addEventListener('input', renderCost);
  fillForm(sample); fillFacts(); fillBlueprint();
  S.engine = await createEngine($('gl'), $('overlay'), { gpu: qs.get('gpu') === '0' ? false : undefined });
  window.__live = { S, K, CPU_CAP };
  wire();
  const v = qs.get('view');
  await setView(v === 'grow' || v === 'build' ? v : 'estate');
  requestAnimationFrame(frame);
}
main().catch((e) => { $('engine').textContent = 'the page failed to start: ' + String((e && e.message) || e); console.error(e); });
