import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  setId: string;
  shareToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenGenerated: (token: string) => void;
}

export function ShareSetModal({ setId, shareToken, open, onOpenChange, onTokenGenerated }: Props) {
  const [loading, setLoading] = useState(false);

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/share/${shareToken}` : null;

  async function activate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sets/${setId}/share`, { method: "POST" });
      const body: { share_token?: string; error?: string } = await res.json();
      if (!res.ok || !body.share_token) {
        toast.error(body.error ?? "Failed to activate sharing");
        return;
      }
      onTokenGenerated(body.share_token);
      toast.success("Sharing activated");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg border-white/10 bg-slate-900 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Share set</DialogTitle>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-blue-100/60">
              Any logged-in user who opens this link can clone the set into their own account.
            </p>
            <div className="rounded-md border border-white/10 bg-white/5 p-3">
              <p className="mb-3 text-sm break-all text-blue-100/80">{shareUrl}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyLink}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <CopyIcon />
                Copy link
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-blue-100/60">
              Generate a shareable link so other users can clone this set into their own account and study it
              independently.
            </p>
            <Button
              type="button"
              onClick={activate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500"
            >
              {loading ? "Activating…" : "Activate sharing"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
