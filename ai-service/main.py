import os
import json
import logging
import asyncio
import math
import random
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from reasoning import build_reasoning_prompt, parse_reasoning_response
from decision.config import get_scenario
from decision.evaluator import normalize_offer
from decision.scoring import hard_violations

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_negotiation_service")

app = FastAPI(
    title="Multi-Agent Negotiation AI Service",
    description="FastAPI service powered by Gemini for autonomous negotiation agents",
    version="1.0.0",
)

# Enable CORS for Express backend and React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# Initialize Gemini Client if key is available
gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info(f"✅ Gemini client initialized successfully with model: {GEMINI_MODEL}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Gemini client: {e}")
else:
    logger.info("ℹ️ GEMINI_API_KEY not set in .env.")

# Initialize OpenAI Backup Client if key is available
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info(f"✅ OpenAI backup client initialized successfully with model: {OPENAI_MODEL}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize OpenAI backup client: {e}")
else:
    logger.info("ℹ️ OPENAI_API_KEY not set in .env.")


# ============================================================================
# Pydantic Request / Response Data Models
# ============================================================================

class AgentProfile(BaseModel):
    id: Optional[str] = None
    role: str
    name: Optional[str] = "Negotiating Agent"
    personality: Optional[str] = "Collaborative"
    goal: Optional[str] = ""
    target_value: Optional[float] = None
    reservation_value: Optional[float] = None
    current_offer: Optional[float] = None
    stance: Optional[str] = "Seeking agreement"
    progress_percent: Optional[int] = 50
    constraints: Optional[List[str]] = []


class ScenarioContext(BaseModel):
    id: str
    title: Optional[str] = "Commercial Negotiation"
    domain: Optional[str] = "General"


class NegotiationTurnRequest(BaseModel):
    scenario: ScenarioContext
    agent: AgentProfile
    counterpart_agent: AgentProfile
    round_number: int = 1
    max_rounds: int = 10
    current_offer: Optional[float] = None
    conversation_history: Optional[List[Dict[str, Any]]] = []


class NegotiationTurnResponse(BaseModel):
    agent_role: str
    agent_name: str
    message: str
    action: str = Field(..., description="OFFER, COUNTER_OFFER, ACCEPT, REJECT")
    offer_value: Optional[float] = None
    proposed_offer: Dict[str, Any] = Field(default_factory=dict)
    currency: str = "₹"
    stance: str = "Seeking agreement"
    progress_percent: int = 50
    reasoning: Optional[str] = ""
    agreement_reached: bool = False
    terms: Optional[Dict[str, Any]] = Field(default_factory=dict)


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/")
def root():
    return {
        "status": "ONLINE",
        "service": "Multi-Agent Negotiation AI Service (FastAPI)",
        "version": "1.0.0",
        "docs_url": "/docs",
        "health_check": "/health"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "service": "Multi-Agent Negotiation AI Service (FastAPI)",
        "gemini_api_configured": bool(GEMINI_API_KEY and gemini_client),
        "gemini_model": GEMINI_MODEL,
        "openai_api_configured": bool(OPENAI_API_KEY and openai_client),
        "openai_model": OPENAI_MODEL,
    }


@app.post("/api/agent/respond", response_model=NegotiationTurnResponse)
async def generate_agent_response(request: NegotiationTurnRequest):
    """
    Generate an autonomous negotiation move using Gemini AI (with dynamic fallback).
    """
    logger.info(
        f"Processing turn for {request.agent.role} ({request.agent.personality}) in round {request.round_number}/{request.max_rounds}"
    )

    # 1. Primary: Attempt Gemini Generation
    if gemini_client and GEMINI_API_KEY:
        try:
            ai_response = await call_gemini_model(request)
            if ai_response:
                return ai_response
        except Exception as e:
            logger.warning(f"⚠️ Gemini API call failed: {e}. Trying OpenAI backup...")

    # 2. Secondary: Attempt OpenAI Backup Generation
    if openai_client and OPENAI_API_KEY:
        try:
            ai_response = await call_openai_model(request)
            if ai_response:
                logger.info(f"✅ Successfully generated response using OpenAI backup for {request.agent.role}")
                return ai_response
        except Exception as e:
            logger.warning(f"⚠️ OpenAI backup call failed: {e}. Falling back to domain engine.")

    # 3. Tertiary: Resilient Mathematical Domain Fallback Engine
    return generate_domain_fallback_response(request)


# ============================================================================
# Gemini Generation Logic
# ============================================================================

async def call_gemini_model(req: NegotiationTurnRequest) -> Optional[NegotiationTurnResponse]:
    """Generate and validate a context-aware negotiation move using Gemini."""

    prompt = build_reasoning_prompt(
        scenario=req.scenario.model_dump(),
        agent=req.agent.model_dump(),
        counterpart=req.counterpart_agent.model_dump(),
        round_number=req.round_number,
        max_rounds=req.max_rounds,
        current_offer=req.current_offer,
        conversation_history=req.conversation_history or [],
    )

    # Run blocking SDK call inside a separate thread to prevent event loop stalls
    response = await asyncio.to_thread(
        gemini_client.models.generate_content,
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "temperature": 0.7,
        },
    )

    if not response or not response.text:
        return None

    parsed = parse_reasoning_response(response.text)
    if not parsed:
        logger.warning(f"Gemini returned text that could not be parsed: {response.text[:200]}")
        return None

    action = parsed["action"]
    proposed_offer = parsed.get("proposed_offer") or {}

    # Guardrail: If there are prior turns in history, downgrade OFFER to COUNTER_OFFER
    has_prior = bool(req.conversation_history and len(req.conversation_history) > 0) or (req.round_number > 1)
    if action == "OFFER" and has_prior:
        action = "COUNTER_OFFER"

    # Guardrail: Strict rule - NEVER allow ACCEPT before Round 5 under any circumstances!
    agent_personality = (req.agent.personality or "Collaborative").lower()
    if action == "ACCEPT" and req.round_number < 5:
        logger.info(f"Guardrail enforced minimum 5 rounds: adjusted premature ACCEPT in round {req.round_number} to COUNTER_OFFER")
        action = "COUNTER_OFFER"
        parsed["agreement_reached"] = False

    # Guardrail: Prevent premature agreement if agent is Aggressive and round is early (rounds 1-7)
    if action == "ACCEPT" and req.round_number <= 7 and "aggressive" in agent_personality:
        logger.info(f"Guardrail adjusted premature ACCEPT by Aggressive agent in round {req.round_number} to COUNTER_OFFER")
        action = "COUNTER_OFFER"
        parsed["agreement_reached"] = False

    # Extract numeric offer
    offer_val = parsed.get("offer_value")
    if offer_val is None:
        for key in ("price", "base_salary", "engineering"):
            if key in proposed_offer:
                offer_val = proposed_offer[key]
                break

    if offer_val is None:
        offer_val = (
            req.agent.current_offer
            if req.agent.current_offer is not None
            else req.agent.target_value
        )

    agreement = (
        action == "ACCEPT"
        and parsed.get("agreement_reached") is True
    )

    progress = min(100, max(20, int(30 + req.round_number * 10)))
    if agreement:
        progress = 100

    terms = {
        "round": req.round_number,
        "proposed_offer": proposed_offer,
    }
    if offer_val is not None:
        terms["unitPrice"] = offer_val

    return NegotiationTurnResponse(
        agent_role=req.agent.role,
        agent_name=req.agent.name or req.agent.role,
        message=parsed["message"],
        action=action,
        offer_value=float(offer_val) if offer_val is not None else None,
        currency="₹",
        stance=parsed.get("stance", "Seeking agreement"),
        progress_percent=progress,
        reasoning=parsed.get("decision_explanation", ""),
        agreement_reached=agreement,
        terms=terms,
    )



def _package_reasoning_turn_response(req: NegotiationTurnRequest, parsed: dict) -> NegotiationTurnResponse:
    action = parsed.get("action", "OFFER")
    proposed_offer = parsed.get("proposed_offer") or {}

    # Guardrail: If there are prior turns in history, downgrade OFFER to COUNTER_OFFER
    has_prior = bool(req.conversation_history and len(req.conversation_history) > 0) or (req.round_number > 1)
    if action == "OFFER" and has_prior:
        action = "COUNTER_OFFER"

    # Guardrail: Strict rule - NEVER allow ACCEPT before Round 5 under any circumstances!
    agent_personality = (req.agent.personality or "Collaborative").lower()
    if action == "ACCEPT" and req.round_number < 5:
        logger.info(f"Guardrail enforced minimum 5 rounds: adjusted premature ACCEPT in round {req.round_number} to COUNTER_OFFER")
        action = "COUNTER_OFFER"
        parsed["agreement_reached"] = False

    # Guardrail: Prevent premature agreement if agent is Aggressive and round is early (rounds 1-7)
    if action == "ACCEPT" and req.round_number <= 7 and "aggressive" in agent_personality:
        logger.info(f"Guardrail adjusted premature ACCEPT by Aggressive agent in round {req.round_number} to COUNTER_OFFER")
        action = "COUNTER_OFFER"
        parsed["agreement_reached"] = False

    # Extract numeric offer
    offer_val = parsed.get("offer_value")
    if offer_val is None:
        for key in ("price", "base_salary", "engineering"):
            if key in proposed_offer:
                offer_val = proposed_offer[key]
                break

    if offer_val is None:
        offer_val = (
            req.agent.current_offer
            if req.agent.current_offer is not None
            else req.agent.target_value
        )

    agreement = (
        action == "ACCEPT"
        and parsed.get("agreement_reached") is True
    )

    progress = min(100, max(20, int(30 + req.round_number * 10)))
    if agreement:
        progress = 100

    terms = {
        "round": req.round_number,
        "proposed_offer": proposed_offer,
    }
    if offer_val is not None:
        terms["unitPrice"] = offer_val

    return NegotiationTurnResponse(
        agent_role=req.agent.role,
        agent_name=req.agent.name or req.agent.role,
        message=parsed["message"],
        action=action,
        offer_value=float(offer_val) if offer_val is not None else None,
        currency="₹",
        stance=parsed.get("stance", "Seeking agreement"),
        progress_percent=progress,
        reasoning=parsed.get("decision_explanation", ""),
        agreement_reached=agreement,
        terms=terms,
    )


async def call_openai_model(req: NegotiationTurnRequest) -> Optional[NegotiationTurnResponse]:
    """Generate context-aware negotiation move using OpenAI as fallback for Gemini."""
    if not openai_client:
        return None

    prompt = build_reasoning_prompt(
        scenario=req.scenario.model_dump(),
        agent=req.agent.model_dump(),
        counterpart=req.counterpart_agent.model_dump(),
        round_number=req.round_number,
        max_rounds=req.max_rounds,
        current_offer=req.current_offer,
        conversation_history=req.conversation_history or [],
    )

    response = await openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are an autonomous negotiation agent participating in a simulated negotiation. You must respond ONLY with a valid JSON object matching the requested schema."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    if not response.choices or not response.choices[0].message.content:
        return None

    text = response.choices[0].message.content
    parsed = parse_reasoning_response(text)
    if not parsed:
        logger.warning(f"OpenAI returned text that could not be parsed: {text[:200]}")
        return None

    return _package_reasoning_turn_response(req, parsed)

# ============================================================================
# High-Fidelity Domain Concession Fallback Engine
# ============================================================================

def validate_proposed_offer(scenario_id: str, agent_id: str, offer: Dict[str, Any]) -> tuple:
    """Validate an outgoing offer against the deterministic schema and bounds."""
    scenario = get_scenario(scenario_id)
    profile = scenario.agent(agent_id)

    if not isinstance(offer, dict):
        return False, ["Offer must be a dictionary."]

    expected_keys = {issue.key for issue in profile.issues}
    if scenario.kind == "allocation":
        expected_keys = set(scenario.issue_keys())

    if set(offer) != expected_keys:
        missing = sorted(expected_keys - set(offer))
        extra = sorted(set(offer) - expected_keys)
        errors = []
        if missing:
            errors.append(f"Missing required fields: {', '.join(missing)}")
        if extra:
            errors.append(f"Unexpected fields: {', '.join(extra)}")
        return False, errors

    for key, value in offer.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            return False, [f"{key} must be a finite number."]

    normalized, errors = normalize_offer(
        scenario=scenario,
        offer=offer,
        history=[],
        agent_id=agent_id,
    )
    if errors or normalized is None:
        return False, errors or ["Offer could not be normalized."]

    violations = hard_violations(profile, normalized)
    if violations:
        return False, [item["message"] for item in violations]

    return True, normalized


def compute_concession_rate(personality: str, round_num: int, max_rounds: int, counterpart_personality: str = "") -> float:
    """
    Compute mathematically grounded concession rate based on Boulware / Conceder dynamics.
    - Aggressive: Boulware curve (beta ~ 0.25), minimal concessions in early/mid rounds.
    - Collaborative: Linear / progressive curve (beta ~ 1.0).
    - Risk-Averse: Conceder curve (beta ~ 2.5), early concessions to secure deal.
    """
    if max_rounds <= 1:
        return 1.0
    t_norm = max(0.0, min(1.0, (round_num - 1) / (max_rounds - 1)))
    p_lower = personality.lower()
    cp_lower = counterpart_personality.lower()

    # Dynamic jitter so mathematical curves don't cross at the exact same deterministic round every run
    jitter = random.uniform(-0.06, 0.06)

    if "aggressive" in p_lower:
        dampener = 0.4 if "aggressive" in cp_lower else 0.75
        rate = dampener * (0.04 * t_norm + 0.32 * (t_norm ** 3)) + jitter * 0.4
        return max(0.0, min(0.45, rate))
    elif "risk" in p_lower:
        rate = 0.20 + 0.60 * (t_norm ** 0.8) + jitter
        return max(0.05, min(0.85, rate))
    else:
        rate = 0.08 + 0.62 * t_norm + jitter
        return max(0.05, min(0.80, rate))


def generate_domain_fallback_response(req: NegotiationTurnRequest) -> NegotiationTurnResponse:
    """Generate a dynamic scenario-aware move based on agent personality, math, and rich varied dialogue."""
    scenario_id = req.scenario.id.lower()
    role_combined = f"{req.agent.role} {req.agent.name or ''} {getattr(req.agent, 'id', None) or ''}".lower()
    p_name = req.agent.personality or "Collaborative"
    cp_name = req.counterpart_agent.personality or "Collaborative"
    round_num = max(1, req.round_number)
    max_rounds = max(2, req.max_rounds)
    currency = "₹"

    agent_ids = {
        "vendor-pricing": (
            "buyer-procurement" if any(
                term in role_combined for term in ("buyer", "procurement", "purchasing", "purchase", "client")
            ) else "vendor-sales"
        ),
        "job-offer": (
            "job-candidate" if any(
                term in role_combined for term in ("candidate", "engineer", "applicant", "interviewee")
            ) else "hiring-director"
        ),
        "project-budget": (
            "vp-engineering" if any(term in role_combined for term in ("engineering", "infrastructure", "department-a", "vp-eng"))
            else "cmo-marketing" if any(term in role_combined for term in ("marketing", "growth", "department-b", "cmo"))
            else "head-product-ai"
        ),
    }

    agent_id = agent_ids.get(scenario_id)
    if not agent_id:
        raise ValueError(f"Unsupported negotiation scenario: {scenario_id}")

    concession_rate = compute_concession_rate(p_name, round_num, max_rounds, cp_name)
    has_prior_moves = bool(req.conversation_history and len(req.conversation_history) > 0)
    counterpart_offer = float(req.counterpart_agent.current_offer) if (has_prior_moves and req.counterpart_agent.current_offer) else None
    action = "COUNTER_OFFER" if (has_prior_moves or round_num > 1) else "OFFER"
    agreement = False

    is_both_aggressive = "aggressive" in p_name.lower() and "aggressive" in cp_name.lower()
    can_conclude_agreement = round_num >= 5 and not is_both_aggressive

    # Stochastic acceptance gate: ensures agreement rounds vary across runs (e.g. round 6, 7, 8, 9, 10, 11)
    accept_chance = 0.25 if round_num == 5 else (0.45 if round_num == 6 else (0.65 if round_num == 7 else (0.80 if round_num == 8 else 0.95)))
    is_stochastically_ready = random.random() < accept_chance

    # -------------------------------------------------------------
    # Scenario 1: Vendor Pricing Negotiation
    # -------------------------------------------------------------
    if scenario_id == "vendor-pricing":
        is_buyer = agent_id == "buyer-procurement"

        if is_buyer:
            price_target = 95000.0
            price_limit = 100000.0
            price_jitter = random.uniform(-800.0, 800.0)
            price_conceded = round(price_target + concession_rate * (price_limit - price_target) + price_jitter, -2)
            proposed_price = min(price_limit, max(price_target, price_conceded))

            if counterpart_offer is not None and can_conclude_agreement:
                if (counterpart_offer <= proposed_price or (counterpart_offer <= price_limit and (counterpart_offer - proposed_price) <= 1200)) and is_stochastically_ready:
                    action = "ACCEPT"
                    agreement = True
                    proposed_price = counterpart_offer

            proposed_offer = {
                "price": proposed_price,
                "payment_days": 60,
                "delivery_weeks": 4,
            }

            if agreement:
                msg = random.choice([
                    f"We have evaluated your revised terms. Settling at {currency}{proposed_price:,.0f} with Net-60 terms meets our operational needs. We are pleased to finalize this contract.",
                    f"We accept your proposed contract valuation of {currency}{proposed_price:,.0f} with Net-60 payment terms. We look forward to a successful implementation.",
                    f"Terms are aligned. We confirm acceptance of {currency}{proposed_price:,.0f} and 4-week delivery on Net-60 terms."
                ])
                stance = "Agreement reached"
            elif round_num == 1:
                msg = random.choice([
                    f"We propose an opening enterprise contract value of {currency}{proposed_price:,.0f} with Net-60 payment terms and 4-week delivery.",
                    f"Based on our procurement parameters, our opening offer is {currency}{proposed_price:,.0f} with standard Net-60 payment terms."
                ])
                stance = "Opening proposal"
            elif "aggressive" in p_name.lower():
                msg = random.choice([
                    f"Our enterprise procurement budget has firm boundaries. We adjust our position to {currency}{proposed_price:,.0f} under Net-60 terms.",
                    f"Given our order scale and strict fiscal caps, {currency}{proposed_price:,.0f} represents our benchmark with Net-60 terms.",
                    f"We cannot justify executive clearance above {currency}{proposed_price:,.0f}. We propose moving forward on Net-60 terms.",
                    f"Market alternatives remain within our targeted envelope. We advance a counter of {currency}{proposed_price:,.0f} with Net-60 payment terms."
                ])
                stance = "Defending budget limits"
            elif "risk" in p_name.lower():
                msg = random.choice([
                    f"To eliminate deadlock risks and secure swift agreement, we raise our offer to {currency}{proposed_price:,.0f} with Net-60 terms.",
                    f"Securing operational certainty is our top priority. We propose settling at {currency}{proposed_price:,.0f} under Net-60 days.",
                    f"We are making a notable step forward to {currency}{proposed_price:,.0f} to ensure immediate continuity and contract closure."
                ])
                stance = "Prioritizing deal certainty"
            else:
                msg = random.choice([
                    f"In the spirit of partnership, we are willing to adjust our purchasing offer to {currency}{proposed_price:,.0f} under Net-60 terms.",
                    f"To bridge the commercial gap, we propose moving our budget to {currency}{proposed_price:,.0f} alongside a Net-60 payment schedule.",
                    f"We can advance our offer to {currency}{proposed_price:,.0f} to help achieve a win-win contract on Net-60 terms."
                ])
                stance = "Exploring compromise"

        else:
            price_target = 110000.0
            price_limit = 90000.0
            price_jitter = random.uniform(-800.0, 800.0)
            price_conceded = round(price_target - concession_rate * (price_target - price_limit) + price_jitter, -2)
            proposed_price = max(price_limit, min(price_target, price_conceded))

            if counterpart_offer is not None and can_conclude_agreement:
                if (counterpart_offer >= proposed_price or (counterpart_offer >= price_limit and (proposed_price - counterpart_offer) <= 1200)) and is_stochastically_ready:
                    action = "ACCEPT"
                    agreement = True
                    proposed_price = counterpart_offer

            payment_days = int(30 + round(concession_rate * 30))
            delivery_weeks = int(max(4, 6 - round(concession_rate * 2)))

            proposed_offer = {
                "price": proposed_price,
                "payment_days": payment_days,
                "delivery_weeks": delivery_weeks,
            }

            if agreement:
                msg = random.choice([
                    f"We confirm and accept your proposal at {currency}{proposed_price:,.0f} with Net-60 payment terms. We look forward to delivering exceptional enterprise SLA support.",
                    f"We agree to finalize at {currency}{proposed_price:,.0f} with the agreed service benchmarks. Excited to partner with your organization.",
                    f"Contract finalized at {currency}{proposed_price:,.0f}. Both parties have reached consensus on all key terms."
                ])
                stance = "Agreement reached"
            elif not counterpart_offer or round_num == 1:
                msg = random.choice([
                    f"We are pleased to present our initial enterprise pricing of {currency}{proposed_price:,.0f} with {payment_days}-day terms and 99.9% uptime SLA.",
                    f"Our opening commercial proposal is {currency}{proposed_price:,.0f} with dedicated enterprise infrastructure and {delivery_weeks}-week rollout."
                ])
                stance = "Opening proposal"
            elif "aggressive" in p_name.lower():
                msg = random.choice([
                    f"Our tier-1 enterprise SLA and dedicated engineering justify our premium rate. Our revised rate is {currency}{proposed_price:,.0f} with {payment_days}-day terms.",
                    f"Maintaining our 99.9% uptime guarantee requires sustainable margin. We can adjust to {currency}{proposed_price:,.0f}.",
                    f"We offer substantial commercial value that alternatives cannot match. Our counter stands at {currency}{proposed_price:,.0f}."
                ])
                stance = "Protecting commercial margin"
            elif "risk" in p_name.lower():
                msg = random.choice([
                    f"To prevent an impasse and lock in dedicated account resources, we reduce our pricing to {currency}{proposed_price:,.0f}.",
                    f"We value long-term stability and offer an accelerated concession to {currency}{proposed_price:,.0f} with {payment_days}-day payment.",
                    f"Closing this contract cleanly is our goal. We can meet you at {currency}{proposed_price:,.0f}."
                ])
                stance = "Securing account stability"
            else:
                msg = random.choice([
                    f"To facilitate cross-organization alignment, we offer a volume adjustment down to {currency}{proposed_price:,.0f} with {payment_days}-day terms.",
                    f"We have reviewed our cost structure and can propose {currency}{proposed_price:,.0f} to help close the gap.",
                    f"In response to your counter, we can move our rate to {currency}{proposed_price:,.0f}."
                ])
                stance = "Advancing compromise"

        offer_val = proposed_price

    # -------------------------------------------------------------
    # Scenario 2: Job Offer Compensation Negotiation
    # -------------------------------------------------------------
    elif scenario_id == "job-offer":
        is_candidate = agent_id == "job-candidate"

        if is_candidate:
            sal_target = 175000.0
            sal_limit = 160000.0
            sal_jitter = random.uniform(-1000.0, 1000.0)
            sal_conceded = round(sal_target - concession_rate * (sal_target - sal_limit) + sal_jitter, -2)
            base_salary = max(sal_limit, min(sal_target, sal_conceded))

            if counterpart_offer is not None and can_conclude_agreement:
                if (counterpart_offer >= base_salary or (counterpart_offer >= sal_limit and (base_salary - counterpart_offer) <= 1500)) and is_stochastically_ready:
                    action = "ACCEPT"
                    agreement = True
                    base_salary = counterpart_offer

            proposed_offer = {
                "base_salary": base_salary,
                "sign_on_bonus": int(max(0, 20000 - concession_rate * 15000)),
                "equity_pct": round(max(0.05, 0.25 - concession_rate * 0.10), 2),
                "office_days": 2,
                "joining_days": 60,
            }

            if agreement:
                msg = random.choice([
                    f"I am delighted to accept the offer at {currency}{base_salary:,.0f} base salary with the agreed equity and remote flexibility. Excited to join the team!",
                    f"Thank you for working through these details. I accept {currency}{base_salary:,.0f} base compensation and look forward to contributing.",
                ])
                stance = "Agreement reached"
            elif "aggressive" in p_name.lower():
                msg = random.choice([
                    f"Considering my specialized AI engineering expertise and competing market benchmarks, I require {currency}{base_salary:,.0f} base compensation with hybrid flexibility.",
                    f"Given the scope of technical leadership expected, {currency}{base_salary:,.0f} represents my baseline compensation target.",
                ])
                stance = "Holding for market value"
            else:
                msg = random.choice([
                    f"I can adjust my salary expectation to {currency}{base_salary:,.0f} base given the equity structure.",
                    f"To make this offer work for both sides, I can adjust my base expectation to {currency}{base_salary:,.0f}.",
                ])
                stance = "Constructive counteroffer"

        else:
            sal_target = 150000.0
            sal_limit = 168000.0
            sal_jitter = random.uniform(-1000.0, 1000.0)
            sal_conceded = round(sal_target + concession_rate * (sal_limit - sal_target) + sal_jitter, -2)
            base_salary = min(sal_limit, max(sal_target, sal_conceded))

            if counterpart_offer is not None and can_conclude_agreement:
                if (counterpart_offer <= base_salary or (counterpart_offer <= sal_limit and (counterpart_offer - base_salary) <= 1500)) and is_stochastically_ready:
                    action = "ACCEPT"
                    agreement = True
                    base_salary = counterpart_offer

            proposed_offer = {
                "base_salary": base_salary,
                "sign_on_bonus": int(5000 + concession_rate * 10000),
                "equity_pct": round(min(0.20, 0.15 + concession_rate * 0.05), 2),
                "office_days": 2,
                "joining_days": int(min(90, 30 + concession_rate * 30)),
            }

            if agreement:
                msg = random.choice([
                    f"We are thrilled to welcome you! We confirm your base compensation at {currency}{base_salary:,.0f} with full benefits.",
                    f"We have finalized approvals for {currency}{base_salary:,.0f} base salary and look forward to having you on board.",
                ])
                stance = "Agreement reached"
            elif not counterpart_offer or round_num == 1:
                msg = random.choice([
                    f"We are excited about your candidacy and pleased to extend an initial opening offer of {currency}{base_salary:,.0f} base salary with full benefits and hybrid flexibility.",
                    f"We value your technical background and are pleased to table an opening compensation offer of {currency}{base_salary:,.0f} base salary.",
                ])
                stance = "Opening Proposal"
            elif "aggressive" in p_name.lower():
                msg = random.choice([
                    f"Our internal salary band for this grade is firmly calibrated. We can stretch to {currency}{base_salary:,.0f} base.",
                    f"We must maintain equity across the engineering team. Our revised band limit is {currency}{base_salary:,.0f}.",
                ])
                stance = "Budget boundary enforcement"
            else:
                msg = random.choice([
                    f"We have secured leadership approval to enhance our package to {currency}{base_salary:,.0f} base plus equity incentives.",
                    f"We value your experience and are pleased to raise our compensation offer to {currency}{base_salary:,.0f}.",
                ])
                stance = "Closing compensation gap"

        offer_val = base_salary

    # -------------------------------------------------------------
    # Scenario 3: Project Budget Allocation (Tripartite 1,000,000)
    # -------------------------------------------------------------
    else:
        eng_concession_max = 25000 if "aggressive" in p_name.lower() else 50000
        mkt_concession_max = 20000 if "aggressive" in p_name.lower() else 40000
        prod_concession_max = 15000 if "aggressive" in p_name.lower() else 35000

        eng_req = int(450000 - concession_rate * eng_concession_max + random.uniform(-2000, 2000))
        mkt_req = int(350000 - concession_rate * mkt_concession_max + random.uniform(-2000, 2000))
        prod_req = int(300000 - concession_rate * prod_concession_max)
        total_demanded = eng_req + mkt_req + prod_req

        is_eng = any(term in agent_id for term in ("engineering", "infrastructure", "vp-engineering", "department-a"))
        is_mkt = any(term in agent_id for term in ("marketing", "growth", "cmo", "department-b"))

        if can_conclude_agreement and (total_demanded <= 1000000 or (round_num >= 7 and is_stochastically_ready)):
            eng_final = 410000
            mkt_final = 325000
            prod_final = 265000
            action = "ACCEPT"
            agreement = True
            stance = "Consensus finalized"
            msg = f"All departments agree on the balanced {currency}1,000,000 allocation: Engineering {currency}{eng_final:,}, Marketing {currency}{mkt_final:,}, Product AI {currency}{prod_final:,}."
            offer_val = float(eng_final if is_eng else (mkt_final if is_mkt else prod_final))
            proposed_offer = {
                "engineering": eng_final,
                "marketing": mkt_final,
                "product_ai": prod_final,
            }
        elif round_num == 1:
            action = "OFFER"
            agreement = False
            stance = f"{p_name} opening request"
            if is_eng:
                offer_val = float(eng_req)
                msg = f"Engineering proposes tripartite allocation: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,} (Total {currency}{total_demanded:,}). Core database uptime and platform reliability are our priority."
            elif is_mkt:
                offer_val = float(mkt_req)
                msg = f"Marketing proposes tripartite allocation: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,} (Total {currency}{total_demanded:,}). Securing dedicated growth campaigns is vital to hit revenue milestones."
            else:
                offer_val = float(prod_req)
                msg = f"Product AI proposes tripartite allocation: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,} (Total {currency}{total_demanded:,}). GenAI model integrations require disciplined cross-team trade-offs."
            proposed_offer = {
                "engineering": eng_req,
                "marketing": mkt_req,
                "product_ai": prod_req,
            }
        else:
            action = "COUNTER_OFFER"
            agreement = False
            stance = f"{p_name} budget defense"
            if is_eng:
                offer_val = float(eng_req)
                msg = f"Engineering proposes revised tripartite split: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,} by phasing secondary tooling while safeguarding database uptime."
            elif is_mkt:
                offer_val = float(mkt_req)
                msg = f"Marketing refines our tripartite ask to: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,}, concentrating spend on highest-ROI growth channels."
            else:
                offer_val = float(prod_req)
                msg = f"Product AI proposes revised tripartite split: Engineering {currency}{eng_req:,}, Marketing {currency}{mkt_req:,}, Product AI {currency}{prod_req:,} by prioritizing essential Q3 feature deliverables."
            proposed_offer = {
                "engineering": eng_req,
                "marketing": mkt_req,
                "product_ai": prod_req,
            }

    is_valid, validation_result = validate_proposed_offer(
        scenario_id, agent_id, proposed_offer
    )

    if not is_valid:
        logger.warning(f"Fallback validation warning: {validation_result}. Applying canonical preset.")
        proposed_offer = opening_offer_for_agent(scenario_id, agent_id)

    progress = 100 if agreement else min(95, int(35 + round_num * 6))

    terms = {**proposed_offer, "round": round_num}
    if "price" in proposed_offer:
        terms["unitPrice"] = proposed_offer["price"]

    return NegotiationTurnResponse(
        agent_role=req.agent.role,
        agent_name=req.agent.name or req.agent.role,
        message=msg,
        action=action,
        offer_value=offer_val,
        proposed_offer=proposed_offer,
        currency=currency,
        stance=stance,
        progress_percent=progress,
        reasoning=f"Dynamic concession model ({p_name} vs {cp_name}) at round {round_num}/{max_rounds}.",
        agreement_reached=agreement,
        terms=terms,
    )


def opening_offer_for_agent(scenario_id: str, agent_id: str) -> Dict[str, Any]:
    """Get a deterministic opening offer for the specified agent."""
    scenario = get_scenario(scenario_id)
    profile = scenario.agent(agent_id)

    if scenario.kind == "allocation":
        from decision.budget import opening_allocation
        return opening_allocation(scenario, profile)

    return {issue.key: issue.target for issue in profile.issues}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
