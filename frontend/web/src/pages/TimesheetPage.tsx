import { useQuery } from '@tanstack/react-query';
import { timeApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { FileText, DollarSign, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useState } from 'react';

export default function TimesheetPage() {
  const { user } = useAuthStore();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = format(startOfWeek(currentWeek), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(currentWeek), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
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

  const handlePreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const summary = data?.summary || {
    totalHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    totalPay: 0,
    pendingApproval: 0,
    approved: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Timesheet</h2>
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : summary.totalHours.toFixed(2)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-primary-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Regular Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : summary.regularHours.toFixed(2)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overtime Hours</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : summary.overtimeHours.toFixed(2)}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pay</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : `$${summary.totalPay.toFixed(2)}`}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Time entries */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Time Entries</h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              <span className="text-gray-600">Approved ({summary.approved})</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
              <span className="text-gray-600">Pending ({summary.pendingApproval})</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading entries...</div>
        ) : !data?.entries || data.entries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No time entries for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clock In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clock Out
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.entries.map((entry: any) => (
                  <tr key={entry.entryId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(entry.clockInTime), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(entry.clockInTime), 'h:mm a')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.clockOutTime ? format(new Date(entry.clockOutTime), 'h:mm a') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.totalHours?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${entry.totalPay?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          entry.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : entry.status === 'pending_approval'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
