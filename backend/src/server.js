const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDbConnection, db } = require('./db/db');
const simulationRoutes = require('./routes/simulationRoutes');
const strategyRoutes = require('./routes/strategyRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Multi-Agent Negotiation Backend (Express)',
    timestamp: new Date().toISOString(),
    neon_database: db.isNeonConnected() ? 'CONNECTED' : 'IN_MEMORY_FALLBACK (Awaiting DATABASE_URL in .env)',
    ai_service_url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  });
});

// Simulation Routes
app.use('/api/simulations', simulationRoutes);

// Strategy Library & Gemini AI Doubt Assistant Routes
app.use('/api/strategies', strategyRoutes);
app.use('/api/strategy-library', strategyRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server & Connect Database
async function startServer() {
  await initDbConnection();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Multi-Agent Negotiation Backend listening on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🎮 Simulations API: http://localhost:${PORT}/api/simulations`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal error during backend startup:', err);
});
 