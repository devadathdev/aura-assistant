const elements = {
  activityList: document.querySelector("#activity-list"),
  assistantStatus: document.querySelector("#assistant-status"),
  clearActivity: document.querySelector("#clear-activity"),
  clearLocalData: document.querySelector("#clear-local-data"),
  clock: document.querySelector("#clock"),
  commandForm: document.querySelector("#command-form"),
  commandInput: document.querySelector("#command-input"),
  connectionLabel: document.querySelector("#connection-label"),
  conversation: document.querySelector("#conversation"),
  exportData: document.querySelector("#export-data"),
  importData: document.querySelector("#import-data"),
  importFile: document.querySelector("#import-file"),
  coreButton: document.querySelector("#core-button"),
  date: document.querySelector("#date"),
  dayPeriod: document.querySelector("#day-period"),
  environmentTime: document.querySelector("#environment-time"),
  greeting: document.querySelector("#greeting"),
  handsFreeToggle: document.querySelector("#hands-free-toggle"),
  latency: document.querySelector("#latency-value"),
  languageSelect: document.querySelector("#language-select"),
  memoryCount: document.querySelector("#memory-count"),
  messageTemplate: document.querySelector("#message-template"),
  modeLabel: document.querySelector("#mode-label"),
  reminderCount: document.querySelector("#reminder-count"),
  reminderList: document.querySelector("#reminder-list"),
  orbState: document.querySelector("#orb-state"),
  orbWrap: document.querySelector("#orb-wrap"),
  voiceButton: document.querySelector("#voice-button"),
  voiceSupport: document.querySelector("#voice-support"),
  taskCount: document.querySelector("#task-count"),
  taskList: document.querySelector("#task-list"),
  uptime: document.querySelector("#uptime"),
  weatherLocation: document.querySelector("#weather-location"),
  weatherBody: document.querySelector("#weather-body"),
  weatherTemp: document.querySelector("#weather-temp"),
  weatherCondition: document.querySelector("#weather-condition"),
  weatherFeels: document.querySelector("#weather-feels"),
  weatherHumidity: document.querySelector("#weather-humidity"),
  weatherWind: document.querySelector("#weather-wind"),
  weatherCityInput: document.querySelector("#weather-city-input"),
  weatherSearch: document.querySelector("#weather-search"),
  timerPhase: document.querySelector("#timer-phase"),
  timerTime: document.querySelector("#timer-time"),
  timerProgress: document.querySelector("#timer-progress span"),
  timerToggle: document.querySelector("#timer-toggle"),
  timerReset: document.querySelector("#timer-reset"),
  timerWork: document.querySelector("#timer-work"),
  timerBreak: document.querySelector("#timer-break"),
  memorySection: document.querySelector("#memory-section"),
  memoryList: document.querySelector("#memory-list"),
  memoryCountLabel: document.querySelector("#memory-count-label"),
  faceAuthOverlay: document.querySelector("#face-auth-overlay"),
  faceAuthVideo: document.querySelector("#face-auth-video"),
  faceAuthCanvas: document.querySelector("#face-auth-canvas"),
  faceAuthMessage: document.querySelector("#face-auth-message"),
  faceAuthProgress: document.querySelector("#face-auth-progress span"),
  faceAuthConfidence: document.querySelector("#face-auth-confidence"),
  faceAuthEnrollBtn: document.querySelector("#face-auth-enroll"),
  faceAuthSkipBtn: document.querySelector("#face-auth-skip"),
  faceAuthEnrolled: document.querySelector("#face-auth-enrolled"),
};

const STORAGE_KEYS = {
  history: "aura.history.v1",
  language: "aura.language.v1",
  memories: "aura.memories.v1",
  reminders: "aura.reminders.v1",
  tasks: "aura.tasks.v1",
  voice: "aura.voice.v1",
  wakeWord: "aura.wake-word.v1",
  weatherCity: "aura.weather-city.v1",
  timerSettings: "aura.timer-settings.v1",
  faceDescriptors: "aura.face-descriptors.v1",
  faceAuthEnabled: "aura.face-auth-enabled.v1",
  currentModel: "aura.current-model.v1",
};

const MALE_VOICE_HINTS = [
  "male",
  "man",
  "david",
  "mark",
  "george",
  "daniel",
  "alex",
  "fred",
  "thomas",
  "oliver",
  "aaron",
  "bruce",
  "ralph",
  "albert",
  "arthur",
  "james",
  "john",
  "tom",
];

const state = {
  startedAt: Date.now(),
  history: loadJson(STORAGE_KEYS.history, []),
  language: loadJson(STORAGE_KEYS.language, "auto"),
  memories: loadJson(STORAGE_KEYS.memories, []),
  reminders: normalizeStoredReminders(loadJson(STORAGE_KEYS.reminders, [])),
  liveAI: false,
  liveNews: false,
  listening: false,
  muted: loadJson(STORAGE_KEYS.voice, false),
  recognition: null,
  recognitionActive: false,
  voiceMode: "wake",
  wakeEnabled: loadJson(STORAGE_KEYS.wakeWord, true),
  wakeRestartTimer: null,
  commandTimer: null,
  pendingVoiceCommand: "",
  pauseWakeForSpeech: false,
  speechCycle: 0,
  speechTimer: null,
  userStoppedRecognition: false,
  tasks: normalizeStoredTasks(loadJson(STORAGE_KEYS.tasks, [])),
  busy: false,
  voicesLoaded: false,
  weatherCity: loadJson(STORAGE_KEYS.weatherCity, ""),
  timerSettings: loadJson(STORAGE_KEYS.timerSettings, { work: 25, break: 5 }),
  timer: {
    phase: "work",
    seconds: 25 * 60,
    running: false,
    interval: null,
  },
  faceDescriptors: loadJson(STORAGE_KEYS.faceDescriptors, []),
  faceAuthEnabled: loadJson(STORAGE_KEYS.faceAuthEnabled, false),
  faceModelsLoaded: false,
  faceAuthPending: false,
  currentModel: loadJson(STORAGE_KEYS.currentModel, "nemotron-3-ultra"),
  availableModels: null,
};

const LOCAL_MODELS = {
  'phi-3-mini': { provider: 'Microsoft', size: '2.4 GB', context: 4096, quantized: true },
  'qwen2-1.5b': { provider: 'Alibaba', size: '1.2 GB', context: 32768, quantized: true },
  'smollm-1.7b': { provider: 'HuggingFace', size: '1.1 GB', context: 8192, quantized: true },
  'llama-3.2-1b': { provider: 'Meta', size: '1.3 GB', context: 131072, quantized: true },
  'llama-3.2-2b': { provider: 'Meta', size: '2.0 GB', context: 131072, quantized: true },
};

if (state.timerSettings) {
  state.timer.seconds = state.timerSettings.work * 60;
}

// Enhanced Auth Instance
let auraAuth = null;

// Initialize enhanced auth system
async function initEnhancedAuth() {
  if (window.AuraAuth) {
    auraAuth = new AuraAuth();
    await auraAuth.init();
    
    // Listen for auth events
    auraAuth.onActivityChange((event, data) => {
      if (event === 'lock') {
        handleAuthLock(data.reason);
      } else if (event === 'unlock') {
        handleAuthUnlock(data.method);
      }
    });
    
    // Sync state
    state.faceAuthEnabled = auraAuth.state.faceAuthEnabled;
    state.faceDescriptors = auraAuth.state.faceDescriptors;
  }
}

// Auth event handlers
function handleAuthLock(reason) {
  console.log('[Auth] handleAuthLock called, reason:', reason);
  console.log('[Auth] auraAuth:', auraAuth);
  state.authenticated = false;
  syncFaceAuthState();
  
  // Check if fingerprint or PIN is available as primary auth
  const hasFingerprint = auraAuth?.state.fingerprintEnabled;
  const hasPin = auraAuth?.state.pinSet;
  console.log('[Auth] hasFingerprint:', hasFingerprint, 'hasPin:', hasPin);
  
  if (hasFingerprint || hasPin) {
    showAuthMethodScreen();
  } else {
    showFaceAuthScreen();
  }
  
  elements.assistantStatus.textContent = "Locked: " + reason;
  setOrbState("", "LOCKED");
  addActivity("Auto-locked: " + reason, true);

  if (!document.hidden && (hasFingerprint || hasPin || state.faceAuthEnabled)) {
    // The auth method screen handles starting the appropriate auth
  }
}

function handleAuthUnlock(method) {
  state.authenticated = true;
  state.authMethod = method;
  unlockApp(method);
  
  // After first auth, enable auto-lock protection
  if (auraAuth && auraAuth.hasAnyAuthEnrolled()) {
    setupFaceAuth();
  }
}


// ── Web Audio UI SFX Engine ──
const sfxState = {
  enabled: loadJson("aura.sfx.enabled", true),
  ctx: null,
};

function getAudioContext() {
  if (!sfxState.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) sfxState.ctx = new AudioContext();
  }
  if (sfxState.ctx && sfxState.ctx.state === "suspended") {
    sfxState.ctx.resume();
  }
  return sfxState.ctx;
}

function playUiSound(type) {
  if (!sfxState.enabled || state.muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "click" || type === "button") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "hover") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } else if (type === "execute" || type === "transmit") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.12);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === "wake" || type === "chime") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === "alert") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {}
}

const WAKE_WORDS = {
  default: [
    "aura",
    "aura.",
    "aura?",
    "aura!",
    "aura,",
    "hey aura",
    "ok aura",
    "okay aura",
    "aura assistant",
    "hey aura assistant",
    "ora",
    "ora.",
    "ora?",
    "ora!",
    "ara",
    "ara.",
    "ara?",
    "ara!",
  ],
  ar: ["أورا", "اورا", "أورا.", "أورا؟", "أورا!"],
  bn: ["অরা", "অওরা", "অরা।", "অওরা।"],
  gu: ["ઓરા", "ઔરા", "ઓરા.", "ઔરા."],
  hi: ["ऑरा", "औरा", "ऑरा।", "औरा।"],
  ja: ["オーラ", "オーラ。", "オーラ！", "オーラ？"],
  kn: ["ಆರಾ", "ಔರಾ", "ಆರಾ.", "ಔರಾ."],
  ko: ["아우라", "오라", "아우라.", "오라.", "아우라!", "오라!"],
  ml: ["ഓറ", "ഓറാ", "ഔറ", "ഓറാ.", "ഔറ."],
  mr: ["ऑरा", "औरा", "ऑरा.", "औरा."],
  ta: ["ஆரா", "ஔரா", "ஆரா.", "ஔரா."],
  te: ["ఆరా", "ఔరా", "ఆరా.", "ఔరా."],
  zh: ["奥拉", "欧拉", "奥拉。", "欧拉。", "奥拉！", "欧拉！"],
};

function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function cleanText(value, limit = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeStringList(items, limit = 20, textLimit = 280) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => cleanText(item, textLimit)).filter(Boolean).slice(-limit);
}

function normalizeHistory(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      role: ["user", "assistant"].includes(item?.role) ? item.role : "assistant",
      content: cleanText(item?.content, 8000),
    }))
    .filter((item) => item.content)
    .slice(-20);
}

function normalizeStoredTasks(items) {
  if (!Array.isArray(items)) return [];
  const now = new Date().toISOString();

  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = cleanText(item);
        return text ? { id: createId("task"), text, createdAt: now, done: false, completedAt: null } : null;
      }

      const text = cleanText(item?.text);
      if (!text) return null;

      return {
        id: cleanText(item?.id, 80) || createId("task"),
        text,
        createdAt: item?.createdAt || now,
        done: Boolean(item?.done),
        completedAt: item?.completedAt || null,
      };
    })
    .filter(Boolean)
    .slice(-50);
}

function normalizeStoredReminders(items) {
  if (!Array.isArray(items)) return [];
  const now = new Date().toISOString();

  return items
    .map((item) => {
      const text = cleanText(item?.text || item?.message);
      const dueAt = item?.dueAt ? new Date(item.dueAt) : null;
      if (!text || !dueAt || Number.isNaN(dueAt.getTime())) return null;

      return {
        id: cleanText(item?.id, 80) || createId("reminder"),
        text,
        dueAt: dueAt.toISOString(),
        createdAt: item?.createdAt || now,
        done: Boolean(item?.done),
        notified: Boolean(item?.notified),
      };
    })
    .filter(Boolean)
    .slice(-50);
}

function getOpenTasks() {
  return state.tasks
    .filter((task) => !task.done)
    .slice()
    .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
}

function getActiveReminders() {
  return state.reminders
    .filter((reminder) => !reminder.done)
    .slice()
    .sort((first, second) => new Date(first.dueAt) - new Date(second.dueAt));
}

function formatRelativeTime(value) {
  const target = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(target.getTime())) return "unknown";

  const diffMs = target.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  if (absMs < 45_000) return diffMs < 0 ? "moments ago" : "now";

  const units = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const [unit, size] = units.find(([, unitSize]) => absMs >= unitSize) || units[2];
  const amount = Math.round(absMs / size);
  const label = amount === 1 ? unit : unit + "s";

  return diffMs < 0 ? amount + " " + label + " ago" : "in " + amount + " " + label;
}

function formatShortDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unscheduled";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderEmptyQueue(container, message) {
  const empty = document.createElement("div");
  empty.className = "queue-empty";
  empty.textContent = message;
  container.appendChild(empty);
}

function updateTaskDisplay() {
  if (!elements.taskList || !elements.taskCount) return;
  const openTasks = getOpenTasks();
  elements.taskCount.textContent = openTasks.length + " OPEN";
  elements.taskList.innerHTML = "";

  if (!openTasks.length) {
    renderEmptyQueue(elements.taskList, "No active tasks.");
    return;
  }

  openTasks.slice(0, 5).forEach((task, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "queue-item";
    item.title = "Mark task complete";
    item.addEventListener("click", () => {
      const completed = completeTask(task.id);
      if (completed) addActivity("Task completed: " + completed.text.slice(0, 30));
    });

    const marker = document.createElement("span");
    marker.className = "queue-index";
    marker.textContent = String(index + 1).padStart(2, "0");

    const body = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    title.textContent = task.text;
    meta.textContent = "Added " + formatRelativeTime(task.createdAt);
    body.append(title, meta);
    item.append(marker, body);
    elements.taskList.appendChild(item);
  });

  if (openTasks.length > 5) {
    renderEmptyQueue(elements.taskList, "+" + (openTasks.length - 5) + " more queued.");
  }
}

function updateReminderDisplay() {
  if (!elements.reminderList || !elements.reminderCount) return;
  const reminders = getActiveReminders();
  elements.reminderCount.textContent = reminders.length + " ACTIVE";
  elements.reminderList.innerHTML = "";

  if (!reminders.length) {
    renderEmptyQueue(elements.reminderList, "No scheduled reminders.");
    return;
  }

  reminders.slice(0, 4).forEach((reminder, index) => {
    const dueAt = new Date(reminder.dueAt);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "queue-item reminder-item";
    if (dueAt <= new Date()) item.classList.add("is-due");
    item.title = "Dismiss reminder";
    item.addEventListener("click", () => {
      const dismissed = completeReminder(reminder.id);
      if (dismissed) addActivity("Reminder dismissed: " + dismissed.text.slice(0, 28), true);
    });

    const marker = document.createElement("span");
    marker.className = "queue-index";
    marker.textContent = String(index + 1).padStart(2, "0");

    const body = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    title.textContent = reminder.text;
    meta.textContent = formatRelativeTime(reminder.dueAt) + " / " + formatShortDateTime(reminder.dueAt);
    body.append(title, meta);
    item.append(marker, body);
    elements.reminderList.appendChild(item);
  });

  if (reminders.length > 4) {
    renderEmptyQueue(elements.reminderList, "+" + (reminders.length - 4) + " more scheduled.");
  }
}

function addTask(text) {
  const taskText = cleanText(text);
  if (!taskText) return null;
  const task = {
    id: createId("task"),
    text: taskText,
    createdAt: new Date().toISOString(),
    done: false,
    completedAt: null,
  };
  state.tasks.push(task);
  state.tasks = state.tasks.slice(-50);
  saveState();
  updateTaskDisplay();
  return task;
}

function resolveOpenTask(reference) {
  const openTasks = getOpenTasks();
  const normalized = cleanText(reference).toLowerCase();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return openTasks[Number.parseInt(normalized, 10) - 1] || null;
  }

  return (
    openTasks.find((task) => task.id === normalized) ||
    openTasks.find((task) => task.text.toLowerCase() === normalized) ||
    openTasks.find((task) => task.text.toLowerCase().includes(normalized)) ||
    null
  );
}

function completeTask(reference) {
  const task = resolveOpenTask(reference);
  if (!task) return null;
  task.done = true;
  task.completedAt = new Date().toISOString();
  saveState();
  updateTaskDisplay();
  return task;
}

function clearCompletedTasks() {
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((task) => !task.done);
  saveState();
  updateTaskDisplay();
  return before - state.tasks.length;
}

function formatTaskList() {
  const openTasks = getOpenTasks();
  if (!openTasks.length) return "Your local task queue is clear.";
  return "Open tasks:\n" + openTasks.map((task, index) => (index + 1) + ". " + task.text + " (added " + formatRelativeTime(task.createdAt) + ")").join("\n");
}

function relativeUnitToMs(amount, unit) {
  const normalized = unit.toLowerCase();
  if (["m", "min", "mins", "minute", "minutes"].includes(normalized)) return amount * 60_000;
  if (["h", "hr", "hrs", "hour", "hours"].includes(normalized)) return amount * 3_600_000;
  if (["d", "day", "days"].includes(normalized)) return amount * 86_400_000;
  return 0;
}

function parseTimeOfDay(value) {
  const normalized = cleanText(value, 80).toLowerCase();
  if (normalized === "noon") return { hours: 12, minutes: 0 };
  if (normalized === "midnight") return { hours: 0, minutes: 0 };

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const meridiem = match[3]?.replace(/\./g, "");
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  return { hours, minutes };
}

function dateWithTime(base, time) {
  const date = new Date(base);
  date.setHours(time.hours, time.minutes, 0, 0);
  return date;
}

function parseScheduledDate(value, now = new Date()) {
  const normalized = cleanText(value, 140).toLowerCase();
  const relativeDay = normalized.match(/^(today|tomorrow)(?:\s+at)?\s*(.*)$/i);

  if (relativeDay) {
    const base = new Date(now);
    if (relativeDay[1].toLowerCase() === "tomorrow") base.setDate(base.getDate() + 1);
    const time = parseTimeOfDay(relativeDay[2] || "09:00");
    if (!time) return null;
    const scheduled = dateWithTime(base, time);
    if (scheduled <= now && relativeDay[1].toLowerCase() === "today") scheduled.setDate(scheduled.getDate() + 1);
    return scheduled;
  }

  const timeOnly = parseTimeOfDay(normalized);
  if (timeOnly) {
    const scheduled = dateWithTime(now, timeOnly);
    if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
    return scheduled;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed <= now ? null : parsed;
}

function parseReminderRequest(input) {
  let body = cleanText(input, 500)
    .replace(/^\/remind\s+/i, "")
    .replace(/^remind\s+me\s+to\s+/i, "")
    .replace(/^remind\s+me\s+/i, "")
    .replace(/^remind\s+/i, "");

  const alternateRelative = body.match(/^in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\s+(?:to\s+)?(.+)$/i);
  if (alternateRelative) {
    const amount = Number.parseInt(alternateRelative[1], 10);
    const dueAt = new Date(Date.now() + relativeUnitToMs(amount, alternateRelative[2]));
    return dueAt > new Date() ? { text: cleanText(alternateRelative[3]), dueAt } : null;
  }

  const relative = body.match(/^(.+?)\s+in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d)$/i);
  if (relative) {
    const amount = Number.parseInt(relative[2], 10);
    const dueAt = new Date(Date.now() + relativeUnitToMs(amount, relative[3]));
    return dueAt > new Date() ? { text: cleanText(relative[1]), dueAt } : null;
  }

  const dayScheduled = body.match(/^(.+?)\s+(today|tomorrow)(?:\s+at)?\s+(.+)$/i);
  if (dayScheduled) {
    const dueAt = parseScheduledDate(dayScheduled[2] + " at " + dayScheduled[3]);
    return dueAt ? { text: cleanText(dayScheduled[1]), dueAt } : null;
  }

  const scheduled = body.match(/^(.+?)\s+(?:at|on)\s+(.+)$/i);
  if (scheduled) {
    const dueAt = parseScheduledDate(scheduled[2]);
    return dueAt ? { text: cleanText(scheduled[1]), dueAt } : null;
  }

  return null;
}

function addReminder(text, dueAt) {
  const reminderText = cleanText(text);
  const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (!reminderText || Number.isNaN(dueDate.getTime())) return null;

  const reminder = {
    id: createId("reminder"),
    text: reminderText,
    dueAt: dueDate.toISOString(),
    createdAt: new Date().toISOString(),
    done: false,
    notified: false,
  };
  state.reminders.push(reminder);
  state.reminders = state.reminders.slice(-50);
  saveState();
  updateReminderDisplay();
  return reminder;
}

function resolveActiveReminder(reference) {
  const reminders = getActiveReminders();
  const normalized = cleanText(reference).toLowerCase();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return reminders[Number.parseInt(normalized, 10) - 1] || null;
  }

  return (
    reminders.find((reminder) => reminder.id === normalized) ||
    reminders.find((reminder) => reminder.text.toLowerCase() === normalized) ||
    reminders.find((reminder) => reminder.text.toLowerCase().includes(normalized)) ||
    null
  );
}

function completeReminder(reference) {
  const reminder = resolveActiveReminder(reference);
  if (!reminder) return null;
  reminder.done = true;
  reminder.notified = true;
  saveState();
  updateReminderDisplay();
  return reminder;
}

function formatReminderList() {
  const reminders = getActiveReminders();
  if (!reminders.length) return "You have no active reminders.";
  return "Active reminders:\n" + reminders.map((reminder, index) => (index + 1) + ". " + reminder.text + " - " + formatRelativeTime(reminder.dueAt) + " (" + formatShortDateTime(reminder.dueAt) + ")").join("\n");
}

function checkDueReminders() {
  const now = new Date();
  const due = getActiveReminders().filter((reminder) => !reminder.notified && new Date(reminder.dueAt) <= now);
  if (!due.length) return;

  due.forEach((reminder) => {
    reminder.done = true;
    reminder.notified = true;
  });
  saveState();
  updateReminderDisplay();

  const message = due.length === 1
    ? "Reminder: " + due[0].text
    : "Reminders due: " + due.map((reminder) => reminder.text).join("; ");
  addMessage("assistant", message);
  addActivity(due.length === 1 ? "Reminder due" : due.length + " reminders due");
  speak(message);
}

const FACE_AUTH_CONFIG = {
  modelUrl: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/",
  minConfidence: 0.6,
  maxEnrollSamples: 3,
  detectionThreshold: 0.5,
  inputSize: 320,
};

function getFaceAuthProgressEl() {
  return elements.faceAuthProgress || document.querySelector("#face-auth-progress span") || document.querySelector(".face-auth-progress span");
}

function setFaceAuthProgress(value) {
  const progressEl = getFaceAuthProgressEl();
  if (!progressEl) return;
  const percent = typeof value === "number" && value <= 1 ? value * 100 : value;
  progressEl.style.width = Math.max(0, Math.min(100, percent || 0)) + "%";
}

function setFaceAuthMessage(message) {
  if (elements.faceAuthMessage) elements.faceAuthMessage.textContent = message;
}

function setFaceAuthConfidence(confidence) {
  if (!elements.faceAuthConfidence) return;
  const confidenceStrong = elements.faceAuthConfidence.querySelector("strong");
  if (typeof confidence !== "number") {
    elements.faceAuthConfidence.hidden = true;
    if (confidenceStrong) confidenceStrong.textContent = "--%";
    return;
  }

  elements.faceAuthConfidence.hidden = false;
  if (confidenceStrong) confidenceStrong.textContent = Math.round(confidence * 100) + "%";
}

function syncFaceAuthState() {
  if (auraAuth) {
    state.faceAuthEnabled = auraAuth.state.faceAuthEnabled;
    state.faceDescriptors = auraAuth.state.faceDescriptors || [];
  }
  console.log('[Auth] syncFaceAuthState - faceAuthEnabled:', state.faceAuthEnabled, 'faceDescriptors:', state.faceDescriptors?.length, 'auraAuth.pinSet:', auraAuth?.state.pinSet, 'auraAuth.fingerprintEnabled:', auraAuth?.state.fingerprintEnabled);
  updateSecurityCardStatus();
}

function getFaceDescriptorCount() {
  return auraAuth?.state.faceDescriptors?.length || state.faceDescriptors.length;
}

function hasFaceEnrollment() {
  return getFaceDescriptorCount() > 0;
}

function formatLivenessChallenge(challenge) {
  const labels = {
    blink: "Blink once",
    lookLeft: "Look left",
    lookRight: "Look right",
    lookUp: "Look up",
    lookDown: "Look down",
    smile: "Smile",
  };
  return labels[challenge] || "Follow the prompt";
}

function updateFaceAuthProgress(update = {}) {
  if (update.message) setFaceAuthMessage(update.message);
  if (typeof update.progress === "number") setFaceAuthProgress(update.progress);
  if (typeof update.confidence === "number") setFaceAuthConfidence(update.confidence);

  if (update.phase === "liveness" && update.challenge) {
    const score = typeof update.score === "number" ? " " + Math.round(update.score * 100) + "%" : "";
    setFaceAuthMessage(formatLivenessChallenge(update.challenge) + score);
  }
}

function shouldKeepFaceAuthCameraActive() {
  return Boolean(
    auraAuth?.state.authenticated &&
      auraAuth.state.faceAuthEnabled &&
      window.AUTH_CONFIG?.continuousProtectionEnabled
  );
}

function updateSecurityCardStatus() {
  const securityCard = document.querySelector(".hud-security-card");
  if (!securityCard) return;

  const enabled = auraAuth ? auraAuth.state.faceAuthEnabled : state.faceAuthEnabled;
  const descriptorCount = auraAuth?.state.faceDescriptors?.length ?? state.faceDescriptors.length;
  const faceStatus = securityCard.querySelector("#face-auth-status");
  if (faceStatus) {
    faceStatus.textContent = enabled && descriptorCount > 0
      ? "FACE ID ACTIVE"
      : enabled
        ? "ENROLL REQUIRED"
        : "PASSCODE ONLY";
    faceStatus.classList.toggle("hud-crimson", enabled && descriptorCount > 0);
  }
}

async function clearFaceData() {
  if (auraAuth) auraAuth.clearFaceData();
  state.faceDescriptors = [];
  state.faceAuthEnabled = false;
  localStorage.setItem(STORAGE_KEYS.faceDescriptors, "[]");
  localStorage.setItem(STORAGE_KEYS.faceAuthEnabled, "false");

  updateSecurityCardStatus();
  stopFaceAuthCamera({ force: true });

  if (elements.faceAuthEnrolled) elements.faceAuthEnrolled.hidden = true;
  if (elements.faceAuthSkipBtn) elements.faceAuthSkipBtn.textContent = "USE PASSCODE";
  setFaceAuthConfidence(null);
  setFaceAuthProgress(0);

  addActivity("Face data cleared", true);
}

async function loadFaceModels() {
  if (state.faceModelsLoaded) return true;

  if (!window.faceapi) {
    console.warn("face-api.js not loaded");
    return false;
  }

  try {
    elements.faceAuthMessage.textContent = "Loading face models...";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_AUTH_CONFIG.modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_AUTH_CONFIG.modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_AUTH_CONFIG.modelUrl),
    ]);
    state.faceModelsLoaded = true;
    return true;
  } catch (error) {
    console.error("Failed to load face models:", error);
    elements.faceAuthMessage.textContent = "Failed to load face models";
    return false;
  }
}

async function startFaceAuthCamera() {
  const video = elements.faceAuthVideo || document.getElementById("face-auth-video");
  const canvas = elements.faceAuthCanvas || document.getElementById("face-auth-canvas");

  if (!navigator.mediaDevices?.getUserMedia) {
    setFaceAuthMessage("Camera is not available in this browser");
    return false;
  }

  try {
    if (video.srcObject) {
      if (video.paused) await video.play();
      return true;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    return true;
  } catch (error) {
    console.error("Camera access denied:", error);
    setFaceAuthMessage("Camera access required for Face ID");
    return false;
  }
}

function stopFaceAuthCamera(options = {}) {
  const { force = false } = options;
  if (!force && shouldKeepFaceAuthCameraActive()) return;

  const video = elements.faceAuthVideo || document.getElementById("face-auth-video");
  if (video?.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }

  const canvas = elements.faceAuthCanvas || document.getElementById("face-auth-canvas");
  const ctx = canvas?.getContext("2d");
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function detectFace(video) {
  if (!window.faceapi || !state.faceModelsLoaded) return null;

  const detections = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detections) return null;

  const canvas = document.getElementById("face-auth-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  faceapi.draw.drawDetections(canvas, detections);
  faceapi.draw.drawFaceLandmarks(canvas, detections);

  return detections;
}

async function initFaceAuth() {
  const loaded = await loadFaceModels();
  if (!loaded) return false;

  const cameraStarted = await startFaceAuthCamera();
  if (!cameraStarted) return false;

  if (elements.faceAuthEnrollBtn) elements.faceAuthEnrollBtn.onclick = enrollFace;
  if (elements.faceAuthSkipBtn) elements.faceAuthSkipBtn.onclick = handleFaceAuthSkip;

  return true;
}

async function enrollFace() {
  const btn = elements.faceAuthEnrollBtn || document.getElementById("face-auth-enroll");
  const video = elements.faceAuthVideo || document.getElementById("face-auth-video");

  btn.disabled = true;
  btn.textContent = "ENROLLING...";
  setFaceAuthMessage("Center your face in the frame.");
  setFaceAuthConfidence(null);
  setFaceAuthProgress(0);

  state.faceAuthPending = true;
  try {
    if (!auraAuth) throw new Error("Enhanced auth not initialized");

    const result = await auraAuth.enrollFace(video, (progress) => {
      updateFaceAuthProgress(progress);
      if (typeof progress.progress === "number") setFaceAuthProgress(progress.progress);
    });

    syncFaceAuthState();
    // auraAuth.enrollFace() already saves encrypted descriptors and state to v2 keys
    // No need to write to legacy v1 keys

    setFaceAuthMessage("Face enrolled. Liveness protection is active.");
    setFaceAuthProgress(100);
    setFaceAuthConfidence(null);
    if (elements.faceAuthEnrolled) {
      elements.faceAuthEnrolled.hidden = false;
      elements.faceAuthEnrolled.textContent = result.samples + " samples enrolled";
    }
    if (elements.faceAuthSkipBtn) elements.faceAuthSkipBtn.textContent = "USE PASSCODE";
    addActivity("Face enrolled with " + result.samples + " quality samples");
  } catch (error) {
    console.error(error);
    setFaceAuthMessage(error instanceof Error ? error.message : "Face enrollment failed");
    setFaceAuthProgress(0);
    addActivity("Face enrollment failed", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "ENROLL FACE";
    state.faceAuthPending = false;
  }
}

async function verifyFace() {
  syncFaceAuthState();
  if (!state.faceAuthEnabled || !hasFaceEnrollment()) {
    unlockApp("none");
    return true;
  }

  const video = elements.faceAuthVideo || document.getElementById("face-auth-video");
  setFaceAuthMessage("Complete the liveness check to unlock.");
  setFaceAuthConfidence(null);
  setFaceAuthProgress(0.08);

  const previousLivenessProgress = window.updateLivenessProgress;
  window.updateLivenessProgress = (challenge, score, detail = {}) => {
    updateFaceAuthProgress({
      phase: "liveness",
      challenge,
      score,
      progress: detail.progress,
      message: detail.message,
    });
  };

  try {
    if (!auraAuth) throw new Error("Enhanced auth not initialized");
    const result = await auraAuth.authenticate("face", {
      videoElement: video,
      requireLiveness: true,
      onProgress: updateFaceAuthProgress,
    });

    if (result.success) {
      setFaceAuthConfidence(result.confidence ?? 1);
      setFaceAuthMessage("Face verified. Access granted.");
      setFaceAuthProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 450));
      auraAuth.unlock(result.method || "face");
      return true;
    }

    setFaceAuthConfidence(result.confidence || 0);
    setFaceAuthMessage("Face auth failed: " + result.error + ". Use passcode.");
    setFaceAuthProgress(0);
    if (elements.faceAuthSkipBtn) elements.faceAuthSkipBtn.hidden = false;
    addActivity("Face auth failed: " + result.error, true);
    return false;
  } catch (error) {
    console.error(error);
    setFaceAuthMessage(error instanceof Error ? error.message : "Face authentication failed");
    setFaceAuthProgress(0);
    addActivity("Face authentication failed", true);
    return false;
  } finally {
    window.updateLivenessProgress = previousLivenessProgress;
  }
}

function unlockApp(method = "face") {
  const overlay = elements.faceAuthOverlay || document.getElementById("face-auth-overlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.removeAttribute("aria-modal");
  }

  state.faceAuthPending = false;
  syncFaceAuthState();
  stopFaceAuthCamera();
  updateSecurityCardStatus();

  addActivity(method === "none" ? "Authentication not required" : "Authenticated via " + method);
  elements.assistantStatus.textContent = "Welcome back. All systems operational.";
  setOrbState("", state.wakeEnabled ? "SAY “AURA”" : "TAP TO SPEAK");
}

function showFaceAuthScreen() {
  const overlay = elements.faceAuthOverlay || document.getElementById("face-auth-overlay");
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute("aria-modal", "true");
  }
  hidePinEntry();
  setFaceAuthConfidence(null);
  setFaceAuthProgress(0);
  elements.assistantStatus.textContent = "Face authentication required";
  setOrbState("", "FACE ID");
}

function handleFaceAuthSkip() {
  syncFaceAuthState();
  if (state.faceAuthEnabled && hasFaceEnrollment()) {
    addActivity("Face ID bypass requested", true);
  }
  
  // Show auth method selector instead of directly showing PIN
  showAuthMethodScreen();
}

// PIN Entry Functions
function showAuthMethodScreen() {
  console.log('[Auth] showAuthMethodScreen called');
  console.log('[Auth] auraAuth:', auraAuth);
  console.log('[Auth] fingerprintEnabled:', auraAuth?.state.fingerprintEnabled);
  console.log('[Auth] pinSet:', auraAuth?.state.pinSet);
  console.log('[Auth] faceAuthEnabled:', state.faceAuthEnabled);
  console.log('[Auth] hasFaceEnrollment:', hasFaceEnrollment());
  
  const overlay = elements.faceAuthOverlay || document.getElementById("face-auth-overlay");
  console.log('[Auth] overlay:', overlay);
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute("aria-modal", "true");
  }
  
  // Hide face auth elements, show auth method selector
  const videoWrap = document.querySelector(".face-auth-video-wrap");
  if (videoWrap) videoWrap.hidden = true;
  
  const statusPanel = document.getElementById("face-auth-panel");
  if (statusPanel) statusPanel.hidden = true;
  
  const actions = document.querySelector(".face-auth-actions");
  if (actions) actions.hidden = true;
  
  // Create or show auth method selector
  let selector = document.getElementById("auth-method-selector");
  if (!selector) {
    selector = document.createElement("div");
    selector.id = "auth-method-selector";
    selector.className = "auth-method-selector";
    selector.innerHTML = `
      <h2 class="face-auth-message">Choose authentication method</h2>
      <div class="face-auth-actions" style="flex-direction: column; gap: 12px;">
        ${auraAuth?.state.fingerprintEnabled ? `
          <button type="button" id="auth-fingerprint" class="face-auth-btn primary">
            <span class="btn-icon">👆</span>
            Use Fingerprint
          </button>
        ` : ''}
        ${auraAuth?.state.pinSet ? `
          <button type="button" id="auth-pin" class="face-auth-btn secondary">
            <span class="btn-icon">🔢</span>
            Use PIN
          </button>
        ` : ''}
        ${state.faceAuthEnabled && hasFaceEnrollment() ? `
          <button type="button" id="auth-face" class="face-auth-btn ghost">
            <span class="btn-icon">👤</span>
            Use Face ID
          </button>
        ` : ''}
      </div>
    `;
    
    const container = document.querySelector(".face-auth-container");
    console.log('[Auth] container:', container);
    if (container) {
      const footer = document.querySelector(".face-auth-footer");
      console.log('[Auth] footer:', footer);
      container.insertBefore(selector, footer);
    }
  }
  selector.hidden = false;
  console.log('[Auth] selector:', selector);
  
  // Add click handlers
  const fpBtn = document.getElementById("auth-fingerprint");
  const pinBtn = document.getElementById("auth-pin");
  const faceBtn = document.getElementById("auth-face");
  
  console.log('[Auth] fpBtn:', fpBtn, 'pinBtn:', pinBtn, 'faceBtn:', faceBtn);
  
  if (fpBtn) fpBtn.onclick = () => authenticateWithFingerprint();
  if (pinBtn) pinBtn.onclick = () => showPinEntry();
  if (faceBtn) faceBtn.onclick = () => startFaceAuth();
  
  elements.assistantStatus.textContent = "Authentication required";
  setOrbState("", "AUTH");
}

function startFaceAuth() {
  const selector = document.getElementById("auth-method-selector");
  if (selector) selector.hidden = true;
  
  const videoWrap = document.querySelector(".face-auth-video-wrap");
  if (videoWrap) videoWrap.hidden = false;
  
  const statusPanel = document.getElementById("face-auth-panel");
  if (statusPanel) statusPanel.hidden = false;
  
  const actions = document.querySelector(".face-auth-actions");
  if (actions) actions.hidden = false;
  
  initFaceAuth().then((initialized) => {
    if (initialized && hasFaceEnrollment()) verifyFace();
  });
}

async function authenticateWithFingerprint() {
  if (!auraAuth) return;
  
  setFaceAuthMessage("Touch the fingerprint sensor...");
  setFaceAuthProgress(0.1);
  
  try {
    const result = await auraAuth.authenticate("fingerprint");
    if (result.success) {
      setFaceAuthConfidence(1);
      setFaceAuthMessage("Fingerprint verified. Access granted.");
      setFaceAuthProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 450));
      auraAuth.unlock("fingerprint");
      return true;
    } else {
      setFaceAuthMessage("Fingerprint failed: " + result.error + ". Try PIN or Face ID.");
      setFaceAuthProgress(0);
      showAuthMethodScreen();
      return false;
    }
  } catch (error) {
    console.error(error);
    setFaceAuthMessage(error.message);
    setFaceAuthProgress(0);
    showAuthMethodScreen();
    return false;
  }
}

function showPinEntry() {
  // Hide the auth method selector
  const selector = document.getElementById("auth-method-selector");
  if (selector) selector.hidden = true;
  
  const pinContainer = document.getElementById("face-auth-pin");
  const skipBtn = elements.faceAuthSkipBtn || document.getElementById("face-auth-skip");
  const enrollBtn = elements.faceAuthEnrollBtn || document.getElementById("face-auth-enroll");
  
  if (pinContainer) {
    pinContainer.hidden = false;
    if (skipBtn) skipBtn.hidden = true;
    if (enrollBtn) enrollBtn.hidden = true;
    setFaceAuthMessage("Enter your PIN to unlock");
    setFaceAuthProgress(0);
    setFaceAuthConfidence(null);
    
    const inputs = pinContainer.querySelectorAll("input");
    inputs.forEach((input) => {
      input.value = "";
      input.removeEventListener("input", handlePinInput);
      input.removeEventListener("keydown", handlePinKeydown);
      input.addEventListener("input", handlePinInput);
      input.addEventListener("keydown", handlePinKeydown);
    });
    inputs[0]?.focus();
    
    const submitBtn = document.getElementById("face-auth-pin-submit");
    const cancelBtn = document.getElementById("face-auth-pin-cancel");
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.onclick = verifyPinEntry;
    }
    if (cancelBtn) {
      cancelBtn.hidden = false;
      cancelBtn.onclick = () => {
        hidePinEntry();
        showAuthMethodScreen();
      };
    }
    
    const errorEl = document.getElementById("face-auth-pin-error");
    if (errorEl) errorEl.hidden = true;
  }
}

function hidePinEntry() {
  const pinContainer = document.getElementById("face-auth-pin");
  const skipBtn = document.getElementById("face-auth-skip");
  const enrollBtn = document.getElementById("face-auth-enroll");
  const submitBtn = document.getElementById("face-auth-pin-submit");
  const cancelBtn = document.getElementById("face-auth-pin-cancel");
  
  if (pinContainer) pinContainer.hidden = true;
  if (skipBtn) skipBtn.hidden = false;
  if (enrollBtn && state.faceDescriptors.length === 0) enrollBtn.hidden = false;
  if (submitBtn) submitBtn.hidden = true;
  if (cancelBtn) cancelBtn.hidden = true;
  
  const inputs = pinContainer?.querySelectorAll("input");
  inputs?.forEach(input => {
    input.value = "";
    input.removeEventListener("input", handlePinInput);
    input.removeEventListener("keydown", handlePinKeydown);
  });
}

function handlePinInput(e) {
  const input = e.target;
  input.value = input.value.replace(/\D/g, "").slice(-1);
  const inputs = input.parentElement.querySelectorAll("input");
  const index = Array.from(inputs).indexOf(input);
  
  if (input.value && index < inputs.length - 1) {
    inputs[index + 1].focus();
  }
  
  const pin = Array.from(inputs).map((item) => item.value).join("");
  if (pin.length === inputs.length) {
    verifyPinEntry();
  }
}

function handlePinKeydown(e) {
  const input = e.target;
  const inputs = input.parentElement.querySelectorAll("input");
  const index = Array.from(inputs).indexOf(input);
  
  if (e.key === "Backspace" && !input.value && index > 0) {
    inputs[index - 1].focus();
  } else if (e.key === "ArrowLeft" && index > 0) {
    inputs[index - 1].focus();
  } else if (e.key === "ArrowRight" && index < inputs.length - 1) {
    inputs[index + 1].focus();
  }
}

async function verifyPinEntry() {
  const pinContainer = document.getElementById("face-auth-pin");
  const inputs = pinContainer.querySelectorAll("input");
  const errorEl = document.getElementById("face-auth-pin-error");
  const pin = Array.from(inputs).map((item) => item.value).join("");
  
  if (pin.length < 4) {
    errorEl.textContent = "PIN must be at least 4 digits";
    errorEl.hidden = false;
    return;
  }
  
  try {
    if (!auraAuth?.state.pinSet) throw new Error("PIN not set");
    const result = await auraAuth.authenticate("pin", { pin });
    if (!result.success) throw new Error(result.error || "Invalid PIN");

    auraAuth.unlock("pin");
    hidePinEntry();
    addActivity("PIN authentication successful");
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    inputs.forEach((input) => (input.value = ""));
    inputs[0]?.focus();
    addActivity("PIN auth failed: " + e.message, true);
  }
}

async function setupFaceAuth() {
  console.log('[Auth] setupFaceAuth called');
  syncFaceAuthState();
  
  // Check if fingerprint or PIN is available as primary auth
  const hasFingerprint = auraAuth?.state.fingerprintEnabled;
  const hasPin = auraAuth?.state.pinSet;
  console.log('[Auth] setupFaceAuth - hasFingerprint:', hasFingerprint, 'hasPin:', hasPin, 'faceAuthEnabled:', state.faceAuthEnabled, 'hasFaceEnrollment:', hasFaceEnrollment());
  
  // If fingerprint or PIN is available, show that instead of face
  if ((hasFingerprint || hasPin) && (!state.faceAuthEnabled || !hasFaceEnrollment())) {
    showAuthMethodScreen();
    return;
  }
  
  // Otherwise fall back to face auth
  if (!auraAuth || !state.faceAuthEnabled) {
    unlockApp("none");
    return;
  }

  showFaceAuthScreen();
  const initialized = await initFaceAuth();
  if (!initialized) {
    handleFaceAuthSkip();
    return;
  }

  if (!hasFaceEnrollment()) {
    if (elements.faceAuthEnrollBtn) elements.faceAuthEnrollBtn.hidden = false;
    if (elements.faceAuthEnrolled) elements.faceAuthEnrolled.hidden = true;
    setFaceAuthMessage("No face enrolled. Click Enroll Face to begin.");
    setFaceAuthProgress(0);
    return;
  }

  if (elements.faceAuthEnrollBtn) elements.faceAuthEnrollBtn.hidden = true;
  if (elements.faceAuthEnrolled) {
    elements.faceAuthEnrolled.hidden = false;
    elements.faceAuthEnrolled.textContent = getFaceDescriptorCount() + " samples enrolled";
  }
  setFaceAuthMessage("Look at the camera to authenticate");
  setFaceAuthProgress(0);
  await verifyFace();
}

async function toggleFaceAuth() {
  const enabled = !state.faceAuthEnabled;
  state.faceAuthEnabled = enabled;
  localStorage.setItem(STORAGE_KEYS.faceAuthEnabled, JSON.stringify(enabled));

  if (auraAuth) {
    auraAuth.state.faceAuthEnabled = enabled;
    auraAuth.saveState();
  }

  syncFaceAuthState();

  if (!enabled) {
    stopFaceAuthCamera({ force: true });
  } else if (!hasFaceEnrollment()) {
    showFaceAuthScreen();
    initFaceAuth().then((initialized) => {
      if (initialized) {
        if (elements.faceAuthEnrollBtn) elements.faceAuthEnrollBtn.hidden = false;
        setFaceAuthMessage("No face enrolled. Click Enroll Face to begin.");
      }
    });
  }

  addActivity("Face authentication " + (enabled ? "enabled" : "disabled"), !enabled);
}

function getExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    app: "aura-assistant",
    version: 1,
    history: state.history.slice(-20),
    memories: state.memories.slice(-20),
    tasks: state.tasks.slice(-50),
    reminders: state.reminders.slice(-50),
    language: state.language,
    muted: state.muted,
    wakeEnabled: state.wakeEnabled,
    weatherCity: state.weatherCity,
    timerSettings: state.timerSettings,
  };
}

function exportLocalData() {
  const payload = getExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aura-data-" + payload.exportedAt.slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyImportedData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Import file is not valid AURA data.");
  }

  state.history = normalizeHistory(payload.history);
  state.memories = normalizeStringList(payload.memories, 20, 280);
  state.tasks = normalizeStoredTasks(payload.tasks);
  state.reminders = normalizeStoredReminders(payload.reminders);
  state.language = typeof payload.language === "string" ? payload.language : state.language;
  state.muted = typeof payload.muted === "boolean" ? payload.muted : state.muted;
  state.wakeEnabled = typeof payload.wakeEnabled === "boolean" ? payload.wakeEnabled : state.wakeEnabled;
  state.weatherCity = typeof payload.weatherCity === "string" ? payload.weatherCity : state.weatherCity;
  if (payload.timerSettings && typeof payload.timerSettings === "object") {
    state.timerSettings = {
      work: Math.min(120, Math.max(1, payload.timerSettings.work || 25)),
      break: Math.min(30, Math.max(1, payload.timerSettings.break || 5)),
    };
    state.timer.seconds = state.timerSettings.work * 60;
  }

  saveState();
  updateMemoryCount();
  updateTaskDisplay();
  updateReminderDisplay();
  updateHandsFreeControl();
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  if (state.recognition) state.recognition.lang = getSpeechLanguage();
  elements.conversation.innerHTML = "";
  restoreHistory();
  renderMemoryList();
  updateTimerDisplay();
  if (state.weatherCity) fetchWeather(state.weatherCity).then(updateWeatherDisplay).catch(() => {});
}

function resetLocalData() {
  state.history = [];
  state.memories = [];
  state.tasks = [];
  state.reminders = [];
  state.language = "auto";
  state.muted = false;
  state.wakeEnabled = true;
  state.weatherCity = "";
  state.timerSettings = { work: 25, break: 5 };
  state.timer.running = false;
  clearInterval(state.timer.interval);
  state.timer.interval = null;
  state.timer.phase = "work";
  state.timer.seconds = 25 * 60;
  saveState();
  updateMemoryCount();
  updateTaskDisplay();
  updateReminderDisplay();
  updateHandsFreeControl();
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  if (state.recognition) state.recognition.lang = getSpeechLanguage();
  elements.conversation.innerHTML = "";
  renderMemoryList();
  updateTimerDisplay();
  updateWeatherDisplay(null);
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history.slice(-20)));
  localStorage.setItem(STORAGE_KEYS.language, JSON.stringify(state.language));
  localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(state.memories.slice(-20)));
  localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(state.reminders.slice(-50)));
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks.slice(-50)));
  localStorage.setItem(STORAGE_KEYS.voice, JSON.stringify(state.muted));
  localStorage.setItem(STORAGE_KEYS.wakeWord, JSON.stringify(state.wakeEnabled));
  if (state.weatherCity) {
    localStorage.setItem(STORAGE_KEYS.weatherCity, JSON.stringify(state.weatherCity));
  }
  localStorage.setItem(STORAGE_KEYS.timerSettings, JSON.stringify(state.timerSettings));
}

function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const period = hours < 5 ? "NIGHT" : hours < 12 ? "MORNING" : hours < 17 ? "AFTERNOON" : hours < 21 ? "EVENING" : "NIGHT";
  const greeting = hours < 5 ? "Good night." : hours < 12 ? "Good morning." : hours < 17 ? "Good afternoon." : hours < 21 ? "Good evening." : "Good night.";

  if (elements.clock) elements.clock.textContent = now.toLocaleTimeString([], { hour12: false });
  if (elements.date) {
    elements.date.textContent = now
      .toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })
      .toUpperCase()
      .replace(",", " /");
  }
  if (elements.environmentTime) {
    elements.environmentTime.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (elements.dayPeriod) elements.dayPeriod.textContent = period;

  const envDateEl = document.querySelector("#environment-date");
  if (envDateEl) {
    envDateEl.textContent = now
      .toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })
      .toUpperCase()
      .replace(",", " /");
  }

  if (elements.greeting) elements.greeting.textContent = greeting;

  const utcClock = document.querySelector("#utc-clock");
  if (utcClock) {
    utcClock.textContent = `UTC ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  }

  const stardateEl = document.querySelector("#stardate-val");
  if (stardateEl) {
    const startYear = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now.getTime() - startYear.getTime()) / 86400000);
    const stardate = (now.getFullYear() + (dayOfYear / 365.25)).toFixed(3);
    stardateEl.textContent = `SD ${stardate}`;
  }

  const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  if (elements.uptime) elements.uptime.textContent = `${minutes}:${seconds}`;
}

function updateMemoryCount() {
  elements.memoryCount.innerHTML = `${state.memories.length}<small>items</small>`;
  if (elements.memoryCountLabel) {
    elements.memoryCountLabel.textContent = String(state.memories.length);
  }
}

function renderMemoryList() {
  if (!elements.memoryList) return;
  elements.memoryList.innerHTML = "";
  if (!state.memories.length) {
    renderEmptyQueue(elements.memoryList, "No stored memories.");
    return;
  }
  state.memories.forEach((memory, index) => {
    const item = document.createElement("div");
    item.className = "memory-item";
    const text = document.createElement("span");
    text.textContent = memory;
    text.title = memory;
    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "FORGET";
    del.addEventListener("click", () => {
      state.memories.splice(index, 1);
      saveState();
      updateMemoryCount();
      renderMemoryList();
      addActivity("Memory deleted: " + memory.slice(0, 30));
    });
    item.append(text, del);
    elements.memoryList.appendChild(item);
  });
}

function addActivity(text, muted = false) {
  const item = document.createElement("div");
  item.className = "activity-item";
  item.innerHTML = `
    <span class="activity-node${muted ? " muted" : ""}"></span>
    <div><strong></strong><small>Just now</small></div>
  `;
  item.querySelector("strong").textContent = text;

  const previous = elements.activityList.firstElementChild;
  if (previous) {
    const line = document.createElement("span");
    line.className = "activity-line";
    item.prepend(line);
  }

  elements.activityList.prepend(item);
  while (elements.activityList.children.length > 6) {
    elements.activityList.lastElementChild.remove();
  }
}

function addMessage(role, text, persist = true) {
  const fragment = elements.messageTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".message");
  const avatar = fragment.querySelector(".message-avatar");
  const name = fragment.querySelector(".message-name");
  const paragraph = fragment.querySelector("p");
  const actions = fragment.querySelector(".message-actions");

  article.classList.add(role === "user" ? "user-message" : "assistant-message");
  avatar.textContent = role === "user" ? "Y" : "A";
  name.textContent = role === "user" ? "YOU" : "AURA";
  paragraph.textContent = text;
  
  if (role === "assistant") {
    actions.style.display = "flex";
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    article.dataset.messageId = msgId;
    article.dataset.messageText = text;
    
    actions.querySelectorAll(".feedback-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleFeedback(msgId, text, btn.dataset.rating, btn.classList.contains("feedback-correct"));
      });
    });
  }
  
  elements.conversation.appendChild(fragment);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  if (persist) {
    state.history.push({ role, content: text });
    state.history = state.history.slice(-20);
    saveState();
  }
}

async function handleFeedback(messageId, responseText, rating, isCorrection) {
  if (isCorrection) {
    const correction = prompt("What should AURA have said instead?");
    if (!correction) return;
    
    try {
      await fetch("/api/learning/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: getLastUserInput(),
          expectedOutput: correction,
          actualOutput: responseText,
          rating: parseInt(rating),
          tags: ["correction"]
        })
      });
      addActivity("Learning: Correction submitted");
    } catch (e) {
      console.error("Feedback error:", e);
    }
    return;
  }
  
  try {
    await fetch("/api/learning/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: getLastUserInput(),
        actualOutput: responseText,
        rating: parseInt(rating),
        tags: rating >= 4 ? ["positive"] : ["negative"]
      })
    });
    addActivity(`Learning: Feedback recorded (${rating}/5)`);
  } catch (e) {
    console.error("Feedback error:", e);
  }
}

function getLastUserInput() {
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].role === "user") {
      return state.history[i].content;
    }
  }
  return "";
}

function setOrbState(mode, label) {
  elements.orbWrap.classList.remove("listening", "thinking", "wake-listening");
  if (mode) elements.orbWrap.classList.add(mode);
  elements.orbState.textContent = label;
}

function updateHandsFreeControl() {
  if (!elements.handsFreeToggle) return;
  elements.handsFreeToggle.setAttribute("aria-checked", String(state.wakeEnabled));
  elements.handsFreeToggle.querySelector("strong").textContent = state.wakeEnabled ? "ON" : "OFF";
}

function setHandsFreeEnabled(enabled, startImmediately = false) {
  state.wakeEnabled = enabled;
  state.pendingVoiceCommand = "";
  state.voiceMode = "wake";
  clearTimeout(state.wakeRestartTimer);
  clearTimeout(state.commandTimer);
  updateHandsFreeControl();
  saveState();

  if (!enabled) {
    if (state.recognitionActive) state.recognition.abort();
    elements.voiceButton.classList.remove("armed", "active");
    elements.voiceSupport.textContent = "HANDS-FREE OFF";
    elements.assistantStatus.textContent = "Hands-free listening is off. Tap the microphone to speak.";
    setOrbState("", "TAP TO SPEAK");
    return;
  }

  elements.voiceSupport.textContent = "ARMING";
  elements.assistantStatus.textContent = "Hands-free listening is armed. Say “Aura” whenever you need me.";
  setOrbState("", "SAY “AURA”");

  if (startImmediately && state.recognition && !state.recognitionActive) {
    try {
      state.recognition.start();
      return;
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.warn("Unable to arm hands-free mode:", error);
      }
    }
  }

  scheduleWakeRestart(50);
}

function scheduleWakeRestart(delay = 100) {
  clearTimeout(state.wakeRestartTimer);
  if (
    !state.wakeEnabled ||
    !state.recognition ||
    state.recognitionActive ||
    state.busy ||
    state.pauseWakeForSpeech ||
    document.hidden
  ) {
    return;
  }

  state.wakeRestartTimer = setTimeout(() => {
    if (
      !state.wakeEnabled ||
      state.recognitionActive ||
      state.busy ||
      state.pauseWakeForSpeech ||
      document.hidden
    ) {
      return;
    }

    state.voiceMode = "wake";
    try {
      state.recognition.start();
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        console.warn("Unable to arm wake word:", error);
      }
    }
  }, delay);
}

function getSpeechLanguage() {
  return state.language === "auto" ? navigator.language || "en-US" : state.language;
}

function extractWakeCommand(transcript) {
  const baseLanguage = getSpeechLanguage().toLowerCase().split("-")[0];
  const wakeWords = [...WAKE_WORDS.default, ...(WAKE_WORDS[baseLanguage] || [])];
  const normalizedTranscript = transcript.toLocaleLowerCase().trim();

  for (const wakeWord of wakeWords) {
    const wakeLower = wakeWord.toLocaleLowerCase();
    const index = normalizedTranscript.indexOf(wakeLower);
    if (index === -1) continue;

    const afterWake = transcript.slice(index + wakeWord.length);
    const cleaned = afterWake.replace(/^[\s,.:;!?—-]+/, "").trim();

    return cleaned || "";
  }

  return null;
}

function speak(text) {
  if (state.muted || !("speechSynthesis" in window)) {
    scheduleWakeRestart();
    return;
  }

  waitForVoices().then(() => {
    state.speechCycle += 1;
    const speechCycle = state.speechCycle;
    state.pauseWakeForSpeech = true;
    clearTimeout(state.speechTimer);
    window.speechSynthesis.cancel();
    if (state.recognitionActive) state.recognition.abort();

    const spokenText = text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`#]/g, "")
      .trim();

    if (!spokenText) {
      state.pauseWakeForSpeech = false;
      scheduleWakeRestart();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voices = window.speechSynthesis.getVoices();
    const language = getSpeechLanguage();

    utterance.lang = language;
    utterance.voice = pickAssistantVoice(voices, language);
    utterance.rate = 1.02;
    utterance.pitch = 0.76;
    utterance.volume = 0.82;
    const finishSpeech = () => {
      if (speechCycle !== state.speechCycle) return;
      clearTimeout(state.speechTimer);
      state.pauseWakeForSpeech = false;
      scheduleWakeRestart(350);
    };
    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;
    window.speechSynthesis.speak(utterance);

    const watchdogDelay = Math.min(45_000, Math.max(8_000, spokenText.length * 85));
    state.speechTimer = setTimeout(finishSpeech, watchdogDelay);
  });
}

function waitForVoices() {
  return new Promise((resolve) => {
    if (state.voicesLoaded || window.speechSynthesis.getVoices().length > 0) {
      state.voicesLoaded = true;
      resolve();
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      state.voicesLoaded = true;
      resolve();
    };
    setTimeout(() => {
      state.voicesLoaded = true;
      resolve();
    }, 500);
  });
}

function getNormalizedVoiceLanguage(voice) {
  return voice.lang.toLowerCase().replace("_", "-");
}

function hasMaleVoiceHint(voice) {
  const name = voice.name.toLowerCase();
  if (name.includes("female") || name.includes("woman")) return false;
  return MALE_VOICE_HINTS.some((hint) => name.includes(hint));
}

function pickAssistantVoice(voices, language) {
  const normalizedLanguage = language.toLowerCase().replace("_", "-");
  const baseLanguage = normalizedLanguage.split("-")[0];
  const exactLanguageVoices = voices.filter((voice) => getNormalizedVoiceLanguage(voice) === normalizedLanguage);
  const baseLanguageVoices = voices.filter((voice) => getNormalizedVoiceLanguage(voice).startsWith(`${baseLanguage}-`));
  const englishVoices = voices.filter((voice) => /en/i.test(voice.lang));
  const voiceGroups = [exactLanguageVoices, baseLanguageVoices, englishVoices, voices];

  for (const group of voiceGroups) {
    const maleVoice = group.find(hasMaleVoiceHint);
    if (maleVoice) return maleVoice;
  }

  return exactLanguageVoices[0] || baseLanguageVoices[0] || englishVoices[0] || null;
}

function playWakeTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(990, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
    oscillator.onended = () => context.close();
  } catch {
    // The visual wake acknowledgement still works if browser audio is blocked.
  }
}

function formatMemoryList() {
  if (!state.memories.length) {
    return "I have not stored any personal notes yet. Say “remember that…” to add one.";
  }

  return `I remember ${state.memories.length} item${state.memories.length === 1 ? "" : "s"}:\n${state.memories
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n")}`;
}

function isNewsCommand(input) {
  const normalized = input.trim().toLowerCase();

  return (
    normalized === "news" ||
    normalized === "headlines" ||
    normalized === "/news" ||
    normalized === "/world-news" ||
    normalized === "/headlines" ||
    /\b(worldwide|world|global|international)\s+(news|headlines|briefing)\b/.test(normalized) ||
    /\b(news|headlines)\s+(briefing|update|summary)\b/.test(normalized) ||
    /\b(news|headlines|briefing)\s+(about|on|for)\s+/.test(normalized) ||
    /\b(latest|current|today'?s)\s+(news|headlines)\b/.test(normalized) ||
    /\b(latest|current|today'?s)\s+.+?\s+(news|headlines)\b/.test(normalized)
  );
}

function getNewsQuery(input) {
  const topicMatch =
    input.match(/(?:news|headlines|briefing)\s+(?:about|on|for)\s+(.+)$/i) ||
    input.match(/(?:latest|current|today'?s)\s+(.+?)\s+(?:news|headlines)$/i);

  if (!topicMatch) return "";
  return topicMatch[1].trim().replace(/[.!?]$/, "");
}

async function requestNewsBrief(input) {
  const topic = getNewsQuery(input);
  const params = new URLSearchParams({ pageSize: "5" });
  if (topic) params.set("q", topic);

  const response = await fetch(`/api/news?${params.toString()}`);
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const setupHint = data.offline ? " Add NEWS_API_KEY to .env and restart the server." : "";
    throw new Error(`${data.error || "News request failed."}${setupHint}`);
  }

  if (!Array.isArray(data.articles) || !data.articles.length) {
    return `I could not find recent headlines for ${topic || "the worldwide news feed"}.`;
  }

  const defaultWorldQuery = "world or global or international";
  const isDefaultWorldQuery = !topic && String(data.query || "").toLowerCase() === defaultWorldQuery;
  const scope = isDefaultWorldQuery ? "worldwide headlines" : `headlines for ${topic || data.query}`;
  const lines = data.articles.map((article, index) => {
    const source = article.source ? ` (${article.source})` : "";
    const published = article.publishedAt ? new Date(article.publishedAt) : null;
    const stamp = published && !Number.isNaN(published.getTime())
      ? published.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
    const description = article.description ? ` ${article.description}` : "";

    return `${index + 1}. ${article.title}${source}${stamp ? `, ${stamp}` : ""}.${description}`;
  });

  return `Here are the latest ${scope}:\n${lines.join("\n")}`;
}

async function fetchWeather(city) {
  const response = await fetch(`/api/weather?q=${encodeURIComponent(city)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Weather request failed.");
  return data;
}

function updateWeatherDisplay(data) {
  if (!data) {
    elements.weatherTemp.textContent = "--°";
    elements.weatherCondition.textContent = "--";
    elements.weatherFeels.textContent = "--°";
    elements.weatherHumidity.textContent = "--%";
    elements.weatherWind.textContent = "--";
    elements.weatherLocation.textContent = "--";
    return;
  }
  elements.weatherTemp.textContent = Math.round(data.temperature) + "°";
  elements.weatherCondition.textContent = data.condition;
  elements.weatherFeels.textContent = Math.round(data.feelsLike) + "°";
  elements.weatherHumidity.textContent = data.humidity + "%";
  elements.weatherWind.textContent = data.windSpeed ? Math.round(data.windSpeed) + " km/h" : "--";
  const location = data.city + (data.country ? ", " + data.country : "");
  elements.weatherLocation.textContent = location;
  elements.weatherLocation.title = location;
}

async function handleWeatherCommand(input) {
  const patterns = [
    /\/weather\s+(.+)/i,
    /weather\s+(?:in|for|at)\s+(.+)/i,
    /what'?s?\s+the\s+weather\s+(?:in|for|at)\s+(.+)/i,
    /how'?s?\s+the\s+weather\s+(?:in|for|at)\s+(.+)/i,
    /tell\s+me\s+the\s+weather\s+(?:in|for|at)\s+(.+)/i,
  ];
  let city = state.weatherCity;
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      city = match[1].trim();
      break;
    }
  }
  if (!city) return 'Tell me which city to check. Try "weather in London".';
  try {
    const data = await fetchWeather(city);
    state.weatherCity = data.city;
    saveState();
    updateWeatherDisplay(data);
    return `It is ${Math.round(data.temperature)}° and ${data.condition.toLowerCase()} in ${data.city}${data.country ? ", " + data.country : ""}. Feels like ${Math.round(data.feelsLike)}°. Humidity ${data.humidity}%. Wind ${data.windSpeed ? Math.round(data.windSpeed) + " km/h" : "calm"}.`;
  } catch (error) {
    return error.message;
  }
}

function formatTimerTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return m + ":" + s;
}

function updateTimerDisplay() {
  const timer = state.timer;
  const total = timer.phase === "work" ? state.timerSettings.work * 60 : state.timerSettings.break * 60;
  elements.timerTime.textContent = formatTimerTime(timer.seconds);
  elements.timerPhase.textContent = timer.phase.toUpperCase();
  elements.timerToggle.textContent = timer.running ? "PAUSE" : "START";
  if (elements.timerWork && document.activeElement !== elements.timerWork) {
    elements.timerWork.value = state.timerSettings.work;
  }
  if (elements.timerBreak && document.activeElement !== elements.timerBreak) {
    elements.timerBreak.value = state.timerSettings.break;
  }
  if (total > 0) {
    elements.timerProgress.style.width = ((total - timer.seconds) / total * 100) + "%";
  }
}

function timerTick() {
  const timer = state.timer;
  if (!timer.running) return;
  timer.seconds -= 1;
  if (timer.seconds <= 0) {
    timer.seconds = 0;
    timer.running = false;
    clearInterval(timer.interval);
    timer.interval = null;
    const phase = timer.phase;
    timer.phase = phase === "work" ? "break" : "work";
    timer.seconds = state.timerSettings[timer.phase] * 60;
    updateTimerDisplay();
    addActivity(phase === "work" ? "Work session complete. Break time." : "Break over. Ready to focus.");
    speak(phase === "work" ? "Work session complete. Take a break." : "Break is over. Ready to focus again.");
    return;
  }
  updateTimerDisplay();
}

function toggleTimer() {
  const timer = state.timer;
  if (timer.running) {
    timer.running = false;
    clearInterval(timer.interval);
    timer.interval = null;
  } else {
    if (timer.seconds <= 0) {
      timer.seconds = state.timerSettings[timer.phase] * 60;
    }
    timer.running = true;
    timer.interval = setInterval(timerTick, 1000);
  }
  updateTimerDisplay();
}

function resetTimer() {
  const timer = state.timer;
  timer.running = false;
  clearInterval(timer.interval);
  timer.interval = null;
  timer.phase = "work";
  timer.seconds = state.timerSettings.work * 60;
  updateTimerDisplay();
}

function formatTimerStatus() {
  const status = state.timer.running ? "running" : "paused";
  const phase = state.timer.phase === "break" ? "break" : "work";
  return `Focus timer ${status}. Phase: ${phase}. Remaining: ${formatTimerTime(state.timer.seconds)}. Work/break cycle: ${state.timerSettings.work}/${state.timerSettings.break} minutes.`;
}

function setTimerSettings(workMinutes, breakMinutes = state.timerSettings.break) {
  const work = Number.parseInt(workMinutes, 10);
  const rest = Number.parseInt(breakMinutes, 10);
  if (!Number.isInteger(work) || work < 1 || work > 120) return "Work sessions must be between 1 and 120 minutes.";
  if (!Number.isInteger(rest) || rest < 1 || rest > 30) return "Break sessions must be between 1 and 30 minutes.";

  state.timerSettings = { work, break: rest };
  if (!state.timer.running) {
    state.timer.seconds = state.timerSettings[state.timer.phase] * 60;
  }
  saveState();
  updateTimerDisplay();
  return `Focus cycle set to ${work}/${rest} minutes.`;
}

function handleTimerCommand(input) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "/timer" || normalized === "/timer status") return formatTimerStatus();
  const cycleMatch = input.match(/^\/timer\s+(?:set\s+)?(\d{1,3})\s*(?:\/|\s+)\s*(\d{1,2})$/i);
  if (cycleMatch) return setTimerSettings(cycleMatch[1], cycleMatch[2]);
  const workMatch = input.match(/^\/timer\s+work\s+(\d{1,3})$/i);
  if (workMatch) return setTimerSettings(workMatch[1], state.timerSettings.break);
  const breakMatch = input.match(/^\/timer\s+break\s+(\d{1,2})$/i);
  if (breakMatch) return setTimerSettings(state.timerSettings.work, breakMatch[1]);
  if (normalized === "/timer start" || normalized === "/timer resume") {
    toggleTimer();
    return formatTimerStatus();
  }
  if (normalized === "/timer pause" || normalized === "/timer stop") {
    if (state.timer.running) toggleTimer();
    return formatTimerStatus();
  }
  if (normalized === "/timer reset") {
    resetTimer();
    return "Focus timer reset.";
  }
  return "Timer commands: /timer, /timer start, /timer pause, /timer reset, /timer 45/10, /timer work 50, /timer break 10";
}

function handleForgetCommand(input) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "/forget" || /\b(forget|delete|remove)\s+(all\s+)?(memory|memories)\b/.test(normalized)) {
    state.memories = [];
    saveState();
    updateMemoryCount();
    renderMemoryList();
    return "All memories cleared.";
  }

  const match = input.match(/(?:\/forget\s+|forget\s+|delete\s+memory\s+|remove\s+memory\s+)(.+)/i);
  if (match) {
    const target = match[1].trim().toLowerCase();
    const index = state.memories.findIndex((m) => m.toLowerCase().includes(target));
    if (index === -1) return "I could not find a memory matching \"" + target + "\".";
    const removed = state.memories[index];
    state.memories.splice(index, 1);
    saveState();
    updateMemoryCount();
    renderMemoryList();
    return "Forgot: " + removed.slice(0, 60);
  }

  return 'Tell me what to forget. Try "/forget all memories" or "/forget meeting at 3pm".';
}

function formatDailyBrief() {
  const now = new Date();
  const openTasks = getOpenTasks();
  const reminders = getActiveReminders();
  const lines = [
    `Local brief - ${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}, ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    `Mode: ${state.liveAI ? "live AI with local command override" : "local core"}. Voice: ${state.muted ? "muted" : "enabled"}. Wake word: ${state.wakeEnabled ? "armed" : "offline"}.`,
  ];

  if (openTasks.length) {
    lines.push(`Tasks: ${openTasks.length} open. Next: ${openTasks.slice(0, 3).map((task, index) => `${index + 1}. ${task.text}`).join("; ")}.`);
  } else {
    lines.push("Tasks: clear.");
  }

  if (reminders.length) {
    lines.push(`Reminders: ${reminders.length} active. Next: ${reminders.slice(0, 3).map((reminder) => `${reminder.text} ${formatRelativeTime(reminder.dueAt)}`).join("; ")}.`);
  } else {
    lines.push("Reminders: none active.");
  }

  lines.push(`Timer: ${state.timer.phase} phase, ${formatTimerTime(state.timer.seconds)} remaining, ${state.timer.running ? "running" : "paused"}. Cycle ${state.timerSettings.work}/${state.timerSettings.break} minutes.`);

  if (state.memories.length) {
    lines.push(`Memory: ${state.memories.length} stored item${state.memories.length === 1 ? "" : "s"}. Latest: ${state.memories.slice(-2).join("; ")}.`);
  } else {
    lines.push("Memory: no stored notes yet.");
  }

  if (state.weatherCity) {
    lines.push(`Weather: pinned to ${state.weatherCity}. Ask "weather" to refresh conditions.`);
  }

  return lines.join("\n");
}

function parseLocalSearch(input) {
  const match = input.match(/^(?:\/(?:find|search)\s+|(?:find|search)\s+(?:local\s+)?(?:for\s+)?|search\s+local\s+for\s+)(.+)$/i);
  if (!match) return null;
  return cleanText(match[1], 100).replace(/^(?:memories?|tasks?|todos?|reminders?|history)\s+/i, "").trim() || null;
}

function formatLocalSearch(query) {
  const needle = cleanText(query, 100).toLowerCase();
  if (!needle) return "Tell me what to search for. Try /find meeting.";

  const matchesText = (text) => String(text || "").toLowerCase().includes(needle);
  const sections = [];
  const appendSection = (title, lines) => {
    if (lines.length) sections.push(`${title}:\n${lines.join("\n")}`);
  };

  appendSection(
    "Memories",
    state.memories
      .filter(matchesText)
      .slice(0, 5)
      .map((memory, index) => `${index + 1}. ${memory}`),
  );

  appendSection(
    "Tasks",
    state.tasks
      .filter((task) => matchesText(task.text))
      .slice(-8)
      .reverse()
      .slice(0, 5)
      .map((task, index) => `${index + 1}. ${task.done ? "done" : "open"}: ${task.text}`),
  );

  appendSection(
    "Reminders",
    state.reminders
      .filter((reminder) => matchesText(reminder.text))
      .slice(-8)
      .reverse()
      .slice(0, 5)
      .map((reminder, index) => `${index + 1}. ${reminder.done ? "done" : formatRelativeTime(reminder.dueAt)}: ${reminder.text}`),
  );

  appendSection(
    "Recent conversation",
    state.history
      .filter((message) => matchesText(message.content))
      .slice(-5)
      .reverse()
      .map((message, index) => `${index + 1}. ${message.role}: ${cleanText(message.content, 120)}`),
  );

  if (!sections.length) {
    return `No local matches for "${query}". Search covers memories, tasks, reminders, and recent conversation.`;
  }

  return `Local search for "${query}":\n${sections.join("\n")}`;
}

function toTitleCase(text) {
  return cleanText(text, 500)
    .toLowerCase()
    .replace(/\b[a-z0-9][a-z0-9'-]*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function makeSlug(text) {
  const slug = cleanText(text, 500)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "untitled";
}

function handleTextToolCommand(input) {
  let match = input.match(/^(?:\/slug|slugify)\s+(.+)$/i);
  if (match) return `Slug: ${makeSlug(match[1])}`;

  match = input.match(/^(?:\/titlecase|title case)\s+(.+)$/i);
  if (match) return `Title case: ${toTitleCase(match[1])}`;

  match = input.match(/^(?:\/uppercase|uppercase)\s+(.+)$/i);
  if (match) return `Uppercase: ${cleanText(match[1], 500).toUpperCase()}`;

  match = input.match(/^(?:\/lowercase|lowercase)\s+(.+)$/i);
  if (match) return `Lowercase: ${cleanText(match[1], 500).toLowerCase()}`;

  match = input.match(/^(?:\/wordcount|word count|count words)\s+(.+)$/i);
  if (match) {
    const text = cleanText(match[1], 1000);
    const words = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || [];
    const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
    const minutes = words.length ? Math.max(1, Math.ceil(words.length / 200)) : 0;
    return `${words.length} word${words.length === 1 ? "" : "s"}, ${text.length} character${text.length === 1 ? "" : "s"}, ${sentences} sentence${sentences === 1 ? "" : "s"}. Estimated reading time: ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }

  return null;
}

const UNIT_DEFINITIONS = {
  mm: { kind: "length", factor: 0.001, label: "mm", aliases: ["mm", "millimeter", "millimeters"] },
  cm: { kind: "length", factor: 0.01, label: "cm", aliases: ["cm", "centimeter", "centimeters"] },
  m: { kind: "length", factor: 1, label: "m", aliases: ["m", "meter", "meters", "metre", "metres"] },
  km: { kind: "length", factor: 1000, label: "km", aliases: ["km", "kilometer", "kilometers", "kilometre", "kilometres"] },
  in: { kind: "length", factor: 0.0254, label: "in", aliases: ["in", "inch", "inches"] },
  ft: { kind: "length", factor: 0.3048, label: "ft", aliases: ["ft", "foot", "feet"] },
  yd: { kind: "length", factor: 0.9144, label: "yd", aliases: ["yd", "yard", "yards"] },
  mi: { kind: "length", factor: 1609.344, label: "mi", aliases: ["mi", "mile", "miles"] },
  mg: { kind: "mass", factor: 0.000001, label: "mg", aliases: ["mg", "milligram", "milligrams"] },
  g: { kind: "mass", factor: 0.001, label: "g", aliases: ["g", "gram", "grams"] },
  kg: { kind: "mass", factor: 1, label: "kg", aliases: ["kg", "kilogram", "kilograms"] },
  oz: { kind: "mass", factor: 0.028349523125, label: "oz", aliases: ["oz", "ounce", "ounces"] },
  lb: { kind: "mass", factor: 0.45359237, label: "lb", aliases: ["lb", "lbs", "pound", "pounds"] },
  ml: { kind: "volume", factor: 0.001, label: "ml", aliases: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"] },
  l: { kind: "volume", factor: 1, label: "l", aliases: ["l", "liter", "liters", "litre", "litres"] },
  tsp: { kind: "volume", factor: 0.00492892159375, label: "tsp", aliases: ["tsp", "teaspoon", "teaspoons"] },
  tbsp: { kind: "volume", factor: 0.01478676478125, label: "tbsp", aliases: ["tbsp", "tablespoon", "tablespoons"] },
  cup: { kind: "volume", factor: 0.2365882365, label: "cup", aliases: ["cup", "cups"] },
  pt: { kind: "volume", factor: 0.473176473, label: "pt", aliases: ["pt", "pint", "pints"] },
  qt: { kind: "volume", factor: 0.946352946, label: "qt", aliases: ["qt", "quart", "quarts"] },
  gal: { kind: "volume", factor: 3.785411784, label: "gal", aliases: ["gal", "gallon", "gallons"] },
  c: { kind: "temperature", label: "C", aliases: ["c", "celsius", "centigrade"] },
  f: { kind: "temperature", label: "F", aliases: ["f", "fahrenheit"] },
  k: { kind: "temperature", label: "K", aliases: ["k", "kelvin"] },
};

const UNIT_ALIASES = Object.entries(UNIT_DEFINITIONS).reduce((aliases, [key, definition]) => {
  definition.aliases.forEach((alias) => {
    aliases[alias] = key;
  });
  return aliases;
}, {});

function normalizeUnitName(value) {
  const normalized = cleanText(value, 40).toLowerCase().replace(/°/g, "").replace(/\./g, "");
  return UNIT_ALIASES[normalized] || UNIT_ALIASES[normalized.replace(/s$/, "")] || null;
}

function formatLocalNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  const maximumFractionDigits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return value.toLocaleString([], { maximumFractionDigits });
}

function convertTemperature(value, fromKey, toKey) {
  let celsius = value;
  if (fromKey === "f") celsius = (value - 32) * 5 / 9;
  if (fromKey === "k") celsius = value - 273.15;
  if (toKey === "f") return celsius * 9 / 5 + 32;
  if (toKey === "k") return celsius + 273.15;
  return celsius;
}

function handleConversionCommand(input) {
  const match = input.match(/^(?:\/convert|convert)\s+(-?\d+(?:\.\d+)?)\s*([a-zA-Z°]+)\s+(?:to|in)\s+([a-zA-Z°]+)$/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  const fromKey = normalizeUnitName(match[2]);
  const toKey = normalizeUnitName(match[3]);
  if (!fromKey || !toKey) return "I do not know one of those units yet. Try km, miles, kg, lb, liters, gallons, C, or F.";

  const from = UNIT_DEFINITIONS[fromKey];
  const to = UNIT_DEFINITIONS[toKey];
  if (from.kind !== to.kind) return `Cannot convert ${from.label} to ${to.label}; they measure different things.`;

  const converted = from.kind === "temperature"
    ? convertTemperature(value, fromKey, toKey)
    : value * from.factor / to.factor;

  return `${formatLocalNumber(value)} ${from.label} = ${formatLocalNumber(converted)} ${to.label}.`;
}

function randomIndex(max) {
  if (!Number.isInteger(max) || max <= 0) return 0;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function handleRandomCommand(input) {
  const normalized = input.trim().toLowerCase();
  if (normalized === "/coin" || normalized === "coin flip" || normalized === "flip a coin") {
    return `Coin flip: ${randomIndex(2) === 0 ? "heads" : "tails"}.`;
  }

  const rollMatch = input.match(/^(?:\/roll|roll)(?:\s+(.+))?$/i);
  if (rollMatch) {
    const notation = cleanText(rollMatch[1] || "1d6", 20).toLowerCase();
    const diceMatch = notation.match(/^(\d{1,2})?d(\d{1,4})$/i);
    const sidesMatch = notation.match(/^d?(\d{1,4})$/i);
    const dice = diceMatch ? Number.parseInt(diceMatch[1] || "1", 10) : 1;
    const sides = diceMatch ? Number.parseInt(diceMatch[2], 10) : sidesMatch ? Number.parseInt(sidesMatch[1], 10) : 0;
    if (!sides || dice < 1 || dice > 20 || sides < 2 || sides > 1000) {
      return "Use dice notation like /roll, /roll d20, or /roll 2d6. Max 20 dice and 1000 sides.";
    }
    const rolls = Array.from({ length: dice }, () => randomIndex(sides) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    return `Rolled ${dice}d${sides}: ${rolls.join(" + ")} = ${total}.`;
  }

  const chooseMatch = input.match(/^(?:\/choose|choose|pick)(?:\s+(?:from|between))?\s+(.+)$/i);
  if (chooseMatch) {
    const options = chooseMatch[1]
      .split(/\s*(?:,|\bor\b|\|)\s*/i)
      .map((option) => cleanText(option, 80))
      .filter(Boolean);
    if (options.length < 2) return "Give me at least two options separated by commas or 'or'.";
    return `I choose: ${options[randomIndex(options.length)]}.`;
  }

  return null;
}

async function localResponse(input) {
  const normalized = input.trim().toLowerCase();
  const now = new Date();

  if (normalized === "/help" || /\b(capabilities|what can you do|help)\b/.test(normalized)) {
    return "I can wake when you say “Aura”, answer through a connected AI model, fetch headlines, speak responses, remember local notes, track tasks, schedule reminders, export browser-local data, report status, calculate, convert units, search local data, create a daily brief, roll dice, choose between options, transform text, and open websites. Try “/brief”, “/find meeting”, “/convert 10 miles to km”, “/roll 2d6”, or “/slug Launch Plan”.";
  }

  if (normalized === "/status" || /\b(system status|diagnostics|status report)\b/.test(normalized)) {
    const mode = state.liveAI ? "live AI" : "local demo";
    const newsMode = state.liveNews ? "configured" : "not configured";
    return `Diagnostics complete. Neural interface nominal. Response mode: ${mode}. News API: ${newsMode}. Voice recognition: ${state.recognition ? "available" : "unavailable"}. Wake word: ${state.wakeEnabled ? "armed" : "offline"}. Local memory contains ${state.memories.length} item${state.memories.length === 1 ? "" : "s"}. Task queue: ${getOpenTasks().length} open. Reminders: ${getActiveReminders().length} active. No anomalies detected.`;
  }

  if (normalized === "/brief" || normalized === "brief" || /\b(daily brief|local brief|mission brief|brief me)\b/.test(normalized)) {
    return formatDailyBrief();
  }

  const localSearchQuery = parseLocalSearch(input);
  if (localSearchQuery) return formatLocalSearch(localSearchQuery);

  const conversionResponse = handleConversionCommand(input);
  if (conversionResponse) return conversionResponse;

  const textToolResponse = handleTextToolCommand(input);
  if (textToolResponse) return textToolResponse;

  const randomResponse = handleRandomCommand(input);
  if (randomResponse) return randomResponse;

  if (normalized === "/clear") {
    state.history = [];
    saveState();
    elements.conversation.innerHTML = "";
    return "Conversation history cleared.";
  }

  if (normalized === "/mute" || /\b(mute|stop speaking)\b/.test(normalized)) {
    state.muted = true;
    window.speechSynthesis?.cancel();
    saveState();
    return "Voice output muted.";
  }

  if (normalized === "/voice" || /\b(unmute|voice on)\b/.test(normalized)) {
    state.muted = false;
    saveState();
    return "Voice output restored.";
  }

  if (normalized === "/sleep" || /\b(go to sleep|disable wake word|stop wake word)\b/.test(normalized)) {
    setHandsFreeEnabled(false);
    return "Wake-word monitoring is offline. Type /wake or tap the microphone to reactivate me.";
  }

  if (normalized === "/wake" || /\b(enable wake word|wake word on)\b/.test(normalized)) {
    setHandsFreeEnabled(true);
    return "Wake-word monitoring is armed. Say “Aura” whenever you need me.";
  }

  if (normalized === "/face-id on" || /\b(enable face id|turn on face id|face auth on)\b/.test(normalized)) {
    if (!state.faceAuthEnabled) await toggleFaceAuth();
    return "Face authentication enabled. Look at the camera to unlock.";
  }

  if (normalized === "/face-id off" || /\b(disable face id|turn off face id|face auth off)\b/.test(normalized)) {
    if (state.faceAuthEnabled) await toggleFaceAuth();
    return "Face authentication disabled. Passcode only mode active.";
  }

  if (normalized === "/face-id enroll" || /\b(enroll face|register face|add face)\b/.test(normalized)) {
    if (!state.faceAuthEnabled) {
      await toggleFaceAuth();
      return "Face authentication enabled. Click Enroll Face on the lock screen to begin.";
    }
    if (state.faceDescriptors.length >= FACE_AUTH_CONFIG.maxEnrollSamples) {
      return "Maximum face samples reached. Clear face data first to re-enroll.";
    }
    showFaceAuthScreen();
    initFaceAuth().then((initialized) => {
      if (initialized) {
        document.getElementById("face-auth-enroll").hidden = false;
        document.getElementById("face-auth-message").textContent = "Look at the camera to enroll your face.";
      }
    });
    return "Enrollment mode activated. Look at the camera and click Enroll Face.";
  }

  if (normalized === "/face-id clear" || /\b(clear face data|delete face|remove face)\b/.test(normalized)) {
    clearFaceData();
    return "Face data cleared. Face authentication disabled.";
  }

  if (normalized === "/face-id status" || /\b(face id status|face auth status)\b/.test(normalized)) {
    const enabled = state.faceAuthEnabled ? "enabled" : "disabled";
    const samples = getFaceDescriptorCount();
    return `Face authentication: ${enabled}. Enrolled samples: ${samples}/${window.AUTH_CONFIG?.maxEnrollSamples || FACE_AUTH_CONFIG.maxEnrollSamples}.`;
  }

  // Enhanced Auth Commands
  if (normalized === "/pin set" || /\b(set pin|create pin|add pin)\b/.test(normalized)) {
    if (auraAuth && auraAuth.state.pinSet) {
      return "PIN already set. Use /pin change to update it.";
    }
    const pin = prompt("Enter new 4-8 digit PIN:");
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      return "Invalid PIN. Must be 4-8 digits.";
    }
    try {
      await auraAuth.setPin(pin);
      return "PIN set successfully.";
    } catch (e) {
      return `Failed to set PIN: ${e.message}`;
    }
  }

  if (normalized === "/pin change" || /\b(change pin|update pin)\b/.test(normalized)) {
    if (!auraAuth || !auraAuth.state.pinSet) {
      return "No PIN set. Use /pin set first.";
    }
    const currentPin = prompt("Enter current PIN:");
    if (!currentPin) return "Cancelled.";
    try {
      await auraAuth.verifyPin(currentPin);
      const newPin = prompt("Enter new 4-8 digit PIN:");
      if (!newPin || !/^\d{4,8}$/.test(newPin)) {
        return "Invalid PIN. Must be 4-8 digits.";
      }
      await auraAuth.setPin(newPin);
      return "PIN changed successfully.";
    } catch (e) {
      return `Failed to change PIN: ${e.message}`;
    }
  }

  if (normalized === "/pin remove" || /\b(remove pin|delete pin)\b/.test(normalized)) {
    if (!auraAuth || !auraAuth.state.pinSet) {
      return "No PIN set.";
    }
    const pin = prompt("Enter current PIN to confirm removal:");
    if (!pin) return "Cancelled.";
    try {
      await auraAuth.verifyPin(pin);
      auraAuth.clearPin();
      return "PIN removed.";
    } catch (e) {
      return `Failed to remove PIN: ${e.message}`;
    }
  }

  // Fingerprint commands
  if (normalized === "/fingerprint enroll" || /\b(enroll fingerprint|add fingerprint|register fingerprint)\b/.test(normalized)) {
    if (!auraAuth) return "Auth not initialized.";
    if (auraAuth.state.fingerprintEnabled) {
      return "Fingerprint already enrolled. Use /fingerprint remove first.";
    }
    try {
      const result = await auraAuth.enrollFingerprint();
      if (result.success) {
        return "Fingerprint enrolled successfully.";
      }
      return `Failed to enroll fingerprint: ${result.error}`;
    } catch (e) {
      return `Failed to enroll fingerprint: ${e.message}`;
    }
  }

  if (normalized === "/fingerprint remove" || /\b(remove fingerprint|delete fingerprint)\b/.test(normalized)) {
    if (!auraAuth || !auraAuth.state.fingerprintEnabled) {
      return "No fingerprint enrolled.";
    }
    auraAuth.state.fingerprintEnabled = false;
    auraAuth.state.fingerprintCredentialId = null;
    localStorage.removeItem(AUTH_STORAGE_KEYS.fingerprintEnabled);
    localStorage.removeItem(AUTH_STORAGE_KEYS.fingerprintCredentialId);
    auraAuth.saveState();
    return "Fingerprint removed.";
  }

  if (normalized === "/fingerprint status" || /\b(fingerprint status)\b/.test(normalized)) {
    if (!auraAuth) return "Auth not initialized.";
    return `Fingerprint: ${auraAuth.state.fingerprintEnabled ? 'enrolled' : 'not enrolled'}. WebAuthn: ${window.PublicKeyCredential ? 'supported' : 'not supported'}.`;
  }

  // Iris/Eye scanning commands
  if (normalized === "/iris enroll" || /\b(enroll iris|add iris|register iris|enroll eyes|scan eyes)\b/.test(normalized)) {
    if (!auraAuth) return "Auth not initialized.";
    if (auraAuth.state.irisAuthEnabled) {
      return "Iris already enrolled. Use /iris remove first.";
    }
    if (!window.faceapi) return "face-api.js not loaded.";
    
    try {
      const video = document.createElement('video');
      video.style.display = 'none';
      document.body.appendChild(video);
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      video.srcObject = stream;
      await video.play();
      
      const result = await auraAuth.enrollIris(video, (progress) => {
        console.log('Iris enrollment progress:', progress);
      });
      
      stream.getTracks().forEach(t => t.stop());
      video.remove();
      
      if (result.success) {
        return `Iris enrolled successfully with ${result.samples} samples.`;
      }
      return `Failed to enroll iris: ${result.error || 'Unknown error'}`;
    } catch (e) {
      return `Failed to enroll iris: ${e.message}`;
    }
  }

  if (normalized === "/iris remove" || /\b(remove iris|delete iris)\b/.test(normalized)) {
    if (!auraAuth || !auraAuth.state.irisAuthEnabled) {
      return "No iris enrolled.";
    }
    auraAuth.state.irisAuthEnabled = false;
    auraAuth.state.irisDescriptors = [];
    auraAuth.state.enrolledIrisDescriptor = null;
    localStorage.removeItem(AUTH_STORAGE_KEYS.irisAuthEnabled);
    localStorage.removeItem(AUTH_STORAGE_KEYS.irisDescriptors);
    auraAuth.saveState();
    return "Iris removed.";
  }

  if (normalized === "/iris status" || /\b(iris status|eye scanner status)\b/.test(normalized)) {
    if (!auraAuth) return "Auth not initialized.";
    return `Iris scanner: ${auraAuth.state.irisAuthEnabled ? 'enrolled' : 'not enrolled'}. Samples: ${auraAuth.state.irisDescriptors.length}/${window.AUTH_CONFIG?.maxIrisEnrollSamples || 4}.`;
  }

  if (normalized === "/liveness on" || /\b(enable liveness|liveness on)\b/.test(normalized)) {
    if (window.AUTH_CONFIG) {
      window.AUTH_CONFIG.livenessEnabled = true;
      return "Liveness detection enabled.";
    }
    return "Auth config not loaded.";
  }

  if (normalized === "/liveness off" || /\b(disable liveness|liveness off)\b/.test(normalized)) {
    if (window.AUTH_CONFIG) {
      window.AUTH_CONFIG.livenessEnabled = false;
      return "Liveness detection disabled.";
    }
    return "Auth config not loaded.";
  }

  if (normalized === "/autolock on" || /\b(enable autolock|autolock on)\b/.test(normalized)) {
    if (auraAuth) {
      auraAuth.startAutoLockTimer();
      return "Auto-lock enabled (5 min inactivity).";
    }
    return "Auth not initialized.";
  }

  if (normalized === "/autolock off" || /\b(disable autolock|autolock off)\b/.test(normalized)) {
    if (auraAuth) {
      if (auraAuth.autoLockTimer) clearTimeout(auraAuth.autoLockTimer);
      return "Auto-lock disabled.";
    }
    return "Auth not initialized.";
  }

  if (normalized === "/auth status" || /\b(auth status|authentication status)\b/.test(normalized)) {
    if (!auraAuth) return "Enhanced auth not initialized.";
    const s = auraAuth.state;
    return `Authenticated: ${s.authenticated} (${s.authMethod || 'none'}). Face: ${s.faceAuthEnabled ? 'on' : 'off'}. PIN: ${s.pinSet ? 'set' : 'not set'}. Fingerprint: ${s.fingerprintEnabled ? 'enrolled' : 'not enrolled'}. Iris: ${s.irisAuthEnabled ? 'enrolled' : 'not enrolled'}. Liveness: ${window.AUTH_CONFIG?.livenessEnabled ? 'on' : 'off'}. Auto-lock: ${s.continuousProtectionActive ? 'active' : 'inactive'}.`;
  }

  if (normalized === "/lock" || /\b(lock now|lock aura)\b/.test(normalized)) {
    if (auraAuth) {
      auraAuth.lock('Manual lock');
      return "AURA locked.";
    }
    return "Auth not initialized.";
  }

  if (normalized === "/unlock" || /\b(unlock aura)\b/.test(normalized)) {
    if (auraAuth && auraAuth.state.authenticated) {
      return "Already unlocked.";
    }
    // Show face auth screen
    setupFaceAuth();
    return "Authentication screen shown.";
  }

  if (normalized === "/sensitive" || /\b(sensitive actions?|reauth required)\b/.test(normalized)) {
    if (!auraAuth) return "Auth not initialized.";
    const actions = window.AUTH_CONFIG?.sensitiveActions || [];
    return `Actions requiring re-auth: ${actions.join(', ')}`;
  }

  const memoryMatch = input.match(/^(?:\/remember\s+|remember(?: that)?\s+)(.+)$/i);
  if (memoryMatch) {
    const memory = memoryMatch[1].trim();
    if (!state.memories.some((item) => item.toLowerCase() === memory.toLowerCase())) {
      state.memories.push(memory);
      state.memories = state.memories.slice(-20);
      saveState();
      updateMemoryCount();
    }
    return `Understood. I’ll remember that ${memory.replace(/[.!]$/, "")}.`;
  }

  if (normalized === "/recall" || /\b(what do you remember|recall memory|show memories)\b/.test(normalized)) {
    return formatMemoryList();
  }


  const addTaskMatch = input.match(/^(?:\/task\s+|add task\s+|add todo\s+|todo\s+)(.+)$/i);
  if (addTaskMatch) {
    const task = addTask(addTaskMatch[1]);
    return task ? "Task added: " + task.text : "Tell me what task to add.";
  }

  if (normalized === "/tasks" || normalized === "tasks" || normalized === "todo list" || /\b(show|list|open)\s+(tasks|todos)\b/.test(normalized)) {
    return formatTaskList();
  }

  const doneTaskMatch = input.match(/^(?:\/done|done|complete task|finish task|mark task)\s+(.+?)(?:\s+done)?$/i);
  if (doneTaskMatch) {
    const task = completeTask(doneTaskMatch[1]);
    return task ? "Task completed: " + task.text : "I could not find that open task.";
  }

  if (normalized === "/clear-completed") {
    const cleared = clearCompletedTasks();
    return cleared ? "Cleared " + cleared + " completed task" + (cleared === 1 ? "" : "s") + "." : "There are no completed tasks to clear.";
  }

  if (normalized === "/reminders" || normalized === "reminders" || /\b(show|list|upcoming)\s+reminders\b/.test(normalized)) {
    return formatReminderList();
  }

  const dismissReminderMatch = input.match(/^(?:\/dismiss|dismiss reminder|clear reminder)\s+(.+)$/i);
  if (dismissReminderMatch) {
    const reminder = completeReminder(dismissReminderMatch[1]);
    return reminder ? "Reminder dismissed: " + reminder.text : "I could not find that active reminder.";
  }

  if (/^(?:\/remind\s+|remind(?: me)?(?: to)?\s+)/i.test(input)) {
    const parsed = parseReminderRequest(input);
    if (!parsed || !parsed.text) {
      return "Tell me what to remember and when. Try “/remind Stand up in 30 minutes” or “remind me to call Alex tomorrow at 9am”.";
    }
    const reminder = addReminder(parsed.text, parsed.dueAt);
    return "Reminder set for " + formatShortDateTime(reminder.dueAt) + ": " + reminder.text;
  }

  if (normalized === "/export" || /\b(export|download)\s+(local\s+)?(data|backup)\b/.test(normalized)) {
    exportLocalData();
    return "Local AURA data export prepared.";
  }

  if (normalized === "/reset-local") {
    resetLocalData();
    return "Local browser data cleared. Wake-word monitoring and voice output are back to defaults.";
  }

  if (/\b(what time|current time|time is it)\b/.test(normalized)) {
    return `It is ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  }

  if (/\b(what day|what date|today'?s date|date is it)\b/.test(normalized)) {
    return `Today is ${now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })}.`;
  }

  const calculation = input.match(/^(?:calculate|compute|what is)\s+([0-9+\-*/().%\s]+)\??$/i);
  if (calculation) {
    const expression = calculation[1].replace(/%/g, "/100");
    try {
      const value = Function(`"use strict"; return (${expression})`)();
      if (Number.isFinite(value)) return `The result is ${value.toLocaleString()}.`;
    } catch {
      return "I could not evaluate that expression. Use numbers and standard arithmetic operators.";
    }
  }

const openMatch = input.match(/^(?:open|go to|launch)\s+(.+)$/i);
  if (openMatch) {
    const target = openMatch[1].trim();
    const knownSites = {
      github: "https://github.com",
      youtube: "https://youtube.com",
      gmail: "https://mail.google.com",
      calendar: "https://calendar.google.com",
      maps: "https://maps.google.com",
      forge: "http://localhost:4000",
      sentinel: "http://localhost:8000",
    };
    const url = knownSites[target.toLowerCase()] || (/^https?:\/\//i.test(target) ? target : `https://${target}`);

    try {
      const parsed = new URL(url);
      window.open(parsed.href, "_blank", "noopener,noreferrer");
      return `Opening ${parsed.hostname}.`;
    } catch {
      return "That destination does not appear to be a valid web address.";
    }
  }

  if (/\b(forge|open forge|launch forge)\b/.test(normalized)) {
    window.open("http://localhost:4000", "_blank", "noopener,noreferrer");
    addActivity("FORGE dashboard opened");
    return "Opening FORGE AI Engineering Team dashboard at http://localhost:4000";
  }

  if (/\b(sentinel|open sentinel|launch sentinel)\b/.test(normalized)) {
    window.open("http://localhost:8000", "_blank", "noopener,noreferrer");
    addActivity("SENTINEL dashboard opened");
    return "Opening SENTINEL Digital Security AI dashboard at http://localhost:8000";
  }

  if (/\b(services|check services|service status)\b/.test(normalized)) {
    await checkExternalServices();
    return "Service status check initiated. Check the right panel for results.";
  }

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "Hello. I'm online and ready. What would you like to work on?";
  }


  if (/\b(thank you|thanks)\b/.test(normalized)) {
    return "You’re welcome.";
  }

  return "I can handle that more intelligently when a live AI key is connected. In local mode, try /brief, /find meeting, /convert 10 miles to km, /roll 2d6, /tasks, a time check, a calculation, or ask me to remember something.";
}

async function requestLiveResponse() {
  const start = performance.now();
  
  // Check if using local model
  const isLocalModel = LOCAL_MODELS[state.currentModel];
  
  if (isLocalModel && window.localAI) {
    return await requestLocalResponse();
  }
  
  // OpenRouter API
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      messages: state.history.slice(-12),
      model: state.currentModel || "nemotron-3-ultra",
      temperature: 0.7,
      maxTokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Live AI request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.text) {
            fullText += data.text;
            updateLastMessage(fullText);
          }
          if (data.done) {
            usage = data.usage;
          }
          if (data.tool_calls) {
            await handleToolCalls(data.tool_calls);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  const latency = Math.max(1, Math.round(performance.now() - start));
  elements.latency.innerHTML = `${latency}<small>ms</small>`;

  return fullText;
}

async function requestLocalResponse() {
  if (!window.localAI) {
    throw new Error("Local AI engine not loaded");
  }
  
  const modelInfo = LOCAL_MODELS[state.currentModel];
  elements.assistantStatus.textContent = `Loading ${modelInfo.name}...`;
  
  try {
    // Load model if not already loaded
    if (!window.localAI.isModelLoaded(state.currentModel)) {
      elements.assistantStatus.textContent = `Downloading ${modelInfo.name} (${modelInfo.size})...`;
      
      await window.localAI.loadModel(state.currentModel, (progress) => {
        elements.assistantStatus.textContent = `Loading ${modelInfo.name}: ${Math.round(progress * 100)}%`;
      });
    }
    
    elements.assistantStatus.textContent = `Generating with ${modelInfo.name}...`;
    
    // Format messages for local model
    const messages = state.history.slice(-12);
    const prompt = window.localAI.formatMessages(messages);
    
    let fullText = "";
    
    for await (const chunk of window.localAI.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
    })) {
      if (chunk.text) {
        fullText += chunk.text;
        updateLastMessage(fullText);
      }
      if (chunk.done) break;
    }
    
    const latency = Math.max(1, Math.round(performance.now() - start));
    elements.latency.innerHTML = `${latency}<small>ms (local)</small>`;
    elements.assistantStatus.textContent = `Response generated locally`;
    
    return fullText;
  } catch (error) {
    console.error('Local AI error:', error);
    throw new Error(`Local AI failed: ${error.message}`);
  }
}

function updateLastMessage(text) {
  const messages = elements.conversation.querySelectorAll(".message");
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.classList.contains("assistant-message")) {
    const p = lastMessage.querySelector("p");
    if (p) p.textContent = text;
    elements.conversation.scrollTop = elements.conversation.scrollHeight;
  }
}

function isWeatherCommand(input) {
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "/weather" ||
    normalized.startsWith("/weather ") ||
    /\b(what'?s?\s+the\s+weather|weather\s+(in|for|at)|how'?s?\s+the\s+weather)\b/.test(normalized) ||
    /^(?:weather)\s+(?:in|for|at)?\s+/i.test(input)
  );
}

function isTimerCommand(input) {
  const normalized = input.trim().toLowerCase();
  return normalized === "/timer" || normalized.startsWith("/timer ");
}

function isForgetCommand(input) {
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "/forget" ||
    normalized.startsWith("/forget ") ||
    /\b(forget|delete\s+memory|remove\s+memory)\b/i.test(input)
  );
}

function isLocalCoreFeatureCommand(input) {
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "brief" ||
    normalized === "/brief" ||
    /\b(daily brief|local brief|mission brief|brief me)\b/.test(normalized) ||
    /^(?:\/(?:find|search|slug|titlecase|uppercase|lowercase|wordcount|convert|roll|coin|choose)|(?:find|search)\s+(?:local\s+)?(?:for\s+)?|search\s+local\s+for\s+|convert\s+-?\d|roll(?:\s|$)|flip a coin|coin flip|choose\s+|pick\s+(?:from|between)\s+|slugify\s+|title case\s+|uppercase\s+|lowercase\s+|word count\s+|count words\s+)/i.test(input)
  );
}

function shouldUseLocalCommand(input) {
  return (
    isNewsCommand(input) ||
    isWeatherCommand(input) ||
    isTimerCommand(input) ||
    isForgetCommand(input) ||
    isLocalCoreFeatureCommand(input) ||
    input.startsWith("/") ||
    /^(remember|open|go to|launch|calculate|compute|add task|add todo|todo|remind)\b/i.test(input) ||
    /\b(what time|current time|time is it|what day|what date|today'?s date|system status|diagnostics|status report|what do you remember|recall memory|show memories|tasks|todo list|complete task|finish task|mark task|reminders|dismiss reminder|clear reminder|export local data|download backup|mute|unmute|stop speaking|voice on|go to sleep|disable wake word|stop wake word|enable wake word|wake word on)\b/i.test(input)
  );
}



async function handleCommand(rawInput) {
  const input = rawInput.trim();
  if (!input || state.busy) return;

  state.busy = true;
  clearTimeout(state.commandTimer);
  if (state.recognitionActive) state.recognition.abort();
  addMessage("user", input);
  addActivity(`Command received: ${input.slice(0, 32)}${input.length > 32 ? "…" : ""}`);
  elements.commandInput.value = "";
  elements.assistantStatus.textContent = "Processing your directive...";
  setOrbState("thinking", "PROCESSING");

  let responseText;
  const newsCommand = isNewsCommand(input);
  const weatherCommand = isWeatherCommand(input);
  const timerCommand = isTimerCommand(input);
  const forgetCommand = isForgetCommand(input);
  const isLocalModel = LOCAL_MODELS[state.currentModel];
  const isLiveAI = !shouldUseLocalCommand(input) && state.liveAI && !isLocalModel;
  const useLocalAI = isLocalModel && window.localAI;
  const start = performance.now();

  try {
    if (newsCommand) {
      responseText = await requestNewsBrief(input);
      state.liveNews = true;
    } else if (weatherCommand) {
      responseText = await handleWeatherCommand(input);
    } else if (timerCommand) {
      responseText = handleTimerCommand(input);
    } else if (forgetCommand) {
      responseText = handleForgetCommand(input);
    } else if (!isLiveAI && !useLocalAI) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      responseText = await localResponse(input);
    } else {
      responseText = await requestLiveResponse();
      // For streaming, UI already updated via updateLastMessage, just add to history
      if (responseText) {
        state.history.push({ role: "assistant", content: responseText });
        state.history = state.history.slice(-20);
        saveState();
      }
      state.busy = false;
      addActivity("Response synthesized");
      elements.assistantStatus.textContent = responseText.split(/[.!?]/)[0].slice(0, 88) + ".";
      setOrbState("", state.wakeEnabled ? "SAY \u201CAURA\u201D" : "TAP TO SPEAK");
      speak(responseText);
      return;
    }
  } catch (error) {
    console.error(error);
    if (newsCommand) {
      responseText = error instanceof Error ? error.message : "News request failed.";
      state.liveNews = false;
      addActivity("News request failed", true);
    } else {
      responseText = `${error.message} I've switched this request to the local command core.`;
      state.liveAI = false;
      elements.modeLabel.textContent = "LOCAL CORE";
      elements.connectionLabel.textContent = "DEGRADED";
    }
  }

  elements.latency.innerHTML = `${Math.max(1, Math.round(performance.now() - start))}<small>ms</small>`;
  addMessage("assistant", responseText);
  addActivity("Response synthesized");
  elements.assistantStatus.textContent = responseText.split(/[.!?]/)[0].slice(0, 88) + ".";
  setOrbState("", state.wakeEnabled ? "SAY \u201CAURA\u201D" : "TAP TO SPEAK");
  state.busy = false;
  speak(responseText);
}

function enterCommandMode() {
  clearTimeout(state.commandTimer);
  state.voiceMode = "command";
  state.listening = true;
  state.userStoppedRecognition = false;
  elements.voiceButton.classList.remove("armed");
  elements.voiceButton.classList.add("active");
  elements.assistantStatus.textContent = "Yes? I\u2019m listening.";
  elements.voiceSupport.textContent = "VOICE ACTIVE";
  setOrbState("listening", "LISTENING");
  playWakeTone();

  state.commandTimer = setTimeout(() => {
    if (state.voiceMode !== "command" || !state.recognitionActive) return;
    state.voiceMode = "wake";
    state.listening = false;
    elements.voiceButton.classList.remove("active");
    elements.voiceButton.classList.add("armed");
    elements.assistantStatus.textContent = "Wake-word monitoring resumed.";
    elements.voiceSupport.textContent = "WAKE READY";
    setOrbState("wake-listening", "SAY \u201CAURA\u201D");
  }, 5000);
}

function setupLanguageSelector() {
  const supportedValues = Array.from(elements.languageSelect.options, (option) => option.value);

  if (!supportedValues.includes(state.language)) {
    state.language = "auto";
  }

  elements.languageSelect.value = state.language;
  elements.languageSelect.addEventListener("change", () => {
    state.language = elements.languageSelect.value;
    state.pendingVoiceCommand = "";
    state.voiceMode = "wake";
    saveState();

    if (state.recognition) {
      state.recognition.lang = getSpeechLanguage();
      if (state.recognitionActive) {
        state.recognition.abort();
      } else {
        scheduleWakeRestart(250);
      }
    }

    const label = elements.languageSelect.selectedOptions[0]?.textContent || getSpeechLanguage();
    elements.assistantStatus.textContent = `Voice recognition set to ${label}.`;
    addActivity(`Recognition language: ${label}`);
  });
}

function updateModelHero() {
  const activeTitle = document.querySelector("#active-model-title");
  const providerEl = document.querySelector("#model-provider");
  if (!activeTitle) return;

  const current = state.currentModel || "nemotron-3-ultra";
  const label = elements.modelSelect?.selectedOptions[0]?.textContent || current;

  if (current.includes("nemotron")) {
    activeTitle.textContent = label.split(" (")[0] || "Nemotron 3 Ultra";
    if (providerEl) providerEl.textContent = "PROVIDER: NVIDIA";
  } else if (current.includes("gpt")) {
    activeTitle.textContent = label.split(" (")[0] || "GPT-4o";
    if (providerEl) providerEl.textContent = "PROVIDER: OPENAI";
  } else if (current.includes("claude")) {
    activeTitle.textContent = label.split(" (")[0] || "Claude 3.5 Sonnet";
    if (providerEl) providerEl.textContent = "PROVIDER: ANTHROPIC";
  } else if (current.includes("gemini") || current.includes("gemma")) {
    activeTitle.textContent = label.split(" (")[0] || "Gemini 1.5 Pro";
    if (providerEl) providerEl.textContent = "PROVIDER: GOOGLE";
  } else if (typeof LOCAL_MODELS !== "undefined" && LOCAL_MODELS[current]) {
    activeTitle.textContent = label.split(" (")[0] || "Phi-3 Mini";
    if (providerEl) providerEl.textContent = "PROVIDER: LOCAL";
  } else {
    activeTitle.textContent = "AURA Neural Prime";
    if (providerEl) providerEl.textContent = "PROVIDER: LOCAL";
  }
}

function setupModelSelector() {
  if (!elements.modelSelect) return;
  
  fetch("/api/models")
    .then(r => r.json())
    .then(models => {
      elements.modelSelect.innerHTML = "";
      for (const [key, value] of Object.entries(models)) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = `${key} (${value})`;
        elements.modelSelect.appendChild(opt);
      }
      if (state.currentModel) {
        elements.modelSelect.value = state.currentModel;
      }
      updateModelHero();
    })
    .catch(() => {
      updateModelHero();
    });

  elements.modelSelect.addEventListener("change", () => {
    state.currentModel = elements.modelSelect.value;
    saveState();
    updateModelHero();
    addActivity(`Model changed to ${state.currentModel}`);
    elements.assistantStatus.textContent = `AI model: ${state.currentModel}`;
  });

  // Manage Data Panel Toggle
  const manageBtn = document.querySelector("#manage-data-btn");
  const actionsPanel = document.querySelector("#data-actions-panel");
  if (manageBtn && actionsPanel) {
    manageBtn.addEventListener("click", () => {
      const isHidden = actionsPanel.style.display === "none" || actionsPanel.hidden;
      if (isHidden) {
        actionsPanel.hidden = false;
        actionsPanel.style.display = "grid";
        manageBtn.classList.add("active");
        addActivity("Local data management opened");
      } else {
        actionsPanel.hidden = true;
        actionsPanel.style.display = "none";
        manageBtn.classList.remove("active");
      }
      playUiSound("click");
    });
  }
}

async function handleToolCalls(toolCalls) {
  for (const call of toolCalls) {
    const { name, arguments: args } = call.function;
    try {
      const parsed = JSON.parse(args);
      let result = null;
      
      switch (name) {
        case "get_weather":
          result = await fetchWeather(parsed.city);
          break;
        case "get_news":
          result = await fetchNews(parsed.query);
          break;
        case "set_timer":
          result = setTimer(parsed.duration, parsed.type);
          break;
        case "add_task":
          result = addTask(parsed.text);
          break;
        case "add_reminder":
          result = addReminder(parsed.text, parsed.dueAt);
          break;
        case "search_memory":
          result = searchMemory(parsed.query);
          break;
        default:
          result = { error: `Unknown function: ${name}` };
      }
      
      // Send function result back
      await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.history.slice(-12),
          model: state.currentModel || "nemotron-3-ultra",
          functionResult: { name, result },
        }),
      });
    } catch (e) {
      console.error("Tool call error:", e);
    }
  }
}

function setupVoiceRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    elements.voiceSupport.textContent = "TEXT ONLY";
    elements.voiceButton.title = "Speech recognition is not supported in this browser.";
    setOrbState("", "TAP TO SPEAK");
    return;
  }

  state.recognition = new Recognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = getSpeechLanguage();
  state.recognition.maxAlternatives = 1;

  // Optimize for lower latency - disable silence detection delays
  // Note: These properties are non-standard but supported by some browsers
  if ('interimResults' in state.recognition) state.recognition.interimResults = true;
  if ('continuous' in state.recognition) state.recognition.continuous = true;

  elements.voiceSupport.textContent = state.wakeEnabled ? "ARMING" : "SLEEPING";

  state.recognition.onstart = () => {
    state.recognitionActive = true;
    if (state.voiceMode === "command") {
      state.listening = true;
      elements.voiceSupport.textContent = "VOICE ACTIVE";
      elements.voiceButton.classList.add("active");
      elements.assistantStatus.textContent = "Listening for your command...";
      setOrbState("listening", "LISTENING");
      return;
    }

    elements.voiceSupport.textContent = "WAKE READY";
    elements.voiceButton.classList.add("armed");
    setOrbState("wake-listening", "SAY “AURA”");
  };

  state.recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0].transcript.trim();

      if (state.voiceMode === "wake") {
        if (!result.isFinal) continue;
        const command = extractWakeCommand(transcript);
        if (command === null) continue;
        addActivity("Wake word detected");

        if (command) {
          playWakeTone();
          state.pendingVoiceCommand = command;
          state.recognition.stop();
        } else {
          enterCommandMode();
        }
        continue;
      }

      elements.commandInput.value = transcript;
      if (result.isFinal && transcript) {
        state.pendingVoiceCommand = transcript;
        state.recognition.stop();
      }
    }
  };

  state.recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.wakeEnabled = false;
      saveState();
      updateHandsFreeControl();
      elements.voiceSupport.textContent = "TAP TO ARM";
      elements.voiceButton.classList.remove("armed", "active");
      elements.assistantStatus.textContent = "Microphone access is required for the Aura wake word.";
      setOrbState("", "TAP TO SPEAK");
      addActivity("Microphone permission required", true);
      return;
    }

    if (!["aborted", "no-speech"].includes(event.error)) {
      addActivity(`Voice input: ${event.error}`, true);
      elements.assistantStatus.textContent = "Voice input was interrupted. Text control remains available.";
    }
  };

state.recognition.onend = () => {
    state.recognitionActive = false;
    state.listening = false;
    elements.voiceButton.classList.remove("active", "armed");
    clearTimeout(state.commandTimer);

    if (state.userStoppedRecognition) {
      state.userStoppedRecognition = false;
      return;
    }

    if (state.pendingVoiceCommand) {
      const command = state.pendingVoiceCommand;
      state.pendingVoiceCommand = "";
      handleCommand(command);
      return;
    }

    if (!state.busy && !state.pauseWakeForSpeech) {
      if (state.wakeEnabled) elements.voiceSupport.textContent = "ARMING";
      setOrbState("", state.wakeEnabled ? "SAY \u201CAURA\u201D" : "TAP TO SPEAK");
      scheduleWakeRestart();
    }
  };

  scheduleWakeRestart(800);
}

function toggleListening() {
  if (!state.recognition) {
    elements.commandInput.focus();
    addActivity("Voice recognition unavailable", true);
    return;
  }

  state.wakeEnabled = true;
  updateHandsFreeControl();
  saveState();

  if (state.recognitionActive && state.voiceMode === "command") {
    state.pendingVoiceCommand = "";
    state.userStoppedRecognition = true;
    state.recognition.stop();
  } else if (state.recognitionActive) {
    enterCommandMode();
  } else {
    state.voiceMode = "command";
    state.userStoppedRecognition = false;
    window.speechSynthesis?.cancel();
    state.pauseWakeForSpeech = false;
    try {
      state.recognition.start();
    } catch (error) {
      if (error.name !== "InvalidStateError") console.error(error);
    }
  }
}

function restoreHistory() {
  state.history.slice(-6).forEach((message) => addMessage(message.role, message.content, false));
}

async function checkServerStatus() {
  const started = performance.now();
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    state.liveAI = Boolean(data.liveAI);
    state.liveNews = Boolean(data.liveNews);
    elements.connectionLabel.textContent = state.liveAI
      ? "LIVE API CONNECTED"
      : state.liveNews
        ? "NEWS API CONNECTED"
        : "API KEY REQUIRED";
    elements.modeLabel.textContent = state.liveAI ? data.model.toUpperCase() : "LOCAL CORE";
    elements.latency.innerHTML = `${Math.max(1, Math.round(performance.now() - started))}<small>ms</small>`;
    addActivity(
      state.liveAI ? "Live AI credential loaded" : "Add API key to .env for live AI",
      !state.liveAI,
    );
    addActivity(
      state.liveNews ? "News API credential loaded" : "Add NEWS_API_KEY to .env for news",
      !state.liveNews,
    );
    
    // Load available models
    if (state.liveAI && data.availableModels) {
      await loadModels(data.availableModels);
    }
  } catch {
    elements.connectionLabel.textContent = "LOCAL SESSION";
    elements.modeLabel.textContent = "OFFLINE CORE";
    addActivity("Server link unavailable", true);
  }
  
  // Check sub-assistant status
  await checkSubAssistantStatus();
}

async function checkSubAssistantStatus() {
  const services = [
    { id: 'forge', name: 'FORGE', url: 'http://localhost:4000/health', endpoint: '/api/proxy/forge' },
    { id: 'sentinel', name: 'SENTINEL', url: 'http://localhost:8000/health', endpoint: '/api/proxy/sentinel' }
  ];
  
  for (const service of services) {
    const statusEl = document.getElementById(`${service.id}-panel-status`);
    if (!statusEl) continue;
    
    statusEl.textContent = 'CHECKING...';
    statusEl.previousElementSibling.className = 'status-dot checking';
    
    try {
      const response = await fetch(service.endpoint, { method: 'GET' });
      if (response.ok) {
        statusEl.textContent = 'Online - Connected';
        statusEl.previousElementSibling.className = 'status-dot online';
      } else {
        statusEl.textContent = 'Offline';
        statusEl.previousElementSibling.className = 'status-dot offline';
      }
    } catch {
      statusEl.textContent = 'Offline';
      statusEl.previousElementSibling.className = 'status-dot offline';
    }
  }
}

function setupSubAssistantTabs() {
  // Tab switching
  document.querySelectorAll('.subassistant-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.subassistant;
      
      // Update tabs
      document.querySelectorAll('.subassistant-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
      // Update panels
      document.querySelectorAll('.subassistant-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
  
  // Panel action buttons
  const panelActions = {
    'panel-aura-new-chat': () => {
      state.history = [];
      saveState();
      document.querySelector('#conversation').innerHTML = '';
      addActivity('New chat started');
    },
    'panel-aura-model': () => {
      const modelSelect = document.getElementById('model-select');
      if (modelSelect) modelSelect.focus();
    },
    'panel-forge-dashboard': () => window.open('http://localhost:4000', '_blank', 'noopener,noreferrer'),
    'panel-forge-new-run': () => window.open('http://localhost:4000/runs/new', '_blank', 'noopener,noreferrer'),
    'panel-forge-projects': () => window.open('http://localhost:4000/projects', '_blank', 'noopener,noreferrer'),
    'panel-sentinel-dashboard': () => window.open('http://localhost:8000', '_blank', 'noopener,noreferrer'),
    'panel-sentinel-scan': () => window.open('http://localhost:8000/scan', '_blank', 'noopener,noreferrer'),
    'panel-sentinel-findings': () => window.open('http://localhost:8000/findings', '_blank', 'noopener,noreferrer'),
  };
  
  Object.entries(panelActions).forEach(([id, action]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        action();
        addActivity(`${id.replace('panel-', '').replace(/-/g, ' ')} triggered`);
      });
    }
  });
}

async function loadModels(availableModels) {
  try {
    const modelSelect = document.getElementById("model-select");
    const modelProvider = document.getElementById("model-provider");
    const modelType = document.getElementById("model-type");
    
    if (!modelSelect) return;
    
    // Fetch detailed model info
    const response = await fetch("/api/models");
    const models = await response.json();
    
    state.availableModels = models;
    
    // Update model info on change
    modelSelect.addEventListener("change", () => {
      const modelKey = modelSelect.value;
      state.currentModel = modelKey;
      saveState();
      
      const modelId = models[modelKey] || '';
      const isLocal = !!LOCAL_MODELS[modelKey];
      const isFree = modelId.includes(':free') || modelId === 'openrouter/free';
      
      if (isLocal) {
        const local = LOCAL_MODELS[modelKey];
        modelProvider.textContent = `Provider: ${local.provider}`;
        modelType.textContent = `LOCAL (${local.size})`;
        modelType.className = 'local-badge';
      } else {
        const provider = modelId.split('/')[0] || 'OpenRouter';
        modelProvider.textContent = `Provider: ${provider}`;
        modelType.textContent = isFree ? 'FREE' : 'PREMIUM';
        modelType.className = isFree ? 'free-badge' : 'premium-badge';
      }
      
      elements.modeLabel.textContent = modelKey.toUpperCase();
      addActivity(`Model switched to ${modelKey}`);
    });
    
    // Set saved model
    if (state.currentModel && modelSelect.querySelector(`option[value="${state.currentModel}"]`)) {
      modelSelect.value = state.currentModel;
      modelSelect.dispatchEvent(new Event('change'));
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}



function setupCognitiveBrainCanvas() {
  const canvas = document.querySelector("#cognitive-brain-canvas");
  if (!canvas || !canvas.parentElement) return;
  const ctx = canvas.getContext("2d");
  let nodes = [];
  let impulses = [];
  let animFrame;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const w = rect.width;
    const h = rect.height;

    nodes = [];
    const count = 46;
    for (let i = 0; i < count; i++) {
      const hemisphere = i % 2 === 0 ? -1 : 1;
      const angle = (Math.random() * Math.PI * 1.8) - 0.9;
      const radiusX = Math.random() * (w * 0.28) + (w * 0.08);
      const radiusY = Math.random() * (h * 0.3) + (h * 0.06);
      
      const x = (w * 0.5) + (hemisphere * (Math.cos(angle) * radiusX + (w * 0.04)));
      const y = (h * 0.44) + (Math.sin(angle) * radiusY);

      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        pulseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.03 + 0.015,
        radius: Math.random() * 2 + 1.4,
        color: Math.random() > 0.25 ? "rgba(46, 230, 197, " : "rgba(232, 199, 107, "
      });
    }
  }

  function draw() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    if (w === 0 || h === 0) {
      animFrame = requestAnimationFrame(draw);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    const time = Date.now() * 0.001;

    // Subtle floating
    nodes.forEach((n) => {
      n.x = n.baseX + Math.sin(time * 1.4 + n.pulseOffset) * 5;
      n.y = n.baseY + Math.cos(time * 1.1 + n.pulseOffset) * 5;
    });

    // Draw neural connections
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < 105) {
          const alpha = (1 - dist / 105) * 0.3;
          ctx.strokeStyle = `rgba(46, 230, 197, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();

          if (Math.random() < 0.004 && impulses.length < 16) {
            impulses.push({
              x1: n1.x,
              y1: n1.y,
              x2: n2.x,
              y2: n2.y,
              progress: 0,
              speed: Math.random() * 0.02 + 0.015,
              color: n1.color
            });
          }
        }
      }
    }

    // Animate data flow impulses
    impulses.forEach((imp) => {
      imp.progress += imp.speed;
      const curX = imp.x1 + (imp.x2 - imp.x1) * imp.progress;
      const curY = imp.y1 + (imp.y2 - imp.y1) * imp.progress;
      ctx.fillStyle = imp.color + "0.95)";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(46, 230, 197, 0.8)";
      ctx.beginPath();
      ctx.arc(curX, curY, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    impulses = impulses.filter((imp) => imp.progress <= 1);

    // Draw nodes with distinct pulsing
    nodes.forEach((n) => {
      const pulse = Math.sin(time * 3 + n.pulseOffset);
      const alpha = 0.45 + pulse * 0.4;
      const r = n.radius + pulse * 0.6;

      ctx.fillStyle = `${n.color}${alpha})`;
      ctx.shadowBlur = 7;
      ctx.shadowColor = n.color + "0.6)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    animFrame = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

function setupNeuralCoreSynapseCanvas() {
  const canvas = document.querySelector("#neural-core-synapse-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = 260;
  const h = 260;
  const cx = 130;
  const cy = 130;

  const coreNodes = [];
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2 + (Math.random() * 0.3);
    const rad = Math.random() * 65 + 35;
    coreNodes.push({
      x: cx + Math.cos(angle) * rad,
      y: cy + Math.sin(angle) * rad,
      baseAngle: angle,
      baseRad: rad,
      pulseOffset: Math.random() * Math.PI * 2,
      size: Math.random() * 1.8 + 1.2,
      color: i % 4 === 0 ? "rgba(232, 199, 107, " : "rgba(46, 230, 197, "
    });
  }

  let packetTracers = [];

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const time = Date.now() * 0.001;

    coreNodes.forEach((n, idx) => {
      const curAngle = n.baseAngle + (time * 0.08 * (idx % 2 === 0 ? 1 : -1));
      const curRad = n.baseRad + Math.sin(time * 2 + n.pulseOffset) * 3.5;
      n.x = cx + Math.cos(curAngle) * curRad;
      n.y = cy + Math.sin(curAngle) * curRad;
    });

    for (let i = 0; i < coreNodes.length; i++) {
      for (let j = i + 1; j < coreNodes.length; j++) {
        const n1 = coreNodes[i];
        const n2 = coreNodes[j];
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < 60) {
          const alpha = (1 - dist / 60) * 0.4;
          ctx.strokeStyle = `rgba(46, 230, 197, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.stroke();

          if (Math.random() < 0.006 && packetTracers.length < 10) {
            packetTracers.push({
              x1: n1.x,
              y1: n1.y,
              x2: n2.x,
              y2: n2.y,
              prog: 0,
              speed: Math.random() * 0.03 + 0.015,
              color: n1.color
            });
          }
        }
      }
    }

    packetTracers.forEach((p) => {
      p.prog += p.speed;
      const px = p.x1 + (p.x2 - p.x1) * p.prog;
      const py = p.y1 + (p.y2 - p.y1) * p.prog;
      ctx.fillStyle = p.color + "1)";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(46, 230, 197, 0.8)";
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    packetTracers = packetTracers.filter((p) => p.prog <= 1);

    coreNodes.forEach((n) => {
      const pulse = Math.sin(time * 3 + n.pulseOffset);
      const alpha = 0.5 + pulse * 0.4;
      ctx.fillStyle = `${n.color}${alpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = n.color + "0.6)";
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size + pulse * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(draw);
  }

  draw();
}

function setupNetworkGraph() {
  const canvas = document.querySelector("#network-graph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let phase = 0;
  let packets = [];

  function resize() {
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) {
      requestAnimationFrame(draw);
      return;
    }
    ctx.clearRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Sine waveform
    phase += 0.04;
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * 0.04 + phase) * 16 * Math.sin(x * 0.008 + phase * 0.4) + (Math.random() - 0.5) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pulse packets
    if (Math.random() < 0.04 && packets.length < 5) {
      packets.push({ x: 0, speed: Math.random() * 2.5 + 2 });
    }
    packets.forEach((p) => {
      p.x += p.speed;
      ctx.fillStyle = "#00ff9d";
      ctx.beginPath();
      ctx.arc(p.x, h / 2 + Math.sin(p.x * 0.04 + phase) * 16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    packets = packets.filter((p) => p.x < w);

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

function setupDiagnosticsLoop() {
  const cpuEl = document.querySelector("#diag-cpu");
  const gpuEl = document.querySelector("#diag-gpu");
  const ramEl = document.querySelector("#diag-ram");
  const diskEl = document.querySelector("#diag-disk");
  const pingEl = document.querySelector("#ping-value");
  const tpEl = document.querySelector("#throughput-value");

  setInterval(() => {
    if (document.hidden) return;
    
    const neuralLoad = Math.floor(82 + Math.random() * 8 + (state.busy ? 10 : 0));
    const neuralEl = document.querySelector("#neural-load-text");
    if (neuralEl) {
      neuralEl.innerHTML = `${neuralLoad}<small>%</small>`;
      const fill = neuralEl.closest(".tech-metric-row")?.querySelector(".tech-progress-bar");
      if (fill) fill.style.width = `${neuralLoad}%`;
    }

    const cpu = Math.floor(18 + Math.random() * 16 + (state.busy ? 42 : 0));
    const gpu = Math.floor(34 + Math.random() * 22 + (state.busy ? 38 : 0));
    const ram = Math.floor(36 + Math.random() * 6);
    const disk = Math.floor(10 + Math.random() * 8);

    if (cpuEl) {
      cpuEl.innerHTML = `${cpu}<span>%</span>`;
      const fill = cpuEl.parentElement?.querySelector(".diag-bar-fill");
      if (fill) fill.style.width = `${cpu}%`;
    }
    if (gpuEl) {
      gpuEl.innerHTML = `${gpu}<span>%</span>`;
      const fill = gpuEl.parentElement?.querySelector(".diag-bar-fill");
      if (fill) fill.style.width = `${gpu}%`;
    }
    if (ramEl) {
      ramEl.innerHTML = `${ram}<span>%</span>`;
      const fill = ramEl.parentElement?.querySelector(".diag-bar-fill");
      if (fill) fill.style.width = `${ram}%`;
    }
    if (diskEl) {
      diskEl.innerHTML = `${disk}<span>%</span>`;
      const fill = diskEl.parentElement?.querySelector(".diag-bar-fill");
      if (fill) fill.style.width = `${disk}%`;
    }

    if (pingEl) {
      const ping = Math.floor(11 + Math.random() * 8);
      pingEl.innerHTML = `${ping}<small>ms</small>`;
    }
    if (tpEl) {
      const tp = (2.1 + Math.random() * 1.8).toFixed(1);
      tpEl.innerHTML = `${tp}<small>Mb/s</small>`;
    }
  }, 2500);
}


function setupCanvas() {
  const neuralCanvas = document.querySelector("#neural-canvas");
  const particleCanvas = document.querySelector("#particle-canvas");
  const radarCanvas = document.querySelector("#radar-sweep");
  const gridCanvas = document.querySelector("#grid-canvas");
  
  const nCtx = neuralCanvas?.getContext("2d");
  const pCtx = particleCanvas?.getContext("2d");
  const rCtx = radarCanvas?.getContext("2d");
  const gCtx = gridCanvas?.getContext("2d");

  let points = [];
  let stellarParticles = [];
  let animationFrame;
  let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    [neuralCanvas, particleCanvas, radarCanvas, gridCanvas].forEach(canv => {
      if (canv) {
        canv.width = w * ratio;
        canv.height = h * ratio;
        canv.style.width = `${w}px`;
        canv.style.height = `${h}px`;
      }
    });

    if (nCtx) nCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (pCtx) pCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (rCtx) rCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (gCtx) gCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const pointCount = Math.min(90, Math.floor(w / 18));
    points = Array.from({ length: pointCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
      color: Math.random() > 0.3 ? "rgba(0, 240, 255, " : "rgba(168, 85, 247, "
    }));

    stellarParticles = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 3 + 0.5,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2
    }));
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const time = Date.now() * 0.001;

    // 1. Draw Starfield Parallax Particles
    if (pCtx) {
      pCtx.clearRect(0, 0, w, h);
      stellarParticles.forEach((p) => {
        p.y -= 0.15 * p.z;
        if (p.y < 0) p.y = h;
        const pX = p.x + (mouse.x - w / 2) * 0.01 * p.z;
        pCtx.fillStyle = `rgba(200, 235, 255, ${p.alpha * (0.6 + Math.sin(time * 2 + p.x) * 0.4)})`;
        pCtx.beginPath();
        pCtx.arc((pX + w) % w, p.y, p.size, 0, Math.PI * 2);
        pCtx.fill();
      });
    }

    // 2. Draw Synaptic Neural Canvas
    if (nCtx) {
      nCtx.clearRect(0, 0, w, h);

      points.forEach((pt, i) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x < 0 || pt.x > w) pt.vx *= -1;
        if (pt.y < 0 || pt.y > h) pt.vy *= -1;

        // Gravitational attraction to mouse
        const dx = mouse.x - pt.x;
        const dy = mouse.y - pt.y;
        const distToMouse = Math.hypot(dx, dy);
        if (distToMouse < 180) {
          pt.x += (dx / distToMouse) * 0.3;
          pt.y += (dy / distToMouse) * 0.3;
        }

        // Draw connections
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const dist = Math.hypot(pt.x - p2.x, pt.y - p2.y);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.25;
            nCtx.strokeStyle = `${pt.color}${alpha})`;
            nCtx.lineWidth = 0.9;
            nCtx.beginPath();
            nCtx.moveTo(pt.x, pt.y);
            nCtx.lineTo(p2.x, p2.y);
            nCtx.stroke();
          }
        }

        // Draw node
        nCtx.fillStyle = `${pt.color}0.85)`;
        nCtx.shadowBlur = 8;
        nCtx.shadowColor = pt.color + "0.6)";
        nCtx.beginPath();
        nCtx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        nCtx.fill();
        nCtx.shadowBlur = 0;
      });
    }

    // 3. Draw Radar Sweep
    if (rCtx) {
      rCtx.clearRect(0, 0, w, h);
      const cx = w * 0.5;
      const cy = h * 0.38;
      const radius = Math.min(w, h) * 0.28;
      const angle = (time * 0.8) % (Math.PI * 2);

      rCtx.save();
      rCtx.translate(cx, cy);

      // Range rings
      rCtx.strokeStyle = "rgba(0, 240, 255, 0.06)";
      rCtx.lineWidth = 1;
      [0.33, 0.66, 1].forEach((r) => {
        rCtx.beginPath();
        rCtx.arc(0, 0, radius * r, 0, Math.PI * 2);
        rCtx.stroke();
      });

      // Sweep gradient sector
      const sweepGrad = rCtx.createConicGradient(angle, 0, 0);
      sweepGrad.addColorStop(0, "rgba(0, 240, 255, 0.12)");
      sweepGrad.addColorStop(0.1, "rgba(0, 240, 255, 0)");
      sweepGrad.addColorStop(1, "rgba(0, 240, 255, 0)");
      rCtx.fillStyle = sweepGrad;
      rCtx.beginPath();
      rCtx.arc(0, 0, radius, 0, Math.PI * 2);
      rCtx.fill();

      // Sweep line
      rCtx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.moveTo(0, 0);
      rCtx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      rCtx.stroke();

      rCtx.restore();
    }

    animationFrame = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(animationFrame);
    else draw();
  });
}


elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  playUiSound("execute");
handleCommand(elements.commandInput.value);
});

elements.voiceButton.addEventListener("click", toggleListening);
elements.coreButton.addEventListener("click", toggleListening);
elements.handsFreeToggle?.addEventListener("click", () => {
  const enabled = !state.wakeEnabled;
  setHandsFreeEnabled(enabled, enabled);
  addActivity(`Hands-free mode ${enabled ? "armed" : "disabled"}`, !enabled);
});


elements.exportData?.addEventListener("click", () => {
  exportLocalData();
  addActivity("Local data exported");
});

elements.importData?.addEventListener("click", () => elements.importFile?.click());

elements.importFile?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    applyImportedData(JSON.parse(await file.text()));
    addMessage("assistant", "Local data import complete.", false);
    addActivity("Local data imported");
  } catch (error) {
    console.error(error);
    addMessage("assistant", error instanceof Error ? error.message : "Import failed.", false);
    addActivity("Local data import failed", true);
  } finally {
    event.target.value = "";
  }
});

elements.clearLocalData?.addEventListener("click", () => {
  if (!window.confirm("Clear AURA history, memories, tasks, reminders, and voice preferences in this browser?")) return;
  resetLocalData();
  addMessage("assistant", "Local browser data cleared.", false);
  addActivity("Local data reset", true);
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => handleCommand(button.dataset.command));
});

document.querySelectorAll(".mode-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-toggle").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const mode = button.dataset.mode;
    document.body.classList.toggle("stealth-mode", mode === "stealth");
    document.body.classList.toggle("cinema-mode", mode === "cinema");

    if (mode === "stealth") {
      state.muted = true;
      window.speechSynthesis?.cancel();
    } else {
      state.muted = false;
    }

    saveState();
    addActivity(`${mode[0].toUpperCase() + mode.slice(1)} mode engaged`);
  });
});

document.querySelector(".hud-security-card")?.addEventListener("click", () => {
  if (state.faceAuthEnabled && state.faceDescriptors.length > 0) {
    toggleFaceAuth();
  } else if (!state.faceAuthEnabled) {
    toggleFaceAuth();
  }
});

document.querySelector(".hud-security-card")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (state.faceAuthEnabled && state.faceDescriptors.length > 0) {
      toggleFaceAuth();
    } else if (!state.faceAuthEnabled) {
      toggleFaceAuth();
    }
  }
});

elements.clearActivity.addEventListener("click", () => {
  elements.activityList.innerHTML = "";
  addActivity("Activity stream cleared", true);
});

elements.weatherSearch?.addEventListener("click", () => {
  const city = elements.weatherCityInput.value.trim();
  if (city) handleCommand("weather in " + city);
});

elements.weatherCityInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const city = elements.weatherCityInput.value.trim();
    if (city) handleCommand("weather in " + city);
  }
});

elements.timerToggle?.addEventListener("click", toggleTimer);
elements.timerReset?.addEventListener("click", resetTimer);

elements.timerWork?.addEventListener("change", () => {
  const val = parseInt(elements.timerWork.value, 10);
  if (val > 0 && val <= 120) {
    state.timerSettings.work = val;
    if (!state.timer.running && state.timer.phase === "work") {
      state.timer.seconds = val * 60;
      updateTimerDisplay();
    }
    saveState();
  }
});

elements.timerBreak?.addEventListener("change", () => {
  const val = parseInt(elements.timerBreak.value, 10);
  if (val > 0 && val <= 30) {
    state.timerSettings.break = val;
    if (!state.timer.running && state.timer.phase === "break") {
      state.timer.seconds = val * 60;
      updateTimerDisplay();
    }
    saveState();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.commandInput.focus();
  }

  if (event.key === "/" && document.activeElement !== elements.commandInput) {
    event.preventDefault();
    elements.commandInput.focus();
  }

  if (event.key === "Escape") {
    state.pendingVoiceCommand = "";
    state.voiceMode = "wake";
    state.recognition?.abort();
    state.speechCycle += 1;
    clearTimeout(state.speechTimer);
    window.speechSynthesis?.cancel();
    state.pauseWakeForSpeech = false;
    setOrbState("", state.wakeEnabled ? "SAY “AURA”" : "TAP TO SPEAK");
    elements.commandInput.blur();
    scheduleWakeRestart();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.recognitionActive) state.recognition.abort();
    return;
  }

  scheduleWakeRestart();
});

async function initLearningUI() {
  const learningList = document.getElementById("learning-list");
  const learningCount = document.getElementById("learning-count");
  const learningPositive = document.getElementById("learning-positive");
  const learningNegative = document.getElementById("learning-negative");
  const learningCorrections = document.getElementById("learning-corrections");
  const learningClear = document.getElementById("learning-clear");
  const learningExport = document.getElementById("learning-export");
  
  if (!learningList) return;
  
  async function refreshLearning() {
    try {
      const response = await fetch("/api/learning/entries");
      const entries = await response.json();
      
      const positive = entries.filter(e => e.rating >= 4 && !e.tags.includes("correction")).length;
      const negative = entries.filter(e => e.rating < 4 && !e.tags.includes("correction")).length;
      const corrections = entries.filter(e => e.tags.includes("correction")).length;
      
      if (learningCount) learningCount.textContent = entries.length;
      if (learningPositive) learningPositive.textContent = positive;
      if (learningNegative) learningNegative.textContent = negative;
      if (learningCorrections) learningCorrections.textContent = corrections;
      
      learningList.innerHTML = "";
      if (!entries.length) {
        learningList.innerHTML = '<div class="learning-empty">No learning data yet. Rate responses to teach AURA.</div>';
        return;
      }
      
      entries.slice(-20).reverse().forEach(entry => {
        const item = document.createElement("div");
        item.className = "learning-item";
        
        let tagClass = "";
        let tagText = "";
        if (entry.tags.includes("correction")) {
          tagClass = "correction";
          tagText = "CORRECTION";
        } else if (entry.rating >= 4) {
          tagClass = "";
          tagText = "POSITIVE";
        } else {
          tagClass = "negative";
          tagText = "NEGATIVE";
        }
        
        item.innerHTML = `
          <span class="learning-tag ${tagClass}">${tagText}</span>
          <span class="learning-preview">${entry.input.slice(0, 50)}${entry.input.length > 50 ? "..." : ""}</span>
          <button class="feedback-btn feedback-negative" data-id="${entry.id}" title="Delete">✗</button>
        `;
        
        item.querySelector(".feedback-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteLearningEntry(entry.id);
        });
        
        learningList.appendChild(item);
      });
    } catch (e) {
      console.error("Failed to load learning data:", e);
    }
  }
  
  async function deleteLearningEntry(id) {
    try {
      await fetch(`/api/learning/entries/${id}`, { method: "DELETE" });
      await refreshLearning();
      addActivity("Learning entry deleted");
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }
  
  if (learningClear) {
    learningClear.addEventListener("click", async () => {
      if (!confirm("Clear all learning data?")) return;
      try {
        const response = await fetch("/api/learning/entries");
        const entries = await response.json();
        for (const entry of entries) {
          await fetch(`/api/learning/entries/${entry.id}`, { method: "DELETE" });
        }
        await refreshLearning();
        addActivity("All learning data cleared");
      } catch (e) {
        console.error("Clear failed:", e);
      }
    });
  }
  
  if (learningExport) {
    learningExport.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/learning/entries");
        const entries = await response.json();
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aura-learning-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addActivity("Learning data exported");
      } catch (e) {
        console.error("Export failed:", e);
      }
    });
  }
  
  await refreshLearning();
}

document.addEventListener("DOMContentLoaded", async () => {
  updateClock();
  setInterval(updateClock, 1000);
  updateMemoryCount();
  updateTaskDisplay();
  updateReminderDisplay();
  checkDueReminders();
  setInterval(() => {
    updateTaskDisplay();
    updateReminderDisplay();
    checkDueReminders();
  }, 30_000);
  updateHandsFreeControl();
  restoreHistory();
  setupLanguageSelector();
  setupVoiceRecognition();
  setupCanvas();
  initLearningUI();
  setupSubAssistantTabs();

  // SFX and Fullscreen Topbar utilities
  const sfxBtn = document.querySelector("#sfx-toggle");
  if (sfxBtn) {
    sfxBtn.classList.toggle("active", sfxState.enabled);
    sfxBtn.addEventListener("click", () => {
      sfxState.enabled = !sfxState.enabled;
      localStorage.setItem("aura.sfx.enabled", JSON.stringify(sfxState.enabled));
      sfxBtn.classList.toggle("active", sfxState.enabled);
      if (sfxState.enabled) playUiSound("click");
      addActivity(`Audio SFX feedback ${sfxState.enabled ? "enabled" : "muted"}`);
    });
  }

  const fsBtn = document.querySelector("#fullscreen-toggle");
  if (fsBtn) {
    fsBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        fsBtn.classList.add("active");
      } else {
        document.exitFullscreen().catch(() => {});
        fsBtn.classList.remove("active");
      }
    });
  }

  // Dock service buttons
  document.querySelectorAll(".dock-service-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        addActivity(`${btn.id.replace("dock-", "").toUpperCase()} opened from dock`);
      }
    });
  });

  // Add click sound effects to all interactive buttons
  document.querySelectorAll("button, .suggestion-chip, .quick-command, .mode-toggle").forEach((btn) => {
    btn.addEventListener("click", () => playUiSound("click"));
    btn.addEventListener("mouseenter", () => playUiSound("hover"));
  });

  setupNetworkGraph();
  setupCognitiveBrainCanvas();
  setupNeuralCoreSynapseCanvas();
  setupDiagnosticsLoop();

  // Populate main AURA command input when clicking quick command
  document.querySelectorAll(".quick-command").forEach((button) => {
    button.addEventListener("click", () => {
      const cmd = button.dataset.command;
      if (elements.commandInput) {
        elements.commandInput.value = cmd;
        elements.commandInput.focus();
        elements.commandInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      playUiSound("click");
    });
  });


  await checkServerStatus();
  setupModelSelector();
  renderMemoryList();
  updateTimerDisplay();
  if (state.weatherCity) {
    fetchWeather(state.weatherCity).then(updateWeatherDisplay).catch(() => {});
  }
  updateSecurityCardStatus();
  await initEnhancedAuth();
  initSkillsPanel();
  // Don't setup face auth on initial load - wait for lock
  // setupFaceAuth();

  // Add lock screen handler for auth-enhanced.js
  window.showLockScreen = (reason) => {
    console.log('[Auth] window.showLockScreen called, reason:', reason);
    handleAuthLock(reason);
  };

  // Add PIN entry command handler
  function addPinEntryHandlers() {
    // Will be triggered by voice command or UI
    window.showPinEntry = async () => {
      const pin = prompt("Enter your PIN:");
      if (!pin) return;
      
      try {
        const result = await auraAuth.authenticate('pin', { pin });
        if (result.success) {
          auraAuth.unlock('pin');
          unlockApp();
          addActivity("PIN authentication successful");
        }
      } catch (e) {
        alert(`PIN error: ${e.message}`);
        addActivity(`PIN auth failed: ${e.message}`, true);
      }
    };
  }

  addPinEntryHandlers();
  initSkillsPanel();
});

async function initSkillsPanel() {
  const skillsList = document.getElementById("skills-list");
  const skillsCount = document.getElementById("skills-count");
  const categoryFilter = document.getElementById("skill-category-filter");
  const refreshBtn = document.getElementById("skills-refresh");
  const installBtn = document.getElementById("skills-install");
  const modalOverlay = document.getElementById("skill-modal-overlay");
  const modalClose = document.getElementById("skill-modal-close");
  const modalCancel = document.getElementById("skill-modal-cancel");
  const modalForm = document.getElementById("skill-modal-form");
  const installMethod = document.getElementById("skill-install-method");
  const templateSection = document.getElementById("skill-template-section");
  const urlSection = document.getElementById("skill-url-section");
  const localSection = document.getElementById("skill-local-section");
  const customSection = document.getElementById("skill-custom-section");
  const templatesGrid = document.getElementById("skill-templates-grid");

  let allSkills = [];
  let selectedTemplate = null;

  async function loadSkills() {
    if (!skillsList) return;
    skillsList.innerHTML = '<div class="skills-loading">Loading skills...</div>';
    
    try {
      const response = await fetch("/api/skills");
      if (!response.ok) throw new Error('Failed to load skills');
      const data = await response.json();
      allSkills = data.skills || [];
      renderSkills(allSkills);
      if (skillsCount) skillsCount.textContent = allSkills.length;
    } catch (error) {
      console.error('Failed to load skills:', error);
      skillsList.innerHTML = '<div class="skills-loading">Failed to load skills. Is the server running?</div>';
    }
  }

  function renderSkills(skills) {
    if (!skillsList) return;
    
    const filter = categoryFilter?.value || 'all';
    const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter);
    
    if (filtered.length === 0) {
      skillsList.innerHTML = '<div class="skills-loading">No skills found</div>';
      return;
    }

    skillsList.innerHTML = filtered.map(skill => `
      <div class="skill-item ${!skill.enabled ? 'disabled' : ''}" data-skill-id="${skill.id}">
        <div class="skill-header">
          <div class="skill-info">
            <div class="skill-icon">
              ${getSkillIcon(skill.category)}
            </div>
            <div class="skill-details">
              <span class="skill-name">${skill.name}</span>
              <div class="skill-meta">
                <span class="skill-version">v${skill.version}</span>
                <span class="skill-category">${skill.category}</span>
              </div>
            </div>
          </div>
          <button class="skill-toggle ${skill.enabled ? 'enabled' : ''}" 
                  data-skill-id="${skill.id}" 
                  aria-label="${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}"
                  aria-pressed="${skill.enabled}"></button>
        </div>
        <div class="skill-description">${skill.description}</div>
        <div class="skill-tags">
          ${skill.tags.map(tag => `<span class="skill-tag">${tag}</span>`).join('')}
        </div>
        <div class="skill-actions">
          <button class="skill-action-btn primary" data-action="configure" data-skill-id="${skill.id}">Configure</button>
          <button class="skill-action-btn" data-action="details" data-skill-id="${skill.id}">Details</button>
          <button class="skill-action-btn" data-action="remove" data-skill-id="${skill.id}">Remove</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    skillsList.querySelectorAll('.skill-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSkill(btn.dataset.skillId, !btn.classList.contains('enabled'));
      });
    });

    skillsList.querySelectorAll('.skill-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleSkillAction(btn.dataset.action, btn.dataset.skillId);
      });
    });
  }

  function getSkillIcon(category) {
    const icons = {
      development: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      productivity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      security: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
      analysis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      utility: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
      ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'
    };
    return icons[category] || icons.custom;
  }

  async function toggleSkill(skillId, enable) {
    try {
      const response = await fetch(`/api/skills/${skillId}/${enable ? 'enable' : 'disable'}`, { method: 'POST' });
      if (response.ok) {
        await loadSkills();
        addActivity(`Skill ${enable ? 'enabled' : 'disabled'}: ${skillId}`);
      } else {
        throw new Error('Failed to toggle skill');
      }
    } catch (error) {
      console.error('Toggle skill failed:', error);
      addActivity(`Failed to toggle skill: ${error.message}`, true);
    }
  }

  function handleSkillAction(action, skillId) {
    const skill = allSkills.find(s => s.id === skillId);
    if (!skill) return;

    switch (action) {
      case 'configure':
        openSkillConfig(skill);
        break;
      case 'details':
        showSkillDetails(skill);
        break;
      case 'remove':
        if (confirm(`Remove skill "${skill.name}"?`)) {
          removeSkill(skillId);
        }
        break;
    }
  }

  async function removeSkill(skillId) {
    try {
      const response = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      if (response.ok) {
        await loadSkills();
        addActivity(`Skill removed: ${skillId}`);
      }
    } catch (error) {
      console.error('Remove skill failed:', error);
      addActivity(`Failed to remove skill: ${error.message}`, true);
    }
  }

  function openSkillConfig(skill) {
    const config = skill.config || {};
    const newConfig = {};
    
    for (const [key, schema] of Object.entries(skill.configSchema?.properties || {})) {
      const currentValue = config[key] ?? schema.default;
      let input;
      
      if (schema.type === 'boolean') {
        input = prompt(`${schema.description}\nCurrent: ${currentValue}\nNew value (true/false):`, String(currentValue));
        newConfig[key] = input === 'true';
      } else if (schema.type === 'number') {
        input = prompt(`${schema.description}\nCurrent: ${currentValue}\nNew value:`, String(currentValue));
        newConfig[key] = parseFloat(input || String(currentValue));
      } else if (schema.enum) {
        input = prompt(`${schema.description}\nOptions: ${schema.enum.join(', ')}\nCurrent: ${currentValue}\nNew value:`, currentValue);
        newConfig[key] = input;
      } else {
        input = prompt(`${schema.description}\nCurrent: ${currentValue}\nNew value:`, currentValue);
        newConfig[key] = input;
      }
    }
    
    if (Object.keys(newConfig).length > 0) {
      updateSkillConfig(skill.id, newConfig);
    }
  }

  async function updateSkillConfig(skillId, config) {
    try {
      const response = await fetch(`/api/skills/${skillId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        await loadSkills();
        addActivity(`Skill config updated: ${skillId}`);
      }
    } catch (error) {
      console.error('Update skill config failed:', error);
      addActivity(`Failed to update config: ${error.message}`, true);
    }
  }

  function showSkillDetails(skill) {
    alert(`${skill.name} v${skill.version}\n\n${skill.description}\n\nAuthor: ${skill.author}\nCategory: ${skill.category}\nTags: ${skill.tags.join(', ')}\nPermissions: ${skill.permissions.map(p => `${p.type}:${p.scope.join(',')}`).join('; ')}`);
  }

  // Modal handling
  function openInstallModal() {
    if (modalOverlay) modalOverlay.classList.add('active');
    renderTemplates();
  }

  function closeInstallModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
    if (modalForm) modalForm.reset();
    selectedTemplate = null;
    document.querySelectorAll('.skill-template-card').forEach(c => c.classList.remove('selected'));
  }

  function renderTemplates() {
    if (!templatesGrid) return;
    
    const templates = [
      { id: 'code-analysis', name: 'Code Analysis', category: 'development', desc: 'Analyze code for bugs, security issues, and best practices', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' },
      { id: 'task-automation', name: 'Task Automation', category: 'productivity', desc: 'Create and manage automated workflows', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
      { id: 'security-audit', name: 'Security Audit', category: 'security', desc: 'Scan for vulnerabilities and compliance issues', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' },
      { id: 'data-analysis', name: 'Data Analysis', category: 'analysis', desc: 'Analyze data, generate visualizations and insights', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
      { id: 'documentation', name: 'Documentation', category: 'development', desc: 'Generate docs from code (README, API docs, comments)', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' }
    ];

    templatesGrid.innerHTML = templates.map(t => `
      <div class="skill-template-card" data-template-id="${t.id}">
        <div class="skill-template-icon">${t.icon}</div>
        <div class="skill-template-name">${t.name}</div>
        <div class="skill-template-desc">${t.desc}</div>
      </div>
    `).join('');

    templatesGrid.querySelectorAll('.skill-template-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.skill-template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedTemplate = card.dataset.templateId;
      });
    });
  }

  // Event listeners
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => renderSkills(allSkills));
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadSkills);
  }

  if (installBtn) {
    installBtn.addEventListener('click', openInstallModal);
  }

  if (modalClose) modalClose.addEventListener('click', closeInstallModal);
  if (modalCancel) modalCancel.addEventListener('click', closeInstallModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeInstallModal();
    });
  }

  if (installMethod) {
    installMethod.addEventListener('change', (e) => {
      const method = e.target.value;
      if (templateSection) templateSection.style.display = method === 'template' ? 'block' : 'none';
      if (urlSection) urlSection.style.display = method === 'url' ? 'block' : 'none';
      if (localSection) localSection.style.display = method === 'local' ? 'block' : 'none';
      if (customSection) customSection.style.display = method === 'custom' ? 'block' : 'none';
    });
  }

  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const method = installMethod?.value;
      
      try {
        let result;
        if (method === 'template' && selectedTemplate) {
          result = await fetch('/api/skills/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: selectedTemplate })
          });
        } else if (method === 'url') {
          const url = document.getElementById('skill-url')?.value;
          result = await fetch('/api/skills/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
        } else if (method === 'local') {
          const file = document.getElementById('skill-local-file')?.files?.[0];
          if (file) {
            const text = await file.text();
            const manifest = JSON.parse(text);
            result = await fetch('/api/skills/install', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ manifest })
            });
          }
        } else if (method === 'custom') {
          const id = document.getElementById('skill-custom-id')?.value;
          const name = document.getElementById('skill-custom-name')?.value;
          const category = document.getElementById('skill-custom-category')?.value;
          const description = document.getElementById('skill-custom-description')?.value;
          const code = document.getElementById('skill-custom-code')?.value;
          
          result = await fetch('/api/skills/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom: { id, name, category, description, code } })
          });
        }

        if (result?.ok) {
          closeInstallModal();
          await loadSkills();
          addActivity('Skill installed successfully');
        } else {
          const error = await result?.json();
          throw new Error(error?.error || 'Install failed');
        }
      } catch (error) {
        console.error('Skill install failed:', error);
        addActivity(`Skill install failed: ${error.message}`, true);
      }
    });
  }

  // Initial load
  await loadSkills();
}
