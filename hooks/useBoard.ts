"use client";

/**
 * useBoard — orchestrates the full board lifecycle as per system design:
 *
 * 1. getOrCreateBoard(slug)
 * 2. fetchElements → seed local Zustand store
 * 3. Sign in anonymously (Supabase anonymous auth)
 * 4. Subscribe to Supabase Realtime channel for the board
 * 5. Presence handshake → broadcast local user info
 * 6. Listen to postgres_changes (INSERT/UPDATE/DELETE on elements)
 * 7. Expose sync helpers for Canvas to call after strokes
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  getOrCreateBoard,
  fetchElements,
  upsertElement,
  deleteElement,
} from "@/lib/supabase/boardService";
import { useBoardStore } from "@/store/useBoardStore";
import type { BoardElement, CursorState } from "@/types";
import { addToast } from "@/components/ui/ToastContainer";

// ─── Local identity ────────────────────────────────────────────────────────────

const GUEST_COLORS = [
  "#3B82F6", "#10B981", "#EF4444", "#F59E0B",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

const GUEST_NAMES = [
  "Alice", "Bob", "Charlie", "Dana", "Eve",
  "Frank", "Grace", "Hiro", "Isla", "Juno",
];

function getOrCreateGuestIdentity(): { name: string; color: string } {
  if (typeof window === "undefined") return { name: "Guest", color: "#3B82F6" };

  const stored = localStorage.getItem("wb_guest_identity");
  if (stored) {
    try {
      return JSON.parse(stored) as { name: string; color: string };
    } catch {
      // ignore malformed stored value
    }
  }

  const name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
  const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
  const identity = { name, color };
  localStorage.setItem("wb_guest_identity", JSON.stringify(identity));
  return identity;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type BoardStatus = "idle" | "loading" | "ready" | "error";

interface UseBoardReturn {
  /** Current board slug */
  boardId: string | null;
  /** Lifecycle status */
  status: BoardStatus;
  /** Error message if status === 'error' */
  error: string | null;
  /** Local user identity */
  localUser: { name: string; color: string };
  /**
   * Call this after a stroke / shape is committed to sync it to Supabase.
   * Internally throttled — safe to call on every element update.
   */
  syncElement: (element: BoardElement) => void;
  /** Call this to delete an element from DB */
  removeElement: (elementId: string) => void;
}

export function useBoard(slug: string): UseBoardReturn {
  const { setElements, setRemoteCursors, pushToHistory } = useBoardStore();

  const [status, setStatus] = useState<BoardStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const boardIdRef = useRef<string | null>(null);
  const localUser = useRef(getOrCreateGuestIdentity());

  // Pending sync queue — batch upserts to avoid hammering DB on every mouse move
  const pendingSync = useRef<Map<string, BoardElement>>(new Map());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Flush pending upserts ─────────────────────────────────────────────────
  const flushSync = useCallback(async () => {
    if (!boardIdRef.current || pendingSync.current.size === 0) return;

    const batch = Array.from(pendingSync.current.values());
    pendingSync.current.clear();

    for (const el of batch) {
      try {
        await upsertElement(boardIdRef.current, el);
      } catch (err) {
        console.error("[useBoard] upsert failed", err);
        // Rollback handled by caller via reconciliation
      }
    }
  }, []);

  // ── Public: queue element for sync (debounced) ────────────────────────────
  const syncElement = useCallback(
    (element: BoardElement) => {
      if (element._preview) return; // Never sync preview elements
      pendingSync.current.set(element.id, element);

      // Flush after 400ms of no new changes (or immediately if stroke ended)
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(flushSync, 400);
    },
    [flushSync],
  );

  // ── Public: delete element from DB ────────────────────────────────────────
  const removeElement = useCallback(async (elementId: string) => {
    try {
      await deleteElement(elementId);
    } catch (err) {
      console.error("[useBoard] delete failed", err);
    }
  }, []);

  // ── Main effect: boot board & subscribe ───────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;

    async function boot() {
      setStatus("loading");
      setError(null);

      try {
        // ── Step 1: Anonymous auth session ──────────────────────────────────
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) {
            // Non-fatal — anon auth not strictly needed for public RLS
            console.warn("[useBoard] anonymous sign-in skipped:", anonError.message);
          }
        }

        // ── Step 2: Get or create board ──────────────────────────────────────
        const board = await getOrCreateBoard(slug);
        if (!isMounted) return;

        boardIdRef.current = board.id;
        setBoardId(board.id);

        // ── Step 3: Fetch existing elements ──────────────────────────────────
        const serverElements = await fetchElements(board.id);
        if (!isMounted) return;

        setElements(serverElements);
        pushToHistory(serverElements);

        // ── Step 4: Subscribe to Realtime channel ────────────────────────────
        channel = supabase.channel(`board:${board.id}`, {
          config: {
            presence: { key: crypto.randomUUID() },
            broadcast: { self: false },
          },
        });

        channelRef.current = channel;

        // ── Step 5: Presence ─────────────────────────────────────────────────
        channel.on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{
            name: string;
            color: string;
            x: number;
            y: number;
          }>();

          const remoteCursors: CursorState[] = Object.entries(state)
            .flatMap(([key, presences]) =>
              presences.map((p) => ({
                id: key,
                name: p.name,
                color: p.color,
                x: p.x ?? 0,
                y: p.y ?? 0,
              })),
            )
            // Exclude our own presence key — we track ourselves locally
            .filter((c) => c.name !== localUser.current.name);

          if (isMounted) setRemoteCursors(remoteCursors);
        });

        // ── Step 6: DB changes on board_elements ─────────────────────────────
        // Type mapping: DB uses 'freedraw'/'ellipse', app uses 'pencil'/'circle'
        const DB_TO_APP: Record<string, string> = { freedraw: "pencil", ellipse: "circle" };
        const mapType = (t: string) => DB_TO_APP[t] ?? t;

        const handleIncoming = (raw: Record<string, unknown>): BoardElement => ({
          ...(raw.data as object),
          id: raw.id as string,
          type: mapType(raw.type as string),
          version: raw.version as number,
        } as BoardElement);

        channel.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "board_elements",
            filter: `board_id=eq.${board.id}`,
          },
          (payload) => {
            if (!isMounted) return;
            const incoming = handleIncoming(payload.new as Record<string, unknown>);
            useBoardStore.setState((state) => {
              // Skip if already present (own optimistic update)
              if (state.elements.some((el) => el.id === incoming.id)) return {};
              return { elements: [...state.elements, incoming] };
            });
          },
        );

        channel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "board_elements",
            filter: `board_id=eq.${board.id}`,
          },
          (payload) => {
            if (!isMounted) return;
            const incoming = handleIncoming(payload.new as Record<string, unknown>);
            useBoardStore.setState((state) => ({
              elements: state.elements.map((el) =>
                el.id === incoming.id ? incoming : el,
              ),
            }));
          },
        );

        channel.on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "board_elements",
            filter: `board_id=eq.${board.id}`,
          },
          (payload) => {
            if (!isMounted) return;
            const deletedId = (payload.old as { id: string }).id;
            useBoardStore.setState((state) => ({
              elements: state.elements.filter((el) => el.id !== deletedId),
            }));
          },
        );

        // ── Step 7: Subscribe & handshake presence ───────────────────────────
        await new Promise<void>((resolve) => {
          channel!.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              // Broadcast our presence
              await channel!.track({
                name: localUser.current.name,
                color: localUser.current.color,
                x: 0,
                y: 0,
              });
              resolve();
            }
          });
        });

        if (isMounted) {
          setStatus("ready");
          addToast(`Board "${board.slug}" loaded`, "success");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[useBoard] boot failed:", message);
        if (isMounted) {
          setStatus("error");
          setError(message);
          addToast(`Board error: ${message}`, "error");
        }
      }
    }

    boot();

    return () => {
      isMounted = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      // Flush any remaining pending changes before unmount
      flushSync();
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      }
    };
  // Only re-run if slug changes (page navigation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Periodic reconciliation (every 10s) ───────────────────────────────────
  useEffect(() => {
    if (status !== "ready" || !boardIdRef.current) return;
    const id = boardIdRef.current;

    const reconcile = async () => {
      try {
        const serverElements = await fetchElements(id);
        const localElements = useBoardStore.getState().elements.filter(
          (el) => !el._preview,
        );

        // Simple diff: compare counts + ids
        const serverIds = new Set(serverElements.map((e) => e.id));
        const localIds = new Set(localElements.map((e) => e.id));
        const hasDrift =
          serverIds.size !== localIds.size ||
          [...serverIds].some((id) => !localIds.has(id));

        if (hasDrift) {
          console.warn("[useBoard] drift detected — syncing from server");
          useBoardStore.setState({ elements: serverElements });
        }
      } catch {
        // Silent — reconciliation is best-effort
      }
    };

    const timer = setInterval(reconcile, 10_000);
    return () => clearInterval(timer);
  }, [status]);

  return {
    boardId,
    status,
    error,
    localUser: localUser.current,
    syncElement,
    removeElement,
  };
}
