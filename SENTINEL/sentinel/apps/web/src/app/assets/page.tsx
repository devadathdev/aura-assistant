'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate, truncate } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Network, Server, HardDrive, Smartphone, Globe, Database } from 'lucide-react';

const assetTypeIcons: Record<string, any> = {
  account: Network,
  device: Server,
  network: Globe,
  application: HardDrive,
  identifier: Smartphone,
};

const assetTypeColors: Record<string, string> = {
  account: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  device: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  network: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  application: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  identifier: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
};

export default function AssetsPage() {
  const { assets, fetchAssets, isLoading } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ label: '', type: 'account', criticality: 50, metadata: {} });

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = assets.filter((a) => {
    if (search && !a.label.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    return true;
  });

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, call the API to create the asset
    setShowCreateModal(false);
    setNewAsset({ label: '', type: 'account', criticality: 50, metadata: {} });
    fetchAssets();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Assets</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Track your accounts, devices, and infrastructure</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search assets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">All Types</option>
                <option value="account">Account</option>
                <option value="device">Device</option>
                <option value="network">Network</option>
                <option value="application">Application</option>
                <option value="identifier">Identifier</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-sentinel-500 border-t-transparent mx-auto" />
                <p className="mt-4 text-slate-500">Loading assets...</p>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-8 text-center">
                <Server className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">No assets found</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {search || typeFilter
                    ? 'No assets match your filters'
                    : 'Add your first asset to start tracking'}
                </p>
                {!search && !typeFilter && (
                  <Button onClick={() => setShowCreateModal(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Asset
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAssets.map((asset) => {
                  const Icon = assetTypeIcons[asset.type] || Server;
                  const colorClass = assetTypeColors[asset.type] || 'bg-gray-100 text-gray-600';
                  return (
                    <Link
                      key={asset.id}
                      href={`/assets/${asset.id}`}
                      className="p-4 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate group-hover:text-sentinel-600 dark:group-hover:text-sentinel-400 transition-colors">
                              {asset.label}
                            </h4>
                            <p className="text-sm text-slate-500 capitalize">{asset.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default" value={asset.criticality}>
                            Criticality: {asset.criticality}
                          </Badge>
                          <p className="text-xs text-slate-400 mt-1">{asset.status}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
                        <span>Updated: {formatDate(asset.updated_at)}</span>
                        <span>{asset.metadata?.platform || 'Unknown platform'}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-4">Add New Asset</h2>
              <form onSubmit={handleCreateAsset}>
                <Input
                  label="Label"
                  value={newAsset.label}
                  onChange={(e) => setNewAsset({ ...newAsset, label: e.target.value })}
                  placeholder="e.g., Production AWS Account"
                  required
                />
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Type</label>
                  <select
                    value={newAsset.type}
                    onChange={(e) => setNewAsset({ ...newAsset, type: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sentinel-500 focus:outline-none focus:ring-2 focus:ring-sentinel-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="account">Account</option>
                    <option value="device">Device</option>
                    <option value="network">Network</option>
                    <option value="application">Application</option>
                    <option value="identifier">Identifier</option>
                  </select>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Criticality: {newAsset.criticality}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newAsset.criticality}
                    onChange={(e) => setNewAsset({ ...newAsset, criticality: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                  />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Asset</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}