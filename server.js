import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readFile, stat } from 'fs/promises';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Available AI models via OpenRouter
// Free model list updated July 2026 from openrouter.ai/api/v1/models
const AVAILABLE_MODELS = {
  // ── Free models (require :free suffix, zero cost per token) ──
  'nemotron-3-ultra':  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nemotron-3-super':  'nvidia/nemotron-3-super-120b-a12b:free',
  'nemotron-3-nano':   'nvidia/nemotron-3-nano-30b-a3b:free',
  'nemotron-nano-omni':'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nemotron-nano-12b': 'nvidia/nemotron-nano-12b-v2-vl:free',
  'nemotron-nano-9b':  'nvidia/nemotron-nano-9b-v2:free',
  'lyria-3-pro':       'google/lyria-3-pro-preview',
  'lyria-3-clip':      'google/lyria-3-clip-preview',
  'gemma-4-31b':       'google/gemma-4-31b-it:free',
  'gemma-4-26b':       'google/gemma-4-26b-a4b-it:free',
  'laguna-m1':         'poolside/laguna-m.1:free',
  'laguna-s21':        'poolside/laguna-s-2.1:free',
  'laguna-xs21':       'poolside/laguna-xs-2.1:free',
  'ling-3-flash':      'inclusionai/ling-3.0-flash:free',
  'north-mini-code':   'cohere/north-mini-code:free',
  'gpt-oss-20b':       'openai/gpt-oss-20b:free',
  'llama-3.2-2b':      'meta-llama/llama-3.2-2b-instruct:free',
  'openrouter-free':   'openrouter/free',

  // ── Paid models (require credits) ──
  'gpt-4o':            'openai/gpt-4o',
  'gpt-4o-mini':       'openai/gpt-4o-mini',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3-haiku':    'anthropic/claude-3-haiku',
  'gemini-1.5-pro':    'google/gemini-1.5-pro',
  'gemini-1.5-flash':  'google/gemini-1.5-flash',
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'nemotron-3-ultra';

// In-memory stores for MVP
const missions = new Map();
const tasks = new Map();
const findings = new Map();
const approvals = new Map();
let missionCounter = 0;
let taskCounter = 0;
let findingCounter = 0;
let approvalCounter = 0;

function generateMissionId() { return `mission-${++missionCounter}-${Date.now()}`; }
function generateTaskId() { return `task-${++taskCounter}-${Date.now()}`; }
function generateFindingId() { return `finding-${++findingCounter}-${Date.now()}`; }
function generateApprovalId() { return `approval-${++approvalCounter}-${Date.now()}`; }

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res, filePath) {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const file = await readFile(filePath);
    res.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(500);
      res.end('Server error');
    }
  }
}

function getModelId(modelKey) {
  return AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS[DEFAULT_MODEL];
}

async function handleAssistant(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { messages, model: modelKey, temperature = 0.7, max_tokens = 2048, stream = true, tools } = JSON.parse(body || '{}');
      
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.end('data: {"text": "Local demo mode. Configure OPENROUTER_API_KEY in .env for live AI.", "done": true}\n\n');
        return;
      }

      const modelId = getModelId(modelKey || DEFAULT_MODEL);
      
      const payload = {
        model: modelId,
        messages: messages || [],
        temperature,
        max_tokens,
        stream,
      };

      if (tools) payload.tools = tools;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AURA Neural Assistant',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      if (!stream) {
        const data = await response.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }

      // Stream response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: {"done": true}\n\n');
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || '';
              const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
              const finishReason = parsed.choices?.[0]?.finish_reason;
              
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
              if (toolCalls) {
                res.write(`data: ${JSON.stringify({ tool_calls: toolCalls })}\n\n`);
              }
              if (finishReason) {
                res.write(`data: ${JSON.stringify({ finish_reason: finishReason })}\n\n`);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      res.end();
    } catch (error) {
      console.error('Assistant error:', error);
      res.writeHead(500, { 'Content-Type': 'text/event-stream' });
      res.end(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  });
}

async function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/api/status') {
    const hasKey = !!process.env.OPENROUTER_API_KEY;
    res.writeHead(200);
    res.end(JSON.stringify({
      liveAI: hasKey,
      liveNews: !!process.env.NEWS_API_KEY,
      liveWeather: !!process.env.WEATHER_API_KEY,
      model: DEFAULT_MODEL,
      availableModels: Object.keys(AVAILABLE_MODELS),
    }));
    return;
  }

  if (path === '/api/models') {
    res.writeHead(200);
    res.end(JSON.stringify(AVAILABLE_MODELS));
    return;
  }

  if (path === '/api/weather') {
    const city = url.searchParams.get('q') || 'Alappuzha';
    res.writeHead(200);
    res.end(JSON.stringify({
      city,
      country: 'IN',
      temperature: 28,
      feelsLike: 31,
      condition: 'Partly Cloudy',
      humidity: 78,
      windSpeed: 12,
    }));
    return;
  }

  if (path === '/api/news') {
    const apiKey = process.env.NEWS_API_KEY;
    const query = process.env.NEWS_API_QUERY || 'world';
    const language = process.env.NEWS_API_LANGUAGE || 'en';

    if (!apiKey) {
      res.writeHead(200);
      res.end(JSON.stringify({
        query,
        articles: [{
          title: 'Local mode: Configure NEWS_API_KEY in .env for live headlines',
          source: 'AURA System',
          publishedAt: new Date().toISOString(),
          description: 'Add your NewsAPI key to enable real-time news briefings.',
        }],
      }));
      return;
    }

    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&pageSize=5&sortBy=publishedAt&apiKey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'ok') {
        res.writeHead(200);
        res.end(JSON.stringify({
          query,
          articles: data.articles.map(a => ({
            title: a.title,
            source: a.source?.name || 'Unknown',
            publishedAt: a.publishedAt,
            description: a.description,
            url: a.url,
            urlToImage: a.urlToImage,
          })),
        }));
      } else {
        throw new Error(data.message || 'NewsAPI error');
      }
    } catch (error) {
      console.error('News API error:', error);
      res.writeHead(200);
      res.end(JSON.stringify({
        query,
        articles: [{
          title: 'Failed to fetch news',
          source: 'AURA System',
          publishedAt: new Date().toISOString(),
          description: error.message,
        }],
      }));
    }
    return;
  }

  if (path === '/api/assistant' && req.method === 'POST') {
    handleAssistant(req, res);
    return;
  }

  // Mission API endpoints
  if (path === '/api/missions' && req.method === 'POST') {
    handleCreateMission(req, res);
    return;
  }

  if (path === '/api/missions' && req.method === 'GET') {
    handleListMissions(req, res);
    return;
  }

  if (path.startsWith('/api/missions/') && req.method === 'GET') {
    const missionId = path.split('/')[3];
    if (missionId && !missionId.includes('/')) {
      handleGetMission(req, res, missionId);
      return;
    }
  }

  if (path.match(/^\/api\/missions\/[^/]+\/pause$/) && req.method === 'POST') {
    const missionId = path.split('/')[3];
    handlePauseMission(req, res, missionId);
    return;
  }

  if (path.match(/^\/api\/missions\/[^/]+\/resume$/) && req.method === 'POST') {
    const missionId = path.split('/')[3];
    handleResumeMission(req, res, missionId);
    return;
  }

  if (path.match(/^\/api\/missions\/[^/]+\/cancel$/) && req.method === 'POST') {
    const missionId = path.split('/')[3];
    handleCancelMission(req, res, missionId);
    return;
  }

  if (path.match(/^\/api\/missions\/[^/]+\/tasks$/) && req.method === 'GET') {
    const missionId = path.split('/')[3];
    handleGetMissionTasks(req, res, missionId);
    return;
  }

  if (path.match(/^\/api\/missions\/[^/]+\/findings$/) && req.method === 'GET') {
    const missionId = path.split('/')[3];
    handleGetMissionFindings(req, res, missionId);
    return;
  }

  if (path === '/api/approvals' && req.method === 'GET') {
    handleListApprovals(req, res);
    return;
  }

  if (path.match(/^\/api\/approvals\/[^/]+\/approve$/) && req.method === 'POST') {
    const approvalId = path.split('/')[3];
    handleApproveApproval(req, res, approvalId);
    return;
  }

  if (path.match(/^\/api\/approvals\/[^/]+\/reject$/) && req.method === 'POST') {
    const approvalId = path.split('/')[3];
    handleRejectApproval(req, res, approvalId);
    return;
  }

  if (path === '/api/findings' && req.method === 'GET') {
    handleListFindings(req, res);
    return;
  }

  if (path.match(/^\/api\/findings\/[^/]+\/remediate$/) && req.method === 'POST') {
    const findingId = path.split('/')[3];
    handleRemediateFinding(req, res, findingId);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res);
    return;
  }

  let filePath = join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

  const ext = extname(filePath).toLowerCase();
  if (!ext) {
    filePath = join(filePath, 'index.html');
  }

  await serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  const modelId = getModelId(DEFAULT_MODEL);
  console.log(`AURA is online at http://localhost:${PORT}`);
  if (process.env.OPENROUTER_API_KEY) {
    console.log(`🟢 Live OpenRouter AI (${modelId}) mode`);
  } else {
    console.log('⚠️  OPENROUTER_API_KEY not set - running in local demo mode');
  }
});

async function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });
}

function handleCreateMission(req, res) {
  readBody(req).then(async (body) => {
    const { objective, projectId, metadata = {} } = body;
    if (!objective) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'objective is required' }));
      return;
    }

    const mission = {
      id: generateMissionId(),
      objective,
      status: 'CREATED',
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      goals: [],
      metadata
    };

    missions.set(mission.id, mission);
    res.writeHead(201);
    res.end(JSON.stringify(mission));
  });
}

function handleListMissions(req, res) {
  const missionList = Array.from(missions.values());
  res.writeHead(200);
  res.end(JSON.stringify(missionList));
}

function handleGetMission(req, res, missionId) {
  const mission = missions.get(missionId);
  if (!mission) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Mission not found' }));
    return;
  }

  const missionTasks = Array.from(tasks.values()).filter(t => t.missionId === missionId);
  const missionFindings = Array.from(findings.values()).filter(f => f.missionId === missionId);
  const missionApprovals = Array.from(approvals.values()).filter(a => a.missionId === missionId);

  res.writeHead(200);
  res.end(JSON.stringify({
    ...mission,
    tasks: missionTasks,
    findings: missionFindings,
    approvals: missionApprovals
  }));
}

function handlePauseMission(req, res, missionId) {
  const mission = missions.get(missionId);
  if (!mission) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Mission not found' }));
    return;
  }

  mission.status = 'PAUSED';
  mission.updatedAt = new Date().toISOString();
  missions.set(missionId, mission);

  res.writeHead(200);
  res.end(JSON.stringify(mission));
}

function handleResumeMission(req, res, missionId) {
  const mission = missions.get(missionId);
  if (!mission) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Mission not found' }));
    return;
  }

  mission.status = 'RUNNING';
  mission.updatedAt = new Date().toISOString();
  if (!mission.startedAt) mission.startedAt = new Date().toISOString();
  missions.set(missionId, mission);

  res.writeHead(200);
  res.end(JSON.stringify(mission));
}

function handleCancelMission(req, res, missionId) {
  const mission = missions.get(missionId);
  if (!mission) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Mission not found' }));
    return;
  }

  mission.status = 'CANCELLED';
  mission.updatedAt = new Date().toISOString();
  mission.completedAt = new Date().toISOString();
  missions.set(missionId, mission);

  const missionTasks = Array.from(tasks.values()).filter(t => t.missionId === missionId);
  for (const task of missionTasks) {
    if (['CREATED', 'ANALYZING', 'PLANNED', 'APPROVED'].includes(task.status)) {
      task.status = 'CANCELLED';
      task.updatedAt = new Date().toISOString();
      tasks.set(task.id, task);
    }
  }

  res.writeHead(200);
  res.end(JSON.stringify(mission));
}

function handleGetMissionTasks(req, res, missionId) {
  const missionTasks = Array.from(tasks.values()).filter(t => t.missionId === missionId);
  res.writeHead(200);
  res.end(JSON.stringify(missionTasks));
}

function handleGetMissionFindings(req, res, missionId) {
  const missionFindings = Array.from(findings.values()).filter(f => f.missionId === missionId);
  res.writeHead(200);
  res.end(JSON.stringify(missionFindings));
}

function handleListApprovals(req, res) {
  const approvalList = Array.from(approvals.values());
  res.writeHead(200);
  res.end(JSON.stringify(approvalList));
}

function handleApproveApproval(req, res, approvalId) {
  const approval = approvals.get(approvalId);
  if (!approval) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Approval not found' }));
    return;
  }

  approval.status = 'APPROVED';
  approval.resolvedAt = new Date().toISOString();
  approval.resolvedBy = 'user';
  approvals.set(approvalId, approval);

  res.writeHead(200);
  res.end(JSON.stringify(approval));
}

function handleRejectApproval(req, res, approvalId) {
  const approval = approvals.get(approvalId);
  if (!approval) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Approval not found' }));
    return;
  }

  approval.status = 'REJECTED';
  approval.resolvedAt = new Date().toISOString();
  approval.resolvedBy = 'user';
  approvals.set(approvalId, approval);

  res.writeHead(200);
  res.end(JSON.stringify(approval));
}

function handleListFindings(req, res) {
  const findingList = Array.from(findings.values());
  res.writeHead(200);
  res.end(JSON.stringify(findingList));
}

function handleRemediateFinding(req, res, findingId) {
  const finding = findings.get(findingId);
  if (!finding) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Finding not found' }));
    return;
  }

  finding.status = 'IN_PROGRESS';
  finding.verificationState = 'UNVERIFIED';
  finding.updatedAt = new Date().toISOString();
  findings.set(findingId, finding);

  const remediationTask = {
    id: generateTaskId(),
    missionId: finding.missionId,
    type: 'REMEDIATION',
    title: `Remediate finding ${findingId}`,
    description: `Fix security issue: ${finding.title}`,
    assignedAgent: 'FORGE',
    capabilities: ['PATCH_GENERATION', 'FAILURE_ANALYSIS'],
    dependencies: [],
    status: 'CREATED',
    requiredPermissions: ['filesystem.workspace.write', 'git.commit'],
    requiresApproval: false,
    riskLevel: 'MEDIUM',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.set(remediationTask.id, remediationTask);

  res.writeHead(200);
  res.end(JSON.stringify({ finding, remediationTask }));
}