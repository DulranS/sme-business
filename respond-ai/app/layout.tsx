import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AutoParts AI — Inventory & Customer System',
  description: 'AI-powered automotive parts inventory management with WhatsApp integration',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0A0A0A' }}>
        {children}
      </body>
    </html>
  )
}