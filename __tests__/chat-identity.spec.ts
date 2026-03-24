import { describe, expect, it } from "vitest";

import {
  CHAT_AVATAR_PLACEHOLDER,
  hasUsableAvatar,
  isPlaceholderAvatar,
  isPlaceholderChatTitle,
  pickBetterChatIdentity,
} from "@/lib/chat/chat-identity";

describe("chat identity helpers", () => {
  it("detects placeholder titles", () => {
    expect(isPlaceholderChatTitle("Contacto")).toBe(true);
    expect(isPlaceholderChatTitle("a4051395...")).toBe(true);
    expect(isPlaceholderChatTitle("Mariana Lopez")).toBe(false);
  });

  it("detects usable avatars", () => {
    expect(hasUsableAvatar(null)).toBe(false);
    expect(hasUsableAvatar("/images/Favicon-v1-jpeg.jpg")).toBe(false);
    expect(hasUsableAvatar("/images/handifav_sinfondo.png")).toBe(false);
    expect(hasUsableAvatar("https://cdn.example.com/avatar.png")).toBe(true);
  });

  it("detects placeholders across normalized/public paths", () => {
    expect(isPlaceholderAvatar("/images/LOGO_HANDI_DB.png")).toBe(true);
    expect(
      isPlaceholderAvatar(
        "https://example.supabase.co/storage/v1/object/public/images/Favicon-v1-jpeg.jpg",
      ),
    ).toBe(true);
    expect(isPlaceholderAvatar("https://cdn.example.com/real-avatar.jpg")).toBe(
      false,
    );
  });

  it("never degrades human name/avatar with placeholders", () => {
    const result = pickBetterChatIdentity(
      {
        title: "Alicia Perez",
        avatarUrl: "https://cdn.example.com/alicia.png",
      },
      {
        title: "Contacto",
        avatarUrl: null,
      },
    );
    expect(result.title).toBe("Alicia Perez");
    expect(result.avatarUrl).toBe("https://cdn.example.com/alicia.png");
  });

  it("upgrades placeholder identity with better incoming data", () => {
    const result = pickBetterChatIdentity(
      { title: "Contacto", avatarUrl: null },
      {
        title: "Carlos Ruiz",
        avatarUrl: "https://cdn.example.com/carlos.png",
      },
    );
    expect(result.title).toBe("Carlos Ruiz");
    expect(result.avatarUrl).toBe("https://cdn.example.com/carlos.png");
  });

  it("does not let placeholder avatar replace a real one", () => {
    const result = pickBetterChatIdentity(
      {
        title: "Mauricio Garza",
        avatarUrl: "https://cdn.example.com/mauricio.jpg",
      },
      {
        title: "Mauricio Garza",
        avatarUrl: CHAT_AVATAR_PLACEHOLDER,
      },
    );
    expect(result.avatarUrl).toBe("https://cdn.example.com/mauricio.jpg");
  });
});
