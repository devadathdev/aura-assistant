'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import {
  User,
  Shield,
  Key,
  Bell,
  Palette,
  Database,
  Download,
  Upload,
  Trash2,
  LogOut,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('account');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account, preferences, and security settings</p>
        </div>

        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="account"><User className="h-4 w-4 mr-2" />Account</TabsTrigger>
            <TabsTrigger value="security"><Shield className="h-4 w-4 mr-2" />Security</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-2" />Notifications</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="h-4 w-4 mr-2" />Appearance</TabsTrigger>
            <TabsTrigger value="data"><Database className="h-4 w-4 mr-2" />Data</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full bg-sentinel-100 flex items-center justify-center dark:bg-sentinel-900">
                    <User className="h-10 w-10 text-sentinel-600 dark:text-sentinel-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">John Doe</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">john.doe@example.com</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Security Analyst</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Full Name" defaultValue="John Doe" />
                  <Input label="Email" defaultValue="john.doe@example.com" type="email" />
                  <Input label="Organization" placeholder="Your organization" />
                  <Input label="Role" defaultValue="Security Analyst" />
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Password & Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Change Password</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Current Password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                    />
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Input
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                    />
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowNewPassword(!showNewPassword)}>
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Input label="Confirm New Password" type="password" placeholder="••••••••" />
                  </div>
                  <Button>Update Password</Button>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Two-Factor Authentication</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security to your account</p>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Authenticator App</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Use TOTP codes from Google Authenticator, Authy, etc.</p>
                    </div>
                    <Button variant="outline">Enable</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Passkeys / WebAuthn</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Use biometrics or hardware keys for passwordless login</p>
                    </div>
                    <Button variant="outline">Add Passkey</Button>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Active Sessions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-sentinel-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-sentinel-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Current Session</p>
                          <p className="text-sm text-slate-500">Chrome on macOS • Active now</p>
                        </div>
                      </div>
                      <Badge variant="status" value="active">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Mobile App</p>
                          <p className="text-sm text-slate-500">iOS • 2 hours ago</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Revoke</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Email Notifications</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Critical Findings', desc: 'Immediate alerts for critical severity findings' },
                      { label: 'High Severity Findings', desc: 'Daily digest of high severity findings' },
                      { label: 'New Incidents', desc: 'Notification when new incidents are created' },
                      { label: 'Incident Updates', desc: 'Status changes on incidents you own' },
                      { label: 'Action Approvals', desc: 'Requests for your approval on security actions' },
                      { label: 'Weekly Security Summary', desc: 'Weekly posture report and trends' },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                        </div>
                        <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-sentinel-600 focus:ring-sentinel-500" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">In-App Notifications</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Real-time Finding Alerts', desc: 'Show toast notifications for new findings' },
                      { label: 'Action Status Updates', desc: 'Notify when actions are executed or verified' },
                      { label: 'System Maintenance', desc: 'Scheduled maintenance windows' },
                    ].map((item) => (
                      <label key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                        </div>
                        <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-sentinel-600 focus:ring-sentinel-500" />
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Theme</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { value: 'light', label: 'Light', icon: '☀️' },
                      { value: 'dark', label: 'Dark', icon: '🌙' },
                      { value: 'system', label: 'System', icon: '💻' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          theme === option.value
                            ? 'border-sentinel-500 bg-sentinel-50 dark:bg-sentinel-900/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="text-3xl mb-2">{option.icon}</div>
                        <p className="font-medium text-slate-900 dark:text-white">{option.label}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {option.value === 'system' ? 'Matches OS preference' : `${option.value.charAt(0).toUpperCase() + option.value.slice(1)} mode`}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Density</h4>
                  <div className="flex gap-4">
                    {['comfortable', 'compact', 'spacious'].map((density) => (
                      <button
                        key={density}
                        className="flex-1 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                      >
                        <p className="font-medium text-slate-900 dark:text-white capitalize">{density}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {density === 'comfortable' ? 'Default spacing' : density === 'compact' ? 'Reduced spacing' : 'Increased spacing'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Sidebar</h4>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-sentinel-600 focus:ring-sentinel-500" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Collapse sidebar by default</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Show only icons in navigation</p>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Export Data</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Download your data in JSON format</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Findings
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Assets
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Incidents
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Audit Log
                    </Button>
                    <Button variant="primary" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export All Data
                    </Button>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Import Data</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Import previously exported data</p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Import Assets
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Import Identities
                    </Button>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white">Data Retention</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">Findings</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Retain for 2 years</p>
                      <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <option>1 year</option>
                        <option selected>2 years</option>
                        <option>5 years</option>
                        <option>Indefinite</option>
                      </select>
                    </div>
                    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">Audit Events</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Retain for 7 years</p>
                      <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                        <option>3 years</option>
                        <option>5 years</option>
                        <option selected>7 years</option>
                        <option>Indefinite</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white text-red-600">Danger Zone</h4>
                  <div className="flex items-center justify-between p-4 rounded-lg border-2 border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-100">Delete All Data</p>
                      <p className="text-sm text-red-700 dark:text-red-300">Permanently delete all your findings, assets, incidents, and audit logs. This cannot be undone.</p>
                    </div>
                    <Button variant="destructive" className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Everything
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}