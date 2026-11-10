/**
 * Strategy Library & Gemini AI Doubt Assistant Client API
 */

import { auth } from '../firebase/config';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Retrieve current user's Firebase ID token for Authorization header
 */
async function getAuthHeaders() {
  try {
    if (auth && auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch (err) {
    console.warn('[Strategy API] Failed to fetch Firebase ID token:', err.message);
  }
  return {};
}

export async function fetchStrategies({ category, difficulty, search, scenarioId } = {}) {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
    if (search && search.trim()) params.append('search', search.trim());
    if (scenarioId) params.append('scenarioId', scenarioId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BACKEND_URL}/api/strategies${query}`);
    if (res.ok) {
      const json = await res.json();
      return json.data || [];
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    console.warn('[Strategy API] Failed to fetch strategies from backend, using fallback:', err.message);
    return [];
  }
}

export async function fetchStrategyById(id) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/strategies/${id}`);
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('[Strategy API] Failed to fetch strategy details:', err.message);
    return null;
  }
}

export async function fetchUserBookmarks(userId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/strategies/bookmarks?userId=${encodeURIComponent(userId || 'guest')}`, {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || [];
    }
  } catch (err) {
    console.warn('[Strategy API] Error fetching bookmarks from backend:', err.message);
  }
  // Local fallback
  try {
    const stored = localStorage.getItem(`negotiator_bookmarks_${userId || 'guest'}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function toggleBookmarkApi(strategyId, isBookmarked, userId, userEmail) {
  try {
    const endpoint = `${BACKEND_URL}/api/strategies/${strategyId}/bookmark`;
    const method = isBookmarked ? 'DELETE' : 'POST';
    const authHeaders = await getAuthHeaders();
    const body = method === 'POST' ? JSON.stringify({ userId: userId || 'guest', userEmail }) : undefined;

    await fetch(endpoint + (method === 'DELETE' ? `?userId=${encodeURIComponent(userId || 'guest')}` : ''), {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body
    });
  } catch (err) {
    console.warn('[Strategy API] Bookmark toggle failed on backend, saving locally:', err.message);
  }

  // Update local storage
  try {
    const key = `negotiator_bookmarks_${userId || 'guest'}`;
    const stored = localStorage.getItem(key);
    let list = stored ? JSON.parse(stored) : [];
    if (isBookmarked) {
      list = list.filter(id => id !== strategyId);
    } else {
      if (!list.includes(strategyId)) list.push(strategyId);
    }
    localStorage.setItem(key, JSON.stringify(list));
    return list;
  } catch {
    return [];
  }
}

export async function askGeminiTutor({ message, strategyId, conversationId, userId, userEmail }) {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/strategy-library/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      message,
      strategyId,
      conversationId,
      userId: userId || 'guest',
      userEmail
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tutor assistant error (${res.status}): ${errText}`);
  }

  const json = await res.json();
  return json.data;
}

export async function fetchConversationHistory(userId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/strategy-library/conversations?userId=${encodeURIComponent(userId || 'guest')}`, {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || [];
    }
  } catch (err) {
    console.warn('[Strategy API] Failed to fetch conversation history:', err.message);
  }
  return [];
}

export async function fetchConversationMessages(convId) {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/strategy-library/conversations/${convId}`, {
      headers: { ...authHeaders },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data?.messages || [];
    }
  } catch (err) {
    console.warn('[Strategy API] Failed to fetch conversation messages:', err.message);
  }
  return [];
}

