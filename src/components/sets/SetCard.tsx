import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FlashcardSet } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  set: FlashcardSet & { flashcard_count: number };
  onRename: () => void;
  onDelete: () => void;
}

export function SetCard({ set, onRename, onDelete }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.language;

  return (
    <Card className={cn("relative border-white/10 bg-white/5 backdrop-blur-xl transition-colors hover:bg-white/10")}>
      <a href={`/sets/${set.id}`} className="absolute inset-0 z-0" aria-label={set.name} />
      <CardHeader>
        <CardAction className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-100/50 hover:text-white"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onRename();
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("set.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("set.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <CardTitle className="text-white">{set.name}</CardTitle>
        <CardDescription className="text-blue-100/50">
          {set.flashcard_count}&nbsp;{set.flashcard_count === 1 ? t("set.card") : t("set.cards")}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-blue-100/40">
        <p>
          {t("set.created")}{" "}
          {new Date(set.created_at).toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </CardContent>
      <CardFooter className="text-xs text-blue-100/30">
        {set.last_opened_at
          ? `${t("set.lastOpened")} ${new Date(set.last_opened_at).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            })}`
          : t("set.notOpenedYet")}
      </CardFooter>
    </Card>
  );
}
