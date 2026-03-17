export type MyProfileRole = "client" | "pro" | "admin" | null | undefined;

export function getMyProfileHref({
  role,
  userId,
}: {
  role: MyProfileRole;
  userId?: string | null;
}): string {
  if (role === "pro" && userId) return `/profiles/${userId}`;
  return "/me";
}
