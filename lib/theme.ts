export const THEME_STORAGE_KEY = "lifeos_theme";
export type AppTheme = "dark" | "light";
export const DEFAULT_THEME: AppTheme = "dark";
export const THEME_CHANGE_EVENT = "lifeos:theme-change";

function normalizeTheme(value: string | null | undefined): AppTheme {
  return value === "light" ? "light" : "dark";
}

export function readDocumentTheme(): AppTheme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.dataset.theme);
}

export function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") return;
  const resolved = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    // Ignore storage errors (private mode / blocked storage).
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function subscribeToThemeChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = () => onChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export const THEME_INIT_SCRIPT = `(() => {
  try {
    const key = "${THEME_STORAGE_KEY}";
    const stored = window.localStorage.getItem(key);
    const theme = stored === "light" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    const root = document.documentElement;
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
  }
})();`;
