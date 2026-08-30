'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatDate, getSeverityColor, cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';
import {
  Search,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Loader2,
  Link as LinkIcon,
  Mail,
  FileText,
  Image,
} from 'lucide-react';

export default function PhishingAnalyzerPage() {
  const [text, setText] = useState('');
  const [urls, setUrls] = useState('');
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [headers, setHeaders] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'email' | 'url'>('text');
  const [history, setHistory] = useState<any[]>([]);

  const handleAnalyze = async () => {
    const request: any = {};

    if (activeTab === 'text') {
      request.text = text;
      if (urls) request.urls = urls.split('\n').map(u => u.trim()).filter(Boolean);
    } else if (activeTab === 'email') {
      request.text = text;
      request.sender = sender;
      request.subject = subject;
      if (headers) {
        try {
          request.headers = JSON.parse(headers);
        } catch {
          alert('Invalid headers JSON');
          return;
        }
      }
    } else if (activeTab === 'url') {
      request.urls = urls.split('\n').map(u => u.trim()).filter(Boolean);
    }

    if (!request.text && (!request.urls || request.urls.length === 0)) {
      alert('Please provide text content or URLs to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await api.analyzePhishing(request);
      setResult(response);
      setHistory(prev => [response, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'malicious': return <AlertTriangle className="h-6 w-6 text-severity-critical" />;
      case 'suspicious': return <AlertTriangle className="h-6 w-6 text-severity-high" />;
      case 'caution': return <Info className="h-6 w-6 text-severity-moderate" />;
      case 'benign': return <CheckCircle className="h-6 w-6 text-severity-low" />;
      default: return <ShieldAlert className="h-6 w-6 text-slate-500" />;
    }
  };

  const getVerdictLabel = (verdict: string) => {
    switch (verdict) {
      case 'malicious': return 'Malicious';
      case 'suspicious': return 'Suspicious';
      case 'caution': return 'Caution Advised';
      case 'benign': return 'Benign';
      default: return verdict;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Phishing Analyzer</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Analyze suspicious messages, emails, and URLs for phishing indicators</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Input</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="text"><FileText className="h-4 w-4 mr-2" />Text Content</TabsTrigger>
                    <TabsTrigger value="email"><Mail className="h-4 w-4 mr-2" />Email</TabsTrigger>
                    <TabsTrigger value="url"><LinkIcon className="h-4 w-4 mr-2" />URLs Only</TabsTrigger>
                  </TabsList>

                  <TabsContent value="text">
                    <Textarea
                      label="Paste suspicious text, message, or email content"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste the suspicious message content here..."
                      rows={8}
                    />
                    <Textarea
                      label="URLs (one per line)"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      placeholder="https://example.com/phishing
https://another-suspicious-link.com"
                      rows={4}
                    />
                  </TabsContent>

                  <TabsContent value="email">
                    <div className="space-y-4">
                      <Input
                        label="Sender Email"
                        value={sender}
                        onChange={(e) => setSender(e.target.value)}
                        placeholder="attacker@phishing-site.com"
                      />
                      <Input
                        label="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Urgent: Account Verification Required"
                      />
                      <Textarea
                        label="Email Body"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste the email body content here..."
                        rows={6}
                      />
                      <Textarea
                        label="Email Headers (JSON)"
                        value={headers}
                        onChange={(e) => setHeaders(e.target.value)}
                        placeholder='{"from": "attacker@phishing-site.com", "reply-to": "different@domain.com", "authentication-results": "spf=fail dkim=fail dmarc=fail"}'
                        rows={4}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="url">
                    <Textarea
                      label="URLs to Analyze (one per line)"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      placeholder="https://example.com/phishing
https://another-suspicious-link.com
https://yet-another.fake-login.page"
                      rows={10}
                    />
                  </TabsContent>

                  <div className="flex justify-end pt-4">
                    <Button
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full sm:w-auto"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-4 w-4 mr-2" />
                          Analyze
                        </>
                      )}
                    </Button>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-800 shadow">
                        {getVerdictIcon(result.verdict)}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                          {getVerdictLabel(result.verdict)}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>Confidence: {Math.round(result.confidence * 100)}%</span>
                          <span>Category: {result.category.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>

                    {result.evidence && result.evidence.length > 0 && (
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white mb-3">Evidence</h4>
                        <div className="space-y-3">
                          {result.evidence.map((ev: any, idx: number) => (
                            <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium capitalize">{ev.source.replace('_', ' ')}</span>
                                <Badge variant="default" value={Math.round(ev.confidence * 100)}>
                                  {Math.round(ev.confidence * 100)}% confidence
                                </Badge>
                              </div>
                              <pre className="text-sm text-slate-600 dark:text-slate-400 overflow-auto max-h-48">
                                {JSON.stringify(ev, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.indicators && result.indicators.length > 0 && (
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white mb-3">Indicators Found</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.indicators.map((ind: any, idx: number) => (
                            <Badge key={idx} variant="default" value={ind.type}>
                              {ind.type}: {ind.value?.slice(0, 50)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.uncertainty && result.uncertainty.length > 0 && (
                      <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Uncertainties</h4>
                        <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                          {result.uncertainty.map((u: string, idx: number) => (
                            <li key={idx}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.safe_next_steps && result.safe_next_steps.length > 0 && (
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white mb-3">Recommended Next Steps</h4>
                        <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400">
                          {result.safe_next_steps.map((step: string, idx: number) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {result.ai_explanation && (
                      <div className="p-4 rounded-lg bg-sentinel-50 dark:bg-sentinel-900/20 border border-sentinel-200 dark:border-sentinel-800">
                        <h4 className="font-medium text-sentinel-900 dark:text-sentinel-100 mb-2">AI Explanation</h4>
                        <p className="text-slate-600 dark:text-slate-400">{result.ai_explanation}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {history.length > 0 && !result && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Analyses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {history.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{item.category.replace('_', ' ')}</span>
                          <Badge variant="severity" value={item.verdict}>
                            {getVerdictLabel(item.verdict)}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Confidence: {Math.round(item.confidence * 100)}%</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <h5 className="font-medium text-slate-900 dark:text-white mb-1">What to look for</h5>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Urgent or threatening language</li>
                      <li>Requests for credentials or payments</li>
                      <li>Mismatched sender/reply-to addresses</li>
                      <li>URL shorteners or suspicious domains</li>
                      <li>Poor grammar, spelling, or formatting</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <h5 className="font-medium text-slate-900 dark:text-white mb-1">Safe practices</h5>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Never click links in suspicious messages</li>
                      <li>Verify sender through known channels</li>
                      <li>Check URLs by hovering (don't click)</li>
                      <li>Enable MFA on all accounts</li>
                      <li>Report phishing to your IT team</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supported Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <FileText className="h-5 w-5 text-sentinel-600" />
                    <span>Text content & messages</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <Mail className="h-5 w-5 text-sentinel-600" />
                    <span>Full emails with headers</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <LinkIcon className="h-5 w-5 text-sentinel-600" />
                    <span>URL lists (batch)</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <Image className="h-5 w-5 text-sentinel-600" />
                    <span>QR codes & images (coming soon)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}