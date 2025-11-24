'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings, Shield, Trash2, RefreshCw } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'

interface UserAuthButtonProps {
  onAuthClick?: () => void
}

export function UserAuthButton({ onAuthClick }: UserAuthButtonProps) {
  const { t } = useLanguage()
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleGoToApp = () => {
    router.push('/app')
  }

  const handleGoToSettings = () => {
    router.push('/app/settings')
  }

  const handleDeleteAccount = () => {
    router.push('/app/settings?tab=security&action=delete')
  }

  const handleResetData = () => {
    router.push('/app/settings?tab=security&action=reset')
  }

  // Check if user is currently in the app
  const isInApp = pathname.startsWith('/app')

  if (user) {
    // User is logged in
    const userInitials = user.email?.charAt(0).toUpperCase() || 'U'
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={userName} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!isInApp && (
            <DropdownMenuItem onClick={handleGoToApp}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Uygulamaya Git</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleGoToSettings}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('auth.settings') || 'Ayarlar'}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleResetData} className="text-orange-600">
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Verileri Sıfırla</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteAccount} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Hesabı Sil</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('auth.signOut') || 'Çıkış Yap'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // User is not logged in
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={onAuthClick}>
        {t('auth.signIn') || 'Giriş Yap'}
      </Button>
      <Button onClick={onAuthClick}>
        {t('auth.signUp') || 'Kayıt Ol'}
      </Button>
    </div>
  )
}