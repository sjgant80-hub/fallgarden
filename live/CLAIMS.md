# FallGarden Live: sealed claims (2026-11-09, before any code)

Two of Simon's specs on one engine, built on top of FallGarden (its node/link model and its force physics, reused):
the Living Company (a company grown from one seed) and FallGarden Live (your estate running; their build simulated).
Three views share one kernel (`live/kernel.mjs`), one visual grammar and one LIGHT stream:

- **Your estate (replay):** every node, edge and pulse comes from a committed public snapshot (`live/data/estate.json`):
  public repos only, their creation dates, Kar's map (family, role, depth, links), live pages, public CI, Liveware's
  public receipts, and the pattern library's night results with any rule naming a private word withheld.
- **Grow a company (from a seed):** a deterministic growth in the browser: fall-core germinates, the estate's layers
  bud in a seeded order, and the library grows night by night through the REAL pattern-library gate
  (`live/vendor/patlib.mjs`, vendored byte for byte from si-didy, witness 70/70) on the public estate's own data.
  Organs climb shadow → draft → assist → autonomous by one rule: an organ climbs one stage for each library rule
  covering its family (1, 2, 3).
- **Your build (simulation):** a client's described process grows into their organs, gate and library by the same
  rules, under a persistent banner: "Simulation of how your build would run, from your described process. Not yet built."

## Claims (each checked as stated; failures are kept)

- **G1 · replay is re-runnable.** Replaying the committed snapshot gives a structure hash that GitHub's runner recomputes
  and that matches the committed receipt (`live/receipts.json`).
- **G2 · same seed, same company.** Growing from seeds 1, 2 and 3 gives hashes that the runner recomputes and that match
  the receipts; seeds 1 and 2 give different hashes.
- **G3 · their build is re-runnable and responsive.** The sample process with seed 1 gives a hash that matches its
  receipt on the runner; the same process with one step removed gives a different hash.
- **G4 · every node and edge is a real record.** In the replay, every node is a repo in the snapshot and every edge is
  a link in the snapshot (checked over all of them, not sampled).
- **G5 · the library only flares for a real pass.** In the grow view, every particle that flares in is a rule the gate
  kept, and every one that fades is a rule the gate dropped (each re-gated independently).
- **G6 · a simulation is always labelled.** Every node, edge and packet the simulation produces carries the
  simulation mark, and the page carries the banner text in its source.
- **G7 · every LIGHT line is the real message.** For every event in all three views, decoding its LIGHT bytes gives
  back exactly its packet, and the counter's LIGHT and JSON byte totals are the sums of the real packets.
- **G8 · no WebGPU, no fake.** Without WebGPU the page draws the same real state on a 2D canvas (checked in a real
  browser with WebGPU off). The page contains no video.
- **G9 · nothing private.** The committed snapshot holds only repos that the GitHub API reported public at snapshot
  time; the snapshot tool refuses to write if any of them is private.
