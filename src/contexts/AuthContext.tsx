'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Helper function to generate verification token (client-side compatible)
const generateVerificationToken = (): string => {
  // Client-side crypto için basit bir yöntem
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

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
            // Profile oluşturma işlemini beklemeden yönlendir
            createOrUpdateProfile(session.user)
            // Giriş başarılı olursa hemen app sayfasına yönlendir
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
      
      // Loading state'ini başlat
      setLoading(true)
      
      // Önce kullanıcının var olup olmadığını kontrol et
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (existingUser) {
        setLoading(false)
        return { error: { message: 'Bu email adresi zaten kayıtlı.' } as AuthError }
      }
      
      // Supabase Auth ile kullanıcı oluştur (email confirmation disabled)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName || null,
            email_verified: false // Custom verification flag
          }
        }
      })

      console.log('Supabase response:', { data, error })
      
      if (error) {
        setLoading(false)
        return { error }
      }

      // Kullanıcı başarıyla oluşturulduysa custom email gönder
      if (data.user && !data.session) {
        try {
          // Custom verification token oluştur
          const verificationToken = generateVerificationToken()
          
          // Verification token'ı veritabanına kaydet
          await supabase
            .from('email_verifications')
            .insert({
              user_id: data.user.id,
              email: email.trim().toLowerCase(),
              token: verificationToken,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 saat
              created_at: new Date().toISOString()
            })

          // Custom email gönder
          const { EmailService } = await import('@/lib/email-template')
          const emailService = EmailService.getInstance()
          
          const verificationUrl = emailService.generateVerificationUrl(
            email.trim().toLowerCase(), 
            verificationToken
          )
          
          const emailData = emailService.createVerificationEmail(
            email.trim().toLowerCase(),
            verificationToken,
            fullName || undefined
          )

          const emailResult = await emailService.sendEmail(emailData)
          
          if (!emailResult.success) {
            console.error('Email gönderilemedi:', emailResult.error)
            // Email gönderilemese bile kullanıcı oluşturuldu, sadece log bas
          } else {
            console.log('Doğrulama emaili başarıyla gönderildi')
          }

        } catch (emailError) {
          console.error('Email gönderme hatası:', emailError)
          // Email hatası kullanıcı oluşturmayı engellemesin
        }
      }
      
      // Loading state'ini bitir
      setLoading(false)
      
      return { error }
    } catch (error) {
      console.error('Signup error:', error)
      setLoading(false)
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
      
      // Loading state'ini başlat
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      })

      console.log('Supabase sign in response:', { data, error })
      
      // Loading state'ini bitir (AuthContext'teki onAuthStateChange yönlendirmeyi yapacak)
      setLoading(false)
      
      return { error }
    } catch (error) {
      console.error('Signin error:', error)
      setLoading(false)
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