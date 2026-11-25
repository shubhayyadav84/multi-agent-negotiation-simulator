/**
 * Centralized Configuration Validator
 *
 * Implements centralized validation mechanisms to verify the selected negotiation scenario
 * and participating agent configurations before launching the Orchestrator Agent and
 * entering the Negotiation Arena.
 *
 * Reusable, pure, and independent of React or any UI components.
 */

import {
  SCENARIOS,
  SUPPORTED_PERSONALITIES,
  getScenarioById,
} from '../data/scenarios.js';

/**
 * Standard supported personality types
 */
export const VALID_PERSONALITIES = SUPPORTED_PERSONALITIES;

/**
 * Validates a negotiation scenario and its associated agent configurations.
 *
 * @param {string | object | null | undefined} scenarioInput - Scenario ID string or scenario object
 * @param {Record<string, string> | Array<object>} agentPersonalities - Map of agentId -> personality or array of agent configs
 * @param {object} [options={}] - Optional validation settings (e.g. { mode: 'simulation' })
 * @returns {{
 *   isValid: boolean,
 *   errors: string[],
 *   fieldErrors: Record<string, string>,
 *   validatedConfig: object | null
 * }}
 */
export function validateNegotiationConfig(scenarioInput, agentPersonalities = {}, options = {}) {
  const errors = [];
  const fieldErrors = {};

  // 1. Scenario Selection Validation
  if (!scenarioInput) {
    const msg = 'Please select a negotiation scenario.';
    errors.push(msg);
    fieldErrors.scenario = msg;
    return {
      isValid: false,
      errors,
      fieldErrors,
      validatedConfig: null,
    };
  }

  // Resolve canonical scenario template
  let scenario = null;
  let scenarioId = null;

  if (typeof scenarioInput === 'string') {
    scenarioId = scenarioInput.trim();
    if (!scenarioId) {
      const msg = 'Please select a negotiation scenario.';
      errors.push(msg);
      fieldErrors.scenario = msg;
      return {
        isValid: false,
        errors,
        fieldErrors,
        validatedConfig: null,
      };
    }
    scenario = getScenarioById(scenarioId);
  } else if (typeof scenarioInput === 'object') {
    scenarioId = scenarioInput.id;
    // Cross-reference with canonical templates to guarantee template integrity
    scenario = scenarioId ? getScenarioById(scenarioId) : null;
    // If not found in registered scenarios, evaluate if it's a valid standalone object
    if (!scenario && scenarioInput.name && Array.isArray(scenarioInput.agents)) {
      scenario = scenarioInput;
    }
  }

  if (!scenario || !scenarioId) {
    const msg = 'The selected scenario could not be found.';
    errors.push(msg);
    fieldErrors.scenario = msg;
    return {
      isValid: false,
      errors,
      fieldErrors,
      validatedConfig: null,
    };
  }

  // Verify scenario required metadata
  const scenarioName = scenario.name?.trim();
  const scenarioDesc = (scenario.description || scenario.shortDescription || scenario.context)?.trim();

  if (!scenarioName || !scenarioDesc) {
    const msg = 'Selected scenario is missing a valid name or description.';
    errors.push(msg);
    fieldErrors.scenarioDetails = msg;
  }

  // Verify scenario agents collection
  if (!Array.isArray(scenario.agents) || scenario.agents.length === 0) {
    const msg = 'The selected scenario does not contain any participating agents.';
    errors.push(msg);
    fieldErrors.scenarioAgents = msg;
    return {
      isValid: false,
      errors,
      fieldErrors,
      validatedConfig: null,
    };
  }

  // Normalize agentPersonalities input into a lookup map
  const personalityMap = {};
  const customConfiguredAgentIds = new Set();

  if (Array.isArray(agentPersonalities)) {
    // Array of configured agent objects [{ id, personality, ... }]
    for (const item of agentPersonalities) {
      if (item && item.id) {
        personalityMap[item.id] = item.personality || item.defaultPersonality;
        customConfiguredAgentIds.add(item.id);
      }
    }
  } else if (agentPersonalities && typeof agentPersonalities === 'object') {
    // Key-value map: { [agentId]: personality }
    for (const [key, val] of Object.entries(agentPersonalities)) {
      if (val !== undefined && val !== null) {
        personalityMap[key] = val;
        customConfiguredAgentIds.add(key);
      }
    }
  }

  const validAgentIds = new Set(scenario.agents.map((a) => a.id));

  // 2. Scenario-to-Agent Consistency (detect agents from unrelated scenarios)
  for (const configuredId of customConfiguredAgentIds) {
    if (!validAgentIds.has(configuredId)) {
      const msg = `The selected agent does not belong to this scenario: "${configuredId}".`;
      errors.push(msg);
      fieldErrors[`agent_${configuredId}`] = msg;
    }
  }

  // 3. Validate Each Required Scenario Agent
  const validatedAgents = [];

  for (const agent of scenario.agents) {
    const agentDisplayName = agent.name || agent.role || agent.id || 'Agent';

    // Unique agent ID
    if (!agent.id || typeof agent.id !== 'string') {
      const msg = `An agent in scenario "${scenarioName}" is missing a valid unique ID.`;
      errors.push(msg);
      fieldErrors[`agent_missing_id`] = msg;
      continue;
    }

    // Role
    const role = (agent.role || agent.name)?.trim();
    if (!role) {
      const msg = `The ${agentDisplayName} is missing a role.`;
      errors.push(msg);
      fieldErrors[`agent_${agent.id}_role`] = msg;
    }

    // Role description
    const roleDesc = agent.roleDescription?.trim();
    if (!roleDesc) {
      const msg = `The ${agentDisplayName} is missing a role description.`;
      errors.push(msg);
      fieldErrors[`agent_${agent.id}_roleDescription`] = msg;
    }

    // Primary goal
    const goal = (agent.primaryGoal || agent.goal)?.trim();
    if (!goal) {
      const msg = `The ${agentDisplayName} is missing a primary goal.`;
      errors.push(msg);
      fieldErrors[`agent_${agent.id}_goal`] = msg;
    }

    // Constraints
    const hasRawConstraints = Array.isArray(agent.constraints) && agent.constraints.length > 0;
    const hasKeyConstraints = Array.isArray(agent.keyConstraints) && agent.keyConstraints.length > 0;
    if (!hasRawConstraints && !hasKeyConstraints) {
      const msg = `The ${agentDisplayName} is missing required constraints.`;
      errors.push(msg);
      fieldErrors[`agent_${agent.id}_constraints`] = msg;
    }

    // Personality validation
    const selectedPersonality = personalityMap[agent.id] || agent.defaultPersonality;
    if (!selectedPersonality || !VALID_PERSONALITIES.includes(selectedPersonality)) {
      const msg = `Select a valid personality for the ${agentDisplayName}.`;
      errors.push(msg);
      fieldErrors[`agent_${agent.id}_personality`] = msg;
    }

    // Build configured agent record without mutating canonical template
    const isOverridden = Boolean(personalityMap[agent.id] && personalityMap[agent.id] !== agent.defaultPersonality);

    validatedAgents.push({
      id: agent.id,
      name: agent.name || role,
      role: role,
      roleDescription: roleDesc,
      stakeholder: agent.stakeholder || null,
      avatarText: agent.avatarText || null,
      primaryGoal: goal,
      goal: goal,
      constraints: agent.constraints ? structuredClone(agent.constraints) : [],
      keyConstraints: agent.keyConstraints ? [...agent.keyConstraints] : [],
      objectives: agent.objectives ? structuredClone(agent.objectives) : [],
      personality: selectedPersonality,
      defaultPersonality: agent.defaultPersonality,
      isCustomPersonality: isOverridden,
    });
  }

  // Check if any required scenario agents are missing when input is an explicit agent array
  if (Array.isArray(agentPersonalities) && agentPersonalities.length > 0) {
    for (const agent of scenario.agents) {
      if (!customConfiguredAgentIds.has(agent.id)) {
        const msg = `The configuration is missing a required agent: "${agent.name || agent.id}".`;
        errors.push(msg);
        fieldErrors[`agent_${agent.id}_missing`] = msg;
      }
    }
  }

  const isValid = errors.length === 0;

  // 4. Construct Structured Downstream Configuration Payload
  let validatedConfig = null;
  if (isValid) {
    validatedConfig = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      mode: options.mode || 'simulation',
      timestamp: new Date().toISOString(),
      scenario: {
        id: scenario.id,
        name: scenario.name,
        category: scenario.category || null,
        description: scenario.description || scenario.shortDescription || null,
        context: scenario.context || scenario.detailedDescription || null,
        topics: scenario.topics ? structuredClone(scenario.topics) : [],
        parameters: scenario.parameters ? structuredClone(scenario.parameters) : {},
        estimatedRounds: scenario.estimatedRounds || null,
        complexity: scenario.complexity || null,
        agents: validatedAgents,
      },
      agents: validatedAgents,
    };
  }

  return {
    isValid,
    errors,
    fieldErrors,
    validatedConfig,
  };
}

/**
 * Prepares the downstream configuration object after full validation.
 * Throws a formatted Error if the configuration is invalid.
 *
 * @param {string | object} scenarioInput
 * @param {Record<string, string> | Array<object>} [agentPersonalities={}]
 * @param {object} [options={}]
 * @returns {object} The validated downstream configuration object
 * @throws {Error} If configuration fails validation
 */
export function prepareNegotiationConfig(scenarioInput, agentPersonalities = {}, options = {}) {
  const result = validateNegotiationConfig(scenarioInput, agentPersonalities, options);
  if (!result.isValid) {
    const errorMsg = result.errors.join(' ');
    const err = new Error(`Configuration validation failed: ${errorMsg}`);
    err.validationErrors = result.errors;
    err.fieldErrors = result.fieldErrors;
    throw err;
  }
  return result.validatedConfig;
}

export default validateNegotiationConfig;
