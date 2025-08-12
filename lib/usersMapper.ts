// lib/usersMapper.ts
import { getSheets } from "@/lib/sheets";

export type UserRow = {
  user_id: string;
  nombre?: string;
  rol_actual?: "cliente" | "profesional";
  roles_permitidos?: string; // ej: "cliente,profesional"
  status_profesional?: "no_iniciado" | "en_proceso" | "enviado" | "aprobado" | "rechazado";
  application_step?: number;
};

const SHEET_NAME = "Usuarios";
const HEADERS: (keyof UserRow)[] = [
  "user_id",
  "nombre",
  "rol_actual",
  "roles_permitidos",
  "status_profesional",
  "application_step",
];

async function ensureHeader() {
  const { sheets, spreadsheetId } = await getSheets();
  const range = `${SHEET_NAME}!A1:F1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const first = res.data.values?.[0] || [];
  if (first.length < HEADERS.length || HEADERS.some((h, i) => (first[i] || "") !== h)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS as string[]] },
    });
  }
}

export async function findUserRow(userId: string): Promise<number> {
  const { sheets, spreadsheetId } = await getSheets();
  await ensureHeader();
  const colRange = `${SHEET_NAME}!A2:A`; // user_id
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: colRange });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => (r?.[0] || "").trim() === userId.trim());
  if (idx === -1) return -1;
  return idx + 2; // 1-based, considerando encabezado en fila 1
}

export async function readUser(rowIndex: number): Promise<UserRow> {
  const { sheets, spreadsheetId } = await getSheets();
  const range = `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`; // <-- A1 válido
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const row = res.data.values?.[0] || [];
  const obj: any = {};
  for (let i = 0; i < HEADERS.length; i++) obj[HEADERS[i]] = row[i] ?? "";
  if (obj.application_step !== "") obj.application_step = Number(obj.application_step);
  return obj as UserRow;
}

export async function writeUser(rowIndex: number, patch: Partial<UserRow>) {
  const { sheets, spreadsheetId } = await getSheets();
  // merge con lo existente (si no hay, queda objeto vacío)
  const current = await readUser(rowIndex).catch(() => ({} as UserRow));
  const merged: any = { ...current, ...patch };

  const values = [HEADERS.map((h) => merged[h] ?? "")];
  const range = `${SHEET_NAME}!A${rowIndex}:F${rowIndex}`; // <-- A1 válido
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function appendUser(row: UserRow) {
  const { sheets, spreadsheetId } = await getSheets();
  await ensureHeader();
  const values = [HEADERS.map((h) => (row as any)[h] ?? "")];
  const range = `${SHEET_NAME}!A1:F1`;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}
