import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// ─── Config ───────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
} as const

// Guard against double-initialization in HMR / StrictMode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

// ─── Service Exports ──────────────────────────────────────────────────────────

export const auth           = getAuth(app)
export const db             = initializeFirestore(app, {
  localCache: persistentMultipleTabManager()
})
export const storage        = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

// ─── Collection Paths ─────────────────────────────────────────────────────────

export const COLLECTIONS = {
  WATCHLIST: 'watchlist',
  EPISODES:  'episodes',
  HISTORY:   'watchHistory',
  SETTINGS:  'settings',
} as const

export type CollectionKey = keyof typeof COLLECTIONS

// NOTE: This is documentation only. The ACTUAL rules live in the
// Firebase Console → Firestore → Rules tab. Verify they match this
// template with your real email substituted in, not just this comment.
/*
 * ─── FIRESTORE SECURITY RULES ─────────────────────────────────────────────────
 * Paste into Firebase Console → Firestore → Rules
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/{document=**} {
 *       allow read, write: if request.auth != null
 *         && request.auth.uid == userId
 *         && request.auth.token.email == '<YOUR_EMAIL>';
 *     }
 *   }
 * }
 */
