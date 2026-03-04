import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Business Inventory AI — Inventory & WhatsApp Console',
  description: 'AI-powered product inventory and WhatsApp customer conversation system for any business',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0A0A0A' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}