/*
  Generates ~1015 synthetic examples for local benchmarking.
  Usage: npx tsx scripts/generate-classifier-seeds.ts > tests/e2e/classifier-seed.json
*/

const titles = [
  "Fuga de agua en baño",
  "Instalar lámparas en sala",
  "Soldar protección para ventana",
  "Mantenimiento a minisplit",
  "Podar jardín delantero",
];
const descs = [
  "Sale agua de tubería bajo lavabo y huele a humedad",
  "Cambiar plafones e instalar spots led",
  "Reparar barandal y soldar portón",
  "Carga de gas y limpieza de filtros",
  "Poda de pasto y ajuste del riego",
];

const more = [
  "Corto en contacto de cocina",
  "Instalar mezcladora de regadera",
  "Colocar persiana blackout",
  "Fuga en WC y manguera",
  "Soldar reja perimetral",
  "Mantenimiento preventivo a clima",
  "Poda de árboles y retiro de ramas",
];

const pool: Array<{ title: string; description: string }> = [];
for (let i = 0; i < 200; i++) {
  titles.forEach((t, idx) => {
    const d = descs[idx % descs.length];
    pool.push({ title: `${t} #${i + 1}`, description: `${d}. Ref ${i}` });
  });
  more.forEach((t, idx) => pool.push({ title: `${t} #${i + 1}`, description: `Caso ${idx} serie ${i}` }));
}

// Trim to ~1015
const out = pool.slice(0, 1015);
console.log(JSON.stringify({ count: out.length, items: out }, null, 2));

