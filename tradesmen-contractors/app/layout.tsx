import "./globals.css"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container py-4 flex justify-between items-center">
              <h1 className="text-xl font-bold">ContractorBid</h1>
              <nav>
                <a href="/" className="text-sm hover:underline">Jobs</a>
                <a href="/dashboard" className="ml-4 text-sm hover:underline">Dashboard</a>
              </nav>
            </div>
          </header>
          <main className="container py-6">{children}</main>
        </div>
      </body>
    </html>
  )
}