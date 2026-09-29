"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendering every `interval` ms until `until` has passed. Drives all progress UI. */
export function useNow(until: number, interval = 150) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t > until + 300 && timer) clearInterval(timer);
    };
    const first = setTimeout(tick, 0);
    if (until + 300 > Date.now()) timer = setInterval(tick, interval);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until, interval]);
  return now;
}
