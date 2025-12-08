import { supabase } from "@/lib/supabaseClient";

/**
 * Sube un archivo al bucket de Supabase y devuelve la URL pública
 * @param bucketName "requests" o "profiles-gallery"
 * @param file Archivo File o Blob
 * @param path Ruta opcional (default: timestamp + nombre original)
 */
export async function uploadToBucket(
  bucketName: "requests" | "profiles-gallery",
  file: File | Blob,
  path?: string,
) {
  const filePath = path || `${Date.now()}-${(file as File).name || "upload"}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
}
