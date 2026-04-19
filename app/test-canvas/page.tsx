"use client";

import { Canvas } from "@/components/canvas/Canvas";

export default function TestCanvasPage() {
  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Simple Header */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <h1 className="text-sm font-semibold text-gray-700">
          🎨 Test Canvas - Drawing Only
        </h1>
        <div className="text-xs text-gray-500">
          Tools: P (Pencil) | R (Rectangle) | C (Circle) | E (Eraser) | V
          (Select)
        </div>
      </div>

      {/* Canvas Full Screen */}
      <div className="flex-1 relative">
        <Canvas />
      </div>
    </div>
  );
}
