// lib/types.ts (opcional)
export type RequestRow = {
  id: string;               // uuid
  title: string;
  description?: string | null;
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  budget?: number | null;
  required_at?: string | null; // ISO
  status: "active" | "closed";
  created_by?: string | null;  // uuid
  created_at: string;          // ISO
};
