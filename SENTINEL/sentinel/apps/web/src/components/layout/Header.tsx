'use client';

import { Bell, User, Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTheme } from 'next-themes';

export function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-6 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
      <Button variant="ghost" size="sm" className="lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            3
          </span>
        </Button>

        <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
          <div className="h-8 w-8 rounded-full bg-sentinel-100 flex items-center justify-center dark:bg-sentinel-900">
            <User className="h-5 w-5 text-sentinel-600 dark:text-sentinel-400" />
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-slate-900 dark:text-white">John Doe</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Analyst</p>
          </div>
        </div>
      </div>
    </header>
  );
}