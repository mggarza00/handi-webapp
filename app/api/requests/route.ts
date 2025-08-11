// app/api/requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Carga credenciales desde env (Vercel y local)
function getAuth() {
  const clientEmail = process.env.CLIENT_EMAIL;
  const privateKey = (process.env.PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const projectId = process.env.PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error("Faltan variables de entorno: PROJECT_ID, CLIENT_EMAIL o PRIVATE_KEY");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

const SHEET_ID = process.env.SHEET_ID!;
const TAB = "Requests";

type RequestRow = {
  id: string;
  createdAt: string; // ISO
  name: string;
  phone: string;
  category: string;
  subcategory: string;
  description: string;
  city: string;
  status: string;
};

// Mapea filas de Sheets a objetos
function rowsToObjects(rows: any[][]): RequestRow[] {
  const [header, ...data] = rows;
  const idx: Record<string, number> = {};
  header.forEach((h, i) => (idx[String(h).trim()] = i));

  return data
    .filter((r) => r && r.length > 0)
    .map((r) => ({
      id: r[idx["id"]] ?? "",
      createdAt: r[idx["createdAt"]] ?? "",
      name: r[idx["name"]] ?? "",
      phone: r[idx["phone"]] ?? "",
      category: r[idx["category"]] ?? "",
      subcategory: r[idx["subcategory"]] ?? "",
      description: r[idx["description"]] ?? "",
      city: r[idx["city"]] ?? "",
      status: r[idx["status"]] ?? "",
    }));
}

// GET /api/requests?status=new&city=Monterrey
export async function GET(req: NextRequest) {
  try {
    if (!SHEET_ID) throw new Error("Falta SHEET_ID");

    const sheets = await getSheets();
    const range = `${TAB}!A1:I`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const values = (resp.data.values || []) as any[][];
    if (values.length === 0) return NextResponse.json({ data: [] });

    let items = rowsToObjects(values);

    // Filtros opcionales
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const city = searchParams.get("city");

    if (status) items = items.filter((x) => x.status === status);
    if (city) items = items.filter((x) => x.city?.toLowerCase() === city.toLowerCase());

    // Orden más reciente primero
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ data: items });
  } catch (err: any) {
    console.error("GET /api/requests error:", err);
    return NextResponse.json(
      { error: "No se pudo leer las solicitudes", detail: err.message },
      { status: 500 }
    );
  }
}

// POST /api/requests
// body: { name, phone, category, subcategory, description, city }
export async function POST(req: NextRequest) {
  try {
    if (!SHEET_ID) throw new Error("Falta SHEET_ID");

    const body = await req.json();
    const required = ["name", "phone", "category", "subcategory", "description", "city"];
    const missing = required.filter((k) => !body?.[k]);
    if (missing.length) {
      return NextResponse.json(
        { error: `Faltan campos: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const sheets = await getSheets();
    const now = new Date().toISOString();
    const id = `REQ_${Date.now()}`;

    const row: RequestRow = {
      id,
      createdAt: now,
      name: String(body.name),
      phone: String(body.phone),
      category: String(body.category),
      subcategory: String(body.subcategory),
      description: String(body.description),
      city: String(body.city),
      status: "new",
    };

    // Append al final
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          row.id,
          row.createdAt,
          row.name,
          row.phone,
          row.category,
          row.subcategory,
          row.description,
          row.city,
          row.status
        ]],
      },
    });

    return NextResponse.json({ ok: true, id, createdAt: now });
  } catch (err: any) {
    console.error("POST /api/requests error:", err);
    return NextResponse.json(
      { error: "No se pudo crear la solicitud", detail: err.message },
      { status: 500 }
    );
  }
}
