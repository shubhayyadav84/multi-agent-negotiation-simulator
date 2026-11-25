/**
 * Pure analytics helpers (no React): win rates, concession velocity, surplus efficiency.
 * All numbers come from real saved sessions; nothing here is invented.
 */
const AGREED = new Set(['AGREEMENT_REACHED', 'COMPLETED']);
export const isAgreement = (s) => Boolean(s) && AGREED.has(s.status);

export const SCENARIO_TABS = [
  { id: 'vendor-pricing', label: 'Vendor Pricing' },
  { id: 'job-offer', label: 'Job Offer' },
  { id: 'project-budget', label: 'Project Budget' },
];

/** Agreement rate per AI personality (human players are never counted as an archetype). */
export function personalityWinRates(sessions) {
  const stats = {};
  (sessions || []).forEach((s) => {
    const seen = new Set();
    ((s && s.agents) || []).forEach((a) => {
      const p = a && a.personality;
      if (!p || p === 'Human' || a.is_human === true) return;
      seen.add(p);
    });
    seen.forEach((p) => {
      const row = stats[p] || (stats[p] = { total: 0, wins: 0 });
      row.total += 1;
      if (isAgreement(s)) row.wins += 1;
    });
  });
  const rows = Object.entries(stats).map(([name, v]) => ({
    name,
    rate: Math.round((v.wins / v.total) * 100),
    sessions: v.total,
  }));
  rows.sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  return rows.length ? rows : [{ name: 'No sessions in this mode yet', rate: 0, sessions: 0 }];
}

/**
 * Concession velocity: how far each role moved its own offer from one round to the
 * next (absolute change), averaged over all sessions of one scenario.
 * `details` are full sessions (with `offers`). Round 1 has no previous offer, so curves start at round 2.
 */
export function concessionVelocity(details, scenarioId) {
  const acc = {};
  let used = 0;
  let maxRound = 2;
  (details || []).forEach((s) => {
    if (!s || s.scenario_id !== scenarioId || !Array.isArray(s.offers)) return;
    const byRole = {};
    s.offers.forEach((o) => {
      const v = Number(o.offer_value);
      const r = Number(o.round_number);
      if (!o.agent_role || !Number.isFinite(v) || !Number.isFinite(r)) return;
      (byRole[o.agent_role] = byRole[o.agent_role] || {})[r] = v; // last offer of the round wins
    });
    let counted = false;
    Object.entries(byRole).forEach(([role, byRound]) => {
      const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < rounds.length; i += 1) {
        const delta = Math.abs(byRound[rounds[i]] - byRound[rounds[i - 1]]);
        const roleAcc = acc[role] || (acc[role] = {});
        const cell = roleAcc[rounds[i]] || (roleAcc[rounds[i]] = { sum: 0, n: 0 });
        cell.sum += delta;
        cell.n += 1;
        counted = true;
        if (rounds[i] > maxRound) maxRound = rounds[i];
      }
    });
    if (counted) used += 1;
  });
  const series = Object.keys(acc).sort().map((role) => {
    const points = [];
    for (let r = 2; r <= maxRound; r += 1) {
      const cell = acc[role][r];
      points.push({ round: r, value: cell ? cell.sum / cell.n : null });
    }
    return { role, points };
  });
  return { sessionsUsed: used, maxRound, series };
}

/**
 * Surplus efficiency for two-party sessions. The available surplus is the gap between
 * the two reservation values. A deadlock realises 0%. An agreement realises 100%
 * minus any overshoot beyond a side's reservation value. Also returns, per role, the
 * average share of the surplus captured in agreements.
 */
export function surplusEfficiency(details) {
  let counted = 0;
  let sum = 0;
  let agreements = 0;
  const shares = {};
  (details || []).forEach((s) => {
    if (!s || !Array.isArray(s.agents) || s.agents.length !== 2) return;
    const [a, b] = s.agents;
    const ra = Number(a.reservation_value);
    const rb = Number(b.reservation_value);
    const ta = Number(a.target_value);
    const tb = Number(b.target_value);
    if (![ra, rb, ta, tb].every(Number.isFinite)) return;
    const aPays = ta < ra; // lower is better for this side
    if (aPays === tb < rb) return; // both sides want the same direction: skip
    const payer = aPays ? a : b;
    const receiver = aPays ? b : a;
    const payerRes = aPays ? ra : rb;
    const receiverRes = aPays ? rb : ra;
    const width = payerRes - receiverRes;
    if (width <= 0) return; // no zone of agreement
    counted += 1;
    const final = s.agreement ? Number(s.agreement.final_value) : NaN;
    if (!isAgreement(s) || !Number.isFinite(final)) return;
    agreements += 1;
    const payerSurplus = payerRes - final;
    const receiverSurplus = final - receiverRes;
    const overshoot = Math.max(0, -payerSurplus, -receiverSurplus);
    sum += Math.max(0, 1 - overshoot / width);
    [[payer, payerSurplus], [receiver, receiverSurplus]].forEach(([agent, surplus]) => {
      const row = shares[agent.role] || (shares[agent.role] = { sum: 0, n: 0 });
      row.sum += Math.min(1, Math.max(0, surplus / width));
      row.n += 1;
    });
  });
  return {
    sessionsCounted: counted,
    agreements,
    efficiency: counted ? Math.round((sum / counted) * 100) : null,
    roleShares: Object.entries(shares).map(([role, v]) => ({ role, share: Math.round((v.sum / v.n) * 100) })),
  };
}
