import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Type,
  Eraser,
  Hand,
  StickyNote,
} from "lucide-react";

export const COLORS = [
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

export const STROKE_SIZES = [2, 4, 6, 10, 16];

export const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select (V)", shortcut: "v" },
  { id: "hand", icon: Hand, label: "Hand (H)", shortcut: "h" },
  { id: "pencil", icon: Pencil, label: "Pencil (P)", shortcut: "p" },
  { id: "rectangle", icon: Square, label: "Rectangle (R)", shortcut: "r" },
  { id: "circle", icon: Circle, label: "Circle (C)", shortcut: "c" },
  { id: "text", icon: Type, label: "Text (T)", shortcut: "t" },
  { id: "sticky", icon: StickyNote, label: "Sticky Note (S)", shortcut: "s" },
  { id: "eraser", icon: Eraser, label: "Eraser (E)", shortcut: "e" },
] as const;
