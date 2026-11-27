# Multi-Agent Negotiation Simulator (Negotiator AI)

An AI-powered negotiation simulation and training platform designed to model, study, and evaluate real-world multi-stakeholder negotiations using autonomous intelligent agents.

[![React](https://img.shields.io/badge/React-19.0.0-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4.4-646CFF.svg)](https://vitejs.dev/)
[![React Router](https://img.shields.io/badge/React_Router-7.3.0-CA4245.svg)](https://reactrouter.com/)
[![Frontend Tests](https://img.shields.io/badge/Frontend_Tests-29%20Passed-10b981.svg)](#running-tests)
[![Backend Tests](https://img.shields.io/badge/Backend_Tests-18%20Passed-10b981.svg)](#running-tests)
[![Decision Engine Tests](https://img.shields.io/badge/Decision_Tests-37%20Passed-10b981.svg)](#running-tests)
[![Total Tests](https://img.shields.io/badge/Total_Tests-84%20Passed-10b981.svg)](#running-tests)
[![Build](https://img.shields.io/badge/Build-Passing-success.svg)](#building-for-production)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌐 Live Deployments

| Service | Platform | Live URL |
| :--- | :--- | :--- |
| **Frontend Application** | Vercel | [https://multi-agent-negotiation-simulator-sepia.vercel.app/](https://multi-agent-negotiation-simulator-sepia.vercel.app/) |
| **Backend API** | Render | [https://negotiator-backend-28r5.onrender.com/](https://negotiator-backend-28r5.onrender.com/) |
| **AI Reasoning Service** | Render | [https://negotiator-ai-service.onrender.com/](https://negotiator-ai-service.onrender.com/) |

### 📊 Project Tracking & Quality Assurance Sheets

| Document | Format / Platform | Link |
| :--- | :--- | :--- |
| **Unit Test Plan (UTP Document)** | Microsoft Excel (OneDrive) | [Open Unit Test Plan (UTP Document)](https://1drv.ms/x/c/0621623379395de3/IQCWiDddcN4ySaSbEOM_NmFZAVYTsnC9HHxOFMsPz5YKRQ0?e=B5xOte) |
| **Agile Sheet** | WPS Office Cloud | [Open Agile Sheet](https://ap.wps.com/cms/docs/d/cbCaeqxsrcGEsHic?platform=pc&refer=copylink) |
| **Defect Tracking Sheet** | Microsoft Excel (OneDrive) | [Open Defect Tracking Sheet](https://1drv.ms/x/c/0621623379395de3/IQABdmzAnGNbQ5JnN693Bs8TAW2BxBMJMe9HM_bD_I_hxoM?e=tURwkt) |

---

## Table of Contents

- [Live Deployments](#-live-deployments)
- [Project Tracking & QA Sheets](#-project-tracking--quality-assurance-sheets)
- [Project Description](#project-description)
- [Milestone Architecture & Workflow](#milestone-architecture--workflow)
  - [4-Stage End-to-End Simulation Pipeline](#4-stage-end-to-end-simulation-pipeline)
- [Milestone Modules & Task Breakdown](#milestone-modules--task-breakdown)
  - [Milestone 1: Scenario Configuration & Agent Specification](#milestone-1-scenario-configuration--agent-specification)
    - [Task 1: Scenario Selection & Agent Configuration](#task-1-scenario-selection--agent-configuration)
  - [Milestone 2: Turn Management & Outcome Analytics](#milestone-2-turn-management--outcome-analytics)
    - [Task 2: Real-Time Multi-Agent Negotiation Arena](#task-2-real-time-multi-agent-negotiation-arena)
    - [Task 3: Outcome Evaluation & History Reports](#task-3-outcome-evaluation--history-reports)
  - [Milestone 3: Advanced Intelligence, Practice Mode & Deadlock Resolution](#milestone-3-advanced-intelligence-practice-mode--deadlock-resolution)
    - [Task 1: Offer Evaluation & Concession Module (Decision Engine)](#task-1-offer-evaluation--concession-module-decision-engine)
    - [Task 2: AI Multi-Round Reasoning & Multi-Tier Fallback Architecture](#task-2-ai-multi-round-reasoning--multi-tier-fallback-architecture)
    - [Task 3: Interactive Practice Mode (Human-vs-AI) with Voice Dictation](#task-3-interactive-practice-mode-human-vs-ai-with-voice-dictation)
    - [Task 4: Universal Deadlock Resolution System & Mathematical Auto-Agreement](#task-4-universal-deadlock-resolution-system--mathematical-auto-agreement)
  - [Milestone 4: Post-Interaction Analysis, Performance Analytics & Final Delivery](#milestone-4-post-interaction-analysis-performance-analytics--final-delivery)
    - [Task 1: Post-Interaction Summary Agent Engine](#task-1-post-interaction-summary-agent-engine)
    - [Task 2: Sentiment Journey Timeline & Emotional Trajectory Visualizer](#task-2-sentiment-journey-timeline--emotional-trajectory-visualizer)
    - [Task 3: Outcome & Resolution Quality Scoring Engine](#task-3-outcome--resolution-quality-scoring-engine)
    - [Task 4: Personalized Recommendations & Tactical Coaching Engine](#task-4-personalized-recommendations--tactical-coaching-engine)
    - [Task 5: Multi-Session Performance Analytics & Deadlock Pattern Detector](#task-5-multi-session-performance-analytics--deadlock-pattern-detector)
- [Team Task Division](#team-task-division)
- [Core Features](#core-features)
  - [Completed Features (Milestones 1, 2, 3 & 4)](#completed-features-milestones-1-2-3--4)
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

## Milestone Modules & Task Breakdown

### Milestone 1: Scenario Configuration & Agent Specification

#### Task 1: Scenario Selection & Agent Configuration (`/scenarios`, `/agents`)
- **Pre-Built Business Scenarios:**
  - **Vendor Pricing:** B2B enterprise procurement between Buyer (Alex Rivers) and Cloud Vendor (Marcus Chen). Pricing range: ₹95k–₹110k, Net-60 payment constraint, 99.9% SLA target.
  - **Job Offer:** Tech talent compensation between Hiring Manager (Sarah Jenkins) and Senior Candidate (David Park). Base salary: ₹152k–₹175k, equity percentage, sign-on bonus, and remote flexibility.
  - **Project Budget Allocation:** 3-way multi-party resource bargaining between Engineering, Product, and Finance dividing a unified ₹1,000,000 pool.
- **Strategic Personality Archetypes:**
  - 🔴 **Aggressive ($\beta < 1$):** Concedes slowly, holds initial reservation price until deadline, demanding maximum counterpart concession.
  - 🟢 **Collaborative ($\beta \approx 1$):** Linear concession trajectory, trades secondary levers (e.g., payment days or bonus) to protect primary objectives.
  - 🟡 **Risk-Averse ($\beta > 1$):** Concedes early to eliminate deadlock hazards, prioritizing swift convergence and certainty.
- **Pre-Flight Validation Engine (`configurationValidator.js`):** Enforces completeness, constraint validity, and personality schema before entering simulation.

---

### Milestone 2: Turn Management & Outcome Analytics

#### Task 2: Real-Time Multi-Agent Negotiation Arena (`/arena`)
- **Alternating Turn-Taking Orchestrator:** Implements an automated state machine cycling rounds $1$ to $T_{\max}$ with three core agent actions per turn: `ACCEPT`, `COUNTER_OFFER`, or `REJECT`.
- **ZOPA & Convergence Engine:**
  - Evaluates buyer and seller reservation overlaps.
  - Automatic crossover detection: When buyer offer $\ge$ seller demand, surplus gap collapses to 0 ($\text{Gap} \le 500$), triggering instant agreement convergence.
  - Self-acceptance guardrail: Agents are strictly prohibited from accepting their own compromises; proposals must be accepted by the counterpart.
- **Live Interactive Visualization:**
  - SVG avatars with micro-animations reflecting real-time agent emotions.
  - Real-time speech bubbles, offer delta tags, round counter, and agreement probability gauge.
  - Responsive full-viewport layout with integrated outcome banner.

#### Task 3: Outcome Evaluation & History Reports (`/history`)
- **Multi-Metric Outcome Analytics:**
  - **Joint Utility / Social Welfare:** $U_{\text{total}} = U_A + U_B$, measuring global outcome efficiency.
  - **Pareto Optimality:** Determines whether non-dominated trade-offs exist where neither agent could improve without harming the other.
  - **Fairness Metric:** Nash bargaining distance formula: $\text{Fairness} = 1 - |U_A - U_B|$.
  - **Concession Velocity:** Round-by-round trajectory velocity tracking strategic concessions.
- **Cloud Database Persistence:** Integrates Neon PostgreSQL and Prisma ORM to record simulation metadata, participants, turn transcripts, offer values, and agreement states (`COMPLETED`, `DEADLOCK`, `LEFT_IN_BETWEEN`).
- **Comprehensive Audit Export:** Multi-token search, filter chips, and formatted client-side PDF export (with sidebar dynamically hidden in print mode) and Markdown report download.

---

### Milestone 3: Advanced Intelligence, Practice Mode & Deadlock Resolution

#### Task 1: Offer Evaluation & Concession Module (Decision Engine)
- **Deterministic Multi-Issue Utility Scoring (`ai-service/decision`):**
  - Pure Python algorithmic decision module validating candidate numbers against scenario boundaries without external API latency.
  - Multi-issue normalization: Maps candidate terms to normalized utilities $u_k(x_k) \in [0, 1]$ based on target and reservation limits.
  - Weighted utility computation: $U(\mathbf{x}) = \sum_{k=1}^m w_k \cdot u_k(x_k)$ across all active scenario levers.
- **Hard Constraint Enforcement:**
  - Enforces hard boundaries (e.g., Buyer payment terms $\ge 60$ days, Project Budget sum $\le ₹10,00,000$, or Vendor floor $\ge ₹90,000$).
  - When hard limits are broken, automatically generates a non-fatal `reject` paired with an actionable `next_offer` to prevent dialogue failure.
- **Time-Decaying Acceptance Bar & Concession Velocity:**
  - Acceptance threshold dynamic relaxation:
    - **Aggressive:** Threshold relaxes from $0.90 \to 0.40$ ($15\% \to 45\%$ concession velocity).
    - **Collaborative:** Threshold relaxes from $0.80 \to 0.30$ ($30\% \to 60\%$ concession velocity with $+10\%$ reciprocity bonus).
    - **Risk-Averse:** Threshold relaxes from $0.70 \to 0.25$ ($25\% \to 50\%$ concession velocity with $+5\%$ reciprocity bonus).
  - Validated by **37 comprehensive unit tests** in `ai-service/tests`.

#### Task 2: AI Multi-Round Reasoning & Multi-Tier Fallback Architecture
- **Multi-Tier AI Microservice Architecture:**
  - **Tier 1 (Primary - Google Gemini):** Powers context-aware persona reasoning using Google Gemini (`gemini-3.8-flash` / `gemini-3.1-flash-lite`). Synthesizes personalized arguments, strategic counteroffers, and structured JSON output.
  - **Tier 2 (Secondary - OpenAI):** Automatic failover to OpenAI (`gpt-4o-mini`) if Gemini encounters transient 503 capacity limits or quota caps.
  - **Tier 3 (Tertiary - Deterministic Math Engine):** Instantaneous high-fidelity concession curve fallback guaranteeing 100% platform availability with zero downtime.
- **Non-Deterministic Round Convergence:**
  - Avoids predictable fixed round endings (e.g. always settling on Round 5).
  - Dynamically randomizes target settlement rounds across Rounds 6–12 with natural variance, enforcing a minimum 5-round bargaining phase for normal positive-gap negotiations.

#### Task 3: Interactive Practice Mode (Human-vs-AI) with Voice Dictation
- **Interactive Human Bargaining Dock (`/arena`):**
  - Enables users to participate directly as a human negotiator in any scenario against configured AI personas.
  - Dynamic role detection: Identifies human participant roles (Purchasing Director, Sales Account Executive, Hiring Director, Job Candidate, or Department Leads).
- **Speech-to-Text Voice Dictation:**
  - Integrated Web Speech API microphone dictation for real-time hands-free speech input with live speech listening states.
- **Monetary & Intent Extraction Engine:**
  - Automatically parses natural human dialogue and extracts monetary figures: raw digits, commas, `k` notation (e.g., `2000k` $\to$ ₹2,000,000), Lakhs, LPA, and Rupees.
  - Robust intent classification: Recognizes acceptances (`"I accept the deal"`, `"agreed"`) and rejections (`"I cannot accept"`).
  - Tripartite departmental split parser for Project Budget Allocation (e.g., `"Engineering 400k, Marketing 340k, Product AI 260k"`).
- **Turn Alternation & Quick Decision Chips:**
  - Automated AI opponent turn scheduling (1.4s deliberate turn pacing).
  - Quick action suggestion chips for one-click counteroffer submission, instant acceptance, or rejection.

#### Task 4: Universal Deadlock Resolution System & Mathematical Auto-Agreement
- **Universal Impasse & Deadlock Detection:**
  - Autonomous Orchestrator monitors negotiation momentum across all scenarios.
  - Identifies deadlocks caused by repeated identical offers without concessions, conflicting positions, or round limit exhaustion.
- **Scenario-Independent Compromise Proposal:**
  - Pauses normal turn-taking and formulates an equitable compromise proposal tailored to scenario dynamics:
    - **Vendor Pricing:** Balanced price, Net-60 payment terms, 4-week delivery, and 99.9% uptime SLA.
    - **Job Offer:** Balanced base salary, equity percentage, sign-on bonus, and remote flexibility.
    - **Project Budget Allocation:** Balanced tripartite distribution (Engineering ₹410,000, Marketing ₹325,000, Product AI ₹265,000 summing to exactly ₹10,00,000).
- **Human-Controlled Resolution (Practice Mode):**
  - Displays prominent Orchestrator Compromise Proposal notice with full terms.
  - Provides three clear action buttons: **ACCEPT OFFER**, **REJECT OFFER**, and **COUNTER-OFFER**.
  - **Strict Maximum of 2 Counter-Offer Attempts**: Visual attempt tracker (`0/2`, `1/2`, `2/2`). Counter-offer interface permanently locks after 2 submissions.
- **Automated AI Resolution (Simulation Mode):**
  - AI agents independently evaluate compromise terms based on role objectives, targets, and reservation thresholds without human intervention.
- **Mathematical Crossover & Instant Auto-Agreement Engine:**
  - **Vendor Pricing:** When Buyer Offer $\ge$ Seller Asking Price, the Seller immediately accepts (`action: 'ACCEPT'`) and terminates with `AGREEMENT_REACHED` at Gap = ₹0.
  - **Job Offer:** When Recruiter Offer $\ge$ Candidate Ask, the Candidate immediately accepts (`action: 'ACCEPT'`) and terminates with `AGREEMENT_REACHED` at Gap = ₹0.
  - **Project Budget:** When demands sum to $\le ₹10,00,000$, all departments accept and conclude into `AGREEMENT_REACHED`.
  - Pacing guardrails never override or suppress explicit acceptances or mathematical crossovers.

---

### Milestone 4: Post-Interaction Analysis, Performance Analytics & Final Delivery

#### Task 1: Post-Interaction Summary Agent Engine (`summaryAgentService.js`)
- **Autonomous Summary Generator:** Ingests complete multi-round logs upon completion or deadlock, extracting initial anchor positions, concession trajectories, and ratified settlement terms.
- **Executive Narrative Generation:** Formulates structured natural-language reports explaining how agents converged within the ZOPA or why an impasse occurred.
- **Practice Mode Trajectory Analysis:** Tracks the human user's strategic milestones (Opening Anchor Placement, Pivotal Concession Move, Deadlock Resistance, and Final Settlement Closure).
- **Offline Heuristic Fallback (`simulationApi.js`):** Built-in client-side generator with an active 3500ms timeout guard, guaranteeing immediate local summary synthesis during backend cold starts.
- **PostgreSQL JSONB Persistence:** Persists complete analytical payloads directly into the `simulations.post_summary` column in Neon PostgreSQL.

#### Task 2: Sentiment Journey Timeline & Emotional Trajectory Visualizer (`HistoryReports.jsx`)
- **Round-by-Round Sentiment Analysis:** Evaluates message tone, stance rigidity, and collaboration level on a normalized scale from $-1.0 \text{ to } +1.0$.
- **Interactive Emotional Trajectory Chart:** Renders continuous SVG/Canvas curves plotting contrasting agent trajectories (Collaborative vs. Aggressive arcs).
- **Human Stance Progression Tracker:** Maps human decision states across 5 milestones (`Awaiting Offer` → `In Dialogue` → `Firm` → `Compromising` → `Agreed`).
- **Collision-Free Tooltip Positioning:** Dynamic viewport offset algorithms displaying round quotes, speaker badges, and stance tags without UI clipping.

#### Task 3: Outcome & Resolution Quality Scoring Engine
- **Mathematical 4-Factor Scoring Rubric ($0 - 100$):**
  $$\text{Resolution Score} = (0.30 \times S_{\text{goal}}) + (0.25 \times S_{\text{agreement}}) + (0.25 \times S_{\text{effectiveness}}) + (0.20 \times S_{\text{concession}})$$
- **Goal Achievement ($S_{\text{goal}}$, 30%):** Evaluates settlement proximity to target aspirations relative to reservation limits.
- **Turn Efficiency ($S_{\text{effectiveness}}$, 25%):** Rewards early convergence while penalizing protracted negotiations.
- **Concession Management ($S_{\text{concession}}$, 20%):** Audits concession discipline, penalizing erratic jumps or rapid surplus erosion.
- **Zero-Concession Penalty:** Enforces a strict score cap ($< 50/100$) when users prematurely capitulate to opening asks without bargaining.
- **Score Tiering Badges:** Categorizes outcomes into **Superior (90–100)**, **Competent (75–89)**, **Moderate (60–74)**, and **Subpar (<60)**.

#### Task 4: Personalized Recommendations & Tactical Coaching Engine
- **Post-Negotiation Tactical Critique Generator:** Evaluates bargaining behaviors and produces actionable strategic feedback.
- **Comparative Archetype Critiques (AI vs AI):** Highlights where Aggressive personas lost surplus and where Collaborative personas conceded too quickly.
- **Personalized Human Feedback:** Populates 3 structured feedback modules:
  - **Strengths:** Commends strong opening anchors, firm walkaway defense, and measured pacing.
  - **Vulnerabilities / Areas for Improvement:** Flags erratic jumps, one-sided concessions, or non-numeric inputs.
  - **Actionable Takeaways:** Delivers 3 role-specific procurement or employment compensation guidelines.

#### Task 5: Multi-Session Performance Analytics & Deadlock Pattern Detector (`NegotiationAnalytics.jsx`)
- **Macro Analytics Dashboard:** Aggregates multi-session historical data across Simulation and Practice modes.
- **Deadlock Pattern Detector:** Categorizes recurring impasse causes into structured clusters (*Aggressive Stance Standoff*, *Reservation Boundary Exhaustion*, *Non-Offer Deadlock*).
- **ZOPA Surplus Realization Efficiency:** Calculates global surplus realization efficiency (**19%** across 79 benchmark sessions).
- **Concession Velocity Curves:** Plots round-by-round first derivative offer changes ($V_t = |O_t - O_{t-1}| / \Delta t$) across scenarios.
- **Strict Session Filtering:** Isolated filter controls separating autonomous simulation data from human practice records.

---

## Team Task Division

| Team Member | Milestone Responsibilities | Key Deliverables |
| :--- | :--- | :--- |
| **Shubhay Yadav** (Team Lead) | **Summary Agent Engine, Concession Math & Architecture** | Post-Interaction Summary Agent (`summaryAgentService.js`), offline fallback generator (`simulationApi.js`), Universal Deadlock Resolution, JSONB schema persistence, and backend test suites. |
| **Niharika Indurthi** | **Sentiment Journey Timeline & Interactive Trajectory Visualizer** | Round-by-round sentiment analysis tracker, interactive emotional trajectory chart in `HistoryReports.jsx`, 5-milestone human stance mapper, and collision-free tooltips. |
| **Keerthana** | **Outcome & 4-Factor Resolution Quality Scoring Engine** | 4-Factor Resolution Quality Score ($0-100$), Goal Achievement, Agreement, Turn Efficiency, Concession Management rubric, premature concession penalty, and scorecard badges. |
| **Tarun** | **Personalized Recommendations & Tactical Coaching Engine** | Behavioral feedback generator, Strengths, Vulnerabilities, role-tailored Actionable Takeaways, and post-session audit cards. |
| **Saitejaswini Tammana** | **Multi-Session Analytics & Deadlock Pattern Detector** | Macro performance analytics (`NegotiationAnalytics.jsx`), Deadlock Pattern Detector (impasse clustering), 19% ZOPA Surplus Efficiency, and cross-scenario Concession Velocity curves. |

---

## Core Features

### Completed Features (Milestones 1, 2, 3 & 4)

* **Autonomous Turn-Taking Arena:** Alternating round-based negotiation with automated agent reasoning.
* **3 Realistic Business Scenarios:** Vendor Pricing, Job Offer Compensation, and 3-Party Project Budget Allocation.
* **Dynamic Personality Concession Curves:** Aggressive, Collaborative, and Risk-Averse concession behaviors.
* **ZOPA & Convergence Engine:** Zero-threshold mathematical convergence ($\Delta = 0$) for contract settlement.
* **Pure Python Decision & Evaluation Engine (M3 Task 1):** Deterministic utility scoring, hard-constraint validation, and concession velocity calculations.
* **3-Tier AI Fallback Architecture (M3 Task 2):** Primary Google Gemini (`gemini-3.8-flash`), secondary OpenAI (`gpt-4o-mini`), and tertiary mathematical concession curves ensuring 100% uptime.
* **Interactive Practice Mode (M3 Task 3):** Human-vs-AI negotiation dock with scenario-enforced opening moves and real-time intent classification badges (`OFFER`, `COUNTER`, `ACCEPT`, `REJECT`).
* **Web Speech API Voice Dictation (M3 Task 3):** Hands-free speech-to-text input with live recording indicators and instant transcription.
* **Universal Deadlock Resolution System (M3 Task 4):** Automated impasse detection and ZOPA midpoint compromise synthesis.
* **Post-Interaction Summary Agent Engine (M4 Task 1):** Autonomous narrative summary generation and human bargaining trajectory analysis persisted to PostgreSQL JSONB.
* **Sentiment Journey Timeline (M4 Task 2):** Round-by-round emotional trajectory curves ($-1.0$ to $+1.0$) and 5-stage human stance progression.
* **4-Factor Resolution Quality Scoring (M4 Task 3):** Multi-criteria 100-point rubric evaluating Goal Achievement, Agreement, Effectiveness, and Concession Management.
* **Personalized Tactical Coaching (M4 Task 4):** Automated behavioral feedback cards identifying Strengths, Vulnerabilities, and 3 Actionable Takeaways.
* **Macro Negotiation Analytics & Pattern Detector (M4 Task 5):** Aggregated telemetry tracking 19% ZOPA Surplus Efficiency, Concession Velocity curves, and Deadlock impasse clustering.
* **Comprehensive Test Suite:** Fully verified with **27 Frontend tests passing**, **13 Backend tests passing**, and 0 production build errors.

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

### 1. Frontend Test Suite (29 Tests)
```bash
cd frontend
npm test -- --run
```
* **Coverage:** Validates scenario configurations, agent parameter boundaries, personality enums, payload handover formatting, monetary/number detection, acceptance/rejection intents, and tripartite budget split parsing.

### 2. Backend Orchestration Test Suite (17 Tests)
```bash
cd backend
npm test
```
* **Coverage:** Validates orchestrator turn initialization, bilateral/multilateral round-robin sequencing, stopping condition evaluations, Universal Deadlock Detection & Compromise Proposals, Practice Mode human decision management (ACCEPT/REJECT/COUNTER-OFFER with 2-attempt limit), and mathematical crossover auto-acceptance across all 3 scenarios.

### 3. AI Service Decision Engine Test Suite (37 Tests)
```bash
cd ai-service
python -m unittest discover -s tests -v
```
* **Coverage:** Validates deterministic multi-issue utility scoring, hard-constraint boundary enforcement, personality concession rates, time-decaying acceptance thresholds, and edge cases.

### 4. Production Build Validation
```bash
cd frontend
npm run build
```
* Bundles all production assets cleanly with exit code `0`.

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

### 3. ZOPA Convergence & Mathematical Crossover
$$\text{If } \text{Buyer Offer} \ge \text{Seller Demand} \implies \text{Gap} = 0 \implies \text{Status} \leftarrow \text{COMPLETED}$$
$$\text{If } \text{Recruiter Offer} \ge \text{Candidate Ask} \implies \text{Gap} = 0 \implies \text{Status} \leftarrow \text{COMPLETED}$$
$$\text{If } \sum \text{Department Budget Requests} \le ₹10,00,000 \implies \text{Gap} = 0 \implies \text{Status} \leftarrow \text{COMPLETED}$$

### 4. Deadlock Detection & Resolution Compromise Formula
When repeated concessions fall below threshold $\epsilon$ or identical offers persist for 2 rounds:
$$\text{Compromise Price} = \text{Target}_{\text{buyer}} + \alpha \cdot (\text{Target}_{\text{seller}} - \text{Target}_{\text{buyer}})$$
where $\alpha \approx 0.5$ balances commercial midpoint terms while adhering strictly to scenario constraints.

---

## About & Team

* **Project Name:** Multi-Agent Autonomous Negotiation Platform (**Negotiator AI**)
* **Milestone:** Milestone 4 (Post-Interaction Analysis, Performance Analytics & Final Project Delivery)
* **Repository:** [https://github.com/shubhayyadav84/multi-agent-negotiation-simulator](https://github.com/shubhayyadav84/multi-agent-negotiation-simulator)
* **Upstream:** [https://github.com/karthik-vana/multi-agent-negotiation-simulator](https://github.com/karthik-vana/multi-agent-negotiation-simulator)
* **License:** [MIT License](LICENSE)
* **Team Members:**
  * **Shubhay Yadav** (Team Lead)
  * **Niharika Indurthi**
  * **Keerthana**
  * **Saitejaswini Tammana**
  * **Tarun**
