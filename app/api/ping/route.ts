export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "/api/ping" }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
