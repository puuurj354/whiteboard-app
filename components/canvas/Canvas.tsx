"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import type { Point } from "@/types";
import { addToast } from "@/components/ui/ToastContainer";


function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    // Midpoint between curr and next — the control point "end"
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    // Midpoint between prev and curr — the control point "start"
    const pmx = (prev.x + curr.x) / 2;
    const pmy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(pmx, pmy, (pmx + mx) / 2, (pmy + my) / 2);
  }

  // Connect to the last point
  const last = points[points.length - 1];
  const secondLast = points[points.length - 2];
  ctx.quadraticCurveTo(
    (secondLast.x + last.x) / 2,
    (secondLast.y + last.y) / 2,
    last.x,
    last.y,
  );
  ctx.stroke();
}

export function Canvas() {
  // ── Refs ──────────────────────────────────────────────────────────────────
  /** Bottom layer: committed, finalised elements */
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  /** Top layer: live-drawing preview (pencil / eraser / shape preview) */
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing interaction state (all refs → no re-render cost)
  const isDrawing = useRef(false);
  const currentPath = useRef<Point[]>([]);
  const startPos = useRef<Point | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<Point | null>(null);

  // ── Zustand store ─────────────────────────────────────────────────────────
  const {
    elements,
    tool,
    color,
    strokeWidth,
    showGrid,
    setElements,
    pushToHistory,
    selectedElementId,
    setSelectedElement,
    viewport,
    setViewport,
    setTool,
    undo,
    redo,
    editingTextId,
    setEditingTextId,
    setShowGrid,
    setShowExport,
  } = useBoardStore();

  // Cursor style state — only this causes a re-render, which is acceptable
  const [cursorStyle, setCursorStyle] = useState<string>("default");

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowExport(true);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v": setTool("select"); break;
        case "h": setTool("hand"); break;
        case "p": setTool("pencil"); break;
        case "r": setTool("rectangle"); break;
        case "c": setTool("circle"); break;
        case "t": setTool("text"); break;
        case "s": setTool("sticky"); break;
        case "e": setTool("eraser"); break;
        case "g": setShowGrid(!showGrid); break;
        case "escape": setSelectedElement(null); break;
        case "delete":
        case "backspace":
          if (selectedElementId) {
            const newEls = elements.filter((el) => el.id !== selectedElementId);
            setElements(newEls);
            pushToHistory(newEls);
            setSelectedElement(null);
            addToast("Element deleted", "info");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editingTextId, selectedElementId, elements, setTool, undo, redo,
    setElements, pushToHistory, setSelectedElement, showGrid, setShowGrid, setShowExport,
  ]);

  // ── Coordinate helper ─────────────────────────────────────────────────────
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent): Point => {
      const rect = staticCanvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left - viewport.pan.x) / viewport.zoom,
        y: (e.clientY - rect.top - viewport.pan.y) / viewport.zoom,
      };
    },
    [viewport.pan, viewport.zoom],
  );

  // ── Hit testing ───────────────────────────────────────────────────────────
  const hitTest = useCallback(
    (coords: Point) => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === "pencil" && el.path) {
          if (el.path.length === 0) continue;
          for (const pt of el.path) {
            const dx = pt.x - coords.x;
            const dy = pt.y - coords.y;
            if (Math.sqrt(dx * dx + dy * dy) < 10) return el;
          }
        } else if (el.type === "rectangle") {
          if (
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 0) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 0)
          ) return el;
        } else if (el.type === "circle") {
          const cx = el.x + (el.radius || 0);
          const cy = el.y + (el.radius || 0);
          const dist = Math.sqrt((coords.x - cx) ** 2 + (coords.y - cy) ** 2);
          if (dist <= (el.radius || 0)) return el;
        } else if (el.type === "text" || el.type === "sticky") {
          if (
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 200) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 40)
          ) return el;
        }
      }
      return null;
    },
    [elements],
  );

  // ── Rounded rect helper ───────────────────────────────────────────────────
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
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

  // ── Draw committed elements (static canvas) ───────────────────────────────
  const drawElements = useCallback(
    (ctx: CanvasRenderingContext2D, els: typeof elements) => {
      els.forEach((el) => {
        if (el._preview) return;
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
          ctx.font = `14px Inter, sans-serif`;
          ctx.fillStyle = el.color || "#000";
          ctx.fillText(el.text || "", el.x + 12, el.y + 24);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Static canvas render (elements + grid) ────────────────────────────────
  // Triggers only when committed data changes, NOT during live drawing.
  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Grid — drawn in screen space to keep lines crisp at any zoom level
    if (showGrid) {
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 0.5;
      const gridSize = 24 * viewport.zoom; // grid cell size in screen pixels
      const offsetX = viewport.pan.x % gridSize;
      const offsetY = viewport.pan.y % gridSize;

      for (let x = offsetX; x < rect.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }
      for (let y = offsetY; y < rect.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
    }

    // Elements
    ctx.save();
    ctx.translate(viewport.pan.x, viewport.pan.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    drawElements(ctx, elements);
    ctx.restore();
  }, [elements, viewport, showGrid, drawElements]);

  // ── Overlay canvas: clear helper ──────────────────────────────────────────
  const clearOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    // Use CSS logical pixel dimensions (canvas is scaled by DPR)
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
  }, []);

  // ── Overlay canvas: sync size with static canvas ──────────────────────────
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const staticC = staticCanvasRef.current;
    if (!overlay || !staticC) return;

    const sync = () => {
      const rect = staticC.getBoundingClientRect();
      overlay.width = rect.width * window.devicePixelRatio;
      overlay.height = rect.height * window.devicePixelRatio;
      const ctx = overlay.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(staticC);
    return () => ro.disconnect();
  }, []);

  // ── Live overlay draw: called DIRECTLY in onMouseMove (no state update!) ──
  const drawOverlayLivePath = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    // Clear entire overlay each frame
    ctx.clearRect(0, 0, overlay.width / window.devicePixelRatio, overlay.height / window.devicePixelRatio);

    const pts = currentPath.current;
    if (pts.length < 2) return;

    ctx.save();
    ctx.translate(viewport.pan.x, viewport.pan.y);
    ctx.scale(viewport.zoom, viewport.zoom);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      // Semi-transparent eraser cursor hint
      ctx.strokeStyle = "rgba(100,100,100,0.4)";
      ctx.lineWidth = strokeWidth;
      ctx.setLineDash([4, 4]);
      drawSmoothPath(ctx, pts);
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      drawSmoothPath(ctx, pts);
    }

    ctx.restore();
  }, [color, strokeWidth, tool, viewport]);

  // ── Live overlay draw: shape preview ─────────────────────────────────────
  const drawOverlayShapePreview = useCallback(
    (coords: Point) => {
      if (!startPos.current) return;
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width / window.devicePixelRatio, overlay.height / window.devicePixelRatio);
      ctx.save();
      ctx.translate(viewport.pan.x, viewport.pan.y);
      ctx.scale(viewport.zoom, viewport.zoom);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([6, 3]);

      if (tool === "rectangle") {
        const x = Math.min(startPos.current.x, coords.x);
        const y = Math.min(startPos.current.y, coords.y);
        const w = Math.abs(coords.x - startPos.current.x);
        const h = Math.abs(coords.y - startPos.current.y);
        ctx.strokeRect(x, y, w, h);
      } else if (tool === "circle") {
        const rx = coords.x - startPos.current.x;
        const ry = coords.y - startPos.current.y;
        const radius = Math.max(Math.abs(rx), Math.abs(ry));
        ctx.beginPath();
        ctx.arc(startPos.current.x, startPos.current.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.restore();
    },
    [color, strokeWidth, tool, viewport],
  );

  // ── Mouse events ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && tool === "hand")) {
        isPanning.current = true;
        panStart.current = {
          x: e.clientX - viewport.pan.x,
          y: e.clientY - viewport.pan.y,
        };
        return;
      }

      if (e.button !== 0) return;
      const coords = getCanvasCoords(e);

      if (tool === "pencil" || tool === "eraser") {
        isDrawing.current = true;
        currentPath.current = [{ x: coords.x, y: coords.y }];
      } else if (tool === "rectangle" || tool === "circle") {
        isDrawing.current = true;
        startPos.current = coords;
      } else if (tool === "text") {
        const newText = {
          id: Math.random().toString(36).substring(2, 10),
          type: "text" as const,
          x: coords.x,
          y: coords.y,
          text: "Double-click to edit",
          fontSize: 20,
          color,
          strokeWidth: 1,
          fill: "transparent",
        };
        const newElements = [...elements, newText];
        setElements(newElements);
        pushToHistory(newElements);
        setTool("select");
      } else if (tool === "sticky") {
        const newSticky = {
          id: Math.random().toString(36).substring(2, 10),
          type: "sticky" as const,
          x: coords.x,
          y: coords.y,
          width: 180,
          height: 140,
          text: "Type something...",
          bgColor: color === "#000000" ? "#FEF3C7" : color,
          color: "#000000",
          strokeWidth: 1,
        };
        const newElements = [...elements, newSticky];
        setElements(newElements);
        pushToHistory(newElements);
        setTool("select");
      } else if (tool === "select") {
        const hit = hitTest(coords);
        if (hit) {
          setSelectedElement(hit.id);
          isDrawing.current = true;
          startPos.current = { x: coords.x - hit.x, y: coords.y - hit.y };
        } else {
          setSelectedElement(null);
        }
      }
    },
    [tool, viewport, getCanvasCoords, color, elements, setElements,
      pushToHistory, setTool, hitTest, setSelectedElement],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current && panStart.current) {
        setViewport({
          pan: {
            x: e.clientX - panStart.current.x,
            y: e.clientY - panStart.current.y,
          },
        });
        return;
      }

      if (!isDrawing.current) return;
      const coords = getCanvasCoords(e);

      if (tool === "pencil" || tool === "eraser") {
        // ── KEY FIX: append point and draw DIRECTLY to overlay canvas ──
        currentPath.current = [...currentPath.current, { x: coords.x, y: coords.y }];
        drawOverlayLivePath();
      } else if (tool === "rectangle" || tool === "circle") {
        // Shape preview drawn directly on overlay (no setElements call!)
        drawOverlayShapePreview(coords);
      } else if (tool === "select" && selectedElementId && startPos.current) {
        const newEls = elements.map((el) =>
          el.id === selectedElementId
            ? { ...el, x: coords.x - startPos.current!.x, y: coords.y - startPos.current!.y }
            : el,
        );
        setElements(newEls);
      }
    },
    [tool, getCanvasCoords, drawOverlayLivePath, drawOverlayShapePreview,
      selectedElementId, elements, setElements, setViewport],
  );

  const onMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      if (isPanning.current) {
        isPanning.current = false;
        panStart.current = null;
        return;
      }

      if (!isDrawing.current) return;
      isDrawing.current = false;

      // Clear the overlay — committed element will now appear on static canvas
      clearOverlay();

      const coords = e ? getCanvasCoords(e) : null;

      if (tool === "pencil" && currentPath.current.length > 1) {
        const newEl = {
          id: Math.random().toString(36).substring(2, 10),
          type: "pencil" as const,
          x: currentPath.current[0].x,
          y: currentPath.current[0].y,
          path: [...currentPath.current],
          color,
          strokeWidth,
        };
        const newEls = [...elements.filter((el) => !el._preview), newEl];
        setElements(newEls);
        pushToHistory(newEls);
      } else if (tool === "eraser" && currentPath.current.length > 1) {
        const eraserPoints = currentPath.current;
        const newEls = elements.filter((el) => {
          if (el._preview) return true;
          if (el.type === "pencil") {
            return !el.path!.some((p) =>
              eraserPoints.some(
                (ep) => Math.sqrt((p.x - ep.x) ** 2 + (p.y - ep.y) ** 2) < Math.max(15, strokeWidth),
              ),
            );
          }
          return true;
        });
        setElements(newEls);
        pushToHistory(newEls);
      } else if (tool === "rectangle" && startPos.current && coords) {
        const x = Math.min(startPos.current.x, coords.x);
        const y = Math.min(startPos.current.y, coords.y);
        const w = Math.abs(coords.x - startPos.current.x);
        const h = Math.abs(coords.y - startPos.current.y);
        if (w > 3 && h > 3) {
          const newEl = {
            id: Math.random().toString(36).substring(2, 10),
            type: "rectangle" as const,
            x, y, width: w, height: h,
            color, strokeWidth,
          };
          const newEls = [...elements.filter((el) => !el._preview), newEl];
          setElements(newEls);
          pushToHistory(newEls);
        }
      } else if (tool === "circle" && startPos.current && coords) {
        const rx = coords.x - startPos.current.x;
        const ry = coords.y - startPos.current.y;
        const radius = Math.max(Math.abs(rx), Math.abs(ry));
        if (radius > 3) {
          const newEl = {
            id: Math.random().toString(36).substring(2, 10),
            type: "circle" as const,
            x: startPos.current.x - radius,
            y: startPos.current.y - radius,
            radius, color, strokeWidth,
          };
          const newEls = [...elements.filter((el) => !el._preview), newEl];
          setElements(newEls);
          pushToHistory(newEls);
        }
      } else if (tool === "select" && selectedElementId) {
        pushToHistory(elements);
      }

      currentPath.current = [];
      startPos.current = null;
    },
    [tool, color, strokeWidth, elements, setElements, pushToHistory,
      selectedElementId, clearOverlay, getCanvasCoords],
  );

  // ── Scroll-wheel zoom ─────────────────────────────────────────────────────
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = staticCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { zoom, pan } = viewport;
      const zoomFactor = e.ctrlKey ? 1 - e.deltaY * 0.01 : 1 - e.deltaY * 0.001;
      const newZoom = Math.min(5, Math.max(0.1, parseFloat((zoom * zoomFactor).toFixed(3))));

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const newPanX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
      const newPanY = cursorY - (cursorY - pan.y) * (newZoom / zoom);

      setViewport({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    },
    [viewport, setViewport],
  );

  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Double-click → edit text/sticky ───────────────────────────────────────
  const onDoubleClick = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const hit = hitTest(coords);
    if (hit && (hit.type === "text" || hit.type === "sticky")) {
      setEditingTextId(hit.id);
    }
  };

  // ── Cursor style ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (tool === "hand") setCursorStyle("grab");
    else if (tool === "pencil") setCursorStyle("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='4' cy='20' r='3' fill='%23333'/%3E%3C/svg%3E\") 4 20, crosshair");
    else if (tool === "eraser") setCursorStyle("cell");
    else setCursorStyle("default");
  }, [tool]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: cursorStyle, position: "relative" }}
    >
      {/* Bottom layer: committed elements */}
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block", touchAction: "none" }}
        onPointerDown={(e) => {
          // Capture pointer to receive events even outside canvas
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          // Delegate to mouse handler (React synthetic events are compatible)
          onMouseDown(e as unknown as React.MouseEvent);
        }}
        onPointerMove={(e) => onMouseMove(e as unknown as React.MouseEvent)}
        onPointerUp={(e) => {
          (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
          onMouseUp(e as unknown as React.MouseEvent);
        }}
        onPointerLeave={(e) => onMouseUp(e as unknown as React.MouseEvent)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Top layer: live preview — pointer-events:none so events pass through */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block", pointerEvents: "none", touchAction: "none" }}
      />
    </div>
  );
}
