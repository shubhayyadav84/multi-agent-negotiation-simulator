import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Play, FileText, Users, Lightbulb, TrendingUp } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useSettings();

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div className="dashboard-page-container">
      {/* ==========================================================================
          Hero Banner Card
          ========================================================================== */}
      <div className="dashboard-hero-card">
        <div className="hero-ambient-glow" />

        {/* Left Column: Value Proposition & CTA */}
        <div className="hero-content-col">
          <div className="hero-pill-badge">
            <Sparkles size={14} className="hero-pill-icon" />
            <span>{t ? t('aiPoweredBadge') : 'AI-Powered Negotiation Training'}</span>
          </div>

          <h1 className="hero-title">
            <span>{t ? t('dashboardHeroTitleMain') : 'Simulate. Negotiate.'}</span>
            <span className="hero-title-accent">{t ? t('dashboardHeroTitleAccent') : 'Learn.'}</span>
          </h1>

          <p className="hero-description">
            {t
              ? t('dashboardHeroDesc')
              : 'An autonomous AI-powered simulation and training platform designed to study multi-stakeholder negotiation dynamics. Interact with intelligent agents, explore real-world scenarios, and develop your negotiation skills in a risk-free environment.'}
          </p>

          <button
            type="button"
            id="dashboard-get-started-btn"
            className="btn-hero-get-started"
            onClick={() => handleNavigate('/scenarios')}
          >
            <Play size={16} className="btn-hero-icon" />
            <span>{t ? t('getStarted') : 'Get Started'}</span>
          </button>
        </div>

        {/* Right Column: 3D Illustration & Floating Interactive Badges */}
        <div className="hero-art-col">
          <picture>
            <source srcSet="/images/dashboard/hero-card.webp" type="image/webp" />
            <img
              src="/images/dashboard/hero-card.png"
              alt="AI Negotiation Simulation Collaboration"
              className="hero-illustration-img"
              loading="eager"
              decoding="async"
            />
          </picture>

          {/* Floating animated ambient pills */}
          <div className="hero-floating-bubble bubble-left">
            <Lightbulb size={13} style={{ color: '#f59e0b' }} />
            <span>Strategy & Insight</span>
          </div>

          <div className="hero-floating-bubble bubble-right">
            <TrendingUp size={13} style={{ color: '#10b981' }} />
            <span>Real-time Analytics</span>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          Section Heading: Explore the Platform
          ========================================================================== */}
      <div className="dashboard-section-header">
        <h2 className="dashboard-section-title">
          {t ? t('explorePlatformTitle') : 'Explore the Platform'}
        </h2>
        <p className="dashboard-section-subtitle">
          {t
            ? t('explorePlatformSubtitle')
            : 'Choose a scenario, configure your agents, and experience intelligent negotiations.'}
        </p>
      </div>

      {/* ==========================================================================
          3 Workflow Step Cards
          ========================================================================== */}
      <div className="dashboard-steps-grid" id="dashboard-steps-grid">
        {/* Step 1: Scenario Selection */}
        <div
          id="dashboard-step-scenarios"
          className="dashboard-step-card"
          style={{
            '--step-accent': '#2563eb',
            '--step-bg': '#eff6ff',
            '--step-glow': 'rgba(37, 99, 235, 0.28)',
          }}
          onClick={() => handleNavigate('/scenarios')}
        >
          <div className="step-card-image-wrap">
            <span className="step-number-badge">1</span>
            <picture>
              <source srcSet="/images/dashboard/card1.webp" type="image/webp" />
              <img
                src="/images/dashboard/card1.png"
                alt="Scenario Selection"
                className="step-card-img"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>

          <div className="step-card-body">
            <div className="step-card-header">
              <div className="step-header-left">
                <div className="step-icon-wrap">
                  <FileText size={18} />
                </div>
                <h3 className="step-card-title">{t ? t('step1Title') : 'Scenario Selection'}</h3>
              </div>
            </div>

            <p className="step-card-desc">
              {t
                ? t('step1Desc')
                : 'Select predefined negotiation templates such as vendor pricing, job offers, or budget allocations to initialize context and boundary conditions.'}
            </p>
          </div>
        </div>

        {/* Step 2: Agent Configuration */}
        <div
          id="dashboard-step-agents"
          className="dashboard-step-card"
          style={{
            '--step-accent': '#7c3aed',
            '--step-bg': '#f5f3ff',
            '--step-glow': 'rgba(124, 58, 237, 0.28)',
          }}
          onClick={() => handleNavigate('/agents')}
        >
          <div className="step-card-image-wrap">
            <span
              className="step-number-badge"
              style={{ backgroundColor: '#7c3aed', '--step-accent': '#7c3aed' }}
            >
              2
            </span>
            <picture>
              <source srcSet="/images/dashboard/card2.webp" type="image/webp" />
              <img
                src="/images/dashboard/card2.png"
                alt="Agent Configuration"
                className="step-card-img"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>

          <div className="step-card-body">
            <div className="step-card-header">
              <div className="step-header-left">
                <div className="step-icon-wrap">
                  <Users size={18} />
                </div>
                <h3 className="step-card-title">{t ? t('step2Title') : 'Agent Configuration'}</h3>
              </div>
            </div>

            <p className="step-card-desc">
              {t
                ? t('step2Desc')
                : 'Review participating stakeholder roles and configure behavior personalities (Aggressive, Collaborative, or Risk-Averse).'}
            </p>
          </div>
        </div>

        {/* Step 3: Live Negotiation Arena */}
        <div
          id="dashboard-step-arena"
          className="dashboard-step-card"
          style={{
            '--step-accent': '#10b981',
            '--step-bg': '#ecfdf5',
            '--step-glow': 'rgba(16, 185, 129, 0.28)',
          }}
          onClick={() => handleNavigate('/arena')}
        >
          <div className="step-card-image-wrap">
            <span
              className="step-number-badge"
              style={{ backgroundColor: '#10b981', '--step-accent': '#10b981' }}
            >
              3
            </span>
            <picture>
              <source srcSet="/images/dashboard/card3.webp" type="image/webp" />
              <img
                src="/images/dashboard/card3.png"
                alt="Live Negotiation Arena"
                className="step-card-img"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>

          <div className="step-card-body">
            <div className="step-card-header">
              <div className="step-header-left">
                <div className="step-icon-wrap">
                  <Play size={18} />
                </div>
                <h3 className="step-card-title">{t ? t('step3Title') : 'Live Negotiation Arena'}</h3>
              </div>
            </div>

            <p className="step-card-desc">
              {t
                ? t('step3Desc')
                : 'Observe autonomous AI-vs-AI turn-taking and concessions, or step in directly to negotiate in Practice Mode with real-time feedback.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
