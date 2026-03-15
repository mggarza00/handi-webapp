const DEFAULT_SUPPORT_EMAIL = "soporte@handi.mx";
const DEFAULT_SUPPORT_WHATSAPP_NUMBER = "528130878691";
const DEFAULT_SUPPORT_WHATSAPP_DISPLAY = "81 3087 8691";

function formatWhatsappDisplay(number: string): string | null {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("52")) {
    const local = digits.slice(2);
    return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6, 10)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;
  }
  return null;
}

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
export const SUPPORT_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_SUPPORT_WHATSAPP_NUMBER;
export const SUPPORT_WHATSAPP_DISPLAY =
  formatWhatsappDisplay(SUPPORT_WHATSAPP_NUMBER) ||
  DEFAULT_SUPPORT_WHATSAPP_DISPLAY;
export const SUPPORT_WHATSAPP_LINK = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
