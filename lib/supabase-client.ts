import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
if (!anon) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const supabaseClient = () => createClient(url, anon);

/**
 * Sube un archivo al bucket de Supabase y devuelve la URL pública
 * @param bucketName "requests" o "profiles-gallery"
 * @param file Archivo File o Blob
 * @param path Ruta opcional (default: timestamp + nombre original)
 */
export async function uploadToBucket(bucketName: "requests" | "profiles-gallery", file: File | Blob, path?: string) {
  const supabase = supabaseClient();

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
