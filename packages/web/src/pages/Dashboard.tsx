import { useState } from 'react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [clockedIn, setClockedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleClockIn = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Get user's current location
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await apiClient.clockIn({
              userId: user?.userId,
              locationId: user?.locationIds?.[0] || 'default-location',
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
              },
              method: 'WEB',
            });

            setCurrentEntryId(response.entryId);
            setClockedIn(true);
            setMessage(response.message);
          } catch (error: any) {
            setMessage(error.response?.data?.error?.message || 'Clock in failed');
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          setMessage('Failed to get your location. Please enable location services.');
          setLoading(false);
        }
      );
    } catch (error: any) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentEntryId) return;

    setLoading(true);
    setMessage('');

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await apiClient.clockOut({
              entryId: currentEntryId,
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString(),
              },
            });

            setClockedIn(false);
            setCurrentEntryId(null);
            setMessage(
              `Clocked out successfully! Total: ${response.totalHours.toFixed(2)} hours, Pay: $${response.totalPay.toFixed(2)}`
            );
          } catch (error: any) {
            setMessage(error.response?.data?.error?.message || 'Clock out failed');
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          setMessage('Failed to get your location. Please enable location services.');
          setLoading(false);
        }
      );
    } catch (error: any) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user?.name}!</h1>
        <p className="dashboard-subtitle">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {message && (
        <div className={`message ${message.includes('success') || message.includes('Total') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="clock-card">
        <div className="clock-status">
          <div className={`status-indicator ${clockedIn ? 'active' : ''}`}></div>
          <span className="status-text">
            {clockedIn ? 'You are clocked in' : 'You are clocked out'}
          </span>
        </div>

        <div className="clock-actions">
          {!clockedIn ? (
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="clock-btn clock-in-btn"
            >
              {loading ? 'Clocking in...' : 'Clock In'}
            </button>
          ) : (
            <button
              onClick={handleClockOut}
              disabled={loading}
              className="clock-btn clock-out-btn"
            >
              {loading ? 'Clocking out...' : 'Clock Out'}
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>This Week</h3>
          <p className="stat-value">0 hours</p>
          <p className="stat-label">Total Hours</p>
        </div>

        <div className="stat-card">
          <h3>Today</h3>
          <p className="stat-value">0 hours</p>
          <p className="stat-label">Hours Worked</p>
        </div>

        <div className="stat-card">
          <h3>Upcoming</h3>
          <p className="stat-value">0</p>
          <p className="stat-label">Scheduled Shifts</p>
        </div>
      </div>
    </div>
  );
}
