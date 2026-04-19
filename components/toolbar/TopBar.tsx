"use client";

import { Grid3X3, Undo2, Redo2, Download, Users } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";

interface TopBarProps {
  slug: string;
  setShowExport: (show: boolean) => void;
  showPresencePanel: boolean;
  setShowPresencePanel: (show: boolean) => void;
}

export function TopBar({
  slug,
  setShowExport,
  showPresencePanel,
  setShowPresencePanel,
}: TopBarProps) {
  const {
    showGrid,
    setShowGrid,
    undo,
    redo,
    historyIndex,
    history,
    remoteCursors,
  } = useBoardStore();

  const boardName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left: Logo + Board Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-linear-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-800 leading-tight">
            {boardName}
          </h1>
          <p className="text-[10px] text-gray-400 leading-tight">
            board/{slug} &bull; Auto-saved
          </p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {/* Grid Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-md transition-all ${
              showGrid
                ? "bg-white shadow-sm text-gray-800"
                : "text-gray-500 hover:text-gray-700"
            }`}
            title="Toggle Grid (G)"
          >
            <Grid3X3 size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-all"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Export Button */}
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-all"
        >
          <Download size={13} />
          Export
        </button>

        {/* Users / Presence Button */}
        <button
          onClick={() => setShowPresencePanel(!showPresencePanel)}
          className={`p-2 rounded-lg transition-all ${
            showPresencePanel
              ? "bg-violet-100 text-violet-700"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          }`}
          title="Collaborators"
        >
          <Users size={15} />
        </button>

        {/* Remote Cursor Avatars */}
        {remoteCursors.length > 0 && (
          <div className="flex -space-x-2 ml-1">
            {remoteCursors.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: c.color }}
                title={c.name}
              >
                {c.name[0].toUpperCase()}
              </div>
            ))}
            {remoteCursors.length > 3 && (
              <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600 shadow-sm">
                +{remoteCursors.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
