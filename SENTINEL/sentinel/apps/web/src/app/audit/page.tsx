'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate, cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  User,
  Key,
  Shield,
  Database,
  Server,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const eventTypeIcons: Record<string, any> = {
  'finding.created': Shield,
  'finding.updated': Shield,
  'asset.created': Database,
  'asset.updated': Database,
  'identity.created': Key,
  'action.proposed': AlertTriangle,
  'action.approved': CheckCircle,
  'action.rejected': XCircle,
  'action.executed': Server,
  'action.verified': CheckCircle,
  'audit.event': Activity,
  'phishing.analyzed': Globe,
  'breach.detected': AlertTriangle,
};

const eventTypeColors: Record<string, string> = {
  'finding.created': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'finding.updated': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'asset.created': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'asset.updated': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'identity.created': 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'action.proposed': 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  'action.approved': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'action.rejected': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'action.executed': 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'action.verified': 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'audit.event': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  'phishing.analyzed': 'bg-sentinel-100 text-sentinel-600 dark:bg-sentinel-900/30 dark:text-sentinel-400',
  'breach.detected': 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export default function AuditPage() {
  const { isLoading } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;

  // Mock data for demo
  useEffect(() => {
    const mockEvents = [
      { id: '01HX...', actor: 'user:john', event_type: 'finding.created', object_ref: 'finding-123', timestamp: new Date().toISOString(), payload: { severity: 'high', detector: 'phishing' } },
      { id: '01HX...', actor: 'system', event_type: 'action.approved', object_ref: 'action-456', timestamp: new Date(Date.now() - 3600000).toISOString(), payload: { action_type: 'revoke_session' } },
      { id: '01HX...', actor: 'user:jane', event_type: 'asset.created', object_ref: 'asset-789', timestamp: new Date(Date.now() - 7200000).toISOString(), payload: { type: 'account', label: 'AWS Production' } },
      { id: '01HX...', actor: 'system', event_type: 'phishing.analyzed', object_ref: 'phish-001', timestamp: new Date(Date.now() - 10800000).toISOString(), payload: { verdict: 'malicious', confidence: 0.92 } },
      { id: '01HX...', actor: 'user:john', event_type: 'action.executed', object_ref: 'action-456', timestamp: new Date(Date.now() - 14400000).toISOString(), payload: { action_type: 'revoke_session', success: true } },
      { id: '01HX...', actor: 'system', event_type: 'breach.detected', object_ref: 'breach-001', timestamp: new Date(Date.now() - 86400000).toISOString(), payload: { identifier_type: 'email', breach_name: 'LinkedIn 2021' } },
      { id: '01HX...', actor: 'user:jane', event_type: 'identity.created', object_ref: 'ident-001', timestamp: new Date(Date.now() - 172800000).toISOString(), payload: { provider: 'github', mfa_state: true } },
      { id: '01HX...', actor: 'system', event_type: 'finding.resolved', object_ref: 'finding-123', timestamp: new Date(Date.now() - 259200000).toISOString(), payload: { resolution: 'false_positive' } },
    ];
    setEvents(mockEvents);
    setTotalPages(Math.ceil(mockEvents.length / pageSize));
  }, []);

  const filteredEvents = events.filter((e) => {
    if (search && !JSON.stringify(e.payload).toLowerCase().includes(search.toLowerCase())) return false;
    if (actorFilter && e.actor !== actorFilter) return false;
    if (eventTypeFilter && e.event_type !== eventTypeFilter) return false;
    return true;
  });

  const paginatedEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize);

  const actors = [...new Set(events.map(e => e.actor))];
  const eventTypes = [...new Set(events.map(e => e.event_type))];

  const getEventTypeLabel = (type: string) => {
    return type.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Audit Log</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Security-relevant events and system activity</p>
          </div>
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search audit events..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10"
                />
              </div>
              <select
                value={actorFilter}
                onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Actors</option>
                {actors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={eventTypeFilter}
                onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Event Types</option>
                {eventTypes.map(t => <option key={t} value={t}>{getEventTypeLabel(t)}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sentinel-500 border-t-transparent mx-auto" />
                <p className="mt-4 text-slate-500">Loading audit log...</p>
              </div>
            ) : paginatedEvents.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No audit events</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {search || actorFilter || eventTypeFilter
                    ? 'No events match your filters'
                    : 'No audit events recorded yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Object</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider pr-6">Verify</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedEvents.map((event) => {
                      const Icon = eventTypeIcons[event.event_type] || Activity;
                      const colorClass = eventTypeColors[event.event_type] || 'bg-gray-100 text-gray-600';
                      return (
                        <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">
                            {formatDate(event.timestamp)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {event.actor.startsWith('user:') ? <User className="h-4 w-4 text-slate-400" /> : <Server className="h-4 w-4 text-slate-400" />}
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{event.actor}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="text-sm text-slate-600 dark:text-slate-400">{getEventTypeLabel(event.event_type)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {event.object_ref ? (
                              <span className="font-mono text-sm text-slate-900 dark:text-white">{event.object_ref}</span>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                              {JSON.stringify(event.payload).slice(0, 100)}...
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" className="text-sentinel-600 hover:text-sentinel-700">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Chain Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Audit Chain Status</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Integrity verification of append-oriented audit trail</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">Verified</span>
                </div>
                <Button variant="outline" size="sm">Verify Now</Button>
                <Button variant="secondary" size="sm">Export Proof</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}