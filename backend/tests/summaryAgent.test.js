/**
 * Unit Test Suite: Post-Interaction Summary Agent Engine
 * Milestone 4 - Member 1 Feature Verification
 *
 * Verifies summary generation for:
 *  1. Simulation Mode (AI vs AI) - Agreement
 *  2. Simulation Mode (AI vs AI) - Deadlock with compromise proposals
 *  3. Practice Mode (Human vs AI) - Human bargaining trajectory & pivotal decision points
 *  4. Concession milestone extraction & opening bid auditing
 */

const assert = require('assert');
const {
  generatePostInteractionSummary,
  extractOpeningBids,
  extractConcessionMilestones,
  extractCompromiseProposals,
  generateSimulationModeNarrative,
  generatePracticeModeNarrative,
} = require('../src/services/summaryAgentService');

console.log('🧪 Starting Post-Interaction Summary Agent Test Suite (Milestone 4 - Member 1)...');

// Mock Data: Simulation Mode Session (Vendor Pricing - Agreement Reached)
const mockSimulationSession = {
  id: 'sim_test_001',
  scenario_id: 'vendor-pricing',
  scenario_title: 'Vendor Pricing Negotiation',
  status: 'AGREEMENT_REACHED',
  current_round: 4,
  max_rounds: 10,
  agents: [
    { name: 'Aarav Sharma', role: 'Buyer', personality: 'Collaborative', target_value: 95000, reservation_value: 100000 },
    { name: 'Vikram Mehta', role: 'Seller', personality: 'Aggressive', target_value: 100000, reservation_value: 92000 },
  ],
  messages: [
    { round_number: 1, sender_type: 'AGENT', sender_name: 'Aarav Sharma', sender_role: 'Buyer', offer_value: 90000, action: 'OFFER' },
    { round_number: 1, sender_type: 'AGENT', sender_name: 'Vikram Mehta', sender_role: 'Seller', offer_value: 102000, action: 'COUNTER_OFFER' },
    { round_number: 2, sender_type: 'AGENT', sender_name: 'Aarav Sharma', sender_role: 'Buyer', offer_value: 93000, action: 'COUNTER_OFFER' },
    { round_number: 2, sender_type: 'AGENT', sender_name: 'Vikram Mehta', sender_role: 'Seller', offer_value: 99000, action: 'COUNTER_OFFER' },
    { round_number: 3, sender_type: 'AGENT', sender_name: 'Aarav Sharma', sender_role: 'Buyer', offer_value: 95000, action: 'COUNTER_OFFER' },
    { round_number: 3, sender_type: 'AGENT', sender_name: 'Vikram Mehta', sender_role: 'Seller', offer_value: 96000, action: 'COUNTER_OFFER' },
    { round_number: 4, sender_type: 'AGENT', sender_name: 'Vikram Mehta', sender_role: 'Seller', offer_value: 95000, action: 'ACCEPT' },
  ],
  offers: [
    { round_number: 1, agent_role: 'Buyer', offer_value: 90000 },
    { round_number: 1, agent_role: 'Seller', offer_value: 102000 },
  ],
  agreement: {
    final_value: 95000,
    terms: { price: 95000, payment_days: 45, delivery_weeks: 4 },
  },
};

// Mock Data: Practice Mode Session (Human vs AI - Job Offer)
const mockPracticeSession = {
  id: 'sim_practice_002',
  scenario_id: 'job-offer',
  scenario_title: 'Job Offer & Compensation Negotiation',
  is_practice: true,
  status: 'AGREEMENT_REACHED',
  current_round: 3,
  max_rounds: 8,
  agents: [
    { name: 'Sarah Jenkins', role: 'Candidate', is_human: true, personality: 'Human' },
    { name: 'David Ross', role: 'Employer', is_human: false, personality: 'Analytical' },
  ],
  messages: [
    { round_number: 1, sender_type: 'AGENT', sender_name: 'David Ross', sender_role: 'Employer', offer_value: 155000, action: 'OFFER' },
    { round_number: 1, sender_type: 'HUMAN', sender_name: 'Sarah Jenkins', sender_role: 'Candidate', offer_value: 175000, action: 'COUNTER_OFFER' },
    { round_number: 2, sender_type: 'AGENT', sender_name: 'David Ross', sender_role: 'Employer', offer_value: 162000, action: 'COUNTER_OFFER' },
    { round_number: 2, sender_type: 'HUMAN', sender_name: 'Sarah Jenkins', sender_role: 'Candidate', offer_value: 168000, action: 'COUNTER_OFFER' },
    { round_number: 3, sender_type: 'HUMAN', sender_name: 'Sarah Jenkins', sender_role: 'Candidate', offer_value: 165000, action: 'ACCEPT' },
  ],
  agreement: {
    final_value: 165000,
    terms: { base_salary: 165000, sign_on_bonus: 10000, office_days: 2 },
  },
};

// Mock Data: Deadlock Session with Orchestrator Compromise Proposal
const mockDeadlockSession = {
  id: 'sim_deadlock_003',
  scenario_id: 'project-budget',
  scenario_title: 'Project Budget Allocation',
  status: 'DEADLOCK',
  current_round: 8,
  max_rounds: 8,
  agents: [
    { name: 'VP Engineering', role: 'Engineering', personality: 'Aggressive' },
    { name: 'CMO Marketing', role: 'Marketing', personality: 'Aggressive' },
  ],
  messages: [
    { round_number: 1, sender_type: 'AGENT', sender_name: 'VP Engineering', sender_role: 'Engineering', offer_value: 450000 },
    { round_number: 1, sender_type: 'AGENT', sender_name: 'CMO Marketing', sender_role: 'Marketing', offer_value: 380000 },
    { round_number: 8, sender_type: 'ORCHESTRATOR', sender_name: 'Orchestrator', sender_role: 'Mediator', message: 'Impasse detected. Proposing compromise midpoint allocation.', offer_value: 400000 },
  ],
  deadlock_reason: 'Budget demands exceed total allowable surplus of ₹10,00,000.',
  deadlock_resolution: {
    status: 'DEADLOCK',
    initial_compromise: {
      round: 8,
      offer_value: 400000,
      summary: 'Orchestrator calculated midpoint compromise proposal.',
    },
  },
};

// --------------------------------------------------------------------------
// TEST 1: Opening Bids Extraction
// --------------------------------------------------------------------------
const openingBids = extractOpeningBids(mockSimulationSession);
assert.strictEqual(openingBids.length, 2, 'Expected 2 opening bids extracted');
assert.strictEqual(openingBids[0].agent_role, 'Buyer');
assert.strictEqual(openingBids[0].offer_value, 90000);
assert.strictEqual(openingBids[1].agent_role, 'Seller');
assert.strictEqual(openingBids[1].offer_value, 102000);
console.log('  ✅ PASS: 1. Opening bids correctly extracted for both agents');

// --------------------------------------------------------------------------
// TEST 2: Concession Milestones Extraction
// --------------------------------------------------------------------------
const milestones = extractConcessionMilestones(mockSimulationSession);
assert.ok(milestones.length >= 4, `Expected at least 4 concession shifts, got ${milestones.length}`);
assert.strictEqual(milestones[0].agent_role, 'Buyer');
assert.strictEqual(milestones[0].direction, 'increased');
assert.strictEqual(milestones[0].concession_amount, 3000);
console.log('  ✅ PASS: 2. Concession milestones correctly tracked round-by-round shifts');

// --------------------------------------------------------------------------
// TEST 3: Compromise Proposals Extraction
// --------------------------------------------------------------------------
const compromises = extractCompromiseProposals(mockDeadlockSession);
assert.ok(compromises.length >= 1, 'Expected compromise proposal from deadlock session');
assert.strictEqual(compromises[0].type, 'DEADLOCK_INITIAL_COMPROMISE');
assert.strictEqual(compromises[0].proposed_value, 400000);
console.log('  ✅ PASS: 3. Compromise proposals cleanly detected from deadlock resolution envelope');

// --------------------------------------------------------------------------
// TEST 4: Simulation Mode (AI vs AI) Full Summary Generation
// --------------------------------------------------------------------------
const simSummary = generatePostInteractionSummary(mockSimulationSession);
assert.strictEqual(simSummary.mode, 'Simulation Mode (AI vs AI)');
assert.strictEqual(simSummary.outcome, 'AGREEMENT_REACHED');
assert.strictEqual(simSummary.final_terms.final_value, 95000);
assert.ok(simSummary.executive_narrative.includes('Aarav Sharma'));
assert.ok(simSummary.executive_narrative.includes('Vikram Mehta'));
assert.ok(simSummary.executive_narrative.includes('₹95,000'));
console.log('  ✅ PASS: 4. Simulation Mode generates comprehensive executive narrative and final terms');

// --------------------------------------------------------------------------
// TEST 5: Practice Mode (Human vs AI) Summary Generation & User Trajectory
// --------------------------------------------------------------------------
const practiceSummary = generatePostInteractionSummary(mockPracticeSession);
assert.strictEqual(practiceSummary.mode, 'Practice Mode (Human vs AI)');
assert.strictEqual(practiceSummary.outcome, 'AGREEMENT_REACHED');
assert.ok(practiceSummary.practice_insights, 'Practice insights must be present');
assert.ok(practiceSummary.practice_insights.style_assessment, 'User style assessment must be computed');
assert.ok(practiceSummary.practice_insights.pivotal_decision_points.length >= 2, 'Pivotal decision points must be listed');
assert.ok(practiceSummary.executive_narrative.includes('Practice Mode'));
console.log('  ✅ PASS: 5. Practice Mode generates user bargaining trajectory, style, and pivotal decision points');

// --------------------------------------------------------------------------
// TEST 6: Deadlock Narrative Generation
// --------------------------------------------------------------------------
const deadlockSummary = generatePostInteractionSummary(mockDeadlockSession);
assert.strictEqual(deadlockSummary.outcome, 'DEADLOCK');
assert.strictEqual(deadlockSummary.final_terms.status, 'UNRESOLVED');
assert.ok(deadlockSummary.executive_narrative.includes('deadlock'));
console.log('  ✅ PASS: 6. Deadlock session produces appropriate impasse narrative with reason');

console.log('\n====================================');
console.log('🎉 ALL 6 SUMMARY AGENT TESTS PASSED!');
console.log('====================================\n');
