"use client";

/**
 * useBoard — orchestrates the full board lifecycle as per system design:
 *
 * 1. getOrCreateBoard(slug)
 * 2. fetchElements → seed local Zustand store
 * 3. Try anonymous auth (non-fatal if disabled in Supabase project)
 * 4. Subscribe to Supabase Realtime channel for the board
 * 5. Presence handshake → broadcast local user info
 * 6. Listen to postgres_changes (INSERT/UPDATE/DELETE on board_elements)
 * 7. Expose sync helpers for page-level code
 * 8. Periodic reconciliation every 10s
 * 9. Tab visibility handling — pause sync when hidden, reconcile on return
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

// ─── Guest identity ────────────────────────────────────────────────────────────

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
      /* ignore malformed */
    }
  }

  const name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
  const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
  const identity = { name, color };
  localStorage.setItem("wb_guest_identity", JSON.stringify(identity));
  return identity;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BoardStatus = "idle" | "loading" | "ready" | "error";

interface UseBoardReturn {
  boardId: string | null;
  status: BoardStatus;
  error: string | null;
  localUser: { name: string; color: string };
  /** DB-persistent sync (debounced 400ms). Use for final commit. */
  syncElement: (element: BoardElement) => void;
  /** DB delete. */
  removeElement: (elementId: string) => void;
  /** Seed initial server elements as "already synced". */
  seedInitialSnapshot: (elements: BoardElement[]) => void;
  /** Instant broadcast to all peers via channel (~50ms). No DB write. */
  broadcastElement: (element: BoardElement) => void;
  /** Instant broadcast-delete to all peers. No DB write. */
  broadcastElementDelete: (elementId: string) => void;
  /** Broadcast cursor world-position via Presence (throttled 20fps). */
  broadcastCursorPos: (worldX: number, worldY: number) => void;
  /** Update local display name/color and immediately re-broadcast presence. */
  updateIdentity: (name: string, color: string) => void;
}

// ─── DB type mapping (same as boardService, duplicated for speed) ─────────────

const DB_TO_APP: Record<string, string> = { freedraw: "pencil", ellipse: "circle" };
const mapDbType = (t: string) => DB_TO_APP[t] ?? t;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBoard(slug: string): UseBoardReturn {
  const { setElements, setRemoteCursors, pushToHistory } = useBoardStore();

  const [status, setStatus] = useState<BoardStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const boardIdRef = useRef<string | null>(null);

  // ── Per-tab session key ───────────────────────────────────────────────────
  // Unique UUID per browser tab — persisted in sessionStorage so it survives
  // hot-reloads but is DIFFERENT in each tab (unlike localStorage).
  // This is what we use to filter self out of presence, NOT the display name.
  // Note: useRef does NOT support lazy init — use an IIFE to compute inline.
  const sessionKeyRef = useRef<string>((() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const stored = sessionStorage.getItem("wb_session_key");
    if (stored) return stored;
    const newKey = crypto.randomUUID();
    sessionStorage.setItem("wb_session_key", newKey);
    return newKey;
  })());

  // ── Local identity (name + color) ────────────────────────────────────────
  const [localUser, setLocalUser] = useState(() => getOrCreateGuestIdentity());
  const localUserRef = useRef(localUser); // ref for use inside callbacks
  useEffect(() => { localUserRef.current = localUser; }, [localUser]);

  // Cursor broadcast throttle
  const lastCursorBroadcast = useRef(0);
  const CURSOR_THROTTLE_MS = 50; // ~20fps

  // Pending upsert queue — batched by element id, flushed after 400ms idle
  const pendingSync = useRef<Map<string, BoardElement>>(new Map());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks whether the page is currently visible (used to pause/resume sync)
  const isVisibleRef = useRef(true);

  // ── Flush pending upserts ─────────────────────────────────────────────────
  const flushSync = useCallback(async () => {
    if (!boardIdRef.current || pendingSync.current.size === 0) return;

    const batch = Array.from(pendingSync.current.values());
    pendingSync.current.clear();

    for (const el of batch) {
      try {
        await upsertElement(boardIdRef.current, el);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useBoard] upsert failed", msg);

        // Surface RLS errors as a toast (likely SQL patch not applied)
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("rls")) {
          addToast(
            "Sync failed: check Supabase RLS policy on board_elements",
            "error",
          );
        }
        // Other elements in batch still attempt — don't abort the whole batch
      }
    }
  }, []);

  // ── Public: queue element for sync ───────────────────────────────────────
  const syncElement = useCallback(
    (element: BoardElement) => {
      if (element._preview) return;
      pendingSync.current.set(element.id, element);

      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(flushSync, 400);
    },
    [flushSync],
  );

  // ── Public: delete from DB ────────────────────────────────────────────────
  const removeElement = useCallback(async (elementId: string) => {
    if (!elementId) return;
    try {
      await deleteElement(elementId);
    } catch (err) {
      console.error("[useBoard] delete failed", err);
    }
  }, []);

  // ── Public: seed initial snapshot (prevents re-upsert on first load) ─────
  const seedInitialSnapshot = useCallback(
    (elements: BoardElement[]) => {
      // Mark these elements as "already in DB" — syncElement won't touch them
      // unless they actually change afterward
      elements.forEach((el) => {
        if (!pendingSync.current.has(el.id)) {
          // Just ensure they're NOT queued
          pendingSync.current.delete(el.id);
        }
      });
    },
    [],
  );

  // ── Main boot effect ───────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;

    async function boot() {
      setStatus("loading");
      setError(null);

      try {
        // ── Step 1: Try anonymous auth (non-fatal) ───────────────────────────
        // If Supabase project has Anonymous sign-ins disabled, we skip silently.
        // Public RLS (USING true) doesn't require auth.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error: anonError } = await supabase.auth.signInAnonymously();
          if (anonError) {
            console.info(
              "[useBoard] anonymous sign-in not available (non-fatal):",
              anonError.message,
            );
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

        // ── Step 4: Realtime channel ─────────────────────────────────────────
        // Each tab uses its unique sessionKeyRef as the presence key.
        // This guarantees self-filtering works even when multiple tabs
        // share the same localStorage identity (same name/color).
        channel = supabase.channel(`board:${board.id}`, {
          config: {
            presence: { key: sessionKeyRef.current },
            broadcast: { self: false },
          },
        });

        channelRef.current = channel;

        // ── Step 5: Presence ─────────────────────────────────────────────────
        // Stale threshold: entries not updated in 90s are considered disconnected.
        const STALE_MS = 90_000;

        channel.on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{
            name: string;
            color: string;
            x: number;
            y: number;
            lastActive: number;
          }>();

          const now = Date.now();
          const remoteCursors: CursorState[] = Object.entries(state)
            .filter(([key]) => key !== sessionKeyRef.current) // filter self by UUID
            .flatMap(([key, presences]) =>
              presences.map((p) => ({
                id: key,
                name: p.name ?? "Anonymous",
                color: p.color ?? "#6366f1",
                x: p.x ?? 0,
                y: p.y ?? 0,
                lastActive: p.lastActive ?? 0,
              })),
            )
            .filter((c) => now - c.lastActive < STALE_MS); // remove stale ghosts

          if (isMounted) setRemoteCursors(remoteCursors);
        });

        // ── Step 6: Broadcast listeners (FAST PATH ~50ms) ────────────────────
        // Receives element_update / element_delete events sent by other clients
        // via channel.send(). This bypasses the DB → WAL → Realtime lag.

        // Helper: reconstruct a BoardElement from a DB row (used by postgres_changes)
        const buildElement = (raw: Record<string, unknown>): BoardElement => ({
          ...(raw.data as object),
          id: raw.id as string,
          type: mapDbType(raw.type as string),
          version: raw.version as number,
        } as BoardElement);

        channel.on(
          "broadcast",
          { event: "element_update" },
          ({ payload }) => {
            if (!isMounted) return;
            const el = payload as BoardElement;
            if (!el?.id) return;

            useBoardStore.setState((state) => {
              const existing = state.elements.find((e) => e.id === el.id);
              // Deduplicate: skip if our local version is newer
              if (existing && (existing.version ?? 0) >= (el.version ?? 0)) return {};
              return {
                elements: existing
                  ? state.elements.map((e) => (e.id === el.id ? el : e))
                  : [...state.elements, el],
              };
            });
          },
        );

        channel.on(
          "broadcast",
          { event: "element_delete" },
          ({ payload }) => {
            if (!isMounted) return;
            const { id } = payload as { id: string };
            if (!id) return;
            useBoardStore.setState((state) => ({
              elements: state.elements.filter((e) => e.id !== id),
            }));
          },
        );

        // ── Step 7: postgres_changes (SLOW PATH, fallback) ───────────────────
        // Handles reconnection scenarios and clients that missed broadcasts.
        // Uses version to skip elements already applied via broadcast.
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
            const incoming = buildElement(payload.new as Record<string, unknown>);
            useBoardStore.setState((state) => {
              const existing = state.elements.find((e) => e.id === incoming.id);
              // Already applied via broadcast and local version >= DB version → skip
              if (existing && (existing.version ?? 0) >= (incoming.version ?? 0)) return {};
              return {
                elements: existing
                  ? state.elements.map((e) => (e.id === incoming.id ? incoming : e))
                  : [...state.elements, incoming],
              };
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
            const incoming = buildElement(payload.new as Record<string, unknown>);
            useBoardStore.setState((state) => {
              const existing = state.elements.find((e) => e.id === incoming.id);
              if (existing && (existing.version ?? 0) >= (incoming.version ?? 0)) return {};
              return {
                elements: state.elements.map((e) =>
                  e.id === incoming.id ? incoming : e,
                ),
              };
            });
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

        // ── Step 7: Subscribe + presence handshake ───────────────────────────
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Realtime subscription timed out")),
            15_000,
          );

          channel!.subscribe(async (subStatus) => {
            if (subStatus === "SUBSCRIBED") {
              clearTimeout(timeout);
              await channel!.track({
                name: localUserRef.current.name,
                color: localUserRef.current.color,
                x: 0,
                y: 0,
                lastActive: Date.now(),
              });
              resolve();
            } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
              clearTimeout(timeout);
              reject(new Error(`Realtime channel error: ${subStatus}`));
            }
          });
        });

        if (isMounted) {
          setStatus("ready");
          addToast(`Connected to board "${board.slug}"`, "success");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[useBoard] boot failed:", message);
        if (isMounted) {
          setStatus("error");
          setError(message);
          addToast(`Connection error: ${message}`, "error");
        }
      }
    }

    boot();

    return () => {
      isMounted = false;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      flushSync(); // Flush remaining on unmount
      if (channel) {
        // Explicitly untrack self from Presence so other clients see us
        // leave immediately instead of waiting for Supabase's TTL (30-60s).
        channel.untrack()
          .catch(() => { /* best-effort */ })
          .finally(() => {
            channel!.unsubscribe();
            supabase.removeChannel(channel!);
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── Tab visibility handling ────────────────────────────────────────────────
  // When tab becomes hidden: pause queued syncs.
  // When tab returns to visible: trigger reconciliation immediately.
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";

      if (isVisibleRef.current && boardIdRef.current && status === "ready") {
        // Flush any queued changes immediately
        flushSync();

        // Reconcile from server after returning to tab
        fetchElements(boardIdRef.current)
          .then((serverElements) => {
            const localEls = useBoardStore
              .getState()
              .elements.filter((el) => !el._preview);
            const serverIds = new Set(serverElements.map((e) => e.id));
            const localIds = new Set(localEls.map((e) => e.id));
            const hasDrift =
              serverIds.size !== localIds.size ||
              [...serverIds].some((id) => !localIds.has(id));

            if (hasDrift) {
              console.info("[useBoard] tab returned — drift detected, syncing");
              useBoardStore.setState({ elements: serverElements });
            }
          })
          .catch(() => {
            /* silent — best effort */
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [status, flushSync]);

  // ── Periodic reconciliation (every 10s) ────────────────────────────────────
  useEffect(() => {
    if (status !== "ready" || !boardIdRef.current) return;
    const id = boardIdRef.current;

    const reconcile = async () => {
      // Skip reconciliation when tab is hidden — wasteful network call
      if (!isVisibleRef.current) return;

      try {
        const serverElements = await fetchElements(id);
        const localElements = useBoardStore
          .getState()
          .elements.filter((el) => !el._preview);

        const serverIds = new Set(serverElements.map((e) => e.id));
        const localIds = new Set(localElements.map((e) => e.id));
        const hasDrift =
          serverIds.size !== localIds.size ||
          [...serverIds].some((sid) => !localIds.has(sid));

        if (hasDrift) {
          console.warn("[useBoard] periodic reconciliation — drift detected");
          useBoardStore.setState({ elements: serverElements });
        }
      } catch {
        /* silent — reconciliation is best-effort */
      }
    };

    const timer = setInterval(reconcile, 10_000);
    return () => clearInterval(timer);
  }, [status]);

  // ── Cursor broadcast (throttled ~20fps via Presence) ──────────────────────
  const broadcastCursorPos = useCallback(
    (worldX: number, worldY: number) => {
      const channel = channelRef.current;
      if (!channel) return;

      const now = Date.now();
      if (now - lastCursorBroadcast.current < CURSOR_THROTTLE_MS) return;
      lastCursorBroadcast.current = now;

      // Fire-and-forget — non-blocking
      channel.track({
        name: localUserRef.current.name,
        color: localUserRef.current.color,
        x: worldX,
        y: worldY,
        lastActive: Date.now(), // updated each cursor move — used for stale detection
      }).catch(() => { /* silent — cursor broadcast is best-effort */ });
    },
    [],
  );

  // ── Update identity + re-broadcast presence ──────────────────────────────
  const updateIdentity = useCallback((name: string, color: string) => {
    if (!name.trim()) return;
    const identity = { name: name.trim(), color };
    // Persist to localStorage so it's remembered next visit
    try {
      localStorage.setItem("wb_guest_identity", JSON.stringify(identity));
    } catch { /* storage unavailable */ }
    setLocalUser(identity);
    // Immediately re-broadcast so other clients see the new name/color
    channelRef.current?.track({
      name: identity.name,
      color: identity.color,
      x: 0,
      y: 0,
      lastActive: Date.now(),
    }).catch(() => { /* silent */ });
  }, []);

  // ── Instant element broadcast (FAST PATH) ────────────────────────────────
  const broadcastElement = useCallback((element: BoardElement) => {
    const channel = channelRef.current;
    if (!channel || element._preview) return;
    // Fire-and-forget — does NOT write to DB
    channel.send({
      type: "broadcast",
      event: "element_update",
      payload: element,
    }).catch(() => { /* silent */ });
  }, []);

  const broadcastElementDelete = useCallback((elementId: string) => {
    const channel = channelRef.current;
    if (!channel || !elementId) return;
    channel.send({
      type: "broadcast",
      event: "element_delete",
      payload: { id: elementId },
    }).catch(() => { /* silent */ });
  }, []);

  return {
    boardId,
    status,
    error,
    localUser,
    syncElement,
    removeElement,
    seedInitialSnapshot,
    broadcastElement,
    broadcastElementDelete,
    broadcastCursorPos,
    updateIdentity,
  };
}
