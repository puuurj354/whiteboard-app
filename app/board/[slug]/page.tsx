"use client";

import { useState, useEffect, useRef } from "react";
import { use } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftOpen, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { useBoard } from "@/hooks/useBoard";
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

  // UI-only state
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
  } = useBoardStore();

  // ── Supabase integration ───────────────────────────────────────────────────
  const {
    status, error, localUser,
    syncElement, removeElement, seedInitialSnapshot,
    broadcastElement, broadcastElementDelete,
    broadcastCursorPos,
  } = useBoard(slug);

  // ── Diff-based element sync ────────────────────────────────────────────────
  // id → JSON snapshot of last known state. Avoids re-upserting unchanged elements.
  const prevElementsRef = useRef<Map<string, string>>(new Map());
  const seededRef = useRef(false); // prevent double-seeding

  // Step A: When board first becomes ready, seed the snapshot from server data.
  // This ensures elements fetched from DB are NOT immediately re-upserted.
  useEffect(() => {
    if (status !== "ready" || seededRef.current) return;
    seededRef.current = true;

    const serverElements = elements.filter((el) => !el._preview);
    serverElements.forEach((el) => {
      prevElementsRef.current.set(el.id, JSON.stringify(el));
    });
    seedInitialSnapshot(serverElements);
  // Only run once when status becomes ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Step B: After seed, diff and sync user-driven changes.
  useEffect(() => {
    if (status !== "ready" || !seededRef.current) return;

    const current = elements.filter((el) => !el._preview);
    const currentIds = new Set(current.map((el) => el.id));
    const prev = prevElementsRef.current;

    // Detect deleted elements
    for (const prevId of prev.keys()) {
      if (!currentIds.has(prevId)) {
        broadcastElementDelete(prevId); // ← instant to peers (~50ms)
        removeElement(prevId);          // ← DB delete (async)
        prev.delete(prevId);
      }
    }

    // Detect added or changed elements
    for (const el of current) {
      const snapshot = JSON.stringify(el);
      if (prev.get(el.id) !== snapshot) {
        broadcastElement(el); // ← instant to peers (~50ms)
        syncElement(el);      // ← DB upsert (debounced 400ms)
        prev.set(el.id, snapshot);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);



  // ── Loading / Error screen ─────────────────────────────────────────────────
  if (status === "loading" || status === "idle") {
    return (
      <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 bg-linear-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center animate-pulse">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Connecting to board…
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <WifiOff size={32} className="text-red-400" />
        <div className="text-center">
          <p className="text-gray-800 font-semibold">Failed to connect</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Main board UI ──────────────────────────────────────────────────────────
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
          <Canvas broadcastCursorPos={broadcastCursorPos} />

          {/* Text Editing Overlay */}
          {editingTextId && <TextEditor key={editingTextId} />}

          {/* Selection Box */}
          {selectedElementId && tool === "select" && <SelectionBox />}

          {/* Remote Cursors */}
          <RemoteCursors cursors={remoteCursors} />

          {/* Zoom Controls */}
          <ZoomControls />

          {/* Element Counter + connection status */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[11px] text-gray-500 z-20 border border-gray-200/50 flex items-center gap-1.5">
              <Wifi size={10} className="text-green-500" />
              {elements.filter((el) => !el._preview).length} element
              {elements.filter((el) => !el._preview).length !== 1 ? "s" : ""}
            </div>
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

              {/* Local user (always shown) */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{
                    backgroundColor: localUser.color,
                    outline: `2px solid ${localUser.color}`,
                    outlineOffset: "2px",
                  }}
                >
                  {localUser.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {localUser.name}{" "}
                    <span className="text-gray-400 font-normal">(you)</span>
                  </p>
                  <p className="text-[10px] text-green-500">● Active now</p>
                </div>
              </div>

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
                        <p className="text-[10px] text-green-500">● Active now</p>
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

      {/* Floating Action Bar */}
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
