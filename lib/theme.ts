export const THEME_STORAGE_KEY = "lifeos_theme";
export type AppTheme = "dark" | "light";
export const DEFAULT_THEME: AppTheme = "dark";

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
