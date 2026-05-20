import { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import QueryProvider from "@/components/query-provider"
import { Header } from "@/components/header"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Mylink - 개발자를 위한 멀티링크 허브',
    template: '%s | Mylink'
  },
  description: '이력서, 깃허브, 기술 블로그를 하나의 모던한 프로필 페이지로 담아내고 편리하게 공유하세요.',
  keywords: ['Mylink', '마이링크', '멀티링크', '포트폴리오', '개발자 이력서', '깃허브', '기술 블로그', 'SNS', '링크 트리'],
  authors: [{ name: 'Mylink Team' }],
  openGraph: {
    title: 'Mylink - 개발자를 위한 멀티링크 허브',
    description: '이력서, 깃허브, 기술 블로그를 하나의 모던한 프로필 페이지로 담아내고 편리하게 공유하세요.',
    url: appUrl,
    siteName: 'Mylink',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mylink - 개발자를 위한 멀티링크 허브',
    description: '이력서, 깃허브, 기술 블로그를 하나의 모던한 프로필 페이지로 담아내고 편리하게 공유하세요.',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              <Header />
              <main className="pt-16">
                {children}
              </main>
            </QueryProvider>
          </AuthProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
