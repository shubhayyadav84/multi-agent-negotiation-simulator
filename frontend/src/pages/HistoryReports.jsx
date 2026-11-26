import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  ArrowLeft,
  Bot,
  User,
  Users,
  Pause,
  Building2,
  Download,
  FileSpreadsheet,
  Code,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Target,
  Award,
  ChevronRight,
  Copy,
  Check,
  DollarSign,
  ShieldCheck,
  BarChart3,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import {
  listSimulations,
  getSimulationState,
  getTacticalRecommendations,
  getSimulationSummary,
  generateClientFallbackSummary,
} from '../services/simulationApi';
import { getStoredPracticeSessions } from './NegotiationAnalytics';
import SentimentJourneyTimeline from '../components/SentimentJourneyTimeline';
import './HistoryReports.css';

// Official supported scenarios
const OFFICIAL_SCENARIO_IDS = ['vendor-pricing', 'job-offer', 'project-budget'];


// Helper to determine simulation mode from metadata
function getSimulationModeLabel(sim) {
  if (!sim) return 'Agent vs Agent (Autonomous)';
  const rawMode = `${sim.simulation_mode || ''} ${sim.mode || ''}`.toLowerCase();
  const agents = sim.agents || [];
  const isPractice =
    rawMode.includes('practice') ||
    sim.is_practice === true ||
    (sim.id && String(sim.id).includes('practice')) ||
    agents.some(a => a.name?.toLowerCase().includes('human') || a.role?.toLowerCase().includes('human') || a.is_human || a.personality === 'Human');
  if (isPractice) {
    return 'Human vs Agent (Practice Mode)';
  }
  return 'Agent vs Agent (Autonomous)';
}

// Helper to parse vendor and buyer details
function getParticipants(sim) {
  const agents = sim.agents || [];
  if (agents.length >= 2) {
    const sid = (sim.scenario_id || '').toLowerCase();
    if (sid.includes('job')) {
      const recruiter = agents.find(a => {
        const k = `${a.id || ''} ${a.role || ''} ${a.name || ''}`.toLowerCase();
        return k.includes('hiring') || k.includes('recruiter') || k.includes('employer') || k.includes('manager');
      }) || agents[0];
      const candidate = agents.find(a => a !== recruiter) || agents[1];
      return { vendor: recruiter, buyer: candidate };
    }
  }

  const vendor = agents.find(a => {
    const k = `${a.id || ''} ${a.role || ''} ${a.name || ''}`.toLowerCase();
    return (
      k.includes('vendor') ||
      k.includes('seller') ||
      k.includes('provider') ||
      k.includes('recruiter') ||
      k.includes('hiring') ||
      k.includes('supplier') ||
      k.includes('marketing')
    );
  }) || agents[0] || {
    name: 'Enterprise Vendor Lead',
    role: 'Vendor',
    personality: 'Analytical',
    current_offer: null,
    stance: 'Active Participant',
  };

  const buyer = agents.find(a => {
    if (a === vendor) return false;
    const k = `${a.id || ''} ${a.role || ''} ${a.name || ''}`.toLowerCase();
    return (
      k.includes('buyer') ||
      k.includes('client') ||
      k.includes('candidate') ||
      k.includes('human') ||
      k.includes('procurement') ||
      k.includes('engineering')
    );
  }) || agents.find(a => a !== vendor) || agents[1] || {
    name: 'Procurement Specialist',
    role: 'Buyer',
    personality: 'Collaborative',
    current_offer: null,
    stance: 'Evaluating terms',
  };

  return { vendor, buyer };
}

// Formatting currency
function formatCurrency(val, currency = '₹') {
  if (val === null || val === undefined || isNaN(Number(val))) return '—';
  return `${currency}${Number(val).toLocaleString('en-IN')}`;
}

// Helper to determine if a simulation was left in between or ended early
function isLeftInBetween(sim) {
  if (!sim) return false;

  // 1. Explicitly left in between, paused, or running (abandoned/left in between without ending)
  if (sim.status === 'LEFT_IN_BETWEEN' || sim.status === 'PAUSED' || sim.status === 'RUNNING') {
    return true;
  }

  // 2. Transcript contains explicit leave in between message
  if (Array.isArray(sim.messages)) {
    const hasLeftMsg = sim.messages.some(
      (m) =>
        typeof m.message === 'string' &&
        (m.message.includes('User left in between') ||
          m.message.includes('Left in between') ||
          m.message.includes('ended early by user'))
    );
    if (hasLeftMsg) return true;
  }

  // 3. Deadlocks or Completed/Agreed negotiations are NOT left in between
  if (sim.status === 'DEADLOCK' || sim.status === 'COMPLETED' || sim.status === 'AGREEMENT_REACHED') {
    return false;
  }

  // Any other unfinished/interrupted status is Left in Between
  return true;
}

// Error Boundary to prevent full unmounting and catch render issues gracefully
class ReportErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ReportErrorBoundary] Caught render error in report:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '900px', margin: '40px auto', padding: '30px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '16px', color: '#991b1b', fontFamily: 'Inter, sans-serif' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 800 }}>Simulation Report View</h2>
          <p style={{ margin: '0 0 16px 0', color: '#7f1d1d' }}>A rendering exception was caught while formatting this report record:</p>
          <pre style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', overflowX: 'auto', fontSize: '12px', lineHeight: '1.5' }}>
            {this.state.error?.toString()}
          </pre>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={() => { window.location.href = '/history'; }}
              style={{ padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
            >
              ← Back to History List
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
              ↻ Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function HistoryReportsContent() {
  const navigate = useNavigate();
  const { simulationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useSettings();
  const { currentUser } = useAuth();

  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active selected simulation for the detailed report view
  const [selectedSim, setSelectedSim] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [coachingData, setCoachingData] = useState(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [coachingError, setCoachingError] = useState('');
  const [postSummary, setPostSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [sortBy, setSortBy] = useState('NEWEST');
  const [copiedId, setCopiedId] = useState(false);

  const reportPrintRef = useRef(null);

  // Load Simulations List: combines both Simulation Mode (Autonomous) and Practice Mode sessions
  const fetchSimulations = async () => {
    setLoading(true);
    setError(null);
    try {
      const userEmail = currentUser?.email || null;
      const userId = currentUser?.uid || null;
      const liveList = await listSimulations(userEmail, userId);

      // 1. Simulation Mode Sessions (strictly matching NegotiationAnalytics Simulation Mode: 32 sessions)
      let simulationSims = [];
      if (liveList && liveList.length > 0) {
        const userSims = liveList.filter(s => {
          if (!currentUser?.email && !currentUser?.uid) return true;
          if (currentUser?.email && s.user_email) {
            return s.user_email.toLowerCase() === currentUser.email.toLowerCase();
          }
          if (currentUser?.uid && s.user_id) {
            return s.user_id === currentUser.uid;
          }
          if (!s.user_email && !s.user_id) {
            return currentUser?.email?.toLowerCase() === 'shubhayyadav84@gmail.com';
          }
          return false;
        });

        simulationSims = userSims.filter(s => {
          const isPractice =
            s.mode === 'practice' ||
            s.is_practice === true ||
            (s.id && s.id.includes('practice')) ||
            (Array.isArray(s.agents) && s.agents.some((a) => a.personality === 'Human' || a.is_human === true));
          if (isPractice) return false;

          const sid = (s.scenario_id || '').toLowerCase();
          const title = (s.scenario_title || '').toLowerCase();
          if (title.includes('saas') || title.includes('lease') || title.includes('office space')) return false;

          const isVendor = sid === 'vendor-pricing' || title.includes('vendor');
          const isJob = sid === 'job-offer' || title.includes('job');
          const isProject = sid === 'project-budget' || title.includes('project');
          return isVendor || isJob || isProject;
        }).map(s => {
          const sid = (s.scenario_id || '').toLowerCase();
          const title = (s.scenario_title || '').toLowerCase();
          let cleanTitle = s.scenario_title;
          if (sid === 'vendor-pricing' || title.includes('vendor')) cleanTitle = 'Vendor Pricing Negotiation';
          else if (sid === 'job-offer' || title.includes('job')) cleanTitle = 'Job Offer Negotiation';
          else if (sid === 'project-budget' || title.includes('project')) cleanTitle = 'Project Budget Allocation';
          return { ...s, scenario_title: cleanTitle, is_practice: false, mode: 'simulation' };
        });
      }

      // 2. Practice Mode Sessions (strictly matching NegotiationAnalytics Practice Mode: 47 sessions)
      const storedPractice = getStoredPracticeSessions() || [];
      const practiceSims = storedPractice.map(p => {
        const sid = (p.scenario_id || '').toLowerCase();
        const title = (p.scenario_title || '').toLowerCase();
        let cleanTitle = p.scenario_title;
        if (sid === 'vendor-pricing' || title.includes('vendor')) cleanTitle = 'Vendor Pricing Negotiation';
        else if (sid === 'job-offer' || title.includes('job')) cleanTitle = 'Job Offer Negotiation';
        else if (sid === 'project-budget' || title.includes('project')) cleanTitle = 'Project Budget Allocation';
        return {
          ...p,
          scenario_title: cleanTitle,
          is_practice: true,
          mode: 'practice',
        };
      });

      // 3. Combined Sessions: Total count addition (Simulation Mode + Practice Mode)
      setSimulations([...simulationSims, ...practiceSims]);
    } catch (err) {
      console.warn('Failed to fetch simulations:', err);
      const storedPractice = getStoredPracticeSessions() || [];
      const practiceSims = storedPractice.map(p => ({ ...p, is_practice: true, mode: 'practice' }));
      setSimulations(practiceSims);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, [currentUser?.email, currentUser?.uid]);

  // Sync simulationId from URL params or search params
  const targetId = simulationId || searchParams.get('id');

  useEffect(() => {
    if (!targetId) {
      setSelectedSim(null);
      return;
    }

    const loadSingleSim = async () => {
      setLoadingDetail(true);
      // Check in existing list first
      const foundInState = simulations.find(s => s.id === targetId);
      if (foundInState && foundInState.messages && foundInState.messages.length > 0) {
        setSelectedSim(foundInState);
        setLoadingDetail(false);
        return;
      }

      // If it's a practice session with offers but no messages, synthesize messages so report loads smoothly
      if (foundInState && (foundInState.is_practice || foundInState.mode === 'practice' || String(foundInState.id).startsWith('practice-seed'))) {
        const syntheticMessages = (foundInState.messages && foundInState.messages.length > 0)
          ? foundInState.messages
          : (foundInState.offers || []).map((o, idx) => ({
              id: `msg_sync_${idx}`,
              round_number: o.round_number || 1,
              sender_role: o.agent_role,
              sender_name: o.agent_role,
              sender_type: o.is_human || /buyer|candidate|engineering/i.test(o.agent_role) ? 'HUMAN' : 'AGENT',
              offer_value: o.offer_value,
              action: idx === (foundInState.offers || []).length - 1 && (foundInState.status === 'AGREEMENT_REACHED' || foundInState.status === 'COMPLETED') ? 'ACCEPT' : 'COUNTER_OFFER',
              message: `Proposal submitted at ₹${Number(o.offer_value).toLocaleString()}.`,
            }));

        const hydrated = {
          ...foundInState,
          messages: syntheticMessages,
          agents: foundInState.agents && foundInState.agents.length > 0 ? foundInState.agents : [
            { role: foundInState.userRole || 'Human Participant', name: 'You', is_human: true, personality: 'Human' },
            { role: foundInState.opponentRole || 'AI Opponent', name: foundInState.opponentRole || 'AI', personality: foundInState.opponentPersonality || 'Collaborative' },
          ],
        };
        setSelectedSim(hydrated);
        setLoadingDetail(false);
        return;
      }

      // Otherwise fetch from backend API
      try {
        const fullSim = await getSimulationState(targetId);
        if (fullSim) {
          setSelectedSim(fullSim);
        } else if (foundInState) {
          setSelectedSim(foundInState);
        }
      } catch (err) {
        console.warn('Failed to load full simulation details:', err);
        if (foundInState) setSelectedSim(foundInState);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadSingleSim();
  }, [targetId, simulations]);
    // Load tactical coaching for the selected simulation
  useEffect(() => {
    if (!selectedSim?.id) {
      setCoachingData(null);
      setCoachingError('');
      return;
    }

    let cancelled = false;

    const loadCoaching = async () => {
      setCoachingLoading(true);
      setCoachingError('');
      setCoachingData(null);

      try {
        const recommendations = await getTacticalRecommendations(selectedSim.id);

        if (!cancelled) {
          setCoachingData(recommendations);
          if (!recommendations) {
            setCoachingError('Coaching recommendations are not available for this session.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCoachingError(err.message || 'Unable to load coaching recommendations.');
        }
      } finally {
        if (!cancelled) {
          setCoachingLoading(false);
        }
      }
    };

    loadCoaching();

    return () => {
      cancelled = true;
    };
  }, [selectedSim?.id]);

  // Load Post-Interaction Executive Summary (Member 1 Feature)
  useEffect(() => {
    if (!selectedSim?.id) {
      setPostSummary(null);
      return;
    }

    let cancelled = false;

    const loadSummary = async () => {
      setSummaryLoading(true);
      try {
        if (selectedSim.post_summary) {
          if (!cancelled) setPostSummary(selectedSim.post_summary);
          return;
        }

        const data = await getSimulationSummary(selectedSim.id);
        if (!cancelled) {
          setPostSummary(data || generateClientFallbackSummary(selectedSim));
        }
      } catch (err) {
        if (!cancelled) {
          setPostSummary(generateClientFallbackSummary(selectedSim));
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [selectedSim?.id]);

  // Helper to determine if selected session is Practice Mode
  const isPracticeMode = useMemo(() => {
    if (!selectedSim) return false;
    return Boolean(
      selectedSim.simulation_mode === 'PRACTICE' ||
      selectedSim.mode === 'practice' ||
      selectedSim.mode === 'PRACTICE' ||
      selectedSim.is_practice === true ||
      (selectedSim.id && String(selectedSim.id).includes('practice')) ||
      getSimulationModeLabel(selectedSim).toLowerCase().includes('practice') ||
      (Array.isArray(selectedSim.agents) && selectedSim.agents.some((a) => a.is_human || a.personality === 'Human' || /human|you/i.test(a.name)))
    );
  }, [selectedSim]);

  // Derived effective summary (loaded summary or instant client fallback)
  const effectiveSummary = useMemo(() => {
    if (!selectedSim) return null;
    try {
      const fallback = generateClientFallbackSummary(selectedSim) || {};
      const base = postSummary || selectedSim.post_summary || {};
      return {
        ...fallback,
        ...base,
        resolution_quality: base.resolution_quality || fallback.resolution_quality || null,
        strategic_agent_critique: base.strategic_agent_critique || fallback.strategic_agent_critique || null,
        outcome_analysis: {
          ...(fallback.outcome_analysis || {}),
          ...(base.outcome_analysis || {}),
        },
      };
    } catch (err) {
      console.warn('Failed to compute effective summary:', err);
      return postSummary || selectedSim.post_summary || null;
    }
  }, [selectedSim, postSummary]);
  // Handle selecting a simulation to view full report
  const handleSelectSimulation = (sim) => {
    setSearchParams({ id: sim.id });
    setSelectedSim(sim);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Back to history list
  const handleBackToList = () => {
    setSearchParams({});
    setSelectedSim(null);
  };

  // Copy ID
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Export as PDF / Print
  const handleExportPDF = () => {
    window.print();
  };

  // Filter & Sort Logic: Completed, Agreements, Paused, Left in Between, Deadlocks, or abandoned Running
  const filteredSimulations = useMemo(() => {
    return simulations.filter(sim => {
      // Include COMPLETED, AGREEMENT_REACHED, PAUSED, LEFT_IN_BETWEEN, DEADLOCK, and RUNNING (treated as Left in Between)
      const isAllowedStatus = sim.status === 'COMPLETED' ||
        sim.status === 'AGREEMENT_REACHED' ||
        sim.status === 'PAUSED' ||
        sim.status === 'LEFT_IN_BETWEEN' ||
        sim.status === 'DEADLOCK' ||
        sim.status === 'RUNNING';
      if (!isAllowedStatus) return false;

      const mode = getSimulationModeLabel(sim);
      const { vendor, buyer } = getParticipants(sim);
      const isEarlyLeft = isLeftInBetween(sim);

      // Mode filter
      if (filterMode === 'AUTONOMOUS' && !mode.includes('Autonomous')) return false;
      if (filterMode === 'PRACTICE' && !mode.includes('Practice')) return false;

      // Outcome filter: Agreement Reached, Deadlock, or Leave in Between
      if (filterOutcome === 'AGREEMENT') {
        if (isEarlyLeft || (sim.status !== 'AGREEMENT_REACHED' && sim.status !== 'COMPLETED')) return false;
      }
      if (filterOutcome === 'DEADLOCK' && sim.status !== 'DEADLOCK') return false;
      if (filterOutcome === 'LEFT_IN_BETWEEN' && !isEarlyLeft) return false;

      // Enhanced search query: multi-field, multi-token matching across all fields
      if (searchQuery.trim()) {
        const queryTokens = searchQuery.trim().toLowerCase().split(/\s+/);
        const statusText = isEarlyLeft ? 'leave in between left paused' : (sim.status || '').toLowerCase();
        const modeText = mode.toLowerCase();
        const scenarioTitle = (sim.scenario_title || '').toLowerCase();
        const scenarioId = (sim.scenario_id || '').toLowerCase();
        const simId = (sim.id || '').toLowerCase();
        const allAgents = (sim.agents || []).map(a => `${a.name || ''} ${a.role || ''} ${a.personality || ''} ${a.goal || ''}`).join(' ').toLowerCase();
        const vendorText = `${vendor.name || ''} ${vendor.role || ''} ${vendor.personality || ''}`.toLowerCase();
        const buyerText = `${buyer.name || ''} ${buyer.role || ''} ${buyer.personality || ''}`.toLowerCase();

        const corpus = `${scenarioTitle} ${scenarioId} ${simId} ${statusText} ${modeText} ${allAgents} ${vendorText} ${buyerText}`;

        const matches = queryTokens.every(token => corpus.includes(token));
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NEWEST') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'OLDEST') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sortBy === 'ROUNDS') return (b.current_round || 0) - (a.current_round || 0);
      return 0;
    });
  }, [simulations, searchQuery, filterMode, filterOutcome, sortBy]);

  // Aggregate statistics across completed and left-in-between simulations (Combines Simulation + Practice)
  const stats = useMemo(() => {
    const validSims = simulations.filter(s =>
      s.status === 'COMPLETED' ||
      s.status === 'AGREEMENT_REACHED' ||
      s.status === 'PAUSED' ||
      s.status === 'LEFT_IN_BETWEEN' ||
      s.status === 'DEADLOCK' ||
      s.status === 'RUNNING'
    );
    const total = validSims.length;
    const agreements = validSims.filter(s => (s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED') && !isLeftInBetween(s)).length;
    const deadlocks = validSims.filter(s => s.status === 'DEADLOCK').length;
    const leftInBetween = validSims.filter(s => isLeftInBetween(s)).length;
    const agreementRate = total > 0 ? Math.round((agreements / total) * 100) : 0;
    const avgRounds = total > 0
      ? (validSims.reduce((acc, curr) => acc + (curr.current_round || curr.rounds || 1), 0) / total).toFixed(1)
      : '0.0';

    const simulationCount = validSims.filter(s => !s.is_practice && s.mode !== 'practice').length;
    const practiceCount = validSims.filter(s => s.is_practice || s.mode === 'practice').length;

    return { total, agreements, deadlocks, leftInBetween, agreementRate, avgRounds, simulationCount, practiceCount };
  }, [simulations]);

  // Offer points for chart rendering
  const chartOffers = useMemo(() => {
    if (!selectedSim) return [];
    const messages = selectedSim.messages || [];
    const agents = selectedSim.agents || [];
    const points = [];

    const agent0Name = (agents[0]?.name || '').toLowerCase();
    const agent0Role = (agents[0]?.role || '').toLowerCase();

    messages.forEach(m => {
      let val = Number(m.offer_value);
      if ((!Number.isFinite(val) || val <= 0) && m.terms) {
        val = Number(m.terms.engineering || m.terms.marketing || m.terms.product || m.terms.salary || m.terms.price || 0);
      }
      if (Number.isFinite(val) && val > 0) {
        const sRole = (m.sender_role || '').toLowerCase();
        const sName = (m.sender_name || '').toLowerCase();

        const isVendorExplicit = sRole.includes('vendor') ||
          sRole.includes('seller') ||
          sRole.includes('provider') ||
          sRole.includes('recruiter') ||
          sRole.includes('hiring') ||
          sRole.includes('landlord');

        let isSide1 = isVendorExplicit;
        if (!isSide1 && agents.length >= 2) {
          if (sName.includes(agent0Name) || sRole.includes(agent0Role)) {
            isSide1 = true;
          }
        }

        points.push({
          round: m.round_number || 1,
          senderName: m.sender_name,
          role: isSide1 ? 'Vendor' : 'Buyer',
          offer: val,
          action: m.action,
        });
      }
    });

    return points;
  }, [selectedSim]);

  // Render Mode Badge Component
  const renderModeBadge = (modeStr) => {
    if (modeStr.includes('Practice')) {
      return (
        <span className="mode-badge mode-badge-practice">
          <User size={12} />
          <span>Human vs Agent (Practice)</span>
        </span>
      );
    }
    return (
      <span className="mode-badge mode-badge-autonomous">
        <Bot size={12} />
        <span>Agent vs Agent (Autonomous)</span>
      </span>
    );
  };

  // Render Status Badge Component
  const renderStatusBadge = (simOrStatus) => {
    const isEarly = typeof simOrStatus === 'object' && simOrStatus ? isLeftInBetween(simOrStatus) : (simOrStatus === 'LEFT_IN_BETWEEN' || simOrStatus === 'PAUSED');

    if (isEarly) {
      return (
        <span className="status-badge status-warning">
          <Pause size={13} />
          <span>Leave in Between</span>
        </span>
      );
    }
    const status = typeof simOrStatus === 'string' ? simOrStatus : simOrStatus?.status;
    if (status === 'DEADLOCK') {
      return (
        <span className="status-badge status-danger">
          <XCircle size={13} />
          <span>Deadlock</span>
        </span>
      );
    }
    if (status === 'AGREEMENT_REACHED' || status === 'COMPLETED') {
      return (
        <span className="status-badge status-success">
          <CheckCircle2 size={13} />
          <span>Agreement Reached</span>
        </span>
      );
    }
    return (
      <span className="status-badge status-warning">
        <Pause size={13} />
        <span>Leave in Between</span>
      </span>
    );
  };

  return (
    <div className="history-page-container">
      {/* Loading state when fetching specific simulation details */}
      {loadingDetail && !selectedSim ? (
        <div className="report-loading-container" style={{ textAlign: 'center', padding: '90px 20px', background: 'var(--bg-card, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
          <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary, #6366f1)', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 8px 0' }}>Loading Simulation Audit Report...</h2>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: 0 }}>Fetching telemetry, counterparty profiles, and complete transcript.</p>
        </div>
      ) : targetId && !loadingDetail && !selectedSim ? (
        <div className="report-notfound-container" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card, #ffffff)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <AlertTriangle size={36} style={{ color: '#d97706', marginBottom: '12px' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 8px 0' }}>Simulation Report Not Found</h2>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: '0 0 20px 0' }}>The requested simulation ID could not be loaded or was cleared.</p>
          <button type="button" className="btn-back-to-list" onClick={handleBackToList}>
            <ArrowLeft size={16} />
            <span>Back to Negotiation History</span>
          </button>
        </div>
      ) : selectedSim ? (
        <div className="report-detail-wrapper" ref={reportPrintRef}>
          {/* Top Navigation & Action Bar */}
          <div className="report-top-bar no-print">
            {searchParams.get('from') === 'arena' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-back-to-list"
                  onClick={() => {
                    const simId = selectedSim?.id || searchParams.get('id');
                    if (simId) {
                      sessionStorage.setItem('viewing_report_sim_id', simId);
                    }
                    navigate('/arena', {
                      state: {
                        restoreSession: true,
                        simId: simId,
                        scenarioId: selectedSim?.scenario_id,
                      }
                    });
                  }}
                  title="Return to the active Negotiation Arena"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Negotiation Arena</span>
                </button>
                <button
                  type="button"
                  className="btn-back-to-list"
                  onClick={handleBackToList}
                  style={{ opacity: 0.75 }}
                  title="View all past negotiation records"
                >
                  <span>All History</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-back-to-list"
                onClick={handleBackToList}
              >
                <ArrowLeft size={16} />
                <span>Back to History</span>
              </button>
            )}

            {/* Download Options */}
            {/* Download Option: PDF Report only */}
            <div className="report-actions-group">
              <button
                type="button"
                className="btn-report-action btn-pdf"
                onClick={handleExportPDF}
                title="Download formatted executive PDF report"
              >
                <Download size={15} />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Report Header Card */}

          <div className="report-header-card">
            <div className="report-header-main">
              <div className="report-meta-tags">
                {renderModeBadge(getSimulationModeLabel(selectedSim))}
                {renderStatusBadge(selectedSim)}
                <span className="round-pill">
                  <Clock size={13} />
                  Round {selectedSim.current_round || 1} of {selectedSim.max_rounds || 10}
                </span>
              </div>

              <h1 className="report-scenario-title">
                {selectedSim.scenario_title || 'Autonomous Negotiation Simulation'}
              </h1>

              <div className="report-id-bar">
                <span className="report-id-label">Simulation ID:</span>
                <code className="report-id-code">{selectedSim.id}</code>
                <button
                  type="button"
                  className="btn-copy-id"
                  onClick={() => handleCopyId(selectedSim.id)}
                  title="Copy Simulation ID"
                >
                  {copiedId ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
                <span className="report-timestamp">
                  Recorded on {new Date(selectedSim.created_at || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Executive KPI Cards */}
          <div className="report-kpi-grid">
            <div className="report-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-value">
                <DollarSign size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-title">Settlement Value</span>
                <span className="kpi-value">
                  {selectedSim.agreement
                    ? formatCurrency(selectedSim.agreement.final_value, selectedSim.currency)
                    : selectedSim.status === 'DEADLOCK'
                    ? 'No Deal (Deadlock)'
                    : formatCurrency(selectedSim.agents?.[0]?.current_offer || selectedSim.current_gap, selectedSim.currency)}
                </span>
                <span className="kpi-subtext">
                  {selectedSim.agreement ? 'Contract Agreement Finalized' : 'Final offer evaluated'}
                </span>
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-convergence">
                <TrendingUp size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-title">Agreement Likelihood</span>
                <span className="kpi-value">{selectedSim.agreement_likelihood || 50}%</span>
                <span className="kpi-subtext">
                  {selectedSim.agreement_likelihood > 80 ? 'High Synergy' : 'Moderate Friction'}
                </span>
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-rounds">
                <Clock size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-title">Rounds to Converge</span>
                <span className="kpi-value">{selectedSim.current_round || 1}</span>
                <span className="kpi-subtext">
                  {selectedSim.messages?.length || 0} Total Strategy Turns
                </span>
              </div>
            </div>

            <div className="report-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-vendor">
                {isPracticeMode ? <Award size={20} /> : <Building2 size={20} />}
              </div>
              <div className="kpi-info">
                <span className="kpi-title">{isPracticeMode ? 'Resolution Quality' : 'Vendor Stance'}</span>
                <span className="kpi-value">
                  {isPracticeMode
                    ? `${effectiveSummary?.resolution_quality?.overall_score || 85}/100`
                    : (getParticipants(selectedSim).vendor.personality || 'Analytical')}
                </span>
                <span className="kpi-subtext text-truncate">
                  {isPracticeMode
                    ? (effectiveSummary?.resolution_quality?.badge || 'Evaluation Completed')
                    : (getParticipants(selectedSim).vendor.stance || 'Final round position')}
                </span>
              </div>
            </div>
          </div>

          {/* Post-Interaction Executive Summary Agent (Milestone 4 - Member 1 Feature) */}
          {effectiveSummary && (
            <div className="report-summary-card" style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px' }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Post-Interaction Executive Summary</h2>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Generated by Autonomous Summary Agent Engine • {effectiveSummary.mode || (isPracticeMode ? 'Practice Mode (Human vs AI)' : 'Simulation Mode (AI vs AI)')}
                    </span>
                  </div>
                </div>
                <span style={{
                  background: effectiveSummary.outcome === 'AGREEMENT_REACHED' ? '#dcfce7' : '#fee2e2',
                  color: effectiveSummary.outcome === 'AGREEMENT_REACHED' ? '#15803d' : '#b91c1c',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '20px'
                }}>
                  {effectiveSummary.outcome}
                </span>
              </div>

              {/* Participant Roles & Opening-to-Closing Offers Comparison */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem' }}>
                  {isPracticeMode ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          👤 Human Participant (You)
                        </span>
                        <span style={{ color: '#475569' }}>
                          Role: <strong>{selectedSim.user_role || (getParticipants(selectedSim).buyer?.is_human ? getParticipants(selectedSim).buyer?.role : (getParticipants(selectedSim).buyer?.role || getParticipants(selectedSim).vendor?.role))}</strong>
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          🤖 AI Counterpart
                        </span>
                        <span style={{ color: '#475569' }}>
                          Role: <strong>{getParticipants(selectedSim).vendor?.is_human ? getParticipants(selectedSim).buyer?.name : getParticipants(selectedSim).vendor?.name}</strong> ({getParticipants(selectedSim).vendor?.personality || 'Collaborative'})
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          🤖 Agent 1
                        </span>
                        <span style={{ color: '#475569' }}>
                          <strong>{getParticipants(selectedSim).vendor?.name}</strong> ({getParticipants(selectedSim).vendor?.role}, {getParticipants(selectedSim).vendor?.personality || 'Analytical'})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          🤖 Agent 2
                        </span>
                        <span style={{ color: '#475569' }}>
                          <strong>{getParticipants(selectedSim).buyer?.name}</strong> ({getParticipants(selectedSim).buyer?.role}, {getParticipants(selectedSim).buyer?.personality || 'Collaborative'})
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Executive Narrative */}
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #3b82f6', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e3a8a', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Executive Narrative</h3>
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: '1.6' }}>{effectiveSummary.executive_narrative}</p>
              </div>

              {/* Opening Bids & Concession Audit Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Opening Bids */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={15} color="#2563eb" />
                    <span>Opening Anchor Positions</span>
                  </h4>
                  {effectiveSummary.opening_bids?.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {effectiveSummary.opening_bids.map((b, idx) => (
                        <li key={idx}>
                          <strong>{b.agent_name} ({b.agent_role}):</strong> Anchor offer {formatCurrency(b.offer_value, selectedSim.currency)} in Round {b.round_number}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>Opening positions recorded at initial turn.</p>
                  )}
                </div>

                {/* Practice Insights or Concession Milestones */}
                {effectiveSummary.practice_insights ? (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={15} color="#8b5cf6" />
                      <span>Human Bargaining Trajectory</span>
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '8px' }}>
                      <strong>Assessed Style:</strong> <span style={{ color: '#7c3aed', fontWeight: 600 }}>{effectiveSummary.practice_insights.style_assessment}</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {effectiveSummary.practice_insights.pivotal_decision_points?.map((p, idx) => (
                        <li key={idx}>
                          <strong>Round {p.round} ({p.title}):</strong> {p.impact}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={15} color="#10b981" />
                      <span>Key Concession Milestones</span>
                    </h4>
                    {effectiveSummary.concession_milestones?.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {effectiveSummary.concession_milestones.slice(0, 3).map((m, idx) => (
                          <li key={idx}>
                            <strong>Round {m.round} ({m.agent_name}):</strong> {m.direction} by {formatCurrency(m.concession_amount, selectedSim.currency)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>Consistent positioning maintained throughout rounds.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Negotiation Resolution Quality Score (Milestone 4 - Strictly Practice Mode Only) */}
          {isPracticeMode && effectiveSummary?.resolution_quality && (
            <div className="report-resolution-quality-card">
              <div className="quality-score-header">
                <div className="quality-header-title-wrap">
                  <div className="quality-header-icon">
                    <Award size={22} />
                  </div>
                  <div>
                    <h2 className="quality-header-title">Negotiation Resolution Quality Score</h2>
                    <span className="quality-header-subtitle">
                      Practice Mode Multi-Factor Evaluation (Goal Achievement 30% · Agreement Status 25% · Negotiation Effectiveness 25% · Concession Management 20%)
                    </span>
                  </div>
                </div>

                <div className="quality-score-badge-wrap">
                  <span className="quality-score-val">{effectiveSummary.resolution_quality.overall_score}</span>
                  <span className="quality-score-max">/100</span>
                  <span className={`quality-badge-pill ${
                    effectiveSummary.resolution_quality.overall_score >= 85
                      ? 'quality-badge-optimal'
                      : effectiveSummary.resolution_quality.overall_score >= 70
                      ? 'quality-badge-proficient'
                      : effectiveSummary.resolution_quality.overall_score >= 50
                      ? 'quality-badge-developing'
                      : 'quality-badge-impasse'
                  }`}>
                    {effectiveSummary.resolution_quality.badge}
                  </span>
                </div>
              </div>

              {/* 4 Factor Breakdown */}
              <div className="quality-factors-grid">
                {(() => {
                  const rawFactors = effectiveSummary.resolution_quality.factors;
                  const factorList = Array.isArray(rawFactors)
                    ? rawFactors
                    : Object.entries(rawFactors || {}).map(([key, f]) => ({
                        name: f.label || f.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        weight: f.weight || 25,
                        score: f.score || 0,
                        weighted_score: f.weighted_score ?? Math.round(((f.score || 0) * (f.weight || 25)) / 100),
                        description: f.description || `Evaluation of ${f.label || key} performance.`,
                      }));

                  return factorList.map((f, idx) => {
                    const fillClass = idx === 0 ? 'quality-fill-emerald' : idx === 1 ? 'quality-fill-indigo' : idx === 2 ? 'quality-fill-blue' : 'quality-fill-purple';
                    return (
                      <div key={idx} className="quality-factor-card">
                        <div className="quality-factor-header">
                          <span className="quality-factor-title">{f.name}</span>
                          <span className="quality-factor-weight">{f.weight}% Weight</span>
                        </div>
                        <div className="quality-factor-score-wrap">
                          <span className="quality-factor-score">{f.score}/100</span>
                          <span className="quality-factor-points">+{f.weighted_score} pts</span>
                        </div>
                        <div className="quality-progress-track">
                          <div className={`quality-progress-fill ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, f.score || 0))}%` }} />
                        </div>
                        <p className="quality-factor-desc">{f.description}</p>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Scoring Explanation */}
              <div className="quality-explanation-box">
                <h4>Scoring Audit & Assessment Rationale</h4>
                <p>{effectiveSummary.resolution_quality.explanation}</p>
              </div>

              {/* Strengths & Weaknesses Grid */}
              <div className="quality-insights-grid">
                <div className="quality-strengths-box">
                  <h4>
                    <CheckCircle2 size={16} />
                    <span>Factors Enhancing Resolution Score</span>
                  </h4>
                  <ul>
                    {(() => {
                      const raw = effectiveSummary.resolution_quality.strengths;
                      const list = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
                      return list.map((str, sIdx) => (
                        <li key={sIdx}>{String(str)}</li>
                      ));
                    })()}
                  </ul>
                </div>
                <div className="quality-weaknesses-box">
                  <h4>
                    <AlertTriangle size={16} />
                    <span>Factors Limiting Resolution Score</span>
                  </h4>
                  <ul>
                    {(() => {
                      const raw = effectiveSummary.resolution_quality.weaknesses;
                      const list = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
                      return list.map((w, wIdx) => (
                        <li key={wIdx}>{String(w)}</li>
                      ));
                    })()}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Comparative Analysis (Milestone 4 - Strictly Simulation Mode Only, Zero Numerical Scores) */}
          {!isPracticeMode && effectiveSummary?.strategic_agent_critique && (
            <div className="report-strategic-critique-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ background: '#ede9fe', color: '#7c3aed', padding: '10px', borderRadius: '12px' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    Strategic Comparative Analysis: Autonomous Agent Decision Quality
                  </h2>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Qualitative comparative evaluation of autonomous agent strategic choices, anchoring firmness, and concession pacing.
                  </span>
                </div>
              </div>

              {/* Better Agent Feature Banner */}
              <div className="critique-winner-banner">
                <div className="critique-winner-title">Comparative Strategic Advantage</div>
                <div className="critique-winner-name">
                  🏆 Top Strategist: {effectiveSummary.strategic_agent_critique.better_agent}
                </div>
                <p className="critique-rationale">
                  {effectiveSummary.strategic_agent_critique.rationale}
                </p>
              </div>

              {/* Qualitative Dimensions Grid */}
              <div className="critique-dimensions-grid">
                {(() => {
                  const raw = effectiveSummary.strategic_agent_critique.comparative_dimensions;
                  const list = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
                  return list.map((dim, dIdx) => (
                    <div key={dIdx} className="critique-dim-card">
                      <h4 className="critique-dim-title">
                        <Target size={16} color="#7c3aed" />
                        <span>{dim.dimension}</span>
                      </h4>
                      <div className="critique-dim-evals">
                        <div className="critique-eval-row">
                          <strong>Agent 1:</strong> {dim.agent1_eval}
                        </div>
                        <div className="critique-eval-row">
                          <strong>Agent 2:</strong> {dim.agent2_eval}
                        </div>
                      </div>
                      <div className="critique-dim-advantage">
                        Strategic Advantage: {dim.advantage}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Final Negotiation Outcome Analysis (Milestone 4 - Both Modes) */}
          {effectiveSummary?.outcome_analysis && (
            <div className="report-outcome-analysis-card">
              <div className="outcome-header">
                <div className="outcome-title-wrap">
                  <div className="outcome-icon">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="outcome-title">Final Negotiation Outcome & Settlement Analysis</h2>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Post-session contract evaluation and goal achievement audit
                    </span>
                  </div>
                </div>

                <span className={`outcome-pill ${
                  String(effectiveSummary.outcome_analysis.outcome_type || '').includes('Agreement')
                    ? 'outcome-pill-success'
                    : String(effectiveSummary.outcome_analysis.outcome_type || '').includes('Failed')
                    ? 'outcome-pill-failed'
                    : 'outcome-pill-impasse'
                }`}>
                  {effectiveSummary.outcome_analysis.outcome_type || 'Concluded'}
                </span>
              </div>

              {/* 4 Metric Columns */}
              <div className="outcome-metrics-grid">
                <div className="outcome-metric-card">
                  <span className="outcome-metric-label">Settlement Price</span>
                  <span className="outcome-metric-val">
                    {effectiveSummary.outcome_analysis.final_price
                      ? formatCurrency(effectiveSummary.outcome_analysis.final_price, selectedSim.currency)
                      : 'No Deal (Deadlock)'}
                  </span>
                  <span className="outcome-metric-sub">
                    {effectiveSummary.outcome_analysis.final_price ? 'Binding Terms Finalized' : 'Impasse reached without convergence'}
                  </span>
                </div>

                <div className="outcome-metric-card">
                  <span className="outcome-metric-label">Buyer / Client Limits</span>
                  <span className="outcome-metric-val" style={{ fontSize: '1.05rem' }}>
                    {formatCurrency(effectiveSummary.outcome_analysis.buyer_limits?.target ?? effectiveSummary.outcome_analysis.buyer_target ?? getParticipants(selectedSim).buyer?.target_value, selectedSim.currency)}
                  </span>
                  <span className="outcome-metric-sub">
                    Reservation Limit: {formatCurrency(effectiveSummary.outcome_analysis.buyer_limits?.reservation ?? effectiveSummary.outcome_analysis.buyer_reservation ?? getParticipants(selectedSim).buyer?.reservation_value, selectedSim.currency)}
                  </span>
                </div>

                <div className="outcome-metric-card">
                  <span className="outcome-metric-label">Seller / Vendor Limits</span>
                  <span className="outcome-metric-val" style={{ fontSize: '1.05rem' }}>
                    {formatCurrency(effectiveSummary.outcome_analysis.seller_limits?.target ?? effectiveSummary.outcome_analysis.seller_target ?? getParticipants(selectedSim).vendor?.target_value, selectedSim.currency)}
                  </span>
                  <span className="outcome-metric-sub">
                    Reservation Floor: {formatCurrency(effectiveSummary.outcome_analysis.seller_limits?.reservation ?? effectiveSummary.outcome_analysis.seller_reservation ?? getParticipants(selectedSim).vendor?.reservation_value, selectedSim.currency)}
                  </span>
                </div>

                <div className="outcome-metric-card">
                  <span className="outcome-metric-label">Goal Realization Status</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {isPracticeMode ? (
                      <>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: (effectiveSummary.outcome_analysis.human_goal_achieved ?? effectiveSummary.outcome_analysis.human_achieved_goal) ? '#16a34a' : '#d97706' }}>
                          Human User: {(effectiveSummary.outcome_analysis.human_goal_achieved ?? effectiveSummary.outcome_analysis.human_achieved_goal) ? 'Target Achieved ✅' : 'Below Aspiration ⚠️'}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: (effectiveSummary.outcome_analysis.ai_goal_achieved ?? effectiveSummary.outcome_analysis.ai_achieved_goal) ? '#16a34a' : '#d97706' }}>
                          AI Opponent: {(effectiveSummary.outcome_analysis.ai_goal_achieved ?? effectiveSummary.outcome_analysis.ai_achieved_goal) ? 'Target Achieved ✅' : 'Conceded ⚠️'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: effectiveSummary.outcome_analysis.buyer_goal_achieved ? '#16a34a' : '#d97706' }}>
                          Buyer Agent: {effectiveSummary.outcome_analysis.buyer_goal_achieved ? 'Goal Achieved ✅' : 'Below Target ⚠️'}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: effectiveSummary.outcome_analysis.seller_goal_achieved ? '#16a34a' : '#d97706' }}>
                          Seller Agent: {effectiveSummary.outcome_analysis.seller_goal_achieved ? 'Goal Achieved ✅' : 'Below Target ⚠️'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Reason Box */}
              <div className="outcome-reason-box">
                <h4>Primary Driver of Negotiation Outcome</h4>
                <p>{effectiveSummary.outcome_analysis.primary_reason || effectiveSummary.outcome_analysis.reason || 'Negotiation concluded.'}</p>
                <span>{effectiveSummary.outcome_analysis.details || ''}</span>
              </div>
            </div>
          )}

          {/* Participants Breakdown: Vendor & Buyer Cards */}
          <div className="report-participants-section">
            <h2 className="section-heading">
              <Users size={18} />
              <span>Counterparty Profiles & Concession Stances</span>
            </h2>

            <div className="participants-grid">
              {/* Vendor Profile Card */}
              <div className="participant-card participant-vendor">
                <div className="participant-header">
                  <div className="participant-badge-pill badge-vendor">
                    <Building2 size={13} />
                    <span>Vendor / Counterparty</span>
                  </div>
                  <span className="personality-pill">
                    {getParticipants(selectedSim).vendor.personality || 'Collaborative'}
                  </span>
                </div>

                <div className="participant-body">
                  <h3 className="participant-name">
                    {getParticipants(selectedSim).vendor.name}
                  </h3>
                  <p className="participant-role">
                    Role: {getParticipants(selectedSim).vendor.role}
                  </p>

                  <div className="participant-metrics-row">
                    <div className="p-metric">
                      <span className="p-metric-label">Opening / Target Ask</span>
                      <span className="p-metric-val">
                        {formatCurrency(getParticipants(selectedSim).vendor.target_value, selectedSim.currency)}
                      </span>
                    </div>
                    <div className="p-metric">
                      <span className="p-metric-label">Reservation Price</span>
                      <span className="p-metric-val">
                        {formatCurrency(getParticipants(selectedSim).vendor.reservation_value, selectedSim.currency)}
                      </span>
                    </div>
                    <div className="p-metric">
                      <span className="p-metric-label">Closing Offer</span>
                      <span className="p-metric-val text-vendor">
                        {formatCurrency(getParticipants(selectedSim).vendor.current_offer, selectedSim.currency)}
                      </span>
                    </div>
                  </div>

                  {getParticipants(selectedSim).vendor.goal && (
                    <div className="participant-goal-box">
                      <strong>Goal:</strong> {getParticipants(selectedSim).vendor.goal}
                    </div>
                  )}

                  {getParticipants(selectedSim).vendor.stance && (
                    <div className="participant-stance-box">
                      <strong>Current Stance:</strong> {getParticipants(selectedSim).vendor.stance}
                    </div>
                  )}
                </div>
              </div>

              {/* Buyer Profile Card */}
              <div className="participant-card participant-buyer">
                <div className="participant-header">
                  <div className="participant-badge-pill badge-buyer">
                    <User size={13} />
                    <span>Buyer / Client</span>
                  </div>
                  <span className="personality-pill">
                    {getParticipants(selectedSim).buyer.personality || 'Collaborative'}
                  </span>
                </div>

                <div className="participant-body">
                  <h3 className="participant-name">
                    {getParticipants(selectedSim).buyer.name}
                  </h3>
                  <p className="participant-role">
                    Role: {getParticipants(selectedSim).buyer.role}
                  </p>

                  <div className="participant-metrics-row">
                    <div className="p-metric">
                      <span className="p-metric-label">Opening Target Bid</span>
                      <span className="p-metric-val">
                        {formatCurrency(getParticipants(selectedSim).buyer.target_value, selectedSim.currency)}
                      </span>
                    </div>
                    <div className="p-metric">
                      <span className="p-metric-label">Reservation Budget</span>
                      <span className="p-metric-val">
                        {formatCurrency(getParticipants(selectedSim).buyer.reservation_value, selectedSim.currency)}
                      </span>
                    </div>
                    <div className="p-metric">
                      <span className="p-metric-label">Closing Bid</span>
                      <span className="p-metric-val text-buyer">
                        {formatCurrency(getParticipants(selectedSim).buyer.current_offer, selectedSim.currency)}
                      </span>
                    </div>
                  </div>

                  {getParticipants(selectedSim).buyer.goal && (
                    <div className="participant-goal-box">
                      <strong>Goal:</strong> {getParticipants(selectedSim).buyer.goal}
                    </div>
                  )}

                  {getParticipants(selectedSim).buyer.stance && (
                    <div className="participant-stance-box">
                      <strong>Current Stance:</strong> {getParticipants(selectedSim).buyer.stance}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Convergence Timeline / Concession Chart */}
          {chartOffers.length > 1 && (
            <div className="report-chart-section">
              <h2 className="section-heading">
                <BarChart3 size={18} />
                <span>Price Convergence & Concession Progression</span>
              </h2>

              <div className="concession-chart-container">
                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-dot dot-vendor" /> Vendor Asks
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot dot-buyer" /> Buyer Bids
                  </span>
                  {selectedSim.agreement && (
                    <span className="legend-item">
                      <span className="legend-dot dot-deal" /> Final Agreement
                    </span>
                  )}
                </div>

                {/* SVG Visual Step Progression Chart */}
                <div className="chart-svg-wrapper">
                  <svg viewBox="0 0 700 220" className="concession-svg" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="vendorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="buyerGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    <line x1="50" y1="30" x2="670" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                    <line x1="50" y1="90" x2="670" y2="90" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                    <line x1="50" y1="150" x2="670" y2="150" stroke="rgba(255,255,255,0.08)" strokeDasharray="4" />
                    <line x1="50" y1="190" x2="670" y2="190" stroke="rgba(255,255,255,0.15)" />

                    {/* Dynamic Step points calculated */}
                    {(() => {
                      const maxVal = Math.max(...chartOffers.map(o => o.offer)) * 1.05;
                      const minVal = Math.min(...chartOffers.map(o => o.offer)) * 0.95;
                      const range = maxVal - minVal || 1;
                      const stepX = 600 / Math.max(chartOffers.length - 1, 1);

                      const pointsCoords = chartOffers.map((o, idx) => {
                        const x = 60 + idx * stepX;
                        const y = 180 - ((o.offer - minVal) / range) * 140;
                        return { ...o, x, y };
                      });

                      const vendorPoints = pointsCoords.filter(p => p.role === 'Vendor');
                      const buyerPoints = pointsCoords.filter(p => p.role === 'Buyer');

                      return (
                        <>
                          {/* Vendor Curve */}
                          {vendorPoints.length > 1 && (
                            <path
                              d={vendorPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')}
                              fill="none"
                              stroke="#8b5cf6"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          )}

                          {/* Buyer Curve */}
                          {buyerPoints.length > 1 && (
                            <path
                              d={buyerPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          )}

                          {/* Dots */}
                          {pointsCoords.map((pt, i) => (
                            <g key={i}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r="5"
                                fill={pt.role === 'Vendor' ? '#8b5cf6' : '#10b981'}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              <text
                                x={pt.x}
                                y={pt.role === 'Vendor' ? pt.y - 10 : pt.y + 18}
                                fill="#ffffff"
                                fontSize="10"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                {formatCurrency(pt.offer, selectedSim.currency)}
                              </text>
                              <text
                                x={pt.x}
                                y="208"
                                fill="rgba(255,255,255,0.5)"
                                fontSize="10"
                                textAnchor="middle"
                              >
                                R{pt.round}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Sentiment Journey Timeline & Emotional Trajectory Visualizer (Member 2 Feature) */}
          {selectedSim.messages && selectedSim.messages.length > 0 && (
            <div className="report-sentiment-section">
              <SentimentJourneyTimeline simulation={selectedSim} />
            </div>
          )}

          {/* Tactical Coaching Recommendations (Member 3 Feature - Strictly Practice Mode Only) */}
          {isPracticeMode && (
            <section className="report-coaching-section" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <div className="report-coaching-heading">
                <Sparkles size={20} />
                <h2>Personalized Tactical Coaching</h2>
              </div>

              {coachingLoading && (
                <p>Loading coaching recommendations...</p>
              )}

              {coachingError && (
                <p className="coaching-error">{coachingError}</p>
              )}

              {(() => {
                if (coachingLoading) return null;

                const allParticipants = coachingData?.participants || [];
                // In Practice Mode, strictly isolate and display ONLY the human user's selected role
                const humanMatches = allParticipants.filter((p) =>
                  p.is_human === true ||
                  (p.name && /human|you/i.test(p.name)) ||
                  (p.display_role && p.display_role.includes('(You)')) ||
                  (p.role && p.role.includes('(You)'))
                );

                const userRoleStr = (
                  selectedSim?.user_role ||
                  selectedSim?.userRole ||
                  selectedSim?.agents?.find((a) => a.is_human || a.personality === 'Human' || /human|you/i.test(a.name))?.role ||
                  'Candidate'
                );

                let displayedParticipant = humanMatches.length > 0 ? humanMatches[0] : null;
                if (!displayedParticipant && allParticipants.length > 0) {
                  const roleMatch = allParticipants.find((p) =>
                    (p.role || '').toLowerCase().includes(userRoleStr.toLowerCase()) ||
                    (p.name || '').toLowerCase().includes(userRoleStr.toLowerCase())
                  );
                  displayedParticipant = roleMatch || allParticipants[0];
                }

                const rawRole = displayedParticipant?.role || userRoleStr || 'Negotiator';
                const cleanRole = rawRole.replace(/\s*\((You|Human)\)$/i, '').trim();
                const cardTitle = `${cleanRole} (You)`;
                const cardSubtitle = `${cleanRole} · Human Negotiator`;

                // --- DATA-DRIVEN COACHING GENERATOR ---
                // Extracts real numerical bids, round steps, and terms across all 3 scenarios
                const scenarioId = String(selectedSim?.scenario_id || selectedSim?.scenarioId || '').toLowerCase();
                const scenarioTitle = String(selectedSim?.scenario_title || selectedSim?.title || '').toLowerCase();
                const isVendor = scenarioId.includes('vendor') || scenarioTitle.includes('vendor') || scenarioTitle.includes('pricing');
                const isJob = scenarioId.includes('job') || scenarioTitle.includes('job') || scenarioTitle.includes('offer');

                const allMsgs = selectedSim?.messages || [];
                const humanMsgs = allMsgs.filter((m) =>
                  m.sender_type === 'HUMAN' ||
                  (m.sender_role && m.sender_role.includes('(You)')) ||
                  (m.sender_name && /you|human/i.test(m.sender_name))
                );
                const aiMsgs = allMsgs.filter((m) => m.sender_type === 'AGENT' && !humanMsgs.includes(m));

                const humanOffers = (humanMsgs.length > 0 ? humanMsgs : allMsgs.filter((m) => (m.sender_role || '').toLowerCase().includes(cleanRole.toLowerCase())))
                  .map((m) => ({ value: Number(m.offer_value), round: m.round_number || 1, message: m.message || '', terms: m.terms || {} }))
                  .filter((o) => Number.isFinite(o.value) && o.value > 0);

                const aiOffers = aiMsgs
                  .map((m) => ({ value: Number(m.offer_value), round: m.round_number || 1, message: m.message || '' }))
                  .filter((o) => Number.isFinite(o.value) && o.value > 0);

                const firstHuman = humanOffers[0]?.value;
                const lastHuman = humanOffers[humanOffers.length - 1]?.value;
                const lastAi = aiOffers[aiOffers.length - 1]?.value;
                const totalRounds = selectedSim?.current_round || humanOffers.length || 1;
                const isDeadlock = selectedSim?.status === 'DEADLOCK';
                const isAgreed = selectedSim?.status === 'AGREEMENT_REACHED' || selectedSim?.status === 'COMPLETED';

                const dataDrivenImprovements = [];

                if (isVendor) {
                  // Scenario 1: Vendor Pricing Negotiation
                  const isBuyerRole = /buyer|procurement|client/i.test(cleanRole);
                  if (isBuyerRole) {
                    if (firstHuman && firstHuman >= 105000) {
                      dataDrivenImprovements.push(`Anchor Conservatism: Your initial offer of ₹${firstHuman.toLocaleString()} was only ₹${(115000 - firstHuman).toLocaleString()} below your ₹115,000 ceiling. Anchoring closer to the ₹90,000 target gives you 20% more bargaining headroom.`);
                    } else if (firstHuman) {
                      dataDrivenImprovements.push(`Opening Anchor: Opened at ₹${firstHuman.toLocaleString()}. To improve surplus, hold this anchor for at least two rounds before making upward concessions.`);
                    }
                    for (let i = 1; i < humanOffers.length; i++) {
                      const jump = humanOffers[i].value - humanOffers[i - 1].value;
                      if (jump > 5000) {
                        dataDrivenImprovements.push(`Rapid Concession: In Round ${humanOffers[i].round}, your offer surged by ₹${jump.toLocaleString()} (${Math.round((jump / humanOffers[i - 1].value) * 100)}%). Concede in smaller increments (e.g. ₹2,000–₹3,000) to avoid signaling budget flexibility.`);
                        break;
                      }
                    }
                    const hasNet60 = humanMsgs.some((m) => /net-60|payment|warranty|volume|sla/i.test(m.message));
                    if (!hasNet60) {
                      dataDrivenImprovements.push(`Single-Dimension Haggling: All ${humanOffers.length || 1} offers focused solely on price. Require Net-60 payment terms or SLA penalty clauses whenever conceding upward on unit price.`);
                    }
                  } else {
                    if (firstHuman && firstHuman <= 108000) {
                      dataDrivenImprovements.push(`Soft Opening Anchor: Your opening quote of ₹${firstHuman.toLocaleString()} was near your ₹95,000 floor. Quoting at ₹120,000+ signals premium quality and protects seller margin.`);
                    }
                    for (let i = 1; i < humanOffers.length; i++) {
                      const drop = humanOffers[i - 1].value - humanOffers[i].value;
                      if (drop > 6000) {
                        dataDrivenImprovements.push(`Rapid Margin Erosion: Dropped price by ₹${drop.toLocaleString()} in Round ${humanOffers[i].round}. Tie every discount to reciprocal buyer commitments such as larger lot sizes.`);
                        break;
                      }
                    }
                  }
                  if (isDeadlock && lastHuman && lastAi) {
                    dataDrivenImprovements.push(`Deadlock Impasse: Negotiation halted with a ₹${Math.abs(lastHuman - lastAi).toLocaleString()} gap between your offer of ₹${lastHuman.toLocaleString()} and counterpart's ₹${lastAi.toLocaleString()}. Propose a compromise split near ₹${Math.round((lastHuman + lastAi) / 2).toLocaleString()} to unlock deadlock.`);
                  } else if (isAgreed && lastHuman) {
                    dataDrivenImprovements.push(`Settlement Efficiency: Deal finalized at ₹${lastHuman.toLocaleString()} in Round ${totalRounds}. Countering once more in Round ${Math.max(1, totalRounds - 1)} could have captured ₹3,000–₹5,000 additional surplus.`);
                  }
                } else if (isJob) {
                  // Scenario 2: Job Offer Negotiation
                  const isCandidateRole = /candidate|applicant/i.test(cleanRole);
                  if (isCandidateRole) {
                    if (firstHuman && firstHuman <= 155000) {
                      dataDrivenImprovements.push(`Under-Anchoring: Your opening ask of ₹${firstHuman.toLocaleString()} was only ₹${(firstHuman - 140000).toLocaleString()} above your ₹140,000 baseline. Tech candidate opening bids should anchor at ₹175,000–₹185,000 to absorb recruiter counter-reductions.`);
                    } else if (firstHuman) {
                      dataDrivenImprovements.push(`Anchor Pacing: Established initial salary ask at ₹${firstHuman.toLocaleString()}. Pair this baseline with objective market compensation data.`);
                    }
                    for (let i = 1; i < humanOffers.length; i++) {
                      const drop = humanOffers[i - 1].value - humanOffers[i].value;
                      if (drop > 8000) {
                        dataDrivenImprovements.push(`Premature Salary Concession: In Round ${humanOffers[i].round}, your salary ask dropped by ₹${drop.toLocaleString()} (${Math.round((drop / humanOffers[i - 1].value) * 100)}%). Do not lower base salary without asking for equity or sign-on bonus.`);
                        break;
                      }
                    }
                    const hasEquityOrBonus = humanMsgs.some((m) => /equity|stock|options|bonus|remote|flexib|sign-on|appraisal/i.test(m.message));
                    if (!hasEquityOrBonus) {
                      dataDrivenImprovements.push(`Single-Dimension Focus: All ${humanOffers.length || 1} rounds focused exclusively on base salary. When recruiters reach fixed band caps, introduce sign-on bonuses, equity vesting acceleration, or remote days.`);
                    }
                  } else {
                    if (firstHuman && firstHuman >= 155000) {
                      dataDrivenImprovements.push(`High Recruiter Anchor: Opened at ₹${firstHuman.toLocaleString()}, leaving only ₹${(165000 - firstHuman).toLocaleString()} before reaching your ₹165,000 budget cap.`);
                    }
                    dataDrivenImprovements.push('Total Rewards Framing: Frame compensation around total annual value (performance bonus, learning stipend) to navigate candidate base salary resistance.');
                  }
                  if (isDeadlock && lastHuman && lastAi) {
                    dataDrivenImprovements.push(`Compensation Deadlock: Stalled with a ₹${Math.abs(lastHuman - lastAi).toLocaleString()} salary gap between your ask (₹${lastHuman.toLocaleString()}) and recruiter offer (₹${lastAi.toLocaleString()}). Offer a 6-month performance review to break salary impasses.`);
                  } else if (isAgreed && lastHuman) {
                    dataDrivenImprovements.push(`Compensation Capture: Concluded contract at ₹${lastHuman.toLocaleString()} in Round ${totalRounds}. Securing performance appraisal timelines in writing protects future trajectory.`);
                  }
                } else {
                  // Scenario 3: Project Budget Allocation
                  if (firstHuman && firstHuman >= 420000) {
                    dataDrivenImprovements.push(`High Initial Allocation Request: Opened requesting ₹${firstHuman.toLocaleString()} (${Math.round(firstHuman / 10000)}% of the total ₹1.0M budget). Demanding over 40% without explicit cross-team ROI justification prompts other leads to form defensive coalitions.`);
                  } else if (firstHuman) {
                    dataDrivenImprovements.push(`Department Allocation Baseline: Opened requesting ₹${firstHuman.toLocaleString()} for your department. Prepare cross-functional milestones to defend this allocation.`);
                  }
                  for (let i = 1; i < humanOffers.length; i++) {
                    const drop = humanOffers[i - 1].value - humanOffers[i].value;
                    if (drop > 15000) {
                      dataDrivenImprovements.push(`Department Concession Pace: Surrendered ₹${drop.toLocaleString()} of your department's allocation in Round ${humanOffers[i].round}. Tie funding concessions directly to deferred project milestones.`);
                      break;
                    }
                  }
                  const hasSplit = humanMsgs.some((m) => m.terms && (m.terms.marketing || m.terms.product || m.terms.engineering));
                  if (!hasSplit) {
                    dataDrivenImprovements.push('Siloed Budget Demands: Your proposals focused exclusively on your own department share. Proposing a complete 3-department split (Engineering, Marketing, Product AI) summing to ₹1,000,000 drives consensus faster.');
                  }
                  if (isDeadlock) {
                    dataDrivenImprovements.push(`Multilateral Deadlock: Cross-department budget stalled with conflicting demands exceeding the ₹1,000,000 organizational cap across ${totalRounds} rounds.`);
                  } else if (isAgreed && lastHuman) {
                    dataDrivenImprovements.push(`Budget Consensus: Concluded with ₹${lastHuman.toLocaleString()} allocated to your department (${Math.round(lastHuman / 10000)}% of total fund). Protect critical infrastructure milestones under this approved allocation.`);
                  }
                }

                // If backend returned non-generic items, merge with data-driven feedback
                const apiImprovements = (displayedParticipant?.areas_for_improvement || []).filter(
                  (item) => !item.toLowerCase().includes('no major issue was detected')
                );
                const finalImprovements = dataDrivenImprovements.length > 0 ? dataDrivenImprovements : (apiImprovements.length > 0 ? apiImprovements : [
                  'Concession Tapering: Make smaller, conditional counteroffers rather than flat concessions.',
                  'Multi-Issue Packaging: Bundle secondary preferences with primary targets to unlock negotiation surplus.',
                ]);

                const finalStrengths = (displayedParticipant?.strengths || []).length > 0
                  ? displayedParticipant.strengths
                  : [
                      `Made ${humanOffers.length || 1} measurable proposal${(humanOffers.length || 1) === 1 ? '' : 's'} during the session.`,
                      `Maintained active negotiation engagement across ${totalRounds} rounds.`,
                    ];

                const finalTakeaways = (displayedParticipant?.actionable_takeaways || []).length > 0
                  ? displayedParticipant.actionable_takeaways
                  : [
                      'Establish a firm initial anchor 15-20% beyond baseline expectations.',
                      'Require reciprocal concessions whenever modifying your offer.',
                      'Bundle multi-issue terms rather than negotiating on a single dimension.',
                    ];

                return (
                  <>
                    <div className="coaching-participant-card">
                      <div className="coaching-participant-meta">
                        <h3>{cardTitle}</h3>
                        <span>{cardSubtitle}</span>
                      </div>

                      <h4>Strengths</h4>
                      <ul>
                        {finalStrengths.map((item, i) => (
                          <li key={`strength-${i}`}>{item}</li>
                        ))}
                      </ul>

                      <h4>Areas for Improvement</h4>
                      <ul>
                        {finalImprovements.map((item, i) => (
                          <li key={`improvement-${i}`}>{item}</li>
                        ))}
                      </ul>

                      <h4>Actionable Recommendations</h4>
                      <ul>
                        {finalTakeaways.map((item, i) => (
                          <li key={`takeaway-${i}`}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {!coachingLoading && coachingData?.deadlock_recovery && (
                      <div className="coaching-deadlock-notice">
                        <strong>Deadlock Recovery Insight</strong>
                        <p>{coachingData.deadlock_recovery}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          {/* Turn-by-Turn Negotiation Transcript */}
          <div className="report-transcript-section">
            <h2 className="section-heading">
              <FileText size={18} />
              <span>Turn-by-Turn Negotiation Transcript</span>
            </h2>

            <div className="transcript-timeline">
              {(!selectedSim.messages || selectedSim.messages.length === 0) ? (
                <div className="empty-transcript-card">
                  <p>No messages recorded for this session yet.</p>
                </div>
              ) : (
                selectedSim.messages.map((msg, idx) => {
                  const isVendor = msg.sender_role?.toLowerCase().includes('vendor') ||
                    msg.sender_role?.toLowerCase().includes('seller') ||
                    msg.sender_role?.toLowerCase().includes('provider') ||
                    msg.sender_role?.toLowerCase().includes('recruiter');
                  const isOrchestrator = msg.sender_type === 'ORCHESTRATOR' || msg.sender_role?.toLowerCase().includes('orchestrator');

                  return (
                    <div
                      key={idx}
                      className={`transcript-message-item ${
                        isOrchestrator ? 'msg-orchestrator' : isVendor ? 'msg-vendor' : 'msg-buyer'
                      }`}
                    >
                      <div className="msg-sender-col">
                        <div className="msg-avatar-chip">
                          {isOrchestrator ? <Sparkles size={14} /> : isVendor ? <Building2 size={14} /> : <User size={14} />}
                        </div>
                        <span className="msg-round-tag">Round {msg.round_number || 1}</span>
                      </div>

                      <div className="msg-content-card">
                        <div className="msg-card-top">
                          <span className="msg-speaker-name">{msg.sender_name}</span>
                          <span className="msg-role-tag">
                            {msg.sender_role} {msg.personality ? `• ${msg.personality}` : ''}
                          </span>

                          {msg.action && (
                            <span className={`msg-action-pill action-${msg.action.toLowerCase()}`}>
                              {msg.action}
                            </span>
                          )}

                          {msg.offer_value !== null && msg.offer_value !== undefined && msg.offer_value > 0 && (
                            <span className="msg-offer-pill">
                              {formatCurrency(msg.offer_value, selectedSim.currency || msg.currency)}
                            </span>
                          )}
                        </div>

                        <p className="msg-dialogue-text">{msg.message}</p>

                        <div className="msg-card-foot">
                          <span className="msg-time">
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : `Turn #${idx + 1}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW B: SIMULATION HISTORY LIST VIEW                           */
        /* ============================================================== */
        <div className="history-list-wrapper">
          {/* Header & Stats Banner */}
          <div className="history-header">
            <div className="history-header-titles">
              <span className="history-kicker">
                <ShieldCheck size={14} />
                Audit Logs & Telemetry
              </span>
              <h1 className="history-main-title">Negotiation History & Reports</h1>
              <p className="history-subtitle">
                Inspect archived sessions, counterparty concession curves, vendor performance metrics, and complete turn-by-turn transcripts.
              </p>
            </div>

            <button
              type="button"
              className="btn-refresh-history"
              onClick={fetchSimulations}
              disabled={loading}
              title="Refresh simulation records from database"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="history-metrics-strip">
            <div className="metric-strip-item">
              <span className="metric-strip-num">{stats.total}</span>
              <span className="metric-strip-label">
                All Completed
                {stats.simulationCount > 0 && stats.practiceCount > 0 && (
                  <span style={{ display: 'block', fontSize: '0.74rem', opacity: 0.8, fontWeight: 500, marginTop: '2px' }}>
                    ({stats.simulationCount} Sim + {stats.practiceCount} Practice)
                  </span>
                )}
              </span>
            </div>
            <div className="metric-strip-item">
              <span className="metric-strip-num text-success">{stats.agreements}</span>
              <span className="metric-strip-label">Agreements Reached</span>
            </div>
            <div className="metric-strip-item">
              <span className="metric-strip-num text-warning">{stats.leftInBetween}</span>
              <span className="metric-strip-label">Leave in Between</span>
            </div>
            <div className="metric-strip-item">
              <span className="metric-strip-num text-danger">{stats.deadlocks}</span>
              <span className="metric-strip-label">Deadlocks</span>
            </div>
          </div>

          {/* Filter, Search & Sort Control Bar */}
          <div className="history-controls-bar">
            {/* Search Input */}
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search scenario, vendor, buyer, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter by Mode (Multi-Vendor removed, only Autonomous and Practice) */}
            <div className="filter-select-group">
              <label htmlFor="filter-mode" className="filter-label">Mode:</label>
              <select
                id="filter-mode"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Modes</option>
                <option value="AUTONOMOUS">Agent vs Agent (Autonomous)</option>
                <option value="PRACTICE">Human vs Agent (Practice)</option>
              </select>
            </div>

            {/* Filter by Outcome: All Completed, Agreement Reached, Deadlock, Leave in Between */}
            <div className="filter-select-group">
              <label htmlFor="filter-outcome" className="filter-label">Outcome:</label>
              <select
                id="filter-outcome"
                value={filterOutcome}
                onChange={(e) => setFilterOutcome(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Completed</option>
                <option value="AGREEMENT">Agreement Reached</option>
                <option value="DEADLOCK">Deadlock</option>
                <option value="LEFT_IN_BETWEEN">Leave in Between</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="filter-select-group">
              <label htmlFor="filter-sort" className="filter-label">Sort:</label>
              <select
                id="filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="ROUNDS">Most Rounds</option>
              </select>
            </div>
          </div>

          {/* List of Simulation Cards */}
          <div className="history-cards-grid">
            {loading && simulations.length === 0 ? (
              <div className="history-loading-box">
                <RefreshCw size={24} className="spin" />
                <p>Loading negotiation history...</p>
              </div>
            ) : filteredSimulations.length === 0 ? (
              <div className="history-empty-box">
                <FileText size={36} />
                {simulations.length === 0 ? (
                  <>
                    <h3>No Negotiations Recorded Yet</h3>
                    <p>
                      {currentUser?.email
                        ? `No negotiation sessions recorded for ${currentUser.email}. Launch a simulation in the Arena to start building your record.`
                        : 'Launch a simulation in the Arena to start building your negotiation record.'}
                    </p>
                    <button
                      type="button"
                      className="btn-clear-filters"
                      onClick={() => navigate('/arena')}
                    >
                      Start Negotiation in Arena
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No Matching Negotiations Found</h3>
                    <p>Try modifying your search term or clearing the active filters.</p>
                    <button
                      type="button"
                      className="btn-clear-filters"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterMode('ALL');
                        setFilterOutcome('ALL');
                      }}
                    >
                      Reset Filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredSimulations.map((sim) => {
                const modeLabel = getSimulationModeLabel(sim);
                const { vendor, buyer } = getParticipants(sim);
                const isEarly = isLeftInBetween(sim);
                const hasAgreement = (sim.status === 'AGREEMENT_REACHED' || sim.status === 'COMPLETED' || Boolean(sim.agreement?.final_value || sim.agreement?.agreed_value)) && !isEarly && sim.status !== 'DEADLOCK';

                return (
                  <div key={sim.id} className="history-card">
                    {/* Card Header: Mode & Status */}
                    <div className="history-card-top">
                      <div className="history-card-mode">
                        {renderModeBadge(modeLabel)}
                      </div>
                      <div className="history-card-status">
                        {renderStatusBadge(sim)}
                      </div>
                    </div>

                    {/* Scenario Title */}
                    <h3 className="history-card-title">{sim.scenario_title}</h3>

                    {/* Vendor & Counterparty Info Box */}
                    <div className="history-card-participants">
                      {/* Vendor Line */}
                      <div className="participant-line">
                        <span className="p-tag-badge vendor-tag">
                          <Building2 size={11} /> Vendor
                        </span>
                        <span className="p-title-name text-truncate" title={vendor.name}>
                          {vendor.name}
                        </span>
                        <span className="p-trait-pill">
                          {vendor.personality || 'Analytical'}
                        </span>
                      </div>

                      {/* Buyer Line */}
                      <div className="participant-line">
                        <span className="p-tag-badge buyer-tag">
                          <User size={11} /> Buyer
                        </span>
                        <span className="p-title-name text-truncate" title={buyer.name}>
                          {buyer.name}
                        </span>
                        <span className="p-trait-pill">
                          {buyer.personality || 'Collaborative'}
                        </span>
                      </div>
                    </div>

                    {/* Financial & Rounds Summary Bar */}
                    <div className="history-card-financials">
                      <div className="f-metric-block">
                        <span className="f-label">Final Deal / Spread</span>
                        <span className="f-val">
                          {hasAgreement
                            ? formatCurrency(sim.agreement?.final_value || sim.agreement?.agreed_value || vendor.current_offer, sim.currency)
                            : isEarly
                            ? 'Left in Between'
                            : sim.status === 'DEADLOCK'
                            ? 'Spread Unresolved'
                            : `Gap: ${formatCurrency(sim.current_gap, sim.currency)}`}
                        </span>
                      </div>

                      <div className="f-metric-block">
                        <span className="f-label">Convergence</span>
                        <span className="f-val text-muted">
                          Round {sim.current_round || 1} / {sim.max_rounds || 10}
                        </span>
                      </div>

                      <div className="f-metric-block">
                        <span className="f-label">Synergy</span>
                        <span className="f-val text-likelihood">
                          {isEarly ? '—' : `${sim.agreement_likelihood || 50}%`}
                        </span>
                      </div>
                    </div>

                    {/* Footer with Timestamp and Action */}
                    <div className="history-card-footer">
                      <span className="history-card-date">
                        <Clock size={12} />
                        {new Date(sim.created_at || Date.now()).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <button
                        type="button"
                        className="btn-view-report"
                        onClick={() => handleSelectSimulation(sim)}
                      >
                        <span>View Full Report</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryReports(props) {
  return (
    <ReportErrorBoundary>
      <HistoryReportsContent {...props} />
    </ReportErrorBoundary>
  );
}
