import { Anchor } from "lucide-react";
import { cn } from "@/lib/utils";

export function HarborMark({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "grid place-items-center rounded-xl bg-accent text-white",
          compact ? "size-8" : "size-9",
        )}
      >
        <Anchor className={compact ? "size-3.5" : "size-4"} />
      </div>
      <div>
        <p className={cn("text-sm font-semibold tracking-wide", light ? "text-white" : "text-ink")}>
          Harbor
        </p>
        <p className={cn("text-[11px]", light ? "text-white/55" : "text-muted")}>Commerce OS</p>
      </div>
    </div>
  );
}

export function BrandBar() {
  return <div className="h-0.5 bg-gradient-to-r from-cyan via-white to-accent" />;
}
