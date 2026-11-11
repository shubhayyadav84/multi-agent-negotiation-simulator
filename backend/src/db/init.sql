-- ============================================================================
-- Multi-Agent Negotiation Simulator Database Schema (Neon PostgreSQL)
-- ============================================================================

-- 1. Simulations Table
CREATE TABLE IF NOT EXISTS simulations (
    id VARCHAR(64) PRIMARY KEY,
    scenario_id VARCHAR(64) NOT NULL,
    scenario_title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'RUNNING', 'PAUSED', 'COMPLETED', 'DEADLOCK'
    current_round INT NOT NULL DEFAULT 1,
    max_rounds INT NOT NULL DEFAULT 10,
    current_gap NUMERIC(14, 2) DEFAULT 0,
    agreement_likelihood INT DEFAULT 50,
    user_email VARCHAR(255),
    user_id VARCHAR(128),
    deadlock_resolution JSONB,
    deadlock_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(64) PRIMARY KEY,
    simulation_id VARCHAR(64) NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL, -- e.g., 'Buyer', 'Seller'
    personality VARCHAR(64) NOT NULL DEFAULT 'Collaborative', -- 'Collaborative', 'Aggressive', 'Analytical'
    goal TEXT,
    target_value NUMERIC(14, 2),
    reservation_value NUMERIC(14, 2),
    current_offer NUMERIC(14, 2),
    stance VARCHAR(64) DEFAULT 'Seeking agreement',
    progress_percent INT DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Messages / Negotiation Transcript Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    simulation_id VARCHAR(64) NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    sender_type VARCHAR(32) NOT NULL DEFAULT 'AGENT', -- 'AGENT', 'ORCHESTRATOR'
    sender_name VARCHAR(255) NOT NULL,
    sender_role VARCHAR(64) NOT NULL,
    personality VARCHAR(64),
    message TEXT NOT NULL,
    offer_value NUMERIC(14, 2),
    currency VARCHAR(16) DEFAULT '₹',
    action VARCHAR(32) DEFAULT 'OFFER', -- 'OFFER', 'COUNTER_OFFER', 'ACCEPT', 'REJECT', 'STATUS'
    timestamp_label VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Offers Table
CREATE TABLE IF NOT EXISTS offers (
    id VARCHAR(64) PRIMARY KEY,
    simulation_id VARCHAR(64) NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    agent_role VARCHAR(64) NOT NULL,
    offer_value NUMERIC(14, 2) NOT NULL,
    terms JSONB DEFAULT '{}'::jsonb,
    decision_status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'COUNTERED', 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Agreements Table
CREATE TABLE IF NOT EXISTS agreements (
    id VARCHAR(64) PRIMARY KEY,
    simulation_id VARCHAR(64) NOT NULL UNIQUE REFERENCES simulations(id) ON DELETE CASCADE,
    final_value NUMERIC(14, 2) NOT NULL,
    terms JSONB DEFAULT '{}'::jsonb,
    outcome VARCHAR(64) NOT NULL DEFAULT 'AGREEMENT_REACHED', -- 'AGREEMENT_REACHED', 'DEADLOCK', 'MAX_ROUNDS_REACHED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_simulation_round ON messages(simulation_id, round_number);
CREATE INDEX IF NOT EXISTS idx_offers_simulation ON offers(simulation_id);
CREATE INDEX IF NOT EXISTS idx_agents_simulation ON agents(simulation_id);

-- 6. Negotiation Strategies Table
CREATE TABLE IF NOT EXISTS negotiation_strategies (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(128) NOT NULL,
    difficulty VARCHAR(32) NOT NULL DEFAULT 'Beginner', -- 'Beginner', 'Intermediate', 'Advanced'
    best_use_case TEXT NOT NULL,
    advantages JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    example_dialogue JSONB DEFAULT '[]'::jsonb,
    recommended_scenarios JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. User Strategy Bookmarks Table
CREATE TABLE IF NOT EXISTS user_strategy_bookmarks (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    user_email VARCHAR(255),
    strategy_id VARCHAR(64) NOT NULL REFERENCES negotiation_strategies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_strategy_bookmark UNIQUE (user_id, strategy_id)
);

-- 8. Strategy Chat Conversations Table
CREATE TABLE IF NOT EXISTS strategy_chat_conversations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    user_email VARCHAR(255),
    title VARCHAR(255) NOT NULL DEFAULT 'Strategy Inquiry',
    strategy_id VARCHAR(64) REFERENCES negotiation_strategies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Strategy Chat Messages Table
CREATE TABLE IF NOT EXISTS strategy_chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES strategy_chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    strategy_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_strategy_bookmarks_user ON user_strategy_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_chat_conv_user ON strategy_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_chat_msg_conv ON strategy_chat_messages(conversation_id);

