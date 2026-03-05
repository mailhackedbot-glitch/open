const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const PANEL_URL = 'https://preview-sandbox--69a8fb9b56d27fc035ce0d04.base44.app';
const API_KEY = process.env.PANEL_API_KEY; // set this in Railway env vars

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY
};

// ✅ Roblox calls this when a player joins
app.post('/player-join', async (req, res) => {
  const { userId, username, displayName } = req.body;
  if (req.headers['x-roblox-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const existing = await fetch(`${PANEL_URL}/api/apps/entities/Player?user_id=${userId}`, { headers });
  const players = await existing.json();

  if (players.length > 0) {
    await fetch(`${PANEL_URL}/api/apps/entities/Player/${players[0].id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ status: 'online', last_seen: new Date().toISOString() })
    });
  } else {
    await fetch(`${PANEL_URL}/api/apps/entities/Player`, {
      method: 'POST', headers,
      body: JSON.stringify({
        user_id: userId, username, display_name: displayName || username,
        status: 'online', join_date: new Date().toISOString(),
        last_seen: new Date().toISOString(), warnings: 0
      })
    });
  }
  res.json({ ok: true });
});

// ✅ Roblox calls this when a player leaves
app.post('/player-leave', async (req, res) => {
  const { userId } = req.body;
  if (req.headers['x-roblox-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const existing = await fetch(`${PANEL_URL}/api/apps/entities/Player?user_id=${userId}`, { headers });
  const players = await existing.json();
  if (players.length > 0 && players[0].status === 'online') {
    await fetch(`${PANEL_URL}/api/apps/entities/Player/${players[0].id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() })
    });
  }
  res.json({ ok: true });
});

// ✅ Roblox polls this every 5s for commands to execute
app.get('/commands', async (req, res) => {
  if (req.headers['x-roblox-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const r = await fetch(`${PANEL_URL}/api/apps/entities/PendingCommand?status=pending`, { headers });
  const commands = await r.json();

  // Mark them as executed so they don't repeat
  for (const cmd of commands) {
    await fetch(`${PANEL_URL}/api/apps/entities/PendingCommand/${cmd.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ status: 'executed' })
    });
  }
  res.json(commands);
});

// ✅ Check if a player is blacklisted (call on join)
app.get('/blacklist/:userId', async (req, res) => {
  if (req.headers['x-roblox-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const r = await fetch(`${PANEL_URL}/api/apps/entities/BlacklistEntry?target_id=${req.params.userId}&status=active`, { headers });
  const entries = await r.json();
  res.json({ banned: entries.length > 0, entry: entries[0] || null });
});

app.listen(process.env.PORT || 3000, () => console.log('RBX Bridge running'));
