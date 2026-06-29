import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'

export interface PlannedWatch {
  id: string
  titleId: string
  title: string
  posterPath: string | null
  type: 'movie' | 'tv'
  plannedDate: string // YYYY-MM-DD
  note: string
  createdAt: Timestamp
}

export function usePlannedWatches() {
  const { user } = useAuth()
  const [plannedWatches, setPlannedWatches] = useState<PlannedWatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPlannedWatches([])
      setIsLoading(false)
      return
    }

    const q = query(
      collection(db, `users/${user.uid}/plannedWatches`),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PlannedWatch[]
        setPlannedWatches(items)
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] plannedWatches sync error:', err)
        setIsLoading(false)
      }
    )

    return unsubscribe
  }, [user])

  const addPlan = async (plan: {
    titleId: string
    title: string
    posterPath: string | null
    type: 'movie' | 'tv'
    plannedDate: string
    note: string
  }) => {
    if (!user) return
    const colRef = collection(db, `users/${user.uid}/plannedWatches`)
    await addDoc(colRef, {
      ...plan,
      createdAt: serverTimestamp(),
    })
  }

  const removePlan = async (id: string) => {
    if (!user) return
    const docRef = doc(db, `users/${user.uid}/plannedWatches/${id}`)
    await deleteDoc(docRef)
  }

  return { plannedWatches, addPlan, removePlan, isLoading }
}
