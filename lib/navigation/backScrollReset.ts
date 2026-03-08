const BACK_SCROLL_RESET_KEY = "lifeos_back_scroll_to_top";
const BACK_SCROLL_RESTORE_MODE_KEY = "lifeos_back_scroll_restore_mode";

type ScrollRestorationMode = History["scrollRestoration"];
let pendingBackScrollReset = false;

export function markBackNavigationScrollReset(): void {
  pendingBackScrollReset = true;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(BACK_SCROLL_RESET_KEY, "1");
  } catch {
    // Ignore storage failures and keep default browser behavior.
  }
}

export function consumeBackNavigationScrollReset(): boolean {
  const hadPendingFlag = pendingBackScrollReset;
  pendingBackScrollReset = false;

  if (typeof window === "undefined") {
    return hadPendingFlag;
  }

  try {
    const shouldReset = window.sessionStorage.getItem(BACK_SCROLL_RESET_KEY) === "1";
    if (shouldReset) {
      window.sessionStorage.removeItem(BACK_SCROLL_RESET_KEY);
    }
    return shouldReset || hadPendingFlag;
  } catch {
    return hadPendingFlag;
  }
}

export function prepareBackNavigationScrollReset(): void {
  if (typeof window === "undefined") {
    return;
  }

  markBackNavigationScrollReset();

  if (!("scrollRestoration" in window.history)) {
    return;
  }

  try {
    window.sessionStorage.setItem(BACK_SCROLL_RESTORE_MODE_KEY, window.history.scrollRestoration);
  } catch {
    // Ignore storage failures and keep default browser behavior.
  }

  try {
    window.history.scrollRestoration = "manual";
  } catch {
    // Ignore unsupported environments.
  }
}

export function restoreBackNavigationScrollBehavior(): void {
  pendingBackScrollReset = false;

  if (typeof window === "undefined" || !("scrollRestoration" in window.history)) {
    return;
  }

  let nextMode: ScrollRestorationMode = "auto";
  try {
    const savedMode = window.sessionStorage.getItem(BACK_SCROLL_RESTORE_MODE_KEY);
    if (savedMode === "manual" || savedMode === "auto") {
      nextMode = savedMode;
    }
    window.sessionStorage.removeItem(BACK_SCROLL_RESTORE_MODE_KEY);
  } catch {
    // Ignore storage failures and fall back to "auto".
  }

  try {
    window.history.scrollRestoration = nextMode;
  } catch {
    // Ignore unsupported environments.
  }
}
