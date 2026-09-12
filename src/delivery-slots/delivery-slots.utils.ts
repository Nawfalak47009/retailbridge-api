const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export function getIndiaDateParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hours = parseInt(map.hour, 10) || 0;
  const minutes = parseInt(map.minute, 10) || 0;
  const weekdayShort = (map.weekday || "").toLowerCase();
  const dayIndex = WEEKDAY_MAP[weekdayShort] ?? date.getDay();

  return { year, month, day, hours, minutes, dayIndex };
}

/**
 * Calculates the next upcoming delivery date for a recurring delivery slot.
 * Strictly operates in Indian Standard Time (Asia/Kolkata) and guarantees
 * that the calculated delivery date is NEVER in the past.
 *
 * Examples:
 * - If today in India is Sun, 13 Sep 2026 and slot is "Saturday" -> Returns Sat, 19 Sep 2026.
 * - If today in India is Sat, 12 Sep 2026 and slot is "Saturday" (morning) -> Returns Sat, 12 Sep 2026.
 * - If today in India is Sat, 12 Sep 2026 (afternoon/evening) -> Returns Sat, 19 Sep 2026.
 */
export function calculateNextDeliveryDate(
  slot?: {
    day?: string | null;
    deliveryDate?: string | Date | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null,
  referenceDate: Date = new Date(),
): Date {
  const ist = getIndiaDateParts(referenceDate);
  const todayKey = `${ist.year}-${String(ist.month).padStart(2, "0")}-${String(ist.day).padStart(2, "0")}`;

  if (!slot) {
    // Fallback: tomorrow noon
    return new Date(Date.UTC(ist.year, ist.month - 1, ist.day + 1, 12, 0, 0));
  }

  // 1. If slot has a deliveryDate that is today or in the future:
  if (slot.deliveryDate) {
    const direct = new Date(slot.deliveryDate);
    if (!Number.isNaN(direct.getTime())) {
      const directIst = getIndiaDateParts(direct);
      const directKey = `${directIst.year}-${String(directIst.month).padStart(2, "0")}-${String(directIst.day).padStart(2, "0")}`;
      if (directKey >= todayKey) {
        return new Date(Date.UTC(directIst.year, directIst.month - 1, directIst.day, 12, 0, 0));
      }
    }
  }

  // 2. Identify target weekday
  let targetDayIndex: number | undefined;
  if (slot.day) {
    const normalized = slot.day.trim().toLowerCase();
    targetDayIndex = WEEKDAY_MAP[normalized];
  }

  if (targetDayIndex === undefined && slot.deliveryDate) {
    const orig = new Date(slot.deliveryDate);
    if (!Number.isNaN(orig.getTime())) {
      targetDayIndex = getIndiaDateParts(orig).dayIndex;
    }
  }

  // 3. Compute next occurrence on or after reference date in IST
  if (targetDayIndex !== undefined) {
    let daysUntilTarget = (targetDayIndex - ist.dayIndex + 7) % 7;

    // If today is the delivery day, but today's delivery/cutoff has passed (>= 12:00 noon):
    // push to the next occurrence (7 days later)
    if (daysUntilTarget === 0 && ist.hours >= 12) {
      daysUntilTarget = 7;
    }

    return new Date(Date.UTC(ist.year, ist.month - 1, ist.day + daysUntilTarget, 12, 0, 0));
  }

  // 4. Default fallback: Tomorrow
  return new Date(Date.UTC(ist.year, ist.month - 1, ist.day + 1, 12, 0, 0));
}
