"use client";

import { motion } from "framer-motion";
import { ImageIcon, Settings2, X } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { addToast } from "@/components/ui/ToastContainer";
import type { BoardElement } from "@/types";

interface ExportModalProps {
  onClose: () => void;
}

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawElements = (
  ctx: CanvasRenderingContext2D,
  elements: BoardElement[],
) => {
  elements.forEach((el) => {
    ctx.strokeStyle = el.color || el.stroke || "#000";
    ctx.fillStyle = el.color || "#000";
    ctx.lineWidth = el.strokeWidth || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (el.type === "pencil" && el.path) {
      if (el.path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(el.path[0].x, el.path[0].y);
      for (let i = 1; i < el.path.length; i++) {
        const prev = el.path[i - 1];
        const curr = el.path[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
    } else if (el.type === "rectangle") {
      ctx.beginPath();
      ctx.rect(el.x, el.y, el.width!, el.height!);
      if (el.fill && el.fill !== "transparent") {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      ctx.stroke();
    } else if (el.type === "circle") {
      ctx.beginPath();
      ctx.arc(el.x + el.radius!, el.y + el.radius!, el.radius!, 0, Math.PI * 2);
      if (el.fill && el.fill !== "transparent") {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      ctx.stroke();
    } else if (el.type === "text") {
      ctx.font = `${el.fontSize || 20}px Inter, sans-serif`;
      ctx.fillStyle = el.color || "#000";
      ctx.fillText(el.text || "", el.x, el.y);
    } else if (el.type === "sticky") {
      const w = el.width || 180;
      const h = el.height || 140;
      ctx.fillStyle = el.bgColor || "#FEF3C7";
      ctx.shadowColor = "rgba(0,0,0,0.1)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      roundRect(ctx, el.x, el.y, w, h, 8);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = "14px Inter, sans-serif";
      ctx.fillStyle = el.color || "#000";
      ctx.fillText(el.text || "", el.x + 12, el.y + 24);
    }
  });
};

export function ExportModal({ onClose }: ExportModalProps) {
  const { elements } = useBoardStore();

  const exportCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, 1920, 1080);

    // Grid
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < 1920; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    for (let y = 0; y < 1080; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }

    drawElements(ctx, elements);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "whiteboard-export.png";
        a.click();
        URL.revokeObjectURL(url);
        addToast("Exported as PNG!", "success");
        onClose();
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Export Canvas</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">Choose your export format</p>

        <div className="space-y-2 mb-4">
          <button
            onClick={exportCanvas}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
          >
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600">
              <ImageIcon size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">PNG Image</p>
              <p className="text-xs text-gray-500">High quality, 1920×1080</p>
            </div>
          </button>

          <button
            onClick={() => {
              addToast("JSON export coming soon", "info");
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all opacity-60"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <Settings2 size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">JSON Data</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}
