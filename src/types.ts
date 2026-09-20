export type Side = "buy" | "sell";
export type Action = "buy" | "sell" | "hold";

/** One price level of the synthetic book. */
export interface Level {
  price: number;
  size: number;
}

/** The book the trader reads each tick. `levels` is best-first on both sides. */
export interface Book {
  tick: number;
  bid: number;
  ask: number;
  mid: number;
  spreadBps: number;
  /** (bidDepth - askDepth) / (bidDepth + askDepth) within 1% of mid. -1..1 */
  imbalance: number;
  levels: { bids: Level[]; asks: Level[] };
  /** Cumulative shares within N bps of mid, per side. */
  depthBps: Record<string, { bid: number; ask: number }>;
}

/** A taker order that printed. `side` is the aggressor's side. */
export interface Print {
  tick: number;
  side: Side;
  size: number;
  price: number;
}

/** This tick's order, resting on the book and replacing last tick's. */
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

/** A taker hit one of our resting orders. `side` is OUR side. */
export interface Fill {
  side: Side;
  size: number;
  price: number;
  orderId: number;
}
