/**
 * Post-Interaction Summary Agent Generation Service
 * Milestone 4 - Member 1 Feature
 *
 * Automatically generates comprehensive post-negotiation executive summaries,
 * concession trajectory milestones, opening bid audits, and decision point narratives
 * for both Simulation Mode (AI vs AI) and Practice Mode (Human vs AI).
 */

/**
 * Format currency amounts nicely
 */
function formatCurrency(amount, currency = '₹') {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return 'N/A';
  return `${currency}${Number(amount).toLocaleString()}`;
}

/**
 * Ingests multi-round messages and offers to extract initial opening bids
 */
function extractOpeningBids(simulation) {
  const messages = simulation.messages || [];
  const offers = simulation.offers || [];
  const agents = simulation.agents || [];
  const openingBids = [];
  const seenRoles = new Set();

  // 1. Check structured offers first
  for (const offer of offers) {
    if (offer.agent_role && !seenRoles.has(offer.agent_role)) {
      seenRoles.add(offer.agent_role);
      const agent = agents.find((a) => a.role === offer.agent_role) || {};
      openingBids.push({
        agent_role: offer.agent_role,
        agent_name: agent.name || offer.agent_role,
        personality: agent.personality || 'Unknown',
        is_human: Boolean(agent.is_human || agent.personality === 'Human'),
        round_number: offer.round_number || 1,
        offer_value: offer.offer_value,
        terms: offer.terms || {},
      });
    }
  }

  // 2. Fallback to transcript messages if offers table was empty
  if (openingBids.length === 0) {
    for (const msg of messages) {
      if (
        msg.offer_value !== null &&
        msg.offer_value !== undefined &&
        msg.sender_role &&
        !seenRoles.has(msg.sender_role) &&
        msg.sender_type !== 'ORCHESTRATOR'
      ) {
        seenRoles.add(msg.sender_role);
        const agent = agents.find((a) => a.role === msg.sender_role) || {};
        openingBids.push({
          agent_role: msg.sender_role,
          agent_name: msg.sender_name || agent.name || msg.sender_role,
          personality: msg.personality || agent.personality || 'Unknown',
          is_human: Boolean(agent.is_human || agent.personality === 'Human' || msg.sender_type === 'HUMAN'),
          round_number: msg.round_number || 1,
          offer_value: msg.offer_value,
          terms: msg.terms || {},
        });
      }
    }
  }

  return openingBids;
}

/**
 * Analyzes round-by-round shifts to extract key concession milestones
 */
function extractConcessionMilestones(simulation) {
  const messages = simulation.messages || [];
  const milestones = [];
  const lastOffersByRole = {};

  for (const msg of messages) {
    if (
      msg.sender_type === 'ORCHESTRATOR' ||
      !msg.sender_role ||
      msg.offer_value === null ||
      msg.offer_value === undefined
    ) {
      continue;
    }

    const role = msg.sender_role;
    const currentVal = Number(msg.offer_value);
    const prevVal = lastOffersByRole[role];

    if (prevVal !== undefined && prevVal !== currentVal) {
      const delta = currentVal - prevVal;
      const direction = delta > 0 ? 'increased' : 'decreased';
      milestones.push({
        round: msg.round_number,
        agent_role: role,
        agent_name: msg.sender_name,
        previous_value: prevVal,
        new_value: currentVal,
        concession_amount: Math.abs(delta),
        direction,
        action: msg.action || 'COUNTER_OFFER',
        description: `${msg.sender_name} (${role}) ${direction} offer from ${prevVal} to ${currentVal} in Round ${msg.round_number}.`,
      });
    }

    lastOffersByRole[role] = currentVal;
  }

  return milestones;
}

/**
 * Identifies any compromise proposals (Orchestrator deadlock compromise or midpoint steps)
 */
function extractCompromiseProposals(simulation) {
  const compromises = [];
  const deadlockRes = simulation.deadlock_resolution;

  if (deadlockRes?.initial_compromise) {
    compromises.push({
      type: 'DEADLOCK_INITIAL_COMPROMISE',
      round: deadlockRes.initial_compromise.round || simulation.current_round,
      proposed_value: deadlockRes.initial_compromise.offer_value,
      summary: deadlockRes.initial_compromise.summary || 'Orchestrator calculated midpoint compromise.',
      terms: deadlockRes.initial_compromise.terms || {},
      status: deadlockRes.status || 'PROPOSED',
    });
  }

  if (deadlockRes?.latest_proposal && deadlockRes.latest_proposal !== deadlockRes.initial_compromise) {
    compromises.push({
      type: 'DEADLOCK_REVISED_COMPROMISE',
      round: simulation.current_round,
      proposed_value: deadlockRes.latest_proposal.offer_value,
      summary: deadlockRes.latest_proposal.summary || 'Revised compromise proposal.',
      terms: deadlockRes.latest_proposal.terms || {},
      status: deadlockRes.status || 'PROPOSED',
    });
  }

  const messages = simulation.messages || [];
  for (const msg of messages) {
    if (
      msg.sender_type === 'ORCHESTRATOR' &&
      (msg.message?.toLowerCase().includes('compromise') ||
        msg.message?.toLowerCase().includes('deadlock resolution') ||
        msg.action === 'COMPROMISE_PROPOSAL')
    ) {
      compromises.push({
        type: 'ORCHESTRATOR_MEDIATION',
        round: msg.round_number,
        proposed_value: msg.offer_value,
        summary: msg.message,
      });
    }
  }

  return compromises;
}

/**
 * Generates qualitative comparative strategic analysis for Simulation Mode (AI vs AI)
 * Explains which agent demonstrated better negotiation strategies and why without numerical scores.
 */
function generateStrategicAgentCritique(simulation, openingBids, milestones) {
  const agents = simulation.agents || [];
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  const agent1 = agents[0] || { name: 'Agent 1', role: 'Buyer', personality: 'Collaborative', target_value: 90000, reservation_value: 115000 };
  const agent2 = agents[1] || { name: 'Agent 2', role: 'Seller', personality: 'Aggressive', target_value: 120000, reservation_value: 95000 };

  const a1Milestones = milestones.filter((m) => m.agent_role === agent1.role);
  const a2Milestones = milestones.filter((m) => m.agent_role === agent2.role);

  const a1TotalConcession = a1Milestones.reduce((sum, m) => sum + (m.concession_amount || 0), 0);
  const a2TotalConcession = a2Milestones.reduce((sum, m) => sum + (m.concession_amount || 0), 0);

  // Determine better agent qualitatively
  let betterAgent = agent1;
  let reasonCritique = '';

  if (isAgreement) {
    const finalVal = Number(agreement?.final_value || simulation.agreement_final_value || 0);
    // If agent1 is buyer / lower side
    const isA1Lower = /buyer|procurement|purchasing|recruiter|hiring/i.test(`${agent1.role} ${agent1.name}`);
    if (isA1Lower && Number.isFinite(finalVal) && Number.isFinite(Number(agent1.target_value))) {
      const a1DistanceToTarget = Math.abs(finalVal - Number(agent1.target_value));
      const a2DistanceToTarget = Math.abs(finalVal - Number(agent2.target_value || 0));
      if (a1DistanceToTarget <= a2DistanceToTarget) {
        betterAgent = agent1;
        reasonCritique = `${agent1.name} (${agent1.role}) demonstrated superior negotiation strategy by defending its reservation boundary and yielding fewer unforced concessions. It forced ${agent2.name} to absorb ${a2TotalConcession > a1TotalConcession ? 'the greater share of price movement' : 'reciprocal concessions'}, concluding settlement closer to its target valuation.`;
      } else {
        betterAgent = agent2;
        reasonCritique = `${agent2.name} (${agent2.role}) demonstrated superior strategic posture through disciplined anchor defense. Despite initial resistance, it preserved favorable pricing terms and required ${agent1.name} to concede upward before converging on mutual agreement.`;
      }
    } else {
      betterAgent = a1TotalConcession <= a2TotalConcession ? agent1 : agent2;
      reasonCritique = `${betterAgent.name} (${betterAgent.role}) exhibited stronger tactical discipline by pacing concessions gradually, avoiding sudden price drops, and maintaining alignment with core utility goals.`;
    }
  } else {
    // Deadlock / Impasse
    betterAgent = a1Milestones.length > 0 ? agent1 : agent2;
    reasonCritique = `In this deadlock impasse, ${betterAgent.name} (${betterAgent.role}) demonstrated more constructive bargaining behavior by tabling counteroffers and exploring compromise zones, whereas excessive stance rigidity stalled agreement convergence.`;
  }

  return {
    better_agent: `${betterAgent.name} (${betterAgent.role})`,
    rationale: reasonCritique,
    comparisons: [
      {
        dimension: 'Opening Anchor Firmness',
        analysis: `${openingBids[0]?.agent_name || agent1.name} established initial position at ${formatCurrency(openingBids[0]?.offer_value)}, while ${openingBids[1]?.agent_name || agent2.name} opened at ${formatCurrency(openingBids[1]?.offer_value)}. Both anchors created a structured ZOPA boundary.`,
      },
      {
        dimension: 'Concession Discipline & Pacing',
        analysis: `${agent1.name} executed ${a1Milestones.length} concession adjustments (${formatCurrency(a1TotalConcession)} cumulative) versus ${agent2.name}'s ${a2Milestones.length} adjustments (${formatCurrency(a2TotalConcession)} cumulative).`,
      },
      {
        dimension: 'Tactical Stance Adaptation',
        analysis: `${agent1.personality} profile adopted an adaptive posture, while ${agent2.personality} maintained pressure on core monetary terms across all active rounds.`,
      },
    ],
  };
}

/**
 * Calculates Negotiation Resolution Quality Score exclusively for Practice Mode (Human vs AI)
 * 1. Goal Achievement – 30%
 * 2. Agreement Status – 25%
 * 3. Negotiation Effectiveness – 25%
 * 4. Concession Management – 20%
 */
function calculatePracticeResolutionQuality(simulation, openingBids, milestones) {
  const agents = simulation.agents || [];
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);
  const isDeadlock = status === 'DEADLOCK';

  const humanAgent = agents.find((a) => a.is_human || a.personality === 'Human') || agents[0] || {
    role: 'Candidate',
    target_value: 180000,
    reservation_value: 140000,
  };
  const aiAgent = agents.find((a) => a !== humanAgent) || agents[1] || {
    role: 'Employer',
    target_value: 130000,
    reservation_value: 165000,
  };

  const target = Number(humanAgent.target_value);
  const reservation = Number(humanAgent.reservation_value);
  const finalVal = Number(agreement?.final_value || simulation.agreement_final_value || 0);

  const isLowerSide = /buyer|procurement|purchasing|recruiter|hiring/i.test(`${humanAgent.role} ${humanAgent.name}`);

  // 1. Goal Achievement (30%)
  let goalAchievement = 50;
  if (isAgreement && Number.isFinite(finalVal) && Number.isFinite(target) && Number.isFinite(reservation)) {
    if (isLowerSide) {
      if (finalVal <= target) goalAchievement = 100;
      else if (finalVal >= reservation) goalAchievement = 10;
      else goalAchievement = Math.max(10, Math.min(100, Math.round(((reservation - finalVal) / (reservation - target)) * 100)));
    } else {
      if (finalVal >= target) goalAchievement = 100;
      else if (finalVal <= reservation) goalAchievement = 10;
      else goalAchievement = Math.max(10, Math.min(100, Math.round(((finalVal - reservation) / (target - reservation)) * 100)));
    }
  } else if (isDeadlock) {
    goalAchievement = 35; // Fair partial evaluation for maintaining reservation floor
  }

  // 2. Agreement Status (25%)
  let agreementStatus = 40;
  if (isAgreement) {
    agreementStatus = 100;
  } else if (isDeadlock) {
    const currentGap = Number(simulation.current_gap || 0);
    agreementStatus = currentGap > 0 && currentGap < 20000 ? 55 : 35; // Partial credit for narrowing gap
  }

  // 3. Negotiation Effectiveness (25%)
  const rounds = Number(simulation.current_round || 1);
  const humanMilestones = milestones.filter((m) => m.agent_role === humanAgent.role);
  let effectiveness = 75;
  if (rounds >= 2 && rounds <= 6) effectiveness += 15;
  else if (rounds === 1) effectiveness -= 20; // Premature settlement
  if (humanMilestones.length >= 1) effectiveness += 10;
  effectiveness = Math.max(20, Math.min(100, effectiveness));

  // 4. Concession Management (20%)
  let concessionManagement = 80;
  if (humanMilestones.length > 0) {
    const suddenDrop = humanMilestones.some((m) => m.concession_amount > 15000);
    if (suddenDrop) concessionManagement -= 20;
    else concessionManagement += 10;
  } else if (rounds > 2) {
    concessionManagement -= 15; // Complete rigidity
  }
  concessionManagement = Math.max(20, Math.min(100, concessionManagement));

  // Weighted Total
  const overall = Math.round(
    goalAchievement * 0.30 +
    agreementStatus * 0.25 +
    effectiveness * 0.25 +
    concessionManagement * 0.20
  );

  const badge = overall >= 85 ? 'Excellent' : overall >= 70 ? 'Competent' : 'Developing';

  const strengths = [];
  const weaknesses = [];

  if (goalAchievement >= 70) {
    strengths.push(`Strong Target Realization: Secured terms yielding high utility relative to your reservation limit.`);
  } else {
    weaknesses.push(`Surplus Compromise: Final terms settled closer to your reservation threshold than your initial target.`);
  }

  if (isAgreement) {
    strengths.push(`Successful Deal Convergence: Successfully reconciled positions within the overlapping ZOPA.`);
  } else {
    weaknesses.push(`Unresolved Standoff: Failed to discover reciprocal compromise before session round limits expired.`);
  }

  if (concessionManagement >= 75) {
    strengths.push(`Disciplined Concession Pacing: Executed measured concessions to prevent rapid surplus erosion.`);
  } else {
    weaknesses.push(`Concession Pacing: Made abrupt position jumps or remained overly rigid during pivotal turns.`);
  }

  let explanation = '';
  if (overall >= 85) {
    explanation = 'Outstanding negotiation execution. You anchored effectively, controlled concession tempo, and achieved a highly favorable settlement.';
  } else if (overall >= 70) {
    explanation = 'Competent bargaining performance. You successfully advanced the negotiation and achieved a viable outcome while maintaining professional composure.';
  } else {
    explanation = 'Sub-optimal resolution outcome. The session concluded with unresolved gap resistance or disproportionate concessions. Focus on strategic anchoring and reciprocal concessions.';
  }

  return {
    overall_score: overall,
    badge,
    factors: {
      goal_achievement: { score: goalAchievement, weight: 30, label: 'Goal Achievement' },
      agreement_status: { score: agreementStatus, weight: 25, label: 'Agreement Status' },
      negotiation_effectiveness: { score: effectiveness, weight: 25, label: 'Negotiation Effectiveness' },
      concession_management: { score: concessionManagement, weight: 20, label: 'Concession Management' },
    },
    explanation,
    strengths,
    weaknesses,
  };
}

/**
 * Calculates Final Negotiation Outcome Analysis (Both Modes)
 */
function calculateOutcomeAnalysis(simulation, isPracticeMode) {
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);
  const isDeadlock = status === 'DEADLOCK';
  const agents = simulation.agents || [];

  const finalVal = isAgreement ? Number(agreement?.final_value || simulation.agreement_final_value || 0) : null;

  const buyer = agents.find((a) => /buyer|procurement|purchasing|recruiter|hiring|engineering/i.test(`${a.role} ${a.name}`)) || agents[0] || {};
  const seller = agents.find((a) => a !== buyer) || agents[1] || {};

  const outcomeType = isAgreement
    ? 'Successful Agreement'
    : isDeadlock
    ? 'Impasse'
    : 'Failed Negotiation';

  let reason = '';
  if (isAgreement) {
    reason = `Mutual convergence achieved in Round ${simulation.current_round || 1}. Both parties established viable compromise terms within the overlapping Zone of Possible Agreement (ZOPA).`;
  } else if (isDeadlock) {
    reason = simulation.deadlock_reason || simulation.deadlock_resolution?.reason || 'Negotiation halted due to irreconcilable reservation limits and gap resistance.';
  } else {
    reason = 'Session ended without reaching formal agreement within allowable round parameters.';
  }

  const humanAgent = agents.find((a) => a.is_human || a.personality === 'Human');
  const humanAchieved = isAgreement && humanAgent
    ? (/buyer|recruiter/i.test(humanAgent.role) ? finalVal <= Number(humanAgent.reservation_value) : finalVal >= Number(humanAgent.reservation_value))
    : false;

  const aiAgent = agents.find((a) => a !== humanAgent);
  const aiAchieved = isAgreement && aiAgent
    ? (/seller|candidate/i.test(aiAgent.role) ? finalVal >= Number(aiAgent.reservation_value) : finalVal <= Number(aiAgent.reservation_value))
    : false;

  const buyerTarget = Number(buyer.target_value) || null;
  const buyerReservation = Number(buyer.reservation_value) || null;
  const sellerTarget = Number(seller.target_value) || null;
  const sellerReservation = Number(seller.reservation_value) || null;

  return {
    outcome_type: outcomeType,
    final_price: finalVal,
    buyer_target: buyerTarget,
    buyer_reservation: buyerReservation,
    seller_target: sellerTarget,
    seller_reservation: sellerReservation,
    buyer_limits: {
      target: buyerTarget,
      reservation: buyerReservation,
    },
    seller_limits: {
      target: sellerTarget,
      reservation: sellerReservation,
    },
    human_achieved_goal: humanAchieved,
    ai_achieved_goal: aiAchieved,
    human_goal_achieved: humanAchieved,
    ai_goal_achieved: aiAchieved,
    buyer_goal_achieved: isAgreement && buyer ? (finalVal <= (buyerReservation || Infinity)) : false,
    seller_goal_achieved: isAgreement && seller ? (finalVal >= (sellerReservation || 0)) : false,
    reason,
    primary_reason: reason,
    details: isAgreement ? `Settled at contract value of ${finalVal ? '₹' + finalVal.toLocaleString() : 'agreed terms'}.` : 'No agreement finalized.',
  };
}

/**
 * Generates executive narrative and analysis for Simulation Mode (AI vs AI)
 */
function generateSimulationModeNarrative(simulation, openingBids, milestones, compromises) {
  const scenarioTitle = simulation.scenario_title || simulation.scenario_id || 'Commercial Negotiation';
  const rounds = simulation.current_round || 1;
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const agents = simulation.agents || [];
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  const agent1 = agents[0] || { name: 'Agent 1', role: 'Buyer', personality: 'Collaborative' };
  const agent2 = agents[1] || { name: 'Agent 2', role: 'Seller', personality: 'Aggressive' };

  let narrative = '';

  // Opening paragraph: Setup & Opening Stances
  narrative += `In this ${scenarioTitle} session, ${agent1.name} (${agent1.role}, ${agent1.personality}) and ${agent2.name} (${agent2.role}, ${agent2.personality}) engaged in a ${rounds}-round autonomous negotiation. `;

  if (openingBids.length >= 2) {
    narrative += `The interaction opened with ${openingBids[0].agent_name} anchoring at ${formatCurrency(openingBids[0].offer_value)}, while ${openingBids[1].agent_name} set an opening position at ${formatCurrency(openingBids[1].offer_value)}. `;
  }

  // Middle paragraph: Concessions & Dynamic Trajectory
  if (milestones.length > 0) {
    narrative += `Across the rounds, both agents traded concessions across ${milestones.length} major turning points. `;
    const majorConcessions = milestones.slice(0, 3).map((m) => m.description).join(' ');
    narrative += `${majorConcessions} `;
  } else {
    narrative += `Both agents maintained firm positioning with restrained concession curves during initial rounds. `;
  }

  // Deadlock / Compromise check
  if (compromises.length > 0) {
    narrative += `As the negotiation reached an impasse, the Orchestrator mediation engine intervened with a compromise proposal to resolve the dispute. `;
  }

  // Closing paragraph: Resolution or Impasse
  if (isAgreement) {
    const finalVal = agreement?.final_value || simulation.agreement_final_value || 'settled terms';
    narrative += `The session successfully converged on an agreement in Round ${rounds} at ${formatCurrency(finalVal)}, achieving mutual satisfaction within the overlapping Zone of Possible Agreement (ZOPA).`;
  } else {
    const reason = simulation.deadlock_reason || simulation.deadlock_resolution?.reason || 'reservation thresholds could not be reconciled';
    narrative += `The negotiation concluded in a deadlock after ${rounds} rounds without reaching mutual consensus. Primary deadlock trigger: ${reason}.`;
  }

  const critique = generateStrategicAgentCritique(simulation, openingBids, milestones);
  const outcomeAnalysis = calculateOutcomeAnalysis(simulation, false);

  return {
    narrative,
    strategic_agent_critique: critique,
    outcome_analysis: outcomeAnalysis,
  };
}

/**
 * Generates human user bargaining trajectory, pivotal decision points, and final terms for Practice Mode
 */
function generatePracticeModeNarrative(simulation, openingBids, milestones, compromises) {
  const scenarioTitle = simulation.scenario_title || simulation.scenario_id || 'Practice Negotiation';
  const rounds = simulation.current_round || 1;
  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const agents = simulation.agents || [];
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  const humanAgent = agents.find((a) => a.is_human || a.personality === 'Human') || agents[0] || {
    name: 'User',
    role: 'Human Participant',
  };
  const aiCounterpart = agents.find((a) => a !== humanAgent) || agents[1] || {
    name: 'AI Counterpart',
    role: 'Opponent',
    personality: 'Collaborative',
  };

  const humanOffers = (simulation.messages || []).filter(
    (m) => m.sender_type === 'HUMAN' || m.sender_role === humanAgent.role
  );
  const humanMilestones = milestones.filter((m) => m.agent_role === humanAgent.role);

  // Assess user's bargaining style
  let styleAssessment = 'Balanced and Pragmatic';
  if (humanMilestones.length === 0) {
    styleAssessment = 'Extremely Firm / Anchor-Heavy';
  } else if (humanMilestones.length >= 3) {
    styleAssessment = 'Adaptive and Concession-Oriented';
  }

  let narrative = `In this Practice Mode session on ${scenarioTitle}, the human participant (${humanAgent.name}) negotiated against ${aiCounterpart.name} (${aiCounterpart.role}, ${aiCounterpart.personality}) over ${rounds} rounds. `;

  if (openingBids.length > 0) {
    const humanOpening = openingBids.find((b) => b.agent_role === humanAgent.role);
    if (humanOpening) {
      narrative += `You established an initial anchor at ${formatCurrency(humanOpening.offer_value)}. `;
    }
  }

  narrative += `Throughout the session, your bargaining pattern displayed a ${styleAssessment} strategy. `;

  if (humanMilestones.length > 0) {
    narrative += `You executed ${humanMilestones.length} deliberate offer adjustments in response to AI countermoves. `;
  } else {
    narrative += `You held firm to your opening numbers, requiring the AI agent to make the majority of the concessions. `;
  }

  if (isAgreement) {
    const finalVal = agreement?.final_value || 'agreed terms';
    narrative += `The negotiation concluded successfully with an agreement reached at ${formatCurrency(finalVal)} in Round ${rounds}.`;
  } else {
    narrative += `The session ended without an agreement in Round ${rounds}, reaching an impasse due to gap resistance.`;
  }

  // Pivotal Decision Points
  const pivotalPoints = [];
  if (openingBids.length > 0) {
    const hOpen = openingBids.find((b) => b.agent_role === humanAgent.role);
    if (hOpen) {
      pivotalPoints.push({
        round: 1,
        title: 'Opening Anchor Placement',
        impact: `Established baseline expectations at ${formatCurrency(hOpen.offer_value)}.`,
      });
    }
  }

  if (humanMilestones.length > 0) {
    const biggestConcession = [...humanMilestones].sort((a, b) => b.concession_amount - a.concession_amount)[0];
    pivotalPoints.push({
      round: biggestConcession.round,
      title: 'Pivotal Concession Move',
      impact: `Adjusted position by ${formatCurrency(biggestConcession.concession_amount)} to narrow the negotiation gap.`,
    });
  }

  if (compromises.length > 0) {
    pivotalPoints.push({
      round: compromises[0].round,
      title: 'Mediation / Compromise Evaluation',
      impact: 'Encountered mediation terms to navigate deadlock resistance.',
    });
  }

  pivotalPoints.push({
    round: rounds,
    title: isAgreement ? 'Mutual Settlement Closure' : 'Session Impasse Termination',
    impact: isAgreement
      ? `Finalized agreed deal terms at ${formatCurrency(agreement?.final_value)}.`
      : 'Concluded session with unresolved reservation gaps.',
  });

  const resolutionQuality = calculatePracticeResolutionQuality(simulation, openingBids, milestones);
  const outcomeAnalysis = calculateOutcomeAnalysis(simulation, true);

  return {
    narrative,
    style_assessment: styleAssessment,
    human_total_offers: humanOffers.length,
    pivotal_decision_points: pivotalPoints,
    resolution_quality: resolutionQuality,
    outcome_analysis: outcomeAnalysis,
  };
}

/**
 * Main Entry Point: Generates complete post-interaction summary envelope
 */
function generatePostInteractionSummary(simulation) {
  if (!simulation) {
    throw new Error('Simulation object is required for post-interaction summary generation.');
  }

  const agents = simulation.agents || [];
  const isPracticeMode = Boolean(
    simulation.is_practice ||
      simulation.mode === 'practice' ||
      agents.some((a) => a.is_human === true || a.personality === 'Human')
  );

  const openingBids = extractOpeningBids(simulation);
  const concessionMilestones = extractConcessionMilestones(simulation);
  const compromiseProposals = extractCompromiseProposals(simulation);

  const status = simulation.status || 'COMPLETED';
  const agreement = simulation.agreement;
  const isAgreement = status === 'COMPLETED' || status === 'AGREEMENT_REACHED' || Boolean(agreement);

  let executiveNarrative = '';
  let practiceInsights = null;
  let resolutionQuality = null;
  let strategicAgentCritique = null;
  let outcomeAnalysis = null;

  if (isPracticeMode) {
    const practiceResult = generatePracticeModeNarrative(
      simulation,
      openingBids,
      concessionMilestones,
      compromiseProposals
    );
    executiveNarrative = practiceResult.narrative;
    practiceInsights = {
      style_assessment: practiceResult.style_assessment,
      human_total_offers: practiceResult.human_total_offers,
      pivotal_decision_points: practiceResult.pivotal_decision_points,
    };
    resolutionQuality = practiceResult.resolution_quality;
    outcomeAnalysis = practiceResult.outcome_analysis;
  } else {
    const simResult = generateSimulationModeNarrative(
      simulation,
      openingBids,
      concessionMilestones,
      compromiseProposals
    );
    executiveNarrative = simResult.narrative;
    strategicAgentCritique = simResult.strategic_agent_critique;
    outcomeAnalysis = simResult.outcome_analysis;
  }

  const summary = {
    simulation_id: simulation.id,
    scenario_id: simulation.scenario_id,
    scenario_title: simulation.scenario_title,
    mode: isPracticeMode ? 'Practice Mode (Human vs AI)' : 'Simulation Mode (AI vs AI)',
    is_practice: isPracticeMode,
    outcome: isAgreement ? 'AGREEMENT_REACHED' : status === 'DEADLOCK' ? 'DEADLOCK' : 'CONCLUDED',
    final_round: simulation.current_round || 1,
    max_rounds: simulation.max_rounds || 10,
    final_terms: isAgreement
      ? {
          final_value: agreement?.final_value || simulation.agreement_final_value,
          terms: agreement?.terms || {},
          status: 'SETTLED',
        }
      : {
          final_gap: simulation.current_gap || 0,
          deadlock_reason: simulation.deadlock_reason || simulation.deadlock_resolution?.reason || 'Impasse reached',
          status: 'UNRESOLVED',
        },
    opening_bids: openingBids,
    concession_milestones: concessionMilestones,
    compromise_proposals: compromiseProposals,
    executive_narrative: executiveNarrative,
    practice_insights: practiceInsights,
    resolution_quality: resolutionQuality,
    strategic_agent_critique: strategicAgentCritique,
    outcome_analysis: outcomeAnalysis,
    generated_at: new Date().toISOString(),
  };

  return summary;
}

module.exports = {
  generatePostInteractionSummary,
  extractOpeningBids,
  extractConcessionMilestones,
  extractCompromiseProposals,
  generateSimulationModeNarrative,
  generatePracticeModeNarrative,
};
