import { DateTime } from 'luxon';

// New simplified duration system
export type DurationKey = 'short' | 'medium' | 'long';

export interface SlotInfo {
  slotNumber: number;
  slotStart: DateTime;
  slotEnd: DateTime;
  slotLabel: string;
  points: number;
  isFirstHalf: boolean;
}

// Definitive points configuration (initial phase)
const SLOT_POINTS: Record<DurationKey, { firstHalf: number; secondHalf: number; penalty: number }> = {
  'short': { firstHalf: 10, secondHalf: 3, penalty: -2 },    // 1 week
  'medium': { firstHalf: 15, secondHalf: 5, penalty: -4 },   // 1 month
  'long': { firstHalf: 20, secondHalf: 7, penalty: -6 }      // 3 months
};

export function formatSlotLabel(startTime: string, endTime: string): string {
  return startTime === endTime ? startTime : `${startTime} - ${endTime}`;
}

// Get the current period start and end for a duration in CEST
function getCurrentPeriod(duration: DurationKey): { start: DateTime; end: DateTime } {
  const now = DateTime.now().setZone('Europe/Berlin');
  
  switch (duration) {
    case 'short': {
      // Monday → Sunday (current week)
      const dayOfWeek = now.weekday; // Monday = 1, Sunday = 7
      const daysToMonday = dayOfWeek === 1 ? 0 : 1 - dayOfWeek;
      const start = now.plus({ days: daysToMonday }).startOf('day');
      const end = start.plus({ days: 6 }).endOf('day');
      return { start, end };
    }
    case 'medium': {
      // 1st → last day of current month
      const start = now.startOf('month');
      const end = now.endOf('month');
      return { start, end };
    }
    case 'long': {
      // Current quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
      const quarter = Math.floor((now.month - 1) / 3);
      const start = now.set({ month: quarter * 3 + 1, day: 1 }).startOf('day');
      const end = start.plus({ months: 3 }).minus({ days: 1 }).endOf('day');
      return { start, end };
    }
    default:
      throw new Error(`Unknown duration: ${duration}`);
  }
}

// Check if a prediction is in the first half of the period
function isFirstHalf(predictionTime: DateTime, duration: DurationKey): boolean {
  const { start, end } = getCurrentPeriod(duration);
  const totalDuration = end.diff(start, 'milliseconds').milliseconds;
  const timeFromStart = predictionTime.diff(start, 'milliseconds').milliseconds;
  return timeFromStart <= totalDuration / 2;
}

// Get points for a prediction based on when it was made (first half vs second half)
export function getPointsForPrediction(duration: DurationKey, predictionTime: DateTime): number {
  const isFirst = isFirstHalf(predictionTime, duration);
  const points = SLOT_POINTS[duration];
  return isFirst ? points.firstHalf : points.secondHalf;
}

// Get penalty for a wrong prediction (fixed per duration)
export function getPenaltyForPrediction(duration: DurationKey): number {
  return SLOT_POINTS[duration].penalty;
}

// Get points for a slot (alias for getPointsForPrediction for backward compatibility)
export function getPointsForSlot(duration: DurationKey, predictionTime: DateTime): number {
  return getPointsForPrediction(duration, predictionTime);
}

// Get current active slot for a duration (simplified - only one slot per duration)
export function getCurrentActiveSlot(duration: DurationKey, zone: string = 'Europe/Berlin'): SlotInfo {
  const now = DateTime.now().setZone(zone);
  const { start, end } = getCurrentPeriod(duration);
  const isFirst = isFirstHalf(now, duration);
  const points = getPointsForPrediction(duration, now);
  
  return {
    slotNumber: 1, // Always slot 1 for simplified system
    slotStart: start,
    slotEnd: end,
    slotLabel: `${start.toFormat('MMM dd')} - ${end.toFormat('MMM dd, yyyy')}`,
    points,
    isFirstHalf: isFirst,
  };
}

// Check if a date is within the current active period
export function isWithinActiveSlot(date: Date | string, duration: DurationKey, zone: string = 'Europe/Berlin'): boolean {
  const dt = typeof date === 'string' ? DateTime.fromISO(date, { zone }) : DateTime.fromJSDate(date, { zone });
  const { start, end } = getCurrentPeriod(duration);
  return dt >= start && dt <= end;
}

// Get all slots for a duration (simplified - returns current period only)
export function getAllSlotsForDuration(
  startDate: Date | string,
  endDate: Date | string,
  duration: DurationKey,
  zone: string = 'Europe/Berlin'
): SlotInfo[] {
  // For simplified system, just return the current active slot
  return [getCurrentActiveSlot(duration, zone)];
}

// Check if a slot is valid (simplified - only current slot is valid)
export function isSlotValid(duration: DurationKey, slotNumber: number, targetTime?: Date | string, zone: string = 'Europe/Berlin'): boolean {
  // In simplified system, only slot 1 (current period) is valid
  return slotNumber === 1 && isWithinActiveSlot(targetTime || new Date(), duration, zone);
}

// Get all valid slots for selection (simplified - only current slot)
export function getValidSlotsForDuration(duration: DurationKey, zone: string = 'Europe/Berlin'): SlotInfo[] {
  const slot = getCurrentActiveSlot(duration, zone);
  return isWithinActiveSlot(new Date(), duration, zone) ? [slot] : [];
}

// Get slot for a specific date (simplified)
export function getSlotForDate(date: Date | string, duration: DurationKey, zone: string = 'Europe/Berlin'): SlotInfo {
  const dt = typeof date === 'string' ? DateTime.fromISO(date, { zone }) : DateTime.fromJSDate(date, { zone });
  const { start, end } = getCurrentPeriod(duration);
  const isFirst = isFirstHalf(dt, duration);
  const points = getPointsForPrediction(duration, dt);
  
  return {
    slotNumber: 1,
    slotStart: start,
    slotEnd: end,
    slotLabel: `${start.toFormat('MMM dd')} - ${end.toFormat('MMM dd, yyyy')}`,
    points,
    isFirstHalf: isFirst,
  };
}
