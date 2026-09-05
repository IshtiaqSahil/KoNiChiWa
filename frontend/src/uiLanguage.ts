import { Language } from "./api";
import { UI_LANGUAGES } from "./i18n";

export const LOCALE_KEY = "verity.ui-language";

// Shared by App.tsx, VerifyPage.tsx, and CertificationsPage.tsx - each is
// an independent entry point (see main.tsx's hand-rolled routing), so
// there's no shared React tree to lift this into instead.
export function loadUiLanguage(): Language {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && (UI_LANGUAGES as string[]).includes(stored)) return stored as Language;
  } catch {
    // Private-mode / blocked storage: fall through to the default.
  }
  return "en";
}
