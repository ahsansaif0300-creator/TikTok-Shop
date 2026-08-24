import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isStaff, requireSession } from "@/lib/auth";
import { money } from "@/lib/utils";
import { MERCHANT_STATUS } from "@/lib/labels";
import { Card, PageHeader, StatusBadge } from "@/components/ui";

export default async function PlansPage() {
  const session = await requireSession();
  if (!isStaff(session.role)) redirect("/");
  const plans = await prisma.plan.findMany({
    include: {
      merchants: { select: { id: true, name: true, status: true }, orderBy: { name: "asc" } },
      _count: { select: { merchants: true } },
    },
    orderBy: { monthlyFee: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Seller plans"
        subtitle="SaaS-style marketplace plans: a monthly platform fee plus a commission on actual sales. Not a VIP paywall for withdrawals."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-6">
            <p className="text-sm uppercase tracking-[0.16em] text-muted">
              {plan._count.merchants} merchants
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted">{plan.description}</p>
            <p className="mt-4 text-3xl font-semibold">
              {money(plan.monthlyFee)}
              <span className="text-base font-normal text-muted">/mo</span>
            </p>
            <p className="mt-1 text-sm text-accent">{(plan.commissionRate * 100).toFixed(0)}% commission on sales</p>
            <p className="mt-1 text-sm text-muted">Up to {plan.maxProducts} products</p>
            <ul className="mt-4 space-y-2 text-sm">
              {(JSON.parse(plan.features) as string[]).map((feature) => (
                <li key={feature} className="rounded-xl bg-soft px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
            {plan.merchants.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                {plan.merchants.map((merchant) => (
                  <li key={merchant.id} className="flex items-center justify-between gap-2">
                    <Link href={`/merchants/${merchant.id}`} className="text-accent hover:underline">
                      {merchant.name}
                    </Link>
                    <StatusBadge value={merchant.status} labels={MERCHANT_STATUS} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
