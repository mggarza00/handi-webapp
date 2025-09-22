const BRANDS = [
  {
    name: "Truper",
    desc: "Las mejores herramientas para los profesionales de México.",
  },
  {
    name: "Comex",
    desc: "Protege tu hogar esta temporada de lluvias con Comex Top.",
  },
  {
    name: "Rotoplas",
    desc: "Tinacos Rotoplas con tecnología antibacterial. Confianza garantizada.",
  },
  {
    name: "Home Depot",
    desc: "Todo lo que necesitas para tu obra, en un solo lugar.",
  },
  { name: "Cemex", desc: "Cemento de calidad para los cimientos de México." },
];

export default function Ads() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Publicidad</h2>
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {BRANDS.map((b) => (
          <li key={b.name} className="py-3">
            <div className="font-medium">{b.name}</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-300">
              {b.desc}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
