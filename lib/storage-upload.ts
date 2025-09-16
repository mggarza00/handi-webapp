// lib/storage-upload.ts
import { uploadToBucket } from "@/lib/supabase-client";

// Reglas V1 (Documento Maestro): JPG/PNG/WebP, máx 5MB
export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_BYTES = 5 * 1024 * 1024;

// Límites por sección
export const MAX_REQUEST_IMAGES = 5; // solicitudes
export const MAX_GALLERY_IMAGES = 10; // galería profesional

function assertValidImage(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG o WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen excede 5MB. Comprime o reduce su tamaño.");
  }
}

/**
 * Sube fotos de una solicitud al bucket "requests".
 * Opcionalmente, agrega prefijo por requestId para organizar en carpetas.
 */
export async function uploadRequestPhotos(
  files: File[],
  opts?: { requestId?: string },
): Promise<string[]> {
  const toUpload = files.slice(0, MAX_REQUEST_IMAGES);
  const urls: string[] = [];

  for (const f of toUpload) {
    assertValidImage(f);
    const prefix = opts?.requestId ? `${opts.requestId}/` : "";
    const path = `${prefix}${Date.now()}-${(f as File).name || "upload"}`;
    const url = await uploadToBucket("requests", f, path);
    urls.push(url);
  }
  return urls;
}

/**
 * Sube fotos de la galería profesional al bucket "profiles-gallery".
 * Opcionalmente, agrega prefijo por userId para carpetas por usuario.
 */
export async function uploadProfileGallery(
  files: File[],
  opts?: { userId?: string },
): Promise<string[]> {
  const toUpload = files.slice(0, MAX_GALLERY_IMAGES);
  const urls: string[] = [];

  for (const f of toUpload) {
    assertValidImage(f);
    const prefix = opts?.userId ? `${opts.userId}/` : "";
    const path = `${prefix}${Date.now()}-${(f as File).name || "upload"}`;
    const url = await uploadToBucket("profiles-gallery", f, path);
    urls.push(url);
  }
  return urls;
}
