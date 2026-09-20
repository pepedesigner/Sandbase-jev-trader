export type Action = "buy" | "sell" | "hold";
export type Side = "buy" | "sell";

/** One price level of the book. */
export interface Level {
  price: number;
  size: number;
}

/** This tick's order, resting on the book and replacing the last one. */
export interface Quote {
  side: Side;
  price: number;
  size: number;
  orderId: number;
  /** Order ids this quote replaced. */
  cancel: number[];
  /** The inventory cap picked this side; the model's probabilities still show its call. */
  capped: boolean;
}

/** A taker hit one of our resting orders. */
export interface Fill {
  side: Side;
  size: number;
  price: number;
  orderId: number;
}

export interface Decision {
  action: Action;
  probabilities: { buy: number; sell: number; hold: number };
  latencyMs: number;
  late: boolean;
}

export interface Position {
  side: "long" | "short" | "flat";
  size: number;
  entryPrice: number | null;
  unrealizedUsd: number;
}

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
  decision: Decision | null;
  quote: Quote | null;
  fill: Fill | null;
  book: { bids: Level[]; asks: Level[] };
  resting: { bidShares: number; askShares: number };
  position: Position;
  totals: Totals;
}

export interface Meta {
  product: string;
  model: string;
  standIn: boolean;
  symbol: string;
  company: string;
  seed: number;
  tickMs: number;
  tradeSize: number;
  maxPosition: number;
  bankrollUsd: number;
  startedAt: number;
}

export type ConnectionState = "connecting" | "live" | "reconnecting";

export interface FeedState {
  meta: Meta | null;
  events: TickEvent[];
  latest: TickEvent | null;
  connection: ConnectionState;
  avgLatencyMs: number;
}
