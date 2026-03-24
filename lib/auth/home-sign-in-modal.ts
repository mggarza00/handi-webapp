export const HOME_SIGN_IN_MODAL_OPEN_EVENT = "handi:home-sign-in-modal-open";

export function openHomeSignInModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_SIGN_IN_MODAL_OPEN_EVENT));
}
