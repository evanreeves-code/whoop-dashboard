const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/sessions — all logged basketball sessions
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY date DESC LIMIT 50').all();
  res.json(rows);
});

// POST /api/sessions — log a new session
router.post('/', (req, res) => {
  const { date, type, duration_minutes, notes } = req.body;
  if (!date || !type) {
    return res.status(400).json({ error: 'date and type are required' });
  }

  const result = db.prepare(`
    INSERT INTO sessions (date, type, duration_minutes, notes)
    VALUES (?, ?, ?, ?)
  `).run(date, type, duration_minutes ?? null, notes ?? null);

  res.json({ id: result.lastInsertRowid });
});

// DELETE /api/sessions/:id — remove a session
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
