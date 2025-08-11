// lib/sheets.ts
import { google } from "googleapis";

export type RequestRow = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string;
  subcategory: string;
  budget: number;
  required_at: string;            // ISO o texto
  status: "active" | "closed";
  created_by: string;
  created_at: string;             // ISO
};

const HEADER = [
  "id","title","description","city","category","subcategory",
  "budget","required_at","status","created_by","created_at"
];

const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL!;
const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

export async function getSheets() {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId };
}

export async function ensureHeader(sheetName = "requests") {
  const { sheets, spreadsheetId } = await getSheets();
  const range = `${sheetName}!A1:K1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

export function mapRow(row: any[]): RequestRow | null {
  if (!row || row.length === 0) return null;
  const [
    id, title, description, city, category, subcategory,
    budget, required_at, status, created_by, created_at
  ] = row;

  return {
    id,
    title: title || "",
    description: description || "",
    city: city || "",
    category: category || "",
    subcategory: subcategory || "",
    budget: Number(budget || 0),
    required_at: required_at || "",
    status: (status || "active") as "active" | "closed",
    created_by: created_by || "",
    created_at: created_at || "",
  };
}
