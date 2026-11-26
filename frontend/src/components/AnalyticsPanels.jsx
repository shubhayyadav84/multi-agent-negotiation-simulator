import React, { useEffect, useMemo, useState } from 'react';
import { getSimulationState } from '../services/simulationApi';
import { summarizeImpasses } from '../utils/deadlockPatterns';
import { SCENARIO_TABS, concessionVelocity, surplusEfficiency } from '../utils/analyticsMetrics';

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#a855f7'];
const money = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** Loads the full session (with offers) for relevant sessions. */
function useSessionDetails(sessions, activeTab) {
  const [detailsMap, setDetailsMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    const list = sessions || [];
    if (list.length === 0) return;

    // Check sessions that already have offers or messages
    const readySessions = {};
    const toFetch = [];

    list.forEach((s) => {
      if (!s || !s.id) return;
      const hasOffers = Array.isArray(s.offers) && s.offers.length > 0;
      const hasMessages = Array.isArray(s.messages) && s.messages.length > 0;
      if (hasOffers || hasMessages) {
        readySessions[s.id] = s;
      } else if (!String(s.id).startsWith('practice-seed')) {
        toFetch.push(s);
      }
    });

    if (Object.keys(readySessions).length > 0) {
      setDetailsMap((prev) => ({ ...readySessions, ...prev }));
    }

    if (toFetch.length === 0) return;

    const isMatchingTab = (s) => {
      const sid = String(s.scenario_id || s.scenario_title || '').toLowerCase();
      if (activeTab === 'vendor-pricing') return sid.includes('vendor') || sid.includes('pricing') || sid.includes('procurement');
      if (activeTab === 'job-offer') return sid.includes('job') || sid.includes('offer') || sid.includes('salary');
      if (activeTab === 'project-budget') return sid.includes('project') || sid.includes('budget') || sid.includes('allocation');
      return true;
    };

    const matching = toFetch.filter(isMatchingTab);
    const nonMatching = toFetch.filter((s) => !isMatchingTab(s));
    const idsToFetch = [...matching.slice(0, 20), ...nonMatching.slice(0, 10)]
      .map((s) => s.id)
      .filter((id) => !detailsMap[id]);

    if (idsToFetch.length === 0) return;

    Promise.all(idsToFetch.map((id) => getSimulationState(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      const fetchedMap = {};
      results.filter(Boolean).forEach((sim) => {
        if (sim && sim.id) fetchedMap[sim.id] = sim;
      });
      setDetailsMap((prev) => ({ ...prev, ...fetchedMap }));
    });

    return () => {
      cancelled = true;
    };
  }, [sessions, activeTab]);

  return useMemo(() => {
    const map = { ...detailsMap };
    (sessions || []).forEach((s) => {
      if (s && s.id && !map[s.id]) {
        map[s.id] = s;
      }
    });
    return Object.values(map);
  }, [detailsMap, sessions]);
}

function VelocityChart({ data }) {
  const W = 640;
  const H = 250;
  const L = 64;
  const R = 24;
  const T = 20;
  const B = 36;
  const values = data.series.flatMap((s) => s.points.map((p) => p.value).filter((v) => v !== null));
  const maxVal = Math.max(0, ...values);
  const yMax = maxVal > 0 ? maxVal * 1.15 : 10000;
  const maxRound = Math.max(3, data.maxRound || 3);
  const x = (r) => L + ((r - 2) / Math.max(1, maxRound - 2)) * (W - L - R);
  const y = (v) => T + (1 - (v || 0) / yMax) * (H - T - B);
  const rounds = [];
  for (let r = 2; r <= maxRound; r += 1) rounds.push(r);

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
        const validPoints = s.points.filter((p) => p.value !== null);
        return (
          <g key={s.role}>
            {validPoints.length > 1 && (
              <path
                d={validPoints.map((p, j) => `${j === 0 ? 'M' : 'L'} ${x(p.round)} ${y(p.value)}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {validPoints.length === 1 && (
              <line
                x1={Math.max(L, x(validPoints[0].round) - 20)}
                x2={Math.min(W - R, x(validPoints[0].round) + 20)}
                y1={y(validPoints[0].value)}
                y2={y(validPoints[0].value)}
                stroke={color}
                strokeWidth="3"
                strokeDasharray="4 2"
              />
            )}
            {validPoints.map((p) => (
              <g key={p.round}>
                <circle cx={x(p.round)} cy={y(p.value)} r="4.5" fill={color} stroke="#ffffff" strokeWidth="2" />
                <title>{`${s.role} Round ${p.round}: ₹${money(p.value)}/rnd`}</title>
              </g>
            ))}
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
    <div className="analytics-charts-grid" style={{ marginTop: '1.25rem' }}>
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

      <div className="analytics-chart-card" data-testid="concession-velocity">
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
  const [tab, setTab] = useState('vendor-pricing');
  const details = useSessionDetails(sessions, tab);
  return <PanelsView sessions={sessions} details={details} tab={tab} onTab={setTab} />;
}

export default AnalyticsPanels;
