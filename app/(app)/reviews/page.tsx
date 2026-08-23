import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { merchantScope } from "@/lib/scope";
import { Card, Empty, PageHeader, TableWrap, Td, Th } from "@/components/ui";

export default async function ReviewsPage() {
  const session = await requireSession();
  const reviews = await prisma.review.findMany({
    where: { product: merchantScope(session) },
    include: { product: { include: { merchant: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Product reviews from real shoppers, scoped to your catalog." />
      <Card>
        {reviews.length === 0 ? (
          <Empty title="No reviews" body="Reviews appear after completed purchases." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Author</Th>
                <Th>Rating</Th>
                <Th>Comment</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <Td>
                    <Link href={`/products/${review.productId}`} className="text-accent hover:underline">
                      {review.product.title}
                    </Link>
                    <p className="text-xs text-muted">{review.product.merchant.name}</p>
                  </Td>
                  <Td>{review.author}</Td>
                  <Td>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</Td>
                  <Td className="max-w-sm">{review.comment}</Td>
                  <Td>{format(review.createdAt, "MMM d")}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
