# The Living Visual: results (claims in live/CLAIMS-living.md, sealed 083f92b), checked on 2026-11-09

Measured in a real browser on this laptop's GPU (an Intel Gen12 integrated GPU).

The machine was not idle. Another session's work was running at the same time: a local model server, its own mutation
gates, and a background tool. The CPU load was between 31% and 93% across the runs. Frame times below are under that
load.

The private live view is the second surface. Its own numbers are in its private repo; only the verdicts are given here.

| # | Result | Numbers |
|---|---|---|
| U1 | **FAILED in part (c); (a) and (d) held; (b) not measured** | See the four checks below. |
| U2 | **HELD** | The Living Company, streamed event by event from the first event to the last (767 events): 1,459 effects logged, and all 1,459 map to the event of their index and of the matching kind, with 0 wrong. This was checked locally, then again on the published Pages site in real Chrome after the deploy, with the same 1,459 of 1,459. The private view, over its last 1,500 real events: 1,799 of 1,799 map, 0 wrong. Its two guardian shields both map to their entries in the guard's own log. The law's tests: every effect carries its cause, and an unknown event makes none. Packet speed and brightness come only from `packetFor(count)`, the count of hand-offs on that edge among the last 240 events. |
| U3 | **HELD** | In The Living Company (seed 1), at events 256, 511 and 767, the mote count equals the kernel's kept rules × 96, and the mass was never reset (0 resets). The kernel kept 1 rule and dropped 173, 417 and 669 by those points. One red mote appeared per drop. The night pulse was on during the nights. The private view: 96 motes = 1 kept rule × 96, after 53 real judgements (1 kept, 52 dropped), with 0 resets. **Plainly:** the real gate is strict, so the real libraries hold one rule. The mass densifies once, from 0 to 96 motes, not thousands. |
| U4 | **HELD** | Your estate: the one repo with a red CI result (fallkard-forge) is red in the renderer's own colour buffer, read back from the GPU as (1, 0.3, 0.24), and carries the failure flag. With the rest dimmed to 0.13 by a hover, it stays at 0.55. No other cell uses the failure red. The private view: its one failed repo is red in the GPU buffer, at 0.55 under the dim. |
| U5 | **HELD** | Tests of every branch of the detector (`live/engine.test.mjs`): forced off, no navigator, no `navigator.gpu`, requestAdapter giving nothing, and requestAdapter throwing (asynchronously and synchronously) all mean no WebGPU; a real adapter means yes. In this real browser, the same detector given a navigator with no `gpu` says no; the real one says yes. With `?gpu=0` the page draws the same state on the 2D canvas, and the note says "No WebGPU here: the same real state on a plainer 2D canvas (no video, no stand-in)". The page has 0 video elements, and a test checks the source for any. |

## U1, check by check

- **(a) held.** Frame cost, drawing back to back and waiting for the GPU, on a 1600×900 CSS canvas:

  | View | Device pixels | Cells, vessels, motes | Medians of three runs |
  |---|---|---|---|
  | Your estate, final event | 2000×1125 | 1,771, 1,171, 96 | 15.6, 15.2, 14.8 ms |
  | The Living Company, final event | 1600×900 | 65, 79, 96 | 14.5, 12.4, 13.3 ms |

  Your estate also drew 1,600 dust motes. Every median is under 16.7 ms. The Living Company's p95 had stalls of up to
  0.8 s under the load.
- **(b) not measured.** No tab of this session was on screen. The built-in pane was hidden, and this session was open in
  no window, so a visible frame rate could not be read. The fps chip shows it on Simon's screen.
- **(c) failed for the FallGarden profile.** This profile drives the three public views. The law matches exactly at
  first: for 10 steps the GPU equals the mirror to one float unit (0.00012 world units), every time it was checked. After
  that the differences grow:
  - 0.0085 at 30 steps and 0.084 at 60 steps from the final replayed state
  - 0.030 after 4,158 steps of settling
  - 0.065 after the shader was split into four lanes

  FallGarden's forces never fully settle at estate scale, so a one-unit rounding difference between the GPU's square
  root and division and JavaScript's grows. The bar was 0.01, and it is not met.

  The private view's anatomy profile held in 5 of 6 checks: 0.0043, 0.0017, 0.00012, 0.00012 and 0.0012. The sixth
  check, soon after the page loaded, gave 0.0109.
- **(d) held.** After settling, the mean speed was 0.21 to 0.26 world units a step in Your estate and 0.19 in The Living
  Company. Both are above 0 and below 2.

## Found by building it, and fixed

1. **The layout ran on too few threads.** One thread per cell meant 2,280 threads each summing every pair in a row, so
   most of the GPU sat idle. Splitting each cell's sum over four lanes, summed in a fixed order the mirror copies,
   cut the private view's physics from about 3 ms a frame to about 1.3 ms.
2. **The camera's robust fit sorted every position every frame** (2.6 ms). It now runs every tenth frame, and the
   page's JavaScript per frame fell from 7.9 ms to 2.6 ms.
3. **The first U4 check read zeros.** The colour buffer lacked `COPY_SRC`, so the readback was refused. The cells were
   drawn red all along; the check could not see it.
4. **A WGSL reserved word** (`active`) and a buffer that was created only after its first write: both were found on
   the first load.
5. **The library mass at 24 motes a rule looked like a sparse ring.** The real gate keeps one rule, so it is now 96 per
   rule. The page states this encoding.
6. **The old renderer wobbled every cell on a timer.** That is idle motion the spec forbids. It is gone; only the breath
   and the tide move without an event.

## Kept as they are

- U1c's bar stays at 0.01, and its failure on the FallGarden profile is kept.
- build-broadcast is not built: no build of that name exists in the estate.
