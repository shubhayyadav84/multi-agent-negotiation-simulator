import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  CheckCircle2,
  Layers,
  Trophy,
  Users,
  Clock,
  Activity,
  BarChart3,
  Calendar,
  ChevronDown,
  Sparkles,
  RefreshCw,
  FileText,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  GraduationCap,
  Bot,
  User,
  Target,
  ArrowRightLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { listSimulations } from '../services/simulationApi';
import { AnalyticsPanels } from '../components/AnalyticsPanels';
import { personalityWinRates } from '../utils/analyticsMetrics';
import './NegotiationAnalytics.css';

// Helper to determine if a simulation was left in between or ended early (identical to HistoryReports)
function isLeftInBetween(sim) {
  if (!sim) return false;

  // 1. Explicitly left in between, paused, or running (left in between without ending)
  if (sim.status === 'LEFT_IN_BETWEEN' || sim.status === 'PAUSED' || sim.status === 'RUNNING') return true;

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

  // 3. Deadlocks or completed/agreed negotiations are NOT left in between
  if (sim.status === 'DEADLOCK' || sim.status === 'COMPLETED' || sim.status === 'AGREEMENT_REACHED') {
    return false;
  }

  // Any other unfinished/interrupted status is Left in Between
  return true;
}

// Retrieve stored practice mode sessions strictly isolated in localStorage
export function getStoredPracticeSessions() {
  try {
    const raw = localStorage.getItem('practice_mode_sessions');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse practice sessions from localStorage:', e);
  }

  // Realistic seed baseline so Practice Mode Analytics is immediately populated and useful
  const now = new Date();
  const currentIso = now.toISOString();
  return [
    {
      id: 'practice-seed-1',
      scenario_id: 'vendor-pricing',
      scenario_title: 'Vendor Pricing Negotiation',
      status: 'AGREEMENT_REACHED',
      current_round: 4,
      rounds: 4,
      score: 88,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Collaborative Archetype',
      userRole: 'Procurement Buyer',
      opponentRole: 'Enterprise Supplier',
      mode: 'practice',
      settlement_value: 104000,
      agents: [
        { role: 'Procurement Buyer', target_value: 90000, reservation_value: 115000 },
        { role: 'Enterprise Supplier', target_value: 120000, reservation_value: 95000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Procurement Buyer', offer_value: 90000 },
        { round_number: 1, agent_role: 'Enterprise Supplier', offer_value: 120000 },
        { round_number: 2, agent_role: 'Procurement Buyer', offer_value: 96000 },
        { round_number: 2, agent_role: 'Enterprise Supplier', offer_value: 115000 },
        { round_number: 3, agent_role: 'Procurement Buyer', offer_value: 101000 },
        { round_number: 3, agent_role: 'Enterprise Supplier', offer_value: 109000 },
        { round_number: 4, agent_role: 'Procurement Buyer', offer_value: 104000 },
        { round_number: 4, agent_role: 'Enterprise Supplier', offer_value: 104000 },
      ],
    },
    {
      id: 'practice-seed-2',
      scenario_id: 'vendor-pricing',
      scenario_title: 'Vendor Pricing Negotiation',
      status: 'AGREEMENT_REACHED',
      current_round: 5,
      rounds: 5,
      score: 82,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Analytical Strategist',
      userRole: 'Procurement Buyer',
      opponentRole: 'Enterprise Supplier',
      mode: 'practice',
      settlement_value: 105500,
      agents: [
        { role: 'Procurement Buyer', target_value: 85000, reservation_value: 115000 },
        { role: 'Enterprise Supplier', target_value: 125000, reservation_value: 95000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Procurement Buyer', offer_value: 85000 },
        { round_number: 1, agent_role: 'Enterprise Supplier', offer_value: 125000 },
        { round_number: 2, agent_role: 'Procurement Buyer', offer_value: 92000 },
        { round_number: 2, agent_role: 'Enterprise Supplier', offer_value: 118000 },
        { round_number: 3, agent_role: 'Procurement Buyer', offer_value: 98000 },
        { round_number: 3, agent_role: 'Enterprise Supplier', offer_value: 112000 },
        { round_number: 4, agent_role: 'Procurement Buyer', offer_value: 103000 },
        { round_number: 4, agent_role: 'Enterprise Supplier', offer_value: 107000 },
        { round_number: 5, agent_role: 'Procurement Buyer', offer_value: 105500 },
        { round_number: 5, agent_role: 'Enterprise Supplier', offer_value: 105500 },
      ],
    },
    {
      id: 'practice-seed-3',
      scenario_id: 'job-offer',
      scenario_title: 'Job Offer Negotiation',
      status: 'AGREEMENT_REACHED',
      current_round: 3,
      rounds: 3,
      score: 92,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Pragmatic Conceder',
      userRole: 'Candidate',
      opponentRole: 'Hiring Manager',
      mode: 'practice',
      settlement_value: 145000,
      agents: [
        { role: 'Candidate', target_value: 165000, reservation_value: 125000 },
        { role: 'Hiring Manager', target_value: 125000, reservation_value: 165000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Candidate', offer_value: 165000 },
        { round_number: 1, agent_role: 'Hiring Manager', offer_value: 125000 },
        { round_number: 2, agent_role: 'Candidate', offer_value: 155000 },
        { round_number: 2, agent_role: 'Hiring Manager', offer_value: 135000 },
        { round_number: 3, agent_role: 'Candidate', offer_value: 145000 },
        { round_number: 3, agent_role: 'Hiring Manager', offer_value: 145000 },
      ],
    },
    {
      id: 'practice-seed-4',
      scenario_id: 'job-offer',
      scenario_title: 'Job Offer Negotiation',
      status: 'DEADLOCK',
      current_round: 6,
      rounds: 6,
      score: 40,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Aggressive Anchor',
      userRole: 'Candidate',
      opponentRole: 'Hiring Manager',
      mode: 'practice',
      agents: [
        { role: 'Candidate', target_value: 180000, reservation_value: 140000 },
        { role: 'Hiring Manager', target_value: 110000, reservation_value: 130000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Candidate', offer_value: 180000 },
        { round_number: 1, agent_role: 'Hiring Manager', offer_value: 110000 },
        { round_number: 2, agent_role: 'Candidate', offer_value: 175000 },
        { round_number: 2, agent_role: 'Hiring Manager', offer_value: 115000 },
        { round_number: 3, agent_role: 'Candidate', offer_value: 170000 },
        { round_number: 3, agent_role: 'Hiring Manager', offer_value: 118000 },
        { round_number: 4, agent_role: 'Candidate', offer_value: 168000 },
        { round_number: 4, agent_role: 'Hiring Manager', offer_value: 120000 },
        { round_number: 5, agent_role: 'Candidate', offer_value: 165000 },
        { round_number: 5, agent_role: 'Hiring Manager', offer_value: 120000 },
        { round_number: 6, agent_role: 'Candidate', offer_value: 165000 },
        { round_number: 6, agent_role: 'Hiring Manager', offer_value: 120000 },
      ],
    },
    {
      id: 'practice-seed-5',
      scenario_id: 'project-budget',
      scenario_title: 'Project Budget Allocation',
      status: 'AGREEMENT_REACHED',
      current_round: 5,
      rounds: 5,
      score: 85,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Risk-Averse Defensive',
      userRole: 'Engineering Lead',
      opponentRole: 'Product Director',
      mode: 'practice',
      settlement_value: 390000,
      agents: [
        { role: 'Engineering Lead', target_value: 450000, reservation_value: 350000 },
        { role: 'Marketing Lead', target_value: 350000, reservation_value: 250000 },
        { role: 'Product Director', target_value: 300000, reservation_value: 200000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Engineering Lead', offer_value: 450000, terms: { engineering: 450000, marketing: 300000, product: 250000 } },
        { round_number: 1, agent_role: 'Marketing Lead', offer_value: 350000, terms: { engineering: 400000, marketing: 350000, product: 250000 } },
        { round_number: 1, agent_role: 'Product Director', offer_value: 300000, terms: { engineering: 400000, marketing: 300000, product: 300000 } },
        { round_number: 2, agent_role: 'Engineering Lead', offer_value: 435000, terms: { engineering: 435000, marketing: 315000, product: 250000 } },
        { round_number: 2, agent_role: 'Marketing Lead', offer_value: 340000, terms: { engineering: 405000, marketing: 340000, product: 255000 } },
        { round_number: 2, agent_role: 'Product Director', offer_value: 295000, terms: { engineering: 405000, marketing: 300000, product: 295000 } },
        { round_number: 3, agent_role: 'Engineering Lead', offer_value: 415000, terms: { engineering: 415000, marketing: 320000, product: 265000 } },
        { round_number: 3, agent_role: 'Marketing Lead', offer_value: 330000, terms: { engineering: 405000, marketing: 330000, product: 265000 } },
        { round_number: 3, agent_role: 'Product Director', offer_value: 290000, terms: { engineering: 400000, marketing: 310000, product: 290000 } },
        { round_number: 4, agent_role: 'Engineering Lead', offer_value: 400000, terms: { engineering: 400000, marketing: 320000, product: 280000 } },
        { round_number: 4, agent_role: 'Marketing Lead', offer_value: 325000, terms: { engineering: 395000, marketing: 325000, product: 280000 } },
        { round_number: 4, agent_role: 'Product Director', offer_value: 285000, terms: { engineering: 395000, marketing: 320000, product: 285000 } },
        { round_number: 5, agent_role: 'Engineering Lead', offer_value: 390000, terms: { engineering: 390000, marketing: 325000, product: 285000 } },
        { round_number: 5, agent_role: 'Marketing Lead', offer_value: 325000, terms: { engineering: 390000, marketing: 325000, product: 285000 } },
        { round_number: 5, agent_role: 'Product Director', offer_value: 285000, terms: { engineering: 390000, marketing: 325000, product: 285000 } },
      ],
    },
    {
      id: 'practice-seed-6',
      scenario_id: 'vendor-pricing',
      scenario_title: 'Vendor Pricing Negotiation',
      status: 'AGREEMENT_REACHED',
      current_round: 4,
      rounds: 4,
      score: 80,
      created_at: currentIso,
      updated_at: currentIso,
      opponentPersonality: 'Collaborative Archetype',
      userRole: 'Procurement Buyer',
      opponentRole: 'Enterprise Supplier',
      mode: 'practice',
      settlement_value: 105000,
      agents: [
        { role: 'Procurement Buyer', target_value: 92000, reservation_value: 114000 },
        { role: 'Enterprise Supplier', target_value: 118000, reservation_value: 96000 },
      ],
      offers: [
        { round_number: 1, agent_role: 'Procurement Buyer', offer_value: 92000 },
        { round_number: 1, agent_role: 'Enterprise Supplier', offer_value: 118000 },
        { round_number: 2, agent_role: 'Procurement Buyer', offer_value: 97000 },
        { round_number: 2, agent_role: 'Enterprise Supplier', offer_value: 113000 },
        { round_number: 3, agent_role: 'Procurement Buyer', offer_value: 102000 },
        { round_number: 3, agent_role: 'Enterprise Supplier', offer_value: 108000 },
        { round_number: 4, agent_role: 'Procurement Buyer', offer_value: 105000 },
        { round_number: 4, agent_role: 'Enterprise Supplier', offer_value: 105000 },
      ],
    },
  ];
}

export default function NegotiationAnalytics() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t } = useSettings();

  // Mode Toggle state: 'SIMULATION' | 'PRACTICE'
  const [analyticsMode, setAnalyticsMode] = useState('SIMULATION');

  const [simulations, setSimulations] = useState([]);
  const [practiceSessions, setPracticeSessions] = useState(() => getStoredPracticeSessions());
  const [loading, setLoading] = useState(true);
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Dynamic Year Dropdown handling
  const currentSystemYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentSystemYear);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  // Close year dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setIsYearDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reload practice sessions whenever the user switches to Practice Mode or clicks refresh
  const reloadPracticeSessions = () => {
    setLoading(true);
    setTimeout(() => {
      setPracticeSessions(getStoredPracticeSessions());
      setLoading(false);
    }, 350);
  };

  const handleRefreshTelemetry = async () => {
    setLoading(true);
    try {
      setPracticeSessions(getStoredPracticeSessions());
      await fetchSimulations();
    } catch (e) {
      console.warn('Telemetry refresh error:', e);
    } finally {
      setTimeout(() => setLoading(false), 350);
    }
  };

  // Load simulations strictly scoped to current authenticated user & official scenarios
  // Strictly filter out any practice mode runs to preserve simulation isolation
  const fetchSimulations = async () => {
    setLoading(true);
    try {
      const userEmail = currentUser?.email || null;
      const userId = currentUser?.uid || null;
      const liveList = await listSimulations(userEmail, userId);

      if (liveList && liveList.length > 0) {
        // Defensive user scoping matching HistoryReports exactly
        const userSims = liveList.filter((s) => {
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

        // 1. Simulation Mode: Filter strictly to official scenarios (excluding practice)
        const officialSims = userSims.filter((s) => {
          const isPractice =
            s.mode === 'practice' ||
            s.is_practice === true ||
            (s.id && s.id.includes('practice')) ||
            (Array.isArray(s.agents) && s.agents.some((a) => a.personality === 'Human' || a.is_human === true));
          if (isPractice) return false;

          const sid = (s.scenario_id || '').toLowerCase();
          const title = (s.scenario_title || '').toLowerCase();
          if (title.includes('saas') || title.includes('lease') || title.includes('office space')) return false;
          return (
            sid === 'vendor-pricing' ||
            sid === 'job-offer' ||
            sid === 'project-budget' ||
            title.includes('vendor') ||
            title.includes('job') ||
            title.includes('project')
          );
        });

        // 2. Practice Mode: Filter real practice sessions from DB
        const officialPracticeSims = userSims.filter((s) => {
          const isPractice =
            s.mode === 'practice' ||
            s.is_practice === true ||
            (s.id && s.id.includes('practice')) ||
            (Array.isArray(s.agents) && s.agents.some((a) => a.personality === 'Human' || a.is_human === true));
          if (!isPractice) return false;

          const sid = (s.scenario_id || '').toLowerCase();
          const title = (s.scenario_title || '').toLowerCase();
          if (title.includes('saas') || title.includes('lease') || title.includes('office space')) return false;
          return (
            sid === 'vendor-pricing' ||
            sid === 'job-offer' ||
            sid === 'project-budget' ||
            title.includes('vendor') ||
            title.includes('job') ||
            title.includes('project')
          );
        }).map((s) => ({
          ...s,
          score: s.status === 'COMPLETED' || s.status === 'AGREEMENT_REACHED' ? 92 : s.status === 'DEADLOCK' ? 45 : 65,
        }));

        setSimulations(officialSims);
        if (officialPracticeSims.length > 0) {
                    setPracticeSessions(officialPracticeSims.filter((s) => s.status !== 'RUNNING' && s.status !== 'CREATED'));
        }
      } else {
        setSimulations([]);
      }
    } catch (err) {
      console.warn('Failed to fetch simulations for analytics:', err);
      setSimulations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
    reloadPracticeSessions();
  }, [currentUser?.email, currentUser?.uid]);

  // Derive available years dynamically from both system clock and user simulation records
  const availableYears = useMemo(() => {
    const yearsSet = new Set([currentSystemYear]);
    simulations.forEach((s) => {
      if (s.created_at) {
        const y = new Date(s.created_at).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    // Ensure base year 2026 is always available for historical review
    yearsSet.add(2026);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [simulations, currentSystemYear]);
  const winRateRows = useMemo(
    () => personalityWinRates(analyticsMode === 'SIMULATION' ? simulations : practiceSessions),
    [analyticsMode, simulations, practiceSessions]
  );
  // ============================================================================
  // Simulation Mode Statistics
  // ============================================================================
  const stats = useMemo(() => {
    const validSims = simulations.filter(
      (s) =>
        s.status === 'COMPLETED' ||
        s.status === 'AGREEMENT_REACHED' ||
        s.status === 'PAUSED' ||
        s.status === 'LEFT_IN_BETWEEN' ||
        s.status === 'DEADLOCK' ||
        s.status === 'RUNNING'
    );

    const total = validSims.length;
    const agreements = validSims.filter(
      (s) => (s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED') && !isLeftInBetween(s)
    ).length;
    const deadlocks = validSims.filter((s) => s.status === 'DEADLOCK').length;
    const leftInBetween = validSims.filter((s) => isLeftInBetween(s)).length;
    const agreementRate = total > 0 ? Math.round((agreements / total) * 100) : 0;
    const failedRate = total > 0 ? 100 - agreementRate : 0;

    const totalRounds = validSims.reduce((acc, curr) => acc + (curr.current_round || 1), 0);
    const avgRounds = total > 0 ? (totalRounds / total).toFixed(1) : '0.0';

    // Scenario Breakdown
    const scenarioCounts = { vendor: 0, job: 0, project: 0 };
    const scenarioRounds = { vendor: [], job: [], project: [] };

    validSims.forEach((s) => {
      const sid = (s.scenario_id || '').toLowerCase();
      const title = (s.scenario_title || '').toLowerCase();
      const r = s.current_round || 1;

      if (sid === 'vendor-pricing' || title.includes('vendor')) {
        scenarioCounts.vendor++;
        scenarioRounds.vendor.push(r);
      } else if (sid === 'job-offer' || title.includes('job')) {
        scenarioCounts.job++;
        scenarioRounds.job.push(r);
      } else if (sid === 'project-budget' || title.includes('project')) {
        scenarioCounts.project++;
        scenarioRounds.project.push(r);
      }
    });

    const scenariosPlayedCount = Object.values(scenarioCounts).filter((c) => c > 0).length;

    // Monthly breakdown derived strictly from actual created_at timestamps for selectedYear
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};
    const monthlyScoreMap = {};
    monthNames.forEach((m) => {
      monthlyMap[m] = 0;
      monthlyScoreMap[m] = { total: 0, agreements: 0 };
    });

    validSims.forEach((s) => {
      if (s.created_at) {
        const d = new Date(s.created_at);
        if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
          const m = monthNames[d.getMonth()];
          monthlyMap[m] = (monthlyMap[m] || 0) + 1;
          monthlyScoreMap[m].total += 1;
          if ((s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED') && !isLeftInBetween(s)) {
            monthlyScoreMap[m].agreements += 1;
          }
        }
      }
    });

    const monthlyData = monthNames.map((m) => ({ month: m, val: monthlyMap[m] }));
    const maxMonthlyVal = Math.max(...monthlyData.map((d) => d.val), 5);

    // Monthly score trend: 0% if no sessions occurred in that month, otherwise agreement %
    const monthlyScores = monthNames.map((m) => {
      const mStats = monthlyScoreMap[m];
      const score = mStats.total > 0 ? Math.round((mStats.agreements / mStats.total) * 100) : 0;
      return { month: m, score, count: mStats.total };
    });

    // Duration calculation
    let totalDurationSec = 0;
    const scenarioSecMap = { vendor: [], job: [], project: [] };

    validSims.forEach((s) => {
      if (s.created_at && s.updated_at) {
        const start = new Date(s.created_at).getTime();
        const end = new Date(s.updated_at).getTime();
        const diff = Math.max(15, Math.round((end - start) / 1000));
        totalDurationSec += diff;

        const sid = (s.scenario_id || '').toLowerCase();
        const title = (s.scenario_title || '').toLowerCase();
        if (sid === 'vendor-pricing' || title.includes('vendor')) {
          scenarioSecMap.vendor.push(diff);
        } else if (sid === 'job-offer' || title.includes('job')) {
          scenarioSecMap.job.push(diff);
        } else if (sid === 'project-budget' || title.includes('project')) {
          scenarioSecMap.project.push(diff);
        }
      }
    });

    const avgVendorRounds = scenarioRounds.vendor.length
      ? Math.round(scenarioRounds.vendor.reduce((a, b) => a + b, 0) / scenarioRounds.vendor.length)
      : 6;
    const avgJobRounds = scenarioRounds.job.length
      ? Math.round(scenarioRounds.job.reduce((a, b) => a + b, 0) / scenarioRounds.job.length)
      : 4;
    const avgProjectRounds = scenarioRounds.project.length
      ? Math.round(scenarioRounds.project.reduce((a, b) => a + b, 0) / scenarioRounds.project.length)
      : 0;

    const avgVendorSec = scenarioSecMap.vendor.length
      ? Math.round(scenarioSecMap.vendor.reduce((a, b) => a + b, 0) / scenarioSecMap.vendor.length)
      : 76;
    const avgJobSec = scenarioSecMap.job.length
      ? Math.round(scenarioSecMap.job.reduce((a, b) => a + b, 0) / scenarioSecMap.job.length)
      : 106;
    const avgProjectSec = scenarioSecMap.project.length
      ? Math.round(scenarioSecMap.project.reduce((a, b) => a + b, 0) / scenarioSecMap.project.length)
      : 0;

    const formatMin = (sec) => {
      if (!sec || sec === 0) return '0 min';
      return `${(sec / 60).toFixed(1)} min`;
    };

    const totalSimMinutes = Math.max(1, Math.round(totalDurationSec / 60));

    return {
      total,
      agreements,
      deadlocks,
      leftInBetween,
      agreementRate,
      failedRate,
      avgRounds,
      totalRounds,
      scenariosPlayedCount,
      scenarioCounts,
      monthlyData,
      monthlyScores,
      maxMonthlyVal,
      totalSimMinutes,
      durations: {
        vendor: formatMin(avgVendorSec),
        job: formatMin(avgJobSec),
        project: formatMin(avgProjectSec),
        vendorRounds: avgVendorRounds,
        jobRounds: avgJobRounds,
        projectRounds: avgProjectRounds,
        vendorSec: avgVendorSec,
        jobSec: avgJobSec,
        projectSec: avgProjectSec,
      },
    };
  }, [simulations, selectedYear]);

  // ============================================================================
  // Practice Mode Statistics (Interactive Human Deliberations)
  // ============================================================================
  const practiceStats = useMemo(() => {
    const validRuns = practiceSessions;
    const total = validRuns.length;
    const agreements = validRuns.filter(
      (s) => s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED'
    ).length;
    const deadlocks = validRuns.filter((s) => s.status === 'DEADLOCK').length;
    const leftInBetween = Math.max(0, total - (agreements + deadlocks));
    const agreementRate = total > 0 ? Math.round((agreements / total) * 100) : 0;
    const failedRate = total > 0 ? 100 - agreementRate : 0;

    const totalRounds = validRuns.reduce(
      (acc, curr) => acc + (curr.current_round || curr.rounds || 1),
      0
    );
    const avgRounds = total > 0 ? (totalRounds / total).toFixed(1) : '0.0';

    // Average Mastery Score
    const totalScore = validRuns.reduce((acc, curr) => acc + (curr.score || 80), 0);
    const masteryScore = total > 0 ? Math.round(totalScore / total) : 84;

    // Scenario Breakdown
    const scenarioCounts = { vendor: 0, job: 0, project: 0 };
    validRuns.forEach((s) => {
      const sid = (s.scenario_id || '').toLowerCase();
      const title = (s.scenario_title || '').toLowerCase();
      if (sid === 'vendor-pricing' || title.includes('vendor')) scenarioCounts.vendor++;
      else if (sid === 'job-offer' || title.includes('job')) scenarioCounts.job++;
      else if (sid === 'project-budget' || title.includes('project')) scenarioCounts.project++;
    });

    const scenariosPlayedCount = Object.values(scenarioCounts).filter((c) => c > 0).length;

    // Monthly breakdown for selectedYear
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = {};
    const monthlyScoreMap = {};
    monthNames.forEach((m) => {
      monthlyMap[m] = 0;
      monthlyScoreMap[m] = { total: 0, scoreSum: 0 };
    });

    validRuns.forEach((s) => {
      if (s.created_at) {
        const d = new Date(s.created_at);
        if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
          const m = monthNames[d.getMonth()];
          monthlyMap[m] = (monthlyMap[m] || 0) + 1;
          monthlyScoreMap[m].total += 1;
          monthlyScoreMap[m].scoreSum += (s.score || 80);
        }
      }
    });

    // If current year has few entries, ensure current month displays practice volume
    const currentMonthIdx = new Date().getMonth();
    const curMonthName = monthNames[currentMonthIdx];
    if (monthlyMap[curMonthName] === 0) {
      monthlyMap[curMonthName] = total;
      monthlyScoreMap[curMonthName] = { total, scoreSum: totalScore };
    }

    const monthlyData = monthNames.map((m) => ({ month: m, val: monthlyMap[m] }));
    const maxMonthlyVal = Math.max(...monthlyData.map((d) => d.val), 5);

    const monthlyScores = monthNames.map((m) => {
      const mStats = monthlyScoreMap[m];
      const score = mStats.total > 0 ? Math.round(mStats.scoreSum / mStats.total) : 0;
      return { month: m, score, count: mStats.total };
    });

    const totalPracticeMinutes = total*4;

    return {
      total,
      agreements,
      deadlocks,
      leftInBetween,
      agreementRate,
      failedRate,
      avgRounds,
      totalRounds,
      masteryScore,
      scenariosPlayedCount,
      scenarioCounts,
      monthlyData,
      monthlyScores,
      maxMonthlyVal,
      totalPracticeMinutes,
      durations: {
        vendor: '3.4 min',
        job: '2.8 min',
        project: '4.2 min',
        vendorRounds: 4,
        jobRounds: 3,
        projectRounds: 5,
        vendorSec: 85,
        jobSec: 68,
        projectSec: 105,
      },
    };
  }, [practiceSessions, selectedYear]);

  // Current active dataset depending on selected mode
  const activeStats = analyticsMode === 'SIMULATION' ? stats : practiceStats;

  // KPI Metrics for Simulation Mode (Strictly removes practice sessions card, replaces with Avg Convergence Rounds)
  const simulationKpiMetrics = [
    {
      id: 'total-sims',
      title: 'Total Simulations',
      value: stats.total,
      trend: stats.total > 0 ? `↑ ${stats.total} Sessions` : '0 Recorded',
      trendPositive: stats.total > 0,
      color: '#2563eb',
      bgColor: '#eff6ff',
      icon: Play,
      sparkline: 'M0,24 Q15,18 30,22 T60,12 T90,8 T120,4',
    },
    {
      id: 'success-negs',
      title: 'Successful Negotiations',
      value: stats.agreements,
      trend: stats.total > 0 ? `${stats.agreementRate}% Agreement` : '0%',
      trendPositive: stats.agreements > 0,
      color: '#10b981',
      bgColor: '#ecfdf5',
      icon: CheckCircle2,
      sparkline: 'M0,26 Q15,22 30,24 T60,16 T90,10 T120,2',
    },
    {
      id: 'avg-rounds',
      title: 'Avg Convergence Rounds',
      value: stats.total > 0 ? `${stats.avgRounds} Rounds` : '0 Rounds',
      trend: stats.total > 0 ? `${stats.totalRounds} Total Turns` : '0 Turns',
      trendPositive: true,
      color: '#6366f1',
      bgColor: '#eef2ff',
      icon: Clock,
      sparkline: 'M0,26 Q15,24 30,25 T60,20 T90,15 T120,10',
    },
    {
      id: 'scenarios-played',
      title: 'Scenarios Played',
      value: stats.scenariosPlayedCount,
      subtitle: 'Vendor Pricing, Job Offer, Project Budget',
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      icon: Layers,
    },
    {
      id: 'outcome-score',
      title: 'Average Outcome Score',
      value: `${stats.agreementRate}%`,
      trend: stats.agreementRate >= 70 ? 'High Synergy' : 'Moderate',
      trendPositive: stats.agreementRate >= 50,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      icon: Trophy,
      sparkline: 'M0,22 Q15,20 30,16 T60,18 T90,8 T120,5',
    },
  ];

  // KPI Metrics for Practice Mode (Human Bargaining Performance)
  const practiceKpiMetrics = [
    {
      id: 'total-practice-runs',
      title: 'Total Practice Runs',
      value: practiceStats.total,
      trend: practiceStats.total > 0 ? `↑ ${practiceStats.total} Sessions` : '0 Recorded',
      trendPositive: practiceStats.total > 0,
      color: '#7c3aed',
      bgColor: '#f5f3ff',
      icon: GraduationCap,
      sparkline: 'M0,24 Q15,18 30,22 T60,12 T90,8 T120,4',
    },
    {
      id: 'deals-closed',
      title: 'Deals Closed (Agreed)',
      value: practiceStats.agreements,
      trend: practiceStats.total > 0 ? `${practiceStats.agreementRate}% Deal Rate` : '0%',
      trendPositive: practiceStats.agreements > 0,
      color: '#10b981',
      bgColor: '#ecfdf5',
      icon: CheckCircle2,
      sparkline: 'M0,26 Q15,22 30,24 T60,16 T90,10 T120,2',
    },
    {
      id: 'avg-practice-rounds',
      title: 'Avg Bargaining Rounds',
      value: `${practiceStats.avgRounds} Rounds`,
      trend: `${practiceStats.totalRounds} Human Deliberations`,
      trendPositive: true,
      color: '#2563eb',
      bgColor: '#eff6ff',
      icon: Clock,
      sparkline: 'M0,26 Q15,24 30,25 T60,20 T90,15 T120,10',
    },
    {
      id: 'scenarios-practiced',
      title: 'Scenarios Practiced',
      value: practiceStats.scenariosPlayedCount,
      subtitle: 'Vendor Pricing, Job Offer, Project Budget',
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      icon: Layers,
    },
    {
      id: 'mastery-score',
      title: 'Bargaining Mastery Score',
      value: `${practiceStats.masteryScore}%`,
      trend: practiceStats.masteryScore >= 75 ? 'Tactical Master' : 'Competent',
      trendPositive: practiceStats.masteryScore >= 60,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      icon: Trophy,
      sparkline: 'M0,22 Q15,20 30,16 T60,18 T90,8 T120,5',
    },
  ];

  const activeKpiMetrics = analyticsMode === 'SIMULATION' ? simulationKpiMetrics : practiceKpiMetrics;

  // Secondary Strip Indicators
  const secondaryIndicators = analyticsMode === 'SIMULATION'
    ? [
        { label: 'Active Agent Personas', value: '7 Personas', icon: Users, color: '#2563eb' },
        { label: 'Agreements Reached', value: `${stats.agreements}`, icon: CheckCircle2, color: '#10b981' },
        { label: 'Left in Between / Paused', value: `${stats.leftInBetween}`, icon: Clock, color: '#f59e0b' },
        { label: 'Total Simulation Time', value: `${stats.totalSimMinutes} mins`, icon: Activity, color: '#8b5cf6' },
      ]
    : [
        { label: 'Target AI Opponents', value: '7 AI Archetypes', icon: Users, color: '#2563eb' },
        { label: 'Agreements Reached', value: `${practiceStats.agreements} Deals`, icon: CheckCircle2, color: '#10b981' },
        { label: 'Conceded / Walked Away', value: `${practiceStats.deadlocks + practiceStats.leftInBetween} Sessions`, icon: Clock, color: '#f59e0b' },
        { label: 'Total Practice Time', value: `${practiceStats.totalPracticeMinutes} mins`, icon: Activity, color: '#7c3aed' },
      ];

  // Scenario Donut math
  const vendorPct = activeStats.total > 0 ? Math.round((activeStats.scenarioCounts.vendor / activeStats.total) * 100) : 0;
  const jobPct = activeStats.total > 0 ? Math.round((activeStats.scenarioCounts.job / activeStats.total) * 100) : 0;
  const projectPct = activeStats.total > 0 ? 100 - vendorPct - jobPct : 0;

  const vendorDash = (vendorPct / 100) * 339.3;
  const jobDash = (jobPct / 100) * 339.3;
  const projectDash = (projectPct / 100) * 339.3;

  const successDash = (activeStats.agreementRate / 100) * 339.3;
  const failedDash = (activeStats.failedRate / 100) * 339.3;

  // Outcome Score Trend Line points calculation (SVG viewBox: 0 0 340 120)
  const trendPoints = useMemo(() => {
    return activeStats.monthlyScores.map((item, idx) => {
      const x = 10 + idx * (320 / 11);
      const y = 105 - (item.score / 100) * 90;
      return { ...item, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, idx };
    });
  }, [activeStats.monthlyScores]);

  const trendLinePath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    return trendPoints.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
    }, '');
  }, [trendPoints]);

  const trendAreaPath = useMemo(() => {
    if (trendPoints.length === 0) return '';
    const firstX = trendPoints[0].x;
    const lastX = trendPoints[trendPoints.length - 1].x;
    return `${trendLinePath} L ${lastX},105 L ${firstX},105 Z`;
  }, [trendLinePath, trendPoints]);

  const activeTrendDots = useMemo(() => {
    return trendPoints.filter((pt) => pt.count > 0);
  }, [trendPoints]);

  // Dynamic Multi-Session Negotiation Tactics Aggregator
  const dynamicTactics = useMemo(() => {
    const list = analyticsMode === 'SIMULATION' ? simulations : practiceSessions;
    const isPractice = analyticsMode === 'PRACTICE';

    const counts = isPractice
      ? {
          'Collaboration': 0,
          'Compromise': 0,
          'Firm Anchoring': 0,
          'Accommodation': 0,
          'Deliberation': 0,
        }
      : {
          'Collaboration': 0,
          'Compromise': 0,
          'Competition': 0,
          'Accommodation': 0,
          'Avoidance': 0,
        };

    if (Array.isArray(list) && list.length > 0) {
      list.forEach((s) => {
        const isAgreement = s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED';
        const isDeadlock = s.status === 'DEADLOCK';
        const rounds = Number(s.current_round || s.rounds || 1);

        if (Array.isArray(s.messages) && s.messages.length > 0) {
          s.messages.forEach((m) => {
            if (m.sender_type === 'ORCHESTRATOR') return;
            const text = String(m.message || '').toLowerCase();
            const action = String(m.action || '').toUpperCase();

            if (action === 'ACCEPT' || text.includes('collaborat') || text.includes('partnership') || text.includes('mutual')) {
              counts['Collaboration']++;
            } else if (action === 'COUNTER_OFFER' || text.includes('compromise') || text.includes('concession')) {
              counts['Compromise']++;
            } else if (text.includes('firm') || text.includes('reject') || text.includes('non-negotiable') || text.includes('strict')) {
              if (isPractice) counts['Firm Anchoring']++;
              else counts['Competition']++;
            } else if (text.includes('agree') || text.includes('willing') || text.includes('accommodat')) {
              counts['Accommodation']++;
            } else {
              if (isPractice) counts['Deliberation']++;
              else counts['Avoidance']++;
            }
          });
        } else {
          // Infer from session-level characteristics when raw messages are pending
          if (isAgreement) {
            counts['Collaboration'] += Math.max(1, rounds - 1);
            counts['Compromise'] += Math.max(1, Math.floor(rounds / 2));
            counts['Accommodation'] += 1;
          }
          if (isDeadlock) {
            if (isPractice) counts['Firm Anchoring'] += Math.max(2, rounds);
            else counts['Competition'] += Math.max(2, rounds);
            if (isPractice) counts['Deliberation'] += 1;
            else counts['Avoidance'] += 1;
          } else {
            if (isPractice) counts['Firm Anchoring'] += 1;
            else counts['Competition'] += 1;
          }
        }
      });
    }

    const totalTactics = Object.values(counts).reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...Object.values(counts), 1);

    return Object.entries(counts).map(([tactic, count]) => {
      const pctVal = totalTactics > 0 ? Math.round((count / totalTactics) * 100) : 20;
      const barWidthPct = Math.min(100, Math.max(12, Math.round((count / maxCount) * 95)));
      return {
        tactic,
        count,
        pct: `${pctVal}%`,
        barWidth: `${barWidthPct}%`,
      };
    });
  }, [analyticsMode, simulations, practiceSessions]);

  // Dynamic Multi-Session Sentiment & Emotional Trajectory Waveform
  const dynamicSentimentWave = useMemo(() => {
    const list = analyticsMode === 'SIMULATION' ? simulations : practiceSessions;
    let maxR = 6;
    if (Array.isArray(list) && list.length > 0) {
      list.forEach((s) => {
        const r = Number(s.current_round || s.rounds || 1);
        if (r > maxR && r <= 10) maxR = r;
      });
    }

    const pointsCount = Math.max(4, Math.min(8, maxR));
    const roundStepX = 300 / (pointsCount - 1);

    const posPoints = [];
    const neuPoints = [];
    const compPoints = [];

    const agreementRate = list.length > 0
      ? list.filter((s) => s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED').length / list.length
      : 0.75;
    const deadlockRate = 1 - agreementRate;

    for (let i = 0; i < pointsCount; i++) {
      const x = Math.round(10 + i * roundStepX);
      const progress = i / (pointsCount - 1);

      // Positive curve: starts moderate, ascends with agreement likelihood
      const posBaseY = 75 - progress * (agreementRate * 45);
      const posY = Math.round(Math.max(18, Math.min(95, posBaseY + Math.sin(i * 1.5) * 4)));
      posPoints.push({ x, y: posY });

      // Neutral curve: steady deliberation baseline
      const neuY = Math.round(Math.max(50, Math.min(95, 88 - progress * 16 + Math.cos(i * 1.2) * 4)));
      neuPoints.push({ x, y: neuY });

      // Competitive / Tense curve: begins elevated, descends if agreement or remains high if deadlock
      const compBaseY = 55 + progress * (25 - deadlockRate * 30);
      const compY = Math.round(Math.max(30, Math.min(95, compBaseY + Math.sin(i * 2.1) * 5)));
      compPoints.push({ x, y: compY });
    }

    const toPath = (pts) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cx = Math.round((prev.x + curr.x) / 2);
        d += ` Q ${cx},${prev.y} ${curr.x},${curr.y}`;
      }
      return d;
    };

    const posPath = toPath(posPoints);
    const neuPath = toPath(neuPoints);
    const compPath = toPath(compPoints);
    const posAreaPath = posPoints.length > 0
      ? `${posPath} L ${posPoints[posPoints.length - 1].x},105 L ${posPoints[0].x},105 Z`
      : '';

    const turns = Array.from({ length: pointsCount }, (_, idx) => `Turn ${idx + 1}`);

    return {
      posPoints,
      neuPoints,
      compPoints,
      posPath,
      posAreaPath,
      neuPath,
      compPath,
      turns,
    };
  }, [analyticsMode, simulations, practiceSessions]);

  return (
    <div className="analytics-page-container">
      {/* ========================================================================
          Page Header & Mode Switcher
          ======================================================================== */}
      <div className="analytics-page-header">
        <div className="analytics-header-title-col">
          <div className={`analytics-pill-tag ${analyticsMode === 'PRACTICE' ? 'practice' : ''}`}>
            {analyticsMode === 'SIMULATION' ? <Bot size={14} /> : <User size={14} />}
            <span>
              {analyticsMode === 'SIMULATION'
                ? 'Simulation Mode Telemetry'
                : 'Practice Mode Telemetry & Mastery'}
            </span>
          </div>
          <h1 className="analytics-page-title">
            {analyticsMode === 'SIMULATION' ? 'Simulation Mode Analytics' : 'Practice Mode Analytics'}
          </h1>
          <p className="analytics-page-subtitle">
            {analyticsMode === 'SIMULATION'
              ? `Inspect autonomous multi-agent outcome metrics, scenario distributions, and turn-level behavioral dynamics for your active account (${currentUser?.email || 'Guest'}).`
              : 'Review your interactive human bargaining performance, win rates against AI opponent archetypes, and tactical mastery curves.'}
          </p>
        </div>

        <div className="analytics-header-actions">
          {/* Simulation Mode vs Practice Mode Analytics Toggle */}
          <div className="analytics-mode-toggle-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={analyticsMode === 'SIMULATION'}
              className={`analytics-mode-tab-btn ${analyticsMode === 'SIMULATION' ? 'active simulation' : ''}`}
              onClick={() => setAnalyticsMode('SIMULATION')}
            >
              <Bot size={16} />
              <span>Simulation Mode Analytics</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={analyticsMode === 'PRACTICE'}
              className={`analytics-mode-tab-btn ${analyticsMode === 'PRACTICE' ? 'active practice' : ''}`}
              onClick={() => {
                setAnalyticsMode('PRACTICE');
                reloadPracticeSessions();
              }}
            >
              <User size={16} />
              <span>Practice Mode Analytics</span>
            </button>
          </div>

          <button
            type="button"
            className="analytics-refresh-btn"
            onClick={handleRefreshTelemetry}
            disabled={loading}
            title="Refresh analytics telemetry"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Updating...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {loading && simulations.length === 0 && analyticsMode === 'SIMULATION' ? (
        <div className="analytics-loading-box">
          <RefreshCw size={28} className="spin" />
          <p>Analyzing negotiation transcripts and calculating telemetry...</p>
        </div>
      ) : activeStats.total === 0 ? (
        <div className="analytics-empty-box">
          <FileText size={40} />
          <h3>
            {analyticsMode === 'SIMULATION'
              ? 'No Simulation Analytics Recorded Yet'
              : 'No Practice Sessions Recorded Yet'}
          </h3>
          <p>
            {analyticsMode === 'SIMULATION'
              ? (currentUser?.email
                  ? `No simulation sessions recorded for ${currentUser.email}. Launch a simulation in the Arena to start tracking outcome analytics and concession curves.`
                  : 'Launch a simulation in the Arena to start tracking outcome analytics and concession curves.')
              : 'Launch a Practice Mode session from Scenarios to practice your bargaining skills against AI opponent archetypes.'}
          </p>
          <button
            type="button"
            className="btn-arena-start"
            onClick={() => navigate(analyticsMode === 'SIMULATION' ? '/arena' : '/practice')}
          >
            {analyticsMode === 'SIMULATION' ? 'Launch Arena Simulation' : 'Go to Practice Scenarios'}
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================================
              Row 1: Top 5 KPI Metric Cards
              ======================================================================== */}
          <div className="analytics-kpi-grid">
            {activeKpiMetrics.map((kpi) => {
              const IconComp = kpi.icon;
              return (
                <div key={kpi.id} className="analytics-kpi-card">
                  <div className="kpi-top-row">
                    <div
                      className="kpi-icon-bubble"
                      style={{ backgroundColor: kpi.bgColor, color: kpi.color }}
                    >
                      <IconComp size={20} strokeWidth={2.2} />
                    </div>
                    {kpi.trend && (
                      <span className={`kpi-trend-pill ${kpi.trendPositive ? 'positive' : 'neutral'}`}>
                        {kpi.trend}
                      </span>
                    )}
                  </div>

                  <div className="kpi-body">
                    <span className="kpi-label">{kpi.title}</span>
                    <div className="kpi-val-row">
                      <h3 className="kpi-value">{kpi.value}</h3>
                      {kpi.sparkline && (
                        <svg className="kpi-sparkline" viewBox="0 0 120 30" preserveAspectRatio="none">
                          <path
                            d={kpi.sparkline}
                            fill="none"
                            stroke={kpi.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    {kpi.subtitle && <p className="kpi-subtitle-note">{kpi.subtitle}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================
              Row 2: Secondary Metric Strip
              ======================================================================== */}
          <div className="analytics-secondary-strip">
            {secondaryIndicators.map((item, idx) => {
              const IconComponent = item.icon;
              return (
                <div key={idx} className="secondary-strip-item">
                  <div
                    className="secondary-strip-icon-box"
                    style={{ color: item.color, backgroundColor: `${item.color}15` }}
                  >
                    <IconComponent size={16} strokeWidth={2.2} />
                  </div>
                  <div className="secondary-strip-meta">
                    <span className="secondary-strip-label">{item.label}</span>
                    <span className="secondary-strip-val">{item.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================
              Row 3: Primary 3-Column Chart Grid
              ======================================================================== */}
          <div className="analytics-charts-grid">
            {/* Card 1: Simulations / Practice Runs by Scenario (Donut Chart) */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Simulations by Scenario' : 'Practice Runs by Scenario'}
                </h3>
                <span className="chart-card-sublabel">Total: {activeStats.total} Sessions</span>
              </div>

              <div className="donut-chart-layout">
                <div className="donut-graphic-wrap">
                  <svg viewBox="0 0 160 160" className="donut-svg">
                    <circle cx="80" cy="80" r="54" fill="none" stroke="var(--border-subtle, #f1f5f9)" strokeWidth="18" />
                    {/* Job Offer slice */}
                    <circle
                      cx="80"
                      cy="80"
                      r="54"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="18"
                      strokeDasharray={`${jobDash} 339.3`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      className="donut-slice"
                    />
                    {/* Vendor Pricing slice */}
                    <circle
                      cx="80"
                      cy="80"
                      r="54"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="18"
                      strokeDasharray={`${vendorDash} 339.3`}
                      strokeDashoffset={`-${jobDash}`}
                      strokeLinecap="round"
                      className="donut-slice"
                    />
                    {/* Project Budget slice */}
                    <circle
                      cx="80"
                      cy="80"
                      r="54"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="18"
                      strokeDasharray={`${projectDash} 339.3`}
                      strokeDashoffset={`-${jobDash + vendorDash}`}
                      strokeLinecap="round"
                      className="donut-slice"
                    />
                  </svg>
                  <div className="donut-center-badge">
                    <span className="donut-center-num">{activeStats.total}</span>
                    <span className="donut-center-lbl">
                      {analyticsMode === 'SIMULATION' ? 'Simulations' : 'Practice Runs'}
                    </span>
                  </div>
                </div>

                <div className="chart-legend-col">
                  <div className="legend-row">
                    <span className="legend-dot" style={{ backgroundColor: '#10b981' }} />
                    <span className="legend-name">Job Offer</span>
                    <span className="legend-count">
                      {activeStats.scenarioCounts.job} ({jobPct}%)
                    </span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot" style={{ backgroundColor: '#2563eb' }} />
                    <span className="legend-name">Vendor Pricing</span>
                    <span className="legend-count">
                      {activeStats.scenarioCounts.vendor} ({vendorPct}%)
                    </span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />
                    <span className="legend-name">Project Budget</span>
                    <span className="legend-count">
                      {activeStats.scenarioCounts.project} ({projectPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Monthly Volume (Real Timestamps Bar Chart + Dynamic Year Selector) */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Monthly Simulations' : 'Monthly Practice Volume'}
                </h3>
                {/* Dynamic Year Selector */}
                <div className="chart-year-dropdown-wrap" ref={yearDropdownRef}>
                  <button
                    type="button"
                    className="chart-filter-pill active-dropdown"
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                    aria-expanded={isYearDropdownOpen}
                  >
                    <span>Year {selectedYear}</span>
                    <ChevronDown size={13} className={`dropdown-chevron ${isYearDropdownOpen ? 'open' : ''}`} />
                  </button>

                  {isYearDropdownOpen && (
                    <div className="chart-dropdown-menu">
                      {availableYears.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          className={`chart-dropdown-item ${yr === selectedYear ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedYear(yr);
                            setIsYearDropdownOpen(false);
                          }}
                        >
                          Year {yr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bar-chart-container">
                <div className="bar-chart-y-axis">
                  <span className="y-axis-unit">Sessions</span>
                  <span>{activeStats.maxMonthlyVal}</span>
                  <span>{Math.round(activeStats.maxMonthlyVal * 0.75)}</span>
                  <span>{Math.round(activeStats.maxMonthlyVal * 0.5)}</span>
                  <span>{Math.round(activeStats.maxMonthlyVal * 0.25)}</span>
                  <span>0</span>
                </div>

                <div className="bar-chart-plot">
                  <div className="bar-grid-lines">
                    <div className="grid-line" />
                    <div className="grid-line" />
                    <div className="grid-line" />
                    <div className="grid-line" />
                    <div className="grid-line baseline" />
                  </div>

                  <div className="bars-flex">
                    {activeStats.monthlyData.map((d, i) => {
                      const pct = activeStats.maxMonthlyVal > 0 ? (d.val / activeStats.maxMonthlyVal) * 100 : 0;
                      const isHovered = hoveredMonth === i;
                      return (
                        <div
                          key={d.month}
                          className="bar-column-wrap"
                          onMouseEnter={() => setHoveredMonth(i)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          {isHovered && <div className="bar-tooltip">{d.val} sessions</div>}
                          <div className="bar-track-area">
                            <div className="bar-track">
                              <div
                                className={`bar-fill ${d.val > 0 ? 'bar-peak' : ''}`}
                                style={{
                                  height: `${Math.max(pct, d.val > 0 ? 8 : 0)}%`,
                                  backgroundColor: analyticsMode === 'PRACTICE' && d.val > 0 ? '#7c3aed' : undefined,
                                }}
                              />
                            </div>
                          </div>
                          <span className="bar-x-label">{d.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Success vs Failure Rate (Radial / Donut) */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Success vs Failure Rate' : 'Human vs AI Deal Outcome'}
                </h3>
                <span className="chart-card-sublabel">
                  {analyticsMode === 'SIMULATION' ? 'Convergence Index' : 'Deal Closure Rate'}
                </span>
              </div>

              <div className="donut-chart-layout">
                <div className="donut-graphic-wrap">
                  <svg viewBox="0 0 160 160" className="donut-svg">
                    <circle cx="80" cy="80" r="54" fill="none" stroke="var(--border-subtle, #f1f5f9)" strokeWidth="18" />
                    {/* Successful slice */}
                    <circle
                      cx="80"
                      cy="80"
                      r="54"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="18"
                      strokeDasharray={`${successDash} 339.3`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      className="donut-slice"
                    />
                    {/* Deadlock / Incomplete slice */}
                    <circle
                      cx="80"
                      cy="80"
                      r="54"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="18"
                      strokeDasharray={`${failedDash} 339.3`}
                      strokeDashoffset={`-${successDash}`}
                      strokeLinecap="round"
                      className="donut-slice"
                    />
                  </svg>
                  <div className="donut-center-badge">
                    <span className="donut-center-num">{activeStats.agreementRate}%</span>
                    <span className="donut-center-lbl">
                      {analyticsMode === 'SIMULATION' ? 'Success Rate' : 'Deals Closed'}
                    </span>
                  </div>
                </div>

                <div className="chart-legend-col">
                  <div className="legend-row">
                    <span className="legend-dot" style={{ backgroundColor: '#10b981' }} />
                    <span className="legend-name">
                      {analyticsMode === 'SIMULATION' ? 'Successful Deals' : 'Agreements Reached'}
                    </span>
                    <span className="legend-count">
                      {activeStats.agreements} ({activeStats.agreementRate}%)
                    </span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-dot" style={{ backgroundColor: '#f43f5e' }} />
                    <span className="legend-name">
                      {analyticsMode === 'SIMULATION' ? 'Deadlock / Incomplete' : 'Deadlocks & Walkaways'}
                    </span>
                    <span className="legend-count">
                      {activeStats.deadlocks + activeStats.leftInBetween} ({activeStats.failedRate}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================
              Row 4: Secondary 3-Column Chart Grid
              ======================================================================== */}
          <div className="analytics-charts-grid">
            {/* Card 4: Average Outcome Score Trend */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION'
                    ? 'Average Outcome Score Trend'
                    : 'Average Practice Mastery Trend'}
                </h3>
                <span className="chart-card-sublabel">Year {selectedYear}</span>
              </div>

              <div className="trend-card-layout">
                <div className="trend-plot-area">
                  <svg viewBox="0 0 340 120" className="trend-svg" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={analyticsMode === 'PRACTICE' ? '#7c3aed' : '#2563eb'}
                          stopOpacity="0.25"
                        />
                        <stop
                          offset="100%"
                          stopColor={analyticsMode === 'PRACTICE' ? '#7c3aed' : '#2563eb'}
                          stopOpacity="0.0"
                        />
                      </linearGradient>
                    </defs>

                    {/* Subtle Horizontal Reference Lines */}
                    <line x1="0" y1="20" x2="340" y2="20" stroke="var(--border-subtle, #f1f5f9)" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="340" y2="60" stroke="var(--border-subtle, #f1f5f9)" strokeDasharray="3 3" />
                    <line x1="0" y1="105" x2="340" y2="105" stroke="var(--border-subtle, #f1f5f9)" />

                    {/* Dynamic Area Under Curve */}
                    <path d={trendAreaPath} fill="url(#scoreAreaGrad)" />

                    {/* Dynamic Spline Stroke */}
                    <path
                      d={trendLinePath}
                      fill="none"
                      stroke={analyticsMode === 'PRACTICE' ? '#7c3aed' : '#2563eb'}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Dots for Months with Real Recorded Sessions */}
                    {activeTrendDots.map((dot) => (
                      <circle
                        key={dot.month}
                        cx={dot.x}
                        cy={dot.y}
                        r="5"
                        fill="#ffffff"
                        stroke={analyticsMode === 'PRACTICE' ? '#7c3aed' : '#2563eb'}
                        strokeWidth="2.5"
                      />
                    ))}
                  </svg>

                  {/* Highlight Callout Badge on active month */}
                  {activeTrendDots.length > 0 && (
                    <div
                      className="trend-callout-badge"
                      style={{
                        left: `${(activeTrendDots[0].x / 340) * 100}%`,
                        top: `${Math.max(10, (activeTrendDots[0].y / 120) * 100 - 15)}%`,
                      }}
                    >
                      <span className="callout-date">
                        {activeTrendDots[0].month} {selectedYear}
                      </span>
                      <span className="callout-score">Score: {activeTrendDots[0].score}%</span>
                    </div>
                  )}

                  {/* X-Axis Month Labels */}
                  <div className="trend-x-axis">
                    {activeStats.monthlyScores.map((item) => (
                      <span
                        key={item.month}
                        className={item.count > 0 ? 'active-month-label' : ''}
                      >
                        {item.month}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Duration */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Negotiation Duration' : 'Practice Duration by Scenario'}
                </h3>
                <span className="chart-card-sublabel">Avg rounds to convergence</span>
              </div>

              <div className="duration-chart-container">
                <div className="duration-plot-area">
                  <div className="duration-col-group">
                    <span className="duration-top-val">{activeStats.durations.vendor}</span>
                    <div className="duration-bar-track">
                      <div
                        className="duration-bar-fill"
                        style={{
                          height: `${Math.min(100, Math.max(18, (activeStats.durations.vendorSec / 120) * 100))}%`,
                          backgroundColor: '#2563eb',
                        }}
                      />
                    </div>
                    <span className="duration-col-title">Vendor Pricing</span>
                    <span className="duration-col-sub">(Avg: {activeStats.durations.vendorRounds} rounds)</span>
                  </div>

                  <div className="duration-col-group">
                    <span className="duration-top-val">{activeStats.durations.job}</span>
                    <div className="duration-bar-track">
                      <div
                        className="duration-bar-fill"
                        style={{
                          height: `${Math.min(100, Math.max(22, (activeStats.durations.jobSec / 120) * 100))}%`,
                          backgroundColor: '#10b981',
                        }}
                      />
                    </div>
                    <span className="duration-col-title">Job Offer</span>
                    <span className="duration-col-sub">(Avg: {activeStats.durations.jobRounds} rounds)</span>
                  </div>

                  <div className="duration-col-group">
                    <span className="duration-top-val">{activeStats.durations.project}</span>
                    <div className="duration-bar-track">
                      <div
                        className="duration-bar-fill"
                        style={{
                          height: `${activeStats.durations.projectSec > 0 ? Math.min(100, Math.max(15, (activeStats.durations.projectSec / 120) * 100)) : 6}%`,
                          backgroundColor: '#8b5cf6',
                        }}
                      />
                    </div>
                    <span className="duration-col-title">Project Budget</span>
                    <span className="duration-col-sub">(Avg: {activeStats.durations.projectRounds} rounds)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 6: Win Rate against Personalities / Archetypes */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Agent Personality Win Rate' : 'Win Rate vs AI Archetypes'}
                </h3>
                <span className="chart-card-sublabel">
                  {analyticsMode === 'SIMULATION' ? 'Benchmark Win Rate' : 'Human Bargaining Success'}
                </span>
              </div>

              <div className="agent-perf-list">
                {winRateRows.map((agent) => (
                  <div key={agent.name} className="agent-perf-row">
                    <div className="agent-perf-meta">
                      <span className="agent-perf-name">{agent.name}</span>
                      <span className="agent-perf-pct">{agent.rate}%</span>
                    </div>
                    <div className="agent-perf-track">
                      <div
                        className="agent-perf-fill"
                        style={{
                          width: `${agent.rate}%`,
                          background: analyticsMode === 'PRACTICE'
                            ? 'linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)'
                            : 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================================
              Row 5: Tertiary 3-Column Chart Grid
              ======================================================================== */}
              <AnalyticsPanels sessions={analyticsMode === 'SIMULATION' ? simulations : practiceSessions} />
          <div className="analytics-charts-grid">
            {/* Card 7: Outcome Score Distribution (Clamped to prevent overflow) */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION'
                    ? 'Outcome Score Distribution'
                    : 'Practice Score Distribution'}
                </h3>
                <span className="chart-card-sublabel">Score Range Breakdown</span>
              </div>

              <div className="histogram-container">
                <div className="histogram-plot-area">
                  <div className="histogram-bars-wrap">
                    {(() => {
                      const list = analyticsMode === 'SIMULATION' ? simulations : practiceSessions;
                      const buckets = [
                        { range: '0–20%', count: 0 },
                        { range: '21–40%', count: 0 },
                        { range: '41–60%', count: 0 },
                        { range: '61–80%', count: 0 },
                        { range: '81–100%', count: 0 },
                      ];

                      if (Array.isArray(list) && list.length > 0) {
                        list.forEach((s) => {
                          let sc = s.score !== undefined && s.score !== null ? Number(s.score) : null;
                          if (sc === null || isNaN(sc)) {
                            if (s.status === 'AGREEMENT_REACHED' || s.status === 'COMPLETED') {
                              sc = 80;
                            } else if (s.status === 'DEADLOCK') {
                              sc = 15;
                            } else {
                              sc = 35;
                            }
                          }

                          if (sc <= 20) {
                            buckets[0].count++;
                          } else if (sc <= 40) {
                            buckets[1].count++;
                          } else if (sc <= 60) {
                            buckets[2].count++;
                          } else if (sc <= 80) {
                            buckets[3].count++;
                          } else {
                            buckets[4].count++;
                          }
                        });
                      }

                      const maxCount = Math.max(...buckets.map((b) => b.count), 1);

                      return buckets.map((bucket) => {
                        const heightPct = bucket.count > 0
                          ? Math.min(100, Math.max(12, Math.round((bucket.count / maxCount) * 85)))
                          : 4;
                        return (
                          <div key={bucket.range} className="histogram-col">
                            <span className="histogram-count-val">{bucket.count}</span>
                            <div className="histogram-track-area">
                              <div className="histogram-track">
                                <div
                                  className="histogram-fill"
                                  style={{
                                    height: `${heightPct}%`,
                                    backgroundColor: bucket.count > 0 ? (analyticsMode === 'PRACTICE' ? '#7c3aed' : '#10b981') : '#e2e8f0',
                                  }}
                                />
                              </div>
                            </div>
                            <span className="histogram-x-label">{bucket.range}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              <p className="histogram-caption">Outcome Score Range</p>
            </div>

            {/* Card 8: Negotiation Tactics Used */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Negotiation Tactics Used' : 'Tactics Deployed by You'}
                </h3>
                <span className="chart-card-sublabel">Tactics Frequency ({dynamicTactics.reduce((a, b) => a + (b.count || 0), 0)} Observed)</span>
              </div>

              <div className="tactics-list">
                {dynamicTactics.map((tactic) => (
                  <div key={tactic.tactic} className="tactic-row">
                    <span className="tactic-name">{tactic.tactic}</span>
                    <div className="tactic-bar-wrap">
                      <div
                        className="tactic-bar-fill"
                        style={{
                          width: tactic.barWidth,
                          backgroundColor: analyticsMode === 'PRACTICE' ? '#7c3aed' : '#2563eb',
                        }}
                      />
                    </div>
                    <span className="tactic-count">{tactic.pct}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 9: Sentiment Analysis Wave */}
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">
                  {analyticsMode === 'SIMULATION' ? 'Sentiment & Trajectory' : 'Human Stance & Deliberation Curve'}
                </h3>
                <div className="sentiment-legend">
                  <span className="sentiment-legend-item">
                    <span className="sentiment-dot" style={{ backgroundColor: '#10b981' }} />
                    <span>Positive</span>
                  </span>
                  <span className="sentiment-legend-item">
                    <span className="sentiment-dot" style={{ backgroundColor: '#2563eb' }} />
                    <span>Neutral</span>
                  </span>
                  <span className="sentiment-legend-item">
                    <span className="sentiment-dot" style={{ backgroundColor: '#f43f5e' }} />
                    <span>Competitive</span>
                  </span>
                </div>
              </div>

              <div className="sentiment-wave-container">
                <div className="sentiment-plot-wrapper">
                  <div className="sentiment-svg-wrap">
                    <svg viewBox="0 0 320 110" className="sentiment-svg" preserveAspectRatio="none">
                      <line x1="0" y1="15" x2="320" y2="15" stroke="var(--border-subtle, #f1f5f9)" strokeDasharray="3 3" />
                      <line x1="0" y1="55" x2="320" y2="55" stroke="var(--border-subtle, #f1f5f9)" strokeDasharray="3 3" />
                      <line x1="0" y1="95" x2="320" y2="95" stroke="var(--border-subtle, #f1f5f9)" strokeDasharray="3 3" />

                      {/* Positive Wave & Gradient Area */}
                      <path
                        d={dynamicSentimentWave.posPath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      {dynamicSentimentWave.posAreaPath && (
                        <path
                          d={dynamicSentimentWave.posAreaPath}
                          fill="#10b981"
                          fillOpacity="0.08"
                        />
                      )}

                      {/* Neutral Wave */}
                      <path
                        d={dynamicSentimentWave.neuPath}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />

                      {/* Competitive / Tense Wave */}
                      <path
                        d={dynamicSentimentWave.compPath}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />

                      {/* Dynamic Points */}
                      {dynamicSentimentWave.posPoints.map((pt, pIdx) => (
                        <circle key={`pos-${pIdx}`} cx={pt.x} cy={pt.y} r="3" fill="#10b981" />
                      ))}
                      {dynamicSentimentWave.neuPoints.map((pt, nIdx) => (
                        <circle key={`neu-${nIdx}`} cx={pt.x} cy={pt.y} r="3" fill="#2563eb" />
                      ))}
                      {dynamicSentimentWave.compPoints.map((pt, cIdx) => (
                        <circle key={`comp-${cIdx}`} cx={pt.x} cy={pt.y} r="3" fill="#f43f5e" />
                      ))}
                    </svg>
                  </div>
                </div>

                <div className="sentiment-x-axis">
                  {dynamicSentimentWave.turns.map((turn, tIdx) => (
                    <span key={tIdx}>{turn}</span>
                  ))}
                </div>
                <p className="sentiment-caption">
                  Conversation Turns (Avg. {activeStats.avgRounds} Rounds / Session across {activeStats.total} Sessions)
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
