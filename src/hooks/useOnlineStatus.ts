import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { processQueue } from '@/pwa/offlineQueue'

/**
 * Listens to window connection events.
 * Triggers offline IndexedDB synchronization queue replay when connection is restored.
 */
export function useOnlineStatus() {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (user) {
        void processQueue(user.uid)
      }
    }
    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user])

  return { isOnline }
}
