import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand-name";

/** Client-supplied mark. Served as-is from /public — do not redraw. */
export const BRAND_MARK_SRC = "/brand-mark.webp";

export function BrandMark({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "xs"
      ? "h-5 w-5"
      : size === "sm"
        ? "h-8 w-8"
        : size === "lg"
          ? "h-14 w-14 sm:h-16 sm:w-16"
          : "h-10 w-10";

  return (
    <img
      src={BRAND_MARK_SRC}
      alt={BRAND_NAME}
      width={700}
      height={700}
      className={cn("shrink-0 object-contain object-center", box, className)}
    />
  );
}

export function HarborMark({
  light = false,
  compact = false,
  large = false,
}: {
  light?: boolean;
  compact?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={large ? "lg" : compact ? "sm" : "md"} />
      <div>
        <p
          className={cn(
            "font-semibold tracking-wide leading-tight",
            large ? "text-base" : "text-sm",
            light ? "text-white" : "text-ink",
          )}
        >
          {BRAND_NAME}
        </p>
      </div>
    </div>
  );
}

export function BrandBar() {
  return <div className="h-0.5 bg-gradient-to-r from-cyan via-white to-accent" />;
}

export function BrandFooter({ light = true }: { light?: boolean }) {
  return (
    <div
      className={cn(
        "mt-auto flex items-center justify-center gap-2 pt-10 text-[11px]",
        light ? "text-white/50" : "text-muted",
      )}
    >
      <BrandMark size="xs" />
      <span>{BRAND_NAME}</span>
    </div>
  );
}
