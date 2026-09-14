import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n/constants";

interface I18nProviderProps {
  locale: SupportedLocale;
  children: React.ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  // Per-island instance cloned with the target locale. cloneInstance shares the
  // resource store with the singleton (no reload) but keeps its own language, so
  // SSR renders in the right locale without mutating global state across
  // concurrent requests in the same worker isolate.
  const [instance] = useState(() => i18n.cloneInstance({ lng: locale }));

  useEffect(() => {
    if (instance.language !== locale) {
      void instance.changeLanguage(locale);
    }
  }, [instance, locale]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
