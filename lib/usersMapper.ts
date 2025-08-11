import type { sheets_v4 } from "googleapis";
import { getSheets } from "./sheets";

const TAB = "Usuarios"; // tu pestaña con headers: user_id, roles_permitidos, rol_actual, status_profesional, application_step

export type UsuarioRow = {
  user_id: string;
  roles_permitidos: string;   // ej: "cliente, profesional" o "cliente"
  rol_actual: "cliente" | "profesional";
  status_profesional: "no_iniciado" | "en_proceso" | "enviado" | "aprobado" | "rechazado";
  application_step: number | string;
};

function a1Col(n: number) {
  let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export async function getHeaderMap() {
  const { sheets, spreadsheetId } = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!1:1` });
  const headers = (res.data.values?.[0] || []) as string[];
  const map: Record<string, number> = {};
  headers.forEach((h, i) => (map[(h || "").trim()] = i + 1));
  return map;
}

// Busca la fila (1-based) donde user_id == value
export async function findUserRow(userId: string) {
  const { sheets, spreadsheetId } = await getSheets();
  const map = await getHeaderMap();
  const col = map["user_id"];
  if (!col) throw new Error("Header 'user_id' no encontrado en Usuarios");

  const colLetter = a1Col(col);
  const range = `${TAB}!${colLetter}2:${colLetter}`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "") === userId) {
      return 1 + 1 + i; // header(1) + offset + index
    }
  }
  return null;
}

export async function readUser(rowIndex: number): Promise<Partial<UsuarioRow>> {
  const { sheets, spreadsheetId } = await getSheets();
  const map = await getHeaderMap();
  const fields = ["user_id","roles_permitidos","rol_actual","status_profesional","application_step"];
  const ranges = fields.map(h => `${TAB}!${a1Col(map[h])}${rowIndex}`);
  const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
  const out: any = {};
  fields.forEach((h, i) => out[h] = res.data.valueRanges?.[i]?.values?.[0]?.[0] ?? "");
  return out;
}

export async function writeUser(rowIndex: number, data: Partial<UsuarioRow>) {
  const { sheets, spreadsheetId } = await getSheets();
  const map = await getHeaderMap();
  const dataRanges: sheets_v4.Schema$ValueRange[] = [];

  Object.entries(data).forEach(([h, v]) => {
    const col = map[h];
    if (!col) throw new Error(`Header '${h}' no encontrado en Usuarios`);
    dataRanges.push({ range: `${TAB}!${a1Col(col)}${rowIndex}`, values: [[v as any]] });
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: dataRanges },
  });
  return { ok: true };
}
