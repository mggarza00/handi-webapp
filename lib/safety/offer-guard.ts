import { getContactPolicy, getContactPolicyMessage } from "@/lib/safety/policy";
import { redactContact, scanContact } from "@/lib/safety/contact-guard";

type OfferFields = {
  title: string;
  description?: string | null;
};

type GuardOk = { ok: true; payload: OfferFields; redacted?: boolean };
type GuardFail = { ok: false; error: string; message: string; findings: ReturnType<typeof scanContact>["findings"] };

export function validateOfferFields(input: OfferFields): GuardOk | GuardFail {
  const text = `${input.title || ""}\n${input.description || ""}`;
  const scan = scanContact(text);
  const policy = getContactPolicy();
  if (!scan.findings.length || policy === "ignore") {
    return { ok: true, payload: input };
  }

  if (policy === "block") {
    return {
      ok: false,
      error: "CONTACT_BLOCKED",
      message: getContactPolicyMessage(),
      findings: scan.findings,
    };
  }

  const redTitle = redactContact(input.title || "");
  const redDesc = input.description ? redactContact(input.description) : null;
  return {
    ok: true,
    payload: {
      title: redTitle.sanitized,
      description: redDesc ? redDesc.sanitized : input.description ?? null,
    },
    redacted: true,
  };
}
