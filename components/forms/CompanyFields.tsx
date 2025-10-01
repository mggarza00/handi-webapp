"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import SlideDown from "./SlideDown";

type Props = {
  open: boolean;
  legalName: string;
  setLegalName: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  employees: string;
  setEmployees: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  errors?: {
    legalName?: boolean;
    industry?: boolean;
    employees?: boolean;
    website?: boolean;
  };
};

export default function CompanyFields({ open, legalName, setLegalName, industry, setIndustry, employees, setEmployees, website, setWebsite, errors }: Props) {
  return (
    <SlideDown open={open} id="company-fields">
      <div className="pt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm mb-1">Razón social</label>
          <Input
            aria-invalid={!!errors?.legalName}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Nombre legal de la empresa"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Giro o sector</label>
          <Input
            aria-invalid={!!errors?.industry}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Ej. Construcción, Servicios, Mantenimiento"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Número de empleados (opcional)</label>
          <Input
            aria-invalid={!!errors?.employees}
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            inputMode="numeric"
            placeholder="Ej. 10"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Sitio (opcional)</label>
          <Input
            aria-invalid={!!errors?.website}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.handi.mx"
          />
        </div>
      </div>
    </SlideDown>
  );
}
