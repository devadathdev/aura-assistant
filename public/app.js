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
};

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
  state.authenticated = false;
  showFaceAuthScreen();
  elements.assistantStatus.textContent = `Locked: ${reason}`;
  setOrbState("", "LOCKED");
  addActivity(`Auto-locked: ${reason}`, true);
}

function handleAuthUnlock(method) {
  state.authenticated = true;
  state.authMethod = method;
  unlockApp();
  addActivity(`Authenticated via ${method}`);
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

function updateSecurityCardStatus() {
  const securityCard = document.querySelector(".hud-security-card");
  if (!securityCard) return;

  const faceStatus = securityCard.querySelector("#face-auth-status");
  if (faceStatus) {
    faceStatus.textContent = state.faceAuthEnabled && state.faceDescriptors.length > 0
      ? "FACE ID ACTIVE"
      : state.faceAuthEnabled
        ? "ENROLL REQUIRED"
        : "PASSCODE ONLY";
    faceStatus.classList.toggle("hud-mint", state.faceAuthEnabled && state.faceDescriptors.length > 0);
  }
}

async function clearFaceData() {
  state.faceDescriptors = [];
  state.faceAuthEnabled = false;
  localStorage.setItem(STORAGE_KEYS.faceDescriptors, "[]");
  localStorage.setItem(STORAGE_KEYS.faceAuthEnabled, "false");

  const securityCard = document.querySelector(".hud-security-card");
  if (securityCard) {
    const status = securityCard.querySelector(".status-value");
    if (status) {
      status.textContent = "PASSCODE ONLY";
      status.classList.remove("hud-mint");
    }
  }

  document.getElementById("face-auth-enrolled").hidden = true;
  document.getElementById("face-auth-skip").textContent = "USE PASSCODE";

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
  const video = document.getElementById("face-auth-video");
  const canvas = document.getElementById("face-auth-canvas");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    return true;
  } catch (error) {
    console.error("Camera access denied:", error);
    elements.faceAuthMessage.textContent = "Camera access required for Face ID";
    return false;
  }
}

function stopFaceAuthCamera() {
  const video = document.getElementById("face-auth-video");
  if (video.srcObject) {
    video.srcObject.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
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

  elements.faceAuthEnrollBtn?.addEventListener("click", enrollFace);
  elements.faceAuthSkipBtn?.addEventListener("click", handleFaceAuthSkip);

  return true;
}

async function enrollFace() {
  const btn = document.getElementById("face-auth-enroll");
  const messageEl = document.getElementById("face-auth-message");
  const progressEl = document.querySelector("#face-auth-status .hud-progress span");
  const confidenceEl = document.getElementById("face-auth-confidence");

  btn.disabled = true;
  btn.textContent = "ENROLLING...";
  messageEl.textContent = "Look at the camera. Capturing samples...";
  confidenceEl.hidden = true;
  progressEl.style.width = "0%";

  state.faceAuthPending = true;
  const samples = [];
  let captured = 0;

  const captureInterval = setInterval(async () => {
    if (!state.faceAuthPending || captured >= FACE_AUTH_CONFIG.maxEnrollSamples) {
      clearInterval(captureInterval);
      btn.disabled = false;
      btn.textContent = "ENROLL FACE";
      state.faceAuthPending = false;

      if (captured > 0) {
        const avgDescriptor = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
          let sum = 0;
          samples.forEach((s) => (sum += s[i]));
          avgDescriptor[i] = sum / samples.length;
        }
        state.faceDescriptors.push(Array.from(avgDescriptor));
        localStorage.setItem(STORAGE_KEYS.faceDescriptors, JSON.stringify(state.faceDescriptors));

        messageEl.textContent = `Enrolled! ${state.faceDescriptors.length}/${FACE_AUTH_CONFIG.maxEnrollSamples} samples`;
        progressEl.style.width = `${(state.faceDescriptors.length / FACE_AUTH_CONFIG.maxEnrollSamples) * 100}%`;
        confidenceEl.hidden = true;

        if (state.faceDescriptors.length === 1) {
          document.getElementById("face-auth-enrolled").hidden = false;
          document.getElementById("face-auth-skip").textContent = "USE PASSCODE";
        }

        addActivity(`Face enrolled (sample ${state.faceDescriptors.length})`);
      }
      return;
    }

    const detection = await detectFace(document.getElementById("face-auth-video"));
    if (detection) {
      samples.push(detection.descriptor);
      captured++;
      progressEl.style.width = `${(captured / FACE_AUTH_CONFIG.maxEnrollSamples) * 100}%`;
      messageEl.textContent = `Capturing sample ${captured}/${FACE_AUTH_CONFIG.maxEnrollSamples}...`;
    }
  }, 800);
}

async function verifyFace() {
  if (!state.faceAuthEnabled || state.faceDescriptors.length === 0) {
    unlockApp();
    return true;
  }

  const messageEl = document.getElementById("face-auth-message");
  const progressEl = document.querySelector("#face-auth-status .hud-progress span");
  const confidenceEl = document.getElementById("face-auth-confidence");
  const confidenceStrong = confidenceEl.querySelector("strong");

  messageEl.textContent = "Scanning for face...";
  confidenceEl.hidden = true;
  progressEl.style.width = "10%";

  const video = document.getElementById("face-auth-video");
  let attempts = 0;
  const maxAttempts = 30;
  let bestMatch = 0;

  const scanInterval = setInterval(async () => {
    attempts++;
    progressEl.style.width = `${Math.min(90, (attempts / maxAttempts) * 100)}%`;

    const detection = await detectFace(video);
    if (detection) {
      let minDistance = Infinity;
      for (const stored of state.faceDescriptors) {
        const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(stored));
        if (distance < minDistance) minDistance = distance;
      }

      const confidence = Math.max(0, (1 - minDistance) * 100);
      if (confidence > bestMatch) bestMatch = confidence;

      if (confidence >= FACE_AUTH_CONFIG.minConfidence * 100) {
        clearInterval(scanInterval);
        confidenceEl.hidden = false;
        confidenceStrong.textContent = `${Math.round(confidence)}%`;
        messageEl.textContent = "✓ Face verified. Access granted.";
        progressEl.style.width = "100%";

        await new Promise((r) => setTimeout(r, 800));
        unlockApp();
        return;
      }

      confidenceEl.hidden = false;
      confidenceStrong.textContent = `${Math.round(confidence)}%`;
      messageEl.textContent = `Verifying... (${Math.round(confidence)}% match)`;
    }

    if (attempts >= maxAttempts) {
      clearInterval(scanInterval);
      confidenceEl.hidden = false;
      confidenceStrong.textContent = `${Math.round(bestMatch)}%`;
      messageEl.textContent = "Face not recognized. Try again or use passcode.";
      addActivity("Face verification failed", true);
    }
  }, 300);
}

function unlockApp() {
  const overlay = document.getElementById("face-auth-overlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.removeAttribute("aria-modal");
  }
  stopFaceAuthCamera();
  state.faceAuthPending = false;

  const securityCard = document.querySelector(".hud-security-card");
  if (securityCard) {
    const status = securityCard.querySelector(".status-value");
    if (status) {
      status.textContent = state.faceAuthEnabled ? "FACE ID ACTIVE" : "PASSCODE ONLY";
      status.classList.add("hud-mint");
    }
  }

  addActivity("Face authentication successful");
  elements.assistantStatus.textContent = "Welcome back. All systems operational.";
  setOrbState("", state.wakeEnabled ? "SAY \u201CAURA\u201D" : "TAP TO SPEAK");
}

function showFaceAuthScreen() {
  const overlay = document.getElementById("face-auth-overlay");
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute("aria-modal", "true");
  }
  elements.assistantStatus.textContent = "Face authentication required";
  setOrbState("", "FACE ID");
}

function handleFaceAuthSkip() {
  if (state.faceAuthEnabled && state.faceDescriptors.length > 0) {
    addActivity("Face ID bypassed - passcode used", true);
  }
  
  // Show PIN entry instead of unlocking directly
  showPinEntry();
}

// PIN Entry Functions
function showPinEntry() {
  const pinContainer = document.getElementById("face-auth-pin");
  const skipBtn = document.getElementById("face-auth-skip");
  const enrollBtn = document.getElementById("face-auth-enroll");
  const messageEl = document.getElementById("face-auth-message");
  const progressEl = document.querySelector("#face-auth-status .hud-progress span");
  
  if (pinContainer) {
    pinContainer.hidden = false;
    skipBtn.hidden = true;
    if (enrollBtn) enrollBtn.hidden = true;
    messageEl.textContent = "Enter your PIN to unlock";
    progressEl.style.width = "0%";
    
    // Focus first input
    const inputs = pinContainer.querySelectorAll("input");
    inputs.forEach((input, i) => {
      input.value = "";
      input.addEventListener("input", handlePinInput);
      input.addEventListener("keydown", handlePinKeydown);
    });
    inputs[0].focus();
    
    // Setup submit button
    const submitBtn = document.getElementById("face-auth-pin-submit");
    const cancelBtn = document.getElementById("face-auth-pin-cancel");
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.onclick = verifyPinEntry;
    }
    if (cancelBtn) {
      cancelBtn.hidden = false;
      cancelBtn.onclick = hidePinEntry;
    }
    
    document.getElementById("face-auth-pin-error").hidden = true;
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
  const inputs = input.parentElement.querySelectorAll("input");
  const index = Array.from(inputs).indexOf(input);
  
  // Auto-advance to next input
  if (input.value && index < inputs.length - 1) {
    inputs[index + 1].focus();
  }
  
  // Check if all filled
  const pin = Array.from(inputs).map(i => i.value).join("");
  if (pin.length >= 4) {
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
  const pin = Array.from(inputs).map(i => i.value).join("");
  
  if (pin.length < 4) {
    errorEl.textContent = "PIN must be at least 4 digits";
    errorEl.hidden = false;
    return;
  }
  
  try {
    if (auraAuth) {
      const result = await auraAuth.authenticate('pin', { pin });
      if (result.success) {
        auraAuth.unlock('pin');
        hidePinEntry();
        unlockApp();
        addActivity("PIN authentication successful");
        return;
      }
    }
    
    // Fallback to legacy PIN check
    if (await auraAuth.verifyPin(pin)) {
      auraAuth.unlock('pin');
      hidePinEntry();
      unlockApp();
      addActivity("PIN authentication successful");
      return;
    }
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
    inputs.forEach(i => i.value = "");
    inputs[0].focus();
    addActivity(`PIN auth failed: ${e.message}`, true);
  }
}

async function setupFaceAuth() {
  if (!auraAuth || !auraAuth.state.faceAuthEnabled) {
    unlockApp();
    return;
  }

  showFaceAuthScreen();
  const initialized = await initFaceAuth();
  if (!initialized) {
    handleFaceAuthSkip();
    return;
  }

  if (auraAuth.state.faceDescriptors.length === 0) {
    document.getElementById("face-auth-enroll").hidden = false;
    document.getElementById("face-auth-message").textContent = "No face enrolled. Click Enroll Face to begin.";
    document.querySelector("#face-auth-status .hud-progress span").style.width = "0%";
  } else {
    document.getElementById("face-auth-message").textContent = "Look at the camera to authenticate";
    document.querySelector("#face-auth-status .hud-progress span").style.width = "0%";
    
    // Use enhanced auth with liveness detection
    const video = document.getElementById("face-auth-video");
    const result = await auraAuth.authenticate('face', { videoElement: video, requireLiveness: true });
    
    if (result.success) {
      auraAuth.unlock('face');
      unlockApp();
    } else {
      document.getElementById("face-auth-message").textContent = `Face auth failed: ${result.error}. Use passcode.`;
      addActivity(`Face auth failed: ${result.error}`, true);
      // Show passcode option
      document.getElementById("face-auth-skip").hidden = false;
    }
  }
}

function toggleFaceAuth() {
  state.faceAuthEnabled = !state.faceAuthEnabled;
  localStorage.setItem(STORAGE_KEYS.faceAuthEnabled, JSON.stringify(state.faceAuthEnabled));

  const securityCard = document.querySelector(".hud-security-card");
  if (securityCard) {
    const status = securityCard.querySelector(".status-value");
    if (status) {
      status.textContent = state.faceAuthEnabled ? "FACE ID ACTIVE" : "PASSCODE ONLY";
    }
  }

  if (state.faceAuthEnabled && state.faceDescriptors.length === 0) {
    showFaceAuthScreen();
    initFaceAuth().then((initialized) => {
      if (initialized) {
        document.getElementById("face-auth-enroll").hidden = false;
        document.getElementById("face-auth-message").textContent = "No face enrolled. Click Enroll Face to begin.";
      }
    });
  }

  addActivity(`Face authentication ${state.faceAuthEnabled ? "enabled" : "disabled"}`, !state.faceAuthEnabled);
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
  const greeting = hours < 5 ? "Still awake?" : hours < 12 ? "Good morning." : hours < 17 ? "Good afternoon." : hours < 21 ? "Good evening." : "Good night.";

  elements.clock.textContent = now.toLocaleTimeString([], { hour12: false });
  elements.date.textContent = now
    .toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase()
    .replace(",", " /");
  elements.environmentTime.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  elements.dayPeriod.textContent = period;
  elements.greeting.textContent = greeting;

  const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  elements.uptime.textContent = `${minutes}:${seconds}`;
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

  article.classList.add(role === "user" ? "user-message" : "assistant-message");
  avatar.textContent = role === "user" ? "Y" : "A";
  name.textContent = role === "user" ? "YOU" : "AURA";
  paragraph.textContent = text;
  elements.conversation.appendChild(fragment);
  elements.conversation.scrollTop = elements.conversation.scrollHeight;

  if (persist) {
    state.history.push({ role, content: text });
    state.history = state.history.slice(-20);
    saveState();
  }
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
    const normalizedLanguage = language.toLowerCase().replace("_", "-");
    const baseLanguage = normalizedLanguage.split("-")[0];

    utterance.lang = language;
    utterance.voice =
      voices.find((voice) => voice.lang.toLowerCase().replace("_", "-") === normalizedLanguage) ||
      voices.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(`${baseLanguage}-`)) ||
      voices.find((voice) => /en/i.test(voice.lang)) ||
      null;
    utterance.rate = 1.02;
    utterance.pitch = 0.82;
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
    if (!state.faceAuthEnabled) toggleFaceAuth();
    return "Face authentication enabled. Look at the camera to unlock.";
  }

  if (normalized === "/face-id off" || /\b(disable face id|turn off face id|face auth off)\b/.test(normalized)) {
    if (state.faceAuthEnabled) toggleFaceAuth();
    return "Face authentication disabled. Passcode only mode active.";
  }

  if (normalized === "/face-id enroll" || /\b(enroll face|register face|add face)\b/.test(normalized)) {
    if (!state.faceAuthEnabled) {
      toggleFaceAuth();
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
    const samples = state.faceDescriptors.length;
    return `Face authentication: ${enabled}. Enrolled samples: ${samples}/${FACE_AUTH_CONFIG.maxEnrollSamples}.`;
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
    return `Authenticated: ${s.authenticated} (${s.authMethod || 'none'}). Face: ${s.faceAuthEnabled ? 'on' : 'off'}. PIN: ${s.pinSet ? 'set' : 'not set'}. Liveness: ${window.AUTH_CONFIG?.livenessEnabled ? 'on' : 'off'}. Auto-lock: ${s.continuousProtectionActive ? 'active' : 'inactive'}.`;
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

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "Hello. I’m online and ready. What would you like to work on?";
  }

  if (/\b(thank you|thanks)\b/.test(normalized)) {
    return "You’re welcome.";
  }

  return "I can handle that more intelligently when a live AI key is connected. In local mode, try /brief, /find meeting, /convert 10 miles to km, /roll 2d6, /tasks, a time check, a calculation, or ask me to remember something.";
}

async function requestLiveResponse() {
  const start = performance.now();
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: state.history.slice(-12) }),
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
            // Update UI incrementally for streaming feel
            updateLastMessage(fullText);
          }
          if (data.done) {
            usage = data.usage;
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
  const isLiveAI = !shouldUseLocalCommand(input) && state.liveAI;
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
    } else if (!isLiveAI) {
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
  elements.voiceButton.classList.remove("armed");
  elements.voiceButton.classList.add("active");
  elements.assistantStatus.textContent = "Yes? I’m listening.";
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
    setOrbState("wake-listening", "SAY “AURA”");
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

    if (state.pendingVoiceCommand) {
      const command = state.pendingVoiceCommand;
      state.pendingVoiceCommand = "";
      handleCommand(command);
      return;
    }

    if (!state.busy && !state.pauseWakeForSpeech) {
      if (state.wakeEnabled) elements.voiceSupport.textContent = "ARMING";
      setOrbState("", state.wakeEnabled ? "SAY “AURA”" : "TAP TO SPEAK");
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
    state.recognition.stop();
  } else if (state.recognitionActive) {
    enterCommandMode();
  } else {
    state.voiceMode = "command";
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
  } catch {
    elements.connectionLabel.textContent = "LOCAL SESSION";
    elements.modeLabel.textContent = "OFFLINE CORE";
    addActivity("Server link unavailable", true);
  }
}

function setupCanvas() {
  const canvas = document.querySelector("#neural-canvas");
  const context = canvas.getContext("2d");
  let points = [];
  let animationFrame;
  let pulsePhase = 0;
  
  // Advanced particle system
  const particles = [];
  const maxParticles = 120;
  
  // Grid pattern for holographic effect
  const gridSize = 60;
  const gridSpacing = 40;
  
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const pointCount = Math.min(120, Math.floor(window.innerWidth / 14));
    points = Array.from({ length: pointCount }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      size: Math.random() * 1.2 + 0.3,
      hue: Math.random() * 360,
      trail: []
    }));
    
    // Initialize advanced particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        vz: (Math.random() - 0.5) * 0.03,
        size: Math.random() * 1.5 + 0.5,
        hue: Math.random() * 360,
        hueSpeed: Math.random() * 0.8 - 0.4,
        trail: []
      });
    }
  }

  function draw() {
    const time = Date.now() * 0.001;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pulsePhase += 0.01;
    
    // Draw holographic grid
    context.strokeStyle = "rgba(0, 255, 209, 0.08)";
    context.lineWidth = 0.5;
    
    for (let x = 0; x < window.innerWidth; x += gridSpacing) {
      for (let y = 0; y < window.innerHeight; y += gridSpacing) {
        const offset = Math.sin(time * 0.5 + x * 0.01) * Math.cos(time * 0.3 + y * 0.01);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + gridSize * Math.cos(time + x * 0.005), y + gridSize * Math.sin(time + y * 0.005));
        context.stroke();
      }
    }
    
    // Draw neural network connections
    points.forEach((point, index) => {
      point.x += point.vx;
      point.y += point.vy;
      point.hue += point.hueSpeed || 0.01;
      
      if (point.x < 0 || point.x > window.innerWidth) point.vx *= -1;
      if (point.y < 0 || point.y > window.innerHeight) point.vy *= -1;
      
      // Store trail
      point.trail.push({ x: point.x, y: point.y, age: 0 });
      if (point.trail.length > 8) point.trail.shift();
      point.trail.forEach(t => t.age++);
      
      // Draw trail
      point.trail.forEach((trail, i) => {
        const alpha = (1 - i / 8) * 0.3;
        context.beginPath();
        context.fillStyle = `hsla(${point.hue % 360}, 80%, 70%, ${alpha})`;
        context.arc(trail.x, trail.y, point.size * (0.5 - i / 16), 0, Math.PI * 2);
        context.fill();
      });
      
      // Draw particle with glow
      const alpha = 0.7 + Math.sin(time + index) * 0.3;
      context.beginPath();
      context.fillStyle = `hsla(${(point.hue % 360) + 180}, 80%, 75%, ${alpha})`;
      context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      context.fill();
      
      // Add glow effect
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size * 3);
      gradient.addColorStop(0, `hsla(${(point.hue % 360) + 180}, 100%, 90%, ${alpha * 0.5})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.fill();
      
      // Draw connections to nearby particles
      for (let otherIndex = index + 1; otherIndex < points.length; otherIndex += 1) {
        const other = points[otherIndex];
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance < 150) {
          const lineAlpha = (1 - distance / 150) * 0.2;
          context.beginPath();
          context.strokeStyle = `hsla(${(point.hue % 360) + 180}, 80%, 70%, ${lineAlpha})`;
          context.lineWidth = 0.8;
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }
    });
    
    // Draw advanced particles
    particles.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.z += particle.vz;
      particle.hue += particle.hueSpeed;
      
      if (particle.x < -50 || particle.x > window.innerWidth + 50) particle.vx *= -1;
      if (particle.y < -50 || particle.y > window.innerHeight + 50) particle.vy *= -1;
      
      const trail = [];
      for (let i = 0; i < 10; i++) {
        trail.push({
          x: particle.x - particle.vx * i * 0.5,
          y: particle.y - particle.vy * i * 0.5,
          age: i
        });
      }
      
      trail.forEach((t, i) => {
        const alpha = (1 - i / 10) * 0.4;
        context.beginPath();
        context.fillStyle = `hsla(${particle.hue % 360}, 70%, 80%, ${alpha})`;
        context.arc(t.x, t.y, particle.size * (0.5 - i / 20), 0, Math.PI * 2);
        context.fill();
      });
      
      // Main particle
      context.save();
      context.globalAlpha = 0.8;
      context.beginPath();
      context.fillStyle = `hsla(${particle.hue % 360}, 90%, 90%, 0.9)`;
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
      
      // Pulse effect
      const pulse = 1 + Math.sin(time * 3 + particle.x * 0.01) * 0.2;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * pulse, 0, Math.PI * 2);
      context.strokeStyle = `hsla(${particle.hue % 360}, 100%, 95%, 0.6)`;
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    });
    
    // Draw radar sweep
    const radarRadius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    const radarAngle = time * 0.5;
    context.strokeStyle = "rgba(0, 255, 209, 0.3)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(window.innerWidth / 2, window.innerHeight - 100);
    context.arc(window.innerWidth / 2, window.innerHeight - 100, radarRadius, 0, radarAngle);
    context.stroke();
    
    animationFrame = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
    } else {
      draw();
    }
  });
}

elements.commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
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
checkServerStatus();
renderMemoryList();
updateTimerDisplay();
if (state.weatherCity) {
  fetchWeather(state.weatherCity).then(updateWeatherDisplay).catch(() => {});
}
updateSecurityCardStatus();
await initEnhancedAuth();
setupFaceAuth();

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
