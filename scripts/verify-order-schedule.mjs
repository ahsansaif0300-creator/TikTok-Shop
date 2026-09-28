#!/usr/bin/env node

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const FALLBACK_TIMEZONE_OFFSET_MINUTES = -300;

function parseOrderWallTime(raw, offsetMinutesRaw = "") {
  const trimmed = raw.trim();
  const match = WALL_TIME.exec(trimmed);
  if (!match) return new Date(trimmed);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const parsedOffset = Number(offsetMinutesRaw);
  const offsetMinutes =
    offsetMinutesRaw.trim() !== "" && Number.isFinite(parsedOffset)
      ? parsedOffset
      : FALLBACK_TIMEZONE_OFFSET_MINUTES;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) + offsetMinutes * 60_000);
}

function isOrderDue(createdAt, now = new Date()) {
  return createdAt.getTime() <= now.getTime();
}

const pakistanOffset = -300;
const wall = parseOrderWallTime("2026-09-27T17:57", String(pakistanOffset));
if (wall.getUTCHours() !== 12 || wall.getUTCMinutes() !== 57) {
  throw new Error(`expected 12:57 UTC for 17:57 PKT, got ${wall.toISOString()}`);
}

const missingOffset = parseOrderWallTime("2026-09-27T17:57", "");
if (missingOffset.getTime() !== wall.getTime()) {
  throw new Error("empty timezone offset must fall back to Pakistan UTC+5, not UTC");
}

const utcOffset = parseOrderWallTime("2026-09-27T17:57", "0");
if (utcOffset.getUTCHours() !== 17 || utcOffset.getUTCMinutes() !== 57) {
  throw new Error("explicit UTC offset 0 must stay 17:57 UTC");
}

const wronglyUtc = Date.UTC(2026, 8, 27, 17, 57);
if (wall.getTime() === wronglyUtc) {
  throw new Error("scheduled time must not be parsed as server UTC");
}

const future = new Date(Date.now() + 3 * 60_000);
const past = new Date(Date.now() - 3 * 60_000);
if (isOrderDue(future)) throw new Error("future order must stay hidden");
if (!isOrderDue(past)) throw new Error("past order must be visible");

console.log(JSON.stringify({ ok: true, wallUtc: wall.toISOString(), hiddenUntilDue: true }));
