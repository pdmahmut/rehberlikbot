import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RPD Öğrenci Yönlendirme",
  description: "RPD Öğrenci Yönlendirme Uygulaması",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            duration: 3000,
          }}
        />
        <div className="min-h-screen flex flex-col">
          {/* Modern Glassmorphism Header */}
          <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl shadow-sm">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
              {/* Logo */}
              <Link href="/" className="group flex items-center gap-2.5 transition-all">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-500/25 transition-all group-hover:shadow-xl group-hover:shadow-blue-500/30 group-hover:scale-105">
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    className="h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z"
                      fill="currentColor"
                      fillOpacity="0.2"
                    />
                    <path
                      d="M16 8c-3.5 0-6.5 1.5-8 4 1.5-1 3.5-1.5 5.5-1 1.5.4 2.5 1.5 2.5 3s-1 2.6-2.5 3c-2 .5-4-.5-5.5-1.5 1.5 3 4.5 5 8 5s6.5-2 8-5c-1.5 1-3.5 2-5.5 1.5-1.5-.4-2.5-1.5-2.5-3s1-2.6 2.5-3c2-.5 4 0 5.5 1-1.5-2.5-4.5-4-8-4z"
                      fill="currentColor"
                    />
                  </svg>
                  {/* Pulse effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-400 to-violet-400 opacity-0 group-hover:opacity-20 transition-opacity" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                    RPD
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 -mt-0.5 hidden sm:block">
                    Öğrenci Takip
                  </span>
                </div>
              </Link>

              {/* Center Logo */}
              <a 
                href="#" 
                className="flex items-center transition-all hover:scale-105"
              >
                <img 
                  src="/logo.png" 
                  alt="psk.dan. Mahmut Karadeniz" 
                  className="h-12 sm:h-16 md:h-20 lg:h-24 w-auto"
                />
              </a>

              {/* Navigation */}
              <nav className="flex items-center gap-2">
                {/* Status Indicator */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/50">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-medium text-emerald-700">Aktif</span>
                </div>

                {/* Panel Button */}
                <Link
                  href="/panel"
                  className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-indigo-500 active:scale-95"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor" 
                    className="w-4 h-4"
                  >
                    <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
                  </svg>
                  <span>Panel</span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
