import { config } from "./config";
import type { Action } from "./types";

/** What the model sees. Compact, relative, human readable. */
export interface TradeState {
  symbol: string;
  tick: number;
  horizonTicks: number; // the question is about the move over this many ticks
  tickMs: number;
  mid: number;
  spreadBps: number;
  bookImbalance: number; // -1 (all offers) .. 1 (all bids), within 10 bps of mid
  /** Cumulative resting shares within 2/5/10 bps of mid, per side. */
  depth: Record<string, { bid: number; ask: number }>;
  /** Top 5 levels each side, best first, as "price x size". */
  book: { bids: string[]; asks: string[] };
  returnsBps: { last1: number; last5: number; last20: number; last100: number };
  recentMids: string; // oldest..newest, sampled every 5 ticks over the horizon
  /** Taker prints over the last `horizonTicks`. cvdShares = taker buy volume - taker sell volume. */
  trades: { count: number; buyShares: number; sellShares: number; cvdShares: number; vwap: number | null; lastPrice: number | null; lastSide: "buy" | "sell" | null };
  recentTrades: string[]; // newest last, "tick side size @ price"
  allowed: { buy: boolean; sell: boolean };
}

export interface Decision {
  action: Action;
  probabilities: Record<Action, number>;
  latencyMs: number;
  inputTokens: number;
}

export interface Model {
  readonly name: string;
  /** True when no real model is connected: the UI shows a stand-in badge. */
  readonly standIn: boolean;
  /**
   * Skip the real inference wait while replaying history. Warm-up runs thousands
   * of ticks before the server opens; sleeping through them would take minutes.
   * The latency still gets reported as if it had waited.
   */
  fast: boolean;
  decide(state: TradeState): Promise<Decision>;
}

export const QUESTION = {
  question: `Will ${config.symbol} be higher or lower than the current mid after \`horizonTicks\` more ticks?`,
  goal: `Trade ${config.symbol} on a simulated book. Ticks are ~${config.tickMs} ms; \`horizonTicks\` is the horizon. A decision is made every tick and held until the next one. The trade crosses the spread (\`spreadBps\`), so the move must beat that cost.`,
  inputs:
    "Taker flow is the strongest signal: `trades.cvdShares` (taker buys minus taker sells over the horizon), `trades.lastSide` and `recentTrades` show who is hitting the book. `depth` and `book` show resting liquidity per side at several distances from mid; thin depth on one side means price moves easily that way. `returnsBps` and `recentMids` show the path over the horizon. If `allowed.buy` is false the trade will be a sell regardless, and vice versa.",
  buy: `Buy ${config.symbol} now: mid more likely to be higher after \`horizonTicks\` ticks, by more than the spread.`,
  sell: `Sell ${config.symbol} now: mid more likely to be lower after \`horizonTicks\` ticks, by more than the spread.`,
} as const;

/**
 * Deterministic stand-in for a real model: momentum + book imbalance + taker
 * flow, pulled back toward flat so it trades both ways. Seeded per tick, so the
 * same session always makes the same calls.
 */
export class StandInModel implements Model {
  readonly name = "stand-in";
  readonly standIn = true;
  fast = false;

  async decide(state: TradeState): Promise<Decision> {
    const t0 = performance.now();
    const notional = state.trades.buyShares + state.trades.sellShares;
    const flow = notional ? state.trades.cvdShares / notional : 0;
    // Resting depth is the strongest read on where the next move goes; short-term
    // momentum and taker flow are secondary and mostly noise, so they get small
    // weights. Seeded jitter keeps it from trading like a metronome.
    const signal =
      state.bookImbalance * 5 +
      flow * 1.5 +
      state.returnsBps.last20 / 12 +
      noise(state.tick) * 0.6;
    const buy = 1 / (1 + Math.exp(-signal)); // logistic
    const probabilities = { buy, sell: 1 - buy, hold: 0 };
    // The window this stands in for: a model round trip, reported the same way
    // during warm-up as live so the average latency means something.
    const latencyMs = config.inferenceMs + noise(state.tick + 1) * 8;
    if (!this.fast) await Bun.sleep(Math.max(0, latencyMs));
    return {
      action: buy >= 0.5 ? "buy" : "sell",
      probabilities,
      latencyMs: this.fast ? latencyMs : performance.now() - t0,
      inputTokens: Math.round(JSON.stringify(state).length / 4),
    };
  }
}

/** Real decisions from Claude, over the Messages API. Enabled with MODEL=claude + ANTHROPIC_API_KEY. */
export class ClaudeModel implements Model {
  readonly name = config.claudeModel;
  readonly standIn = false;
  /** No fast path: every decision is a network round trip, so warm-up is skipped. */
  fast = false;

  async decide(state: TradeState): Promise<Decision> {
    const t0 = performance.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicApiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.claudeModel,
        max_tokens: 256,
        system: "You are the decision model for an automated trading desk. Answer only with JSON.",
        messages: [
          {
            role: "user",
            content:
              `${QUESTION.question}\n\n${QUESTION.goal}\n\nInputs: ${QUESTION.inputs}\n\n` +
              `State:\n${JSON.stringify(state)}\n\n` +
              `Reply with exactly {"action":"buy"|"sell","probUp":0..1} and nothing else.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens?: number } };
    const text = json.content.map((c) => c.text ?? "").join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`anthropic: no JSON in ${text.slice(0, 120)}`);
    const parsed = JSON.parse(match[0]) as { action?: string; probUp?: number };
    const buy = Math.min(1, Math.max(0, Number(parsed.probUp ?? 0.5)));
    const action: Action = parsed.action === "sell" ? "sell" : buy >= 0.5 ? "buy" : "sell";
    return {
      action,
      probabilities: { buy, sell: 1 - buy, hold: 0 },
      latencyMs: performance.now() - t0,
      inputTokens: json.usage?.input_tokens ?? 0,
    };
  }
}

/** A cheap deterministic jitter, so the stand-in does not trade like a robot. */
function noise(seed: number): number {
  let h = (Math.imul(seed, 2654435761) >>> 0);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return ((h % 1000) / 1000 - 0.5) * 3;
}

export const createModel = (): Model => (config.model === "claude" && config.anthropicApiKey ? new ClaudeModel() : new StandInModel());
