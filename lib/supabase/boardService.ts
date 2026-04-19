/**
 * boardService — Supabase DB interactions adapted to the existing schema.
 *
 * Schema facts:
 *  - Table: public.boards           (id, slug, created_at, updated_at) — NO `name` column
 *  - Table: public.board_elements   (id, board_id, type, data, version, created_at, updated_at)
 *  - Type mapping: app `pencil` ↔ DB `freedraw`, app `circle` ↔ DB `ellipse`
 */
import { supabase } from "@/lib/supabase/client";
import type { BoardElement } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoardRecord {
  id: string;
  slug: string;
}

// ─── Type mapping (app ↔ DB) ──────────────────────────────────────────────────

const APP_TO_DB_TYPE: Record<string, string> = {
  pencil: "freedraw",
  circle: "ellipse",
};

const DB_TO_APP_TYPE: Record<string, string> = {
  freedraw: "pencil",
  ellipse: "circle",
};

function toDbType(appType: string): string {
  return APP_TO_DB_TYPE[appType] ?? appType;
}

function toAppType(dbType: string): string {
  return DB_TO_APP_TYPE[dbType] ?? dbType;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Classifies whether an error is a transient network failure worth retrying.
 * Supabase RLS/permission errors (4xx) should NOT be retried.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof TypeError) return true; // NetworkError / fetch failure
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Don't retry permission/RLS errors — they won't resolve on retry
    if (msg.includes("rls") || msg.includes("permission") || msg.includes("policy")) {
      return false;
    }
    return msg.includes("network") || msg.includes("fetch") || msg.includes("timeout");
  }
  return false;
}

/**
 * Wraps an async operation with exponential-backoff retry.
 * Only retries transient errors (network failures), not permission errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  label = "operation",
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxAttempts) {
        throw err;
      }

      const delayMs = 2 ** attempt * 200; // 400ms → 800ms → 1600ms
      console.warn(
        `[boardService] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`,
        err,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw lastError;
}

// ─── Board ────────────────────────────────────────────────────────────────────

/**
 * Fetches an existing board by slug, or creates a new one if it doesn't exist.
 * boards table has NO `name` column — only `id`, `slug`, timestamps.
 */
export async function getOrCreateBoard(slug: string): Promise<BoardRecord> {
  if (!slug || typeof slug !== "string") {
    throw new Error("Invalid board slug provided.");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("boards")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch board: ${fetchError.message}`);
  }

  if (existing) {
    return existing as unknown as BoardRecord;
  }

  // Board doesn't exist → create with just slug (no name column in schema)
  const { data: created, error: createError } = await supabase
    .from("boards")
    .insert([{ slug }])
    .select("id, slug")
    .single();

  if (createError || !created) {
    throw new Error(
      `Failed to create board "${slug}": ${createError?.message ?? "no data returned"}`,
    );
  }

  return created as unknown as BoardRecord;
}

// ─── Elements ─────────────────────────────────────────────────────────────────

type DbElementRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  version: number;
};

/**
 * Fetches all non-preview elements for a board, ordered by creation time.
 * Translates DB type names → app type names.
 */
export async function fetchElements(boardId: string): Promise<BoardElement[]> {
  if (!boardId) throw new Error("boardId is required");

  const { data, error } = await supabase
    .from("board_elements")
    .select("id, type, data, version")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch elements: ${error.message}`);
  }

  return ((data ?? []) as DbElementRow[]).map((row) => ({
    ...row.data,
    id: row.id,
    type: toAppType(row.type),
    version: row.version,
  })) as BoardElement[];
}

/**
 * Upserts a single element to board_elements with retry on transient errors.
 * - Translates app type → DB type.
 * - Increments version for conflict detection.
 * - Retries up to 3× on network failures.
 * - Does NOT retry RLS/permission errors (surfaces them immediately).
 */
export async function upsertElement(
  boardId: string,
  element: BoardElement,
): Promise<void> {
  if (!boardId) throw new Error("boardId is required");
  if (!element?.id) throw new Error("element.id is required");

  // Strip local-only flags before persisting
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _preview, version: _v, ...cleanElement } = element as BoardElement & {
    _preview?: boolean;
  };

  const nextVersion = (element.version ?? 0) + 1;

  const payload = {
    id: cleanElement.id,
    board_id: boardId,
    type: toDbType(cleanElement.type as string),
    data: { ...cleanElement } as unknown as Record<string, unknown>,
    version: nextVersion,
  };

  await withRetry(
    async () => {
      const { error } = await supabase
        .from("board_elements")
        .upsert([payload], { onConflict: "id" });

      if (error) {
        // Surface RLS/permission errors with a clearer message
        if (error.code === "42501" || error.message.toLowerCase().includes("rls")) {
          throw new Error(
            `Permission denied for element ${element.id}. ` +
            `Check Supabase RLS policy on board_elements. Details: ${error.message}`,
          );
        }
        throw new Error(`Failed to upsert element ${element.id}: ${error.message}`);
      }
    },
    3,
    `upsert(${element.id})`,
  );
}

/**
 * Deletes a single element by id from board_elements.
 */
export async function deleteElement(elementId: string): Promise<void> {
  if (!elementId) return; // No-op for empty id

  await withRetry(
    async () => {
      const { error } = await supabase
        .from("board_elements")
        .delete()
        .eq("id", elementId);

      if (error) {
        throw new Error(`Failed to delete element ${elementId}: ${error.message}`);
      }
    },
    3,
    `delete(${elementId})`,
  );
}

/**
 * Full-replace: clears all elements for a board and re-inserts.
 * Used for reconciliation. Use sparingly.
 */
export async function replaceAllElements(
  boardId: string,
  elements: BoardElement[],
): Promise<void> {
  if (!boardId) throw new Error("boardId is required");

  const { error: deleteError } = await supabase
    .from("board_elements")
    .delete()
    .eq("board_id", boardId);

  if (deleteError) {
    throw new Error(`Failed to clear elements: ${deleteError.message}`);
  }

  const rows = elements
    .filter((el) => !el._preview)
    .map((el) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _preview, version: _v, ...clean } = el as BoardElement & {
        _preview?: boolean;
      };
      return {
        id: clean.id,
        board_id: boardId,
        type: toDbType(clean.type as string),
        data: { ...clean } as unknown as Record<string, unknown>,
        version: (el.version ?? 0) + 1,
      };
    });

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("board_elements")
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert elements: ${insertError.message}`);
  }
}
