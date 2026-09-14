import type { ProductListingStatus, ProductStatus } from "@prisma/client";

export { LISTING_STATUS } from "@/lib/labels";

export const listedCatalogWhere = {
  status: "ACTIVE" as ProductStatus,
  listingStatus: "LISTED" as ProductListingStatus,
};

export function isListedProduct(product: {
  status: ProductStatus;
  listingStatus: ProductListingStatus;
}) {
  return product.status === "ACTIVE" && product.listingStatus === "LISTED";
}
