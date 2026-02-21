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

function ReadinessBanner({ score }) {
  const r = readiness(score);
  return (
    <div className={`card rounded-2xl p-4 ${r.bg} border ${r.border}`}>
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${r.dot} flex-shrink-0`} />
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Today's Readiness</p>
          <p className="text-white font-semibold mt-0.5">{r.text}</p>
        </div>
        <div className="ml-auto text-2xl font-bold text-white">{score}%</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
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

function SessionLogger() {
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'game', duration_minutes: '', notes: '' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/sessions').then(r => r.json()).then(setSessions).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null }),
    });
    if (res.ok) {
      const updated = await fetch('/api/sessions').then(r => r.json());
      setSessions(updated);
      setForm({ date: new Date().toISOString().slice(0, 10), type: 'game', duration_minutes: '', notes: '' });
      setOpen(false);
    }
  }

  async function deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions(s => s.filter(x => x.id !== id));
  }

  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Basketball Sessions</p>
        <button
          onClick={() => setOpen(v => !v)}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition-colors"
        >
          {open ? 'Cancel' : '+ Log'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              required
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="game">Game</option>
              <option value="practice">Practice</option>
            </select>
          </div>
          <input
            type="number"
            placeholder="Duration (minutes)"
            value={form.duration_minutes}
            onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none"
            rows={2}
          />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-sm transition-colors">
            Save Session
          </button>
        </form>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">No sessions logged yet</p>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${s.type === 'game' ? 'bg-orange-900/50 text-orange-300' : 'bg-blue-900/50 text-blue-300'}`}>
                  {s.type}
                </span>
                <span className="text-sm text-slate-300">{s.date}</span>
                {s.duration_minutes && <span className="text-xs text-slate-500 ml-2">{s.duration_minutes}m</span>}
                {s.notes && <p className="text-xs text-slate-500 mt-1">{s.notes}</p>}
              </div>
              <button onClick={() => deleteSession(s.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
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

function AppleWatchSetup() {
  const [open, setOpen] = useState(false);
  const briefUrl = `${window.location.origin}/api/brief`;

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
        <div className="mt-4 space-y-3 text-xs text-slate-400 leading-relaxed">
          <p>Get a morning brief notification on your Apple Watch daily — no app needed.</p>

          <div className="space-y-1.5">
            <p className="text-slate-300 font-medium">1. Create an iOS Shortcut</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Open <span className="text-slate-300">Shortcuts</span> app on iPhone</li>
              <li>Tap <span className="text-slate-300">+</span> → Add Action</li>
              <li>Search for <span className="text-slate-300">"Get Contents of URL"</span></li>
              <li>Set URL to:</li>
            </ol>
            <div className="bg-slate-800 rounded-lg px-3 py-2 mt-1 flex items-center gap-2">
              <span className="text-blue-400 break-all flex-1">{briefUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(briefUrl)}
                className="text-slate-600 hover:text-slate-300 flex-shrink-0 transition-colors"
                title="Copy URL"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1" start="5">
              <li>Add action: <span className="text-slate-300">"Show Notification"</span></li>
              <li>Set the notification Body to <span className="text-slate-300">Shortcut Input</span></li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <p className="text-slate-300 font-medium">2. Set up daily automation</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Go to <span className="text-slate-300">Automation</span> tab in Shortcuts</li>
              <li>Tap <span className="text-slate-300">+</span> → Time of Day</li>
              <li>Set to <span className="text-slate-300">7:00 AM, Daily</span></li>
              <li>Add action: Run the shortcut you just made</li>
            </ol>
          </div>

          <p className="text-slate-500 pt-1">The notification will appear on your Apple Watch automatically each morning.</p>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

function Dashboard({ wakeTime }) {
  const [recovery, setRecovery] = useState(null);
  const [sleep, setSleep] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');

  useEffect(() => {
    Promise.all([
      fetch('/api/recovery').then(r => r.json()),
      fetch('/api/sleep').then(r => r.json()),
      fetch('/api/cycle').then(r => r.json()),
      fetch('/api/workout').then(r => r.json()),
      fetch('/api/weekly').then(r => r.json()),
    ]).then(([rec, slp, cyc, wrk, wkl]) => {
      setRecovery(rec);
      setSleep(slp);
      setCycle(cyc);
      setWorkouts(wrk);
      setWeekly(wkl);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const recoveryScore = recovery?.score?.recovery_score ?? 0;
  const hrv = recovery?.score?.hrv_rmssd_milli ? Math.round(recovery.score.hrv_rmssd_milli) : null;
  const rhr = recovery?.score?.resting_heart_rate ?? null;
  const sleepPerf = sleep?.score?.sleep_performance_percentage ?? null;
  const sleepNeed = sleep?.score?.sleep_needed?.baseline_milli ?? null;
  const strain = cycle?.score?.strain ?? null;
  const bedTime = sleepRecommendation(sleepNeed, wakeTime);

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'brief', label: 'Brief' },
    { id: 'weekly', label: 'Week' },
    { id: 'sessions', label: 'Log' },
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
          <ReadinessBanner score={recoveryScore} />

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="HRV" value={hrv ? `${hrv} ms` : '--'} sub="Heart rate variability" />
            <MetricCard label="Resting HR" value={rhr ? `${fmt(rhr)} bpm` : '--'} sub="Last night" />
            <MetricCard label="Sleep" value={sleepPerf ? `${fmt(sleepPerf)}%` : '--'} sub="Performance" />
            <MetricCard label="Yesterday Strain" value={strain ? strain.toFixed(1) : '--'} sub="out of 21" />
          </div>

          <div className="card rounded-2xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Strain Target Today</p>
            <p className="text-3xl font-bold text-orange-400">{strainTarget(recoveryScore)}</p>
            <p className="text-xs text-slate-500 mt-1">Based on {recoveryScore}% recovery</p>
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

      {tab === 'sessions' && <SessionLogger />}
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
  return <Dashboard wakeTime="07:00" />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
