"use client";

import { Canvas } from "@/components/canvas/Canvas";
import { SelectionBox } from "@/components/elements/SelectionBox";
import { TextEditor } from "@/components/elements/TextEditor";
import { FloatingActionBar } from "@/components/toolbar/FloatingActionBar";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useBoardStore } from "@/store/useBoardStore";

export default function TestCanvasPage() {
  const { selectedElementId, editingTextId } = useBoardStore();

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
        {editingTextId && <TextEditor key={editingTextId} />}
        {selectedElementId && <SelectionBox />}
        <FloatingActionBar />
        <ToastContainer />
      </div>
    </div>
  );
}
