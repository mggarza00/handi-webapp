export async function getRequestById(id: string) {
  const rows = await listRequests(); // lee todo y filtra
  return rows.find(r => r.id === id) || null;
}
import { google } from "googleapis";

export type RequestRow = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number | string;
  required_at: string; // ISO o texto
  status: "active" | "closed" | string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
};

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
const REQUESTS_SHEET = "Solicitudes"; // <- Asegúrate que el nombre de la pestaña coincida
const CLIENT_EMAIL = process.env.CLIENT_EMAIL!;
const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!SPREADSHEET_ID) throw new Error("Falta SHEETS_SPREADSHEET_ID en .env.local");
if (!CLIENT_EMAIL) throw new Error("Falta CLIENT_EMAIL en .env.local");
if (!PRIVATE_KEY) throw new Error("Falta PRIVATE_KEY en .env.local");

const auth = new google.auth.JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

/** Lee los encabezados A1:Z1 y regresa un Map<header, index> */
export async function getHeaderIndexMap() {
  try {
    const range = `${REQUESTS_SHEET}!A1:Z1`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
      majorDimension: "ROWS",
    });
    let headers = res.data.values?.[0] || [];

    if (!headers.length) {
      // Escribe encabezados por defecto si la fila 1 está vacía
      headers = [
        "id","title","description","city","category","subcategory",
        "budget","required_at","status","created_by","created_at","updated_at"
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${REQUESTS_SHEET}!A1:L1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }

    const map = new Map<string, number>();
    headers.forEach((h: string, idx: number) => map.set((h || "").trim(), idx));
    return map;
  } catch (err: any) {
    const hint =
      `Verifica: (1) SHEET_ID correcto, ` +
      `(2) pestaña "${REQUESTS_SHEET}" existe y el nombre coincide exacto, ` +
      `(3) el service account tiene acceso Editor.`;
    throw new Error(`No se pudo leer/escribir encabezados (${REQUESTS_SHEET}!A1:Z1). ${hint} Detalle: ${err?.message}`);
  }
}

/** Lista solicitudes desde A2:Z, mapea por encabezado y aplica limit opcional */
export async function listRequests(limit?: number): Promise<RequestRow[]> {
  const headerMap = await getHeaderIndexMap();

  const asRow = (row: string[]): RequestRow => {
    const get = (name: string) => row[headerMap.get(name) ?? -1] ?? "";
    return {
      id: get("id"),
      title: get("title"),
      description: get("description"),
      city: get("city"),
      category: get("category"),
      subcategory: get("subcategory"),
      budget: get("budget"),
      required_at: get("required_at"),
      status: (get("status") as any) || "active",
      created_by: get("created_by"),
      created_at: get("created_at"),
      updated_at: get("updated_at"),
    };
  };

  const range = `${REQUESTS_SHEET}!A2:Z`; // datos desde la fila 2
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    majorDimension: "ROWS",
  });

  const values: string[][] = (res.data.values as any) || [];
  const rows = values.map(asRow);

  return typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows;
}

/** Agrega una solicitud (usa encabezados para ordenar columnas) */
export async function appendRequest(data: Partial<RequestRow>) {
  const headerMap = await getHeaderIndexMap();

  const headers = Array.from(headerMap.keys());
  const row: any[] = headers.map((h) => {
    const v = (data as any)[h];
    return v == null ? "" : v;
  });

  const range = `${REQUESTS_SHEET}!A1:Z1`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { ok: true };
}