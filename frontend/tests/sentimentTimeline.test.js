import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreMessageSentiment,
  analyzeTrajectory,
  calculateTooltipOffsets,
  HUMAN_STANCES,
  HUMAN_STANCE_PROFILES,
  ARCHETYPE_BASELINES,
} from '../src/utils/sentimentAnalyzer.js';

test('1. Baseline scoring and lexical analysis sanity', () => {
  // Test Collaborative baseline opening
  const openingMsg = {
    round_number: 1,
    sender_type: 'AGENT',
    sender_role: 'Purchasing Manager',
    personality: 'Collaborative',
    message: 'Hello, I am proposing an opening price for our contract.',
    action: 'OFFER',
  };
  const scoredOpening = scoreMessageSentiment(openingMsg, { roundNumber: 1 });
  assert.equal(scoredOpening.sentimentScore, 0.0);
  assert.ok(scoredOpening.emotionalTone >= 0);

  // Test Aggressive rejection
  const rejectionMsg = {
    round_number: 3,
    sender_type: 'AGENT',
    sender_role: 'Candidate',
    personality: 'Aggressive',
    message: 'I reject this offer. It is completely unacceptable and below market value.',
    action: 'REJECT',
  };
  const scoredRejection = scoreMessageSentiment(rejectionMsg, { roundNumber: 3 });
  assert.ok(scoredRejection.sentimentScore <= -0.55);
  assert.ok(scoredRejection.isTension);
  assert.ok(scoredRejection.stanceRigidity >= 0.85);

  // Test Agreement acceptance
  const acceptMsg = {
    round_number: 8,
    sender_type: 'AGENT',
    sender_role: 'Purchasing Manager',
    personality: 'Collaborative',
    message: 'We agree to these terms. Thank you for a constructive partnership.',
    action: 'ACCEPT',
  };
  const scoredAccept = scoreMessageSentiment(acceptMsg, { roundNumber: 8, hasAgreement: true });
  assert.ok(scoredAccept.sentimentScore >= 0.85);
  assert.ok(scoredAccept.isConvergence);
  assert.equal(scoredAccept.stanceTag, 'Agreed');
});

/**
 * Test 2.1 (Simulation Mode - Collaborative Convergence Arc)
 * Run a Vendor Pricing simulation between Collaborative agents.
 * Verify the sentiment timeline renders a smooth ascending curve from opening neutral (0.0) to high collaboration (+0.85).
 */
test('Test 2.1 (Simulation Mode - Collaborative Convergence Arc)', () => {
  const vendorPricingMessages = [
    {
      round_number: 1,
      sender_type: 'AGENT',
      sender_role: 'Purchasing Manager',
      sender_name: 'Procurement Buyer',
      personality: 'Collaborative',
      message: 'Opening discussion for vendor pricing at $95,000.',
      offer_value: 95000,
      action: 'OFFER',
    },
    {
      round_number: 1,
      sender_type: 'AGENT',
      sender_role: 'Sales Representative',
      sender_name: 'Enterprise Supplier',
      personality: 'Collaborative',
      message: 'Welcome. We propose an initial rate of $110,000 with high quality SLAs.',
      offer_value: 110000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 2,
      sender_type: 'AGENT',
      sender_role: 'Purchasing Manager',
      sender_name: 'Procurement Buyer',
      personality: 'Collaborative',
      message: 'We appreciate the quality tier and can offer $98,000 to move closer.',
      offer_value: 98000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 2,
      sender_type: 'AGENT',
      sender_role: 'Sales Representative',
      sender_name: 'Enterprise Supplier',
      personality: 'Collaborative',
      message: 'Thank you for the concession. We can meet you at $105,000.',
      offer_value: 105000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'AGENT',
      sender_role: 'Purchasing Manager',
      sender_name: 'Procurement Buyer',
      personality: 'Collaborative',
      message: 'Let us meet in the middle at $102,000 with Net-45 payment terms.',
      offer_value: 102000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'AGENT',
      sender_role: 'Sales Representative',
      sender_name: 'Enterprise Supplier',
      personality: 'Collaborative',
      message: 'We accept your proposal of $102,000. It is a mutually beneficial win-win.',
      offer_value: 102000,
      action: 'ACCEPT',
    },
  ];

  const trajectory = analyzeTrajectory(vendorPricingMessages, {
    scenarioId: 'vendor-pricing',
    maxRounds: 3,
    agreement: { finalPrice: 102000, status: 'COMPLETED' },
  });

  assert.equal(trajectory.agentCurves.length, 2);
  const buyerCurve = trajectory.agentCurves.find((c) => c.role === 'Purchasing Manager');
  const vendorCurve = trajectory.agentCurves.find((c) => c.role === 'Sales Representative');

  assert.ok(buyerCurve, 'Buyer curve must be present');
  assert.ok(vendorCurve, 'Vendor curve must be present');

  // Verify opening round score is exactly neutral (0.0)
  assert.equal(buyerCurve.points[0].score, 0.0, 'Opening round score must be neutral 0.0');
  assert.equal(vendorCurve.points[0].score, 0.0, 'Opening round score must be neutral 0.0');

  // Verify final round score reaches high collaboration (+0.85)
  const buyerFinal = buyerCurve.points[buyerCurve.points.length - 1];
  const vendorFinal = vendorCurve.points[vendorCurve.points.length - 1];
  assert.equal(buyerFinal.score, 0.85, 'Buyer final score must reach +0.85');
  assert.equal(vendorFinal.score, 0.85, 'Vendor final score must reach +0.85');

  // Verify smooth monotonic ascent without negative dips
  for (let i = 1; i < buyerCurve.points.length; i++) {
    const prev = buyerCurve.points[i - 1].score;
    const curr = buyerCurve.points[i].score;
    assert.ok(
      curr >= prev,
      `Buyer curve should ascend smoothly: R${i} (${prev}) -> R${i + 1} (${curr})`
    );
  }

  for (let i = 1; i < vendorCurve.points.length; i++) {
    const prev = vendorCurve.points[i - 1].score;
    const curr = vendorCurve.points[i].score;
    assert.ok(
      curr >= prev,
      `Vendor curve should ascend smoothly: R${i} (${prev}) -> R${i + 1} (${curr})`
    );
  }

  assert.ok(
    trajectory.summary.overallArc.includes('Collaborative') || trajectory.summary.overallArc.includes('Convergence')
  );
  assert.equal(trajectory.tensionPoints.length, 0, 'No tension points in collaborative convergence arc');
});

/**
 * Test 2.2 (Simulation Mode - Aggressive Persona Volatility)
 * Run a Job Offer simulation with Aggressive Candidate vs Risk-Averse Recruiter.
 * Verify the sentiment timeline records negative dips (-0.6) during counter-offer rejections and spikes upon final compromise.
 */
test('Test 2.2 (Simulation Mode - Aggressive Persona Volatility)', () => {
  const jobOfferMessages = [
    {
      round_number: 1,
      sender_type: 'AGENT',
      sender_role: 'Candidate',
      sender_name: 'Senior AI Engineer Candidate',
      personality: 'Aggressive',
      message: 'I demand $175,000 base salary plus maximum equity.',
      offer_value: 175000,
      action: 'OFFER',
    },
    {
      round_number: 1,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'Hiring Director & Talent Lead',
      personality: 'Risk-Averse',
      message: 'Our approved compensation band allows $140,000.',
      offer_value: 140000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 2,
      sender_type: 'AGENT',
      sender_role: 'Candidate',
      sender_name: 'Senior AI Engineer Candidate',
      personality: 'Aggressive',
      message: 'I reject this offer. $140,000 is completely unacceptable and non-negotiable for my skillset.',
      offer_value: 175000,
      action: 'REJECT',
    },
    {
      round_number: 2,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'Hiring Director & Talent Lead',
      personality: 'Risk-Averse',
      message: 'We are cautious about exceeding departmental bounds but can stretch to $152,000.',
      offer_value: 152000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'AGENT',
      sender_role: 'Candidate',
      sender_name: 'Senior AI Engineer Candidate',
      personality: 'Aggressive',
      message: 'If you include a $15,000 sign-on bonus with $158,000 base, I will accept.',
      offer_value: 158000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'Hiring Director & Talent Lead',
      personality: 'Risk-Averse',
      message: 'We agree to the compromised terms. We welcome you to the team.',
      offer_value: 158000,
      action: 'ACCEPT',
    },
  ];

  const trajectory = analyzeTrajectory(jobOfferMessages, {
    scenarioId: 'job-offer',
    maxRounds: 3,
    agreement: { finalSalary: 158000, status: 'COMPLETED' },
  });

  const candidateCurve = trajectory.agentCurves.find((c) => c.role === 'Candidate');
  assert.ok(candidateCurve);

  // Verify negative dip down to -0.6 during counter-offer rejection in Round 2
  const round2Point = candidateCurve.points.find((p) => p.round === 2);
  assert.ok(round2Point, 'Round 2 point must exist');
  assert.equal(
    round2Point.score,
    -0.60,
    'Candidate curve must record negative dip of -0.60 during rejection'
  );
  assert.ok(round2Point.isTension, 'Rejection must be flagged as a tension point');

  // Verify tension points recorded in trajectory
  assert.ok(trajectory.tensionPoints.length > 0, 'Should record tension points');
  const registeredDip = trajectory.tensionPoints.find((tp) => tp.score <= -0.55);
  assert.ok(registeredDip, 'Trajectory should register the negative tension point');

  // Verify spike upon final compromise in Round 3
  const round3Point = candidateCurve.points.find((p) => p.round === 3);
  assert.ok(round3Point, 'Round 3 point must exist');
  assert.ok(
    round3Point.score >= 0.70,
    `Final compromise score should spike to positive territory: got ${round3Point.score}`
  );

  // Volatility check: score delta from round 2 to round 3 must be >= 1.2
  const volatilityDelta = round3Point.score - round2Point.score;
  assert.ok(
    volatilityDelta >= 1.2,
    `Volatility jump should be substantial upon compromise (was ${volatilityDelta})`
  );
});

/**
 * Test 2.3 (Practice Mode - Human Emotional Stance Tracking)
 * User negotiates Job Offer against AI Recruiter.
 * Verify the timeline dynamically plots human stance transitions across rounds without missing data points.
 */
test('Test 2.3 (Practice Mode - Human Emotional Stance Tracking)', () => {
  const practiceJobOfferMessages = [
    {
      round_number: 1,
      sender_type: 'HUMAN',
      sender_role: 'Candidate',
      sender_name: 'Human Candidate',
      stance: HUMAN_STANCES.AWAITING_OFFER,
      message: '',
      action: 'OFFER',
    },
    {
      round_number: 1,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'AI Recruiter',
      personality: 'Risk-Averse',
      message: 'Hello! We are excited to offer ₹1,40,000 for the role.',
      offer_value: 140000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 2,
      sender_type: 'HUMAN',
      sender_role: 'Candidate',
      sender_name: 'Human Candidate',
      stance: HUMAN_STANCES.IN_DIALOGUE,
      message: 'Could you share the structure of the performance bonus and remote flexibility?',
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 2,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'AI Recruiter',
      personality: 'Risk-Averse',
      message: 'We can offer 2 remote days per week and up to 10% annual bonus.',
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'HUMAN',
      sender_role: 'Candidate',
      sender_name: 'Human Candidate',
      stance: HUMAN_STANCES.FIRM,
      message: 'I cannot accept under ₹1,65,000 given current market benchmarks.',
      offer_value: 165000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 3,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'AI Recruiter',
      personality: 'Risk-Averse',
      message: '₹1,65,000 exceeds our policy limit. We could manage ₹1,55,000.',
      offer_value: 155000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 4,
      sender_type: 'HUMAN',
      sender_role: 'Candidate',
      sender_name: 'Human Candidate',
      stance: HUMAN_STANCES.COMPROMISING,
      message: 'I can compromise at ₹1,58,000 if we keep 3 remote days.',
      offer_value: 158000,
      action: 'COUNTER_OFFER',
    },
    {
      round_number: 4,
      sender_type: 'AGENT',
      sender_role: 'Recruiter',
      sender_name: 'AI Recruiter',
      personality: 'Risk-Averse',
      message: 'That works for us. We agree to ₹1,58,000 and 3 remote days.',
      offer_value: 158000,
      action: 'ACCEPT',
    },
    {
      round_number: 5,
      sender_type: 'HUMAN',
      sender_role: 'Candidate',
      sender_name: 'Human Candidate',
      stance: HUMAN_STANCES.AGREED,
      message: 'Deal accepted! Looking forward to joining.',
      action: 'ACCEPT',
    },
  ];

  const trajectory = analyzeTrajectory(practiceJobOfferMessages, {
    scenarioId: 'job-offer',
    maxRounds: 5,
    agreement: { status: 'COMPLETED' },
    practiceUserRole: 'Candidate',
  });

  const humanCurve = trajectory.agentCurves.find((c) => c.isHuman);
  assert.ok(humanCurve, 'Human participant curve must be detected in Practice Mode');

  // Verify all 5 rounds have data points (no missing data points)
  assert.equal(humanCurve.points.length, 5, 'Every round must have a human stance point (zero missing)');
  humanCurve.points.forEach((pt, idx) => {
    assert.equal(pt.round, idx + 1);
    assert.ok(typeof pt.score === 'number' && !isNaN(pt.score), `Point R${pt.round} must have valid numerical score`);
  });

  // Verify stance progression sequence matches human trajectory
  assert.equal(humanCurve.points[0].stanceTag, HUMAN_STANCES.AWAITING_OFFER);
  assert.equal(humanCurve.points[1].stanceTag, HUMAN_STANCES.IN_DIALOGUE);
  assert.equal(humanCurve.points[2].stanceTag, HUMAN_STANCES.FIRM);
  assert.equal(humanCurve.points[3].stanceTag, HUMAN_STANCES.COMPROMISING);
  assert.equal(humanCurve.points[4].stanceTag, HUMAN_STANCES.AGREED);

  // Check qualitative scores align with human stance profiles
  assert.equal(humanCurve.points[0].score, 0.0);
  assert.ok(humanCurve.points[1].score > 0.2); // In Dialogue is constructive
  assert.ok(humanCurve.points[2].score < 0.0); // Firm stance dips into negative/rigid
  assert.ok(humanCurve.points[3].score > 0.5); // Compromising is positive
  assert.ok(humanCurve.points[4].score > 0.85); // Agreed is top tier
});

/**
 * Test 2.4 (Practice Mode - 3-Party Project Budget Sync)
 * User plays Engineering Lead alongside 2 AI agents in Project Budget.
 * Verify the timeline plots 3 distinct, synchronized curves without UI collisions or tooltip offset errors.
 */
test('Test 2.4 (Practice Mode - 3-Party Project Budget Sync)', () => {
  const threePartyBudgetMessages = [
    // Round 1
    { round_number: 1, sender_type: 'HUMAN', sender_role: 'Engineering Lead', stance: 'Firm', message: 'Engineering requires ₹45,00,000 for core infra.', offer_value: 4500000 },
    { round_number: 1, sender_type: 'AGENT', sender_role: 'Product Lead', personality: 'Collaborative', message: 'Product needs ₹35,00,000 for UX overhaul.', offer_value: 3500000 },
    { round_number: 1, sender_type: 'AGENT', sender_role: 'Finance Director', personality: 'Risk-Averse', message: 'Total budget ceiling is strictly ₹1 Crore.', offer_value: 2000000 },

    // Round 2
    { round_number: 2, sender_type: 'HUMAN', sender_role: 'Engineering Lead', stance: 'Compromising', message: 'We can defer Phase 2 infra and request ₹40,00,000.', offer_value: 4000000 },
    { round_number: 2, sender_type: 'AGENT', sender_role: 'Product Lead', personality: 'Collaborative', message: 'Product will align at ₹32,00,000.', offer_value: 3200000 },
    { round_number: 2, sender_type: 'AGENT', sender_role: 'Finance Director', personality: 'Risk-Averse', message: 'Leaves ₹28,00,000 for buffer. This fits our ceiling.', offer_value: 2800000 },

    // Round 3
    { round_number: 3, sender_type: 'HUMAN', sender_role: 'Engineering Lead', stance: 'Agreed', message: 'Engineering accepts the ₹40L allocation.', action: 'ACCEPT' },
    { round_number: 3, sender_type: 'AGENT', sender_role: 'Product Lead', personality: 'Collaborative', message: 'Product accepts the ₹32L allocation.', action: 'ACCEPT' },
    { round_number: 3, sender_type: 'AGENT', sender_role: 'Finance Director', personality: 'Risk-Averse', message: 'Finance confirms the 3-party consensus budget.', action: 'ACCEPT' },
  ];

  const trajectory = analyzeTrajectory(threePartyBudgetMessages, {
    scenarioId: 'project-budget',
    maxRounds: 3,
    agreement: { total: 10000000 },
    practiceUserRole: 'Engineering Lead',
  });

  // Verify exactly 3 distinct synchronized curves are generated
  assert.equal(trajectory.agentCurves.length, 3, 'Must have exactly 3 distinct curves');
  const roles = trajectory.agentCurves.map((c) => c.role);
  assert.ok(roles.includes('Engineering Lead'));
  assert.ok(roles.includes('Product Lead'));
  assert.ok(roles.includes('Finance Director'));

  // Verify each curve has 3 synchronized round points
  trajectory.agentCurves.forEach((curve) => {
    assert.equal(curve.points.length, 3, `Curve ${curve.role} must have exactly 3 round points`);
  });

  // Verify collision detection & tooltip offset calculation
  // For each round, calculate tooltip offsets and ensure NO vertical collision
  for (let r = 1; r <= 3; r++) {
    const pointsAtRound = trajectory.agentCurves.map((c) => c.points[r - 1]);
    const offsets = calculateTooltipOffsets(pointsAtRound, { width: 800, height: 300, padding: 40 });

    assert.equal(offsets.length, 3, 'Must process all 3 points');

    // Verify minimum vertical spacing between sorted tooltip positions
    const sortedY = [...offsets].sort((a, b) => (a.rawY + a.tooltipOffsetY) - (b.rawY + b.tooltipOffsetY));
    for (let i = 1; i < sortedY.length; i++) {
      const prevY = sortedY[i - 1].rawY + sortedY[i - 1].tooltipOffsetY;
      const currY = sortedY[i].rawY + sortedY[i].tooltipOffsetY;
      const separation = currY - prevY;
      assert.ok(
        separation >= 24,
        `Tooltips at Round ${r} must have minimum separation (got ${separation}px between ${sortedY[i - 1].role} and ${sortedY[i].role})`
      );
    }

    // Verify tooltips stay strictly within canvas vertical bounds [padding, height - padding]
    offsets.forEach((pt) => {
      const finalY = pt.rawY + pt.tooltipOffsetY;
      assert.ok(finalY >= 20, `Tooltip Y must not clip top canvas (was ${finalY})`);
      assert.ok(finalY <= 280, `Tooltip Y must not clip bottom canvas (was ${finalY})`);
    });
  }
});

