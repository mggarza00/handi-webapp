/*
  scripts/remove-categories.js
  Elimina todas las filas de la tabla `categories_subcategories` cuya categoría sea "Agricultura" o "Ganadería"
  Carga variables desde .env.local y .env sin depender de paquetes externos.
*/

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(p) {
  try {
    if (!fs.existsSync(p)) return;
    const content = fs.readFileSync(p, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (e) {
    console.error("No se pudo leer", p, e.message);
  }
}

// Cargar .env.local y después .env
loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
  );
  process.exit(1);
}

const supabase = createClient(url, service, {
  auth: { persistSession: false },
});

function normalizeCat(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

(async () => {
  try {
    console.log("Obteniendo categorías actuales...");
    const { data, error } = await supabase
      .from("categories_subcategories")
      .select('"Categoría"');
    if (error) throw error;

    const target = new Set(["agricultura", "ganaderia"]);
    const toDeleteValues = Array.from(
      new Set(
        (data || [])
          .map((r) => r && r["Categoría"])
          .filter((v) => typeof v === "string")
          .filter((v) => target.has(normalizeCat(v))),
      ),
    );

    if (toDeleteValues.length === 0) {
      console.log(
        "No se encontraron categorías 'Agricultura' o 'Ganadería' para eliminar.",
      );
      process.exit(0);
    }

    console.log("Eliminando filas con categorías:", toDeleteValues);
    const del = await supabase
      .from("categories_subcategories")
      .delete()
      .in("Categoría", toDeleteValues);
    if (del.error) throw del.error;
    console.log(
      "Eliminación completada. Filas afectadas:",
      del.count ?? "(sin count)",
    );
  } catch (e) {
    console.error("Error durante la eliminación:", e.message || e);
    process.exit(1);
  }
})();
