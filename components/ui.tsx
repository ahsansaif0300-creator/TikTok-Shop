import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE } from "@/lib/labels";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(28,25,21,0.04)]", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const map = {
    neutral: "bg-[#f3eee4] text-[#5c5348]",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-rose-50 text-rose-800",
    info: "bg-sky-50 text-sky-800",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", map[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ value, labels }: { value: string; labels: Record<string, string> }) {
  return <Badge tone={TONE[value] ?? "neutral"}>{labels[value] ?? value}</Badge>;
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-accent text-white hover:bg-[#0c6a5e]",
    secondary: "bg-white text-ink border border-line hover:bg-[#faf6ef]",
    ghost: "text-ink hover:bg-[#f3eee4]",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tabs({
  items,
  active,
  basePath,
}: {
  items: { value: string; label: string }[];
  active: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-[#efe8db] p-1">
      {items.map((item) => {
        const href = item.value ? `${basePath}?status=${item.value}` : basePath;
        const isActive = active === item.value;
        return (
          <Link
            key={item.value || "all"}
            href={href}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm transition",
              isActive ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SearchForm({
  placeholder,
  defaultValue,
  extra,
}: {
  placeholder: string;
  defaultValue?: string;
  extra?: ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2" method="get">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full max-w-xs rounded-xl border border-line bg-white px-3 text-sm outline-none ring-accent/30 focus:ring-2"
      />
      {extra}
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-line px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 text-ink", className)}>{children}</td>;
}

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-accent/30 focus:ring-2 disabled:bg-[#f6f1e8]"
      />
    </label>
  );
}
