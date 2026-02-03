"use client";

import * as React from "react";

import AdminActions from "./AdminActions.client";

type ApplicationRow = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  empresa: boolean | null;
  status: string | null;
  created_at: string | null;
};

type Reference = {
  name?: string | null;
  phone?: string | null;
  relation?: string | null;
};

type Uploads = {
  cv_url?: string | null;
  letters_urls?: string[] | null;
  id_front_url?: string | null;
  id_back_url?: string | null;
  company_doc_incorporation_url?: string | null;
  company_csf_url?: string | null;
  company_rep_id_front_url?: string | null;
  company_rep_id_back_url?: string | null;
  bank_cover_url?: string | null;
  signature_url?: string | null;
};

type ApplicationDetail = ApplicationRow & {
  rfc?: string | null;
  is_company?: boolean | null;
  company_legal_name?: string | null;
  company_industry?: string | null;
  company_employees_count?: number | null;
  company_website?: string | null;
  services_desc?: string | null;
  cities?: string[] | null;
  categories?: string[] | null;
  subcategories?: string[] | null;
  years_experience?: number | null;
  refs?: Reference[] | null;
  uploads?: Uploads | null;
  company_doc_incorporation_url?: string | null;
  company_csf_url?: string | null;
  company_rep_id_front_url?: string | null;
  company_rep_id_back_url?: string | null;
  updated_at?: string | null;
};

type DetailResponse =
  | { ok: true; data: ApplicationDetail }
  | { ok: false; error: string };

function labelStatus(s: string | null) {
  switch (s) {
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    default:
      return "En revision";
  }
}

function formatList(value: unknown): string {
  if (Array.isArray(value)) {
    const text = value
      .filter((v) => typeof v === "string" && v.trim())
      .join(", ");
    return text || ".";
  }
  if (typeof value === "string") return value || ".";
  return ".";
}

function buildUploadItems(detail: ApplicationDetail) {
  const uploads: Uploads =
    detail.uploads && typeof detail.uploads === "object" ? detail.uploads : {};
  const items: Array<{ label: string; url: string }> = [];
  const pushUrl = (label: string, url?: string | null) => {
    if (typeof url === "string" && url.trim()) {
      items.push({ label, url });
    }
  };
  pushUrl("CV", uploads.cv_url);
  if (Array.isArray(uploads.letters_urls)) {
    uploads.letters_urls.forEach((url, idx) => {
      if (typeof url === "string" && url.trim()) {
        items.push({ label: `Carta ${idx + 1}`, url });
      }
    });
  }
  pushUrl("ID frente", uploads.id_front_url);
  pushUrl("ID reverso", uploads.id_back_url);
  pushUrl(
    "Acta constitutiva",
    uploads.company_doc_incorporation_url ||
      detail.company_doc_incorporation_url,
  );
  pushUrl("CSF", uploads.company_csf_url || detail.company_csf_url);
  pushUrl(
    "ID representante (frente)",
    uploads.company_rep_id_front_url || detail.company_rep_id_front_url,
  );
  pushUrl(
    "ID representante (reverso)",
    uploads.company_rep_id_back_url || detail.company_rep_id_back_url,
  );
  pushUrl("Caratula bancaria", uploads.bank_cover_url);
  pushUrl("Firma", uploads.signature_url);
  return items;
}

export default function ProApplicationsTable({
  rows,
}: {
  rows: ApplicationRow[];
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [detailsById, setDetailsById] = React.useState<
    Record<string, ApplicationDetail>
  >({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [errorById, setErrorById] = React.useState<Record<string, string>>({});

  const handleToggle = React.useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(id);
      if (Object.prototype.hasOwnProperty.call(detailsById, id)) return;
      setLoadingId(id);
      setErrorById((prev) => ({ ...prev, [id]: "" }));
      try {
        const res = await fetch(`/api/admin/pro-applications/${id}`, {
          cache: "no-store",
        });
        const json = (await res
          .json()
          .catch(() => null)) as DetailResponse | null;
        if (!res.ok || !json || json.ok === false) {
          const message =
            json && "error" in json && json.error
              ? json.error
              : "No se pudo cargar el detalle";
          throw new Error(message);
        }
        setDetailsById((prev) => ({ ...prev, [id]: json.data }));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error inesperado";
        setErrorById((prev) => ({ ...prev, [id]: message }));
      } finally {
        setLoadingId((prev) => (prev === id ? null : prev));
      }
    },
    [detailsById, expandedId],
  );

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Correo</th>
            <th className="px-3 py-2">Telefono</th>
            <th className="px-3 py-2">Empresa</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Creada</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isExpanded = expandedId === r.id;
            const detail = detailsById[r.id];
            const isLoading = loadingId === r.id;
            const error = errorById[r.id];
            const isCompany = Boolean(detail?.empresa ?? detail?.is_company);
            const uploads = detail ? buildUploadItems(detail) : [];
            const refs = Array.isArray(detail?.refs) ? detail?.refs : [];
            return (
              <React.Fragment key={r.id}>
                <tr className="border-t border-slate-200">
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.phone}</td>
                  <td className="px-3 py-2">{r.empresa ? "Si" : "No"}</td>
                  <td className="px-3 py-2">{labelStatus(r.status)}</td>
                  <td className="px-3 py-2">
                    {new Date(r.created_at || "").toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AdminActions
                      id={r.id}
                      status={r.status}
                      onToggleView={handleToggle}
                      isExpanded={isExpanded}
                    />
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={8} className="px-4 py-3">
                      {isLoading ? (
                        <div className="text-sm text-slate-500">
                          Cargando detalle...
                        </div>
                      ) : error ? (
                        <div className="text-sm text-rose-600">{error}</div>
                      ) : detail ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Datos basicos
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Nombre
                                </div>
                                <div>{detail.full_name || "."}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Telefono
                                </div>
                                <div>{detail.phone || "."}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Correo
                                </div>
                                <div>{detail.email || "."}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  RFC
                                </div>
                                <div>{detail.rfc || "."}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Empresa
                                </div>
                                <div>{isCompany ? "Si" : "No"}</div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Info profesional
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Anios de experiencia
                                </div>
                                <div>{detail.years_experience ?? "."}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  Categorias
                                </div>
                                <div>
                                  {formatList(detail.categories) || "."}
                                </div>
                              </div>
                              {detail.subcategories ? (
                                <div>
                                  <div className="text-xs text-slate-500">
                                    Subcategorias
                                  </div>
                                  <div>
                                    {formatList(detail.subcategories) || "."}
                                  </div>
                                </div>
                              ) : null}
                              <div>
                                <div className="text-xs text-slate-500">
                                  Ciudades
                                </div>
                                <div>{formatList(detail.cities) || "."}</div>
                              </div>
                            </div>
                          </div>

                          {isCompany ? (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Empresa
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <div className="text-xs text-slate-500">
                                    Razon social
                                  </div>
                                  <div>{detail.company_legal_name || "."}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">
                                    Giro
                                  </div>
                                  <div>{detail.company_industry || "."}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">
                                    Empleados
                                  </div>
                                  <div>
                                    {detail.company_employees_count ?? "."}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-500">
                                    Sitio
                                  </div>
                                  {detail.company_website ? (
                                    <a
                                      href={detail.company_website}
                                      className="text-blue-600 underline"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {detail.company_website}
                                    </a>
                                  ) : (
                                    <div>.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase text-slate-500">
                              Servicios
                            </div>
                            <div className="whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                              {detail.services_desc || "."}
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Referencias
                              </div>
                              {refs.length ? (
                                <ul className="space-y-2 text-sm">
                                  {refs.map((ref, idx) => (
                                    <li
                                      key={`${ref?.name ?? "ref"}-${idx}`}
                                      className="rounded border border-slate-200 bg-white p-2"
                                    >
                                      <div>{ref?.name || "."}</div>
                                      <div className="text-xs text-slate-500">
                                        {ref?.phone || "."}
                                        {ref?.relation
                                          ? ` - ${ref.relation}`
                                          : ""}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-sm text-slate-500">.</div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">
                                Archivos
                              </div>
                              {uploads.length ? (
                                <ul className="space-y-2 text-sm">
                                  {uploads.map((file) => (
                                    <li key={`${file.label}-${file.url}`}>
                                      <a
                                        href={file.url}
                                        className="text-blue-600 underline"
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {file.label}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-sm text-slate-500">.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">.</div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
