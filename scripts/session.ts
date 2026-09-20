/**
 * Headless session runner with fill attribution: simulate N ticks as fast as the
 * machine allows, then report where the P&L actually came from.
 *
 *   bun run scripts/session.ts 5000
 *   SEED=7 bun run scripts/session.ts 5000
 */
import { config } from "../src/config";
import { Exchange } from "../src/exchange";
import { createModel } from "../src/model";
import { Trader, type TickEvent } from "../src/trader";

const ticks = Number(process.argv[2] ?? 3000);

const exchange = new Exchange();
const model = createModel();
model.fast = true; // no point sleeping through a headless replay
const events: TickEvent[] = [];
const trader = new Trader(exchange, model, (e) => events.push(e));

const t0 = performance.now();
for (let i = 0; i < ticks; i++) {
  const book = exchange.beginTick();
  await trader.onTick(i + 1, book);
}
const elapsed = performance.now() - t0;

const last = events.at(-1)!;
const f = (x: number, d = 2) => x.toFixed(d);
console.log(`seed ${config.seed} · ${ticks} ticks in ${f(elapsed / 1000, 1)}s (${f(((ticks / elapsed) * 1000), 0)} ticks/s)`);

// ---- directional accuracy of the model -------------------------------------
let correct = 0;
let decided = 0;
for (let i = 1; i < events.length; i++) {
  const prev = events[i - 1]!;
  const d = prev.decision;
  if (!d || d.late || d.action === "hold") continue;
  decided++;
  if ((d.action === "buy") === (events[i]!.mid >= prev.mid)) correct++;
}

// ---- fill attribution: mark each fill forward ---------------------------------
const horizons = [1, 5, 20, 50];
const edge: Record<number, number> = {};
const edgeTicks: Record<number, number> = {};
for (const k of horizons) {
  edge[k] = 0;
  edgeTicks[k] = 0;
}
let fills = 0;
let fillShares = 0;
for (let i = 0; i < events.length; i++) {
  const fill = events[i]!.fill;
  if (!fill) continue;
  fills++;
  fillShares += fill.size;
  const sign = fill.side === "buy" ? 1 : -1;
  for (const k of horizons) {
    const later = events[i + k];
    if (!later) continue;
    edge[k]! += sign * (later.mid - fill.price) * fill.size;
    edgeTicks[k]! += 1;
  }
}

const mid = (e: TickEvent) => e.mid;
const first = mid(events[0]!);
const finalMid = mid(events[events.length - 1]!);
console.log(`seed ${config.seed} · ${ticks} ticks in ${f(elapsed / 1000, 1)}s (${f((ticks / elapsed) * 1000, 0)} ticks/s)`);
console.log(`price   ${f(first)} -> ${f(finalMid)} (${f(((finalMid - first) / first) * 10000)} bps)`);
console.log(`fills   ${fills} ticks · ${fillShares} shares · ${f((fills / ticks) * 100, 1)}% of ticks`);
console.log(`model   right on ${f((correct / Math.max(1, decided)) * 100, 1)}% of ${decided} decided ticks`);
console.log(`pnl     $${f(last.totals.pnlUsd)} (${f(last.totals.pnlPct, 3)}%) · realized $${f(last.totals.realizedUsd)}`);
for (const k of horizons) {
  if (!edgeTicks[k]) continue;
  const perShare = edge[k]! / fillShares;
  console.log(`  edge +${String(k).padStart(2)} ticks  $${f(perShare, 4)}/share  (${f(perShare / config.tickSize, 2)} ticks)`);
}
console.log(`curve   ${sparkline(events.map((e) => e.totals.pnlUsd), 64)}`);


/** Coarse block-character plot of a series, so a P&L path can be eyeballed. */
function sparkline(xs: number[], width: number): string {
  if (xs.length < 2) return "";
  const blocks = "▁▂▃▄▅▆▇█";
  const step = Math.max(1, Math.floor(xs.length / width));
  const sampled: number[] = [];
  for (let i = 0; i < xs.length; i += step) sampled.push(xs[i]!);
  const lo = Math.min(...sampled);
  const hi = Math.max(...sampled);
  const span = hi - lo || 1;
  return sampled.map((x) => blocks[Math.min(7, Math.floor(((x - lo) / span) * 8))]).join("");
}
