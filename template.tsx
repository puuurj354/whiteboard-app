import { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Type,
  Eraser,
  Download,
  Undo2,
  Redo2,
  Grid3X3,
  Minus,
  Plus,
  Copy,
  Trash2,
  Hand,
  ChevronDown,
  Users,
  Settings2,
  Image as ImageIcon,
  StickyNote,
  PanelLeftClose,
  PanelLeftOpen,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

const STROKE_SIZES = [2, 4, 6, 10, 16];

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "hand", icon: Hand, label: "Hand (H)" },
  { id: "pencil", icon: Pencil, label: "Pencil (P)" },
  { id: "rectangle", icon: Square, label: "Rectangle (R)" },
  { id: "circle", icon: Circle, label: "Circle (C)" },
  { id: "text", icon: Type, label: "Text (T)" },
  { id: "sticky", icon: StickyNote, label: "Sticky Note (S)" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)" },
];

const generateId = () => Math.random().toString(36).substring(2, 10);

const randomRemoteCursors = [
  {
    id: "c1",
    name: "Alice",
    color: "#3B82F6",
    x: 320,
    y: 280,
    cursor: { x: 320, y: 280 },
  },
  {
    id: "c2",
    name: "Bob",
    color: "#10B981",
    x: 580,
    y: 420,
    cursor: { x: 580, y: 420 },
  },
  {
    id: "c3",
    name: "Charlie",
    color: "#EF4444",
    x: 180,
    y: 500,
    cursor: { x: 180, y: 500 },
  },
];

export default function App() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [elements, setElements] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [startPos, setStartPos] = useState(null);
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState(randomRemoteCursors);
  const [editingTextId, setEditingTextId] = useState(null);
  const [textEditValue, setTextEditValue] = useState("");
  const [toasts, setToasts] = useState([]);
  const [showPresencePanel, setShowPresencePanel] = useState(false);

  const getCanvasCoords = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - panOffset.x) / zoom,
        y: (e.clientY - rect.top - panOffset.y) / zoom,
      };
    },
    [panOffset, zoom],
  );

  const addToast = useCallback((message, type = "info") => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const pushToHistory = useCallback(
    (newElements) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newElements)));
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      addToast("Undo", "info");
    }
  }, [history, historyIndex, addToast]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      addToast("Redo", "info");
    }
  }, [history, historyIndex, addToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (editingTextId) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === "s") {
          e.preventDefault();
          exportCanvas();
        } else if (e.key === "c" && selectedElement) {
          e.preventDefault();
        }
        return;
      }
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
        case "delete":
        case "backspace":
          if (selectedElement) {
            const newEls = elements.filter((el) => el.id !== selectedElement);
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
    selectedElement,
    elements,
    undo,
    redo,
    addToast,
    pushToHistory,
  ]);

  const onMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && tool === "hand")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }
    if (e.button !== 0) return;

    const coords = getCanvasCoords(e);

    if (tool === "pencil" || tool === "eraser") {
      setIsDrawing(true);
      setCurrentPath([{ x: coords.x, y: coords.y }]);
    } else if (tool === "rectangle" || tool === "circle") {
      setIsDrawing(true);
      setStartPos(coords);
    } else if (tool === "text") {
      const newText = {
        id: generateId(),
        type: "text",
        x: coords.x,
        y: coords.y,
        text: "Double-click to edit",
        fontSize: 20,
        color: color,
        fill: "transparent",
      };
      const newElements = [...elements, newText];
      setElements(newElements);
      pushToHistory(newElements);
      setTool("select");
    } else if (tool === "sticky") {
      const newSticky = {
        id: generateId(),
        type: "sticky",
        x: coords.x,
        y: coords.y,
        width: 180,
        height: 140,
        text: "Type something...",
        bgColor: color === "#000000" ? "#FEF3C7" : color,
        color: "#000000",
      };
      const newElements = [...elements, newSticky];
      setElements(newElements);
      pushToHistory(newElements);
      setTool("select");
    } else if (tool === "select") {
      const hit = hitTest(coords);
      if (hit) {
        setSelectedElement(hit.id);
        setIsDrawing(true);
        setStartPos({ x: coords.x - hit.x, y: coords.y - hit.y });
      } else {
        setSelectedElement(null);
      }
    }
  };

  const hitTest = (coords) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === "pencil") {
        if (el.path.length === 0) continue;
        for (let j = 0; j < el.path.length; j++) {
          const dx = el.path[j].x - coords.x;
          const dy = el.path[j].y - coords.y;
          if (Math.sqrt(dx * dx + dy * dy) < 10) return el;
        }
      } else if (el.type === "rectangle") {
        if (
          coords.x >= el.x &&
          coords.x <= el.x + el.width &&
          coords.y >= el.y &&
          coords.y <= el.y + el.height
        )
          return el;
      } else if (el.type === "circle") {
        const cx = el.x + el.radius;
        const cy = el.y + el.radius;
        const dist = Math.sqrt((coords.x - cx) ** 2 + (coords.y - cy) ** 2);
        if (dist <= el.radius) return el;
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
  };

  const onMouseMove = (e) => {
    if (isPanning && panStart) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing) return;

    const coords = getCanvasCoords(e);

    if (tool === "pencil" || tool === "eraser") {
      setCurrentPath((prev) => [...prev, { x: coords.x, y: coords.y }]);
    } else if (tool === "rectangle" && startPos) {
      const preview = elements.filter((el) => !el._preview);
      const w = coords.x - startPos.x;
      const h = coords.y - startPos.y;
      const previewEl = {
        id: "_preview_rect",
        type: "rectangle",
        x: Math.min(startPos.x, coords.x),
        y: Math.min(startPos.y, coords.y),
        width: Math.abs(w),
        height: Math.abs(h),
        stroke: color,
        strokeWidth: strokeWidth,
        _preview: true,
      };
      setElements([...preview, previewEl]);
    } else if (tool === "circle" && startPos) {
      const preview = elements.filter((el) => !el._preview);
      const rx = coords.x - startPos.x;
      const ry = coords.y - startPos.y;
      const radius = Math.max(Math.abs(rx), Math.abs(ry));
      const previewEl = {
        id: "_preview_circle",
        type: "circle",
        x: startPos.x - radius,
        y: startPos.y - radius,
        radius: radius,
        stroke: color,
        strokeWidth: strokeWidth,
        _preview: true,
      };
      setElements([...preview, previewEl]);
    } else if (tool === "select" && selectedElement && startPos) {
      const newEls = elements.map((el) => {
        if (el.id === selectedElement) {
          return { ...el, x: coords.x - startPos.x, y: coords.y - startPos.y };
        }
        return el;
      });
      setElements(newEls);
    }
  };

  const onMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "pencil" && currentPath.length > 1) {
      const newEl = {
        id: generateId(),
        type: "pencil",
        path: [...currentPath],
        color: color,
        strokeWidth: strokeWidth,
      };
      const newEls = [...elements.filter((el) => !el._preview), newEl];
      setElements(newEls);
      pushToHistory(newEls);
    } else if (tool === "eraser" && currentPath.length > 1) {
      const eraserPoints = currentPath;
      const newEls = elements.filter((el) => {
        if (el._preview) return true;
        if (el.type === "pencil") {
          return !el.path.some((p) =>
            eraserPoints.some(
              (ep) => Math.sqrt((p.x - ep.x) ** 2 + (p.y - ep.y) ** 2) < 15,
            ),
          );
        }
        return true;
      });
      setElements(newEls);
      pushToHistory(newEls);
    } else if (tool === "rectangle" && startPos) {
      const current = elements.find((el) => el.id === "_preview_rect");
      if (current) {
        const clean = { ...current, id: generateId(), _preview: undefined };
        if (clean.width > 3 && clean.height > 3) {
          const newEls = [...elements.filter((el) => !el._preview), clean];
          setElements(newEls);
          pushToHistory(newEls);
        } else {
          setElements(elements.filter((el) => !el._preview));
        }
      }
    } else if (tool === "circle" && startPos) {
      const current = elements.find((el) => el.id === "_preview_circle");
      if (current) {
        const clean = { ...current, id: generateId(), _preview: undefined };
        if (clean.radius > 3) {
          const newEls = [...elements.filter((el) => !el._preview), clean];
          setElements(newEls);
          pushToHistory(newEls);
        } else {
          setElements(elements.filter((el) => !el._preview));
        }
      }
    } else if (tool === "select" && selectedElement) {
      pushToHistory(elements);
    }

    setCurrentPath([]);
    setStartPos(null);
  };

  const exportCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, 1920, 1080);
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
        addToast("Canvas exported as PNG", "success");
      }
    });
    setShowExport(false);
  };

  const drawElements = (ctx, els) => {
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
        ctx.rect(el.x, el.y, el.width, el.height);
        if (el.fill && el.fill !== "transparent") {
          ctx.fillStyle = el.fill;
          ctx.fill();
        }
        ctx.stroke();
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc(el.x + el.radius, el.y + el.radius, el.radius, 0, Math.PI * 2);
        if (el.fill && el.fill !== "transparent") {
          ctx.fillStyle = el.fill;
          ctx.fill();
        }
        ctx.stroke();
      } else if (el.type === "text") {
        ctx.font = `${el.fontSize || 20}px Inter, sans-serif`;
        ctx.fillStyle = el.color || "#000";
        ctx.fillText(el.text, el.x, el.y);
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
        ctx.fillText(el.text, el.x + 12, el.y + 24);
      }
    });
  };

  const roundRect = (ctx, x, y, w, h, r) => {
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (showGrid) {
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 0.5;
      const gridSize = 24;
      const offsetX = (panOffset.x % (gridSize * zoom)) / zoom;
      const offsetY = (panOffset.y % (gridSize * zoom)) / zoom;
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

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);
    drawElements(ctx, elements);
    ctx.restore();

    if (currentPath.length > 1) {
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
      }
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        const prev = currentPath[i - 1];
        const curr = currentPath[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [
    elements,
    currentPath,
    zoom,
    panOffset,
    showGrid,
    color,
    strokeWidth,
    tool,
    window,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors((prev) =>
        prev.map((c) => ({
          ...c,
          cursor: {
            x: c.cursor.x + (Math.random() - 0.5) * 40,
            y: c.cursor.y + (Math.random() - 0.5) * 40,
          },
        })),
      );
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleDoubleClickText = (el) => {
    if (el.type === "text" || el.type === "sticky") {
      setEditingTextId(el.id);
      setTextEditValue(el.text);
    }
  };

  const finishTextEdit = () => {
    if (editingTextId) {
      const newEls = elements.map((el) => {
        if (el.id === editingTextId) {
          return { ...el, text: textEditValue };
        }
        return el;
      });
      setElements(newEls);
      pushToHistory(newEls);
      setEditingTextId(null);
      setTextEditValue("");
    }
  };

  const deleteSelected = () => {
    if (selectedElement) {
      const newEls = elements.filter((el) => el.id !== selectedElement);
      setElements(newEls);
      pushToHistory(newEls);
      setSelectedElement(null);
      addToast("Element deleted", "info");
    }
  };

  const clearCanvas = () => {
    if (window.confirm("Clear the entire canvas?")) {
      setElements([]);
      pushToHistory([]);
      setSelectedElement(null);
      addToast("Canvas cleared", "info");
    }
  };

  return (
    <div
      className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top Bar */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">
              Untitled Board
            </h1>
            <p className="text-[10px] text-gray-400">
              board/untitled • Auto-saved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-md transition-all ${showGrid ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
              title="Toggle Grid"
            >
              <Grid3X3 size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-all"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-all"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={14} />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-all"
          >
            <Download size={13} />
            Export
          </button>

          <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all">
            <Users size={15} />
          </button>

          <div className="flex -space-x-2 ml-2">
            {remoteCursors.map((c) => (
              <div
                key={c.id}
                className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: c.color }}
                title={c.name}
              >
                {c.name[0]}
              </div>
            ))}
            <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600">
              +2
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 56, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0 z-20 overflow-hidden"
            >
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

              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:bg-gray-100 group"
                title="Color"
              >
                <div
                  className="w-5 h-5 rounded-md border border-gray-300"
                  style={{ backgroundColor: color }}
                />
              </button>

              <AnimatePresence>
                {showColorPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-14 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-50"
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

              <button
                onClick={() => setSidebarOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                title="Hide sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-16 left-3 z-30 bg-white border border-gray-200 rounded-lg p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm transition-all"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            cursor:
              tool === "hand" || isPanning
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
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Text Editing Overlay */}
          {editingTextId && (
            <div
              className="absolute z-40"
              style={{
                left:
                  (elements.find((el) => el.id === editingTextId)?.x || 0) *
                    zoom +
                  panOffset.x,
                top:
                  (elements.find((el) => el.id === editingTextId)?.y || 0) *
                    zoom +
                  panOffset.y,
              }}
            >
              <input
                autoFocus
                value={textEditValue}
                onChange={(e) => setTextEditValue(e.target.value)}
                onBlur={finishTextEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) finishTextEdit();
                  if (e.key === "Escape") {
                    setEditingTextId(null);
                    setTextEditValue("");
                  }
                }}
                className="border-2 border-violet-400 rounded px-1 py-0.5 outline-none bg-white/90 text-sm"
                style={{
                  fontSize:
                    (elements.find((el) => el.id === editingTextId)?.fontSize ||
                      20) * zoom,
                  color:
                    elements.find((el) => el.id === editingTextId)?.color ||
                    "#000",
                }}
              />
            </div>
          )}

          {/* Selection indicator */}
          {selectedElement && tool === "select" && (
            <div
              className="absolute border-2 border-violet-500 pointer-events-none z-20 rounded-sm"
              style={{
                left:
                  ((elements.find((el) => el.id === selectedElement)?.x || 0) -
                    4) *
                    zoom +
                  panOffset.x,
                top:
                  ((elements.find((el) => el.id === selectedElement)?.y || 0) -
                    4) *
                    zoom +
                  panOffset.y,
                width:
                  ((elements.find((el) => el.id === selectedElement)?.width ||
                    elements.find((el) => el.id === selectedElement)?.radius *
                      2 ||
                    100) +
                    8) *
                  zoom,
                height:
                  ((elements.find((el) => el.id === selectedElement)?.height ||
                    elements.find((el) => el.id === selectedElement)?.radius *
                      2 ||
                    40) +
                    8) *
                  zoom,
              }}
            >
              <div
                className="absolute -top-2 -left-2 w-3 h-3 bg-violet-500 rounded-full"
                style={{ transform: "translate(-50%, -50%)" }}
              />
              <div
                className="absolute -top-2 -right-2 w-3 h-3 bg-violet-500 rounded-full"
                style={{ transform: "translate(50%, -50%)" }}
              />
              <div
                className="absolute -bottom-2 -left-2 w-3 h-3 bg-violet-500 rounded-full"
                style={{ transform: "translate(-50%, 50%)" }}
              />
              <div
                className="absolute -bottom-2 -right-2 w-3 h-3 bg-violet-500 rounded-full"
                style={{ transform: "translate(50%, 50%)" }}
              />
            </div>
          )}

          {/* Remote Cursors */}
          {remoteCursors.map((c) => (
            <motion.div
              key={c.id}
              className="absolute pointer-events-none z-20"
              animate={{
                left: c.cursor.x * zoom + panOffset.x,
                top: c.cursor.y * zoom + panOffset.y,
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

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex items-center gap-1 z-20">
            <button
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
            >
              <Minus size={14} />
            </button>
            <span className="text-xs font-medium text-gray-700 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(5, z + 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
              title="Reset view"
            >
              <Maximize size={14} />
            </button>
          </div>

          {/* Element Count */}
          <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-[11px] text-gray-500 z-20">
            {elements.length} element{elements.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Floating Action Bar (when element selected) */}
      <AnimatePresence>
        {selectedElement && tool === "select" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-1 z-30"
          >
            <button
              onClick={() => {
                const el = elements.find((e) => e.id === selectedElement);
                if (el) {
                  const copy = {
                    ...el,
                    id: generateId(),
                    x: el.x + 20,
                    y: el.y + 20,
                  };
                  const newEls = [...elements, copy];
                  setElements(newEls);
                  pushToHistory(newEls);
                  setSelectedElement(copy.id);
                }
              }}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
              title="Duplicate"
            >
              <Copy size={15} />
            </button>
            <div className="w-px h-5 bg-gray-200" />
            <button
              onClick={deleteSelected}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowExport(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-80"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                Export Canvas
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Choose your export format
              </p>

              <div className="space-y-2 mb-4">
                <button
                  onClick={exportCanvas}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
                >
                  <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600">
                    <ImageIcon size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800">
                      PNG Image
                    </p>
                    <p className="text-xs text-gray-500">
                      High quality, 1920×1080
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    addToast("JSON export coming soon", "info");
                    setShowExport(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all opacity-60"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <Settings2 size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800">
                      JSON Data
                    </p>
                    <p className="text-xs text-gray-500">Coming soon</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowExport(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`px-4 py-2 rounded-xl shadow-lg text-sm font-medium ${
                toast.type === "success"
                  ? "bg-green-500 text-white"
                  : toast.type === "error"
                    ? "bg-red-500 text-white"
                    : "bg-gray-800 text-white"
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Presence Panel */}
      <AnimatePresence>
        {showPresencePanel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-14 right-4 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-30 w-64"
          >
            <h3 className="text-sm font-bold text-gray-800 mb-3">
              Active Users
            </h3>
            <div className="space-y-2">
              {remoteCursors.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">
                      {c.name}
                    </p>
                    <p className="text-[10px] text-green-500">● Active now</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">
                4 collaborators viewing
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
