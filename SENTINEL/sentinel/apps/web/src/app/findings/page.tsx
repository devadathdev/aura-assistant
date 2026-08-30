'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate, getSeverityColor, getStatusColor, truncate } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
} from 'lucide-react';

export default function FindingsPage() {
  const { findings, fetchFindings, isLoading } = useStore();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'severity' | 'confidence'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const filteredFindings = findings
    .filter((f) => {
      if (search && !f.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'created_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  const handleSort = (field: 'created_at' | 'severity' | 'confidence') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-4 w-4 text-slate-400" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-sentinel-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-sentinel-600" />
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Findings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Security findings and alerts</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button variant="primary" size="sm" onClick={() => fetchFindings()}>
              <Search className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search findings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full sm:w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sentinel-500 border-t-transparent mx-auto" />
                <p className="mt-4 text-slate-500">Loading findings...</p>
              </div>
            ) : filteredFindings.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldAlert className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No findings</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {search || severityFilter || statusFilter
                    ? 'No findings match your filters'
                    : 'No findings recorded yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleSort('created_at')}>
                        <div className="flex items-center gap-1">
                          Created
                          <SortIcon field="created_at" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleSort('severity')}>
                        <div className="flex items-center gap-1">
                          Severity
                          <SortIcon field="severity" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleSort('confidence')}>
                        <div className="flex items-center gap-1">
                          Confidence
                          <SortIcon field="confidence" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Detector</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredFindings.map((finding) => (
                      <tr key={finding.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(finding.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="severity" value={finding.severity}>
                            {finding.severity}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {Math.round(finding.confidence * 100)}%
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/findings/${finding.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-sentinel-600 dark:hover:text-sentinel-400 truncate block max-w-xs"
                          >
                            {finding.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {finding.detector}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="status" value={finding.status}>
                            {finding.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/findings/${finding.id}`}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}