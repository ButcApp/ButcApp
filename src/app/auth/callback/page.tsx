'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const token = searchParams.get('token')
        const email = searchParams.get('email')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Eğer URL'de error varsa (legacy support)
        if (error) {
          setStatus('error')
          setMessage(errorDescription || 'Doğrulama sırasında bir hata oluştu.')
          return
        }

        // Custom token doğrulama
        if (token && email) {
          if (!supabase) {
            setStatus('error')
            setMessage('Supabase bağlantısı kurulamadı.')
            return
          }

          // Token'ı veritabanında kontrol et
          const { data: verificationData, error: verificationError } = await supabase
            .from('email_verifications')
            .select('*')
            .eq('token', token)
            .eq('email', email)
            .is('usedAt', null)
            .single()

          if (verificationError || !verificationData) {
            setStatus('error')
            setMessage('Geçersiz veya kullanılmış doğrulama linki.')
            return
          }

          // Token'ın süresi dolmuş mu kontrol et
          const expiresAt = new Date(verificationData.expiresAt)
          if (expiresAt < new Date()) {
            setStatus('error')
            setMessage('Doğrulama linkinin süresi dolmuş. Lütfen yeni bir doğrulama emaili isteyin.')
            return
          }

          // Kullanıcıyı Supabase'te bul ve email_confirmed_at'ı güncelle
          const { data: userData, error: userError } = await supabase.auth.admin.updateUserById(
            verificationData.userId,
            { email_confirm: true }
          )

          if (userError) {
            console.error('User update error:', userError)
            setStatus('error')
            setMessage('Kullanıcı bilgileri güncellenemedi: ' + userError.message)
            return
          }

          // Token'ı kullanıldı olarak işaretle
          await supabase
            .from('email_verifications')
            .update({ usedAt: new Date().toISOString() })
            .eq('id', verificationData.id)

          setStatus('success')
          setMessage('Email adresiniz başarıyla doğrulandı! Yönlendiriliyorsunuz...')
          
          // 3 saniye sonra ana sayfaya yönlendir
          setTimeout(() => {
            router.push('/app')
          }, 3000)

          return
        }

        // Legacy support - Eğer access_token varsa
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // Session'ı token'larla kur
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            setStatus('error')
            setMessage('Oturum oluşturulamadı: ' + sessionError.message)
            return
          }

          if (data.session && data.user) {
            // Email'in doğrulanmış olduğunu kontrol et
            if (data.user.email_confirmed_at) {
              setStatus('success')
              setMessage('Email adresiniz başarıyla doğrulandı! Yönlendiriliyorsunuz...')
              
              // 3 saniye sonra ana sayfaya yönlendir
              setTimeout(() => {
                router.push('/app')
              }, 3000)
            } else {
              setStatus('error')
              setMessage('Email doğrulanamadı. Lütfen linkin geçerliliğini kontrol edin.')
            }
          } else {
            setStatus('error')
            setMessage('Kullanıcı bilgileri alınamadı.')
          }
          return
        }

        // Hiçbir token yoksa
        setStatus('error')
        setMessage('Geçersiz doğrulama linki. Token bilgileri bulunamadı.')

      } catch (error) {
        console.error('Verification error:', error)
        setStatus('error')
        setMessage('Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin.')
      }
    }

    verifyEmail()
  }, [searchParams, router])

  const handleGoHome = () => {
    router.push('/')
  }

  const handleGoToApp = () => {
    router.push('/app')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Email Doğrulanıyor...'}
            {status === 'success' && 'Doğrulama Başarılı!'}
            {status === 'error' && 'Doğrulama Hatası'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Lütfen bekleyin, email adresiniz doğrulanıyor...'}
            {status === 'success' && 'Email adresiniz başarıyla doğrulandı.'}
            {status === 'error' && 'Email doğrulanırken bir sorun oluştu.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-600" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-16 w-16 text-red-600" />
            )}
          </div>

          {/* Message */}
          {message && (
            <div className={`text-center p-3 rounded-lg ${
              status === 'success' 
                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                : status === 'error'
                ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
            }`}>
              {message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-4">
            {status === 'success' && (
              <>
                <Button 
                  onClick={handleGoToApp}
                  className="w-full"
                >
                  Uygulamaya Git
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleGoHome}
                  className="w-full"
                >
                  Ana Sayfaya Dön
                </Button>
              </>
            )}
            
            {status === 'error' && (
              <>
                <Button 
                  onClick={handleGoHome}
                  className="w-full"
                >
                  Ana Sayfaya Dön
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/resend-verification')}
                  className="w-full"
                >
                  Yeni Email İste
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Tekrar Dene
                </Button>
              </>
            )}
          </div>

          {/* Additional Info */}
          {status === 'success' && (
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p>Otomatik olarak uygulamaya yönlendirileceksiniz...</p>
              <p>Beklemek istemiyorsanız yukarıdaki butona tıklayabilirsiniz.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p>Sorun devam ederse lütfen destek ile iletişime geçin.</p>
              <p className="mt-2">
                <strong>Not:</strong> Doğrulama linkinin 24 saat içinde kullanılması gerekmektedir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}