import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { BoardElement, CursorState } from "@/types";
import { addToast } from "@/components/ui/ToastContainer";

type Viewport = {
  zoom: number;
  pan: { x: number; y: number };
};

interface BoardState {
  // --- State ---
  elements: BoardElement[];
  tool: string;
  color: string;
  strokeWidth: number;
  showGrid: boolean;
  history: BoardElement[][];
  historyIndex: number;
  selectedElementId: string | null;
  editingTextId: string | null;
  remoteCursors: CursorState[];
  viewport: Viewport;
  showExport: boolean;

  // --- Actions ---
  setElements: (elements: BoardElement[], skipHistory?: boolean) => void;
  setTool: (tool: string) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setShowGrid: (show: boolean) => void;

  pushToHistory: (currentElements: BoardElement[]) => void;
  undo: () => void;
  redo: () => void;

  setSelectedElement: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;

  // Viewport actions
  setViewport: (viewport: Partial<Viewport>) => void;

  // Presence actions
  setRemoteCursors: (cursors: CursorState[]) => void;
  updateRemoteCursor: (id: string, x: number, y: number) => void;

  // Export actions
  setShowExport: (show: boolean) => void;

  // Canvas actions
  clearCanvas: () => void;
}

const mockCursors: CursorState[] = [
  { id: "c1", name: "Alice", color: "#3B82F6", x: 320, y: 280 },
  { id: "c2", name: "Bob", color: "#10B981", x: 580, y: 420 },
  { id: "c3", name: "Charlie", color: "#EF4444", x: 180, y: 500 },
];

const initialElements: BoardElement[] = [];

export const useBoardStore = create<BoardState>()(
  devtools((set, get) => ({
    // Initial State
    elements: initialElements,
    tool: "select",
    color: "#000000",
    strokeWidth: 3,
    showGrid: true,
    history: [initialElements],
    historyIndex: 0,
    selectedElementId: null,
    editingTextId: null,
    remoteCursors: mockCursors,
    viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    showExport: false,

    // Actions
    setElements: (elements, skipHistory = false) =>
      set(
        { elements },
        false,
        skipHistory ? "SET_ELEMENTS_SKIP_HISTORY" : "SET_ELEMENTS",
      ),

    setTool: (tool) => set({ tool }),
    setColor: (color) => set({ color }),
    setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
    setShowGrid: (showGrid) => set({ showGrid }),

    pushToHistory: (currentElements) => {
      const { history, historyIndex } = get();
      // Deep copy to prevent mutation issues
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(currentElements)));

      // Limit history size (50 steps)
      if (newHistory.length > 50) newHistory.shift();

      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex > 0) {
        set({
          historyIndex: historyIndex - 1,
          elements: JSON.parse(JSON.stringify(history[historyIndex - 1])),
        });
        addToast("Undo", "info");
      }
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex < history.length - 1) {
        set({
          historyIndex: historyIndex + 1,
          elements: JSON.parse(JSON.stringify(history[historyIndex + 1])),
        });
        addToast("Redo", "info");
      }
    },

    setSelectedElement: (id) => set({ selectedElementId: id }),
    setEditingTextId: (id) => set({ editingTextId: id }),

    setViewport: ({ zoom, pan }) =>
      set((state) => ({
        viewport: {
          zoom: zoom !== undefined ? zoom : state.viewport.zoom,
          pan: pan !== undefined ? pan : state.viewport.pan,
        },
      })),

    setRemoteCursors: (cursors) => set({ remoteCursors: cursors }),
    updateRemoteCursor: (id, x, y) =>
      set((state) => ({
        remoteCursors: state.remoteCursors.map((c) =>
          c.id === id ? { ...c, x, y } : c,
        ),
      })),

    setShowExport: (show) => set({ showExport: show }),

    clearCanvas: () => {
      get().pushToHistory([]);
      set({ elements: [], selectedElementId: null });
    },
  })),
);
