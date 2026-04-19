"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Generates a URL-friendly slug from a board name
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

// Generates a random catchy board name
const ADJECTIVES = ["swift", "cosmic", "bright", "calm", "vivid", "bold", "crisp", "epic"];
const NOUNS = ["canvas", "board", "space", "studio", "frame", "desk", "room", "lab"];
function randomBoardName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}-${noun}-${num}`;
}

interface RecentBoard {
  slug: string;
  name: string;
  visitedAt: number;
}

function getRecentBoards(): RecentBoard[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("wb_recent_boards") ?? "[]");
  } catch {
    return [];
  }
}

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [boardName, setBoardName] = useState("");
  const [recentBoards, setRecentBoards] = useState<RecentBoard[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  // Generate a random default on mount (client only)
  useEffect(() => {
    setBoardName(randomBoardName());
    setRecentBoards(getRecentBoards().slice(0, 5));
  }, []);

  const slug = toSlug(boardName) || "untitled-board";

  function handleOpen(targetSlug: string, targetName: string) {
    if (isNavigating) return;
    setIsNavigating(true);

    // Persist to recent boards
    const updated: RecentBoard[] = [
      { slug: targetSlug, name: targetName, visitedAt: Date.now() },
      ...getRecentBoards().filter((b) => b.slug !== targetSlug),
    ].slice(0, 10);
    localStorage.setItem("wb_recent_boards", JSON.stringify(updated));

    router.push(`/board/${targetSlug}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (slug) handleOpen(slug, boardName || slug);
  }

  const timeAgo = (ms: number): string => {
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60_000);
    const hrs = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, #7c3aed 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Whiteboard</h1>
            <p className="text-sm text-white/40 mt-0.5">Real-time collaborative canvas</p>
          </div>
        </div>

        {/* Main card */}
        <div
          className="w-full rounded-2xl p-6 flex flex-col gap-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-xs font-medium text-white/50 uppercase tracking-widest">
              Board name or URL
            </label>
            <input
              ref={inputRef}
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="e.g. swift-canvas-042"
              className="w-full rounded-xl px-4 py-3 text-sm bg-white/5 border border-white/10 text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Slug preview */}
            {boardName && (
              <p className="text-[11px] text-white/30 px-1">
                URL:{" "}
                <span className="text-violet-400/70 font-mono">
                  /board/<strong>{slug}</strong>
                </span>
              </p>
            )}

            <button
              type="submit"
              disabled={isNavigating || !slug}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              style={{
                background: isNavigating
                  ? "rgba(124,58,237,0.5)"
                  : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 0 20px rgba(124,58,237,0.3)",
              }}
            >
              {isNavigating ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Opening…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                  Open Board
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[11px] text-white/25">or</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <button
            onClick={() => {
              const name = randomBoardName();
              setBoardName(name);
              inputRef.current?.focus();
            }}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-white/40 hover:text-white/70 transition-colors border border-white/8 hover:border-white/15"
          >
            🎲 Generate random board name
          </button>
        </div>

        {/* Recent boards */}
        {recentBoards.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest px-1">
              Recent boards
            </p>
            <div className="flex flex-col gap-1.5">
              {recentBoards.map((board) => (
                <button
                  key={board.slug}
                  onClick={() => handleOpen(board.slug, board.name)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/80 font-mono">{board.slug}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/25 group-hover:text-white/40 transition-colors shrink-0">
                    {timeAgo(board.visitedAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feature pills */}
        <div className="flex items-center gap-4 text-[10px] text-white/25 flex-wrap justify-center">
          <span className="flex items-center gap-1">✏️ Draw & annotate</span>
          <span className="flex items-center gap-1">👥 Multiplayer</span>
          <span className="flex items-center gap-1">📤 Export PNG</span>
          <span className="flex items-center gap-1">🔄 Auto-save</span>
        </div>
      </div>
    </div>
  );
}
