import { useState } from "react";
import { useTranslation } from "react-i18next";
import { User, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";

interface Props {
  email: string;
  locale: SupportedLocale;
}

export function UserMenu({ email, locale }: Props) {
  return (
    <I18nProvider locale={locale}>
      <UserMenuInner email={email} />
    </I18nProvider>
  );
}

function UserMenuInner({ email }: { email: string }) {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10">
          <User className="h-4 w-4 text-blue-100/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-white/10 bg-[#0f1529] text-white">
        <DropdownMenuLabel className="text-blue-100/50">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-white/10 focus:text-white">
          <a href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("nav.settings")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className="cursor-pointer focus:bg-white/10 focus:text-white"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? t("nav.signingOut") : t("nav.signout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
