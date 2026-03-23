type LocalInfoBandProps = {
  title: string;
  description: string;
  chips?: string[];
};

export default function LocalInfoBand({
  title,
  description,
  chips = [],
}: LocalInfoBandProps) {
  return (
    <section className="rounded-2xl border border-slate-300/80 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-[0_12px_28px_-22px_rgba(8,40,119,0.45)] md:p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {description}
      </p>
      {chips.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600"
            >
              {chip}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
