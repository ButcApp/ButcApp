'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updateUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      if (!supabase) {
        console.error('Supabase client not initialized')
        setLoading(false)
        return
      }
      
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
      }
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event, session)
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)

          // Create or update user profile and redirect to app
          if (session?.user) {
            await createOrUpdateProfile(session.user)
            // Giriş başarılı olursa app sayfasına yönlendir
            router.push('/app')
          }
        }
      )

      return () => subscription.unsubscribe()
    }
  }, [])

  const createOrUpdateProfile = async (user: User) => {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized')
        return
      }
      
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error creating/updating profile:', error)
      }
    } catch (error) {
      console.error('Error in createOrUpdateProfile:', error)
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      if (!supabase) {
        return { error: { message: 'Supabase client not initialized' } as AuthError }
      }
      
      console.log('Attempting to sign up with email:', email)
      console.log('Password length:', password.length)
      console.log('Full name:', fullName)
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName || null
          }
        }
      })

      console.log('Supabase response:', { data, error })
      return { error }
    } catch (error) {
      console.error('Signup error:', error)
      return { error: error as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      if (!supabase) {
        return { error: { message: 'Supabase client not initialized' } as AuthError }
      }
      
      console.log('Attempting to sign in with email:', email)
      console.log('Password length:', password.length)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })

      console.log('Supabase sign in response:', { data, error })
      return { error }
    } catch (error) {
      console.error('Signin error:', error)
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized')
        return
      }
      
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      if (!supabase) {
        return { error: { message: 'Supabase client not initialized' } as AuthError }
      }
      
      console.log('Attempting to reset password for email:', email)
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
      console.log('Password reset response:', { error })
      return { error }
    } catch (error) {
      console.error('Password reset error:', error)
      return { error: error as AuthError }
    }
  }

  const updateUser = async () => {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized')
        return
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        await createOrUpdateProfile(session.user)
      }
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}