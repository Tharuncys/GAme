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
  settings: { controlMode: "camera" },
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
  cameraGesture: { unlocked: false, holdStart: 0 }
};

const els = {
  appVersion: document.getElementById("appVersion"),
  loginPatientId: document.getElementById("loginPatientId"),
  loginPassword: document.getElementById("loginPassword"),
  openRegisterBtn: document.getElementById("openRegisterBtn"),
  registerUserId: document.getElementById("registerUserId"),
  registerUserPassword: document.getElementById("registerUserPassword"),
  authMessage: document.getElementById("authMessage"),
  activePatientLabel: document.getElementById("activePatientLabel"),
  dailyActivityPanel: document.getElementById("dailyActivityPanel"),
  controlModeSelect: document.getElementById("controlModeSelect"),
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
  summaryContent: document.getElementById("summaryContent"),
  analyticsChart: document.getElementById("analyticsChart"),
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
    levelsToday: today.reduce((a, s) => a + s.totals.totalLevelsCompleted, 0),
    tasksDoneToday: today.reduce((a, s) => a + s.taskStats.completed, 0),
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
  els.dailyActivityPanel.innerHTML = `
    <h3>Daily Game Activity</h3>
    <p>Date: <strong>${daily.date}</strong></p>
    <p>Sessions today: <strong>${daily.sessionsToday}</strong></p>
    <p>Total levels completed today: <strong>${daily.levelsToday}</strong></p>
    <p>Therapeutic tasks completed today: <strong>${daily.tasksDoneToday}</strong></p>
  `;
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
    vx: rand(-1, 1) * cfg.speed,
    vy: rand(-1, 1) * cfg.speed,
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
  const target = state.baselineTimes[levelId];
  if (!target) {
    state.baselineTimes[levelId] = timeTaken;
    await persistBaseline(state.activeUserId, state.baselineTimes);
    return null;
  }
  if (timeTaken <= target) return null;
  return {
    levelId,
    target,
    actual: timeTaken,
    timer: 30,
    text: `You exceeded target time (${target.toFixed(1)}s). Please perform wrist hold-and-release activity for 30 seconds.`
  };
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

const drawAnalyticsChart = (session) => {
  const canvas = els.analyticsChart;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4faff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barW = 40;
  const gap = 50;
  const max = Math.max(...session.levels.map((l) => Math.max(l.timeTakenSec, l.targetTimeSec || 0)), 1);

  session.levels.forEach((l, i) => {
    const x = 40 + i * (barW + gap);
    const h1 = (l.timeTakenSec / max) * 200;
    const h2 = ((l.targetTimeSec || l.timeTakenSec) / max) * 200;
    ctx.fillStyle = "#4c8bf5";
    ctx.fillRect(x, 240 - h1, barW, h1);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x + barW + 4, 240 - h2, barW, h2);
    ctx.fillStyle = "#123";
    ctx.fillText(`L${l.level}`, x + 10, 258);
  });
  ctx.fillStyle = "#4c8bf5"; ctx.fillRect(560, 30, 14, 14); ctx.fillStyle = "#123"; ctx.fillText("Actual Time", 580, 42);
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(560, 52, 14, 14); ctx.fillStyle = "#123"; ctx.fillText("Target Time", 580, 64);
};

const buildSession = () => {
  const levelsCompleted = state.levelReports.length;
  const tasksAssigned = state.levelReports.filter((l) => l.assignedTask).length;
  const tasksCompleted = state.levelReports.filter((l) => l.taskCompleted).length;
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
    levels: state.levelReports,
    savedAt: new Date().toISOString(),
  };
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
  const session = buildSession();
  await saveSessionRemote(session);

  els.summaryContent.innerHTML = `
    <p><strong>Patient:</strong> ${session.patient.patientName} (${session.userId})</p>
    <p><strong>Session Time:</strong> ${session.totals.sessionDurationSec.toFixed(1)}s</p>
    <p><strong>Levels Completed:</strong> ${session.totals.totalLevelsCompleted}/7</p>
    <p><strong>Tasks Assigned/Completed:</strong> ${session.taskStats.assigned}/${session.taskStats.completed}</p>
  `;

  drawAnalyticsChart(session);
  els.storageInfo.innerHTML = `<p>Stored in browser localStorage: <code>${SESSION_STORAGE_KEY}</code>, user profiles: <code>${USER_STORAGE_KEY}</code>, level baselines: <code>${LEVEL_BASELINE_KEY}</code>.</p>`;
  await updateDailyPanel();
  showScene("summaryScene");
};

const attachEvents = () => {
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
    showScene("authScene");
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
    state.sessionStartTs = Date.now();
    startLevel(0);
  });
  document.querySelectorAll("[data-back]").forEach((btn) => btn.addEventListener("click", () => showScene(btn.dataset.back)));

  document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
    state.settings.controlMode = els.controlModeSelect.value;
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
    state.taskInterval = setInterval(() => {
      state.taskTimer -= 1;
      els.taskTimer.textContent = String(Math.max(0, state.taskTimer));
      if (state.taskTimer <= 0) {
        clearInterval(state.taskInterval);
      }
    }, 1000);
  });
  document.getElementById("taskDoneBtn").addEventListener("click", () => runAssignedTask(true));
  document.getElementById("taskNotDoneBtn").addEventListener("click", () => runAssignedTask(false));

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
  attachEvents();
  showScene("authScene");
};

window.addEventListener("beforeunload", () => stopCameraTracking());
init();
