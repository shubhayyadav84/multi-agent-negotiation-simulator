"""Offline Practice Mode test runner (Issue #31).

Plays scripted HUMAN strategies against the AI service for all 3 scenarios and
3 AI personalities, using ONLY the built-in fallback engine (no Gemini calls,
no API quota). Run from the ai-service folder:

    py tests/practice_mode_runner.py

Writes tests/logs/practice_mode_log.csv (every request) and
tests/logs/practice_mode_summary.txt (what is printed).
"""
import csv
import datetime
import logging
import os
import sys
import warnings

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")

import main  # noqa: E402

main.gemini_client = None    # force the fallback engine: no quota used
main.openai_client = None
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app, raise_server_exceptions=False)
ROUNDS, MAX_ROUNDS = 8, 10
PERSONALITIES = ("Aggressive", "Collaborative", "Risk-Averse")


def ramp(a, b, n=ROUNDS):
    return [round(a + (b - a) * i / (n - 1)) for i in range(n)]


def strategies(extreme, start, end, rigid, jump):
    return {"extreme": [extreme] * ROUNDS,
            "concede": ramp(start, end),
            "rigid": [rigid] * ROUNDS,
            "rapid": [extreme] + [jump] * (ROUNDS - 1)}


# down=True: the AI concedes by lowering its own number.
# target/limit/better: how the AI judges the HUMAN's offer (None = not applicable).
SIDES = [
    dict(name="vendor: AI seller vs human buyer", scenario="vendor-pricing",
         role="Sales Representative", agent_id="vendor-sales", key="price", down=True,
         target=110000, limit=90000, better="higher",
         human=strategies(80000, 88000, 108000, 95000, 120000)),
    dict(name="vendor: AI buyer vs human seller", scenario="vendor-pricing",
         role="Procurement Director (Buyer)", agent_id="buyer-procurement", key="price", down=False,
         target=95000, limit=100000, better="lower",
         human=strategies(125000, 120000, 96000, 105000, 90000)),
    dict(name="job: AI employer vs human candidate", scenario="job-offer",
         role="Hiring Director", agent_id="hiring-director", key="base_salary", down=False,
         target=150000, limit=168000, better="lower",
         human=strategies(190000, 185000, 152000, 165000, 150000)),
    dict(name="job: AI candidate vs human employer", scenario="job-offer",
         role="Candidate", agent_id="job-candidate", key="base_salary", down=True,
         target=175000, limit=160000, better="higher",
         human=strategies(120000, 135000, 172000, 165000, 190000)),
    dict(name="budget: AI marketing vs human eng. lead", scenario="project-budget",
         role="CMO Marketing", agent_id="cmo-marketing", key="marketing", down=True,
         target=None, limit=None, better=None,
         human=strategies(600000, 550000, 420000, 450000, 380000)),
    dict(name="budget: AI product AI vs human eng. lead", scenario="project-budget",
         role="Head of Product AI", agent_id="head-product-ai", key="product_ai", down=True,
         target=None, limit=None, better=None,
         human=strategies(600000, 550000, 420000, 450000, 380000)),
]

LINES = []


def out(text=""):
    print(text)
    LINES.append(text)


def at_or_better(value, ref, better):
    return value >= ref if better == "higher" else value <= ref


def worse_than(value, ref, better):
    return value < ref if better == "higher" else value > ref


def post(scenario, role, personality, offer, rnd=2, mx=MAX_ROUNDS, history=None, prev=None):
    body = {"scenario": {"id": scenario},
            "agent": {"role": role, "personality": personality, "current_offer": prev},
            "counterpart_agent": {"role": "Human", "current_offer": offer},
            "round_number": rnd, "max_rounds": mx, "current_offer": offer,
            "conversation_history": history if history is not None else []}
    return client.post("/api/agent/respond", json=body)


def run_conversations(csv_writer):
    stats, slots, strat_stats = {}, {}, {}
    for side in SIDES:
        s = stats.setdefault(side["name"], dict(runs=0, deals=0, bad=0, missed=0,
                                                back=0, viol=0, crash=0))
        for pers in PERSONALITIES:
            for strat, offers in side["human"].items():
                s["runs"] += 1
                history, seq, prev, deal = [], [], None, False
                for rnd, h in enumerate(offers, start=1):
                    r = post(side["scenario"], side["role"], pers, h, rnd,
                             MAX_ROUNDS, history, prev)
                    if r.status_code != 200:
                        s["crash"] += 1
                        csv_writer.writerow([side["name"], pers, strat, rnd, h,
                                             "HTTP %d" % r.status_code, "", ""])
                        break
                    j = r.json()
                    offer = j["proposed_offer"] or j["terms"].get("proposed_offer", {})
                    ok = False
                    if offer:
                        ok = bool(main.validate_proposed_offer(
                            side["scenario"], side["agent_id"], offer)[0])
                    if not ok:
                        s["viol"] += 1
                    act = j["action"]
                    val = offer.get(side["key"]) if offer else None
                    if side["target"] is not None:
                        if act == "ACCEPT" and worse_than(h, side["limit"], side["better"]):
                            s["bad"] += 1
                        if rnd >= 2 and at_or_better(h, side["target"], side["better"]) \
                                and act != "ACCEPT":
                            s["missed"] += 1
                    slots.setdefault((side["name"], pers, rnd), []).append(val)
                    if act != "ACCEPT" and val is not None:
                        if seq and ((side["down"] and val > seq[-1]) or
                                    (not side["down"] and val < seq[-1])):
                            s["back"] += 1
                        seq.append(val)
                    csv_writer.writerow([side["name"], pers, strat, rnd, h, act, val, ok])
                    history += [{"speaker": "Human", "message": "My offer is %s" % h, "offer": h},
                                {"speaker": "AI", "message": j["message"], "offer": val}]
                    prev = val
                    if act == "ACCEPT":
                        deal = True
                        break
                if deal:
                    s["deals"] += 1
                st = strat_stats.setdefault(strat, dict(runs=0, deals=0))
                st["runs"] += 1
                st["deals"] += 1 if deal else 0
    return stats, slots, strat_stats


def reacts_percent(slots, side_name):
    keys = [k for k in slots if k[0] == side_name and len(slots[k]) > 1]
    varied = sum(1 for k in keys if len(set(slots[k])) > 1)
    return 100.0 * varied / len(keys) if keys else 0.0


def run_edge_cases():
    out("\n== EDGE CASES (AI seller, vendor pricing) ==")
    base = ("vendor-pricing", "Sales Representative", "Collaborative")
    cases = [("normal offer 100000", dict(offer=100000)),
             ("no offer (None)", dict(offer=None)),
             ("zero offer", dict(offer=0)),
             ("negative offer", dict(offer=-5000)),
             ("huge offer 10^12", dict(offer=10 ** 12)),
             ("text 'abc' as offer", dict(offer="abc")),
             ("round 0", dict(offer=100000, rnd=0)),
             ("round 12 of max 10", dict(offer=100000, rnd=12)),
             ("max_rounds 1", dict(offer=100000, mx=1)),
             ("empty message in history", dict(offer=100000, history=[{"speaker": "Human", "message": ""}])),
             ("200 messages in history", dict(offer=100000, history=[{"message": "x"}] * 200))]
    problems = []
    for label, kw in cases:
        r = post(*base, **kw)
        if r.status_code == 200:
            j = r.json()
            note = ""
            if label.split()[0] in ("zero", "negative", "huge", "no"):
                note = "  <-- invalid offer accepted silently"
                problems.append(label)
            out("%-26s HTTP 200 %-13s %s%s" % (label, j["action"], j["offer_value"], note))
        elif r.status_code == 422:
            out("%-26s HTTP 422 refused with a clear validation error" % label)
        else:
            out("%-26s HTTP %d  <-- CRASH" % (label, r.status_code))
            problems.append(label)
    r = post("xyz", "Sales Representative", "Collaborative", 100000)
    if r.status_code >= 500:
        out("%-26s HTTP %d  <-- CRASH (should be a clear error)" % ("unknown scenario 'xyz'", r.status_code))
        problems.append("unknown scenario")
    else:
        out("%-26s HTTP %d handled" % ("unknown scenario 'xyz'", r.status_code))
    return problems


def run_all():
    os.makedirs(os.path.join(HERE, "logs"), exist_ok=True)
    log_path = os.path.join(HERE, "logs", "practice_mode_log.csv")
    with open(log_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["side", "ai_personality", "human_strategy", "round",
                    "human_offer", "ai_action", "ai_offer", "ai_limits_ok"])
        stats, slots, strat_stats = run_conversations(w)

    out("== PRACTICE MODE OFFLINE RUN  %s ==" % datetime.date.today())
    out("Engine: built-in fallback (Gemini disabled, no quota used)")
    total_runs = sum(s["runs"] for s in stats.values())
    out("Conversations: %d (6 sides x 4 human strategies x 3 AI personalities, up to %d rounds)"
        % (total_runs, ROUNDS))
    out("\n%-42s %4s %5s %5s %6s %5s %5s %6s %8s" %
        ("SIDE", "runs", "deals", "crash", "limits", "bad", "miss", "backw", "reacts%"))
    findings = []
    for side in SIDES:
        s = stats[side["name"]]
        pct = reacts_percent(slots, side["name"])
        out("%-42s %4d %5d %5d %6d %5d %5d %6d %7.0f%%" % (
            side["name"], s["runs"], s["deals"], s["crash"], s["viol"],
            s["bad"], s["missed"], s["back"], pct))
        if s["crash"]:
            findings.append("CRASH in '%s' (%d)" % (side["name"], s["crash"]))
        if s["viol"]:
            findings.append("AI offer broke its own hard limits in '%s' (%d)" % (side["name"], s["viol"]))
        if s["bad"]:
            findings.append("AI ACCEPTED an offer beyond its limit in '%s' (%d)" % (side["name"], s["bad"]))
        if s["missed"]:
            findings.append("AI did not accept offers better than its target in '%s' (%d)" % (side["name"], s["missed"]))
        if s["back"]:
            findings.append("AI moved AWAY from the human in '%s' (%d)" % (side["name"], s["back"]))
        if pct < 50:
            findings.append("AI reply barely depends on the human's offer in '%s' (%.0f%%)" % (side["name"], pct))
    out("\nlegend: limits = AI offers that broke its hard limits | bad = accepted an offer beyond its limit")
    out("        miss = offer at/better than AI target not accepted (round 2+) | backw = AI moved away from human")
    out("        reacts%  = share of rounds where the AI reply changed when the human offer changed")
    out("\n== DEALS BY HUMAN STRATEGY ==")
    for strat, st in strat_stats.items():
        out("%-8s %3d runs, deal reached in %3d" % (strat, st["runs"], st["deals"]))

    problems = run_edge_cases()
    out("\n== FINDINGS ==")
    for item in findings + ["EDGE CASE: " + p for p in problems]:
        out("- " + item)
    if not findings and not problems:
        out("- none")
    out("\nFull log: %s" % os.path.relpath(log_path))
    with open(os.path.join(HERE, "logs", "practice_mode_summary.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LINES) + "\n")


if __name__ == "__main__":
    run_all()