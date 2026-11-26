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
 * `details` are full sessions (with `offers` or `messages`).
 */
export function concessionVelocity(details, scenarioId) {
  const acc = {};
  let used = 0;
  let maxRound = 2;

  const targetSid = String(scenarioId || '').toLowerCase();

  const isScenarioMatch = (s) => {
    if (!s) return false;
    const sid = String(s.scenario_id || s.scenarioId || '').toLowerCase();
    const title = String(s.scenario_title || s.title || '').toLowerCase();

    if (targetSid.includes('vendor')) return sid.includes('vendor') || title.includes('vendor');
    if (targetSid.includes('job')) return sid.includes('job') || title.includes('job');
    if (targetSid.includes('project') || targetSid.includes('budget')) {
      return sid.includes('project') || sid.includes('budget') || title.includes('project') || title.includes('budget');
    }
    return sid === targetSid;
  };

  (details || []).forEach((s) => {
    if (!isScenarioMatch(s)) return;

    // Ingest offers from s.offers or extract from s.messages if offers table is empty
    let rawOffers = Array.isArray(s.offers) && s.offers.length > 0 ? s.offers : [];
    if (rawOffers.length === 0 && Array.isArray(s.messages)) {
      rawOffers = s.messages
        .filter((m) => m && (m.offer_value !== null && m.offer_value !== undefined) && m.sender_type !== 'ORCHESTRATOR')
        .map((m) => ({
          round_number: m.round_number || 1,
          agent_role: m.sender_role || m.sender_name,
          offer_value: m.offer_value,
          terms: m.terms,
        }));
    }

    if (rawOffers.length === 0) return;

    const byRole = {};
    rawOffers.forEach((o) => {
      let v = Number(o.offer_value ?? o.value ?? o.offer);
      const r = Number(o.round_number ?? o.round ?? 1);
      const rawRole = String(o.agent_role || o.sender_role || o.role || '').trim();
      if (!rawRole || !Number.isFinite(r)) return;

      const role = rawRole.replace(/\s*\((You|Human)\)$/i, '').trim();

      // For project budget, extract individual department allocations if total was saved
      if (targetSid.includes('project') || targetSid.includes('budget')) {
        const t = o.terms || {};
        const rLower = role.toLowerCase();
        if (rLower.includes('eng') && Number.isFinite(Number(t.engineering ?? t.engineeringFunding))) {
          v = Number(t.engineering ?? t.engineeringFunding);
        } else if ((rLower.includes('mark') || rLower.includes('cmo')) && Number.isFinite(Number(t.marketing ?? t.marketingFunding))) {
          v = Number(t.marketing ?? t.marketingFunding);
        } else if ((rLower.includes('prod') || rLower.includes('ai')) && Number.isFinite(Number(t.product ?? t.productAIFunding))) {
          v = Number(t.product ?? t.productAIFunding);
        }
      }

      if (Number.isFinite(v)) {
        (byRole[role] = byRole[role] || {})[r] = v;
      }
    });

    let counted = false;
    Object.entries(byRole).forEach(([role, byRound]) => {
      const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
      if (rounds.length >= 2) {
        for (let i = 1; i < rounds.length; i += 1) {
          const delta = Math.abs(byRound[rounds[i]] - byRound[rounds[i - 1]]);
          const roleAcc = acc[role] || (acc[role] = {});
          const cell = roleAcc[rounds[i]] || (roleAcc[rounds[i]] = { sum: 0, n: 0 });
          cell.sum += delta;
          cell.n += 1;
          counted = true;
          if (rounds[i] > maxRound) maxRound = rounds[i];
        }
      } else if (rounds.length === 1) {
        // Single round baseline step so 1-round sessions still plot an anchor point
        const r = 2;
        const roleAcc = acc[role] || (acc[role] = {});
        const cell = roleAcc[r] || (roleAcc[r] = { sum: 0, n: 0 });
        cell.sum += 0;
        cell.n += 1;
        counted = true;
      }
    });

    if (counted) used += 1;
  });

  const effectiveMaxRound = Math.max(3, maxRound);
  const series = Object.keys(acc).sort().map((role) => {
    const points = [];
    for (let r = 2; r <= effectiveMaxRound; r += 1) {
      const cell = acc[role] ? acc[role][r] : null;
      points.push({ round: r, value: cell ? Math.round(cell.sum / cell.n) : 0 });
    }
    return { role, points };
  });

  return { sessionsUsed: used, maxRound: effectiveMaxRound, series };
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
