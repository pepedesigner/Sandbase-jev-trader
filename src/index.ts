import { config } from "./config";
import { Exchange } from "./exchange";
import { startTickFeed } from "./feed";
import { createModel } from "./model";
import { startServer } from "./server";
import { Trader } from "./trader";

const WARMUP_TICKS = Number(process.env.WARMUP_TICKS ?? 1800);

const exchange = new Exchange();
const model = createModel();

const server = startServer(
  {
    product: config.product,
    model: model.name,
    standIn: model.standIn,
    symbol: config.symbol,
    company: config.company,
    seed: config.seed,
    tickMs: config.tickMs,
    tradeSize: config.tradeSize,
    maxPosition: config.maxPosition,
    bankrollUsd: config.bankrollUsd,
    // the warm-up is simulated history, so uptime starts where the tape does
    startedAt: Date.now() - WARMUP_TICKS * config.tickMs,
  },
  () => trader.history,
);

const trader = new Trader(exchange, model, (e, timing) => {
  server.broadcast(e);
  if (e.decision && !e.decision.late) {
    const p = e.decision.probabilities;
    const q = e.quote;
    const quote = !q ? " no order (cap on both sides)" : ` ${q.side.toUpperCase()} ${q.size} @ ${q.price.toFixed(2)}${q.capped ? " capped" : ""}`;
    const fill = e.fill ? ` FILL ${e.fill.side} ${e.fill.size} @ ${e.fill.price.toFixed(2)}` : "";
    console.log(
      `#${e.tick} ${e.mid.toFixed(2)} b${(p.buy * 100).toFixed(0)} s${(p.sell * 100).toFixed(0)} ${e.decision.latencyMs}ms${quote}${fill} pnl $${e.totals.pnlUsd}${timing ? ` · loop ${timing.loopMs}ms` : ""}`,
    );
  }
});

// Replay a stretch of the session before going live, so the chart, the counters
// and the P&L are already populated on the first frame a viewer sees. Only the
// stand-in can do this: a real model would need one network call per tick.
if (WARMUP_TICKS > 0 && model.standIn) {
  model.fast = true;
  for (let i = 0; i < WARMUP_TICKS; i++) {
    const book = exchange.beginTick();
    await trader.onTick(i + 1, book);
  }
  model.fast = false;
}

console.log(
  `${config.product.toLowerCase().replace(/\s+/g, "-")} · ${config.symbol} (${config.company}, fictional) · model=${model.name}${model.standIn ? " STAND-IN" : ""} · post-only ${config.quoteInsideTicks} tick inside the touch · horizon ${config.horizonTicks} ticks · seed ${config.seed} · warm-up ${WARMUP_TICKS} ticks · :${config.port}`,
);

startTickFeed(
  (tick) => {
    const book = exchange.beginTick();
    trader.onTick(tick, book);
  },
  config.tickMs,
  WARMUP_TICKS,
);
