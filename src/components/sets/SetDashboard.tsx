import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FlashcardSet, LearningStats, DonatedSetTile } from "@/types";
import { SetGrid } from "@/components/sets/SetGrid";
import { CreateSetDialog } from "@/components/sets/CreateSetDialog";
import { RenameSetDialog } from "@/components/sets/RenameSetDialog";
import { DeleteSetDialog } from "@/components/sets/DeleteSetDialog";
import { StatsBlock } from "@/components/dashboard/StatsBlock";
import { DonatedSetsSection } from "@/components/dashboard/DonatedSetsSection";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";

type SetWithCount = FlashcardSet & { flashcard_count: number };

interface Props {
  initialSets: string;
  initialStats: string;
  initialDonatedSets: string;
  locale: SupportedLocale;
}

export default function SetDashboard(props: Props) {
  return (
    <I18nProvider locale={props.locale}>
      <SetDashboardInner {...props} />
    </I18nProvider>
  );
}

function SetDashboardInner({ initialSets, initialStats, initialDonatedSets }: Props) {
  const { t } = useTranslation("dashboard");
  const [sets, setSets] = useState<SetWithCount[]>(() => {
    try {
      return JSON.parse(initialSets) as SetWithCount[];
    } catch {
      return [];
    }
  });

  const [stats] = useState<LearningStats>(() => {
    try {
      return JSON.parse(initialStats) as LearningStats;
    } catch {
      return { dailyMinutes: [], recentSets: [] };
    }
  });

  const [donatedSets] = useState<DonatedSetTile[]>(() => {
    try {
      return JSON.parse(initialDonatedSets) as DonatedSetTile[];
    } catch {
      return [];
    }
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FlashcardSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlashcardSet | null>(null);

  const handleCreate = useCallback(
    (newSet: FlashcardSet) => {
      setSets((prev) => [{ ...newSet, flashcard_count: 0 }, ...prev]);
      setCreateOpen(false);
      toast.success(t("set.setCreated", { name: newSet.name }));
    },
    [t],
  );

  const handleRename = useCallback(
    (updated: FlashcardSet) => {
      setSets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setRenameTarget(null);
      toast.success(t("set.setRenamed", { name: updated.name }));
    },
    [t],
  );

  const handleDelete = useCallback(
    (setId: string) => {
      const deleted = sets.find((s) => s.id === setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
      setDeleteTarget(null);
      toast.success(t("set.setDeleted", { name: deleted?.name ?? "unknown" }));
    },
    [sets, t],
  );

  return (
    <div className="bg-cosmic min-h-screen p-4 text-white">
      <div className="mx-auto max-w-5xl">
        <StatsBlock stats={stats} />

        <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
          <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
            {t("dashboard.mySets")}
          </h1>
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
          >
            <PlusIcon />
            {t("dashboard.newSet")}
          </button>
        </div>

        <SetGrid sets={sets} onRename={setRenameTarget} onDelete={setDeleteTarget} />

        {donatedSets.length > 0 && <DonatedSetsSection tiles={donatedSets} />}
      </div>

      <CreateSetDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />

      <RenameSetDialog
        key={renameTarget?.id ?? "empty"}
        set={renameTarget}
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onRename={handleRename}
      />

      <DeleteSetDialog
        set={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
