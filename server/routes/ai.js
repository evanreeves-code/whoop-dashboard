const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
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

function calcBedtime(sleepNeedMs, wakeTime = '07:00') {
  if (!sleepNeedMs) return null;
  const [wh, wm] = wakeTime.split(':').map(Number);
  const wakeMins = wh * 60 + wm;
  const sleepNeedMins = Math.round(sleepNeedMs / 1000 / 60);
  let bedMins = wakeMins - sleepNeedMins;
  if (bedMins < 0) bedMins += 24 * 60;
  return fmt12(bedMins);
}

// Merges recovery + cycle records and computes trend stats
function analyzeHistory(recoveries, cycles) {
  const recoveryByCycle = Object.fromEntries(recoveries.map(r => [r.cycle_id, r]));

  const merged = cycles
    .filter(c => c.end !== null && recoveryByCycle[c.id])
    .map(c => ({
      date: c.start?.slice(0, 10),
      strain: c.score?.strain ?? null,
      recovery: recoveryByCycle[c.id]?.score?.recovery_score ?? null,
      hrv: recoveryByCycle[c.id]?.score?.hrv_rmssd_milli
        ? Math.round(recoveryByCycle[c.id].score.hrv_rmssd_milli) : null,
    }))
    .filter(d => d.recovery != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first

  if (merged.length < 3) return null;

  const last7  = merged.slice(0, Math.min(7,  merged.length));
  const prev7  = merged.slice(7, Math.min(14, merged.length));
  const last30 = merged.slice(0, Math.min(30, merged.length));

  const avgRecovery = arr =>
    arr.length ? (arr.reduce((s, d) => s + d.recovery, 0) / arr.length).toFixed(0) : null;

  const avgHRV = arr => {
    const vals = arr.filter(d => d.hrv).map(d => d.hrv);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(0) : null;
  };

  const avgRecovery7  = avgRecovery(last7);
  const avgRecovery30 = avgRecovery(last30);
  const avgHRV7       = avgHRV(last7);
  const avgHRVprev7   = avgHRV(prev7);

  // HRV trend
  let hrvTrend = null;
  if (avgHRV7 && avgHRVprev7) {
    const diff = Number(avgHRV7) - Number(avgHRVprev7);
    if (diff > 3)       hrvTrend = `up +${diff}ms vs prior week (positive sign)`;
    else if (diff < -3) hrvTrend = `down ${diff}ms vs prior week (watch your load)`;
    else                hrvTrend = 'stable week over week';
  }

  // Recovery trend: last 7 vs the 7 before that
  let recoveryTrend = null;
  if (prev7.length >= 3) {
    const diff = Number(avgRecovery7) - Number(avgRecovery(prev7));
    if (diff > 5)       recoveryTrend = `improving (+${diff}% vs prior week)`;
    else if (diff < -5) recoveryTrend = `declining (${diff}% vs prior week — may need more rest)`;
    else                recoveryTrend = 'stable week over week';
  }

  // High strain days (15+) and next-day recovery
  const postHighStrainRecoveries = [];
  for (let i = 0; i < Math.min(last30.length - 1, 29); i++) {
    if (last30[i].strain >= 15) {
      postHighStrainRecoveries.push(last30[i + 1].recovery);
    }
  }
  const avgPostHighStrain = postHighStrainRecoveries.length
    ? (postHighStrainRecoveries.reduce((s, v) => s + v, 0) / postHighStrainRecoveries.length).toFixed(0)
    : null;

  return {
    avgRecovery7,
    avgRecovery30,
    avgHRV7,
    hrvTrend,
    recoveryTrend,
    avgPostHighStrain,
    highStrainCount: postHighStrainRecoveries.length,
    dataPoints: merged.length,
  };
}

// GET /api/brief — plain text morning summary for iOS Shortcuts / Apple Watch
router.get('/brief', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.status(401).send('Not authenticated. Connect Whoop first.');

    const [recoveryData, sleepData, cycleData] = await Promise.all([
      whoopGet('/v2/recovery?limit=1', token),
      whoopGet('/v2/activity/sleep?limit=1', token),
      whoopGet('/v1/cycle?limit=2', token),
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

    let dot, readinessLabel;
    if (recoveryScore >= 67)      { dot = '🟢'; readinessLabel = 'Go hard'; }
    else if (recoveryScore >= 34) { dot = '🟡'; readinessLabel = 'Moderate'; }
    else                          { dot = '🔴'; readinessLabel = 'Take it easy'; }

    const day = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const lines = [
      `${day}`,
      `${dot} Recovery ${recoveryScore}% · ${readinessLabel}`,
      `❤️ HRV ${hrv ?? '--'}ms · RHR ${rhr ?? '--'}bpm`,
      `😴 Sleep ${sleepPerf != null ? Math.round(sleepPerf) + '%' : '--'} · Strain ${strain != null ? strain.toFixed(1) : '--'}`,
      `⚡ Target ${strainTarget}`,
      bedTime ? `🛏 Bed ${bedTime}` : null,
    ].filter(Boolean);

    res.type('text/plain').send(lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// POST /api/ai-suggest — streams a personalized Claude brief with historical pattern analysis
// Body: { routine: string[] }
router.post('/ai-suggest', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not set in .env — add your key and restart the server.',
    });
  }

  const { routine = [] } = req.body;

  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    // Fetch today + up to 60 days of history in parallel
    const [recoveryData, sleepData, cycleData] = await Promise.all([
      whoopGet('/v2/recovery?limit=60', token),
      whoopGet('/v2/activity/sleep?limit=1', token),
      whoopGet('/v1/cycle?limit=60', token),
    ]);

    const recoveries = recoveryData.records ?? [];
    const cycles     = cycleData.records ?? [];
    const sleep      = sleepData.records?.[0];

    // Today's snapshot (most recent records)
    const todayRecovery = recoveries[0];
    const todayCycle    = cycles.find(c => c.end !== null) ?? cycles[0];

    const recoveryScore = todayRecovery?.score?.recovery_score ?? 0;
    const hrv           = todayRecovery?.score?.hrv_rmssd_milli
      ? Math.round(todayRecovery.score.hrv_rmssd_milli) : null;
    const rhr           = todayRecovery?.score?.resting_heart_rate ?? null;
    const sleepPerf     = sleep?.score?.sleep_performance_percentage ?? null;
    const strain        = todayCycle?.score?.strain ?? null;
    const strainTarget  = (recoveryScore * 0.21).toFixed(1);
    const bedTime       = calcBedtime(sleep?.score?.sleep_needed?.baseline_milli);

    let readinessLabel;
    if (recoveryScore >= 67)      readinessLabel = 'Green (well-recovered)';
    else if (recoveryScore >= 34) readinessLabel = 'Yellow (moderate)';
    else                          readinessLabel = 'Red (under-recovered)';

    // Historical pattern analysis
    const history = analyzeHistory(recoveries, cycles);

    const historySection = history ? [
      `Historical Patterns (${history.dataPoints} days of data):`,
      `- 7-day avg recovery: ${history.avgRecovery7}% | 30-day avg: ${history.avgRecovery30}%`,
      history.recoveryTrend ? `- Recovery trend: ${history.recoveryTrend}` : null,
      history.avgHRV7 ? `- HRV: ${history.avgHRV7}ms 7-day avg (${history.hrvTrend ?? 'no prior week data'})` : null,
      history.avgPostHighStrain
        ? `- After high-strain days (15+): avg next-day recovery is ${history.avgPostHighStrain}% (seen ${history.highStrainCount}x in last 30 days)`
        : null,
    ].filter(Boolean).join('\n') : '';

    const routineText = routine.length > 0
      ? routine.map(item => `- ${item}`).join('\n')
      : '(no routine items set)';

    const prompt = `You are a concise personal health coach with access to this athlete's real Whoop data. Give a short, personalized morning brief.

Today's Data:
- Recovery: ${recoveryScore}% — ${readinessLabel}
- HRV: ${hrv ?? 'unavailable'}ms
- Resting HR: ${rhr ?? 'unavailable'} bpm
- Sleep Performance: ${sleepPerf != null ? Math.round(sleepPerf) + '%' : 'unavailable'}
- Yesterday's Strain: ${strain != null ? Number(strain).toFixed(1) : 'unavailable'}
- Suggested Strain Target: ${strainTarget}
- Recommended Bedtime: ${bedTime ?? 'unavailable'}
${historySection ? '\n' + historySection : ''}

Morning Routine:
${routineText}

Write a brief with these sections (total under 160 words):
1. One sentence on how they're looking today, referencing their personal trends where relevant.
2. Specific workout intensity or activity recommendation based on today's numbers and their historical patterns.
3. A natural reminder of their morning routine items.
4. One short motivating closing line.

Be direct, personal, and reference actual numbers.`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const text of stream.textStream) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
