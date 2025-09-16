// Local fallback for environments without the optional heic2any dependency.
// PhotoUploader will catch errors from this stub and show a helpful message.
export default async function heic2any(): Promise<Blob> {
  throw new Error(
    "heic2any no instalado. Conversión HEIC no disponible en este entorno.",
  );
}
