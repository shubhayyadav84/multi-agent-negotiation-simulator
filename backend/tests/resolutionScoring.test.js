
const assert = require('assert');

const {
  calculateResolutionScore,
} = require('../src/services/resolutionScoringService');

let passed = 0;
let failed = 0;

const runTest = (name, expected, testFunction) => {
  try {
    const actual = testFunction();
    console.log(`\nPASS: ${name}`);
    console.log(`Expected: ${expected}`);
    console.log(`Actual: ${JSON.stringify(actual)}`);
    passed++;
  } catch (error) {
    console.log(`\nFAIL: ${name}`);
    console.log(`Expected: ${expected}`);
    console.log(`Reason: ${error.message}`);
    failed++;
  }
};

// TC 3.1: Vendor Pricing

const vendorAgents = [
  {
    role: 'Buyer',
    target_value: 95000,
    reservation_value: 100000,
  },
  {
    role: 'Seller',
    target_value: 110000,
    reservation_value: 90000,
  },
];

const vendorOffers = [
  { agent_role: 'Buyer', round_number: 1, offer_value: 95000 },
  { agent_role: 'Seller', round_number: 1, offer_value: 110000 },
  { agent_role: 'Buyer', round_number: 2, offer_value: 99000 },
  { agent_role: 'Seller', round_number: 2, offer_value: 97000 },
];

const vendorPositive = {
  scenario_id: 'vendor-pricing',
  status: 'COMPLETED',
  current_round: 2,
  max_rounds: 10,
  agents: vendorAgents,
  agreement: { final_value: 97000 },
  offers: vendorOffers,
};

const vendorNegative = {
  ...vendorPositive,
  agreement: { final_value: 105000 },
};

// TC 3.2: Deadlock

const deadlockSimulation = {
  scenario_id: 'vendor-pricing',
  status: 'DEADLOCK',
  current_round: 10,
  max_rounds: 10,
  agents: vendorAgents,
  agreement: null,
  offers: [
    { agent_role: 'Buyer', round_number: 1, offer_value: 95000 },
    { agent_role: 'Seller', round_number: 1, offer_value: 110000 },
  ],
};

const deadlockWithoutOffers = {
  ...deadlockSimulation,
  offers: [],
};

// TC 3.3: Practice Job Offer

const jobAgents = [
  {
    role: 'Recruiter',
    target_value: 152000,
    reservation_value: 168000,
  },
  {
    role: 'Candidate',
    personality: 'Human',
    target_value: 175000,
    reservation_value: 160000,
  },
];

const jobOffers = [
  { agent_role: 'Recruiter', round_number: 1, offer_value: 152000 },
  { agent_role: 'Candidate', round_number: 1, offer_value: 175000 },
  { agent_role: 'Recruiter', round_number: 2, offer_value: 160000 },
  { agent_role: 'Candidate', round_number: 3, offer_value: 165000 },
];

const jobPositive = {
  scenario_id: 'job-offer',
  status: 'COMPLETED',
  current_round: 3,
  max_rounds: 10,
  agents: jobAgents,
  agreement: { final_value: 165000 },
  offers: jobOffers,
};

const jobNegative = {
  ...jobPositive,
  agreement: { final_value: 155000 },
};

// TC 3.4: Premature Acceptance

const immediateAcceptance = {
  scenario_id: 'job-offer',
  status: 'COMPLETED',
  current_round: 1,
  max_rounds: 10,
  agents: jobAgents,
  agreement: { final_value: 152000 },
  offers: [
    {
      agent_role: 'Recruiter',
      round_number: 1,
      offer_value: 152000,
    },
  ],
};

const prematureAcceptanceAt158K = {
  ...immediateAcceptance,
  agreement: { final_value: 158000 },
  offers: [
    {
      agent_role: 'Recruiter',
      round_number: 1,
      offer_value: 152000,
    },
    {
      agent_role: 'Recruiter',
      round_number: 2,
      offer_value: 158000,
    },
  ],
};

// Positive tests

runTest(
  'TC 3.1 Positive: Vendor Pricing early agreement',
  'Valid settlement with score >= 85',
  () => {
    const result = calculateResolutionScore(vendorPositive);

    assert.strictEqual(result.validSettlement, true);
    assert.ok(result.totalScore >= 85);
    assert.strictEqual(result.components.jointSurplus, 100);

    return result;
  }
);

runTest(
  'TC 3.2 Positive: Deadlock detection',
  'Deadlock detected with score <= 45',
  () => {
    const result = calculateResolutionScore(deadlockSimulation);

    assert.strictEqual(result.outcome, 'DEADLOCK');
    assert.ok(result.totalScore <= 45);

    return result;
  }
);

runTest(
  'TC 3.3 Positive: Practice Job Offer agreement',
  'Valid agreement with salary surplus and concession fairness',
  () => {
    const result = calculateResolutionScore(jobPositive);

    assert.strictEqual(result.validSettlement, true);
    assert.strictEqual(result.mode, 'Practice');
    assert.strictEqual(result.salarySurplus, 5000);
    assert.strictEqual(result.components.concessionBalance, 75);
    assert.ok(result.badge !== null);

    return result;
  }
);

runTest(
  'TC 3.4 Positive: Premature acceptance detection',
  'Immediate acceptance receives a score below 50',
  () => {
    const result = calculateResolutionScore(immediateAcceptance);

    assert.strictEqual(result.validSettlement, false);
    assert.strictEqual(result.components.concessionBalance, 0);
    assert.ok(result.totalScore < 50);

    return result;
  }
);

// Negative tests

runTest(
  'TC 3.1 Negative: Invalid Vendor Pricing settlement',
  'Settlement outside reservation limits receives score <= 49',
  () => {
    const result = calculateResolutionScore(vendorNegative);

    assert.strictEqual(result.validSettlement, false);
    assert.ok(result.totalScore <= 49);

    return result;
  }
);

runTest(
  'TC 3.2 Negative: Deadlock without negotiation offers',
  'Deadlock must not receive joint surplus or an agreement bonus',
  () => {
    const result = calculateResolutionScore(deadlockWithoutOffers);

    assert.strictEqual(result.outcome, 'DEADLOCK');
    assert.strictEqual(result.components.jointSurplus, 0);
    assert.strictEqual(result.components.outcomeMultiplier, 0.45);
    assert.ok(result.totalScore <= 45);

    return result;
  }
);

runTest(
  'TC 3.3 Negative: Unfair Job Offer settlement',
  'Settlement below candidate reservation receives score <= 49',
  () => {
    const result = calculateResolutionScore(jobNegative);

    assert.strictEqual(result.validSettlement, false);
    assert.strictEqual(result.salarySurplus, null);
    assert.ok(result.totalScore <= 49);

    return result;
  }
);

runTest(
  'TC 3.4 Negative: Premature acceptance at 158000',
  'Candidate accepting below reservation receives score <= 49',
  () => {
    const result = calculateResolutionScore(prematureAcceptanceAt158K);

    assert.strictEqual(result.validSettlement, false);
    assert.strictEqual(result.components.concessionBalance, 0);
    assert.ok(result.totalScore <= 49);

    return result;
  }
);

console.log('\n====================================');
console.log('MILESTONE 4 SCORING TEST RESULTS');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('====================================');

if (failed > 0) {
  process.exitCode = 1;
}
