const express = require('express');
const { getValidToken, whoopGet } = require('../whoop-client');

const router = express.Router();

// GET /api/recovery — latest recovery cycle
router.get('/recovery', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v2/recovery?limit=1', token);
    res.json(data.records?.[0] ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sleep — latest sleep record
router.get('/sleep', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v2/activity/sleep?limit=1', token);
    res.json(data.records?.[0] ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workout — yesterday's workouts
router.get('/workout', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v2/activity/workout?limit=5', token);
    res.json(data.records ?? []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cycle — latest cycle (for yesterday's strain)
router.get('/cycle', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v1/cycle?limit=2', token);
    const records = data.records ?? [];
    const completed = records.find(r => r.end !== null) ?? records[0] ?? null;
    res.json(completed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weekly — last 7 days of cycles + recoveries for chart
router.get('/weekly', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const [cycleData, recoveryData] = await Promise.all([
      whoopGet('/v1/cycle?limit=7', token),
      whoopGet('/v2/recovery?limit=7', token),
    ]);

    const cycles = cycleData.records ?? [];
    const recoveries = recoveryData.records ?? [];

    const recoveryMap = Object.fromEntries(recoveries.map(r => [r.cycle_id, r.score?.recovery_score]));
    const merged = cycles.map(c => ({
      ...c,
      recovery_score: recoveryMap[c.id] ?? null,
    }));

    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
