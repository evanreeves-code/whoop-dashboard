const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const SCOPES = 'offline read:recovery read:cycles read:sleep read:workout read:body_measurement read:profile';

function getRedirectUri() {
  if (process.env.APP_URL) return `${process.env.APP_URL}/auth/callback`;
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/auth/callback`;
}

// GET /auth/whoop — start OAuth flow
router.get('/whoop', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in DB so we can verify it on callback
  db.exec(`CREATE TABLE IF NOT EXISTS oauth_state (state TEXT PRIMARY KEY, created_at INTEGER)`);
  db.prepare('DELETE FROM oauth_state').run();
  db.prepare('INSERT INTO oauth_state (state, created_at) VALUES (?, ?)').run(state, Date.now());

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  res.redirect(`${WHOOP_AUTH_URL}?${params}`);
});

// GET /auth/callback — exchange code for tokens
router.get('/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;
  if (error || !code) {
    console.error('Whoop OAuth error:', error, error_description);
    return res.redirect('/?auth=error');
  }

  // Verify state
  db.exec(`CREATE TABLE IF NOT EXISTS oauth_state (state TEXT PRIMARY KEY, created_at INTEGER)`);
  const stored = db.prepare('SELECT state FROM oauth_state WHERE state = ?').get(state);
  if (!stored) {
    console.error('OAuth state mismatch');
    return res.redirect('/?auth=error');
  }
  db.prepare('DELETE FROM oauth_state').run();

  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Token exchange failed:', text);
      return res.redirect('/?auth=error');
    }

    const data = await response.json();
    const expires_at = Date.now() + data.expires_in * 1000;

    db.prepare(`
      INSERT INTO tokens (id, access_token, refresh_token, expires_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at
    `).run(data.access_token, data.refresh_token, expires_at);

    res.redirect('/?auth=success');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect('/?auth=error');
  }
});

// GET /auth/status — check if authenticated
router.get('/status', (req, res) => {
  const row = db.prepare('SELECT expires_at FROM tokens WHERE id = 1').get();
  res.json({ authenticated: !!row });
});

// GET /auth/logout — clear tokens
router.get('/logout', (req, res) => {
  db.prepare('DELETE FROM tokens WHERE id = 1').run();
  res.json({ ok: true });
});

module.exports = router;
