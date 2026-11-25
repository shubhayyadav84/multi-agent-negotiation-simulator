import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  Info,
  User,
  Bot,
  Zap,
  Activity,
  ChevronRight,
  Shield,
  Handshake,
  Flame,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import {
  analyzeTrajectory,
  calculateTooltipOffsets,
  HUMAN_STANCES,
  HUMAN_STANCE_PROFILES
} from '../utils/sentimentAnalyzer';
import './SentimentJourneyTimeline.css';

/**
 * SentimentJourneyTimeline Component
 * 
 * Interactive Multi-Agent Emotional Trajectory Visualizer & Sentiment Timeline
 * Member 2: Feature Ownership
 */
export default function SentimentJourneyTimeline({
  simulation,
  practiceUserRole = null,
  height = 300,
  showSummary = true,
  showTensionBadges = true,
  className = '',
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeRoleFilter, setActiveRoleFilter] = useState(null); // null = all, or role string

  // Compute trajectory analysis memoized
  const trajectory = useMemo(() => {
    if (!simulation) return null;
    return analyzeTrajectory(simulation.messages || [], {
      scenarioId: simulation.scenario_id,
      agents: simulation.agents || [],
      agreement: simulation.agreement,
      maxRounds: simulation.max_rounds || 10,
      currentRound: simulation.current_round,
      practiceUserRole,
    });
  }, [simulation, practiceUserRole]);

  if (!trajectory || !simulation.messages || simulation.messages.length === 0 || trajectory.agentCurves.length === 0) {
    return (
      <div className={`sentiment-timeline-empty ${className}`}>
        <Activity size={24} className="empty-icon" />
        <p>No negotiation transcript messages available to plot sentiment journey yet.</p>
      </div>
    );
  }

  const { agentCurves, tensionPoints, convergencePoint, summary, totalRounds } = trajectory;
  const isPracticeMode = agentCurves.some((c) => c.isHuman);

  // SVG Dimensions & Coordinates calculation
  const svgWidth = 820;
  const svgHeight = height;
  const padding = { top: 40, right: 50, bottom: 45, left: 60 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // X coordinate calculation (spread rounds evenly)
  const getX = (round) => {
    if (totalRounds <= 1) return padding.left + graphWidth / 2;
    return padding.left + ((round - 1) / (totalRounds - 1)) * graphWidth;
  };

  // Y coordinate calculation (score -1.0 to +1.0)
  // +1.0 -> top (padding.top), 0.0 -> middle, -1.0 -> bottom (padding.top + graphHeight)
  const getY = (score) => {
    const normalized = (score + 1.0) / 2.0; // 0.0 to 1.0
    return padding.top + graphHeight - normalized * graphHeight;
  };

  // Zero-line Y
  const zeroY = getY(0.0);

  // Build SVG path data for curves (smooth cubic bezier)
  const buildSmoothPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) {
      return `M ${getX(points[0].round)} ${getY(points[0].score)}`;
    }

    const coords = points.map((p) => ({ x: getX(p.round), y: getY(p.score) }));
    let d = `M ${coords[0].x} ${coords[0].y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

      // Catmull-Rom to Cubic Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return d;
  };

  // Pre-calculate collision-free tooltip offsets for all rounds
  const offsetPointsMap = useMemo(() => {
    const map = new Map();
    for (let r = 1; r <= totalRounds; r++) {
      const ptsAtR = agentCurves.flatMap((c) => c.points.filter((p) => p.round === r));
      const offsets = calculateTooltipOffsets(ptsAtR, {
        width: svgWidth,
        height: svgHeight,
        padding: padding.top,
      });
      offsets.forEach((off) => {
        map.set(`${off.role}_r${off.round}`, off);
      });
    }
    return map;
  }, [agentCurves, totalRounds]);

  return (
    <div className={`sentiment-journey-container ${className}`}>
      {/* 1. Header & Dynamic Archetype Legend */}
      <div className="sentiment-journey-header">
        <div className="header-title-wrap">
          <div className="header-icon-pill">
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="sentiment-journey-title">
              Sentiment Journey & Emotional Trajectory
            </h3>
            <p className="sentiment-journey-subtitle">
              Round-by-round emotional tone, stance rigidity, and collaboration dynamics
              {isPracticeMode && ' (Practice Mode: Human vs AI Tracking)'}
            </p>
          </div>
        </div>

        {/* Interactive Legend with click-to-filter */}
        <div className="sentiment-agents-legend">
          {agentCurves.map((curve) => {
            const isFaded = activeRoleFilter && activeRoleFilter !== curve.role;
            const isSelected = activeRoleFilter === curve.role;

            return (
              <button
                key={curve.role}
                type="button"
                className={`legend-chip ${isSelected ? 'selected' : ''} ${isFaded ? 'faded' : ''}`}
                onClick={() => setActiveRoleFilter(isSelected ? null : curve.role)}
                title={`Click to focus on ${curve.name}`}
              >
                <span className="legend-chip-color" style={{ backgroundColor: curve.color }} />
                <span className="legend-chip-role">
                  {curve.isHuman ? 'Human (You)' : curve.name}
                </span>
                <span className="legend-chip-archetype">
                  {curve.isHuman ? 'Human Stance' : curve.personality}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Interactive SVG Trajectory Canvas */}
      <div className="sentiment-canvas-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="sentiment-trajectory-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradients for each curve */}
            {agentCurves.map((curve, idx) => (
              <linearGradient
                key={curve.role}
                id={`grad-${curve.role.replace(/[^a-zA-Z0-9]/g, '')}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={curve.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={curve.color} stopOpacity="0.0" />
              </linearGradient>
            ))}

            {/* Tension Zone Background Gradient */}
            <linearGradient id="tensionZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
            </linearGradient>

            {/* Convergence Zone Background Gradient */}
            <linearGradient id="convergenceZoneGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Zones: High Collaboration (Top) & High Tension (Bottom) */}
          <rect
            x={padding.left}
            y={padding.top}
            width={graphWidth}
            height={zeroY - padding.top}
            fill="url(#convergenceZoneGrad)"
          />
          <rect
            x={padding.left}
            y={zeroY}
            width={graphWidth}
            height={padding.top + graphHeight - zeroY}
            fill="url(#tensionZoneGrad)"
          />

          {/* Horizontal Reference Grid Lines */}
          {[1.0, 0.5, 0.0, -0.5, -1.0].map((level) => {
            const y = getY(level);
            const isZero = level === 0.0;
            return (
              <g key={level} className="grid-level-group">
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + graphWidth}
                  y2={y}
                  stroke={isZero ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeDasharray={isZero ? '0' : '4 4'}
                  strokeWidth={isZero ? 1.5 : 1}
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  className={`axis-label ${isZero ? 'axis-zero' : level > 0 ? 'axis-positive' : 'axis-negative'}`}
                >
                  {level > 0 ? `+${level.toFixed(1)}` : level.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Qualitative Badges */}
          <text x={padding.left + 8} y={padding.top + 16} className="zone-label zone-label-high">
            High Collaboration (+0.85)
          </text>
          <text x={padding.left + 8} y={zeroY - 6} className="zone-label zone-label-neutral">
            Neutral Baseline (0.0)
          </text>
          <text x={padding.left + 8} y={padding.top + graphHeight - 8} className="zone-label zone-label-tension">
            High Tension & Rigidity (-0.60)
          </text>

          {/* Vertical Round Grid Lines & X-Axis Labels */}
          {Array.from({ length: totalRounds }).map((_, idx) => {
            const r = idx + 1;
            const x = getX(r);
            return (
              <g key={r} className="round-grid-group">
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + graphHeight}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="2 4"
                />
                <text
                  x={x}
                  y={padding.top + graphHeight + 24}
                  textAnchor="middle"
                  className="round-x-label"
                >
                  R{r}
                </text>
              </g>
            );
          })}

          {/* Render Curve Paths */}
          {agentCurves.map((curve) => {
            const isFaded = activeRoleFilter && activeRoleFilter !== curve.role;
            const pathD = buildSmoothPath(curve.points);
            const gradId = `grad-${curve.role.replace(/[^a-zA-Z0-9]/g, '')}`;

            // Area fill closed path
            const firstX = getX(1);
            const lastX = getX(totalRounds);
            const areaD = `${pathD} L ${lastX} ${padding.top + graphHeight} L ${firstX} ${padding.top + graphHeight} Z`;

            return (
              <g
                key={curve.role}
                className={`curve-group ${isFaded ? 'faded-curve' : ''}`}
                style={{ opacity: isFaded ? 0.15 : 1, transition: 'opacity 0.25s ease' }}
              >
                {/* Area Gradient Fill */}
                <path d={areaD} fill={`url(#${gradId})`} />

                {/* Main Curve Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="trajectory-path"
                />
              </g>
            );
          })}

          {/* Tension Inflection Indicators (Test 2.2 highlight) */}
          {showTensionBadges &&
            tensionPoints.map((tp, idx) => {
              const x = getX(tp.round);
              const y = getY(tp.score);
              return (
                <g key={`tension-${idx}`} className="tension-marker" transform={`translate(${x}, ${y})`}>
                  <circle r="12" className="tension-pulse-ring" />
                  <circle r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              );
            })}

          {/* Agreement Convergence Star Indicator */}
          {convergencePoint && (
            <g
              className="convergence-marker"
              transform={`translate(${getX(convergencePoint.round)}, ${getY(convergencePoint.score)})`}
            >
              <circle r="14" className="convergence-pulse-ring" />
              <polygon
                points="0,-8 2.5,-2.5 8,-2.5 3.8,1.2 5.5,7 0,3.5 -5.5,7 -3.8,1.2 -8,-2.5 -2.5,-2.5"
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Interactive Data Point Nodes with Hover Hits */}
          {agentCurves.map((curve) => {
            const isFaded = activeRoleFilter && activeRoleFilter !== curve.role;
            if (isFaded) return null;

            return (
              <g key={`nodes-${curve.role}`} className="curve-nodes">
                {curve.points.map((pt) => {
                  const x = getX(pt.round);
                  const y = getY(pt.score);
                  const isHovered =
                    hoveredPoint &&
                    hoveredPoint.role === pt.role &&
                    hoveredPoint.round === pt.round;

                  const offsetData = offsetPointsMap.get(`${pt.role}_r${pt.round}`) || {};
                  const tooltipX = x + (offsetData.tooltipOffsetX || 0);
                  const tooltipY = y + (offsetData.tooltipOffsetY || 0);

                  return (
                    <g
                      key={`node-${pt.role}-${pt.round}`}
                      className="interactive-node-group"
                      onMouseEnter={() => setHoveredPoint({ ...pt, tooltipX, tooltipY })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* Transparent larger hit target for smooth hover on mobile/desktop */}
                      <circle cx={x} cy={y} r="14" fill="transparent" style={{ cursor: 'pointer' }} />

                      {/* Visible Node Circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7 : 4.5}
                        fill={curve.color}
                        stroke="#0f172a"
                        strokeWidth="2.5"
                        className="trajectory-node"
                        style={{
                          transition: 'r 0.15s ease, fill 0.15s ease',
                          filter: isHovered ? `drop-shadow(0 0 6px ${curve.color})` : 'none',
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* 3. Floating Collision-Free Rich Tooltip */}
        {hoveredPoint && (
          <div
            className="sentiment-tooltip-card"
            style={{
              left: `${(hoveredPoint.tooltipX / svgWidth) * 100}%`,
              top: `${hoveredPoint.tooltipY}px`,
            }}
          >
            <div className="tooltip-header">
              <span className="tooltip-round-pill">Round {hoveredPoint.round}</span>
              <span
                className="tooltip-speaker-badge"
                style={{
                  backgroundColor: `${hoveredPoint.color}20`,
                  color: hoveredPoint.color,
                  borderColor: hoveredPoint.color,
                }}
              >
                {hoveredPoint.isHuman ? 'Human Negotiator' : hoveredPoint.name}
              </span>
              <span
                className={`tooltip-stance-tag stance-${hoveredPoint.stanceTag.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {hoveredPoint.stanceTag}
              </span>
            </div>

            {/* Quantitative Score Metrics Grid */}
            <div className="tooltip-metrics-row">
              <div className="tooltip-metric">
                <span className="metric-label">Composite Sentiment</span>
                <span
                  className={`metric-val ${hoveredPoint.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {hoveredPoint.score >= 0 ? `+${hoveredPoint.score.toFixed(2)}` : hoveredPoint.score.toFixed(2)}
                </span>
              </div>
              <div className="tooltip-metric">
                <span className="metric-label">Rigidity</span>
                <span className="metric-val text-slate-300">
                  {(hoveredPoint.stanceRigidity * 100).toFixed(0)}%
                </span>
              </div>
              <div className="tooltip-metric">
                <span className="metric-label">Collaboration</span>
                <span
                  className={`metric-val ${hoveredPoint.collaborationLevel >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {hoveredPoint.collaborationLevel >= 0
                    ? `+${hoveredPoint.collaborationLevel.toFixed(2)}`
                    : hoveredPoint.collaborationLevel.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quote Snippet */}
            {hoveredPoint.quoteSnippet && (
              <div className="tooltip-quote-box">
                <span className="quote-mark">“</span>
                <p className="quote-text">{hoveredPoint.quoteSnippet}</p>
                <span className="quote-mark">”</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Practice Mode Live Stance Progression Ribbon (Test 2.3) */}
      {isPracticeMode && (
        <div className="practice-stance-ribbon">
          <div className="ribbon-title">
            <User size={14} className="text-blue-400" />
            <span>Human Live Stance Progression:</span>
          </div>
          <div className="ribbon-steps">
            {[
              HUMAN_STANCES.AWAITING_OFFER,
              HUMAN_STANCES.IN_DIALOGUE,
              HUMAN_STANCES.FIRM,
              HUMAN_STANCES.COMPROMISING,
              HUMAN_STANCES.AGREED,
            ].map((st, sIdx) => {
              const profile = HUMAN_STANCE_PROFILES[st];
              const reached = agentCurves
                .find((c) => c.isHuman)
                ?.points.some((pt) => pt.stanceTag === st);

              return (
                <React.Fragment key={st}>
                  <div className={`stance-step-chip ${reached ? 'step-active' : 'step-inactive'}`}>
                    <span className="step-dot" style={{ backgroundColor: profile.color }} />
                    <span className="step-name">{st}</span>
                  </div>
                  {sIdx < 4 && <ChevronRight size={13} className="step-arrow" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Summary KPI Banner (Test 2.1 & 2.2 metrics) */}
      {showSummary && (
        <div className="sentiment-summary-banner">
          <div className="summary-col">
            <span className="summary-label">Trajectory Arc</span>
            <span className="summary-val highlight">{summary.overallArc}</span>
          </div>

          <div className="summary-col">
            <span className="summary-label">Average Collaboration</span>
            <span
              className={`summary-val ${summary.averageCollaboration >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {summary.averageCollaboration >= 0
                ? `+${summary.averageCollaboration.toFixed(2)}`
                : summary.averageCollaboration.toFixed(2)}
            </span>
          </div>

          <div className="summary-col">
            <span className="summary-label">Peak Tension Point</span>
            <span className="summary-val text-amber-400">
              {summary.peakTensionRound
                ? `Round ${summary.peakTensionRound} (${summary.peakTensionSpeaker}): ${summary.peakTensionScore?.toFixed(2)}`
                : 'None detected'}
            </span>
          </div>

          <div className="summary-col">
            <span className="summary-label">Consensus Convergence</span>
            <span className="summary-val text-emerald-400">
              {convergencePoint ? `Locked at Round ${convergencePoint.round}` : summary.hasAgreement ? 'Agreement Reached' : 'Ongoing'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

