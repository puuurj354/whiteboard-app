"use client";

import { Minus, Plus, Maximize } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";

export function ZoomControls() {
  const { viewport, setViewport } = useBoardStore();

  const zoomIn = () =>
    setViewport({ zoom: Math.min(5, parseFloat((viewport.zoom + 0.1).toFixed(1))) });

  const zoomOut = () =>
    setViewport({ zoom: Math.max(0.1, parseFloat((viewport.zoom - 0.1).toFixed(1))) });

  const resetView = () =>
    setViewport({ zoom: 1, pan: { x: 0, y: 0 } });

  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex items-center gap-1 z-20">
      <button
        onClick={zoomOut}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
        title="Zoom Out"
      >
        <Minus size={14} />
      </button>

      <span className="text-xs font-medium text-gray-700 w-12 text-center tabular-nums">
        {Math.round(viewport.zoom * 100)}%
      </span>

      <button
        onClick={zoomIn}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
        title="Zoom In"
      >
        <Plus size={14} />
      </button>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      <button
        onClick={resetView}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
        title="Reset View (100%)"
      >
        <Maximize size={14} />
      </button>
    </div>
  );
}
