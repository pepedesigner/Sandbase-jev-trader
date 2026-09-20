import { config } from "./config";

/**
 * Emits tick numbers on a fixed interval. This is the clock the whole system is
 * built around: one decision, one order, per tick. Unlike a chain there is no
 * feed to fall behind, so ticks are emitted unconditionally and a tick that
 * arrives while the loop is still busy is emitted as late.
 */
export function startTickFeed(onTick: (tick: number) => void, tickMs = config.tickMs, start = 0) {
  let tick = start;
  const timer = setInterval(() => onTick(++tick), tickMs);
  return () => clearInterval(timer);
}
