import React, { useEffect, useMemo, useState } from 'react';
import { getSimulationState } from '../services/simulationApi';
import { summarizeImpasses } from '../utils/deadlockPatterns';
import { SCENARIO_TABS, concessionVelocity, surplusEfficiency } from '../utils/analyticsMetrics';

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#a855f7'];
const money = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** Loads the full session (with offers) for the newest sessions. */
function useSessionDetails(sessions) {
  const [details, setDetails] = useState([]);
  const key = (sessions || []).map((s) => s.id).join('|');
  useEffect(() => {
    let cancelled = false;
    const ids = (sessions || [])
      .map((s) => s.id)
      .filter((id) => id && !String(id).startsWith('practice-seed'))
      .slice(0, 15);
    if (ids.length === 0) {
      setDetails([]);
      return undefined;
    }
    Promise.all(ids.map((id) => getSimulationState(id).catch(() => null))).then((list) => {
      if (!cancelled) setDetails(list.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return details;
}

function VelocityChart({ data }) {
  const W = 640;
  const H = 250;
  const L = 64;
  const R = 16;
  const T = 14;
  const B = 36;
  const values = data.series.flatMap((s) => s.points.map((p) => p.value).filter((v) => v !== null));
  const yMax = Math.max(1, ...values);
  const x = (r) => L + ((r - 2) / Math.max(1, data.maxRound - 2)) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const rounds = [];
  for (let r = 2; r <= data.maxRound; r += 1) rounds.push(r);
  const runs = (points) => {
    const out = [];
    let cur = [];
    points.forEach((p) => {
      if (p.value === null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else {
        cur.push(p);
      }
    });
    if (cur.length) out.push(cur);
    return out;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Concession velocity per round">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(yMax * f)} y2={y(yMax * f)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={L - 8} y={y(yMax * f) + 4} textAnchor="end" fontSize="11" fill="#64748b">
            {money(yMax * f)}
          </text>
        </g>
      ))}
      {rounds.map((r) => (
        <text key={r} x={x(r)} y={H - 14} textAnchor="middle" fontSize="11" fill="#64748b">
          R{r}
        </text>
      ))}
      {data.series.map((s, i) => {
        const color = COLORS[i % COLORS.length];
        return (
          <g key={s.role}>
            {runs(s.points).map((run, k) =>
              run.length > 1 ? (
                <path
                  key={k}
                  d={run.map((p, j) => `${j === 0 ? 'M' : 'L'} ${x(p.round)} ${y(p.value)}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                />
              ) : null
            )}
            {s.points.map((p) =>
              p.value === null ? null : <circle key={p.round} cx={x(p.round)} cy={y(p.value)} r="3.5" fill={color} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Presentational part: easy to test, no data fetching inside. */
export function PanelsView({ sessions, details, tab, onTab }) {
  const impasse = useMemo(() => summarizeImpasses(sessions), [sessions]);
  const surplus = useMemo(() => surplusEfficiency(details), [details]);
  const velocity = useMemo(() => concessionVelocity(details, tab), [details, tab]);
  const counts = useMemo(() => {
    const c = {};
    (sessions || []).forEach((s) => {
      c[s.scenario_id] = (c[s.scenario_id] || 0) + 1;
    });
    return c;
  }, [sessions]);

  return (
    <div
      style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1.25rem' }}
    >
      <div className="analytics-chart-card" data-testid="deadlock-patterns">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Deadlock Pattern Detector</h3>
          <span className="chart-card-sublabel">
            {impasse.total} impasse{impasse.total === 1 ? '' : 's'}: {impasse.deadlocks} deadlocked, {impasse.resolved} resolved
          </span>
        </div>
        {impasse.total === 0 ? (
          <p className="chart-card-sublabel">No impasses recorded for this mode yet.</p>
        ) : (
          <div className="agent-perf-list">
            {impasse.causes.map((c) => (
              <div key={c.label} className="agent-perf-row">
                <div className="agent-perf-meta">
                  <span className="agent-perf-name">{c.label}</span>
                  <span className="agent-perf-pct">
                    {c.count} ({c.pct}%)
                  </span>
                </div>
                <div className="agent-perf-track">
                  <div
                    className="agent-perf-fill"
                    style={{ width: `${c.pct}%`, background: 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)' }}
                  />
                </div>
                <span className="chart-card-sublabel">
                  {c.deadlocked} ended in deadlock, {c.resolved} resolved by compromise
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="analytics-chart-card" data-testid="surplus-efficiency">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Surplus Efficiency</h3>
          <span className="chart-card-sublabel">{surplus.sessionsCounted} two-party sessions</span>
        </div>
        {surplus.efficiency === null ? (
          <p className="chart-card-sublabel">No two-party sessions with limits recorded yet.</p>
        ) : (
          <>
            <div style={{ fontSize: '2.2rem', fontWeight: 700 }}>{surplus.efficiency}%</div>
            <p className="chart-card-sublabel">
              Share of the available surplus realised without breaking either side&apos;s limit. Deadlocks count as 0%.
            </p>
            <div className="agent-perf-list">
              {surplus.roleShares.map((r) => (
                <div key={r.role} className="agent-perf-row">
                  <div className="agent-perf-meta">
                    <span className="agent-perf-name">{r.role} surplus captured</span>
                    <span className="agent-perf-pct">{r.share}%</span>
                  </div>
                  <div className="agent-perf-track">
                    <div
                      className="agent-perf-fill"
                      style={{ width: `${r.share}%`, background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="analytics-chart-card" style={{ gridColumn: '1 / -1' }} data-testid="concession-velocity">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Concession Velocity Curves</h3>
          <span className="chart-card-sublabel">
            Average change of each side&apos;s offer per round ({velocity.sessionsUsed} session
            {velocity.sessionsUsed === 1 ? '' : 's'})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {SCENARIO_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                fontWeight: 600,
                background: tab === t.id ? '#2563eb' : 'transparent',
                color: tab === t.id ? '#fff' : 'inherit',
              }}
            >
              {t.label} ({counts[t.id] || 0})
            </button>
          ))}
        </div>
        {velocity.series.length === 0 ? (
          <p className="chart-card-sublabel">No offer history for this scenario yet.</p>
        ) : (
          <>
            <VelocityChart data={velocity} />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {velocity.series.map((s, i) => (
                <span key={s.role} className="chart-card-sublabel">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: COLORS[i % COLORS.length],
                      marginRight: 6,
                    }}
                  />
                  {s.role}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Drop-in section for the Analytics page. */
export function AnalyticsPanels({ sessions }) {
  const details = useSessionDetails(sessions);
  const [tab, setTab] = useState('vendor-pricing');
  return <PanelsView sessions={sessions} details={details} tab={tab} onTab={setTab} />;
}

export default AnalyticsPanels;
