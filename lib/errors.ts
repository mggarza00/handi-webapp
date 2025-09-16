/**
 * Utilidades de error tipadas para API y UI.
 * Evita `any` y unifica forma de respuesta.
 */

export class HttpError extends Error {
  status: number;
  detail?: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.detail = detail;
  }
}

export function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(typeof e === "string" ? e : JSON.stringify(e));
  } catch {
    return new Error("Unknown error");
  }
}

/** Retrocompat: devuelve mensaje legible desde unknown */
export function getErrorMessage(e: unknown): string {
  const err = toError(e);
  return err.message || "Unknown error";
}

/** Lanza HttpError con status y mensaje. */
export function httpError(
  status: number,
  message: string,
  detail?: unknown,
): never {
  throw new HttpError(status, message, detail);
}

/** Asegura que no haya casos no manejados en switches exhaustivos. */
export function assertNever(x: never, msg = "Unexpected variant"): never {
  throw new Error(`${msg}: ${String(x)}`);
}

/** Respuesta JSON estándar { ok, ... } */
export function jsonOk<T>(data: T) {
  return Response.json({ ok: true, data }, { status: 200 });
}

export function jsonFail(message: string, status = 400, detail?: unknown) {
  return Response.json({ ok: false, error: message, detail }, { status });
}

/** Intenta parsear JSON del body preservando UTF-8. */
export async function readJson<T>(req: Request): Promise<T> {
  const text = await req.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    httpError(400, "Invalid JSON body", {
      parseError: toError(e).message,
      text,
    });
  }
}

/** Envuelve un handler y traduce HttpError/errores a respuestas JSON. */
export async function runHandler<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return jsonOk(data);
  } catch (e) {
    const err = toError(e);
    if (e instanceof HttpError) {
      return jsonFail(e.message, e.status, e.detail);
    }
    return jsonFail(err.message || "Unexpected failure", 500);
  }
}
