import { google } from "googleapis";

export async function getSheets() {
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.CLIENT_EMAIL;
  let privateKey =
    process.env.GOOGLE_PRIVATE_KEY || process.env.PRIVATE_KEY || "";

  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID || process.env.SHEET_ID;

  return { sheets, spreadsheetId };
}