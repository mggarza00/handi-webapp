import { z } from "zod";

// Subcategorías: aceptar strings o objetos {id?, name}
const SubcatObject = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
});
const SubcatInput = z.union([z.string().min(1).max(80), SubcatObject]);

const AttachmentUrl = z.object({
  url: z.string().url(),
  mime: z.string(),
  size: z.number().max(5_000_000),
});
const AttachmentPath = z.object({
  path: z.string().min(3),
  mime: z.string(),
  size: z.number().max(5_000_000),
});

export const RequestCreateSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000).optional(),
  city: z.string().min(2).max(80),
  category: z.string().min(2).max(80).optional(),
  subcategories: z
    .array(SubcatInput)
    .max(6)
    .default([])
    .transform((arr) =>
      arr.map((s) => (typeof s === "string" ? { name: s } : s)),
    ),
  // Aceptar string (serializado) o array de strings; normalización se hace en handler
  conditions: z
    .union([
      z.string().max(240),
      z.array(z.string().min(2).max(40)).max(10),
    ])
    .optional(),
  budget: z.number().positive().max(1_000_000).optional(),
  // Aceptar 'YYYY-MM-DD'; si viene ISO con tiempo, recortar antes de insertar
  required_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  attachments: z
    .array(z.union([AttachmentUrl, AttachmentPath]))
    .max(5)
    .optional(),
});

export type RequestCreateInput = z.infer<typeof RequestCreateSchema>;

// GET /api/requests query params
export const RequestListQuerySchema = z.object({
  mine: z
    .enum(["1", "true", "0", "false"]) // aceptamos 1/true/0/false
    .optional(),
  status: z.enum(["active", "in_process", "completed", "cancelled"]).optional(),
  city: z.string().min(2).max(80).optional(),
  category: z.string().min(2).max(80).optional(),
  // Paginación simple: limit/offset
  limit: z
    .preprocess(
      (v) => (typeof v === "string" ? Number(v) : v),
      z.number().int().min(1).max(100),
    )
    .optional()
    .default(20),
  offset: z
    .preprocess(
      (v) => (typeof v === "string" ? Number(v) : v),
      z.number().int().min(0).max(10_000),
    )
    .optional()
    .default(0),
  // Paginación con cursor (prioritario sobre offset si se envía)
  cursor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    .optional(),
  dir: z.enum(["next", "prev"]).optional().default("next"),
});

export type RequestListQuery = z.infer<typeof RequestListQuerySchema>;
