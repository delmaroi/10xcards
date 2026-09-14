import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SharedSetInfo } from "@/types";

type ClaimStatus = "unclaimed" | "already_claimed" | "already_owner" | "unauthenticated";

interface Props {
  setInfo: SharedSetInfo;
  claimStatus: ClaimStatus;
  claimedSetId?: string;
  token: string;
}

export function SharePageContent({ setInfo, claimStatus, claimedSetId, token }: Props) {
  const [status, setStatus] = useState<ClaimStatus>(claimStatus);
  const [clonedId, setClonedId] = useState<string | undefined>(claimedSetId);
  const [loading, setLoading] = useState(false);

  async function claim() {
    setLoading(true);
    try {
      const res = await fetch("/api/share/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body: { cloned_set_id?: string; already_claimed?: boolean; error?: string } = await res.json();

      if (!res.ok || !body.cloned_set_id) {
        toast.error(body.error ?? "Failed to clone set");
        return;
      }

      if (body.already_claimed) {
        setStatus("already_claimed");
        setClonedId(body.cloned_set_id);
        return;
      }

      window.location.href = `/sets/${body.cloned_set_id}`;
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-cosmic flex min-h-screen items-center justify-center p-4 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
          {setInfo.set_name}
        </h1>
        <p className="mt-2 text-sm text-blue-100/50">
          {setInfo.flashcard_count} {setInfo.flashcard_count === 1 ? "flashcard" : "flashcards"}
        </p>

        <div className="mt-8">
          {status === "unauthenticated" && (
            <div className="space-y-3">
              <p className="text-sm text-blue-100/60">Log in to clone this set into your account and study it.</p>
              <a
                href="/auth/signin"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-500"
              >
                Log in to claim
              </a>
            </div>
          )}

          {status === "unclaimed" && (
            <div className="space-y-3">
              <p className="text-sm text-blue-100/60">
                Clone this set into your account and study it with your own spaced repetition history.
              </p>
              <Button
                type="button"
                onClick={claim}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-500"
              >
                {loading ? "Cloning…" : "Clone to my sets"}
              </Button>
            </div>
          )}

          {status === "already_owner" && (
            <div className="space-y-3">
              <p className="text-sm text-blue-100/60">This is your own set — you cannot clone it.</p>
              <a
                href={`/sets/${setInfo.set_id}`}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Open original set
              </a>
            </div>
          )}

          {status === "already_claimed" && (
            <div className="space-y-3">
              <p className="text-sm text-blue-100/60">You already have this set in your account.</p>
              <a
                href={`/sets/${clonedId}`}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-500"
              >
                Open my copy
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
