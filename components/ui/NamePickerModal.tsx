"use client";

import { useState, useEffect, useRef } from "react";

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#64748b", // slate
];

interface NamePickerModalProps {
  /** Current identity to pre-fill */
  initial: { name: string; color: string };
  /** Whether to show as "first time join" or "edit profile" */
  mode: "join" | "edit";
  onConfirm: (name: string, color: string) => void;
  onClose?: () => void;
}

export function NamePickerModal({
  initial,
  mode,
  onConfirm,
  onClose,
}: NamePickerModalProps) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select on mount
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, color);
  }

  const isValid = name.trim().length > 0 && name.trim().length <= 24;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={mode === "edit" ? onClose : undefined}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl"
        style={{
          background: "#1a1a24",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (edit mode only) */}
        {mode === "edit" && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-lg transition-all"
            style={{ backgroundColor: color }}
          >
            {name.trim()[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              {mode === "join" ? "Set your display name" : "Edit your profile"}
            </h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              {mode === "join"
                ? "Others will see this when you collaborate"
                : "Changes are applied instantly"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
              Display name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name…"
              maxLength={24}
              className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/6 border text-white placeholder-white/20 outline-none transition-all"
              style={{
                borderColor: isValid ? "rgba(255,255,255,0.12)" : "rgba(239,68,68,0.5)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = color + "80")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = isValid
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(239,68,68,0.5)")
              }
            />
            {name.length > 0 && name.trim().length === 0 && (
              <p className="text-[10px] text-red-400">Name cannot be blank</p>
            )}
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
              Your color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : "3px solid transparent",
                    outlineOffset: "2px",
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{
              background: isValid
                ? `linear-gradient(135deg, ${color}, ${color}bb)`
                : "rgba(255,255,255,0.1)",
              boxShadow: isValid ? `0 4px 20px ${color}40` : "none",
            }}
          >
            {mode === "join" ? "Join Board →" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
