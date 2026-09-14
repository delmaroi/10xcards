import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Lock, UserPlus } from "lucide-react";
import { getErrorI18nKey } from "@/lib/i18n/api-errors";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
  locale: SupportedLocale;
}

export default function SignUpForm({ locale, ...props }: Props) {
  return (
    <I18nProvider locale={locale}>
      <SignUpFormInner {...props} />
    </I18nProvider>
  );
}

function SignUpFormInner({ serverError }: Omit<Props, "locale">) {
  const { t } = useTranslation("auth");
  const translatedError = serverError ? t(getErrorI18nKey(serverError)) : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  function validate() {
    const next: typeof errors = {};

    if (!email.trim()) {
      next.email = t("form.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("form.emailInvalid");
    }

    if (!password) {
      next.password = t("form.passwordRequired");
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t("form.passwordMinLength", { min: MIN_PASSWORD_LENGTH });
    }

    if (!confirmPassword) {
      next.confirmPassword = t("form.passwordConfirmRequired");
    } else if (password !== confirmPassword) {
      next.confirmPassword = t("form.passwordsDoNotMatch");
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

  const passwordHint =
    !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="mt-1 text-xs text-blue-100/50">
        {t("form.charactersNeeded", { count: MIN_PASSWORD_LENGTH - password.length })}
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder={t("form.passwordMinPlaceholder")}
        error={errors.password}
        hint={passwordHint}
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

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label={t("form.confirmPassword")}
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder={t("form.confirmPasswordPlaceholder")}
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={translatedError} />

      <SubmitButton pendingText={t("signup.buttonPending")} icon={<UserPlus className="size-4" />}>
        {t("signup.button")}
      </SubmitButton>
    </form>
  );
}
