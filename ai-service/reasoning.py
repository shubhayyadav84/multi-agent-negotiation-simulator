import json
from typing import Any, Dict, List, Optional

SUPPORTED_PERSONALITIES = {
    "aggressive",
    "collaborative",
    "risk-averse",
}

SCENARIO_OFFER_FIELDS = {
    "vendor-pricing": ["price", "payment_days", "delivery_weeks"],
    "job-offer": [
        "base_salary",
        "sign_on_bonus",
        "equity_pct",
        "office_days",
        "joining_days",
    ],
    "project-budget": ["engineering", "marketing", "product_ai"],
}


def build_reasoning_prompt(
    scenario: Dict[str, Any],
    agent: Dict[str, Any],
    counterpart: Dict[str, Any],
    round_number: int,
    max_rounds: int,
    current_offer: Optional[float] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Build a context-aware prompt for a negotiation agent."""

    personality = str(agent.get("personality") or "Collaborative")
    if personality.lower() not in SUPPORTED_PERSONALITIES:
        personality = "Collaborative"

    counterpart_personality = str(counterpart.get("personality") or "Collaborative")

    scenario_id = str(scenario.get("id") or "vendor-pricing")
    offer_fields = SCENARIO_OFFER_FIELDS.get(
        scenario_id, ["offer_value"]
    )

    history = (conversation_history or [])[-8:]
    history_text = json.dumps(history, ensure_ascii=False, default=str)

    return f"""
You are an AI autonomous negotiation agent representing {agent.get('role', 'Negotiator')} in a multi-agent simulation.

SCENARIO
ID: {scenario_id}
Title: {scenario.get("title", "Negotiation")}
Domain: {scenario.get("domain", "General")}

YOUR PROFILE
Role: {agent.get("role", "Negotiator")}
Name: {agent.get("name", "Negotiating Agent")}
Personality: {personality}
Goal: {agent.get("goal", "")}
Target value: {agent.get("target_value")}
Reservation value: {agent.get("reservation_value")}
Current offer: {agent.get("current_offer")}
Constraints: {json.dumps(agent.get("constraints") or [])}

COUNTERPART
Role: {counterpart.get("role", "Negotiator")}
Name: {counterpart.get("name", "Counterpart")}
Personality: {counterpart_personality}
Goal: {counterpart.get("goal", "")}
Current offer: {counterpart.get("current_offer")}

NEGOTIATION STATE
Round: {round_number} of {max_rounds}
Incoming offer: {current_offer}
Required offer fields: {json.dumps(offer_fields)}
Conversation history: {history_text}

STRATEGIC PERSONALITY DIRECTIVES:
- Aggressive:
  * You defend your target value fiercely and make minimal concessions (at most 0.5% - 1.5% per round).
  * In rounds 1 through 7, NEVER choose "ACCEPT" unless the counterpart has fully conceded to your target or reservation threshold.
  * CRITICAL FOR AGGRESSIVE VS AGGRESSIVE: Both you and your counterpart are Aggressive! Stand your ground firmly. Do NOT concede easily and DO NOT accept or converge early. Force the negotiation into late rounds (rounds 8-12). If your counterpart refuses to concede, keep countering firmly or let it deadlock in round {max_rounds}.
- Collaborative:
  * You seek a balanced, mutually beneficial agreement. Concede steadily and reciprocally (10% - 20% of the remaining gap per round).
  * Do NOT rush to a fixed round conclusion. Explore nuanced trade-offs across multiple rounds so convergence emerges naturally between Round 6 and Round 11.
- Risk-Averse:
  * You prioritize certainty and avoiding deadlock, but maintain commercial prudence.
  * Concede carefully across rounds to secure agreement without giving away margin prematurely. NEVER accept before Round 5.

RULES & CONSTRAINTS:
- MATHEMATICAL CROSSOVER & DIRECT ACCEPTANCE RULE:
  * If you are a Seller and the Buyer's offer is greater than or equal to your asking price/target, you MUST immediately choose "ACCEPT" and set "agreement_reached": true!
  * If you are a Buyer and the Seller's offer is less than or equal to your target/budget, you MUST immediately choose "ACCEPT" and set "agreement_reached": true!
  * If you are a Candidate and the Recruiter's offer is greater than or equal to your salary expectation, you MUST immediately choose "ACCEPT" and set "agreement_reached": true!
  * If you are a Recruiter and the Candidate's expectation is less than or equal to your offer/budget, you MUST immediately choose "ACCEPT" and set "agreement_reached": true!
  * If this is Project Budget Allocation and the total department requests sum to <= 1,000,000, you MUST immediately choose "ACCEPT" and set "agreement_reached": true!
  * When any crossover condition above is satisfied, you MUST accept immediately regardless of round number (even in rounds 1-4).
- STRICT MINIMUM 5 ROUNDS FOR NORMAL BARGAINING: When a gap remains (Buyer < Seller, Candidate > Recruiter, or Budget > 1,000,000), NEVER choose "ACCEPT" before Round 5! Rounds 1 through 4 are for active bargaining and progressive concessions.
- RANDOMIZED, NON-DETERMINISTIC CONVERGENCE: Do NOT follow a fixed round pattern or always settle in Round 5 or 6! Every negotiation run must feel distinct and unpredictable. Vary your concessions and bargaining posture naturally so that agreement can occur at diverse rounds (e.g. Round 6, 7, 8, 9, 10, 11, or 12), or result in a deadlock if positions fail to align.
- Check current Round ({round_number} of {max_rounds}):
  * If round_number < 5 and NO mathematical crossover has occurred: You MUST choose "OFFER" or "COUNTER_OFFER". "ACCEPT" is prohibited before Round 5 unless a direct crossover has occurred!
  * If you are Aggressive: DO NOT accept in rounds 1 through 7 unless your target is met or crossed.
  * If both agents are Aggressive: DO NOT accept! Stand firm and keep countering through later rounds.
- Never knowingly violate a stated hard constraint (e.g. Buyer payment_days >= 60).
- For vendor-pricing: proposed_offer must include "price" (numeric), "payment_days" (numeric, >= 60 for buyer), and "delivery_weeks" (numeric).
- For job-offer: proposed_offer must include "base_salary" (numeric), "sign_on_bonus" (numeric), "equity_pct" (numeric), "office_days" (numeric), "joining_days" (numeric).
- For project-budget: proposed_offer must include "engineering", "marketing", and "product_ai" allocations summing to exactly 1,000,000.
- Return only valid JSON. Do not include Markdown fences.
- DIVERSITY & NATURAL DIALOGUE: Generate unique, persuasive, context-specific negotiation dialogue. Avoid canned repetitive phrases. Adapt your rationale to the latest round numbers and counterpart actions.

JSON FORMAT
{{
  "message": "Natural conversational response",
  "action": "OFFER, COUNTER_OFFER, ACCEPT, or REJECT",
  "proposed_offer": {{}},
  "offer_value": null,
  "stance": "Short negotiation stance",
  "decision_explanation": "Brief explanation of the decision",
  "agreement_reached": false
}}
""".strip()


def extract_json_block(text: str) -> str:
    """Robustly extract JSON string from model response, handling code fences and preamble."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        cleaned = cleaned[first_brace:last_brace + 1]
    return cleaned


def parse_reasoning_response(
    response_text: str,
) -> Optional[Dict[str, Any]]:
    """Parse and validate the essential fields in a Gemini JSON response."""

    try:
        clean_text = extract_json_block(response_text)
        result = json.loads(clean_text)
    except (json.JSONDecodeError, TypeError):
        return None

    if not isinstance(result, dict):
        return None

    action = str(result.get("action", "")).upper()
    allowed_actions = {"OFFER", "COUNTER_OFFER", "ACCEPT", "REJECT"}

    if action not in allowed_actions:
        return None

    message = result.get("message")
    if not isinstance(message, str) or not message.strip():
        return None

    proposed_offer = result.get("proposed_offer", {})
    if not isinstance(proposed_offer, dict):
        return None

    for key, value in proposed_offer.items():
        if not isinstance(key, str):
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None

    offer_value = result.get("offer_value")
    if offer_value is not None:
        if isinstance(offer_value, bool) or not isinstance(
            offer_value, (int, float)
        ):
            return None

    result["action"] = action
    result["message"] = message.strip()
    result["proposed_offer"] = proposed_offer
    result["decision_explanation"] = str(
        result.get("decision_explanation") or ""
    )
    result["agreement_reached"] = (
        action == "ACCEPT"
        and result.get("agreement_reached") is True
    )

    return result
