# The Living Visual: sealed claims (2026-11-09, before any code)

Simon's spec, 2026-11-09: "render an organism, not a diagram." It is the WebGPU upgrade layer. The render is upgraded
(motion, glow, depth, flow, growth, character) on top of the SAME real state, and every beautiful thing is driven by a
real event. Honesty is unchanged:
- real events only
- red on a real failure
- live and recorded are labelled
- no secrets on screen

**Two surfaces, one renderer:**
1. **FallGarden Live**, public at sjgant80-hub.github.io/fallgarden/live/, in all three views: Your estate, The Living
   Company and Your build.
2. **My Estate Graph**, the private live view, on the owner's laptop only (127.0.0.1).

The renderer (`live/organism.mjs`) and its law (`live/living.mjs`) are written once, in this public repo. The private
view vendors both byte for byte, with their SHA-256 pinned.

The spec also names build-broadcast. No build of that name exists in the estate: the full index (1,810 repos) and a live
GitHub search both return none. It is left out and not invented.

## Fixed, whatever the claims below say

- `live/kernel.mjs` does not change, so every receipt in `live/receipts.json` and `hashes.mjs --check` stay as they are.
- All new motion lives in the renderer.
- Private names and events never reach Pages.

## Claims (each checked as stated; any that fail are kept as failed)

- **U1 · It breathes at 60 fps.** The layout runs every frame in a WebGPU compute shader. It never stops, and after it
  settles it keeps stirring. Every node, edge and particle of the view is drawn, with bloom and depth, in these views:
  - FallGarden Live's Your estate view at its final event
  - FallGarden Live's The Living Company view at its final event
  - the private view with its whole estate

  The checks:
  - (a) Drawing frames back to back and waiting for the GPU each time, the median frame costs at most 16.7 ms (at least
    60 fps sustainable), on a canvas of at least 1600×900 CSS pixels, on this laptop's GPU.
  - (b) In a tab visible on screen, the page's frame counter reads at least 58 on a 60 Hz display. If no visible tab can
    be measured, that is said, not assumed.
  - (c) The shader is the law. 60 steps on the GPU from a real state equal the CPU mirror (`live/physics.mjs`) within
    0.01 world units.
  - (d) After settling, the mean node speed stays above zero (it stirs) and below 2 world units a frame (it is calm).
- **U2 · Every pulse is a real event.** Each of these is caused by one event of the log and carries that event's index:
  every packet of light, routing line, flare, ring, bloom, bud and library mote that the renderer draws. Packet speed and
  brightness depend only on the real recent activity on that edge.

  Only two things move without an event: the breathing wave from the heart, and the slow current that keeps the layout
  from freezing. Their constants are stated on the page.

  The checks:
  - The law's tests show that every effect has a cause, and that an event the law does not know makes no effect.
  - In a real browser, during a replay, every entry of the renderer's effect log maps to the event of that index, of the
    matching kind. All of them are checked, not a sample.
- **U3 · The library is a living mass.** The mass holds as many motes as the rules kept, times the stated motes per rule,
  up to the stated cap:
  - Each real kept rule adds its motes, so the mass densifies.
  - Each real dropped rule shows a red mote that fades out within the stated time.
  - The mass pulses during a night:
    - in The Living Company view, from Kar handing the cases to the gate to that night's last event
    - in the private view, while a night organ runs

  The checks:
  - In a real browser, the mote count is checked at three points of The Living Company's replay against the kernel's
    kept count.
  - It is checked once more against the private view's real pattern-library state.
- **U4 · A failure shows.** A real failure (a red CI result, a run that failed, a dropped rule) is drawn red, never in its
  family or organ colour. A dropped rule is drawn as a fading red mote. Dimming the rest on hover never takes a failed
  node below a stated floor of visibility.

  The checks:
  - The law's tests.
  - In a real browser, every node with a red CI result in the drawn state is drawn red. This is read from the renderer's
    own colour buffer.
- **U5 · No WebGPU, no fake.** The page falls back to its existing plainer 2D engine and says so when any of these holds:
  - the browser has no `navigator.gpu`
  - `requestAdapter` gives nothing or throws
  - `?gpu=0` is set

  The 2D engine draws the same real state. There is no video anywhere.

  The checks:
  - Tests of every branch of the detector.
  - A real browser in which the detector sees no `navigator.gpu`.
