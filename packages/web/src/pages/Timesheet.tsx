import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import './Timesheet.css';

export default function Timesheet() {
  const [currentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  const { data, isLoading, error } = useQuery({
    queryKey: ['timesheet', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      apiClient.getTimesheet({
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
      }),
  });

  return (
    <div className="timesheet-container">
      <div className="timesheet-header">
        <h1>Timesheet</h1>
        <p className="date-range">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </p>
      </div>

      {data?.summary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Total Hours</div>
            <div className="summary-value">{data.summary.totalHours.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Regular Hours</div>
            <div className="summary-value">{data.summary.regularHours.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Overtime Hours</div>
            <div className="summary-value">{data.summary.overtimeHours.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Pay</div>
            <div className="summary-value">${data.summary.totalPay.toFixed(2)}</div>
          </div>
        </div>
      )}

      {isLoading && <div className="loading">Loading timesheet...</div>}
      {error && <div className="error">Failed to load timesheet</div>}

      {data?.entries && data.entries.length > 0 ? (
        <div className="entries-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
                <th>Regular</th>
                <th>Overtime</th>
                <th>Pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry: any) => (
                <tr key={entry.entryId}>
                  <td>{format(new Date(entry.date), 'MMM d, yyyy')}</td>
                  <td>{format(new Date(entry.clockInTime), 'h:mm a')}</td>
                  <td>
                    {entry.clockOutTime
                      ? format(new Date(entry.clockOutTime), 'h:mm a')
                      : '-'}
                  </td>
                  <td>{entry.totalHours?.toFixed(2) || '-'}</td>
                  <td>{entry.regularHours?.toFixed(2) || '-'}</td>
                  <td>{entry.overtimeHours?.toFixed(2) || '-'}</td>
                  <td>${entry.totalPay?.toFixed(2) || '-'}</td>
                  <td>
                    <span className={`status-badge status-${entry.status.toLowerCase()}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-entries">No time entries found for this period</div>
      )}
    </div>
  );
}
