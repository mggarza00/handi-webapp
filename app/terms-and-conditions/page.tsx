import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function getTermsMd(): Promise<string> {
  const mdPath = path.join(
    process.cwd(),
    "docs",
    "policies",
    "terminos-y-condiciones.md",
  );
  try {
    const buf = await fs.readFile(mdPath);
    return buf.toString("utf-8");
  } catch {
    return "Términos y Condiciones no disponibles.";
  }
}

export default async function TermsAndConditionsPage() {
  const md = await getTermsMd();
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
