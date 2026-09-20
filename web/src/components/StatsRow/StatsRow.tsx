"use client";

import { useEffect, useState } from "react";
import type { TickEvent, Meta } from "@/lib/types";
import { fmtInt, fmtPnl, fmtSignedPct, uptime } from "@/lib/format";
import styles from "./StatsRow.module.css";

const DASH = "-";

export default function StatsRow({
  latest,
  avgLatencyMs,
  meta,
}: {
  latest: TickEvent | null;
  avgLatencyMs: number;
  meta: Meta | null;
}) {
  const startedAt = meta?.startedAt ?? null;
  // Ticks once a second; starts on the client so SSR and hydration agree.
  const [up, setUp] = useState<string | null>(null);

  useEffect(() => {
    if (startedAt == null) {
      setUp(null);
      return;
    }
    const tick = () => setUp(uptime(startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const decision = latest?.decision ?? null;
  const last = decision && !decision.late ? `${decision.latencyMs} ms` : `${DASH} ms`;
  const avg = Number.isFinite(avgLatencyMs) && avgLatencyMs > 0 ? `${Math.round(avgLatencyMs)}ms` : DASH;
  const totals = latest?.totals ?? null;
  const position = latest?.position ?? null;
  const stance =
    !position || position.side === "flat"
      ? "flat"
      : `${position.side} ${fmtInt(position.size)}`;

  return (
    <div className={styles.stats}>
      <span>last {last}</span>
      <span>avg {avg}</span>
      <span className={styles.nowrap}>{totals ? fmtInt(totals.decisions) : DASH} decisions</span>
      <span className={styles.nowrap}>{totals ? fmtInt(totals.fills) : DASH} fills</span>
      <span className={styles.spacer} />
      <span className={styles.nowrap}>pos {stance}</span>
      <span
        className={styles.nowrap}
        style={{ color: (totals?.pnlUsd ?? 0) >= 0 ? "var(--pnl-pos)" : "var(--pnl-neg)" }}
      >
        {totals ? `${fmtPnl(totals.pnlUsd)} (${fmtSignedPct(totals.pnlPct)})` : DASH}
      </span>
      <span className={styles.nowrap}>uptime {up ?? "00:00:00"}</span>
    </div>
  );
}
