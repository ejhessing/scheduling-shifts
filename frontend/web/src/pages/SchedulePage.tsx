import { useQuery } from '@tanstack/react-query';
import { scheduleApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Calendar, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useState } from 'react';

export default function SchedulePage() {
  const { user } = useAuthStore();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = format(startOfWeek(currentWeek), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(currentWeek), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
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

  const handlePreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Schedule</h2>
          <p className="text-gray-600">
            {format(startOfWeek(currentWeek), 'MMM d')} -{' '}
            {format(endOfWeek(currentWeek), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handlePreviousWeek} className="btn-secondary">
            Previous
          </button>
          <button onClick={handleToday} className="btn-secondary">
            Today
          </button>
          <button onClick={handleNextWeek} className="btn-secondary">
            Next
          </button>
        </div>
      </div>

      {/* Schedule grid */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading schedule...</div>
        ) : !data?.shiftsByDate || Object.keys(data.shiftsByDate).length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No shifts scheduled for this week</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(data.shiftsByDate).map(([date, shifts]: [string, any]) => (
              <div key={date} className="border-b pb-4 last:border-b-0">
                <h3 className="font-semibold text-gray-900 mb-3">
                  {format(new Date(date), 'EEEE, MMMM d')}
                </h3>
                <div className="space-y-2">
                  {shifts.map((shift: any) => (
                    <div key={shift.shiftId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {format(new Date(shift.startTime), 'h:mm a')} -{' '}
                            {format(new Date(shift.endTime), 'h:mm a')}
                          </p>
                          {shift.position && (
                            <p className="text-sm text-gray-600">{shift.position}</p>
                          )}
                          {shift.notes && (
                            <p className="text-sm text-gray-500 mt-1">{shift.notes}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          shift.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : shift.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700'
                            : shift.status === 'completed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {shift.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
