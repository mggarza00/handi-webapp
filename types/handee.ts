/**
 * Tipos Handee V1 — alineados al Documento Maestro Unificado.
 * Usar en UI y API para evitar `any`.
 */

export type UUID = string;          // formato uuid
export type ISODate = string;       // '2025-08-21'
export type ISODateTime = string;   // '2025-08-21T12:34:56Z'

export interface FileAttachment {
  url: string;
  mime: string;
  size: number; // bytes
}

export interface Profile {
  id: UUID;
  full_name: string | null;
  role: 'client' | 'pro' | 'admin';
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  years_experience: number | null;
  rating: number | null; // 0..5
  is_featured: boolean;
  active: boolean;
  city: string | null;
  cities: Array<{ id?: string; name: string }> | [];
  categories: Array<{ id?: string; name: string }> | [];
  subcategories: Array<{ id?: string; name: string }> | [];
  last_active_at: ISODateTime | null;
  created_at: ISODateTime;
}

export type RequestStatus = 'active' | 'in_process' | 'completed' | 'cancelled';
export interface RequestItem {
  id: UUID;
  title: string;
  description: string | null;
  city: string | null;
  category: string | null;
  subcategories: Array<{ id?: string; name: string }> | [];
  budget: number | null;
  required_at: ISODate | null;
  status: RequestStatus;
  attachments: FileAttachment[];
  created_by: UUID;
  created_at: ISODateTime;
}

export type ApplicationStatus = 'applied' | 'accepted' | 'rejected' | 'completed';
export interface Application {
  id: UUID;
  request_id: UUID;
  professional_id: UUID;
  note: string | null;
  status: ApplicationStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type AgreementStatus =
  | 'negotiating'
  | 'accepted'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface Agreement {
  id: UUID;
  request_id: UUID;
  professional_id: UUID;
  amount: number | null;
  status: AgreementStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiFail {
  ok: false;
  error: string;
  detail?: unknown;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFail;

/** Params para rutas App Router (server components / route handlers) */
export interface PageParams<T extends Record<string, string> = { id: string }> {
  params: T;
  searchParams?: Record<string, string | string[] | undefined>;
}
