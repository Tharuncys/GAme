const VERSION = "1.3.0";
const SESSION_STORAGE_KEY = "rehab-balloon-session-history";
const USER_STORAGE_KEY = "rehab-balloon-users";
const LEVEL_BASELINE_KEY = "rehab-level-baselines";
const API_BASE = "";

const LEVELS = [
  { id: 1, name: "Level 1 – Basic Pop", targetPops: 10, speed: 0.7, balloonCount: 1, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 2, name: "Level 2 – Increased Speed", targetPops: 12, speed: 1.0, balloonCount: 1, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 3, name: "Level 3 – Multiple Balloons", targetPops: 15, speed: 1.1, balloonCount: 2, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 4, name: "Level 4 – Random Movement", targetPops: 16, speed: 1.2, balloonCount: 2, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 5, name: "Level 5 – Time Pressure", targetPops: 18, speed: 1.35, balloonCount: 2, timeLimit: 45, enableShrink: false, shrinkFactor: 1 },
  { id: 6, name: "Level 6 – Shrinking Balloon", targetPops: 20, speed: 1.45, balloonCount: 2, timeLimit: 50, enableShrink: true, shrinkFactor: 0.75 },
  { id: 7, name: "Level 7 – Advanced Control", targetPops: 22, speed: 1.6, balloonCount: 3, timeLimit: 55, enableShrink: true, shrinkFactor: 0.56 }
];

const state = {
  scene: "authScene",
  activeUserId: null,
  settings: { controlMode: "camera", speedMultiplier: 0.6, adaptiveSpeed: true },
  patient: null,
  sessionStartTs: null,
  levelIndex: 0,
  levelRuntime: { targetPops: 0, currentPops: 0, timer: 0, levelRunning: false, misses: 0 },
  cursor: { x: 220, y: 220 },
  trail: [],
  balloons: [],
  levelReports: [],
  totalPops: 0,
  rafId: null,
  levelStartPerf: 0,
  levelStartTs: 0,
  baselineTimes: {},
  currentTask: null,
  taskTimer: 30,
  taskInterval: null,
  adaptiveSpeedBoost: 0,
  cameraGesture: { unlocked: false, holdStart: 0 }
};

const els = {
  appVersion: document.getElementById("appVersion"),
  portalLoginBtn: document.getElementById("portalLoginBtn"),
  portalRegisterBtn: document.getElementById("portalRegisterBtn"),
  loginPatientId: document.getElementById("loginPatientId"),
  loginPassword: document.getElementById("loginPassword"),
  openRegisterBtn: document.getElementById("openRegisterBtn"),
  registerUserId: document.getElementById("registerUserId"),
  registerUserPassword: document.getElementById("registerUserPassword"),
  authMessage: document.getElementById("authMessage"),
  activePatientLabel: document.getElementById("activePatientLabel"),
  dailySnapshot: document.getElementById("dailySnapshot"),
  dailyActivityPanel: document.getElementById("dailyActivityPanel"),
  controlModeSelect: document.getElementById("controlModeSelect"),
  speedMultiplier: document.getElementById("speedMultiplier"),
  speedMultiplierValue: document.getElementById("speedMultiplierValue"),
  adaptiveSpeedToggle: document.getElementById("adaptiveSpeedToggle"),
  inputStatus: document.getElementById("inputStatus"),
  levelName: document.getElementById("levelName"),
  popCounter: document.getElementById("popCounter"),
  timerValue: document.getElementById("timerValue"),
  targetTimeValue: document.getElementById("targetTimeValue"),
  controlModeLabel: document.getElementById("controlModeLabel"),
  gestureState: document.getElementById("gestureState"),
  playArea: document.getElementById("playArea"),
  trailCanvas: document.getElementById("trailCanvas"),
  cursor: document.getElementById("cursor"),
  levelNumber: document.getElementById("levelNumber"),
  levelScore: document.getElementById("levelScore"),
  levelTime: document.getElementById("levelTime"),
  targetTimeInfo: document.getElementById("targetTimeInfo"),
  taskTriggerInfo: document.getElementById("taskTriggerInfo"),
  taskText: document.getElementById("taskText"),
  taskTimer: document.getElementById("taskTimer"),
  taskDoneBtn: document.getElementById("taskDoneBtn"),
  taskNotDoneBtn: document.getElementById("taskNotDoneBtn"),
  startTaskBtn: document.getElementById("startTaskBtn"),
  taskGateMessage: document.getElementById("taskGateMessage"),
  dashboardTitle: document.getElementById("dashboardTitle"),
  profileSummary: document.getElementById("profileSummary"),
  summaryContent: document.getElementById("summaryContent"),
  dailyProgressChart: document.getElementById("dailyProgressChart"),
  levelTrendGrid: document.getElementById("levelTrendGrid"),
  storageInfo: document.getElementById("storageInfo"),
  cameraPreview: document.getElementById("cameraPreview"),
};

let camStream = null;
let camIntervalId = null;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const todayKey = () => new Date().toISOString().slice(0, 10);
const showScene = (id) => {
  document.querySelectorAll(".scene").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  state.scene = id;
};
const currentLevel = () => LEVELS[state.levelIndex];
const getLatestLevelReports = () => {
  const latest = new Map();
  state.levelReports.forEach((report) => latest.set(report.level, report));
  return [...latest.values()].sort((a, b) => a.level - b.level);
};
const effectiveSpeed = (baseSpeed) => {
  const manual = Number(state.settings.speedMultiplier || 0.6);
  const adaptive = state.settings.adaptiveSpeed ? (1 + state.adaptiveSpeedBoost) : 1;
  return baseSpeed * manual * adaptive;
};

const getUsers = () => JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || "{}");
const saveUsers = (users) => localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));

const getBaselines = () => JSON.parse(localStorage.getItem(LEVEL_BASELINE_KEY) || "{}");
const saveBaselines = (all) => localStorage.setItem(LEVEL_BASELINE_KEY, JSON.stringify(all));

const apiRequest = async (path, method = "GET", body) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error("api error");
    return await response.json();
  } catch {
    return null;
  }
};

const registerUser = async (payload) => {
  const remote = await apiRequest("/api/register", "POST", payload);
  if (remote) return remote;

  const { patientId, password, profile } = payload;
  const users = getUsers();
  if (users[patientId]) return { ok: false, message: "User exists. Please login." };
  users[patientId] = {
    password,
    profile,
    createdAt: new Date().toISOString()
  };
  saveUsers(users);
  return { ok: true, message: "Registered. Now login." };
};

const loginUser = async (patientId, password) => {
  const remote = await apiRequest("/api/login", "POST", { patientId, password });
  if (remote) return remote;
  const users = getUsers();
  if (!users[patientId] || users[patientId].password !== password) return { ok: false, message: "Invalid credentials." };
  return { ok: true, profile: users[patientId].profile || null };
};

const getUserProfile = async (userId) => {
  const remote = await apiRequest(`/api/profile?userId=${encodeURIComponent(userId)}`);
  if (remote?.ok) return remote.profile || null;
  const users = getUsers();
  return users[userId]?.profile || null;
};

const saveSessionRemote = async (session) => {
  const remote = await apiRequest("/api/session", "POST", session);
  if (remote) return;
  const all = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]");
  all.unshift(session);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(all.slice(0, 100)));
};

const fetchDailyActivity = async (userId) => {
  const remote = await apiRequest(`/api/daily-activity?userId=${encodeURIComponent(userId)}`);
  if (remote?.ok) return remote;
  const sessions = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]").filter((s) => s.userId === userId);
  const today = sessions.filter((s) => s.dateKey === todayKey());
  return {
    ok: true,
    date: todayKey(),
    sessionsToday: today.length,
    levelsToday: today.reduce((a, s) => a + (s.levels?.length || s.totals?.totalLevelsCompleted || 0), 0),
    tasksDoneToday: today.reduce((a, s) => a + (s.taskStats?.completed || 0), 0),
  };
};

const fetchBaseline = async (userId) => {
  const remote = await apiRequest(`/api/baseline?userId=${encodeURIComponent(userId)}`);
  if (remote?.ok) return remote.baseline || {};
  const all = getBaselines();
  return all[userId] || {};
};

const persistBaseline = async (userId, baseline) => {
  const remote = await apiRequest("/api/baseline", "POST", { userId, baseline });
  if (remote?.ok) return;
  const all = getBaselines();
  all[userId] = baseline;
  saveBaselines(all);
};

const updateDailyPanel = async () => {
  const daily = await fetchDailyActivity(state.activeUserId);
  if (els.dailySnapshot) {
    els.dailySnapshot.innerHTML = `
      <h3>Daily Game Activity</h3>
      <p>Date: <strong>${daily.date}</strong></p>
      <p>Sessions today: <strong>${daily.sessionsToday}</strong></p>
      <p>Total levels completed today: <strong>${daily.levelsToday}</strong></p>
      <p>Therapeutic tasks completed today: <strong>${daily.tasksDoneToday}</strong></p>
    `;
  }
  if (els.dailyActivityPanel) {
    els.dailyActivityPanel.innerHTML = `
      <div class="kpi-item"><span>Sessions</span><strong>${daily.sessionsToday}</strong></div>
      <div class="kpi-item"><span>Levels</span><strong>${daily.levelsToday}</strong></div>
      <div class="kpi-item"><span>Tasks</span><strong>${daily.tasksDoneToday}</strong></div>
    `;
  }
  return daily;
};

const drawTrail = () => {
  const ctx = els.trailCanvas.getContext("2d");
  const { width, height } = els.playArea.getBoundingClientRect();
  if (els.trailCanvas.width !== Math.floor(width) || els.trailCanvas.height !== Math.floor(height)) {
    els.trailCanvas.width = Math.floor(width);
    els.trailCanvas.height = Math.floor(height);
  }
  ctx.clearRect(0, 0, els.trailCanvas.width, els.trailCanvas.height);
  if (state.trail.length < 2) return;
  ctx.strokeStyle = "rgba(11,95,169,0.4)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  state.trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
};

const updateHUD = () => {
  const cfg = currentLevel();
  els.levelName.textContent = cfg.name;
  els.popCounter.textContent = `${state.levelRuntime.currentPops}/${cfg.targetPops}`;
  els.timerValue.textContent = state.levelRuntime.timer.toFixed(1);
  const target = state.baselineTimes[cfg.id];
  els.targetTimeValue.textContent = target ? `${target.toFixed(1)}s` : "--";
  els.controlModeLabel.textContent = state.settings.controlMode;
  els.gestureState.textContent = state.cameraGesture.unlocked ? "unlocked" : "locked";
};

const setCursorByPoint = (x, y) => {
  const rect = els.playArea.getBoundingClientRect();
  state.cursor.x = clamp(x - rect.left, 0, rect.width);
  state.cursor.y = clamp(y - rect.top, 0, rect.height);
};

const pollJoystick = () => {
  const gp = navigator.getGamepads?.()[0];
  if (!gp) {
    els.inputStatus.textContent = "No joystick detected. Using mouse fallback.";
    return;
  }
  const [axX = 0, axY = 0] = gp.axes;
  const rect = els.playArea.getBoundingClientRect();
  const width = Math.max(0, rect.width || els.playArea.clientWidth);
  const height = Math.max(0, rect.height || els.playArea.clientHeight);
  state.cursor.x = clamp(state.cursor.x + axX * 8, 0, width);
  state.cursor.y = clamp(state.cursor.y + axY * 8, 0, height);
  els.inputStatus.textContent = `Joystick active: ${gp.id}`;
};

const processGestureUnlock = (normX, normY, brightPixels) => {
  const signDetected = brightPixels > 35 && normX < 0.3 && normY < 0.3;
  if (!state.cameraGesture.unlocked && signDetected) {
    if (!state.cameraGesture.holdStart) state.cameraGesture.holdStart = performance.now();
    if (performance.now() - state.cameraGesture.holdStart > 1000) {
      state.cameraGesture.unlocked = true;
      els.inputStatus.textContent = "Unique sign accepted. Cursor unlocked.";
    }
  } else if (!signDetected) {
    state.cameraGesture.holdStart = 0;
  }
};

const beginCameraTracking = async () => {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    els.cameraPreview.srcObject = camStream;
    els.cameraPreview.style.display = "block";
    camIntervalId = setInterval(() => {
      if (state.settings.controlMode !== "camera" || state.scene !== "levelScene") return;
      const c = document.createElement("canvas");
      c.width = 64; c.height = 48;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(els.cameraPreview, 0, 0, c.width, c.height);
      const data = cx.getImageData(0, 0, c.width, c.height).data;
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const b = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (b > 180) {
          const p = i / 4;
          sx += p % c.width;
          sy += Math.floor(p / c.width);
          n += 1;
        }
      }
      if (n > 20) {
        const nx = sx / n / c.width;
        const ny = sy / n / c.height;
        processGestureUnlock(nx, ny, n);
        if (state.cameraGesture.unlocked) {
          state.cursor.x = nx * els.playArea.clientWidth;
          state.cursor.y = ny * els.playArea.clientHeight;
          els.inputStatus.textContent = "Camera tracking active";
        }
      }
    }, 60);
  } catch {
    els.inputStatus.textContent = "Camera unavailable/permission denied.";
  }
};

const stopCameraTracking = () => {
  if (camIntervalId) clearInterval(camIntervalId);
  camIntervalId = null;
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  els.cameraPreview.style.display = "none";
};

const spawnBalloon = () => {
  const cfg = currentLevel();
  const speed = effectiveSpeed(cfg.speed);
  const node = document.getElementById("balloonTemplate").content.firstElementChild.cloneNode(true);
  const scale = cfg.enableShrink ? cfg.shrinkFactor : 1;
  const radiusX = 36;
  const radiusY = 44;
  const rect = els.playArea.getBoundingClientRect();
  const width = Math.max(radiusX * 2 + 10, rect.width || els.playArea.clientWidth || 0);
  const height = Math.max(radiusY * 2 + 10, rect.height || els.playArea.clientHeight || 0);
  const b = {
    node,
    x: rand(radiusX, width - radiusX),
    y: rand(radiusY, height - radiusY),
    vx: rand(-1, 1) * speed,
    vy: rand(-1, 1) * speed,
    scale,
  };
  node.style.left = `${b.x}px`;
  node.style.top = `${b.y}px`;
  node.style.transform = `translate(-50%,-50%) scale(${scale})`;
  node.addEventListener("click", (e) => { e.stopPropagation(); popBalloon(b); });
  els.playArea.appendChild(node);
  state.balloons.push(b);
};

const popBalloon = (balloon) => {
  if (!state.levelRuntime.levelRunning) return;
  state.levelRuntime.currentPops += 1;
  state.totalPops += 1;
  balloon.node.classList.add("pop");
  setTimeout(() => balloon.node.remove(), 150);
  state.balloons = state.balloons.filter((x) => x !== balloon);
  if (state.levelRuntime.currentPops < currentLevel().targetPops) spawnBalloon();
};

const resetLevelRuntime = () => {
  state.levelRuntime.currentPops = 0;
  state.levelRuntime.misses = 0;
  state.levelRuntime.levelRunning = false;
  state.levelRuntime.timer = currentLevel().timeLimit;
  state.balloons.forEach((b) => b.node.remove());
  state.balloons = [];
  state.trail = [];
  state.cameraGesture.unlocked = state.settings.controlMode !== "camera";
  state.cameraGesture.holdStart = 0;
};

const maybeAssignTask = async (levelId, timeTaken) => {
  const target = state.baselineTimes[levelId] || null;
  const task = target && timeTaken > target ? {
    levelId,
    target,
    actual: timeTaken,
    timer: 30,
    text: `You exceeded target time (${target.toFixed(1)}s). Please perform wrist hold-and-release activity for 30 seconds.`
  } : null;

  state.baselineTimes[levelId] = timeTaken;
  await persistBaseline(state.activeUserId, state.baselineTimes);

  if (state.settings.adaptiveSpeed) {
    if (!task) state.adaptiveSpeedBoost = Math.min(0.9, state.adaptiveSpeedBoost + 0.05);
    else state.adaptiveSpeedBoost = Math.max(0, state.adaptiveSpeedBoost - 0.03);
  }
  return task;
};

const finishLevel = async () => {
  state.levelRuntime.levelRunning = false;
  cancelAnimationFrame(state.rafId);

  const cfg = currentLevel();
  const timeTaken = (Date.now() - state.levelStartTs) / 1000;
  const accuracy = (state.levelRuntime.currentPops / Math.max(1, state.levelRuntime.currentPops + state.levelRuntime.misses)) * 100;
  const task = await maybeAssignTask(cfg.id, timeTaken);

  state.levelReports.push({
    level: cfg.id,
    targetPops: cfg.targetPops,
    pops: state.levelRuntime.currentPops,
    timeTakenSec: Number(timeTaken.toFixed(2)),
    targetTimeSec: state.baselineTimes[cfg.id] ? Number(state.baselineTimes[cfg.id].toFixed(2)) : null,
    accuracy: Number(accuracy.toFixed(2)),
    assignedTask: Boolean(task),
    taskCompleted: null
  });

  els.levelNumber.textContent = `${cfg.id}/7`;
  els.levelScore.textContent = `${state.levelRuntime.currentPops}/${cfg.targetPops}`;
  els.levelTime.textContent = `${timeTaken.toFixed(2)}s`;
  els.targetTimeInfo.textContent = state.baselineTimes[cfg.id] ? `${state.baselineTimes[cfg.id].toFixed(2)}s` : "Set now";
  els.taskTriggerInfo.textContent = task ? "Target time missed: therapeutic task assigned." : "Good performance.";

  state.currentTask = task;
  showScene("levelCompleteScene");
};

const updateBalloons = () => {
  state.balloons.forEach((b) => {
    const radiusX = 36 * b.scale;
    const radiusY = 44 * b.scale;
    b.x += b.vx; b.y += b.vy;
    if (b.x < radiusX || b.x > els.playArea.clientWidth - radiusX) b.vx *= -1;
    if (b.y < radiusY || b.y > els.playArea.clientHeight - radiusY) b.vy *= -1;
    const d = Math.hypot(b.x - state.cursor.x, b.y - state.cursor.y);
    if (d < 24 * b.scale) popBalloon(b);
    b.node.style.left = `${b.x}px`;
    b.node.style.top = `${b.y}px`;
  });
};

const loop = () => {
  if (!state.levelRuntime.levelRunning) return;
  if (state.settings.controlMode === "joystick") pollJoystick();

  const elapsed = (performance.now() - state.levelStartPerf) / 1000;
  const cfg = currentLevel();
  state.levelRuntime.timer = cfg.timeLimit > 0 ? Math.max(0, cfg.timeLimit - elapsed) : elapsed;

  state.trail.push({ x: state.cursor.x, y: state.cursor.y });
  if (state.trail.length > 24) state.trail.shift();
  drawTrail();
  els.cursor.style.left = `${state.cursor.x}px`;
  els.cursor.style.top = `${state.cursor.y}px`;
  updateBalloons();
  updateHUD();

  if (state.levelRuntime.currentPops >= cfg.targetPops) return finishLevel();
  if (cfg.timeLimit > 0 && elapsed >= cfg.timeLimit) return finishLevel();
  state.rafId = requestAnimationFrame(loop);
};

const startLevel = (idx) => {
  state.levelIndex = idx;
  resetLevelRuntime();
  const cfg = currentLevel();
  state.levelRuntime.levelRunning = true;
  state.levelStartTs = Date.now();
  state.levelStartPerf = performance.now();
  showScene("levelScene");

  requestAnimationFrame(() => {
    const rect = els.playArea.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const nextX = Number.isFinite(state.cursor.x) ? state.cursor.x : rect.width / 2;
      const nextY = Number.isFinite(state.cursor.y) ? state.cursor.y : rect.height / 2;
      state.cursor.x = clamp(nextX, 0, rect.width);
      state.cursor.y = clamp(nextY, 0, rect.height);
    }
    for (let i = 0; i < cfg.balloonCount; i += 1) spawnBalloon();
    updateHUD();
    state.rafId = requestAnimationFrame(loop);
  });
};

const runAssignedTask = (done) => {
  const last = state.levelReports[state.levelReports.length - 1];
  if (last && state.currentTask) last.taskCompleted = done;
  clearInterval(state.taskInterval);
  state.taskInterval = null;
  state.currentTask = null;
  const next = state.levelIndex + 1;
  if (next < LEVELS.length) startLevel(next);
  else renderSummary();
};

const buildSession = () => {
  const finalLevels = getLatestLevelReports();
  const levelsCompleted = finalLevels.length;
  const tasksAssigned = finalLevels.filter((l) => l.assignedTask).length;
  const tasksCompleted = finalLevels.filter((l) => l.taskCompleted).length;
  return {
    userId: state.activeUserId,
    dateKey: todayKey(),
    patient: state.patient,
    totals: {
      totalLevelsCompleted: levelsCompleted,
      totalPops: state.totalPops,
      sessionDurationSec: (Date.now() - state.sessionStartTs) / 1000,
    },
    taskStats: { assigned: tasksAssigned, completed: tasksCompleted },
    levels: finalLevels,
    savedAt: new Date().toISOString(),
  };
};

const drawDailyProgressChart = (userId) => {
  if (!els.dailyProgressChart) return;
  const sessions = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]")
    .filter((s) => s.userId === userId)
    .slice(0, 14)
    .reverse();
  const c = els.dailyProgressChart;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#f7fbff";
  ctx.fillRect(0, 0, c.width, c.height);
  if (!sessions.length) return;

  const points = sessions.map((s, i) => ({
    x: 40 + i * ((c.width - 80) / Math.max(1, sessions.length - 1)),
    levels: s.totals?.totalLevelsCompleted || s.levels?.length || 0,
    tasks: s.taskStats?.completed || 0,
    label: (s.savedAt || s.dateKey || "").slice(5, 10)
  }));
  const maxVal = Math.max(1, ...points.flatMap((p) => [p.levels, p.tasks]));
  const scaleY = (v) => 210 - (v / maxVal) * 160;

  const drawLine = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const y = scaleY(p[key]);
      if (i === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.stroke();
    points.forEach((p) => {
      const y = scaleY(p[key]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  drawLine("tasks", "#16a34a");
  drawLine("levels", "#2563eb");

  ctx.fillStyle = "#334155";
  points.forEach((p) => ctx.fillText(p.label, p.x - 10, 230));
  ctx.fillStyle = "#16a34a"; ctx.fillRect(20, 18, 12, 12); ctx.fillStyle = "#1e293b"; ctx.fillText("Tasks Completed", 38, 28);
  ctx.fillStyle = "#2563eb"; ctx.fillRect(170, 18, 12, 12); ctx.fillStyle = "#1e293b"; ctx.fillText("Levels Completed", 188, 28);
};

const improvementBadge = (level, actual, sessions) => {
  const prevBest = sessions
    .flatMap((s) => s.levels || [])
    .filter((l) => l.level === level)
    .map((l) => l.timeTakenSec)
    .reduce((m, v) => Math.min(m, v), Infinity);
  if (!Number.isFinite(prevBest)) return { label: "First", cls: "steady" };
  if (actual < prevBest - 0.2) return { label: "Improved", cls: "improved" };
  if (actual > prevBest + 0.2) return { label: "Declined", cls: "declined" };
  return { label: "Steady", cls: "steady" };
};

const renderLevelTrendCharts = (userId) => {
  if (!els.levelTrendGrid) return;
  const sessions = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]")
    .filter((s) => s.userId === userId)
    .slice(0, 20)
    .reverse();

  els.levelTrendGrid.innerHTML = "";
  for (let level = 1; level <= 7; level += 1) {
    const card = document.createElement("div");
    card.className = "trend-card";
    card.innerHTML = `<h4>Level ${level} Time Trend</h4><canvas width="280" height="140"></canvas>`;
    const canvas = card.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const points = sessions.map((s, i) => {
      const rec = (s.levels || []).find((l) => l.level === level);
      return rec ? { x: 20 + i * ((canvas.width - 40) / Math.max(1, sessions.length - 1)), y: rec.timeTakenSec } : null;
    }).filter(Boolean);

    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (points.length > 1) {
      const max = Math.max(...points.map((p) => p.y), 1);
      const min = Math.min(...points.map((p) => p.y), 0);
      const mapY = (v) => 120 - ((v - min) / Math.max(1, max - min)) * 90;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((p, i) => {
        const py = mapY(p.y);
        if (i === 0) ctx.moveTo(p.x, py); else ctx.lineTo(p.x, py);
      });
      ctx.stroke();
      points.forEach((p) => {
        const py = mapY(p.y);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(p.x, py, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    els.levelTrendGrid.appendChild(card);
  }
};

const saveBlob = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

const renderSummary = async () => {
  const previousSessions = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]")
    .filter((s) => s.userId === state.activeUserId);
  const session = buildSession();
  await saveSessionRemote(session);

  const rows = session.levels.map((l) => {
    const badge = improvementBadge(l.level, l.timeTakenSec, previousSessions);
    const icon = badge.cls === "improved" ? "▲" : badge.cls === "declined" ? "▼" : "●";
    return `<tr><td>L${l.level}</td><td>${l.timeTakenSec.toFixed(2)}s <span class="trend-pill ${badge.cls}">${icon} ${badge.label}</span></td><td>${(l.targetTimeSec ?? l.timeTakenSec).toFixed(2)}s</td><td>${l.accuracy.toFixed(1)}%</td><td>${l.assignedTask ? "Yes" : "No"}</td><td>${l.taskCompleted === null ? "-" : (l.taskCompleted ? "Done" : "Not done")}</td></tr>`;
  }).join("");

  if (els.dashboardTitle) {
    els.dashboardTitle.textContent = `Dashboard for ${session.patient.patientName || session.userId}`;
  }
  if (els.profileSummary) {
    const p = session.patient || {};
    els.profileSummary.textContent = `Name: ${p.patientName || "-"} | Age: ${p.age || "-"} | Gender: ${p.gender || "-"} | Affected Hand: ${p.affectedHand || "-"}`;
  }

  els.summaryContent.innerHTML = `
    <p><strong>Latest Session:</strong> ${new Date(session.savedAt).toLocaleString()}</p>
    <p><strong>Levels Completed:</strong> ${session.totals.totalLevelsCompleted}/7 &nbsp;|&nbsp; <strong>Tasks Assigned/Completed:</strong> ${session.taskStats.assigned}/${session.taskStats.completed}</p>
    <table><thead><tr><th>Level</th><th>Actual Time</th><th>Target Time</th><th>Accuracy</th><th>Task Assigned</th><th>Task Completed</th></tr></thead><tbody>${rows}</tbody></table>
  `;

  await updateDailyPanel();
  drawDailyProgressChart(session.userId);
  renderLevelTrendCharts(session.userId);

  els.storageInfo.innerHTML = `<p>Stored in browser localStorage/API. Keys: <code>${SESSION_STORAGE_KEY}</code>, <code>${USER_STORAGE_KEY}</code>, <code>${LEVEL_BASELINE_KEY}</code>.</p>`;
  showScene("summaryScene");
};

const attachEvents = () => {
  if (els.portalLoginBtn) els.portalLoginBtn.addEventListener("click", () => showScene("authScene"));
  if (els.portalRegisterBtn) els.portalRegisterBtn.addEventListener("click", () => showScene("patientScene"));
  els.openRegisterBtn.addEventListener("click", () => showScene("patientScene"));

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = els.loginPatientId.value.trim();
    const pw = els.loginPassword.value;
    const result = await loginUser(id, pw);
    if (!result.ok) return (els.authMessage.textContent = result.message || "Invalid credentials.");
    state.activeUserId = id;
    const userProfile = result.profile || await getUserProfile(id);
    state.patient = userProfile ? { ...userProfile, userId: id } : null;
    state.baselineTimes = await fetchBaseline(id);
    els.activePatientLabel.textContent = id;
    await updateDailyPanel();
    showScene("startScene");
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    stopCameraTracking();
    state.activeUserId = null;
    showScene("portalScene");
  });

  document.getElementById("settingsBtn").addEventListener("click", () => showScene("settingsScene"));
  document.getElementById("startBtn").addEventListener("click", () => {
    if (!state.activeUserId) {
      els.authMessage.textContent = "Please login to start a session.";
      showScene("authScene");
      return;
    }

    state.levelReports = [];
    state.totalPops = 0;
    state.adaptiveSpeedBoost = 0;
    state.sessionStartTs = Date.now();
    startLevel(0);
  });
  document.querySelectorAll("[data-back]").forEach((btn) => btn.addEventListener("click", () => showScene(btn.dataset.back)));

  document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
    state.settings.controlMode = els.controlModeSelect.value;
    state.settings.speedMultiplier = Number(els.speedMultiplier.value || 0.6);
    state.settings.adaptiveSpeed = Boolean(els.adaptiveSpeedToggle.checked);
    if (state.settings.controlMode === "camera") await beginCameraTracking();
    else stopCameraTracking();
    showScene("startScene");
  });

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = els.registerUserId.value.trim();
    const pw = els.registerUserPassword.value;
    if (!id || !pw) return;

    const profile = {
      patientName: document.getElementById("patientName").value.trim(),
      age: Number(document.getElementById("patientAge").value),
      gender: document.getElementById("patientGender").value,
      affectedHand: document.getElementById("affectedHand").value,
      timeSinceStroke: document.getElementById("strokeTime").value,
      sessionDate: new Date().toISOString()
    };
    const result = await registerUser({ patientId: id, password: pw, profile });
    els.authMessage.textContent = result.message || (result.ok ? "Registered. Now login." : "Registration failed.");
    if (!result.ok) return;
    els.loginPatientId.value = id;
    els.loginPassword.value = "";
    showScene("authScene");
  });

  els.playArea.addEventListener("pointermove", (e) => {
    if (state.settings.controlMode !== "camera") setCursorByPoint(e.clientX, e.clientY);
  });

  els.playArea.addEventListener("click", (e) => {
    if (e.target === els.playArea || e.target === els.trailCanvas) state.levelRuntime.misses += 1;
  });

  document.getElementById("nextLevelBtn").addEventListener("click", () => {
    if (state.currentTask) {
      els.taskText.textContent = state.currentTask.text;
      state.taskTimer = 30;
      els.taskTimer.textContent = String(state.taskTimer);
      els.taskDoneBtn.disabled = true;
      els.taskNotDoneBtn.disabled = true;
      els.startTaskBtn.disabled = false;
      if (els.taskGateMessage) els.taskGateMessage.textContent = "Complete the full timer to unlock feedback buttons.";
      showScene("taskScene");
      return;
    }
    const next = state.levelIndex + 1;
    if (next < LEVELS.length) startLevel(next);
    else renderSummary();
  });

  document.getElementById("retryLevelBtn").addEventListener("click", () => startLevel(state.levelIndex));

  document.getElementById("startTaskBtn").addEventListener("click", () => {
    clearInterval(state.taskInterval);
    els.startTaskBtn.disabled = true;
    state.taskInterval = setInterval(() => {
      state.taskTimer -= 1;
      els.taskTimer.textContent = String(Math.max(0, state.taskTimer));
      if (state.taskTimer <= 0) {
        clearInterval(state.taskInterval);
        state.taskInterval = null;
        els.taskDoneBtn.disabled = false;
        els.taskNotDoneBtn.disabled = false;
        if (els.taskGateMessage) els.taskGateMessage.textContent = "Timer completed. Please submit feedback to continue.";
      }
    }, 1000);
  });
  document.getElementById("taskDoneBtn").addEventListener("click", () => {
    if (state.taskTimer > 0) return;
    runAssignedTask(true);
  });
  document.getElementById("taskNotDoneBtn").addEventListener("click", () => {
    if (state.taskTimer > 0) return;
    runAssignedTask(false);
  });

  document.getElementById("downloadJsonBtn").addEventListener("click", () => saveBlob(`session-${Date.now()}.json`, JSON.stringify(buildSession(), null, 2), "application/json"));
  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    const s = buildSession();
    const h = "level,pops,targetPops,timeTakenSec,targetTimeSec,accuracy,assignedTask,taskCompleted";
    const rows = s.levels.map((r) => `${r.level},${r.pops},${r.targetPops},${r.timeTakenSec},${r.targetTimeSec ?? ""},${r.accuracy},${r.assignedTask},${r.taskCompleted}`);
    saveBlob(`session-${Date.now()}.csv`, [h, ...rows].join("\n"), "text/csv");
  });

  document.getElementById("restartBtn").addEventListener("click", () => showScene("startScene"));
};

const init = () => {
  if (els.appVersion) els.appVersion.textContent = VERSION;
  els.controlModeSelect.value = state.settings.controlMode;
  if (els.speedMultiplier) els.speedMultiplier.value = String(state.settings.speedMultiplier);
  if (els.speedMultiplierValue) els.speedMultiplierValue.textContent = `${state.settings.speedMultiplier.toFixed(1)}x`;
  if (els.adaptiveSpeedToggle) els.adaptiveSpeedToggle.checked = state.settings.adaptiveSpeed;
  if (els.speedMultiplier) {
    els.speedMultiplier.addEventListener("input", () => {
      els.speedMultiplierValue.textContent = `${Number(els.speedMultiplier.value).toFixed(1)}x`;
    });
  }
  attachEvents();
  showScene("portalScene");
};

window.addEventListener("beforeunload", () => stopCameraTracking());
init();
