type ProcessStepsCompactProps = {
  title?: string;
  steps: string[];
};

export default function ProcessStepsCompact({
  title = "Como funciona",
  steps,
}: ProcessStepsCompactProps) {
  if (!steps.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-[#f7faff] p-4 md:p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {steps.slice(0, 3).map((step, index) => (
          <article
            key={step}
            className="rounded-2xl border border-slate-300/80 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(8,40,119,0.5)]"
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-[#3659ad] uppercase">
              Paso {index + 1}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {step}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
