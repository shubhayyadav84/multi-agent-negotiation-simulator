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
  const hasPriorOffers = Array.isArray(history) && history.some((m) => m.offer_value || m.sender_type === 'AGENT' || m.sender_type === 'HUMAN');
  const counterpartOffer = hasPriorOffers && counterpart?.current_offer ? Number(counterpart.current_offer) : null;

  let proposedOffer = 0;
  let message = '';
  let stance = 'Holding firm';
  let action = hasPriorOffers || roundNumber > 1 ? 'COUNTER_OFFER' : 'OFFER';
  let agreementReached = false;
  let terms = {};

  // Scenario 1: Project Budget Allocation (3-agent multilateral)
  if (scenarioId.includes('budget') || scenarioTitle.includes('budget')) {
    const engConcessionMax = personality.includes('aggressive') ? 25000 : 50000;
    const mktConcessionMax = personality.includes('aggressive') ? 20000 : 40000;
    const prodConcessionMax = personality.includes('aggressive') ? 15000 : 35000;

    // Independent departmental demands starting at target:
    // Engineering: 450k (target) -> 400k (concession)
    // Marketing: 350k (target) -> 310k (concession)
    // Product AI: 300k (target) -> 265k (concession)
    const engReq = Math.round(450000 - concessionRate * engConcessionMax);
    const mktReq = Math.round(350000 - concessionRate * mktConcessionMax);
    const prodReq = Math.round(300000 - concessionRate * prodConcessionMax);
    const totalDemanded = engReq + mktReq + prodReq;

    const isEng = agentDescriptor.includes('engineering') || agentDescriptor.includes('infrastructure') || agentDescriptor.includes('department-a') || agentDescriptor.includes('lead software') || agentDescriptor.includes('vp-eng');
    const isMkt = agentDescriptor.includes('marketing') || agentDescriptor.includes('growth') || agentDescriptor.includes('department-b') || agentDescriptor.includes('cmo');

    if (roundNumber >= 8 || totalDemanded <= 1000000) {
      // Balanced consensus allocation summing to exactly 1,000,000
      const engFinal = 410000;
      const mktFinal = 325000;
      const prodFinal = 265000;

      action = 'ACCEPT';
      agreementReached = true;
      stance = 'Agreement reached';
      proposedOffer = isEng ? engFinal : (isMkt ? mktFinal : prodFinal);
      terms = {
        engineeringFunding: engFinal,
        marketingFunding: mktFinal,
        productAIFunding: prodFinal,
        total: 1000000,
      };
      message = pickRandom([
        `All three divisions agree to the balanced ${currency}1,000,000 allocation: Engineering ${currency}${engFinal.toLocaleString()}, Marketing ${currency}${mktFinal.toLocaleString()}, Product AI ${currency}${prodFinal.toLocaleString()}.`,
        `Consensus finalized. We accept the tripartite distribution: Engineering ${currency}${engFinal.toLocaleString()}, Marketing ${currency}${mktFinal.toLocaleString()}, Product AI ${currency}${prodFinal.toLocaleString()}.`
      ]);
    } else if (roundNumber === 1) {
      stance = `${agent.personality} opening request`;
      action = 'OFFER';
      if (isEng) {
        proposedOffer = engReq;
        terms = { engineeringFunding: engReq, totalDemanded };
        message = pickRandom([
          `Engineering requests ${currency}${engReq.toLocaleString()} for database scaling, security hardening, and 99.99% uptime reliability. With division requests totaling ${currency}${totalDemanded.toLocaleString()} against our ${currency}1,000,000 ceiling, we must safeguard core platform infrastructure.`,
          `Our technical roadmap requires ${currency}${engReq.toLocaleString()} capital for cloud infrastructure modernization. We need to prioritize core systems before secondary initiatives.`
        ]);
      } else if (isMkt) {
        proposedOffer = mktReq;
        terms = { marketingFunding: mktReq, totalDemanded };
        message = pickRandom([
          `Marketing requests ${currency}${mktReq.toLocaleString()} for global customer acquisition campaigns, brand partnerships, and event sponsorships. Strong growth is essential to achieve enterprise ROI.`,
          `To drive necessary pipeline and revenue targets, Marketing requires ${currency}${mktReq.toLocaleString()} in dedicated campaign funding.`
        ]);
      } else {
        proposedOffer = prodReq;
        terms = { productAIFunding: prodReq, totalDemanded };
        message = pickRandom([
          `Product AI requests ${currency}${prodReq.toLocaleString()} for generative AI feature engineering and core UX enhancements. All three divisions must negotiate disciplined trade-offs to stay within our ${currency}1,000,000 limit.`,
          `Delivering our customer-facing GenAI roadmap requires ${currency}${prodReq.toLocaleString()} funding. We propose reviewing shared dependencies to balance the budget.`
        ]);
      }
    } else {
      stance = `${agent.personality} budget defense`;
      action = 'COUNTER_OFFER';
      if (isEng) {
        proposedOffer = engReq;
        terms = { engineeringFunding: engReq, totalDemanded };
        message = pickRandom([
          `Engineering can adjust our allocation ask to ${currency}${engReq.toLocaleString()} by phasing secondary tooling, provided our core platform uptime standards remain protected.`,
          `We are willing to trim our requirement to ${currency}${engReq.toLocaleString()}, but further cuts would compromise database modernization.`
        ]);
      } else if (isMkt) {
        proposedOffer = mktReq;
        terms = { marketingFunding: mktReq, totalDemanded };
        message = pickRandom([
          `Marketing is prepared to refine our allocation ask to ${currency}${mktReq.toLocaleString()}, concentrating spend strictly on high-converting growth channels.`,
          `To assist in closing the budget gap, Marketing can operate at ${currency}${mktReq.toLocaleString()} while protecting primary launch milestones.`
        ]);
      } else {
        proposedOffer = prodReq;
        terms = { productAIFunding: prodReq, totalDemanded };
        message = pickRandom([
          `Product AI proposes a revised ask of ${currency}${prodReq.toLocaleString()} by prioritizing essential feature deliverables for Q3.`,
          `We can streamline our requirements to ${currency}${prodReq.toLocaleString()} to help bring all three departments within the overall ${currency}1,000,000 pool.`
        ]);
      }
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

      if (counterpartOffer !== null && counterpartOffer !== undefined && counterpartOffer > 0) {
        if (counterpartOffer >= proposedOffer) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        } else if (counterpartOffer >= salLimit && ((proposedOffer - counterpartOffer) <= 500 || roundNumber >= 8)) {
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
      } else if (!hasPriorOffers || roundNumber === 1) {
        proposedOffer = salTarget;
        message = pickRandom([
          `Based on senior AI engineering market benchmarks, I propose a base salary of ${currency}${proposedOffer.toLocaleString()} with remote flexibility.`,
          `My initial proposal is ${currency}${proposedOffer.toLocaleString()} base compensation reflecting senior machine learning engineering rates.`
        ]);
        stance = 'Seeking target compensation';
      } else if (personality.includes('aggressive')) {
        if (counterpartOffer) proposedOffer = Math.max(proposedOffer, counterpartOffer);
        message = pickRandom([
          `My technical background and machine learning impact warrant a competitive package. I propose ${currency}${proposedOffer.toLocaleString()} base.`,
          `Given competing offers and domain expertise, ${currency}${proposedOffer.toLocaleString()} base is my required compensation baseline.`
        ]);
        stance = 'Holding for market value';
      } else {
        if (counterpartOffer) proposedOffer = Math.max(proposedOffer, counterpartOffer);
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

      if (counterpartOffer !== null && counterpartOffer !== undefined && counterpartOffer > 0) {
        if (counterpartOffer <= proposedOffer) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        } else if (counterpartOffer <= salLimit && ((counterpartOffer - proposedOffer) <= 500 || roundNumber >= 8)) {
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
      } else if (!hasPriorOffers || roundNumber === 1) {
        proposedOffer = salTarget;
        message = pickRandom([
          `We are excited about your candidacy and pleased to extend an initial opening offer of ${currency}${proposedOffer.toLocaleString()} base salary with full benefits.`,
          `We value your technical background and are pleased to table an opening compensation offer of ${currency}${proposedOffer.toLocaleString()} base salary.`
        ]);
        stance = 'Opening Proposal';
      } else if (personality.includes('aggressive')) {
        if (counterpartOffer) proposedOffer = Math.min(proposedOffer, counterpartOffer);
        message = pickRandom([
          `Our salary band for this grade has strict budget caps. We can adjust to ${currency}${proposedOffer.toLocaleString()} base.`,
          `We must maintain consistency across the engineering division. Our counter is ${currency}${proposedOffer.toLocaleString()} base.`
        ]);
        stance = 'Budget boundary enforcement';
      } else {
        if (counterpartOffer) proposedOffer = Math.min(proposedOffer, counterpartOffer);
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

      if (counterpartOffer !== null && counterpartOffer !== undefined && counterpartOffer > 0) {
        // Condition 1: Seller asks less than or equal to what buyer was offering (e.g. seller asks 70k when buyer offer is 95k)
        if (counterpartOffer <= proposedOffer) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
        // Condition 2: Seller asks within buyer ceiling with close gap or in late rounds
        else if (counterpartOffer <= priceLimit && ((counterpartOffer - proposedOffer) <= 500 || (roundNumber >= 8 && !personality.includes('aggressive')))) {
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
      } else if (!hasPriorOffers || roundNumber === 1) {
        proposedOffer = priceTarget;
        message = pickRandom([
          `We propose an opening contract value of ${currency}${proposedOffer.toLocaleString()} with Net-60 payment and four-week delivery.`,
          `Our initial procurement proposal is ${currency}${proposedOffer.toLocaleString()} under standard Net-60 payment terms.`
        ]);
        stance = 'Seeking agreement';
      } else if (personality.includes('aggressive')) {
        if (counterpartOffer) proposedOffer = Math.min(proposedOffer, counterpartOffer);
        message = pickRandom([
          `Our enterprise procurement budget has firm constraints. We can offer ${currency}${proposedOffer.toLocaleString()} under standard Net-60 terms.`,
          `Executive leadership has set strict expenditure ceilings. Our revised offer is ${currency}${proposedOffer.toLocaleString()} on Net-60 terms.`,
          `Market alternatives remain within our targeted envelope. We counter at ${currency}${proposedOffer.toLocaleString()} with Net-60 terms.`
        ]);
        stance = 'Defending budget limits';
      } else {
        if (counterpartOffer) proposedOffer = Math.min(proposedOffer, counterpartOffer);
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

      if (counterpartOffer !== null && counterpartOffer !== undefined && counterpartOffer > 0) {
        // Condition 1: Buyer offers more than or equal to what seller is asking (e.g. buyer offers 115k when seller ask is 110k)
        if (counterpartOffer >= proposedOffer) {
          action = 'ACCEPT';
          agreementReached = true;
          proposedOffer = counterpartOffer;
        }
        // Condition 2: Buyer offers above floor with close gap or in late rounds
        else if (counterpartOffer >= priceLimit && ((proposedOffer - counterpartOffer) <= 500 || (roundNumber >= 8 && !personality.includes('aggressive')))) {
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
      } else if (!hasPriorOffers || roundNumber === 1) {
        proposedOffer = priceTarget;
        message = pickRandom([
          `Our initial quotation is ${currency}${proposedOffer.toLocaleString()} under standard Net-30 payment terms and 99.9% uptime SLA.`,
          `We are pleased to present our initial enterprise rate of ${currency}${proposedOffer.toLocaleString()} with standard commercial delivery terms.`
        ]);
        stance = 'Opening Proposal';
      } else if (personality.includes('aggressive')) {
        if (counterpartOffer) proposedOffer = Math.max(proposedOffer, counterpartOffer);
        message = pickRandom([
          `Our dedicated infrastructure and enterprise SLAs justify our rate. Our revised rate is ${currency}${proposedOffer.toLocaleString()}.`,
          `Maintaining our 99.9% uptime compliance requires sustainable margins. We adjust to ${currency}${proposedOffer.toLocaleString()}.`,
          `Our service level delivers measurable commercial value. Our current counter is ${currency}${proposedOffer.toLocaleString()}.`
        ]);
        stance = 'Protecting commercial margin';
      } else {
        if (counterpartOffer) proposedOffer = Math.max(proposedOffer, counterpartOffer);
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
