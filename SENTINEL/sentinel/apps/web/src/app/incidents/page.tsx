'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatDate, getSeverityColor, getStatusColor, cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  AlertTriangle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function IncidentsPage() {
  const { incidents, fetchIncidents, isLoading } = useStore();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'severity' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = incidents
    .filter((i) => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (severityFilter && i.severity !== severityFilter) return false;
      if (statusFilter && i.status !== statusFilter) return false;
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

  const handleSort = (field: 'created_at' | 'severity' | 'status') => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertTriangle className="h-4 w-4" />;
      case 'investigating': return <ShieldAlert className="h-4 w-4" />;
      case 'contained': return <CheckCircle className="h-4 w-4" />;
      case 'recovering': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <FolderGit2 className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Incidents</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Security incidents and investigations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button variant="primary" size="sm" onClick={() => fetchIncidents()}>
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
                  placeholder="Search incidents..."
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
                className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="contained">Contained</option>
                <option value="recovering">Recovering</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sentinel-500 border-t-transparent mx-auto" />
                <p className="mt-4 text-slate-500">Loading incidents...</p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-8 text-center">
                <FolderGit2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No incidents</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {search || severityFilter || statusFilter
                    ? 'No incidents match your filters'
                    : 'No incidents recorded yet'}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleSort('severity')}>
                        <div className="flex items-center gap-1">
                          Severity
                          <SortIcon field="severity" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-1">
                          Status
                          <SortIcon field="status" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Findings</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assets</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => { setSelectedIncident(incident); setShowDetail(true); }}>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(incident.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/incidents/${incident.id}`}
                            className="font-medium text-slate-900 dark:text-white hover:text-sentinel-600 dark:hover:text-sentinel-400 truncate block max-w-md"
                          >
                            {incident.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="severity" value={incident.severity}>
                            {incident.severity}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(incident.status)}
                            <Badge variant="status" value={incident.status}>
                              {incident.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {incident.finding_refs?.length || 0} linked
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {incident.asset_refs?.length || 0} affected
                        </td>
                        <td className="px-6 py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/incidents/${incident.id}`}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              title="View details"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/incidents/${incident.id}`}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                              title="Investigate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ArrowRight className="h-4 w-4" />
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

        {showDetail && selectedIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetail(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{selectedIncident.title}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedIncident.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="severity" value={selectedIncident.severity}>{selectedIncident.severity}</Badge>
                  <Badge variant="status" value={selectedIncident.status}>{selectedIncident.status.replace('_', ' ')}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="p-6">
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="findings">Findings</TabsTrigger>
                    <TabsTrigger value="assets">Assets</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Incident ID</p>
                          <p className="font-mono text-sm text-slate-900 dark:text-white">{selectedIncident.id}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Created</p>
                          <p className="text-sm text-slate-900 dark:text-white">{formatDate(selectedIncident.created_at)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-sm text-slate-500 dark:text-slate-400">Last Updated</p>
                          <p className="text-sm text-slate-900 dark:text-white">{formatDate(selectedIncident.updated_at)}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white mb-3">Description</h4>
                        <p className="text-slate-600 dark:text-slate-400">{selectedIncident.description || 'No description provided'}</p>
                      </div>

                      {selectedIncident.metadata && Object.keys(selectedIncident.metadata).length > 0 && (
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white mb-3">Metadata</h4>
                          <pre className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg overflow-auto">
                            {JSON.stringify(selectedIncident.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="timeline">
                    <div className="space-y-4">
                      {selectedIncident.timeline && selectedIncident.timeline.length > 0 ? (
                        selectedIncident.timeline.map((event: any, idx: number) => (
                          <div key={idx} className="flex gap-4 pb-4 border-l border-slate-200 dark:border-slate-700 pl-4 last:border-0 last:pb-0">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sentinel-100 dark:bg-sentinel-900/30 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-sentinel-600 dark:text-sentinel-400" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 dark:text-white">{event.action || event.type || 'Event'}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(event.timestamp || event.created_at)}</p>
                              {event.details && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{event.details}</p>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <Clock className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                          <p>No timeline events recorded</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="findings">
                    <div>
                      {selectedIncident.finding_refs && selectedIncident.finding_refs.length > 0 ? (
                        <div className="space-y-2">
                          {selectedIncident.finding_refs.map((findingId: string) => (
                            <div key={findingId} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{findingId}</p>
                                <p className="text-sm text-slate-500">Finding reference</p>
                              </div>
                              <Link href={`/findings/${findingId}`} className="text-sentinel-600 hover:text-sentinel-700 text-sm">View</Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                          <p>No findings linked to this incident</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="assets">
                    <div>
                      {selectedIncident.asset_refs && selectedIncident.asset_refs.length > 0 ? (
                        <div className="space-y-2">
                          {selectedIncident.asset_refs.map((assetId: string) => (
                            <div key={assetId} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{assetId}</p>
                                <p className="text-sm text-slate-500">Affected asset</p>
                              </div>
                              <Link href={`/assets/${assetId}`} className="text-sentinel-600 hover:text-sentinel-700 text-sm">View</Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <FolderGit2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                          <p>No assets linked to this incident</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}