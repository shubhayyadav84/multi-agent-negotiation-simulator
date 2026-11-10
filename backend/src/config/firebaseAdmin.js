const admin = require('firebase-admin');

/**
 * Firebase Admin SDK Configuration
 *
 * Supports three credential configuration methods:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY (full JSON string)
 * 2. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (discrete env vars)
 * 3. GOOGLE_APPLICATION_CREDENTIALS (file path to JSON key)
 *
 * If credentials are not configured (e.g. in local development or automated tests),
 * the module flags isFirebaseAdminConfigured = false so that local testing and development
 * continue smoothly without crashing.
 */

let isFirebaseAdminConfigured = false;

try {
  if (admin.apps.length > 0) {
    isFirebaseAdminConfigured = true;
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseAdminConfigured = true;
    console.log('✅ [Firebase Admin] Initialized successfully using FIREBASE_SERVICE_ACCOUNT_KEY JSON.');
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    isFirebaseAdminConfigured = true;
    console.log(`✅ [Firebase Admin] Initialized successfully for project: ${process.env.FIREBASE_PROJECT_ID}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
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

module.exports = {
  admin,
  isFirebaseAdminConfigured: () => isFirebaseAdminConfigured,
};
