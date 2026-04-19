"use client";

import { useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { TopBar } from "@/components/toolbar/TopBar";
import { ToolSidebar } from "@/components/toolbar/ToolSidebar";
import { Canvas } from "@/components/canvas/Canvas";
import { RemoteCursors } from "@/components/presence/RemoteCursors";
import { ZoomControls } from "@/components/toolbar/ZoomControls";
import { ExportModal } from "@/components/ui/ExportModal";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { SelectionBox } from "@/components/elements/SelectionBox";
import { TextEditor } from "@/components/elements/TextEditor";
import { FloatingActionBar } from "@/components/toolbar/FloatingActionBar";

interface BoardPageProps {
  params: {
    slug: string;
  };
}

export default function BoardPage({ params }: BoardPageProps) {
  const { slug } = params;

  // UI State (tidak perlu di zustand karena hanya untuk UI toggle)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Get state from Zustand
  const { selectedElementId, editingTextId, remoteCursors, elements } =
    useBoardStore();

  return (
    <div
      className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top Bar */}
      <TopBar
        slug={slug}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setShowExport={setShowExport}
        showColorPicker={showColorPicker}
        setShowColorPicker={setShowColorPicker}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <ToolSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-16 left-3 z-30 bg-white border border-gray-200 rounded-lg p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm transition-all"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas />

          {/* Text Editing Overlay */}
          {editingTextId && <TextEditor />}

          {/* Selection Box */}
          {selectedElementId && <SelectionBox />}

          {/* Remote Cursors */}
          <RemoteCursors cursors={remoteCursors} />

          {/* Zoom Controls */}
          <ZoomControls />

          {/* Element Count */}
          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[11px] text-gray-500 z-20">
            {elements.length} element{elements.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Floating Action Bar (when element selected) */}
      {selectedElementId && <FloatingActionBar />}

      {/* Export Modal */}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
