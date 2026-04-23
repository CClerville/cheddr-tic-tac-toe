import { useEffect, useRef, useState } from "react";

const DEFAULT_BASE_CPS = 80;
const STREAM_END_SNAP_MS = 150;

export interface UseTypewriterOptions {
  isStreaming?: boolean;
  baseCps?: number;
  reduceMotion?: boolean;
}

/**
 * Reveals `target` with a frame-paced typewriter effect. Decouples network
 * chunking from UX: large SSE bursts still animate out smoothly, and the
 * reveal speeds up when far behind so total time stays bounded.
 */
export function useTypewriter(
  target: string,
  opts: UseTypewriterOptions = {},
): string {
  const {
    isStreaming = false,
    baseCps = DEFAULT_BASE_CPS,
    reduceMotion = false,
  } = opts;

  const [displayed, setDisplayed] = useState("");
  const displayedRef = useRef("");
  const targetRef = useRef(target);
  const baseCpsRef = useRef(baseCps);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  targetRef.current = target;
  baseCpsRef.current = baseCps;

  const cancelRaf = () => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTsRef.current = null;
  };

  useEffect(() => {
    if (!reduceMotion) return;
    displayedRef.current = target;
    setDisplayed(target);
  }, [reduceMotion, target]);

  useEffect(() => {
    if (reduceMotion) {
      cancelRaf();
      return;
    }

    const tick = (ts: number) => {
      const targetStr = targetRef.current;
      let d = displayedRef.current;

      if (targetStr.length < d.length || !targetStr.startsWith(d)) {
        d = "";
        displayedRef.current = "";
        setDisplayed("");
      }

      const behind = targetStr.length - d.length;
      if (behind <= 0) {
        rafIdRef.current = null;
        lastTsRef.current = null;
        return;
      }

      const last = lastTsRef.current ?? ts;
      const dt = Math.min(Math.max(ts - last, 0), 100);
      lastTsRef.current = ts;

      const catchUp = Math.min(4, Math.max(1, 1 + behind / 60));
      const n = Math.max(
        1,
        Math.round((baseCpsRef.current * catchUp * dt) / 1000),
      );
      const next = targetStr.slice(0, d.length + Math.min(n, behind));
      displayedRef.current = next;
      setDisplayed(next);

      if (next.length < targetStr.length) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
        lastTsRef.current = null;
      }
    };

    const t = target;
    const d = displayedRef.current;
    if (t.length < d.length || !t.startsWith(d)) {
      displayedRef.current = "";
      setDisplayed("");
      cancelRaf();
    }

    const d2 = displayedRef.current;
    if (t.length > d2.length && rafIdRef.current == null) {
      lastTsRef.current = null;
      rafIdRef.current = requestAnimationFrame(tick);
    }
    // Intentionally no cleanup: tick reads targetRef so frequent stream
    // chunks must not cancel/restart RAF (would stutter).
  }, [target, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    if (isStreaming) {
      if (snapTimeoutRef.current != null) {
        clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
      return;
    }

    snapTimeoutRef.current = setTimeout(() => {
      snapTimeoutRef.current = null;
      const t = targetRef.current;
      if (displayedRef.current.length < t.length) {
        displayedRef.current = t;
        setDisplayed(t);
      }
    }, STREAM_END_SNAP_MS);

    return () => {
      if (snapTimeoutRef.current != null) {
        clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, [isStreaming, reduceMotion]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastTsRef.current = null;
      if (snapTimeoutRef.current != null) {
        clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = null;
      }
    };
  }, []);

  if (reduceMotion) return target;
  return displayed;
}
