# SandBase Jev Trader

One decision every 300 ms tick. An AI model watches a simulated Anthropic
order book and answers buy or sell. Every tick it posts one post-only limit
order on that side, one tick inside the touch, replacing the last one. Fills
happen when a taker hits it, so the desk earns the spread instead of paying it.
A small server streams every tick to a live dashboard.

> **Anthropic is private, so there is no real market here.** The listing is
> fictional and so is the book. What is real is the machinery: a decision, an
> order, and a fill accounting path that runs on a fixed clock. Nothing in this
> repo is investment advice and the model is not trying to be profitable.

## Run

```sh
bun install
bun run start
```

Then the dashboard, in a second shell:

```sh
cd web
bun install
cp .env.example .env.local
bun run dev
```

The backend serves `http://localhost:3000`, the dashboard expects it there and
listens on `http://localhost:3001`.

Two commands are worth knowing:

```sh
bun run typecheck
bun run scripts/session.ts 8000   # headless replay with fill attribution
```

## Endpoints

- `GET /` snapshot: model, instrument, seed, latest tick event
- `GET /history` the last 1000 tick events
- `GET /events` SSE: `snapshot` on connect, then one `tick` event per tick

Every event (see `src/trader.ts` for the types):

```json
{
  "tick": 1968, "ts": 1789871367552,
  "mid": 342.12, "bestBid": 342.11, "bestAsk": 342.13, "spreadBps": 1.17,
  "decision": { "action": "sell", "probabilities": { "buy": 0.12, "sell": 0.88, "hold": 0 }, "latencyMs": 52, "late": false },
  "quote": { "side": "sell", "price": 342.12, "size": 200, "orderId": 100020968, "cancel": [100020967], "capped": false },
  "fill": null,
  "book": { "bids": [{ "price": 342.11, "size": 4105 }], "asks": [{ "price": 342.13, "size": 3966 }] },
  "resting": { "bidShares": 0, "askShares": 200 },
  "position": { "side": "short", "size": 779, "entryPrice": 342.4, "unrealizedUsd": -183.1 },
  "totals": { "ticks": 1968, "decisions": 1968, "quotes": 1968, "fills": 740, "lateTicks": 0, "volumeShares": 143200, "notional": 48980000, "modelUsd": 0.0041, "realizedUsd": 1075.5, "pnlUsd": 892.41, "pnlPct": 0.89 }
}
```

Every tick the model is asked about the move over `HORIZON_TICKS` (default 100)
and answers `buy` or `sell`. `quote` is the order that tick put on the book: a
post-only limit order of `TRADE_SIZE` shares on that side, `QUOTE_INSIDE_TICKS`
inside the touch, cancelling whatever we had resting (`cancel`). `hold` appears
only with `decision.late: true`, when the model missed the tick and nothing was
posted. When the inventory cap blocks a side, the quote goes on the other side
with `capped: true` and `probabilities` still show the model's call. `resting` is
our size known to be on the book after that tick.

## Layout

```
src/config.ts     env — the simulation's parameters
src/rng.ts        seeded PRNG, so a recorded session replays exactly
src/types.ts      Book, Print, Quote, Fill
src/exchange.ts   the venue: price process, generated level-2 book, taker flow, matching
src/model.ts      Model interface, StandInModel, ClaudeModel
src/trader.ts     the loop: one decision in flight, hold when late, position and P&L
src/feed.ts       the 300 ms tick clock
src/server.ts     Bun.serve: snapshot, history, SSE
web/              Next.js dashboard: header, stats, chart, decision panel, book ladder, tape
video/            the screen-capture rig (CDP screencast -> 30 fps mp4)
videos/           the produced launch short (HyperFrames project)
```

## The market

Anthropic has no order book to read, so `src/exchange.ts` stands in for both the
venue and the price feed. Its properties matter more than they look:

- **A tick has two phases.** `beginTick()` realizes the pending move, plans the
  next one and builds the book. `trade()` then runs the tick's taker flow and
  matches our resting order first.
- **The order has to be live in the tick it was posted in.** Quoting against a
  stale book and only offering it to the next tick's flow is a structurally
  losing game: the fill condition then selects on the price having already moved
  the wrong way. Measured on this simulation, that one ordering change was worth
  about 10 percentage points per session, from roughly -6% to roughly +4%.
- **Resting depth carries the signal.** Each book is skewed toward the move it
  is about to make, so `bookImbalance` is genuinely informative. The skew is
  noisy on purpose: an edge, not a giveaway.
- **Taker flow is mostly uninformed.** `FLOW_LEAN` sets the share that trades on
  the signal; that share is the adverse selection the desk faces, and it is the
  main dial between a profitable desk and a bleeding one. At the default the
  desk runs modestly positive with real drawdowns.

`bun run scripts/session.ts` prints the attribution: side accuracy and the
average edge per share at +1/+5/+20/+50 ticks after each fill.

## Model

The default `stand-in` is a local heuristic: resting-depth imbalance (strong),
taker flow and short-term momentum (weak), plus seeded jitter. It is labelled
`stand-in model` in the dashboard because that is what it is.

To use a real model instead, set `MODEL=claude` and `ANTHROPIC_API_KEY`. Note
that warm-up is skipped for a hosted model, since it would need one network call
per tick.

## Environment

See `.env.example`. The ones that change behaviour most: `SEED` (reproducibility),
`VOL_BPS` (how fast the market moves), `FLOW_LEAN` (how much of the flow is
informed), `TICK_MS`, `TRADE_SIZE`, `MAX_POSITION`.

## Video

Two cuts, both in this repo.

- `video/takes/hero.mp4` is a raw 31 second screen capture of the dashboard
  ticking, 1920x1080 at 30 fps. `video/` holds the rig that records it: a CDP
  screencast that keeps every repaint at full quality and resamples the real
  frame timestamps onto a constant grid, so the pacing matches the tick clock.
- `videos/sandbase-jev-trader/renders/sandbase-jev-trader.mp4` is a 34.5 second
  produced short built in HyperFrames, with a minimal ambient bed. Every number
  in it is one this run produced. `renders/contact-sheet.png` is the frame sheet,
  and `videos/sandbase-jev-trader/STORYBOARD.md` is the plan behind it.

## Credits

Adapted from [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader),
which does the same thing somewhere real: a TypeSafe Jev model quoting the Kuru
MON-USDC book on Monad, one order per 300 ms block, earning the spread instead of
paying it.

The architecture here, the dashboard's design system, and the idea of one
decision per tick that is replaced every tick all come from that project. What
changed is the market (a seeded simulation instead of a chain and a real venue)
and the instrument (a fictional Anthropic listing, because Anthropic is private
and has no book to read).

MIT licensed. The original copyright notice is preserved in [LICENSE](LICENSE).
