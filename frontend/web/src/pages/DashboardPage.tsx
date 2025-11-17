import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { timeApi, scheduleApi } from '../lib/api';
import { Clock, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const today = new Date();
  const weekStart = format(startOfWeek(today), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(today), 'yyyy-MM-dd');

  // Fetch current week timesheet
  const { data: timesheetData, isLoading: timesheetLoading } = useQuery({
    queryKey: ['timesheet', weekStart, weekEnd],
    queryFn: async () => {
      const response = await timeApi.getTimesheet({
        userId: user?.userId,
        startDate: weekStart,
        endDate: weekEnd,
      });
      return response.data.data;
    },
  });

  // Fetch upcoming shifts
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule', weekStart, weekEnd],
    queryFn: async () => {
      const response = await scheduleApi.getSchedule({
        userId: user?.userId,
        startDate: weekStart,
        endDate: weekEnd,
      });
      return response.data.data;
    },
  });

  const summary = timesheetData?.summary || {
    totalHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    totalPay: 0,
    pendingApproval: 0,
  };

  const upcomingShifts = scheduleData?.shifts?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h2>
        <p className="text-gray-600">Here's your activity for this week</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {timesheetLoading ? '...' : summary.totalHours.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overtime Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {timesheetLoading ? '...' : summary.overtimeHours.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Estimated Pay</p>
              <p className="text-2xl font-bold text-gray-900">
                {timesheetLoading ? '...' : `$${summary.totalPay.toFixed(2)}`}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Shifts</p>
              <p className="text-2xl font-bold text-gray-900">
                {scheduleLoading ? '...' : upcomingShifts.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming shifts */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Shifts</h3>
        {scheduleLoading ? (
          <div className="text-center py-8 text-gray-500">Loading shifts...</div>
        ) : upcomingShifts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No upcoming shifts</div>
        ) : (
          <div className="space-y-3">
            {upcomingShifts.map((shift: any) => (
              <div key={shift.shiftId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(shift.startTime), 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(shift.startTime), 'h:mm a')} -{' '}
                    {format(new Date(shift.endTime), 'h:mm a')}
                  </p>
                  {shift.position && (
                    <p className="text-sm text-gray-500">{shift.position}</p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    shift.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : shift.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {shift.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent time entries */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Time Entries</h3>
        {timesheetLoading ? (
          <div className="text-center py-8 text-gray-500">Loading entries...</div>
        ) : !timesheetData?.entries || timesheetData.entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No time entries yet</div>
        ) : (
          <div className="space-y-3">
            {timesheetData.entries.slice(0, 5).map((entry: any) => (
              <div key={entry.entryId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(entry.clockInTime), 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(entry.clockInTime), 'h:mm a')}
                    {entry.clockOutTime && ` - ${format(new Date(entry.clockOutTime), 'h:mm a')}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{entry.totalHours?.toFixed(2) || '0.00'}h</p>
                  <span
                    className={`text-xs font-medium ${
                      entry.status === 'approved'
                        ? 'text-green-600'
                        : entry.status === 'pending_approval'
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {entry.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
