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

export interface NoteEntry {
  id: string
  title: string
  content: string
  category: string
  titleId?: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  color: string
}

export interface AddNoteParams {
  title: string
  content: string
  category: string
  titleId?: string | null
  color: string
}

export function useNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setNotes([])
      setIsLoading(false)
      return
    }

    const notesCol = collection(db, `users/${user.uid}/notes`)
    const q = query(notesCol, orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as NoteEntry[]
        setNotes(items)
        setIsLoading(false)
      },
      (err) => {
        console.error('[CineTrack] useNotes sync error:', err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  const addNote = async (params: AddNoteParams): Promise<string> => {
    if (!user) throw new Error('User must be logged in to create notes.')

    const notesCol = collection(db, `users/${user.uid}/notes`)
    const docRef = await addDoc(notesCol, {
      ...params,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  const updateNote = async (noteId: string, updates: Partial<Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
    if (!user) throw new Error('User must be logged in to update notes.')

    const docRef = doc(db, `users/${user.uid}/notes`, noteId)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteNote = async (noteId: string): Promise<void> => {
    if (!user) throw new Error('User must be logged in to delete notes.')

    const docRef = doc(db, `users/${user.uid}/notes`, noteId)
    await deleteDoc(docRef)
  }

  return {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
  }
}
