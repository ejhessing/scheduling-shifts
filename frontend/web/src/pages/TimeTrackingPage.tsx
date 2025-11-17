import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeApi, locationApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Clock, MapPin, Camera, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function TimeTrackingPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Get current active entry
  const { data: timesheetData, isLoading } = useQuery({
    queryKey: ['timesheet', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await timeApi.getTimesheet({
        userId: user?.userId,
        startDate: today,
        endDate: today,
      });
      return response.data.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const activeEntry = timesheetData?.entries?.find((e: any) => !e.clockOutTime);

  // Get locations
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await locationApi.getLocations();
      return response.data.data;
    },
  });

  // Get current location
  const getLocation = () => {
    return new Promise<{ lat: number; lng: number; accuracy?: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(new Error('Unable to retrieve your location'));
        }
      );
    });
  };

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocationId) {
        throw new Error('Please select a location');
      }

      const loc = await getLocation();
      setLocation(loc);
      setLocationError('');

      return timeApi.clockIn({
        locationId: selectedLocationId,
        location: loc,
        notes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setNotes('');
    },
    onError: (error: any) => {
      setLocationError(error.response?.data?.error?.message || 'Failed to clock in');
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) throw new Error('No active time entry');

      const loc = await getLocation();
      setLocation(loc);
      setLocationError('');

      return timeApi.clockOut({
        entryId: activeEntry.entryId,
        location: loc,
        notes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setNotes('');
    },
    onError: (error: any) => {
      setLocationError(error.response?.data?.error?.message || 'Failed to clock out');
    },
  });

  const handleClockIn = () => {
    clockInMutation.mutate();
  };

  const handleClockOut = () => {
    clockOutMutation.mutate();
  };

  const isProcessing = clockInMutation.isPending || clockOutMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Clock in/out card */}
      <div className="card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <Clock className="w-10 h-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {activeEntry ? 'You are clocked in' : 'Ready to start work?'}
          </h2>
          <p className="text-gray-600 mt-2">
            {activeEntry
              ? `Started at ${format(new Date(activeEntry.clockInTime), 'h:mm a')}`
              : 'Clock in to start tracking your time'}
          </p>
        </div>

        {/* Location info */}
        {location && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Location captured</p>
                <p className="text-xs text-green-700 mt-1">
                  Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {locationError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-xs text-red-700 mt-1">{locationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Location selector (only for clock in) */}
        {!activeEntry && (
          <div className="mb-6">
            <label htmlFor="location" className="label">
              Location
            </label>
            <select
              id="location"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="input"
            >
              <option value="">Select a location</option>
              {locationsData?.locations?.map((loc: any) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.name}
                </option>
              ))}
            </select>
            {locationsData?.locations?.length === 0 && (
              <p className="mt-2 text-sm text-gray-600">
                No locations available. Please contact your manager to create locations.
              </p>
            )}
          </div>
        )}

        {/* Notes input */}
        <div className="mb-6">
          <label htmlFor="notes" className="label">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            rows={3}
            placeholder="Add any notes about this entry..."
          />
        </div>

        {/* Clock in/out button */}
        <button
          onClick={activeEntry ? handleClockOut : handleClockIn}
          disabled={isProcessing || isLoading}
          className={activeEntry ? 'btn-danger w-full' : 'btn-success w-full'}
        >
          {isProcessing ? (
            'Processing...'
          ) : activeEntry ? (
            <>
              <Clock className="w-5 h-5 mr-2" />
              Clock Out
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 mr-2" />
              Clock In
            </>
          )}
        </button>

        {/* Current session info */}
        {activeEntry && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Current Session</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <p>Started: {format(new Date(activeEntry.clockInTime), 'h:mm a')}</p>
              <p>
                Duration:{' '}
                {Math.floor(
                  (new Date().getTime() - new Date(activeEntry.clockInTime).getTime()) /
                    (1000 * 60 * 60)
                )}
                h{' '}
                {Math.floor(
                  ((new Date().getTime() - new Date(activeEntry.clockInTime).getTime()) /
                    (1000 * 60)) %
                    60
                )}
                m
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Today's entries */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Entries</h3>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : !timesheetData?.entries || timesheetData.entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No entries yet today</div>
        ) : (
          <div className="space-y-3">
            {timesheetData.entries.map((entry: any) => (
              <div key={entry.entryId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(entry.clockInTime), 'h:mm a')}
                    {entry.clockOutTime && ` - ${format(new Date(entry.clockOutTime), 'h:mm a')}`}
                  </p>
                  {entry.notes && <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>}
                </div>
                <div className="text-right">
                  {entry.clockOutTime ? (
                    <>
                      <p className="font-medium text-gray-900">
                        {entry.totalHours?.toFixed(2) || '0.00'}h
                      </p>
                      <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                    </>
                  ) : (
                    <span className="text-blue-600 text-sm font-medium">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
