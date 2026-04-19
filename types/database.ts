// Auto-generated-style Database type for the whiteboard app schema.
// If you use Supabase CLI: `supabase gen types typescript` to regenerate.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      boards: {
        Row: {
          id: string;
          slug: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          updated_at?: string;
        };
      };
      elements: {
        Row: {
          id: string;
          board_id: string;
          type: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          board_id: string;
          type: string;
          data: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: string;
          data?: Json;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
