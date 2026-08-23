import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">That route is not part of the Harbor workspace.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
