import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format, subDays } from 'date-fns';
import './Analytics.css';

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: laborCost, isLoading: loadingLabor } = useQuery({
    queryKey: ['labor-cost', dateRange],
    queryFn: () => apiClient.getLaborCostAnalysis(dateRange),
  });

  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', dateRange],
    queryFn: () => apiClient.getAttendanceReport(dateRange),
  });

  if (loadingLabor || loadingAttendance) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <div className="date-range-selector">
          <label>
            From:
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            />
          </label>
          <label>
            To:
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            />
          </label>
        </div>
      </div>

      {/* Labor Cost Summary */}
      <section className="analytics-section">
        <h2>Labor Cost Analysis</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Total Hours</div>
            <div className="metric-value">{laborCost?.summary.totalHours.toFixed(2)}</div>
            <div className="metric-subtext">
              Regular: {laborCost?.summary.regularHours.toFixed(2)} |
              OT: {laborCost?.summary.overtimeHours.toFixed(2)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Cost</div>
            <div className="metric-value">${laborCost?.summary.totalCost.toFixed(2)}</div>
            <div className="metric-subtext">
              Avg Rate: ${laborCost?.summary.averageHourlyRate.toFixed(2)}/hr
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Entries</div>
            <div className="metric-value">{laborCost?.summary.totalEntries}</div>
          </div>
        </div>

        {/* Cost by User */}
        <div className="chart-container">
          <h3>Cost by Employee</h3>
          <div className="bar-chart">
            {laborCost?.byUser.slice(0, 10).map((user: any) => (
              <div key={user.userId} className="bar-item">
                <div className="bar-label">{user.userId.substring(0, 8)}</div>
                <div className="bar-wrapper">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(user.totalPay / laborCost.summary.totalCost) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="bar-value">${user.totalPay.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost by Location */}
        <div className="chart-container">
          <h3>Cost by Location</h3>
          <div className="bar-chart">
            {laborCost?.byLocation.map((loc: any) => (
              <div key={loc.locationId} className="bar-item">
                <div className="bar-label">{loc.locationId.substring(0, 12)}</div>
                <div className="bar-wrapper">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(loc.totalCost / laborCost.summary.totalCost) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="bar-value">
                  ${loc.totalCost.toFixed(2)} ({loc.employeeCount} employees)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Trend */}
        <div className="chart-container">
          <h3>Daily Labor Cost Trend</h3>
          <div className="line-chart">
            {laborCost?.byDate.map((day: any) => (
              <div key={day.date} className="line-item">
                <div className="line-date">{format(new Date(day.date), 'MMM d')}</div>
                <div className="line-bar-wrapper">
                  <div
                    className="line-bar"
                    style={{
                      height: `${(day.totalCost / Math.max(...laborCost.byDate.map((d: any) => d.totalCost))) * 100}%`,
                    }}
                  ></div>
                </div>
                <div className="line-value">${day.totalCost.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Attendance Analysis */}
      <section className="analytics-section">
        <h2>Attendance Analysis</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Attendance Rate</div>
            <div className="metric-value">{attendance?.summary.attendanceRate}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Completed Shifts</div>
            <div className="metric-value">{attendance?.summary.completedShifts}</div>
            <div className="metric-subtext">
              of {attendance?.summary.totalShifts} scheduled
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">No-Shows</div>
            <div className="metric-value danger">{attendance?.summary.noShows}</div>
          </div>
        </div>

        {/* Attendance by Employee */}
        <div className="table-container">
          <h3>Employee Attendance</h3>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Scheduled</th>
                <th>Completed</th>
                <th>No-Shows</th>
                <th>Late Clock-Ins</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {attendance?.byUser.slice(0, 15).map((user: any) => (
                <tr key={user.userId}>
                  <td>{user.userId.substring(0, 8)}</td>
                  <td>{user.scheduled}</td>
                  <td>{user.completed}</td>
                  <td className={user.noShows > 0 ? 'danger' : ''}>{user.noShows}</td>
                  <td>{user.lateClockIns}</td>
                  <td>
                    <span className={`badge ${user.attendanceRate >= 90 ? 'success' : user.attendanceRate >= 75 ? 'warning' : 'danger'}`}>
                      {user.attendanceRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
