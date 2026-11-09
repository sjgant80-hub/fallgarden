// fallgarden · live/grow-worker.mjs — grows a company (or simulates a client's build) off the page's main thread, so a
// second of real gate work never freezes the graph. It runs the same kernel CI gates; it only computes and replies.
import K from './kernel.mjs';

let snap = null;
async function estate() {
  if (!snap) snap = await (await fetch(new URL('./data/estate.json', import.meta.url))).json();
  return snap;
}
self.onmessage = async (msg) => {
  const m = msg.data || {};
  try {
    if (m.mode === 'grow') {
      const t = performance.now();
      const g = K.growFromSeed(Number(m.seed) >>> 0, await estate());
      self.postMessage({ id: m.id, ok: true, events: g.events, detail: g.detail, ms: Math.round(performance.now() - t) });
    } else if (m.mode === 'sim') {
      const t = performance.now();
      const r = K.simulate(m.process, Number(m.seed) >>> 0);
      self.postMessage({ id: m.id, ok: r.ok, why: r.why || null, events: r.events, banner: r.banner || null, examples: r.examples || 0, ms: Math.round(performance.now() - t) });
    } else self.postMessage({ id: m.id, ok: false, why: 'unknown request' });
  } catch (e) {
    self.postMessage({ id: m.id, ok: false, why: String((e && e.message) || e).slice(0, 200) });
  }
};
