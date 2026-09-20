import { appendFileSync, mkdirSync } from "node:fs";
import { config } from "./config";
import type { DeskOrder, Exchange, TradeResult } from "./exchange";
import type { Action, Book, Fill, Level, Quote, Side } from "./types";
import type { Decision, Model, TradeState } from "./model";

export interface Totals {
  ticks: number;
  decisions: number;
  quotes: number;
  fills: number;
  lateTicks: number;
  volumeShares: number;
  notional: number;
  modelUsd: number;
  realizedUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

export interface TickEvent {
  tick: number;
  ts: number;
  mid: number;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  decision: { action: Action; probabilities: Record<Action, number>; latencyMs: number; late: boolean } | null;
  /** The order this tick put on the book. */
  quote: Quote | null;
  /** A taker hit our resting order this tick (aggregated). */
  fill: Fill | null;
  /** Top of the book, for the ladder. */
  book: { bids: Level[]; asks: Level[] };
  /** Our size still resting after this tick's order and flow. */
  resting: { bidShares: number; askShares: number };
  position: { side: "long" | "short" | "flat"; size: number; entryPrice: number | null; unrealizedUsd: number };
  totals: Totals;
}

/** Per-tick latency: the whole loop, plus the model call on its own. */
export interface Timing { loopMs: number; modelMs: number }

interface Resting extends DeskOrder { tick: number }

/**
 * Every tick: read the book, ask the model buy or sell, and post one post-only
 * limit order on that side (`quoteInsideTicks` inside the touch), replacing
 * whatever we had resting. One decision in flight; a tick that arrives while the
 * previous one is still running is emitted as late.
 *
 * Being inside the touch puts us at the front of the queue on our side, so
 * takers hit us before the levels behind us: that is the whole edge. It also
 * means we are picked off whenever the price moves through us, which the P&L
 * shows plainly rather than hiding.
 */
export class Trader {
  readonly history: TickEvent[] = [];
  private mids: number[] = [];
  private busy = false;
  private order: Resting | null = null;
  /** Order ids come off a venue-wide sequence, so they do not start at 1. */
  private nextOrderId = 100_000_000 + (config.seed % 10_000_000);
  private position = { shares: 0, costUsd: 0 }; // signed inventory and its cost basis
  private totals: Totals = {
    ticks: 0, decisions: 0, quotes: 0, fills: 0, lateTicks: 0,
    volumeShares: 0, notional: 0, modelUsd: 0, realizedUsd: 0, pnlUsd: 0, pnlPct: 0,
  };

  constructor(
    private exchange: Exchange,
    private model: Model,
    private onEvent: (e: TickEvent, timing?: Timing) => void,
  ) {
    mkdirSync("data", { recursive: true });
  }

  async onTick(tick: number, book: Book) {
    this.totals.ticks++;
    if (this.busy) {
      this.totals.lateTicks++;
      this.emit(tick, book, null, null, null, true);
      return;
    }
    this.busy = true;
    const t0 = performance.now();
    try {
      this.mids.push(book.mid);
      if (this.mids.length > 400) this.mids.shift();

      const decision = await this.model.decide(this.buildState(tick, book));
      this.totals.decisions++;
      this.totals.modelUsd += (decision.inputTokens / 1e6) * 3;

      const wanted: Side = decision.action === "sell" ? "sell" : "buy";
      const other: Side = wanted === "buy" ? "sell" : "buy";
      // The inventory cap can only pick the reducing side. The probabilities still show the model's call.
      const side: Side | null = this.allowed(wanted) ? wanted : this.allowed(other) ? other : null;

      let quote: Quote | null = null;
      if (side) {
        decision.action = side;
        quote = this.post(tick, side, book, side !== wanted);
        this.totals.quotes++;
      }

      // The tick's flow runs after we post, so this order is live for it. When we
      // posted nothing the previous order stays resting, exactly as it would on a
      // real book.
      const result = this.exchange.trade(this.order);
      this.settle(result);

      this.emit(tick, book, decision, quote, result.fill, false, {
        loopMs: Math.round(performance.now() - t0),
        modelMs: Math.round(decision.latencyMs),
      });
    } catch (e) {
      console.error(`tick ${tick}:`, (e as Error).message);
    } finally {
      this.busy = false;
    }
  }

  /** Where this tick's order rests: `quoteInsideTicks` inside the touch, never crossing. */
  quotePrice(side: Side, book: Book): number {
    const step = config.quoteInsideTicks * config.tickSize;
    let p = side === "buy" ? book.bid + step : book.ask - step;
    if (side === "buy" && p >= book.ask) p = book.bid;
    if (side === "sell" && p <= book.bid) p = book.ask;
    return round(p, 4);
  }

  /** Cancel what is resting, post one post-only order on `side`. */
  private post(tick: number, side: Side, book: Book, capped: boolean): Quote {
    const cancel = this.order ? [this.order.id] : [];
    const id = ++this.nextOrderId;
    this.order = { id, side, price: this.quotePrice(side, book), size: config.tradeSize, tick };
    return { side, price: this.order.price, size: this.order.size, orderId: id, cancel, capped };
  }

  /** Apply the tick's flow: shrink or clear our order, and book the fill. */
  private settle(result: TradeResult) {
    this.order = result.resting ? { ...result.resting, tick: this.order?.tick ?? 0 } : null;
    if (result.fill) this.applyFill(result.fill);
  }

  private restingShares(side: Side) {
    return this.order && this.order.side === side ? this.order.size : 0;
  }

  /** Would this order, plus what is already resting on its side, keep us inside the cap? */
  private allowed(side: Side) {
    const size = config.tradeSize;
    const exposure =
      side === "buy"
        ? this.position.shares + this.restingShares("buy") + size
        : this.position.shares - this.restingShares("sell") - size;
    return Math.abs(exposure) <= config.maxPosition;
  }

  private buildState(tick: number, book: Book): TradeState {
    const m = this.mids;
    const n = m.length;
    const H = config.horizonTicks;
    const ret = (k: number) => (n > k ? ((m[n - 1]! - m[n - 1 - k]!) / m[n - 1 - k]!) * 10_000 : 0);
    const sampled = m.slice(-H).filter((_, i, a) => (a.length - 1 - i) % 5 === 0); // every 5th tick, newest included
    const lvl = (l: Level) => `${l.price.toFixed(2)} x ${Math.round(l.size)}`;
    const depth: TradeState["depth"] = {};
    for (const [k, v] of Object.entries(book.depthBps)) depth[k + "bps"] = { bid: round(v.bid, 0), ask: round(v.ask, 0) };
    return {
      symbol: config.symbol,
      tick,
      horizonTicks: H,
      tickMs: config.tickMs,
      mid: book.mid,
      spreadBps: round(book.spreadBps, 2),
      bookImbalance: round(book.imbalance, 3),
      depth,
      book: { bids: book.levels.bids.map(lvl), asks: book.levels.asks.map(lvl) },
      returnsBps: { last1: round(ret(1), 2), last5: round(ret(5), 2), last20: round(ret(20), 2), last100: round(ret(100), 2) },
      recentMids: sampled.map((x) => x.toFixed(2)).join(" "),
      trades: this.exchange.summary(H, tick),
      recentTrades: this.exchange.recent(10).map((t) => `${t.tick} ${t.side} ${Math.round(t.size)} @ ${t.price.toFixed(2)}`),
      allowed: { buy: this.allowed("buy"), sell: this.allowed("sell") },
    };
  }

  private applyFill(f: Fill) {
    if (f.size <= 0) return;
    const signed = f.side === "buy" ? f.size : -f.size;
    const p = this.position;
    if (p.shares === 0 || Math.sign(p.shares) === Math.sign(signed)) {
      p.costUsd += signed * f.price; // adding to the position
    } else {
      const closing = Math.min(Math.abs(signed), Math.abs(p.shares)) * Math.sign(signed);
      const entry = p.costUsd / p.shares;
      this.totals.realizedUsd += -closing * (f.price - entry); // the closing part realizes P&L
      p.costUsd += closing * entry;
      p.costUsd += (signed - closing) * f.price; // any flip opens the other way
    }
    p.shares += signed;
    if (Math.abs(p.shares) < 1e-9) {
      p.shares = 0;
      p.costUsd = 0;
    }
    this.totals.fills++;
    this.totals.volumeShares += f.size;
    this.totals.notional += f.size * f.price;
  }

  private entryPrice() {
    return this.position.shares ? this.position.costUsd / this.position.shares : null;
  }

  private emit(tick: number, book: Book, decision: Decision | null, quote: Quote | null, fill: Fill | null, late: boolean, timing?: Timing) {
    const t = this.totals;
    const unrealized = this.position.shares ? this.position.shares * (book.mid - this.entryPrice()!) : 0;
    t.pnlUsd = t.realizedUsd + unrealized;
    t.pnlPct = (t.pnlUsd / config.bankrollUsd) * 100;

    const event: TickEvent = {
      tick,
      ts: Date.now(),
      mid: round(book.mid, 4),
      bestBid: round(book.bid, 2),
      bestAsk: round(book.ask, 2),
      spreadBps: round(book.spreadBps, 2),
      decision: late
        ? { action: "hold", probabilities: { buy: 0, sell: 0, hold: 1 }, latencyMs: 0, late: true }
        : decision && { action: decision.action, probabilities: decision.probabilities, latencyMs: Math.round(decision.latencyMs), late: false },
      quote,
      fill,
      book: book.levels,
      resting: { bidShares: round(this.restingShares("buy"), 0), askShares: round(this.restingShares("sell"), 0) },
      position: {
        side: this.position.shares > 0 ? "long" : this.position.shares < 0 ? "short" : "flat",
        size: Math.abs(this.position.shares),
        entryPrice: this.entryPrice(),
        unrealizedUsd: round(unrealized, 2),
      },
      totals: {
        ...t,
        volumeShares: round(t.volumeShares, 0),
        notional: round(t.notional, 0),
        modelUsd: round(t.modelUsd, 6),
        realizedUsd: round(t.realizedUsd, 2),
        pnlUsd: round(t.pnlUsd, 4),
        pnlPct: round(t.pnlPct, 4),
      },
    };
    this.history.push(event);
    if (this.history.length > config.historySize) this.history.shift();
    // The tape is a convenience for offline review and for cutting video against
    // real numbers; it is never allowed to take the trading loop down.
    try {
      appendFileSync("data/events.jsonl", JSON.stringify(event) + "\n");
    } catch {}
    this.onEvent(event, timing);
  }
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
