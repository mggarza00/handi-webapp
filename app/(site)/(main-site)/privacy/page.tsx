import fs from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Consulta el aviso de privacidad de Handi y el manejo de datos personales.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Aviso de privacidad | Handi",
    description:
      "Consulta el aviso de privacidad de Handi y el manejo de datos personales.",
    url: "/privacy",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Aviso de privacidad | Handi",
    description:
      "Consulta el aviso de privacidad de Handi y el manejo de datos personales.",
  },
};

async function getPrivacyMd(): Promise<string> {
  const mdPath = path.join(
    process.cwd(),
    "docs",
    "policies",
    "aviso-de-privacidad.md",
  );
  try {
    const buf = await fs.readFile(mdPath);
    return buf.toString("utf-8");
  } catch {
    return "Aviso de Privacidad no disponible.";
  }
}

export default async function PrivacyPage() {
  const md = await getPrivacyMd();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <article className="prose prose-slate max-w-none">
        <MarkdownView md={md} />
      </article>
    </main>
  );
}

function MarkdownView({ md }: { md: string }) {
  // Render muy básico: respeta saltos de línea y algunos encabezados/negritas
  const html = md
    .replace(/^# (.*)$/gim, "<h1>$1</h1>")
    .replace(/^## (.*)$/gim, "<h2>$1</h2>")
    .replace(/^### (.*)$/gim, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^\s*$/gim, "<br/>");
  return <div dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}
