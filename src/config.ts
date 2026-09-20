const env = (key: string, fallback?: string) => process.env[key] ?? fallback;
const num = (key: string, fallback: number) => (env(key) ? Number(env(key)) : fallback);

/**
 * The traded asset is fictional: Anthropic is private, so there is no real
 * order book to read. Everything below drives a self-contained synthetic
 * market, and the seed makes a session reproducible.
 */
export const config = {
  seed: num("SEED", 20260920),
  tickMs: num("TICK_MS", 300),

  /** The desk's name. The instrument below is a separate thing: a fictional listing. */
  product: env("PRODUCT", "SandBase Jev Trader")!,
  symbol: env("SYMBOL", "ANTH")!,
  company: env("COMPANY", "Anthropic")!,
  tickSize: num("TICK_SIZE", 0.01),
  startPrice: num("START_PRICE", 342),

  /** Per-tick log-return sigma, in basis points. */
  volBps: num("VOL_BPS", 1.7),
  /** The drift flips sign every so often, so the tape trends instead of chopping. */
  driftBps: num("DRIFT_BPS", 0.5),
  driftFlipProb: num("DRIFT_FLIP_PROB", 0.012),
  /** A news shock: rare, and much larger than the tick-to-tick noise. */
  jumpProb: num("JUMP_PROB", 0.0016),
  jumpBps: num("JUMP_BPS", 15),

  /** Levels generated each side of the synthetic book. */
  bookLevels: num("BOOK_LEVELS", 20),
  /** Shares resting at the touch before the size ramp. */
  touchSize: num("TOUCH_SIZE", 900),
  /** Taker orders per tick (Poisson mean). */
  flowRate: num("FLOW_RATE", 1.1),
  /** Median taker order size, in shares. */
  flowSize: num("FLOW_SIZE", 420),
  /**
   * How informed the taker flow is, 0..1. Resting depth carries the signal (see
   * the book skew in exchange.ts); this is only the share of takers trading on
   * it. Real flow is mostly uninformed, which is what makes quoting inside the
   * touch pay for the spread instead of only paying for adverse selection.
   */
  flowLean: num("FLOW_LEAN", 0.45),
  /** Net taker shares that push the mid by one tick. */
  impactShares: num("IMPACT_SHARES", 2200),

  /** Shares per order the trader posts, and the inventory cap it stays inside. */
  tradeSize: num("TRADE_SIZE", 200),
  maxPosition: num("MAX_POSITION", 1000),
  bankrollUsd: num("BANKROLL_USD", 100_000),
  /** Quote this many ticks inside the touch (0 joins the best bid/ask). Never crosses. */
  quoteInsideTicks: num("QUOTE_INSIDE_TICKS", 1),
  /** The model is asked about the move over this many ticks. */
  horizonTicks: num("HORIZON_TICKS", 100),

  model: env("MODEL", "stand-in") as "stand-in" | "claude",
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  claudeModel: env("CLAUDE_MODEL", "claude-sonnet-4-5")!,
  /** Stand-in inference time, so the latency column reads like a real model. */
  inferenceMs: num("INFERENCE_MS", 55),

  port: num("PORT", 3000),
  historySize: num("HISTORY_SIZE", 1000),
};
