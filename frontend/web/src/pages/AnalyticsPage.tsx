import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  AlertCircle,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import { PageHeader, LoadingSpinner, StatsCard, EmptyState } from '../components/ui';
import { formatCurrency, formatHours, formatDate } from '../lib/utils';

interface AnalyticsMetrics {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalCost: number;
  regularCost: number;
  overtimeCost: number;
  shiftsScheduled: number;
  shiftsCompleted: number;
  attendanceRate: number;
  employeeCount: number;
}

interface TrendDataPoint {
  date: string;
  value: number;
}

interface DepartmentMetrics {
  locationId: string;
  locationName: string;
  hours: number;
  cost: number;
  employeeCount: number;
  attendanceRate: number;
}

interface Anomaly {
  type: string;
  description: string;
  entryId: string;
  severity: 'low' | 'medium' | 'high';
}

interface BudgetStatus {
  periodStart: string;
  periodEnd: string;
  budgetAmount: number;
  actualSpent: number;
  projectedSpend: number;
  remainingBudget: number;
  percentageUsed: number;
  onTrack: boolean;
  daysRemaining: number;
  alert?: boolean;
  alertMessage?: string;
}

export default function AnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Last 30 days
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Budget settings
  const [budgetAmount, setBudgetAmount] = useState(10000);
  const [showBudget, setShowBudget] = useState(true);

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', startDate, endDate, groupBy],
    queryFn: async () => {
      const response = await analyticsApi.getAnalytics({
        startDate,
        endDate,
        groupBy,
      });
      return response.data.data;
    },
    enabled: isManager,
  });

  // Fetch budget status
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', startDate, endDate, budgetAmount],
    queryFn: async () => {
      const response = await analyticsApi.getBudgetStatus({
        periodStart: startDate,
        periodEnd: endDate,
        budgetAmount,
      });
      return response.data.data as BudgetStatus;
    },
    enabled: isManager && showBudget,
  });

  // Fetch employee metrics
  const { data: employeeData, isLoading: employeeLoading } = useQuery({
    queryKey: ['employeeMetrics', startDate, endDate],
    queryFn: async () => {
      const response = await analyticsApi.getEmployeeMetrics({
        startDate,
        endDate,
      });
      return response.data.data;
    },
    enabled: isManager,
  });

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <EmptyState
          icon={AlertCircle}
          title="Access Restricted"
          description="Analytics are only available to managers and administrators."
        />
      </div>
    );
  }

  if (analyticsLoading || budgetLoading || employeeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const metrics: AnalyticsMetrics = analyticsData?.metrics || {
    totalHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    totalCost: 0,
    regularCost: 0,
    overtimeCost: 0,
    shiftsScheduled: 0,
    shiftsCompleted: 0,
    attendanceRate: 0,
    employeeCount: 0,
  };

  const trends = analyticsData?.trends || { hours: [], cost: [] };
  const departmentMetrics: DepartmentMetrics[] = analyticsData?.departmentMetrics || [];
  const anomalies: Anomaly[] = analyticsData?.anomalies || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Analytics Dashboard"
        description="Comprehensive insights into labor costs, hours worked, and performance"
        icon={TrendingUp}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Hours"
            value={formatHours(metrics.totalHours)}
            icon={Clock}
            description={`Regular: ${formatHours(metrics.regularHours)} | OT: ${formatHours(metrics.overtimeHours)}`}
            trend={metrics.overtimeHours > 0 ? 'up' : undefined}
          />
          <StatsCard
            title="Labor Cost"
            value={formatCurrency(metrics.totalCost)}
            icon={DollarSign}
            description={`Regular: ${formatCurrency(metrics.regularCost)} | OT: ${formatCurrency(metrics.overtimeCost)}`}
            trend={metrics.overtimeCost > metrics.regularCost * 0.1 ? 'up' : undefined}
          />
          <StatsCard
            title="Attendance Rate"
            value={`${metrics.attendanceRate}%`}
            icon={Users}
            description={`${metrics.shiftsCompleted} of ${metrics.shiftsScheduled} shifts completed`}
            trend={metrics.attendanceRate >= 95 ? 'up' : 'down'}
          />
          <StatsCard
            title="Active Employees"
            value={metrics.employeeCount.toString()}
            icon={Users}
            description="Employees with logged hours"
          />
        </div>

        {/* Budget Status */}
        {showBudget && budgetData && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Budget Tracking
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Budget:</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(parseFloat(e.target.value))}
                  className="w-32 px-3 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>

            {budgetData.alert && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{budgetData.alertMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Actual Spent:</span>
                <span className="font-semibold">{formatCurrency(budgetData.actualSpent)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Projected:</span>
                <span className="font-semibold">{formatCurrency(budgetData.projectedSpend)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Remaining:</span>
                <span className={`font-semibold ${budgetData.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(budgetData.remainingBudget)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Budget Usage</span>
                  <span>{budgetData.percentageUsed}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      budgetData.percentageUsed >= 100
                        ? 'bg-red-600'
                        : budgetData.percentageUsed >= 80
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(budgetData.percentageUsed, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-gray-600">{budgetData.daysRemaining} days remaining</span>
                <span
                  className={`text-sm font-medium ${budgetData.onTrack ? 'text-green-600' : 'text-red-600'}`}
                >
                  {budgetData.onTrack ? '✓ On Track' : '⚠ Over Budget'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Department Breakdown */}
        {departmentMetrics.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Department Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Employees</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {departmentMetrics.map((dept) => (
                    <tr key={dept.locationId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.locationName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatHours(dept.hours)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(dept.cost)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{dept.employeeCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            dept.attendanceRate >= 95
                              ? 'bg-green-100 text-green-800'
                              : dept.attendanceRate >= 85
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {dept.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Performers */}
        {employeeData?.employees && employeeData.employees.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Employee Performance</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT Hours</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Attendance</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Late Clock-Ins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employeeData.employees.slice(0, 10).map((emp: any) => (
                    <tr key={emp.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.userName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatHours(emp.totalHours)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {emp.overtimeHours > 0 ? (
                          <span className="text-orange-600 font-medium">{formatHours(emp.overtimeHours)}</span>
                        ) : (
                          '0h'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            emp.attendanceRate >= 95
                              ? 'bg-green-100 text-green-800'
                              : emp.attendanceRate >= 85
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {emp.attendanceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">
                        {emp.lateClockIns > 0 ? (
                          <span className="text-red-600">{emp.lateClockIns}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Anomalies Detected
            </h2>
            <div className="space-y-3">
              {anomalies.map((anomaly, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    anomaly.severity === 'high'
                      ? 'bg-red-50 border-red-200'
                      : anomaly.severity === 'medium'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        anomaly.severity === 'high'
                          ? 'text-red-600'
                          : anomaly.severity === 'medium'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{anomaly.type.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-600">{anomaly.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Placeholder - In production, would use recharts or similar */}
        {trends.hours.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trends</h2>
            <p className="text-sm text-gray-600 mb-4">
              Hours trend: {trends.hours.length} data points from {trends.hours[0]?.date} to{' '}
              {trends.hours[trends.hours.length - 1]?.date}
            </p>
            <p className="text-sm text-gray-500 italic">
              Chart visualization available when recharts library is installed. Data is available via API.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
