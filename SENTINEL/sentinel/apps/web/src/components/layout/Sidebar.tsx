'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShieldAlert,
  Search,
  Network,
  FolderGit2,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Findings', href: '/findings', icon: ShieldAlert },
  { name: 'Assets', href: '/assets', icon: Search },
  { name: 'Network', href: '/network', icon: Network },
  { name: 'Incidents', href: '/incidents', icon: FolderGit2 },
  { name: 'Audit Log', href: '/audit', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-800',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-sentinel-600 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">SENTINEL</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sentinel-50 text-sentinel-700 dark:bg-sentinel-900/30 dark:text-sentinel-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <Button variant="ghost" className="w-full justify-start" onClick={() => {}}>
            <LogOut className="mr-3 h-5 w-5" aria-hidden="true" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}