"use client";

import { useEffect, useRef, useState } from "react";
import type { TickEvent } from "@/lib/types";
import { fmtInt, fmtPrice, fmtShares } from "@/lib/format";
import styles from "./Feed.module.css";

/** Must match `.row { height }` in Feed.module.css. */
const ROW_H = 26;
/** Hard ceiling, so a very tall viewport does not render an absurd list. */
const MAX_ROWS = 40;

type Kind = "buy" | "sell" | "late";

function kindOf(event: TickEvent): Kind {
  const d = event.decision;
  if (!d || d.late) return "late";
  if (d.action === "buy") return "buy";
  if (d.action === "sell") return "sell";
  return "late";
}

const KIND_CLASS: Record<Kind, string> = {
  buy: styles.kindBuy,
  sell: styles.kindSell,
  late: styles.kindLate,
};

const WORD: Record<Kind, string> = { buy: "BUY", sell: "SELL", late: "LATE" };

/**
 * One row per tick. The word is the side the model picked, the detail is the
 * order that went on the book (a bid or an ask, at its price), and when a taker
 * hit our order in that tick the detail becomes the fill instead. The last
 * column is the resting order id.
 */
export default function Feed({ events }: { events: TickEvent[] }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // How many whole 26px rows fit in the box the layout gives us. The list
  // itself clips, so a wrong guess is never a half-drawn row, only a hidden one.
  const [capacity, setCapacity] = useState(MAX_ROWS);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const fits = Math.max(1, Math.min(MAX_ROWS, Math.floor(el.clientHeight / ROW_H)));
      setCapacity((prev) => (prev === fits ? prev : fits));
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = events.slice(-capacity).reverse();

  return (
    <section className={styles.feed}>
      <div className={styles.label}>TAPE</div>
      <div className={styles.list} ref={listRef}>
        {rows.length === 0 ? (
          <div className={styles.empty}>no ticks yet</div>
        ) : (
          rows.map((event, i) => {
            const kind = kindOf(event);
            const decision = event.decision;
            const quote = event.quote;
            const fill = event.fill;
            const decided = kind !== "late";
            const kindClass = KIND_CLASS[kind];

            const conf = !decided || !decision ? "" : Math.max(
              decision.probabilities.buy,
              decision.probabilities.sell,
              decision.probabilities.hold,
            ).toFixed(2);

            const lat = !decided || !decision ? "" : `${decision.latencyMs}ms`;

            let detail = "";
            let detailMuted = false;
            if (fill && fill.size > 0) {
              detail = `FILL ${fmtShares(fill.size)} @ ${fmtPrice(fill.price)}`;
            } else if (decided && quote) {
              detail = `${quote.side === "buy" ? "bid" : "ask"} ${fmtShares(quote.size)} @ ${fmtPrice(quote.price)}${quote.capped ? " cap" : ""}`;
            } else if (decided) {
              detail = "no order";
              detailMuted = true;
            }

            const rowClass = [styles.row, kindClass, i === 0 ? styles.newest : "", fill ? styles.filled : ""]
              .filter(Boolean)
              .join(" ");

            return (
              <div key={event.tick} className={rowClass}>
                <span className={`${styles.cell} ${styles.tick}`}>{fmtInt(event.tick)}</span>
                <span className={`${styles.cell} ${styles.word}`}>{WORD[kind]}</span>
                <span className={`${styles.cell} ${styles.conf}`}>{conf}</span>
                <span className={`${styles.cell} ${styles.lat}`}>{lat}</span>
                <span className={`${styles.cell} ${styles.detail}${detailMuted ? ` ${styles.muted}` : ""}`}>
                  {detail}
                </span>
                <span className={`${styles.cell} ${styles.id}`}>
                  {quote ? `#${quote.orderId}` : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
