import Link from "next/link";
import { BrandFooter, HarborMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-sidebar p-6 text-white">
      <div className="max-w-md text-center">
        <div className="flex justify-center">
          <HarborMark light />
        </div>
        <p className="mt-8 text-sm uppercase tracking-[0.16em] text-white/45">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-white/60">That route is not part of the Harbor workspace.</p>
        <Link href="/login" className="mt-6 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
          Sign in
        </Link>
        <BrandFooter />
      </div>
    </div>
  );
}
