import React from 'react';
import {
  User,
  Target,
  ShieldAlert,
  Flame,
  Handshake,
  ShieldCheck,
  Info,
  Sparkles
} from 'lucide-react';
import {
  PERSONALITIES,
  PERSONALITY_DESCRIPTIONS
} from '../data/scenarios';
import { useSettings } from '../context/SettingsContext';
import AgentFaceAvatar from './AgentFaceAvatar';

const personalityIcons = {
  [PERSONALITIES.AGGRESSIVE]: Flame,
  [PERSONALITIES.COLLABORATIVE]: Handshake,
  [PERSONALITIES.RISK_AVERSE]: ShieldCheck
};

const personalityColorStyles = {
  [PERSONALITIES.AGGRESSIVE]: {
    border: '#f87171',
    bg: '#fef2f2',
    text: '#b91c1c',
    glow: 'rgba(239, 68, 68, 0.15)'
  },
  [PERSONALITIES.COLLABORATIVE]: {
    border: '#818cf8',
    bg: '#eef2ff',
    text: '#4338ca',
    glow: 'rgba(79, 70, 229, 0.15)'
  },
  [PERSONALITIES.RISK_AVERSE]: {
    border: '#34d399',
    bg: '#ecfdf5',
    text: '#047857',
    glow: 'rgba(16, 185, 129, 0.15)'
  }
};

const AgentCard = ({ agent, currentPersonality, onPersonalityChange, scenarioAccent }) => {
  const { t } = useSettings();
  const activePersonality = currentPersonality || agent.defaultPersonality;
  const ActiveIcon = personalityIcons[activePersonality] || Sparkles;
  const activeColor = personalityColorStyles[activePersonality] || personalityColorStyles[PERSONALITIES.COLLABORATIVE];

  const isDefault = activePersonality === agent.defaultPersonality;

  const agentKey = (agent.id || '').replace(/-/g, '_');
  const getTranslatedOrFallback = (key, fallback) => {
    if (!t) return fallback;
    const val = t(key);
    return (val && val !== key) ? val : fallback;
  };

  const agentName = getTranslatedOrFallback(`agent_${agentKey}_name`, agent.name);
  const agentStakeholder = getTranslatedOrFallback(`agent_${agentKey}_stakeholder`, agent.stakeholder);
  const agentRoleDesc = getTranslatedOrFallback(`agent_${agentKey}_role_desc`, agent.roleDescription);
  const agentPrimaryGoal = getTranslatedOrFallback(`agent_${agentKey}_primary_goal`, agent.primaryGoal);

  const getPersonalityLabel = (p) => {
    if (!t) return p;
    if (p === PERSONALITIES.AGGRESSIVE) return t('aggressive') || p;
    if (p === PERSONALITIES.COLLABORATIVE) return t('collaborative') || p;
    if (p === PERSONALITIES.RISK_AVERSE) return t('riskAverse') || p;
    return p;
  };

  const getPersonalityDesc = (p) => {
    if (!t) return PERSONALITY_DESCRIPTIONS[p];
    if (p === PERSONALITIES.AGGRESSIVE) return t('aggressive_desc') || PERSONALITY_DESCRIPTIONS[p];
    if (p === PERSONALITIES.COLLABORATIVE) return t('collaborative_desc') || PERSONALITY_DESCRIPTIONS[p];
    if (p === PERSONALITIES.RISK_AVERSE) return t('risk_averse_desc') || PERSONALITY_DESCRIPTIONS[p];
    return PERSONALITY_DESCRIPTIONS[p];
  };

  const getConstraintText = (constraint, idx) => {
    const rawFallback = typeof constraint === 'string'
      ? constraint
      : (constraint?.description || constraint?.text || '');
    return getTranslatedOrFallback(`agent_${agentKey}_constraint_${idx}`, rawFallback);
  };

  return (
    <div
      className="agent-role-card"
      id={`agent-card-${agent.id}`}
      style={{
        '--agent-theme-border': activeColor.border,
        '--agent-theme-glow': activeColor.glow
      }}
    >
      {/* Card Header: Avatar, Name, and Stakeholder */}
      <div className="agent-card-header">
        {/* Animated Face Avatar */}
        <AgentFaceAvatar agentId={agent.id} accentColor={scenarioAccent} />

        <div className="agent-identity">
          <div className="agent-stakeholder-badge">{agentStakeholder}</div>
          <h3 className="agent-name">{agentName}</h3>
        </div>
      </div>

      {/* Role Description */}
      <p className="agent-role-desc">{agentRoleDesc}</p>

      {/* Primary Goal / Objective Section */}
      <div className="agent-section-box agent-goal-box">
        <div className="agent-section-title">
          <Target size={15} className="section-icon goal-icon" />
          <span>{t ? t('primaryGoalTitle') : 'Primary Goal & Target'}</span>
        </div>
        <p className="agent-goal-text">{agentPrimaryGoal}</p>
      </div>

      {/* Key Constraints Section */}
      <div className="agent-section-box agent-constraint-box">
        <div className="agent-section-title">
          <ShieldAlert size={15} className="section-icon constraint-icon" />
          <span>{t ? t('keyConstraintsTitle') : 'Key Negotiation Constraints'}</span>
        </div>
        <ul className="agent-constraints-list">
          {agent.keyConstraints?.map((constraint, idx) => (
            <li key={idx} className="agent-constraint-item">
              <span className="constraint-bullet" />
              <span>{getConstraintText(constraint, idx)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Personality Selection Controls */}
      <div className="agent-personality-control-block">
        <div className="personality-control-header">
          <span className="personality-label">{t ? t('negotiationPersonality') : 'Negotiation Personality:'}</span>
          {isDefault ? (
            <span className="default-pill">{t ? t('defaultPreset') : 'Default Preset'}</span>
          ) : (
            <span className="custom-pill">{t ? t('userModified') : 'User Modified'}</span>
          )}
        </div>

        {/* 3 Personality Options Button Group */}
        <div className="personality-options-grid" role="radiogroup" aria-label="Negotiation Personality">
          {Object.values(PERSONALITIES).map((personality) => {
            const Icon = personalityIcons[personality];
            const isSelected = activePersonality === personality;
            const style = personalityColorStyles[personality];

            return (
              <button
                key={personality}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onPersonalityChange(agent.id, personality)}
                className={`personality-btn ${isSelected ? 'active' : ''}`}
                style={
                  isSelected
                    ? {
                        borderColor: style.border,
                        backgroundColor: style.bg,
                        color: style.text,
                        boxShadow: `0 0 0 2px ${style.border}, 0 4px 12px ${style.glow}`
                      }
                    : {}
                }
              >
                <Icon size={14} />
                <span>{getPersonalityLabel(personality)}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Behavioral Description Preview */}
        <div
          className="personality-behavior-preview"
          style={{
            backgroundColor: activeColor.bg,
            borderColor: activeColor.border,
            color: activeColor.text
          }}
        >
          <div className="behavior-header">
            <ActiveIcon size={14} />
            <strong>{getPersonalityLabel(activePersonality)} {t ? t('strategy') : 'Strategy'}:</strong>
          </div>
          <p className="behavior-text">
            {getPersonalityDesc(activePersonality)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
