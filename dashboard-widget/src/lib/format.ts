import {isNum} from "../sources";

export {isNum};

export function fmt(value: unknown, precision = 1): string {
  if (!isNum(value)) return "--";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** Thousands-separated integer, for totalisers and pulse counts. */
export function fmtInt(value: unknown): string {
  return isNum(value) ? Math.round(value).toLocaleString() : "--";
}

/**
 * Timestamps on Doover tags are inconsistent: some apps write epoch seconds,
 * some epoch milliseconds. Anything below ~1e11 can only be seconds.
 */
export function toMillis(value: unknown): number | null {
  if (!isNum(value) || value <= 0) return null;
  return value < 1e11 ? value * 1000 : value;
}

/**
 * Relative time, written out rather than pulled from a date library — the whole
 * widget ships as one federated bundle and every dependency in that graph is
 * another way for it to fail to initialise at runtime.
 */
export function fromNow(value: unknown, now = Date.now()): string {
  const ms = toMillis(value);
  if (ms == null) return "--";

  const seconds = Math.round((now - ms) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);

  let text: string;
  if (abs < 45) text = "a few seconds";
  else if (abs < 90) text = "a minute";
  else if (abs < 3600) text = `${Math.round(abs / 60)} minutes`;
  else if (abs < 5400) text = "an hour";
  else if (abs < 86400) text = `${Math.round(abs / 3600)} hours`;
  else if (abs < 172800) text = "a day";
  else if (abs < 2592000) text = `${Math.round(abs / 86400)} days`;
  else if (abs < 5184000) text = "a month";
  else if (abs < 31536000) text = `${Math.round(abs / 2592000)} months`;
  else text = `${Math.round(abs / 31536000)} years`;

  return future ? `in ${text}` : `${text} ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Absolute local time for tooltips, e.g. "24 Aug, 9:02 am". */
export function absTime(value: unknown): string {
  const ms = toMillis(value);
  if (ms == null) return "";

  const date = new Date(ms);
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours24 < 12 ? "am" : "pm";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${hours}:${minutes} ${suffix}`;
}

/** Seconds since a timestamp, or null when it isn't a usable timestamp. */
export function secondsSince(value: unknown, now = Date.now()): number | null {
  const ms = toMillis(value);
  return ms == null ? null : (now - ms) / 1000;
}

/** Compact uptime: "6d 4h", "4h 12m", "12m". */
export function fmtDuration(seconds: unknown): string {
  if (!isNum(seconds) || seconds < 0) return "--";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
