import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/email-template'

export async function POST(request: NextRequest) {
  try {
    const { email, userName } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email adresi gereklidir' },
        { status: 400 }
      )
    }

    // Test token oluştur
    const testToken = 'test-verification-token-' + Date.now()

    const emailService = EmailService.getInstance()
    const emailData = emailService.createVerificationEmail(
      email,
      testToken,
      userName || 'Test Kullanıcı'
    )

    const result = await emailService.sendEmail(emailData)

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test emaili başarıyla gönderildi',
        email: email
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata') },
      { status: 500 }
    )
  }
}

// GET request için test formu
export async function GET() {
  return NextResponse.json({ 
    message: 'Email test endpoint',
    usage: 'POST request with { email: "test@example.com", userName?: "İsim" }',
    timestamp: new Date().toISOString()
  })
}