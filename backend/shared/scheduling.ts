/**
 * Advanced Scheduling Utilities
 * Handles shift templates, availability, conflicts, and schedule publishing
 */

export interface ShiftTemplate {
  templateId: string;
  organizationId: string;
  name: string;
  description?: string;
  locationId: string;
  position?: string;
  startTime: string; // HH:mm format (e.g., "09:00")
  endTime: string; // HH:mm format
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  color?: string; // For calendar display
  createdBy: string;
  createdAt: string;
}

export interface Availability {
  availabilityId: string;
  userId: string;
  organizationId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  effectiveDate?: string; // When this availability starts (YYYY-MM-DD)
  expiryDate?: string; // When this availability ends (optional)
  isRecurring: boolean; // Weekly recurring or one-time
  notes?: string;
}

export interface ScheduleConflict {
  type: 'overlap' | 'double_booking' | 'unavailable' | 'time_off' | 'insufficient_rest' | 'overtime_risk';
  severity: 'error' | 'warning';
  shiftId?: string;
  userId: string;
  date: string;
  description: string;
  conflictingShiftId?: string;
}

export interface ScheduleStats {
  totalShifts: number;
  totalHours: number;
  employeesScheduled: number;
  estimatedLaborCost: number;
  coverage: {
    [locationId: string]: {
      locationName: string;
      shiftsCount: number;
      hoursTotal: number;
    };
  };
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  // Handle overnight shifts
  let end1Adjusted = end1Min;
  let end2Adjusted = end2Min;

  if (end1Min < start1Min) end1Adjusted = end1Min + 24 * 60;
  if (end2Min < start2Min) end2Adjusted = end2Min + 24 * 60;

  return start1Min < end2Adjusted && end1Adjusted > start2Min;
}

/**
 * Check if a shift time falls within employee's availability
 */
export function isWithinAvailability(
  shiftDate: string,
  shiftStartTime: string,
  shiftEndTime: string,
  availabilities: Availability[]
): { available: boolean; conflictingAvailability?: Availability } {
  const shiftDay = new Date(shiftDate).getDay();

  // Find availability for this day of week
  const dayAvailabilities = availabilities.filter(a => {
    if (a.dayOfWeek !== shiftDay) return false;

    // Check if availability is active for this date
    if (a.effectiveDate && shiftDate < a.effectiveDate) return false;
    if (a.expiryDate && shiftDate > a.expiryDate) return false;

    return true;
  });

  // If no availability set, assume available (unless org requires availability)
  if (dayAvailabilities.length === 0) {
    return { available: true };
  }

  // Check if shift falls within any availability window
  for (const avail of dayAvailabilities) {
    if (timeRangesOverlap(shiftStartTime, shiftEndTime, avail.startTime, avail.endTime)) {
      // Shift at least partially overlaps with availability
      // Check if it's completely within
      const shiftStartMin = timeToMinutes(shiftStartTime);
      const shiftEndMin = timeToMinutes(shiftEndTime);
      const availStartMin = timeToMinutes(avail.startTime);
      const availEndMin = timeToMinutes(avail.endTime);

      if (shiftStartMin >= availStartMin && shiftEndMin <= availEndMin) {
        return { available: true };
      }
    }
  }

  return {
    available: false,
    conflictingAvailability: dayAvailabilities[0],
  };
}

/**
 * Detect schedule conflicts for a set of shifts
 */
export function detectScheduleConflicts(
  shifts: Array<{
    shiftId: string;
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
    locationId: string;
  }>,
  availabilities: Availability[],
  timeOffRequests: Array<{ userId: string; startDate: string; endDate: string; status: string }>,
  existingShifts: Array<{
    shiftId: string;
    userId: string;
    date: string;
    startTime: string;
    endTime: string;
  }>
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (const shift of shifts) {
    // Check for double-booking (overlapping shifts on same day for same employee)
    const sameUserShifts = [...existingShifts, ...shifts].filter(
      s => s.userId === shift.userId && s.date === shift.date && s.shiftId !== shift.shiftId
    );

    for (const otherShift of sameUserShifts) {
      if (timeRangesOverlap(shift.startTime, shift.endTime, otherShift.startTime, otherShift.endTime)) {
        conflicts.push({
          type: 'double_booking',
          severity: 'error',
          shiftId: shift.shiftId,
          userId: shift.userId,
          date: shift.date,
          description: `Shift overlaps with another shift (${otherShift.startTime}-${otherShift.endTime})`,
          conflictingShiftId: otherShift.shiftId,
        });
      }
    }

    // Check availability
    const userAvailabilities = availabilities.filter(a => a.userId === shift.userId);
    const availCheck = isWithinAvailability(
      shift.date,
      shift.startTime,
      shift.endTime,
      userAvailabilities
    );

    if (!availCheck.available && userAvailabilities.length > 0) {
      conflicts.push({
        type: 'unavailable',
        severity: 'warning',
        shiftId: shift.shiftId,
        userId: shift.userId,
        date: shift.date,
        description: `Employee is not available during these hours`,
      });
    }

    // Check time-off
    const userTimeOff = timeOffRequests.filter(
      t => t.userId === shift.userId && t.status === 'approved'
    );

    for (const timeOff of userTimeOff) {
      if (shift.date >= timeOff.startDate && shift.date <= timeOff.endDate) {
        conflicts.push({
          type: 'time_off',
          severity: 'error',
          shiftId: shift.shiftId,
          userId: shift.userId,
          date: shift.date,
          description: `Employee has approved time-off from ${timeOff.startDate} to ${timeOff.endDate}`,
        });
      }
    }

    // Check rest period (8 hours between shifts)
    const previousDay = new Date(shift.date);
    previousDay.setDate(previousDay.getDate() - 1);
    const prevDayStr = previousDay.toISOString().split('T')[0];

    const previousShift = existingShifts.find(
      s => s.userId === shift.userId && s.date === prevDayStr
    );

    if (previousShift) {
      const prevEndMin = timeToMinutes(previousShift.endTime);
      const shiftStartMin = timeToMinutes(shift.startTime);

      // Calculate hours between shifts (accounting for overnight)
      let hoursBetween = (shiftStartMin + 24 * 60 - prevEndMin) / 60;
      if (hoursBetween > 24) hoursBetween -= 24;

      if (hoursBetween < 8) {
        conflicts.push({
          type: 'insufficient_rest',
          severity: 'warning',
          shiftId: shift.shiftId,
          userId: shift.userId,
          date: shift.date,
          description: `Only ${hoursBetween.toFixed(1)} hours rest since previous shift (minimum 8 hours recommended)`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Calculate schedule statistics
 */
export function calculateScheduleStats(
  shifts: Array<{
    userId: string;
    locationId: string;
    startTime: string;
    endTime: string;
    payRate?: number;
  }>,
  locations: Map<string, { name: string }>
): ScheduleStats {
  const uniqueEmployees = new Set(shifts.map(s => s.userId));
  let totalHours = 0;
  let totalCost = 0;
  const coverage: { [locationId: string]: { locationName: string; shiftsCount: number; hoursTotal: number } } = {};

  for (const shift of shifts) {
    // Calculate shift hours
    const startMin = timeToMinutes(shift.startTime);
    let endMin = timeToMinutes(shift.endTime);

    // Handle overnight shifts
    if (endMin < startMin) {
      endMin += 24 * 60;
    }

    const hours = (endMin - startMin) / 60;
    totalHours += hours;

    // Calculate cost
    if (shift.payRate) {
      totalCost += hours * shift.payRate;
    }

    // Track coverage by location
    if (!coverage[shift.locationId]) {
      coverage[shift.locationId] = {
        locationName: locations.get(shift.locationId)?.name || 'Unknown',
        shiftsCount: 0,
        hoursTotal: 0,
      };
    }

    coverage[shift.locationId].shiftsCount++;
    coverage[shift.locationId].hoursTotal += hours;
  }

  return {
    totalShifts: shifts.length,
    totalHours: Math.round(totalHours * 10) / 10,
    employeesScheduled: uniqueEmployees.size,
    estimatedLaborCost: Math.round(totalCost * 100) / 100,
    coverage,
  };
}

/**
 * Generate shifts from a template for a date range
 */
export function generateShiftsFromTemplate(
  template: ShiftTemplate,
  startDate: string,
  endDate: string,
  userId?: string
): Array<{
  date: string;
  startTime: string;
  endTime: string;
  locationId: string;
  position?: string;
  templateId: string;
}> {
  const shifts = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();

    if (template.daysOfWeek.includes(dayOfWeek)) {
      shifts.push({
        date: current.toISOString().split('T')[0],
        startTime: template.startTime,
        endTime: template.endTime,
        locationId: template.locationId,
        position: template.position,
        templateId: template.templateId,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return shifts;
}

/**
 * Get day of week name
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

/**
 * Parse recurring pattern (e.g., "MWF" = Monday, Wednesday, Friday)
 */
export function parseRecurringPattern(pattern: string): number[] {
  const dayMap: { [key: string]: number } = {
    U: 0, // Sunday
    M: 1, // Monday
    T: 2, // Tuesday
    W: 3, // Wednesday
    R: 4, // Thursday
    F: 5, // Friday
    S: 6, // Saturday
  };

  return pattern.toUpperCase().split('').map(char => dayMap[char]).filter(day => day !== undefined);
}
