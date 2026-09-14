import { useTranslation } from "react-i18next";
import type { DonatedSetTile } from "@/types";

interface Props {
  tiles: DonatedSetTile[];
}

export function DonatedSetsSection({ tiles }: Props) {
  const { t } = useTranslation("dashboard");

  function formatRelativeDate(iso: string | null): string {
    if (!iso) return "—";
    const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diffDays === 0) return t("dashboard.today");
    if (diffDays === 1) return t("dashboard.yesterday");
    return t("dashboard.daysAgo", { count: diffDays });
  }

  return (
    <div className="mt-8 mb-8">
      <div className="mb-8 flex items-center border-b border-white/10 pb-4">
        <h2 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          {t("dashboard.donatedSets")}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.share_id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="truncate font-medium text-white">{tile.original_set_name}</p>
            <p className="mt-1 truncate text-sm text-blue-100/60">{tile.recipient_email}</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-blue-100/50">
              <span>{t("dashboard.claimed")}</span>
              <span className="text-right">{formatRelativeDate(tile.claimed_at)}</span>
              <span>{t("dashboard.cards")}</span>
              <span className="text-right">
                {tile.learned_count}/{tile.total_flashcards} {t("dashboard.learned")}
              </span>
              <span>{t("dashboard.lastActivity")}</span>
              <span className="text-right">{formatRelativeDate(tile.last_activity)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
