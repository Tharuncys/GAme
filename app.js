const VERSION = "1.2.0";
const SESSION_STORAGE_KEY = "rehab-balloon-session-history";

const LEVELS = [
  { id: 1, name: "Level 1 – Basic Pop", targetPops: 10, speed: 0.75, balloonCount: 1, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 2, name: "Level 2 – Increased Speed", targetPops: 15, speed: 1.1, balloonCount: 1, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 3, name: "Level 3 – Multiple Balloons", targetPops: 18, speed: 1.1, balloonCount: 2, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 4, name: "Level 4 – Random Movement", targetPops: 20, speed: 1.35, balloonCount: 2, timeLimit: 0, enableShrink: false, shrinkFactor: 1 },
  { id: 5, name: "Level 5 – Time Pressure", targetPops: 20, speed: 1.45, balloonCount: 2, timeLimit: 45, enableShrink: false, shrinkFactor: 1 },
  { id: 6, name: "Level 6 – Shrinking Balloon", targetPops: 22, speed: 1.55, balloonCount: 2, timeLimit: 50, enableShrink: true, shrinkFactor: 0.7 },
  { id: 7, name: "Level 7 – Advanced Control", targetPops: 25, speed: 1.75, balloonCount: 3, timeLimit: 55, enableShrink: true, shrinkFactor: 0.52 }
];

const state = {
  scene: "startScene",
  settings: { controlMode: "camera" },
  patient: null,
  sessionStartTs: null,
  levelIndex: 0,
  levelRuntime: {
    targetPops: 0,
    currentPops: 0,
    timer: 0,
    levelRunning: false,
    enableShrink: false,
    shrinkFactor: 1,
    misses: 0
  },
  cursor: { x: 220, y: 220 },
  trail: [],
  balloons: [],
  reactionTimes: [],
  levelReports: [],
  totalPops: 0,
  rafId: null,
  levelStartPerf: 0,
  levelStartTs: 0
};

const els = {
  appVersion: document.getElementById("appVersion"),
  controlModeSelect: document.getElementById("controlModeSelect"),
  inputStatus: document.getElementById("inputStatus"),
  levelName: document.getElementById("levelName"),
  popCounter: document.getElementById("popCounter"),
  timerValue: document.getElementById("timerValue"),
  controlModeLabel: document.getElementById("controlModeLabel"),
  shrinkState: document.getElementById("shrinkState"),
  missCounter: document.getElementById("missCounter"),
  playArea: document.getElementById("playArea"),
  trailCanvas: document.getElementById("trailCanvas"),
  cursor: document.getElementById("cursor"),
  levelNumber: document.getElementById("levelNumber"),
  levelScore: document.getElementById("levelScore"),
  levelTime: document.getElementById("levelTime"),
  levelAccuracy: document.getElementById("levelAccuracy"),
  summaryContent: document.getElementById("summaryContent"),
  levelBreakdown: document.getElementById("levelBreakdown"),
  storageInfo: document.getElementById("storageInfo"),
  cameraPreview: document.getElementById("cameraPreview")
};

let camStream = null;
let camIntervalId = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rand = (min, max) => Math.random() * (max - min) + min;

const showScene = (sceneId) => {
  document.querySelectorAll(".scene").forEach((scene) => scene.classList.remove("active"));
  document.getElementById(sceneId).classList.add("active");
  state.scene = sceneId;
};

const currentLevel = () => LEVELS[state.levelIndex];

const resetSessionTracking = () => {
  state.levelReports = [];
  state.totalPops = 0;
  state.reactionTimes = [];
};

const resetLevelRuntime = () => {
  const cfg = currentLevel();
  state.levelRuntime.targetPops = cfg.targetPops;
  state.levelRuntime.currentPops = 0;
  state.levelRuntime.timer = cfg.timeLimit;
  state.levelRuntime.levelRunning = false;
  state.levelRuntime.enableShrink = cfg.enableShrink;
  state.levelRuntime.shrinkFactor = cfg.shrinkFactor;
  state.levelRuntime.misses = 0;
  state.trail = [];
  state.balloons.forEach((b) => b.node.remove());
  state.balloons = [];
};

const drawTrail = () => {
  const { width, height } = els.playArea.getBoundingClientRect();
  if (els.trailCanvas.width !== Math.floor(width) || els.trailCanvas.height !== Math.floor(height)) {
    els.trailCanvas.width = Math.floor(width);
    els.trailCanvas.height = Math.floor(height);
  }
  const ctx = els.trailCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.trailCanvas.width, els.trailCanvas.height);
  if (state.trail.length < 2) return;
  ctx.strokeStyle = "rgba(11,95,169,0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  state.trail.forEach((point, idx) => (idx === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
  ctx.stroke();
};

const updateHUD = () => {
  const cfg = currentLevel();
  els.levelName.textContent = cfg.name;
  els.popCounter.textContent = `${state.levelRuntime.currentPops}/${state.levelRuntime.targetPops}`;
  els.timerValue.textContent = state.levelRuntime.timer.toFixed(1);
  els.controlModeLabel.textContent = state.settings.controlMode;
  els.shrinkState.textContent = state.levelRuntime.enableShrink ? `${state.levelRuntime.shrinkFactor}x` : "off";
  els.missCounter.textContent = String(state.levelRuntime.misses);
};

const setCursorByPoint = (x, y) => {
  const area = els.playArea.getBoundingClientRect();
  state.cursor.x = clamp(x - area.left, 0, area.width);
  state.cursor.y = clamp(y - area.top, 0, area.height);
};

const pollJoystick = () => {
  const gp = navigator.getGamepads?.()[0];
  if (!gp) {
    els.inputStatus.textContent = "No joystick detected. Connect joystick or switch to camera.";
    return;
  }
  const [axX = 0, axY = 0] = gp.axes;
  state.cursor.x = clamp(state.cursor.x + axX * 9, 0, els.playArea.clientWidth);
  state.cursor.y = clamp(state.cursor.y + axY * 9, 0, els.playArea.clientHeight);
  els.inputStatus.textContent = `Joystick active: ${gp.id}`;
};

const beginCameraTracking = async () => {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    els.cameraPreview.srcObject = camStream;
    els.cameraPreview.style.display = "block";
    camIntervalId = setInterval(() => {
      if (state.settings.controlMode !== "camera" || state.scene !== "levelScene") return;
      const probe = document.createElement("canvas");
      probe.width = 64;
      probe.height = 48;
      const probeCtx = probe.getContext("2d", { willReadFrequently: true });
      probeCtx.drawImage(els.cameraPreview, 0, 0, probe.width, probe.height);
      const image = probeCtx.getImageData(0, 0, probe.width, probe.height).data;

      let sumX = 0;
      let sumY = 0;
      let brightPixels = 0;
      for (let i = 0; i < image.length; i += 4) {
        const br = (image[i] + image[i + 1] + image[i + 2]) / 3;
        if (br > 185) {
          const p = i / 4;
          sumX += p % probe.width;
          sumY += Math.floor(p / probe.width);
          brightPixels += 1;
        }
      }

      if (brightPixels > 20) {
        state.cursor.x = (sumX / brightPixels / probe.width) * els.playArea.clientWidth;
        state.cursor.y = (sumY / brightPixels / probe.height) * els.playArea.clientHeight;
        els.inputStatus.textContent = "Camera hand-motion tracking active.";
      }
    }, 60);
  } catch {
    els.inputStatus.textContent = "Camera permission denied or device unavailable.";
  }
};

const stopCameraTracking = () => {
  if (camIntervalId) clearInterval(camIntervalId);
  camIntervalId = null;
  if (camStream) camStream.getTracks().forEach((track) => track.stop());
  camStream = null;
  els.cameraPreview.style.display = "none";
};

const createBalloon = () => {
  const cfg = currentLevel();
  const node = document.getElementById("balloonTemplate").content.firstElementChild.cloneNode(true);
  const scale = cfg.enableShrink ? cfg.shrinkFactor : 1;
  const balloon = {
    node,
    x: rand(40, Math.max(41, els.playArea.clientWidth - 40)),
    y: rand(70, Math.max(71, els.playArea.clientHeight - 40)),
    vx: rand(-1, 1) * cfg.speed,
    vy: rand(-1, 1) * cfg.speed,
    scale,
    bornAt: performance.now()
  };

  node.style.left = `${balloon.x}px`;
  node.style.top = `${balloon.y}px`;
  node.style.transform = `translate(-50%, -50%) scale(${scale})`;

  node.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!state.levelRuntime.levelRunning) return;
    popBalloon(balloon);
  });

  els.playArea.appendChild(node);
  state.balloons.push(balloon);
};

const popBalloon = (balloon) => {
  const reactionTimeSec = (performance.now() - balloon.bornAt) / 1000;
  state.reactionTimes.push(reactionTimeSec);
  state.levelRuntime.currentPops += 1;
  state.totalPops += 1;
  balloon.node.classList.add("pop");
  setTimeout(() => balloon.node.remove(), 170);
  state.balloons = state.balloons.filter((b) => b !== balloon);

  if (state.levelRuntime.currentPops < state.levelRuntime.targetPops) createBalloon();
};

const buildSessionExport = () => {
  const completedLevels = state.levelReports.filter((r) => r.result === "Completed").length;
  const avgReaction = state.reactionTimes.reduce((acc, t) => acc + t, 0) / Math.max(state.reactionTimes.length, 1);
  const sessionDurationSec = (Date.now() - state.sessionStartTs) / 1000;
  const averageTimePerLevel = state.levelReports.reduce((acc, level) => acc + level.timeTakenSec, 0) / Math.max(state.levelReports.length, 1);

  return {
    patient: state.patient,
    settings: state.settings,
    totals: {
      totalLevelsCompleted: completedLevels,
      averageTimePerLevel,
      totalPops: state.totalPops,
      sessionDurationSec,
      averageReactionTimeSec: avgReaction
    },
    levels: state.levelReports
  };
};

const storeSessionInHistory = (sessionData) => {
  const prev = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]");
  prev.unshift({ savedAt: new Date().toISOString(), ...sessionData });
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(prev.slice(0, 20)));
};

const saveBlob = (filename, content, type) => {
  const file = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const finishLevel = ({ timeout = false } = {}) => {
  state.levelRuntime.levelRunning = false;
  cancelAnimationFrame(state.rafId);

  const cfg = currentLevel();
  const timeTakenSec = (Date.now() - state.levelStartTs) / 1000;
  const hitCount = state.levelRuntime.currentPops;
  const attempts = hitCount + state.levelRuntime.misses;
  const accuracy = attempts > 0 ? (hitCount / attempts) * 100 : 0;

  state.levelReports.push({
    level: cfg.id,
    levelName: cfg.name,
    targetPops: cfg.targetPops,
    pops: hitCount,
    misses: state.levelRuntime.misses,
    timeTakenSec: Number(timeTakenSec.toFixed(2)),
    accuracy: Number(accuracy.toFixed(2)),
    averageReactionTimeSec: Number((state.reactionTimes.reduce((a, b) => a + b, 0) / Math.max(1, state.reactionTimes.length)).toFixed(2)),
    result: timeout ? "Failed - Timeout" : "Completed"
  });

  els.levelNumber.textContent = `${cfg.id} / ${LEVELS.length}`;
  els.levelScore.textContent = `${hitCount}/${cfg.targetPops}`;
  els.levelTime.textContent = `${timeTakenSec.toFixed(2)}s`;
  els.levelAccuracy.textContent = `${accuracy.toFixed(2)}%`;
  showScene("levelCompleteScene");
};

const updateBalloonPositions = () => {
  state.balloons.forEach((balloon) => {
    balloon.x += balloon.vx;
    balloon.y += balloon.vy;

    if (balloon.x < 25 || balloon.x > els.playArea.clientWidth - 25) balloon.vx *= -1;
    if (balloon.y < 45 || balloon.y > els.playArea.clientHeight - 25) balloon.vy *= -1;

    const dist = Math.hypot(balloon.x - state.cursor.x, balloon.y - state.cursor.y);
    if (dist < 24 * balloon.scale) popBalloon(balloon);

    balloon.node.style.left = `${balloon.x}px`;
    balloon.node.style.top = `${balloon.y}px`;
  });
};

const gameLoop = () => {
  if (!state.levelRuntime.levelRunning) return;

  if (state.settings.controlMode === "joystick") pollJoystick();
  state.trail.push({ x: state.cursor.x, y: state.cursor.y });
  if (state.trail.length > 30) state.trail.shift();
  drawTrail();

  els.cursor.style.left = `${state.cursor.x}px`;
  els.cursor.style.top = `${state.cursor.y}px`;

  const cfg = currentLevel();
  const elapsedSec = (performance.now() - state.levelStartPerf) / 1000;
  state.levelRuntime.timer = cfg.timeLimit > 0 ? Math.max(0, cfg.timeLimit - elapsedSec) : elapsedSec;

  updateBalloonPositions();
  updateHUD();

  if (state.levelRuntime.currentPops >= state.levelRuntime.targetPops) return finishLevel({ timeout: false });
  if (cfg.timeLimit > 0 && elapsedSec >= cfg.timeLimit) return finishLevel({ timeout: true });
  state.rafId = requestAnimationFrame(gameLoop);
};

const startLevel = (index) => {
  state.levelIndex = index;
  resetLevelRuntime();
  updateHUD();

  const cfg = currentLevel();
  state.levelRuntime.levelRunning = true;
  state.levelStartTs = Date.now();
  state.levelStartPerf = performance.now();
  for (let i = 0; i < cfg.balloonCount; i += 1) createBalloon();

  showScene("levelScene");
  state.rafId = requestAnimationFrame(gameLoop);
};

const renderSummary = () => {
  const data = buildSessionExport();
  const completed = data.totals.totalLevelsCompleted;
  const progressRating = completed === LEVELS.length ? "Excellent" : completed >= 4 ? "Good" : "Needs More Practice";

  els.summaryContent.innerHTML = `
    <p><strong>Patient Name:</strong> ${data.patient.patientName}</p>
    <p><strong>Age / Gender:</strong> ${data.patient.age} / ${data.patient.gender}</p>
    <p><strong>Total Session Time:</strong> ${data.totals.sessionDurationSec.toFixed(2)}s</p>
    <p><strong>Average Reaction Time:</strong> ${data.totals.averageReactionTimeSec.toFixed(2)}s</p>
    <p><strong>Completion Status:</strong> ${completed}/${LEVELS.length} levels completed</p>
    <p><strong>Progress Rating:</strong> ${progressRating}</p>
  `;

  els.levelBreakdown.innerHTML = `<table><thead><tr><th>Level</th><th>Result</th><th>Pops</th><th>Misses</th><th>Accuracy</th><th>Time(s)</th></tr></thead><tbody>${data.levels.map((l) => `<tr><td>${l.level}</td><td>${l.result}</td><td>${l.pops}/${l.targetPops}</td><td>${l.misses}</td><td>${l.accuracy}%</td><td>${l.timeTakenSec}</td></tr>`).join("")}</tbody></table>`;

  els.storageInfo.innerHTML = `
    <h3>Where is patient data stored?</h3>
    <p>Session records are stored offline in your browser under <code>localStorage["${SESSION_STORAGE_KEY}"]</code>.</p>
    <p>When you click Download JSON/CSV, files are saved to your device Downloads folder.</p>
  `;

  storeSessionInHistory(data);
  showScene("summaryScene");
};

const handleControls = () => {
  document.getElementById("startBtn").addEventListener("click", () => showScene("patientScene"));
  document.getElementById("settingsBtn").addEventListener("click", () => showScene("settingsScene"));
  document.getElementById("exitBtn").addEventListener("click", () => alert("You can close this tab to exit."));

  document.querySelectorAll("[data-back]").forEach((btn) => btn.addEventListener("click", () => showScene(btn.dataset.back)));

  document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
    state.settings.controlMode = els.controlModeSelect.value;
    if (state.settings.controlMode === "camera") await beginCameraTracking();
    else {
      stopCameraTracking();
      els.inputStatus.textContent = "Settings saved.";
    }
    showScene("startScene");
  });

  document.getElementById("patientForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.patient = {
      patientName: document.getElementById("patientName").value.trim(),
      age: Number(document.getElementById("patientAge").value),
      gender: document.getElementById("patientGender").value,
      affectedHand: document.getElementById("affectedHand").value,
      timeSinceStroke: document.getElementById("strokeTime").value,
      sessionDate: new Date().toISOString()
    };
    state.sessionStartTs = Date.now();
    resetSessionTracking();
    startLevel(0);
  });

  els.playArea.addEventListener("pointermove", (event) => {
    if (state.settings.controlMode === "mouse" || state.settings.controlMode === "camera") setCursorByPoint(event.clientX, event.clientY);
  });

  els.playArea.addEventListener("click", (event) => {
    if (event.target === els.playArea || event.target === els.trailCanvas) {
      state.levelRuntime.misses += 1;
      updateHUD();
    }
  });

  document.getElementById("nextLevelBtn").addEventListener("click", () => {
    const nextIndex = state.levelIndex + 1;
    if (nextIndex < LEVELS.length) startLevel(nextIndex);
    else renderSummary();
  });

  document.getElementById("retryLevelBtn").addEventListener("click", () => {
    state.levelReports = state.levelReports.filter((r) => r.level !== currentLevel().id);
    startLevel(state.levelIndex);
  });

  document.getElementById("downloadJsonBtn").addEventListener("click", () => saveBlob(`session-${Date.now()}.json`, JSON.stringify(buildSessionExport(), null, 2), "application/json"));

  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    const data = buildSessionExport();
    const header = "level,result,targetPops,pops,misses,accuracy,timeTakenSec,averageReactionTimeSec";
    const rows = data.levels.map((r) => `${r.level},${r.result},${r.targetPops},${r.pops},${r.misses},${r.accuracy},${r.timeTakenSec},${r.averageReactionTimeSec}`);
    saveBlob(`session-${Date.now()}.csv`, [header, ...rows].join("\n"), "text/csv");
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    stopCameraTracking();
    showScene("startScene");
  });
};

const init = () => {
  els.appVersion.textContent = VERSION;
  els.controlModeSelect.value = state.settings.controlMode;
  handleControls();
  showScene("startScene");
};

window.addEventListener("beforeunload", () => stopCameraTracking());
init();
