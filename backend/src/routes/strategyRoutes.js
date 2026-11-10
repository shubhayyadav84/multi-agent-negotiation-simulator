/**
 * Strategy Library & Gemini AI Doubt Assistant Routes
 */

const express = require('express');
const router = express.Router();
const { db } = require('../db/db');
const { answerStrategyDoubt } = require('../services/geminiTutorService');
const { optionalFirebaseToken } = require('../middleware/authMiddleware');

router.use(optionalFirebaseToken);

/**
 * GET /api/strategies
 * List all strategies with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, search, scenarioId } = req.query;
    const strategies = await db.listStrategies({ category, difficulty, search, scenarioId });
    return res.json({ success: true, data: strategies });
  } catch (err) {
    console.error('[Strategy Routes] Error listing strategies:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/strategies/bookmarks
 * Get list of bookmarked strategy IDs for user
 */
router.get('/bookmarks', async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId || req.headers['x-user-id'] || 'guest';
    const bookmarks = await db.getUserBookmarks(userId);
    return res.json({ success: true, data: bookmarks });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/strategies/conversations
 * List user's doubt assistant conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user?.uid || req.query.userId || req.headers['x-user-id'] || 'guest';
    const convs = await db.listStrategyConversations(userId);
    return res.json({ success: true, data: convs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/strategies/conversations/:id
 * Get single conversation with all its messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conv = await db.getStrategyConversation(id);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    const messages = await db.getStrategyChatMessages(id);
    return res.json({ success: true, data: { ...conv, messages } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/strategies/conversations/:id
 * Delete a chat conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || req.headers['x-user-id'] || null;
    await db.deleteStrategyConversation(id, userId);
    return res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/chat (also mounted under /api/strategy-library/chat)
 * Ask Gemini about negotiation strategies
 */
router.post('/chat', async (req, res) => {
  try {
    const {
      message,
      strategyId,
      conversationId,
      userId = req.headers['x-user-id'] || 'guest',
      userEmail
    } = req.body || {};

    const effectiveUserId = req.user?.uid || userId;
    const effectiveUserEmail = req.user?.email || userEmail;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    const result = await answerStrategyDoubt({
      message,
      strategyId,
      conversationId,
      userId: effectiveUserId,
      userEmail: effectiveUserEmail,
    });
      userId,
      userEmail
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[Strategy Assistant] Error generating response:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to process inquiry with negotiation tutor assistant. Please try again.'
    });
  }
});

/**
 * GET /api/strategies/:id
 * Get single strategy details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const strategy = await db.getStrategy(id);
    if (!strategy) {
      return res.status(404).json({ success: false, error: 'Strategy not found' });
    }
    return res.json({ success: true, data: strategy });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/strategies/:id/bookmark
 * Bookmark a strategy
 */
router.post('/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = req.headers['x-user-id'] || 'guest', userEmail } = req.body || {};
    await db.addBookmark(userId, userEmail, id);
    return res.json({ success: true, message: 'Strategy bookmarked' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/strategies/:id/bookmark
 * Remove bookmark
 */
router.delete('/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid || req.query.userId || req.headers['x-user-id'] || 'guest';
    await db.removeBookmark(userId, id);
    return res.json({ success: true, message: 'Bookmark removed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

