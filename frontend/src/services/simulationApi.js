/**
 * Simulation API Service
 * Handles client communication with the Express Backend and AI Service
 */

import { auth } from '../firebase/config';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Retrieve current user's Firebase ID token for Authorization header
 */
async function getAuthHeaders() {
  try {
    if (auth && auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch (err) {
    console.warn('[Simulation API] Failed to fetch Firebase ID token:', err.message);
  }
  return {};
}

// In-memory local simulations cache for offline/cold-start reliability
const localSimulationsCache = new Map();

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) return { online: false };
    const data = await res.json();
    return { online: true, ...data };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

export async function startSimulation(scenarioId = 'vendor-pricing', customAgents = null, maxRounds = null, userEmail = null, userId = null) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ scenarioId, customAgents, maxRounds, userEmail, userId }),
    });

    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    console.warn('[Simulation API] Backend unavailable or timed out, initializing clean scenario session at Round 1:', err.message);
    const local = createLocalSimulation(scenarioId, customAgents, maxRounds || 10);
    local.user_email = userEmail;
    local.user_id = userId;
    localSimulationsCache.set(local.id, local);
    return local;
  }
}

export async function listSimulations(userEmail = null, userId = null) {
  try {
    const authHeaders = await getAuthHeaders();
    const params = new URLSearchParams();
    if (userEmail) params.append('userEmail', userEmail);
    if (userId) params.append('userId', userId);
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${BACKEND_URL}/api/simulations${query}`, {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || [];
    }
  } catch (err) {
    console.warn('[Simulation API] Failed to list simulations:', err.message);
  }
  return [];
}

export async function getSimulationState(simulationId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}`, {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] Failed to fetch state:', err.message);
  }
  return localSimulationsCache.get(simulationId) || null;
}

export async function stepSimulation(simulationId, customMove = null) {
  try {
    const authHeaders = await getAuthHeaders();
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
    };
    if (customMove) {
      options.body = JSON.stringify(customMove);
    }
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}/step`, options);

    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] Step failed on backend, executing local step:', err.message);
  }

  // Local fallback turn progression for local simulations or during backend startup
  return advanceLocalSimulation(simulationId, customMove);
}

export async function pauseSimulation(simulationId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}/pause`, {
      method: 'POST',
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] Pause error:', err.message);
  }
  const local = localSimulationsCache.get(simulationId);
  if (local) {
    local.status = 'PAUSED';
    return { ...local };
  }
  return null;
}

export async function resumeSimulation(simulationId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}/resume`, {
      method: 'POST',
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] Resume error:', err.message);
  }
  const local = localSimulationsCache.get(simulationId);
  if (local) {
    local.status = 'RUNNING';
    return { ...local };
  }
  return null;
}

export async function endSimulation(simulationId, reason = 'Left in between') {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] End error:', err.message);
  }
  const local = localSimulationsCache.get(simulationId);
  if (local) {
    local.status = 'LEFT_IN_BETWEEN';
    return { ...local };
  }
  return null;
}

export async function restartSimulation(simulationId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/simulations/${simulationId}/restart`, {
      method: 'POST',
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('[Simulation API] Restart error:', err.message);
  }
  return null;
}

/**
 * Local fallback simulation generator that starts cleanly at Round 1
 * and dynamically adapts agents and messages to the chosen scenario.
 */
function createLocalSimulation(scenarioId = 'vendor-pricing', customAgents = null, maxRounds = 10) {
  const scenarioConfigs = {
    'vendor-pricing': {
      title: 'Vendor Pricing Negotiation',
      defaultMaxRounds: 10,
      currency: '₹',
      agents: [
        {
          id: 'buyer-procurement',
          role: 'Buyer',
          name: 'Procurement Director',
          personality: 'Collaborative',
          goal: 'Secure server hardware licenses under budget with Net-60 terms and 99.9% uptime SLA',
          current_offer: 95000,
          target_value: 95000,
          reservation_value: 100000,
          stance: 'Seeking agreement',
          progress_percent: 50,
        },
        {
          id: 'vendor-sales',
          role: 'Seller',
          name: 'Sales Account Executive',
          personality: 'Aggressive',
          goal: 'Maximize annual contract value, protect commercial margin, and secure Net-30 terms',
          current_offer: 110000,
          target_value: 110000,
          reservation_value: 90000,
          stance: 'Holding firm',
          progress_percent: 45,
        },
      ],
      openingOffer: 95000,
      openingMessage: 'We can offer ₹95,000 total contract value for the initial hardware order with Net-60 payment terms.',
    },
    'job-offer': {
      title: 'Job Offer Negotiation',
      defaultMaxRounds: 8,
      currency: '₹',
      agents: [
        {
          id: 'hiring-director',
          role: 'Recruiter',
          name: 'Hiring Director & Talent Lead',
          personality: 'Risk-Averse',
          goal: 'Hire key engineering talent within departmental salary limits and equity allocation bands',
          current_offer: 152000,
          target_value: 152000,
          reservation_value: 168000,
          stance: 'Evaluating budget',
          progress_percent: 50,
        },
        {
          id: 'job-candidate',
          role: 'Candidate',
          name: 'Senior AI Engineer Candidate',
          personality: 'Collaborative',
          goal: 'Secure top-of-band base compensation, equity stock grants, and 3 days remote flexibility',
          current_offer: 175000,
          target_value: 175000,
          reservation_value: 160000,
          stance: 'Seeking agreement',
          progress_percent: 50,
        },
      ],
      openingOffer: 152000,
      openingMessage: 'We are pleased to extend an initial compensation proposal of ₹1,52,000 base salary with comprehensive enterprise benefits and standard equity vesting.',
    },
    'project-budget': {
      title: 'Project Budget Allocation',
      defaultMaxRounds: 12,
      currency: '₹',
      agents: [
        {
          id: 'vp-engineering',
          role: 'Engineering Lead',
          name: 'VP of Engineering',
          personality: 'Risk-Averse',
          goal: 'Secure core infrastructure capital (target ₹4,50,000) for platform reliability and tech debt reduction',
          current_offer: 450000,
          target_value: 450000,
          reservation_value: 350000,
          stance: 'Justifying reliability',
          progress_percent: 50,
        },
        {
          id: 'cmo-marketing',
          role: 'Marketing Lead',
          name: 'Chief Marketing Officer',
          personality: 'Aggressive',
          goal: 'Secure customer acquisition and paid growth capital (target ₹3,50,000)',
          current_offer: 350000,
          target_value: 350000,
          reservation_value: 250000,
          stance: 'Demanding growth capital',
          progress_percent: 45,
        },
        {
          id: 'head-product-ai',
          role: 'Product AI Lead',
          name: 'Head of Product AI',
          personality: 'Collaborative',
          goal: 'Secure feature development and GenAI product launch capital (target ₹3,00,000) to meet roadmap goals',
          current_offer: 300000,
          target_value: 300000,
          reservation_value: 200000,
          stance: 'Highlighting innovation',
          progress_percent: 50,
        },
      ],
      openingOffer: 450000,
      openingMessage: 'Engineering proposes initial tripartite allocation: Engineering ₹4,50,000, Marketing ₹3,50,000, Product AI ₹3,00,000 (Total ₹11,00,000 against ₹10,00,000 ceiling). Cloud infrastructure and database uptime must remain protected.',
    },
  };

  const config = scenarioConfigs[scenarioId] || scenarioConfigs['vendor-pricing'];

  // Apply custom agent personalities and goals if provided
  const effectiveAgents = config.agents.map((baseAgent, idx) => {
    if (Array.isArray(customAgents) && customAgents.length > 0) {
      const match = customAgents.find(
        (ca) =>
          ca.id === baseAgent.id ||
          ca.role?.toLowerCase() === baseAgent.role?.toLowerCase() ||
          ca.name?.toLowerCase() === baseAgent.name?.toLowerCase()
      ) || customAgents[idx];

      if (match) {
        return {
          ...baseAgent,
          name: match.name || baseAgent.name,
          role: match.role || baseAgent.role,
          personality: match.personality || baseAgent.personality,
          goal: match.goal || baseAgent.goal,
          is_human: match.is_human === true || match.personality === 'Human',
        };
      }
    }
    return baseAgent;
  });

  const hasHuman = effectiveAgents.some((a) => a.is_human === true || a.personality === 'Human');
  if (hasHuman) {
    if (scenarioId === 'vendor-pricing') {
      const seller = effectiveAgents.find((a) => (a.role || '').toLowerCase().includes('seller') || (a.role || '').toLowerCase().includes('sales') || (a.id || '').includes('seller') || (a.id || '').includes('vendor'));
      const buyer = effectiveAgents.find((a) => (a.role || '').toLowerCase().includes('buyer') || (a.role || '').toLowerCase().includes('procurement') || (a.id || '').includes('buyer'));
      if (seller && buyer) effectiveAgents = [seller, buyer];
    } else if (scenarioId === 'job-offer') {
      const recruiter = effectiveAgents.find((a) => (a.role || '').toLowerCase().includes('recruiter') || (a.role || '').toLowerCase().includes('hiring') || (a.id || '').includes('recruiter') || (a.id || '').includes('hiring'));
      const candidate = effectiveAgents.find((a) => (a.role || '').toLowerCase().includes('candidate') || (a.id || '').includes('candidate'));
      if (recruiter && candidate) effectiveAgents = [recruiter, candidate];
    } else if (scenarioId === 'project-budget') {
      const aiAgents = effectiveAgents.filter((a) => a.personality !== 'Human' && a.is_human !== true);
      const humanAgents = effectiveAgents.filter((a) => a.personality === 'Human' || a.is_human === true);
      if (aiAgents.length > 0 && humanAgents.length > 0) effectiveAgents = [...aiAgents, ...humanAgents];
    }
  }

  const firstAgent = effectiveAgents[0];
  const secondAgent = effectiveAgents[1] || effectiveAgents[0];
  const initialGap = Math.abs((firstAgent.current_offer || 0) - (secondAgent.current_offer || 0));

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isFirstHuman = firstAgent.personality === 'Human' || firstAgent.is_human === true;
  const initialMessages = [
    {
      id: `msg_init_${Date.now()}_0`,
      round_number: 1,
      sender_type: 'ORCHESTRATOR',
      sender_name: 'Orchestrator Agent',
      sender_role: 'Orchestrator',
      message: `Simulation initialized for "${config.title}". Round 1 commenced between ${effectiveAgents.map(a => a.name || a.role).join(' vs ')}. Awaiting opening move.`,
      action: 'STATUS',
      timestamp_label: timeStr,
    },
  ];

  const initialOffers = [];

  if (!isFirstHuman) {
    let openingMsg = config.openingMessage;
    let openingVal = config.openingOffer;
    if (firstAgent.id === 'vendor-sales') {
      openingVal = 110000;
      openingMsg = 'We are pleased to present our initial enterprise quotation of ₹110,000 with Net-30 payment terms and 99.9% uptime SLA.';
    } else if (firstAgent.id === 'hiring-director') {
      openingVal = 152000;
      openingMsg = 'We are pleased to extend an initial compensation proposal of ₹1,52,000 base salary with comprehensive enterprise benefits and standard equity vesting.';
    } else if (firstAgent.id === 'vp-engineering') {
      openingVal = 450000;
      openingMsg = 'Engineering proposes initial tripartite allocation: Engineering ₹4,50,000, Marketing ₹3,50,000, Product AI ₹3,00,000 (Total ₹11,00,000 against ₹10,00,000 ceiling). Cloud infrastructure and database uptime must remain protected.';
    }

    initialMessages.push({
      id: `msg_init_${Date.now()}_1`,
      round_number: 1,
      sender_type: 'AGENT',
      sender_name: firstAgent.name,
      sender_role: firstAgent.role,
      personality: firstAgent.personality,
      message: openingMsg,
      offer_value: openingVal,
      timestamp_label: timeStr,
    });
    initialOffers.push({
      round_number: 1,
      agent_role: firstAgent.role,
      offer_value: openingVal,
    });
  }

  return {
    id: `local_sim_${Date.now()}`,
    scenario_id: scenarioId,
    scenario_title: config.title,
    status: 'RUNNING',
    current_round: 1,
    max_rounds: maxRounds || config.defaultMaxRounds,
    current_gap: initialGap,
    agreement_likelihood: 50,
    agents: effectiveAgents,
    messages: initialMessages,
    offers: initialOffers,
  };
}

/**
 * Local turn advance engine for fallback offline / cold-start reliability
 */
function advanceLocalSimulation(simulationId, customMove = null) {
  let sim = localSimulationsCache.get(simulationId);
  if (!sim) {
    sim = {
      id: simulationId,
      scenario_id: 'project-budget',
      scenario_title: 'Project Budget Allocation',
      status: 'RUNNING',
      current_round: 1,
      max_rounds: 12,
      current_gap: 0,
      agreement_likelihood: 50,
      agents: [
        { id: 'vp-engineering', role: 'Engineering Lead', name: 'VP of Engineering', personality: 'Risk-Averse', current_offer: 450000 },
        { id: 'cmo-marketing', role: 'Marketing Lead', name: 'Chief Marketing Officer', personality: 'Aggressive', current_offer: 350000 },
        { id: 'head-product-ai', role: 'Product AI Lead', name: 'Head of Product AI', personality: 'Collaborative', current_offer: 300000 },
      ],
      messages: [],
      offers: [],
    };
    localSimulationsCache.set(simulationId, sim);
  }

  const maxR = Number(sim.max_rounds || 10);
  if (sim.status !== 'RUNNING' || Number(sim.current_round) > maxR) {
    if (sim.status === 'RUNNING' && Number(sim.current_round) >= maxR) {
      sim.status = 'DEADLOCK';
    }
    return sim;
  }

  const agents = sim.agents || [];
  if (agents.length === 0) return sim;

  const currentRoundMessages = (sim.messages || []).filter(
    (m) => m.round_number === sim.current_round && (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN')
  );

  const activeIndex = currentRoundMessages.length % agents.length;
  let activeAgent = agents[activeIndex];

  // Prevent consecutive speaker repeats
  const lastMsg = currentRoundMessages[currentRoundMessages.length - 1];
  if (lastMsg && (lastMsg.sender_role === activeAgent.role || lastMsg.sender_name === activeAgent.name)) {
    activeAgent = agents[(activeIndex + 1) % agents.length];
  }

  // If a custom move is submitted (human action), lock activeAgent to the human participant
  if (customMove) {
    const humanAg = agents.find(
      (a) => a.personality === 'Human' || a.is_human === true || (customMove.sender_role && a.role === customMove.sender_role)
    );
    if (humanAg) {
      activeAgent = humanAg;
    }
  }

  const isHumanTurn = activeAgent.personality === 'Human' || activeAgent.is_human === true || Boolean(customMove);
  const isRoundEnd = (currentRoundMessages.length + 1) % agents.length === 0;

  if (isHumanTurn && !customMove) {
    return sim;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let moveMessage = '';
  let moveOffer = activeAgent.current_offer;
  let moveAction = (sim.messages || []).some(m => m.offer_value) ? 'COUNTER_OFFER' : 'OFFER';

  if (isHumanTurn && customMove) {
    moveMessage = customMove.message || 'I propose our revised allocation.';
    moveOffer = customMove.offer_value !== undefined ? customMove.offer_value : activeAgent.current_offer;
    moveAction = customMove.action || 'COUNTER_OFFER';
  } else {
    // Generate realistic AI moves with natural concession
    const rNum = Number(sim.current_round || 1);
    const progress = Math.min(1.0, (rNum - 1) / Math.max(1, maxR - 3));

    if (sim.scenario_id === 'project-budget') {
      const isEng = (activeAgent.id || '').includes('engineering') || (activeAgent.role || '').toLowerCase().includes('engineering');
      const isMkt = (activeAgent.id || '').includes('marketing') || (activeAgent.role || '').toLowerCase().includes('marketing');
      const roundConcession = Math.min(sim.current_round * 10000, 40000);

      const engVal = 450000 - (isEng ? roundConcession : Math.round(roundConcession * 0.8));
      const mktVal = 350000 - (isMkt ? roundConcession : Math.round(roundConcession * 0.7));
      const prodVal = 300000 - (!isEng && !isMkt ? roundConcession : Math.round(roundConcession * 0.6));
      const totalDemanded = engVal + mktVal + prodVal;

      if (sim.current_round >= 6 || totalDemanded <= 1000000) {
        moveAction = 'ACCEPT';
        moveOffer = isEng ? 410000 : (isMkt ? 325000 : 265000);
        moveMessage = `We agree to finalize the balanced ₹1,000,000 tripartite allocation: Engineering ₹410,000, Marketing ₹325,000, Product AI ₹265,000.`;
      } else {
        moveOffer = isEng ? engVal : (isMkt ? mktVal : prodVal);
        if (isEng) {
          moveMessage = `Engineering proposes allocation: Engineering ₹${engVal.toLocaleString()}, Marketing ₹${mktVal.toLocaleString()}, Product AI ₹${prodVal.toLocaleString()} (Total ₹${totalDemanded.toLocaleString()}). Platform reliability remains vital.`;
        } else if (isMkt) {
          moveMessage = `Marketing proposes allocation: Engineering ₹${engVal.toLocaleString()}, Marketing ₹${mktVal.toLocaleString()}, Product AI ₹${prodVal.toLocaleString()} (Total ₹${totalDemanded.toLocaleString()}). Securing enterprise customer acquisition capital is essential.`;
        } else {
          moveMessage = `Product AI proposes allocation: Engineering ₹${engVal.toLocaleString()}, Marketing ₹${mktVal.toLocaleString()}, Product AI ₹${prodVal.toLocaleString()} (Total ₹${totalDemanded.toLocaleString()}). Balancing GenAI model development and shared capacities.`;
        }
      }
    } else if (sim.scenario_id === 'job-offer') {
      const isCandidate = (activeAgent.role || '').toLowerCase().includes('candidate');
      if (isCandidate) {
        const candidateOffer = Math.round(175000 - progress * 10000);
        const recruiterOffer = agents.find(a => a !== activeAgent)?.current_offer || 152000;
        if (recruiterOffer >= candidateOffer || (rNum >= 5 && Math.abs(candidateOffer - recruiterOffer) <= 3000)) {
          moveAction = 'ACCEPT';
          moveOffer = recruiterOffer;
          moveMessage = `Thank you for working through these terms. I am pleased to accept the agreed base salary of ₹${Number(moveOffer).toLocaleString()}.`;
        } else {
          moveOffer = candidateOffer;
          moveMessage = `To help us align, I can adjust my compensation expectation to ₹${Number(moveOffer).toLocaleString()} base with full benefits.`;
        }
      } else {
        const recruiterOffer = Math.round(152000 + progress * 12000);
        const candidateOffer = agents.find(a => a !== activeAgent)?.current_offer || 175000;
        if (recruiterOffer >= candidateOffer || (rNum >= 5 && Math.abs(candidateOffer - recruiterOffer) <= 3000)) {
          moveAction = 'ACCEPT';
          moveOffer = candidateOffer;
          moveMessage = `We are pleased to extend and finalize an agreed compensation of ₹${Number(moveOffer).toLocaleString()} base salary. Welcome to the team!`;
        } else {
          moveOffer = recruiterOffer;
          moveMessage = `We have secured executive approval to enhance our package to ₹${Number(moveOffer).toLocaleString()} base salary.`;
        }
      }
    } else {
      // Vendor Pricing Negotiation
      const isBuyer = (activeAgent.role || '').toLowerCase().includes('buyer') || (activeAgent.role || '').toLowerCase().includes('procurement');
      if (isBuyer) {
        const buyerOffer = Math.round(95000 + progress * 4000);
        const sellerOffer = agents.find(a => a !== activeAgent)?.current_offer || 110000;
        if (sellerOffer <= buyerOffer || (rNum >= 5 && Math.abs(sellerOffer - buyerOffer) <= 2500)) {
          moveAction = 'ACCEPT';
          moveOffer = sellerOffer;
          moveMessage = `We accept your proposed contract valuation of ₹${Number(moveOffer).toLocaleString()} with Net-60 payment terms.`;
        } else {
          moveOffer = buyerOffer;
          moveMessage = `In the spirit of partnership, we adjust our purchasing offer to ₹${Number(moveOffer).toLocaleString()} under Net-60 terms.`;
        }
      } else {
        const sellerOffer = Math.round(110000 - progress * 11000);
        const buyerOffer = agents.find(a => a !== activeAgent)?.current_offer || 95000;
        if (buyerOffer >= sellerOffer || (rNum >= 5 && Math.abs(sellerOffer - buyerOffer) <= 2500)) {
          moveAction = 'ACCEPT';
          moveOffer = buyerOffer;
          moveMessage = `We are pleased to accept your proposed contract value of ₹${Number(moveOffer).toLocaleString()} with Net-60 terms and four-week delivery.`;
        } else {
          moveOffer = sellerOffer;
          moveMessage = `To facilitate alignment, we can offer a concession down to ₹${Number(moveOffer).toLocaleString()} under standard commercial terms.`;
        }
      }
    }
  }

  // Update agent offer
  activeAgent.current_offer = moveOffer;

  const newMessages = [
    ...(sim.messages || []),
    {
      id: `msg_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      round_number: sim.current_round,
      sender_type: isHumanTurn ? 'HUMAN' : 'AGENT',
      sender_name: activeAgent.name,
      sender_role: activeAgent.role,
      personality: activeAgent.personality,
      message: moveMessage,
      offer_value: moveOffer,
      action: moveAction,
      timestamp_label: timeStr,
    },
  ];

  let nextRound = sim.current_round;
  let status = sim.status;

  if (moveAction === 'ACCEPT') {
    status = 'COMPLETED';
    newMessages.push({
      id: `msg_local_accept_${Date.now()}`,
      round_number: sim.current_round,
      sender_type: 'ORCHESTRATOR',
      sender_name: 'Orchestrator Agent',
      sender_role: 'Orchestrator',
      message: 'Congratulations! All participating parties have successfully reached an agreement. The negotiation has concluded.',
      action: 'STATUS',
      timestamp_label: timeStr,
    });
  } else if (isRoundEnd) {
    if (sim.current_round >= maxR) {
      status = 'DEADLOCK';
      newMessages.push({
        id: `msg_local_deadlock_${Date.now()}`,
        round_number: sim.current_round,
        sender_type: 'ORCHESTRATOR',
        sender_name: 'Orchestrator Agent',
        sender_role: 'Orchestrator',
        message: `Maximum round limit (${maxR}) reached without agreement. Negotiation concluded in Deadlock.`,
        action: 'STATUS',
        timestamp_label: timeStr,
      });
    } else {
      nextRound = sim.current_round + 1;
      newMessages.push({
        id: `msg_local_round_${Date.now()}`,
        round_number: sim.current_round,
        sender_type: 'ORCHESTRATOR',
        sender_name: 'Orchestrator Agent',
        sender_role: 'Orchestrator',
        message: `Round ${sim.current_round} concluded. Advancing to Round ${nextRound}...`,
        action: 'STATUS',
        timestamp_label: timeStr,
      });
    }
  }

  const updatedSim = {
    ...sim,
    current_round: nextRound,
    status,
    messages: newMessages,
    agreement_likelihood: status === 'COMPLETED' ? 100 : Math.min(95, 50 + nextRound * 4),
  };

  localSimulationsCache.set(simulationId, updatedSim);
  return updatedSim;
}
