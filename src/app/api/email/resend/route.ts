import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email adresi gereklidir' },
        { status: 400 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase bağlantısı kurulamadı' },
        { status: 500 }
      )
    }

    // Kullanıcıyı bul
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('List users error:', listError)
      return NextResponse.json(
        { error: 'Kullanıcılar listelenemedi' },
        { status: 500 }
      )
    }

    const user = users.find(u => u.email === email.toLowerCase())
    
    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Yeni verification token oluştur
    const { EmailService } = await import('@/lib/email-template')
    const emailService = EmailService.getInstance()
    
    const verificationToken = 'resend-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    
    // Token'ı veritabanına kaydet
    const { error: tokenError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
        token: verificationToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 saat
        created_at: new Date().toISOString()
      })

    if (tokenError) {
      console.error('Token save error:', tokenError)
      return NextResponse.json(
        { error: 'Doğrulama token\'ı kaydedilemedi' },
        { status: 500 }
      )
    }

    // Email gönder
    const verificationUrl = emailService.generateVerificationUrl(
      email.toLowerCase(), 
      verificationToken
    )
    
    const emailData = emailService.createVerificationEmail(
      email.toLowerCase(),
      verificationToken,
      user.user_metadata?.full_name || undefined
    )

    const emailResult = await emailService.sendEmail(emailData)
    
    if (!emailResult.success) {
      console.error('Email gönderilemedi:', emailResult.error)
      return NextResponse.json(
        { error: 'Email gönderilemedi: ' + emailResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Doğrulama emaili yeniden gönderildi',
      email: email
    })

  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata') },
      { status: 500 }
    )
  }
}