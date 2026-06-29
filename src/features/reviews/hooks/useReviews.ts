import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/useAuth'

export interface ReviewEntry {
  id: string
  titleId: string
  title: string
  posterPath: string | null
  year: number
  rating: number // 1-10
  reviewText: string
  tags: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface AddReviewParams {
  titleId: string
  title: string
  posterPath: string | null
  year: number
  rating: number
  reviewText: string
  tags: string[]
}

export function useReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<ReviewEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setReviews([])
      setIsLoading(false)
      return
    }

    const reviewsCol = collection(db, `users/${user.uid}/reviews`)
    const q = query(reviewsCol, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ReviewEntry[]
        setReviews(items)
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] useReviews sync error:', err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  const addReview = async (params: AddReviewParams): Promise<string> => {
    if (!user) throw new Error('User must be logged in to review.')
    
    const reviewsCol = collection(db, `users/${user.uid}/reviews`)
    const docRef = await addDoc(reviewsCol, {
      ...params,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  const updateReview = async (reviewId: string, updates: Partial<Omit<ReviewEntry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
    if (!user) throw new Error('User must be logged in to update.')

    const docRef = doc(db, `users/${user.uid}/reviews`, reviewId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteReview = async (reviewId: string): Promise<void> => {
    if (!user) throw new Error('User must be logged in to delete.')

    const docRef = doc(db, `users/${user.uid}/reviews`, reviewId)
    await deleteDoc(docRef)
  }

  return {
    reviews,
    isLoading,
    addReview,
    updateReview,
    deleteReview,
  }
}
