/**
 * AI Service Client
 * Handles communication between Express Backend and Python/FastAPI Gemini Service
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Request next negotiation move from the AI Service (or fallback simulator)
 */
async function getAgentNegotiationMove({
  scenario,
  agent,
  counterpart,
  roundNumber,
  maxRounds,
  currentOffer,
  history = [],
}) {
  // 1. Attempt to call Python/FastAPI Gemini AI Service
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast real-time response with instant fallback

    const res = await fetch(`${AI_SERVICE_URL}/api/agent/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario,
        agent,
        counterpart_agent: counterpart,
        round_number: roundNumber,
        max_rounds: maxRounds,
        current_offer: currentOffer,
        conversation_history: history,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      console.log(`🤖 [AI Service] Received response from Gemini service for ${agent.role}:`, data.action);
      return data;
    } else {
      console.warn(`⚠️ [AI Service] FastAPI returned HTTP ${res.status}, using intelligent fallback engine.`);
    }
  } catch (err) {
    // Expected when FastAPI is not yet started or offline
    console.log(`ℹ️ [AI Service] FastAPI offline (${err.name === 'AbortError' ? 'timeout' : err.message}). Using built-in reasoning engine.`);
  }

  // 2. High-Fidelity Domain Concession Fallback Engine
  // Models realistic multi-round negotiation concession curves
  return generateDeterministicAgentMove({
    scenario,
    agent,
    counterpart,
    roundNumber,
    maxRounds,
    currentOffer,
    history,
  });
}

/**
 * Helper to pick random dialogue option
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Mathematically grounded concession rate calculation
 */
function calculateConcessionRate(personality, roundNumber, maxRounds, counterpartPersonality = '') {
  if (maxRounds <= 1) return 1.0;
  const tNorm = Math.max(0, Math.min(1, (roundNumber - 1) / (maxRounds - 1)));
  const p = (personality || 'Collaborative').toLowerCase();
  const cp = (counterpartPersonality || 'Collaborative').toLowerCase();

  if (p.includes('aggressive')) {
    const dampener = cp.includes('aggressive') ? 0.7 : 1.0;
    return dampener * (0.04 * tNorm + 0.35 * Math.pow(tNorm, 3));
  } else if (p.includes('risk')) {
    return Math.min(0.90, 0.25 + 0.65 * Math.pow(tNorm, 0.6));
  } else {
    return Math.min(0.75, 0.10 + 0.65 * tNorm);
  }
}

/**
 * Intelligent domain reasoning engine for seamless offline demo and test stability
 */
function generateDeterministicAgentMove({
  scenario,
  agent,
  counterpart,
  roundNumber,
  maxRounds = 10,
  currentOffer,
  history,
}) {
  const scenarioId = (scenario?.id || scenario?.scenario_id || '').toLowerCase();
  const scenarioTitle = (scenario?.title || scenario?.scenario_title || '').toLowerCase();
  const role = (agent?.role || '').toLowerCase();
  const name = (agent?.name || '').toLowerCase();
  const agentId = (agent?.id || '').toLowerCase();
  const agentDescriptor = `${agentId} ${role} ${name}`.toLowerCase();
  const personality = (agent?.personality || 'Collaborative').toLowerCase();
  const cpPersonality = (counterpart?.personality || 'Collaborative').toLowerCase();
  const currency = scenario?.currency || '₹';

  const concessionRate = calculateConcessionRate(personality, roundNumber, maxRounds, cpPersonality);
  const counterpartOffer = counterpart?.current_offer ? Number(counterpart.current_offer) : null;

  let proposedOffer = 0;
  let message = '';
  let stance = 'Holding firm';
  const hasPriorOffers = Array.isArray(history) && history.some((m) => m.offer_value || m.sender_type === 'AGENT' || m.sender_type === 'HUMAN');
  let action = hasPriorOffers || roundNumber > 1 ? 'COUNTER_OFFER' : 'OFFER';
  let agreementReached = false;
  let terms = {};

  // Scenario 1: Project Budget Allocation (3-agent multilateral)
  if (scenarioId.includes('budget') || scenarioTitle.includes('budget')) {
    const engReq = Math.round(450000 - concessionRate * 50000);
    const mktReq = Math.round(350000 - concessionRate * 30000);
    const prodReq = 1000000 - (engReq + mktReq);

    if (roundNumber >= 8 || (Math.abs(engReq - 400000) <= 5000 && roundNumber >= 6)) {
      action = 'ACCEPT';
      agreementReached = true;
      stance = 'Agreement reached';
      message = pickRandom([
        `All teams align on the balanced ${currency}1,000,000 budget split: Engineering ${currency}${engReq.toLocaleString()}, Marketing ${currency}${mktReq.toLocaleString()}, Product AI ${currency}${prodReq.toLocaleString()}.`,
        `Consensus finalized. We agree to the tripartite allocation: Engineering ${currency}${engReq.toLocaleString()}, Marketing ${currency}${mktReq.toLocaleString()}, Product AI ${currency}${prodReq.toLocaleString()}.`
      ]);
    } else {
      stance = `${agent.personality} allocation review`;
      message = pickRandom([
        `Proposing balanced budget allocation: Engineering ${currency}${engReq.toLocaleString()}, Marketing ${currency}${mktReq.toLocaleString()}, Product AI ${currency}${prodReq.toLocaleString()}.`,
        `To optimize cross-team ROI, our revised distribution is: Engineering ${currency}${engReq.toLocaleString()}, Marketing ${currency}${mktReq.toLocaleString()}, Product AI ${currency}${prodReq.toLocaleString()}.`
      ]);
    }

    if (agentDescriptor.includes('engineering') || agentDescriptor.includes('infrastructure') || agentDescriptor.includes('department-a') || agentDescriptor.includes('lead software')) {
      proposedOffer = engReq;
      terms = { engineeringFunding: engReq, total: 1000000 };
    } else if (agentDescriptor.includes('marketing') || agentDescriptor.includes('growth') || agentDescriptor.includes('department-b') || agentDescriptor.includes('cmo')) {
      proposedOffer = mktReq;
      terms = { marketingFunding: mktReq, total: 1000000 };
    } else {
      proposedOffer = prodReq;
      terms = { productAIFunding: prodReq, total: 1000000 };
    }
  }
  // Scenario 2: Job Offer / Compensation Negotiation (Bilateral)
  else if (scenarioId.includes('job') || scenarioId.includes('salary') || scenarioTitle.includes('job')) {
    const isCandidate = agentDescriptor.includes('candidate') ||
                        agentDescriptor.includes('engineer') ||
                        agentDescriptor.includes('applicant') ||
                        agentDescriptor.includes('interviewee');
    if (isCandidate) {
      const salTarget = 175000;
      const salLimit = 160000;
      proposedOffer = Math.round(salTarget - concessionRate * (salTarget - salLimit));

      if (counterpartOffer && counterpartOffer >= salLimit) {
        if (Math.abs(proposedOffer - counterpartOffer) <= 500 || roundNumber >= 8) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
      }

      if (agreementReached) {
        message = pickRandom([
          `I am delighted to accept the offer of ${currency}${proposedOffer.toLocaleString()} base salary with the agreed remote flexibility.`,
          `Thank you for working through these terms. I confirm acceptance of ${currency}${proposedOffer.toLocaleString()} base salary.`
        ]);
        stance = 'Agreement reached';
      } else if (roundNumber === 1) {
        message = pickRandom([
          `Based on senior AI engineering market benchmarks, I propose a base salary of ${currency}${proposedOffer.toLocaleString()} with remote flexibility.`,
          `My initial proposal is ${currency}${proposedOffer.toLocaleString()} base compensation reflecting senior machine learning engineering rates.`
        ]);
        stance = 'Seeking target compensation';
      } else if (personality.includes('aggressive')) {
        message = pickRandom([
          `My technical background and machine learning impact warrant a competitive package. I propose ${currency}${proposedOffer.toLocaleString()} base.`,
          `Given competing offers and domain expertise, ${currency}${proposedOffer.toLocaleString()} base is my required compensation baseline.`
        ]);
        stance = 'Holding for market value';
      } else {
        message = pickRandom([
          `I can adjust my salary expectation to ${currency}${proposedOffer.toLocaleString()} base given the equity structure.`,
          `To help us bridge the gap, I propose a compromise base salary of ${currency}${proposedOffer.toLocaleString()}.`
        ]);
        stance = 'Constructive counteroffer';
      }
    } else {
      // Recruiter / Hiring Director
      const salTarget = 152000;
      const salLimit = 168000;
      proposedOffer = Math.round(salTarget + concessionRate * (salLimit - salTarget));

      if (counterpartOffer && counterpartOffer <= salLimit) {
        if (Math.abs(counterpartOffer - proposedOffer) <= 500 || roundNumber >= 8) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
      }

      if (agreementReached) {
        message = pickRandom([
          `We are pleased to accept your proposed base salary of ${currency}${proposedOffer.toLocaleString()} with full benefits. Welcome to the team!`,
          `We confirm an agreed base compensation of ${currency}${proposedOffer.toLocaleString()}. Thrilled to have you join us!`
        ]);
        stance = 'Agreement reached';
      } else if (!counterpartOffer || roundNumber === 1) {
        if (!hasPriorOffers) proposedOffer = salTarget;
        message = pickRandom([
          `We are excited about your candidacy and pleased to extend an initial opening offer of ${currency}${proposedOffer.toLocaleString()} base salary with full benefits.`,
          `We value your technical background and are pleased to table an opening compensation offer of ${currency}${proposedOffer.toLocaleString()} base salary.`
        ]);
        stance = 'Opening Proposal';
      } else if (personality.includes('aggressive')) {
        message = pickRandom([
          `Our salary band for this grade has strict budget caps. We can adjust to ${currency}${proposedOffer.toLocaleString()} base.`,
          `We must maintain consistency across the engineering division. Our counter is ${currency}${proposedOffer.toLocaleString()} base.`
        ]);
        stance = 'Budget boundary enforcement';
      } else {
        message = pickRandom([
          `We have secured approval to enhance our package to ${currency}${proposedOffer.toLocaleString()} base with annual refreshers.`,
          `To demonstrate our strong interest, we increase our offer to ${currency}${proposedOffer.toLocaleString()} base salary.`
        ]);
        stance = 'Approaching agreement';
      }
    }
    terms = { baseSalary: proposedOffer, round: roundNumber };
  }
  // Scenario 3: Vendor Pricing Negotiation (Standard Default)
  else {
    const isBuyer = agentDescriptor.includes('buyer') ||
                    agentDescriptor.includes('procurement') ||
                    agentDescriptor.includes('purchasing') ||
                    agentDescriptor.includes('purchase') ||
                    agentDescriptor.includes('client');

    if (isBuyer) {
      const priceTarget = 95000;
      const priceLimit = 100000;
      proposedOffer = Math.round(priceTarget + concessionRate * (priceLimit - priceTarget));

      if (counterpartOffer && counterpartOffer <= priceLimit) {
        if (Math.abs(counterpartOffer - proposedOffer) <= 500 || (roundNumber >= 8 && !personality.includes('aggressive'))) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
      }

      if (agreementReached) {
        message = pickRandom([
          `We accept your proposed contract value of ${currency}${proposedOffer.toLocaleString()} with Net-60 payment terms.`,
          `We have reviewed the revised figures and agree to finalize at ${currency}${proposedOffer.toLocaleString()} with Net-60 terms.`,
          `Deal confirmed at ${currency}${proposedOffer.toLocaleString()}. We look forward to a successful implementation.`
        ]);
        stance = 'Agreement reached';
      } else if (roundNumber === 1) {
        message = pickRandom([
          `We propose an opening contract value of ${currency}${proposedOffer.toLocaleString()} with Net-60 payment and four-week delivery.`,
          `Our initial procurement proposal is ${currency}${proposedOffer.toLocaleString()} under standard Net-60 payment terms.`
        ]);
        stance = 'Seeking agreement';
      } else if (personality.includes('aggressive')) {
        message = pickRandom([
          `Our enterprise procurement budget has firm constraints. We can offer ${currency}${proposedOffer.toLocaleString()} under standard Net-60 terms.`,
          `Executive leadership has set strict expenditure ceilings. Our revised offer is ${currency}${proposedOffer.toLocaleString()} on Net-60 terms.`,
          `Market alternatives remain within our targeted envelope. We counter at ${currency}${proposedOffer.toLocaleString()} with Net-60 terms.`
        ]);
        stance = 'Defending budget limits';
      } else {
        message = pickRandom([
          `We can advance our offer to ${currency}${proposedOffer.toLocaleString()} to help bridge the commercial difference.`,
          `In the interest of mutual progress, we increase our proposal to ${currency}${proposedOffer.toLocaleString()} under Net-60 terms.`,
          `We appreciate your position and propose adjusting our budget to ${currency}${proposedOffer.toLocaleString()}.`
        ]);
        stance = 'Exploring compromise';
      }
    } else {
      // Seller
      const priceTarget = 110000;
      const priceLimit = 90000;
      proposedOffer = Math.round(priceTarget - concessionRate * (priceTarget - priceLimit));

      if (counterpartOffer && counterpartOffer >= priceLimit) {
        if (Math.abs(proposedOffer - counterpartOffer) <= 500 || (roundNumber >= 8 && !personality.includes('aggressive'))) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
      }

      if (agreementReached) {
        message = pickRandom([
          `We are pleased to accept your proposed contract value of ${currency}${proposedOffer.toLocaleString()} with agreed terms.`,
          `We accept ${currency}${proposedOffer.toLocaleString()} with Net-60 payment terms and four-week delivery.`,
          `Consensus reached at ${currency}${proposedOffer.toLocaleString()}. We look forward to serving your organization.`
        ]);
        stance = 'Agreement reached';
      } else if (!counterpartOffer || roundNumber === 1) {
        if (!hasPriorOffers) proposedOffer = priceTarget;
        message = pickRandom([
          `Our initial quotation is ${currency}${proposedOffer.toLocaleString()} under standard Net-30 payment terms and 99.9% uptime SLA.`,
          `We are pleased to present our initial enterprise rate of ${currency}${proposedOffer.toLocaleString()} with standard commercial delivery terms.`
        ]);
        stance = 'Opening Proposal';
      } else if (personality.includes('aggressive')) {
        message = pickRandom([
          `Our dedicated infrastructure and enterprise SLAs justify our rate. Our revised rate is ${currency}${proposedOffer.toLocaleString()}.`,
          `Maintaining our 99.9% uptime compliance requires sustainable margins. We adjust to ${currency}${proposedOffer.toLocaleString()}.`,
          `Our service level delivers measurable commercial value. Our current counter is ${currency}${proposedOffer.toLocaleString()}.`
        ]);
        stance = 'Protecting commercial margin';
      } else {
        message = pickRandom([
          `To facilitate alignment, we can offer a volume concession down to ${currency}${proposedOffer.toLocaleString()}.`,
          `We can meet you midway by reducing our quotation to ${currency}${proposedOffer.toLocaleString()}.`,
          `In response to your counter, we are willing to concession down to ${currency}${proposedOffer.toLocaleString()}.`
        ]);
        stance = 'Exploring concession';
      }
    }
    terms = { unitPrice: proposedOffer, currency, round: roundNumber };
  }

  // Handle conversational chit-chat / greetings if human sent casual message
  if (Array.isArray(history) && history.length > 0) {
    const lastMsg = history[history.length - 1];
    if (lastMsg?.sender_type === 'HUMAN') {
      const text = (lastMsg.message || '').toLowerCase().trim();
      if (/(movie|film|weather|song|joke|sport|food|favourite|favorite|hobby)/i.test(text)) {
        message = "That's interesting! However, let's focus on our negotiation. Would you be comfortable with our current proposed offer?";
      } else if (/^(hello|hi\b|hey\b|how are you|good morning|good evening)/i.test(text)) {
        message = "I'm doing well, thank you! Let's continue our discussion.";
      }
    }
  }

  // Calculate progress percent towards deal
  const progressPercent = agreementReached ? 100 : Math.min(95, Math.max(30, Math.round(35 + (roundNumber / maxRounds) * 55)));

  return {
    agent_role: agent.role,
    agent_name: agent.name,
    message,
    action,
    offer_value: proposedOffer,
    currency,
    stance,
    progress_percent: progressPercent,
    agreement_reached: agreementReached,
    terms,
  };
}

module.exports = {
  getAgentNegotiationMove,
};
