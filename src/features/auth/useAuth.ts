import { useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  loading: boolean
  isOwner: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL as string

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    // Always show the account picker
    googleProvider.setCustomParameters({ prompt: 'select_account' })

    const result = await signInWithPopup(auth, googleProvider)

    // Immediately verify owner — kick out and throw if not authorized
    if (result.user.email !== OWNER_EMAIL) {
      await firebaseSignOut(auth)
      throw new Error('ACCESS_DENIED')
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const isOwner = user?.email === OWNER_EMAIL

  return { user, loading, isOwner, signInWithGoogle, signOut }
}
