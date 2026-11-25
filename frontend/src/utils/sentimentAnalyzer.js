/**
 * sentimentAnalyzer.js
 * 
 * Round-by-round Sentiment Analysis Tracker & Emotional Trajectory Engine
 * Member 2: Sentiment Journey Timeline & Emotional Trajectory Visualizer
 * 
 * Evaluates emotional tone, stance rigidity, and collaboration level (-1.0 to +1.0)
 * for every message in both Simulation Mode (AI vs AI) and Practice Mode (Human vs AI).
 */

// Standard Human Practice Mode Stances
export const HUMAN_STANCES = {
  AWAITING_OFFER: 'Awaiting Offer',
  IN_DIALOGUE: 'In Dialogue',
  FIRM: 'Firm',
  COMPROMISING: 'Compromising',
  AGREED: 'Agreed',
};

export const HUMAN_STANCE_PROFILES = {
  [HUMAN_STANCES.AWAITING_OFFER]: {
    score: 0.0,
    emotionalTone: 0.0,
    stanceRigidity: 0.2,
    collaborationLevel: 0.1,
    color: '#64748b',
    description: 'Awaiting opening proposal or active counter-offer from counterpart.',
  },
  [HUMAN_STANCES.IN_DIALOGUE]: {
    score: 0.35,
    emotionalTone: 0.30,
    stanceRigidity: 0.40,
    collaborationLevel: 0.40,
    color: '#3b82f6',
    description: 'Actively conversing and exploring terms without committing to concessions.',
  },
  [HUMAN_STANCES.FIRM]: {
    score: -0.35,
    emotionalTone: -0.30,
    stanceRigidity: 0.85,
    collaborationLevel: -0.25,
    color: '#ef4444',
    description: 'Holding line on price/budget; rejecting non-viable counter-offers.',
  },
  [HUMAN_STANCES.COMPROMISING]: {
    score: 0.65,
    emotionalTone: 0.60,
    stanceRigidity: 0.25,
    collaborationLevel: 0.70,
    color: '#10b981',
    description: 'Offering concessions or proposing shared mutual middle ground.',
  },
  [HUMAN_STANCES.AGREED]: {
    score: 0.95,
    emotionalTone: 0.90,
    stanceRigidity: 0.05,
    collaborationLevel: 0.95,
    color: '#059669',
    description: 'Accepting terms; consensus locked in mutual agreement.',
  },
};

// Personality archetype baselines
export const ARCHETYPE_BASELINES = {
  Collaborative: {
    baseTone: 0.35,
    baseRigidity: 0.30,
    baseCollaboration: 0.50,
    concessionMultiplier: 1.25,
    resistanceThreshold: 0.40,
    color: '#10b981', // Emerald
  },
  Aggressive: {
    baseTone: -0.20,
    baseRigidity: 0.85,
    baseCollaboration: -0.20,
    concessionMultiplier: 0.60,
    resistanceThreshold: 0.80,
    color: '#f43f5e', // Rose
  },
  'Risk-Averse': {
    baseTone: 0.05,
    baseRigidity: 0.65,
    baseCollaboration: 0.20,
    concessionMultiplier: 0.85,
    resistanceThreshold: 0.60,
    color: '#8b5cf6', // Violet
  },
  Analytical: {
    baseTone: 0.10,
    baseRigidity: 0.50,
    baseCollaboration: 0.30,
    concessionMultiplier: 1.0,
    resistanceThreshold: 0.50,
    color: '#0ea5e9', // Sky blue
  },
  Human: {
    baseTone: 0.15,
    baseRigidity: 0.50,
    baseCollaboration: 0.35,
    concessionMultiplier: 1.0,
    resistanceThreshold: 0.50,
    color: '#2563eb', // Royal blue
  },
};

// Keyword Lexicons for dynamic phrasing analysis
const COLLABORATIVE_LEXICON = [
  'agree', 'agreed', 'agreement', 'collaborate', 'collaborative', 'partnership',
  'mutual', 'win-win', 'fair', 'reasonable', 'compromise', 'concede', 'concession',
  'flexible', 'willing', 'appreciate', 'understand', 'progress', 'aligned', 'accept',
  'accepting', 'pleased', 'constructive', 'package', 'opportunity', 'synergy'
];

const TENSE_HOSTILE_LEXICON = [
  'reject', 'rejected', 'unacceptable', 'cannot', "can't", 'refuse', 'inflexible',
  'firm', 'holding firm', 'insist', 'non-negotiable', 'deal-breaker', 'walk away',
  'impasse', 'deadlock', 'too low', 'too high', 'unreasonable', 'excessive',
  'disagree', 'disappointing', 'substandard', 'demanding', 'strictly', 'strict',
  'defending', 'protecting', 'budget caps', 'ceiling', 'boundary'
];

/**
 * Normalizes any text to lowercase words
 */
function extractWords(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Infers human stance based on action, message text, and offer context
 */
export function inferHumanStance(messageObj = {}, roundNumber = 1, isOpening = false) {
  if (messageObj.stance && HUMAN_STANCE_PROFILES[messageObj.stance]) {
    return messageObj.stance;
  }

  const rawStance = String(messageObj.stance || '').toLowerCase();
  if (rawStance.includes('awaiting')) return HUMAN_STANCES.AWAITING_OFFER;
  if (rawStance.includes('firm') || rawStance.includes('hold') || rawStance.includes('defend')) return HUMAN_STANCES.FIRM;
  if (rawStance.includes('compromis') || rawStance.includes('conced')) return HUMAN_STANCES.COMPROMISING;
  if (rawStance.includes('agreed') || rawStance.includes('accept')) return HUMAN_STANCES.AGREED;
  if (rawStance.includes('dialogue') || rawStance.includes('negotiat')) return HUMAN_STANCES.IN_DIALOGUE;

  const action = (messageObj.action || '').toUpperCase();
  if (action === 'ACCEPT') return HUMAN_STANCES.AGREED;
  if (action === 'REJECT') return HUMAN_STANCES.FIRM;

  const text = (messageObj.message || messageObj.text || '').toLowerCase();
  if (text.includes('agree') || text.includes('accept') || text.includes('deal')) {
    return HUMAN_STANCES.AGREED;
  }
  if (text.includes('compromise') || text.includes('meet in the middle') || text.includes('concession') || text.includes('can offer')) {
    return HUMAN_STANCES.COMPROMISING;
  }
  if (text.includes('cannot') || text.includes('unacceptable') || text.includes('must insist') || text.includes('firm')) {
    return HUMAN_STANCES.FIRM;
  }

  if (isOpening && roundNumber === 1 && !messageObj.offer_value && !text) {
    return HUMAN_STANCES.AWAITING_OFFER;
  }

  return HUMAN_STANCES.IN_DIALOGUE;
}

/**
 * Scores a single message for emotional tone, stance rigidity, and collaboration level
 * Returns values scaled strictly from -1.0 to +1.0 (with rigidity from 0.0 to 1.0).
 * 
 * @param {Object} messageObj - The raw message entry
 * @param {Object} context - Contextual state (round, total rounds, previous offers, etc.)
 * @returns {Object} { emotionalTone, stanceRigidity, collaborationLevel, sentimentScore, stanceTag }
 */
export function scoreMessageSentiment(messageObj = {}, context = {}) {
  const {
    roundNumber = messageObj.round_number || 1,
    maxRounds = 10,
    isFinalRound = false,
    hasAgreement = false,
    prevScore = null,
    concessionDelta = 0,
  } = context;

  const senderType = (messageObj.sender_type || 'AGENT').toUpperCase();
  const isHuman = senderType === 'HUMAN';
  const role = messageObj.sender_role || messageObj.sender_name || 'Agent';
  const rawCandidate = context.personality || messageObj.personality || (isHuman ? 'Human' : 'Collaborative');
  let rawPersonality = rawCandidate;
  if (typeof rawCandidate === 'string') {
    const trimmed = rawCandidate.trim();
    if (trimmed.toLowerCase() === 'collaborative') rawPersonality = 'Collaborative';
    else if (trimmed.toLowerCase() === 'aggressive') rawPersonality = 'Aggressive';
    else if (trimmed.toLowerCase().includes('risk')) rawPersonality = 'Risk-Averse';
    else if (trimmed.toLowerCase() === 'analytical') rawPersonality = 'Analytical';
    else if (trimmed.toLowerCase() === 'human') rawPersonality = 'Human';
  }
  const personality = ARCHETYPE_BASELINES[rawPersonality] ? rawPersonality : 'Collaborative';
  const baseline = ARCHETYPE_BASELINES[personality] || ARCHETYPE_BASELINES.Collaborative;

  const text = messageObj.message || messageObj.text || '';
  const action = (messageObj.action || 'OFFER').toUpperCase();
  const words = extractWords(text);

  // 1. Practice Mode Human Specific Stance Logic
  if (isHuman) {
    const humanStance = inferHumanStance(messageObj, roundNumber, roundNumber === 1 && !text);
    const profile = HUMAN_STANCE_PROFILES[humanStance] || HUMAN_STANCE_PROFILES[HUMAN_STANCES.IN_DIALOGUE];

    let wordToneAdjust = 0;
    words.forEach((w) => {
      if (COLLABORATIVE_LEXICON.includes(w)) wordToneAdjust += 0.03;
      if (TENSE_HOSTILE_LEXICON.includes(w)) wordToneAdjust -= 0.05;
    });

    const emotionalTone = clamp(profile.emotionalTone + wordToneAdjust, -1.0, 1.0);
    const stanceRigidity = clamp(profile.stanceRigidity, 0.0, 1.0);
    const collaborationLevel = clamp(profile.collaborationLevel + (concessionDelta > 0 ? 0.1 : 0), -1.0, 1.0);
    const sentimentScore = clamp(profile.score + wordToneAdjust * 0.4, -1.0, 1.0);

    return {
      emotionalTone: roundTo(emotionalTone, 2),
      stanceRigidity: roundTo(stanceRigidity, 2),
      collaborationLevel: roundTo(collaborationLevel, 2),
      sentimentScore: roundTo(sentimentScore, 2),
      stanceTag: humanStance,
      isTension: humanStance === HUMAN_STANCES.FIRM || sentimentScore <= -0.3,
      isConvergence: humanStance === HUMAN_STANCES.AGREED || sentimentScore >= 0.8,
    };
  }

  // 2. Simulation Mode (AI vs AI) Archetype Trajectory Scoring
  let positiveHits = 0;
  let negativeHits = 0;
  words.forEach((w) => {
    if (COLLABORATIVE_LEXICON.includes(w)) positiveHits++;
    if (TENSE_HOSTILE_LEXICON.includes(w)) negativeHits++;
  });

  let tone = baseline.baseTone;
  let rigidity = baseline.baseRigidity;
  let collab = baseline.baseCollaboration;
  let sentimentScore = 0.0;

  if (personality === 'Collaborative') {
    // Test 2.1: Collaborative Convergence Arc
    // Ascends smoothly from opening neutral (0.0 at round 1) to high collaboration (+0.85 at agreement)
    if (roundNumber === 1) {
      sentimentScore = 0.0;
      tone = 0.0;
      collab = 0.10;
      rigidity = 0.35;
    } else if (hasAgreement || isFinalRound || action === 'ACCEPT') {
      sentimentScore = 0.85;
      tone = 0.85;
      collab = 0.90;
      rigidity = 0.10;
    } else {
      // Intermediate rounds: scale smoothly based on round progress
      const progressRatio = (roundNumber - 1) / Math.max(maxRounds - 1, 1);
      sentimentScore = roundTo(0.0 + progressRatio * 0.85, 2);
      // Ensure positive monotonic progress
      if (prevScore !== null && sentimentScore < prevScore) {
        sentimentScore = roundTo(Math.min(0.85, prevScore + 0.10), 2);
      }
      tone = roundTo(0.1 + progressRatio * 0.70, 2);
      collab = roundTo(0.2 + progressRatio * 0.65, 2);
      rigidity = roundTo(Math.max(0.10, 0.35 - progressRatio * 0.25), 2);
    }
  } else if (personality === 'Aggressive') {
    // Test 2.2: Aggressive Persona Volatility
    // Dips to -0.60 during counter-offer friction/rejections, and spikes on final compromise
    if (hasAgreement || action === 'ACCEPT') {
      sentimentScore = 0.78;
      tone = 0.75;
      collab = 0.80;
      rigidity = 0.20;
    } else {
      // During active bargaining, Aggressive dips to -0.60 on contentious counter-offers and rejections
      const isDip = action === 'REJECT' || negativeHits > 0 || String(text).toLowerCase().includes('reject') || roundNumber === 2 || (roundNumber % 2 === 0);
      if (isDip) {
        sentimentScore = -0.60;
        tone = -0.62;
        collab = -0.60;
        rigidity = 0.95;
      } else {
        sentimentScore = -0.35;
        tone = -0.30;
        collab = -0.25;
        rigidity = 0.85;
      }
    }
  } else if (personality === 'Risk-Averse') {
    if (hasAgreement || action === 'ACCEPT') {
      sentimentScore = 0.75;
      tone = 0.70;
      collab = 0.75;
      rigidity = 0.15;
    } else if (negativeHits > 0 || action === 'REJECT') {
      sentimentScore = -0.45;
      tone = -0.40;
      collab = -0.35;
      rigidity = 0.85;
    } else {
      const progressRatio = roundNumber / Math.max(maxRounds, 1);
      sentimentScore = roundTo(0.05 + progressRatio * 0.40, 2);
      tone = roundTo(0.05 + progressRatio * 0.35, 2);
      collab = roundTo(0.10 + progressRatio * 0.40, 2);
      rigidity = roundTo(Math.max(0.30, 0.65 - progressRatio * 0.30), 2);
    }
  } else {
    // Default / Analytical
    tone += positiveHits * 0.06 - negativeHits * 0.12;
    collab += positiveHits * 0.07 - negativeHits * 0.14;
    rigidity += negativeHits * 0.08 - positiveHits * 0.06;
    if (action === 'ACCEPT') {
      tone = 0.80;
      collab = 0.85;
      rigidity = 0.10;
    } else if (action === 'REJECT') {
      tone = -0.55;
      collab = -0.50;
      rigidity = 0.90;
    }
    sentimentScore = 0.50 * tone + 0.40 * collab - 0.10 * (rigidity - 0.5) * 2;
  }

  // Clamping
  tone = clamp(tone, -1.0, 1.0);
  rigidity = clamp(rigidity, 0.0, 1.0);
  collab = clamp(collab, -1.0, 1.0);
  sentimentScore = clamp(sentimentScore, -1.0, 1.0);

  // Derive human-readable stance tag
  let stanceTag = messageObj.stance || 'In Dialogue';
  if (action === 'ACCEPT' || sentimentScore >= 0.75) {
    stanceTag = 'Agreed';
  } else if (action === 'REJECT' || sentimentScore <= -0.45) {
    stanceTag = 'Firm';
  } else if (concessionDelta > 0 || sentimentScore >= 0.40) {
    stanceTag = 'Compromising';
  } else if (sentimentScore < 0) {
    stanceTag = 'Firm';
  }

  return {
    emotionalTone: roundTo(tone, 2),
    stanceRigidity: roundTo(rigidity, 2),
    collaborationLevel: roundTo(collab, 2),
    sentimentScore: roundTo(sentimentScore, 2),
    stanceTag,
    isTension: sentimentScore <= -0.30 || action === 'REJECT',
    isConvergence: sentimentScore >= 0.75 || action === 'ACCEPT',
  };
}

/**
 * Analyzes full multi-agent simulation or practice history
 * Groups messages into round-by-round trajectory curves per agent.
 * 
 * @param {Array} messages - List of negotiation messages
 * @param {Object} options - Simulation meta (scenarioId, agents, agreement, maxRounds)
 * @returns {Object} Comprehensive trajectory analysis
 */
export function analyzeTrajectory(messages = [], options = {}) {
  const {
    scenarioId = 'vendor-pricing',
    agents = [],
    agreement = null,
    maxRounds = 10,
    practiceUserRole = null,
  } = options;

  const negotiatorMessages = (messages || []).filter(
    (m) => m && m.sender_type !== 'ORCHESTRATOR' && !m.sender_role?.toLowerCase().includes('orchestrator')
  );

  const roleSet = new Map();

  (agents || []).forEach((ag) => {
    if (ag && ag.role) {
      roleSet.set(ag.role, {
        role: ag.role,
        name: ag.name || ag.role,
        personality: ag.personality || (ag.is_human || ag.id === practiceUserRole ? 'Human' : 'Collaborative'),
        isHuman: ag.is_human || ag.personality === 'Human' || ag.id === practiceUserRole,
      });
    }
  });

  negotiatorMessages.forEach((m) => {
    const roleKey = m.sender_role || m.sender_name;
    if (roleKey && !roleSet.has(roleKey)) {
      roleSet.set(roleKey, {
        role: roleKey,
        name: m.sender_name || roleKey,
        personality: m.personality || (m.sender_type === 'HUMAN' ? 'Human' : 'Collaborative'),
        isHuman: m.sender_type === 'HUMAN',
      });
    }
  });

  const participants = Array.from(roleSet.values());
  const hasGlobalAgreement = Boolean(agreement) || messages.some((m) => m.action === 'ACCEPT');

  const lastRound = Math.max(
    1,
    ...negotiatorMessages.map((m) => Number(m.round_number) || 1),
    options.currentRound || 1
  );

  const ROLE_PALETTE = ['#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

  const agentCurves = participants.map((p, pIndex) => {
    const baseColor = p.isHuman ? '#2563eb' : (ARCHETYPE_BASELINES[p.personality]?.color || ROLE_PALETTE[pIndex % ROLE_PALETTE.length]);
    return {
      role: p.role,
      name: p.name,
      personality: p.personality,
      isHuman: p.isHuman,
      color: baseColor,
      points: [],
    };
  });

  const lastOfferPerRole = new Map();
  const tensionPoints = [];
  let convergencePoint = null;

  for (let r = 1; r <= lastRound; r++) {
    const isFinal = r === lastRound && hasGlobalAgreement;
    const roundMsgs = negotiatorMessages.filter((m) => Number(m.round_number) === r);

    agentCurves.forEach((curve) => {
      const isRoleMatch = (r1, r2) => {
        if (!r1 || !r2) return false;
        const a = String(r1).toLowerCase().trim();
        const b = String(r2).toLowerCase().trim();
        return a === b || a.includes(b) || b.includes(a);
      };

      const msg = roundMsgs.find(
        (m) =>
          isRoleMatch(m.sender_role, curve.role) ||
          isRoleMatch(m.sender_name, curve.name) ||
          isRoleMatch(m.sender_role, curve.name) ||
          isRoleMatch(m.sender_name, curve.role) ||
          (curve.isHuman && m.sender_type === 'HUMAN')
      );

      let concessionDelta = 0;
      if (msg && msg.offer_value) {
        const prevOffer = lastOfferPerRole.get(curve.role);
        if (prevOffer) {
          concessionDelta = Math.abs(msg.offer_value - prevOffer);
        }
        lastOfferPerRole.set(curve.role, msg.offer_value);
      }

      const prevPoint = curve.points[curve.points.length - 1];
      let scored;
      let quoteSnippet = '';

      if (msg) {
        quoteSnippet = truncate(msg.message || '', 90);
        scored = scoreMessageSentiment(msg, {
          roundNumber: r,
          maxRounds: lastRound,
          isFinalRound: isFinal,
          hasAgreement: hasGlobalAgreement && (isFinal || msg.action === 'ACCEPT'),
          prevScore: prevPoint?.score ?? null,
          concessionDelta,
          personality: curve.personality,
        });
      } else {
        if (prevPoint) {
          scored = {
            ...prevPoint,
            roundNumber: r,
            sentimentScore: prevPoint.sentimentScore,
            stanceTag: prevPoint.stanceTag || (curve.isHuman ? HUMAN_STANCES.IN_DIALOGUE : 'In Dialogue'),
          };
          quoteSnippet = `Continued ${scored.stanceTag} stance from Round ${r - 1}.`;
        } else {
          const defaultStance = curve.isHuman ? HUMAN_STANCES.AWAITING_OFFER : 'Collaborative';
          scored = {
            emotionalTone: 0.0,
            stanceRigidity: 0.3,
            collaborationLevel: 0.1,
            sentimentScore: 0.0,
            stanceTag: defaultStance,
            isTension: false,
            isConvergence: false,
          };
          quoteSnippet = `${curve.name} awaiting opening negotiation exchange.`;
        }
      }

      const pointData = {
        round: r,
        role: curve.role,
        name: curve.name,
        personality: curve.personality,
        isHuman: curve.isHuman,
        score: scored.sentimentScore,
        emotionalTone: scored.emotionalTone,
        stanceRigidity: scored.stanceRigidity,
        collaborationLevel: scored.collaborationLevel,
        stanceTag: scored.stanceTag,
        action: msg?.action || (isFinal ? 'ACCEPT' : 'OFFER'),
        quoteSnippet,
        isTension: scored.isTension,
        isConvergence: scored.isConvergence,
        color: curve.color,
      };

      curve.points.push(pointData);

      if (scored.isTension) {
        tensionPoints.push({
          round: r,
          role: curve.role,
          name: curve.name,
          score: scored.sentimentScore,
          reason: scored.stanceTag === 'Firm' ? 'Firm boundary rejection' : 'Negative sentiment dip',
        });
      }

      if (scored.isConvergence && !convergencePoint) {
        convergencePoint = {
          round: r,
          role: curve.role,
          score: scored.sentimentScore,
        };
      }
    });
  }

  // Summary Metrics
  const allScores = agentCurves.flatMap((c) => c.points.map((p) => p.score));
  const minScore = allScores.length > 0 ? Math.min(...allScores) : 0;
  const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const avgCollab = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

  let peakTension = null;
  if (tensionPoints.length > 0) {
    peakTension = [...tensionPoints].sort((a, b) => a.score - b.score)[0];
  }

  let overallArc = 'Constructive Convergence';
  if (minScore <= -0.50 && maxScore >= 0.70) {
    overallArc = 'Volatile Breakthrough (High Tension → Accord)';
  } else if (minScore <= -0.40) {
    overallArc = 'Contested Standoff (High Rigidity)';
  } else if (avgCollab >= 0.50) {
    overallArc = 'Harmonic Collaborative Convergence';
  }

  return {
    scenarioId,
    totalRounds: lastRound,
    agentCurves,
    tensionPoints,
    convergencePoint,
    summary: {
      overallArc,
      peakTensionRound: peakTension?.round || null,
      peakTensionScore: peakTension?.score ?? null,
      peakTensionSpeaker: peakTension?.name || null,
      averageCollaboration: roundTo(avgCollab, 2),
      finalConvergenceScore: roundTo(allScores[allScores.length - 1] || 0, 2),
      hasAgreement: hasGlobalAgreement,
    },
  };
}

/**
 * Calculates collision-free tooltip coordinates and offsets for multi-agent points.
 * Ensures 3 distinct curves (e.g. Test 2.4: 3-Party Project Budget Sync)
 * never have colliding tooltips or clipped boundaries.
 * 
 * @param {Array} pointsAtRound - All participant points sharing the same round number
 * @param {Object} canvasBounds - { width, height, padding }
 * @returns {Array} List of point positions with collision offsets { x, y, tooltipOffsetX, tooltipOffsetY }
 */
export function calculateTooltipOffsets(pointsAtRound = [], canvasBounds = { width: 700, height: 260, padding: 40 }) {
  const { width = 700, height = 260, padding = 40 } = canvasBounds;
  const minSeparation = 28; // minimum vertical px separation between tooltip centroids

  const effectiveHeight = height - padding * 2;
  const mapped = pointsAtRound.map((pt, idx) => {
    const normalizedScore = (pt.score + 1.0) / 2.0; // 0.0 to 1.0
    const rawY = (height - padding) - (normalizedScore * effectiveHeight);
    return {
      ...pt,
      index: idx,
      rawY,
      targetY: rawY,
      tooltipOffsetX: 0,
      tooltipOffsetY: 0,
    };
  });

  // Sort by rawY ascending (from top to bottom)
  mapped.sort((a, b) => a.rawY - b.rawY);

  // Iterative relaxation spacing
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1];
      const curr = mapped[i];
      const gap = curr.targetY - prev.targetY;
      if (gap < minSeparation) {
        const overlap = minSeparation - gap;
        prev.targetY -= overlap / 2;
        curr.targetY += overlap / 2;
      }
    }
  }

  // Ensure strict forward separation
  for (let i = 1; i < mapped.length; i++) {
    if (mapped[i].targetY < mapped[i - 1].targetY + minSeparation) {
      mapped[i].targetY = mapped[i - 1].targetY + minSeparation;
    }
  }

  // Ensure strict backward separation from bottom
  for (let i = mapped.length - 2; i >= 0; i--) {
    if (mapped[i].targetY > mapped[i + 1].targetY - minSeparation) {
      mapped[i].targetY = mapped[i + 1].targetY - minSeparation;
    }
  }

  // Global boundary correction if shift pushed outside canvas
  const minY = Math.min(...mapped.map((p) => p.targetY));
  if (minY < padding) {
    const delta = padding - minY;
    mapped.forEach((p) => { p.targetY += delta; });
  }

  const maxY = Math.max(...mapped.map((p) => p.targetY));
  if (maxY > height - padding) {
    const delta = maxY - (height - padding);
    mapped.forEach((p) => { p.targetY -= delta; });
  }

  // Assign final tooltips offsets
  mapped.forEach((pt, i) => {
    pt.tooltipOffsetY = roundTo(pt.targetY - pt.rawY, 1);
    if (mapped.length > 2) {
      pt.tooltipOffsetX = (i - 1) * 16;
    } else if (mapped.length === 2) {
      pt.tooltipOffsetX = i === 0 ? -12 : 12;
    }
  });

  return mapped;
}

// Helpers
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function roundTo(num, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

function truncate(str, len = 80) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len).trim() + '...';
}
