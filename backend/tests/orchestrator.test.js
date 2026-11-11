/**
 * Unit & Integration Tests for Orchestrator Agent & Negotiation Turn Management (Task 2)
 * 
 * Verifies:
 * 1. Session initialization and agent registration
 * 2. Bilateral (2-agent) and Multilateral (3-agent) turn rotation
 * 3. Conversation history tracking and context preservation
 * 4. Step advancement, metric updates (gap & likelihood), and round progression
 * 5. Stopping condition evaluations (Acceptance, Gap Convergence, Rejection Breakdown, Max Rounds Deadlock)
 * 6. Simulation lifecycle controls (Pause, Resume, End, Run to completion)
 */

const assert = require('assert');
const { OrchestratorAgent, orchestratorService, SCENARIO_PRESETS } = require('../src/services/orchestratorService');
const { db } = require('../src/db/db');

async function runTests() {
  console.log('🧪 Starting Orchestrator Agent & Negotiation Turn Management Test Suite...\n');
  let passedCount = 0;
  let failedCount = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n${err.stack}`);
      failedCount++;
    }
  }

  // --- Test Suite ---

  await test('1. Preset retrieval loads valid defaults and scenarios', async () => {
    const orchestrator = new OrchestratorAgent();
    const vendorPreset = orchestrator.getScenarioPreset('vendor-pricing');
    assert.strictEqual(vendorPreset.id, 'vendor-pricing');
    assert.strictEqual(vendorPreset.agents.length, 2);

    const budgetPreset = orchestrator.getScenarioPreset('project-budget');
    assert.strictEqual(budgetPreset.id, 'project-budget');
    assert.strictEqual(budgetPreset.agents.length, 3);

    // Fallback for unknown ID
    const unknownPreset = orchestrator.getScenarioPreset('unknown-id');
    assert.strictEqual(unknownPreset.id, 'vendor-pricing');
  });

  await test('2. initializeSimulation creates session, logs welcome announcement, and posts opening move', async () => {
    const sim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 5,
    });

    assert.ok(sim.id, 'Simulation should have a unique ID');
    assert.strictEqual(sim.status, 'RUNNING');
    assert.strictEqual(sim.current_round, 1);
    assert.strictEqual(sim.max_rounds, 5);
    assert.strictEqual(sim.agents.length, 2);

    // Messages should include: 1 ORCHESTRATOR welcome status + 1 AGENT opening offer
    assert.ok(sim.messages.length >= 2, 'Should have at least 2 messages logged');
    assert.strictEqual(sim.messages[0].sender_type, 'ORCHESTRATOR');
    assert.strictEqual(sim.messages[1].sender_type, 'AGENT');
    assert.strictEqual(sim.messages[1].sender_role, sim.agents[0].role);

    // Initial offer recorded
    assert.ok(sim.offers.length >= 1, 'Should record opening offer');
    assert.strictEqual(sim.offers[0].agent_role, sim.agents[0].role);
  });

  await test('3. determineNextTurn handles bilateral (2-agent) alternation correctly', async () => {
    const orchestrator = new OrchestratorAgent();
    const mockSim = {
      current_round: 1,
      agents: [
        { role: 'Buyer', name: 'Buyer 1' },
        { role: 'Seller', name: 'Seller 1' },
      ],
      messages: [
        { round_number: 1, sender_type: 'ORCHESTRATOR', message: 'Welcome' },
        { round_number: 1, sender_type: 'AGENT', sender_role: 'Buyer', message: 'Offer 1' },
      ],
    };

    // After 1 agent turn, next speaker must be Agent 1 (Seller)
    const turn1 = orchestrator.determineNextTurn(mockSim);
    assert.strictEqual(turn1.activeAgent.role, 'Seller');
    assert.strictEqual(turn1.counterpartAgent.role, 'Buyer');
    assert.strictEqual(turn1.isRoundEnd, true, 'Turn 2 of 2 finishes Round 1');

    // Simulate Seller having spoken
    mockSim.messages.push({ round_number: 1, sender_type: 'AGENT', sender_role: 'Seller', message: 'Counter 1' });
    mockSim.current_round = 2; // Advancing to Round 2

    // Round 2 start: turnsCount = 0 for round 2
    const turn2 = orchestrator.determineNextTurn(mockSim);
    assert.strictEqual(turn2.activeAgent.role, 'Buyer');
    assert.strictEqual(turn2.isRoundEnd, false);
  });

  await test('4. determineNextTurn handles multilateral (3-agent) circular round-robin correctly', async () => {
    const orchestrator = new OrchestratorAgent();
    const mockSim3 = {
      current_round: 1,
      agents: [
        { role: 'Engineering Lead' },
        { role: 'Marketing Lead' },
        { role: 'Product AI Lead' },
      ],
      messages: [
        { round_number: 1, sender_type: 'AGENT', sender_role: 'Engineering Lead' },
      ],
    };

    // Turn 2 in round 1 -> Marketing Lead
    const turn2 = orchestrator.determineNextTurn(mockSim3);
    assert.strictEqual(turn2.activeAgent.role, 'Marketing Lead');
    assert.strictEqual(turn2.isRoundEnd, false);

    // Add turn 2
    mockSim3.messages.push({ round_number: 1, sender_type: 'AGENT', sender_role: 'Marketing Lead' });

    // Turn 3 in round 1 -> Product AI Lead
    const turn3 = orchestrator.determineNextTurn(mockSim3);
    assert.strictEqual(turn3.activeAgent.role, 'Product AI Lead');
    assert.strictEqual(turn3.isRoundEnd, true, 'Turn 3 of 3 completes round for 3 agents');
  });

  await test('5. advanceStep advances turn, records move, and updates metrics', async () => {
    const sim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 5,
    });

    const initialMessagesCount = sim.messages.length;
    const stepResult = await orchestratorService.advanceStep(sim.id);

    assert.strictEqual(stepResult.advanced, true);
    assert.strictEqual(stepResult.turnTakenBy, 'Seller'); // Since Buyer made opening move

    const updatedSim = await db.getSimulation(sim.id);
    assert.strictEqual(updatedSim.messages.length, initialMessagesCount + 2); // 1 Agent move + 1 Orchestrator round advancement announcement
    assert.strictEqual(updatedSim.current_round, 2); // Round 1 concluded, moved to Round 2
  });

  await test('6. evaluateStoppingConditions detects explicit ACCEPT and gap convergence', async () => {
    const orchestrator = new OrchestratorAgent();

    // Explicit ACCEPT
    const acceptEval = orchestrator.evaluateStoppingConditions({
      action: 'ACCEPT',
      agreementReached: true,
      currentGap: 100,
      threshold: 50,
      currentRound: 3,
      maxRounds: 10,
      isRoundEnd: false,
      settlementPrice: 10000,
      activeAgent: { role: 'Buyer' },
    });
    assert.strictEqual(acceptEval.shouldStop, true);
    assert.strictEqual(acceptEval.finalStatus, 'COMPLETED');
    assert.strictEqual(acceptEval.agreedValue, 10000);

    // Gap Convergence within threshold
    const gapEval = orchestrator.evaluateStoppingConditions({
      action: 'COUNTER_OFFER',
      agreementReached: false,
      currentGap: 30, // <= threshold 50
      threshold: 50,
      currentRound: 3,
      maxRounds: 10,
      isRoundEnd: false,
      settlementPrice: 9800,
      activeAgent: { role: 'Seller' },
      bothHaveOffered: true,
    });
    assert.strictEqual(gapEval.shouldStop, true);
    assert.strictEqual(gapEval.finalStatus, 'COMPLETED');
  });

  await test('7. evaluateStoppingConditions detects REJECT and max round deadlock', async () => {
    const orchestrator = new OrchestratorAgent();

    // Breakdown via REJECT
    const rejectEval = orchestrator.evaluateStoppingConditions({
      action: 'REJECT',
      agreementReached: false,
      currentGap: 3000,
      threshold: 50,
      currentRound: 2,
      maxRounds: 5,
      isRoundEnd: false,
      settlementPrice: 8000,
      activeAgent: { role: 'Vendor' },
    });
    assert.strictEqual(rejectEval.shouldStop, true);
    assert.strictEqual(rejectEval.finalStatus, 'DEADLOCK');

    // Max rounds limit reached at round end
    const maxRoundEval = orchestrator.evaluateStoppingConditions({
      action: 'COUNTER_OFFER',
      agreementReached: false,
      currentGap: 1500,
      threshold: 50,
      currentRound: 5,
      maxRounds: 5,
      isRoundEnd: true,
      settlementPrice: 8500,
      activeAgent: { role: 'Seller' },
    });
    assert.strictEqual(maxRoundEval.shouldStop, true);
    assert.strictEqual(maxRoundEval.finalStatus, 'DEADLOCK');
  });
  await test('11. Detects repeated identical offers', async () => {
  const orchestrator = new OrchestratorAgent();

  const result = orchestrator.detectDeadlock({
    messages: [
      { sender_type: 'AGENT', sender_role: 'Buyer', offer_value: 90000 },
      { sender_type: 'AGENT', sender_role: 'Seller', offer_value: 110000 },
      { sender_type: 'AGENT', sender_role: 'Buyer', offer_value: 90000 },
      { sender_type: 'AGENT', sender_role: 'Buyer', offer_value: 90000 },
    ],
  });

  assert.strictEqual(result.detected, true);
  assert.strictEqual(result.type, 'UNCHANGED_OFFERS');
});

await test('12. Detects repeated rejections', async () => {
  const orchestrator = new OrchestratorAgent();

  const result = orchestrator.detectDeadlock({
    messages: [
      { sender_type: 'AGENT', action: 'REJECT' },
      { sender_type: 'HUMAN', action: 'REJECT' },
      { sender_type: 'AGENT', action: 'REJECT' },
    ],
  });

  assert.strictEqual(result.detected, true);
  assert.strictEqual(result.type, 'REPEATED_REJECTIONS');
});
await test('13. Compromise proposal is attempted before final deadlock', async () => {
  const sim = await orchestratorService.initializeSimulation({
    scenarioId: 'vendor-pricing',
    maxRounds: 10,
    customAgents: [
      {
        id: 'buyer-procurement',
        personality: 'Human',
        is_human: true,
      },
      {
        id: 'vendor-sales',
        personality: 'Human',
        is_human: true,
      },
    ],
  });

  // Repeat the same offers from both participants
  for (let i = 0; i < 6; i++) {
    const offerValue = i % 2 === 0 ? 95000 : 110000;

    await orchestratorService.advanceStep(sim.id, {
      message: `My offer is ₹${offerValue}.`,
      offer_value: offerValue,
      action: 'COUNTER_OFFER',
    });
  }

  const finalSim = await db.getSimulation(sim.id);

  const compromiseMessage = finalSim.messages.find(
    (message) =>
      message.message?.includes('[DEADLOCK_COMPROMISE_ATTEMPTED]')
  );

  assert.ok(compromiseMessage, 'Compromise proposal should be recorded');
  assert.strictEqual(finalSim.status, 'DEADLOCK');
});

  await test('8. Pause, Resume, and End lifecycle controls work properly', async () => {
    const sim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 5,
    });

    const paused = await orchestratorService.pauseSimulation(sim.id);
    assert.strictEqual(paused.status, 'PAUSED');

    // Advancing while paused should be rejected
    const advanceWhilePaused = await orchestratorService.advanceStep(sim.id);
    assert.strictEqual(advanceWhilePaused.advanced, false);

    const resumed = await orchestratorService.resumeSimulation(sim.id);
    assert.strictEqual(resumed.status, 'RUNNING');

    const ended = await orchestratorService.endSimulation(sim.id, 'User test termination');
    assert.strictEqual(ended.status, 'COMPLETED');
  });

  await test('9. runFullSimulation executes turns until negotiation reaches conclusion', async () => {
    const sim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 6,
    });

    const fullRunResult = await orchestratorService.runFullSimulation(sim.id, 20);
    assert.ok(fullRunResult.stepsTaken > 0, 'Should have taken multiple steps');
    assert.ok(
      fullRunResult.simulation.status === 'COMPLETED' || fullRunResult.simulation.status === 'DEADLOCK',
      `Simulation status should be COMPLETED or DEADLOCK, was: ${fullRunResult.simulation.status}`
    );
  });

  await test('10. User-scoped isolation: simulations are correctly tagged with userEmail and filtered on listing', async () => {
    const userA = 'user_alpha@example.com';
    const userB = 'user_beta@example.com';

    const simA = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 4,
      userEmail: userA,
    });

    const simB = await orchestratorService.initializeSimulation({
      scenarioId: 'job-offer',
      maxRounds: 4,
      userEmail: userB,
    });

    assert.strictEqual(simA.user_email, userA);
    assert.strictEqual(simB.user_email, userB);

    const listA = await db.listSimulations({ userEmail: userA });
    const listB = await db.listSimulations({ userEmail: userB });

    assert.ok(listA.some(s => s.id === simA.id), 'listA should contain simA');
    assert.ok(!listA.some(s => s.id === simB.id), 'listA should NOT contain simB');

    assert.ok(listB.some(s => s.id === simB.id), 'listB should contain simB');
    assert.ok(!listB.some(s => s.id === simA.id), 'listB should NOT contain simA');
  });

  await test('14. Multilateral Project Budget: 3 agents negotiate without premature Round 1 agreement, and Practice Mode requires Human participation', async () => {
    // 1. Simulation Mode for project-budget has 3 agents and does not end in round 1
    const budgetSim = await orchestratorService.initializeSimulation({
      scenarioId: 'project-budget',
      maxRounds: 10,
    });

    assert.strictEqual(budgetSim.agents.length, 3, 'Project budget must have 3 participating agents');
    assert.strictEqual(budgetSim.status, 'RUNNING');
    assert.strictEqual(budgetSim.current_round, 1);

    // Turn 2 in round 1 (Marketing Lead)
    const turn2Result = await orchestratorService.advanceStep(budgetSim.id);
    assert.strictEqual(turn2Result.advanced, true);
    let currentSim = await db.getSimulation(budgetSim.id);
    assert.strictEqual(currentSim.status, 'RUNNING', 'Must NOT conclude after turn 2 in round 1');

    // Turn 3 in round 1 (Product AI Lead)
    const turn3Result = await orchestratorService.advanceStep(budgetSim.id);
    assert.strictEqual(turn3Result.advanced, true);
    currentSim = await db.getSimulation(budgetSim.id);
    assert.strictEqual(currentSim.status, 'RUNNING', 'Must NOT conclude at round 1 because demands start at ~₹1.1M');
    assert.strictEqual(currentSim.current_round, 2, 'Should cleanly advance to Round 2');

    // 2. Practice Mode with 3 agents: 2 AI and 1 Human
    const practiceAgents = [
      { id: 'head-product-ai', role: 'Product AI Lead', personality: 'Aggressive' },
      { id: 'cmo-marketing', role: 'Marketing Lead', personality: 'Aggressive' },
      { id: 'vp-engineering', role: 'Lead Software Engineer', personality: 'Human', is_human: true },
    ];

    const practiceSim = await orchestratorService.initializeSimulation({
      scenarioId: 'project-budget',
      maxRounds: 10,
      customAgents: practiceAgents,
    });

    assert.strictEqual(practiceSim.agents.length, 3);
    assert.strictEqual(practiceSim.status, 'RUNNING');

    // Turn 2 taken by second AI (Marketing Lead)
    const pTurn2 = await orchestratorService.advanceStep(practiceSim.id);
    assert.strictEqual(pTurn2.advanced, true);
    let pSimState = await db.getSimulation(practiceSim.id);
    assert.strictEqual(pSimState.status, 'RUNNING', 'AI vs AI must NOT conclude round 1 before Human turn');

    // Turn 3: Attempting automatic advanceStep must wait for Human
    const pTurn3Waiting = await orchestratorService.advanceStep(practiceSim.id);
    assert.strictEqual(pTurn3Waiting.waitingForHuman, true, 'Must wait for human player');

    // Human submits move with 3 values
    const pHumanMove = await orchestratorService.advanceStep(practiceSim.id, {
      message: 'Engineering requests 400000, Marketing 350000, Product 250000',
    });
    assert.strictEqual(pHumanMove.advanced, true);
  });

  await test('15. Universal Deadlock Resolution: Dynamic scenario-independent proposals across all 3 scenarios and Practice Mode actions', async () => {
    // A. Verify Compromise Proposal generation across all 3 scenarios
    const vendorSim = { scenario_id: 'vendor-pricing', agents: [{ role: 'Buyer', current_offer: 95000 }, { role: 'Seller', current_offer: 110000 }] };
    const jobSim = { scenario_id: 'job-offer', agents: [{ role: 'Recruiter', current_offer: 155000 }, { role: 'Candidate', current_offer: 175000 }] };
    const budgetSim = { scenario_id: 'project-budget', agents: [{ role: 'Engineering Lead' }, { role: 'Marketing Lead' }, { role: 'Product AI Lead' }] };

    const vendorProposal = orchestratorService.generateCompromiseProposal(vendorSim);
    assert.ok(vendorProposal.detailed_terms.unitPrice, 'Vendor proposal must formulate unit price');
    assert.ok(vendorProposal.detailed_terms.payment_terms.includes('Net-45'), 'Vendor proposal must formulate Net-45 payment terms');

    const jobProposal = orchestratorService.generateCompromiseProposal(jobSim);
    assert.ok(jobProposal.detailed_terms.baseSalary, 'Job proposal must formulate base salary');
    assert.ok(jobProposal.detailed_terms.work_arrangement.includes('Hybrid'), 'Job proposal must formulate hybrid work arrangement');

    const budgetProposal = orchestratorService.generateCompromiseProposal(budgetSim);
    assert.strictEqual(budgetProposal.detailed_terms.total, 1000000, 'Budget proposal must sum strictly to ₹10,00,000');
    assert.strictEqual(budgetProposal.detailed_terms.engineering + budgetProposal.detailed_terms.marketing + budgetProposal.detailed_terms.product, 1000000);

    // B. Practice Mode Deadlock Actions (ACCEPT, REJECT, COUNTER-OFFER with max 2 attempts)
    const practiceDeadlockSim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 10,
      customAgents: [
        { id: 'seller-rep', role: 'Sales Account Executive', personality: 'Aggressive' },
        { id: 'buyer-user', role: 'Procurement Director', personality: 'Human', is_human: true },
      ],
    });

    // Initiate deadlock resolution manually
    await orchestratorService.initiateDeadlockResolution(practiceDeadlockSim.id, {
      reason: 'Repeated stubborn positions',
      type: 'UNCHANGED_OFFERS',
    });

    let currentSim = await db.getSimulation(practiceDeadlockSim.id);
    assert.strictEqual(currentSim.deadlock_resolution.active, true);
    assert.strictEqual(currentSim.deadlock_resolution.counter_offer_attempts, 0);

    // Counter-Offer Attempt 1 (declined by AI because ₹85,000 is too far from compromise)
    const counter1Result = await orchestratorService.handleDeadlockAction(practiceDeadlockSim.id, {
      action: 'COUNTER_OFFER',
      offer_value: 85000,
      sender_role: 'Procurement Director',
      message: 'Counter-offer 1: Proposing ₹85,000',
    });
    assert.strictEqual(counter1Result.deadlockResolution.counter_offer_attempts, 1);
    assert.strictEqual(counter1Result.simulation.status, 'RUNNING');

    // Counter-Offer Attempt 2 (declined by AI -> max attempts exhausted -> concludes with DEADLOCK)
    const counter2Result = await orchestratorService.handleDeadlockAction(practiceDeadlockSim.id, {
      action: 'COUNTER_OFFER',
      offer_value: 86000,
      sender_role: 'Procurement Director',
      message: 'Counter-offer 2: Proposing ₹86,000',
    });
    assert.strictEqual(counter2Result.deadlockResolution.counter_offer_attempts, 2);
    assert.strictEqual(counter2Result.simulation.status, 'DEADLOCK');

    // Attempt 3 must be strictly blocked (max 2 counter-offers rule)
    let attempt3Blocked = false;
    try {
      await orchestratorService.handleDeadlockAction(practiceDeadlockSim.id, {
        action: 'COUNTER_OFFER',
        offer_value: 101500,
        sender_role: 'Procurement Director',
        message: 'Attempt 3',
      });
    } catch (err) {
      attempt3Blocked = true;
      assert.ok(err.message.toLowerCase().includes('maximum') && err.message.includes('2'));
    }
    assert.strictEqual(attempt3Blocked, true, '3rd counter-offer must be rejected');

    // Accept action concludes in AGREEMENT_REACHED
    const acceptSim = await orchestratorService.initializeSimulation({
      scenarioId: 'job-offer',
      maxRounds: 10,
      customAgents: [
        { id: 'recruiter', role: 'Hiring Director', personality: 'Collaborative' },
        { id: 'candidate', role: 'Job Candidate', personality: 'Human', is_human: true },
      ],
    });
    await orchestratorService.initiateDeadlockResolution(acceptSim.id, { reason: 'Impasse' });
    const acceptResult = await orchestratorService.handleDeadlockAction(acceptSim.id, {
      action: 'ACCEPT',
      sender_role: 'Job Candidate',
      message: 'I accept the compromise offer',
    });
    assert.strictEqual(acceptResult.simulation.status, 'AGREEMENT_REACHED');
    assert.strictEqual(acceptResult.deadlockResolution.active, false);
    assert.strictEqual(acceptResult.deadlockResolution.final_outcome, 'AGREEMENT_REACHED');
  });

  await test('16. Universal Deadlock Resolution: Fully automated AI resolution in Simulation Mode', async () => {
    const aiSim = await orchestratorService.initializeSimulation({
      scenarioId: 'vendor-pricing',
      maxRounds: 10,
      customAgents: [
        { id: 'buyer', role: 'Buyer', personality: 'Collaborative' },
        { id: 'seller', role: 'Seller', personality: 'Collaborative' },
      ],
    });

    const result = await orchestratorService.initiateDeadlockResolution(aiSim.id, {
      reason: 'AI stagnation',
      type: 'UNCHANGED_OFFERS',
    });

    assert.strictEqual(result.status, 'AGREEMENT_REACHED', 'AI agents in simulation mode should automatically evaluate and conclude');
    assert.strictEqual(result.deadlock_resolution.final_outcome, 'AGREEMENT_REACHED');
    assert.strictEqual(result.deadlock_resolution.active, false);
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Execute when run directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Test suite failed unexpectedly:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
