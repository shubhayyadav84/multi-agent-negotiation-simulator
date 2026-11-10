import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  UserCheck,
  Bot,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Play,
  Layers,
  Flame,
  Handshake,
  ShieldCheck,
  Target,
  ShieldAlert,
  Sparkles,
  User,
  HelpCircle,
  Clock,
  Users
} from 'lucide-react';
import { useScenario } from '../context/ScenarioContext';
import { useSettings } from '../context/SettingsContext';
import {
  PERSONALITIES,
  PERSONALITY_DESCRIPTIONS,
  getScenarioById
} from '../data/scenarios';
import AgentFaceAvatar from '../components/AgentFaceAvatar';
import './PracticeAgentConfig.css';

// Pre-defined role profiles for Practice Mode across all 3 scenarios
const PRACTICE_ROLES_DATA = {
  'vendor-pricing': {
    id: 'vendor-pricing',
    name: 'Vendor Pricing Negotiation',
    category: 'Procurement & Supply Chain',
    accentColor: '#2563eb',
    estimatedRounds: '12 Rounds Dynamic',
    participantText: '1 Human Negotiator vs 1 AI Agent',
    roles: [
      {
        id: 'buyer-procurement',
        name: 'Procurement Buyer',
        title: 'Purchasing Director',
        stakeholder: 'Enterprise Buyer Organization',
        avatarText: 'PB',
        roleDescription:
          'Represents the enterprise buying mission-critical cloud server hardware and enterprise software support. Negotiates unit pricing, delivery schedules, and favorable net payment terms.',
        primaryGoal:
          'Obtain competitive unit pricing under budget (≤ ₹95,000/unit), secure Net-60 payment terms, and lock in a 99.9% uptime SLA.',
        constraints: [
          'Must not exceed approved total purchasing budget (max ₹1,10,000 total).',
          'Must secure delivery within 30 days of contract signing.',
          'Must obtain Net-60 payment terms and refuse 100% upfront prepayment.',
        ],
        defaultPersonality: PERSONALITIES.COLLABORATIVE,
      },
      {
        id: 'vendor-sales',
        name: 'Enterprise Supplier',
        title: 'Senior Sales Account Executive',
        stakeholder: 'Hardware & Cloud Vendor',
        avatarText: 'ES',
        roleDescription:
          'Represents the high-end technology supplier protecting commercial margins, volume thresholds, and accelerated cash-flow terms.',
        primaryGoal:
          'Maximize annual contract value (target ₹1,10,000), preserve minimum 25% gross margin, and achieve Net-30 payment terms.',
        constraints: [
          'Must not accept a unit price below minimum allowable price floor (min ₹90,000).',
          'Must not commit to delivery faster than 14-day production lead time.',
          'Must not agree to payment terms longer than Net-45 days.',
        ],
        defaultPersonality: PERSONALITIES.AGGRESSIVE,
      },
    ],
  },
  'job-offer': {
    id: 'job-offer',
    name: 'Job Offer Negotiation',
    category: 'Talent & Executive Compensation',
    accentColor: '#059669',
    estimatedRounds: '10 Rounds Dynamic',
    participantText: '1 Human Negotiator vs 1 AI Agent',
    roles: [
      {
        id: 'hiring-director',
        name: 'Hiring Recruiter',
        title: 'Director of Talent Acquisition',
        stakeholder: 'Corporate Talent Team',
        avatarText: 'HR',
        roleDescription:
          'Represents the hiring company seeking to recruit top-tier technical talent while adhering strictly to department compensation bands and equity grant caps.',
        primaryGoal:
          'Hire candidate within departmental salary budget (target base ₹1,55,000) and preserve long-term retention incentives.',
        constraints: [
          'Must remain within approved maximum salary band (max ₹1,70,000 base).',
          'Must not offer more than 3 remote days per week per corporate policy.',
          'Must not exceed maximum sign-on bonus percentage cap (max 10%).',
        ],
        defaultPersonality: PERSONALITIES.RISK_AVERSE,
      },
      {
        id: 'job-candidate',
        name: 'Job Candidate',
        title: 'Senior AI Engineer Candidate',
        stakeholder: 'Candidate Side',
        avatarText: 'JC',
        roleDescription:
          'An accomplished engineering candidate negotiating a full compensation package including base salary, performance sign-on bonus, equity stock grants, and remote work arrangements.',
        primaryGoal:
          'Maximize total compensation package (target base ₹1,75,000, 10% bonus, 0.75% equity) and secure at least 3 remote days per week.',
        constraints: [
          'Must secure base salary meeting minimum career threshold (min ₹1,50,000).',
          'Must secure equity stock allocation of at least 0.5%.',
          'Must obtain at least 2 remote days per week.',
        ],
        defaultPersonality: PERSONALITIES.COLLABORATIVE,
      },
    ],
  },
  'project-budget': {
    id: 'project-budget',
    name: 'Project Budget Allocation',
    category: 'Cross-Department Resource Management',
    accentColor: '#8b5cf6',
    estimatedRounds: '12 Rounds Multilateral',
    participantText: '1 Human Lead vs 2 AI Stakeholders',
    roles: [
      {
        id: 'vp-engineering',
        name: 'Lead Software Engineer',
        title: 'VP of Engineering',
        stakeholder: 'Core Engineering Department',
        avatarText: 'ENG',
        roleDescription:
          'Defends core technical infrastructure, cloud compute scaling, database modernization, and critical engineering tech debt resolution.',
        primaryGoal:
          'Secure core infrastructure budget (target ₹4,50,000) for platform reliability and uptime.',
        constraints: [
          'Must receive minimum operational funding of ₹2,50,000.',
          'Must secure at least 700 shared team engineering hours.',
          'Must not request funding above own project estimate (max ₹6,00,000).',
        ],
        defaultPersonality: PERSONALITIES.RISK_AVERSE,
      },
      {
        id: 'cmo-marketing',
        name: 'Marketing Director',
        title: 'Chief Marketing Officer',
        stakeholder: 'Growth & Marketing Department',
        avatarText: 'MKT',
        roleDescription:
          'Fights for global brand awareness, paid digital customer acquisition, event sponsorships, and lead-generation campaigns.',
        primaryGoal:
          'Secure customer acquisition and growth capital (target ₹3,50,000) to meet targets.',
        constraints: [
          'Must receive minimum campaign funding of ₹2,00,000.',
          'Must secure at least 600 shared team hours.',
          'Must not request funding above own project estimate (max ₹5,50,000).',
        ],
        defaultPersonality: PERSONALITIES.AGGRESSIVE,
      },
      {
        id: 'head-product-ai',
        name: 'Product Manager',
        title: 'Head of Product AI',
        stakeholder: 'Product & AI Innovation Department',
        avatarText: 'AI',
        roleDescription:
          'Champions product feature roadmap, customer-facing GenAI capabilities, UX enhancements, and user growth initiatives.',
        primaryGoal:
          'Secure feature development and GenAI product launch capital (target ₹3,00,000).',
        constraints: [
          'Must receive minimum operational product funding of ₹2,00,000.',
          'Must secure at least 500 shared design and QA hours.',
          'Must not request funding above own project estimate (max ₹4,00,000).',
        ],
        defaultPersonality: PERSONALITIES.COLLABORATIVE,
      },
    ],
  },
};

const personalityIcons = {
  [PERSONALITIES.AGGRESSIVE]: Flame,
  [PERSONALITIES.COLLABORATIVE]: Handshake,
  [PERSONALITIES.RISK_AVERSE]: ShieldCheck,
};

const personalityStyles = {
  [PERSONALITIES.AGGRESSIVE]: {
    border: '#f87171',
    bg: '#fef2f2',
    text: '#b91c1c',
    glow: 'rgba(239, 68, 68, 0.15)',
  },
  [PERSONALITIES.COLLABORATIVE]: {
    border: '#818cf8',
    bg: '#eef2ff',
    text: '#4338ca',
    glow: 'rgba(79, 70, 229, 0.15)',
  },
  [PERSONALITIES.RISK_AVERSE]: {
    border: '#34d399',
    bg: '#ecfdf5',
    text: '#047857',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
};

const PracticeAgentConfig = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedScenarioId, selectScenario } = useScenario();
  const { t } = useSettings();

  // Resolve active scenario ID from URL search, state, or context
  const searchParams = new URLSearchParams(location.search);
  const scenarioParam = searchParams.get('scenario') || location.state?.scenarioId || selectedScenarioId || 'vendor-pricing';

  const scenarioData = PRACTICE_ROLES_DATA[scenarioParam] || PRACTICE_ROLES_DATA['vendor-pricing'];

  // User's selected role: defaults to first role in scenario
  const [selectedUserRoleId, setSelectedUserRoleId] = useState(() => {
    return scenarioData.roles[0]?.id || '';
  });

  // State to hold personalities for AI agents
  const [aiPersonalities, setAiPersonalities] = useState(() => {
    const initial = {};
    scenarioData.roles.forEach((r) => {
      initial[r.id] = r.defaultPersonality;
    });
    return initial;
  });

  const [notification, setNotification] = useState('');
  const [validationError, setValidationError] = useState('');

  // When scenario changes, ensure valid selection
  useEffect(() => {
    if (scenarioData) {
      if (!scenarioData.roles.some((r) => r.id === selectedUserRoleId)) {
        setSelectedUserRoleId(scenarioData.roles[0]?.id || '');
      }
      const initial = {};
      scenarioData.roles.forEach((r) => {
        initial[r.id] = r.defaultPersonality;
      });
      setAiPersonalities(initial);
    }
  }, [scenarioParam]);

  // Separate the User's chosen role from the AI counterpart(s)
  const userRole = useMemo(() => {
    return scenarioData.roles.find((r) => r.id === selectedUserRoleId) || scenarioData.roles[0];
  }, [scenarioData, selectedUserRoleId]);

  const aiCounterparts = useMemo(() => {
    return scenarioData.roles.filter((r) => r.id !== selectedUserRoleId);
  }, [scenarioData, selectedUserRoleId]);

  const handleSelectUserRole = (roleId) => {
    setSelectedUserRoleId(roleId);
    setValidationError('');
    const roleObj = scenarioData.roles.find((r) => r.id === roleId);
    showToast(`You selected: ${roleObj?.name || 'Human Role'}. Counterpart assigned.`);
  };

  const handleAiPersonalityChange = (agentId, personality) => {
    setAiPersonalities((prev) => ({
      ...prev,
      [agentId]: personality,
    }));
    setValidationError('');
    showToast(`Updated AI personality to ${personality}.`);
  };

  const handleResetDefaults = () => {
    const defaults = {};
    scenarioData.roles.forEach((r) => {
      defaults[r.id] = r.defaultPersonality;
    });
    setAiPersonalities(defaults);
    showToast('Reset all AI counterpart personalities to default presets.');
  };

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleStartPracticeArena = () => {
    if (!userRole) {
      setValidationError('Please select which role you wish to play.');
      return;
    }

    // Verify all AI counterparts have a valid personality
    for (const ai of aiCounterparts) {
      const p = aiPersonalities[ai.id] || ai.defaultPersonality;
      if (!Object.values(PERSONALITIES).includes(p)) {
        setValidationError(`Please select a valid personality for ${ai.name}.`);
        return;
      }
    }

    setValidationError('');

    // Prepare complete payload for Practice Arena
    const arenaPayload = {
      scenarioId: scenarioData.id,
      scenario: scenarioData,
      mode: 'practice',
      isPractice: true,
      agents: [
        {
          id: userRole.id,
          name: userRole.name,
          role: userRole.title || userRole.role || userRole.name,
          personality: 'Human',
          goal: userRole.primaryGoal,
          constraints: userRole.constraints,
          is_human: true,
        },
        ...aiCounterparts.map((ai) => ({
          id: ai.id,
          name: ai.name,
          role: ai.title || ai.role || ai.name,
          personality: aiPersonalities[ai.id] || ai.defaultPersonality,
          goal: ai.primaryGoal,
          constraints: ai.constraints,
          is_human: false,
        })),
      ],
      userRole: {
        id: userRole.id,
        name: userRole.name,
        title: userRole.title,
        stakeholder: userRole.stakeholder,
        roleDescription: userRole.roleDescription,
        primaryGoal: userRole.primaryGoal,
        constraints: userRole.constraints,
      },
      userRoleAgentId: userRole.id,
      userSide: userRole.id === 'buyer-procurement' ? 'buyer' : userRole.id === 'vendor-sales' ? 'seller' : null,
      aiCounterparts: aiCounterparts.map((ai) => ({
        id: ai.id,
        name: ai.name,
        title: ai.title,
        stakeholder: ai.stakeholder,
        roleDescription: ai.roleDescription,
        primaryGoal: ai.primaryGoal,
        constraints: ai.constraints,
        personality: aiPersonalities[ai.id] || ai.defaultPersonality,
        isHuman: false,
      })),
      agentPersonalities: {
        ...aiPersonalities,
        [userRole.id]: 'Human',
      },
    };

    navigate('/arena', {
      state: arenaPayload,
    });
  };

  return (
    <div className="practice-agent-config-page">
      {/* Top Header & Navigation */}
      <div className="practice-config-header-row">
        <button
          type="button"
          onClick={() => navigate('/practice')}
          className="btn-back-practice"
          title="Back to Practice Scenarios"
        >
          <ArrowLeft size={16} />
          <span>Back to Practice Scenarios</span>
        </button>

        <div className="practice-stepper-pill">
          <Sliders size={14} />
          <span>Step 2 of 3 • Choose Your Role & Configure AI Counterparts</span>
        </div>
      </div>

      {/* Page Title & Mission Subtitle */}
      <div className="practice-config-title-group">
        <h1 className="practice-config-title">Configure Practice Negotiation & Opponents</h1>
        <p className="practice-config-subtitle">
          First, select which stakeholder role <strong>you</strong> want to play as a human negotiator.
          Then, configure the behavioral personality (Aggressive, Collaborative, or Risk-Averse) of your AI counterpart(s)
          to simulate real-world tactical dynamics.
        </p>
      </div>

      {/* Active Scenario Context Banner */}
      <div
        className="practice-scenario-banner"
        style={{ borderLeftColor: scenarioData.accentColor }}
      >
        <div className="scenario-banner-left">
          <div
            className="scenario-banner-icon"
            style={{
              backgroundColor: `${scenarioData.accentColor}18`,
              color: scenarioData.accentColor,
            }}
          >
            <Layers size={20} />
          </div>

          <div className="scenario-banner-info">
            <span className="scenario-banner-label">Active Practice Scenario</span>
            <h2 className="scenario-banner-name">{scenarioData.name}</h2>
          </div>
        </div>

        <div className="scenario-banner-meta">
          <span className="banner-pill category-pill">{scenarioData.category}</span>
          <span className="banner-pill agents-pill">
            <Users size={12} />
            {scenarioData.participantText}
          </span>
          <span className="banner-pill rounds-pill">
            <Clock size={12} />
            {scenarioData.estimatedRounds}
          </span>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="btn-reset-practice-defaults"
            title="Reset AI counterpart personalities to defaults"
          >
            <RotateCcw size={14} />
            <span>Reset AI Defaults</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="practice-config-toast" role="status">
          <CheckCircle2 size={16} className="toast-icon" />
          <span>{notification}</span>
        </div>
      )}

      {/* Validation Error Alert */}
      {validationError && (
        <div className="practice-config-alert" role="alert">
          <AlertCircle size={18} />
          <span>{validationError}</span>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: Select Which Role YOU Want to Play (Human Participant)
          ========================================================================= */}
      <div className="practice-section-container">
        <div className="section-headline">
          <div className="step-number-badge">1</div>
          <div>
            <h3 className="section-title">Select Your Role to Play (Human Participant)</h3>
            <p className="section-desc">
              Choose the side you want to represent. You will enter offers, counteroffers, and strategic decisions directly in the arena transcript.
            </p>
          </div>
        </div>

        {/* Role Selection Option Buttons Grid */}
        <div className="user-role-selection-grid">
          {scenarioData.roles.map((role) => {
            const isUserSelected = selectedUserRoleId === role.id;

            return (
              <div
                key={role.id}
                role="button"
                tabIndex={0}
                aria-pressed={isUserSelected}
                onClick={() => handleSelectUserRole(role.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectUserRole(role.id);
                  }
                }}
                className={`role-select-card ${isUserSelected ? 'selected' : ''}`}
                style={{
                  '--role-accent': isUserSelected ? scenarioData.accentColor : '#cbd5e1',
                }}
              >
                <div className="role-card-top">
                  <AgentFaceAvatar agentId={role.id} accentColor={scenarioData.accentColor} size={46} />
                  <div className="role-card-titles">
                    <span className="role-stakeholder">{role.stakeholder}</span>
                    <h4 className="role-name">{role.name}</h4>
                  </div>
                </div>

                <p className="role-quick-goal">
                  <strong>Goal:</strong> {role.primaryGoal}
                </p>

                <div className="role-select-footer">
                  {isUserSelected ? (
                    <div className="role-active-pill">
                      <UserCheck size={14} />
                      <span>Playing as You</span>
                    </div>
                  ) : (
                    <div className="role-inactive-pill">
                      <span>Click to Play This Role</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SECTION 1.1: Detailed Profile of User's Selected Role (NO AI PERSONALITY)
          ========================================================================= */}
      {userRole && (
        <div className="practice-user-profile-card">
          <div className="user-profile-header">
            <div className="user-profile-identity">
              <AgentFaceAvatar agentId={userRole.id} accentColor={scenarioData.accentColor} size={54} />
              <div>
                <div className="user-role-badge">
                  <UserCheck size={14} />
                  <span>YOU (Human Negotiator)</span>
                </div>
                <h3 className="user-profile-name">{userRole.name} • {userRole.title}</h3>
                <span className="user-profile-stakeholder">{userRole.stakeholder}</span>
              </div>
            </div>

            <div className="human-controlled-tag">
              <Sparkles size={14} />
              <span>Full Strategic Freedom</span>
            </div>
          </div>

          <p className="user-profile-desc">{userRole.roleDescription}</p>

          <div className="user-profile-details-grid">
            <div className="user-detail-box goal-box">
              <div className="detail-box-title">
                <Target size={15} className="detail-icon" style={{ color: '#2563eb' }} />
                <span>Your Primary Goal & Objectives</span>
              </div>
              <p className="detail-box-text">{userRole.primaryGoal}</p>
            </div>

            <div className="user-detail-box constraints-box">
              <div className="detail-box-title">
                <ShieldAlert size={15} className="detail-icon" style={{ color: '#dc2626' }} />
                <span>Your Operational Constraints & Boundaries</span>
              </div>
              <ul className="user-constraints-list">
                {userRole.constraints.map((c, idx) => (
                  <li key={idx} className="constraint-item">
                    <span className="bullet-dot" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Explicit Notice: No AI Personality Mode for Human User */}
          <div className="human-mode-notice-bar">
            <User size={16} className="notice-icon" />
            <div>
              <strong>Human Participant Control:</strong> You craft every proposal and respond manually.
              Behavioral personality profiles (Aggressive, Collaborative, Risk-Averse) do not apply to your role.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: Configure Your Counterpart AI Agent(s)
          ========================================================================= */}
      <div className="practice-section-container" style={{ marginTop: '36px' }}>
        <div className="section-headline">
          <div className="step-number-badge">2</div>
          <div>
            <h3 className="section-title">
              {aiCounterparts.length === 1
                ? 'Configure Your AI Counterpart (Opponent Agent)'
                : `Configure Your AI Counterparts (${aiCounterparts.length} Opponent Stakeholders)`}
            </h3>
            <p className="section-desc">
              {aiCounterparts.length === 1
                ? 'Because you selected the role above, the other party is automatically designated as your AI opponent. Choose their behavioral personality below.'
                : 'Because you selected your role above, the remaining stakeholders are designated as your AI counterparts. Configure each agent’s behavioral personality below.'}
            </p>
          </div>
        </div>

        {/* Responsive Grid of AI Counterpart Cards */}
        <div className="ai-counterparts-grid">
          {aiCounterparts.map((aiAgent) => {
            const currentPersonality =
              aiPersonalities[aiAgent.id] || aiAgent.defaultPersonality;
            const ActiveIcon = personalityIcons[currentPersonality] || Sparkles;
            const activeStyle = personalityStyles[currentPersonality] || personalityStyles[PERSONALITIES.COLLABORATIVE];
            const isDefault = currentPersonality === aiAgent.defaultPersonality;

            return (
              <div
                key={aiAgent.id}
                className="ai-agent-config-card"
                id={`ai-card-${aiAgent.id}`}
                style={{
                  '--ai-accent-border': activeStyle.border,
                  '--ai-accent-glow': activeStyle.glow,
                }}
              >
                {/* AI Agent Header */}
                <div className="ai-card-header">
                  <AgentFaceAvatar agentId={aiAgent.id} accentColor={scenarioData.accentColor} size={50} />
                  <div className="ai-agent-identity">
                    <div className="ai-opponent-tag">
                      <Bot size={13} />
                      <span>AI Counterpart</span>
                    </div>
                    <h4 className="ai-agent-name">{aiAgent.name}</h4>
                    <span className="ai-agent-stakeholder">{aiAgent.stakeholder}</span>
                  </div>
                </div>

                <p className="ai-role-desc">{aiAgent.roleDescription}</p>

                {/* AI Objectives & Boundaries Preview */}
                <div className="ai-details-box">
                  <div className="ai-box-row">
                    <Target size={14} className="box-icon" style={{ color: '#2563eb' }} />
                    <span className="box-title">Opponent Goal:</span>
                  </div>
                  <p className="box-text">{aiAgent.primaryGoal}</p>
                </div>

                {/* Personality Selection Radio Group */}
                <div className="ai-personality-block">
                  <div className="personality-block-header">
                    <span className="personality-title">Negotiation Personality:</span>
                    {isDefault ? (
                      <span className="preset-tag default">Default Preset</span>
                    ) : (
                      <span className="preset-tag modified">Customized</span>
                    )}
                  </div>

                  <div className="personality-buttons-grid" role="radiogroup" aria-label={`Personality for ${aiAgent.name}`}>
                    {Object.values(PERSONALITIES).map((personality) => {
                      const Icon = personalityIcons[personality];
                      const isSelected = currentPersonality === personality;
                      const style = personalityStyles[personality];

                      return (
                        <button
                          key={personality}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleAiPersonalityChange(aiAgent.id, personality)}
                          className={`btn-personality-choice ${isSelected ? 'active' : ''}`}
                          style={
                            isSelected
                              ? {
                                  borderColor: style.border,
                                  backgroundColor: style.bg,
                                  color: style.text,
                                  boxShadow: `0 0 0 2px ${style.border}, 0 4px 12px ${style.glow}`,
                                }
                              : {}
                          }
                        >
                          <Icon size={14} />
                          <span>{personality}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Strategy Behavior Preview Box */}
                  <div
                    className="ai-strategy-preview-box"
                    style={{
                      backgroundColor: activeStyle.bg,
                      borderColor: activeStyle.border,
                      color: activeStyle.text,
                    }}
                  >
                    <div className="strategy-header">
                      <ActiveIcon size={14} />
                      <strong>{currentPersonality} Strategy:</strong>
                    </div>
                    <p className="strategy-desc">
                      {PERSONALITY_DESCRIPTIONS[currentPersonality]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          Bottom Continuity & Launch Bar
          ========================================================================= */}
      <div className="practice-action-footer">
        <div className="footer-summary-group">
          <CheckCircle2 size={20} className="summary-icon" />
          <div className="summary-text-wrap">
            <span className="summary-headline">Practice Setup Ready</span>
            <div className="summary-pills-row">
              <span className="summary-pill human-pill">
                <User size={12} />
                You: <strong>{userRole?.name}</strong>
              </span>
              <span className="summary-pill ai-pill">
                <Bot size={12} />
                AI Opponents: {aiCounterparts.map((a) => `${a.name} (${aiPersonalities[a.id] || a.defaultPersonality})`).join(', ')}
              </span>
            </div>
          </div>
        </div>

        <div className="footer-actions-group">
          <button
            type="button"
            id="start-practice-negotiation-btn"
            onClick={handleStartPracticeArena}
            className="btn-launch-practice-arena"
            title="Launch live interactive practice session in Negotiation Arena"
          >
            <Play size={16} className="play-icon" />
            <span>Enter Negotiation Arena</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeAgentConfig;

