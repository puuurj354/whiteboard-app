export type Point = {
  x: number;
  y: number;
};

export type ElementType =
  | "pencil"
  | "rectangle"
  | "circle"
  | "text"
  | "sticky"
  | "eraser";

export interface BoardElement {
  id: string;
  type: ElementType;

  // Common properties
  x: number;
  y: number;
  color: string;
  strokeWidth: number;

  // Specific properties (Optional based on type)
  path?: Point[]; // For pencil
  width?: number; // For rectangle/text
  height?: number; // For rectangle/text
  radius?: number; // For circle
  text?: string; // For text/sticky
  bgColor?: string; // For sticky note
  fontSize?: number; // For text
  fill?: string; // For shapes
  stroke?: string; // For shapes

  // System properties
  version?: number; // For Supabase conflict resolution
  _preview?: boolean; // For local UI preview (don't save to DB)
}

export interface CursorState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}
