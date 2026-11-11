let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch (err) {
  // pg module not installed; fallback to inMemoryStore
}
const fs = require('fs');
const path = require('path');

const { SEED_STRATEGIES } = require('../data/seedStrategies');

let pool = null;
let isNeonConnected = false;

// In-Memory Fallback Store (Used if Neon DB URL is not yet configured or offline)
const inMemoryStore = {
  simulations: new Map(),
  agents: new Map(), // key: simulationId, value: Array of agents
  messages: new Map(), // key: simulationId, value: Array of messages
  offers: new Map(), // key: simulationId, value: Array of offers
  agreements: new Map(), // key: simulationId, value: agreement
  strategies: new Map(SEED_STRATEGIES.map(s => [s.id, { ...s, created_at: new Date(), updated_at: new Date() }])),
  bookmarks: new Map(), // key: userId, value: Set of strategyIds
  conversations: new Map(), // key: convId, value: object
  chatMessages: new Map(), // key: convId, value: Array of messages
};

/**
 * Initialize Database Connection
 */
const initDbConnection = async () => {
  const connectionString = process.env.DATABASE_URL;

  if (!Pool || !connectionString || connectionString.trim() === '') {
    console.log('[Neon DB] Running with robust In-Memory Store.');
    isNeonConnected = false;
    return false;
  }

  const cleanConnectionString = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
  pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: {
      rejectUnauthorized: false, // Required for Neon serverless postgres
    },
    connectionTimeoutMillis: 15000,
  });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Neon DB] Connecting to Neon PostgreSQL (attempt ${attempt}/${maxRetries})...`);
      const client = await pool.connect();
      const res = await client.query('SELECT NOW()');
      client.release();

      console.log('✅ [Neon DB] Connected successfully to Neon PostgreSQL at:', res.rows[0].now);
      isNeonConnected = true;

      // Run migrations
      await runMigrations();
      return true;
    } catch (error) {
      console.warn(`⚠️ [Neon DB] Connection attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`[Neon DB] Waiting 2s before retry ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.warn('⚠️ [Neon DB] All connection attempts failed, falling back to In-Memory Store.');
        isNeonConnected = false;
        return false;
      }
    }
  }
};

/**
 * Execute Schema Migration
 */
const runMigrations = async () => {
  if (!pool || !isNeonConnected) return;
  try {
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);

    // Ensure user isolation columns & attribute legacy test sessions to original creator
    await pool.query(`
      ALTER TABLE simulations ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
      ALTER TABLE simulations ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);
      ALTER TABLE simulations ADD COLUMN IF NOT EXISTS deadlock_resolution JSONB;
      ALTER TABLE simulations ADD COLUMN IF NOT EXISTS deadlock_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_simulations_user_email ON simulations(user_email);
      UPDATE simulations SET user_email = 'shubhayyadav84@gmail.com' WHERE user_email IS NULL;
    `);

    // Seed negotiation strategies if empty or updated
    for (const strat of SEED_STRATEGIES) {
      await pool.query(
        `INSERT INTO negotiation_strategies (
          id, slug, title, description, category, difficulty, best_use_case,
          advantages, risks, example_dialogue, recommended_scenarios, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          difficulty = EXCLUDED.difficulty,
          best_use_case = EXCLUDED.best_use_case,
          advantages = EXCLUDED.advantages,
          risks = EXCLUDED.risks,
          example_dialogue = EXCLUDED.example_dialogue,
          recommended_scenarios = EXCLUDED.recommended_scenarios,
          updated_at = CURRENT_TIMESTAMP`,
        [
          strat.id,
          strat.slug,
          strat.title,
          strat.description,
          strat.category,
          strat.difficulty,
          strat.best_use_case,
          JSON.stringify(strat.advantages),
          JSON.stringify(strat.risks),
          JSON.stringify(strat.example_dialogue),
          JSON.stringify(strat.recommended_scenarios || [])
        ]
      );
    }
    console.log(`✅ [Neon DB] Seeded ${SEED_STRATEGIES.length} negotiation strategies successfully.`);

    console.log('✅ [Neon DB] Schema tables verified & migrated successfully.');
  } catch (err) {
    console.error('❌ [Neon DB] Migration error:', err.message);
  }
};

// ============================================================================
// Database Service Interface
// ============================================================================

const db = {
  isNeonConnected: () => isNeonConnected,
  getPool: () => pool,

  /**
   * Create a new simulation session with initial agents
   */
  async createSimulation(simData, agents = []) {
    const {
      id,
      scenario_id,
      scenario_title,
      status = 'CREATED',
      current_round = 1,
      max_rounds = 10,
      current_gap = 0,
      agreement_likelihood = 50,
      user_email = null,
      user_id = null,
    } = simData;

    if (isNeonConnected && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO simulations (id, scenario_id, scenario_title, status, current_round, max_rounds, current_gap, agreement_likelihood, user_email, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             scenario_id = EXCLUDED.scenario_id,
             scenario_title = EXCLUDED.scenario_title,
             status = EXCLUDED.status,
             current_round = EXCLUDED.current_round,
             max_rounds = EXCLUDED.max_rounds,
             current_gap = EXCLUDED.current_gap,
             agreement_likelihood = EXCLUDED.agreement_likelihood,
             user_email = COALESCE(EXCLUDED.user_email, simulations.user_email),
             user_id = COALESCE(EXCLUDED.user_id, simulations.user_id),
             updated_at = CURRENT_TIMESTAMP`,
          [id, scenario_id, scenario_title, status, current_round, max_rounds, current_gap, agreement_likelihood, user_email, user_id]
        );

        for (const agent of agents) {
          const scopedAgentId = `${id}_${agent.id || agent.role.toLowerCase()}`;
          await client.query(
            `INSERT INTO agents (id, simulation_id, name, role, personality, goal, target_value, reservation_value, current_offer, stance, progress_percent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE SET
               current_offer = EXCLUDED.current_offer,
               stance = EXCLUDED.stance,
               progress_percent = EXCLUDED.progress_percent`,
            [
              scopedAgentId,
              id,
              agent.name,
              agent.role,
              agent.personality || 'Collaborative',
              agent.goal || '',
              agent.target_value || 0,
              agent.reservation_value || 0,
              agent.current_offer || null,
              agent.stance || 'Seeking agreement',
              agent.progress_percent || 50,
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory cache update
    inMemoryStore.simulations.set(id, {
      ...simData,
      status,
      current_round,
      max_rounds,
      current_gap,
      agreement_likelihood,
      user_email,
      user_id,
      created_at: new Date(),
      updated_at: new Date(),
    });
    inMemoryStore.agents.set(id, agents.map(a => ({ ...a })));
    if (!inMemoryStore.messages.has(id)) inMemoryStore.messages.set(id, []);
    if (!inMemoryStore.offers.has(id)) inMemoryStore.offers.set(id, []);

    return this.getSimulation(id);
  },

  /**
   * Retrieve full simulation state by ID
   */
  async getSimulation(id) {
    if (isNeonConnected && pool) {
      try {
        const simRes = await pool.query('SELECT * FROM simulations WHERE id = $1', [id]);
        if (simRes.rows.length === 0) return null;

        const sim = simRes.rows[0];
        const agentsRes = await pool.query('SELECT * FROM agents WHERE simulation_id = $1 ORDER BY created_at ASC', [id]);
        const msgRes = await pool.query('SELECT * FROM messages WHERE simulation_id = $1 ORDER BY created_at ASC', [id]);
        const offersRes = await pool.query('SELECT * FROM offers WHERE simulation_id = $1 ORDER BY created_at ASC', [id]);
        const agreementRes = await pool.query('SELECT * FROM agreements WHERE simulation_id = $1', [id]);

        return {
          ...sim,
          agents: agentsRes.rows,
          messages: msgRes.rows,
          offers: offersRes.rows,
          agreement: agreementRes.rows[0] || null,
        };
      } catch (err) {
        console.warn('[Neon DB] Error in getSimulation, falling back to cache:', err.message);
      }
    }

    // Fallback in-memory
    const sim = inMemoryStore.simulations.get(id);
    if (!sim) return null;

    return {
      ...sim,
      agents: inMemoryStore.agents.get(id) || [],
      messages: inMemoryStore.messages.get(id) || [],
      offers: inMemoryStore.offers.get(id) || [],
      agreement: inMemoryStore.agreements.get(id) || null,
    };
  },

  /**
   * List all simulations
   */
  async listSimulations(options = 50) {
    let limit = 50;
    let userEmail = null;
    let userId = null;

    if (typeof options === 'number') {
      limit = options;
    } else if (options && typeof options === 'object') {
      limit = options.limit || 50;
      userEmail = options.userEmail || null;
      userId = options.userId || null;
    }

    if (isNeonConnected && pool) {
      try {
        const query = userEmail
          ? `
            SELECT s.*, 
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', a.id,
                    'name', a.name,
                    'role', a.role,
                    'personality', a.personality,
                    'goal', a.goal,
                    'target_value', a.target_value,
                    'reservation_value', a.reservation_value,
                    'current_offer', a.current_offer,
                    'stance', a.stance,
                    'progress_percent', a.progress_percent
                  )
                ) FILTER (WHERE a.id IS NOT NULL), '[]'
              ) AS agents,
              COALESCE(
                (SELECT row_to_json(ag) FROM agreements ag WHERE ag.simulation_id = s.id LIMIT 1),
                NULL
              ) AS agreement
            FROM simulations s
            LEFT JOIN agents a ON a.simulation_id = s.id
            WHERE LOWER(s.user_email) = LOWER($1) OR ($2::text IS NOT NULL AND s.user_id = $2)
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT $3
          `
          : `
            SELECT s.*, 
              COALESCE(
                json_agg(
                  DISTINCT jsonb_build_object(
                    'id', a.id,
                    'name', a.name,
                    'role', a.role,
                    'personality', a.personality,
                    'goal', a.goal,
                    'target_value', a.target_value,
                    'reservation_value', a.reservation_value,
                    'current_offer', a.current_offer,
                    'stance', a.stance,
                    'progress_percent', a.progress_percent
                  )
                ) FILTER (WHERE a.id IS NOT NULL), '[]'
              ) AS agents,
              COALESCE(
                (SELECT row_to_json(ag) FROM agreements ag WHERE ag.simulation_id = s.id LIMIT 1),
                NULL
              ) AS agreement
            FROM simulations s
            LEFT JOIN agents a ON a.simulation_id = s.id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT $1
          `;
        const params = userEmail ? [userEmail, userId || null, limit] : [limit];
        const res = await pool.query(query, params);
        return res.rows;
      } catch (err) {
        console.warn('[Neon DB] Error in listSimulations, using cache:', err.message);
      }
    }

    return Array.from(inMemoryStore.simulations.values())
      .filter(sim => {
        if (!userEmail) return true;
        const matchEmail = sim.user_email && sim.user_email.toLowerCase() === userEmail.toLowerCase();
        const matchId = userId && sim.user_id === userId;
        return matchEmail || matchId;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(sim => ({
        ...sim,
        agents: inMemoryStore.agents.get(sim.id) || [],
        agreement: inMemoryStore.agreements.get(sim.id) || null
      }));
  },

  /**
   * Update Simulation status/round/metrics
   */
  async updateSimulation(id, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return;

    if (isNeonConnected && pool) {
      try {
        const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = [id, ...keys.map(k => updates[k])];
        await pool.query(
          `UPDATE simulations SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          values
        );
      } catch (err) {
        console.warn('[Neon DB] Update error:', err.message);
      }
    }

    const current = inMemoryStore.simulations.get(id);
    if (current) {
      inMemoryStore.simulations.set(id, {
        ...current,
        ...updates,
        updated_at: new Date(),
      });
    }
  },

  /**
   * Append a negotiation message
   */
  async addMessage(msg) {
    const {
      id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      simulation_id,
      round_number,
      sender_type = 'AGENT',
      sender_name,
      sender_role,
      personality,
      message,
      offer_value = null,
      currency = '₹',
      action = 'OFFER',
      timestamp_label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    } = msg;

    const record = {
      id,
      simulation_id,
      round_number,
      sender_type,
      sender_name,
      sender_role,
      personality,
      message,
      offer_value,
      currency,
      action,
      timestamp_label,
      created_at: new Date(),
    };

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO messages (id, simulation_id, round_number, sender_type, sender_name, sender_role, personality, message, offer_value, currency, action, timestamp_label)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [id, simulation_id, round_number, sender_type, sender_name, sender_role, personality, message, offer_value, currency, action, timestamp_label]
        );
      } catch (err) {
        console.warn('[Neon DB] addMessage error:', err.message);
      }
    }

    const list = inMemoryStore.messages.get(simulation_id) || [];
    list.push(record);
    inMemoryStore.messages.set(simulation_id, list);

    return record;
  },

  /**
   * Record a proposed offer
   */
  async addOffer(offer) {
    const {
      id = `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      simulation_id,
      round_number,
      agent_role,
      offer_value,
      terms = {},
      decision_status = 'PENDING',
    } = offer;

    const record = {
      id,
      simulation_id,
      round_number,
      agent_role,
      offer_value,
      terms,
      decision_status,
      created_at: new Date(),
    };

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO offers (id, simulation_id, round_number, agent_role, offer_value, terms, decision_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, simulation_id, round_number, agent_role, offer_value, JSON.stringify(terms), decision_status]
        );
      } catch (err) {
        console.warn('[Neon DB] addOffer error:', err.message);
      }
    }

    const list = inMemoryStore.offers.get(simulation_id) || [];
    list.push(record);
    inMemoryStore.offers.set(simulation_id, list);

    return record;
  },

  /**
   * Update Agent state
   */
  async updateAgent(simulationId, role, updates) {
    if (isNeonConnected && pool) {
      try {
        const keys = Object.keys(updates);
        if (keys.length > 0) {
          const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
          const values = [simulationId, role, ...keys.map(k => updates[k])];
          await pool.query(
            `UPDATE agents SET ${setClauses} WHERE simulation_id = $1 AND role = $2`,
            values
          );
        }
      } catch (err) {
        console.warn('[Neon DB] updateAgent error:', err.message);
      }
    }

    const list = inMemoryStore.agents.get(simulationId) || [];
    const idx = list.findIndex(a => a.role === role);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      inMemoryStore.agents.set(simulationId, list);
    }
  },

  /**
   * Save Agreement Outcome
   */
  async saveAgreement(agreement) {
    const {
      id = `agr_${Date.now()}`,
      simulation_id,
      final_value,
      terms = {},
      outcome = 'AGREEMENT_REACHED',
    } = agreement;

    const record = {
      id,
      simulation_id,
      final_value,
      terms,
      outcome,
      created_at: new Date(),
    };

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO agreements (id, simulation_id, final_value, terms, outcome)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (simulation_id) DO UPDATE SET
             final_value = EXCLUDED.final_value,
             terms = EXCLUDED.terms,
             outcome = EXCLUDED.outcome`,
          [id, simulation_id, final_value, JSON.stringify(terms), outcome]
        );
      } catch (err) {
        console.warn('[Neon DB] saveAgreement error:', err.message);
      }
    }

    inMemoryStore.agreements.set(simulation_id, record);
    return record;
  },

  async deleteAgreement(simulationId) {
    if (isNeonConnected && pool) {
      try {
        await pool.query('DELETE FROM agreements WHERE simulation_id = $1', [simulationId]);
      } catch (err) {
        console.warn('[Neon DB] deleteAgreement error:', err.message);
      }
    }
    inMemoryStore.agreements.delete(simulationId);
  },

  // ============================================================================
  // Strategy Library & AI Doubt Assistant DB Methods
  // ============================================================================

  /**
   * List all strategies with optional filters
   */
  async listStrategies({ category, difficulty, search, scenarioId } = {}) {
    if (isNeonConnected && pool) {
      try {
        let query = 'SELECT * FROM negotiation_strategies WHERE 1=1';
        const params = [];
        let pIndex = 1;

        if (category && category !== 'All' && category !== 'All Categories') {
          query += ` AND category = $${pIndex++}`;
          params.push(category);
        }
        if (difficulty && difficulty !== 'All' && difficulty !== 'All Levels') {
          query += ` AND LOWER(difficulty) = LOWER($${pIndex++})`;
          params.push(difficulty);
        }
        if (search && search.trim()) {
          query += ` AND (title ILIKE $${pIndex} OR description ILIKE $${pIndex} OR best_use_case ILIKE $${pIndex} OR category ILIKE $${pIndex})`;
          params.push(`%${search.trim()}%`);
          pIndex++;
        }

        query += ' ORDER BY created_at ASC';
        const res = await pool.query(query, params);
        if (res.rows && res.rows.length > 0) {
          return res.rows;
        }
      } catch (err) {
        console.warn('[Neon DB] listStrategies error:', err.message);
      }
    }

    // In-memory fallback
    let list = Array.from(inMemoryStore.strategies.values());
    if (category && category !== 'All' && category !== 'All Categories') {
      list = list.filter(s => s.category.toLowerCase() === category.toLowerCase());
    }
    if (difficulty && difficulty !== 'All' && difficulty !== 'All Levels') {
      list = list.filter(s => s.difficulty.toLowerCase() === difficulty.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.best_use_case && s.best_use_case.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return list;
  },

  /**
   * Get single strategy by ID or slug
   */
  async getStrategy(idOrSlug) {
    if (!idOrSlug) return null;
    if (isNeonConnected && pool) {
      try {
        const res = await pool.query(
          'SELECT * FROM negotiation_strategies WHERE id = $1 OR slug = $1 LIMIT 1',
          [idOrSlug]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.warn('[Neon DB] getStrategy error:', err.message);
      }
    }

    // In-memory fallback
    const byId = inMemoryStore.strategies.get(idOrSlug);
    if (byId) return byId;
    return Array.from(inMemoryStore.strategies.values()).find(s => s.slug === idOrSlug) || null;
  },

  /**
   * Get bookmarks for user
   */
  async getUserBookmarks(userId) {
    if (!userId) return [];
    if (isNeonConnected && pool) {
      try {
        const res = await pool.query(
          'SELECT strategy_id FROM user_strategy_bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        return res.rows.map(r => r.strategy_id);
      } catch (err) {
        console.warn('[Neon DB] getUserBookmarks error:', err.message);
      }
    }

    const set = inMemoryStore.bookmarks.get(userId);
    return set ? Array.from(set) : [];
  },

  /**
   * Add bookmark for user
   */
  async addBookmark(userId, userEmail, strategyId) {
    if (!userId || !strategyId) return false;
    const bookmarkId = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO user_strategy_bookmarks (id, user_id, user_email, strategy_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, strategy_id) DO NOTHING`,
          [bookmarkId, userId, userEmail || null, strategyId]
        );
        return true;
      } catch (err) {
        console.warn('[Neon DB] addBookmark error:', err.message);
      }
    }

    if (!inMemoryStore.bookmarks.has(userId)) {
      inMemoryStore.bookmarks.set(userId, new Set());
    }
    inMemoryStore.bookmarks.get(userId).add(strategyId);
    return true;
  },

  /**
   * Remove bookmark for user
   */
  async removeBookmark(userId, strategyId) {
    if (!userId || !strategyId) return false;
    if (isNeonConnected && pool) {
      try {
        await pool.query(
          'DELETE FROM user_strategy_bookmarks WHERE user_id = $1 AND strategy_id = $2',
          [userId, strategyId]
        );
        return true;
      } catch (err) {
        console.warn('[Neon DB] removeBookmark error:', err.message);
      }
    }

    if (inMemoryStore.bookmarks.has(userId)) {
      inMemoryStore.bookmarks.get(userId).delete(strategyId);
    }
    return true;
  },

  /**
   * Create or get strategy chat conversation
   */
  async createStrategyConversation(userId, userEmail, title = 'Strategy Inquiry', strategyId = null) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const convRecord = {
      id,
      user_id: userId || 'guest',
      user_email: userEmail || null,
      title,
      strategy_id: strategyId || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO strategy_chat_conversations (id, user_id, user_email, title, strategy_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, convRecord.user_id, convRecord.user_email, title, convRecord.strategy_id]
        );
      } catch (err) {
        console.warn('[Neon DB] createStrategyConversation error:', err.message);
      }
    }

    inMemoryStore.conversations.set(id, convRecord);
    return convRecord;
  },

  /**
   * List strategy chat conversations for user
   */
  async listStrategyConversations(userId) {
    if (!userId) return [];
    if (isNeonConnected && pool) {
      try {
        const res = await pool.query(
          `SELECT c.*, s.title as strategy_title, s.slug as strategy_slug
           FROM strategy_chat_conversations c
           LEFT JOIN negotiation_strategies s ON c.strategy_id = s.id
           WHERE c.user_id = $1
           ORDER BY c.updated_at DESC`,
          [userId]
        );
        return res.rows;
      } catch (err) {
        console.warn('[Neon DB] listStrategyConversations error:', err.message);
      }
    }

    return Array.from(inMemoryStore.conversations.values())
      .filter(c => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  },

  /**
   * Get single conversation
   */
  async getStrategyConversation(id, userId = null) {
    if (!id) return null;
    if (isNeonConnected && pool) {
      try {
        const query = userId
          ? 'SELECT * FROM strategy_chat_conversations WHERE id = $1 AND user_id = $2'
          : 'SELECT * FROM strategy_chat_conversations WHERE id = $1';
        const params = userId ? [id, userId] : [id];
        const res = await pool.query(query, params);
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.warn('[Neon DB] getStrategyConversation error:', err.message);
      }
    }

    return inMemoryStore.conversations.get(id) || null;
  },

  /**
   * Delete conversation
   */
  async deleteStrategyConversation(id, userId = null) {
    if (!id) return false;
    if (isNeonConnected && pool) {
      try {
        const query = userId
          ? 'DELETE FROM strategy_chat_conversations WHERE id = $1 AND user_id = $2'
          : 'DELETE FROM strategy_chat_conversations WHERE id = $1';
        const params = userId ? [id, userId] : [id];
        await pool.query(query, params);
        return true;
      } catch (err) {
        console.warn('[Neon DB] deleteStrategyConversation error:', err.message);
      }
    }

    inMemoryStore.conversations.delete(id);
    inMemoryStore.chatMessages.delete(id);
    return true;
  },

  /**
   * Add message to conversation
   */
  async addStrategyChatMessage(conversationId, role, content, strategyId = null) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msg = {
      id,
      conversation_id: conversationId,
      role,
      content,
      strategy_id: strategyId || null,
      created_at: new Date()
    };

    if (isNeonConnected && pool) {
      try {
        await pool.query(
          `INSERT INTO strategy_chat_messages (id, conversation_id, role, content, strategy_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, conversationId, role, content, strategyId]
        );
        await pool.query(
          'UPDATE strategy_chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [conversationId]
        );
      } catch (err) {
        console.warn('[Neon DB] addStrategyChatMessage error:', err.message);
      }
    }

    if (!inMemoryStore.chatMessages.has(conversationId)) {
      inMemoryStore.chatMessages.set(conversationId, []);
    }
    inMemoryStore.chatMessages.get(conversationId).push(msg);

    const conv = inMemoryStore.conversations.get(conversationId);
    if (conv) conv.updated_at = new Date();

    return msg;
  },

  /**
   * Get messages for conversation
   */
  async getStrategyChatMessages(conversationId) {
    if (!conversationId) return [];
    if (isNeonConnected && pool) {
      try {
        const res = await pool.query(
          'SELECT * FROM strategy_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
          [conversationId]
        );
        return res.rows;
      } catch (err) {
        console.warn('[Neon DB] getStrategyChatMessages error:', err.message);
      }
    }

    return inMemoryStore.chatMessages.get(conversationId) || [];
  },
};

module.exports = {
  initDbConnection,
  db,
};
