import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, COLLECTIONS } from '@/lib/firebase'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PendingOperation {
  id: string
  type: 'addEntry' | 'updateEntry' | 'removeEntry' | 'updateEpisode'
  payload: {
    titleId: string
    episodeKey?: string
    data?: any
    watched?: boolean
  }
  timestamp: number
}

// ─── Direct IndexedDB helper functions ────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cinetrack-offline-db', 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('operations')) {
        database.createObjectStore('operations', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function queueOperation(op: Omit<PendingOperation, 'id' | 'timestamp'>): Promise<void> {
  const database = await openDB()
  const fullOp: PendingOperation = {
    id: Math.random().toString(36).substring(2, 9),
    type: op.type,
    payload: op.payload,
    timestamp: Date.now(),
  }

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('operations', 'readwrite')
    const store = transaction.objectStore('operations')
    const request = store.add(fullOp)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getPendingOps(): Promise<PendingOperation[]> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('operations', 'readonly')
    const store = transaction.objectStore('operations')
    const request = store.getAll()

    request.onsuccess = () => {
      const results = request.result as PendingOperation[]
      resolve(results.sort((a, b) => a.timestamp - b.timestamp))
    }
    request.onerror = () => reject(request.error)
  })
}

export async function removeOp(id: string): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('operations', 'readwrite')
    const store = transaction.objectStore('operations')
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ─── Background Sync Replay Queue ───────────────────────────────────────────

export async function processQueue(userId: string): Promise<void> {
  if (!userId) return
  const ops = await getPendingOps()

  for (const op of ops) {
    try {
      const { titleId, episodeKey, data, watched } = op.payload

      if (op.type === 'addEntry') {
        const docRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}/${titleId}`)
        await setDoc(docRef, data, { merge: true })
      } else if (op.type === 'updateEntry') {
        const docRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}/${titleId}`)
        await updateDoc(docRef, data)
      } else if (op.type === 'removeEntry') {
        const docRef = doc(db, `users/${userId}/${COLLECTIONS.WATCHLIST}/${titleId}`)
        await deleteDoc(docRef)
      } else if (op.type === 'updateEpisode') {
        const docRef = doc(
          db,
          `users/${userId}/${COLLECTIONS.WATCHLIST}/${titleId}/${COLLECTIONS.EPISODES}/${episodeKey!}`
        )
        if (watched) {
          await setDoc(docRef, data)
        } else {
          await deleteDoc(docRef)
        }
      }

      // Sync complete, pop from IndexedDB queue
      await removeOp(op.id)
    } catch (err) {
      console.error(`[CineTrack PWA] Replay failed for operation: ${op.type}`, err)
      // Break loop to keep processing order intact (replay on next connection)
      break
    }
  }
}
