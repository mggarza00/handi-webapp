// app/api/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Reusa tus helpers de env del otro archivo si los tienes en un util.
// Para dejar esto autocontenido, incluyo versiones locales:
function getEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim() !== "") return v;
  }
  throw new Error(`Falta variable de entorno: ${keys.join(" | ")}`);
}
function getAuth() {
  const clientEmail = getEnv("CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL");
  const privateKeyRaw = getEnv("PRIVATE_KEY", "GOOGLE_PRIVATE_KEY");
  const privateKey = String(privateKeyRaw).replace(/\\n/g, "\n");
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
function getSheetId() {
  return getEnv("SHEET_ID", "GOOGLE_SHEET_ID");
}

const TAB = "Requests";

type RequestRow = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  category: string;
  subcategory: string;
  description: string;
  city: string;
  status: string;
};

function rowsToObjects(rows: any[][]): { header: string[]; items: RequestRow[] } {
  const [header, ...data] = rows;
  const idx: Record<string, number> = {};
  header.forEach((h, i) => (idx[String(h).trim()] = i));
  const items = data
    .filter(Boolean)
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
  return { header, items };
}

// GET /api/requests/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const SHEET_ID = getSheetId();
    const sheets = await getSheets();
    const range = `${TAB}!A1:Z`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
    const values = (resp.data.values || []) as any[][];
    if (values.length === 0) return NextResponse.json({ data: null }, { status: 404 });

    const { items } = rowsToObjects(values);
    const item = items.find((x) => x.id === params.id);
    if (!item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json({ data: item });
  } catch (err: any) {
    console.error("GET /api/requests/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/requests/[id]
// body: { status?: string, ...otrosCamposOpcionales }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const SHEET_ID = getSheetId();
    const sheets = await getSheets();
    const body = await req.json();

    // 1) Leemos toda la hoja para ubicar la fila a actualizar
    const readRange = `${TAB}!A1:Z`;
    const read = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: readRange });
    const values = (read.data.values || []) as any[][];
    if (values.length < 2) return NextResponse.json({ error: "Hoja vacía" }, { status: 404 });

    const header = values[0].map((h) => String(h).trim());
    const idCol = header.indexOf("id");
    if (idCol === -1) return NextResponse.json({ error: "Falta columna id" }, { status: 500 });

    const rowIndex = values.findIndex((r, i) => i > 0 && r[idCol] === params.id); // índice en el array
    if (rowIndex === -1) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // 2) Construimos la fila actualizada (solo columnas que existan en header)
    const current = values[rowIndex] ?? [];
    const updated = [...current];
    for (const [k, v] of Object.entries(body)) {
      const col = header.indexOf(k);
      if (col !== -1) updated[col] = v;
    }

    // 3) Escribimos de vuelta solo esa fila
    // Nota: rowIndex es base 0 del array; en Sheets, la fila real = rowIndex + 1
    const sheetRowNumber = rowIndex + 1;
    const updateRange = `${TAB}!A${sheetRowNumber}:${colToLetter(header.length)}${sheetRowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: updateRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [updated] },
    });

    return NextResponse.json({ ok: true, id: params.id });
  } catch (err: any) {
    console.error("PATCH /api/requests/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Utilidad para convertir índice de columna a letra (A, B, ... AA)
function colToLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
