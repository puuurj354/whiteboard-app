"use client";

import { useRef, useEffect, useCallback } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import type { Point } from "@/types";
import { addToast } from "@/components/ui/ToastContainer";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get state & actions from Zustand
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

  // Local state for drawing
  const isDrawing = useRef(false);
  const currentPath = useRef<Point[]>([]);
  const startPos = useRef<Point | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<Point | null>(null);

  // --- KEYBOARD SHORTCUTS LOGIC ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Jangan ubah tool jika sedang mengetik di Text Editor
      if (editingTextId) return;

      // Ctrl/Cmd + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Ctrl/Cmd + S (Export)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        setShowExport(true);
        return;
      }

      // Shortcut Tool Switching
      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "h":
          setTool("hand");
          break;
        case "p":
          setTool("pencil");
          break;
        case "r":
          setTool("rectangle");
          break;
        case "c":
          setTool("circle");
          break;
        case "t":
          setTool("text");
          break;
        case "s":
          setTool("sticky");
          break;
        case "e":
          setTool("eraser");
          break;
        case "g":
          setShowGrid(!showGrid);
          break;
        case "escape":
          setSelectedElement(null);
          break;
        case "delete":
        case "backspace":
          if (selectedElementId) {
            // Logic delete bisa dipindah ke hook, tapi untuk test ini kita biarkan di sini dulu
            const newEls = elements.filter((el) => el.id !== selectedElementId);
            setElements(newEls);
            pushToHistory(newEls);
            setSelectedElement(null);
            addToast("Element deleted", "info");
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editingTextId,
    selectedElementId,
    elements,
    setTool,
    undo,
    redo,
    setElements,
    pushToHistory,
    setSelectedElement,
    showGrid,
    setShowGrid,
    setShowExport,
  ]);
  // --------------------------------

  // Helper: Get canvas coordinates with zoom & pan
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      return {
        x: (e.clientX - rect.left - viewport.pan.x) / viewport.zoom,
        y: (e.clientY - rect.top - viewport.pan.y) / viewport.zoom,
      };
    },
    [viewport.pan, viewport.zoom],
  );

  // Hit test for selection
  const hitTest = useCallback(
    (coords: Point) => {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === "pencil" && el.path) {
          if (el.path.length === 0) continue;
          for (let j = 0; j < el.path.length; j++) {
            const dx = el.path[j].x - coords.x;
            const dy = el.path[j].y - coords.y;
            if (Math.sqrt(dx * dx + dy * dy) < 10) return el;
          }
        } else if (el.type === "rectangle") {
          if (
            coords.x >= el.x &&
            coords.x <= el.x + (el.width || 0) &&
            coords.y >= el.y &&
            coords.y <= el.y + (el.height || 0)
          )
            return el;
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
          )
            return el;
        }
      }
      return null;
    },
    [elements],
  );

  // Mouse Event Handlers
  const onMouseDown = (e: React.MouseEvent) => {
    // Middle click or hand tool = panning
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
        color: color,
        strokeWidth: 1,
        fill: "transparent",
      };
      const newElements = [...elements, newText];
      setElements(newElements);
      pushToHistory(newElements);
      setTool("select"); // Switch back to select after creating
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
      setTool("select"); // Switch back to select after creating
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
  };

  const onMouseMove = (e: React.MouseEvent) => {
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
      currentPath.current = [
        ...currentPath.current,
        { x: coords.x, y: coords.y },
      ];
    } else if (tool === "rectangle" && startPos.current) {
      const preview = elements.filter((el) => !el._preview);
      const w = coords.x - startPos.current.x;
      const h = coords.y - startPos.current.y;
      const previewEl = {
        id: "_preview_rect",
        type: "rectangle" as const,
        x: Math.min(startPos.current.x, coords.x),
        y: Math.min(startPos.current.y, coords.y),
        width: Math.abs(w),
        height: Math.abs(h),
        color: color,
        strokeWidth: strokeWidth,
        _preview: true,
      };
      setElements([...preview, previewEl]);
    } else if (tool === "circle" && startPos.current) {
      const preview = elements.filter((el) => !el._preview);
      const rx = coords.x - startPos.current.x;
      const ry = coords.y - startPos.current.y;
      const radius = Math.max(Math.abs(rx), Math.abs(ry));
      const previewEl = {
        id: "_preview_circle",
        type: "circle" as const,
        x: startPos.current.x - radius,
        y: startPos.current.y - radius,
        radius: radius,
        color: color,
        strokeWidth: strokeWidth,
        _preview: true,
      };
      setElements([...preview, previewEl]);
    } else if (tool === "select" && selectedElementId && startPos.current) {
      const newEls = elements.map((el) => {
        if (el.id === selectedElementId) {
          return {
            ...el,
            x: coords.x - startPos.current!.x,
            y: coords.y - startPos.current!.y,
          };
        }
        return el;
      });
      setElements(newEls);
    }
  };

  const onMouseUp = () => {
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === "pencil" && currentPath.current.length > 1) {
      const newEl = {
        id: Math.random().toString(36).substring(2, 10),
        type: "pencil" as const,
        x: currentPath.current[0].x,
        y: currentPath.current[0].y,
        path: [...currentPath.current],
        color: color,
        strokeWidth: strokeWidth,
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
              (ep) => Math.sqrt((p.x - ep.x) ** 2 + (p.y - ep.y) ** 2) < 15,
            ),
          );
        }
        return true;
      });
      setElements(newEls);
      pushToHistory(newEls);
    } else if (tool === "rectangle" && startPos.current) {
      const current = elements.find((el) => el.id === "_preview_rect");
      if (current) {
        const clean = {
          ...current,
          id: Math.random().toString(36).substring(2, 10),
          _preview: undefined,
        };
        if (clean.width! > 3 && clean.height! > 3) {
          const newEls = [...elements.filter((el) => !el._preview), clean];
          setElements(newEls);
          pushToHistory(newEls);
        } else {
          setElements(elements.filter((el) => !el._preview));
        }
      }
    } else if (tool === "circle" && startPos.current) {
      const current = elements.find((el) => el.id === "_preview_circle");
      if (current) {
        const clean = {
          ...current,
          id: Math.random().toString(36).substring(2, 10),
          _preview: undefined,
        };
        if (clean.radius! > 3) {
          const newEls = [...elements.filter((el) => !el._preview), clean];
          setElements(newEls);
          pushToHistory(newEls);
        } else {
          setElements(elements.filter((el) => !el._preview));
        }
      }
    } else if (tool === "select" && selectedElementId) {
      pushToHistory(elements);
    }

    currentPath.current = [];
    startPos.current = null;
  };

  // Scroll wheel zoom (zooms towards cursor position)
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { zoom, pan } = viewport;

      // Pinch-to-zoom via trackpad sends small deltaY; mouse wheel sends larger values
      const zoomFactor = e.ctrlKey
        ? 1 - e.deltaY * 0.01 // pinch gesture (ctrlKey = true on trackpad pinch)
        : 1 - e.deltaY * 0.001; // scroll wheel

      const newZoom = Math.min(
        5,
        Math.max(0.1, parseFloat((zoom * zoomFactor).toFixed(3))),
      );

      // Zoom towards the cursor position
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const newPanX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
      const newPanY = cursorY - (cursorY - pan.y) * (newZoom / zoom);

      setViewport({ zoom: newZoom, pan: { x: newPanX, y: newPanY } });
    },
    [viewport, setViewport],
  );

  // Attach wheel listener as non-passive so preventDefault() works
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Double-click to edit text / sticky elements
  const onDoubleClick = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const hit = hitTest(coords);
    if (hit && (hit.type === "text" || hit.type === "sticky")) {
      setEditingTextId(hit.id);
    }
  };

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
          ctx.arc(
            el.x + el.radius!,
            el.y + el.radius!,
            el.radius!,
            0,
            Math.PI * 2,
          );
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
    [],
  );

  // Canvas rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid (conditional)
    if (showGrid) {
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 0.5;
      const gridSize = 24;
      const offsetX =
        (viewport.pan.x % (gridSize * viewport.zoom)) / viewport.zoom;
      const offsetY =
        (viewport.pan.y % (gridSize * viewport.zoom)) / viewport.zoom;

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

    // Apply transform
    ctx.save();
    ctx.translate(viewport.pan.x, viewport.pan.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw elements
    drawElements(ctx, elements);
    ctx.restore();

    // Draw current path (preview)
    if (currentPath.current.length > 1) {
      ctx.save();
      ctx.translate(viewport.pan.x, viewport.pan.y);
      ctx.scale(viewport.zoom, viewport.zoom);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
      }

      ctx.beginPath();
      ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
      for (let i = 1; i < currentPath.current.length; i++) {
        const prev = currentPath.current[i - 1];
        const curr = currentPath.current[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [elements, viewport, color, strokeWidth, tool, showGrid, drawElements]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{
        cursor:
          tool === "hand"
            ? "grab"
            : tool === "pencil" || tool === "eraser"
              ? "crosshair"
              : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
