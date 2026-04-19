"use client";

import { Grid3X3, Undo2, Redo2, Download, Users } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";

interface TopBarProps {
  slug: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setShowExport: (show: boolean) => void;
  showColorPicker: boolean;
  setShowColorPicker: (show: boolean) => void;
}

export function TopBar({
  slug,
  sidebarOpen,
  setSidebarOpen,
  setShowExport,
  showColorPicker,
  setShowColorPicker,
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

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-30">
      {/* Left: Title & Board Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <span className="text-sm font-semibold text-gray-700">
            Test Canvas - Drawing Only
          </span>
        </div>
      </div>

      {/* Center: Tools Info */}
      <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
        Tools: P (Pencil) | R (Rectangle) | C (Circle) | E (Eraser) | V (Select)
      </div>

      {/* Right: Actions */}
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
            title="Toggle Grid"
          >
            <Grid3X3 size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Undo/Redo */}
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

        {/* Users Button */}
        <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all">
          <Users size={15} />
        </button>

        {/* User Avatars */}
        <div className="flex -space-x-2 ml-2">
          {remoteCursors.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: c.color }}
              title={c.name}
            >
              {c.name[0]}
            </div>
          ))}
          {remoteCursors.length > 3 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600">
              +{remoteCursors.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
