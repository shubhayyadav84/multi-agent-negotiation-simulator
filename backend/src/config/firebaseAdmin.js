const admin = require('firebase-admin');
const { initializeApp, cert, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

/**
 * Firebase Admin SDK Configuration
 *
 * Supports three credential configuration methods:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY (full JSON string)
 * 2. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (discrete env vars)
 * 3. GOOGLE_APPLICATION_CREDENTIALS (file path to JSON key)
 *
 * Compatible with Firebase Admin v14+ and legacy v10-v12.
 */

let isFirebaseAdminConfigured = false;
let authInstance = null;

function resolveCert(params) {
  if (typeof cert === 'function') {
    return cert(params);
  }
  if (admin && admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert(params);
  }
  if (admin && typeof admin.cert === 'function') {
    return admin.cert(params);
  }
  throw new Error('Firebase Admin cert helper is not available.');
}

function resolveAppDefault() {
  if (typeof applicationDefault === 'function') {
    return applicationDefault();
  }
  if (admin && admin.credential && typeof admin.credential.applicationDefault === 'function') {
    return admin.credential.applicationDefault();
  }
  throw new Error('Firebase Admin applicationDefault helper is not available.');
}

try {
  const existingApps = typeof getApps === 'function' ? getApps() : (admin?.apps || []);
  if (Array.isArray(existingApps) && existingApps.length > 0) {
    isFirebaseAdminConfigured = true;
    authInstance = typeof getAuth === 'function' ? getAuth() : (admin?.auth ? admin.auth() : null);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const serviceAccount = JSON.parse(raw);
    const credential = resolveCert(serviceAccount);
    const app = typeof initializeApp === 'function' ? initializeApp({ credential }) : admin.initializeApp({ credential });
    authInstance = typeof getAuth === 'function' ? getAuth(app) : (admin?.auth ? admin.auth() : null);
    isFirebaseAdminConfigured = true;
    console.log('✅ [Firebase Admin] Initialized successfully using FIREBASE_SERVICE_ACCOUNT_KEY JSON.');
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    // Handle double-quotes or single-quotes wrapping the key
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const credential = resolveCert({
      projectId: process.env.FIREBASE_PROJECT_ID.trim(),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey,
    });
    const app = typeof initializeApp === 'function' ? initializeApp({ credential }) : admin.initializeApp({ credential });
    authInstance = typeof getAuth === 'function' ? getAuth(app) : (admin?.auth ? admin.auth() : null);
    isFirebaseAdminConfigured = true;
    console.log(`✅ [Firebase Admin] Initialized successfully for project: ${process.env.FIREBASE_PROJECT_ID}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credential = resolveAppDefault();
    const app = typeof initializeApp === 'function' ? initializeApp({ credential }) : admin.initializeApp({ credential });
    authInstance = typeof getAuth === 'function' ? getAuth(app) : (admin?.auth ? admin.auth() : null);
    isFirebaseAdminConfigured = true;
    console.log('✅ [Firebase Admin] Initialized successfully using application default credentials.');
  } else {
    console.warn(
      '⚠️ [Firebase Admin] No Firebase service account credentials found in environment (FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY). Running in development mode.'
    );
  }
} catch (err) {
  console.warn('⚠️ [Firebase Admin] Initialization failed:', err.message);
  isFirebaseAdminConfigured = false;
}

function getAdminAuth() {
  if (authInstance) return authInstance;
  if (isFirebaseAdminConfigured) {
    try {
      authInstance = typeof getAuth === 'function' ? getAuth() : (admin?.auth ? admin.auth() : null);
      return authInstance;
    } catch {}
  }
  return null;
}

module.exports = {
  admin,
  getAdminAuth,
  isFirebaseAdminConfigured: () => isFirebaseAdminConfigured,
};

