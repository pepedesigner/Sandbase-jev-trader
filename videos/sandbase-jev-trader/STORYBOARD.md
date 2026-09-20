---
format: 1920x1080
duration: 34s
message: "One AI decision and one live order every 300 ms tick, on a simulated Anthropic order book"
arc: Demo Loop
audience: developers and trading-adjacent builders who scroll past bot demos
mode: autonomous
music: none
---

## Video direction

**Palette** (from `frame.md`, which is remixed onto the dashboard's own tokens):
`bg` #F0EEE9 warm canvas is the ground of every frame; `text` #0A0A0A for
display; `text-muted` #77776F for body; `primary` #0FA968 is the only accent and
means *bid*; `sell` #E4573D means *offer* and nothing else; `text-light` #98968E
for chrome. Numbers are set in a tabular monospace; speech in Inter. No third
colour, no gradient that is not a measurement.

**Motion grammar.** One paused GSAP timeline per frame, seeked by the renderer.
Every entrance is a `fromTo` on a long-tail settle (`power3` default, `expo.out`
on a fast arrival); nothing bounces, nothing overshoots, nothing repeats. Motion
is small and mechanical: a piece arrives, it settles, it stays. **Reveals are
paced to the voiceover** — at t=0 only what the line is saying enters, and every
later piece waits for its spoken cue across the back half of the shot. Nothing
is front-loaded. During a hold the frame is genuinely still; the only permitted
aliveness is a low-amplitude jitter on one hero element, and it is not used here.

**Rhythm.** Frames 1, 2 and 6 are quiet, typographic beats; frames 3, 4 and 5
carry the product and are the most active. Frame 6 is the allocated stillness —
it is the breather, and it is meant to read as one.

**Camera.** Only frames 3 and 4 move the camera, and only for a reason: it
travels to the region the line is describing. A camera move is never decoration.

**Negative list.** No pulsing or blinking indicators. No lazy breathing, no
back-half pan or push over a held read. No particle fields, no floating bokeh,
no purple-blue gradient. No card that scales up and down to look alive. No
content in the bottom 17% of the canvas (caption band). No invented numbers:
every figure on screen is one the run produced. No `Math.random`, no `Date.now`,
no CSS transition or keyframe driving motion.

---

## Frame 1 — 300 ms

- scene: A single number counts down to the tick, over and over
- voiceover: "Three hundred milliseconds. One decision. One order."
- duration: 4s
- poster: 3.2s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Rule of three
- beat: tension + curiosity
- blueprint: kinetic-type-beats (Adapt)
- focal: (typography only)
- roles: no assets — pure typography on the canvas
- asset_candidates:

Adapt: keep the fixed-center anchor and the in-place token swap; the swapped
token is the *object* of the sentence (decision → order), not a vocabulary list,
and an oversized ghost numeral sits behind the anchor as the only depth layer.

Scene 1 (0.0–1.3s): solid `bg` canvas. Only the first clause is on screen: "Three
hundred milliseconds." arrives as one line on a `power3` settle, centered at `h2`
scale (primary visual ~55% of canvas width). An oversized "300" sits behind it at
~6% ink opacity as the second depth layer. No other element exists yet.
Scene 2 (1.3–2.7s): the clause clears upward and the anchor holds empty for a
beat, then "One decision." **hard-cuts in** at the same center
(`discrete-text-sequence`) — the swap itself is the beat, no fade, no roll. The
ghost numeral behind it swaps to "1". As the voiceover reaches "One order.", the
final word swaps **in place** at the same anchor, and the ghost numeral swaps to
the live tick counter.
Scene 3 (2.7–4.0s): the three clauses resolve into a single stacked three-line
lockup, left-aligned on a rule-of-thirds anchor, with a thin `primary` rule
wiping in beneath it left-to-right on the same settle. Holds still to the last frame.

narrativeRole: Establish the rate before anything else. The viewer must feel that
this thing acts several times a second, which is the entire claim of the piece.
keyMessage: The cadence is the product.

---

## Frame 2 — SandBase Jev Trader

- scene: The desk's name lands on the same warm ground, with the stand-in badge stated plainly
- voiceover: "A market-making desk on a book that does not exist. Anthropic is private, so the simulation is the market."
- duration: 4.5s
- poster: 3.6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-intro.html
- type: product_intro
- persuasion: Negative contrast
- beat: clarity + intrigue
- blueprint: titlecard-reveal (Adapt — card chain)
- focal: (typography only)
- roles: no assets — pure typography on the canvas
- asset_candidates:

Adapt: keep the "one restrained move, then a still hold" contract and the
monochrome-on-solid register; chain two cards instead of one, seamed by an
instant hard cut, and put the caveat on the second card rather than a qualifier
line on the first.

Scene 1 (0.0–1.5s): empty canvas; a mono eyebrow types on character-by-character
behind a blinking caret (`discrete-text-sequence` + `context-sensitive-cursor`):
`ANTH/USD · simulated listing`. That is the only element.
Scene 2 (1.5–3.0s): the eyebrow demotes to `text-light`; the wordmark "SandBase
Jev Trader" fades up dead-center with a subtle scale settle, the ‖ mark drawing on
before the letters (`svg-path-draw` + `spring-pop-entrance` settle). Layout is
centered, primary visual ~40%.
Scene 3 (3.0–4.5s): the caveat slides up into place beneath the wordmark —
"Anthropic is private, so the simulation is the market." in `text-muted` body,
with an amber stand-in pill settling top-right of the lockup. Holds still.

narrativeRole: Name the thing, then immediately disarm it. The fictional listing
is not a footnote to hide, it is the setup: everything downstream is honest
because the market is declared fake and only the execution is real.
keyMessage: SandBase Jev Trader, on a simulated Anthropic book.

---

## Frame 3 — It picks a side

- scene: The camera pushes into the decision panel while the live dashboard ticks behind it
- voiceover: "Every tick it asks one question. Buy, or sell. Then sixty-two milliseconds later it has an answer, with a probability attached."
- numbers: 62 ms and conf 0.88 are read off `assets/dashboard-live.mp4` itself, not invented
- duration: 7s
- poster: 6s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-decision.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: focus + control
- blueprint: device-surface-showcase (Adapt — static surface, instrument framing)
- focal: assets/dashboard-still.png
- roles: dashboard-still.png = cutout (the hero surface, a 3840x2160 plate in a clipped window) · dashboard-live.mp4 = supporting (the live capture, delivered as its own cut) · backdrop = background (`bg` canvas; the surface is light on light, separated by a hairline border and a 3px depth stack)
- asset_candidates: assets/dashboard-live.mp4 — live dashboard capture, pushed into the decision panel; assets/dashboard-still.png — 3840x2160 still of the same view, kept as the fallback plate

Adapt (structural, forced by the media contract): the surface stays STILL. An
approved `<video>` is hoisted to the host root — a frame cannot transform it — so
this frame keeps the blueprint's real lesson (the surface is the hero, at 1:1,
and the copy is secondary) and swaps the push-in for an instrument treatment: a
viewfinder box and a leader line land ON the live surface where it already is.
The footage supplies all of the motion; the frame supplies the measurement.

Scene 1 (0.0–1.6s): the surface is seated as a 1560x878 plate on the `bg` canvas
and is on screen from t=0. Only the hairline card edge settles (`scale` 1.012→1)
and the mono eyebrow "WHICH SIDE THIS TICK?" arrives above it.
Scene 2 (1.6–4.2s): a `primary` viewfinder box lands on the decision panel at
1111,245 (452x98) with four corner ticks and a leader line running left, as the
voiceover says "Every tick it asks one question." The first cue, "every tick, one
question", reveals in the left rail on its own beat — one element per cue.
Scene 3 (4.2–5.6s): as the voiceover names "Buy, or sell.", the second cue reveals
in the rail with the two words carrying the palette's two sides.
Scene 4 (5.6–7.0s): the latency and confidence cue arrives last — "62 ms · conf
0.88", read off the surface itself. Settles and holds; the footage keeps ticking
under the held read.

narrativeRole: The first real proof: the model answering a question about an
order book, live, on the surface that ships.
keyMessage: An AI model makes the call, not a rule.

---

## Frame 4 — It posts the order

- scene: The camera travels from the decision panel down the book ladder, where our own row appears inside the spread
- voiceover: "The call becomes a post-only order, one tick inside the touch. It is the best price on that side, so the takers come to it. Next tick, the order is replaced."
- duration: 7s
- poster: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-quote.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: precision
- blueprint: camera-journey (Adapt — sub-shape B, cursorless camera travel)
- focal: assets/dashboard-still.png
- roles: dashboard-still.png = cutout (the same surface, as a 3840x2160 plate inside a clipped window, so the camera can travel over it and stay sharp) · dashboard-live.mp4 = supporting (declared, carried by frame 3, not mounted here)
- asset_candidates: assets/dashboard-still.png — 3840x2160 plate of the same view, the surface the camera travels over; assets/dashboard-live.mp4 — live dashboard capture, the fallback motion source

Adapt: keep the motivated multi-leg camera and the "travel to the consequence"
structure, and move the travel onto a plate the frame CAN transform — the 2x still
inside a clipped window. There is no cursor: the hinge is the tick itself, so each
leg is motivated by the panel the line is describing next.

Scene 1 (0.0–1.5s): the window is held WIDE on the whole instrument — scale 1,
offset 0 — which is where frame 3 left the surface, so the seam reads as a camera
hold rather than a new shot. Only the mono eyebrow arrives. The plate is on screen
from t=0.
Scene 2 (1.5–3.8s): LEG ONE — the camera travels down the right column onto the
decision panel (scale 1→2, `power2.inOut`, region centre 0.742/0.171), the first
real travel of the video. A canvas scrim fades up over the chart to seat the
callout rail, and the first two cues arrive on their own beats: "post-only, 1 tick
inside the touch", then "the best price on that side."
Scene 3 (3.8–5.6s): LEG TWO — the camera continues down the same column to the
tape (region centre 0.742/0.737), which is where fills print. The third cue lands
as the travel settles: "next tick, cancelled and replaced."
Scene 4 (5.6–7.0s): LEG THREE — the camera eases back out to the whole desk
(scale 2→1) and the rail clears; the frame rests wide and holds to the last frame.

narrativeRole: Show the mechanism, not the claim. Quote inside the touch is why
the desk earns the spread instead of paying it, and the ladder shows it directly.
keyMessage: The order is real, inside the spread, and replaced every tick.

---

## Frame 5 — What it did

- scene: Real counters from the run count up, with the P&L line drawing itself
- voiceover: "One thousand nine hundred and sixty-eight decisions in ten minutes. Seven hundred and forty fills. Forty-three milliseconds, average. And a P and L that is small, real, and shown whether it is up or down."
- duration: 7s
- poster: 6s
- transition_in: push-slide UP
- status: animated
- src: compositions/frames/05-numbers.html
- type: benefit_highlight
- persuasion: Statistical proof
- beat: confidence
- blueprint: dataviz-countup (Reproduce — light instrument variant)
- focal: assets/dashboard-still.png
- roles: dashboard-still.png = supporting (a small, heavily cropped plate of the tape, bottom-right, at 40% opacity behind the numbers — evidence, not the hero) · numbers = the hero, set in type
- asset_candidates: assets/dashboard-still.png — 3840x2160 still, cropped to the tape and P&L readout as a supporting plate

Reproduce: the count-up hero metric and the camera-free instrument field; one
instrument per beat, the data carrying the argument. Light registration per the
palette, not the dark variant.

Scene 1 (0.0–1.8s): empty canvas. The hero metric "1,968" counts up with its
transform scale growing into its final size (`counting-dynamic-scale`), label
"decisions this run" beneath in `text-muted`, and a thin `primary` rule drawing
under the pair (`svg-path-draw`). A very slow continuous zoom-in runs underneath
(`multi-phase-camera`). Only the hero is on screen.
Scene 2 (1.8–3.8s): a three-up stat row builds **left to right on its cues** —
"740 fills", then "43 ms avg", then "1.17 bps spread" — each arriving by
`spring-pop-entrance` with tabular numerals, in `card-tinted` cards at asymmetric
60/40 weight so the row does not read as a grid.
Scene 3 (3.8–5.6s): the P&L instrument draws: a `primary` trend line traces
left-to-right (`svg-path-draw`) into the value "+$892.41", with "+0.89%" beside it
in `positive`, and the line "shown whether it is up or down" revealing under it on
its spoken cue.
Scene 4 (5.6–7.0s): the slow zoom settles to a slightly wider composition; the
supporting plate of the tape fades up bottom-right at 40% behind the numbers.
A mono footnote reveals last: `tick 1,968 · seed 20260920 · 00:09:50 elapsed`.
Holds still.

narrativeRole: Pay off the rate claim with the run's own ledger. The numbers are
deliberately unremarkable: this is a working system, not a money printer.
keyMessage: The system ran, and here is exactly what it did.

---

## Frame 6 — Where it stands

- scene: The honest caveat and the source, held on the warm canvas
- voiceover: "A stand-in model, a fictional ticker, no real money. The dashboard is the whole demo, and the source is open."
- duration: 5s
- poster: 4.2s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-outro.html
- type: branding
- persuasion: Risk reversal
- beat: peace of mind
- blueprint: titlecard-reveal (Reproduce — card chain, final card held)
- focal: (typography only)
- roles: no assets — the surface is the type
- asset_candidates:

Reproduce: the monochrome end-card chain — statement → statement → lockup —
seamed by instant hard cuts at full opacity, each card its own allocated
stillness, terminating on the wordmark held to the final frame.

Scene 1 (0.0–1.7s): hard cut onto card one. An amber dot and the mono label
`stand-in model`, with "no hosted model connected for this run" beneath in
`text-muted`. One restrained fade-and-settle; then it holds. That is the whole card.
Scene 2 (1.7–3.3s): instant hard cut to card two. `fictional ticker` in mono, with
"Anthropic is private. ANTH does not exist." beneath. Same restrained settle, then
holds.
Scene 3 (3.3–5.0s): instant hard cut to the final card — the ‖ mark and the
wordmark "SandBase Jev Trader" centered, the mono line `simulated market · real execution
· source open` beneath it. Settles once and is held, completely still, to the last
frame. No exit animation.

narrativeRole: Close the honesty loop opened in frame 2 and hand over the
artifact. Nothing here overclaims.
keyMessage: Simulated market, real execution, open source.

---

## Stillness allocation

| Frame | Energy | Held read |
| ----- | ------ | --------- |
| 1 | medium — three hard swap beats | final lockup, ~1.3s |
| 2 | low — one settle | lockup, ~1.5s |
| 3 | high — camera push + live footage | re-framed wide, ~1.4s |
| 4 | high — three camera legs + live footage | wide rest, ~1.4s |
| 5 | medium — sequential count-ups | settled wide, ~1.4s |
| 6 | **lowest — allocated breather** | final card, ~1.7s |

## Number provenance

Every figure on screen comes from the recorded run, read off
`assets/dashboard-live.mp4`: tick 1,968 · 1,968 decisions · 740 fills · 43 ms
average latency · 1.17 bps spread · +$892.41 (+0.89%) · short 779 · 00:09:50
elapsed · seed 20260920 · 300 ms per tick. No figure is invented, rounded up for
effect, or carried over from a different run.
