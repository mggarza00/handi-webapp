import { writeFileSync, mkdirSync } from "node:fs";
import { proApplicationAcceptedHtml } from "@/lib/email-templates";

const base =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

const linkUrl = `${base}/profiles/test-user`;
const imageUrl = `${base}/images/imagen_correo_sol_aceptada.png`;

const html = proApplicationAcceptedHtml({ linkUrl, imageUrl });

const outDir = "tmp/email-previews";
const outFile = `${outDir}/accepted-preview.html`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, { encoding: "utf8" });

console.log(`OK => ${outFile}`);

