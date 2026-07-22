import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readFile, stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

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

function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (path === '/api/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      liveAI: false,
      liveNews: false,
      model: 'local',
    }));
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
    res.writeHead(200);
    res.end(JSON.stringify({
      query: 'world',
      articles: [
        {
          title: 'Local mode: Configure NEWS_API_KEY in .env for live headlines',
          source: 'AURA System',
          publishedAt: new Date().toISOString(),
          description: 'Add your NewsAPI key to enable real-time news briefings.',
        },
      ],
    }));
    return;
  }

  if (path === '/api/assistant' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200);
      res.end('data: {"text": "Local demo mode. Configure OPENROUTER_API_KEY in .env for live AI.", "done": true}\n\n');
    });
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
  console.log(`AURA server running at http://localhost:${PORT}`);
});