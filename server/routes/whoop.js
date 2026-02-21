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

// GET /api/ready — returns true once Whoop has processed today's recovery score
router.get('/ready', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.json({ ready: false });
    const data = await whoopGet('/v2/recovery?limit=1', token);
    const score = data.records?.[0]?.score?.recovery_score;
    res.json({ ready: score != null && score > 0 });
  } catch {
    res.json({ ready: false });
  }
});

// GET /api/strength — recent strength training sessions from Whoop
router.get('/strength', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v2/activity/workout?limit=20', token);
    const all = data.records ?? [];

    const keywords = ['weight', 'strength', 'power', 'functional', 'crossfit', 'resistance', 'lift'];
    const strength = all.filter(w => keywords.some(k => (w.sport_name || '').toLowerCase().includes(k)));

    res.json(strength.length > 0 ? strength : all.slice(0, 6));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — 30-day averages for HRV and recovery
router.get('/stats', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = await whoopGet('/v2/recovery?limit=30', token);
    const recoveries = data.records ?? [];

    const hrvValues = recoveries
      .filter(r => r.score?.hrv_rmssd_milli)
      .map(r => Math.round(r.score.hrv_rmssd_milli));

    const recoveryValues = recoveries
      .filter(r => r.score?.recovery_score != null)
      .map(r => r.score.recovery_score);

    const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

    res.json({
      avgHRV: avg(hrvValues),
      avgRecovery: avg(recoveryValues),
      dataPoints: recoveries.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
