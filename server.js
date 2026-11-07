require('dotenv').config();
const express = require('express');
const https = require('https');
const app = express();

app.use(express.json());

const API_KEY = process.env.API_KEY;

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ── Config state ──────────────────────────────────────────────────────────────
let config = {
  filterEnabled: true,
  allowedGroups: []
};

// ── Routes ────────────────────────────────────────────────────────────────────

// Bot reads this every 5 minutes
app.get('/config', auth, (req, res) => {
  res.json(config);
});

// You POST to this to update allowed groups or toggle the filter
app.post('/config', auth, (req, res) => {
  const { filterEnabled, allowedGroups } = req.body;
  if (typeof filterEnabled === 'boolean') config.filterEnabled = filterEnabled;
  if (Array.isArray(allowedGroups)) config.allowedGroups = allowedGroups;
  res.json({ ok: true, config });
});

// Add a single group without replacing the whole list
app.post('/config/add', auth, (req, res) => {
  const { groupJid } = req.body;
  if (!groupJid) return res.status(400).json({ error: 'groupJid required' });
  if (!config.allowedGroups.includes(groupJid)) {
    config.allowedGroups.push(groupJid);
  }
  res.json({ ok: true, config });
});

// Remove a single group
app.post('/config/remove', auth, (req, res) => {
  const { groupJid } = req.body;
  if (!groupJid) return res.status(400).json({ error: 'groupJid required' });
  config.allowedGroups = config.allowedGroups.filter(g => g !== groupJid);
  res.json({ ok: true, config });
});

// Health check — no auth needed
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Keep Render awake (pings itself every 14 minutes) ─────────────────────────
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL) {
  setInterval(() => {
    https.get(SELF_URL + '/health', () => {})
      .on('error', (e) => console.warn('[Ping] Self-ping failed:', e.message));
  }, 14 * 60 * 1000);
  console.log('[Ping] Self-ping enabled for', SELF_URL);
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Config server running on port ${PORT}`);
  console.log(`Filter enabled: ${config.filterEnabled}`);
});
