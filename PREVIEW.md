# Preview

## Option A (recommended): Run with local DB (Node + SQLite)

```bash
npm install
npm start
# open http://127.0.0.1:4173
```

This creates/uses a local SQLite database file:
- `rehab_local.db`

## Option B: Static preview only (no backend DB)

```bash
python3 -m http.server 4173
# open http://127.0.0.1:4173
```

In Option B, login/session data falls back to browser localStorage only.

For the final submission, Unity scenes/scripts under `Assets/Scripts` are the canonical implementation.
