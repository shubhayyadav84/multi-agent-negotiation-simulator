
const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const getRoleType = (agent, scenarioId) => {
  const role = `${agent.role || ''} ${agent.name || ''}`.toLowerCase();

  if (scenarioId === 'vendor-pricing') {
    if (/buyer|procurement|purchasing/.test(role)) return 'lower';
    if (/seller|sales|vendor/.test(role)) return 'higher';
  }

  if (scenarioId === 'job-offer') {
    if (/recruiter|hiring|talent/.test(role)) return 'lower';
    if (/candidate/.test(role)) return 'higher';
  }

  return 'higher';
};

const calculateGoalAchievement = (agent, finalValue, scenarioId) => {
  const target = Number(agent.target_value);
  const reservation = Number(agent.reservation_value);

  if (
    !Number.isFinite(target) ||
    !Number.isFinite(reservation) ||
    !Number.isFinite(finalValue) ||
    target === reservation
  ) return 0;

  if (getRoleType(agent, scenarioId) === 'lower') {
    if (finalValue <= target) return 100;
    if (finalValue >= reservation) return 0;

    return clamp(
      ((reservation - finalValue) / (reservation - target)) * 100
    );
  }

  if (finalValue >= target) return 100;
  if (finalValue <= reservation) return 0;

  return clamp(
    ((finalValue - reservation) / (target - reservation)) * 100
  );
};

const isWithinReservationLimits = (agents, finalValue, scenarioId) => {
  if (!Array.isArray(agents) || agents.length < 2) return false;

  return agents.every((agent) => {
    const reservation = Number(agent.reservation_value);

    if (!Number.isFinite(reservation)) return false;

    return getRoleType(agent, scenarioId) === 'lower'
      ? finalValue <= reservation
      : finalValue >= reservation;
  });
};

const getAgentOffers = (agent, offers) => {
  const role = String(agent.role || '').toLowerCase().trim();

  return offers
    .filter((offer) =>
      String(offer.agent_role || offer.role || '')
        .toLowerCase()
        .trim() === role
    )
    .filter((offer) => Number.isFinite(Number(offer.offer_value)))
    .sort((a, b) => {
      const roundDifference =
        Number(a.round_number || 0) - Number(b.round_number || 0);

      if (roundDifference !== 0) return roundDifference;

      return new Date(a.created_at || 0) -
        new Date(b.created_at || 0);
    });
};

const calculateConcessionBalance = (
  agents,
  finalValue,
  offers,
  scenarioId
) => {
  if (
    !Array.isArray(agents) ||
    agents.length < 2 ||
    !Array.isArray(offers) ||
    offers.length === 0
  ) return 0;

  const rates = agents.map((agent) => {
    const target = Number(agent.target_value);
    const reservation = Number(agent.reservation_value);

    if (
      !Number.isFinite(target) ||
      !Number.isFinite(reservation) ||
      target === reservation
    ) return 0;

    const history = getAgentOffers(agent, offers);

    if (history.length < 2) return 0;

    const opening = Number(history[0].offer_value);
    const latest = Number(history[history.length - 1].offer_value);

    const lowerSide = getRoleType(agent, scenarioId) === 'lower';

    const concession = lowerSide
      ? latest - opening
      : opening - latest;

    const concessionRange = lowerSide
      ? reservation - target
      : target - reservation;

    if (concession <= 0 || concessionRange <= 0) return 0;

    return clamp((concession / concessionRange) * 100);
  });

  const highestRate = Math.max(...rates);
  const lowestRate = Math.min(...rates);

  if (highestRate === 0) return 0;

  // Measures how evenly participants shared their concession effort.
  return Math.round((lowestRate / highestRate) * 100);
};

const calculateJointSurplus = (agents, finalValue, scenarioId, validSettlement) => {
  const lowerAgent = agents.find(
    (agent) => getRoleType(agent, scenarioId) === 'lower'
  );

  const higherAgent = agents.find(
    (agent) => getRoleType(agent, scenarioId) === 'higher'
  );

  if (!lowerAgent || !higherAgent) {
    return {
      score: 0,
      totalSurplus: 0,
      maximumSurplus: 0,
      lowerSideSurplus: 0,
      higherSideSurplus: 0,
      lowerSideShare: 0,
      higherSideShare: 0,
    };
  }

  const lowerReservation = Number(lowerAgent.reservation_value);
  const higherReservation = Number(higherAgent.reservation_value);

  const maximumSurplus = Math.max(
    0,
    lowerReservation - higherReservation
  );

  if (!validSettlement || maximumSurplus <= 0) {
    return {
      score: 0,
      totalSurplus: 0,
      maximumSurplus,
      lowerSideSurplus: 0,
      higherSideSurplus: 0,
      lowerSideShare: 0,
      higherSideShare: 0,
    };
  }

  const lowerSideSurplus = Math.max(
    0,
    lowerReservation - finalValue
  );

  const higherSideSurplus = Math.max(
    0,
    finalValue - higherReservation
  );

  const totalSurplus = lowerSideSurplus + higherSideSurplus;

  const score = clamp(
    (totalSurplus / maximumSurplus) * 100
  );

  return {
    score: Math.round(score),
    totalSurplus,
    maximumSurplus,
    lowerSideSurplus,
    higherSideSurplus,
    lowerSideShare: totalSurplus
      ? Math.round((lowerSideSurplus / totalSurplus) * 100)
      : 0,
    higherSideShare: totalSurplus
      ? Math.round((higherSideSurplus / totalSurplus) * 100)
      : 0,
  };
};

const calculateResolutionScore = (simulation) => {
  const agents = simulation.agents || [];
  const offers = simulation.offers || [];
  const agreement = simulation.agreement;
  const scenarioId = simulation.scenario_id;

  const isAgreement =
    ['COMPLETED', 'AGREEMENT_REACHED'].includes(simulation.status) &&
    Boolean(agreement);

  const isDeadlock = simulation.status === 'DEADLOCK';

  const finalValue = Number(
    agreement?.final_value ??
    agreement?.terms?.agreedPrice ??
    0
  );

  const validSettlement =
    isAgreement &&
    Number.isFinite(finalValue) &&
    agents.length >= 2 &&
    isWithinReservationLimits(agents, finalValue, scenarioId);

  // 1. Goal achievement.
  const goalAchievement = validSettlement
    ? agents.reduce(
        (sum, agent) =>
          sum + calculateGoalAchievement(agent, finalValue, scenarioId),
        0
      ) / agents.length
    : 0;

  // 2. Concession fairness.
  const concessionBalance = validSettlement
    ? calculateConcessionBalance(
        agents,
        finalValue,
        offers,
        scenarioId
      )
    : 0;

  // 3. Turn efficiency.
  const currentRound = Math.max(
    1,
    Number(simulation.current_round || 1)
  );

  const maxRounds = Math.max(
    1,
    Number(simulation.max_rounds || 1)
  );

  const turnEfficiency = clamp(
    100 * (1 - (currentRound - 1) / maxRounds)
  );

  // 4. Joint surplus and value creation.
  const jointSurplus = calculateJointSurplus(
    agents,
    finalValue,
    scenarioId,
    validSettlement
  );

  // 5. Outcome multiplier.
  let outcomeMultiplier = 0.50;

  if (validSettlement) {
    outcomeMultiplier = 1.05;
  } else if (isDeadlock) {
    outcomeMultiplier = 0.45;
  } else if (isAgreement) {
    outcomeMultiplier = 0.45;
  }

  // Weighted score.
  const rawScore =
    goalAchievement * 0.20 +
    concessionBalance * 0.20 +
    turnEfficiency * 0.20 +
    jointSurplus.score * 0.40;

  let score = Math.round(
    clamp(rawScore * outcomeMultiplier)
  );

  if (isDeadlock) {
    score = Math.min(score, 45);
  }

  if (isAgreement && !validSettlement) {
    score = Math.min(score, 49);
  }

  // Identify Practice Mode.
  const humanAgent = agents.find(
    (agent) =>
      agent.personality === 'Human' ||
      agent.is_human === true
  );

  const isPractice = Boolean(humanAgent);

  // Calculate the candidate's salary surplus.
  const candidate = agents.find((agent) =>
    /candidate/i.test(`${agent.role || ''} ${agent.name || ''}`)
  );

  const salarySurplus =
    isPractice && candidate && validSettlement
      ? finalValue - Number(candidate.reservation_value)
      : null;

  // Practice Mode performance badge.
  let badge = null;

  if (isPractice) {
    if (score >= 90) {
      badge = 'Excellent';
    } else if (score >= 70) {
      badge = 'Competent';
    } else {
      badge = 'Sub-optimal';
    }
  }

  return {
    totalScore: score,
    badge,
    mode: isPractice ? 'Practice' : 'Simulation',
    finalValue: isAgreement ? finalValue : null,

    components: {
      goalAchievement: Math.round(goalAchievement),
      concessionBalance,
      turnEfficiency: Math.round(turnEfficiency),
      jointSurplus: jointSurplus.score,
      outcomeMultiplier,
      outcomeQuality: validSettlement ? 100 : 0,
    },

    surplusDistribution: {
      totalSurplus: jointSurplus.totalSurplus,
      maximumSurplus: jointSurplus.maximumSurplus,
      lowerSideSurplus: jointSurplus.lowerSideSurplus,
      higherSideSurplus: jointSurplus.higherSideSurplus,
      lowerSideShare: jointSurplus.lowerSideShare,
      higherSideShare: jointSurplus.higherSideShare,
    },

    salarySurplus,

    outcome: isAgreement
      ? 'AGREEMENT'
      : isDeadlock
        ? 'DEADLOCK'
        : 'INCOMPLETE',

    validSettlement: Boolean(validSettlement),
  };
};

module.exports = {
  calculateResolutionScore,
  calculateGoalAchievement,
  calculateConcessionBalance,
  calculateJointSurplus,
  isWithinReservationLimits,
};
