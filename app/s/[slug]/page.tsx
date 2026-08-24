import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureDatabase } from "@/lib/ensure-db";
import { money } from "@/lib/utils";
import { shopAbsoluteUrl, workspaceLoginUrl } from "@/lib/shop-url";
import { BrandBar, HarborMark } from "@/components/brand";
import { CopyShopLink } from "@/components/copy-shop-link";

export default async function PublicShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await ensureDatabase();
  const merchant = await prisma.merchant.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: { id: true, title: true, price: true },
      },
      _count: { select: { products: true } },
    },
  });
  if (!merchant) notFound();

  const shopUrl = await shopAbsoluteUrl(merchant.slug);
  const loginHref = await workspaceLoginUrl(merchant.slug);
  const open = merchant.status === "ACTIVE";

  return (
    <div className="min-h-screen bg-sidebar text-white">
      <BrandBar />
      <header className="mx-auto flex max-w-lg items-center justify-between px-5 py-5">
        <HarborMark light />
        <div className="flex gap-2 text-sm">
          <Link href="/login" className="rounded-full bg-white/10 px-3 py-1.5 font-medium hover:bg-white/15">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full bg-accent px-3 py-1.5 font-semibold text-white hover:bg-[#e11d48]">
            Sign up
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-5 pb-16">
        <div className="rounded-3xl bg-white p-6 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-sidebar text-xl font-semibold text-white">
              {merchant.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{merchant.name}</h1>
              <p className="text-sm text-muted">
                {open ? "Harbor seller" : "This shop is not taking orders right now."}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-soft px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Shop link</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate font-mono text-xs text-ink">{shopUrl}</p>
              <CopyShopLink url={shopUrl} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              href={loginHref}
              className="grid h-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-white hover:bg-[#e11d48]"
            >
              Seller login
            </Link>
            <Link
              href="/signup"
              className="grid h-11 place-items-center rounded-xl border border-line text-sm font-semibold text-ink hover:bg-soft"
            >
              Open my shop
            </Link>
          </div>
          {open && merchant.products.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-sm font-medium">Catalog</h2>
              <ul className="mt-2 divide-y divide-line">
                {merchant.products.map((product) => (
                  <li key={product.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate pr-3">{product.title}</span>
                    <span className="shrink-0 font-medium">{money(product.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{merchant._count.products} live SKUs · checkout stays on your own storefront.</p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              {open ? "No live products yet. Sign in as the seller to add catalog items." : "Staff can reactivate this shop from Merchants."}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
