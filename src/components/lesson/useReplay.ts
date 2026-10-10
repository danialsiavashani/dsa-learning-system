"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Release the rewind even if animation frames are throttled (hidden tab, webview). */
const FALLBACK_RELEASE_MS = 150;

/**
 * Replay rewinds the stage to the previous state with transitions disabled,
 * lets the browser paint it, then releases back to the current state so the
 * normal identity-preserving transitions run again.
 *
 * `frameKey` identifies what is on stage; navigating away mid-replay changes
 * the key, which ends the rewind immediately.
 */
export function useReplay(frameKey: string) {
  const [rewoundKey, setRewoundKey] = useState<string | null>(null);
  const pending = useRef<{ frames: number[]; timeout?: number }>({ frames: [] });

  const cancel = useCallback(() => {
    pending.current.frames.forEach(cancelAnimationFrame);
    window.clearTimeout(pending.current.timeout);
    pending.current = { frames: [] };
  }, []);

  useEffect(() => cancel, [cancel]);

  const replay = useCallback(() => {
    cancel();
    setRewoundKey(frameKey);

    const release = () => {
      cancel();
      setRewoundKey(null);
    };
    // Two frames: the first lands before the rewound state is painted, the
    // second runs after it has been painted at least once.
    pending.current.frames.push(
      requestAnimationFrame(() => {
        pending.current.frames.push(requestAnimationFrame(release));
      }),
    );
    pending.current.timeout = window.setTimeout(release, FALLBACK_RELEASE_MS);
  }, [cancel, frameKey]);

  return { rewound: rewoundKey === frameKey, replay };
}
