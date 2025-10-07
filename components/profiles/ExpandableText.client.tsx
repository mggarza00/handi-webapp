"use client";
import * as React from "react";

type Props = {
  text: string;
  /** Max paragraphs to ever render (hard cap). Default 35 */
  maxParagraphs?: number;
  /** How many paragraphs to show when collapsed. Default 4 */
  previewParagraphs?: number;
};

export default function ExpandableText({ text, maxParagraphs = 35, previewParagraphs = 4 }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const paras = React.useMemo(() => {
    // Split on blank lines or single newlines; trim empties
    const raw = (text || "").split(/\n\s*\n|\n/g).map((p) => p.trim()).filter(Boolean);
    return raw.slice(0, maxParagraphs);
  }, [text, maxParagraphs]);

  const showToggle = paras.length > previewParagraphs;
  const visible = expanded ? paras : paras.slice(0, previewParagraphs);

  return (
    <div>
      {visible.map((p, i) => (
        <p key={i} className="mb-3 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
          {p}
        </p>
      ))}
      {showToggle && (
        <button
          type="button"
          className="mt-1 rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Ver menos" : "Ver más"}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}

