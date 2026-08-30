'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatDate, getSeverityColor, getStatusColor } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { dashboard, fetchDashboard, fetchAssets, fetchFindings, fetchIncidents, isLoading } = useStore();

  useEffect(() => {
    fetchDashboard();
    fetchAssets();
    fetchFindings();
    fetchIncidents();
  }, [fetchDashboard, fetchAssets, fetchFindings, fetchIncidents]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-severity-critical';
    if (score >= 50) return 'text-severity-high';
    if (score >= 25) return 'text-severity-moderate';
    return 'text-severity-low';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return 'Critical Risk';
    if (score >= 50) return 'High Risk';
    if (score >= 25) return 'Moderate Risk';
    return 'Low Risk';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Your personal security operations center</p>
        </div>

        {dashboard && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Posture Score</CardTitle>
                  <Target className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-4xl font-bold ${getScoreColor(dashboard.posture_score)}`}>
                      {dashboard.posture_score}
                    </span>
                    <span className="text-sm text-slate-500">/ 100</span>
                  </div>
                  <p className={`text-sm mt-2 ${getScoreColor(dashboard.posture_score)}`}>
                    {getScoreLabel(dashboard.posture_score)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
                  <ShieldAlert className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {dashboard.unresolved_findings?.length || 0}
                  </div>
                  <p className="text-sm text-slate-500">Requiring attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Critical Assets</CardTitle>
                  <Search className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {dashboard.critical_assets?.length || 0}
                  </div>
                  <p className="text-sm text-slate-500">High-value targets</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">0</div>
                  <p className="text-sm text-slate-500">Under investigation</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="findings" className="space-y-4">
              <TabsList>
                <TabsTrigger value="findings">Unresolved Findings</TabsTrigger>
                <TabsTrigger value="assets">Critical Assets</TabsTrigger>
                <TabsTrigger value="drivers">Score Drivers</TabsTrigger>
              </TabsList>

              <TabsContent value="findings">
                <Card>
                  <CardContent className="pt-6">
                    {dashboard.unresolved_findings && dashboard.unresolved_findings.length > 0 ? (
                      <div className="space-y-3">
                        {dashboard.unresolved_findings.slice(0, 10).map((finding: any) => (
                          <Link
                            key={finding.id}
                            href={`/findings/${finding.id}`}
                            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-slate-900 dark:text-white truncate">
                                  {finding.title}
                                </h4>
                                <Badge variant="severity" value={finding.severity}>
                                  {finding.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Detector: {finding.detector} • Confidence: {Math.round(finding.confidence * 100)}%
                              </p>
                            </div>
                            <div className="flex items-center gap-4 ml-4">
                              <span className="text-sm text-slate-500">
                                Score: {finding.risk_score || 'N/A'}
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-severity-low mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No unresolved findings</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">All clear for now</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="assets">
                <Card>
                  <CardContent className="pt-6">
                    {dashboard.critical_assets && dashboard.critical_assets.length > 0 ? (
                      <div className="space-y-3">
                        {dashboard.critical_assets.map((asset: any) => (
                          <Link
                            key={asset.id}
                            href={`/assets/${asset.id}`}
                            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-sentinel-100 flex items-center justify-center dark:bg-sentinel-900">
                                <Search className="h-5 w-5 text-sentinel-600 dark:text-sentinel-400" />
                              </div>
                              <div>
                                <h4 className="font-medium text-slate-900 dark:text-white">{asset.label}</h4>
                                <p className="text-sm text-slate-500 capitalize">{asset.type}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="default" value={asset.criticality}>
                                Criticality: {asset.criticality}
                              </Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No critical assets</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Add assets to track their posture</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="drivers">
                <Card>
                  <CardContent className="pt-6">
                    {dashboard.score_drivers && dashboard.score_drivers.length > 0 ? (
                      <div className="space-y-3">
                        {dashboard.score_drivers.map((driver: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                  driver.impact < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                                }`}
                              >
                                {driver.impact < 0 ? (
                                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white capitalize">
                                  {driver.factor.replace(/_/g, ' ')}
                                </p>
                                <p className="text-sm text-slate-500">{driver.count} findings</p>
                              </div>
                            </div>
                            <span
                              className={`font-mono font-medium ${
                                driver.impact < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                              }`}
                            >
                              {driver.impact > 0 ? '+' : ''}{driver.impact}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No score drivers</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Run assessments to see risk factors</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {isLoading && !dashboard && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-8 bg-slate-200 animate-pulse rounded dark:bg-slate-700 mb-4" />
                  <div className="h-4 bg-slate-200 animate-pulse rounded dark:bg-slate-700 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}