'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Send, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setMessage('Lütfen email adresinizi girin')
      setMessageType('error')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setMessage('Lütfen geçerli bir email adresi girin')
      setMessageType('error')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/email/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage('Doğrulama emaili başarıyla gönderildi! Lütfen email kutunuzu kontrol edin.')
        setMessageType('success')
        setEmail('')
      } else {
        setMessage(data.error || 'Email gönderilemedi. Lütfen daha sonra tekrar deneyin.')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Resend error:', error)
      setMessage('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            Doğrulama Emaili Tekrar Gönder
          </CardTitle>
          <CardDescription>
            Email doğrulama linkini almadıysanız, yeni bir tane isteyebilirsiniz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Adresi</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {message && (
              <div className={`text-center p-3 rounded-lg text-sm ${
                messageType === 'success' 
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                  : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              }`}>
                {message}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Email Gönder
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-4 border-t">
            <Button 
              variant="ghost" 
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ana Sayfaya Dön
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Not:</strong> Emailiniz spam klasöründe olabilir.
            </p>
            <p>
              Lütfen "destek@cepfinans.com" adresini güvenli olarak işaretleyin.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}