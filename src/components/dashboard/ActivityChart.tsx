import { useTranslation } from "react-i18next";
import type { DailyStats } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  dailyMinutes: DailyStats[];
}

export function ActivityChart({ dailyMinutes }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const maxMinutes = Math.max(...dailyMinutes.map((d) => d.minutes), 1);
  const allZero = dailyMinutes.every((d) => d.minutes === 0);

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium tracking-wide text-blue-100/60 uppercase">{t("dashboard.activity")}</h2>
      {dailyMinutes.length === 0 || allZero ? (
        <p className="text-sm text-blue-100/40">{t("dashboard.noActivity")}</p>
      ) : (
        <div className="flex h-24 gap-1">
          {dailyMinutes.map((d) => {
            const heightPct = (d.minutes / maxMinutes) * 100;
            const label = new Date(d.day + "T12:00:00Z").toLocaleDateString(i18n.language, { weekday: "short" });
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.minutes} min`}>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all",
                      d.minutes > 0 ? "bg-purple-500" : "bg-white/10",
                    )}
                    style={{ height: `${heightPct}%`, minHeight: "2px" }}
                  />
                </div>
                <span className="text-[9px] text-blue-100/40">{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
