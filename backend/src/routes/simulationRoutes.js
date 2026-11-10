const express = require('express');
const router = express.Router();
const { optionalFirebaseToken } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/simulationController');

// All simulation routes support optional Firebase ID token (populates req.user when logged in, allows guest testing)
router.post('/start', optionalFirebaseToken, startSimulation);
router.get('/', optionalFirebaseToken, listSimulations);
router.get('/:id', optionalFirebaseToken, getSimulationState);
router.get('/:id/export', optionalFirebaseToken, exportSimulation);
router.post('/:id/step', optionalFirebaseToken, advanceSimulationStep);
router.post('/:id/run', optionalFirebaseToken, runFullSimulation);
router.post('/:id/pause', optionalFirebaseToken, pauseSimulation);
router.post('/:id/resume', optionalFirebaseToken, resumeSimulation);
router.post('/:id/end', optionalFirebaseToken, endSimulation);
router.post('/:id/restart', optionalFirebaseToken, restartSimulation);

module.exports = router;
