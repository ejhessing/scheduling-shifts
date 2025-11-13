import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { timeOffApi } from '../lib/api';
import { Calendar, Plus, Check, X, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TimeOffRequest, TimeOffType, TimeOffStatus } from '../types';
import { StatusBadge, LoadingSpinner, Modal, PageHeader, EmptyState, StatsCard, Button } from '../components/ui';
import { useIsManager } from '../hooks';
import { capitalize } from '../lib/utils';

export function TimeOffPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'balance' | 'requests' | 'pending'>('balance');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);

  const isManager = useIsManager(user?.role);

  // Fetch time-off balance
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['time-off-balance', user?.userId],
    queryFn: () => timeOffApi.getBalance(),
  });

  // Fetch user's time-off requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['time-off-requests', user?.userId],
    queryFn: () => timeOffApi.getRequests(),
  });

  // Fetch pending requests (managers only)
  const { data: pendingData } = useQuery({
    queryKey: ['time-off-pending'],
    queryFn: () => timeOffApi.getPendingRequests(),
    enabled: isManager,
  });

  // Request time off mutation
  const requestTimeOffMutation = useMutation({
    mutationFn: (data: any) => timeOffApi.requestTimeOff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-balance'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      setShowRequestModal(false);
    },
  });

  // Review time off mutation
  const reviewTimeOffMutation = useMutation({
    mutationFn: ({ requestId, action, notes }: { requestId: string; action: 'approve' | 'reject'; notes?: string }) =>
      timeOffApi.reviewTimeOff(requestId, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off-pending'] });
      queryClient.invalidateQueries({ queryKey: ['time-off-requests'] });
      setShowReviewModal(false);
      setSelectedRequest(null);
    },
  });

  const balance = balanceData?.balance;
  const requests = requestsData?.requests || [];
  const pendingRequests = pendingData?.requests || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Time Off"
          description="Manage your time-off requests and balance"
          action={{
            label: 'Request Time Off',
            icon: <Plus className="w-5 h-5" />,
            onClick: () => setShowRequestModal(true),
          }}
        />

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex gap-4 p-6 border-b">
            <button
              onClick={() => setActiveTab('balance')}
              className={`pb-2 px-1 border-b-2 ${
                activeTab === 'balance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              Balance
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-2 px-1 border-b-2 ${
                activeTab === 'requests'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              My Requests
            </button>
            {isManager && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`pb-2 px-1 border-b-2 relative ${
                  activeTab === 'pending'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600'
                }`}
              >
                Pending Approvals
                {pendingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Balance Tab */}
          {activeTab === 'balance' && (
            <div className="p-6 space-y-6">
              {balanceLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  {/* Balance Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border rounded-lg p-6">
                      <div className="flex items-center gap-2 text-blue-700 mb-4">
                        <Calendar className="w-5 h-5" />
                        <h3 className="font-semibold">Vacation</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accrued:</span>
                          <span className="font-semibold">{balance?.vacation?.accrued || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Used:</span>
                          <span className="font-semibold">{balance?.vacation?.used || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pending:</span>
                          <span className="font-semibold text-yellow-600">{balance?.vacation?.pending || 0} days</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-900 font-semibold">Available:</span>
                          <span className="font-bold text-blue-600">{balance?.vacation?.available || 0} days</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-6">
                      <div className="flex items-center gap-2 text-green-700 mb-4">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="font-semibold">Sick</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accrued:</span>
                          <span className="font-semibold">{balance?.sick?.accrued || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Used:</span>
                          <span className="font-semibold">{balance?.sick?.used || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pending:</span>
                          <span className="font-semibold text-yellow-600">{balance?.sick?.pending || 0} days</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-900 font-semibold">Available:</span>
                          <span className="font-bold text-green-600">{balance?.sick?.available || 0} days</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border rounded-lg p-6">
                      <div className="flex items-center gap-2 text-purple-700 mb-4">
                        <Clock className="w-5 h-5" />
                        <h3 className="font-semibold">Personal</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accrued:</span>
                          <span className="font-semibold">{balance?.personal?.accrued || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Used:</span>
                          <span className="font-semibold">{balance?.personal?.used || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pending:</span>
                          <span className="font-semibold text-yellow-600">{balance?.personal?.pending || 0} days</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-900 font-semibold">Available:</span>
                          <span className="font-bold text-purple-600">{balance?.personal?.available || 0} days</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Time Off */}
                  {balanceData?.upcomingTimeOff && balanceData.upcomingTimeOff.length > 0 && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Upcoming Time Off</h3>
                      <div className="space-y-3">
                        {balanceData.upcomingTimeOff.map((timeOff: TimeOffRequest) => (
                          <div key={timeOff.requestId} className="flex justify-between items-center border-b pb-3 last:border-0">
                            <div>
                              <div className="font-medium">{capitalize(timeOff.type)}</div>
                              <div className="text-sm text-gray-600">
                                {format(parseISO(timeOff.startDate), 'MMM d')} - {format(parseISO(timeOff.endDate), 'MMM d, yyyy')}
                                <span className="ml-2">({timeOff.totalDays} days)</span>
                              </div>
                            </div>
                            <StatusBadge status={timeOff.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === 'requests' && (
            <div className="p-6">
              {requestsLoading ? (
                <LoadingSpinner />
              ) : requests.length === 0 ? (
                <EmptyState
                  icon={<Calendar className="w-12 h-12" />}
                  title="No time-off requests yet"
                  action={{
                    label: 'Request your first time off',
                    onClick: () => setShowRequestModal(true),
                  }}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {requests.map((request: TimeOffRequest) => (
                        <tr key={request.requestId} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <span className="font-medium">{capitalize(request.type)}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm">{request.totalDays}</td>
                          <td className="px-6 py-4">
                            <StatusBadge status={request.status} />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {format(parseISO(request.requestedAt), 'MMM d, yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pending Approvals Tab (Managers Only) */}
          {activeTab === 'pending' && isManager && (
            <div className="p-6">
              {pendingRequests.length === 0 ? (
                <EmptyState
                  icon={<Check className="w-12 h-12 text-green-500" />}
                  title="No pending time-off requests"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingRequests.map((request: TimeOffRequest) => (
                        <tr key={request.requestId} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium">{request.userName}</div>
                              <div className="text-sm text-gray-500">{request.userEmail}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium">{capitalize(request.type)}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm">{request.totalDays}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{request.reason || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowReviewModal(true);
                                }}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => reviewTimeOffMutation.mutate({ requestId: request.requestId, action: 'reject' })}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Request Time Off Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Time Off"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            requestTimeOffMutation.mutate({
              type: formData.get('type'),
              startDate: formData.get('startDate'),
              endDate: formData.get('endDate'),
              reason: formData.get('reason'),
            });
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select name="type" required className="w-full p-2 border rounded-lg">
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input type="date" name="startDate" required className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input type="date" name="endDate" required className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <textarea name="reason" rows={3} className="w-full p-2 border rounded-lg" />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRequestModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={requestTimeOffMutation.isPending}
              className="flex-1"
            >
              {requestTimeOffMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
