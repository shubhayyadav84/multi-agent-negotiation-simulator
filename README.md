# Multi-Agent Negotiation Simulator (Negotiator AI)

An AI-powered negotiation simulation and training platform designed to model, study, and evaluate real-world multi-stakeholder negotiations using autonomous intelligent agents.

[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4.4-646CFF.svg)](https://vitejs.dev/)
[![React Router](https://img.shields.io/badge/React_Router-7.3.0-CA4245.svg)](https://reactrouter.com/)
[![Frontend Tests](https://img.shields.io/badge/Frontend_Tests-29%20Passed-10b981.svg)](#running-tests)
[![Backend Tests](https://img.shields.io/badge/Backend_Tests-16%20Passed-10b981.svg)](#running-tests)
[![Build](https://img.shields.io/badge/Build-Passing-success.svg)](#building-for-production)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌐 Live Deployments

| Service | Platform | Live URL |
| :--- | :--- | :--- |
| **Frontend Application** | Vercel | [https://multi-agent-negotiation-simulator-sepia.vercel.app/](https://multi-agent-negotiation-simulator-sepia.vercel.app/) |
| **Backend API** | Render | [https://negotiator-backend-28r5.onrender.com/](https://negotiator-backend-28r5.onrender.com/) |
| **AI Reasoning Service** | Render | [https://negotiator-ai-service.onrender.com/](https://negotiator-ai-service.onrender.com/) |

---

## Table of Contents

- [Live Deployments](#-live-deployments)

- [Project Description](#project-description)
- [Milestone Architecture & Workflow](#milestone-architecture--workflow)
  - [4-Stage End-to-End Simulation Pipeline](#4-stage-end-to-end-simulation-pipeline)
- [Milestone 1 & 2 Modules](#milestone-1--2-modules)
  - [Task 1: Scenario Selection & Agent Configuration](#task-1-scenario-selection--agent-configuration)
  - [Task 2: Real-Time Multi-Agent Negotiation Arena](#task-2-real-time-multi-agent-negotiation-arena)
  - [Task 3: Outcome Evaluation & History Reports](#task-3-outcome-evaluation--history-reports)
- [Team Task Division](#team-task-division)
- [Core Features](#core-features)
  - [Completed Features (Milestone 1 & 2)](#completed-features-milestone-1--2)
  - [Future Roadmap (Milestone 3)](#future-roadmap-milestone-3)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Configuration Validation & Concession Math](#configuration-validation--concession-math)
- [Troubleshooting](#troubleshooting)
- [About & Team](#about--team)

---

## Project Description

Negotiation is a core competency across business operations, contract discussions, procurement, hiring, and cross-functional resource distribution. However, mastering negotiation skills is challenging due to the scarcity of realistic, scalable, and repeatable practice environments.

The **Multi-Agent Negotiation Simulator (Negotiator AI)** provides a full-stack platform where autonomous Generative AI agents represent distinct stakeholders with conflicting objectives, strict boundary constraints, and configurable behavioral personalities. Agents exchange contextually reasoned offers and counteroffers, evaluate concessions across multi-issue problem spaces, detect positive surplus across the **Zone of Possible Agreement (ZOPA)**, and compute post-negotiation analytics (Pareto efficiency, social welfare, fairness indices).

![Negotiator AI Dashboard](https://github.com/user-attachments/assets/ddd8405d-ea0e-4b38-81e0-c7e976073546)

---

## Milestone Architecture & Workflow

### 4-Stage End-to-End Simulation Pipeline

```text
[ Step 1: Scenario Selection ] ➔ [ Step 2: Agent Configuration ] ➔ [ Step 3: Negotiation Arena ] ➔ [ Step 4: Outcome Evaluation ]
   • Vendor Pricing                 • Inspect Bio & Role              • Alternating Turn Engine        • Joint Social Welfare
   • Job Offer                      • Set Primary Goals               • Concession Curves (β)          • Pareto Optimality
   • Budget Allocation              • Set Boundary Constraints        • ZOPA Crossover Detection       • Fairness Index (Nash)
   • Levers Inspection              • Assign Personalities            • Real-time Dialogue Stream      • PDF / Markdown Export
```

---

## Milestone 1 & 2 Modules

### Task 1: Scenario Selection & Agent Configuration (`/scenarios`, `/agents`)
- **Pre-Built Business Scenarios:**
  - **Vendor Pricing:** B2B enterprise procurement between Buyer (Alex Rivers) and Cloud Vendor (Marcus Chen). Pricing range: ₹95k–₹110k, Net-60 payment constraint, 99.9% SLA target.
  - **Job Offer:** Tech talent compensation between Hiring Manager (Sarah Jenkins) and Senior Candidate (David Park). Base salary: ₹152k–₹175k, equity percentage, sign-on bonus, and remote flexibility.
  - **Project Budget Allocation:** 3-way multi-party resource bargaining between Engineering, Product, and Finance dividing a unified ₹1,000,000 pool.
- **Strategic Personality Archetypes:**
  - 🔴 **Aggressive ($\beta < 1$):** Concedes slowly, holds initial reservation price until deadline, demanding maximum counterpart concession.
  - 🟢 **Collaborative ($\beta \approx 1$):** Linear concession trajectory, trades secondary levers (e.g., payment days or bonus) to protect primary objectives.
  - 🟡 **Risk-Averse ($\beta > 1$):** Concedes early to eliminate deadlock hazards, prioritizing swift convergence and certainty.
- **Pre-Flight Validation Engine (`configurationValidator.js`):** Enforces completeness, constraint validity, and personality schema before entering simulation.

### Task 2: Real-Time Multi-Agent Negotiation Arena (`/arena`)
- **Alternating Turn-Taking Orchestrator:** Implements an automated state machine cycling rounds $1$ to $T_{\max}$ (10 rounds max) with three possible agent actions per turn: `ACCEPT`, `COUNTER_OFFER`, or `REJECT`.
- **ZOPA & Convergence Engine:**
  - Evaluates buyer and seller reservation overlaps.
  - Automatic crossover detection: When buyer offer $\ge$ seller demand, surplus gap collapses to 0 ($\text{Gap} \le 500$), triggering instant agreement convergence.
  - Self-acceptance guardrail: Agents are strictly prohibited from accepting their own compromises; proposals must be accepted by the counterpart.
- **Live Interactive Visualization:**
  - SVG avatars with micro-animations reflecting real-time agent emotions.
  - Real-time speech bubbles, offer delta tags, round counter, and agreement probability gauge.
  - Responsive full-viewport layout with integrated outcome banner.

### Task 3: Outcome Evaluation & History Reports (`/history`)
- **Multi-Metric Outcome Analytics:**
  - **Joint Utility / Social Welfare:** $U_{\text{total}} = U_A + U_B$, measuring global outcome efficiency.
  - **Pareto Optimality:** Determines whether non-dominated trade-offs exist where neither agent could improve without harming the other.
  - **Fairness Metric:** Nash bargaining distance formula: $\text{Fairness} = 1 - |U_A - U_B|$.
  - **Concession Velocity:** Round-by-round trajectory velocity tracking strategic concessions.
- **Cloud Database Persistence:** Integrates Neon PostgreSQL and Prisma ORM to record simulation metadata, participants, turn transcripts, offer values, and agreement states (`COMPLETED`, `DEADLOCK`, `LEFT_IN_BETWEEN`).
- **Comprehensive Audit Export:** Multi-token search, filter chips, and formatted client-side PDF export (with sidebar dynamically hidden in print mode) and Markdown report download.

---

## Team Task Division

| Team Member | Milestone Responsibilities | Key Deliverables |
| :--- | :--- | :--- |
| **Shubhay Yadav** | **Concession Math, PDF Export & Integration** | Concession curve mathematical formulation, ZOPA crossover convergence fix, session status guards, clean PDF export, and test integration. |
| **Niharika Indurthi** | **Scenario Selection & Arena UI** | Scenario selection screen, responsive negotiation arena dashboard, real-time speech bubbles, and outcome modal integration. |
| **Saitejaswini Tammana** | **Scenario Templates & Constraint Rules** | Centralized scenario schema (`scenarios.js`), boundary constraint enforcement (Net-60 hard rules), and fallback presets. |
| **Keerthana** | **Agent Configuration & Database Persistence** | Agent configuration cards, personality selector controls, Neon PostgreSQL schema, and Prisma history persistence. |
| **Karthik Vana** | **Orchestrator State Machine & Metrics** | Alternating turn-taking orchestrator, validation logic, outcome analytics (Joint Utility, Pareto, Fairness), and integration testing. |

---

## Core Features

### Completed Features (Milestone 1 & 2)

* **Autonomous Turn-Taking Arena:** Alternating round-based negotiation with automated agent reasoning.
* **3 Realistic Business Scenarios:** Vendor Pricing, Job Offer Compensation, and 3-Party Project Budget Allocation.
* **Dynamic Personality Concession Curves:** Aggressive, Collaborative, and Risk-Averse concession behaviors.
* **ZOPA & Convergence Engine:** Mathematical threshold detection ($\text{Gap} \le 500$) for instantaneous settlement.
* **Pre-Flight Validation Engine:** 100% schema and constraint verification before simulation launch.
* **Post-Negotiation History & Analytics:** Persistent Neon PostgreSQL session store with Pareto and fairness evaluation.
* **Interactive Reports & PDF Export:** Clean, print-optimized post-negotiation audit generation with transcripts.
* **Multilingual Support (i18n):** Complete UI localization across 6 languages (**English, Hindi, Bengali, Telugu, Tamil, Marathi**).
* **Automated Test Coverage:** **21 Frontend Unit Tests** and **9 Backend Integration Tests** passing with 0 build errors.

### Future Roadmap (Milestone 3)

* [ ] **AI Mediator Agent:** Automated detection of persistent impasses with neutral mediator intervention proposals.
* [ ] **Interactive Practice Mode (Human-vs-AI):** Live text and speech-enabled voice negotiation allowing human users to negotiate against configured AI personas.
* [ ] **Reinforcement Learning Posture:** Dynamic adaptation of concession rates based on sentiment analysis of counterpart dialogue.

---

## Tech Stack

| Technology | Layer | Purpose |
| :--- | :--- | :--- |
| **React 19** | Frontend Framework | Component-driven UI architecture with React hooks |
| **Vite 6** | Build & Dev Tooling | High-performance bundling and instant Hot Module Replacement (HMR) |
| **React Router 7** | Client Navigation | Multi-step routing across Dashboard, Scenarios, Arena, and History |
| **Lucide React** | Icon System | Modern SVG iconography |
| **Node.js / Express** | Orchestration Backend | Turn-taking state machine, convergence logic, and REST API (`:5000`) |
| **Python 3.12 / FastAPI** | AI Intelligence Service | Autonomous LLM negotiation reasoning and mathematical fallbacks (`:8000`) |
| **Mistral-7B / LLaMA-3 / Gemini** | Large Language Models | Powers personality-guided negotiation moves and natural dialogue |
| **Prisma ORM & Neon PostgreSQL**| Cloud Persistence | Serverless relational database for simulations, offers, and transcripts |
| **Vitest & Jest** | Automated Testing | Comprehensive unit and integration test runners |
| **Vanilla CSS** | Styling System | Design system tokens, glassmorphism, responsive flex/grid layouts |

---

## Prerequisites

Verify that the following tools are installed on your machine:

* **Node.js:** `v18.0.0` or higher (tested on `v20+` / `v24+`)
* **Python:** `3.10+` (tested on `3.12+`)
* **npm:** `v9.0.0` or higher
* **Git:** Installed and configured

```bash
node -v
python --version
npm -v
git --version
```

---

## Quick Start

Launch the complete three-tier architecture locally:

```bash
# Terminal 1: Python FastAPI AI Service
cd ai-service
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
# AI Service runs at http://localhost:8000

# Terminal 2: Node.js Express Orchestrator Backend
cd backend
npm install
npm run dev
# Backend API runs at http://localhost:5000

# Terminal 3: React Vite Frontend
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

Open your browser at [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

### 1. Frontend (`frontend/.env`)
```ini
VITE_BACKEND_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### 2. Backend (`backend/.env`)
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
AI_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
```

### 3. AI Service (`ai-service/.env`)
```ini
PORT=8000
HOST=0.0.0.0
# Primary AI Provider
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash

# Secondary AI Backup Provider (fallback if Gemini fails)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

> **Multi-Tier AI Fallback Architecture**:
> 1. **Tier 1 (Primary)**: Google Gemini (`gemini-3.8-flash`) context-aware autonomous reasoning.
> 2. **Tier 2 (Secondary)**: OpenAI (`gpt-4o-mini`) backup if Gemini encounters rate-limits or downtime.
> 3. **Tier 3 (Tertiary)**: Mathematical Domain Fallback Engine guaranteeing 100% uptime with no simulation failures.

---

## Running Tests

### Frontend Test Suite (21 Tests)
```bash
cd frontend
npm test -- --run
```
* **Coverage:** Validates scenario configurations, agent parameter boundaries, personality enums, payload handover formatting, and SVG avatar rendering.

### Backend Test Suite (9 Tests)
```bash
cd backend
npm test
```
* **Coverage:** Validates orchestrator turn initialization, alternating offer sequencing, constraint enforcement, and state transitions.

### Production Build Validation
```bash
cd frontend
npm run build
```
* Exits cleanly with code `0`.

---

## Project Structure

```text
multi-agent-negotiation-simulator/
├── ai-service/                         # Python FastAPI microservice
│   ├── config.py                       # Scenario rules, boundary constraints & ranges
│   ├── main.py                         # Agent inference, concession functions & fallbacks
│   └── requirements.txt                # Python dependencies
├── backend/                            # Express orchestration server
│   ├── prisma/
│   │   └── schema.prisma               # Neon PostgreSQL relational data model
│   ├── src/
│   │   ├── controllers/                # Simulation and history route controllers
│   │   ├── services/
│   │   │   ├── aiClient.js             # Bridge to AI service with local fallback solver
│   │   │   ├── orchestratorService.js  # Turn-taking state machine & ZOPA convergence
│   │   │   └── scenarioService.js      # Scenario configuration loader
│   │   └── server.js                   # Express application entry point
│   └── tests/                          # Backend Jest test suite (9 tests)
├── frontend/                           # React 19 + Vite client
│   ├── src/
│   │   ├── components/                 # Reusable UI components (Avatar, Cards, Layout)
│   │   ├── context/                    # AuthContext, ScenarioContext, SettingsContext
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx           # Landing overview & workflow guide
│   │   │   ├── ScenarioSelection.jsx   # Step 1: Scenario catalog
│   │   │   ├── AgentConfiguration.jsx  # Step 2: Persona & personality setup
│   │   │   ├── NegotiationArena.jsx    # Step 3: Real-time autonomous arena
│   │   │   ├── HistoryReports.jsx      # Step 4: Outcome evaluation & export
│   │   │   └── Settings.jsx            # User profile and multi-language controls
│   │   └── utils/
│   │       ├── configurationValidator.js # Validation engine
│   │       └── translations.js         # 6-language i18n dictionary
│   └── tests/                          # Frontend Vitest suite (21 tests)
├── LICENSE                             # MIT License
└── README.md                           # Comprehensive documentation
```

---

## Configuration Validation & Concession Math

### 1. Multi-Issue Utility Scoring
$$U(\mathbf{x}) = \sum_{k=1}^{m} w_k \cdot u_k(x_k)$$
where $\sum w_k = 1$, and $u_k(x_k)$ maps candidate terms against normalized reservation boundaries.

### 2. Time-Dependent Concession Dynamics
$$x(t) = x_{\min} + (x_{\max} - x_{\min}) \cdot \left(\frac{t}{T_{\max}}\right)^{1/\beta}$$
- **Aggressive ($\beta < 1$):** Minimal concessions until final rounds.
- **Collaborative ($\beta \approx 1$):** Linear, predictable concessions.
- **Risk-Averse ($\beta > 1$):** Rapid early concessions to secure agreement.

### 3. ZOPA Convergence Condition
$$\text{If } \text{Buyer Offer} \ge \text{Seller Demand} \implies \text{Gap} \le 500 \implies \text{Status} \leftarrow \text{COMPLETED}$$

---

## About & Team

* **Project Name:** Multi-Agent Autonomous Negotiation Platform (**Negotiator AI**)
* **Milestone:** Milestone 2 (Tasks 2 & 3: Real-Time Arena, Concession Math & History Reports)
* **Repository:** [https://github.com/karthik-vana/multi-agent-negotiation-simulator](https://github.com/karthik-vana/multi-agent-negotiation-simulator)
* **License:** [MIT License](LICENSE)
* **Team Members:**
  * **Shubhay Yadav**
  * **Niharika Indurthi**
  * **Saitejaswini Tammana**
  * **Keerthana**
  * **Karthik Vana**
