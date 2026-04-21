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
    <html lang="en" data-scroll-behavior="smooth">
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

            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
