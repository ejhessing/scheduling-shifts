import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { format, startOfWeek, addDays } from 'date-fns';
import './Schedule.css';

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      apiClient.getSchedule({
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      }),
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const previousWeek = () => {
    setCurrentDate((prev) => addDays(prev, -7));
  };

  const nextWeek = () => {
    setCurrentDate((prev) => addDays(prev, 7));
  };

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <h1>Schedule</h1>
        <div className="week-navigation">
          <button onClick={previousWeek} className="nav-btn">← Previous</button>
          <span className="week-label">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={nextWeek} className="nav-btn">Next →</button>
        </div>
      </div>

      {isLoading && <div className="loading">Loading schedule...</div>}
      {error && <div className="error">Failed to load schedule</div>}

      <div className="schedule-grid">
        {days.map((day) => {
          const dayShifts = data?.shifts.filter(
            (shift: any) => shift.date === format(day, 'yyyy-MM-dd')
          ) || [];

          return (
            <div key={day.toISOString()} className="day-column">
              <div className="day-header">
                <div className="day-name">{format(day, 'EEE')}</div>
                <div className="day-date">{format(day, 'MMM d')}</div>
              </div>
              <div className="shifts-list">
                {dayShifts.length === 0 ? (
                  <div className="no-shifts">No shifts scheduled</div>
                ) : (
                  dayShifts.map((shift: any) => (
                    <div key={shift.shiftId} className="shift-card">
                      <div className="shift-time">
                        {format(new Date(shift.startTime), 'h:mm a')} -{' '}
                        {format(new Date(shift.endTime), 'h:mm a')}
                      </div>
                      <div className="shift-position">{shift.position}</div>
                      <div className={`shift-status status-${shift.status.toLowerCase()}`}>
                        {shift.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
