/**
 * boardService — Supabase DB interactions adapted to the existing schema.
 *
 * Schema facts:
 *  - Table: public.boards     (id, slug, created_at, updated_at) — NO `name` column
 *  - Table: public.board_elements (id, board_id, type, data, version, created_at, updated_at)
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
// The DB CHECK constraint uses 'freedraw' and 'ellipse' from an earlier design.
// Our canvas uses 'pencil' and 'circle'. We translate at the service boundary.

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

// ─── Board ────────────────────────────────────────────────────────────────────

/**
 * Fetches an existing board by slug, or creates a new one if it doesn't exist.
 * Note: boards table has NO `name` column — only `slug`.
 */
export async function getOrCreateBoard(slug: string): Promise<BoardRecord> {
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

  // Board doesn't exist → create with just slug (no name column)
  const { data: created, error: createError } = await supabase
    .from("boards")
    .insert([{ slug }])
    .select("id, slug")
    .single();

  if (createError || !created) {
    throw new Error(
      `Failed to create board: ${createError?.message ?? "no data returned"}`,
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
 * Fetches all elements for a board, ordered by creation time.
 * Translates DB type names back to app type names.
 */
export async function fetchElements(boardId: string): Promise<BoardElement[]> {
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
    type: toAppType(row.type),   // translate DB type → app type
    version: row.version,
  })) as BoardElement[];
}

/**
 * Upserts a single element to board_elements.
 * Translates app type → DB type and increments version for conflict resolution.
 */
export async function upsertElement(
  boardId: string,
  element: BoardElement,
): Promise<void> {
  // Strip local-only flags before persisting
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _preview, version: _v, ...cleanElement } =
    element as BoardElement & { _preview?: boolean };

  const nextVersion = (element.version ?? 0) + 1;

  const payload = {
    id: cleanElement.id,
    board_id: boardId,
    type: toDbType(cleanElement.type as string), // translate app type → DB type
    data: { ...cleanElement } as unknown as Record<string, unknown>,
    version: nextVersion,
  };

  const { error } = await supabase
    .from("board_elements")
    .upsert([payload], { onConflict: "id" });

  if (error) {
    throw new Error(
      `Failed to upsert element ${element.id}: ${error.message}`,
    );
  }
}

/**
 * Deletes a single element by id from board_elements.
 */
export async function deleteElement(elementId: string): Promise<void> {
  const { error } = await supabase
    .from("board_elements")
    .delete()
    .eq("id", elementId);

  if (error) {
    throw new Error(`Failed to delete element ${elementId}: ${error.message}`);
  }
}

/**
 * Full-replace: clears all elements for a board and re-inserts.
 * Used for reconciliation. Use sparingly.
 */
export async function replaceAllElements(
  boardId: string,
  elements: BoardElement[],
): Promise<void> {
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
