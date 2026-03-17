export type ConversionEventName =
  | "request_created"
  | "pro_apply_submitted"
  | "contact_intent";

export type ConversionUserType = "client" | "pro" | "admin" | "unknown";

type BaseConversionInput = {
  event_id?: string;
  source_page?: string;
  user_type?: ConversionUserType;
  request_id?: string;
  profile_id?: string;
  conversation_id?: string;
  service_category?: string;
  service_subcategory?: string;
  city?: string;
  placement?: string;
  intent_channel?: "chat_start";
};

const MODEL_VERSION = "v1";

function cleanString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function buildConversionEventId(
  event: ConversionEventName,
  ids: {
    request_id?: string;
    profile_id?: string;
    conversation_id?: string;
    seed?: string;
  } = {},
): string {
  const stableSeed =
    cleanString(ids.conversation_id) ||
    cleanString(ids.request_id) ||
    cleanString(ids.profile_id) ||
    cleanString(ids.seed);

  if (stableSeed) {
    return `${event}:${stableSeed}`;
  }

  const nonce = Math.random().toString(36).slice(2, 10);
  return `${event}:${Date.now()}:${nonce}`;
}

export function buildConversionPayload(
  event: ConversionEventName,
  input: BaseConversionInput,
): Record<string, string | number | boolean | null | undefined> {
  const requestId = cleanString(input.request_id);
  const profileId = cleanString(input.profile_id);
  const conversationId = cleanString(input.conversation_id);
  const sourcePage = cleanString(input.source_page);
  const serviceCategory = cleanString(input.service_category);
  const serviceSubcategory = cleanString(input.service_subcategory);
  const city = cleanString(input.city);
  const placement = cleanString(input.placement);

  const eventId =
    cleanString(input.event_id) ||
    buildConversionEventId(event, {
      request_id: requestId,
      profile_id: profileId,
      conversation_id: conversationId,
    });

  return {
    conversion_name: event,
    conversion_value_tier: "primary",
    conversion_model_version: MODEL_VERSION,
    conversion_transport_ready: "client_now_server_ready",
    event_id: eventId,
    source_page: sourcePage,
    user_type: input.user_type ?? "unknown",
    request_id: requestId,
    profile_id: profileId,
    conversation_id: conversationId,
    service_category: serviceCategory,
    service_subcategory: serviceSubcategory,
    city,
    placement,
    intent_channel: input.intent_channel,
  };
}
