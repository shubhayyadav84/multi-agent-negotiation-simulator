import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNegotiationConfig,
  prepareNegotiationConfig,
  VALID_PERSONALITIES,
} from '../src/utils/configurationValidator.js';
import SCENARIOS, {
  getScenarioById,
  SUPPORTED_PERSONALITIES,
} from '../src/data/scenarios.js';

test('1. Valid Vendor Pricing Negotiation configuration', () => {
  const result = validateNegotiationConfig('vendor-pricing');
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.fieldErrors, {});
  assert.ok(result.validatedConfig);
  assert.equal(result.validatedConfig.scenarioId, 'vendor-pricing');
  assert.equal(result.validatedConfig.scenarioName, 'Vendor Pricing Negotiation');
  assert.equal(result.validatedConfig.agents.length, 2);
  assert.equal(result.validatedConfig.mode, 'simulation');

  // Verify agents in payload
  const buyer = result.validatedConfig.agents.find((a) => a.id === 'buyer-procurement');
  const vendor = result.validatedConfig.agents.find((a) => a.id === 'vendor-sales');
  assert.ok(buyer);
  assert.ok(vendor);
  assert.equal(buyer.personality, 'Collaborative');
  assert.equal(vendor.personality, 'Aggressive');
  assert.equal(buyer.isCustomPersonality, false);
});

test('2. Valid Job Offer Negotiation configuration', () => {
  const result = validateNegotiationConfig('job-offer');
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.validatedConfig);
  assert.equal(result.validatedConfig.scenarioId, 'job-offer');
  assert.equal(result.validatedConfig.scenarioName, 'Job Offer Negotiation');
  assert.equal(result.validatedConfig.agents.length, 2);

  const candidate = result.validatedConfig.agents.find((a) => a.id === 'job-candidate');
  const employer = result.validatedConfig.agents.find((a) => a.id === 'hiring-director');
  assert.ok(candidate);
  assert.ok(employer);
  assert.equal(candidate.personality, 'Collaborative');
  assert.equal(employer.personality, 'Risk-Averse');
});

test('3. Valid Project Budget Allocation configuration', () => {
  const result = validateNegotiationConfig('project-budget');
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.validatedConfig);
  assert.equal(result.validatedConfig.scenarioId, 'project-budget');
  assert.equal(result.validatedConfig.agents.length, 3);
});

test('4. No scenario selected is rejected with actionable error message', () => {
  const nullResult = validateNegotiationConfig(null);
  assert.equal(nullResult.isValid, false);
  assert.equal(nullResult.validatedConfig, null);
  assert.ok(nullResult.errors.includes('Please select a negotiation scenario.'));
  assert.equal(nullResult.fieldErrors.scenario, 'Please select a negotiation scenario.');

  const undefinedResult = validateNegotiationConfig(undefined);
  assert.equal(undefinedResult.isValid, false);
  assert.ok(undefinedResult.errors.includes('Please select a negotiation scenario.'));

  const emptyResult = validateNegotiationConfig('');
  assert.equal(emptyResult.isValid, false);
  assert.ok(emptyResult.errors.includes('Please select a negotiation scenario.'));
});

test('5. Unknown scenario ID is rejected', () => {
  const result = validateNegotiationConfig('non-existent-scenario');
  assert.equal(result.isValid, false);
  assert.equal(result.validatedConfig, null);
  assert.ok(result.errors.includes('The selected scenario could not be found.'));
  assert.equal(result.fieldErrors.scenario, 'The selected scenario could not be found.');
});

test('6. Missing required agent is rejected when explicit agent list is supplied', () => {
  // Scenario vendor-pricing expects 2 agents: buyer-procurement and vendor-sales
  const incompleteAgents = [
    { id: 'buyer-procurement', personality: 'Collaborative' },
  ];
  const result = validateNegotiationConfig('vendor-pricing', incompleteAgents);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('missing a required agent')));
  assert.ok(result.fieldErrors['agent_vendor-sales_missing']);
});

test('7. Agent from an unrelated scenario is rejected', () => {
  // Passing 'job-candidate' (from job-offer) into 'vendor-pricing'
  const roguePersonalities = {
    'buyer-procurement': 'Collaborative',
    'vendor-sales': 'Aggressive',
    'job-candidate': 'Collaborative',
  };
  const result = validateNegotiationConfig('vendor-pricing', roguePersonalities);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('does not belong to this scenario: "job-candidate"')));
  assert.ok(result.fieldErrors['agent_job-candidate']);
});

test('8. Missing primary goal is detected', () => {
  const scenarioWithoutGoal = {
    id: 'custom-scenario',
    name: 'Custom Test Scenario',
    description: 'A test scenario description',
    agents: [
      {
        id: 'agent-1',
        name: 'Agent One',
        role: 'Purchaser',
        roleDescription: 'Handles purchases',
        primaryGoal: '', // Missing
        constraints: [{ id: 'c1', type: 'budget_limit', description: 'Budget limit' }],
        defaultPersonality: 'Collaborative',
      },
    ],
  };

  const result = validateNegotiationConfig(scenarioWithoutGoal);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('missing a primary goal')));
  assert.ok(result.fieldErrors['agent_agent-1_goal']);
});

test('9. Missing required constraints is detected', () => {
  const scenarioWithoutConstraints = {
    id: 'custom-scenario-2',
    name: 'Custom Test Scenario 2',
    description: 'A test scenario description',
    agents: [
      {
        id: 'agent-1',
        name: 'Agent One',
        role: 'Purchaser',
        roleDescription: 'Handles purchases',
        primaryGoal: 'Achieve minimum cost',
        constraints: [], // Empty
        keyConstraints: [], // Empty
        defaultPersonality: 'Collaborative',
      },
    ],
  };

  const result = validateNegotiationConfig(scenarioWithoutConstraints);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('missing required constraints')));
  assert.ok(result.fieldErrors['agent_agent-1_constraints']);
});

test('10. Invalid personality is rejected; valid personalities are accepted', () => {
  const invalidResult = validateNegotiationConfig('vendor-pricing', {
    'buyer-procurement': 'UnreasonableAggressive',
  });
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.some((e) => e.includes('Select a valid personality for the')));
  assert.ok(invalidResult.fieldErrors['agent_buyer-procurement_personality']);

  // All 3 supported personalities should be accepted
  for (const personality of SUPPORTED_PERSONALITIES) {
    const valid = validateNegotiationConfig('vendor-pricing', {
      'buyer-procurement': personality,
    });
    assert.equal(valid.isValid, true, `Expected personality ${personality} to be valid`);
  }
});

test('11. Valid configuration with a modified agent personality', () => {
  // Override buyer from Collaborative to Aggressive
  const result = validateNegotiationConfig('vendor-pricing', {
    'buyer-procurement': 'Aggressive',
  });
  assert.equal(result.isValid, true);
  assert.equal(result.errors.length, 0);

  const buyer = result.validatedConfig.agents.find((a) => a.id === 'buyer-procurement');
  assert.equal(buyer.personality, 'Aggressive');
  assert.equal(buyer.defaultPersonality, 'Collaborative');
  assert.equal(buyer.isCustomPersonality, true);

  const vendor = result.validatedConfig.agents.find((a) => a.id === 'vendor-sales');
  assert.equal(vendor.personality, 'Aggressive');
  assert.equal(vendor.isCustomPersonality, false);
});

test('12. Configuration with unchanged original scenario templates', () => {
  const beforeClone = structuredClone(SCENARIOS);

  // Validate multiple times with custom overrides
  validateNegotiationConfig('vendor-pricing', { 'buyer-procurement': 'Risk-Averse' });
  validateNegotiationConfig('job-offer', { 'job-candidate': 'Aggressive' });
  validateNegotiationConfig('project-budget', { 'dept-a-rep': 'Collaborative' });

  // Original scenario templates must remain strictly identical and frozen
  assert.deepEqual(SCENARIOS, beforeClone);
  assert.ok(Object.isFrozen(SCENARIOS));
  assert.ok(Object.isFrozen(SCENARIOS[0]));
});

test('13. prepareNegotiationConfig returns valid payload or throws on error', () => {
  const valid = prepareNegotiationConfig('job-offer', { 'hiring-director': 'Collaborative' });
  assert.ok(valid);
  assert.equal(valid.scenarioId, 'job-offer');
  assert.equal(valid.agents.find((a) => a.id === 'hiring-director').personality, 'Collaborative');

  assert.throws(
    () => {
      prepareNegotiationConfig(null);
    },
    /Configuration validation failed: Please select a negotiation scenario./
  );

  assert.throws(
    () => {
      prepareNegotiationConfig('vendor-pricing', { 'buyer-procurement': 'FakePersonality' });
    },
    /Configuration validation failed/
  );
});
