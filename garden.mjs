// fallgarden · garden.mjs — the second-brain's load-bearing law, konomified IN PLACE (2026-08-27).
// These four functions ARE the page's link engine, extracted byte-faithful: the page's globals
// (G.files) become the `files` parameter, and buildGraphData's randomness is injected so the gate
// is deterministic while the page keeps its scatter. The page inlines this kernel verbatim and
// delegates — the gated logic IS the live logic (CI diffs the rebuild).

// resolve a [[wiki-link]] key to a real note path: exact first, then any-folder suffix
export function resolveNote(files, key) {
  key = key.endsWith('.md') ? key : key + '.md';
  if (files.has(key)) return key;
  for (const p of files.keys()) { if (p.endsWith('/' + key)) return p; }
  return null;
}

export function hasNote(filesSet, key) {
  if (filesSet.has(key)) return true;
  for (const p of filesSet.keys()) { if (p.endsWith('/' + key) || p === key) return true; }
  return false;
}

// the word index. ⚠ VERBATIM: the page's regex is {2} — it indexes non-overlapping 2-char CHUNKS
// ("hello" → "he","ll"), not whole words. That is what the live search runs on, so that is what is
// locked; changing it here would silently change live behavior. Konomify locks the maths, and says.
export function buildIndex(files) {
  const idx = new Map();
  for (const [p, f] of files) {
    const words = (f.body.toLowerCase().match(/[a-z0-9_-]{2}/g) || []);
    for (const w of words) {
      if (!idx.has(w)) idx.set(w, new Set());
      idx.get(w).add(p);
    }
  }
  return idx;
}

// the graph: notes as nodes, [[links]] as edges (degree counted BOTH ends), #tags as tag-nodes
export function buildGraphData(files, includeTags = true, rand = Math.random) {
  const nodes = []; const links = [];
  const idx = new Map();
  for (const p of files.keys()) {
    const id = p; idx.set(id, nodes.length);
    const name = p.split('/').pop().replace(/\.md$/, '');
    nodes.push({ id, label: name, kind: 'note', x: rand() * 800, y: rand() * 500, vx: 0, vy: 0, degree: 0 });
  }
  const tagMap = new Map();
  for (const [p, f] of files) {
    const rx = /\[\[([^\]|]+)/g; let m;
    while ((m = rx.exec(f.body))) {
      const target = resolveNote(files, m[1].trim());
      if (target && target !== p) {
        links.push({ source: idx.get(p), target: idx.get(target) });
        nodes[idx.get(p)].degree++; nodes[idx.get(target)].degree++;
      }
    }
    if (includeTags) {
      const tags = f.body.match(/(^|\s)#[a-zA-Z0-9_/-]+/g) || [];
      for (const t of tags) {
        const tag = t.trim().slice(1);
        if (!tagMap.has(tag)) { tagMap.set(tag, nodes.length); nodes.push({ id: '#' + tag, label: '#' + tag, kind: 'tag', x: rand() * 800, y: rand() * 500, vx: 0, vy: 0, degree: 0 }); }
        links.push({ source: idx.get(p), target: tagMap.get(tag) });
      }
    }
  }
  return { nodes, links };
}
