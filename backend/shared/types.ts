/**
 * Shared TypeScript types for backend services
 */

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string;
  role: 'employee' | 'manager' | 'admin' | 'owner';
  organizationId: string;
  hourlyRate?: number;
  employeeNumber?: string;
  hireDate?: string;
  department?: string;
  position?: string;
}

export interface TimeEntry {
  entryId: string;
  userId: string;
  organizationId: string;
  locationId: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  notes?: string;
  clockInLocation?: {
    latitude: number;
    longitude: number;
  };
  clockOutLocation?: {
    latitude: number;
    longitude: number;
  };
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Shift {
  shiftId: string;
  organizationId: string;
  userId: string;
  locationId: string;
  date: string;
  startTime: string;
  endTime: string;
  position?: string;
  status: 'scheduled' | 'published' | 'cancelled';
  notes?: string;
}

export interface Location {
  locationId: string;
  organizationId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  active: boolean;
}
