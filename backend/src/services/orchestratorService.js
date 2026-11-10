/**
 * Orchestrator Agent & Negotiation Turn Management Service
 * 
 * Responsibilities:
 * 1. Manages autonomous AI-vs-AI turn-taking order across bilateral (2-agent) and multilateral (3-agent) scenarios.
 * 2. Tracks simulation rounds, active agent turns, and lifecycle states (RUNNING, PAUSED, COMPLETED, DEADLOCK).
 * 3. Maintains conversation history and formats strategic context for the AI reasoning service (Gemini).
 * 4. Coordinates with the Decision and Concession Evaluation logic for incoming/outgoing offers.
 * 5. Updates and persists negotiation state, messages, offers, and agreements via the Neon database interface.
 * 6. Enforces stopping conditions: agreement acceptance, concession convergence, reservation walkaway, or max-round exhaustion.
 */

const { db } = require('../db/db');
const { getAgentNegotiationMove } = require('./aiClient');

// Canonical Scenario Presets
const SCENARIO_PRESETS = {
  'vendor-pricing': {
    id: 'vendor-pricing',
    title: 'Vendor Pricing Negotiation',
    domain: 'Procurement & Sales',
    currency: '₹',
    max_rounds: 12,
    agreement_threshold: 0, // Gap <= 0 (or exact match/crossover) considered agreement
    agents: [
      {
        id: 'buyer-procurement',
        role: 'Buyer',
        name: 'Procurement Director',
        personality: 'Collaborative',
        goal: 'Secure enterprise software licenses under budget with 99.9% uptime SLA and Net-60 terms',
        target_value: 95000,
        reservation_value: 100000,
        current_offer: 95000,
        stance: 'Seeking agreement',
        progress_percent: 50,
      },
      {
        id: 'vendor-sales',
        role: 'Seller',
        name: 'Sales Account Executive',
        personality: 'Aggressive',
        goal: 'Maximize annual contract value, protect commercial margin, and secure Net-30 terms',
        target_value: 110000,
        reservation_value: 90000,
        current_offer: 110000,
        stance: 'Holding firm',
        progress_percent: 45,
      },
    ],
  },
  'job-offer': {
    id: 'job-offer',
    title: 'Job Offer Negotiation',
    domain: 'Talent & Human Resources',
    currency: '₹',
    max_rounds: 8,
    agreement_threshold: 0,
    agents: [
      {
        id: 'hiring-director',
        role: 'Recruiter',
        name: 'Hiring Director & Talent Lead',
        personality: 'Risk-Averse',
        goal: 'Hire key engineering talent within departmental salary limits and equity allocation bands',
        target_value: 152000,
        reservation_value: 168000,
        current_offer: 152000,
        stance: 'Holding firm',
        progress_percent: 50,
      },
      {
        id: 'job-candidate',
        role: 'Candidate',
        name: 'Senior AI Engineer Candidate',
        personality: 'Collaborative',
        goal: 'Secure top-of-band base compensation, equity stock grants, and remote flexibility',
        target_value: 175000,
        reservation_value: 160000,
        current_offer: 175000,
        stance: 'Holding firm',
        progress_percent: 50,
      },
    ],
  },
  'project-budget': {
    id: 'project-budget',
    title: 'Project Budget Allocation',
    domain: 'Corporate Strategy & Finance',
    currency: '₹',
    max_rounds: 12,
    agreement_threshold: 0,
    agents: [
      {
        id: 'vp-engineering',
        role: 'Engineering Lead',
        name: 'VP of Engineering',
        personality: 'Risk-Averse',
        goal: 'Secure core infrastructure budget (target ₹450,000) for database modernization and uptime reliability',
        target_value: 450000,
        reservation_value: 350000,
        current_offer: 450000,
        stance: 'Justifying reliability',
        progress_percent: 50,
      },
      {
        id: 'cmo-marketing',
        role: 'Marketing Lead',
        name: 'Chief Marketing Officer',
        personality: 'Aggressive',
        goal: 'Secure customer acquisition and paid growth capital (target ₹350,000)',
        target_value: 350000,
        reservation_value: 250000,
        current_offer: 350000,
        stance: 'Demanding growth capital',
        progress_percent: 45,
      },
      {
        id: 'head-product-ai',
        role: 'Product AI Lead',
        name: 'Head of Product AI',
        personality: 'Collaborative',
        goal: 'Secure GenAI research and compute budget (target ₹300,000)',
        target_value: 300000,
        reservation_value: 200000,
        current_offer: 300000,
        stance: 'Highlighting innovation',
        progress_percent: 50,
      },
    ],
    },
};

class OrchestratorAgent {
  constructor() {
  this.name = 'Orchestrator Agent';
  this.role = 'Orchestrator';

  // Deadlock detection configuration
  this.deadlockConfig = {
    unchangedOfferLimit: 3,
    repeatedRejectionLimit: 3,
    maxCompromiseAttempts: 1,
  };
}
  /**
   * Detect repeated offers and rejection patterns.
   */
  detectDeadlock(simulation) {
  const messages = (simulation.messages || []).filter(
    (message) =>
      message.sender_type === 'AGENT' ||
      message.sender_type === 'HUMAN'
  );

  // Group offers by participant role
  const participantRoles = [
    ...new Set(messages.map((message) => message.sender_role))
  ];

  let unchangedOffers = false;

  for (const role of participantRoles) {
    const roleOffers = messages.filter(
      (message) =>
        message.sender_role === role &&
        message.offer_value !== null &&
        message.offer_value !== undefined
    );

    const recentOffers = roleOffers.slice(
      -this.deadlockConfig.unchangedOfferLimit
    );

    if (
      recentOffers.length >= this.deadlockConfig.unchangedOfferLimit &&
      recentOffers.every(
        (message) =>
          Number(message.offer_value) ===
          Number(recentOffers[0].offer_value)
      )
    ) {
      unchangedOffers = true;
      break;
    }
  }

  // Check the latest participant actions for repeated rejections
  const recentMessages = messages.slice(
    -this.deadlockConfig.repeatedRejectionLimit
  );

  const repeatedRejections =
    recentMessages.length >= this.deadlockConfig.repeatedRejectionLimit &&
    recentMessages.every(
      (message) => message.action === 'REJECT'
    );

  if (unchangedOffers) {
    return {
      detected: true,
      reason: 'A participant repeated the same offer without making any concession.',
      type: 'UNCHANGED_OFFERS',
    };
  }

  if (repeatedRejections) {
    return {
      detected: true,
      reason: 'Participants repeatedly rejected proposals without reaching an agreement.',
      type: 'REPEATED_REJECTIONS',
    };
  }

  return {
    detected: false,
    reason: null,
    type: null,
  };
}
  /**
   * Retrieves scenario definition by ID with fallback
   */
  getScenarioPreset(scenarioId) {
    return SCENARIO_PRESETS[scenarioId] || SCENARIO_PRESETS['vendor-pricing'];
  }

  /**
   * 1. Initialize a brand new simulation session
   */
  async initializeSimulation({ scenarioId = 'vendor-pricing', customAgents = null, maxRounds = null, userEmail = null, userId = null }) {
    const preset = this.getScenarioPreset(scenarioId);
    const simId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const effectiveMaxRounds = maxRounds || preset.max_rounds || 10;
    const humanCount = Array.isArray(customAgents)
      ? customAgents.filter((a) => a.personality === 'Human' || a.is_human === true).length
      : 0;
    const isPractice = humanCount > 0 && humanCount < (customAgents || []).length;

    const matchPresetAgent = (ca, presetAgents) => {
      const key = `${ca.id || ''} ${ca.role || ''} ${ca.name || ''} ${ca.title || ''}`.toLowerCase();
      const direct = presetAgents.find((pa) => pa.id === ca.id);
      if (direct) return direct;
      if (key.includes('buyer') || key.includes('procurement') || key.includes('purchasing')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('buyer') || (pa.name || '').toLowerCase().includes('purchasing'));
        if (found) return found;
      }
      if (key.includes('seller') || key.includes('sales') || key.includes('vendor') || key.includes('supplier')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('seller') || (pa.name || '').toLowerCase().includes('sales'));
        if (found) return found;
      }
      if (key.includes('recruiter') || key.includes('hiring') || key.includes('talent')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('recruiter') || (pa.name || '').toLowerCase().includes('hiring'));
        if (found) return found;
      }
      if (key.includes('candidate') || key.includes('applicant')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('candidate'));
        if (found) return found;
      }
      if (key.includes('engineering') || key.includes('infrastructure') || key.includes('department-a') || key.includes('lead software')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('engineering') || (pa.id || '').includes('engineering') || (pa.id || '').includes('department-a'));
        if (found) return found;
      }
      if (key.includes('marketing') || key.includes('growth') || key.includes('department-b')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('marketing') || (pa.id || '').includes('marketing') || (pa.id || '').includes('department-b'));
        if (found) return found;
      }
      if (key.includes('product')) {
        const found = presetAgents.find((pa) => (pa.role || pa.id || '').toLowerCase().includes('product') || (pa.id || '').includes('product'));
        if (found) return found;
      }
      return null;
    };

    let effectiveAgents = Array.isArray(customAgents) && customAgents.length > 0
      ? customAgents.map((ca, idx) => {
          const presetMatch = matchPresetAgent(ca, preset.agents) || preset.agents[idx] || {};
          const isHuman = ca.is_human === true || ca.personality === 'Human' || presetMatch.personality === 'Human';
          return {
            ...presetMatch,
            ...ca,
            personality: ca.personality || presetMatch.personality || 'Collaborative',
            is_human: isHuman,
          };
        })
      : preset.agents;

    // Apply Practice Mode opening order:
    // In Practice Mode, the AI counterpart ALWAYS starts with the opening offer,
    // so the human user arrives at an active "Your Turn to Bargain" prompt!
    if (isPractice) {
      const aiAgents = effectiveAgents.filter((a) => a.personality !== 'Human' && a.is_human !== true);
      const humanAgents = effectiveAgents.filter((a) => a.personality === 'Human' || a.is_human === true);
      if (aiAgents.length > 0 && humanAgents.length > 0) {
        effectiveAgents = [...aiAgents, ...humanAgents];
      }
    }

    const initialBuyerOffer = effectiveAgents[0]?.current_offer || effectiveAgents[0]?.target_value || 8000;
    const initialSellerOffer = effectiveAgents[1]?.current_offer || effectiveAgents[1]?.target_value || 11000;
    const initialGap = Math.abs(initialBuyerOffer - initialSellerOffer);

    const simulationRecord = {
      id: simId,
      scenario_id: preset.id,
      scenario_title: preset.title,
      status: 'RUNNING',
      current_round: 1,
      max_rounds: effectiveMaxRounds,
      current_gap: initialGap,
      agreement_likelihood: 50,
      user_email: userEmail || null,
      user_id: userId || null,
    };

    // 1. Persist initial simulation and agents to database
    await db.createSimulation(simulationRecord, effectiveAgents);

    // 2. Log Orchestrator Welcome Announcement
    const formatAgentTitle = (a) => {
      const role = (a.role || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      const combined = `${role} ${name}`;
      if (combined.includes('buyer') || combined.includes('procurement') || combined.includes('purchasing')) {
        return 'Buyer (Procurement Director)';
      }
      if (combined.includes('seller') || combined.includes('vendor') || combined.includes('supplier') || combined.includes('sales')) {
        return 'Seller (Sales Account Executive)';
      }
      if (combined.includes('recruiter') || combined.includes('hiring') || combined.includes('talent')) {
        return 'Recruiter (Hiring Director)';
      }
      if (combined.includes('candidate') || combined.includes('applicant') || combined.includes('interviewee')) {
        return 'Candidate (Job Candidate)';
      }
      if (combined.includes('engineering') || combined.includes('infrastructure') || combined.includes('department a')) {
        return 'Engineering Lead (VP of Engineering)';
      }
      if (combined.includes('marketing') || combined.includes('cmo') || combined.includes('growth') || combined.includes('department b')) {
        return 'Marketing Lead (Chief Marketing Officer)';
      }
      if (combined.includes('product') || combined.includes('head-product') || combined.includes('department c')) {
        return 'Product AI Lead (Head of Product AI)';
      }
      return a.role && a.name && a.role !== a.name ? `${a.role} (${a.name})` : (a.role || a.name || 'Participant');
    };
    const participantRoles = effectiveAgents.map(formatAgentTitle).join(' vs ');
    const openingAgentLabel = formatAgentTitle(effectiveAgents[0] || {});
    await db.addMessage({
      simulation_id: simId,
      round_number: 1,
      sender_type: 'ORCHESTRATOR',
      sender_name: this.name,
      sender_role: this.role,
      message: `Simulation initialized for "${preset.title}". Round 1 commenced between ${participantRoles}. Awaiting opening move from ${openingAgentLabel}.`,
      action: 'STATUS',
    });

    // 3. Dispatch the opening move for Agent 1 (ONLY if opening agent is NOT human)
    const openingAgent = effectiveAgents[0];
    const counterpartAgent = effectiveAgents[1] || effectiveAgents[0];
    const isOpeningHuman = openingAgent.personality === 'Human' || openingAgent.is_human === true;

    if (!isOpeningHuman) {
      const openingMove = await getAgentNegotiationMove({
        scenario: preset,
        agent: openingAgent,
        counterpart: counterpartAgent,
        roundNumber: 1,
        maxRounds: effectiveMaxRounds,
        currentOffer: openingAgent.current_offer || openingAgent.target_value || initialBuyerOffer,
        history: [],
      });
      if (openingMove.action === 'ACCEPT') {
        openingMove.action = 'OFFER';
      }

      // 4. Record opening message and offer
      await db.addMessage({
        simulation_id: simId,
        round_number: 1,
        sender_type: 'AGENT',
        sender_name: openingAgent.name,
        sender_role: openingAgent.role,
        personality: openingAgent.personality,
        message: openingMove.message,
        offer_value: openingMove.offer_value,
        action: openingMove.action || 'OFFER',
      });

      if (openingMove.offer_value) {
        await db.addOffer({
          simulation_id: simId,
          round_number: 1,
          agent_role: openingAgent.role,
          offer_value: openingMove.offer_value,
          terms: openingMove.terms,
        });

        await db.updateAgent(simId, openingAgent.role, {
          current_offer: openingMove.offer_value,
          stance: openingMove.stance || 'Seeking agreement',
          progress_percent: openingMove.progress_percent || 55,
        });
      }
    }

    return await db.getSimulation(simId);
  }

  /**
   * 2. Determine which agent speaks next
   * Handles 2-agent bilateral and 3+ agent multilateral round-robin turn-taking
   */
  determineNextTurn(sim) {
    let agents = sim.agents || [];
    if (agents.length === 0) {
      throw new Error('Simulation has no registered participating agents.');
    }

    // In Practice Mode: Apply opening order where AI counterpart speaks first
    const simAgents = sim.agents || agents || [];
    const humanCount = simAgents.filter((a) => a.personality === 'Human' || a.is_human === true).length;
    const isPractice =
      sim.mode === 'practice' ||
      sim.is_practice === true ||
      (humanCount > 0 && humanCount < simAgents.length);

    if (isPractice) {
      const aiAgents = agents.filter((a) => a.personality !== 'Human' && a.is_human !== true);
      const humanAgents = agents.filter((a) => a.personality === 'Human' || a.is_human === true);
      if (aiAgents.length > 0 && humanAgents.length > 0) {
        agents = [...aiAgents, ...humanAgents];
      }
    } else if (sim.scenario_id && SCENARIO_PRESETS[sim.scenario_id]) {
      // In autonomous simulation mode: sort agents strictly by the canonical scenario preset order
      const preset = SCENARIO_PRESETS[sim.scenario_id];
      if (preset && Array.isArray(preset.agents)) {
        const orderMap = new Map();
        preset.agents.forEach((pa, i) => {
          orderMap.set(pa.id.toLowerCase(), i);
          orderMap.set(pa.role.toLowerCase(), i);
        });
        agents = [...agents].sort((a, b) => {
          const getIdx = (ag) => {
            const aId = (ag.id || '').toLowerCase();
            const aRole = (ag.role || '').toLowerCase();
            for (const [k, v] of orderMap.entries()) {
              if (aId === k || aRole === k || aId.includes(k) || aRole.includes(k)) return v;
            }
            return 99;
          };
          return getIdx(a) - getIdx(b);
        });
      }
    }

    // Filter messages for the current round sent by AGENTS
    const currentRoundMessages = (sim.messages || []).filter(
      m => m.round_number === sim.current_round && (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN')
    );

    const turnsCount = currentRoundMessages.length;
    const numAgents = agents.length;

    // Index of the agent whose turn it is now (0 to numAgents - 1)
    const activeIndex = turnsCount % numAgents;

    // Safety guard: prevent the exact same agent from taking two consecutive turns
    const allAgentMsgs = (sim.messages || []).filter(m => m.sender_type === 'AGENT' || m.sender_type === 'HUMAN');
    const lastMsg = allAgentMsgs[allAgentMsgs.length - 1];
    let effectiveActiveIndex = activeIndex;
    const isSameRole = Boolean(lastMsg?.sender_role && agents[activeIndex]?.role && lastMsg.sender_role === agents[activeIndex].role);
    const isSameName = Boolean(lastMsg?.sender_name && agents[activeIndex]?.name && lastMsg.sender_name === agents[activeIndex].name);
    if (lastMsg && numAgents > 1 && (isSameRole || isSameName)) {
      effectiveActiveIndex = (activeIndex + 1) % numAgents;
    }

    const activeAgent = agents[effectiveActiveIndex];

    // Counterpart is the previous speaker, or the next agent in circular order
    const counterpartIndex = (effectiveActiveIndex + 1) % numAgents;
    const counterpartAgent = agents[counterpartIndex];

    // Round ends when all agents in this round have completed exactly one turn
    const isRoundEnd = (turnsCount + 1) % numAgents === 0;

    return {
      activeAgent,
      counterpartAgent,
      isRoundEnd,
      turnIndexInRound: activeIndex + 1,
      totalTurnsInRound: numAgents,
    };
  }

  /**
   * 3. Advance the negotiation by one single turn
   */
  async advanceStep(simulationId, customMove = null) {
    const sim = await db.getSimulation(simulationId);
    if (!sim) {
      throw new Error(`Simulation with ID "${simulationId}" not found.`);
    }

    // Guard: only advance if currently running
    if (sim.status !== 'RUNNING') {
      return {
        simulation: sim,
        advanced: false,
        message: `Simulation is currently ${sim.status}. Cannot advance turns.`,
      };
    }

    const preset = this.getScenarioPreset(sim.scenario_id);
    const effectiveMaxRounds = Number(sim.max_rounds || preset.max_rounds || 10);
    if (Number(sim.current_round) > effectiveMaxRounds) {
      await db.updateSimulation(simulationId, { status: 'DEADLOCK' });
      const deadlockSim = await db.getSimulation(simulationId);
      return {
        simulation: deadlockSim,
        advanced: false,
        message: `Maximum round limit (${effectiveMaxRounds}) reached. Negotiation concluded in Deadlock.`,
      };
    }

    // 1. Determine active speaker, counterpart, and scenario preset
    let { activeAgent, counterpartAgent, isRoundEnd } = this.determineNextTurn(sim);
    const simAgents = sim.agents || [];
    const humanCount = simAgents.filter(a => a.is_human === true || a.personality === 'Human').length;
    const isPractice = (sim.id && sim.id.startsWith('practice_')) ||
      (humanCount > 0 && humanCount < simAgents.length);

    // In Practice Mode (where exactly one human participant exists), ensure human moves are locked to the human participant
    if (customMove && isPractice) {
      const humanAg = simAgents.find(
        (a) => (customMove.sender_role && a.role === customMove.sender_role) || a.is_human === true || a.personality === 'Human'
      );
      if (humanAg) {
        activeAgent = humanAg;
      }
    }

    const isHumanTurn = activeAgent.personality === 'Human' || activeAgent.is_human === true || Boolean(customMove);

    // Guard: if it's a human turn and no move was provided by human, do NOT generate an automated AI response!
    if (isHumanTurn && !customMove) {
      return {
        simulation: sim,
        advanced: false,
        waitingForHuman: true,
        turnTakenBy: activeAgent.role,
        message: `Awaiting move from human negotiator (${activeAgent.name || activeAgent.role}).`,
      };
    }

    let move;
    if (isHumanTurn && customMove) {
      let offerVal = customMove.offer_value;
      if (offerVal === undefined || offerVal === null) {
        // Check for 3-department allocation in project-budget
        if (sim.scenario_id === 'project-budget') {
          const terms = customMove.terms || {};
          const engAmt = terms.engineering || terms.engineeringFunding;
          const mktAmt = terms.marketing || terms.marketingFunding;
          const prodAmt = terms.product || terms.productFunding || terms.productAIFunding;

          const roleKey = `${activeAgent.id || ''} ${activeAgent.role || ''} ${activeAgent.name || ''}`.toLowerCase();
          if (engAmt && mktAmt && prodAmt) {
            if (roleKey.includes('engineering') || roleKey.includes('software') || roleKey.includes('infra')) {
              offerVal = Number(engAmt);
            } else if (roleKey.includes('marketing') || roleKey.includes('growth') || roleKey.includes('cmo')) {
              offerVal = Number(mktAmt);
            } else {
              offerVal = Number(prodAmt);
            }

            for (const ag of sim.agents || []) {
              const k = `${ag.id || ''} ${ag.role || ''} ${ag.name || ''}`.toLowerCase();
              let aOffer = null;
              if (k.includes('engineering') || k.includes('infra') || k.includes('software')) aOffer = engAmt;
              else if (k.includes('marketing') || k.includes('growth') || k.includes('cmo')) aOffer = mktAmt;
              else aOffer = prodAmt;
              if (aOffer) {
                await db.updateAgent(simulationId, ag.role, { current_offer: aOffer });
              }
            }
          } else {
            const threeNums = (customMove.message || '').replace(/,/g, '').match(/\b(\d{5,9})\b/g);
            if (threeNums && threeNums.length >= 3) {
              if (roleKey.includes('engineering') || roleKey.includes('software') || roleKey.includes('infra')) {
                offerVal = Number(threeNums[0]);
              } else if (roleKey.includes('marketing') || roleKey.includes('growth') || roleKey.includes('cmo')) {
                offerVal = Number(threeNums[1]);
              } else {
                offerVal = Number(threeNums[2]);
              }
            }
          }
        }
        if (offerVal === undefined || offerVal === null) {
          const numMatch = (customMove.message || '').replace(/,/g, '').match(/(?:₹|\$)?\s*(\d{4,9})/);
          if (numMatch) {
            offerVal = Number(numMatch[1]);
          } else {
            const thousandMatch = (customMove.message || '').match(/(\d+(?:\.\d+)?)\s*(?:thousand|thousands|k)\b/i);
            if (thousandMatch) {
              offerVal = Math.round(parseFloat(thousandMatch[1]) * 1000);
            } else {
              offerVal = null;
            }
          }
        }
      }

      let humanAction = customMove.action;
      const lowerMsg = (customMove.message || '').toLowerCase();
      const hasProposal = /\b(propose|counter|offer|how about|what about|settle at|instead|rather|my offer|my price)\b/i.test(lowerMsg) || (offerVal !== null && offerVal !== undefined);
      const hasConditional = /\b(if\b|unless|but\b|however|provided that)\b/i.test(lowerMsg);

      if (!humanAction || humanAction === 'COUNTER_OFFER' || humanAction === 'STATUS' || humanAction === 'OFFER') {
        if (!hasConditional && !hasProposal) {
          if (/\b(accept\b|agreed?\b|we have a deal|that works for me|finalize this|happy with this (?:deal|agreement|offer))\b/i.test(lowerMsg)) {
            humanAction = 'ACCEPT';
          } else if (/\b(reject\b|cannot accept|can't accept|not acceptable|end this negotiation|decline\b|no deal|walk away)\b/i.test(lowerMsg)) {
            humanAction = 'REJECT';
          }
        } else if (hasProposal && offerVal !== null) {
          humanAction = 'COUNTER_OFFER';
        }
      }

      move = {
        message: customMove.message,
        offer_value: offerVal,
        action: humanAction || (offerVal !== null ? 'COUNTER_OFFER' : 'STATUS'),
        stance: customMove.stance || 'Human proposal',
        progress_percent: Math.min((activeAgent.progress_percent || 40) + 10, 95),
        terms: customMove.terms || {},
      };
    } else {
      // 2. Build formatted conversation history context for AI reasoning
      const historyContext = (sim.messages || []).slice(-10).map(m => ({
        sender_role: m.sender_role,
        sender_name: m.sender_name,
        sender_type: m.sender_type,
        message: m.message,
        offer_value: m.offer_value,
        round: m.round_number,
        action: m.action,
      }));

      // 3. Request decision & reasoned move from AI service
const deadlockTestMode = process.env.DEADLOCK_TEST_MODE === 'true';

if (deadlockTestMode) {
  const descriptor = `${activeAgent.id || ''} ${activeAgent.role || ''} ${activeAgent.name || ''}`.toLowerCase();

const fixedOffer =
  descriptor.includes('buyer') || descriptor.includes('procurement') || descriptor.includes('purchasing') || descriptor.includes('recruiter')
    ? 95000
    : 110000;

  move = {
    message: `Deadlock test: maintaining my offer of ₹${fixedOffer}.`,
    offer_value: fixedOffer,
    action: 'COUNTER_OFFER',
    terms: 'Standard terms',
  };
} else {
  move = await getAgentNegotiationMove({
    scenario: {
      id: sim.scenario_id,
      title: sim.scenario_title,
      domain: preset.domain,
    },
    agent: activeAgent,
    counterpart: counterpartAgent,
    roundNumber: sim.current_round,
    maxRounds: sim.max_rounds,
    currentOffer: activeAgent.current_offer || activeAgent.target_value,
    history: historyContext,
  });
}
}
    // Guard: check if simulation was paused, ended, or aborted while awaiting AI move
    const freshSim = await db.getSimulation(simulationId);
    if (!freshSim || freshSim.status !== 'RUNNING') {
      return {
        simulation: freshSim,
        advanced: false,
        message: 'Simulation is currently inactive. Turn was aborted.',
      };
    }

    // Guard: only the very first turn in a simulation can be an 'OFFER'. All subsequent turns are 'COUNTER_OFFER'
    let stepAction = move.action || 'COUNTER_OFFER';
    const hasExistingOffers = (sim.messages || []).some(
      (m) => (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN') && m.offer_value
    );
    if (hasExistingOffers && stepAction === 'OFFER') {
      stepAction = 'COUNTER_OFFER';
    }

    // 4. Record Agent Dialogue in Database
    await db.addMessage({
      simulation_id: simulationId,
      round_number: sim.current_round,
      sender_type: isHumanTurn ? 'HUMAN' : 'AGENT',
      sender_name: activeAgent.name,
      sender_role: activeAgent.role,
      personality: activeAgent.personality,
      message: move.message,
      offer_value: move.offer_value,
      action: stepAction,
    });

    // 5. Record discrete numerical offer & update agent current standing
    if (move.offer_value !== undefined && move.offer_value !== null) {
      await db.addOffer({
        simulation_id: simulationId,
        round_number: sim.current_round,
        agent_role: activeAgent.role,
        offer_value: move.offer_value,
        terms: move.terms || {},
      });

      await db.updateAgent(simulationId, activeAgent.role, {
        current_offer: move.offer_value,
        stance: move.stance || 'In negotiation',
        progress_percent: move.progress_percent || 60,
      });
    }

    // 6. Refresh simulation to inspect all latest agent offers
    const updatedSim = await db.getSimulation(simulationId);
    const agents = updatedSim.agents || [];

    // Calculate current gap between primary stakeholders
    let currentGap = sim.current_gap;
    if (sim.scenario_id === 'job-offer') {
      const recruiter = agents.find((a) => {
        const k = `${a.id || ''} ${a.role || ''} ${a.name || ''}`.toLowerCase();
        return k.includes('recruiter') || k.includes('hiring') || k.includes('talent');
      }) || agents[0];
      const candidate = agents.find((a) => a !== recruiter) || agents[1];
      const rOffer = Number(recruiter?.current_offer || 0);
      const cOffer = Number(candidate?.current_offer || 0);
      if (rOffer > 0 && cOffer > 0) {
        currentGap = rOffer >= cOffer ? 0 : (cOffer - rOffer);
      } else {
        currentGap = Math.abs(rOffer - cOffer);
      }
    } else if (sim.scenario_id === 'vendor-pricing') {
      const buyer = agents.find((a) => {
        const k = `${a.id || ''} ${a.role || ''} ${a.name || ''}`.toLowerCase();
        return k.includes('buyer') || k.includes('procurement') || k.includes('purchasing');
      }) || agents[0];
      const seller = agents.find((a) => a !== buyer) || agents[1];
      const bOffer = Number(buyer?.current_offer || 0);
      const sOffer = Number(seller?.current_offer || 0);
      if (bOffer > 0 && sOffer > 0) {
        currentGap = bOffer >= sOffer ? 0 : (sOffer - bOffer);
      } else {
        currentGap = Math.abs(bOffer - sOffer);
      }
    } else if (sim.scenario_id === 'project-budget') {
      const totalDemanded = agents.reduce((sum, a) => sum + Number(a.current_offer || 0), 0);
      currentGap = totalDemanded <= 1000000 ? 0 : (totalDemanded - 1000000);
    } else {
      const agent0Offer = Number(agents[0]?.current_offer || 0);
      const agent1Offer = Number(agents[1]?.current_offer || 0);
      currentGap = Math.abs(agent0Offer - agent1Offer);
    }

    // Require primary participants to have actively tabled offers before evaluating gap convergence
    const activeOfferMessages = (updatedSim.messages || []).filter(
      (m) => (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN') && m.offer_value
    );
    const uniqueOfferSenders = new Set(activeOfferMessages.map((m) => m.sender_role || m.sender_name));
    const allHaveOffered = uniqueOfferSenders.size >= agents.length;
    const bothHaveOffered = allHaveOffered;
// Check whether the negotiation is reaching a deadlock
const deadlock = this.detectDeadlock(updatedSim);

const compromiseMarker = '[DEADLOCK_COMPROMISE_ATTEMPTED]';

const compromiseAlreadyAttempted = (updatedSim.messages || []).some(
  (message) =>
    message.sender_type === 'ORCHESTRATOR' &&
    message.message?.includes(compromiseMarker)
);

let deadlockShouldStop =
  deadlock.detected && compromiseAlreadyAttempted;

if (deadlock.detected && !compromiseAlreadyAttempted) {
  const firstOffer = Number(agents[0]?.current_offer);
  const secondOffer = Number(agents[1]?.current_offer);

  const compromiseOffer =
    Number.isFinite(firstOffer) &&
    Number.isFinite(secondOffer) &&
    firstOffer > 0 &&
    secondOffer > 0
      ? Math.round((firstOffer + secondOffer) / 2)
      : null;

  await db.addMessage({
    simulation_id: simulationId,
    round_number: sim.current_round,
    sender_type: 'ORCHESTRATOR',
    sender_name: this.name,
    sender_role: this.role,
    message: `${compromiseMarker} Deadlock detected. Reason: ${deadlock.reason} ${
      compromiseOffer !== null
        ? `The orchestrator proposes a compromise value of ₹${compromiseOffer.toLocaleString()}.`
        : 'The orchestrator requests revised offers from all participants.'
    }`,
    offer_value: compromiseOffer,
    action: 'STATUS',
  });
}
    // Compute dynamic agreement likelihood %
    const threshold = typeof preset.agreement_threshold === 'number' ? preset.agreement_threshold : 0;
    let likelihood = Math.min(
      99,
      Math.max(10, Math.round(100 - (currentGap / 200) + (sim.current_round * 5)))
    );

    // 7. Evaluate Stopping Conditions
    const stoppingEvaluation = this.evaluateStoppingConditions({
      action: move.action,
      agreementReached: move.agreement_reached,
      currentGap,
      threshold,
      currentRound: sim.current_round,
      maxRounds: sim.max_rounds,
      isRoundEnd,
      settlementPrice: move.offer_value || (currentGap <= threshold ? Math.round((agent0Offer + agent1Offer) / 2) : (agent1Offer || agent0Offer)),
      activeAgent,
      bothHaveOffered,
      allHaveOffered,
      totalAgents: agents.length,
      isPractice,
    });

    // Guard for Practice Mode & Multilateral Negotiations:
    // A round is not concluded until every participant in that round has taken their turn!
    // Agreement CANNOT be reached mid-round while awaiting the human player or third agent.
    if ((isPractice || agents.length > 2) && !isRoundEnd && stoppingEvaluation.finalStatus === 'COMPLETED') {
      stoppingEvaluation.shouldStop = false;
      stoppingEvaluation.finalStatus = 'RUNNING';
    }
    // Apply detected deadlock after the compromise attempt
if (
  deadlockShouldStop &&
  stoppingEvaluation.finalStatus !== 'COMPLETED'
) {
  stoppingEvaluation.shouldStop = true;
  stoppingEvaluation.finalStatus = 'DEADLOCK';
  stoppingEvaluation.agreedValue = null;
  stoppingEvaluation.deadlockReason = deadlock.reason;
  stoppingEvaluation.orchestratorMessage =
    `Negotiation ended in deadlock. Reason: ${deadlock.reason} A compromise proposal was already attempted without success.`;
}

    let newStatus = sim.status;
    let nextRound = sim.current_round;

    if (stoppingEvaluation.shouldStop) {
      newStatus = stoppingEvaluation.finalStatus;
      likelihood = stoppingEvaluation.finalStatus === 'COMPLETED' ? 100 : 0;

      // Post Orchestrator Termination Announcement
      await db.addMessage({
        simulation_id: simulationId,
        round_number: sim.current_round,
        sender_type: 'ORCHESTRATOR',
        sender_name: this.name,
        sender_role: this.role,
        message: stoppingEvaluation.orchestratorMessage,
        action: 'STATUS',
      });

      // If agreement reached, persist agreement record
      if (stoppingEvaluation.finalStatus === 'COMPLETED') {
        await db.saveAgreement({
          simulation_id: simulationId,
          final_value: stoppingEvaluation.agreedValue,
          outcome: 'AGREEMENT_REACHED',
          terms: {
            agreedPrice: stoppingEvaluation.agreedValue,
            settlementRound: sim.current_round,
            scenario: sim.scenario_title,
          },
        });
      }
    } else if (isRoundEnd) {
      // Transition to next round
      nextRound = sim.current_round + 1;

      await db.addMessage({
        simulation_id: simulationId,
        round_number: sim.current_round,
        sender_type: 'ORCHESTRATOR',
        sender_name: this.name,
        sender_role: this.role,
        message: `Round ${sim.current_round} concluded. Gap is ₹${currentGap.toLocaleString()}. Advancing to Round ${nextRound}...`,
        action: 'STATUS',
      });
    }

    // 8. Update Simulation Envelope in DB
    await db.updateSimulation(simulationId, {
      current_round: nextRound,
      status: newStatus,
      current_gap: currentGap,
      agreement_likelihood: likelihood,
    });

    const finalState = await db.getSimulation(simulationId);
    return {
      simulation: finalState,
      advanced: true,
      turnTakenBy: activeAgent.role,
      action: move.action,
      offerValue: move.offer_value,
      stoppingConditionMet: stoppingEvaluation.shouldStop,
    };
  }

  /**
   * 4. Stopping Conditions Evaluator
   * Checks for:
   * - Agreement (ACCEPT action or offer gap within threshold)
   * - Maximum Rounds Exhaustion (Deadlock)
   * - Negotiation Breakdown (Explicit REJECT without concession room)
   */
  evaluateStoppingConditions({
    action,
    agreementReached,
    currentGap,
    threshold,
    currentRound,
    maxRounds,
    isRoundEnd,
    settlementPrice,
    activeAgent,
    bothHaveOffered,
    allHaveOffered,
    totalAgents = 2,
    isPractice = false,
  }) {
    // Condition A: Explicit or Numerical Agreement
    const isExplicitAccept = action === 'ACCEPT' || agreementReached === true;
    const hasSufficientOffers = typeof allHaveOffered === 'boolean'
      ? allHaveOffered
      : (bothHaveOffered ?? true);

    const isMultiPartyOrPractice = totalAgents > 2 || isPractice;
    const isGapConverged = isMultiPartyOrPractice
      ? (isRoundEnd && hasSufficientOffers && currentGap <= threshold && currentGap >= 0)
      : (hasSufficientOffers && currentGap <= threshold && currentGap >= 0);

    if (isExplicitAccept || isGapConverged) {
      return {
        shouldStop: true,
        finalStatus: 'COMPLETED',
        agreedValue: settlementPrice,
        orchestratorMessage: `Congratulations! All participating parties have successfully reached an agreement. The negotiation has been concluded.`,
      };
    }
    // Condition B: Negotiation Breakdown on Hard Rejection
if (action === 'REJECT') {
  return {
    shouldStop: true,
    finalStatus: 'DEADLOCK',
    agreedValue: null,
    deadlockReason: 'An agent explicitly rejected the negotiation.',
    orchestratorMessage: `The negotiation has been terminated. No agreement was reached between the parties. Reason: An agent explicitly rejected the negotiation.`,
  };
}
    // Condition C: Max Rounds Reached at End of Round
    const numMaxRounds = Number(maxRounds || 10);
    const numCurRound = Number(currentRound || 1);
    if ((isRoundEnd && numCurRound >= numMaxRounds) || numCurRound > numMaxRounds) {
      return {
        shouldStop: true,
        finalStatus: 'DEADLOCK',
        agreedValue: null,
        deadlockReason: 'The maximum number of negotiation rounds was reached without an agreement.',
        orchestratorMessage: `Maximum round limit (${numMaxRounds}) reached without agreement. Final gap remained ₹${Number(currentGap || 0).toLocaleString()}. Negotiation terminated in Deadlock.`,
      };
    }
    // No stopping condition met -> continue negotiation
    return {
      shouldStop: false,
      finalStatus: 'RUNNING',
    };
  }

  /**
   * 5. Pause active simulation
   */
  async pauseSimulation(simulationId) {
    const sim = await db.getSimulation(simulationId);
    if (!sim) throw new Error('Simulation not found');

    await db.updateSimulation(simulationId, { status: 'PAUSED' });
    await db.addMessage({
      simulation_id: simulationId,
      round_number: sim.current_round,
      sender_type: 'ORCHESTRATOR',
      sender_name: this.name,
      sender_role: this.role,
      message: `Simulation paused by user at Round ${sim.current_round}.`,
      action: 'STATUS',
    });

    return await db.getSimulation(simulationId);
  }

  /**
   * 6. Resume paused simulation
   */
  async resumeSimulation(simulationId) {
    const sim = await db.getSimulation(simulationId);
    if (!sim) throw new Error('Simulation not found');

    await db.updateSimulation(simulationId, { status: 'RUNNING' });
    await db.addMessage({
      simulation_id: simulationId,
      round_number: sim.current_round,
      sender_type: 'ORCHESTRATOR',
      sender_name: this.name,
      sender_role: this.role,
      message: `Simulation resumed by user at Round ${sim.current_round}.`,
      action: 'STATUS',
    });

    return await db.getSimulation(simulationId);
  }

  /**
   * 7. End simulation manually
   */
  async endSimulation(simulationId, reason = 'Left in between') {
    const sim = await db.getSimulation(simulationId);
    if (!sim) throw new Error('Simulation not found');

    const isNatural = sim.status === 'COMPLETED' || sim.status === 'AGREEMENT_REACHED' || sim.status === 'DEADLOCK' || Boolean(sim.agreement);
    if (isNatural) {
      // Simulation already reached agreement or deadlock; retain final natural status
      return sim;
    }

    const status = (reason === 'User test termination' ? 'COMPLETED' : 'LEFT_IN_BETWEEN');

    if (status === 'LEFT_IN_BETWEEN') {
      await db.deleteAgreement(simulationId);
    }

    await db.updateSimulation(simulationId, { status });
    await db.addMessage({
      simulation_id: simulationId,
      round_number: sim.current_round,
      sender_type: 'ORCHESTRATOR',
      sender_name: this.name,
      sender_role: this.role,
      message: `Simulation concluded. Reason: ${reason}`,
      action: 'STATUS',
    });

    return await db.getSimulation(simulationId);
  }

  /**
   * 8. Restart simulation using original parameters
   */
  async restartSimulation(simulationId) {
    const sim = await db.getSimulation(simulationId);
    if (!sim) throw new Error('Simulation not found');

    return await this.initializeSimulation({
      scenarioId: sim.scenario_id,
      maxRounds: sim.max_rounds,
      userEmail: sim.user_email || null,
      userId: sim.user_id || null,
    });
  }

  /**
   * 9. Run full simulation until completion or deadlock (useful for automated AI-vs-AI runs)
   */
  async runFullSimulation(simulationId, maxSteps = 30) {
    let stepsTaken = 0;
    let result = null;

    while (stepsTaken < maxSteps) {
      result = await this.advanceStep(simulationId);
      stepsTaken++;

      if (!result.advanced || result.stoppingConditionMet) {
        break;
      }
    }

    return {
      simulation: result?.simulation || (await db.getSimulation(simulationId)),
      stepsTaken,
    };
  }
}

const orchestratorService = new OrchestratorAgent();

module.exports = {
  OrchestratorAgent,
  orchestratorService,
  SCENARIO_PRESETS,
};
