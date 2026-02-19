const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 4173;
const DB_PATH = path.join(__dirname, 'rehab_local.db');
const db = new sqlite3.Database(DB_PATH);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    patient_id TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    profile_json TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run('PRAGMA table_info(users)', (err) => {
    if (err) return;
    db.all('PRAGMA table_info(users)', (e, rows) => {
      if (e) return;
      const hasProfile = rows.some((r) => r.name === 'profile_json');
      if (!hasProfile) db.run('ALTER TABLE users ADD COLUMN profile_json TEXT');
    });
  });

  db.run(`CREATE TABLE IF NOT EXISTS baselines (
    patient_id TEXT PRIMARY KEY,
    baseline_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    date_key TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    session_json TEXT NOT NULL
  )`);
});

app.post('/api/register', (req, res) => {
  const { patientId, password, profile } = req.body || {};
  if (!patientId || !password) return res.status(400).json({ ok: false, message: 'Missing fields' });

  db.get('SELECT patient_id FROM users WHERE patient_id = ?', [patientId], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'DB error' });
    if (row) return res.json({ ok: false, message: 'User exists. Please login.' });

    db.run('INSERT INTO users(patient_id, password, profile_json, created_at) VALUES(?,?,?,?)', [patientId, password, JSON.stringify(profile || null), new Date().toISOString()], (insErr) => {
      if (insErr) return res.status(500).json({ ok: false, message: 'Unable to register' });
      res.json({ ok: true, message: 'Registered. Now login.' });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { patientId, password } = req.body || {};
  if (!patientId || !password) return res.status(400).json({ ok: false, message: 'Missing fields' });

  db.get('SELECT password, profile_json FROM users WHERE patient_id = ?', [patientId], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'DB error' });
    if (!row || row.password !== password) return res.json({ ok: false, message: 'Invalid credentials.' });
    let profile = null;
    try { profile = row.profile_json ? JSON.parse(row.profile_json) : null; } catch {}
    res.json({ ok: true, profile });
  });
});

app.get('/api/profile', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ ok: false });
  db.get('SELECT profile_json FROM users WHERE patient_id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ ok: false });
    let profile = null;
    try { profile = row?.profile_json ? JSON.parse(row.profile_json) : null; } catch {}
    res.json({ ok: true, profile });
  });
});

app.get('/api/baseline', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ ok: false });

  db.get('SELECT baseline_json FROM baselines WHERE patient_id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ ok: false });
    const baseline = row ? JSON.parse(row.baseline_json) : {};
    res.json({ ok: true, baseline });
  });
});

app.post('/api/baseline', (req, res) => {
  const { userId, baseline } = req.body || {};
  if (!userId || !baseline) return res.status(400).json({ ok: false });

  db.run(
    `INSERT INTO baselines(patient_id, baseline_json, updated_at) VALUES(?,?,?)
     ON CONFLICT(patient_id) DO UPDATE SET baseline_json=excluded.baseline_json, updated_at=excluded.updated_at`,
    [userId, JSON.stringify(baseline), new Date().toISOString()],
    (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true });
    }
  );
});

app.post('/api/session', (req, res) => {
  const session = req.body;
  if (!session?.userId || !session?.dateKey) return res.status(400).json({ ok: false });

  db.run(
    'INSERT INTO sessions(patient_id, date_key, saved_at, session_json) VALUES(?,?,?,?)',
    [session.userId, session.dateKey, session.savedAt || new Date().toISOString(), JSON.stringify(session)],
    (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true });
    }
  );
});

app.get('/api/daily-activity', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ ok: false });
  const date = new Date().toISOString().slice(0, 10);

  db.all('SELECT session_json FROM sessions WHERE patient_id = ? AND date_key = ?', [userId, date], (err, rows) => {
    if (err) return res.status(500).json({ ok: false });
    const sessions = rows.map((r) => JSON.parse(r.session_json));
    const levelsToday = sessions.reduce((a, s) => a + (s.totals?.totalLevelsCompleted || 0), 0);
    const tasksDoneToday = sessions.reduce((a, s) => a + (s.taskStats?.completed || 0), 0);
    res.json({ ok: true, date, sessionsToday: sessions.length, levelsToday, tasksDoneToday });
  });
});

app.listen(PORT, () => {
  console.log(`Rehab app running on http://127.0.0.1:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH}`);
});
