import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readFile, stat, writeFile } from 'fs/promises';
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
  'nemotron-3.5-lightning': 'nvidia/nemotron-3.5-lightning:free',
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

// Self-learning store
const learningStore = new Map();
const LEARNING_FILE = join(__dirname, 'learning-data.json');

async function loadLearningData() {
  try {
    const data = await readFile(LEARNING_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    for (const [key, value] of Object.entries(parsed)) {
      learningStore.set(key, value);
    }
    console.log(`Loaded ${learningStore.size} learning entries`);
  } catch (e) {
    console.log('No existing learning data, starting fresh');
  }
}

async function saveLearningData() {
  try {
    const obj = Object.fromEntries(learningStore);
    await writeFile(LEARNING_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Failed to save learning data:', e);
  }
}

function generateLearningId() { return `learn-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function addLearningEntry(input, expectedOutput, actualOutput, rating, tags = []) {
  const id = generateLearningId();
  const entry = {
    id,
    input,
    expectedOutput,
    actualOutput,
    rating,
    tags,
    timestamp: Date.now(),
    useCount: 0
  };
  learningStore.set(id, entry);
  saveLearningData();
  return entry;
}

function getRelevantLearning(input, maxEntries = 5) {
  const entries = Array.from(learningStore.values())
    .filter(e => e.rating >= 4)
    .sort((a, b) => b.useCount - a.useCount || b.timestamp - a.timestamp)
    .slice(0, maxEntries);
  return entries;
}

function buildLearningPrompt(input) {
  const relevant = getRelevantLearning(input);
  if (relevant.length === 0) return '';
  
  let prompt = '\n\n--- Learned Patterns (from user feedback) ---\n';
  for (const entry of relevant) {
    prompt += `User: ${entry.input}\n`;
    if (entry.expectedOutput) {
      prompt += `Preferred: ${entry.expectedOutput}\n`;
    }
    prompt += `---\n`;
    entry.useCount++;
  }
  saveLearningData();
  return prompt;
}

async function handleProxy(serviceName, targetUrl, req, res) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeout);
    
    res.writeHead(response.status, { 'Content-Type': 'application/json' });
    const data = await response.text();
    res.end(data);
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'unhealthy', 
      service: serviceName,
      error: error.name === 'AbortError' ? 'timeout' : error.message 
    }));
  }
}

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
      const { messages, model: modelKey, temperature = 0.7, max_tokens = 2048, stream = true, tools, userInput } = JSON.parse(body || '{}');
      
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.end('data: {"text": "Local demo mode. Configure OPENROUTER_API_KEY in .env for live AI.", "done": true}\n\n');
        return;
      }

      const modelId = getModelId(modelKey || DEFAULT_MODEL);
      
      let enhancedMessages = messages || [];
      if (userInput) {
        const learningPrompt = buildLearningPrompt(userInput);
        if (learningPrompt) {
          const hasSystem = enhancedMessages.some(m => m.role === 'system');
          if (hasSystem) {
            enhancedMessages = enhancedMessages.map(m => 
              m.role === 'system' ? { ...m, content: m.content + learningPrompt } : m
            );
          } else {
            enhancedMessages = [{ role: 'system', content: 'You are AURA, a helpful AI assistant.' + learningPrompt }, ...enhancedMessages];
          }
        }
      }
      
      const payload = {
        model: modelId,
        messages: enhancedMessages,
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

  // Learning API endpoints
  if (path === '/api/learning/feedback' && req.method === 'POST') {
    handleLearningFeedback(req, res);
    return;
  }

  if (path === '/api/learning/entries' && req.method === 'GET') {
    handleGetLearningEntries(req, res);
    return;
  }

  if (path.match(/^\/api\/learning\/entries\/[^/]+$/) && req.method === 'DELETE') {
    handleDeleteLearningEntry(req, res);
    return;
  }

  // Skills API endpoints
  if (path === '/api/skills' && req.method === 'GET') {
    handleGetSkills(req, res);
    return;
  }

  if (path.match(/^\/api\/skills\/[^/]+$/) && req.method === 'GET') {
    handleGetSkill(req, res);
    return;
  }

  if (path === '/api/skills/install' && req.method === 'POST') {
    handleInstallSkill(req, res);
    return;
  }

  if (path.match(/^\/api\/skills\/[^/]+\/enable$/) && req.method === 'POST') {
    handleEnableSkill(req, res);
    return;
  }

  if (path.match(/^\/api\/skills\/[^/]+\/disable$/) && req.method === 'POST') {
    handleDisableSkill(req, res);
    return;
  }

  if (path.match(/^\/api\/skills\/[^/]+\/config$/) && req.method === 'PATCH') {
    handleUpdateSkillConfig(req, res);
    return;
  }

  if (path.match(/^\/api\/skills\/[^/]+$/) && req.method === 'DELETE') {
    handleRemoveSkill(req, res);
    return;
  }

  // External service proxy endpoints
  if (path === '/api/proxy/forge' && req.method === 'GET') {
    handleProxy('forge', 'http://localhost:4000/health', req, res);
    return;
  }

  if (path === '/api/proxy/sentinel' && req.method === 'GET') {
    handleProxy('sentinel', 'http://localhost:8000/health', req, res);
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

// Skills storage
const skillsStore = new Map();
const SKILLS_FILE = join(__dirname, 'skills-data.json');

async function loadSkillsData() {
  try {
    const data = await readFile(SKILLS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    for (const skill of parsed) {
      skillsStore.set(skill.id, skill);
    }
    console.log(`Loaded ${skillsStore.size} skills`);
  } catch (e) {
    console.log('No existing skills data, initializing with defaults');
    await initializeDefaultSkills();
  }
}

async function saveSkillsData() {
  try {
    const skills = Array.from(skillsStore.values());
    await writeFile(SKILLS_FILE, JSON.stringify(skills, null, 2));
  } catch (e) {
    console.error('Failed to save skills data:', e);
  }
}

async function initializeDefaultSkills() {
  const defaultSkills = [
    {
      id: 'code-analysis',
      name: 'Code Analysis',
      version: '1.0.0',
      description: 'Analyzes code snippets for issues, best practices, and improvements',
      author: 'AURA Team',
      category: 'development',
      tags: ['code', 'analysis', 'lint', 'review'],
      permissions: [
        { type: 'model', scope: ['analysis'], description: 'Uses AI model for code analysis' },
        { type: 'filesystem', scope: ['read'], description: 'Reads code files for analysis' }
      ],
      configSchema: {
        type: 'object',
        properties: {
          autoAnalyze: { type: 'boolean', description: 'Automatically analyze code blocks', default: true },
          severityThreshold: { type: 'string', description: 'Minimum severity to report', enum: ['info', 'warning', 'error'], default: 'warning' },
          languages: { type: 'array', description: 'Supported languages', default: ['typescript', 'javascript', 'python', 'go', 'rust'] }
        }
      },
      defaultConfig: { autoAnalyze: true, severityThreshold: 'warning', languages: ['typescript', 'javascript', 'python', 'go', 'rust'] },
      enabled: true
    },
    {
      id: 'task-automation',
      name: 'Task Automation',
      version: '1.0.0',
      description: 'Automates repetitive tasks and workflows',
      author: 'AURA Team',
      category: 'productivity',
      tags: ['automation', 'workflow', 'tasks', 'scheduler'],
      permissions: [
        { type: 'shell', scope: ['execute'], description: 'Runs automation scripts' },
        { type: 'filesystem', scope: ['read', 'write'], description: 'Manages task files and scripts' },
        { type: 'api', scope: ['forge'], description: 'Triggers FORGE runs' }
      ],
      configSchema: {
        type: 'object',
        properties: {
          maxConcurrentTasks: { type: 'number', description: 'Max concurrent tasks', default: 3 },
          defaultTimeout: { type: 'number', description: 'Default timeout (ms)', default: 300000 },
          retryAttempts: { type: 'number', description: 'Retry attempts', default: 2 }
        }
      },
      defaultConfig: { maxConcurrentTasks: 3, defaultTimeout: 300000, retryAttempts: 2 },
      enabled: true
    },
    {
      id: 'security-audit',
      name: 'Security Audit',
      version: '1.0.0',
      description: 'Scans for security vulnerabilities and compliance issues',
      author: 'AURA Team',
      category: 'security',
      tags: ['security', 'audit', 'vulnerability', 'compliance', 'sentinel'],
      permissions: [
        { type: 'api', scope: ['sentinel'], description: 'Integrates with SENTINEL for security scanning' },
        { type: 'shell', scope: ['semgrep', 'gitleaks', 'trivy'], description: 'Runs security scanners' },
        { type: 'filesystem', scope: ['read'], description: 'Scans codebase for vulnerabilities' }
      ],
      configSchema: {
        type: 'object',
        properties: {
          scanOnSave: { type: 'boolean', description: 'Scan on file save', default: false },
          severityFilter: { type: 'string', description: 'Minimum severity', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
          scanners: { type: 'array', description: 'Enabled scanners', default: ['semgrep', 'gitleaks', 'trivy', 'npm-audit'] },
          autoRemediate: { type: 'boolean', description: 'Auto-remediate issues', default: false }
        }
      },
      defaultConfig: { scanOnSave: false, severityFilter: 'medium', scanners: ['semgrep', 'gitleaks', 'trivy', 'npm-audit'], autoRemediate: false },
      enabled: true
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis',
      version: '1.0.0',
      description: 'Performs data analysis, visualization, and insights generation',
      author: 'AURA Team',
      category: 'analysis',
      tags: ['data', 'analytics', 'visualization', 'statistics', 'ml'],
      permissions: [
        { type: 'model', scope: ['analysis'], description: 'Uses AI for data insights' },
        { type: 'filesystem', scope: ['read', 'write'], description: 'Processes data files' },
        { type: 'shell', scope: ['python', 'jupyter'], description: 'Runs data analysis scripts' }
      ],
      configSchema: {
        type: 'object',
        properties: {
          defaultFormat: { type: 'string', description: 'Default data format', default: 'csv' },
          maxRows: { type: 'number', description: 'Max rows to process', default: 100000 },
          enableML: { type: 'boolean', description: 'Enable ML features', default: false }
        }
      },
      defaultConfig: { defaultFormat: 'csv', maxRows: 100000, enableML: false },
      enabled: true
    },
    {
      id: 'documentation',
      name: 'Documentation Generator',
      version: '1.0.0',
      description: 'Generates and maintains documentation from code',
      author: 'AURA Team',
      category: 'development',
      tags: ['documentation', 'docs', 'readme', 'api-docs', 'comments'],
      permissions: [
        { type: 'model', scope: ['generation'], description: 'Generates documentation using AI' },
        { type: 'filesystem', scope: ['read', 'write'], description: 'Reads code and writes docs' }
      ],
      configSchema: {
        type: 'object',
        properties: {
          formats: { type: 'array', description: 'Output formats', default: ['markdown', 'jsdoc', 'openapi'] },
          includeExamples: { type: 'boolean', description: 'Include code examples', default: true },
          updateOnChange: { type: 'boolean', description: 'Auto-update on code changes', default: false }
        }
      },
      defaultConfig: { formats: ['markdown', 'jsdoc', 'openapi'], includeExamples: true, updateOnChange: false },
      enabled: true
    }
  ];

  for (const skill of defaultSkills) {
    skillsStore.set(skill.id, skill);
  }
  await saveSkillsData();
}

function handleGetSkills(req, res) {
  const skills = Array.from(skillsStore.values());
  res.writeHead(200);
  res.end(JSON.stringify({ skills }));
}

function handleGetSkill(req, res) {
  const id = req.url.split('/').pop();
  const skill = skillsStore.get(id);
  if (skill) {
    res.writeHead(200);
    res.end(JSON.stringify(skill));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Skill not found' }));
  }
}

async function handleInstallSkill(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      let skill;
      
      if (data.template) {
        const templateSkill = skillsStore.get(data.template);
        if (!templateSkill) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Template not found' }));
          return;
        }
        skill = { ...templateSkill, id: `${data.template}-${Date.now()}`, installedAt: new Date().toISOString() };
      } else if (data.url) {
        skill = {
          id: `skill-${Date.now()}`,
          name: 'Custom Skill from URL',
          version: '1.0.0',
          description: `Installed from ${data.url}`,
          author: 'External',
          category: 'custom',
          tags: ['custom'],
          permissions: [],
          configSchema: { type: 'object', properties: {} },
          defaultConfig: {},
          enabled: true,
          sourceUrl: data.url,
          installedAt: new Date().toISOString()
        };
      } else if (data.manifest) {
        skill = { ...data.manifest, id: data.manifest.id || `skill-${Date.now()}`, installedAt: new Date().toISOString() };
      } else if (data.custom) {
        skill = {
          id: data.custom.id,
          name: data.custom.name,
          version: '1.0.0',
          description: data.custom.description,
          author: 'User',
          category: data.custom.category,
          tags: ['custom'],
          permissions: [],
          configSchema: { type: 'object', properties: {} },
          defaultConfig: {},
          enabled: true,
          code: data.custom.code,
          installedAt: new Date().toISOString()
        };
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid install data' }));
        return;
      }
      
      if (skillsStore.has(skill.id)) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: 'Skill already exists' }));
        return;
      }
      
      skillsStore.set(skill.id, skill);
      await saveSkillsData();
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, skill }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

async function handleEnableSkill(req, res) {
  const id = req.url.split('/')[3];
  const skill = skillsStore.get(id);
  if (!skill) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Skill not found' }));
    return;
  }
  skill.enabled = true;
  await saveSkillsData();
  res.writeHead(200);
  res.end(JSON.stringify({ success: true, skill }));
}

async function handleDisableSkill(req, res) {
  const id = req.url.split('/')[3];
  const skill = skillsStore.get(id);
  if (!skill) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Skill not found' }));
    return;
  }
  skill.enabled = false;
  await saveSkillsData();
  res.writeHead(200);
  res.end(JSON.stringify({ success: true, skill }));
}

async function handleUpdateSkillConfig(req, res) {
  const id = req.url.split('/')[3];
  const skill = skillsStore.get(id);
  if (!skill) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Skill not found' }));
    return;
  }
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const config = JSON.parse(body || '{}');
      skill.config = { ...skill.defaultConfig, ...skill.config, ...config };
      await saveSkillsData();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, skill }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

async function handleRemoveSkill(req, res) {
  const id = req.url.split('/').pop();
  if (skillsStore.delete(id)) {
    await saveSkillsData();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Skill not found' }));
  }
}

await loadLearningData();
await loadSkillsData();

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

async function handleLearningFeedback(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { input, expectedOutput, actualOutput, rating, tags } = JSON.parse(body || '{}');
      if (!input || rating === undefined) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'input and rating required' }));
        return;
      }
      const entry = addLearningEntry(input, expectedOutput || '', actualOutput || '', rating, tags || []);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, entry }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

function handleGetLearningEntries(req, res) {
  const entries = Array.from(learningStore.values())
    .sort((a, b) => b.timestamp - a.timestamp);
  res.writeHead(200);
  res.end(JSON.stringify(entries));
}

function handleDeleteLearningEntry(req, res) {
  const id = req.url.split('/').pop();
  if (learningStore.delete(id)) {
    saveLearningData();
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Entry not found' }));
  }
}