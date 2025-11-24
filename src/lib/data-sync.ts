import { supabase } from './supabase'

// Basit veri senkronizasyon fonksiyonları
export const dataSync = {
  // Mevcut kullanıcı ID'sini al
  async getCurrentUserId() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        console.error('Error getting current user:', error)
        return null
      }
      return user.id
    } catch (error) {
      console.error('Error in getCurrentUserId:', error)
      return null
    }
  },

  // Bakiyeleri getir
  async getBalances() {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) return { cash: 0, bank: 0, savings: 0 }

      const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .eq('data_type', 'accounts')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No balances found for user, returning defaults')
          return { cash: 0, bank: 0, savings: 0 }
        }
        console.error('Error getting balances:', error)
        return { cash: 0, bank: 0, savings: 0 }
      }

      console.log('Balances retrieved from Supabase:', data?.data)
      return data?.data || { cash: 0, bank: 0, savings: 0 }
    } catch (error) {
      console.error('Error in getBalances:', error)
      return { cash: 0, bank: 0, savings: 0 }
    }
  },

  // Bakiyeleri güncelle
  async updateBalances(balances: any) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for updating balances')
        return false
      }

      console.log('Updating balances in Supabase:', balances)

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'accounts',
          data: balances,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error updating balances:', error)
        return false
      }

      console.log('Balances successfully updated in Supabase')
      return true
    } catch (error) {
      console.error('Error in updateBalances:', error)
      return false
    }
  },

  // İşlemleri getir
  async getTransactions() {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) return []

      const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .eq('data_type', 'transactions')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No transactions found for user')
          return []
        }
        console.error('Error getting transactions:', error)
        return []
      }

      console.log('Transactions retrieved from Supabase:', data?.data?.length || 0)
      return data?.data || []
    } catch (error) {
      console.error('Error in getTransactions:', error)
      return []
    }
  },

  // İşlem ekle
  async addTransaction(transaction: any) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for adding transaction')
        return false
      }

      console.log('Adding transaction to Supabase:', transaction)

      // Mevcut işlemleri getir
      const existingTransactions = await this.getTransactions()
      
      // Aynı ID'ye sahip işlem var mı kontrol et
      const duplicateTransaction = existingTransactions.find(t => 
        t.id === transaction.id || 
        (t.type === transaction.type && 
         t.amount === transaction.amount && 
         t.category === transaction.category && 
         t.account === transaction.account && 
         t.date === transaction.date)
      )

      if (duplicateTransaction) {
        console.error('Duplicate transaction found, not adding:', transaction)
        return false
      }

      const updatedTransactions = [transaction, ...existingTransactions]

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'transactions',
          data: updatedTransactions,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error adding transaction:', error)
        return false
      }

      console.log('Transaction successfully added to Supabase')
      return true
    } catch (error) {
      console.error('Error in addTransaction:', error)
      return false
    }
  },

  // Tekrarlayan işlemleri getir
  async getRecurringTransactions() {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) return []

      const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .eq('data_type', 'recurring_transactions')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No recurring transactions found for user')
          return []
        }
        console.error('Error getting recurring transactions:', error)
        return []
      }

      console.log('Recurring transactions retrieved from Supabase:', data?.data?.length || 0)
      return data?.data || []
    } catch (error) {
      console.error('Error in getRecurringTransactions:', error)
      return []
    }
  },

  // Tekrarlayan işlem ekle
  async addRecurringTransaction(recurring: any) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for adding recurring transaction')
        return false
      }

      console.log('Adding recurring transaction to Supabase:', recurring)

      // Mevcut işlemleri getir
      const existingRecurring = await this.getRecurringTransactions()
      
      // Aynı ID'ye sahip işlem var mı kontrol et
      const duplicateRecurring = existingRecurring.find(r => 
        r.id === recurring.id || 
        (r.type === recurring.type && 
         r.amount === recurring.amount && 
         r.category === recurring.category && 
         r.account === recurring.account && 
         r.frequency === recurring.frequency && 
         r.dayOfMonth === recurring.dayOfMonth && 
         r.startDate === recurring.startDate)
      )

      if (duplicateRecurring) {
        console.error('Duplicate recurring transaction found, not adding:', recurring)
        return false
      }

      const updatedRecurring = [recurring, ...existingRecurring]

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'recurring_transactions',
          data: updatedRecurring,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error adding recurring transaction:', error)
        return false
      }

      console.log('Recurring transaction successfully added to Supabase')
      return true
    } catch (error) {
      console.error('Error in addRecurringTransaction:', error)
      return false
    }
  },

  // Tekrarlayan işlem güncelle
  async updateRecurringTransaction(updatedRecurring: any) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for updating recurring transaction')
        return false
      }

      console.log('Updating recurring transaction in Supabase:', updatedRecurring)

      // Mevcut işlemleri getir ve güncelle
      const existingRecurring = await this.getRecurringTransactions()
      const updatedRecurring = existingRecurring.map(r => 
        r.id === updatedRecurring.id ? updatedRecurring : r
      )

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'recurring_transactions',
          data: updatedRecurring,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error updating recurring transaction:', error)
        return false
      }

      console.log('Recurring transaction successfully updated in Supabase')
      return true
    } catch (error) {
      console.error('Error in updateRecurringTransaction:', error)
      return false
    }
  },

  // Notları getir
  async getNotes() {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) return []

      const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .eq('data_type', 'notes')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No notes found for user')
          return []
        }
        console.error('Error getting notes:', error)
        return []
      }

      console.log('Notes retrieved from Supabase:', data?.data?.length || 0)
      return data?.data || []
    } catch (error) {
      console.error('Error in getNotes:', error)
      return []
    }
  },

  // Not ekle
  async addNote(note: any) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for adding note')
        return false
      }

      console.log('Adding note to Supabase:', note)

      // Mevcut notları getir
      const existingNotes = await this.getNotes()
      
      // Aynı ID'ye sahip not var mı kontrol et
      const duplicateNote = existingNotes.find(n => 
        n.id === note.id || 
        (n.content === note.content && n.createdAt === note.createdAt)
      )

      if (duplicateNote) {
        console.error('Duplicate note found, not adding:', note)
        return false
      }

      const updatedNotes = [note, ...existingNotes]

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'notes',
          data: updatedNotes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error adding note:', error)
        return false
      }

      console.log('Note successfully added to Supabase')
      return true
    } catch (error) {
      console.error('Error in addNote:', error)
      return false
    }
  },

  // Not sil
  async deleteNote(noteId: string) {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) {
        console.error('No user ID found for deleting note')
        return false
      }

      console.log('Deleting note from Supabase:', noteId)

      // Mevcut notları getir ve sil
      const existingNotes = await this.getNotes()
      const updatedNotes = existingNotes.filter(note => note.id !== noteId)

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          data_type: 'notes',
          data: updatedNotes,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,data_type'
        })

      if (error) {
        console.error('Error deleting note:', error)
        return false
      }

      console.log('Note successfully deleted from Supabase')
      return true
    } catch (error) {
      console.error('Error in deleteNote:', error)
      return false
    }
  }
}