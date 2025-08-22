// Profiles
export interface Profile {
  id: string;
  full_name?: string;
  role: "client" | "pro";
  avatar_url?: string;
  headline?: string;
  bio?: string;
  years_experience?: number;
  rating?: number | null;
  is_featured: boolean;
  active: boolean;
  city?: string;
  cities: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string }[];
  last_active_at?: string;
  created_at: string;
}

// Requests
export interface Request {
  id: string;
  title: string;
  description?: string;
  city?: string;
  category?: string;
  subcategories: { id: string; name: string }[];
  budget?: number;
  required_at?: string;
  status: "active" | "in_process" | "completed" | "cancelled";
  attachments: { url: string; mime: string; size: number }[];
  created_by: string;
  created_at: string;
}

// Applications
export interface Application {
  id: string;
  request_id: string;
  professional_id: string;
  note?: string;
  status: "applied" | "accepted" | "rejected" | "completed";
  created_at: string;
  updated_at: string;
}

// Agreements
export interface Agreement {
  id: string;
  request_id: string;
  professional_id: string;
  amount?: number;
  status:
    | "negotiating"
    | "accepted"
    | "paid"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "disputed";
  created_at: string;
  updated_at: string;
}
