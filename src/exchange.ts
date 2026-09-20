import { config } from "./config";
import { Rng } from "./rng";
import type { Book, Fill, Level, Print, Side } from "./types";

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Our desk's single resting order, as the venue sees it. */
export interface DeskOrder {
  id: number;
  side: Side;
  price: number;
  size: number;
}

export interface TradeResult {
  /** Everything that printed this tick, including the part of a taker order we filled. */
  prints: Print[];
  /** What the tick's flow took off our order. */
  fill: Fill | null;
  /** Our order after the flow: null once it is completely filled. */
  resting: DeskOrder | null;
}

export interface TradeSummary {
  count: number;
  buyShares: number;
  sellShares: number;
  /** taker buy volume minus taker sell volume, in shares */
  cvdShares: number;
  vwap: number | null;
  lastPrice: number | null;
  lastSide: Side | null;
}

/** One queue slot a taker order can consume: a book level, or our own order. */
interface Slot {
  price: number;
  size: number;
  orderId: number | null;
  level?: Level;
}

const RING = 500;

/**
 * A self-contained synthetic market for a fictional ANTH/USD listing.
 *
 * Anthropic is private, so there is no real book to read and no chain to send
 * to. This stands in for both: a fundamental price process, a generated level-2
 * book around it, and a taker flow that walks that book. Every step is driven by
 * one seeded PRNG, so a given seed replays the same session exactly.
 *
 * A tick has two phases, and the order matters:
 *   beginTick()  realizes the pending move, plans the next one, builds the book.
 *   trade()      runs the tick's taker flow, matching our resting order first.
 *
 * The desk's order has to be live for the flow of the same tick it was posted
 * in. Quoting against a stale book and only offering it to the next tick's flow
 * is a structurally losing game: the fill condition then selects on the price
 * having already moved the wrong way.
 */
export class Exchange {
  private rng: Rng;
  private tick = 0;
  /** Fundamental value, before taker impact. */
  private anchor: number;
  /** Accumulated taker impact, in ticks, decaying every tick. */
  private pressure = 0;
  /** Current drift, in bps per tick. */
  private drift: number;
  /** Current per-tick sigma, in bps. Volatility clusters. */
  private vol: number;
  /** The log return that will be realized at the next beginTick, in bps. */
  private moveBps = 0;
  private full: { bids: Level[]; asks: Level[] } = { bids: [], asks: [] };
  private working: { bids: Level[]; asks: Level[] } = { bids: [], asks: [] };
  private book!: Book;
  private tape: Print[] = [];

  constructor(seed = config.seed) {
    this.rng = new Rng(seed);
    this.anchor = config.startPrice;
    this.vol = config.volBps;
    this.drift = this.rng.range(-config.driftBps, config.driftBps);
    this.beginTick();
  }

  get currentTick() {
    return this.tick;
  }

  /** The book the desk reads this tick. */
  readBook(): Book {
    return this.book;
  }

  /**
   * Phase 1: realize the move planned last tick, plan the next one, and build
   * the book. The book is skewed toward the move it is about to make, which is
   * what makes resting depth informative rather than noise: the same way a real
   * book carries information, but never a giveaway, because the skew is noisy.
   */
  beginTick(): Book {
    this.tick++;
    this.anchor *= Math.exp(this.moveBps / 10_000);
    this.pressure *= 0.86;
    this.plan();
    this.book = this.build();
    this.working = { bids: this.full.bids.map((l) => ({ ...l })), asks: this.full.asks.map((l) => ({ ...l })) };
    return this.book;
  }

  /**
   * Phase 2: this tick's taker flow. Orders walk the book most-aggressive
   * level first; our resting order sits in that queue at its own price, so a
   * quote strictly inside the touch is hit before anything behind it.
   */
  trade(order: DeskOrder | null): TradeResult {
    const prints: Print[] = [];
    const fills: Fill[] = [];
    let remaining = order?.size ?? 0;
    const n = this.rng.poisson(config.flowRate);

    for (let i = 0; i < n; i++) {
      let left = Math.max(1, Math.round(this.rng.logNormal(config.flowSize, 0.72)));
      const side: Side = this.rng.bool(0.5 + this.flowLean()) ? "buy" : "sell";
      const slots = this.queue(side, order, remaining);

      let filled = 0;
      let notional = 0;
      for (const slot of slots) {
        if (left <= 0) break;
        const take = Math.min(left, slot.size);
        slot.size -= take;
        left -= take;
        filled += take;
        notional += take * slot.price;
        if (slot.orderId !== null) {
          remaining -= take;
          fills.push({ side: order!.side, size: take, price: slot.price, orderId: slot.orderId });
        }
      }
      // write consumed size back so the next taker in this tick sees the book it left behind
      for (const slot of slots) if (slot.level) slot.level.size = slot.size;

      if (!filled) continue;
      prints.push({ tick: this.tick, side, size: round(filled, 1), price: round(notional / filled, 4) });
      this.pressure += (side === "buy" ? filled : -filled) / config.impactShares;
    }

    for (const p of prints) {
      this.tape.push(p);
      if (this.tape.length > RING) this.tape.shift();
    }

    return {
      prints,
      fill: fills.length ? aggregate(fills) : null,
      resting: order && remaining > 0 ? { ...order, size: remaining } : null,
    };
  }

  /** Newest last. */
  recent(n: number): Print[] {
    return this.tape.slice(-n);
  }

  summary(lastTicks: number, currentTick: number): TradeSummary {
    const minTick = currentTick - lastTicks;
    let count = 0;
    let buyShares = 0;
    let sellShares = 0;
    let notional = 0;
    let lastPrice: number | null = null;
    let lastSide: Side | null = null;
    for (const t of this.tape) {
      if (t.tick <= minTick) continue;
      count++;
      if (t.side === "buy") buyShares += t.size;
      else sellShares += t.size;
      notional += t.size * t.price;
      lastPrice = t.price;
      lastSide = t.side;
    }
    const vol = buyShares + sellShares;
    return {
      count,
      buyShares,
      sellShares,
      cvdShares: buyShares - sellShares,
      vwap: vol > 0 ? notional / vol : null,
      lastPrice,
      lastSide,
    };
  }

  // -------------------------------------------------------------------------------------------

  /**
   * The queue a taker order walks: every level on the side it is taking, plus
   * our order when we are on that side. Sorted most aggressive first, with book
   * levels ahead of us at the same price (we are behind them in the queue).
   */
  private queue(taker: Side, order: DeskOrder | null, remaining: number): Slot[] {
    const levels = taker === "buy" ? this.working.asks : this.working.bids;
    const slots: Slot[] = levels.map((l) => ({ price: l.price, size: l.size, orderId: null, level: l }));
    if (order && remaining > 0 && order.side !== taker) slots.push({ price: order.price, size: remaining, orderId: order.id });
    slots.sort((a, b) => (taker === "buy" ? a.price - b.price : b.price - a.price));
    return slots;
  }

  /** Share of takers trading on the book's signal. This is the adverse selection the desk faces. */
  private flowLean(): number {
    return Math.tanh(this.moveBps / (this.vol * 1.8)) * config.flowLean;
  }

  /** Decide this tick's move, without applying it: the book is built around the pre-move price. */
  private plan() {
    const r = this.rng;
    if (r.bool(config.driftFlipProb)) this.drift = r.range(-1, 1) * config.driftBps;
    // volatility clusters: mean-revert toward the base sigma, never below a floor
    this.vol = clamp(this.vol + (config.volBps - this.vol) * 0.05 + r.normal() * 0.14, config.volBps * 0.35, config.volBps * 3.2);

    let bps = this.drift + this.vol * r.normal();
    if (r.bool(config.jumpProb)) bps += (r.bool() ? 1 : -1) * config.jumpBps * r.range(0.6, 1.8);
    // a weak leash, so a long session stays in a plausible band instead of drifting away
    bps -= Math.log(this.anchor / config.startPrice) * 220;

    this.moveBps = bps;
  }

  /** Generate the level-2 book around the impacted mid, skewed toward the coming move. */
  private build(): Book {
    const r = this.rng;
    const tick = config.tickSize;
    const mid = this.anchor + this.pressure * tick;
    // wider touch when volatility is running hot
    const halfSpread = Math.max(2, Math.round(2 + (this.vol / config.volBps - 1) * 2));
    const bidU = Math.round(mid / tick) - halfSpread;
    const bestBid = bidU * tick;
    const bestAsk = (bidU + halfSpread * 2) * tick;

    // Compressed through a tanh so a big move does not produce an absurd book.
    const skew = Math.tanh(this.moveBps / (this.vol * 2.2));
    const bidMult = 1 + skew * 0.6;
    const askMult = 1 - skew * 0.6;

    const bids: Level[] = [];
    const asks: Level[] = [];
    for (let i = 0; i < config.bookLevels; i++) {
      // size ramps with distance from the touch, with per-level noise
      const base = config.touchSize * (1 + i * 0.55);
      bids.push({ price: round(bestBid - i * tick, 4), size: round(base * bidMult * r.logNormal(1, 0.34), 1) });
      asks.push({ price: round(bestAsk + i * tick, 4), size: round(base * askMult * r.logNormal(1, 0.34), 1) });
    }
    this.full = { bids, asks };

    const midPx = (bestBid + bestAsk) / 2;
    const within = (ls: Level[], bps: number) => ls.filter((l) => (Math.abs(l.price - midPx) / midPx) * 10_000 <= bps).reduce((s, l) => s + l.size, 0);
    const bidDepth = within(bids, 10);
    const askDepth = within(asks, 10);
    const depthBps: Book["depthBps"] = {};
    for (const b of [2, 5, 10]) depthBps[String(b)] = { bid: within(bids, b), ask: within(asks, b) };

    return {
      tick: this.tick,
      bid: bestBid,
      ask: bestAsk,
      mid: midPx,
      spreadBps: ((bestAsk - bestBid) / midPx) * 10_000,
      imbalance: bidDepth + askDepth ? (bidDepth - askDepth) / (bidDepth + askDepth) : 0,
      levels: { bids: bids.slice(0, 5), asks: asks.slice(0, 5) },
      depthBps,
    };
  }
}

/** Several fills in one tick become one: total size, size-weighted price. */
function aggregate(fills: Fill[]): Fill {
  const size = fills.reduce((s, f) => s + f.size, 0);
  const price = fills.reduce((s, f) => s + f.size * f.price, 0) / size;
  return { side: fills[0]!.side, size: round(size, 1), price: round(price, 4), orderId: fills[0]!.orderId };
}
