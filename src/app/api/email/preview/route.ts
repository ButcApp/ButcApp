import { NextRequest, NextResponse } from 'next/server'
import { generateEmailVerificationTemplate } from '@/lib/email-template'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userName = searchParams.get('userName') || 'Test Kullanıcı'
    const verificationUrl = searchParams.get('verificationUrl') || 'http://localhost:3000/auth/callback?token=test-token&email=test@example.com'

    const htmlContent = generateEmailVerificationTemplate({
      userName,
      verificationUrl,
      expirationHours: 24
    })

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Template generation error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}