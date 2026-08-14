import bcrypt from "bcryptjs";
import {
  ApplicationStatus,
  LedgerType,
  MerchantStatus,
  OrderStatus,
  PayoutStatus,
  PrismaClient,
  ProductStatus,
  RefundStatus,
  RefundType,
  ShipmentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);
}

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchantApplication.deleteMany();
  await prisma.user.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.category.deleteMany();
  await prisma.carrier.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.createMany({
    data: [
      { key: "storeName", value: "Harbor Commerce" },
      { key: "supportEmail", value: "julia.r@example.org" },
      { key: "currency", value: "USD" },
      { key: "supportUrl", value: "https://support.harbor.example" },
    ],
  });

  const [starter, growth, scale] = await Promise.all([
    prisma.plan.create({
      data: {
        name: "Starter",
        description: "For new sellers getting their first catalog live.",
        monthlyFee: 29,
        commissionRate: 0.1,
        maxProducts: 50,
        features: JSON.stringify(["Standard payouts", "Email support", "Basic analytics"]),
      },
    }),
    prisma.plan.create({
      data: {
        name: "Growth",
        description: "For established stores with regular order volume.",
        monthlyFee: 79,
        commissionRate: 0.08,
        maxProducts: 250,
        features: JSON.stringify(["Faster payouts", "Priority support", "Inventory alerts"]),
      },
    }),
    prisma.plan.create({
      data: {
        name: "Scale",
        description: "For high-volume brands that need lower take rates.",
        monthlyFee: 199,
        commissionRate: 0.05,
        maxProducts: 2000,
        features: JSON.stringify(["Dedicated ops manager", "Custom reports", "API access"]),
      },
    }),
  ]);

  const merchantDefs = [
    {
      name: "Northline Outfitters",
      city: "Portland",
      country: "United States",
      planId: growth.id,
      status: MerchantStatus.ACTIVE,
      bankName: "Chase",
      last4: "4412",
    },
    {
      name: "Cedar & Co. Home",
      city: "Austin",
      country: "United States",
      planId: starter.id,
      status: MerchantStatus.ACTIVE,
      bankName: "Bank of America",
      last4: "8821",
    },
    {
      name: "Lumen Beauty",
      city: "Los Angeles",
      country: "United States",
      planId: scale.id,
      status: MerchantStatus.ACTIVE,
      bankName: "Wells Fargo",
      last4: "1904",
    },
    {
      name: "Atlas Fitness",
      city: "Denver",
      country: "United States",
      planId: growth.id,
      status: MerchantStatus.ACTIVE,
      bankName: "US Bank",
      last4: "6730",
    },
    {
      name: "Willow Baby",
      city: "Seattle",
      country: "United States",
      planId: starter.id,
      status: MerchantStatus.PENDING,
      bankName: "Ally",
      last4: "2298",
    },
    {
      name: "BrightByte Electronics",
      city: "Chicago",
      country: "United States",
      planId: scale.id,
      status: MerchantStatus.SUSPENDED,
      bankName: "Citi",
      last4: "5517",
    },
  ];

  const merchants = [];
  for (const def of merchantDefs) {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    merchants.push(
      await prisma.merchant.create({
        data: {
          name: def.name,
          slug,
          legalName: `${def.name} LLC`,
          email: `hello@${slug.replace(/-/g, "")}.example`,
          phone: "+1-555-0100",
          country: def.country,
          city: def.city,
          address: `100 Market Street, ${def.city}`,
          status: def.status,
          planId: def.planId,
          rating: 4.4 + Math.random() * 0.5,
          reviewCount: 20 + Math.floor(Math.random() * 80),
          bankName: def.bankName,
          bankAccountLast4: def.last4,
        },
      }),
    );
  }

  const passwordHash = await bcrypt.hash("HarborAdmin!2026", 10);
  const opsHash = await bcrypt.hash("HarborOps!2026", 10);
  const merchantHash = await bcrypt.hash("HarborMerchant!2026", 10);

  const admin = await prisma.user.create({
    data: {
      email: "oscar.d@example.net",
      name: "Amina Shah",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  const ops = await prisma.user.create({
    data: {
      email: "sarah.b@example.net",
      name: "Jonah Reed",
      passwordHash: opsHash,
      role: "OPS",
    },
  });
  await prisma.user.create({
    data: {
      email: "iris.p@example.org",
      name: "Maya Chen",
      passwordHash: merchantHash,
      role: "MERCHANT",
      merchantId: merchants[0].id,
    },
  });

  const categories = await Promise.all(
    [
      "Apparel",
      "Home & Living",
      "Beauty",
      "Fitness",
      "Baby",
      "Electronics",
      "Outdoor",
      "Kitchen",
    ].map((name) =>
      prisma.category.create({
        data: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
      }),
    ),
  );

  const catalog: { merchant: number; category: number; title: string; price: number; cost: number; stock: number }[] = [
    { merchant: 0, category: 0, title: "Trail Fleece Jacket", price: 89, cost: 38, stock: 42 },
    { merchant: 0, category: 6, title: "Alpine Daypack 22L", price: 64, cost: 24, stock: 30 },
    { merchant: 0, category: 0, title: "Merino Crew Socks (3-pack)", price: 22, cost: 7, stock: 120 },
    { merchant: 0, category: 6, title: "Insulated Water Bottle", price: 34, cost: 11, stock: 80 },
    { merchant: 1, category: 1, title: "Linen Duvet Cover", price: 129, cost: 48, stock: 18 },
    { merchant: 1, category: 7, title: "Stoneware Dinner Set", price: 96, cost: 40, stock: 24 },
    { merchant: 1, category: 1, title: "Oak Serving Board", price: 48, cost: 16, stock: 36 },
    { merchant: 1, category: 1, title: "Woven Throw Blanket", price: 72, cost: 27, stock: 15 },
    { merchant: 2, category: 2, title: "Vitamin C Serum", price: 38, cost: 9, stock: 64 },
    { merchant: 2, category: 2, title: "Mineral SPF 50", price: 28, cost: 8, stock: 70 },
    { merchant: 2, category: 2, title: "Overnight Repair Cream", price: 52, cost: 14, stock: 40 },
    { merchant: 2, category: 2, title: "Gentle Cleansing Balm", price: 24, cost: 6, stock: 90 },
    { merchant: 3, category: 3, title: "Adjustable Kettlebell", price: 79, cost: 32, stock: 22 },
    { merchant: 3, category: 3, title: "Resistance Band Set", price: 29, cost: 8, stock: 100 },
    { merchant: 3, category: 3, title: "Yoga Mat Pro", price: 58, cost: 18, stock: 35 },
    { merchant: 3, category: 3, title: "Jump Rope Steel", price: 19, cost: 5, stock: 75 },
    { merchant: 4, category: 4, title: "Organic Cotton Onesie", price: 26, cost: 8, stock: 48 },
    { merchant: 4, category: 4, title: "Silicone Feeding Set", price: 32, cost: 10, stock: 40 },
    { merchant: 5, category: 5, title: "USB-C Hub 7-in-1", price: 45, cost: 16, stock: 55 },
    { merchant: 5, category: 5, title: "Noise-Cancel Earbuds", price: 89, cost: 34, stock: 28 },
  ];

  const products = [];
  for (const [index, item] of catalog.entries()) {
    products.push(
      await prisma.product.create({
        data: {
          merchantId: merchants[item.merchant].id,
          categoryId: categories[item.category].id,
          title: item.title,
          sku: `HB-${String(index + 1).padStart(4, "0")}`,
          description: `${item.title} from a verified Harbor seller. In-stock and ready to ship.`,
          price: item.price,
          cost: item.cost,
          stock: item.stock,
          status: item.merchant === 5 ? ProductStatus.ARCHIVED : ProductStatus.ACTIVE,
        },
      }),
    );
  }

  const customerDefs = [
    ["Elena Vasquez", "Austin"],
    ["Noah Patel", "Chicago"],
    ["Sofia Rossi", "Miami"],
    ["Liam Okafor", "Boston"],
    ["Hana Suzuki", "Seattle"],
    ["Owen Gallagher", "Denver"],
    ["Priya Nair", "San Jose"],
    ["Marcus Holm", "Portland"],
    ["Amelia Brooks", "Nashville"],
    ["Yusuf Rahman", "Houston"],
    ["Chloe Martin", "New York"],
    ["Diego Alvarez", "Phoenix"],
  ];
  const customers = [];
  for (const [i, [name, city]] of customerDefs.entries()) {
    customers.push(
      await prisma.customer.create({
        data: {
          name,
          email: `${name.toLowerCase().replace(/ /g, ".")}@shopper.example`,
          phone: `+1-555-01${String(10 + i).padStart(2, "0")}`,
          address: `${120 + i} Harbor Ave`,
          city,
          country: "United States",
        },
      }),
    );
  }

  const carriers = await Promise.all([
    prisma.carrier.create({
      data: {
        name: "UPS",
        code: "UPS",
        trackingUrl: "https://www.ups.com/track?tracknum={tracking}",
      },
    }),
    prisma.carrier.create({
      data: {
        name: "FedEx",
        code: "FDX",
        trackingUrl: "https://www.fedex.com/fedextrack/?trknbr={tracking}",
      },
    }),
    prisma.carrier.create({
      data: {
        name: "USPS",
        code: "USPS",
        trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}",
      },
    }),
  ]);

  const statuses: OrderStatus[] = [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.COMPLETED,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED,
  ];

  const activeMerchants = merchants.filter((m) => m.status === MerchantStatus.ACTIVE);
  const orders = [];
  for (let i = 0; i < 48; i++) {
    const merchant = pick(activeMerchants, i);
    const merchantProducts = products.filter((p) => p.merchantId === merchant.id);
    const product = pick(merchantProducts, i);
    const qty = (i % 3) + 1;
    const subtotal = product.price * qty;
    const shippingFee = subtotal > 75 ? 0 : 6.95;
    const tax = Number((subtotal * 0.07).toFixed(2));
    const total = Number((subtotal + shippingFee + tax).toFixed(2));
    const cost = product.cost * qty;
    const plan = [starter, growth, scale].find((p) => p.id === merchant.planId) ?? growth;
    const platformFee = Number((subtotal * plan.commissionRate).toFixed(2));
    const profit = Number((subtotal - cost - platformFee).toFixed(2));
    const status = pick(statuses, i);
    const createdAt = daysAgo(18 - (i % 18), i % 12);

    const order = await prisma.order.create({
      data: {
        orderNumber: `HB-2026-${String(10001 + i)}`,
        merchantId: merchant.id,
        customerId: pick(customers, i).id,
        status,
        subtotal,
        shippingFee,
        tax,
        total,
        cost,
        profit,
        platformFee,
        notes: i % 9 === 0 ? "Customer requested gift wrap." : "",
        paidAt: status === OrderStatus.PENDING_PAYMENT ? null : daysAgo(17 - (i % 18), 2),
        shippedAt: ["SHIPPED", "DELIVERED", "COMPLETED"].includes(status) ? daysAgo(12 - (i % 12)) : null,
        deliveredAt: ["DELIVERED", "COMPLETED"].includes(status) ? daysAgo(8 - (i % 8)) : null,
        completedAt: status === OrderStatus.COMPLETED ? daysAgo(5 - (i % 5)) : null,
        createdAt,
        items: {
          create: {
            productId: product.id,
            title: product.title,
            sku: product.sku,
            quantity: qty,
            price: product.price,
            cost: product.cost,
          },
        },
      },
    });
    orders.push(order);

    if (["SHIPPED", "DELIVERED", "COMPLETED"].includes(status)) {
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrierId: pick(carriers, i).id,
          trackingNumber: `${pick(["1Z", "FX", "94"], i)}${1000000000 + i}`,
          status:
            status === OrderStatus.SHIPPED
              ? ShipmentStatus.IN_TRANSIT
              : ShipmentStatus.DELIVERED,
          shippedAt: order.shippedAt,
          deliveredAt: order.deliveredAt,
        },
      });
    }

    if (status === OrderStatus.PAID || status === OrderStatus.PROCESSING || status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED) {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { pendingBalance: { increment: profit } },
      });
      await prisma.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: LedgerType.SALE,
          amount: profit,
          reference: order.orderNumber,
          note: "Pending settlement",
          createdAt,
        },
      });
    }

    if (status === OrderStatus.COMPLETED) {
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { availableBalance: { increment: profit } },
      });
      await prisma.ledgerEntry.create({
        data: {
          merchantId: merchant.id,
          type: LedgerType.SALE,
          amount: profit,
          reference: order.orderNumber,
          note: "Settled after delivery window",
          createdAt: order.completedAt ?? createdAt,
        },
      });
    }
  }

  const refundable = orders.filter((o) =>
    [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.SHIPPED].includes(o.status),
  );
  for (let i = 0; i < 6; i++) {
    const order = refundable[i];
    await prisma.refund.create({
      data: {
        refundNumber: `RF-${String(i + 1).padStart(5, "0")}`,
        orderId: order.id,
        type: pick([RefundType.REFUND_ONLY, RefundType.RETURN_AND_REFUND, RefundType.EXCHANGE], i),
        reason: pick(
          ["Item arrived damaged", "Wrong size", "Changed mind within return window", "Missing accessory"],
          i,
        ),
        amount: Number((order.total * (i === 2 ? 0.5 : 1)).toFixed(2)),
        status: pick(
          [RefundStatus.PENDING, RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.REJECTED, RefundStatus.COMPLETED],
          i,
        ),
        restock: i % 2 === 0,
        createdAt: daysAgo(4 - (i % 4)),
      },
    });
  }

  await prisma.payout.createMany({
    data: [
      {
        payoutNumber: "PO-00001",
        merchantId: merchants[0].id,
        amount: 420,
        status: PayoutStatus.PAID,
        bankName: "Chase",
        accountLast4: "4412",
        processedAt: daysAgo(6),
        createdAt: daysAgo(8),
      },
      {
        payoutNumber: "PO-00002",
        merchantId: merchants[2].id,
        amount: 890,
        status: PayoutStatus.PENDING,
        bankName: "Wells Fargo",
        accountLast4: "1904",
        createdAt: daysAgo(1),
      },
      {
        payoutNumber: "PO-00003",
        merchantId: merchants[1].id,
        amount: 215.5,
        status: PayoutStatus.APPROVED,
        bankName: "Bank of America",
        accountLast4: "8821",
        createdAt: daysAgo(2),
      },
    ],
  });

  await prisma.merchantApplication.createMany({
    data: [
      {
        businessName: "Solstice Jewelry",
        contactName: "Rina Cole",
        email: "rina@solstice.example",
        phone: "+1-555-0177",
        country: "United States",
        category: "Accessories",
        notes: "Independent jeweler, 4 years of Shopify history.",
        status: ApplicationStatus.PENDING,
      },
      {
        businessName: "Greenfield Organics",
        contactName: "Tom Nguyen",
        email: "tom@greenfield.example",
        phone: "+1-555-0188",
        country: "United States",
        category: "Grocery",
        notes: "USDA organic pantry goods. Wants weekly replenishment.",
        status: ApplicationStatus.PENDING,
      },
      {
        businessName: "Paperbird Studio",
        contactName: "Leah Ortiz",
        email: "leah@paperbird.example",
        phone: "+1-555-0199",
        country: "United States",
        category: "Stationery",
        notes: "Approved after tax ID verification.",
        status: ApplicationStatus.APPROVED,
        reviewerId: ops.id,
        reviewedAt: daysAgo(10),
        merchantId: merchants[1].id,
      },
    ],
  });

  const reviewComments = [
    ["True to size and shipped quickly.", 5],
    ["Good quality for the price.", 4],
    ["Packaging was excellent.", 5],
    ["Color differed slightly from photos.", 3],
    ["Would buy again.", 5],
  ] as const;
  for (let i = 0; i < 12; i++) {
    const [comment, rating] = pick([...reviewComments], i);
    await prisma.review.create({
      data: {
        productId: pick(products, i).id,
        author: pick(customers, i).name,
        rating,
        comment,
        createdAt: daysAgo(i + 1),
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: "Two seller applications need review",
        body: "Solstice Jewelry and Greenfield Organics are waiting on a decision.",
        href: "/merchants/applications",
      },
      {
        userId: admin.id,
        title: "Payout ready",
        body: "Lumen Beauty requested $890.00 to Wells Fargo •1904.",
        href: "/finance/payouts",
      },
      {
        userId: ops.id,
        title: "Refund queue",
        body: "New return-and-refund requests are waiting for ops review.",
        href: "/refunds",
      },
      {
        userId: admin.id,
        title: "Low stock",
        body: "Woven Throw Blanket is down to 15 units.",
        href: "/products",
        read: true,
      },
    ],
  });

  console.log("Harbor demo data ready.");
  console.log("  oscar.d@example.net / HarborAdmin!2026");
  console.log("  sarah.b@example.net / HarborOps!2026");
  console.log("  iris.p@example.org / HarborMerchant!2026");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
