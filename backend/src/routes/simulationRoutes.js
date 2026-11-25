const express = require('express');
const router = express.Router();
const { optionalFirebaseToken } = require('../middleware/authMiddleware');
const {
  startSimulation,
  getSimulationState,
  getSimulationRecommendations,
  listSimulations,
  advanceSimulationStep,
  runFullSimulation,
  pauseSimulation,
  resumeSimulation,
  endSimulation,
  restartSimulation,
  exportSimulation,
  handleDeadlockResolutionAction,
} = require('../controllers/simulationController');

// All simulation routes support optional Firebase authentication.
router.post('/start', optionalFirebaseToken, startSimulation);
router.get('/', optionalFirebaseToken, listSimulations);

// Tactical coaching recommendations
router.get('/:id/recommendations', optionalFirebaseToken, getSimulationRecommendations);
router.get('/:id', optionalFirebaseToken, getSimulationState);
router.get('/:id/export', optionalFirebaseToken, exportSimulation);
router.post('/:id/step', optionalFirebaseToken, advanceSimulationStep);
router.post('/:id/deadlock/action', optionalFirebaseToken, handleDeadlockResolutionAction);
router.post('/:id/run', optionalFirebaseToken, runFullSimulation);
router.post('/:id/pause', optionalFirebaseToken, pauseSimulation);
router.post('/:id/resume', optionalFirebaseToken, resumeSimulation);
router.post('/:id/end', optionalFirebaseToken, endSimulation);
router.post('/:id/restart', optionalFirebaseToken, restartSimulation);

module.exports = router;