import type { SupportedLocale } from "./constants";

export const ui = {
  en: {
    "app.title": "10x Cards - MJ",
    "banner.attention": "Attention:",
    "banner.docs": "Documentation",
    "nav.dashboard": "Dashboard",
    "nav.settings": "Settings",
    "nav.signout": "Sign out",
    "nav.signingOut": "Signing out...",
    "auth.signin": "Sign in",
    "auth.signup": "Sign up",
    "auth.noAccount": "Don't have an account?",
    "auth.hasAccount": "Already have an account?",
    "auth.registrationSuccessful": "Registration successful",
    "auth.registrationSuccessfulDesc": "Your account has been created. You can now sign in.",
    "auth.goToSignIn": "Go to sign in",
    "auth.checkYourEmail": "Check your email",
    "auth.checkYourEmailDesc":
      "We've sent a confirmation link to your email address. Click it to activate your account.",
    "auth.backToSignIn": "Back to sign in",
    "dashboard.title": "Dashboard",
    "settings.title": "Settings",
    "lookup.title": "Look up word",
    "lookup_de.title": "Look up a German word",
    "set.errorLoading": "Failed to load sets. Please try again later.",
    "set.failedToLoad": "Failed to load set. Please try again later.",
    "set.notFound": "Set not found",
    "set.notFoundDesc": "This set doesn't exist or you don't have access to it.",
    "set.backToDashboard": "Back to dashboard",
    "config.supabaseNotConfigured": "Supabase is not configured — authentication features are disabled.",
    "config.setupInstructions": "Setup instructions",
  },
  pl: {
    "app.title": "10x Cards - MJ",
    "banner.attention": "Uwaga:",
    "banner.docs": "Dokumentacja",
    "nav.dashboard": "Dashboard",
    "nav.settings": "Ustawienia",
    "nav.signout": "Wyloguj się",
    "nav.signingOut": "Wylogowywanie...",
    "auth.signin": "Zaloguj się",
    "auth.signup": "Zarejestruj się",
    "auth.noAccount": "Nie masz konta?",
    "auth.hasAccount": "Masz już konto?",
    "auth.registrationSuccessful": "Rejestracja zakończona",
    "auth.registrationSuccessfulDesc": "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
    "auth.goToSignIn": "Przejdź do logowania",
    "auth.checkYourEmail": "Sprawdź swoją pocztę",
    "auth.checkYourEmailDesc": "Wysłaliśmy link potwierdzający na Twój adres email. Kliknij go, aby aktywować konto.",
    "auth.backToSignIn": "Wróć do logowania",
    "dashboard.title": "Dashboard",
    "settings.title": "Ustawienia",
    "lookup.title": "Wyszukaj słowo",
    "lookup_de.title": "Wyszukaj słowo niemieckie",
    "set.errorLoading": "Nie udało się załadować zestawów. Spróbuj ponownie później.",
    "set.failedToLoad": "Nie udało się załadować zestawu. Spróbuj ponownie później.",
    "set.notFound": "Nie znaleziono zestawu",
    "set.notFoundDesc": "Ten zestaw nie istnieje lub nie masz do niego dostępu.",
    "set.backToDashboard": "Wróć do panelu",
    "config.supabaseNotConfigured": "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    "config.setupInstructions": "Zobacz instrukcję konfiguracji",
  },
} as const;

export function getTranslations(lang: SupportedLocale) {
  const langUi = ui[lang] as Record<string, string>;
  const enUi = ui.en as Record<string, string>;
  return function t(key: string): string {
    return langUi[key] || enUi[key] || key;
  };
}
