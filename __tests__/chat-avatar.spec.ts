import { describe, expect, it } from "vitest";

import { resolveChatAvatarSrc } from "@/lib/chat/chat-avatar";
import { CHAT_AVATAR_PLACEHOLDER } from "@/lib/chat/chat-identity";

describe("chat avatar fallback", () => {
  it("returns placeholder when avatar is missing", () => {
    expect(resolveChatAvatarSrc(null)).toBe(CHAT_AVATAR_PLACEHOLDER);
    expect(resolveChatAvatarSrc(undefined)).toBe(CHAT_AVATAR_PLACEHOLDER);
    expect(resolveChatAvatarSrc("")).toBe(CHAT_AVATAR_PLACEHOLDER);
  });

  it("returns placeholder when avatar is a known placeholder", () => {
    expect(resolveChatAvatarSrc("/images/Favicon-v1-jpeg.jpg")).toBe(
      CHAT_AVATAR_PLACEHOLDER,
    );
    expect(resolveChatAvatarSrc("/images/LOGO_HANDI_DB.png")).toBe(
      CHAT_AVATAR_PLACEHOLDER,
    );
  });

  it("keeps a real avatar url", () => {
    const real = "https://cdn.example.com/avatar.png";
    expect(resolveChatAvatarSrc(real)).toBe(real);
  });
});
