/**
 * Predefined negotiation scenarios and agent templates.
 *
 * Pure data + tiny read-only helpers. No UI or framework dependencies, so any
 * module (Scenario Selection, Agent Configuration, validation, orchestrator)
 * can import it. See docs/scenarios-data-structure.md for the data contract.
 *
 * IMPORTANT: every numeric value in `parameters` is an illustrative SAMPLE
 * value, not real business data. Constraints reference these values via
 * `parameterKey`, so changing a number in one place updates every constraint
 * that depends on it.
 *
 * Templates are deep-frozen. To customise (e.g. override a personality in the
 * Agent Configuration UI), clone first: `structuredClone(scenario)`.
 */
 
export const PERSONALITIES = Object.freeze({
  AGGRESSIVE: 'Aggressive',
  COLLABORATIVE: 'Collaborative',
  RISK_AVERSE: 'Risk-Averse',
});
 
export const SUPPORTED_PERSONALITIES = Object.freeze(Object.values(PERSONALITIES));
 
export const PERSONALITY_DESCRIPTIONS = Object.freeze({
  [PERSONALITIES.AGGRESSIVE]:
    'Firm on opening positions, makes minimal concessions, presses for maximum value, and challenges counterpart proposals.',
  [PERSONALITIES.COLLABORATIVE]:
    'Seeks win-win trade-offs, communicates transparently, explores creative package deals, and values relationship durability.',
  [PERSONALITIES.RISK_AVERSE]:
    'Prioritizes safety margins, avoids high-stakes deadlocks, favors guaranteed contractual terms, and concedes cautiously.',
});
 
/** Constraint types used across all scenarios. */
export const CONSTRAINT_TYPES = Object.freeze({
  BUDGET_LIMIT: 'budget_limit',
  PRICE_FLOOR: 'price_floor',
  MIN_REQUIREMENT: 'min_requirement',
  MAX_LIMIT: 'max_limit',
  CAPACITY: 'capacity',
  POLICY: 'policy',
});
 
const { AGGRESSIVE, COLLABORATIVE, RISK_AVERSE } = PERSONALITIES;
const T = CONSTRAINT_TYPES;
 
/**
 * Constraint shape:
 *  - id: unique within its agent
 *  - type: one of CONSTRAINT_TYPES
 *  - description: explicit, testable rule (no numbers; see parameterKey)
 *  - parameterKey: key in scenario.parameters holding the threshold (null for pure policy rules)
 *  - operator: 'lte' | 'gte' (agent's value must be <= / >= the parameter), or null
 *  - hard: true = must never be violated; false = strong preference
 */
const constraint = (id, type, description, parameterKey = null, operator = null, hard = true) => ({
  id,
  type,
  description,
  parameterKey,
  operator,
  hard,
});
 
const topic = (id, label, description) => ({ id, label, description });
 
const param = (value, unit, description) => ({ value, unit, description, isSample: true });
 
/* -------------------------------------------------------------------------- */
/* Scenario A: Vendor Pricing Negotiation                                      */
/* -------------------------------------------------------------------------- */
const vendorPricing = {
  id: 'vendor-pricing',
  category: 'Procurement & Sales',
  iconName: 'ShoppingCart',
  accentColor: '#4f46e5',
  participantCount: 2,
  keyLevers: ['Unit Pricing', 'Order Volume', 'Payment Terms (Net 30/60)', 'Delivery SLA'],
  estimatedRounds: '8 - 12 Turns',
  complexity: 'Standard (2 Agents)',
  name: 'Vendor Pricing Negotiation',
  description:
    'Negotiate product pricing, purchasing terms, order quantities, and delivery conditions between a buyer and a vendor.',
  context:
    'The organization needs to purchase a batch of standard products. The buyer wants a competitive price at required quality and delivery standards; the vendor wants a profitable sale with an acceptable margin.',
  topics: [
    topic('unit-price', 'Unit price', 'Price per unit of the product.'),
    topic('order-quantity', 'Order quantity', 'Number of units in the order.'),
    topic('delivery-schedule', 'Delivery schedule', 'Delivery lead time and dates.'),
    topic('payment-terms', 'Payment terms', 'Payment timing, e.g. days until payment is due.'),
    topic('quality-requirements', 'Quality requirements', 'Minimum product quality grade and inspection terms.'),
  ],
  constraints: [
    constraint(
      'feasible-price-zone',
      T.POLICY,
      'Sample values are set so the buyer maximum unit price is at or above the vendor minimum unit price, leaving a feasible agreement zone.',
    ),
  ],
  parameters: {
    currency: param('USD', null, 'Currency label for all monetary samples.'),
    buyerMaxUnitPrice: param(100, 'currency/unit', 'Highest unit price the buyer is approved to pay.'),
    buyerMaxTotalBudget: param(110000, 'currency', 'Maximum approved total purchasing budget for the order.'),
    buyerMinQualityGrade: param(3, 'grade (1-5)', 'Lowest acceptable product quality grade.'),
    buyerMaxDeliveryDays: param(30, 'days', 'Latest acceptable delivery time after order.'),
    buyerMaxPaymentTermsDays: param(60, 'days', 'Longest payment window the purchasing policy allows buyer to propose; shorter terms (e.g. 30 days) may be offered.'),
    vendorMinUnitPrice: param(80, 'currency/unit', 'Lowest unit price the vendor may accept.'),
    vendorUnitCost: param(65, 'currency/unit', 'Vendor supply cost per unit; minimum price must stay above this.'),
    vendorMinLeadTimeDays: param(14, 'days', 'Fastest delivery the vendor can commit to.'),
    vendorMaxOrderQuantity: param(1200, 'units', 'Maximum units the vendor can deliver for this order.'),
    sampleOrderQuantity: param(1000, 'units', 'Illustrative order quantity used to sanity-check budgets.'),
  },
  agents: [
    {
      id: 'buyer-procurement',
      stakeholder: 'Enterprise Buyer Organization',
      avatarText: 'PM',
      name: 'Purchasing Manager',
      role: 'Purchasing Manager',
      roleDescription:
        'Represents the organization purchasing products and negotiates commercial terms with the vendor.',
      primaryGoal:
        'Obtain a competitive price while maintaining required product quality and delivery standards.',
      objectives: [
        'Minimize the unit price and total cost.',
        'Secure delivery within the required window.',
        'Obtain longer payment terms where possible.',
      ],
      constraints: [
        constraint('max-budget', T.BUDGET_LIMIT, 'Must not exceed the approved maximum total purchasing budget.', 'buyerMaxTotalBudget', 'lte'),
        constraint('max-unit-price', T.BUDGET_LIMIT, 'Must not agree to a unit price above the approved maximum unit price.', 'buyerMaxUnitPrice', 'lte'),
        constraint('min-quality', T.MIN_REQUIREMENT, 'Must not accept products below the minimum quality grade.', 'buyerMinQualityGrade', 'gte'),
        constraint('max-delivery', T.MAX_LIMIT, 'Must not accept a delivery time longer than the maximum allowed days.', 'buyerMaxDeliveryDays', 'lte'),
        constraint('payment-policy', T.POLICY, 'Must not offer payment terms longer than the purchasing policy allows, and must not agree to full prepayment.', 'buyerMaxPaymentTermsDays', 'lte'),
      ],
      defaultPersonality: COLLABORATIVE,
      personality: null, // null = use defaultPersonality; Agent Configuration may set an override on a clone
    },
    {
      id: 'vendor-sales',
      stakeholder: 'Supplier Organization',
      avatarText: 'SR',
      name: 'Sales Representative',
      role: 'Sales Representative',
      roleDescription:
        "Represents the supplier and negotiates pricing and commercial terms while protecting the vendor's business interests.",
      primaryGoal: 'Secure a profitable sale while maintaining an acceptable commercial margin.',
      objectives: [
        'Maximize the unit price and total revenue.',
        'Secure a larger order quantity.',
        'Obtain shorter payment terms.',
      ],
      constraints: [
        constraint('min-price', T.PRICE_FLOOR, 'Must not accept a unit price below the minimum acceptable selling price.', 'vendorMinUnitPrice', 'gte'),
        constraint('cost-floor', T.PRICE_FLOOR, 'Must not accept a unit price at or below the vendor supply cost per unit.', 'vendorUnitCost', 'gte'),
        constraint('delivery-capacity', T.CAPACITY, 'Must not commit to delivery faster than the minimum lead time.', 'vendorMinLeadTimeDays', 'gte'),
        constraint('order-capacity', T.CAPACITY, 'Must not commit to an order quantity above the maximum deliverable units.', 'vendorMaxOrderQuantity', 'lte'),
        constraint('feasibility', T.POLICY, 'Must not agree to terms that make the sale commercially unviable (e.g. unpaid delivery or open-ended payment terms).'),
      ],
      defaultPersonality: AGGRESSIVE,
      personality: null,
    },
  ],
};
 
/* -------------------------------------------------------------------------- */
/* Scenario B: Job Offer Negotiation                                           */
/* -------------------------------------------------------------------------- */
const jobOffer = {
  id: 'job-offer',
  category: 'Talent & Human Resources',
  iconName: 'Briefcase',
  accentColor: '#06b6d4',
  participantCount: 2,
  keyLevers: ['Base Salary', 'Equity Stock Grants', 'Sign-On Bonus', 'Remote Flexibility'],
  estimatedRounds: '6 - 10 Turns',
  complexity: 'Standard (2 Agents)',
  name: 'Job Offer Negotiation',
  description:
    'Negotiate employment terms between a job candidate and an employer, including salary, benefits, joining date, and work arrangements.',
  context:
    'The candidate has received an offer and wants a package and working arrangement that meet their needs. The employer wants to hire within the approved salary budget and company policies.',
  topics: [
    topic('base-salary', 'Base salary', 'Annual base compensation.'),
    topic('benefits', 'Benefits', 'Benefits package such as leave, insurance, and bonus.'),
    topic('joining-date', 'Joining date', 'When the candidate starts.'),
    topic('work-arrangement', 'Remote or hybrid work', 'Number of remote days per week or on-site requirements.'),
    topic('job-responsibilities', 'Job responsibilities', 'Scope of the role and expectations.'),
  ],
  constraints: [
    constraint(
      'feasible-salary-zone',
      T.POLICY,
      'Sample values are set so the employer maximum salary is at or above the candidate minimum salary, and the date and remote-work ranges overlap.',
    ),
  ],
  parameters: {
    currency: param('USD', null, 'Currency label for all monetary samples.'),
    candidateMinSalary: param(90000, 'currency/year', 'Lowest annual base salary the candidate will accept.'),
    candidateTargetSalary: param(100000, 'currency/year', 'Salary the candidate would like to reach.'),
    candidateEarliestJoiningDays: param(30, 'days from offer', 'Earliest the candidate can start (notice period).'),
    candidatePreferredJoiningDays: param(45, 'days from offer', 'Candidate preferred start date.'),
    candidateMinRemoteDays: param(2, 'days/week', 'Minimum remote days per week the candidate requires.'),
    employerMaxSalary: param(105000, 'currency/year', 'Highest annual base salary the employer is approved to offer.'),
    employerLatestJoiningDays: param(60, 'days from offer', 'Latest start date that meets business needs.'),
    employerMaxRemoteDays: param(3, 'days/week', 'Maximum remote days per week company policy permits.'),
    employerMaxBonusPercent: param(10, 'percent of base', 'Maximum annual bonus the benefits policy allows.'),
  },
  agents: [
    {
      id: 'hiring-director',
      stakeholder: 'Hiring Organization',
      avatarText: 'HM',
      name: 'Hiring Manager',
      role: 'Hiring Manager',
      roleDescription:
        'Represents the employer and negotiates employment terms while considering organizational requirements.',
      primaryGoal: 'Hire a suitable candidate within the approved compensation budget and company policies.',
      objectives: [
        'Keep total compensation cost as low as possible.',
        'Fill the role by the required date.',
        'Keep working arrangements consistent with company policy.',
      ],
      constraints: [
        constraint('max-salary', T.BUDGET_LIMIT, 'Must remain within the approved maximum salary budget.', 'employerMaxSalary', 'lte'),
        constraint('latest-joining', T.MAX_LIMIT, 'Must not agree to a joining date later than the latest date that meets business needs.', 'employerLatestJoiningDays', 'lte'),
        constraint('max-remote', T.MAX_LIMIT, 'Must not offer more remote days per week than company policy permits.', 'employerMaxRemoteDays', 'lte'),
        constraint('max-bonus', T.MAX_LIMIT, 'Must not offer a bonus above the maximum permitted by the benefits policy.', 'employerMaxBonusPercent', 'lte'),
        constraint('role-requirements', T.POLICY, 'Must not change core role requirements or seniority level to justify a higher salary.'),
      ],
      defaultPersonality: RISK_AVERSE,
      personality: null,
    },
    {
      id: 'job-candidate',
      stakeholder: 'Prospective Employee',
      avatarText: 'JC',
      name: 'Job Candidate',
      role: 'Job Candidate',
      roleDescription: 'Represents a candidate negotiating employment terms with a prospective employer.',
      primaryGoal: 'Obtain an acceptable compensation package and suitable working conditions.',
      objectives: [
        'Maximize base salary and benefits.',
        'Secure a start date that accommodates the notice period.',
        'Secure flexible remote or hybrid working.',
      ],
      constraints: [
        constraint('min-salary', T.MIN_REQUIREMENT, 'Must meet the minimum acceptable salary requirement.', 'candidateMinSalary', 'gte'),
        constraint('earliest-joining', T.MIN_REQUIREMENT, 'Must not agree to a joining date earlier than the earliest possible start (notice period).', 'candidateEarliestJoiningDays', 'gte'),
        constraint('min-remote', T.MIN_REQUIREMENT, 'Must not accept fewer remote days per week than the minimum required.', 'candidateMinRemoteDays', 'gte'),
        constraint('role-expectations', T.POLICY, 'Must not accept responsibilities materially outside the advertised role without matching compensation or title.'),
      ],
      defaultPersonality: COLLABORATIVE,
      personality: null,
    },
  ],
};
 
/* -------------------------------------------------------------------------- */
/* Scenario C: Project Budget Allocation                                       */
/* -------------------------------------------------------------------------- */
const projectBudget = {
  id: 'project-budget',
  category: 'Corporate Strategy & Finance',
  iconName: 'PieChart',
  accentColor: '#10b981',
  participantCount: 3,
  keyLevers: ['Capital Share %', 'Priority Milestones', 'Headcount Quota', 'ROI Projections'],
  estimatedRounds: '10 - 15 Turns',
  complexity: 'Multilateral (3 Agents)',
  name: 'Project Budget Allocation',
  description:
    'Negotiate how a limited project budget should be distributed among competing departments or project stakeholders.',
  context:
    'Combined funding requests exceed the available ₹1,000,000 budget pool. Core Engineering, Growth & Marketing, and Product & AI must negotiate their shares within the strict overall ceiling.',
  topics: [
    topic('total-budget', 'Total available budget', 'The fixed pool of funds to be divided.'),
    topic('funding-allocation', 'Departmental funding allocation', 'Amount allocated to each department.'),
    topic('project-priorities', 'Project priorities', 'Which initiatives are funded first.'),
    topic('shared-resources', 'Shared resources', 'Allocation of the shared team capacity.'),
    topic('delivery-timelines', 'Delivery timelines', 'When funded initiatives will be delivered.'),
  ],
  constraints: [
    constraint('fixed-total-budget', T.BUDGET_LIMIT, 'Combined allocations must not exceed the total available budget.', 'totalBudget', 'lte'),
    constraint('fixed-shared-capacity', T.CAPACITY, 'Combined shared-resource allocations must not exceed the shared team capacity.', 'sharedResourceHours', 'lte'),
    constraint(
      'feasible-compromise',
      T.POLICY,
      'Sample values are set so the minimum operational funding amounts sum to less than the total budget, while the full requests sum to more than it.',
    ),
  ],
  parameters: {
    currency: param('₹', null, 'Currency label for all monetary samples.'),
    totalBudget: param(1000000, 'currency', 'Total available project budget.'),
    sharedResourceHours: param(2000, 'hours', 'Total hours available from the shared team.'),
    deptAProjectCostEstimate: param(600000, 'currency', 'Estimated cost of Engineering priority initiatives.'),
    deptAMinOperationalFunding: param(250000, 'currency', 'Minimum funding Engineering needs to operate.'),
    deptASharedHoursRequested: param(1200, 'hours', 'Shared team hours Engineering needs for full delivery.'),
    deptAMinSharedHours: param(700, 'hours', 'Minimum shared hours Engineering needs.'),
    deptBProjectCostEstimate: param(550000, 'currency', 'Estimated cost of Marketing priority initiatives.'),
    deptBMinOperationalFunding: param(200000, 'currency', 'Minimum funding Marketing needs to operate.'),
    deptBSharedHoursRequested: param(1000, 'hours', 'Shared team hours Marketing needs for full delivery.'),
    deptBMinSharedHours: param(600, 'hours', 'Minimum shared hours Marketing needs.'),
    deptCProjectCostEstimate: param(400000, 'currency', 'Estimated cost of Product AI priority initiatives.'),
    deptCMinOperationalFunding: param(200000, 'currency', 'Minimum funding Product AI needs to operate.'),
    deptCSharedHoursRequested: param(800, 'hours', 'Shared team hours Product AI needs.'),
    deptCMinSharedHours: param(500, 'hours', 'Minimum shared hours Product AI needs.'),
  },
  agents: [
    {
      id: 'vp-engineering',
      stakeholder: 'Core Engineering Department',
      avatarText: 'ENG',
      name: 'Engineering & Infrastructure Lead',
      role: 'Engineering Lead',
      roleDescription: 'Defends core technical infrastructure, cloud compute scaling, database modernization, and platform uptime.',
      primaryGoal: 'Secure sufficient funding (target ₹4,50,000) for platform reliability, tech debt, and core infrastructure.',
      objectives: [
        'Maximize the share of the total budget allocated to Engineering.',
        'Protect cloud uptime and infrastructure reliability standards.',
        'Secure enough shared team hours to deliver platform modernization.',
      ],
      constraints: [
        constraint('min-operational-funding', T.MIN_REQUIREMENT, 'Must receive sufficient funding to meet its minimum operational requirement.', 'deptAMinOperationalFunding', 'gte'),
        constraint('min-shared-hours', T.MIN_REQUIREMENT, 'Must receive at least the minimum shared team hours required.', 'deptAMinSharedHours', 'gte'),
        constraint('cost-estimate-cap', T.MAX_LIMIT, 'Must not request funding above its own project cost estimate.', 'deptAProjectCostEstimate', 'lte'),
        constraint('priority-order', T.POLICY, 'Must not drop its top-priority initiative to fund a lower-priority one.'),
      ],
      defaultPersonality: RISK_AVERSE,
      personality: null,
    },
    {
      id: 'cmo-marketing',
      stakeholder: 'Growth & Marketing Department',
      avatarText: 'MKT',
      name: 'Marketing & Growth Lead',
      role: 'Marketing Lead',
      roleDescription: 'Fights for global brand awareness, customer acquisition campaigns, and market expansion.',
      primaryGoal: 'Secure sufficient funding (target ₹3,50,000) for global customer acquisition and marketing campaigns.',
      objectives: [
        'Maximize customer acquisition and growth campaign funding.',
        'Protect key product launch marketing timelines.',
        'Secure shared creative team capacity for go-to-market assets.',
      ],
      constraints: [
        constraint('min-operational-funding', T.MIN_REQUIREMENT, 'Must receive sufficient funding to meet its minimum operational requirement.', 'deptBMinOperationalFunding', 'gte'),
        constraint('min-shared-hours', T.MIN_REQUIREMENT, 'Must receive at least the minimum shared team hours required.', 'deptBMinSharedHours', 'gte'),
        constraint('cost-estimate-cap', T.MAX_LIMIT, 'Must not request funding above its own project cost estimate.', 'deptBProjectCostEstimate', 'lte'),
        constraint('delivery-commitments', T.POLICY, 'Must not agree to an allocation that makes an already committed campaign date impossible without renegotiating.'),
      ],
      defaultPersonality: AGGRESSIVE,
      personality: null,
    },
    {
      id: 'head-product-ai',
      stakeholder: 'Product & AI Innovation Department',
      avatarText: 'AI',
      name: 'Product & AI Innovation Lead',
      role: 'Product AI Lead',
      roleDescription: 'Champions customer-facing GenAI capabilities, UX enhancements, and user growth initiatives.',
      primaryGoal: 'Secure feature development and GenAI product launch capital (target ₹3,00,000) to meet roadmap goals.',
      objectives: [
        'Secure funding for generative AI models and product feature engineering.',
        'Protect the Q3 customer product launch timeline.',
        'Secure dedicated design and QA capacity.',
      ],
      constraints: [
        constraint('min-operational-funding', T.MIN_REQUIREMENT, 'Must receive sufficient funding to meet its minimum operational requirement.', 'deptCMinOperationalFunding', 'gte'),
        constraint('min-shared-hours', T.MIN_REQUIREMENT, 'Must receive at least the minimum shared team hours required.', 'deptCMinSharedHours', 'gte'),
        constraint('cost-estimate-cap', T.MAX_LIMIT, 'Must not request funding above its own project cost estimate.', 'deptCProjectCostEstimate', 'lte'),
        constraint('roadmap-priorities', T.POLICY, 'Must not sacrifice core generative AI model deliverables.'),
      ],
      defaultPersonality: COLLABORATIVE,
      personality: null,
    },
  ],
};
 
/* -------------------------------------------------------------------------- */
/* Exports                                                                     */
/* -------------------------------------------------------------------------- */
 
const UNIT_LABEL = (unit, params) =>
  unit == null ? '' : ' ' + unit.replace('currency', params.currency.value);
 
/**
 * Human-readable constraint text including its current threshold, e.g.
 * "Must not exceed the approved maximum total purchasing budget (max 110,000 USD)".
 * Re-run this after overriding parameters on a cloned scenario.
 */
export const formatConstraint = (constraint, parameters) => {
  if (!constraint.parameterKey) return constraint.description;
  const p = parameters[constraint.parameterKey];
  const word = constraint.operator === 'lte' ? 'max' : 'min';
  const value = typeof p.value === 'number' ? p.value.toLocaleString('en-US') : p.value;
  return `${constraint.description.replace(/\.$/, '')} (${word} ${value}${UNIT_LABEL(p.unit, parameters)})`;
};
 
// Derived/compatibility fields used by the Scenario Selection and Agent Configuration modules.
[vendorPricing, jobOffer, projectBudget].forEach((s) => {
  s.shortDescription = s.description;
  s.detailedDescription = s.context;
  s.agents.forEach((a) => {
    a.availablePersonalities = [...SUPPORTED_PERSONALITIES];
    a.keyConstraints = a.constraints.map((c) => formatConstraint(c, s.parameters));
  });
});
 
const deepFreeze = (obj) => {
  Object.values(obj).forEach((v) => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  });
  return Object.freeze(obj);
};
 
export const SCENARIOS = deepFreeze([vendorPricing, jobOffer, projectBudget]);
 
export const getAllScenarios = () => SCENARIOS;
 
export const getScenarioById = (id) => SCENARIOS.find((s) => s.id === id) ?? null;
 
export const getAgentById = (scenarioId, agentId) =>
  getScenarioById(scenarioId)?.agents.find((a) => a.id === agentId) ?? null;
 
export default SCENARIOS;
 