"use client";

import type { MouseEvent } from "react";

const themeStorageKey = "de-imoveis-theme";
const themes = ["light", "dark", "logo"] as const;
const themeLabels = {
  light: "tema claro",
  dark: "tema escuro",
  logo: "cores do logo",
};

export function ThemeToggle() {
  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const currentTheme = document.documentElement.dataset.estateTheme;
    const currentIndex = themes.indexOf(currentTheme as (typeof themes)[number]);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    document.documentElement.dataset.estateTheme = nextTheme;
    const followingTheme = themes[(themes.indexOf(nextTheme) + 1) % themes.length];
    const activeLabel = nextTheme === "logo" ? "Cores do logo ativas" : `Tema ${themeLabels[nextTheme]} ativo`;
    event.currentTarget.setAttribute("aria-label", `${activeLabel}. Clique para ativar ${themeLabels[followingTheme]}.`);
    event.currentTarget.title = `Ativar ${themeLabels[followingTheme]}`;
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // A preferência ainda se aplica nesta página se o navegador bloquear o armazenamento.
    }
  }

  return (
    <button
      className="estate-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar entre tema claro, escuro e cores do logo"
      title="Alternar entre tema claro, escuro e cores do logo"
    >
      <svg className="estate-theme-toggle__sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg className="estate-theme-toggle__moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.2 15.4A8.7 8.7 0 0 1 8.6 3.8 8.8 8.8 0 1 0 20.2 15.4Z" />
      </svg>
      <svg className="estate-theme-toggle__palette" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18h1.2a2.1 2.1 0 0 0 1.5-3.6 1.7 1.7 0 0 1 1.2-2.9H18a3 3 0 0 0 3-3c0-4.7-4-8.5-9-8.5Z" />
        <circle cx="7.5" cy="11" r=".8" /><circle cx="10" cy="7.5" r=".8" /><circle cx="14" cy="7.5" r=".8" />
      </svg>
    </button>
  );
}
