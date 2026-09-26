#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { orderPickupCharge } = await import(path.join(root, "lib/order-pickup.ts"));

const cost = 12.16;
const total = 24.07;
const charge = orderPickupCharge({ cost, total });
if (charge !== 12.16) throw new Error(`pickup charged ${charge}, expected cost 12.16`);
if (charge === total) throw new Error("pickup must not charge total price");

const requireBalance = (available, amount) => available >= amount;
if (!requireBalance(12.16, charge)) throw new Error("cost funds should be enough to pick up");
if (requireBalance(12.16, total)) throw new Error("cost funds must not be enough for total price");

console.log(JSON.stringify({ ok: true, cost, total, charged: charge }));
