type TrustSignalChipsProps = {
  title?: string;
  items: string[];
};

export default function TrustSignalChips({
  title = "Confianza para decidir rapido",
  items,
}: TrustSignalChipsProps) {
  if (!items.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#f8faff] p-4 md:p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
