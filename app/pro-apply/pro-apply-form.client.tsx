"use client";
import * as React from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/cities";
import CompanyToggle from "@/components/forms/CompanyToggle";
import CompanyFields from "@/components/forms/CompanyFields";
import SlideDown from "@/components/forms/SlideDown";
import {
  readDraft,
  writeDraft,
  clearDraft,
  isPendingAutoSubmit,
  clearGatingFlags,
} from "@/lib/drafts";

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const AppSchema = z
  .object({
    full_name: z.string().min(2).max(120),
    phone: z.string().min(8).max(20),
    email: z.string().email(),
    rfc: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .refine((s) => RFC_REGEX.test(s), "RFC inválido"),
    empresa: z.boolean().optional(),
    company_legal_name: z.string().min(2).optional(),
    company_industry: z.string().min(1).optional(),
    company_employees_count: z.number().int().min(1).optional(),
    company_website: z
      .string()
      .optional()
      .refine((s) => !s || /^https?:\/\//i.test(s), "Sitio inválido"),
    services_desc: z.string().min(10).max(1200),
    cities: z.array(z.string().min(2).max(120)).min(1).max(20),
    categories: z.array(z.string().min(2).max(120)).min(1).max(20),
    subcategories: z.array(z.string().min(1).max(120)).max(50).optional(),
    years_experience: z.number().int().min(0).max(80),
    privacy_accept: z.literal(true),
    references: z
      .array(
        z.object({
          name: z.string().min(2).max(120),
          phone: z.string().min(8).max(20),
          relation: z.string().min(2).max(80),
        }),
      )
      .min(1)
      .max(10),
  })
  .superRefine((data, ctx) => {
    if (data.empresa) {
      if (!data.company_legal_name || data.company_legal_name.trim().length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_legal_name"], message: "Requerido" });
      }
      if (!data.company_industry || data.company_industry.trim().length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_industry"], message: "Requerido" });
      }
      if (data.company_employees_count != null && (!Number.isInteger(data.company_employees_count) || data.company_employees_count < 1)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_employees_count"], message: "Inválido" });
      }
      if (data.company_website && !/^https?:\/\//i.test(data.company_website)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company_website"], message: "Inválido" });
      }
    }
  });

type Reference = { name: string; phone: string; relation: string };

export default function ProApplyForm({
  userId,
  userEmail,
  defaultFullName = "",
}: {
  userId: string;
  userEmail: string;
  defaultFullName?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  // Basic fields
  const [fullName, setFullName] = React.useState(defaultFullName || "");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(userEmail || "");
  const [rfc, setRfc] = React.useState("");
  const [servicesDesc, setServicesDesc] = React.useState("");
  const [empresa, setEmpresa] = React.useState(false);
  const [companyLegalName, setCompanyLegalName] = React.useState("");
  const [companyIndustry, setCompanyIndustry] = React.useState("");
  const [companyEmployees, setCompanyEmployees] = React.useState("");
  const [companyWebsite, setCompanyWebsite] = React.useState("");
  const [selectedCities, setSelectedCities] = React.useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    [],
  );
  const [selectedSubcategories, setSelectedSubcategories] = React.useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<
    string[]
  >([]);
  const [groupedSubcats, setGroupedSubcats] = React.useState<Record<string, string[]>>({});
  const [loadingCats, setLoadingCats] = React.useState(false);
  const [years, setYears] = React.useState("");
  const [privacy, setPrivacy] = React.useState(false);
  // Facturación (solo persona física)
  const [canInvoiceSelf, setCanInvoiceSelf] = React.useState(false);
  const [authorizeHandi, setAuthorizeHandi] = React.useState(false);

  // Error UI states
  const [fieldErrs, setFieldErrs] = React.useState<Record<string, boolean>>({
    full_name: false,
    phone: false,
    email: false,
    rfc: false,
    empresa: false,
    company_legal_name: false,
    company_industry: false,
    company_employees_count: false,
    company_website: false,
    services_desc: false,
    cities: false,
    categories: false,
    years_experience: false,
    privacy_accept: false,
  });
  const [refErrs, setRefErrs] = React.useState<
    Array<{ name: boolean; phone: boolean; relation: boolean }>
  >([
    { name: false, phone: false, relation: false },
    { name: false, phone: false, relation: false },
    { name: false, phone: false, relation: false },
  ]);
  const [fileErrs, setFileErrs] = React.useState<{
    // persona física
    cv: boolean;
    letters: boolean;
    idFront: boolean;
    idBack: boolean;
    // empresa
    companyDoc: boolean;
    companyCsf: boolean;
    repIdFront: boolean;
    repIdBack: boolean;
    // común
    sig: boolean;
  }>({
    cv: false,
    letters: false,
    idFront: false,
    idBack: false,
    companyDoc: false,
    companyCsf: false,
    repIdFront: false,
    repIdBack: false,
    sig: false,
  });

  // Uploads
  // Persona física (no empresa)
  const [cvFile, setCvFile] = React.useState<File | null>(null);
  const [letters, setLetters] = React.useState<File[]>([]);
  const [idFront, setIdFront] = React.useState<File | null>(null);
  const [idBack, setIdBack] = React.useState<File | null>(null);
  // Empresa
  const [companyDoc, setCompanyDoc] = React.useState<File | null>(null);
  const [companyCsf, setCompanyCsf] = React.useState<File | null>(null);
  const [repIdFront, setRepIdFront] = React.useState<File | null>(null);
  const [repIdBack, setRepIdBack] = React.useState<File | null>(null);

  // References (3 fijas)
  const [refs, setRefs] = React.useState<Reference[]>([
    { name: "", phone: "", relation: "" },
    { name: "", phone: "", relation: "" },
    { name: "", phone: "", relation: "" },
  ]);

  // Signature
  const sigCanvasRef = React.useRef<HTMLCanvasElement | null>(null); // persistent/offscreen canvas used for upload
  const sigDialogCanvasRef = React.useRef<HTMLCanvasElement | null>(null); // dialog-visible canvas for drawing
  const [sigDirty, setSigDirty] = React.useState(false);
  const [sigPreviewUrl, setSigPreviewUrl] = React.useState<string | null>(null);
  const [sigOpen, setSigOpen] = React.useState(false);

  // Load draft on mount
  React.useEffect(() => {
    try {
      const d = readDraft<{
        full_name?: string;
        phone?: string;
        email?: string;
        rfc?: string;
        empresa?: boolean;
        company_legal_name?: string;
        company_industry?: string;
        company_employees_count?: string;
        company_website?: string;
        services_desc?: string;
        cities?: string[];
        categories?: string[];
        subcategories?: string[];
        years_experience?: string;
        privacy_accept?: boolean;
        references?: Reference[];
      }>("draft:apply-professional");
      if (d) {
        if (typeof d.full_name === "string") setFullName(d.full_name);
        if (typeof d.phone === "string") setPhone(d.phone);
        if (typeof d.email === "string") setEmail(d.email);
        if (typeof d.rfc === "string") setRfc(d.rfc);
        if (typeof d.empresa === "boolean") setEmpresa(d.empresa);
        if (typeof d.company_legal_name === "string")
          setCompanyLegalName(d.company_legal_name);
        if (typeof d.company_industry === "string")
          setCompanyIndustry(d.company_industry);
        if (typeof d.company_employees_count === "string")
          setCompanyEmployees(d.company_employees_count);
        if (typeof d.company_website === "string")
          setCompanyWebsite(d.company_website);
        if (typeof d.services_desc === "string")
          setServicesDesc(d.services_desc);
        if (Array.isArray(d.cities)) setSelectedCities(d.cities);
        if (Array.isArray(d.categories)) setSelectedCategories(d.categories);
        if (Array.isArray(d.subcategories))
          setSelectedSubcategories(d.subcategories);
        if (typeof d.years_experience === "string")
          setYears(d.years_experience);
        if (typeof d.privacy_accept === "boolean") setPrivacy(d.privacy_accept);
        if (typeof (d as any).billing_can_invoice_self === "boolean")
          setCanInvoiceSelf((d as any).billing_can_invoice_self as boolean);
        if (typeof (d as any).billing_authorize_handi === "boolean")
          setAuthorizeHandi((d as any).billing_authorize_handi as boolean);
        if (Array.isArray(d.references) && d.references.length === 3)
          setRefs(d.references);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist draft on change (exclude files/signature)
  React.useEffect(() => {
    writeDraft("draft:apply-professional", {
      full_name: fullName,
      phone,
      email,
      rfc,
      empresa,
      company_legal_name: companyLegalName,
      company_industry: companyIndustry,
      company_employees_count: companyEmployees,
      company_website: companyWebsite,
      services_desc: servicesDesc,
      cities: selectedCities,
      categories: selectedCategories,
      subcategories: selectedSubcategories,
      years_experience: years,
      privacy_accept: privacy,
      billing_can_invoice_self: canInvoiceSelf,
      billing_authorize_handi: authorizeHandi,
      references: refs,
    });
  }, [
    fullName,
    phone,
    email,
    rfc,
    empresa,
    companyLegalName,
    companyIndustry,
    companyEmployees,
    companyWebsite,
    servicesDesc,
    selectedCities,
    selectedCategories,
    selectedSubcategories,
    years,
    privacy,
    canInvoiceSelf,
    authorizeHandi,
    refs,
  ]);

  // Do not auto-submit this form after login because files/signature cannot be persisted
  React.useEffect(() => {
    if (isPendingAutoSubmit()) {
      // We only rehydrate via the effect above; just clear the gating flags with a gentle note.
      clearGatingFlags();
      toast.message(
        "Tu sesión está iniciada. Revisa los datos, adjunta archivos y envía tu postulación.",
      );
    }
  }, []);

  // Load categories
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      try {
        const res = await fetch("/api/catalog/categories", {
          cache: "no-store",
        });
        const j = await res.json();
        if (!res.ok || j?.ok === false)
          throw new Error(j?.detail || j?.error || "fetch_failed");
        const rows: Array<{ category?: string | null; subcategory?: string | null }> = j?.data ?? [];
        const catSet = new Set<string>();
        const grouped: Record<string, string[]> = {};
        (rows || []).forEach((r) => {
          const c = (r?.category ?? "").toString().trim();
          const s = (r?.subcategory ?? "").toString().trim();
          if (c) catSet.add(c);
          if (c && s) {
            if (!grouped[c]) grouped[c] = [];
            if (!grouped[c].includes(s)) grouped[c].push(s);
          }
        });
        if (!cancelled) {
          setAvailableCategories(Array.from(catSet).sort((a, b) => a.localeCompare(b)));
          // Sort subcategories alphabetically per category
          Object.keys(grouped).forEach((k) => grouped[k].sort((a, b) => a.localeCompare(b)));
          setGroupedSubcats(grouped);
        }
      } catch {
        if (!cancelled) setAvailableCategories([]);
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When categories change, drop any subcategories that no longer belong
  React.useEffect(() => {
    if (!selectedCategories?.length) {
      if (selectedSubcategories.length) setSelectedSubcategories([]);
      return;
    }
    const allowed = new Set<string>();
    selectedCategories.forEach((c) => {
      (groupedSubcats[c] || []).forEach((s) => allowed.add(s));
    });
    const filtered = selectedSubcategories.filter((s) => allowed.has(s));
    if (filtered.length !== selectedSubcategories.length) {
      setSelectedSubcategories(filtered);
    }
  }, [selectedCategories, groupedSubcats, selectedSubcategories]);

  // Signature drawing handlers (pointer events) bind when dialog opens
  React.useEffect(() => {
    if (!sigOpen) return;
    let disposed = false;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let rafSetup = 0;
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const setup = () => {
      if (disposed) return;
      canvas = sigDialogCanvasRef.current;
      if (!canvas) {
        rafSetup = requestAnimationFrame(setup);
        return;
      }
      // Ensure touch-action none
      try { (canvas.style as any).touchAction = "none"; } catch {}
      ctx = canvas.getContext("2d");
      if (!ctx) {
        rafSetup = requestAnimationFrame(setup);
        return;
      }
      const setupSize = () => {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        let { width: w, height: h } = canvas!.getBoundingClientRect();
        if (!w || !h) {
          w = canvas!.offsetWidth || canvas!.width || 640;
          h = canvas!.offsetHeight || canvas!.height || 180;
        }
        canvas!.width = Math.max(1, Math.round(w * dpr));
        canvas!.height = Math.max(1, Math.round(h * dpr));
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx!.lineWidth = 2;
        ctx!.lineCap = "round";
        ctx!.strokeStyle = "#111827";
      };
      setupSize();
      const onResize = () => setupSize();
      window.addEventListener("resize", onResize);

      const getPos = (e: PointerEvent) => {
        const r = canvas!.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        return { x, y };
      };
      const down = (e: PointerEvent) => {
        e.preventDefault();
        if (e.pointerType === "mouse" && e.button !== 0) return;
        canvas!.setPointerCapture(e.pointerId);
        const { x, y } = getPos(e);
        drawing = true;
        lastX = x;
        lastY = y;
        setSigDirty(true);
        // Dot on click
        ctx!.beginPath();
        ctx!.arc(x, y, 0.75, 0, Math.PI * 2);
        ctx!.fillStyle = "#111827";
        ctx!.fill();
      };
      const move = (e: PointerEvent) => {
        if (!drawing) return;
        e.preventDefault();
        const { x, y } = getPos(e);
        ctx!.beginPath();
        ctx!.moveTo(lastX, lastY);
        ctx!.lineTo(x, y);
        ctx!.stroke();
        lastX = x;
        lastY = y;
      };
      const up = (e: PointerEvent) => {
        drawing = false;
        try { canvas!.releasePointerCapture(e.pointerId); } catch {}
      };

      canvas!.addEventListener("pointerdown", down);
      canvas!.addEventListener("pointermove", move);
      canvas!.addEventListener("pointerup", up);
      canvas!.addEventListener("pointercancel", up);

      return () => {
        window.removeEventListener("resize", onResize);
        canvas!.removeEventListener("pointerdown", down);
        canvas!.removeEventListener("pointermove", move);
        canvas!.removeEventListener("pointerup", up);
        canvas!.removeEventListener("pointercancel", up);
      };
    };

    const cleanup = setup();
    return () => {
      disposed = true;
      if (rafSetup) cancelAnimationFrame(rafSetup);
      if (typeof cleanup === "function") cleanup();
    };
  }, [sigOpen]);

  function clearDialogSignature() {
    const canvas = sigDialogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigDirty(false);
  }

  function acceptSignature() {
    const source = sigDialogCanvasRef.current;
    const dest = sigCanvasRef.current;
    if (!source || !dest) {
      setSigOpen(false);
      return;
    }
    const dctx = dest.getContext("2d");
    if (!dctx) {
      setSigOpen(false);
      return;
    }
    // Copy scaled content into a fixed-size destination for upload
    const targetW = 640;
    const targetH = 180;
    dest.width = targetW;
    dest.height = targetH;
    dctx.clearRect(0, 0, targetW, targetH);
    // Draw source to fit destination while keeping aspect (centered)
    const ratio = Math.min(targetW / source.width, targetH / source.height);
    const dw = source.width * ratio;
    const dh = source.height * ratio;
    const dx = (targetW - dw) / 2;
    const dy = (targetH - dh) / 2;
    dctx.drawImage(source, 0, 0, source.width, source.height, dx, dy, dw, dh);

    try {
      const url = dest.toDataURL("image/png");
      setSigPreviewUrl(url);
    } catch {
      // ignore
    }
    setSigOpen(false);
  }

  async function uploadViaApi(
    file: File,
    path: string,
    bucket = "pro-verifications",
  ): Promise<{ url: string; path: string }> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", path);
    fd.append("bucket", bucket);
    const res = await fetch("/api/storage/upload", {
      method: "POST",
      body: fd,
    });
    const j = await res.json();
    if (!res.ok || !j?.ok)
      throw new Error(j?.error || "No se pudo subir archivo");
    return { url: j.url as string, path: j.path as string };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrs({
      full_name: false,
      phone: false,
      email: false,
      services_desc: false,
      cities: false,
      categories: false,
      years_experience: false,
      privacy_accept: false,
    });
    setRefErrs([
      { name: false, phone: false, relation: false },
      { name: false, phone: false, relation: false },
      { name: false, phone: false, relation: false },
    ]);
    setFileErrs({
      cv: false,
      letters: false,
      idFront: false,
      idBack: false,
      companyDoc: false,
      companyCsf: false,
      repIdFront: false,
      repIdBack: false,
      sig: false,
    });

    const cities = selectedCities.slice();
    const cat = selectedCategories.slice();
    const refsTrimmed = refs.map((r) => ({
      name: (r.name || "").trim(),
      phone: (r.phone || "").trim(),
      relation: (r.relation || "").trim(),
    }));
    for (let i = 0; i < refsTrimmed.length; i++) {
      const r = refsTrimmed[i];
      const problems: string[] = [];
      if (r.name.length < 2) problems.push("Nombre");
      if (r.phone.length < 8) problems.push("Teléfono");
      if (r.relation.length < 2) problems.push("Relación");
      if (problems.length > 0) {
        const msg = `Referencia ${i + 1}: ${problems.join(", ")} inválido(s) o incompleto(s)`;
        setError(msg);
        toast.error(msg);
        setRefErrs((prev) =>
          prev.map((x, idx) =>
            idx === i
              ? {
                  name: r.name.length < 2,
                  phone: r.phone.length < 8,
                  relation: r.relation.length < 2,
                }
              : x,
          ),
        );
        return;
      }
    }

    const parsed = AppSchema.safeParse({
      full_name: fullName,
      phone,
      email,
      rfc,
      empresa,
      company_legal_name: companyLegalName,
      company_industry: companyIndustry,
      company_employees_count: companyEmployees ? Number(companyEmployees) : undefined,
      company_website: companyWebsite,
      services_desc: servicesDesc,
      cities,
      categories: cat,
  subcategories: selectedSubcategories,
      years_experience: years ? Number(years) : NaN,
      privacy_accept: privacy,
      references: refsTrimmed,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const friendly = (key: string) => {
        switch (key) {
          case "email":
            return "Ingresa un correo válido";
          case "rfc":
            return "Ingresa un RFC válido";
          case "full_name":
            return "Ingresa tu nombre completo";
          case "phone":
            return "Ingresa un teléfono válido (mín. 8 dígitos)";
          case "empresa":
            return "Indica si aplicas como empresa (opcional)";
          case "company_legal_name":
            return "Ingresa la razón social";
          case "company_industry":
            return "Ingresa el giro o sector";
          case "company_employees_count":
            return "Número de empleados debe ser entero > 0";
          case "company_website":
            return "Ingresa un sitio válido (http/https)";
          case "services_desc":
            return "Describe brevemente tus servicios (mín. 10 caracteres)";
          case "cities":
            return "Selecciona al menos una ciudad";
          case "categories":
            return "Selecciona al menos una categoría";
          case "years_experience":
            return "Ingresa años de experiencia válidos";
          case "privacy_accept":
            return "Debes aceptar el Aviso de Privacidad";
          default:
            return "Revisa este campo";
        }
      };
      const shown = new Set<string>();
      for (const issue of issues) {
        const key = (issue.path?.[0] as string) || "form";
        if (shown.has(key)) continue;
        shown.add(key);
        toast.error(friendly(key));
        setFieldErrs((prev) => ({ ...prev, [key]: true }));
      }
      setError("Revisa los campos del formulario.");
      return;
    }

    // Facturación: si no es empresa, exigir autorización si no tiene facultad propia
    if (!empresa && !canInvoiceSelf && !authorizeHandi) {
      const msg = "Se requiere autorización del usuario para elaborar facturas a su nombre.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (empresa) {
      // Validación de documentos de empresa
      const max = 10 * 1024 * 1024; // 10MB
      if (!companyDoc) {
        const msg = "Sube el acta constitutiva.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, companyDoc: true }));
        return;
      }
      if (companyDoc.size > max) {
        const msg = "Acta constitutiva excede 10 MB.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, companyDoc: true }));
        return;
      }
      if (!companyCsf) {
        const msg = "Sube la constancia de situación fiscal (CSF).";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, companyCsf: true }));
        return;
      }
      if (companyCsf.size > max) {
        const msg = "CSF excede 10 MB.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, companyCsf: true }));
        return;
      }
      if (repIdFront && repIdFront.size > max) {
        const msg = "Identificación (frente) excede 10 MB.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, repIdFront: true }));
        return;
      }
      if (repIdBack && repIdBack.size > max) {
        const msg = "Identificación (reverso) excede 10 MB.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, repIdBack: true }));
        return;
      }
    } else {
      // Validación de documentos para persona física
      if (!cvFile) {
        const msg = "Sube tu CV (PDF o DOC).";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, cv: true }));
        return;
      }
      if ((letters?.length ?? 0) < 1) {
        const msg = "Sube al menos una carta de recomendación.";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, letters: true }));
        return;
      }
      if (!idFront || !idBack) {
        const msg = "Sube fotos de tu identificación (ambos lados).";
        setError(msg);
        toast.error(msg);
        setFileErrs((p) => ({ ...p, idFront: !idFront, idBack: !idBack }));
        return;
      }
    }
    if (!sigDirty) {
      const msg = "Firma requerida.";
      setError(msg);
      toast.error(msg);
      setFileErrs((p) => ({ ...p, sig: true }));
      return;
    }

    setLoading(true);
    try {
      // 1) Upload files
      const prefix = `${userId}/`;
      const uploads: Record<string, string | string[]> = {};
      if (empresa) {
        const compPrefix = `applications/${userId}/company/`;
        const docUp = await uploadViaApi(
          companyDoc!,
          `${compPrefix}doc-incorporation-${Date.now()}-${encodeURIComponent(companyDoc!.name)}`,
          "applications",
        );
        uploads.company_doc_incorporation_url = docUp.url;
        const csfUp = await uploadViaApi(
          companyCsf!,
          `${compPrefix}csf-${Date.now()}-${encodeURIComponent(companyCsf!.name)}`,
          "applications",
        );
        uploads.company_csf_url = csfUp.url;
        if (repIdFront) {
          const repFUp = await uploadViaApi(
            repIdFront,
            `${compPrefix}rep-id-front-${Date.now()}-${encodeURIComponent(repIdFront.name)}`,
            "applications",
          );
          uploads.company_rep_id_front_url = repFUp.url;
        }
        if (repIdBack) {
          const repBUp = await uploadViaApi(
            repIdBack,
            `${compPrefix}rep-id-back-${Date.now()}-${encodeURIComponent(repIdBack.name)}`,
            "applications",
          );
          uploads.company_rep_id_back_url = repBUp.url;
        }
      } else {
        // Persona física: subir CV, cartas y identificación (frente/reverso) al bucket por defecto
        const cvUp = await uploadViaApi(
          cvFile!,
          `${prefix}cv-${Date.now()}.${(cvFile!.name.split(".").pop() || "pdf").toLowerCase()}`,
        );
        uploads.cv_url = cvUp.url;
        const lettersUrls: string[] = [];
        for (const f of letters) {
          const up = await uploadViaApi(
            f,
            `${prefix}letter-${Date.now()}-${encodeURIComponent(f.name)}`,
          );
          lettersUrls.push(up.url);
        }
        uploads.letters_urls = lettersUrls;
        const idFrontUp = await uploadViaApi(
          idFront!,
          `${prefix}id-front-${Date.now()}-${encodeURIComponent(idFront!.name)}`,
        );
        const idBackUp = await uploadViaApi(
          idBack!,
          `${prefix}id-back-${Date.now()}-${encodeURIComponent(idBack!.name)}`,
        );
        uploads.id_front_url = idFrontUp.url;
        uploads.id_back_url = idBackUp.url;
      }
      const canvas = sigCanvasRef.current!;
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/png"),
      );
      const sigFile = new File([blob], "signature.png", { type: "image/png" });
      const sigUp = await uploadViaApi(
        sigFile,
        `${prefix}signature-${Date.now()}.png`,
      );
      uploads.signature_url = sigUp.url;

      // 2) Upsert profile and elevate to pro
      const profRes = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          city: cities[0],
          cities,
          years_experience: years ? Number(years) : undefined,
          categories: cat,
          subcategories: selectedSubcategories,
          bio: servicesDesc,
          empresa,
        }),
      });
      if (!profRes.ok) {
        const j = await profRes.json().catch(() => null);
        throw new Error(j?.error || "No se pudo guardar el perfil");
      }

      // 3) Send application to admins
      const appRes = await fetch("/api/pro-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          email,
          rfc,
          empresa,
          company_legal_name: companyLegalName || undefined,
          company_industry: companyIndustry || undefined,
          company_employees_count: companyEmployees ? Number(companyEmployees) : undefined,
          company_website: companyWebsite || undefined,
          services_desc: servicesDesc,
          cities,
          categories: cat,
          subcategories: selectedSubcategories,
          years_experience: Number(years),
          references: refsTrimmed,
          uploads,
          privacy_accept: true,
        }),
      });
      if (!appRes.ok) {
        const j = await appRes.json().catch(() => null);
        throw new Error(j?.error || "No se pudo enviar la postulación");
      }

      toast.success("¡Postulación enviada!");
      // Mark role as professional (active user type) best-effort and clear draft
      try {
        await fetch("/api/profile/active-user-type", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ to: "profesional" }),
        });
      } catch (_e) {
        void _e;
      }
      clearDraft("draft:apply-professional");
      clearGatingFlags();
      // Redirigir a página de confirmación
      window.location.href = "/pro-apply/submitted";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      toast.error(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {ok && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {ok}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-pink-300 bg-pink-50 p-3 text-sm text-pink-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">
          Ingresa los datos de tu postulación
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm mb-1">Nombre completo</label>
            <Input
              aria-invalid={fieldErrs.full_name}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono de contacto</label>
            <Input
              aria-invalid={fieldErrs.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10 dígitos"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Correo</label>
            <Input
              aria-invalid={fieldErrs.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">RFC</label>
            <Input
              aria-invalid={fieldErrs.rfc}
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              placeholder="RFC (12 o 13 caracteres)"
              inputMode="text"
              autoCapitalize="characters"
            />
            {fieldErrs.rfc && (
              <p className="text-xs text-pink-600 mt-1">Ingresa un RFC válido</p>
            )}
          </div>
          <div className="md:col-span-2">
            <CompanyToggle checked={empresa} onChange={setEmpresa} />
            <CompanyFields
              open={empresa}
              legalName={companyLegalName}
              setLegalName={setCompanyLegalName}
              industry={companyIndustry}
              setIndustry={setCompanyIndustry}
              employees={companyEmployees}
              setEmployees={setCompanyEmployees}
              website={companyWebsite}
              setWebsite={setCompanyWebsite}
              errors={{
                legalName: fieldErrs.company_legal_name,
                industry: fieldErrs.company_industry,
                employees: fieldErrs.company_employees_count,
                website: fieldErrs.company_website,
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Describe brevemente cuáles son los servicios que ofreces
            </label>
            <Textarea
              aria-invalid={fieldErrs.services_desc}
              rows={4}
              value={servicesDesc}
              onChange={(e) => setServicesDesc(e.target.value)}
              placeholder="Ej. Electricidad residencial, mantenimiento e instalaciones…"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Ciudades donde ofreces tus servicios
            </label>
            <MultiSelect
              placeholder="Selecciona ciudades"
              options={CITIES as unknown as string[]}
              value={selectedCities}
              onChange={setSelectedCities}
              error={fieldErrs.cities}
            />
            {fieldErrs.cities && (
              <p className="text-xs text-pink-600 mt-1">
                Selecciona al menos una ciudad
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">
              Categorías de servicios
            </label>
            <MultiSelect
              placeholder={
                loadingCats ? "Cargando categorías..." : "Selecciona categorías"
              }
              options={availableCategories}
              value={selectedCategories}
              onChange={setSelectedCategories}
              disabled={loadingCats}
              error={fieldErrs.categories}
            />
            {fieldErrs.categories && (
              <p className="text-xs text-pink-600 mt-1">
                Selecciona al menos una categoría
              </p>
            )}
            {selectedCategories.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-slate-700 mb-2">Subcategorías</p>
                <div className="space-y-2">
                  {selectedCategories.map((cat) => {
                    const subs = groupedSubcats[cat] || [];
                    if (subs.length === 0) return null;
                    return (
                      <details key={cat} className="rounded-md border bg-slate-50">
                        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{cat}</summary>
                        <div className="px-3 pb-3 pt-1">
                          <div className="flex items-center justify-end mb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const all = new Set<string>(selectedSubcategories);
                                subs.forEach((s) => all.add(s));
                                setSelectedSubcategories(Array.from(all));
                              }}
                            >
                              Seleccionar todas
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {subs.map((s) => {
                              const checked = selectedSubcategories.includes(s);
                              return (
                                <label key={s} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.currentTarget.checked
                                        ? Array.from(new Set([...selectedSubcategories, s]))
                                        : selectedSubcategories.filter((x) => x !== s);
                                      setSelectedSubcategories(next);
                                    }}
                                  />
                                  <span>{s}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm mb-1">
              Años de experiencia en el oficio
            </label>
            <Input
              aria-invalid={fieldErrs.years_experience}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
      </section>

      {!empresa && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Documentos</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm mb-1">Sube tu CV (PDF o DOC)</label>
              <Input
                className={cn(fileErrs.cv && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setCvFile(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Cartas de recomendación (al menos una)</label>
              <Input
                className={cn(fileErrs.letters && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => setLetters(Array.from(e.currentTarget.files ?? []))}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Identificación oficial (frente)</label>
              <Input
                className={cn(fileErrs.idFront && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="image/*"
                onChange={(e) => setIdFront(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Identificación oficial (reverso)</label>
              <Input
                className={cn(fileErrs.idBack && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="image/*"
                onChange={(e) => setIdBack(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
          </div>
        </section>
      )}

      <SlideDown open={empresa}>
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Documentos de empresa</h2>
          <p className="text-xs text-slate-600 mb-3">Tamaño máximo 10 MB por archivo. Formatos: PDF, JPG o PNG.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm mb-1">Acta constitutiva</label>
              <Input
                className={cn(fileErrs.companyDoc && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setCompanyDoc(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Constancia de situación fiscal (CSF)</label>
              <Input
                className={cn(fileErrs.companyCsf && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setCompanyCsf(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Identificación representante legal (frente)</label>
              <Input
                className={cn(fileErrs.repIdFront && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setRepIdFront(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Identificación representante legal (reverso)</label>
              <Input
                className={cn(fileErrs.repIdBack && "border-pink-500 focus-visible:ring-pink-500/50")}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setRepIdBack(e.currentTarget.files?.[0] ?? null)}
              />
            </div>
          </div>
        </section>
      </SlideDown>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">Referencias laborales</h2>
        <p className="text-xs text-slate-600 mb-3">
          Ingresa datos de personas que puedan confirmar tu experiencia (exjefes
          o clientes).
        </p>
        <div className="space-y-3">
          {refs.map((r, idx) => (
            <div key={idx} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  className={cn(
                    refErrs[idx]?.name &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder="Nombre"
                  value={r.name}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  className={cn(
                    refErrs[idx]?.phone &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder="Teléfono"
                  value={r.phone}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, phone: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Input
                  className={cn(
                    refErrs[idx]?.relation &&
                      "border-pink-500 focus-visible:ring-pink-500/50",
                  )}
                  placeholder={empresa ? "ej. Proveedor o Cliente" : "Relación (ej. jefe anterior)"}
                  value={r.relation}
                  onChange={(e) =>
                    setRefs((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, relation: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
              {idx < 2 ? <Separator className="my-2" /> : null}
            </div>
          ))}
        </div>
      </section>

      {!empresa && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold">Facturación</h2>
          <div className="space-y-3">
            <CompanyToggle
              id="billing-self"
              checked={canInvoiceSelf}
              onChange={(v) => {
                setCanInvoiceSelf(v);
                if (v) setAuthorizeHandi(false);
              }}
              label="Tengo facultad de elaborar las facturas de mis servicios"
            />
            {!canInvoiceSelf && (
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CompanyToggle
                  id="billing-authorize"
                  checked={authorizeHandi}
                  onChange={setAuthorizeHandi}
                  label="Autorizo que Handi elabore las facturas de mis servicios"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="/politicas-facturacion"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline text-slate-700 hover:text-slate-900 sm:ml-3"
                    >
                      ¿Qué es esto?
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top">ir a Políticas de Facturación</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">
          Aviso de privacidad y firma
        </h2>
        <div className="space-y-2">
          <label className="block cursor-pointer">
            <div
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all",
                "hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-300",
                fieldErrs.privacy_accept
                  ? "border-pink-500 ring-1 ring-pink-500/40"
                  : "border-slate-200",
              )}
            >
              <input
                id="privacy-accept"
                type="checkbox"
                className="peer sr-only"
                checked={privacy}
                onChange={(e) => setPrivacy(e.currentTarget.checked)}
                aria-invalid={fieldErrs.privacy_accept}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border shadow-inner transition-all",
                  privacy ? "bg-emerald-500 border-emerald-600" : "bg-white border-slate-300",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  focusable="false"
                  className={cn(
                    "h-3.5 w-3.5 origin-center transition-all duration-200",
                    privacy ? "opacity-100 scale-100" : "opacity-0 scale-75",
                  )}
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm leading-5">
                He leído y acepto el{' '}
                <a
                  className="underline"
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Aviso de Privacidad
                </a>{' '}
                y autorizo a Handi a verificar mis datos para validar mi perfil profesional.
              </span>
            </div>
          </label>
          {fieldErrs.privacy_accept && (
            <p className="text-xs text-pink-600">Debes aceptar el Aviso de Privacidad</p>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm mb-2">Firma</p>
          <div className="flex justify-center sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSigOpen(true)}
              className={cn(fileErrs.sig && "border-pink-500 focus-visible:ring-pink-500/50")}
            >
              Firma
            </Button>
            {sigPreviewUrl && (
              <div className="mt-3">
                <img
                  src={sigPreviewUrl}
                  alt="Firma"
                  className="h-20 w-auto max-w-full rounded-md border bg-white"
                />
              </div>
            )}
            {fileErrs.sig && (
              <p className="text-xs text-pink-600 mt-2">Firma requerida</p>
            )}
          </div>
          {/* Hidden persistent canvas to keep the signature for upload */}
          <canvas ref={sigCanvasRef} width={640} height={180} className="hidden" />
          <Dialog open={sigOpen} onOpenChange={setSigOpen}>
            <DialogContent className="sm:max-w-xl">
              <div className="space-y-3">
                <div className="rounded-lg border bg-slate-50 p-2">
                  <canvas
                    ref={sigDialogCanvasRef}
                    width={640}
                    height={180}
                    className="w-full touch-none cursor-crosshair select-none"
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button type="button" variant="outline" onClick={clearDialogSignature}>
                    Borrar
                  </Button>
                  <Button type="button" onClick={acceptSignature}>
                    Aceptar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <div className="pt-1">
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando…" : "Enviar postulación"}
        </Button>
      </div>
    </form>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  error,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  const label =
    value.length === 0
      ? placeholder || "Selecciona"
      : value.length <= 3
        ? value.join(", ")
        : `${value.length} seleccionadas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60",
            error && "border-pink-500 focus-visible:ring-pink-500/50",
          )}
        >
          <span className="truncate block">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="max-h-64 overflow-auto space-y-2">
          {options.map((opt) => {
            const checked = value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const v = e.currentTarget.checked
                      ? Array.from(new Set([...value, opt]))
                      : value.filter((x) => x !== opt);
                    onChange(v);
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="text-xs text-slate-500">Sin opciones</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
