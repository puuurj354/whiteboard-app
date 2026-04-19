"use client";

import { motion } from "framer-motion";
import type { CursorState } from "@/types";
import { useBoardStore } from "@/store/useBoardStore";

interface RemoteCursorsProps {
  cursors: CursorState[];
}

export function RemoteCursors({ cursors }: RemoteCursorsProps) {
  const { viewport } = useBoardStore();

  return (
    <>
      {cursors.map((c) => (
        <motion.div
          key={c.id}
          className="absolute pointer-events-none z-20"
          animate={{
            left: c.x * viewport.zoom + viewport.pan.x,
            top: c.y * viewport.zoom + viewport.pan.y,
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <svg
            width="20"
            height="24"
            viewBox="0 0 20 24"
            fill="none"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))" }}
          >
            <path
              d="M1 1L1 19L5.5 14.5L10.5 23L13 21.5L8 13L15 13L1 1Z"
              fill={c.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
          <div
            className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white ml-3 -mt-1 whitespace-nowrap"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </div>
        </motion.div>
      ))}
    </>
  );
}
