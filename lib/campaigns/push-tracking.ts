import { createHmac, timingSafeEqual } from "node:crypto";

type PushTrackingTokenInput = {
  campaignId: string;
  messageId: string | null;
  publishJobId: string;
  subscriptionId: string;
  targetUserId: string | null;
  dispatchId: string;
};

function getTrackingSecret() {
  return (
    process.env.CAMPAIGN_SIGNAL_SECRET ||
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY ||
    ""
  ).trim();
}

function serializeTrackingFields(input: PushTrackingTokenInput) {
  return [
    input.campaignId,
    input.messageId || "",
    input.publishJobId,
    input.subscriptionId,
    input.targetUserId || "",
    input.dispatchId,
  ].join(":");
}

export function canSignPushTrackingTokens() {
  return Boolean(getTrackingSecret());
}

export function createPushTrackingToken(input: PushTrackingTokenInput) {
  const secret = getTrackingSecret();
  if (!secret) return null;

  return createHmac("sha256", secret)
    .update(serializeTrackingFields(input))
    .digest("hex");
}

export function verifyPushTrackingToken(
  input: PushTrackingTokenInput,
  token: string | null | undefined,
) {
  if (!token) return false;

  const expected = createPushTrackingToken(input);
  if (!expected) return false;

  const expectedBuffer = Buffer.from(expected, "hex");
  const tokenBuffer = Buffer.from(token, "hex");
  if (expectedBuffer.length !== tokenBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, tokenBuffer);
}
