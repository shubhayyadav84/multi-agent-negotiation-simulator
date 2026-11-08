import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  GraduationCap,
  UserCheck,
  ShoppingBag,
  Users,
  PieChart,
  Clock,
  Target,
  Bot,
  Briefcase
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import './PracticeMode.css';

// Practice Mode scenario metadata customized for Human vs. AI training
const PRACTICE_SCENARIOS = [
  {
    id: 'vendor-pricing',
    name: 'Vendor Pricing Negotiation',
    image: '/images/practice/practice-vendor.jpeg',
    fallbackImage: '/images/practice/practice vendor.jpeg',
    category: 'Procurement & Supply Chain',
    accentColor: '#2563eb',
    icon: ShoppingBag,
    selectableSides: 'Buyer or Supplier (Vendor)',
    shortDescription:
      'Negotiate from either side of the table: step in as the enterprise procurement buyer seeking volume discounts, or as the supplier defending profit margins and net payment terms.',
    participantText: '1 Human Negotiator vs 1 AI Agent',
    estimatedRounds: '8 Rounds Dynamic',
    keyLevers: ['Unit Price (₹)', 'Payment Terms (Net Days)', 'Delivery SLA (Weeks)'],
    tacticalSkills: ['Anchoring & Framing', 'Volume Concessions', 'Contract Boundary Defense'],
  },
  {
    id: 'job-offer',
    name: 'Job Offer Negotiation',
    image: '/images/practice/practice-job.jpeg',
    fallbackImage: '/images/practice/practice job.jpeg',
    category: 'Talent & Executive Compensation',
    accentColor: '#10b981',
    icon: Briefcase,
    selectableSides: 'Candidate or Hiring Recruiter',
    shortDescription:
      'Practice compensation bargaining from your preferred perspective: play as the high-demand candidate pitching your market value, or as the hiring director balancing talent acquisition and payroll limits.',
    participantText: '1 Human Negotiator vs 1 AI Agent',
    estimatedRounds: '10 Rounds Dynamic',
    keyLevers: ['Base Salary (₹)', 'Sign-on Bonus (₹)', 'Equity (%)', 'Remote Days/Week'],
    tacticalSkills: ['Value Justification', 'Multi-Issue Tradeoffs', 'Counter-Proposal Packaging'],
  },
  {
    id: 'project-budget',
    name: 'Project Budget Allocation',
    image: '/images/practice/practice-project.jpeg',
    fallbackImage: '/images/practice/practice project.jpeg',
    category: 'Cross-Department Resource Management',
    accentColor: '#8b5cf6',
    icon: PieChart,
    selectableSides: 'Lead Software Engineer, Product Manager, or Marketing Director',
    shortDescription:
      'Step into an executive resource allocation summit. Negotiate as the Lead Software Engineer, Product Manager, or Marketing Director to defend your division\u2019s capital while reaching cross-functional compromise within a strict \u20b91 Crore ceiling.',
    participantText: '1 Human Lead vs AI Stakeholders',
    estimatedRounds: '12 Rounds Multilateral',
    keyLevers: ['Engineering Budget (₹)', 'Product & Design (₹)', 'Marketing & Growth (₹)'],
    tacticalSkills: ['Coalition Building', 'Pareto Optimization', 'Budget Defensibility'],
  },
];

const PracticeMode = () => {
  const location = useLocation();
  const { t } = useSettings();

  const [selectedId, setSelectedId] = useState(null);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (location.state?.error) {
      setValidationError(location.state.error);
    }
  }, [location.state]);

  const handleSelectScenario = (scenarioId) => {
    setSelectedId((prev) => (prev === scenarioId ? null : scenarioId));
    setValidationError('');
  };

  // Use window.location.href — guaranteed to navigate regardless of React Router state
  const handleContinue = (overrideId) => {
    const id = overrideId || selectedId || PRACTICE_SCENARIOS[0].id;
    window.location.href = `/practice-agents?scenario=${id}`;
  };

  const activeSelected = PRACTICE_SCENARIOS.find((s) => s.id === selectedId);

  return (
    <div className="practice-selection-page">
      {/* Header */}
      <div className="practice-page-header">
        <div className="practice-stepper-row">
          <div className="practice-stepper-badge">
            <GraduationCap size={15} />
            <span>Step 1 of 3 &bull; Practice Mode Scenario Selection</span>
          </div>
          <div className="practice-mode-pill">
            <UserCheck size={14} />
            <span>Interactive Human vs. AI Arena</span>
          </div>
        </div>

        <h1 className="practice-page-title">Choose Your Practice Negotiation Scenario</h1>
        <p className="practice-page-subtitle">
          Step into the arena as an active human negotiator. Choose a scenario below, then proceed
          to the configuration screen to select which role you wish to play (e.g. Buyer or Seller,
          Candidate or Recruiter) and configure your AI counterpart.
        </p>

        <div className="practice-highlights-strip">
          <div className="highlight-pill">
            <UserCheck size={14} className="highlight-icon" style={{ color: '#2563eb' }} />
            <span>Choose Any Role (Play Either Side)</span>
          </div>
          <div className="highlight-pill">
            <Bot size={14} className="highlight-icon" style={{ color: '#10b981' }} />
            <span>Adaptive AI Counterparties with Reasoning</span>
          </div>
          <div className="highlight-pill">
            <Target size={14} className="highlight-icon" style={{ color: '#8b5cf6' }} />
            <span>Explainable Post-Negotiation Scorecards</span>
          </div>
        </div>
      </div>

      {/* Validation Warning */}
      {validationError && (
        <div className="practice-alert practice-alert-warning" role="alert">
          <AlertCircle size={18} className="alert-icon" />
          <div className="alert-content">
            <strong>Selection Required:</strong> {validationError}
          </div>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => setValidationError('')}
            title="Dismiss"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Scenario Cards Grid */}
      <div className="practice-scenarios-grid">
        {PRACTICE_SCENARIOS.map((scenario) => {
          const isSelected = selectedId === scenario.id;
          const CategoryIcon = scenario.icon;

          return (
            <div
              key={scenario.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => handleSelectScenario(scenario.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectScenario(scenario.id);
                }
              }}
              className={`practice-card ${isSelected ? 'selected' : ''}`}
              id={`practice-card-${scenario.id}`}
              style={{ '--card-accent': scenario.accentColor }}
            >
              {isSelected && (
                <div className="practice-card-selected-tag">
                  <CheckCircle2 size={16} />
                  <span>Selected for Practice</span>
                </div>
              )}

              <div className="practice-card-image-wrap">
                <img
                  src={scenario.image}
                  alt={scenario.name}
                  className="practice-card-img"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    if (e.target.src !== scenario.fallbackImage) {
                      e.target.src = scenario.fallbackImage;
                    }
                  }}
                />
              </div>

              <div className="practice-card-inner">
                <div className="practice-category-pill">
                  <CategoryIcon size={14} className="category-pill-icon" />
                  <span>{scenario.category}</span>
                </div>

                <h3 className="practice-card-title">{scenario.name}</h3>
                <p className="practice-card-desc">{scenario.shortDescription}</p>

                <div className="practice-opponent-box">
                  <div className="opponent-role-row">
                    <span className="opponent-label">Available Roles:</span>
                    <span className="opponent-name">{scenario.selectableSides}</span>
                  </div>
                </div>

                <div className="practice-meta-row">
                  <div className="practice-meta-chip">
                    <Users size={14} className="meta-icon" />
                    <span>{scenario.participantText}</span>
                  </div>
                  <div className="practice-meta-chip">
                    <Clock size={14} className="meta-icon" />
                    <span>{scenario.estimatedRounds}</span>
                  </div>
                </div>

                <div className="practice-levers-section">
                  <span className="practice-levers-label">INTERACTIVE NEGOTIATION LEVERS:</span>
                  <div className="practice-levers-list">
                    {scenario.keyLevers.map((lever, idx) => (
                      <span key={idx} className="practice-lever-tag">{lever}</span>
                    ))}
                  </div>
                </div>

                <div className="practice-skills-section">
                  <span className="practice-skills-label">TACTICAL SKILLS PRACTICED:</span>
                  <div className="practice-skills-list">
                    {scenario.tacticalSkills.map((skill, idx) => (
                      <span key={idx} className="practice-skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>

                {/* Card-level action button */}
                <button
                  type="button"
                  className={`btn-practice-card-action ${isSelected ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      handleContinue(scenario.id);
                    } else {
                      handleSelectScenario(scenario.id);
                    }
                  }}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Proceed to Configure &rarr;</span>
                    </>
                  ) : (
                    <>
                      <span>Select Practice Scenario</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Action Bar — static, visible only after scrolling past cards ── */}
      <div className="practice-action-bar">
        <div className="practice-selection-status">
          {activeSelected ? (
            <div className="practice-status-selected-box">
              <CheckCircle2 size={20} style={{ color: activeSelected.accentColor }} />
              <div>
                <span className="status-label">Selected Scenario:</span>
                <span className="status-scenario-name">{activeSelected.name}</span>
                <span className="status-participants-pill">
                  Available Roles: {activeSelected.selectableSides}
                </span>
              </div>
            </div>
          ) : (
            <div className="practice-status-unselected-box">
              <span className="status-dot" />
              <span>No practice scenario selected. Click any card above to choose.</span>
            </div>
          )}
        </div>

        <div className="practice-cta-wrapper">
          {/* anchor-tag fallback guarantees navigation even if JS event is swallowed */}
          <a
            href={`/practice-agents?scenario=${selectedId || PRACTICE_SCENARIOS[0].id}`}
            className={`btn-practice-continue ${selectedId ? 'ready' : 'disabled'}`}
            id="continue-to-practice-config-btn"
            title={
              selectedId
                ? 'Proceed to select your role and configure negotiation agents'
                : 'Please select a practice scenario first'
            }
            onClick={(e) => {
              if (!selectedId) {
                e.preventDefault();
                setValidationError('Please select a practice scenario before proceeding.');
                document.getElementById('practice-card-vendor-pricing')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <span>Proceed to Role Selection &amp; Setup</span>
            <ArrowRight size={16} className="btn-icon" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default PracticeMode;
