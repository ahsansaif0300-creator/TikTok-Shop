import type { OrderStatus } from "@prisma/client";

export type LiveOrderItem = {
  id: string;
  title: string;
  quantity: number;
  price: number;
  image: string | null;
};

export type LiveOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  total: number;
  profit: number;
  merchant: { name: string };
  customer: { name: string; city: string };
  items: LiveOrderItem[];
};

export function orderListStamp(orders: LiveOrder[]) {
  return orders.map((order) => `${order.id}:${order.status}:${order.updatedAt}`).join("|");
}
