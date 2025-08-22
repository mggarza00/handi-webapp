import { google } from "googleapis";
import crypto from "crypto";

export type RequestRow = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number;
  required_at: string;           // ISO o texto
  status: "active" | "closed";
  created_by: string;            // userId
  created_at: string;            // ISO
};

const SHEET_ID =
  process.env.GOOGLE_SHEETS_ID ||
  process.env.SHEET_ID || "";

const REQUESTS_SHEET =
  process.env.GOOGLE_SHEETS_REQUESTS_SHEET || "Solicitudes";

function getAuth() {
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.CLIENT_EMAIL;
  let privateKey =
    process.env.GOOGLE_PRIVATE_KEY ||
    process.env.PRIVATE_KEY || "";

  if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_ID is required");
  if (!clientEmail) throw new Error("GOOGLE_CLIENT_EMAIL is required");
  if (!privateKey) throw new Error("GOOGLE_PRIVATE_KEY is required");

  // Manejo de \n en claves
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

type ColIndex = Record<string, number>;

async function getHeaderIndex(): Promise<{ headers: string[]; idx: ColIndex }> {
  const sheets = sheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${REQUESTS_SHEET}!1:1`,
  });
  const headers = (data.values?.[0] || []) as string[];
  const idx: ColIndex = {};
  headers.forEach((h, i) => (idx[h.trim()] = i));
  return { headers, idx };
}

function toNumber(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function listRequests(limit = 50): Promise<RequestRow[]> {
  const sheets = sheetsClient();
  const { headers, idx } = await getHeaderIndex();
  if (!headers.length) return [];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${REQUESTS_SHEET}!A2:Z`,
  });
  const rows = res.data.values || [];
  const take = rows.slice(-limit);
  return take.map((r) => ({
    id: r[idx["id"]],
    title: r[idx["title"]],
    description: r[idx["description"]],
    city: r[idx["city"]],
    category: r[idx["category"]],
    subcategory: r[idx["subcategory"]],
    budget: toNumber(r[idx["budget"]]),
    required_at: r[idx["required_at"]],
    status: (r[idx["status"]] as "active" | "closed") || "active",
    created_by: r[idx["created_by"]],
    created_at: r[idx["created_at"]],
  }));
}

export async function getRequest(id: string): Promise<RequestRow | null> {
  const sheets = sheetsClient();
  const { idx } = await getHeaderIndex();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${REQUESTS_SHEET}!A2:Z`,
  });
  for (const r of res.data.values || []) {
    if (r[idx["id"]] === id) {
      return {
        id: r[idx["id"]],
        title: r[idx["title"]],
        description: r[idx["description"]],
        city: r[idx["city"]],
        category: r[idx["category"]],
        subcategory: r[idx["subcategory"]],
        budget: toNumber(r[idx["budget"]]),
        required_at: r[idx["required_at"]],
        status: (r[idx["status"]] as "active" | "closed") || "active",
        created_by: r[idx["created_by"]],
        created_at: r[idx["created_at"]],
      };
    }
  }
  return null;
}

export async function createRequest(input: Omit<RequestRow, "id" | "created_at" | "status"> & Partial<Pick<RequestRow, "status">>): Promise<RequestRow> {
  const sheets = sheetsClient();
  const { headers } = await getHeaderIndex();
  const id = (crypto as any).randomUUID?.() ?? `req_${Date.now()}`;
  const created_at = new Date().toISOString();
  const status = input.status ?? "active";

  const row: RequestRow = {
    id,
    title: input.title,
    description: input.description,
    city: input.city,
    category: input.category,
    subcategory: input.subcategory,
    budget: toNumber(input.budget),
    required_at: input.required_at,
    status,
    created_by: input.created_by,
    created_at,
  };

  // Alinea el orden con headers existentes
  const line = headers.map((h) => (row as any)[h] ?? "");
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${REQUESTS_SHEET}!A1:Z1`,
    valueInputOption: "RAW",
    requestBody: { values: [line] },
  });

  return row;
}
