# AURA — Neural Operating System

A cinematic, voice-first personal AI assistant dashboard with a holographic cyberpunk aesthetic. Combines a responsive command-center interface with browser speech APIs, built-in commands and memory, optional live responses from NVIDIA Nemotron through OpenRouter, and optional live headline briefings through NewsAPI.org.

The app runs as a small Node.js HTTP server and a static browser client. No frontend framework or build step required.

## Features

- **Voice-First Interface** — Wake word detection ("Aura"), continuous listening, multi-language speech recognition (20+ languages)
- **Holographic UI** — Cinematic orbital visualization, neural network particle system, HUD-style panels with cyberpunk glow effects
- **Local-First Architecture** — All data stored in browser localStorage, works offline
- **Live AI Integration** — OpenRouter API streaming for LLM responses (NVIDIA Nemotron 3 Ultra by default)
- **Real-Time Data** — Weather (OpenWeatherMap), News (NewsAPI), system diagnostics
- **Productivity Tools** — Focus timer (Pomodoro), task queue, reminders, memory bank
- **Offline Command Utilities** — Daily briefs, local search, unit conversion, dice/coin/choice tools, and text transforms
- **Multi-Modal Input** — Voice, text commands, quick-action buttons, keyboard shortcuts
- **Interface Modes** — Focus (standard), Stealth (muted), Cinema (immersive)
- **Security** — Server-side API credentials never exposed to browser

## Quick Start

```bash
# Install dependencies
npm install

# Configure API keys (optional)
cp .env.example .env
# Edit .env with your keys:
# OPENROUTER_API_KEY=your_key
# NEWS_API_KEY=your_key
# WEATHER_API_KEY=your_key

# Start server
npm start
```

Visit [http://localhost:3000](http://localhost:3000). Without API keys, AURA starts in local mode with built-in commands available.

For development with auto-restart:

```bash
npm run dev
```

## Configuration

Create `.env` from `.env.example`:

```dotenv
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
NEWS_API_KEY=your-newsapi-key
NEWS_API_QUERY=world OR global OR international
NEWS_API_LANGUAGE=en
WEATHER_API_KEY=your-openweathermap-key
PORT=3000
```

| Variable | Enables | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Live AI responses through OpenRouter | none |
| `OPENROUTER_MODEL` | OpenRouter model selection | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `NEWS_API_KEY` | Live headline briefings through NewsAPI.org | none |
| `NEWS_API_QUERY` | Default news query | `world OR global OR international` |
| `NEWS_API_LANGUAGE` | NewsAPI two-letter language code | `en` |
| `WEATHER_API_KEY` | Weather data through OpenWeatherMap | demo key |
| `PORT` | Local HTTP port | `3000` |

Restart server after changing environment variables.

## Voice Commands

Say "**Aura**" to wake, then speak your request:

| Command | Action |
| --- | --- |
| "Aura, what time is it?" | Time check |
| "Aura, weather in Tokyo" | Weather lookup |
| "Aura, world news" | Headlines |
| "Aura, remember I have a meeting at 3" | Store memory |
| "Aura, what do you remember?" | Recall memories |
| "Aura, add task Review PR" | Create task |
| "Aura, remind me to stretch in 30 minutes" | Set reminder |
| "Aura, daily brief" | Summarize local tasks, reminders, timer, memory, and mode |
| "Aura, convert 10 miles to km" | Convert units locally |
| "Aura, roll 2d6" | Roll dice locally |
| "Aura, /timer start" | Start focus timer |

## Text Commands

Type in the command dock (`⌘K` or `/`):

- `/status` — System diagnostics
- `/tasks` — List open tasks
- `/done "task name"` — Complete task
- `/reminders` — Show reminders
- `/remind "text" in 10 minutes` — Set reminder
- `/timer` / `/timer start` / `/timer pause` / `/timer reset` — Focus timer
- `/timer 45/10` / `/timer work 50` / `/timer break 10` — Update focus timer lengths
- `/brief` — Daily local brief with tasks, reminders, timer, memory, voice, and mode
- `/find meeting` — Search local memories, tasks, reminders, and recent conversation
- `/convert 10 miles to km` — Convert length, mass, volume, and temperature units
- `/roll 2d6` / `/coin` / `/choose coffee, tea` — Random local utilities
- `/slug Launch Plan` / `/titlecase launch plan` / `/wordcount draft text` — Text tools
- `/export` — Export local data
- `/reset-local` — Clear all browser data
- `/mute` / `/voice` — Toggle speech output
- `/sleep` / `/wake` — Disable/enable wake word
- `open github.com` — Launch website
- `calculate 18 * 7` — Math

Natural language also works: "what time is it?", "world headlines", "latest technology news", "show memories", "daily brief", "convert 32 F to C", and "flip a coin".

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+K` / `Cmd+K` | Focus command input |
| `/` | Focus command input |
| `Enter` | Submit command |
| `Escape` | Cancel voice/speech, return to standby |

## Interface Modes

- **Focus** — Standard assistance
- **Stealth** — Muted responses, minimal UI
- **Cinema** — Immersive, side rails hidden, enlarged orb

## Architecture

```
Browser (public/)
  |-- local commands, Web Speech APIs, localStorage
  |-- GET /api/status
  |-- GET /api/news
  |-- GET /api/weather
  `-- POST /api/assistant
                |
Node HTTP server (server.js)
  |-- static file serving & .env loading
  |-- credential isolation
  `-- OpenRouter SDK & NewsAPI.org & OpenWeatherMap proxy requests
```

### HTTP Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` / `HEAD` | `/api/status` | Live AI, model, news, weather configuration |
| `GET` / `HEAD` | `/api/news` | Fetch headlines from NewsAPI.org |
| `GET` / `HEAD` | `/api/weather` | Fetch weather from OpenWeatherMap |
| `POST` | `/api/assistant` | Generate streaming AI response |
| `GET` / `HEAD` | `/*` | Serve files from `public/` |

## Project Structure

```
.
|-- public/
|   |-- app.js       # Commands, voice, persistence, UI behavior
|   |-- index.html   # Dashboard markup (HUD panels, orbital viz, neural canvas)
|   `-- styles.css   # Cyberpunk theme: --cyan #00ffd1, grid, scanlines, glow
|-- .env.example     # Environment variable template
|-- package.json     # Runtime requirement & npm scripts
|-- package-lock.json
`-- server.js        # HTTP server, static files, OpenRouter SDK, API proxies
```

### UI Components

- **Topbar** — Brand, connection status, AI mode, clock
- **Left Rail** — System status (metric ring, telemetry), Network graph, Diagnostics, Quick commands, Mission queue, Security protocol
- **Core Stage** — Orbital visualizer (reactor core, rings, orbits), HUD orb with listening/thinking/wake states, Conversation log, Suggestion chips
- **Right Rail** — Environment (time, hands-free toggle, language), Weather, Reminders, Focus timer, Local data (export/import/memories), Activity stream, Interface modes
- **Command Dock** — Voice button, command input, execute button, meta status

## Data & Privacy

- `OPENROUTER_API_KEY`, `NEWS_API_KEY`, `WEATHER_API_KEY` stay on server, never returned by API
- Notes, voice preferences, wake-word settings, latest 20 messages stored in browser `localStorage`
- Live AI requests send recent context through OpenRouter to model provider
- News commands query NewsAPI.org; weather queries OpenWeatherMap
- Local commands require no external API
- Clearing site data removes browser-local history and notes

## Validation

Check JavaScript syntax before committing changes:

```bash
npm run check
```

## Troubleshooting

- **Voice shows `TEXT ONLY`** — Use a browser with `SpeechRecognition`/`webkitSpeechRecognition` (Chromium recommended)
- **Wake word inactive** — Allow microphone access, keep page visible, use `/wake` or click microphone
- **`npm start` can't find `@openrouter/sdk`** — Run `npm install` from project root
- **Stays in local mode** — Confirm `OPENROUTER_API_KEY` in `.env` or server environment, restart Node.js
- **News says not configured** — Confirm `NEWS_API_KEY` in `.env`, restart
- **Speech unavailable** — Check speech synthesis support, ensure not in Stealth mode or muted
- **Site won't open** — Allow pop-ups for local AURA page; nav commands open new tab

## License

MIT