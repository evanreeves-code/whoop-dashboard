const fetch = require('node-fetch');
const db = require('./db');

const WHOOP_API = 'https://api.prod.whoop.com/developer';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

async function getValidToken() {
  const row = db.prepare('SELECT * FROM tokens WHERE id = 1').get();
  if (!row) return null;

  if (Date.now() >= row.expires_at - 5 * 60 * 1000) {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: row.refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const expires_at = Date.now() + data.expires_in * 1000;

    db.prepare(`
      UPDATE tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = 1
    `).run(data.access_token, data.refresh_token, expires_at);

    return data.access_token;
  }

  return row.access_token;
}

async function whoopGet(path, token) {
  const res = await fetch(`${WHOOP_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

module.exports = { getValidToken, whoopGet };
