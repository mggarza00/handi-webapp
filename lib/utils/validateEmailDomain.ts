export const isBlockedDomain = (email: string) => {
  const blocked = ["test.com", "example.com", "mailinator.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return blocked.includes(domain);
};
