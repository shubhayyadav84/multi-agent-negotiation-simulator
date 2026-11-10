const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/authMiddleware');
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

// All simulation routes are protected by Firebase ID Token Authentication
router.post('/start', verifyFirebaseToken, startSimulation);
router.get('/', verifyFirebaseToken, listSimulations);
router.get('/:id', verifyFirebaseToken, getSimulationState);
router.get('/:id/export', verifyFirebaseToken, exportSimulation);
router.post('/:id/step', verifyFirebaseToken, advanceSimulationStep);
router.post('/:id/run', verifyFirebaseToken, runFullSimulation);
router.post('/:id/pause', verifyFirebaseToken, pauseSimulation);
router.post('/:id/resume', verifyFirebaseToken, resumeSimulation);
router.post('/:id/end', verifyFirebaseToken, endSimulation);
router.post('/:id/restart', verifyFirebaseToken, restartSimulation);

module.exports = router;
