import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getErrorI18nKey } from "@/lib/i18n/api-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation("settings");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(t("changePassword.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("changePassword.passwordsDoNotMatch"));
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast.success(t("changePassword.success"));
        handleOpenChange(false);
      } else {
        const body: { error?: string } = await res.json();
        setError(body.error ? t(getErrorI18nKey(body.error)) : t("changePassword.failed"));
        toast.error(body.error ? t(getErrorI18nKey(body.error)) : t("changePassword.failed"));
      }
    } catch {
      setError(t("changePassword.networkError"));
      toast.error(t("changePassword.networkError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#0f1529] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changePassword.title")}</DialogTitle>
          <DialogDescription className="text-blue-100/50">{t("changePassword.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm text-blue-100/70">
                {t("changePassword.currentPassword")}
              </label>
              <Input
                id="current-password"
                type="password"
                placeholder={t("changePassword.currentPasswordPlaceholder")}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={pending}
                className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm text-blue-100/70">
                {t("changePassword.newPassword")}
              </label>
              <Input
                id="new-password"
                type="password"
                placeholder={t("changePassword.newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={pending}
                className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm text-blue-100/70">
                {t("changePassword.confirmNewPassword")}
              </label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={t("changePassword.confirmNewPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={pending}
                className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-500">
              {pending ? t("changePassword.buttonPending") : t("changePassword.button")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
