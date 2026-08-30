# AURA — Unified Intelligence Platform

AURA is a central AI intelligence and orchestration platform that acts as the "central brain" for specialized agent systems. The user communicates with AURA rather than managing multiple independent agents. AURA understands objectives, maintains context, creates Missions, decomposes work, delegates tasks, coordinates agents, evaluates results, and synthesizes a unified response.

The platform contains four primary specialist systems:
- **FORGE** — Software engineering (architecture, implementation, testing, code review, Git operations)
- **SENTINEL** — Defensive security and independent verification (threat modeling, SAST, dependency analysis, secret detection, remediation verification)
- **RESEARCH** — Knowledge acquisition and evidence synthesis (web research, documentation retrieval, fact verification)
- **AUTOMATION/OPS** — Authorized device, infrastructure, deployment, and operational actions

All consequential tool usage passes through an independent **Governance Engine** and **Tool Broker**, separating AI intelligence from execution authority.

## Core Architecture

```
USER
  |
  v
AURA — CENTRAL BRAIN
  |
  +---- FORGE -------- Engineering sub-agents
  |
  +---- SENTINEL ----- Security sub-agents
  |
  +---- RESEARCH ----- Research sub-agents
  |
  +---- AUTOMATION --- Operations sub-agents
  |
  v
GOVERNANCE ENGINE
  |
TOOL BROKER
  |
  +---- SANDBOX
  +---- DEVICE
  +---- CLOUD
```

## Product Principles

- **PR-01** — One central brain: AURA owns high-level intelligence and orchestration
- **PR-02** — Specialized agents: Primary agents own domain-specific work
- **PR-03** — Specialized sub-agents: Complex work is decomposed into narrow workers
- **PR-04** — Least privilege: Agents receive only required permissions
- **PR-05** — Intelligence is not authority: AI decisions do not automatically authorize execution
- **PR-06** — Independent verification: FORGE cannot verify its own security fixes
- **PR-07** — Human authority: Consequential actions remain policy and approval controlled
- **PR-08** — Recoverability: Engineering operations should be reversible where technically possible
- **PR-09** — Auditability: Consequential operations must be attributable and traceable
- **PR-10** — Local-first/hybrid: Local resources usable alongside controlled cloud execution

## New: AURA Mission Control API

### HTTP Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/missions` | Create a new mission from user objective |
| `GET` | `/api/missions` | List all missions |
| `GET` | `/api/missions/:id` | Get mission with tasks, findings, approvals |
| `POST` | `/api/missions/:id/pause` | Pause a running mission |
| `POST` | `/api/missions/:id/resume` | Resume a paused mission |
| `POST` | `/api/missions/:id/cancel` | Cancel a mission |
| `GET` | `/api/missions/:id/tasks` | List tasks for a mission |
| `GET` | `/api/missions/:id/findings` | List security findings for a mission |
| `GET` | `/api/approvals` | List pending approval requests |
| `POST` | `/api/approvals/:id/approve` | Approve an action |
| `POST` | `/api/approvals/:id/reject` | Reject an action |
| `GET` | `/api/findings` | List all security findings |
| `POST` | `/api/findings/:id/remediate` | Trigger FORGE remediation for a finding |

### Mission Lifecycle

Missions progress through states:
```
CREATED → PLANNING → WAITING_APPROVAL → RUNNING → PAUSED/BLOCKED/FAILED/COMPLETED/CANCELLED
                                      ↓
                              ROLLING_BACK → ROLLED_BACK
```

### FORGE-SENTINEL Remediation Protocol

```
FORGE → engineering result
  |
  v
AURA → security review task
  |
  v
SENTINEL → finding SEC-xxx
  |
  v
AURA → remediation task
  |
  v
FORGE → patch + tests
  |
  v
AURA → verification task
  |
  v
SENTINEL → VERIFIED / REOPEN
```

**Key principle**: FORGE cannot change a SENTINEL finding from OPEN to VERIFIED. Verification is an independent SENTINEL operation. Accepted risk remains distinct from resolved risk.

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

## Voice-First Assistant Features (Legacy Dashboard)

The original cinematic voice-first personal AI assistant dashboard is still available at the root path:

- **Voice-First Interface** — Wake word detection ("Aura"), continuous listening, multi-language speech recognition (20+ languages)
- **Holographic UI** — Cinematic orbital visualization, neural network particle system, HUD-style panels with cyberpunk glow effects
- **Local-First Architecture** — All data stored in browser localStorage, works offline
- **Live AI Integration** — OpenRouter API streaming for LLM responses (NVIDIA Nemotron 3 Ultra by default)
- **Real-Time Data** — Weather (OpenWeatherMap), News (NewsAPI), system diagnostics
- **Productivity Tools** — Focus timer (Pomodoro), task queue, reminders, memory bank
- **Enhanced Authentication** — Face recognition with liveness detection, PIN fallback, AES-256 encryption, auto-lock on blur/tab switch, continuous face verification
- **Multi-Model AI Selection** — 30+ models across free, premium, and local offline categories

## AI Models

AURA supports 30+ models across three tiers via OpenRouter:

### Free Models (OpenRouter)
| Key | Model | Provider |
| --- | --- | --- |
| `nemotron-3-ultra` | Nemotron 3 Ultra 550B | NVIDIA |
| `nemotron-3-super` | Nemotron 3 Super 120B | NVIDIA |
| `nemotron-3-nano` | Nemotron 3 Nano 30B | NVIDIA |
| `nemotron-nano-omni` | Nemotron 3 Nano Omni 30B | NVIDIA |
| `nemotron-nano-12b` | Nemotron Nano 12B v2 VL | NVIDIA |
| `nemotron-nano-9b` | Nemotron Nano 9B v2 | NVIDIA |
| `lyria-3-pro` | Lyria 3 Pro | Google |
| `lyria-3-clip` | Lyria 3 Clip | Google |
| `gemma-4-31b` | Gemma 4 31B IT | Google |
| `gemma-4-26b` | Gemma 4 26B A4B IT | Google |
| `laguna-m1` | Laguna M1 | Poolside |
| `laguna-s21` | Laguna S 2.1 | Poolside |
| `laguna-xs21` | Laguna XS 2.1 | Poolside |
| `ling-3-flash` | Ling 3.0 Flash | InclusionAI |
| `north-mini-code` | North Mini Code | Cohere |
| `gpt-oss-20b` | GPT-OSS 20B | OpenAI |
| `llama-3.2-2b` | Llama 3.2 2B Instruct | Meta |
| `openrouter-free` | OpenRouter Free Router | OpenRouter |

### Premium Models (Require Credits)
| Key | Model | Provider |
| --- | --- | --- |
| `gpt-4o` | GPT-4o | OpenAI |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI |
| `claude-3.5-sonnet` | Claude 3.5 Sonnet | Anthropic |
| `claude-3-haiku` | Claude 3 Haiku | Anthropic |
| `gemini-1.5-pro` | Gemini 1.5 Pro | Google |
| `gemini-1.5-flash` | Gemini 1.5 Flash | Google |

### Local/Offline Models (Experimental)
Run entirely in-browser via WebLLM / Transformers.js:
| Key | Model | Provider | Size | Context |
| --- | --- | --- | --- | --- |
| `phi-3-mini` | Phi-3 Mini | Microsoft | 2.4 GB | 4K |
| `qwen2-1.5b` | Qwen2 1.5B | Alibaba | 1.2 GB | 32K |
| `smollm-1.7b` | SmolLM 1.7B | HuggingFace | 1.1 GB | 8K |
| `llama-3.2-1b` | Llama 3.2 1B | Meta | 1.3 GB | 128K |
| `llama-3.2-2b` | Llama 3.2 2B | Meta | 2.0 GB | 128K |

Select models via the **AI Model** panel in the right rail or via `/model <key>` command. Local models require WebGPU and download on first use.

## Voice Commands (Legacy Dashboard)

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
| "Aura, enroll my face" | Start face enrollment |
| "Aura, lock aura" | Lock the interface |

## Text Commands (Legacy Dashboard)

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
- `/lock` — Lock AURA (requires re-auth)
- `/unlock` — Unlock with PIN or face
- `/enroll-face` — Start face enrollment flow
- `/model nemotron-3-ultra` — Switch AI model
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
| `Ctrl+L` / `Cmd+L` | Lock AURA |

## Interface Modes (Legacy Dashboard)

- **Focus** — Standard assistance
- **Stealth** — Muted responses, minimal UI
- **Cinema** — Immersive, side rails hidden, enlarged orb

## Architecture

### AURA Core (New)
```
core/
|-- intent/           # IntentService - recognizes intents from user requests
|-- planner/          # PlannerService - decomposes objectives into goals/milestones/tasks
|-- missions/         # MissionService - manages mission lifecycle, tasks, findings, approvals
|-- context/          # ContextManager - hierarchical context (user→project→mission→agent→task)
|-- routing/          # AgentRouter - routes work by capability, policy, availability
|-- models/           # ModelRouter - routes to local/cloud/specialized models
|-- recovery/         # RecoveryManager - handles failures, retries, mission resumption
```

### Agent Adapters (New)
```
agents/
|-- forge/            # FORGE adapter - executes engineering tasks via ToolBroker
|-- sentinel/         # SENTINEL adapter - executes security tasks, verifies FORGE patches
|-- research/         # RESEARCH adapter - web research, documentation retrieval
|-- automation/       # AUTOMATION adapter - deployment, operations (restricted)
```

### Governance & Execution (New)
```
governance/           # GovernanceEngine - policy evaluation, approval workflows
tools/                # ToolBroker - mediates all tool execution through governance
sandbox/              # Sandbox - isolated execution environment
audit/                # AuditService - append-only audit events with hash chaining
database/             # PostgreSQL schema for missions, tasks, findings, approvals
```

### Legacy Dashboard
```
Browser (public/)
  |-- local commands, Web Speech APIs, localStorage
  |-- Face Auth (auth-enhanced.js) — liveness, PIN, encryption, auto-lock
  |-- GET /api/status
  |-- GET /api/models
  |-- GET /api/news
  |-- GET /api/weather
  `-- POST /api/assistant
                 |
Node HTTP server (server.js)
  |-- static file serving & .env loading
  |-- credential isolation
  |-- OpenRouter SDK & NewsAPI.org & OpenWeatherMap proxy requests
  `-- Mission API endpoints (/api/missions, /api/approvals, /api/findings)
```

## Project Structure

```
.
|-- public/                     # Legacy dashboard
|   |-- app.js                  # Commands, voice, persistence, UI behavior
|   |-- auth-enhanced.js        # Face auth, liveness, PIN, encryption, auto-lock
|   |-- index.html              # Dashboard markup (HUD panels, orbital viz, neural canvas)
|   |-- local-ai.js             # Local/offline model loading via WebLLM
|   `-- styles.css              # Cyberpunk theme: --cyan #00ffd1, grid, scanlines, glow
|-- core/                       # AURA Central Brain
|   |-- intent/
|   |-- planner/
|   |-- missions/
|   |-- context/
|   |-- routing/
|   |-- models/
|   `-- recovery/
|-- agents/                     # Agent Adapters
|   |-- forge/
|   |-- sentinel/
|   |-- research/
|   `-- automation/
|-- governance/                 # Governance Engine
|-- tools/                      # Tool Broker & Executors
|-- sandbox/                    # Sandbox Manager
|-- memory/                     # Hierarchical Memory
|-- audit/                      # Audit Service
|-- database/                   # Database Schema (PostgreSQL)
|-- shared/                     # Shared Types (TypeScript)
|-- .env.example                # Environment variable template
|-- package.json                # Runtime requirement & npm scripts
|-- package-lock.json
|-- server.js                   # HTTP server, static files, OpenRouter SDK, API proxies
|-- index.ts                    # Main exports
`-- README.md
```

## Database Schema

PostgreSQL schema (`database/schema.sql`) includes tables for:
- `users`, `projects`
- `missions` — objectives, goals, status, metadata
- `tasks` — typed tasks with dependencies, permissions, approval requirements
- `task_dependencies` — DAG edges
- `security_findings` — normalized findings with severity, verification state
- `approvals` — approval requests with risk, affected resources, rollback info
- `tool_requests`, `tool_executions` — full tool usage audit trail
- `git_checkpoints` — engineering session state for rollback
- `audit_events` — append-only events with cryptographic hash chaining
- `memories` — hierarchical context storage
- `agent_runs` — execution tracking with tokens, cost, duration
- `execution_nodes` — distributed execution node registry

Views: `mission_progress`, `agent_performance`

## Governance Decisions

Every tool request is evaluated by the Governance Engine:

| Decision | Meaning |
| --- | --- |
| `ALLOW` | Execute immediately |
| `DENY` | Block execution |
| `REQUIRE_APPROVAL` | Pause, request human approval |
| `SANDBOX_ONLY` | Execute only in isolated sandbox |
| `ALLOW_WITH_LIMITS` | Execute with parameter constraints (e.g., network allowlist) |

Capability permissions are granular:
- `filesystem.read`, `filesystem.workspace.write`
- `git.commit`, `git.push`, `git.branch`
- `sandbox.execute`
- `network.http.allowlisted`
- `secrets.request`
- `deployment.staging`, `deployment.production`

## Enhanced Authentication (Legacy Dashboard)

AURA includes a client-side security layer (`public/auth-enhanced.js`) with:

- **Face Recognition** — Browser-based face detection via `face-api.js` (TinyFaceDetector + 68-point landmarks + 128-dim embeddings)
- **Liveness Detection** — Anti-spoofing challenges: blink, look left/right/up/down, smile (randomized sequence)
- **PIN Fallback** — 4–8 digit PIN with PBKDF2 (100k iterations, SHA-256) + salt, lockout after 5 failures (15 min)
- **AES-256-GCM Encryption** — Face descriptors and sensitive data encrypted at rest in `localStorage`; key derived via PBKDF2 from device entropy
- **Auto-Lock** — Instant lock on window blur, tab hide, or page unload; configurable inactivity timeout (default 30s)
- **Continuous Protection** — Background face verification every 1s while authenticated; locks on different face or no face
- **Sensitive Action Re-Auth** — Commands containing passwords, API keys, financial terms, or destructive actions require fresh biometric/PIN verification
- **WebAuthn Support** — Optional platform biometric (Touch ID, Face ID, Windows Hello) as additional factor

## Data & Privacy

- `OPENROUTER_API_KEY`, `NEWS_API_KEY`, `WEATHER_API_KEY` stay on server, never returned by API
- Notes, voice preferences, wake-word settings, latest 20 messages stored in browser `localStorage`
- Face descriptors & auth config encrypted (AES-256-GCM) in `localStorage`
- Live AI requests send recent context through OpenRouter to model provider
- News commands query NewsAPI.org; weather queries OpenWeatherMap
- Local commands require no external API
- Clearing site data removes browser-local history, notes, and encrypted auth data
- Mission data stored in PostgreSQL with audit trail

## Validation

Check JavaScript syntax before committing changes:

```bash
npm run check
```

TypeScript type checking (for core packages):

```bash
cd FORGE && pnpm typecheck
```

## Troubleshooting

- **Voice shows `TEXT ONLY`** — Use a browser with `SpeechRecognition`/`webkitSpeechRecognition` (Chromium recommended)
- **Wake word inactive** — Allow microphone access, keep page visible, use `/wake` or click microphone
- **`npm start` can't find `@openrouter/sdk`** — Run `npm install` from project root
- **Stays in local mode** — Confirm `OPENROUTER_API_KEY` in `.env` or server environment, restart Node.js
- **News says not configured** — Confirm `NEWS_API_KEY` in `.env`, restart
- **Speech unavailable** — Check speech synthesis support, ensure not in Stealth mode or muted
- **Site won't open** — Allow pop-ups for local AURA page; nav commands open new tab
- **Face auth camera not starting** — Allow camera permission, ensure HTTPS or localhost, check `face-api.js` loaded from CDN
- **Face auth keeps failing** — Re-enroll in good lighting, center face in frame, ensure liveness challenges complete
- **Auto-lock too aggressive** — Adjust `AUTH_CONFIG.autoLockTimeout` in `auth-enhanced.js` or disable `lockOnBlur`
- **PIN locked out** — Wait 15 minutes or clear `localStorage` keys `aura.pin.*`

## License

MIT