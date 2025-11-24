import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create clients if environment variables are available
let supabase: ReturnType<typeof createClient> | null = null
let supabaseAdmin: ReturnType<typeof createClient> | null = null

if (typeof window !== 'undefined') {
  // Client side - only use anon key
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'Accept': 'application/json'
        }
      }
    })
  }
} else {
  // Server side - can use service role key
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'Accept': 'application/json'
        }
      }
    })
  }
  if (supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'Accept': 'application/json'
        }
      }
    })
  }
}

export { supabase, supabaseAdmin }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_data: {
        Row: {
          id: string
          user_id: string
          data_type: 'accounts' | 'transactions' | 'recurring_transactions' | 'notes' | 'settings'
          data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          data_type: 'accounts' | 'transactions' | 'recurring_transactions' | 'notes' | 'settings'
          data: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          data_type?: 'accounts' | 'transactions' | 'recurring_transactions' | 'notes' | 'settings'
          data?: any
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}