/**
 * Deadlock Pattern Detector
 *
 * The orchestrator saves a plain-English `deadlock_reason` whenever a negotiation
 * hits an impasse. Some impasses end in DEADLOCK; others are rescued by the
 * compromise step and still end in agreement. These helpers group the saved
 * sentences into a few named, recurring causes. Order matters: first match wins.
 */
export const DEADLOCK_CAUSES = [
  { label: 'Aggressive Stance Standoff', test: /aggressive|unyielding/i },
  { label: 'Round Limit Reached', test: /round limit|number of negotiation rounds/i },
  { label: 'No-Offer Warnings Exhausted', test: /without a numerical offer|non-offer|consecutive messages/i },
  { label: 'Repeated Offer, No Concession', test: /repeated the same offer|unchanged offers/i },
  { label: 'Proposals Rejected', test: /repeatedly rejected|explicitly rejected/i },
  { label: 'Compromise Declined', test: /declined the compromise/i },
  { label: 'Resolution Attempts Exhausted', test: /counter-offer attempts/i },
];

export const UNRECORDED_CAUSE = 'Other / Not Recorded';

/** Turns one saved deadlock_reason sentence into a cause name. */
export function classifyDeadlockReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return UNRECORDED_CAUSE;
  const hit = DEADLOCK_CAUSES.find((cause) => cause.test.test(text));
  return hit ? hit.label : UNRECORDED_CAUSE;
}

/**
 * Counts impasse causes across sessions. A session counts when its status is
 * DEADLOCK or it saved a deadlock_reason (impasse later resolved by compromise).
 * Returns { total, deadlocks, resolved, causes: [{ label, count, deadlocked, resolved, pct }] }.
 */
export function summarizeImpasses(sessions) {
  const rows = {};
  let total = 0;
  let deadlocks = 0;
  (sessions || []).forEach((s) => {
    if (!s) return;
    const isDeadlock = s.status === 'DEADLOCK';
    const hasReason = Boolean(s.deadlock_reason && String(s.deadlock_reason).trim());
    if (!isDeadlock && !hasReason) return;
    const label = classifyDeadlockReason(s.deadlock_reason);
    const row = rows[label] || (rows[label] = { label, count: 0, deadlocked: 0, resolved: 0 });
    row.count += 1;
    total += 1;
    if (isDeadlock) {
      row.deadlocked += 1;
      deadlocks += 1;
    } else {
      row.resolved += 1;
    }
  });
  const causes = Object.values(rows)
    .map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { total, deadlocks, resolved: total - deadlocks, causes };
}
