import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, SlotInfo, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { schedulingApi, usersApi, locationsApi } from '../api/client';
import { Plus, AlertTriangle, Users, MapPin, Clock } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Setup date-fns localizer for react-big-calendar
const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface ShiftEvent extends Event {
  shiftId: string;
  userId: string;
  userName: string;
  locationId: string;
  locationName: string;
  position?: string;
  status: string;
  color?: string;
}

export function ScheduleCalendarPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('week');
  const [selectedShift, setSelectedShift] = useState<ShiftEvent | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  // Calculate date range based on current view
  const dateRange = useMemo(() => {
    if (view === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    } else if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    } else {
      return {
        startDate: format(currentDate, 'yyyy-MM-dd'),
        endDate: format(currentDate, 'yyyy-MM-dd'),
      };
    }
  }, [currentDate, view]);

  // Fetch shifts
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['schedule', dateRange.startDate, dateRange.endDate],
    queryFn: () => schedulingApi.getSchedule(dateRange.startDate, dateRange.endDate),
  });

  // Fetch users for the organization
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.listUsers(),
  });

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getLocations(),
  });

  // Fetch schedule conflicts
  const { data: conflictsData } = useQuery({
    queryKey: ['schedule-conflicts', dateRange.startDate, dateRange.endDate],
    queryFn: () => schedulingApi.checkConflicts(dateRange.startDate, dateRange.endDate),
    enabled: user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner',
  });

  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: ({ shiftId, updates }: { shiftId: string; updates: any }) =>
      schedulingApi.updateShift(shiftId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-conflicts'] });
    },
  });

  // Convert shifts to calendar events
  const events: ShiftEvent[] = useMemo(() => {
    if (!shiftsData?.shifts) return [];

    const userMap = new Map(usersData?.users?.map((u: any) => [u.userId, u]) || []);
    const locationMap = new Map(locationsData?.locations?.map((l: any) => [l.locationId, l]) || []);

    return shiftsData.shifts.map((shift: any) => {
      const user = userMap.get(shift.userId);
      const location = locationMap.get(shift.locationId);
      const startDateTime = new Date(`${shift.date}T${shift.startTime}`);
      const endDateTime = new Date(`${shift.date}T${shift.endTime}`);

      // If end time is before start time, it's an overnight shift
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      return {
        shiftId: shift.shiftId,
        userId: shift.userId,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        locationId: shift.locationId,
        locationName: location?.name || 'Unknown Location',
        position: shift.position,
        status: shift.status,
        color: location?.color || '#3B82F6',
        title: `${user?.firstName || 'Unknown'} - ${location?.name || 'Unknown'}`,
        start: startDateTime,
        end: endDateTime,
      };
    });
  }, [shiftsData, usersData, locationsData]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: ShiftEvent) => {
    setSelectedShift(event);
  }, []);

  // Handle slot selection (for creating new shifts)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot(slotInfo);
    setShowCreateModal(true);
  }, []);

  // Handle event drag and drop
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: ShiftEvent; start: Date; end: Date }) => {
      const newDate = format(start, 'yyyy-MM-dd');
      const newStartTime = format(start, 'HH:mm');
      const newEndTime = format(end, 'HH:mm');

      updateShiftMutation.mutate({
        shiftId: event.shiftId,
        updates: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
        },
      });
    },
    [updateShiftMutation]
  );

  // Handle event resize
  const handleEventResize = useCallback(
    ({ event, start, end }: { event: ShiftEvent; start: Date; end: Date }) => {
      const newStartTime = format(start, 'HH:mm');
      const newEndTime = format(end, 'HH:mm');

      updateShiftMutation.mutate({
        shiftId: event.shiftId,
        updates: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      });
    },
    [updateShiftMutation]
  );

  // Custom event style
  const eventStyleGetter = useCallback((event: ShiftEvent) => {
    const hasConflict = conflictsData?.conflicts?.some(
      (c: any) => c.shiftId === event.shiftId
    );

    return {
      style: {
        backgroundColor: hasConflict ? '#EF4444' : event.color || '#3B82F6',
        borderColor: hasConflict ? '#DC2626' : undefined,
        opacity: event.status === 'draft' ? 0.7 : 1,
      },
    };
  }, [conflictsData]);

  const conflicts = conflictsData?.conflicts || [];
  const errors = conflicts.filter((c: any) => c.severity === 'error');
  const warnings = conflicts.filter((c: any) => c.severity === 'warning');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Schedule Calendar</h1>
              <p className="text-gray-600 mt-1">
                Drag and drop shifts to reschedule
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Create Shift
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Users className="w-5 h-5" />
                <span className="font-semibold">Total Shifts</span>
              </div>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                {events.length}
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Total Hours</span>
              </div>
              <p className="text-2xl font-bold text-green-900 mt-2">
                {shiftsData?.stats?.totalHours || 0}
              </p>
            </div>

            {errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Errors</span>
                </div>
                <p className="text-2xl font-bold text-red-900 mt-2">
                  {errors.length}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Double bookings, time-off conflicts
                </p>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Warnings</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900 mt-2">
                  {warnings.length}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Availability, rest period issues
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {shiftsLoading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 700 }}
              view={view}
              onView={(newView) => setView(newView as 'month' | 'week' | 'day')}
              date={currentDate}
              onNavigate={(date) => setCurrentDate(date)}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              selectable
              resizable
              draggableAccessor={() => true}
              eventPropGetter={eventStyleGetter}
              popup
            />
          )}
        </div>

        {/* Shift Details Modal */}
        {selectedShift && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">Shift Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600">Employee:</span>
                  <span className="ml-2 font-semibold">{selectedShift.userName}</span>
                </div>
                <div>
                  <span className="text-gray-600">Location:</span>
                  <span className="ml-2 font-semibold">{selectedShift.locationName}</span>
                </div>
                {selectedShift.position && (
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <span className="ml-2 font-semibold">{selectedShift.position}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Time:</span>
                  <span className="ml-2 font-semibold">
                    {format(selectedShift.start, 'h:mm a')} - {format(selectedShift.end, 'h:mm a')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-sm ${
                    selectedShift.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedShift.status}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedShift(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // TODO: Open edit modal
                    setSelectedShift(null);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
