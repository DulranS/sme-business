// src/app/(marketing)/layout.tsx
import { BUSINESS_CONFIG } from '../config/business-config';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: `${BUSINESS_CONFIG.name} | Get a Free Quote`,
  description: BUSINESS_CONFIG.metaDescription,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div 
          className="min-h-screen"
          style={
            {
              '--primary-color': BUSINESS_CONFIG.primaryColor,
              '--secondary-color': BUSINESS_CONFIG.secondaryColor,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </body>
    </html>
  );
}