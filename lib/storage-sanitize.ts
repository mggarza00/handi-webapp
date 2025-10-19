// lib/storage-sanitize.ts
/**
 * Devuelve la extensión del nombre (incluyendo el ".") o cadena vacía si no hay.
 * Ejemplos: "foto.png" -> ".png", ".env" -> "" (no consideramos nombres que empiezan con punto como extensión)
 */
export function getExtension(name: string): string {
  const base = baseName(name);
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === base.length - 1) return "";
  return base.slice(lastDot).toLowerCase();
}

/**
 * Normaliza un nombre de archivo preservando Unicode (acentos, espacios) y la extensión.
 * - Elimina rutas (solo mantiene el último segmento)
 * - Elimina caracteres de control y separadores peligrosos
 * - No usa encodeURIComponent
 * - Contrae espacios múltiples
 * - Asegura que no queda vacío; si está vacío, usa "archivo"
 */
export function sanitizeForStorageFilename(
  name: string,
  opts?: { allowUnicode?: boolean; maxLength?: number },
): string {
  const allowUnicode = opts?.allowUnicode !== false; // default true
  const maxLength = opts?.maxLength ?? 150;

  // Quitar cualquier ruta; quedarnos con el basename
  let base = baseName(name);

  // Normalizar Unicode para consistencia
  try {
    base = base.normalize("NFC");
  } catch {
    // ignore
  }

  // Separar extensión para preservarla
  const ext = getExtension(base);
  let stem = ext ? base.slice(0, base.length - ext.length) : base;

  // Eliminar caracteres de control y BOM
  stem = stem.replace(/[\u0000-\u001F\u007F]/g, "");

  // Quitar separadores y caracteres problemáticos para claves
  // Permitimos espacios, acentos y símbolos comunes. Removemos solo los peligrosos.
  // Peligrosos: barra, backslash, ?, %, #, *, ", <, >, |, :
  stem = stem.replace(/[\\/\?%#*"<>|:]/g, "");

  // Contraer espacios y recortar
  stem = stem.replace(/\s+/g, " ").trim();

  // Si no se permite Unicode, transliterar a ASCII y limitar el set
  if (!allowUnicode) {
    const ascii = removeDiacritics(stem)
      .replace(/[^A-Za-z0-9._\- ]+/g, "_")
      .replace(/\s+/g, "_");
    stem = ascii;
  }

  // Evitar nombre vacío
  if (!stem) stem = "archivo";

  // Reaplicar extensión asegurando que siga válida
  let out = stem + ext;

  // Longitud máxima (preservando extensión en la medida de lo posible)
  if (out.length > maxLength) {
    const keep = Math.max(1, maxLength - ext.length);
    out = stem.slice(0, keep) + ext;
  }

  // Evitar que empiece por punto (dotfile)
  if (out.startsWith(".")) out = "_" + out.slice(1);

  return out;
}

/**
 * Sanitiza SOLO el nombre base (sin path). Mantiene letras, números (ASCII), punto, guion y guion bajo.
 * Reemplaza todo lo demás por "_", colapsa "_" repetidos y recorta a maxLen.
 * No altera la extensión más allá de lo anterior (conserva los puntos).
 */
export function sanitizeBaseName(basename: string, maxLen = 100): string {
  let base = (basename || "");
  // Asegurar que no vengan separadores de ruta
  base = base.replace(/\\/g, "/");
  if (base.includes("/")) base = base.split("/").filter(Boolean).pop() || base;
  try { base = base.normalize("NFC"); } catch { /* ignore */ }

  // Extraer y sanitizar extensión por separado
  const rawExt = getExtension(base); // incluye '.' o vacío
  let ext = "";
  if (rawExt) {
    const coreExt = rawExt.slice(1); // quitar punto
    const cleanExt = coreExt.replace(/[^A-Za-z0-9]+/g, ""); // sólo alfanumérico
    if (cleanExt) ext = "." + cleanExt.toLowerCase();
  }

  // Quitar extensión del base para sanear el núcleo
  const core = ext ? base.slice(0, base.length - (rawExt || "").length) : base;

  // Reemplazar separadores o espacios por '-' o '_'
  let safeCore = core
    .replace(/\s+/g, "_") // espacios -> _
    .replace(/[\\/]+/g, "-"); // separadores -> '-'

  // Mantener sólo ASCII alfanumérico, punto, guion y guion bajo en el núcleo
  safeCore = safeCore.replace(/[^A-Za-z0-9._-]/g, "_");

  // Colapsar underscores repetidos
  safeCore = safeCore.replace(/_+/g, "_");

  // Recortar guiones/underscores al borde
  safeCore = safeCore.replace(/^[-_]+|[-_]+$/g, "");

  // Longitud (reservando espacio para la extensión)
  const keepCore = Math.max(1, maxLen - ext.length);
  let trimmedCore = safeCore.slice(0, keepCore);
  if (!trimmedCore) trimmedCore = "file"; // nunca vacío

  const finalName = trimmedCore;
  return ext ? `${finalName}${ext}` : finalName;
}

/**
 * Variante ultra-segura: translitera a ASCII, restringe al set [A-Za-z0-9._-],
 * contrae separadores y preserva extensión.
 */
export function ultraSafeFilename(name: string, opts?: { maxLength?: number }): string {
  const maxLength = opts?.maxLength ?? 120;
  const base = baseName(name);
  const ext = getExtension(base);
  const stemRaw = ext ? base.slice(0, base.length - ext.length) : base;
  let stem = removeDiacritics(stemRaw)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\\/\?%#*"<>|:]/g, "")
    .replace(/[^A-Za-z0-9._\- ]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .trim();
  if (!stem) stem = "file";
  let out = stem + ext;
  if (out.length > maxLength) {
    const keep = Math.max(1, maxLength - ext.length);
    out = stem.slice(0, keep) + ext;
  }
  if (out.startsWith(".")) out = "_" + out.slice(1);
  return out;
}

/**
 * Une segmentos de ruta en una key de Storage segura:
 * - Usa "/" como separador
 * - Elimina duplicados de "/" y segmentos relativos (".", "..")
 * - Quita slashes iniciales/finales
 */
export function joinStoragePath(...parts: Array<string | null | undefined>): string {
  const segs = parts
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/\\/g, "/"))
    .join("/");
  const norm = segs
    .replace(/\/+/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .join("/");
  return norm.replace(/^\/+/, "");
}

/**
 * Elimina un prefijo de bucket si vino incluido erróneamente: "bucket/..." -> "..."
 */
export function stripBucketPrefix(key: string, bucket: string): string {
  let k = key.replace(/^\/+/, "");
  const prefix = `${bucket}/`;
  if (k.startsWith(prefix)) k = k.slice(prefix.length);
  return k;
}

/**
 * Obtiene el nombre base (último segmento) de una ruta (tolerante a backslashes).
 */
export function baseName(path: string): string {
  const cleaned = (path || "").replace(/\\/g, "/");
  const parts = cleaned.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : cleaned;
}

/**
 * Construye una key segura de Storage con prefijo(s) + timestamp + nombre saneado.
 * Nunca antepone "/" ni incluye el nombre del bucket.
 *
 * Ejemplos:
 *  buildStorageKey("user123", "Foto baño final.png")
 *   -> "user123/1700000000000-Foto baño final.png" (si allowUnicode=true)
 *
 *  buildStorageKey(["conversation", cid, mid], "a/b:?.pdf", { allowUnicode: false })
 *   -> "conversation/<cid>/<mid>/1700000000000-a_b_.pdf"
 */
export function buildStorageKey(
  prefixes: string | string[],
  originalName: string,
  opts?: { allowUnicode?: boolean; maxNameLength?: number; timestamp?: number },
): string {
  const allowUnicode = opts?.allowUnicode ?? true;
  const maxNameLength = opts?.maxNameLength ?? 180;
  const ts = typeof opts?.timestamp === "number" ? opts!.timestamp : Date.now();

  const safeName = sanitizeForStorageFilename(originalName, {
    allowUnicode,
    maxLength: maxNameLength,
  });

  const prefSegs: string[] = Array.isArray(prefixes)
    ? prefixes.flatMap((p) => p.replace(/\\/g, "/").split("/").filter(Boolean))
    : (prefixes || "").replace(/\\/g, "/").split("/").filter(Boolean);

  const last = `${ts}-${safeName}`;
  return joinStoragePath(...prefSegs, last);
}

/**
 * Quita diacríticos (NFD) para transliteración simple a ASCII.
 */
function removeDiacritics(input: string): string {
  try {
    return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return input;
  }
}

/**
 * Devuelve "<timestamp>-<nombre-saneado>" para usar como segmento final de la key.
 */
export function buildTimestampedBasename(
  filename: string,
  now: number = Date.now(),
): string {
  const safe = sanitizeForStorageFilename(filename, { allowUnicode: true, maxLength: 180 });
  return `${now}-${safe}`;
}

/**
 * Versión ultra conservadora (fallback) por si un validador externo fuera aún más estricto.
 * - Prefijos: ASCII seguro en [a-z0-9._-], sin "/", sin "." ni "..", en minúsculas.
 * - Nombre: usa sanitizeBaseName, fuerza minúsculas, permite solo un punto (el de la extensión),
 *   colapsa "." adicionales a "_" en el núcleo, y limita longitud total.
 * - Resultado: "<prefijos...>/<now>-<nombre>" sin dobles slashes ni slash inicial.
 */
export function buildUltraSafeKey(
  prefixes: string,
  filename: string,
  now: number = Date.now(),
): string {
  // Limpiar prefijos a segmentos ASCII seguros en minúsculas
  const cleanPrefixes = String(prefixes)
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .map((seg) => {
      const ascii = removeDiacritics(seg).toLowerCase();
      return ascii
        .replace(/[^a-z0-9._-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^[-_]+|[-_]+$/g, "");
    })
    .filter(Boolean);

  // Nombre ultra-seguro: ASCII, minúsculas, un solo punto de extensión
  let safe = sanitizeBaseName(filename, 120).toLowerCase();
  const ext = getExtension(safe); // ext ya en minúsculas
  let core = ext ? safe.slice(0, safe.length - ext.length) : safe;
  // Reemplazar puntos repetidos en el núcleo por "_"
  core = core.replace(/\.+/g, "_").replace(/_+/g, "_").replace(/^[-_]+|[-_]+$/g, "");
  if (!core) core = "file";
  safe = ext ? `${core}${ext}` : core;

  // Construir key y aplicar defensa adicional de longitud máxima
  const key = joinStoragePath(...cleanPrefixes, `${now}-${safe}`);
  const trimmed = key.length > 1024 ? key.slice(0, 1024) : key;
  return trimmed;
}
