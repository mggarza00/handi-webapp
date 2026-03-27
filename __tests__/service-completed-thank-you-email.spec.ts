import { describe, expect, it } from "vitest";

import {
  renderServiceCompletedThankYouEmailHtml,
  renderServiceCompletedThankYouEmailText,
} from "@/lib/emails/service-completed-thank-you-email";

describe("service completed thank-you email", () => {
  it("renders a warm follow-up email with summary and photo thumbnails", () => {
    const html = renderServiceCompletedThankYouEmailHtml({
      name: "Mariana",
      requestTitle: "Instalacion de lamparas",
      professionalName: "Carlos Perez",
      serviceDateLabel: "jueves 27 de marzo",
      photoUrls: [
        "https://cdn.handi.mx/photo-1.jpg",
        "https://cdn.handi.mx/photo-2.jpg",
      ],
      supportEmail: "soporte@handi.mx",
    });

    expect(html).toContain("Gracias por confiar en Handi");
    expect(html).toContain("Instalacion de lamparas");
    expect(html).toContain("Carlos Perez");
    expect(html).toContain("https://cdn.handi.mx/photo-1.jpg");
    expect(html).toContain("https://cdn.handi.mx/photo-2.jpg");
    expect(html).toContain("soporte@handi.mx");
    expect(html).toContain("Resumen del servicio");
  });

  it("renders cleanly without photos", () => {
    const html = renderServiceCompletedThankYouEmailHtml({
      name: "Mariana",
      requestTitle: null,
      professionalName: null,
      serviceDateLabel: null,
      photoUrls: [],
    });

    expect(html).toContain("tu servicio");
    expect(html).toContain("Profesional Handi");
    expect(html).not.toContain("Referencias del trabajo realizado");
  });

  it("renders a usable text fallback", () => {
    const text = renderServiceCompletedThankYouEmailText({
      name: "Mariana",
      requestTitle: "Instalacion de lamparas",
      professionalName: "Carlos Perez",
      serviceDateLabel: "jueves 27 de marzo",
      photoUrls: ["https://cdn.handi.mx/photo-1.jpg"],
      supportEmail: "soporte@handi.mx",
    });

    expect(text).toContain("Gracias por confiar en Handi.");
    expect(text).toContain("Servicio: Instalacion de lamparas");
    expect(text).toContain("Profesional: Carlos Perez");
    expect(text).toContain("Fotos de referencia registradas: 1");
    expect(text).toContain("soporte@handi.mx");
  });
});
