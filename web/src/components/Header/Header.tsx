"use client";

import type { TickEvent, ConnectionState, Meta } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import styles from "./Header.module.css";

export interface HeaderProps {
  meta: Meta | null;
  latest: TickEvent | null;
  connection: ConnectionState;
}

/** Only shown when we are NOT live. Live is the silent, default state. */
const OFFLINE_LABEL: Partial<Record<ConnectionState, string>> = {
  connecting: "connecting",
  reconnecting: "reconnecting",
};

export default function Header({ meta, latest, connection }: HeaderProps) {
  const model = meta?.model ?? null;
  const standIn = meta?.standIn ?? true;
  const offline = OFFLINE_LABEL[connection] ?? null;
  const product = meta?.product ?? "SandBase Jev Trader";

  return (
    <div className={styles.header}>
      <span className={styles.brand}>&#8214; {product}</span>

      <span className={styles.tick}>tick {latest ? fmtInt(latest.tick) : "-"}</span>

      <span className={styles.spacer} />

      {offline ? <span className={styles.offline}>{offline}</span> : null}

      <span
        className={styles.sim}
        title={`fictional listing, ${meta?.tickMs ?? 300} ms per tick, seed ${meta?.seed ?? "-"}`}
      >
        {meta ? (
          <>
            <span>sim {meta.tickMs} ms</span>
            <span>seed {meta.seed}</span>
          </>
        ) : (
          "sim"
        )}
      </span>

      <span
        className={styles.badge}
        style={{
          background: standIn ? "var(--badge-standin-bg)" : "var(--badge-model-bg)",
          color: standIn ? "var(--badge-standin-fg)" : "var(--badge-model-fg)",
        }}
        title={standIn ? "no real model is connected: decisions come from a local heuristic" : "decisions come from a hosted model"}
      >
        {standIn ? "stand-in model" : model}
      </span>
    </div>
  );
}
