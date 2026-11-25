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
  origin: (origin, callback) => {
    // Allow server-to-server, curl, localhost, or any deployed vercel frontend
    if (!origin || origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for smooth cloud demo
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Root & Health check endpoints
app.get(['/', '/health'], (req, res) => {
  const isHtml = req.accepts(['html', 'json']) === 'html';
  const data = {
    status: 'ONLINE',
    service: 'Multi-Agent Negotiation Backend (Express)',
    version: '1.0.0',
    message: 'Multi-Agent Negotiation Simulator Backend is live and operational.',
    timestamp: new Date().toISOString(),
    neon_database: db.isNeonConnected() ? 'CONNECTED' : 'IN_MEMORY_FALLBACK',
    ai_service_url: process.env.AI_SERVICE_URL || 'https://negotiator-ai-service.onrender.com/',
    frontend_url: 'https://multi-agent-negotiation-simulator-sepia.vercel.app/',
    endpoints: {
      health: '/api/health',
      simulations: '/api/simulations',
      strategies: '/api/strategies',
    },
  };

  if (isHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backend Status • Multi-Agent Negotiation Simulator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #020617 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 20px;
      padding: 40px;
      max-width: 580px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 12px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
      letter-spacing: -0.02em;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      text-align: left;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .metric-label {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    .metric-value {
      font-size: 0.88rem;
      color: #e2e8f0;
      font-weight: 600;
      margin-top: 2px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn {
      display: inline-block;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.92rem;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(148, 163, 184, 0.1);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    .btn-secondary:hover {
      background: rgba(148, 163, 184, 0.18);
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="pulse-dot"></span>
      Backend Live & Operational
    </div>
    <h1>Negotiator AI Backend</h1>
    <p>Multi-Agent Negotiation Simulator REST API is online, healthy, and servicing negotiation turns and reasoning pipelines.</p>
    
    <div class="metrics">
      <div>
        <div class="metric-label">Status</div>
        <div class="metric-value" style="color: #34d399;">Active (200 OK)</div>
      </div>
      <div>
        <div class="metric-label">Service</div>
        <div class="metric-value">Express Engine</div>
      </div>
      <div>
        <div class="metric-label">Neon Database</div>
        <div class="metric-value">${data.neon_database}</div>
      </div>
      <div>
        <div class="metric-label">Version</div>
        <div class="metric-value">v1.0.0</div>
      </div>
    </div>

    <div class="actions">
      <a class="btn btn-primary" href="https://multi-agent-negotiation-simulator-sepia.vercel.app/" target="_blank" rel="noopener noreferrer">Launch Frontend Simulator →</a>
      <a class="btn btn-secondary" href="/api/health">View JSON Health Check (/api/health)</a>
    </div>
  </div>
</body>
</html>`);
  }

  return res.json(data);
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
 