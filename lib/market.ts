import type { MarketStatus } from "./types";

const NY_TZ = "America/New_York";

function nyParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

export function getMarketStatus(now = new Date()): MarketStatus {
  const { weekday, hour, minute } = nyParts(now);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const isWeekday = weekdayIndex >= 1 && weekdayIndex <= 5;
  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (isWeekday && minutes >= open && minutes < close) {
    return { isOpen: true, label: "Market open", session: "open", nextEvent: `Closes in ${Math.floor((close - minutes) / 60)}h ${(close - minutes) % 60}m` };
  }
  if (isWeekday && minutes >= 4 * 60 && minutes < open) {
    return { isOpen: false, label: "Pre-market", session: "pre-market", nextEvent: `Opens in ${Math.floor((open - minutes) / 60)}h ${(open - minutes) % 60}m` };
  }
  if (isWeekday && minutes >= close && minutes < 20 * 60) {
    return { isOpen: false, label: "After hours", session: "after-hours", nextEvent: "Next regular session at 9:30 AM ET" };
  }
  return { isOpen: false, label: "Market closed", session: "closed", nextEvent: "Next regular session at 9:30 AM ET" };
}

export function marketBucket(now = new Date()) {
  const { year, month, day, weekday, hour, minute } = nyParts(now);
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const minutes = hour * 60 + minute;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const isWeekday = weekdayIndex >= 1 && weekdayIndex <= 5;

  if (isWeekday && minutes >= open && minutes < close) {
    return (year * 10_000 + month * 100 + day) * 1_000 + Math.floor(minutes / 5);
  }

  const sessionDate = new Date(Date.UTC(year, month - 1, day));
  if (!isWeekday || minutes < open) sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  while (sessionDate.getUTCDay() === 0 || sessionDate.getUTCDay() === 6) sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  const dateKey = sessionDate.getUTCFullYear() * 10_000 + (sessionDate.getUTCMonth() + 1) * 100 + sessionDate.getUTCDate();
  const lastRegularBucket = Math.floor((close - 1) / 5);
  return dateKey * 1_000 + lastRegularBucket;
}
