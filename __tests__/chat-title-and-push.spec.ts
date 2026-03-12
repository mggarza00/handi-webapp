import { describe, expect, it } from "vitest";

import {
  getSafeChatTitle,
  isLikelyUuidishLabel,
  pickBestChatTitle,
} from "@/lib/chat/chat-title";
import {
  buildChatPushPayload,
  resolvePushAvatarIconUrl,
} from "@/lib/chat/push-payload";

describe("chat title helpers", () => {
  it("detects uuid-ish labels", () => {
    expect(isLikelyUuidishLabel("a4051395-1234-1234-1234-1234567890ab")).toBe(
      true,
    );
    expect(isLikelyUuidishLabel("a4051395...")).toBe(true);
    expect(isLikelyUuidishLabel("Mariana Lopez")).toBe(false);
  });

  it("keeps the best human title during merges", () => {
    expect(pickBestChatTitle("Mariana Lopez", "Contacto")).toBe(
      "Mariana Lopez",
    );
    expect(pickBestChatTitle("Mariana Lopez", "a4051395...")).toBe(
      "Mariana Lopez",
    );
    expect(pickBestChatTitle("Contacto", "Alicia Perez")).toBe("Alicia Perez");
  });

  it("uses generic safe fallback before short id", () => {
    expect(getSafeChatTitle("", "a4051395-1234-1234-1234-1234567890ab")).toBe(
      "Contacto",
    );
    expect(
      getSafeChatTitle("Carla Gomez", "a4051395-1234-1234-1234-1234567890ab"),
    ).toBe("Carla Gomez");
  });
});

describe("chat push payload", () => {
  it("uses sender name and avatar when available", () => {
    const payload = buildChatPushPayload({
      conversationId: "conv-1",
      senderName: "Carla Gomez",
      senderAvatarUrl: "https://cdn.example.com/avatar.png",
      messageBody: "Hola, ya te respondi",
      attachmentsCount: 0,
    });
    expect(payload.title).toBe("Carla Gomez");
    expect(payload.body).toBe("Hola, ya te respondi");
    expect(payload.icon).toBe("https://cdn.example.com/avatar.png");
    expect(payload.data.url).toBe("/mensajes/conv-1");
    expect(payload.tag).toBe("thread:conv-1");
  });

  it("falls back safely when sender data is missing", () => {
    const payload = buildChatPushPayload({
      conversationId: "conv-2",
      senderName: "",
      senderAvatarUrl: "",
      messageBody: "",
      attachmentsCount: 1,
    });
    expect(payload.title).toBe("Nuevo mensaje");
    expect(payload.body).toBe("Te envio un archivo");
    expect(payload.icon).toBe("/icons/icon-192.png");
    expect(payload.badge).toBe("/icons/badge-72.png");
    expect(payload.url).toBe("/mensajes/conv-2");
  });

  it("normalizes relative storage avatar paths to absolute push icon urls", () => {
    const icon = resolvePushAvatarIconUrl(
      "public/avatars/user-1.png",
      "https://handi.mx",
    );
    expect(icon).toBe(
      "https://handi.mx/storage/v1/object/public/avatars/user-1.png",
    );
  });

  it("falls back to generic icon when avatar url is invalid", () => {
    const icon = resolvePushAvatarIconUrl("undefined", "https://handi.mx");
    expect(icon).toBe("https://handi.mx/icons/icon-192.png");
  });

  it("keeps absolute public avatar when already valid", () => {
    const icon = resolvePushAvatarIconUrl(
      "https://cdn.example.com/u/avatar.png",
      "https://handi.mx",
    );
    expect(icon).toBe("https://cdn.example.com/u/avatar.png");
  });
});
