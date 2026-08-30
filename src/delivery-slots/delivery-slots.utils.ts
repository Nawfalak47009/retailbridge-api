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

/**
 * Calculates the next upcoming delivery date for a recurring delivery slot.
 * Ensures the delivery date is never in the past.
 *
 * Examples:
 * - If today is Sun, 30 Aug 2026 and slot day is "Friday" -> Returns Fri, 4 Sep 2026.
 * - If today is Fri, 4 Sep 2026 and slot day is "Friday" -> Returns Fri, 4 Sep 2026.
 * - If today is Sun, 30 Aug 2026 and slot day is "Tuesday" -> Returns Tue, 1 Sep 2026.
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
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  if (!slot) {
    const fallback = new Date(ref);
    fallback.setDate(ref.getDate() + 1);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  // 1. If slot has a deliveryDate that is strictly today or in the future:
  if (slot.deliveryDate) {
    const directDate = new Date(slot.deliveryDate);
    if (!Number.isNaN(directDate.getTime())) {
      directDate.setHours(0, 0, 0, 0);
      if (directDate.getTime() >= ref.getTime()) {
        return directDate;
      }
    }
  }

  // 2. Identify the target weekday from slot.day or slot.deliveryDate
  let targetDayIndex: number | undefined;

  if (slot.day) {
    const normalizedDay = slot.day.trim().toLowerCase();
    targetDayIndex = WEEKDAY_MAP[normalizedDay];
  }

  if (targetDayIndex === undefined && slot.deliveryDate) {
    const originalDate = new Date(slot.deliveryDate);
    if (!Number.isNaN(originalDate.getTime())) {
      targetDayIndex = originalDate.getDay();
    }
  }

  // 3. Compute next occurrence on or after reference date
  if (targetDayIndex !== undefined) {
    const currentDayIndex = ref.getDay();
    const daysUntilTarget = (targetDayIndex - currentDayIndex + 7) % 7;

    const nextDate = new Date(ref);
    nextDate.setDate(ref.getDate() + daysUntilTarget);
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
  }

  // 4. Default fallback: Tomorrow
  const fallback = new Date(ref);
  fallback.setDate(ref.getDate() + 1);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}
