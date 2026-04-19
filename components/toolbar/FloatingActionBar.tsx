"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, X } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { addToast } from "@/components/ui/ToastContainer";

export function FloatingActionBar() {
  const {
    tool,
    selectedElementId,
    elements,
    setElements,
    pushToHistory,
    setSelectedElement,
    clearCanvas,
  } = useBoardStore();

  const handleClearAll = () => {
    if (window.confirm("Clear the entire canvas?")) {
      clearCanvas();
      addToast("Canvas cleared", "info");
    }
  };

  const handleDuplicate = () => {
    const el = elements.find((e) => e.id === selectedElementId);
    if (el) {
      const copy = {
        ...el,
        id: Math.random().toString(36).substring(2, 10),
        x: el.x + 20,
        y: el.y + 20,
      };
      const newEls = [...elements, copy];
      setElements(newEls);
      pushToHistory(newEls);
      setSelectedElement(copy.id);
      addToast("Element duplicated", "info");
    }
  };

  const handleDelete = () => {
    if (!selectedElementId) return;
    const newEls = elements.filter((el) => el.id !== selectedElementId);
    setElements(newEls);
    pushToHistory(newEls);
    setSelectedElement(null);
    addToast("Element deleted", "info");
  };

  return (
    <AnimatePresence>
      {selectedElementId && tool === "select" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-1 z-30"
        >
          <button
            onClick={handleDuplicate}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
            title="Duplicate"
          >
            <Copy size={15} />
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={handleClearAll}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
            title="Clear All"
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
