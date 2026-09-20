"use client";

import type { TickEvent } from "@/lib/types";
import { fmtConf, fmtPct, fmtShares } from "@/lib/format";
import styles from "./DecisionPanel.module.css";

export interface DecisionPanelProps {
  latest: TickEvent | null;
}

type Chosen = "buy" | "sell" | null;

interface BarRowProps {
  label: string;
  /** css color for the label text */
  labelColor: string;
  /** dims the label to .38 when false */
  active: boolean;
  /** 0..1, fill width as a fraction of the track */
  value: number;
  /** css background for the fill */
  fill: string;
  /** right-hand percentage text ("62%" or "-") */
  pct: string;
}

function BarRow({ label, labelColor, active, value, fill, pct }: BarRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label} style={{ color: labelColor, opacity: active ? 1 : 0.38 }}>
        {label}
      </span>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: fill }}
        />
      </div>
      <span className={styles.pct}>{pct}</span>
    </div>
  );
}

/** The top of the book, worked from the outside in: offers on top, bids below, touch in the middle. */
function Ladder({ latest }: { latest: TickEvent | null }) {
  const book = latest?.book ?? null;
  if (!book || (!book.bids.length && !book.asks.length)) return <div className={styles.ladderEmpty}>no book</div>;

  const quote = latest?.quote ?? null;
  const rows = [
    ...book.asks.slice().reverse().map((l) => ({ ...l, side: "ask" as const })),
    ...book.bids.map((l) => ({ ...l, side: "bid" as const })),
  ];
  const max = Math.max(...rows.map((r) => r.size), 1);
  const oursSide = quote?.side === "buy" ? "bid" : quote ? "ask" : null;
  // After a partial fill the size left on the book is smaller than the order was.
  const oursSize = oursSide === "bid" ? latest?.resting.bidShares ?? 0 : latest?.resting.askShares ?? 0;

  return (
    <div className={styles.ladder}>
      {rows.map((r) => {
        // Our quote sits one tick inside the touch, so it is its own row: mark that row only.
        const ours = oursSide === r.side && quote?.price === r.price;
        const isTouch =
          (r.side === "ask" && r.price === book.asks[0]?.price) ||
          (r.side === "bid" && r.price === book.bids[0]?.price);
        return (
          <div
            key={`${r.side}-${r.price}`}
            className={[styles.ladderRow, r.side === "ask" ? styles.askRow : styles.bidRow, isTouch ? styles.touch : "", ours ? styles.ours : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.depth} style={{ width: `${(r.size / max) * 100}%` }} aria-hidden="true" />
            <span className={styles.ladderPx}>{r.price.toFixed(2)}</span>
            <span className={styles.ladderSz}>{ours ? `${fmtShares(oursSize)} us` : fmtShares(r.size)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DecisionPanel({ latest }: DecisionPanelProps) {
  const decision = latest?.decision ?? null;
  const late = decision ? decision.late : true;
  // "hold" is treated as a non-decision, exactly as the feed does.
  const chosen: Chosen = decision && !decision.late && decision.action !== "hold" ? decision.action : null;

  const probs = decision?.probabilities ?? { buy: 0, sell: 0, hold: 0 };
  const decided = decision !== null && !late && chosen !== null;
  const pctOf = (p: number) => (decided ? fmtPct(p) : "-");

  const headline = chosen ? (chosen === "buy" ? "BUY" : "SELL") : "LATE";
  const headlineColor = chosen
    ? chosen === "buy"
      ? "var(--buy-ink)"
      : "var(--sell-ink)"
    : "var(--late-ink)";
  const headlinePct = chosen ? fmtPct(probs[chosen]) : "";
  const conf = decision ? Math.max(probs.buy, probs.sell, probs.hold) : 0;
  const shape = latest?.quote?.capped ? "capped by the inventory limit" : null;

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionLabel}>WHICH SIDE THIS TICK?</div>

        <div className={styles.headline} style={{ color: headlineColor }}>
          <span className={styles.headlineWord}>{headline}</span>
          {headlinePct ? <span className={styles.headlinePct}>{headlinePct}</span> : null}
        </div>

        <BarRow
          label="buy"
          labelColor="var(--buy-ink)"
          active={chosen === "buy"}
          value={probs.buy}
          fill={chosen === "buy" ? "var(--buy-bar)" : "var(--buy-bar-dim)"}
          pct={pctOf(probs.buy)}
        />
        <BarRow
          label="sell"
          labelColor="var(--sell-ink)"
          active={chosen === "sell"}
          value={probs.sell}
          fill={chosen === "sell" ? "var(--sell-bar)" : "var(--sell-bar-dim)"}
          pct={pctOf(probs.sell)}
        />

        <div className={styles.footnote}>
          <span>{decided ? `conf ${fmtConf(conf)}` : "held this tick"}</span>
          <span>{shape ?? ""}</span>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>TOP OF BOOK</div>
        <Ladder latest={latest} />
      </section>
    </div>
  );
}
