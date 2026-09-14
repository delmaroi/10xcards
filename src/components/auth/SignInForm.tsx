import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Lock, LogIn } from "lucide-react";
import { getErrorI18nKey } from "@/lib/i18n/api-errors";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";

interface Props {
  serverError?: string | null;
  locale: SupportedLocale;
}

export default function SignInForm({ locale, ...props }: Props) {
  return (
    <I18nProvider locale={locale}>
      <SignInFormInner {...props} />
    </I18nProvider>
  );
}

function SignInFormInner({ serverError }: Omit<Props, "locale">) {
  const { t } = useTranslation("auth");
  const translatedError = serverError ? t(getErrorI18nKey(serverError)) : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = t("form.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("form.emailInvalid");
    }
    if (!password) {
      next.password = t("form.passwordRequired");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={t("form.email")}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={t("form.emailPlaceholder")}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label={t("form.password")}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={t("form.passwordPlaceholder")}
        error={errors.password}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <ServerError message={translatedError} />

      <SubmitButton pendingText={t("signin.buttonPending")} icon={<LogIn className="size-4" />}>
        {t("signin.button")}
      </SubmitButton>
    </form>
  );
}
