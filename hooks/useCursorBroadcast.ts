"use client";

/**
 * useCursorBroadcast — broadcasts local cursor position via Supabase Presence.
 * Throttled to ~20fps to stay within Realtime limits.
 */

import { useCallback, useRef, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useBoardStore } from "@/store/useBoardStore";

const THROTTLE_MS = 50; // ~20fps

export function useCursorBroadcast(
  channel: RealtimeChannel | null,
  localUser: { name: string; color: string },
) {
  const { viewport } = useBoardStore();
  const lastBroadcast = useRef<number>(0);
  const viewportRef = useRef(viewport);

  // Keep viewport ref up to date without re-creating the broadcast fn
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const broadcastCursor = useCallback(
    (clientX: number, clientY: number, canvasRect: DOMRect) => {
      if (!channel) return;
      const now = Date.now();
      if (now - lastBroadcast.current < THROTTLE_MS) return;
      lastBroadcast.current = now;

      const { pan, zoom } = viewportRef.current;
      const worldX = (clientX - canvasRect.left - pan.x) / zoom;
      const worldY = (clientY - canvasRect.top - pan.y) / zoom;

      channel.track({
        name: localUser.name,
        color: localUser.color,
        x: worldX,
        y: worldY,
      });
    },
    [channel, localUser],
  );

  return { broadcastCursor };
}
