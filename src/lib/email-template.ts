import { Database } from '@/lib/supabase'

interface EmailVerificationTemplateProps {
  userName?: string
  verificationUrl: string
  expirationHours?: number
}

export function generateEmailVerificationTemplate({
  userName,
  verificationUrl,
  expirationHours = 24
}: EmailVerificationTemplateProps): string {
  const currentYear = new Date().getFullYear()

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CepFinans - Email Doğrulama</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            border-radius: 12px 12px 0 0;
        }
        
        .logo {
            width: 120px;
            height: auto;
            margin-bottom: 20px;
        }
        
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            color: #e2e8f0;
            font-size: 16px;
        }
        
        .content {
            padding: 40px 30px;
            background-color: #ffffff;
            border-radius: 0 0 12px 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .welcome-text {
            font-size: 20px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 16px;
        }
        
        .message {
            color: #475569;
            margin-bottom: 32px;
            line-height: 1.7;
        }
        
        .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            margin: 24px 0;
            transition: transform 0.2s ease;
            cursor: pointer;
            border: none;
        }
        
        .verify-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        
        .security-notice {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        
        .security-notice h3 {
            color: #92400e;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .security-notice p {
            color: #78350f;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .alternative-link {
            color: #64748b;
            font-size: 14px;
            word-break: break-all;
            background-color: #f1f5f9;
            padding: 12px;
            border-radius: 4px;
            margin: 16px 0;
            border: 1px solid #e2e8f0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            background-color: #f8fafc;
            border-radius: 12px;
            margin-top: 20px;
        }
        
        .footer p {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .footer-links {
            margin-top: 16px;
        }
        
        .footer-links a {
            color: #667eea;
            text-decoration: none;
            margin: 0 8px;
            font-size: 14px;
            transition: color 0.2s ease;
        }
        
        .footer-links a:hover {
            color: #764ba2;
            text-decoration: underline;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 10px;
            }
            
            .header, .content, .footer {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .welcome-text {
                font-size: 18px;
            }
            
            .verify-button {
                padding: 14px 24px;
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1>CepFinans</h1>
            <p>Kişisel Finans Yönetim Uygulamanız</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <h2 class="welcome-text">
                Hoş Geldiniz${userName ? ' ' + userName : ''}! 👋
            </h2>
            
            <p class="message">
                CepFinans'a kaydolduğunuz için teşekkür ederiz! Hesabınızı aktif hale getirmek ve kişisel finans yönetim uygulamasını kullanmaya başlamak için lütfen aşağıdaki butona tıklayarak email adresinizi doğrulayın.
            </p>
            
            <!-- Verify Button -->
            <div style="text-align: center;">
                <a href="${verificationUrl}" class="verify-button" target="_blank" rel="noopener noreferrer">
                    Email Adresimi Doğrula
                </a>
            </div>
            
            <!-- Security Notice -->
            <div class="security-notice">
                <h3>🔒 Güvenlik Uyarısı</h3>
                <p>
                    Bu doğrulama linki sadece ${expirationHours} saat geçerlidir. Eğer bu işlemi siz yapmadıysanız, lütfen bu emaili dikkate almayın. Hesabınız güvendedir.
                </p>
            </div>
            
            <!-- Alternative Link -->
            <div>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
                    Eğer buton çalışmıyorsa, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırabilirsiniz:
                </p>
                <div class="alternative-link">
                    ${verificationUrl}
                </div>
            </div>
            
            <p class="message">
                Doğrulama işleminden sonra finansal hedeflerinizi belirleyebilir, gelir ve giderlerinizi takip edebilir, bütçeler oluşturabilir ve finansal geleceğinizi daha iyi yönetebilirsiniz.
            </p>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <p>© ${currentYear} CepFinans. Tüm hakları saklıdır.</p>
            <p>Finansal özgürlüğünüz için buradayız!</p>
            <div class="footer-links">
                <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Web Sitesi</a>
                <a href="mailto:destek@cepfinans.com">Destek</a>
                <a href="http://localhost:3000/privacy" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</a>
            </div>
        </div>
    </div>
</body>
</html>
  `
}

export interface EmailData {
  to: string
  subject: string
  htmlContent: string
  userName?: string
}

export class EmailService {
  private static instance: EmailService
  private baseUrl: string

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  public generateVerificationUrl(email: string, token: string): string {
    return `${this.baseUrl}/auth/callback?access_token=${token}&refresh_token=${token}&type=signup&email=${encodeURIComponent(email)}`
  }

  public createVerificationEmail(
    email: string, 
    token: string, 
    userName?: string
  ): EmailData {
    const verificationUrl = this.generateVerificationUrl(email, token)
    const htmlContent = generateEmailVerificationTemplate({
      userName,
      verificationUrl,
      expirationHours: 24
    })

    return {
      to: email,
      subject: 'CepFinans - Email Adresinizi Doğrulayın',
      htmlContent,
      userName
    }
  }

  public async sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string }> {
    try {
      // Email gönderme API'sine istek at
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Email gönderilemedi')
      }

      return { success: true }
    } catch (error) {
      console.error('Email sending error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata' 
      }
    }
  }
}