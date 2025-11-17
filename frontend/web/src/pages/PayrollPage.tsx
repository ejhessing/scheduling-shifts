import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  DollarSign,
  Download,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { PageHeader, LoadingSpinner, StatusBadge, Modal, EmptyState, Button } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/utils';

interface PayrollPeriod {
  periodId: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';
  periodType: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  totalGrossPay: number;
  totalNetPay?: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export default function PayrollPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'quickbooks' | 'adp' | 'json'>('csv');

  // Form state for creating new period
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    payDate: '',
    periodType: 'biweekly' as 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
  });

  // Fetch payroll periods
  const { data: periods, isLoading } = useQuery({
    queryKey: ['payrollPeriods'],
    queryFn: async () => {
      const response = await payrollApi.getPeriods();
      return response.data.data as PayrollPeriod[];
    },
    enabled: isManager,
  });

  // Create period mutation
  const createPeriodMutation = useMutation({
    mutationFn: payrollApi.createPeriod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
      setShowCreateModal(false);
      setFormData({
        startDate: '',
        endDate: '',
        payDate: '',
        periodType: 'biweekly',
      });
    },
  });

  // Process period mutation
  const processMutation = useMutation({
    mutationFn: (periodId: string) => payrollApi.processPeriod(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
    },
  });

  // Approve period mutation
  const approveMutation = useMutation({
    mutationFn: ({ periodId, action }: { periodId: string; action: 'approve' | 'mark_paid' }) =>
      payrollApi.approvePeriod(periodId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] });
    },
  });

  // Export payroll
  const handleExport = async (periodId: string, format: 'csv' | 'quickbooks' | 'adp' | 'json') => {
    try {
      const response = await payrollApi.exportPeriod(periodId, format);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const extensions = {
        csv: 'csv',
        quickbooks: 'iif',
        adp: 'csv',
        json: 'json',
      };

      link.setAttribute('download', `payroll_export.${extensions[format]}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export payroll');
    }
  };

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <EmptyState
          icon={AlertCircle}
          title="Access Restricted"
          description="Payroll management is only available to managers and administrators."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Payroll Management"
        description="Manage payroll periods, process payments, and export to payroll systems"
        icon={DollarSign}
        action={
          <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
            Create Period
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto p-6">
        {!periods || periods.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Payroll Periods"
            description="Create your first payroll period to get started"
            action={
              <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                Create Period
              </Button>
            }
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employees</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Pay</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {periods.map((period) => (
                  <tr key={period.periodId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(new Date(period.startDate))} - {formatDate(new Date(period.endDate))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(new Date(period.payDate))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                      {period.periodType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {period.employeeCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(period.totalGrossPay)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={period.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {period.status === 'draft' && (
                          <button
                            onClick={() => processMutation.mutate(period.periodId)}
                            disabled={processMutation.isPending}
                            className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                            title="Process Payroll"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Process
                          </button>
                        )}

                        {period.status === 'processing' && (
                          <button
                            onClick={() => approveMutation.mutate({ periodId: period.periodId, action: 'approve' })}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center px-3 py-1 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
                            title="Approve Payroll"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </button>
                        )}

                        {period.status === 'approved' && (
                          <button
                            onClick={() => approveMutation.mutate({ periodId: period.periodId, action: 'mark_paid' })}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center px-3 py-1 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50"
                            title="Mark as Paid"
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Mark Paid
                          </button>
                        )}

                        {(period.status === 'processing' || period.status === 'approved' || period.status === 'paid') && (
                          <button
                            onClick={() => {
                              setSelectedPeriod(period);
                            }}
                            className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
                            title="Export Payroll"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Period Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Payroll Period"
        icon={Plus}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPeriodMutation.mutate(formData);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
            <select
              value={formData.periodType}
              onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="semimonthly">Semi-monthly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pay Date</label>
            <input
              type="date"
              value={formData.payDate}
              onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPeriodMutation.isPending}
              className="flex-1 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {createPeriodMutation.isPending ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={selectedPeriod !== null}
        onClose={() => setSelectedPeriod(null)}
        title="Export Payroll"
        icon={Download}
      >
        {selectedPeriod && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Period:</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(new Date(selectedPeriod.startDate))} - {formatDate(new Date(selectedPeriod.endDate))}
              </p>
              <p className="text-sm text-gray-600 mt-2">Total Gross Pay:</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(selectedPeriod.totalGrossPay)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
              <div className="space-y-2">
                {[
                  { value: 'csv', label: 'CSV (Excel, Spreadsheets)' },
                  { value: 'quickbooks', label: 'QuickBooks IIF' },
                  { value: 'adp', label: 'ADP Format' },
                  { value: 'json', label: 'JSON (API Integration)' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="format"
                      value={option.value}
                      checked={exportFormat === option.value}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="mr-3"
                    />
                    <span className="text-sm text-gray-900">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setSelectedPeriod(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleExport(selectedPeriod.periodId, exportFormat);
                  setSelectedPeriod(null);
                }}
                className="flex-1 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
