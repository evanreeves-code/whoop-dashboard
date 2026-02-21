const { useState, useEffect, useRef } = React;

// ─── Helpers ───────────────────────────────────────────────────────────────

function readiness(score) {
  if (score >= 67) return { label: 'Green', color: 'green', text: 'Good day to go hard', bg: 'bg-green-900/40', border: 'border-green-500/50', dot: 'bg-green-400' };
  if (score >= 34) return { label: 'Yellow', color: 'yellow', text: 'Moderate effort — listen to your body', bg: 'bg-yellow-900/40', border: 'border-yellow-500/50', dot: 'bg-yellow-400' };
  return { label: 'Red', color: 'red', text: 'Take it easy today', bg: 'bg-red-900/40', border: 'border-red-500/50', dot: 'bg-red-400' };
}

function strainTarget(recoveryScore) {
  return (recoveryScore * 0.21).toFixed(1);
}

function sleepRecommendation(sleepNeedMs, wakeTime = '07:00') {
  if (!sleepNeedMs) return null;
  const [wh, wm] = wakeTime.split(':').map(Number);
  const wakeMins = wh * 60 + wm;
  const sleepNeedMins = Math.round(sleepNeedMs / 1000 / 60);
  let bedMins = wakeMins - sleepNeedMins;
  if (bedMins < 0) bedMins += 24 * 60;
  const bh = Math.floor(bedMins / 60) % 24;
  const bm = bedMins % 60;
  const period = bh >= 12 ? 'PM' : 'AM';
  const h12 = bh % 12 || 12;
  return `${h12}:${String(bm).padStart(2, '0')} ${period}`;
}

function formatDuration(ms) {
  if (!ms) return '--';
  const mins = Math.round(ms / 1000 / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt(val, unit = '') {
  if (val === null || val === undefined) return '--';
  return `${Math.round(val)}${unit}`;
}

const DEFAULT_ROUTINE = [
  { text: 'Drink water', done: false },
  { text: 'Stretch 10 min', done: false },
  { text: 'Cold shower', done: false },
  { text: 'Journal', done: false },
  { text: 'Review goals', done: false },
];

function loadRoutine() {
  try {
    const stored = localStorage.getItem('morning-routine');
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_ROUTINE;
}

// ─── Components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="spinner w-8 h-8 rounded-full border-2 border-slate-600 border-t-blue-400" />
    </div>
  );
}

function ConnectScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Morning Dashboard</h1>
        <p className="text-slate-400 text-sm">Connect your Whoop to get started</p>
      </div>
      <a
        href="/auth/whoop"
        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
      >
        Connect Whoop
      </a>
    </div>
  );
}

function ReadinessBanner({ score, avgRecovery }) {
  const r = readiness(score);
  const diff = avgRecovery != null ? score - avgRecovery : null;
  const trendColor = diff == null ? '' : diff > 5 ? 'text-green-400' : diff < -5 ? 'text-red-400' : 'text-slate-400';
  const trendSymbol = diff == null ? '' : diff > 5 ? '↑' : diff < -5 ? '↓' : '→';

  return (
    <div className={`card rounded-2xl p-4 ${r.bg} border ${r.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${r.dot} flex-shrink-0`} />
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Today's Readiness</p>
          <p className="text-white font-semibold mt-0.5">{r.text}</p>
          {diff != null && (
            <p className={`text-xs mt-0.5 ${trendColor}`}>
              {diff > 0 ? '+' : ''}{diff}% vs your avg
            </p>
          )}
        </div>
        <div className="ml-auto text-right">
          <span className="text-2xl font-bold text-white">{score}%</span>
          {trendSymbol && <span className={`text-lg font-bold ml-1 ${trendColor}`}>{trendSymbol}</span>}
        </div>
      </div>
    </div>
  );
}

function TrendArrow({ current, avg, threshold = 5 }) {
  if (!avg || current == null) return null;
  const diff = current - avg;
  if (diff > threshold)  return <span className="text-green-400 text-sm font-bold ml-1">↑</span>;
  if (diff < -threshold) return <span className="text-red-400 text-sm font-bold ml-1">↓</span>;
  return <span className="text-slate-500 text-sm ml-1">→</span>;
}

function MetricCard({ label, value, sub, trend }) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{label}</p>
      <div className="flex items-baseline">
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend}
      </div>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function WeeklyChart({ cycles }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!cycles?.length || !canvasRef.current) return;

    const sorted = [...cycles].sort((a, b) => new Date(a.start) - new Date(b.start));
    const labels = sorted.map(c => {
      const d = new Date(c.start);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const strainData = sorted.map(c => c.score?.strain ?? null);
    const recoveryData = sorted.map(c => c.recovery_score ?? null);

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Recovery %',
            data: recoveryData,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.1)',
            tension: 0.4,
            yAxisID: 'y',
          },
          {
            label: 'Strain',
            data: strainData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.1)',
            tension: 0.4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.08)' } },
          y: {
            type: 'linear', position: 'left', min: 0, max: 100,
            ticks: { color: '#22d3ee' }, grid: { color: 'rgba(148,163,184,0.08)' },
          },
          y1: {
            type: 'linear', position: 'right', min: 0, max: 21,
            ticks: { color: '#f97316' }, grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [cycles]);

  return (
    <div className="card rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">7-Day Strain vs Recovery</p>
      <canvas ref={canvasRef} />
    </div>
  );
}


// ─── Brief Tab Components ──────────────────────────────────────────────────

function RoutineChecklist() {
  const [items, setItems] = useState(() => loadRoutine());
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState('');

  // Reset checkboxes at the start of each new day
  useEffect(() => {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('routine-date');
    if (lastDate !== today) {
      const reset = items.map(i => ({ ...i, done: false }));
      setItems(reset);
      localStorage.setItem('routine-date', today);
      localStorage.setItem('morning-routine', JSON.stringify(reset));
    }
  }, []);

  function save(updated) {
    setItems(updated);
    localStorage.setItem('morning-routine', JSON.stringify(updated));
  }

  function toggle(idx) {
    save(items.map((item, i) => i === idx ? { ...item, done: !item.done } : item));
  }

  function remove(idx) {
    save(items.filter((_, i) => i !== idx));
  }

  function addItem(e) {
    e.preventDefault();
    if (!newItem.trim()) return;
    save([...items, { text: newItem.trim(), done: false }]);
    setNewItem('');
  }

  const doneCount = items.filter(i => i.done).length;

  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Morning Routine</p>
          <p className="text-xs text-slate-600 mt-0.5">{doneCount}/{items.length} complete</p>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {!editing && (
              <button
                onClick={() => toggle(i)}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  item.done ? 'bg-green-500 border-green-500' : 'border-slate-600 hover:border-slate-400'
                }`}
              >
                {item.done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}
            <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>
              {item.text}
            </span>
            {editing && (
              <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <form onSubmit={addItem} className="flex gap-2 mt-4">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add item..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500"
          />
          <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
            Add
          </button>
        </form>
      )}
    </div>
  );
}

function AiBrief() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  async function generate() {
    const routine = loadRoutine().map(i => i.text);

    setLoading(true);
    setText('');
    setHasGenerated(true);

    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setText(err.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const { text: t, error } = JSON.parse(data);
            if (error) { setText(error); break; }
            if (t) setText(prev => prev + t);
          } catch {}
        }
      }
    } catch (err) {
      setText(`Error: ${err.message}`);
    }

    setLoading(false);
  }

  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">AI Morning Brief</p>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
        >
          {loading ? 'Generating...' : hasGenerated ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {!hasGenerated && (
        <p className="text-sm text-slate-500 text-center py-3">Tap Generate for your personalized AI brief</p>
      )}

      {loading && !text && (
        <div className="flex items-center gap-2 py-2">
          <div className="spinner w-4 h-4 rounded-full border-2 border-slate-700 border-t-purple-400" />
          <span className="text-xs text-slate-500">Analyzing your data...</span>
        </div>
      )}

      {text && (
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}

function AiLift() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setText('');
    setHasGenerated(true);

    try {
      const res = await fetch('/api/ai-lift', { method: 'POST', headers: { 'Content-Type': 'application/json' } });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setText(err.error || 'Something went wrong.');
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const { text: t, error } = JSON.parse(data);
            if (error) { setText(error); break; }
            if (t) setText(prev => prev + t);
          } catch {}
        }
      }
    } catch (err) {
      setText(`Error: ${err.message}`);
    }

    setLoading(false);
  }

  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Today's Workout</p>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-3 py-1 rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : hasGenerated ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {!hasGenerated && (
        <p className="text-sm text-slate-500 text-center py-3">Tap Generate for an AI workout based on your recovery</p>
      )}

      {loading && !text && (
        <div className="flex items-center gap-2 py-2">
          <div className="spinner w-4 h-4 rounded-full border-2 border-slate-700 border-t-orange-400" />
          <span className="text-xs text-slate-500">Analyzing recovery + training history...</span>
        </div>
      )}

      {text && <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{text}</p>}
    </div>
  );
}

function StrengthHistory({ workouts }) {
  if (!workouts?.length) return null;

  const keywords = ['weight', 'strength', 'power', 'functional', 'crossfit', 'resistance', 'lift'];
  const strength = workouts.filter(w => keywords.some(k => (w.sport_name || '').toLowerCase().includes(k)));
  const sessions = strength.length > 0 ? strength : workouts;

  return (
    <div className="card rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Recent Sessions</p>
      <div className="space-y-2">
        {sessions.slice(0, 6).map(w => {
          const date = w.start ? new Date(w.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--';
          const mins = w.end && w.start ? Math.round((new Date(w.end) - new Date(w.start)) / 60000) : null;
          const strain = w.score?.strain?.toFixed(1);
          return (
            <div key={w.id} className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-300">{w.sport_name || `Sport ${w.sport_id}`}</span>
                <span className="text-xs text-slate-500 ml-2">{date}</span>
              </div>
              <div className="text-right">
                {strain && <span className="text-xs text-orange-400 font-medium">{strain} strain</span>}
                {mins && <span className="text-xs text-slate-500 ml-2">{mins}m</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppleWatchSetup() {
  const [open, setOpen] = useState(false);
  const origin = window.location.origin;
  const readyUrl = `${origin}/api/ready`;
  const briefUrl = `${origin}/api/brief`;

  function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    return (
      <button
        onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-xs text-slate-500 hover:text-slate-300 flex-shrink-0 transition-colors px-1.5 py-0.5 rounded border border-slate-700 hover:border-slate-500"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    );
  }

  return (
    <div className="card rounded-2xl p-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full"
      >
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Apple Watch Setup</p>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-xs text-slate-400 leading-relaxed">
          <p>Sends your morning brief to your Apple Watch every day at a set time — no app needed.</p>

          <div className="space-y-2">
            <p className="text-slate-300 font-medium">Step 1 — Build the shortcut</p>
            <p>Open <span className="text-slate-300">Shortcuts</span> → tap <span className="text-slate-300">+</span> → name it <span className="text-slate-300">"Morning Brief"</span>. Add two actions:</p>
            <div className="space-y-2 pl-1">
              <div className="bg-slate-800/60 rounded-lg p-2.5 space-y-1.5">
                <p className="text-slate-300 font-medium">1. Get Contents of URL</p>
                <div className="flex items-center gap-2 bg-slate-900/60 rounded px-2 py-1.5">
                  <span className="text-blue-400 flex-1 break-all">{briefUrl}</span>
                  <CopyButton text={briefUrl} />
                </div>
              </div>
              <div className="bg-slate-800/60 rounded-lg p-2.5">
                <p className="text-slate-300 font-medium">2. Show Notification</p>
                <p className="mt-0.5">Set Body to <span className="text-slate-300">Contents of URL</span></p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-slate-300 font-medium">Step 2 — Set the automation</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Go to <span className="text-slate-300">Automation</span> tab → <span className="text-slate-300">+</span></li>
              <li>Choose <span className="text-slate-300">Time of Day</span></li>
              <li>Set time to <span className="text-slate-300">~45 min after you usually wake up</span></li>
              <li>Set to <span className="text-slate-300">Daily</span> → run <span className="text-slate-300">Morning Brief</span></li>
            </ol>
            <p className="text-slate-500">The 45-min buffer gives Whoop time to finish processing your sleep. The notification shows on your Apple Watch automatically.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

function Dashboard() {
  const [recovery, setRecovery] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [stats, setStats] = useState(null);
  const [strengthWorkouts, setStrengthWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const wakeTime = '08:00';

  useEffect(() => {
    Promise.all([
      fetch('/api/recovery').then(r => r.json()),
      fetch('/api/sleep').then(r => r.json()),
      fetch('/api/cycle').then(r => r.json()),
      fetch('/api/workout').then(r => r.json()),
      fetch('/api/weekly').then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/strength').then(r => r.json()),
    ]).then(([rec, slp, cyc, wrk, wkl, st, sw]) => {
      setRecovery(rec);
      setSleep(slp);
      setCycle(cyc);
      setWorkouts(wrk);
      setWeekly(wkl);
      setStats(st);
      setStrengthWorkouts(sw);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const recoveryScore = recovery?.score?.recovery_score ?? 0;
  const hrv = recovery?.score?.hrv_rmssd_milli ? Math.round(recovery.score.hrv_rmssd_milli) : null;
  const rhr = recovery?.score?.resting_heart_rate ?? null;
  const spo2 = recovery?.score?.spo2_percentage != null ? recovery.score.spo2_percentage.toFixed(1) : null;
  const sleepPerf = sleep?.score?.sleep_performance_percentage ?? null;
  const sleepEfficiency = sleep?.score?.sleep_efficiency_percentage ?? null;
  const respiratoryRate = sleep?.score?.respiratory_rate != null ? sleep.score.respiratory_rate.toFixed(1) : null;
  const sleepNeed = sleep?.score?.sleep_needed?.baseline_milli ?? null;
  const stages = sleep?.score?.stage_summary ?? null;
  const totalSleepMs = stages
    ? (stages.total_light_sleep_time_milli ?? 0) + (stages.total_slow_wave_sleep_time_milli ?? 0) + (stages.total_rem_sleep_time_milli ?? 0)
    : null;
  const remMs = stages?.total_rem_sleep_time_milli ?? null;
  const deepMs = stages?.total_slow_wave_sleep_time_milli ?? null;
  const strain = cycle?.score?.strain ?? null;
  const bedTime = sleepRecommendation(sleepNeed, wakeTime);

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'lift', label: 'Lift' },
    { id: 'brief', label: 'Brief' },
    { id: 'weekly', label: 'Week' },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pb-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white">Good morning</h1>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <a href="/auth/logout" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Disconnect</a>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <div className="space-y-3">
          <ReadinessBanner score={recoveryScore} avgRecovery={stats?.avgRecovery ?? null} />

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="HRV"
              value={hrv ? `${hrv} ms` : '--'}
              sub={stats?.avgHRV && hrv ? `${hrv > stats.avgHRV ? '+' : ''}${hrv - stats.avgHRV}ms vs your avg` : 'Heart rate variability'}
              trend={<TrendArrow current={hrv} avg={stats?.avgHRV} threshold={5} />}
            />
            <MetricCard label="Resting HR" value={rhr ? `${fmt(rhr)} bpm` : '--'} sub="Last night" />
            <MetricCard label="SpO2" value={spo2 ? `${spo2}%` : '--'} sub="Blood oxygen" />
            <MetricCard label="Resp. Rate" value={respiratoryRate ?? '--'} sub="Breaths / min" />
          </div>

          <div className="card rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Sleep</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-white">{totalSleepMs ? formatDuration(totalSleepMs) : '--'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{sleepPerf ? `${fmt(sleepPerf)}%` : '--'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Performance</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{sleepEfficiency ? `${fmt(sleepEfficiency)}%` : '--'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Efficiency</p>
              </div>
            </div>
            {(remMs || deepMs) && (
              <div className="grid grid-cols-2 gap-2 text-center mt-3 pt-3 border-t border-slate-700/50">
                <div>
                  <p className="text-base font-bold text-blue-400">{remMs ? formatDuration(remMs) : '--'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">REM</p>
                </div>
                <div>
                  <p className="text-base font-bold text-purple-400">{deepMs ? formatDuration(deepMs) : '--'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Deep</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Strain Target</p>
              <p className="text-3xl font-bold text-orange-400">{strainTarget(recoveryScore)}</p>
              <p className="text-xs text-slate-500 mt-1">{recoveryScore}% recovery</p>
            </div>
            <MetricCard label="Yesterday Strain" value={strain ? strain.toFixed(1) : '--'} sub="out of 21" />
          </div>

          {bedTime && (
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Bedtime Tonight</p>
              <p className="text-3xl font-bold text-purple-400">{bedTime}</p>
              <p className="text-xs text-slate-500 mt-1">To meet your sleep goal (wake {wakeTime})</p>
            </div>
          )}

          {workouts.length > 0 && (
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Recent Workouts</p>
              <div className="space-y-2">
                {workouts.slice(0, 3).map(w => (
                  <div key={w.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{w.sport_name ?? `Sport ${w.sport_id}`}</span>
                    <span className="text-xs text-slate-500">{formatDuration(w.end && w.start ? new Date(w.end) - new Date(w.start) : null)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'lift' && (
        <div className="space-y-3">
          <AiLift />
          <StrengthHistory workouts={strengthWorkouts} />
        </div>
      )}

      {tab === 'brief' && (
        <div className="space-y-3">
          <AiBrief />
          <RoutineChecklist />
          <AppleWatchSetup />
        </div>
      )}

      {tab === 'weekly' && (
        <div className="space-y-3">
          <WeeklyChart cycles={weekly} />
        </div>
      )}

    </div>
  );
}

function App() {
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth')) {
      window.history.replaceState({}, '', '/');
    }

    fetch('/auth/status')
      .then(r => r.json())
      .then(d => setAuthState(d.authenticated ? 'authenticated' : 'unauthenticated'))
      .catch(() => setAuthState('unauthenticated'));
  }, []);

  if (authState === 'loading') return <Spinner />;
  if (authState === 'unauthenticated') return <ConnectScreen />;
  return <Dashboard />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
