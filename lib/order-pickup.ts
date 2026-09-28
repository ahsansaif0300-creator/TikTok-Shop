/** Stores pick an order by paying Cost Price. Total Price is display only. */
export function orderPickupCharge(order: { cost: number }) {
  return Math.round(Number(order.cost) * 100) / 100;
}
