import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi, userApi, scheduleApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Users, Clock, CheckCircle, XCircle, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'team' | 'shifts'>('pending');

  const isManager = ['manager', 'admin', 'owner'].includes(user?.role || '');

  if (!isManager) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">You don't have permission to access this page</p>
      </div>
    );
  }

  // Get all users
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await userApi.listUsers();
      return response.data.data;
    },
  });

  // Get pending time entries
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-entries'],
    queryFn: async () => {
      // Fetch timesheet for all users this week
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const response = await timeApi.getTimesheet({
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
      });

      // Filter for pending entries
      const pendingEntries = response.data.data.entries?.filter(
        (e: any) => e.status === 'pending_approval'
      ) || [];

      return { entries: pendingEntries };
    },
  });

  // Approve/reject mutation
  const approveMutation = useMutation({
    mutationFn: ({ entryIds, action }: { entryIds: string[]; action: 'approve' | 'reject' }) => {
      return timeApi.approveEntries({ entryIds, action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setSelectedEntries([]);
    },
  });

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === pendingData?.entries?.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(pendingData?.entries?.map((e: any) => e.entryId) || []);
    }
  };

  const handleApprove = () => {
    if (selectedEntries.length === 0) return;
    approveMutation.mutate({ entryIds: selectedEntries, action: 'approve' });
  };

  const handleReject = () => {
    if (selectedEntries.length === 0) return;
    if (confirm(`Are you sure you want to reject ${selectedEntries.length} time entries?`)) {
      approveMutation.mutate({ entryIds: selectedEntries, action: 'reject' });
    }
  };

  // Get user name from ID
  const getUserName = (userId: string) => {
    const foundUser = usersData?.users?.find((u: any) => u.userId === userId);
    return foundUser?.name || 'Unknown User';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
        <p className="text-gray-600">Manage your team and approve time entries</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Team Members</p>
              <p className="text-2xl font-bold text-gray-900">
                {usersData?.users?.length || 0}
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900">
                {pendingData?.entries?.length || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Now</p>
              <p className="text-2xl font-bold text-gray-900">
                {/* TODO: Calculate active users */}
                0
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scheduled Shifts</p>
              <p className="text-2xl font-bold text-gray-900">
                {/* TODO: Get upcoming shifts count */}
                0
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approvals ({pendingData?.entries?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'team'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Team Members ({usersData?.users?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shifts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upcoming Shifts
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'pending' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Pending Time Entries</h3>
            {selectedEntries.length > 0 && (
              <div className="flex items-center space-x-2">
                <button onClick={handleApprove} className="btn-success">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve ({selectedEntries.length})
                </button>
                <button onClick={handleReject} className="btn-danger">
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject ({selectedEntries.length})
                </button>
              </div>
            )}
          </div>

          {pendingLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : !pendingData?.entries || pendingData.entries.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pending approvals</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEntries.length === pendingData.entries.length}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingData.entries.map((entry: any) => (
                    <tr
                      key={entry.entryId}
                      className={`hover:bg-gray-50 ${
                        selectedEntries.includes(entry.entryId) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry.entryId)}
                          onChange={() => handleSelectEntry(entry.entryId)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getUserName(entry.userId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(entry.clockInTime), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(entry.clockInTime), 'h:mm a')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.clockOutTime
                          ? format(new Date(entry.clockOutTime), 'h:mm a')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.totalHours?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${entry.totalPay?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Team Members</h3>
          {!usersData?.users || usersData.users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No team members</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usersData.users.map((member: any) => (
                <div key={member.userId} className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-primary-700 font-medium text-lg">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{member.name}</h4>
                      <p className="text-sm text-gray-600">{member.email}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Role:</span>
                      <span className="font-medium capitalize">{member.role}</span>
                    </div>
                    {member.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{member.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'shifts' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Upcoming Shifts</h3>
          <div className="text-center py-8">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Shifts view coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}
