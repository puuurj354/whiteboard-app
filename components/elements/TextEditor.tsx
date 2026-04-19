"use client";

import { useState, useEffect, useRef } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { addToast } from "@/components/ui/ToastContainer";

export function TextEditor() {
  const {
    editingTextId,
    elements,
    setElements,
    pushToHistory,
    setEditingTextId,
    viewport,
  } = useBoardStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const element = elements.find((el) => el.id === editingTextId);
  const [tempValue, setTempValue] = useState(element?.text || "");

  // Focus the correct input after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      textareaRef.current?.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, []);

  if (!element) return null;

  const handleSave = () => {
    if (!editingTextId) return;
    const newEls = elements.map((el) =>
      el.id === editingTextId ? { ...el, text: tempValue } : el,
    );
    setElements(newEls);
    pushToHistory(newEls);
    setEditingTextId(null);
    addToast("Text updated", "success");
  };

  const handleCancel = () => {
    setEditingTextId(null);
    setTempValue("");
  };

  const screenX = element.x * viewport.zoom + viewport.pan.x;
  const screenY = element.y * viewport.zoom + viewport.pan.y;

  // --- Sticky Note Editor ---
  if (element.type === "sticky") {
    const w = (element.width || 180) * viewport.zoom;
    const h = (element.height || 140) * viewport.zoom;

    return (
      <div
        className="absolute z-40 overflow-hidden rounded-lg"
        style={{
          left: screenX,
          top: screenY,
          width: w,
          height: h,
          backgroundColor: element.bgColor || "#FEF3C7",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <textarea
          ref={textareaRef}
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
            // Ctrl+Enter saves
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
          className="w-full h-full resize-none border-none outline-none bg-transparent p-3 leading-snug"
          style={{
            fontSize: Math.max(10, 14 * viewport.zoom),
            color: element.color || "#000",
            fontFamily: "inherit",
          }}
          placeholder="Type something..."
        />
      </div>
    );
  }

  // --- Text Element Editor ---
  // Canvas draws text at (el.x, el.y) as the baseline.
  // We shift up by fontSize/2 so the input visually aligns with the text.
  const fontSize = Math.max(12, (element.fontSize || 20) * viewport.zoom);

  return (
    <div
      className="absolute z-40"
      style={{
        left: screenX,
        top: screenY - fontSize * 0.8, // align baseline with canvas text
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") {
            handleCancel();
          }
        }}
        className="border-2 border-violet-400 rounded px-1.5 py-0.5 outline-none bg-white/95 shadow-md"
        style={{
          fontSize,
          color: element.color || "#000",
          minWidth: "120px",
          fontFamily: "inherit",
          lineHeight: 1.2,
        }}
      />
    </div>
  );
}
