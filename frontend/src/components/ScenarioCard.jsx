import React from 'react';
import {
  ShoppingBag,
  Users,
  PieChart,
  Clock,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const scenarioImageMap = {
  'vendor-pricing': '/images/scenarios/vendor-pricing.png',
  'job-offer': '/images/scenarios/job-offer.png',
  'project-budget': '/images/scenarios/project-budget.png',
};

const scenarioWebpMap = {
  'vendor-pricing': '/images/scenarios/vendor-pricing.webp',
  'job-offer': '/images/scenarios/job-offer.webp',
  'project-budget': '/images/scenarios/project-budget.webp',
};

const categoryIconMap = {
  'vendor-pricing': ShoppingBag,
  'job-offer': Users,
  'project-budget': PieChart,
};

const ScenarioCard = ({ scenario, isSelected, onSelect }) => {
  const { t } = useSettings();
  const CategoryIcon = categoryIconMap[scenario.id] || Sparkles;
  const scenarioImage = scenarioImageMap[scenario.id] || scenario.image;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(scenario.id);
    }
  };

  const scenarioKey = scenario.id.replace(/-/g, '_');
  const scenarioName = t ? (t(`scenario_${scenarioKey}_name`) || scenario.name) : scenario.name;
  const scenarioCategory = t ? (t(`scenario_${scenarioKey}_category`) || scenario.category) : scenario.category;
  const scenarioDesc = t ? (t(`scenario_${scenarioKey}_desc`) || scenario.shortDescription) : scenario.shortDescription;

  // Participant count matching reference design: 3 for project-budget, 2 for vendor/job
  const displayParticipantCount = scenario.id === 'project-budget' ? 3 : scenario.participantCount;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(scenario.id)}
      onKeyDown={handleKeyDown}
      className={`scenario-card ${isSelected ? 'selected' : ''}`}
      id={`scenario-card-${scenario.id}`}
      style={{
        '--card-accent': scenario.accentColor || '#2563eb'
      }}
    >
      {/* Top Illustration Banner */}
      <div className="scenario-card-image-wrap">
        <picture>
          {scenarioWebpMap[scenario.id] && (
            <source srcSet={scenarioWebpMap[scenario.id]} type="image/webp" />
          )}
          <img
            src={scenarioImage}
            alt={scenarioName}
            className="scenario-card-img"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>

      {/* Card Content Section */}
      <div className="scenario-card-inner">
        {/* Category Pill with Icon */}
        <div className="scenario-category-pill">
          <CategoryIcon size={14} className="category-pill-icon" />
          <span>{scenarioCategory}</span>
        </div>

        {/* Title & Description */}
        <h3 className="scenario-card-title">{scenarioName}</h3>
        <p className="scenario-card-desc">{scenarioDesc}</p>

        {/* Metadata Badges Row: Agents & Estimated Duration */}
        <div className="scenario-meta-row">
          <div className="scenario-meta-chip">
            <Users size={14} className="meta-icon" />
            <span>
              {displayParticipantCount} {t ? t('participatingAgents') : 'Participating Agents'}
            </span>
          </div>

          <div className="scenario-meta-chip">
            <Clock size={14} className="meta-icon" />
            <span>{t ? (t(`scenario_${scenarioKey}_rounds`) || scenario.estimatedRounds) : scenario.estimatedRounds}</span>
          </div>
        </div>

        {/* Key Negotiation Levers */}
        {scenario.keyLevers && scenario.keyLevers.length > 0 && (
          <div className="scenario-levers-section">
            <span className="scenario-levers-label">{t ? t('coreLevers') : 'CORE NEGOTIATION LEVERS:'}</span>
            <div className="scenario-levers-list">
              {scenario.keyLevers.map((lever, idx) => (
                <span key={idx} className="scenario-lever-tag">
                  {lever}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Selection Button */}
        <div className="scenario-card-footer">
          <button
            type="button"
            className={`scenario-select-btn ${isSelected ? 'btn-selected' : ''}`}
            title={isSelected ? (t ? t('clickToDeselect') : 'Click to deselect scenario') : (t ? t('selectScenario') : 'Click to select')}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(scenario.id);
            }}
          >
            {isSelected ? (
              <>
                <CheckCircle2 size={16} />
                <span>{t ? t('selectedContext') : 'Selected Scenario'}</span>
              </>
            ) : (
              <span>{t ? t('selectScenario') : 'Select Scenario'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioCard;
