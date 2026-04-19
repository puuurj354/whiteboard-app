"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftOpen } from "lucide-react";
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
  params: Promise<{ slug: string }>;
}

export default function BoardPage({ params }: BoardPageProps) {
  const { slug } = use(params);

  // UI-only state (no need to live in Zustand)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPresencePanel, setShowPresencePanel] = useState(false);

  const {
    selectedElementId,
    editingTextId,
    remoteCursors,
    elements,
    showExport,
    setShowExport,
    tool,
    updateRemoteCursor,
  } = useBoardStore();

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random cursor movement for demo
      ["c1", "c2", "c3"].forEach((id) => {
        updateRemoteCursor(
          id,
          Math.random() * 800 + 100,
          Math.random() * 500 + 100,
        );
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [updateRemoteCursor]);

  return (
    <div
      className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top Bar */}
      <TopBar
        slug={slug}
        setShowExport={setShowExport}
        showPresencePanel={showPresencePanel}
        setShowPresencePanel={setShowPresencePanel}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <AnimatePresence>
          {sidebarOpen && (
            <ToolSidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Collapsed Sidebar Toggle */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-30 bg-white border border-gray-200 rounded-lg p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm transition-all"
            title="Open Sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas />

          {/* Text Editing Overlay */}
          {editingTextId && <TextEditor key={editingTextId} />}

          {/* Selection Box */}
          {selectedElementId && tool === "select" && <SelectionBox />}

          {/* Remote Cursors */}
          <RemoteCursors cursors={remoteCursors} />

          {/* Zoom Controls */}
          <ZoomControls />

          {/* Element Counter */}
          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[11px] text-gray-500 z-20 border border-gray-200/50">
            {elements.filter((el) => !el._preview).length} element
            {elements.filter((el) => !el._preview).length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Presence Panel */}
        <AnimatePresence>
          {showPresencePanel && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="absolute top-2 right-4 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-30 w-64"
            >
              <h3 className="text-sm font-bold text-gray-800 mb-3">
                Active Users
              </h3>
              {remoteCursors.length === 0 ? (
                <p className="text-xs text-gray-400">No other users online.</p>
              ) : (
                <div className="space-y-2">
                  {remoteCursors.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {c.name}
                        </p>
                        <p className="text-[10px] text-green-500">
                          ● Active now
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">
                  {remoteCursors.length + 1} collaborator
                  {remoteCursors.length + 1 !== 1 ? "s" : ""} viewing
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Bar (shown when element is selected) */}
      <FloatingActionBar />

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      </AnimatePresence>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
