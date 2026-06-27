import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
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
export const db             = getFirestore(app)
export const storage        = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

// ─── Offline Persistence ──────────────────────────────────────────────────────

enableMultiTabIndexedDbPersistence(db).catch((err: { code: string }) => {
  if (err.code === 'failed-precondition') {
    console.warn('[CineTrack] Firestore persistence: multiple tabs open — active in first tab only.')
  } else if (err.code === 'unimplemented') {
    console.warn('[CineTrack] Firestore persistence: browser does not support IndexedDB.')
  }
})

// ─── Collection Paths ─────────────────────────────────────────────────────────

export const COLLECTIONS = {
  WATCHLIST: 'watchlist',
  EPISODES:  'episodes',
  HISTORY:   'watchHistory',
  SETTINGS:  'settings',
} as const

export type CollectionKey = keyof typeof COLLECTIONS

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
