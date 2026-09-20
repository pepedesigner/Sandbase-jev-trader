/** Formatting helpers. All are pure and SSR safe. */

const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function safe(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** 1048576 -> "1,048,576" */
export function fmtInt(n: number | null | undefined): string {
  return INT.format(Math.round(safe(n)));
}

/** 341.995 -> "342.00" (cent ticks) */
export function fmtPrice(n: number | null | undefined): string {
  return safe(n).toFixed(2);
}

/** 1200 -> "1,200" shares */
export function fmtShares(n: number | null | undefined, d = 0): string {
  return safe(n).toLocaleString("en-US", { maximumFractionDigits: d });
}

/** 12345.6 -> "$12,345.60"; negatives -> "-$12,345.60" */
export function fmtUsd(n: number | null | undefined, d = 2): string {
  const v = safe(n);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/** A dollar amount where the cents matter more than the size: "$3,807.42" */
export function fmtPnl(n: number | null | undefined): string {
  const v = safe(n);
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 0.62 -> "62%" */
export function fmtPct(p: number | null | undefined): string {
  return `${Math.round(safe(p) * 100)}%`;
}

/** 0.62 -> "0.62" (two-decimal confidence) */
export function fmtConf(p: number | null | undefined): string {
  return safe(p).toFixed(2);
}

/** Signed number with a forced sign: (3.807, 2) -> "+3.81" */
export function fmtSigned(n: number | null | undefined, d = 2): string {
  const v = safe(n);
  return `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(d)}`;
}

/** 3.807 -> "+3.81%" (already a percentage, not a ratio) */
export function fmtSignedPct(p: number | null | undefined, d = 2): string {
  return `${fmtSigned(p, d)}%`;
}

/** 0.0012 (a ratio) -> "+0.12%" */
export function fmtSignedRatio(p: number | null | undefined, d = 2): string {
  return `${fmtSigned(safe(p) * 100, d)}%`;
}

/** Accepts ms- or seconds-epoch. Elapsed since `startedAt` as "04:13:42". */
export function uptime(startedAt: number | null | undefined, now: number = Date.now()): string {
  if (!startedAt || !Number.isFinite(startedAt)) return "00:00:00";
  const startMs = startedAt < 1e12 ? startedAt * 1000 : startedAt;
  return hhmmss(Math.max(0, now - startMs));
}

/** Milliseconds -> "hh:mm:ss" (hours are not capped at 24). */
export function hhmmss(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
