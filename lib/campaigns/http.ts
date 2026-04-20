import { NextResponse } from "next/server";

export function isJsonRequest(req: Request): boolean {
  const contentType = req.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

export async function readRequestPayload(
  req: Request,
): Promise<Record<string, unknown>> {
  if (isJsonRequest(req)) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return {};

  const payload: Record<string, unknown> = {};
  const grouped = new Map<string, FormDataEntryValue[]>();

  formData.forEach((value, key) => {
    const arr = grouped.get(key) || [];
    arr.push(value);
    grouped.set(key, arr);
  });

  grouped.forEach((values, key) => {
    payload[key] =
      values.length > 1
        ? values.map((value) => String(value))
        : String(values[0] ?? "");
  });

  return payload;
}

export function respondWithRedirectOrJson(args: {
  req: Request;
  payload: unknown;
  redirectTo?: string | null;
  status?: number;
}) {
  if (isJsonRequest(args.req)) {
    return NextResponse.json(args.payload, { status: args.status || 200 });
  }

  const redirectTo =
    args.redirectTo ||
    reqHeaderOrNull(args.req, "referer") ||
    "/admin/campaigns";

  return NextResponse.redirect(new URL(redirectTo, args.req.url), 303);
}

function reqHeaderOrNull(req: Request, key: string): string | null {
  const value = req.headers.get(key);
  return value && value.trim() ? value : null;
}
