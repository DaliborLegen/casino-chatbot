// Support schedule for the Zendesk switchboard: during open hours the bot hands
// the conversation to human agents, outside them it answers itself.
//
// Configured locally (env) so the integration works before Zendesk API access is
// granted. Once we can read Zendesk's own schedule, swap `isSupportOpen` to fetch
// GET /api/v2/business_hours/schedules/{id}.json and cache it — the call sites
// don't change.

const DEFAULT_TIMEZONE = "Europe/Ljubljana";
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 24;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Holidays when support is closed all day: "2026-12-25,2027-01-01". */
function holidays(): Set<string> {
  const raw = process.env.SUPPORT_HOLIDAYS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
  );
}

/** Weekdays support is open, 0 = Sunday. Defaults to every day. */
function openWeekdays(): Set<number> {
  const raw = process.env.SUPPORT_WEEKDAYS;
  if (!raw) return new Set([0, 1, 2, 3, 4, 5, 6]);
  return new Set(
    raw
      .split(",")
      .map((d) => Number.parseInt(d.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
}

interface LocalTime {
  hour: number;
  /** YYYY-MM-DD in the support timezone. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
}

/**
 * Current wall-clock time in the support timezone. Uses Intl rather than a fixed
 * UTC offset so daylight-saving changes are handled automatically.
 */
export function localTime(now: Date = new Date()): LocalTime {
  const timeZone = process.env.SUPPORT_TIMEZONE || DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    // Intl renders midnight as "24" in some ICU versions; normalise to 0.
    hour: Number.parseInt(get("hour"), 10) % 24,
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: Math.max(0, weekdayNames.indexOf(get("weekday"))),
  };
}

/** UTC offset of the support timezone at a given instant, in minutes. */
function zoneOffsetMinutes(at: Date): number {
  const timeZone = process.env.SUPPORT_TIMEZONE || DEFAULT_TIMEZONE;
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name ? /GMT([+-])(\d{2}):(\d{2})/.exec(name) : null;
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * "2026-08-20" -> ISO instant for that day's 23:59:59.999 local time, so an end
 * date entered in the dashboard means "valid through that whole day here".
 * Returns null for empty or malformed input.
 */
export function endOfDayInSupportZone(dateStr?: string | null): string | null {
  const m = dateStr ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim()) : null;
  if (!m) return null;
  const [, y, mo, d] = m;
  // Probe at midday so a DST switch (which happens at night) can't flip the offset.
  const offset = zoneOffsetMinutes(new Date(`${y}-${mo}-${d}T12:00:00Z`));
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), 23, 59, 59, 999) - offset * 60_000;
  return new Date(utcMs).toISOString();
}

/** True when human agents are on duty (default 08:00–24:00, every day). */
export function isSupportOpen(now: Date = new Date()): boolean {
  const { hour, date, weekday } = localTime(now);

  if (holidays().has(date)) return false;
  if (!openWeekdays().has(weekday)) return false;

  const start = intEnv("SUPPORT_HOURS_START", DEFAULT_START_HOUR);
  const end = intEnv("SUPPORT_HOURS_END", DEFAULT_END_HOUR);

  // Overnight windows (e.g. 20–4) wrap around midnight.
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
