import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getErrorI18nKey } from "@/lib/i18n/api-errors";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/services/ai-prompt";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { VoiceSwitcher } from "@/components/settings/VoiceSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import type { VoiceId } from "@/lib/tts/voices";

interface Props {
  email: string;
  initialPrompt: string | null;
  initialFlashcardCount: number | null;
  locale: SupportedLocale;
  initialVoiceFront: VoiceId;
  initialVoiceBack: VoiceId;
}

type PromptMode = "default" | "custom";

export function SettingsPage(props: Props) {
  return (
    <I18nProvider locale={props.locale}>
      <SettingsPageInner {...props} />
    </I18nProvider>
  );
}

function SettingsPageInner({
  email,
  initialPrompt,
  initialFlashcardCount,
  locale,
  initialVoiceFront,
  initialVoiceBack,
}: Props) {
  const { t } = useTranslation("settings");
  const initialMode: PromptMode = initialPrompt ? "custom" : "default";
  const [promptMode, setPromptMode] = useState<PromptMode>(initialMode);
  const [customPrompt, setCustomPrompt] = useState(initialPrompt ?? DEFAULT_SYSTEM_PROMPT);
  const [flashcardCount, setFlashcardCount] = useState(initialFlashcardCount ?? 5);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);

  async function handleSave() {
    const trimmed = customPrompt.trim();
    if (!trimmed) {
      toast.error(t("settings.promptEmpty"));
      return;
    }
    if (flashcardCount < 1 || flashcardCount > 20) {
      toast.error(t("settings.flashcardCountRange"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, flashcard_count: flashcardCount }),
      });

      if (res.ok) {
        toast.success(t("settings.promptSaved"));
      } else {
        const body: { error?: string } = await res.json();
        toast.error(body.error ? t(getErrorI18nKey(body.error)) : t("settings.promptSaveFailed"));
      }
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchToDefault() {
    setSwitchConfirmOpen(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user-prompt", { method: "DELETE" });
      if (res.ok) {
        setPromptMode("default");
        setCustomPrompt(DEFAULT_SYSTEM_PROMPT);
        setFlashcardCount(5);
        toast.success(t("settings.switchedToDefault"));
      } else {
        const body: { error?: string } = await res.json();
        toast.error(body.error ? t(getErrorI18nKey(body.error)) : t("settings.switchToDefaultFailed"));
      }
    } catch {
      toast.error(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  function handleModeSwitch(mode: PromptMode) {
    if (mode === "default" && promptMode === "custom") {
      setSwitchConfirmOpen(true);
    } else {
      setPromptMode(mode);
      if (mode === "default") {
        setCustomPrompt(DEFAULT_SYSTEM_PROMPT);
        setFlashcardCount(5);
      }
    }
  }

  return (
    <div className="bg-cosmic flex min-h-screen items-start justify-center p-4 pt-8">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
          {t("settings.title")}
        </h1>

        {/* AI Prompt Section */}
        <Card className="border-white/10 bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">{t("settings.aiPromptTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  promptMode === "default"
                    ? "bg-purple-600 text-white"
                    : "border border-white/10 bg-white/5 text-blue-100/60 hover:bg-white/10"
                }`}
                onClick={() => {
                  handleModeSwitch("default");
                }}
              >
                {t("settings.default")}
              </button>
              <button
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  promptMode === "custom"
                    ? "bg-purple-600 text-white"
                    : "border border-white/10 bg-white/5 text-blue-100/60 hover:bg-white/10"
                }`}
                onClick={() => {
                  setPromptMode("custom");
                }}
              >
                {t("settings.custom")}
              </button>
            </div>

            {promptMode === "default" ? (
              <>
                <Textarea
                  value={DEFAULT_SYSTEM_PROMPT}
                  disabled
                  className="max-h-[600px] min-h-40 overflow-y-auto border-white/10 bg-white/5 text-blue-100/50"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-blue-100/70">{t("settings.flashcardsPerGeneration")}</label>
                  <Input
                    type="number"
                    value={5}
                    disabled
                    className="w-24 border-white/10 bg-white/5 text-white opacity-50"
                  />
                </div>
              </>
            ) : (
              <>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                  }}
                  placeholder={t("settings.promptPlaceholder")}
                  className="max-h-[600px] min-h-40 overflow-y-auto border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
                />
                <div className="flex items-center gap-3">
                  <label htmlFor="flashcard-count" className="text-sm text-blue-100/70">
                    {t("settings.flashcardsPerGenerationRange")}
                  </label>
                  <Input
                    id="flashcard-count"
                    type="number"
                    min={1}
                    max={20}
                    value={flashcardCount}
                    onChange={(e) => {
                      setFlashcardCount(Number(e.target.value));
                    }}
                    className="w-24 border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500">
                    {saving ? t("settings.saving") : t("settings.save")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card className="border-white/10 bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">{t("settings.language")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LanguageSwitcher currentLocale={locale} />
          </CardContent>
        </Card>

        {/* Voice Section */}
        <Card className="border-white/10 bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">{t("settings.voiceTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <VoiceSwitcher initialFront={initialVoiceFront} initialBack={initialVoiceBack} />
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card className="border-white/10 bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">{t("settings.account")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-blue-100/50">{t("settings.email")}</p>
              <p className="text-white">{email}</p>
            </div>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => {
                setPasswordOpen(true);
              }}
            >
              {t("settings.changePassword")}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/30 bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-red-400">{t("settings.dangerZone")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              {t("settings.deleteAccount")}
            </Button>
          </CardContent>
        </Card>

        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
        <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />

        <Dialog open={switchConfirmOpen} onOpenChange={setSwitchConfirmOpen}>
          <DialogContent className="border-white/10 bg-[#0f1529] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.switchToDefaultTitle")}</DialogTitle>
              <DialogDescription className="text-blue-100/50">{t("settings.switchToDefaultDesc")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setSwitchConfirmOpen(false);
                }}
              >
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleSwitchToDefault}>
                {t("settings.default")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
