import { useTranslation } from "react-i18next";
import type { LearningStats } from "@/types";
import { ActivityChart } from "@/components/dashboard/ActivityChart";

interface Props {
  stats: LearningStats;
}

export function StatsBlock({ stats }: Props) {
  const { t } = useTranslation("dashboard");
  const { dailyMinutes, recentSets } = stats;

  return (
    <div className="mb-8 space-y-6">
      {/* Bar chart */}
      <ActivityChart dailyMinutes={dailyMinutes} />

      {/* Recent sets */}
      {recentSets.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium tracking-wide text-blue-100/60 uppercase">
            {t("dashboard.recentlyOpened")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {recentSets.map((s) => {
              const diffDays = Math.floor((Date.now() - new Date(s.last_opened_at).getTime()) / 86400000);
              let relativeDate: string;
              if (diffDays === 0) relativeDate = t("dashboard.today");
              else if (diffDays === 1) relativeDate = t("dashboard.yesterday");
              else relativeDate = t("dashboard.daysAgo", { count: diffDays });

              return (
                <a
                  key={s.id}
                  href={`/sets/${s.id}`}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <p className="mb-2 truncate font-medium">{s.name}</p>
                  <p className="text-sm text-blue-100/60">
                    {s.learned_count} / {s.total_flashcards} {t("dashboard.cardsLearned")}
                  </p>
                  <p className="mt-1 text-xs text-blue-100/40">{relativeDate}</p>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {recentSets.length === 0 && dailyMinutes.length > 0 && (
        <p className="text-sm text-blue-100/40">{t("dashboard.noStats")}</p>
      )}
    </div>
  );
}
