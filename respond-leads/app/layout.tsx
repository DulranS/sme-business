import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inventory Manager',
  description: 'WhatsApp AI Inventory Management Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0C0C0C' }}>
        {children}
      </body>
    </html>
  )
}