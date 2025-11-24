'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Mail, 
  Lock, 
  Camera, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle,
  Upload,
  Shield,
  Trash2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { UserAuthButton } from '@/components/auth/UserAuthButton'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export default function SettingsPage() {
  const { t } = useLanguage()
  const { user, updateUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get URL parameters
  const tab = searchParams.get('tab') || 'profile'
  const action = searchParams.get('action')
  
  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // UI states
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  // Dialog states
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(action === 'delete')
  const [showResetDialog, setShowResetDialog] = useState(action === 'reset')
  
  // Delete account states
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  
  // Reset data states
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name || '')
      setEmail(user.email || '')
      setAvatarUrl(user.user_metadata?.avatar_url || '')
    }
  }, [user])

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleUpdateName = async () => {
    if (!name.trim()) {
      showMessage('error', 'İsim boş olamaz')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() }
      })

      if (error) throw error

      await updateUser()
      showMessage('success', 'İsim başarıyla güncellendi')
      setShowNameDialog(false)
    } catch (error: any) {
      showMessage('error', error.message || 'İsim güncellenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!email.trim()) {
      showMessage('error', 'E-posta boş olamaz')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        email: email.trim()
      })

      if (error) throw error

      showMessage('success', 'E-posta güncelleme linki gönderildi')
      setShowEmailDialog(false)
    } catch (error: any) {
      showMessage('error', error.message || 'E-posta güncellenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('error', 'Tüm şifre alanlarını doldurun')
      return
    }

    if (newPassword !== confirmPassword) {
      showMessage('error', 'Yeni şifreler eşleşmiyor')
      return
    }

    if (newPassword.length < 6) {
      showMessage('error', 'Şifre en az 6 karakter olmalı')
      return
    }

    setLoading(true)
    try {
      // First verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      })

      if (signInError) {
        showMessage('error', 'Mevcut şifre hatalı')
        return
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      showMessage('success', 'Şifre başarıyla güncellendi')
      setShowPasswordDialog(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      showMessage('error', error.message || 'Şifre güncellenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showMessage('error', 'Şifrenizi giriniz')
      return
    }

    setDeleteLoading(true)
    try {
      // First verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: deletePassword
      })

      if (signInError) {
        showMessage('error', 'Şifre hatalı')
        return
      }

      // Delete user data from all tables
      const userId = user?.id
      
      // Delete from user_data table
      const { error: userDataError } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId)

      if (userDataError) {
        console.error('Error deleting user data:', userDataError)
      }

      // Delete from profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (profileError) {
        console.error('Error deleting profile:', profileError)
      }

      // Delete avatar from storage if exists
      if (user.user_metadata?.avatar_url) {
        const avatarPath = user.user_metadata.avatar_url.split('/').pop()
        if (avatarPath) {
          await supabase.storage
            .from('avatars')
            .remove([`avatars/${avatarPath}`])
        }
      }

      // Finally delete the user account
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteError) {
        throw deleteError
      }

      showMessage('success', 'Hesabınız başarıyla silindi')
      
      // Sign out and redirect
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/')
      }, 2000)

    } catch (error: any) {
      showMessage('error', error.message || 'Hesap silinirken hata oluştu')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleResetData = async () => {
    if (!resetPassword) {
      showMessage('error', 'Şifrenizi giriniz')
      return
    }

    setResetLoading(true)
    try {
      // First verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: resetPassword
      })

      if (signInError) {
        showMessage('error', 'Şifre hatalı')
        return
      }

      // Delete user data from user_data table only (keep profile and auth)
      const userId = user?.id
      
      const { error: userDataError } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId)

      if (userDataError) {
        console.error('Error deleting user data:', userDataError)
        throw userDataError
      }

      showMessage('success', 'Tüm verileriniz başarıyla sıfırlandı')
      
      // Close dialog and reset form
      setShowResetDialog(false)
      setResetPassword('')
      
      // Redirect to app to show fresh state
      setTimeout(() => {
        router.push('/app')
      }, 1500)

    } catch (error: any) {
      showMessage('error', error.message || 'Veriler sıfırlanırken hata oluştu')
    } finally {
      setResetLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Sadece resim dosyaları yüklenebilir')
      return
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      showMessage('error', 'Resim boyutu 2MB\'dan küçük olmalı')
      return
    }

    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      })

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      await updateUser()
      showMessage('success', 'Profil resmi başarı güncellendi')
    } catch (error: any) {
      showMessage('error', error.message || 'Profil resmi yüklenirken hata oluştu')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'U'
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Ayarlar</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <UserAuthButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Message Alert */}
        {message && (
          <Alert className={`mb-6 ${message.type === 'error' ? 'border-destructive' : 'border-green-500'}`}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue={tab} className="space-y-6" onValueChange={(value) => router.push(`/app/settings?tab=${value}`)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="security">Güvenlik</TabsTrigger>
            <TabsTrigger value="preferences">Tercihler</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil Bilgileri</CardTitle>
                <CardDescription>
                  Kişisel bilgilerinizi yönetin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl} alt={userName} />
                      <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90 transition-colors">
                      <Camera className="h-3 w-3" />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploadingAvatar}
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-medium">Profil Resmi</h3>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG veya GIF formatında, maksimum 2MB
                    </p>
                    {uploadingAvatar && (
                      <p className="text-sm text-primary">Yükleniyor...</p>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">İsim</Label>
                    <p className="text-sm text-muted-foreground">{name || 'Belirtilmemiş'}</p>
                  </div>
                  <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Değiştir</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>İsim Güncelle</DialogTitle>
                        <DialogDescription>
                          Yeni isminizi girin
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">İsim</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="İsminizi girin"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleUpdateName} 
                            disabled={loading}
                            className="flex-1"
                          >
                            {loading ? 'Kaydediliyor...' : 'Kaydet'}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowNameDialog(false)}
                            className="flex-1"
                          >
                            İptal
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">E-posta</Label>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                  <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Değiştir</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>E-posta Güncelle</DialogTitle>
                        <DialogDescription>
                          Yeni e-posta adresinizi girin. Doğrulama linki gönderilecektir.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">E-posta</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ornek@email.com"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleUpdateEmail} 
                            disabled={loading}
                            className="flex-1"
                          >
                            {loading ? 'Gönderiliyor...' : 'Gönder'}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setShowEmailDialog(false)}
                            className="flex-1"
                          >
                            İptal
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Şifre Güvenliği</CardTitle>
                <CardDescription>
                  Hesabınızın güvenliği için şifrenizi düzenli olarak güncelleyin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Lock className="mr-2 h-4 w-4" />
                      Şifre Değiştir
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Şifre Güncelle</DialogTitle>
                      <DialogDescription>
                        Güvenliğiniz için şifrenizi düzenli olarak güncelleyin
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="current-password">Mevcut Şifre</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Mevcut şifrenizi girin"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-password">Yeni Şifre</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Yeni şifrenizi girin"
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirm-password">Yeni Şifre (Tekrar)</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Yeni şifrenizi tekrar girin"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleUpdatePassword} 
                          disabled={loading}
                          className="flex-1"
                        >
                          {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowPasswordDialog(false)}
                          className="flex-1"
                        >
                          İptal
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Reset Data Section */}
            <Card className="border-orange-500">
              <CardHeader>
                <CardTitle className="text-orange-600">Verileri Sıfırla</CardTitle>
                <CardDescription>
                  Uygulama verilerinizi sıfırlamak istediğinizden emin misiniz? Hesabınız korunacaktır.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-orange-500">
                  <RefreshCw className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Bilgi:</strong> Bu işlem sadece uygulama verilerinizi sıfırlar. Hesabınız ve profil bilgileriniz korunacaktır.
                  </AlertDescription>
                </Alert>
                
                <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-orange-500 text-orange-600 hover:bg-orange-50">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verilerimi Sıfırla
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-orange-600">Verileri Sıfırla</DialogTitle>
                      <DialogDescription>
                        Uygulama verilerinizi sıfırlamak istediğinizden emin misiniz?
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Alert className="border-orange-500">
                        <RefreshCw className="h-4 w-4" />
                        <AlertDescription>
                          Sıfırlanacak veriler:
                          <ul className="mt-2 list-disc list-inside text-sm">
                            <li>Finansal işlemleriniz</li>
                            <li>Bakiye bilgileriniz</li>
                            <li>Notlarınız</li>
                            <li>Tekrarlayan işlemleriniz</li>
                          </ul>
                          <div className="mt-2 text-green-600">
                            <strong>Korunacak veriler:</strong>
                            <ul className="mt-1 list-disc list-inside text-sm">
                              <li>Profil bilgileriniz</li>
                              <li>Hesabınız</li>
                              <li>Profil resminiz</li>
                            </ul>
                          </div>
                        </AlertDescription>
                      </Alert>
                      
                      <div>
                        <Label htmlFor="reset-password">Şifreniz</Label>
                        <Input
                          id="reset-password"
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="Şifrenizi girerek onaylayın"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          className="border-orange-500 text-orange-600 hover:bg-orange-50 flex-1"
                          onClick={handleResetData} 
                          disabled={resetLoading}
                        >
                          {resetLoading ? 'Sıfırlanıyor...' : 'Verileri Sıfırla'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowResetDialog(false)
                            setResetPassword('')
                          }}
                          className="flex-1"
                        >
                          İptal
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Delete Account Section */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Hesabı Sil</CardTitle>
                <CardDescription>
                  Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Dikkat:</strong> Hesabınızı sildiğinizde tüm verileriniz (işlemler, bakiyeler, notlar, profil bilgileri) kalıcı olarak silinecektir.
                  </AlertDescription>
                </Alert>
                
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hesabımı Sil
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-destructive">Hesabı Sil</DialogTitle>
                      <DialogDescription>
                        Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecektir.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Alert className="border-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Silinecek veriler:
                          <ul className="mt-2 list-disc list-inside text-sm">
                            <li>Profil bilgileriniz</li>
                            <li>Finansal işlemleriniz</li>
                            <li>Bakiye bilgileriniz</li>
                            <li>Notlarınız</li>
                            <li>Profil resminiz</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                      
                      <div>
                        <Label htmlFor="delete-password">Şifreniz</Label>
                        <Input
                          id="delete-password"
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Şifrenizi girerek onaylayın"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="destructive"
                          onClick={handleDeleteAccount} 
                          disabled={deleteLoading}
                          className="flex-1"
                        >
                          {deleteLoading ? 'Siliniyor...' : 'Hesabı Sil'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowDeleteDialog(false)
                            setDeletePassword('')
                          }}
                          className="flex-1"
                        >
                          İptal
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Uygulama Tercihleri</CardTitle>
                <CardDescription>
                  Uygulama deneyiminizi kişiselleştirin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Tema</Label>
                    <p className="text-sm text-muted-foreground">
                      Uygulama görünümünü ayarlayın
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Dil</Label>
                    <p className="text-sm text-muted-foreground">
                      Uygulama dilini ayarlayın
                    </p>
                  </div>
                  <LanguageToggle />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}