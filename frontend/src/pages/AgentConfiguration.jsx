import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Play,
  Layers,
} from 'lucide-react';
import { useScenario } from '../context/ScenarioContext';
import { useSettings } from '../context/SettingsContext';
import { getScenarioById } from '../data/scenarios';
import { validateNegotiationConfig } from '../utils/configurationValidator';
import AgentCard from '../components/AgentCard';
import PracticeAgentConfig from './PracticeAgentConfig';

const AgentConfiguration = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // If in practice mode, delegate directly to PracticeAgentConfig
  const searchParams = new URLSearchParams(location.search);
  const isPracticeMode =
    searchParams.get('mode') === 'practice' ||
    location.state?.mode === 'practice' ||
    location.state?.isPractice === true;

  if (isPracticeMode) {
    return <PracticeAgentConfig />;
  }
  const {
    selectedScenarioId,
    selectedScenario,
    agentPersonalities,
    updateAgentPersonality,
    resetAgentPersonalities,
    lastDraftSaved,
    discardDraft,
  } = useScenario();
  const { t } = useSettings();

  const [notification, setNotification] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);

  // Active scenario strictly based on user selection
  const urlScenarioId = searchParams.get('scenario');
  const scenarioFromUrl = urlScenarioId ? getScenarioById(urlScenarioId) : null;
  const isInvalidUrlScenario = Boolean(urlScenarioId && !scenarioFromUrl);

  const activeScenario = isInvalidUrlScenario
    ? null
    : (scenarioFromUrl || selectedScenario || (selectedScenarioId ? getScenarioById(selectedScenarioId) : null));

  useEffect(() => {
    if (isInvalidUrlScenario || !activeScenario) {
      navigate('/scenarios', {
        replace: true,
        state: {
          error: isInvalidUrlScenario
            ? 'The selected scenario could not be found.'
            : (t ? t('pleaseSelectScenario') : 'Please select a negotiation scenario before proceeding to agent configuration.')
        }
      });
    }
  }, [activeScenario, isInvalidUrlScenario, navigate, t]);

  if (!activeScenario) {
    return null;
  }

  const handlePersonalityChange = (agentId, personality) => {
    updateAgentPersonality(agentId, personality);
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
    setNotification(`Updated agent personality to ${personality}.`);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleReset = () => {
    resetAgentPersonalities();
    discardDraft?.();
    setValidationErrors([]);
    setNotification('Restored all agents to default scenario personalities.');
    setTimeout(() => setNotification(''), 2500);
  };

  // Get active scenario agent personalities only (excluding any stray keys from storage)
  const getScopedPersonalities = () => {
    const scoped = {};
    if (activeScenario && activeScenario.agents) {
      activeScenario.agents.forEach((agent) => {
        scoped[agent.id] = agentPersonalities[agent.id] || agent.defaultPersonality;
      });
    }
    return scoped;
  };

  const handleStartNegotiation = () => {
    const scopedPersonalities = getScopedPersonalities();
    // Validate current configuration at execution time
    const validation = validateNegotiationConfig(activeScenario, scopedPersonalities);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors([]);
    discardDraft?.();

    // Hand over structured, validated configuration to the downstream Orchestrator / Arena
    navigate('/arena', {
      state: {
        scenarioId: validation.validatedConfig.scenarioId,
        scenario: validation.validatedConfig.scenario,
        agents: validation.validatedConfig.agents,
        agentPersonalities: scopedPersonalities,
        negotiationConfig: validation.validatedConfig,
      }
    });
  };

  // Pre-validate configuration to reflect real-time readiness
  const currentValidation = validateNegotiationConfig(activeScenario, getScopedPersonalities());

  const scenarioKey = activeScenario.id.replace(/-/g, '_');
  const scenarioName = t ? (t(`scenario_${scenarioKey}_name`) || activeScenario.name) : activeScenario.name;
  const scenarioCategory = t ? (t(`scenario_${scenarioKey}_category`) || activeScenario.category) : activeScenario.category;

  return (
    <div className="agent-configuration-page">
      {/* Top Navigation Bar with Back Action & Stepper */}
      <div className="agent-page-header-row">
        <button
          type="button"
          onClick={() => navigate('/scenarios')}
          className="btn-back-scenario"
          title="Back to Scenario Selection"
        >
          <ArrowLeft size={16} />
          <span>{t ? t('changeScenario') : 'Change Scenario'}</span>
        </button>

        <div className="agent-stepper-pill">
          <Sliders size={14} />
          <span>{t ? t('step2AgentConfig') : 'Step 2 of 3 • Agent Role & Personality Configuration'}</span>
        </div>
      </div>

      {/* Page Title & Context Description */}
      <div className="agent-page-title-group">
        <h1 className="agent-page-title">{t ? t('configureAgentsTitle') : 'Configure Negotiating Agents'}</h1>
        <p className="agent-page-subtitle">
          {t ? t('configureAgentsSubtitle') : `Review the participating stakeholder roles, primary objectives, and strict boundary constraints loaded dynamically for ${scenarioName}. Customize each agent's behavioral personality below to model realistic negotiation dynamics before initiating the session.`}
        </p>
      </div>

      {/* Active Scenario Context Banner */}
      <div
        className="active-scenario-banner"
        style={{
          borderLeftColor: activeScenario.accentColor
        }}
      >
        <div className="scenario-banner-left">
          <div
            className="scenario-banner-icon"
            style={{
              backgroundColor: `${activeScenario.accentColor}18`,
              color: activeScenario.accentColor
            }}
          >
            <Layers size={20} />
          </div>

          <div className="scenario-banner-info">
            <span className="scenario-banner-label">{t ? t('activeScenarioContext') : 'Active Scenario Context'}</span>
            <h2 className="scenario-banner-name">{scenarioName}</h2>
          </div>
        </div>

        <div className="scenario-banner-meta">
          <span className="banner-pill category-pill">{scenarioCategory}</span>
          <span className="banner-pill agents-pill">
            {activeScenario.participantCount} {t ? t('participatingAgents') : 'Participating Agents'}
          </span>
          <span className="banner-pill rounds-pill">
            {t ? (t(`scenario_${scenarioKey}_rounds`) || activeScenario.estimatedRounds) : activeScenario.estimatedRounds}
          </span>

          <button
            type="button"
            onClick={handleReset}
            className="btn-reset-defaults"
            title="Reset all agent personalities to defaults"
          >
            <RotateCcw size={14} />
            <span>{t ? t('resetDefaults') : 'Reset Defaults'}</span>
          </button>
        </div>
      </div>

      {/* Validation Warning Alert (if user attempts to start with invalid configuration) */}
      {validationErrors.length > 0 && (
        <div className="scenario-alert scenario-alert-warning" role="alert" style={{ marginBottom: '24px' }}>
          <AlertCircle size={20} className="alert-icon" style={{ color: '#ef4444' }} />
          <div className="alert-content">
            <strong style={{ color: '#ef4444' }}>Configuration Validation Failed:</strong>
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              {validationErrors.map((err, idx) => (
                <li key={idx} style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Quick Status Notification Toast */}
      {notification && (
        <div className="agent-config-toast" role="status">
          <CheckCircle2 size={16} className="toast-icon" />
          <span>{notification}</span>
        </div>
      )}

      {/* Responsive Grid of Agent Role Cards */}
      <div className="agent-cards-grid" id="agent-cards-grid">
        {activeScenario.agents?.map((agent) => {
          const currentPersonality =
            agentPersonalities[agent.id] || agent.defaultPersonality;

          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentPersonality={currentPersonality}
              onPersonalityChange={handlePersonalityChange}
              scenarioAccent={activeScenario.accentColor}
            />
          );
        })}
      </div>

      {/* Dynamic Validation & Handover Status Box */}
      <div className="agent-validation-banner">
        <div className="validation-status-group">
          {currentValidation.isValid ? (
            <CheckCircle2 size={20} className="validation-success-icon" />
          ) : (
            <AlertCircle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          )}
          <div>
            <h4 className="validation-title">
              {currentValidation.isValid
                ? (t ? t('configValidatedTitle') : 'Configuration Validated & Ready for Simulation')
                : 'Configuration Incomplete'}
            </h4>
            <p className="validation-desc">
              {currentValidation.isValid
                ? (t ? t('configValidatedDesc') : `All ${activeScenario.participantCount} agent roles are parameter-mapped with bounded goals, operational constraints, and active negotiation personalities. Ready to initialize the Orchestrator Agent.`)
                : currentValidation.errors[0] || 'Please complete all required fields and select valid agent personalities.'}
            </p>
          </div>
        </div>

        <div className="validation-action-group">
          <button
            type="button"
            id="start-negotiation-btn"
            onClick={handleStartNegotiation}
            className={`btn-start-negotiation ${!currentValidation.isValid ? 'disabled' : ''}`}
            title={
              currentValidation.isValid
                ? 'Launch live negotiation simulation with current agent configuration'
                : currentValidation.errors.join('; ')
            }
          >
            <Play size={16} className="play-icon" />
            <span>{t ? t('startNegotiationArena') : 'Start Negotiation Arena'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentConfiguration;
