import type { ReactNode } from "react";
import { BrandBar, HarborMark } from "@/components/brand";

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sidebar text-white">
      <BrandBar />
      <div className="mx-auto flex min-h-[calc(100vh-2px)] max-w-md flex-col px-5 py-8 sm:max-w-lg">
        <HarborMark light />
        <div className="mt-10 rounded-3xl bg-white p-6 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-white/70">{footer}</div> : null}
      </div>
    </div>
  );
}
