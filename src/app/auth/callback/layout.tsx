import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Doğrulama | CepFinans',
  description: 'Email adres doğrulama sayfası',
}

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  )
}