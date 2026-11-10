import test from 'node:test';
import assert from 'node:assert/strict';
import SCENARIOS, {
  SUPPORTED_PERSONALITIES,
  CONSTRAINT_TYPES,
  PERSONALITY_DESCRIPTIONS,
  getAllScenarios,
  getScenarioById,
  getAgentById,
} from '../src/data/scenarios.js';
 
const REQUIRED_SCENARIO = ['id', 'name', 'description', 'context', 'topics', 'constraints', 'parameters', 'agents'];
const REQUIRED_AGENT = ['id', 'name', 'role', 'roleDescription', 'primaryGoal', 'objectives', 'constraints', 'defaultPersonality'];
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
 
test('three scenarios with unique ids are importable', () => {
  assert.equal(SCENARIOS.length, 3);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, 3);
  assert.deepEqual(SCENARIOS.map((s) => s.id), ['vendor-pricing', 'job-offer', 'project-budget']);
});
 
test('required fields present and non-empty', () => {
  for (const s of SCENARIOS) {
    for (const f of REQUIRED_SCENARIO) assert.ok(f in s, `${s.id} missing ${f}`);
    assert.ok(nonEmpty(s.name) && nonEmpty(s.description) && nonEmpty(s.context));
    assert.ok(s.topics.length >= 4);
    assert.equal(s.agents.length, s.participantCount);
    for (const a of s.agents) {
      for (const f of REQUIRED_AGENT) assert.ok(f in a, `${s.id}/${a.id} missing ${f}`);
      assert.ok(nonEmpty(a.role) && nonEmpty(a.roleDescription) && nonEmpty(a.primaryGoal));
      assert.ok(a.constraints.length > 0 && a.objectives.length > 0);
    }
  }
});
 
test('agent ids unique within scenario; topic and constraint ids unique', () => {
  for (const s of SCENARIOS) {
    assert.equal(new Set(s.agents.map((a) => a.id)).size, s.agents.length);
    assert.equal(new Set(s.topics.map((t) => t.id)).size, s.topics.length);
    for (const a of s.agents) {
      assert.equal(new Set(a.constraints.map((c) => c.id)).size, a.constraints.length);
    }
  }
});
 
test('default personalities are valid; all three are represented', () => {
  const used = new Set();
  for (const s of SCENARIOS) {
    for (const a of s.agents) {
      assert.ok(SUPPORTED_PERSONALITIES.includes(a.defaultPersonality), `${a.id}`);
      assert.equal(a.personality, null);
      used.add(a.defaultPersonality);
    }
  }
  assert.deepEqual([...used].sort(), [...SUPPORTED_PERSONALITIES].sort());
});
 
test('constraints reference existing parameters and valid types', () => {
  const types = Object.values(CONSTRAINT_TYPES);
  for (const s of SCENARIOS) {
    const all = [...s.constraints, ...s.agents.flatMap((a) => a.constraints)];
    for (const c of all) {
      assert.ok(types.includes(c.type), c.id);
      assert.ok(nonEmpty(c.description));
      if (c.parameterKey !== null) {
        assert.ok(c.parameterKey in s.parameters, `${s.id}: ${c.id} -> ${c.parameterKey}`);
        assert.ok(['lte', 'gte'].includes(c.operator));
      }
    }
    for (const p of Object.values(s.parameters)) assert.equal(p.isSample, true);
  }
});
 
test('sample values admit a feasible agreement', () => {
  const p = (id) => getScenarioById(id).parameters;
  const v = p('vendor-pricing');
  const price = v.vendorMinUnitPrice.value;
  assert.ok(v.vendorMinUnitPrice.value <= v.buyerMaxUnitPrice.value);
  assert.ok(v.vendorMinUnitPrice.value > v.vendorUnitCost.value);
  assert.ok(price * v.sampleOrderQuantity.value <= v.buyerMaxTotalBudget.value);
  assert.ok(v.vendorMinLeadTimeDays.value <= v.buyerMaxDeliveryDays.value);
  assert.ok(v.sampleOrderQuantity.value <= v.vendorMaxOrderQuantity.value);
 
  const j = p('job-offer');
  assert.ok(j.candidateMinSalary.value <= j.employerMaxSalary.value);
  assert.ok(j.candidateEarliestJoiningDays.value <= j.employerLatestJoiningDays.value);
  assert.ok(j.candidateMinRemoteDays.value <= j.employerMaxRemoteDays.value);
  assert.ok(j.candidateMinSalary.value <= j.candidateTargetSalary.value);
 
  const b = p('project-budget');
  assert.ok(b.deptAMinOperationalFunding.value + b.deptBMinOperationalFunding.value + (b.deptCMinOperationalFunding?.value || 0) <= b.totalBudget.value);
  assert.ok(b.deptAProjectCostEstimate.value + b.deptBProjectCostEstimate.value + (b.deptCProjectCostEstimate?.value || 0) > b.totalBudget.value);
  assert.ok(b.deptAMinSharedHours.value + b.deptBMinSharedHours.value <= b.sharedResourceHours.value);
  assert.ok(b.deptASharedHoursRequested.value + b.deptBSharedHoursRequested.value > b.sharedResourceHours.value);
  assert.ok(b.deptAMinOperationalFunding.value <= b.deptAProjectCostEstimate.value);
  assert.ok(b.deptBMinOperationalFunding.value <= b.deptBProjectCostEstimate.value);
});
 
test('agents have distinct goals; data is frozen; helpers work', () => {
  for (const s of SCENARIOS) {
    assert.notEqual(s.agents[0].primaryGoal, s.agents[1].primaryGoal);
  }
  assert.throws(() => { 'use strict'; SCENARIOS[0].name = 'x'; });
  const clone = structuredClone(SCENARIOS[0]);
  clone.agents[0].personality = 'Aggressive';
  assert.equal(SCENARIOS[0].agents[0].personality, null);
  assert.equal(getAgentById('job-offer', 'hiring-director').defaultPersonality, 'Risk-Averse');
  assert.equal(getScenarioById('nope'), null);
});
 
test('compatibility fields for existing UI modules are present', () => {
  assert.equal(getAllScenarios().length, 3);
  assert.deepEqual(Object.keys(PERSONALITY_DESCRIPTIONS).sort(), [...SUPPORTED_PERSONALITIES].sort());
  for (const s of SCENARIOS) {
    for (const f of ['category', 'iconName', 'accentColor', 'participantCount', 'keyLevers', 'estimatedRounds', 'complexity', 'shortDescription', 'detailedDescription']) {
      assert.ok(f in s, `${s.id} missing ${f}`);
    }
    assert.equal(s.participantCount, s.agents.length);
    for (const a of s.agents) {
      assert.ok(nonEmpty(a.stakeholder) && nonEmpty(a.avatarText));
      assert.deepEqual(a.availablePersonalities, [...SUPPORTED_PERSONALITIES]);
      assert.equal(a.keyConstraints.length, a.constraints.length);
    }
  }
  assert.match(getAgentById('vendor-pricing', 'buyer-procurement').keyConstraints[0], /110,000 USD/);
});