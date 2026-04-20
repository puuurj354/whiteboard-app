"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CursorState } from "@/types";
import { useBoardStore } from "@/store/useBoardStore";

interface RemoteCursorsProps {
  cursors: CursorState[];
}

export function RemoteCursors({ cursors }: RemoteCursorsProps) {
  const { viewport } = useBoardStore();

  return (
    <AnimatePresence>
      {cursors.map((c) => {
        // Convert world → screen coordinates using current viewport
        const screenX = c.x * viewport.zoom + viewport.pan.x;
        const screenY = c.y * viewport.zoom + viewport.pan.y;

        return (
          <motion.div
            key={c.id}
            className="absolute pointer-events-none z-20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              left: screenX,
              top: screenY,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            // Fast animation — feels live, not laggy
            transition={{
              left: { duration: 0.08, ease: "linear" },
              top:  { duration: 0.08, ease: "linear" },
              opacity: { duration: 0.15 },
              scale:   { duration: 0.15 },
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="18"
              height="22"
              viewBox="0 0 20 24"
              fill="none"
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))" }}
            >
              <path
                d="M1 1L1 19L5.5 14.5L10.5 23L13 21.5L8 13L15 13L1 1Z"
                fill={c.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>

            {/* Name label */}
            <div
              className="absolute top-4 left-3.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
