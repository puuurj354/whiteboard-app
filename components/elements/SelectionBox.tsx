"use client";

import { useBoardStore } from "@/store/useBoardStore";

export function SelectionBox() {
  const { selectedElementId, elements, viewport } = useBoardStore();

  const element = elements.find((el) => el.id === selectedElementId);
  if (!element) return null;

  // --- Bounding box calculation ---
  let elX = element.x;
  let elY = element.y;
  let width = element.width || 100;
  let height = element.height || 40;

  if (element.type === "circle") {
    const r = element.radius || 50;
    width = r * 2;
    height = r * 2;
  } else if (element.type === "text") {
    width = element.width || 200;
    height = element.fontSize || 24;
  } else if (
    element.type === "pencil" &&
    element.path &&
    element.path.length > 0
  ) {
    const xs = element.path.map((p) => p.x);
    const ys = element.path.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    elX = minX;
    elY = minY;
    width = Math.max(maxX - minX, 10);
    height = Math.max(maxY - minY, 10);
  }

  // Padding around the element (in canvas units)
  const pad = 6;

  // Convert to screen coordinates
  const screenX = (elX - pad) * viewport.zoom + viewport.pan.x;
  const screenY = (elY - pad) * viewport.zoom + viewport.pan.y;
  const screenWidth = (width + pad * 2) * viewport.zoom;
  const screenHeight = (height + pad * 2) * viewport.zoom;

  const handleClass =
    "absolute w-3 h-3 bg-violet-500 rounded-full shadow-sm border-2 border-white";

  return (
    <div
      className="absolute border-2 border-violet-500 pointer-events-none z-20 rounded-sm"
      style={{
        left: screenX,
        top: screenY,
        width: screenWidth,
        height: screenHeight,
      }}
    >
      {/* Top-left */}
      <div
        className={handleClass}
        style={{ position: "absolute", top: -6, left: -6 }}
      />
      {/* Top-right */}
      <div
        className={handleClass}
        style={{ position: "absolute", top: -6, right: -6 }}
      />
      {/* Bottom-left */}
      <div
        className={handleClass}
        style={{ position: "absolute", bottom: -6, left: -6 }}
      />
      {/* Bottom-right */}
      <div
        className={handleClass}
        style={{ position: "absolute", bottom: -6, right: -6 }}
      />
    </div>
  );
}
