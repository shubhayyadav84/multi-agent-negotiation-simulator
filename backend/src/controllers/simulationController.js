/**
 * Simulation Controller
 * HTTP API Controller connecting Express routes to the Orchestrator Agent service.
 */

const { db } = require('../db/db');
const { orchestratorService } = require('../services/orchestratorService');

/**
 * Verify user ownership of simulation
 */
function isUserAuthorizedForSim(sim, req) {
  if (!sim) return false;
  // If simulation is legacy or unassigned (no user_id or user_email), allow creator
  if (!sim.user_id && !sim.user_email) return true;
  // If authenticated user is present, match UID or Email
  if (req.user) {
    if (req.user.uid && sim.user_id && req.user.uid === sim.user_id) return true;
    if (req.user.email && sim.user_email && req.user.email.toLowerCase() === sim.user_email.toLowerCase()) return true;
    return false;
  }
  return true;
}

/**
 * Start or Initialize a Simulation
 * POST /api/simulations/start
 */
async function startSimulation(req, res) {
  try {
    const {
      scenarioId = 'vendor-pricing',
      customAgents = null,
      maxRounds = null,
      userEmail = null,
      userId = null,
    } = req.body || {};

    const effectiveUserId = req.user?.uid || (userId ? String(userId).trim() : null);
    const effectiveUserEmail = req.user?.email || (userEmail ? String(userEmail).trim() : null);

    const fullState = await orchestratorService.initializeSimulation({
      scenarioId,
      customAgents,
      maxRounds,
      userEmail: effectiveUserEmail,
      userId: effectiveUserId,
    });

    return res.status(201).json({
      success: true,
      data: fullState,
    });
  } catch (err) {
    console.error('[Simulation Controller] Error starting simulation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Get Simulation by ID
 * GET /api/simulations/:id
 */
async function getSimulationState(req, res) {
  try {
    const { id } = req.params;
    const sim = await db.getSimulation(id);
    if (!sim) {
      return res.status(404).json({ success: false, error: 'Simulation not found' });
    }

    // Ownership check: If authenticated and simulation has an owner, restrict access
    if (!isUserAuthorizedForSim(sim, req)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to view this simulation.',
      });
    }

    return res.json({ success: true, data: sim });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * List all simulations
 * GET /api/simulations
 */
async function listSimulations(req, res) {
  try {
    const { userEmail, userId, limit = 50 } = req.query || {};
    const effectiveUserId = req.user?.uid || (userId ? String(userId).trim() : null);
    const effectiveUserEmail = req.user?.email || (userEmail ? String(userEmail).trim() : null);

    const list = await db.listSimulations({
      userEmail: effectiveUserEmail,
      userId: effectiveUserId,
      limit: Number(limit) || 50,
    });
    return res.json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Advance Simulation by One Step / Turn
 * POST /api/simulations/:id/step
 */
async function advanceSimulationStep(req, res) {
  try {
    const { id } = req.params;
    const sim = await db.getSimulation(id);
    if (!sim) {
      return res.status(404).json({ success: false, error: 'Simulation not found' });
    }

    // Ownership check
    if (!isUserAuthorizedForSim(sim, req)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to modify this simulation.',
      });
    }

    const { humanMove, message, offer_value, action, terms, stance, isDeadlockAction } = req.body || {};
    const customMove = humanMove || (message || action || offer_value !== undefined ? { message, offer_value, action, terms, stance, isDeadlockAction } : null);

    // If deadlock resolution is active and action is a deadlock resolution decision
    if (sim.deadlock_resolution?.active && (isDeadlockAction || ['ACCEPT', 'REJECT', 'COUNTER_OFFER', 'COUNTER'].includes((action || '').toUpperCase()))) {
      const result = await orchestratorService.handleDeadlockAction(id, customMove);
      return res.json({
        success: true,
        data: result.simulation,
        deadlockResolution: result.deadlockResolution,
        message: result.message,
      });
    }

    const result = await orchestratorService.advanceStep(id, customMove);

    return res.json({
      success: true,
      data: result.simulation,
      turnTaken: result.turnTakenBy,
      action: result.action,
      offerValue: result.offerValue,
      stoppingConditionMet: result.stoppingConditionMet,
      deadlockInitiated: result.deadlockInitiated,
      waitingForHuman: result.waitingForHuman,
      message: result.message,
    });
  } catch (err) {
    console.error('[Simulation Controller] Error in step:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Handle Deadlock Resolution Action
 * POST /api/simulations/:id/deadlock/action
 */
async function handleDeadlockResolutionAction(req, res) {
  try {
    const { id } = req.params;
    const sim = await db.getSimulation(id);
    if (!sim) {
      return res.status(404).json({ success: false, error: 'Simulation not found' });
    }

    if (!isUserAuthorizedForSim(sim, req)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to modify this simulation.',
      });
    }

    const { action, offer_value, terms, message, sender_role, confirmDeadlock } = req.body || {};
    const result = await orchestratorService.handleDeadlockAction(id, {
      action,
      offer_value,
      terms,
      message,
      sender_role,
      confirmDeadlock,
    });

    return res.json({
      success: true,
      data: result.simulation,
      deadlockResolution: result.deadlockResolution,
      message: result.message,
    });
  } catch (err) {
    console.error('[Simulation Controller] Error in deadlock action:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Run full simulation until completion or deadlock
 * POST /api/simulations/:id/run
 */
async function runFullSimulation(req, res) {
  try {
    const { id } = req.params;
    const { maxSteps = 30 } = req.body || {};
    const result = await orchestratorService.runFullSimulation(id, maxSteps);

    return res.json({
      success: true,
      data: result.simulation,
      stepsTaken: result.stepsTaken,
    });
  } catch (err) {
    console.error('[Simulation Controller] Error in runFullSimulation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Pause Simulation
 * POST /api/simulations/:id/pause
 */
async function pauseSimulation(req, res) {
  try {
    const { id } = req.params;
    const sim = await orchestratorService.pauseSimulation(id);
    return res.json({ success: true, data: sim });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Resume Simulation
 * POST /api/simulations/:id/resume
 */
async function resumeSimulation(req, res) {
  try {
    const { id } = req.params;
    const sim = await orchestratorService.resumeSimulation(id);
    return res.json({ success: true, data: sim });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * End Simulation manually
 * POST /api/simulations/:id/end
 */
async function endSimulation(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const sim = await orchestratorService.endSimulation(id, reason);
    return res.json({ success: true, data: sim });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Restart Simulation
 * POST /api/simulations/:id/restart
 */
async function restartSimulation(req, res) {
  try {
    const { id } = req.params;
    const sim = await orchestratorService.restartSimulation(id);
    return res.status(201).json({ success: true, data: sim });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Export Simulation Data (JSON or CSV)
 * GET /api/simulations/:id/export?format=json|csv
 */
async function exportSimulation(req, res) {
  try {
    const { id } = req.params;
    const format = (req.query.format || 'json').toLowerCase();
    const sim = await db.getSimulation(id);

    if (!sim) {
      return res.status(404).json({ success: false, error: 'Simulation not found' });
    }

    if (format === 'csv') {
      const messages = sim.messages || [];
      const headers = ['Round', 'Sender Name', 'Sender Role', 'Personality', 'Action', 'Offer Value', 'Message', 'Created At'];
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = messages.map(m => [
        m.round_number || '',
        escapeCsv(m.sender_name),
        escapeCsv(m.sender_role),
        escapeCsv(m.personality || ''),
        escapeCsv(m.action || ''),
        m.offer_value !== null && m.offer_value !== undefined ? m.offer_value : '',
        escapeCsv(m.message || ''),
        escapeCsv(m.created_at || ''),
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="simulation_${id}_report.csv"`);
      return res.send(csvContent);
    }

    // Default JSON export
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="simulation_${id}_report.json"`);
    return res.send(JSON.stringify(sim, null, 2));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  startSimulation,
  getSimulationState,
  listSimulations,
  advanceSimulationStep,
  runFullSimulation,
  pauseSimulation,
  resumeSimulation,
  endSimulation,
  restartSimulation,
  exportSimulation,
  handleDeadlockResolutionAction,
};
