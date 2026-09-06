import type { MarketStatus } from "./types";

const NY_TZ = "America/New_York";

function nyParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
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
  return Math.floor(now.getTime() / (5 * 60 * 1000));
}
