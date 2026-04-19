"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, ChevronDown } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { TOOLS, COLORS, STROKE_SIZES } from "@/lib/constants";

interface ToolSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolSidebar({ isOpen, onClose }: ToolSidebarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const { tool, setTool, color, setColor, strokeWidth, setStrokeWidth } =
    useBoardStore();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 56, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0 z-20 overflow-hidden relative"
    >
      {/* Tools */}
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group ${
              tool === t.id
                ? "bg-violet-100 text-violet-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
            title={t.label}
          >
            <Icon size={16} />
            <span className="absolute left-12 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {t.label}
            </span>
          </button>
        );
      })}

      <div className="w-6 h-px bg-gray-200 my-1" />

      {/* Color Picker Toggle */}
      <button
        onClick={() => setShowColorPicker(!showColorPicker)}
        className="w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:bg-gray-100 group relative"
        title="Color"
      >
        <div
          className="w-5 h-5 rounded-md border border-gray-300"
          style={{ backgroundColor: color }}
        />
      </button>

      {/* Color Picker Dropdown */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute left-14 top-12 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50"
          >
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setShowColorPicker(false);
                  }}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${
                    color === c
                      ? "border-gray-800 scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 font-medium">
                Stroke Width
              </p>
              <div className="flex gap-1">
                {STROKE_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrokeWidth(s)}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                      strokeWidth === s
                        ? "bg-violet-100 text-violet-700"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{
                        width: Math.min(s, 10),
                        height: Math.min(s, 10),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1" />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
        title="Hide sidebar"
      >
        <PanelLeftClose size={14} />
      </button>
    </motion.div>
  );
}
