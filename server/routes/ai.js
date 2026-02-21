const express = require('express');
const { getValidToken, whoopGet } = require('../whoop-client');

const router = express.Router();

function fmt12(bedMins) {
  if (bedMins == null) return null;
  const bh = Math.floor(bedMins / 60) % 24;
  const bm = bedMins % 60;
  const period = bh >= 12 ? 'PM' : 'AM';
  const h12 = bh % 12 || 12;
  return `${h12}:${String(bm).padStart(2, '0')} ${period}`;
}

function calcBedtime(sleepNeedMs, wakeTime = '08:00') {
  if (!sleepNeedMs) return null;
  const [wh, wm] = wakeTime.split(':').map(Number);
  const wakeMins = wh * 60 + wm;
  const sleepNeedMins = Math.round(sleepNeedMs / 1000 / 60);
  let bedMins = wakeMins - sleepNeedMins;
  if (bedMins < 0) bedMins += 24 * 60;
  return fmt12(bedMins);
}

// GET /api/brief — plain text morning summary for iOS Shortcuts / Apple Watch
router.get('/brief', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).send('Not authenticated. Connect Whoop first.');

    const [recoveryData, sleepData, cycleData, historyData] = await Promise.all([
      whoopGet('/v2/recovery?limit=1', token),
      whoopGet('/v2/activity/sleep?limit=1', token),
      whoopGet('/v1/cycle?limit=2', token),
      whoopGet('/v2/recovery?limit=14', token),
    ]);

    const recovery = recoveryData.records?.[0];
    const sleep    = sleepData.records?.[0];
    const cycles   = cycleData.records ?? [];
    const cycle    = cycles.find(r => r.end !== null) ?? cycles[0] ?? null;

    const recoveryScore = recovery?.score?.recovery_score ?? 0;
    const hrv           = recovery?.score?.hrv_rmssd_milli ? Math.round(recovery.score.hrv_rmssd_milli) : null;
    const rhr           = recovery?.score?.resting_heart_rate ?? null;
    const sleepPerf     = sleep?.score?.sleep_performance_percentage ?? null;
    const strain        = cycle?.score?.strain ?? null;
    const strainTarget  = (recoveryScore * 0.21).toFixed(1);
    const bedTime       = calcBedtime(sleep?.score?.sleep_needed?.baseline_milli);

    const hrvHistory = historyData.records ?? [];
    const hrvValues  = hrvHistory.filter(r => r.score?.hrv_rmssd_milli).map(r => Math.round(r.score.hrv_rmssd_milli));
    const avgHRV     = hrvValues.length ? Math.round(hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length) : null;
    const hrvDiff    = hrv != null && avgHRV != null ? hrv - avgHRV : null;

    let dot, readinessLabel;
    if (recoveryScore >= 67)      { dot = '🟢'; readinessLabel = 'Go hard'; }
    else if (recoveryScore >= 34) { dot = '🟡'; readinessLabel = 'Moderate'; }
    else                          { dot = '🔴'; readinessLabel = 'Take it easy'; }

    const day = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const lines = [
      `${day}`,
      `${dot} Recovery ${recoveryScore}% · ${readinessLabel}`,
      `❤️ HRV ${hrv ?? '--'}ms${hrvDiff != null ? ` (${hrvDiff > 0 ? '+' : ''}${hrvDiff} vs avg)` : ''} · RHR ${rhr ?? '--'}bpm`,
      `😴 Sleep ${sleepPerf != null ? Math.round(sleepPerf) + '%' : '--'} · Strain ${strain != null ? strain.toFixed(1) : '--'}`,
      `⚡ Strain Target ${strainTarget}`,
      bedTime ? `🛏 Bed ${bedTime}` : null,
    ].filter(Boolean);

    res.type('text/plain').send(lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;
