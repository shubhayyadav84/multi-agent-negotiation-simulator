import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Swords,
  Pause,
  Play,
  Square,
  RotateCcw,
  FileText,
  Maximize2,
  Minimize2,
  Users,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Bot,
  Info,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Mic,
  MicOff,
  Send,
  Lightbulb,
  Sparkles,
  User,
  ArrowRightLeft,
  Coins,
  MessageSquare,
  XCircle,
  Loader2,
  Tag,
  UserCheck,
  RotateCw,
  BookOpen,
  Scale,
} from 'lucide-react';
import { useScenario } from '../context/ScenarioContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { getScenarioById, SCENARIOS } from '../data/scenarios';
import AgentFaceAvatar from '../components/AgentFaceAvatar';
import {
  startSimulation,
  getSimulationState,
  stepSimulation,
  pauseSimulation,
  resumeSimulation,
  restartSimulation,
  endSimulation,
} from '../services/simulationApi';
import {
  extractMonetaryOffer,
  detectNegotiationIntent,
  getMessageOffer,
  extractProjectBudgetAllocations,
} from '../utils/negotiationInteraction';
import { useSpeechToText } from '../hooks/useSpeechToText';
import './NegotiationArena.css';

/**
 * Determines the live stance category dynamically: 'Firm' | 'Compromising' | 'Cautious'
 */
const getDynamicStanceCategory = (agent, sim, isFirst) => {
  if (!agent) return 'Firm';

  // 1. If negotiation has ended with an agreement
  const isCompleted = sim?.status === 'COMPLETED' || sim?.status === 'AGREEMENT_REACHED' || Boolean(sim?.agreement);
  if (isCompleted) {
    return 'Agreed';
  }
  if (sim?.status === 'DEADLOCK') {
    return 'Firm';
  }

  // 2. Count actual offers made by this specific agent in the transcript
  const agentRoleLower = (agent.role || '').toLowerCase();
  const agentNameLower = (agent.name || '').toLowerCase();
  const isHuman = agent.is_human === true || agent.personality === 'Human';

  const agentOffers = (sim?.messages || []).filter((m) => {
    if ((m.sender_type !== 'AGENT' && m.sender_type !== 'HUMAN') || !m.offer_value) return false;
    if (isHuman && m.sender_type === 'HUMAN') return true;
    const sRole = (m.sender_role || '').toLowerCase();
    const sName = (m.sender_name || '').toLowerCase();
    return (
      (sRole && (sRole === agentRoleLower || agentRoleLower.includes(sRole) || sRole.includes(agentRoleLower))) ||
      (sName && (sName === agentNameLower || agentNameLower.includes(sName) || sName.includes(agentNameLower)))
    );
  });

  // If the agent has made 0 or 1 offer yet, they are holding firm at their opening position
  if (agentOffers.length <= 1) {
    return 'Firm';
  }

  // If 2+ offers, check concession from opening offer
  const initialOffer = Number(agentOffers[0].offer_value);
  const latestOffer = Number(agentOffers[agentOffers.length - 1].offer_value);
  const concessionAmount = Math.abs(latestOffer - initialOffer);

  // If agent made a meaningful concession (> 1% shift toward counterpart) -> Compromising
  if (concessionAmount > initialOffer * 0.01) {
    return 'Compromising';
  }

  // If near round limit without agreeing -> Cautious
  const round = sim?.current_round || 1;
  const maxR = sim?.max_rounds || 10;
  if (round >= maxR - 2) {
    return 'Cautious';
  }

  return 'Firm';
};

/**
 * Formats agent titles cleanly with role/title in brackets across all 3 scenarios:
 * e.g. "Buyer (Procurement Director)" in transcript, "Procurement Director (Buyer)" in Agent Status
 */
const getFormattedAgentTitle = (agentOrMsg, target = 'transcript') => {
  if (!agentOrMsg) return '';
  const role = (agentOrMsg.role || agentOrMsg.sender_role || '').trim();
  const name = (agentOrMsg.name || agentOrMsg.sender_name || '').trim();
  const title = (agentOrMsg.title || '').trim();

  const combined = `${role} ${name} ${title}`.toLowerCase();

  let canonicalRole = role || 'Participant';
  let canonicalName = name || title || role;

  if (combined.includes('buyer') || combined.includes('procurement') || combined.includes('purchasing')) {
    canonicalRole = 'Buyer';
    canonicalName = 'Procurement Director';
  } else if (combined.includes('seller') || combined.includes('vendor') || combined.includes('supplier') || combined.includes('sales')) {
    canonicalRole = 'Seller';
    canonicalName = 'Sales Account Executive';
  } else if (combined.includes('recruiter') || combined.includes('hiring') || combined.includes('talent')) {
    canonicalRole = 'Recruiter';
    canonicalName = 'Hiring Director';
  } else if (combined.includes('candidate') || combined.includes('applicant') || combined.includes('interviewee')) {
    canonicalRole = 'Candidate';
    canonicalName = 'Job Candidate';
  } else if (combined.includes('engineering') || combined.includes('lead software') || combined.includes('department a') || combined.includes('infrastructure') || combined.includes('vp-eng')) {
    canonicalRole = 'Engineering Lead';
    canonicalName = 'VP of Engineering';
  } else if (combined.includes('marketing') || combined.includes('cmo') || combined.includes('growth') || combined.includes('department b')) {
    canonicalRole = 'Marketing Lead';
    canonicalName = 'Chief Marketing Officer';
  } else if (combined.includes('product') || combined.includes('head-product') || combined.includes('department c')) {
    canonicalRole = 'Product AI Lead';
    canonicalName = 'Head of Product AI';
  }

  if (target === 'transcript') {
    return `${canonicalRole} (${canonicalName})`;
  }
  // Agent Status cards: "Procurement Director (Buyer)"
  return `${canonicalName} (${canonicalRole})`;
};

/**
 * Normalizes legacy or raw orchestrator announcement text to canonical role/title formatting
 */
const formatOrchestratorMessage = (text) => {
  if (!text) return '';
  return text
    .replace(/\[DEADLOCK_COMPROMISE_ATTEMPTED\]\s*/gi, '')
    .replace(/Purchasing Manager vs Sales Representative/gi, 'Buyer (Procurement Director) vs Seller (Sales Account Executive)')
    .replace(/Awaiting opening move from Purchasing Manager/gi, 'Awaiting opening move from Buyer (Procurement Director)')
    .replace(/Hiring Manager vs Job Candidate/gi, 'Recruiter (Hiring Director) vs Candidate (Job Candidate)')
    .replace(/Hiring Recruiter vs Job Candidate/gi, 'Recruiter (Hiring Director) vs Candidate (Job Candidate)')
    .replace(/Awaiting opening move from Hiring Manager/gi, 'Awaiting opening move from Recruiter (Hiring Director)')
    .replace(/Awaiting opening move from Hiring Recruiter/gi, 'Awaiting opening move from Recruiter (Hiring Director)')
    .replace(/Department A Representative vs Department B Representative/gi, 'Engineering Lead (VP of Engineering) vs Marketing Lead (Chief Marketing Officer)');
};

/**
 * Renders an action badge pill: 'OFFER' | 'COUNTER_OFFER' | 'ACCEPT' | 'REJECT'
 * Strictly guarantees ONLY the very first offer in the negotiation transcript is labeled OPENING OFFER
 */
const renderActionBadge = (actionStr, msg = null, allMessages = []) => {
  let act = (actionStr || '').toUpperCase().trim();
  if (act === 'OPENING_OFFER' || act === 'OPENING OFFER') act = 'OFFER';
  if (act === 'COUNTER' || act === 'COUNTER OFFER') act = 'COUNTER_OFFER';

  // Strict guard: The very first message with an offer is ALWAYS the OPENING OFFER.
  // All subsequent messages with offers are ALWAYS COUNTER-OFFER.
  if (msg && Array.isArray(allMessages) && allMessages.length > 0) {
    const firstOfferMsg = allMessages.find(
      (m) => (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN') && m.offer_value !== undefined && m.offer_value !== null
    );
    if (firstOfferMsg) {
      const isFirstOffer = (msg === firstOfferMsg) || (msg.id && firstOfferMsg.id && msg.id === firstOfferMsg.id);
      if (isFirstOffer) {
        act = 'OFFER';
      } else if (act === 'OFFER') {
        act = 'COUNTER_OFFER';
      }
    }
  }

  if (act === 'ACCEPT') {
    return (
      <span className="arena-action-badge action-accept">
        <CheckCircle2 size={11} /> ACCEPT
      </span>
    );
  }
  if (act === 'REJECT') {
    return (
      <span className="arena-action-badge action-reject">
        <XCircle size={11} /> REJECT
      </span>
    );
  }
  if (act === 'COUNTER_OFFER') {
    return (
      <span className="arena-action-badge action-counter">
        <ArrowRightLeft size={11} /> COUNTER-OFFER
      </span>
    );
  }
  if (act === 'OFFER') {
    return (
      <span className="arena-action-badge action-offer">
        <Tag size={11} /> OPENING OFFER
      </span>
    );
  }
  return null;
};

const SCENARIO_OPTIONS = [
  { id: 'vendor-pricing', title: 'Vendor Pricing Negotiation', maxRounds: 12 },
  { id: 'job-offer', title: 'Job Offer Negotiation', maxRounds: 8 },
  { id: 'project-budget', title: 'Project Budget Allocation', maxRounds: 12 },
];

const NegotiationArena = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedScenarioId, selectedScenario, agentPersonalities } = useScenario();
  const { t } = useSettings();
  const { currentUser } = useAuth();

  // Active scenario strictly locked to selection
  const currentScenarioId =
    location.state?.scenarioId ||
    selectedScenarioId ||
    'vendor-pricing';

  const stateAgentPersonalities = {};
  if (Array.isArray(location.state?.agents)) {
    location.state.agents.forEach((ag) => {
      if (ag && ag.id && ag.personality) {
        stateAgentPersonalities[ag.id] = ag.personality;
      }
    });
  }

  const effectivePersonalities = {
    ...(agentPersonalities || {}),
    ...stateAgentPersonalities,
    ...(location.state?.agentPersonalities || {}),
  };

  const scenarioMeta =
    location.state?.scenario ||
    selectedScenario ||
    getScenarioById(currentScenarioId) ||
    SCENARIOS[0];

  // Simulation State: always enter in full screen mode by default
  const [simulation, setSimulation] = useState(null);
  const deadlockReason = (simulation?.messages || [])
  .filter((message) => message.sender_type === 'ORCHESTRATOR')
  .find((message) =>
    message.message?.includes('Deadlock') ||
    message.message?.includes('deadlock')
  )?.message || 'No specific deadlock reason available.';
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen] = useState(true);
  const [turnRunning, setTurnRunning] = useState(false);
  const turnRunningRef = useRef(false);
  useEffect(() => {
    turnRunningRef.current = turnRunning;
  }, [turnRunning]);

  // Practice Mode detection: strictly true ONLY when entering Practice Mode flow
  const isPracticeMode = Boolean(
    location.state?.isPractice === true ||
    location.state?.mode === 'practice' ||
    location.search.includes('practice')
  );

  // New UI state
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [practiceMessage, setPracticeMessage] = useState('');
  const [practiceOfferValue, setPracticeOfferValue] = useState('');
  const [showPracticeReportModal, setShowPracticeReportModal] = useState(false);

  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // VOICE DICTATION FEATURE: powered by useSpeechToText hook
  const {
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    toggleListening,
    stopListening: stopVoiceDictation,
  } = useSpeechToText({
    lang: 'en-US',
    continuous: true,
    interimResults: true,
    onTranscriptChange: (newText) => {
      setPracticeMessage(newText.slice(0, 1000));
    },
  });

  // Turn state helpers for Practice Mode & Simulation Mode
  const getActiveTurnAgent = (sim) => {
    if (!sim || !sim.agents || sim.agents.length === 0) return null;
    let agents = [...sim.agents];

    if (isPracticeMode) {
      if (currentScenarioId === 'vendor-pricing') {
        const seller = agents.find((a) => (a.role || '').toLowerCase().includes('seller') || (a.role || '').toLowerCase().includes('sales') || (a.id || '').includes('seller') || (a.id || '').includes('vendor'));
        const buyer = agents.find((a) => (a.role || '').toLowerCase().includes('buyer') || (a.role || '').toLowerCase().includes('procurement') || (a.id || '').includes('buyer'));
        if (seller && buyer) agents = [seller, buyer];
      } else if (currentScenarioId === 'job-offer') {
        const recruiter = agents.find((a) => (a.role || '').toLowerCase().includes('recruiter') || (a.role || '').toLowerCase().includes('hiring') || (a.id || '').includes('recruiter') || (a.id || '').includes('hiring'));
        const candidate = agents.find((a) => (a.role || '').toLowerCase().includes('candidate') || (a.id || '').includes('candidate'));
        if (recruiter && candidate) agents = [recruiter, candidate];
      } else if (currentScenarioId === 'project-budget') {
        const aiAgents = agents.filter((a) => a.personality !== 'Human' && a.is_human !== true && a.id !== location.state?.userRoleAgentId);
        const humanAgents = agents.filter((a) => a.personality === 'Human' || a.is_human === true || a.id === location.state?.userRoleAgentId);
        if (aiAgents.length > 0 && humanAgents.length > 0) agents = [...aiAgents, ...humanAgents];
      }
    } else {
      const presetAgents = scenarioMeta?.agents || [];
      if (presetAgents.length > 0) {
        const orderMap = new Map();
        presetAgents.forEach((pa, i) => {
          if (pa.id) orderMap.set(pa.id.toLowerCase(), i);
          if (pa.role) orderMap.set(pa.role.toLowerCase(), i);
        });
        agents.sort((a, b) => {
          const getIdx = (ag) => {
            const aId = (ag.id || '').toLowerCase();
            const aRole = (ag.role || '').toLowerCase();
            for (const [k, v] of orderMap.entries()) {
              if (aId.includes(k) || aRole.includes(k)) return v;
            }
            return 99;
          };
          return getIdx(a) - getIdx(b);
        });
      }
    }

    const currentRoundMessages = (sim.messages || []).filter(
      (m) => m.round_number === sim.current_round && (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN')
    );
    const activeIndex = currentRoundMessages.length % agents.length;

    // Safety guard: prevent the exact same agent from taking two consecutive turns
    const allAgentMsgs = (sim.messages || []).filter(
      (m) => m.sender_type === 'AGENT' || m.sender_type === 'HUMAN'
    );
    const lastMsg = allAgentMsgs[allAgentMsgs.length - 1];
    let effectiveActiveIndex = activeIndex;
    const isSameRole = Boolean(lastMsg?.sender_role && agents[activeIndex]?.role && lastMsg.sender_role === agents[activeIndex].role);
    const isSameName = Boolean(lastMsg?.sender_name && agents[activeIndex]?.name && lastMsg.sender_name === agents[activeIndex].name);
    if (lastMsg && agents.length > 1 && (isSameRole || isSameName)) {
      effectiveActiveIndex = (activeIndex + 1) % agents.length;
    }

    return agents[effectiveActiveIndex];
  };

  const activeTurnAgent = getActiveTurnAgent(simulation);
  const isHumanTurn = Boolean(
    isPracticeMode &&
    simulation?.status === 'RUNNING' &&
    (activeTurnAgent?.personality === 'Human' ||
      activeTurnAgent?.is_human === true ||
      activeTurnAgent?.id === location.state?.userRoleAgentId ||
      (activeTurnAgent?.id && location.state?.userRoleAgentId && activeTurnAgent.id.includes(location.state.userRoleAgentId)) ||
      (location.state?.userRole?.id && activeTurnAgent?.id && activeTurnAgent.id.includes(location.state.userRole.id)) ||
      (activeTurnAgent?.role && location.state?.userRole?.title && activeTurnAgent.role.toLowerCase() === location.state.userRole.title.toLowerCase()) ||
      (activeTurnAgent?.role && location.state?.userRole?.role && activeTurnAgent.role.toLowerCase() === location.state.userRole.role.toLowerCase()) ||
      (activeTurnAgent?.role && location.state?.userRole?.name && activeTurnAgent.role.toLowerCase().includes(location.state.userRole.name.toLowerCase())) ||
      (activeTurnAgent?.role && location.state?.userSide === (activeTurnAgent.role.toLowerCase().includes('buyer') ? 'buyer' : 'seller')))
  );

  const isAiOpponentTurn = Boolean(
    isPracticeMode &&
    simulation?.status === 'RUNNING' &&
    !isPaused &&
    activeTurnAgent &&
    !isHumanTurn
  );

  // Opening move detection: true when no agent or human has put forward an offer yet
  const activeOffersCount = (simulation?.messages || []).filter(
    (m) => (m.sender_type === 'AGENT' || m.sender_type === 'HUMAN') && m.offer_value
  ).length;
  const isOpeningMove = activeOffersCount === 0;

  // Real-time detection of monetary amount in single chat input as user types
  const detectedOfferInInput = extractMonetaryOffer(practiceMessage);
  const detectedBudgetSplit = currentScenarioId === 'project-budget' ? extractProjectBudgetAllocations(practiceMessage) : null;
  const inputIntent = detectNegotiationIntent(practiceMessage);
  const isBudgetValidForSubmit = currentScenarioId !== 'project-budget' || Boolean(detectedBudgetSplit) || inputIntent.isAccept || inputIntent.isReject;

  /**
   * Dispatches human negotiation messages via the single chat input
   * Automatically handles:
   * 1. Monetary offer extraction (₹150,000, 1.5 lakh, ₹2 LPA, $80,000, 150000)
   * 2. Deal Acceptance detection ("I accept the deal", "That works for me")
   * 3. Deal Rejection detection ("I cannot accept this offer. Let's end the negotiation")
   * 4. Irrelevant message forwarding to existing AI service ("What is your favourite movie?")
   */
  const handleSendPracticeMessage = async (overrideText = null) => {
    if (turnRunning || !simulation?.id || simulation.status !== 'RUNNING' || isTerminated) {
      return;
    }

    const text = (typeof overrideText === 'string' ? overrideText : practiceMessage).trim();
    if (!text) {
      return; // Validation: prevents submission of empty or whitespace-only messages
    }

    const intent = detectNegotiationIntent(text);
    const extractedOffer = extractMonetaryOffer(text);
    const budgetSplit = currentScenarioId === 'project-budget' ? extractProjectBudgetAllocations(text) : null;

    // In Project Budget Allocation, require all 3 allocations unless explicitly accepting or rejecting
    if (currentScenarioId === 'project-budget' && isPracticeMode && !budgetSplit && !intent.isAccept && !intent.isReject) {
      return;
    }

    let actionType = 'COUNTER_OFFER';
    let numericOffer = null;
    let customTerms = {};

    if (budgetSplit) {
      customTerms = {
        engineering: budgetSplit.engineering,
        marketing: budgetSplit.marketing,
        product: budgetSplit.product,
        total: budgetSplit.total,
      };

      const userRoleKey = `${humanAgent?.id || ''} ${humanAgent?.role || ''} ${humanAgent?.name || ''}`.toLowerCase();
      if (userRoleKey.includes('engineering') || userRoleKey.includes('software') || userRoleKey.includes('tech') || userRoleKey.includes('infra') || userRoleKey.includes('vp-eng')) {
        numericOffer = budgetSplit.engineering;
      } else if (userRoleKey.includes('marketing') || userRoleKey.includes('growth') || userRoleKey.includes('cmo')) {
        numericOffer = budgetSplit.marketing;
      } else {
        numericOffer = budgetSplit.product;
      }

      actionType = isOpeningMove ? 'OFFER' : 'COUNTER_OFFER';
    } else if (intent.isAccept) {
      actionType = 'ACCEPT';
      numericOffer = humanAgent?.current_offer || (currentScenarioId === 'project-budget' ? 380000 : null);
      if (numericOffer === null) {
        const counterpartMessages = (simulation?.messages || []).filter(
          (m) => m.sender_type !== 'ORCHESTRATOR' && (m.sender_type === 'AGENT' || m.sender_role !== humanAgent?.role)
        );
        const lastCounterpartOfferMsg = [...counterpartMessages].reverse().find(
          (m) => getMessageOffer(m)
        );
        numericOffer = lastCounterpartOfferMsg
          ? getMessageOffer(lastCounterpartOfferMsg)
          : (opponentAgent?.current_offer || (currentScenarioId === 'vendor-pricing' ? 10000 : 165000));
      }
    } else if (intent.isReject) {
      actionType = 'REJECT';
      numericOffer = null;
    } else if (extractedOffer !== null) {
      actionType = isOpeningMove ? 'OFFER' : 'COUNTER_OFFER';
      numericOffer = extractedOffer;
    } else {
      // General message / conversational response without monetary proposal
      actionType = isOpeningMove ? 'OFFER' : 'COUNTER_OFFER';
      numericOffer = null;
    }

    stopVoiceDictation();
    setPracticeMessage('');
    setTurnRunning(true);

    try {
      const updated = await stepSimulation(simulation.id, {
        message: text,
        offer_value: numericOffer,
        action: actionType,
        terms: customTerms,
        sender_role: humanAgent?.role || activeTurnAgent?.role,
        sender_name: humanAgent?.name || activeTurnAgent?.name || 'You',
        is_human: true,
      });
      if (updated) {
        setSimulation(updated);
        if (updated.status !== 'RUNNING') {
          setIsPaused(true);
        }
      }
    } catch (err) {
      console.error('Error submitting practice message:', err);
    } finally {
      setTurnRunning(false);
    }
  };

  /**
   * Directly triggers human decision submissions (Acceptance / Rejection quick options)
   */
  const handleHumanSubmit = (text) => {
    if (!text || turnRunning || !simulation?.id || isTerminated) return;
    handleSendPracticeMessage(text);
  };


  

  const transcriptEndRef = useRef(null);
  const timerRef = useRef(null);
  const simulationRef = useRef(null);

  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  // 1. Initialize Simulation on mount or scenario change (restoring active session if returning from report)
  useEffect(() => {
    let isMounted = true;

    async function initArena() {
      setLoading(true);
      try {
        // ONLY restore session if returning from report via "Back to Negotiation Arena"
        const isFromReport = location.state?.restoreSession === true || Boolean(sessionStorage.getItem('viewing_report_sim_id'));
        const reportSimId = location.state?.simId || sessionStorage.getItem('viewing_report_sim_id');

        if (isFromReport && reportSimId) {
          sessionStorage.removeItem('viewing_report_sim_id');
          try {
            const existingSim = await getSimulationState(reportSimId);
            if (isMounted && existingSim && existingSim.id) {
              setSimulation(existingSim);
              setIsPaused(true);
              setLoading(false);
              return;
            }
          } catch (restoreErr) {
            console.warn('Could not restore previous report simulation:', restoreErr);
          }
        }

        // Clean up session storage so any normal visit starts a fresh conversation
        sessionStorage.removeItem('active_arena_sim_id');
        sessionStorage.removeItem('viewing_report_sim_id');

        const agentsList =
          location.state?.agents ||
          scenarioMeta?.agents ||
          scenarioMeta?.roles ||
          [];
        let customAgents = agentsList.map((a, idx) => {
          const fallbackId =
            a.id ||
            (currentScenarioId === 'job-offer'
              ? (idx === 0 ? 'hiring-director' : 'job-candidate')
              : currentScenarioId === 'project-budget'
              ? (idx === 0 ? 'vp-engineering' : idx === 1 ? 'cmo-marketing' : 'head-product-ai')
              : (idx === 0 ? 'buyer-procurement' : 'vendor-sales'));
          const personality =
            effectivePersonalities?.[a.id] ||
            effectivePersonalities?.[fallbackId] ||
            (isPracticeMode && a.id === location.state?.userRoleAgentId ? 'Human' : null) ||
            a.personality ||
            a.defaultPersonality ||
            'Collaborative';
          return {
            id: fallbackId,
            role: a.role || a.name,
            name: a.name,
            goal: a.primaryGoal || a.goal,
            personality,
            is_human: personality === 'Human' || a.id === location.state?.userRoleAgentId,
          };
        });

        // Apply Practice Mode opening order:
        // In Practice Mode, the AI counterpart ALWAYS starts the opening offer,
        // so the human negotiator immediately arrives at an active "Your Turn to Bargain" turn!
        if (isPracticeMode) {
          const aiAgents = customAgents.filter((a) => a.personality !== 'Human' && a.is_human !== true && a.id !== location.state?.userRoleAgentId);
          const humanAgents = customAgents.filter((a) => a.personality === 'Human' || a.is_human === true || a.id === location.state?.userRoleAgentId);
          if (aiAgents.length > 0 && humanAgents.length > 0) {
            customAgents = [...aiAgents, ...humanAgents];
          }
        }

        const simData = await startSimulation(
          currentScenarioId,
          customAgents,
          null,
          currentUser?.email || null,
          currentUser?.uid || null
        );
        if (isMounted && simData) {
          setSimulation(simData);
          setIsPaused(false);
          if (simData.id) {
            sessionStorage.setItem('active_arena_sim_id', simData.id);
          }
        }
      } catch (err) {
        console.error('Failed to init simulation:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initArena();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (!allowExitRef.current && simulationRef.current) {
        const cur = simulationRef.current;
        const isFin = (cur.status === 'COMPLETED' || cur.status === 'AGREEMENT_REACHED' || cur.status === 'DEADLOCK') && Boolean(cur.agreement);
        if (!isFin && cur.id && cur.status !== 'LEFT_IN_BETWEEN') {
          endSimulation(cur.id, 'User left in between before completion').catch(() => {});
        }
        sessionStorage.removeItem('active_arena_sim_id');
        sessionStorage.removeItem('viewing_report_sim_id');
      }
    };
  }, [currentScenarioId, selectedScenario, agentPersonalities, location.state]);

  // 2. Real-time turn progression timer (runs every 3.5 seconds in Simulation Mode ONLY)
  useEffect(() => {
    if (!simulation || isPaused || simulation.status !== 'RUNNING') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // In Practice Mode, DO NOT run automatic timer! Progression is strictly driven by the human user.
    if (isPracticeMode) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(async () => {
      if (turnRunningRef.current) return;

      const cur = simulationRef.current || simulation;
      const maxLimit = Number(cur?.max_rounds || 12);
      if (cur.status !== 'RUNNING' || Number(cur.current_round) > maxLimit) {
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      turnRunningRef.current = true;
      setTurnRunning(true);
      try {
        const updated = await stepSimulation(simulation.id);
        if (updated) {
          setSimulation(updated);
          if (updated.status !== 'RUNNING' || Number(updated.current_round) > Number(updated.max_rounds || maxLimit)) {
            setIsPaused(true);
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      } catch (err) {
        console.warn('Error taking turn:', err);
      } finally {
        turnRunningRef.current = false;
        setTurnRunning(false);
      }
    }, 3500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simulation?.id, simulation?.status, isPaused, isPracticeMode]);

  // 2.1 AI Opponent auto-counter in Practice Mode (triggers after user takes turn)
  useEffect(() => {
    if (!isPracticeMode || !isAiOpponentTurn || turnRunningRef.current || !simulation?.id || simulation?.status !== 'RUNNING' || isPaused) {
      return;
    }

    const aiTimeout = setTimeout(async () => {
      if (turnRunningRef.current) return;
      turnRunningRef.current = true;
      setTurnRunning(true);
      try {
        const updated = await stepSimulation(simulation.id);
        if (updated) {
          setSimulation(updated);
          if (updated.status !== 'RUNNING') {
            setIsPaused(true);
          }
        }
      } catch (err) {
        console.warn('AI opponent step error in practice mode:', err);
      } finally {
        turnRunningRef.current = false;
        setTurnRunning(false);
      }
    }, 1400);

    return () => clearTimeout(aiTimeout);
  }, [isPracticeMode, isAiOpponentTurn, simulation?.id, simulation?.status, isPaused, simulation?.messages?.length]);

  // 3. Auto-scroll transcript to bottom on new messages
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulation?.messages?.length]);

  // Status Helpers
  const isDeadlock = simulation?.status === 'DEADLOCK';
  const isCompleted = simulation?.status === 'COMPLETED' || simulation?.status === 'AGREEMENT_REACHED';
  const isTerminated = isDeadlock || isCompleted;
  const isReallyPaused = isPaused && !isTerminated;

  const handleToggleVoiceDictation = () => {
    if (!isHumanTurn || turnRunning || isTerminated || isPaused) return;
    toggleListening(practiceMessage);
  };

  // Stop listening immediately when the human loses the turn, the simulation is
  // paused, a request is processing, or the negotiation has ended.
  useEffect(() => {
    if ((!isHumanTurn || turnRunning || isTerminated || isPaused) && isListening) {
      stopVoiceDictation();
    }
  }, [isHumanTurn, turnRunning, isTerminated, isPaused, isListening, stopVoiceDictation]);

  const [showExitWarning, setShowExitWarning] = useState(false);
  const allowExitRef = useRef(false);

  // Exit guard: lock browser back button in Arena until simulation is explicitly ended
  useEffect(() => {
    window.history.pushState({ arenaLocked: true }, '', window.location.href);

    const handlePopState = () => {
      if (!allowExitRef.current && !isTerminated) {
        window.history.pushState({ arenaLocked: true }, '', window.location.href);
        setShowExitWarning(true);
        setTimeout(() => setShowExitWarning(false), 3500);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isTerminated]);

  // Handle Controls
  const handleTogglePause = async () => {
    if (!simulation || isTerminated) return;
    if (isPaused) {
      setIsPaused(false);
      await resumeSimulation(simulation.id);
    } else {
      setIsPaused(true);
      await pauseSimulation(simulation.id);
    }
  };

  // End simulation: clear active session, do NOT show report in arena, redirect directly to Dashboard
  const handleEndSimulation = async () => {
    sessionStorage.removeItem('active_arena_sim_id');
    allowExitRef.current = true;
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const isAlreadyFinished = (isCompleted || isDeadlock || simulation?.status === 'COMPLETED' || simulation?.status === 'AGREEMENT_REACHED' || simulation?.status === 'DEADLOCK') && Boolean(simulation?.agreement);
    if (simulation?.id && !isAlreadyFinished) {
      try {
        await endSimulation(simulation.id, 'User left in between before completion');
      } catch (err) {
        console.warn('Failed to end simulation cleanly:', err);
      }
    }
    navigate('/dashboard');
  };

  // Direct navigation to negotiation report (includes ?from=arena so report page has a "Back to Negotiation Arena" button)
  const handleViewReport = () => {
    if (isPracticeMode) {
      setShowPracticeReportModal(true);
      return;
    }
    allowExitRef.current = true;
    if (simulation?.id) {
      sessionStorage.setItem('viewing_report_sim_id', simulation.id);
      navigate(`/history?id=${simulation.id}&from=arena`);
    } else {
      navigate('/history?from=arena');
    }
  };

  const handleRestart = async () => {
    sessionStorage.removeItem('active_arena_sim_id');
    setLoading(true);
    setIsPaused(false);
    try {
      const agentsList =
        location.state?.agents ||
        scenarioMeta?.agents ||
        scenarioMeta?.roles ||
        [];
      let customAgents = agentsList.map((a, idx) => {
        const fallbackId =
          a.id ||
          (currentScenarioId === 'job-offer'
            ? (idx === 0 ? 'hiring-director' : 'job-candidate')
            : currentScenarioId === 'project-budget'
            ? (idx === 0 ? 'vp-engineering' : idx === 1 ? 'cmo-marketing' : 'head-product-ai')
            : (idx === 0 ? 'buyer-procurement' : 'vendor-sales'));
        const personality =
          effectivePersonalities?.[a.id] ||
          effectivePersonalities?.[fallbackId] ||
          (isPracticeMode && a.id === location.state?.userRoleAgentId ? 'Human' : null) ||
          a.personality ||
          a.defaultPersonality ||
          'Collaborative';
        return {
          id: fallbackId,
          role: a.role || a.name,
          name: a.name,
          goal: a.primaryGoal || a.goal,
          personality,
          is_human: personality === 'Human' || a.id === location.state?.userRoleAgentId,
        };
      });

      if (isPracticeMode) {
        const aiAgents = customAgents.filter((a) => a.personality !== 'Human' && a.is_human !== true && a.id !== location.state?.userRoleAgentId);
        const humanAgents = customAgents.filter((a) => a.personality === 'Human' || a.is_human === true || a.id === location.state?.userRoleAgentId);
        if (aiAgents.length > 0 && humanAgents.length > 0) {
          customAgents = [...aiAgents, ...humanAgents];
        }
      }

      const restarted = await startSimulation(
        currentScenarioId,
        customAgents,
        null,
        currentUser?.email || null,
        currentUser?.uid || null
      );
      if (restarted) {
        setSimulation(restarted);
        if (restarted.id) {
          sessionStorage.setItem('active_arena_sim_id', restarted.id);
        }
      }
    } catch (err) {
      console.warn('Restart failed, restarting fresh:', err);
      const fresh = await startSimulation(
        currentScenarioId,
        null,
        null,
        currentUser?.email || null,
        currentUser?.uid || null
      );
      if (fresh) {
        setSimulation(fresh);
        if (fresh.id) {
          sessionStorage.setItem('active_arena_sim_id', fresh.id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Group messages by round
  const groupedMessages = (simulation?.messages || []).reduce((acc, msg) => {
    const r = msg.round_number || 1;
    if (!acc[r]) acc[r] = [];
    acc[r].push(msg);
    return acc;
  }, {});

  const currentScenarioObj =
    SCENARIO_OPTIONS.find((s) => s.id === currentScenarioId) || SCENARIO_OPTIONS[0];

  const simulationAgents = simulation?.agents || [];
  let sourceAgentsList =
    location.state?.agents ||
    scenarioMeta?.agents ||
    scenarioMeta?.roles ||
    simulationAgents;

  if (isPracticeMode && Array.isArray(sourceAgentsList)) {
    let reordered = [...sourceAgentsList];
    if (currentScenarioId === 'vendor-pricing') {
      const seller = reordered.find((a) => (a.role || '').toLowerCase().includes('seller') || (a.role || '').toLowerCase().includes('sales') || (a.id || '').includes('seller') || (a.id || '').includes('vendor'));
      const buyer = reordered.find((a) => (a.role || '').toLowerCase().includes('buyer') || (a.role || '').toLowerCase().includes('procurement') || (a.id || '').includes('buyer'));
      if (seller && buyer) sourceAgentsList = [seller, buyer];
    } else if (currentScenarioId === 'job-offer') {
      const recruiter = reordered.find((a) => (a.role || '').toLowerCase().includes('recruiter') || (a.role || '').toLowerCase().includes('hiring') || (a.id || '').includes('recruiter') || (a.id || '').includes('hiring'));
      const candidate = reordered.find((a) => (a.role || '').toLowerCase().includes('candidate') || (a.id || '').includes('candidate'));
      if (recruiter && candidate) sourceAgentsList = [recruiter, candidate];
    } else if (currentScenarioId === 'project-budget') {
      const aiAgents = reordered.filter((a) => a.personality !== 'Human' && a.is_human !== true && a.id !== location.state?.userRoleAgentId);
      const humanAgents = reordered.filter((a) => a.personality === 'Human' || a.is_human === true || a.id === location.state?.userRoleAgentId);
      if (aiAgents.length > 0 && humanAgents.length > 0) sourceAgentsList = [...aiAgents, ...humanAgents];
    }
  }

  const activeAgentsList = sourceAgentsList.map((metaAgent, idx) => {
    const simAgent =
      simulationAgents.find(
        (a) => a.id === metaAgent.id || a.role?.toLowerCase() === metaAgent.role?.toLowerCase() || a.name?.toLowerCase() === metaAgent.name?.toLowerCase()
      ) ||
      simulationAgents[idx] ||
      {};

    const agentId =
      metaAgent.id ||
      simAgent.id ||
      (currentScenarioId === 'job-offer'
        ? (idx === 0 ? 'hiring-director' : 'job-candidate')
        : currentScenarioId === 'project-budget'
        ? (idx === 0 ? 'vp-engineering' : idx === 1 ? 'cmo-marketing' : 'head-product-ai')
        : (idx === 0 ? 'buyer-procurement' : 'vendor-sales'));

    const configuredPersonality =
      effectivePersonalities?.[agentId] ||
      effectivePersonalities?.[metaAgent.id] ||
      metaAgent.personality ||
      simAgent.personality ||
      metaAgent.defaultPersonality ||
      'Collaborative';

    return {
      ...metaAgent,
      ...simAgent,
      id: agentId,
      name: simAgent.name || metaAgent.name || metaAgent.role,
      role: simAgent.role || metaAgent.role,
      goal: simAgent.goal || metaAgent.primaryGoal || metaAgent.goal,
      personality: configuredPersonality,
      current_offer:
        simAgent.current_offer ||
        (currentScenarioId === 'job-offer'
          ? (idx === 0 ? 152000 : 175000)
          : currentScenarioId === 'project-budget'
          ? (idx === 0 ? 450000 : idx === 1 ? 350000 : 300000)
          : (idx === 0 ? 95000 : 110000)),
      stance: simAgent.stance || (idx === 0 ? 'Holding firm' : 'Evaluating terms'),
      progress_percent: simAgent.progress_percent || 50,
    };
  });

  const buyerAgent = activeAgentsList[0] || {};
  const sellerAgent = activeAgentsList[1] || {};
  const humanAgent = activeAgentsList.find(
    (a) => a.id === location.state?.userRoleAgentId || a.personality === 'Human' || a.is_human === true
  ) || (location.state?.userSide === 'seller' ? activeAgentsList[1] : activeAgentsList[0]);

  const opponentAgent = activeAgentsList.find(
    (a) => a !== humanAgent
  ) || (humanAgent === activeAgentsList[0] ? activeAgentsList[1] : activeAgentsList[0]);

  const opponentStance = getDynamicStanceCategory(
    opponentAgent,
    simulation,
    opponentAgent === activeAgentsList[0]
  );

  // Auto-record practice mode session updates to localStorage (isolated from Simulation History DB)
  useEffect(() => {
    if (!isPracticeMode || !simulation?.id) return;
    try {
      const raw = localStorage.getItem('practice_mode_sessions');
      let sessions = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(sessions)) sessions = [];

      const isAgreed =
        (simulation.status === 'AGREEMENT_REACHED' || simulation.status === 'COMPLETED') &&
        Boolean(simulation.agreement);
      const isDead = simulation.status === 'DEADLOCK';
      const score = isAgreed ? 85 : isDead ? 38 : 60;

      const record = {
        id: simulation.id,
        scenario_id: simulation.scenario_id || currentScenarioId,
        scenario_title: simulation.scenario_title || scenarioMeta.title,
        status: simulation.status,
        current_round: simulation.current_round || 1,
        rounds: simulation.current_round || 1,
        created_at: simulation.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        score,
        userRole: humanAgent?.role || 'Procurement Buyer',
        opponentRole: opponentAgent?.role || 'Enterprise Supplier',
        opponentPersonality: opponentAgent?.personality || 'Collaborative',
        is_human: true,
        mode: 'practice',
      };

      const existingIdx = sessions.findIndex((s) => s.id === record.id);
      if (existingIdx >= 0) {
        sessions[existingIdx] = { ...sessions[existingIdx], ...record };
      } else {
        sessions.unshift(record);
      }
      localStorage.setItem('practice_mode_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.warn('Could not save practice session to localStorage:', e);
    }
  }, [
    isPracticeMode,
    simulation?.id,
    simulation?.status,
    simulation?.current_round,
    simulation?.agreement,
    currentScenarioId,
    scenarioMeta.title,
    humanAgent?.role,
    opponentAgent?.role,
    opponentAgent?.personality,
  ]);

  const currentRound = simulation?.current_round || 1;
  const maxRounds = simulation?.max_rounds || currentScenarioObj.maxRounds || 10;
  const roundProgress = Math.min(100, Math.round((currentRound / maxRounds) * 100));
  const offersCount = simulation?.offers?.length || 4;
  const currentGap = simulation?.current_gap || 1000;
  const agreementLikelihood = simulation?.agreement_likelihood || 68;

  return (
    <div className={`arena-page-wrapper ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* ========================================================================
          1. Header Section
          ======================================================================== */}
      <div className="arena-header">
        <div className="arena-header-left">
          <div className="arena-header-icon-box">
            <Swords size={22} className="arena-header-icon" />
          </div>
          <div>
            <h1 className="arena-title">Negotiation Arena</h1>
            <p className="arena-subtitle">Watch AI agents negotiate in real time</p>
          </div>
        </div>
      </div>

      {/* Exit Warning Toast when user tries to go back without ending simulation */}
      {showExitWarning && (
        <div className="arena-exit-toast">
          <AlertCircle size={18} />
          <span>Active negotiation in progress. Click <strong>End Simulation</strong> to exit to Dashboard.</span>
        </div>
      )}

      {/* In-page Negotiation Outcome Message (NO popup modal, NO Scenario Selection button) */}
      {isTerminated && (
        <div className={`arena-outcome-banner ${isDeadlock ? 'banner-deadlock' : 'banner-completed'}`}>
          <div className="arena-outcome-banner-left">
            {isDeadlock ? (
              <AlertCircle size={22} className="outcome-banner-icon text-danger" />
            ) : (
              <CheckCircle2 size={22} className="outcome-banner-icon text-success" />
            )}
            <div className="arena-outcome-banner-text">
              <span className="outcome-banner-title">
                {isDeadlock ? 'Deadlock Detected' : 'Agreement Reached'}
              </span>
              <span className="outcome-banner-desc">
                {isDeadlock
                   ? `Negotiation reached an impasse in Round ${currentRound}. Reason: ${deadlockReason}`
                  : `Negotiation successfully completed in Round ${currentRound} of ${maxRounds}. You can inspect the negotiation report below.`}
              </span>
            </div>
          </div>
          <div className="arena-outcome-banner-actions">
            <button
              type="button"
              className="btn-banner-report"
              onClick={handleViewReport}
              title="Show full negotiation audit report"
            >
              <FileText size={16} />
              <span>Show Negotiation Report</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================
          2. Top Control Bar (Scenario, Status, Round Indicator, Buttons)
          ======================================================================== */}
      <div className="arena-control-bar">
        {/* Scenario Display Pill (Not a dropdown) */}
        <div className="arena-scenario-dropdown-wrap">
          <div className="arena-scenario-selector" title="Active Scenario">
            <div className="arena-scenario-tag">
              <span className="arena-scenario-label">Scenario</span>
            </div>
            <div className="arena-scenario-current">
              <LayoutGrid size={15} className="arena-grid-icon" />
              <span className="arena-scenario-name">{currentScenarioObj.title}</span>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="arena-status-card">
          <div className="arena-status-indicator">
            <span
              className={`arena-pulse-dot ${
                isDeadlock
                  ? 'deadlock'
                  : isCompleted
                  ? 'completed'
                  : isReallyPaused
                  ? 'paused'
                  : 'live'
              }`}
            />
            <span
              className={`arena-status-text ${
                isDeadlock
                  ? 'status-deadlock'
                  : isCompleted
                  ? 'status-completed'
                  : isReallyPaused
                  ? 'status-paused'
                  : 'status-live'
              }`}
            >
              {isDeadlock
                ? 'DEADLOCK DETECTED'
                : isCompleted
                ? 'AGREEMENT REACHED'
                : isReallyPaused
                ? 'SIMULATION PAUSED'
                : 'LIVE SIMULATION'}
            </span>
          </div>
          <span className="arena-status-subtext">
            {isDeadlock
              ? 'Negotiation reached an impasse'
              : isCompleted
              ? 'Consensus finalized successfully'
              : isReallyPaused
              ? 'Waiting for user action'
              : 'AI agents are negotiating'}
          </span>
        </div>

        {/* Round Progress Indicator */}
        <div className="arena-round-card">
          <div className="arena-round-top">
            <div className="arena-round-target-icon">
              <div className="arena-target-dot" />
            </div>
            <div className="arena-round-label-wrap">
              <span className="arena-round-label">ROUND</span>
              <span className="arena-round-counter">
                {String(currentRound).padStart(2, '0')} / {String(maxRounds).padStart(2, '0')}
              </span>
            </div>
          </div>
          <div className="arena-round-progress-track">
            <div
              className="arena-round-progress-bar"
              style={{ width: `${roundProgress}%` }}
            />
          </div>
        </div>

        {/* Simulation Control Buttons */}
        <div className="arena-actions-group">
          {!isTerminated && (
            <button
              type="button"
              className={`btn-arena-pause ${isReallyPaused ? 'paused' : ''}`}
              onClick={handleTogglePause}
              title={isReallyPaused ? 'Resume simulation' : 'Pause simulation'}
            >
              {isReallyPaused ? <Play size={15} /> : <Pause size={15} />}
              <span>{isReallyPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            type="button"
            className="btn-arena-end"
            onClick={handleEndSimulation}
            title="End simulation and return to Dashboard"
          >
            <Square size={14} />
            <span>End Simulation</span>
          </button>

          <button
            type="button"
            className="btn-arena-restart"
            onClick={handleRestart}
            title="Restart from round 1"
          >
            <RotateCcw size={14} />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* ========================================================================
          3. Main Arena Grid: Left Transcript & Right Status/Metrics
          ======================================================================== */}
      <div className="arena-main-grid">
        {/* LEFT COLUMN: Negotiation Transcript */}
        <div className="arena-transcript-card">
          {/* Card Header */}
          <div className="arena-transcript-header">
            <div className="arena-transcript-title-wrap">
              <FileText size={18} className="arena-card-header-icon" />
              <h2 className="arena-card-title">Negotiation Transcript</h2>
            </div>
            <div className="arena-transcript-header-right">
              <span className="arena-live-pill">
                <span className="arena-live-pill-dot" />
                <span>Live</span>
              </span>
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="arena-transcript-body">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="arena-transcript-empty">
                <Bot size={32} />
                <p>Starting simulation and connecting to AI agents...</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([roundNum, msgs]) => (
                <div key={`round-${roundNum}`} className="arena-round-group">
                  {/* Round Divider Pill */}
                  <div className="arena-round-divider">
                    <span className="arena-round-pill">Round {roundNum}</span>
                  </div>

                  {/* Messages inside this round */}
                  <div className="arena-messages-stream">
                    {(() => {
                      let turnIdx = 0;
                      return msgs.map((msg) => {
                        const isOrchestrator = msg.sender_type === 'ORCHESTRATOR';

                        if (isOrchestrator) {
                          const isCompromise = typeof msg.message === 'string' && msg.message.includes('[DEADLOCK_COMPROMISE_ATTEMPTED]');
                          return (
                            <div key={msg.id} className={`arena-orchestrator-row ${isCompromise ? 'compromise-row' : ''}`}>
                              <div className={`arena-orchestrator-box ${isCompromise ? 'compromise-box' : ''}`}>
                                <div className="arena-orchestrator-avatar">
                                  {isCompromise ? <Scale size={18} style={{ color: '#d97706' }} /> : <Bot size={18} />}
                                </div>
                                <div className="arena-orchestrator-content">
                                  <div className="arena-orchestrator-header">
                                    <span className="arena-orchestrator-name">
                                      {isCompromise ? 'Orchestrator Deadlock Resolution' : (msg.sender_name || 'Orchestrator Agent')}
                                    </span>
                                    {isCompromise && (
                                      <span className="arena-compromise-pill">
                                        ⚖️ Compromise Proposal
                                      </span>
                                    )}
                                    <span className="arena-timestamp">
                                      {msg.timestamp_label || '10:24 AM'}
                                    </span>
                                  </div>
                                  <p className="arena-orchestrator-text">{formatOrchestratorMessage(msg.message)}</p>
                                  {isCompromise && msg.offer_value && (
                                    <div className="arena-compromise-suggestion-pill">
                                      <span>Suggested Settlement: <strong>₹{Number(msg.offer_value).toLocaleString()}</strong></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Direct, accurate agent lookup for this message
                        const senderAgent = activeAgentsList.find((a) => {
                          if (msg.sender_id && (a.id === msg.sender_id || a.agent_id === msg.sender_id)) return true;
                          const msgRole = (msg.sender_role || '').toLowerCase();
                          const aRole = (a.role || '').toLowerCase();
                          const aName = (a.name || '').toLowerCase();
                          const msgName = (msg.sender_name || '').toLowerCase();
                          if (msgRole && (aRole === msgRole || aName === msgRole)) return true;
                          if (msgName && (aName === msgName || aRole === msgName)) return true;
                          if (msgRole.includes('candidate') && (aRole.includes('candidate') || a.id.includes('candidate'))) return true;
                          if (msgRole.includes('recruiter') && (aRole.includes('recruiter') || a.id.includes('recruiter') || a.id.includes('hiring'))) return true;
                          if (msgRole.includes('buyer') && (aRole.includes('buyer') || a.id.includes('buyer') || aRole.includes('procurement'))) return true;
                          if (msgRole.includes('seller') && (aRole.includes('seller') || a.id.includes('seller') || a.id.includes('vendor') || aRole.includes('sales'))) return true;
                          if (msgRole.includes('engineering') && (aRole.includes('engineering') || a.id.includes('engineering') || a.id.includes('department-a'))) return true;
                          if (msgRole.includes('marketing') && (aRole.includes('marketing') || a.id.includes('marketing') || a.id.includes('department-b'))) return true;
                          if (msgRole.includes('product') && (aRole.includes('product') || a.id.includes('product'))) return true;
                          return false;
                        }) || (turnIdx % 2 === 0 ? activeAgentsList[0] : activeAgentsList[1]);

                        // Determine if message is from human
                        const isHumanMsg = Boolean(
                          msg.sender_type === 'HUMAN' ||
                          msg.personality === 'Human' ||
                          msg.is_human === true ||
                          (isPracticeMode && senderAgent && (
                            senderAgent.id === location.state?.userRoleAgentId ||
                            senderAgent.personality === 'Human' ||
                            senderAgent.is_human === true
                          ))
                        );

                        // Deterministic side placement:
                        // Practice Mode: AI counterpart is on LEFT, Human user is on RIGHT.
                        // Autonomous Simulation Mode:
                        // - Vendor Pricing: Buyer is on LEFT, Seller is on RIGHT.
                        // - Job Offer: Recruiter is on LEFT, Candidate is on RIGHT.
                        // - Project Budget: Engineering & Product on LEFT, Marketing on RIGHT.
                        let isLeft = true;
                        if (isPracticeMode) {
                          isLeft = !isHumanMsg;
                        } else if (currentScenarioId === 'vendor-pricing') {
                          const roleKey = `${senderAgent?.role || ''} ${senderAgent?.name || ''} ${msg.sender_role || ''} ${senderAgent?.id || ''}`.toLowerCase();
                          const isSeller = roleKey.includes('seller') || roleKey.includes('vendor') || roleKey.includes('sales');
                          isLeft = !isSeller;
                        } else if (currentScenarioId === 'job-offer') {
                          const roleKey = `${senderAgent?.role || ''} ${senderAgent?.name || ''} ${msg.sender_role || ''} ${senderAgent?.id || ''}`.toLowerCase();
                          const isCandidate = roleKey.includes('candidate') || roleKey.includes('applicant');
                          isLeft = !isCandidate;
                        } else if (currentScenarioId === 'project-budget') {
                          const roleKey = `${senderAgent?.role || ''} ${senderAgent?.name || ''} ${msg.sender_role || ''} ${senderAgent?.id || ''}`.toLowerCase();
                          const isMarketing = roleKey.includes('marketing') || roleKey.includes('cmo') || roleKey.includes('growth');
                          isLeft = !isMarketing;
                        } else {
                          isLeft = senderAgent?.id === activeAgentsList[0]?.id;
                        }

                        turnIdx++;

                        const displayPersonality =
                          effectivePersonalities?.[senderAgent?.id] ||
                          senderAgent?.personality ||
                          msg.personality ||
                          'Collaborative';
                        const personalityClass = (displayPersonality || '').toLowerCase().includes('aggressive')
                          ? 'aggressive'
                          : (displayPersonality || '').toLowerCase().includes('risk')
                          ? 'risk-averse'
                          : 'collaborative';

                        return (
                          <div
                            key={msg.id}
                            className={`arena-chat-row ${isLeft ? 'buyer-row' : 'seller-row'} ${isHumanMsg ? 'human-chat-row' : 'ai-chat-row'}`}
                          >
                            {/* Left-side Avatar (Shows animated SVG face avatar for all scenarios) */}
                            {isLeft && (
                              <div className="arena-avatar-container buyer-avatar">
                                <AgentFaceAvatar
                                  agentId={senderAgent?.id}
                                  personality={displayPersonality}
                                  role={senderAgent?.role || msg.sender_role || 'Negotiator'}
                                  size={44}
                                />
                              </div>
                            )}

                            {/* Message Bubble + Attached Offer */}
                            <div className={`arena-bubble-wrapper ${isLeft ? 'buyer' : 'seller'} ${isHumanMsg ? 'human-turn-bubble' : 'ai-turn-bubble'}`}>
                              {/* Message Meta Info Header */}
                              <div className="arena-bubble-meta">
                                {isHumanMsg ? (
                                  <>
                                    <span className="arena-human-badge">
                                      <User size={12} /> You
                                    </span>
                                    <span className="arena-agent-name">{getFormattedAgentTitle(msg, 'transcript')}</span>
                                    {renderActionBadge(msg.action, msg, simulation?.messages)}
                                    <span className="arena-meta-spacer" />
                                    <span className="arena-timestamp">
                                      {msg.timestamp_label || '10:24 AM'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="arena-agent-name">{getFormattedAgentTitle(msg, 'transcript')}</span>
                                    <span className={`arena-agent-personality ${personalityClass}`}>
                                      {displayPersonality}
                                    </span>
                                    {renderActionBadge(msg.action, msg, simulation?.messages)}
                                    <span className="arena-meta-spacer" />
                                    <span className="arena-timestamp">
                                      {msg.timestamp_label || '10:24 AM'}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Bubble Content Row (Text + Dynamic Offer badge) */}
                              {(() => {
                                const attachedOffer = getMessageOffer(msg);
                                return (
                                  <div className="arena-bubble-content-row">
                                    {/* Attached Offer Badge for Right/User messages (Placed on left of text) */}
                                    {!isLeft && attachedOffer && (
                                      <div className="arena-attached-offer seller-offer">
                                        <span>Offer: ₹{Number(attachedOffer).toLocaleString()}</span>
                                      </div>
                                    )}

                                    <div className={`arena-speech-bubble ${isHumanMsg ? 'human-bubble' : ''} ${isLeft ? 'buyer-bubble' : 'seller-bubble'}`}>
                                      <p className="arena-bubble-text">{msg.message}</p>
                                    </div>

                                    {/* Attached Offer Badge for Left/AI messages (Placed on right of text) */}
                                    {isLeft && attachedOffer && (
                                      <div className="arena-attached-offer buyer-offer">
                                        <span>Offer: ₹{Number(attachedOffer).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Right-side Avatar (Shows animated SVG face avatar for all scenarios) */}
                            {!isLeft && (
                              <div className="arena-avatar-container seller-avatar">
                                <AgentFaceAvatar
                                  agentId={senderAgent?.id}
                                  personality={displayPersonality}
                                  role={senderAgent?.role || msg.sender_role || 'Negotiator'}
                                  size={44}
                                />
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom Info Bar (only shown in pure automated simulation mode) */}
          {!isPracticeMode && (
            <div className="arena-transcript-footer">
              <Info size={15} className="arena-footer-info-icon" />
              <span>
                Simulation is running — AI agents are negotiating automatically. No manual input is required.
              </span>
            </div>
          )}

          {/* Interactive Human Participant Action Input Dock */}
          {isPracticeMode && (
            <div
              className={`arena-human-dock ${
                isHumanTurn && !turnRunning ? 'is-human-turn-active' : 'is-thinking-locked'
              }`}
            >
              {/* Top Status & Stance Bar */}
              <div className="arena-human-dock-header">
                <div className="arena-dock-header-left">
                  <div className="arena-turn-indicator-wrap">
                    {isTerminated ? (
                      <span className="arena-dock-badge completed-badge">
                        <CheckCircle2 size={13} />
                        <span>Negotiation Concluded ({isCompleted ? 'Agreement Reached' : 'Deadlock'})</span>
                      </span>
                    ) : isHumanTurn && !turnRunning ? (
                      <span className="arena-dock-badge user-turn-badge">
                        <span className="pulse-dot-green" />
                        <span>{isOpeningMove ? 'Your Turn to Make Opening Offer' : 'Your Turn to Bargain'}</span>
                      </span>
                    ) : (
                      <span className="arena-dock-badge ai-thinking-badge">
                        <Loader2 size={13} className="spin-icon" />
                        <span>AI Counterpart Deliberating...</span>
                      </span>
                    )}
                  </div>
                  <span className="arena-dock-role-tag">
                    Role: <strong>{humanAgent?.role || 'Human Participant'}</strong>
                  </span>
                </div>

                <div className="arena-dock-header-right">
                  {opponentAgent && (
                    <div className="arena-opponent-stance-pill">
                      <span className="stance-label">Opponent Stance:</span>
                      <span className={`arena-live-stance-pill stance-${opponentStance.toLowerCase()}`}>
                        <span className="stance-dot" />
                        {opponentStance}
                      </span>
                    </div>
                  )}
                  <button
                    className="arena-practice-coach-link"
                    type="button"
                    onClick={() => setAiCoachEnabled((p) => !p)}
                    title="View accepted number, price, and currency formats"
                  >
                    <BookOpen size={13} className="arena-coach-bulb" />
                    <span>Numbers and Offer Guide</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Single Chat Input Area (Replaces separate counter-offer numeric input) */}
              <div className="arena-dock-single-input-wrap">
                <div className="arena-dock-label-row">
                  <label htmlFor="human-message-input" className="arena-dock-label">
                    <MessageSquare size={13} />
                    <span>Negotiation Chat Input</span>
                  </label>
                  {detectedBudgetSplit ? (
                    <span
                      className="arena-dock-detected-pill"
                      style={{
                        borderColor: detectedBudgetSplit.isValidBudget ? '#10b981' : '#f59e0b',
                        color: detectedBudgetSplit.isValidBudget ? '#047857' : '#b45309',
                        background: detectedBudgetSplit.isValidBudget ? '#ecfdf5' : '#fffbeb',
                      }}
                    >
                      <Tag size={11} /> Detected Split: <strong>Eng ₹{detectedBudgetSplit.engineering?.toLocaleString()} | Mkt ₹{detectedBudgetSplit.marketing?.toLocaleString()} | Prod ₹{detectedBudgetSplit.product?.toLocaleString()}</strong>
                      <span style={{ marginLeft: 6, fontSize: '0.8rem', opacity: 0.85 }}>
                        (Total: ₹{detectedBudgetSplit.total?.toLocaleString()}{detectedBudgetSplit.isValidBudget ? ' ✓ Fits ₹10L' : ' ✕ Over ₹10L'})
                      </span>
                    </span>
                  ) : detectedOfferInInput ? (
                    <span className="arena-dock-detected-pill">
                      <Tag size={11} /> Detected Offer: <strong>₹{Number(detectedOfferInInput).toLocaleString()}</strong>
                    </span>
                  ) : null}
                  <span className="arena-dock-char-count">{practiceMessage.length}/1000</span>
                </div>
                <textarea
                  id="human-message-input"
                  className="arena-dock-textarea arena-dock-single-textarea"
                  placeholder={
                    isTerminated
                      ? "Negotiation has concluded. Inspect the summary report above or restart to begin a new session."
                      : isHumanTurn && !turnRunning
                        ? currentScenarioId === 'project-budget'
                          ? "Specify all 3 department allocations: Engineering, Marketing, Product AI (e.g. 'Engineering 400k, Marketing 340k, Product AI 260k' or '400k, 340k, 260k')..."
                          : isOpeningMove
                            ? "State your opening proposal or offer (e.g. 'I can adjust my salary expectation to ₹173,500' or '₹165,000')..."
                            : "Type your offer, response, or question (e.g. 'I propose ₹160,000' or 'I accept the deal')..."
                        : "AI counterpart is reviewing the dialogue and formulating a response..."
                  }
                  value={practiceMessage}
                  disabled={!isHumanTurn || turnRunning || isTerminated}
                  onChange={(e) => setPracticeMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (practiceMessage.trim() && isHumanTurn && !turnRunning && !isTerminated && isBudgetValidForSubmit) {
                        handleSendPracticeMessage();
                      }
                    }
                  }}
                  maxLength={1000}
                  rows={2}
                />

                {/* Validation hint for Project Budget when 3 allocations are needed */}
                {currentScenarioId === 'project-budget' && isHumanTurn && practiceMessage.trim().length > 0 && !isBudgetValidForSubmit && (
                  <div style={{ fontSize: '0.78rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>Please enter three separate values for Engineering, Marketing, and Product AI (e.g. <em>"Engineering 400k, Marketing 340k, Product AI 260k"</em> or <em>"400k, 340k, 260k"</em>).</span>
                  </div>
                )}

                {/* Quick Suggestion Chips */}
                {!isTerminated && isHumanTurn && !turnRunning && (
                  <div className="arena-dock-quick-chips">
                    <span className="quick-chips-label">Quick options:</span>
                    {currentScenarioId === 'project-budget' && (
                      <button
                        type="button"
                        className="arena-quick-chip"
                        disabled={!isHumanTurn || turnRunning || isTerminated}
                        onClick={() => setPracticeMessage("I propose: Engineering ₹400,000, Marketing ₹340,000, Product AI ₹260,000.")}
                        title="Propose balanced 10 Lakh split across 3 departments"
                      >
                        "Propose ₹10L Split"
                      </button>
                    )}
                    <button
                      type="button"
                      className="arena-quick-chip"
                      disabled={!isHumanTurn || turnRunning || isTerminated}
                      onClick={() => handleHumanSubmit("I accept the deal.")}
                      title="Directly accept the current offer and conclude negotiation"
                    >
                      "I accept the deal."
                    </button>
                    <button
                      type="button"
                      className="arena-quick-chip chip-reject"
                      disabled={!isHumanTurn || turnRunning || isTerminated}
                      onClick={() => handleHumanSubmit("I cannot accept this offer. Let's end the negotiation.")}
                      title="Directly reject the offer and terminate negotiation"
                    >
                      "I cannot accept this offer."
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Action Controls Bar */}
              <div className="arena-dock-actions-bar">
                <div className="arena-dock-voice-hint">
                  <button
                    className={`arena-dock-mic-btn ${isListening ? 'mic_recording' : ''}`}
                    type="button"
                    disabled={!isHumanTurn || turnRunning || isTerminated || isPaused}
                    onClick={handleToggleVoiceDictation}
                    title={
                      isListening
                        ? 'Stop voice dictation'
                        : !isHumanTurn || turnRunning || isTerminated || isPaused
                          ? 'Microphone is available only during your active turn'
                          : 'Start voice dictation'
                    }
                    aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                    aria-pressed={isListening}
                  >
                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>
                  <div
                    className={`arena-audio-waves ${isListening ? 'active' : ''}`}
                    aria-hidden="true"
                  >
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="arena-dock-hint-text" role="status" aria-live="polite">
                    {speechError ||
                      (isListening
                        ? 'Listening… speak your offer or counterproposal.'
                        : isSpeechSupported
                          ? 'Click mic to dictate, then review text before sending.'
                          : 'Voice dictation is not supported in this browser')}
                  </span>
                </div>

                <div className="arena-dock-action-buttons">
                  <button
                    type="button"
                    className="btn-dock-action btn-dock-send"
                    disabled={!isHumanTurn || turnRunning || isTerminated || !practiceMessage.trim() || !isBudgetValidForSubmit}
                    onClick={() => handleSendPracticeMessage()}
                    title={
                      isTerminated
                        ? "Negotiation has ended"
                        : !isHumanTurn
                        ? "Awaiting AI counterpart's response"
                        : turnRunning
                        ? "Deliberating turn..."
                        : !practiceMessage.trim()
                        ? "Type a message or offer to send"
                        : "Send negotiation message"
                    }
                  >
                    {turnRunning ? (
                      <>
                        <Loader2 size={14} className="spin-icon" />
                        <span>Deliberating...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Agent Status & Negotiation Metrics */}
        <div className="arena-sidebar-col">
          {/* Agent Status Card */}
          <div className="arena-side-card">
            <div className="arena-side-card-header">
              <Users size={17} className="arena-card-header-icon" />
              <h2 className="arena-card-title">Agent Status</h2>
            </div>

            <div className="arena-agents-list">
              {activeAgentsList.map((agent, idx) => {
                const isFirst = idx === 0;
                const rolePillClass = (agent.personality || '').toLowerCase().includes('aggressive')
                  ? 'aggressive'
                  : (agent.personality || '').toLowerCase().includes('risk')
                  ? 'risk-averse'
                  : 'collaborative';
                const offerVal = agent.current_offer || (isFirst ? 9000 : 10000);
                const stanceVal = agent.stance || (isFirst ? 'Seeking agreement' : 'Holding firm');
                const progressVal = agent.progress_percent || (isFirst ? 70 : 60);

                return (
                  <div key={agent.id || `agent-item-${idx}`} className="arena-agent-item-card">
                    <div className="arena-agent-item-top">
                      <div className="arena-agent-avatar-small">
                        <AgentFaceAvatar
                          agentId={agent.id}
                          personality={agent.personality}
                          role={agent.role}
                          size={42}
                        />
                      </div>
                      <div className="arena-agent-item-id">
                        <div className="arena-agent-item-name-row">
                          <span className="arena-agent-main-role">{getFormattedAgentTitle(agent, 'agent-status')}</span>
                          {(() => {
                            const isHumanParticipant = Boolean(
                              agent.personality === 'Human' ||
                              agent.is_human === true ||
                              (isPracticeMode && (
                                agent.id === location.state?.userRoleAgentId ||
                                (humanAgent && (agent.id === humanAgent.id || agent.role === humanAgent.role))
                              ))
                            );
                            return (
                              <span className={`arena-role-pill ${isHumanParticipant ? 'human' : rolePillClass}`}>
                                {isHumanParticipant ? 'You' : (agent.personality || (isFirst ? 'Collaborative' : 'Aggressive'))}
                              </span>
                            );
                          })()}
                        </div>
                        <span className="arena-agent-active-badge">Active</span>
                      </div>
                    </div>

                    <p className="arena-agent-goal-text">
                      Goal: {agent.goal || (isFirst ? 'Get best price with good terms' : 'Maximize profit with stable demand')}
                    </p>

                    <div className="arena-agent-offer-stance-row">
                      <div className="arena-agent-stat-col">
                        <span className="arena-stat-label">CURRENT OFFER</span>
                        <span className={`arena-stat-value ${isFirst ? 'buyer-val' : 'seller-val'}`}>
                          ₹{Number(offerVal).toLocaleString()}
                          {currentScenarioId === 'vendor-pricing' && (
                            <span className="arena-stat-unit"> per unit</span>
                          )}
                        </span>
                      </div>
                      <div className="arena-agent-stat-col align-right">
                        <span className="arena-stat-label">{isPracticeMode ? 'LIVE STANCE' : 'Stance'}</span>
                        <span
                          className={`arena-live-stance-pill stance-${getDynamicStanceCategory(agent, simulation, isFirst).toLowerCase()}`}
                          title={`Live Stance: ${getDynamicStanceCategory(agent, simulation, isFirst)}`}
                        >
                          <span className="stance-dot" />
                          {getDynamicStanceCategory(agent, simulation, isFirst)}
                        </span>
                      </div>
                    </div>

                    <div className="arena-agent-progress-row">
                      <div className="arena-agent-progress-track">
                        <div
                          className={`arena-agent-progress-bar ${isFirst ? 'buyer-progress' : 'seller-progress'}`}
                          style={{ width: `${progressVal}%` }}
                        />
                      </div>
                      {!isPracticeMode && (
                        <span className="arena-progress-percent-label">
                          {progressVal}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Numbers and Offer Guide Card (Practice Mode) */}
          {isPracticeMode && (
          <div className="arena-coach-card arena-number-guide-card">
            <div className="arena-coach-header">
              <div className="arena-coach-left">
                <div className="arena-coach-icon-wrap guide-icon-wrap">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="arena-coach-title">Numbers and Offer Guide</h3>
                  <p className="arena-coach-desc">How to enter prices, offers, acceptances, and rejections in Practice Mode</p>
                </div>
              </div>
              <div className="arena-coach-toggle-wrap">
                <button
                  type="button"
                  className={`arena-coach-toggle ${aiCoachEnabled ? 'on' : 'off'}`}
                  onClick={() => setAiCoachEnabled((p) => !p)}
                  title={aiCoachEnabled ? 'Hide Guide' : 'Show Guide'}
                  aria-label="Toggle Guide"
                >
                  <span className="arena-toggle-knob" />
                </button>
              </div>
            </div>

            {aiCoachEnabled && (
              <div className="arena-guide-body">
                <div className="arena-format-table-wrapper">
                  <table className="arena-format-table">
                    <thead>
                      <tr>
                        <th>Format Entered</th>
                        <th>Example Message</th>
                        <th>Extracted Offer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Rupees Symbol (₹)</strong></td>
                        <td><code>&quot;I propose ₹173,500&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹173,500</span></td>
                      </tr>
                      <tr>
                        <td><strong>Rupees Text (Rs.)</strong></td>
                        <td><code>&quot;Rs. 1,50,000 is our best price&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹150,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>Rupees Suffix (rupees / rs)</strong></td>
                        <td><code>&quot;80 rupees&quot; or &quot;80 rs&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹80</span></td>
                      </tr>
                      <tr>
                        <td><strong>Rupees Word Prefix</strong></td>
                        <td><code>&quot;rupees 80&quot; or &quot;rupee 80&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹80</span></td>
                      </tr>
                      <tr>
                        <td><strong>Indian Lakh (lakh / lac)</strong></td>
                        <td><code>&quot;We can do 1.5 lakh&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹150,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>Thousand in Words</strong></td>
                        <td><code>&quot;my offer 50 thousand&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹50,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>LPA (Lakhs Per Annum)</strong></td>
                        <td><code>&quot;My expectation is ₹2 LPA&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹200,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>Dollars ($)</strong></td>
                        <td><code>&quot;Final offer is $80,000&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹80,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>K Notation (k)</strong></td>
                        <td><code>&quot;We can offer 120k&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹120,000</span></td>
                      </tr>
                      <tr>
                        <td><strong>Raw Numbers</strong></td>
                        <td><code>&quot;110000&quot;</code></td>
                        <td><span className="format-badge-sample">Offer: ₹110,000</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="arena-format-guide-note">
                  <AlertCircle size={15} className="guide-note-icon" />
                  <p>
                    <strong>Don&apos;t use dollars ($):</strong> All scenario conversions, budget limits, and evaluation thresholds are calibrated for <strong>Rupees (₹) only</strong>. If you write a price with a dollar sign (e.g. <code>$80,000</code>), it will automatically convert directly into Rupees (<strong>₹80,000</strong>).
                  </p>
                </div>

                <div className="arena-guide-action-box">
                  <div className="arena-guide-action-item accept-item">
                    <CheckCircle2 size={16} className="guide-action-icon text-emerald-500" />
                    <div>
                      <strong>Accepting an Offer:</strong>
                      <p>
                        Type messages such as <code>&quot;I want to accept this offer&quot;</code>, <code>&quot;I accept the deal&quot;</code>, or <code>&quot;I agree to your offer&quot;</code>, or directly click the <strong>&quot;I accept the deal.&quot;</strong> quick option button. The negotiation will immediately conclude with a successful agreement (<strong>Agreed</strong>) and no further turns will run.
                      </p>
                    </div>
                  </div>

                  <div className="arena-guide-action-item reject-item">
                    <XCircle size={16} className="guide-action-icon text-rose-500" />
                    <div>
                      <strong>Rejecting an Offer:</strong>
                      <p>
                        Type messages such as <code>&quot;I want to reject this offer&quot;</code>, <code>&quot;I cannot accept this offer&quot;</code>, or <code>&quot;I decline this deal&quot;</code>, or directly click the <strong>&quot;I cannot accept this offer.&quot;</strong> quick option button. The negotiation will immediately conclude in a breakdown (<strong>Rejected / Deadlock</strong>).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Negotiation Metrics Card */}
          <div className="arena-side-card">
            <div
              className={`arena-side-card-header ${isPracticeMode ? 'clickable' : ''}`}
              onClick={() => isPracticeMode && setMetricsExpanded((p) => !p)}
            >
              <div className="arena-side-card-header-left">
                <BarChart3 size={17} className="arena-card-header-icon" />
                <h2 className="arena-card-title">Negotiation Metrics</h2>
              </div>
              {isPracticeMode && (
                <ChevronDown size={18} className={`arena-metrics-chevron ${metricsExpanded ? 'rotated' : ''}`} />
              )}
            </div>

            {(!isPracticeMode || metricsExpanded) && <div className="arena-metrics-grid">
              {/* Metric 1: Current Round */}
              <div className="arena-metric-box">
                <span className="arena-metric-label">Current Round</span>
                <span className="arena-metric-number">
                  {currentRound} / {maxRounds}
                </span>
                <div className="arena-metric-bar-track">
                  <div
                    className="arena-metric-bar-fill blue-fill"
                    style={{ width: `${roundProgress}%` }}
                  />
                </div>
              </div>

              {/* Metric 2: Offers Exchanged */}
              <div className="arena-metric-box">
                <span className="arena-metric-label">Offers Exchanged</span>
                <span className="arena-metric-number">{offersCount}</span>
                <div className="arena-metric-bar-track">
                  <div
                    className="arena-metric-bar-fill purple-fill"
                    style={{ width: `${Math.min(100, offersCount * 22)}%` }}
                  />
                </div>
              </div>

              {/* Metric 3: Current Gap */}
              <div className="arena-metric-box">
                <span className="arena-metric-label">Current Gap</span>
                <span className="arena-metric-number gap-number">
                  ₹{Number(currentGap).toLocaleString()}
                </span>
                <div className="arena-metric-bar-track">
                  <div
                    className="arena-metric-bar-fill red-fill"
                    style={{ width: `${Math.min(100, Math.max(15, currentGap / 30))}%` }}
                  />
                </div>
              </div>

              {/* Metric 4: Agreement Likelihood */}
              <div className="arena-metric-box">
                <span className="arena-metric-label">Agreement Likelihood</span>
                <span className="arena-metric-number green-number">
                  {agreementLikelihood}%
                </span>
                <div className="arena-metric-bar-track">
                  <div
                    className="arena-metric-bar-fill green-fill"
                    style={{ width: `${agreementLikelihood}%` }}
                  />
                </div>
              </div>
            </div>}
          </div>
        </div>
      </div>

      {/* Practice Mode Executive Negotiation Report Modal */}
      {showPracticeReportModal && (
        <div className="arena-modal-backdrop" onClick={() => setShowPracticeReportModal(false)}>
          <div className="arena-modal-card practice-report-dev-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="practice-dev-header">
              <div className="practice-dev-icon-wrap" style={{ background: isDeadlock ? '#fee2e2' : '#dcfce7' }}>
                {isDeadlock ? <XCircle size={28} style={{ color: '#ef4444' }} /> : <CheckCircle2 size={28} style={{ color: '#16a34a' }} />}
              </div>
              <span className="practice-dev-badge">Practice Mode Telemetry</span>
              <h3 className="practice-dev-title">
                {isDeadlock ? 'Negotiation Deadlock Audit' : 'Negotiation Agreement Report'}
              </h3>
              <span className={`practice-dev-status-pill ${isDeadlock ? 'status-danger' : 'status-success'}`} style={{
                background: isDeadlock ? '#fee2e2' : '#dcfce7',
                color: isDeadlock ? '#b91c1c' : '#15803d',
                fontWeight: 700
              }}>
                {isDeadlock ? 'Deadlock Impasse' : 'Agreement Finalized'}
              </span>
            </div>

            <div className="practice-report-summary-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              margin: '18px 0',
              padding: '14px',
              background: 'var(--bg-card-subtle, #f8fafc)',
              borderRadius: '12px',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Settlement Value</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: isDeadlock ? '#b91c1c' : '#15803d' }}>
                  {simulation?.agreement?.final_value
                    ? `₹${Number(simulation.agreement.final_value).toLocaleString()}`
                    : isDeadlock ? 'No Deal' : `Gap: ₹${Number(simulation?.current_gap || 0).toLocaleString()}`}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Rounds Concluded</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {simulation?.current_round || 1} / {simulation?.max_rounds || 10}
                </span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Offers Exchanged</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#6366f1' }}>
                  {(simulation?.messages || []).filter(m => m.offer_value).length}
                </span>
              </div>
            </div>

            <p className="practice-dev-text" style={{ fontSize: '0.92rem', lineHeight: '1.5', color: '#334155', margin: '0 0 16px 0' }}>
              {isDeadlock
                ? `Negotiation reached an impasse in Round ${simulation?.current_round || 1}. Reason: ${simulation?.deadlock_reason || 'Participants were unable to converge within reservation thresholds.'}`
                : `Successfully concluded mutual terms between ${humanAgent?.name || 'Human Participant'} and ${opponentAgent?.name || 'AI Counterpart'} at ₹${Number(simulation?.agreement?.final_value || 0).toLocaleString()} under scenario guidelines.`}
            </p>

            <div className="practice-dev-note" style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '10px', fontSize: '0.82rem', color: '#475569', marginBottom: '20px' }}>
              <span>🎯 <strong>Tactical Feedback:</strong> {isDeadlock ? 'AI counterpart held a firm stance. Consider proposing concessions earlier or testing a collaborative opening move.' : 'Great job closing the gap! Your concessions effectively matched the counterpart archetype.'}</span>
            </div>

            <div className="practice-dev-actions">
              <button
                type="button"
                className="btn-practice-dev-scenarios"
                onClick={() => {
                  allowExitRef.current = true;
                  navigate('/practice');
                }}
              >
                Back to Practice Scenarios
              </button>
              <button
                type="button"
                className="btn-practice-dev-restart"
                onClick={() => {
                  setShowPracticeReportModal(false);
                  handleRestart();
                }}
              >
                Restart Session
              </button>
              <button
                type="button"
                className="btn-practice-dev-close"
                onClick={() => setShowPracticeReportModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NegotiationArena;
