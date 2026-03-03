"use client";

import { useMemo } from "react";
import { getInitialLang, setLang, t, type Lang, type Locale } from "@/lib/i18n";

type LanguageToggleProps = {
  className?: string;
  value?: Locale;
  onChange?: (lang: Lang) => void;
};

export function LanguageToggle({ className = "", value, onChange }: LanguageToggleProps) {
  const currentLang =
    typeof window === "undefined" ? "en" : getInitialLang(new URLSearchParams(window.location.search).get("lang"));
  const activeLang = value ?? currentLang;

  const setLanguage = (lang: Lang) => {
    setLang(lang);
    onChange?.(lang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.location.assign(url.toString());
    }
  };

  const labels = useMemo(
    () => ({
      en: t("eng", activeLang),
      ru: t("ru", activeLang),
    }),
    [activeLang],
  );

  return (
    <div className={`inline-flex rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-xs ${className}`}>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`rounded px-2 py-1 transition ${activeLang === "en" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
        aria-label="Switch language to English"
      >
        {labels.en}
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ru")}
        className={`rounded px-2 py-1 transition ${activeLang === "ru" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
        aria-label="Switch language to Russian"
      >
        {labels.ru}
      </button>
    </div>
  );
}
