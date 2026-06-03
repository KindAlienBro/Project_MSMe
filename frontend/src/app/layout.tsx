// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Automatic Timetable | Professional Auth',
  description: 'A Next-Generation Timetable Management Platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Timetable',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* The background color is now defined by our CSS variable */}
      <body className={`${inter.className} bg-[--color-background]`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}