import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { to, subject, htmlContent, userName } = await request.json()

    // Validation
    if (!to || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Eksik parametreler: to, subject, htmlContent gereklidir' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Geçersiz email adresi' },
        { status: 400 }
      )
    }

    console.log('Email gönderme isteği:', { to, subject, userName })

    // Email gönderme
    const { data, error } = await resend.emails.send({
      from: 'CepFinans <onboarding@resend.dev>', // Resend'in default domain'ini kullanıyoruz
      to: [to],
      subject,
      html: htmlContent,
      replyTo: 'destek@cepfinans.com'
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: 'Email gönderilemedi: ' + error.message },
        { status: 500 }
      )
    }

    console.log('Email başarıyla gönderildi:', data)

    return NextResponse.json({ 
      success: true, 
      message: 'Email başarıyla gönderildi',
      data 
    })

  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata') },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'Email API çalışıyor',
    timestamp: new Date().toISOString()
  })
}