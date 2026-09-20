"use client";

import { useEffect, useReducer } from "react";
import type { ConnectionState, FeedState, Meta, TickEvent } from "./types";

export { useUptime } from "./useUptime";

/** Max tick events kept in memory (oldest -> newest). */
const CAP = 1000;
/** Reconnect backoff, doubling from 1s up to 10s. */
const BACKOFF_MIN = 1000;
const BACKOFF_MAX = 10_000;
/** If nothing arrives for this long (server pings every few seconds), force a reconnect. */
const STALE_MS = 45_000;

interface State extends FeedState {
  /** running accumulators so avgLatencyMs stays O(1) per event */
  latSum: number;
  latCount: number;
}

type Action =
  | { type: "snapshot"; meta: Meta | null; history: TickEvent[] }
  | { type: "tick"; event: TickEvent }
  | { type: "connection"; connection: ConnectionState };

const initialState: State = {
  meta: null,
  events: [],
  latest: null,
  connection: "connecting",
  avgLatencyMs: 0,
  latSum: 0,
  latCount: 0,
};

/** latencyMs of a decided (non-late) tick, or null if it should not count. */
function latencyOf(e: TickEvent): number | null {
  const d = e?.decision;
  if (!d || d.late || typeof d.latencyMs !== "number" || !Number.isFinite(d.latencyMs)) return null;
  return d.latencyMs;
}

function indexOfTick(events: TickEvent[], tick: number): number {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].tick === tick) return i;
  return -1;
}

function avg(latSum: number, latCount: number): number {
  return latCount > 0 ? Math.round(latSum / latCount) : 0;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "connection":
      return state.connection === action.connection ? state : { ...state, connection: action.connection };

    case "snapshot": {
      const history = Array.isArray(action.history) ? action.history : [];
      const events = history.length > CAP ? history.slice(history.length - CAP) : history;
      let latSum = 0;
      let latCount = 0;
      for (const e of events) {
        const l = latencyOf(e);
        if (l !== null) {
          latSum += l;
          latCount++;
        }
      }
      return {
        meta: action.meta ?? state.meta,
        events,
        latest: events.length ? events[events.length - 1] : null,
        connection: "live",
        avgLatencyMs: avg(latSum, latCount),
        latSum,
        latCount,
      };
    }

    case "tick": {
      const ev = action.event;
      if (!ev || typeof ev.tick !== "number") return state;
      const prev = state.events;
      const last = prev.length ? prev[prev.length - 1] : null;

      // Dedupe: a re-sent tick replaces the one we already have; a stale older tick is dropped.
      if (last && ev.tick <= last.tick) {
        const idx = indexOfTick(prev, ev.tick);
        if (idx < 0) return state;
        const events = prev.slice();
        const old = events[idx];
        events[idx] = ev;
        let latSum = state.latSum;
        let latCount = state.latCount;
        const o = latencyOf(old);
        if (o !== null) {
          latSum -= o;
          latCount--;
        }
        const n = latencyOf(ev);
        if (n !== null) {
          latSum += n;
          latCount++;
        }
        return {
          ...state,
          events,
          latest: events[events.length - 1],
          avgLatencyMs: avg(latSum, latCount),
          latSum,
          latCount,
        };
      }

      let latSum = state.latSum;
      let latCount = state.latCount;
      const n = latencyOf(ev);
      if (n !== null) {
        latSum += n;
        latCount++;
      }
      let events = prev.concat(ev);
      if (events.length > CAP) {
        const drop = events.length - CAP;
        for (let i = 0; i < drop; i++) {
          const l = latencyOf(events[i]);
          if (l !== null) {
            latSum -= l;
            latCount--;
          }
        }
        events = events.slice(drop); // only ever slices once we are over the cap
      }
      return {
        ...state,
        events,
        latest: ev,
        avgLatencyMs: avg(latSum, latCount),
        latSum,
        latCount,
      };
    }

    default:
      return state;
  }
}

function parseMeta(raw: Record<string, unknown> | null): Meta | null {
  if (!raw) return null;
  const str = (k: string, fallback: string) => (typeof raw[k] === "string" ? (raw[k] as string) : fallback);
  const num = (k: string, fallback: number) => (typeof raw[k] === "number" ? (raw[k] as number) : fallback);
  return {
    product: str("product", "SandBase Jev Trader"),
    model: str("model", ""),
    standIn: Boolean(raw.standIn),
    symbol: str("symbol", "ANTH"),
    company: str("company", "Anthropic"),
    seed: num("seed", 0),
    tickMs: num("tickMs", 300),
    tradeSize: num("tradeSize", 200),
    maxPosition: num("maxPosition", 1000),
    bankrollUsd: num("bankrollUsd", 100_000),
    startedAt: num("startedAt", Date.now()),
  };
}

/**
 * Live tick feed over SSE.
 *
 * Connects to `${apiUrl}/events` and handles: `snapshot` (meta + history),
 * `tick` (append, deduped by tick number, capped at 1000) and `ping` (liveness).
 * Reconnects with 1s -> 10s backoff, surfacing `connection`.
 */
export function useFeed(apiUrl: string): FeedState {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    const base = (apiUrl || "").replace(/\/+$/, "");

    let closed = false;
    let attempt = 0;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let staleTimer: ReturnType<typeof setTimeout> | undefined;

    const armStaleTimer = () => {
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (!closed) scheduleReconnect();
      }, STALE_MS);
    };

    const teardown = () => {
      if (es) {
        es.onopen = null;
        es.onerror = null;
        es.close();
        es = null;
      }
      if (staleTimer) clearTimeout(staleTimer);
    };

    const scheduleReconnect = () => {
      if (closed) return;
      teardown();
      dispatch({ type: "connection", connection: "reconnecting" });
      const delay = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** attempt);
      attempt++;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, delay);
    };

    const handle = (type: string, fn: (data: unknown) => void) => {
      es?.addEventListener(type, (raw: Event) => {
        armStaleTimer();
        const payload = (raw as MessageEvent).data;
        if (typeof payload !== "string" || !payload) return;
        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          return;
        }
        fn(data);
      });
    };

    function connect() {
      if (closed) return;
      dispatch({ type: "connection", connection: attempt === 0 ? "connecting" : "reconnecting" });
      es = new EventSource(`${base}/events`);

      es.onopen = () => {
        attempt = 0;
        dispatch({ type: "connection", connection: "live" });
        armStaleTimer();
      };
      es.onerror = () => {
        if (!closed) scheduleReconnect();
      };

      handle("snapshot", (data) => {
        const d = (data ?? {}) as Record<string, unknown>;
        const history = Array.isArray(d.history) ? (d.history as TickEvent[]) : [];
        dispatch({ type: "snapshot", meta: parseMeta(d), history });
      });
      handle("tick", (data) => {
        dispatch({ type: "tick", event: data as TickEvent });
      });
      handle("ping", () => {
        dispatch({ type: "connection", connection: "live" });
      });
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      teardown();
    };
  }, [apiUrl]);

  return state;
}

export default useFeed;
