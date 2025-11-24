/**
 * CepFinans - Kişisel Muhasebe Uygulaması
 * 
 * Bu dosya CepFinans uygulamasının ana sayfasıdır.
 * 
 * Özellikler:
 * - Hesap yönetimi (nakit, banka, birikim)
 * - İşlem takibi (gelir, gider, transfer)
 * - Tekrarlayan işlemler (günlük, haftalık, aylık, yıllık, özel)
 * - Grafikler ve raporlar
 * - Not defteri
 * - Veri senkronizasyonu (Supabase)
 * - Responsive tasarım
 * - Dark/Light tema desteği
 * - Türkçe dil desteği
 * 
 * @author CepFinans Team
 * @version 1.0.0
 * @since 2024
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, DollarSign, TrendingUp, TrendingDown, Plus, Wallet, PiggyBank, Building, Filter, Repeat, Settings, BarChart3, Target, AlertCircle, ArrowRightLeft, Clock, Timer, Shield, Smartphone, FileText, Download, Upload, Menu, X, ChevronRight, CheckCircle, LineChart as LineChartIcon, Mail, Send, CheckCircle2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { UserAuthButton } from '@/components/auth/UserAuthButton'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import { dataSync } from '@/lib/data-sync'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts'
import Link from 'next/link'
import EditRecurringDialog from '@/components/EditRecurringDialog'

interface Transaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  category: string
  description: string
  date: string
  account: 'cash' | 'bank' | 'savings'
  isRecurring?: boolean
  recurringId?: string
  transferFrom?: 'cash' | 'bank' | 'savings'
  transferTo?: 'cash' | 'bank' | 'savings'
}

interface RecurringTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  account: 'cash' | 'bank' | 'savings'
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  customFrequency?: string
  dayOfWeek?: number  // Haftalık için (1-7, 1=Pazartesi)
  startDate: string
  endDate?: string
  isActive: boolean
}

interface AccountBalances {
  cash: number
  bank: number
  savings: number
}

interface Note {
  id: string
  content: string
  date: string
  createdAt: string
  tags?: string[]
}

export default function CepFinansApp() {
  const { t } = useLanguage()
  const { user } = useAuth()
  
  // State yönetimi - performans için useCallback kullan
  const [balances, setBalances] = useState<AccountBalances>({ cash: 0, bank: 0, savings: 0 })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([])
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [loading, setLoading] = useState(true)
  
  // Modal state'leri - tek bir state'de toplamak
  const [modals, setModals] = useState({
    addTransaction: false,
    recurringDialog: false,
    contactDialog: false,
    transferDialog: false,
    statsDialog: false,
    editRecurringDialog: false,
    notesSection: false,
    noteDialog: false,
    allNotesDialog: false
  })
  
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const [noteFilter, setNoteFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  
  // Notlar state'i
  const [notes, setNotes] = useState<Note[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [noteTags, setNoteTags] = useState('')
  
  // İletişim form state'i
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    type: t('contact.suggestion')
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  

  // Modal açma/kapma fonksiyonları - performans için
  const openModal = (modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: true }))
  }

  const closeModal = (modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: false }))
  }

  // Verileri Supabase'den yükle - optimize edilmiş
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Sequential olarak verileri yükle (daha stabil)
        const balancesData = await dataSync.getBalances()
        const transactionsData = await dataSync.getTransactions()
        const recurringData = await dataSync.getRecurringTransactions()
        const notesData = await dataSync.getNotes()

        // State'leri aynı anda güncelle
        setBalances(balancesData || { cash: 0, bank: 0, savings: 0 })
        setTransactions(transactionsData || [])
        setRecurringTransactions(recurringData || [])
        setNotes(notesData || [])
        
        if (balancesData) {
          setIsFirstTime(false)
        }
      } catch (error) {
        console.error('Veriler yüklenirken hata:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  // Tekrarlayan işlemleri kontrol et - optimize edilmiş
  useEffect(() => {
    const checkAndApplyRecurringTransactions = () => {
      const today = new Date()
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()
      const currentDay = today.getDate()
      const currentWeekDay = today.getDay() // 0 = Pazar, 1 = Pazartesi
      const todayStr = today.toISOString().split('T')[0]

      // Sadece aktif işlemleri kontrol et
      const activeRecurring = recurringTransactions.filter(r => r.isActive)
      
      // Batch processing için optimize
      const transactionsToAdd = activeRecurring.filter(recurring => {
        let shouldApply = false

        switch (recurring.frequency) {
          case 'daily':
            shouldApply = true
            break
          case 'weekly':
            if (recurring.dayOfWeek) {
              const jsDayOfWeek = recurring.dayOfWeek === 7 ? 0 : recurring.dayOfWeek
              shouldApply = currentWeekDay === jsDayOfWeek
            }
            break
          case 'monthly':
            shouldApply = true
            break
          case 'yearly':
            shouldApply = true
            break
          case 'custom':
            shouldApply = true
            break
        }

        // Daha önce eklenmiş mi kontrol et
        if (shouldApply) {
          const alreadyApplied = transactions.some(t => 
            t.recurringId === recurring.id && 
            t.date.startsWith(todayStr)
          )
          return !alreadyApplied
        }
        
        return false
      })

      // Batch olarak işlemleri ekle
      if (transactionsToAdd.length > 0) {
        transactionsToAdd.forEach(recurring => {
          addTransaction({
            type: recurring.type,
            amount: recurring.amount,
            category: recurring.category,
            description: `${recurring.description} (Otomatik)`,
            account: recurring.account,
            date: today.toISOString(),
            isRecurring: true,
            recurringId: recurring.id
          })
        })
      }
    }

    // Debounce ile optimize et
    const timeoutId = setTimeout(checkAndApplyRecurringTransactions, 1000)
    return () => clearTimeout(timeoutId)
  }, [recurringTransactions, transactions])

  // Hesap ayarlarını yap - optimize edilmiş
  const handleInitialSetup = async (newBalances: AccountBalances) => {
    // Önce state'i güncelle (UX için)
    setBalances(newBalances)
    setIsFirstTime(false)
    
    // Arka planda veritabanına kaydet
    try {
      const balanceUpdated = await dataSync.updateBalances(newBalances)
      if (!balanceUpdated) {
        console.error('Bakiyeler kaydedilemedi, state geri alınıyor')
        // Hata durumunda state'i geri al ama kullanıcıyı bilgilendirme
        setBalances({ cash: 0, bank: 0, savings: 0 })
        setIsFirstTime(true)
      }
    } catch (error) {
      console.error('Bakiyeler kaydedilirken hata:', error)
      // Hata durumunda state'i geri al
      setBalances({ cash: 0, bank: 0, savings: 0 })
      setIsFirstTime(true)
    }
  }

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString()
    }
    
    console.log('🔄 addTransaction başlatılıyor:', newTransaction)
    console.log('📊 Mevcut bakiyeler:', balances)
    
    // Önce state'i güncelle
    setTransactions(prev => [newTransaction, ...prev])
    
    // Supabase'e kaydet
    try {
      console.log('💾 Supabase\'e transaction kaydediliyor...')
      const transactionAdded = await dataSync.addTransaction(newTransaction)
      console.log('✅ Transaction Supabase\'e kaydedildi:', transactionAdded)
      
      if (!transactionAdded) {
        console.error('❌ Transaction kaydedilemedi, state geri alınıyor')
        setTransactions(prev => prev.filter(t => t.id !== newTransaction.id))
        alert('İşlem kaydedilemedi. Lütfen tekrar deneyin.')
        return
      }
    } catch (error) {
      console.error('❌ Transaction kaydedilirken hata:', error)
      // Hata durumunda state'i geri al
      setTransactions(prev => prev.filter(t => t.id !== newTransaction.id))
      alert('İşlem kaydedilemedi. Lütfen tekrar deneyin.')
      return
    }
    
    // Bakiyeleri güncelleme kısmı
    console.log('💰 Bakiyeler güncelleniyor...')
    
    // Transfer işlemi ise bakiyeleri farklı güncelle
    if (transaction.type === 'transfer' && transaction.transferFrom && transaction.transferTo) {
      console.log('📤 Transfer işlemi tespit edildi')
      const newBalances = { ...balances }
      newBalances[transaction.transferFrom!] -= transaction.amount
      newBalances[transaction.transferTo!] += transaction.amount
      console.log('💰 Transfer sonrası bakiyeler:', newBalances)
      setBalances(newBalances)
      
      // Bakiyeleri Supabase'e kaydet (await ekle)
      console.log('💾 Transfer bakiyeleri Supabase\'e kaydediliyor...')
      const balanceUpdated = await dataSync.updateBalances(newBalances)
      console.log('✅ Transfer bakiyeleri Supabase\'e güncellendi:', balanceUpdated)
      if (!balanceUpdated) {
        console.error('❌ Bakiyeler güncellenemedi, state geri alınıyor')
        setBalances(balances) // Orijinal bakiyeleri geri al
        alert('Bakiyeler güncellenemedi. Lütfen tekrar deneyin.')
      }
    } else {
      console.log('📤 Normal gelir/gider işlemi tespit edildi')
      // Normal gelir/gider işlemi
      const newBalances = { ...balances }
      if (transaction.type === 'income') {
        newBalances[transaction.account] += transaction.amount
        console.log(`💰 Gelir eklendi: +${transaction.amount} -> ${transaction.account}`)
      } else if (transaction.type === 'expense') {
        newBalances[transaction.account] -= transaction.amount
        console.log(`💰 Gider eklendi: -${transaction.amount} -> ${transaction.account}`)
      }
      console.log('💰 İşlem sonrası bakiyeler:', newBalances)
      setBalances(newBalances)
      
      // Bakiyeleri Supabase'e kaydet (await ekle)
      console.log('💾 Normal bakiyeleri Supabase\'e kaydediliyor...')
      const balanceUpdated = await dataSync.updateBalances(newBalances)
      console.log('✅ Normal bakiyeler Supabase\'e güncellendi:', balanceUpdated)
      if (!balanceUpdated) {
        console.error('❌ Bakiyeler güncellenemedi, state geri alınıyor')
        setBalances(balances) // Orijinal bakiyeleri geri al
        alert('Bakiyeler güncellenemedi. Lütfen tekrar deneyin.')
      }
    }
    
    console.log('✅ addTransaction tamamlandı')
  }

  const addTransfer = (transfer: { from: 'cash' | 'bank' | 'savings', to: 'cash' | 'bank' | 'savings', amount: number, description: string }) => {
    addTransaction({
      type: 'transfer',
      amount: transfer.amount,
      category: 'Transfer',
      description: transfer.description,
      account: transfer.from,
      date: new Date().toISOString(),
      transferFrom: transfer.from,
      transferTo: transfer.to
    })
  }

  const getNextRecurringTransactions = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const currentDay = today.getDate()
    const currentWeekDay = today.getDay() // 0 = Pazar, 1 = Pazartesi

    return recurringTransactions
      .filter(r => r.isActive)
      .map(r => {
        let nextDate = new Date()
        
        switch (r.frequency) {
          case 'daily':
            nextDate = new Date(currentYear, currentMonth, currentDay + 1)
            break
          case 'weekly':
            if (r.dayOfWeek) {
              // JavaScript'te: 0=Pazar, 1=Pazartesi
              // Bizim sistemimizde: 1=Pazartesi, 7=Pazar
              const jsDayOfWeek = r.dayOfWeek === 7 ? 0 : r.dayOfWeek
              const daysUntilNext = (jsDayOfWeek - currentWeekDay + 7) % 7
              nextDate = new Date(currentYear, currentMonth, currentDay + daysUntilNext)
            }
            break
          case 'monthly':
            nextDate = new Date(currentYear, currentMonth + 1, currentDay)
            break
          case 'yearly':
            nextDate = new Date(currentYear + 1, currentMonth, currentDay)
            break
          case 'custom':
            // Özel periyot için bir sonraki tarihi hesaplamak karmaşık olabilir
            // Şimdilik bir ay sonraya ayarlayalım
            nextDate = new Date(currentYear, currentMonth + 1, currentDay)
            break
          default:
            nextDate = new Date(currentYear, currentMonth + 1, currentDay)
        }

        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        return {
          ...r,
          nextDate,
          daysUntil
        }
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }

  const addRecurringTransaction = async (recurring: Omit<RecurringTransaction, 'id'>) => {
    const newRecurring: RecurringTransaction = {
      ...recurring,
      id: Date.now().toString()
    }
    
    // Önce state'i güncelle
    setRecurringTransactions(prev => [...prev, newRecurring])
    
    // Supabase'e kaydet (await ekle)
    try {
      const recurringUpdated = await dataSync.addRecurringTransaction(newRecurring)
      if (!recurringUpdated) {
        console.error('Recurring transaction kaydedilemedi, state geri alınıyor')
        setRecurringTransactions(prev => prev.filter(r => r.id !== newRecurring.id))
        alert('Tekrarlayan işlem kaydedilemedi. Lütfen tekrar deneyin.')
      }
    } catch (error) {
      console.error('Recurring transaction kaydedilirken hata:', error)
      // Hata durumunda state'i geri al
      setRecurringTransactions(prev => prev.filter(r => r.id !== newRecurring.id))
      alert('Tekrarlayan işlem kaydedilemedi. Lütfen tekrar deneyin.')
    }
  }

  const handleEditRecurring = (recurring: RecurringTransaction) => {
    setEditingRecurring(recurring)
    setShowEditRecurringDialog(true)
  }

  const updateRecurringTransaction = async (updatedRecurring: RecurringTransaction) => {
    // Önce state'i güncelle
    setRecurringTransactions(prev => 
      prev.map(r => 
        r.id === updatedRecurring.id ? updatedRecurring : r
      )
    )
    
    // Supabase'e güncelle (await ekle)
    try {
      const recurringUpdated = await dataSync.updateRecurringTransaction(updatedRecurring)
      if (!recurringUpdated) {
        console.error('Recurring transaction güncellenemedi, state geri alınıyor')
        // Orijinal veriyi geri almak zorundayız ama bu karmaşık
        alert('Tekrarlayan işlem güncellenemedi. Lütfen tekrar deneyin.')
        return
      }
      
      setShowEditRecurringDialog(false)
      setEditingRecurring(null)
    } catch (error) {
      console.error('Recurring transaction güncellenirken hata:', error)
      alert('Tekrarlayan işlem güncellenemedi. Lütfen tekrar deneyin.')
    }
  }

  const totalBalance = balances.cash + balances.bank + balances.savings
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  
  const monthlyIncome = recurringTransactions
    .filter(r => r.type === 'income' && r.isActive)
    .reduce((sum, r) => sum + r.amount, 0)
  
  const monthlyExpense = recurringTransactions
    .filter(r => r.type === 'expense' && r.isActive)
    .reduce((sum, r) => sum + r.amount, 0)

  const upcomingTransactions = getNextRecurringTransactions()

  // Form verilerini güncelle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Formu Formspree ile gönder
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const form = e.target as HTMLFormElement
      const formData = new FormData(form)
      
      // Formspree'ye gönder
      const response = await fetch('https://formspree.io/f/mzzwpgar', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      
      if (response.ok) {
        setSubmitStatus('success')
        setTimeout(() => {
          setShowContactDialog(false)
          setSubmitStatus('idle')
          // Formu sıfırla
          setFormData({
            name: '',
            email: '',
            subject: '',
            message: '',
            type: 'Öneri'
          })
          form.reset()
        }, 2000)
      } else {
        throw new Error(t('contact.errorMessage'))
      }
      
    } catch (error) {
      console.error('Form gönderim hatası:', error)
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Not fonksiyonları
  const addNote = async () => {
    if (!noteContent.trim()) {
      alert('Lütfen bir not içeriği girin!')
      return
    }

    const newNote: Note = {
      id: Date.now().toString(),
      content: noteContent.trim(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      tags: noteTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    }

    // Önce state'i güncelle
    setNotes(prev => [newNote, ...prev])
    
    // Supabase'e kaydet (await ekle)
    try {
      const noteAdded = await dataSync.addNote(newNote)
      if (!noteAdded) {
        console.error('Not kaydedilemedi, state geri alınıyor')
        setNotes(prev => prev.filter(note => note.id !== newNote.id))
        alert('Not kaydedilemedi. Lütfen tekrar deneyin.')
        return
      }
      
      setNoteContent('')
      setNoteTags('')
      setShowNoteDialog(false)
    } catch (error) {
      console.error('Not kaydedilirken hata:', error)
      // Hata durumunda state'i geri al
      setNotes(prev => prev.filter(note => note.id !== newNote.id))
      alert('Not kaydedilemedi. Lütfen tekrar deneyin.')
    }
  }

  const deleteNote = async (noteId: string) => {
    if (confirm('Bu notu silmek istediğinizden emin misiniz?')) {
      // Supabase'den sil (await ekle)
      try {
        const noteDeleted = await dataSync.deleteNote(noteId)
        if (!noteDeleted) {
          console.error('Not silinemedi')
          alert('Not silinemedi. Lütfen tekrar deneyin.')
          return
        }
        
        // State'i güncelle (backend'den silindiği için)
        setNotes(prev => prev.filter(note => note.id !== noteId))
        console.log('Note successfully deleted from Supabase and state updated')
      } catch (error) {
        console.error('Not silinirken hata:', error)
        alert('Not silinemedi. Lütfen tekrar deneyin.')
      }
    }
  }

  const getFilteredNotes = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return notes.filter(note => {
      const noteDate = new Date(note.date)
      noteDate.setHours(0, 0, 0, 0)

      switch (noteFilter) {
        case 'today':
          return noteDate.getTime() === today.getTime()
        case 'week':
          const weekFromNow = new Date(today)
          weekFromNow.setDate(weekFromNow.getDate() + 7)
          return noteDate >= today && noteDate <= weekFromNow
        case 'month':
          const monthFromNow = new Date(today)
          monthFromNow.setMonth(monthFromNow.getMonth() + 1)
          return noteDate >= today && noteDate <= monthFromNow
        default:
          return true
      }
    })
  }

  // {t('app.monthlyDataPreparation')}
  const getMonthlyData = () => {
    const monthlyData: { ay: string; gelir: number; gider: number; net: number }[] = []
    const currentYear = new Date().getFullYear()
    
    // Son 6 ayın verilerini oluştur
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, new Date().getMonth() - i, 1)
      const monthName = date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
      
      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date)
        return transactionDate.getMonth() === date.getMonth() && 
               transactionDate.getFullYear() === date.getFullYear()
      })
      
      const gelir = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const gider = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      
      monthlyData.push({
        ay: monthName,
        gelir,
        gider,
        net: gelir - gider
      })
    }
    
    return monthlyData
  }

  // Kullanıcı giriş yapmamışsa yükleme göster
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Kullanıcı giriş yapmamışsa giriş sayfasına yönlendir
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Giriş Gerekli
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Bu sayfaya erişmek için giriş yapmanız gerekmektedir.
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
          >
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    )
  }

  if (isFirstTime) {
    return <InitialSetup onComplete={handleInitialSetup} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-4 md:p-6 pb-32">
        {/* Header */}
        <header className="mb-8 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
              <img 
                src="/favicon.png" 
                alt={t('app.title')} 
                className="w-12 h-12 rounded-xl shadow-sm"
              />
            </Link>
            <div>
              <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                  {t('app.title')}
                </h1>
              </Link>
              <p className="text-gray-600 dark:text-gray-400 text-lg">{t('app.modernPersonalFinance')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserAuthButton />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-green-500/10 border-green-500/20 dark:bg-green-900/20 dark:border-green-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">{t('app.totalBalance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-800 dark:text-green-200">₺{totalBalance.toFixed(2)}</div>
              <div className="flex items-center gap-2 mt-2 text-green-600 dark:text-green-400">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">{t('app.allAccounts')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-500/10 border-blue-500/20 dark:bg-blue-900/20 dark:border-blue-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('app.monthlyRecurringIncome')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-800 dark:text-blue-200">₺{monthlyIncome.toFixed(2)}</div>
              <div className="flex items-center gap-2 mt-2 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{recurringTransactions.filter(r => r.type === 'income' && r.isActive).length} gelir</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-500/10 border-red-500/20 dark:bg-red-900/20 dark:border-red-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">{t('app.monthlyRecurringExpense')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-800 dark:text-red-200">₺{monthlyExpense.toFixed(2)}</div>
              <div className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">{recurringTransactions.filter(r => r.type === 'expense' && r.isActive).length} gider</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-500/10 border-purple-500/20 dark:bg-purple-900/20 dark:border-purple-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">{t('app.monthlyNet')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-800 dark:text-purple-200">₺{(monthlyIncome - monthlyExpense).toFixed(2)}</div>
              <div className="flex items-center gap-2 mt-2 text-purple-600 dark:text-purple-400">
                <Target className="h-4 w-4" />
                <span className="text-sm">{t('app.estimatedSavings')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* {t('app.accountBalances')} */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('app.cash')}</CardTitle>
              <Wallet className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">₺{balances.cash.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('app.bank')}</CardTitle>
              <Building className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">₺{balances.bank.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('app.savings')}</CardTitle>
              <PiggyBank className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">₺{balances.savings.toFixed(2)}</div>
            </CardContent>
          </Card>

        </div>

        {/* {t('app.quickTransactions')} */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('app.addNewTransaction')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle>{t('app.addTransaction')}</DialogTitle>
                <DialogDescription>
                  {t('app.addTransactionDesc')}
                </DialogDescription>
              </DialogHeader>
              <AddTransactionForm onSubmit={addTransaction} onClose={() => setShowAddTransaction(false)} />
            </DialogContent>
          </Dialog>


          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white dark:bg-gray-800 border">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {t('app.transferTitle')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle>{t('app.transferBetweenAccounts')}</DialogTitle>
                <DialogDescription>
                  {t('app.transferDesc')}
                </DialogDescription>
              </DialogHeader>
              <TransferForm onSubmit={addTransfer} onClose={() => setShowTransferDialog(false)} balances={balances} />
            </DialogContent>
          </Dialog>

          <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white dark:bg-gray-800 border">
                <Repeat className="h-4 w-4 mr-2" />
                {t('app.addRecurring')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800 max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('app.addRecurring')}</DialogTitle>
                <DialogDescription>
                  {t('app.addRecurringDesc')}
                </DialogDescription>
              </DialogHeader>
              <RecurringTransactionForm onSubmit={addRecurringTransaction} onClose={() => setShowRecurringDialog(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* {t('app.upcomingTransactionsArea')} */}
        {upcomingTransactions.length > 0 && (
          <Card className="mb-8 bg-orange-500/10 border-orange-500/20 dark:bg-orange-900/20 dark:border-orange-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <Timer className="h-5 w-5" />
                {t('app.upcomingTransactions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingTransactions.slice(0, 6).map((transaction, index) => (
                  <div key={transaction.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'} className="text-xs">
                        {transaction.type === 'income' ? t('app.income') : t('app.expense')}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                          {transaction.daysUntil === 0 ? 'Bugün' : 
                           transaction.daysUntil === 1 ? 'Yarın' : 
                           `${transaction.daysUntil} gün`}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{transaction.category}</div>
                    {transaction.description && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{transaction.description}</div>
                    )}
                    <div className="text-sm font-bold mt-2 text-gray-900 dark:text-white">
                      {transaction.type === 'income' ? '+' : '-'}₺{transaction.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {transaction.nextDate.toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ana İçerik */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-gray-800 border">
            <TabsTrigger value="transactions">{t('app.transactions')}</TabsTrigger>
            <TabsTrigger value="recurring">{t('app.recurring')}</TabsTrigger>
            <TabsTrigger value="reports">{t('app.reports')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions">
            <TransactionList transactions={transactions} selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </TabsContent>
          
          <TabsContent value="recurring">
            <RecurringTransactionsList recurringTransactions={recurringTransactions} setRecurringTransactions={setRecurringTransactions} onEditRecurring={handleEditRecurring} />
          </TabsContent>
          
          <TabsContent value="reports">
            <DailyReports transactions={transactions} />
          </TabsContent>
        </Tabs>

        {/* İstatistikler Butonu */}
        <div className="mt-8 flex justify-center">
          <Button 
            onClick={() => setShowStatsDialog(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 text-lg font-medium shadow-lg transition-all duration-300 hover:scale-105"
          >
            <BarChart3 className="mr-2 w-5 h-5" />
            {t('app.viewStatistics')}
          </Button>
        </div>

        {/* İstatistikler Dialog */}
        <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
          <DialogContent className="bg-white dark:bg-gray-800 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-green-600" />
                {t('app.financialStatistics')}
              </DialogTitle>
              <DialogDescription>
                {t('app.incomeExpenseAnalysis')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-8 p-6">
              {/* {t('app.accountDistributionChart')} */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-green-600" />
                  {t('app.accountDistributionChart')}
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Nakit', value: balances.cash, color: '#10b981' },
                          { name: 'Banka', value: balances.bank, color: '#3b82f6' },
                          { name: 'Birikim', value: balances.savings, color: '#8b5cf6' }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Nakit', value: balances.cash, color: '#10b981' },
                          { name: 'Banka', value: balances.bank, color: '#3b82f6' },
                          { name: 'Birikim', value: balances.savings, color: '#8b5cf6' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₺${value.toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <div className="text-green-800 dark:text-green-200 font-semibold">{t('app.cash')}</div>
                    <div className="text-green-600 dark:text-green-400 text-xl font-bold">₺{balances.cash.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-blue-800 dark:text-blue-200 font-semibold">{t('app.bank')}</div>
                    <div className="text-blue-600 dark:text-blue-400 text-xl font-bold">₺{balances.bank.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-purple-800 dark:text-purple-200 font-semibold">{t('app.savings')}</div>
                    <div className="text-purple-600 dark:text-purple-400 text-xl font-bold">₺{balances.savings.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* {t('app.incomeExpenseChart')} */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-green-600" />
                  {t('app.incomeExpenseChart')}
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      {name: t('app.totalIncomeReport'), gelir: totalIncome, gider: 0},
                      {name: t('app.totalExpenseReport'), gelir: 0, gider: totalExpense}
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `₺${value.toFixed(2)}`} />
                      <Legend />
                      <Bar dataKey="gelir" fill="#10b981" />
                      <Bar dataKey="gider" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <div className="text-green-800 dark:text-green-200 font-semibold">{t('app.totalIncomeReport')}</div>
                    <div className="text-green-600 dark:text-green-400 text-xl font-bold">₺{totalIncome.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <div className="text-red-800 dark:text-red-200 font-semibold">{t('app.totalExpenseReport')}</div>
                    <div className="text-red-600 dark:text-red-400 text-xl font-bold">₺{totalExpense.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* {t('app.monthlySpendingTrendReport')} */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  {t('app.monthlySpendingTrendReport')}
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getMonthlyData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ay" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `₺${value.toFixed(2)}`} />
                      <Legend />
                      <Line type="monotone" dataKey="gelir" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="gider" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* İletişim Bölümü */}
        <div className="mt-8 flex justify-center">
          <Button 
            onClick={() => setShowContactDialog(true)}
            variant="outline"
            className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-105"
          >
            <Mail className="mr-2 w-4 h-4" />
            İletişim
          </Button>
        </div>
      </div>

      {/* Notlar Bölümü */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40">
        <div className="max-w-6xl mx-auto">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setShowNotesSection(!showNotesSection)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('app.notes')}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {notes.length} not • {getFilteredNotes().length} gösteriliyor
                </p>
              </div>
            </div>
            <ChevronRight 
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${
                showNotesSection ? 'rotate-90' : ''
              }`}
            />
          </div>
          
          {showNotesSection && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
              <div className="flex gap-3 mb-4">
                <Button
                  onClick={() => setShowNoteDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('app.writeNote')}
                </Button>
                <Button
                  onClick={() => setShowAllNotesDialog(true)}
                  variant="outline"
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {t('app.allNotes')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer için boşluk - Notlar bölümü ile çakışmayı önlemek için */}
      <div className="h-20"></div>

      {/* Not Ekleme Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('app.newNote')}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNoteDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Not İçeriği *
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Bugün ne düşündünüz? Ne yapmayı planlıyorsunuz?"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Etiketler (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    placeholder="iş, kişisel, önemli, virgülle ayırın..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 justify-end mt-6">
                  <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNoteDialog(false)}
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {t('app.cancel')}
                </Button>
                <Button
                  onClick={addNote}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {t('app.saveNoteButton')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tüm Notlar Dialog */}
      {showAllNotesDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t('app.allNotesWithCount', { count: getFilteredNotes().length })}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAllNotesDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              {/* Filtreleme Butonları */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={noteFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setNoteFilter('all')}
                  size="sm"
                  className="text-xs"
                >
                  {t('app.allFilter')}
                </Button>
                <Button
                  variant={noteFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setNoteFilter('today')}
                  size="sm"
                  className="text-xs"
                >
                  Bugün
                </Button>
                <Button
                  variant={noteFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setNoteFilter('week')}
                  size="sm"
                  className="text-xs"
                >
                  Bu Hafta
                </Button>
                <Button
                  variant={noteFilter === 'month' ? 'default' : 'outline'}
                  onClick={() => setNoteFilter('month')}
                  size="sm"
                  className="text-xs"
                >
                  Bu Ay
                </Button>
              </div>
              
              {/* Notlar Listesi */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getFilteredNotes().length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>Seçilen filtreye uygun not bulunamadı.</p>
                  </div>
                ) : (
                  getFilteredNotes().map((note) => (
                    <div key={note.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{note.content}</p>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {note.tags.map((tag, index) => (
                                <span key={index} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNote(note.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(note.date).toLocaleDateString('tr-TR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200 dark:border-gray-800 mt-16">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              CepFinans
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {t('app.footer')}
          </p>
        </div>
      </footer>

      {/* İletişim Dialog */}
      {showContactDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  İletişim
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowContactDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Durum Mesajı */}
                {submitStatus === 'success' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      Mesajınız başarıyla gönderildi! En kısa sürede yanıtlanacaktır.
                    </span>
                  </div>
                )}
                
                {submitStatus === 'error' && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 dark:text-red-200 font-medium">
                      Form gönderilemedi. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.
                    </span>
                  </div>
                )}
                
                {/* Form Alanları */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ad Soyad *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder={t('contact.namePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        E-posta *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder={t('contact.emailPlaceholder')}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Konu *
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder={t('contact.subjectPlaceholder')}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mesaj Türü *
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="Öneri">Öneri</option>
                      <option value="Şikayet">Şikayet</option>
                      <option value="Hata Bildirimi">Hata Bildirimi</option>
                      <option value="Özellik Talebi">Özellik Talebi</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Mesajınız *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                      placeholder={t('contact.messagePlaceholder')}
                    />
                  </div>
                </div>
                
                {/* Bilgilendirme */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-blue-800 dark:text-blue-200 text-sm">
                      <p className="font-medium mb-1">Form Gönderim Süreci:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Formu gönderdiğinizde Formspree üzerinden mail olarak iletilir</li>
                        <li>• Tüm bilgiler güvenli bir şekilde şifrelenir</li>
                        <li>• Form gönderim başarısız olursa hata mesajı alırsınız</li>
                        <li>• Mesajlarınız en kısa sürede yanıtlanacaktır</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Butonlar */}
                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowContactDialog(false)}
                    disabled={isSubmitting}
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-105"
                  >
                    İptal
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 flex items-center gap-2 transition-all duration-300 hover:scale-105"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Gönder
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme Dialog */}
      {showEditRecurringDialog && editingRecurring && (
        <EditRecurringDialog
          recurring={editingRecurring}
          onSave={updateRecurringTransaction}
          onCancel={() => {
            setShowEditRecurringDialog(false)
            setEditingRecurring(null)
          }}
        />
      )}
    </div>
  )
}

function InitialSetup({ onComplete }: { onComplete: (balances: AccountBalances) => void }) {
  const { t } = useLanguage()
  const [balances, setBalances] = useState<AccountBalances>({ cash: 0, bank: 0, savings: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await onComplete(balances)
      setShowSuccess(true)
      
      // 2 saniye sonra başarı ekranını gizle ve yönlendir
      setTimeout(() => {
        setShowSuccess(false)
        setIsLoading(false)
      }, 2000)
    } catch (error) {
      console.error('Setup error:', error)
      setIsLoading(false)
      alert('Bakiyeler kaydedilemedi. Lütfen tekrar deneyin.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      {showSuccess ? (
        <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-sm border">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Başarılı!
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Hesap bakiyeleriniz başarıyla kaydedildi. Yönlendiriliyorsunuz...
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-sm border">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('app.initialSetup')}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {t('app.initialSetupDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cash" className="text-sm font-medium">Nakit Bakiye</Label>
                <Input
                  id="cash"
                  type="number"
                  step="0.01"
                  value={balances.cash}
                  onChange={(e) => setBalances(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="bank" className="text-sm font-medium">Banka Bakiye</Label>
                <Input
                  id="bank"
                  type="number"
                  step="0.01"
                  value={balances.bank}
                  onChange={(e) => setBalances(prev => ({ ...prev, bank: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="savings" className="text-sm font-medium">Birikim Bakiye</Label>
                <Input
                  id="savings"
                  type="number"
                  step="0.01"
                  value={balances.savings}
                  onChange={(e) => setBalances(prev => ({ ...prev, savings: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Kaydediliyor...
                  </div>
                ) : (
                  'Başla'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TransferForm({ 
  onSubmit, 
  onClose,
  balances 
}: { 
  onSubmit: (transfer: { from: 'cash' | 'bank' | 'savings', to: 'cash' | 'bank' | 'savings', amount: number, description: string }) => void
  onClose: () => void
  balances: AccountBalances
}) {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    from: 'cash' as 'cash' | 'bank' | 'savings',
    to: 'bank' as 'cash' | 'bank' | 'savings',
    amount: '',
    description: ''
  })

  const accounts = [
    { value: 'cash', label: t('app.cash'), icon: Wallet, balance: balances.cash },
    { value: 'bank', label: t('app.bank'), icon: Building, balance: balances.bank },
    { value: 'savings', label: t('app.savings'), icon: PiggyBank, balance: balances.savings }
  ]

  const availableToAccounts = accounts.filter(acc => acc.value !== formData.from)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || parseFloat(formData.amount) <= 0) return

    const amount = parseFloat(formData.amount)
    if (amount > balances[formData.from]) {
      alert(t('app.insufficientBalance'))
      return
    }

    onSubmit({
      from: formData.from,
      to: formData.to,
      amount,
      description: formData.description || `${formData.from} → ${formData.to} ${t('app.moneyTransfer')}`
    })

    setFormData({
      from: 'cash',
      to: 'bank',
      amount: '',
      description: ''
    })
    onClose()
  }

  const fromAccount = accounts.find(acc => acc.value === formData.from)
  const toAccount = accounts.find(acc => acc.value === formData.to)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>{t('app.transferFrom')}</Label>
        <Select value={formData.from} onValueChange={(value: 'cash' | 'bank' | 'savings') => 
          setFormData(prev => ({ ...prev, from: value, to: value === prev.to ? 'cash' : prev.to }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.value} value={account.value}>
                <div className="flex items-center gap-2">
                  <account.icon className="h-4 w-4" />
                  <span>{account.label}</span>
                  <span className="text-sm text-gray-500">(₺{account.balance.toFixed(2)})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.transferTo')}</Label>
        <Select value={formData.to} onValueChange={(value: 'cash' | 'bank' | 'savings') => 
          setFormData(prev => ({ ...prev, to: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableToAccounts.map(account => (
              <SelectItem key={account.value} value={account.value}>
                <div className="flex items-center gap-2">
                  <account.icon className="h-4 w-4" />
                  <span>{account.label}</span>
                  <span className="text-sm text-gray-500">(₺{account.balance.toFixed(2)})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.amount')}</Label>
        <Input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          placeholder="0.00"
          max={balances[formData.from]}
          required
        />
        {fromAccount && (
          <p className="text-xs text-gray-500 mt-1">
            {t('app.currentBalance')}: ₺{fromAccount.balance.toFixed(2)}
          </p>
        )}
      </div>

      <div>
        <Label>{t('app.description')}</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('app.optional')}
        />
      </div>

      {fromAccount && toAccount && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <fromAccount.icon className="h-4 w-4" />
              <span>{fromAccount.label}</span>
            </div>
            <span className="font-medium">-₺{formData.amount || '0.00'}</span>
          </div>
          <div className="flex items-center justify-center my-2">
            <ArrowRightLeft className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <toAccount.icon className="h-4 w-4" />
              <span>{toAccount.label}</span>
            </div>
            <span className="font-medium text-green-600">+₺{formData.amount || '0.00'}</span>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
        {t('app.doTransfer')}
      </Button>
    </form>
  )
}

function AddTransactionForm({ 
  onSubmit, 
  onClose 
}: { 
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    account: 'cash' as 'cash' | 'bank' | 'savings'
  })

  const categories = {
    income: ['Maaş', 'Ek Gelir', 'Yatırım', 'Hediye', 'Kira Geliri', 'Diğer'],
    expense: ['Gıda', 'Ulaşım', 'Eğlence', 'Faturalar', 'Alışveriş', 'Sağlık', 'Eğitim', 'Kira', 'Diğer']
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.category) return

    onSubmit({
      type: formData.type,
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      account: formData.account,
      date: new Date().toISOString()
    })

    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      account: 'cash'
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>{t('app.transactionType')}</Label>
        <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => 
          setFormData(prev => ({ ...prev, type: value, category: '' }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Gelir</SelectItem>
            <SelectItem value="expense">Gider</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.amount')}</Label>
        <Input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <Label>{t('app.transactionCategory')}</Label>
        <Select value={formData.category} onValueChange={(value) => 
          setFormData(prev => ({ ...prev, category: value }))
        }>
          <SelectTrigger>
            <SelectValue placeholder={t('app.selectCategory')} />
          </SelectTrigger>
          <SelectContent>
            {categories[formData.type].map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.account')}</Label>
        <Select value={formData.account} onValueChange={(value: 'cash' | 'bank' | 'savings') => 
          setFormData(prev => ({ ...prev, account: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Nakit</SelectItem>
            <SelectItem value="bank">Banka</SelectItem>
            <SelectItem value="savings">Birikim</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.description')}</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('app.optional')}
        />
      </div>

      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
        İşlemi Ekle
      </Button>
    </form>
  )
}

function RecurringTransactionForm({ 
  onSubmit, 
  onClose 
}: { 
  onSubmit: (recurring: Omit<RecurringTransaction, 'id'>) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    category: '',
    description: '',
    account: 'cash' as 'cash' | 'bank' | 'savings',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
    customFrequency: '',
    dayOfWeek: 1, // Haftalık için (1-7, 1=Pazartesi)
    startDate: new Date().toISOString().split('T')[0]
  })

  const categories = {
    income: ['Maaş', 'Ek Gelir', 'Yatırım', 'Hediye', 'Kira Geliri', 'Diğer'],
    expense: ['Kira', 'Faturalar', 'Sigorta', 'Eğitim', 'Diğer']
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasyon
    if (formData.frequency === 'custom' && !formData.customFrequency.trim()) {
      alert('Özel periyot seçildiğinde periyot açıklaması zorunludur.')
      return
    }
    
    if (!formData.amount || !formData.category) return

    onSubmit({
      type: formData.type,
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      account: formData.account,
      frequency: formData.frequency,
      customFrequency: formData.frequency === 'custom' ? formData.customFrequency : undefined,
      dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : undefined,
      startDate: formData.startDate,
      isActive: true
    })

    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      account: 'cash',
      frequency: 'monthly',
      customFrequency: '',
      dayOfWeek: 1,
      startDate: new Date().toISOString().split('T')[0]
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('app.transactionType')}</Label>
          <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => 
            setFormData(prev => ({ ...prev, type: value, category: '' }))
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">{t('app.income')}</SelectItem>
              <SelectItem value="expense">{t('app.expense')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('app.recurringFrequency')}</Label>
          <Select value={formData.frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom') => 
            setFormData(prev => ({ ...prev, frequency: value }))
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Günlük</SelectItem>
              <SelectItem value="weekly">Haftalık</SelectItem>
              <SelectItem value="monthly">{t('app.monthly')}</SelectItem>
              <SelectItem value="yearly">{t('app.yearly')}</SelectItem>
              <SelectItem value="custom">Diğer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>{t('app.amount')}</Label>
        <Input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <Label>{t('app.transactionCategory')}</Label>
        <Select value={formData.category} onValueChange={(value) => 
          setFormData(prev => ({ ...prev, category: value }))
        }>
          <SelectTrigger>
            <SelectValue placeholder={t('app.selectCategory')} />
          </SelectTrigger>
          <SelectContent>
            {categories[formData.type].map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {formData.frequency === 'weekly' && (
          <div>
            <Label>Haftanın Günü</Label>
            <Select value={formData.dayOfWeek.toString()} onValueChange={(value) => 
              setFormData(prev => ({ ...prev, dayOfWeek: parseInt(value) || 1 }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Pazartesi</SelectItem>
                <SelectItem value="2">Salı</SelectItem>
                <SelectItem value="3">Çarşamba</SelectItem>
                <SelectItem value="4">Perşembe</SelectItem>
                <SelectItem value="5">Cuma</SelectItem>
                <SelectItem value="6">Cumartesi</SelectItem>
                <SelectItem value="7">Pazar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {formData.frequency === 'custom' && (
          <div className="col-span-2">
            <Label>Özel Periyot</Label>
            <Input
              type="text"
              value={formData.customFrequency}
              onChange={(e) => setFormData(prev => ({ ...prev, customFrequency: e.target.value }))}
              placeholder="Örn: 15 günde bir, 2 ayda bir"
              required
            />
          </div>
        )}
      </div>

      <div>
        <Label>{t('app.account')}</Label>
        <Select value={formData.account} onValueChange={(value: 'cash' | 'bank' | 'savings') => 
          setFormData(prev => ({ ...prev, account: value }))
        }>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Nakit</SelectItem>
            <SelectItem value="bank">Banka</SelectItem>
            <SelectItem value="savings">Birikim</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('app.description')}</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Örn: Ev kirası, Araba taksiti"
        />
      </div>

      <div>
        <Label>{t('app.startDate')}</Label>
        <Input
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
        />
      </div>

      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
        {t('app.addRecurringTransaction')}
      </Button>
    </form>
  )
}

function TransactionList({ 
  transactions, 
  selectedDate, 
  onDateChange 
}: { 
  transactions: Transaction[]
  selectedDate: string
  onDateChange: (date: string) => void
}) {
  const { t } = useLanguage()
  const uniqueDates = Array.from(new Set(
    transactions.map(t => new Date(t.date).toLocaleDateString('tr-TR'))
  )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  const filteredTransactions = selectedDate === 'all' 
    ? transactions 
    : transactions.filter(t => new Date(t.date).toLocaleDateString('tr-TR') === selectedDate)

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{t('app.transactions')}</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={selectedDate} onValueChange={onDateChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('app.all')}</SelectItem>
                {uniqueDates.map(date => (
                  <SelectItem key={date} value={date}>{date}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {selectedDate === 'all' ? t('app.noTransactions') : t('app.noTransactionsForDate')}
            </p>
          ) : (
            filteredTransactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      transaction.type === 'income' ? 'default' : 
                      transaction.type === 'expense' ? 'destructive' : 
                      'secondary'
                    }>
                      {transaction.type === 'income' ? t('app.income') : 
                       transaction.type === 'expense' ? t('app.expense') : 'Transfer'}
                    </Badge>
                    {transaction.isRecurring && (
                      <Badge variant="outline" className="text-xs">
                        <Repeat className="h-3 w-3 mr-1" />
                        Otomatik
                      </Badge>
                    )}
                    <span className="font-medium">{transaction.category}</span>
                  </div>
                  {transaction.type === 'transfer' && transaction.transferFrom && transaction.transferTo && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {transaction.transferFrom === 'cash' ? 'Nakit' : 
                       transaction.transferFrom === 'bank' ? 'Banka' : 'Birikim'} → 
                      {transaction.transferTo === 'cash' ? ' Nakit' : 
                       transaction.transferTo === 'bank' ? ' Banka' : ' Birikim'}
                    </p>
                  )}
                  {transaction.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {transaction.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(transaction.date).toLocaleDateString('tr-TR')}
                    {transaction.type !== 'transfer' && (
                      <> • 
                      {transaction.account === 'cash' ? ' Nakit' : 
                       transaction.account === 'bank' ? ' Banka' : ' Birikim'}
                      </>
                    )}
                  </p>
                </div>
                <div className={`text-lg font-bold ${
                  transaction.type === 'income' ? 'text-green-600' : 
                  transaction.type === 'expense' ? 'text-red-600' : 
                  'text-blue-600'
                }`}>
                  {transaction.type === 'income' ? '+' : 
                   transaction.type === 'expense' ? '-' : '→'}₺{transaction.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RecurringTransactionsList({ recurringTransactions, setRecurringTransactions, onEditRecurring }: { 
  recurringTransactions: RecurringTransaction[]
  setRecurringTransactions: React.Dispatch<React.SetStateAction<RecurringTransaction[]>>
  onEditRecurring: (recurring: RecurringTransaction) => void
}) {
  const { t } = useLanguage()
  const toggleRecurring = (id: string) => {
    setRecurringTransactions(prev => 
      prev.map(r => 
        r.id === id ? { ...r, isActive: !r.isActive } : r
      )
    )
  }

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" />
          {t('app.recurringTransactions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {recurringTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('app.noRecurringTransactions')}</p>
          ) : (
            recurringTransactions.map(recurring => (
              <div key={recurring.id} className={`p-4 rounded-lg ${
                recurring.isActive 
                  ? 'bg-gray-50 dark:bg-gray-700' 
                  : 'bg-gray-100 dark:bg-gray-600 opacity-60'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={recurring.type === 'income' ? 'default' : 'destructive'}>
                        {recurring.type === 'income' ? t('app.income') : t('app.expense')}
                      </Badge>
                      <span className="font-medium">{recurring.category}</span>
                      {!recurring.isActive && (
                        <Badge variant="outline" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pasif
                        </Badge>
                      )}
                    </div>
                    {recurring.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {recurring.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {recurring.frequency === 'monthly' 
                        ? `Her ayın ${recurring.dayOfMonth}. günü` 
                        : `Her yıl ${recurring.monthOfYear}. ayın ${recurring.dayOfMonth}. günü`
                      } • 
                      {recurring.account === 'cash' ? ' Nakit' : 
                       recurring.account === 'bank' ? ' Banka' : ' Birikim'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`text-lg font-bold ${
                      recurring.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {recurring.type === 'income' ? '+' : '-'}₺{recurring.amount.toFixed(2)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRecurring(recurring.id)}
                      >
                        {recurring.isActive ? 'Pasif Et' : 'Aktif Et'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditRecurring(recurring)}
                      >
                        Düzenle
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DailyReports({ transactions }: { transactions: Transaction[] }) {
  const { t } = useLanguage()
  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date).toLocaleDateString('tr-TR')
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(transaction)
    return acc
  }, {} as Record<string, Transaction[]>)

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {t('app.dailyReports')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {sortedDates.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('app.noReports')}</p>
          ) : (
            sortedDates.map(date => {
              const dayTransactions = groupedTransactions[date]
              const dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0)
              const dayExpense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
              const netAmount = dayIncome - dayExpense

              return (
                <div key={date} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {date}
                    </h3>
                    <div className={`font-bold ${
                      netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {netAmount >= 0 ? '+' : ''}₺{netAmount.toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Gelir:</span>
                      <span className="ml-2 text-green-600 font-medium">₺{dayIncome.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Gider:</span>
                      <span className="ml-2 text-red-600 font-medium">₺{dayExpense.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {dayTransactions.length} işlem
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default CepFinansApp
}