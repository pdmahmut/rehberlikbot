'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react'; // Menü durumunu kontrol etmek için useState'i dahil ettik

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPanelRoute = pathname?.startsWith('/panel');
  
  // Mobil menünün açık olup olmadığını tutacağımız değişken
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isPanelRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 md:px-6">
          
          {/* Sol Taraf: Logo ve İsim */}
          <Link href="/" className="group flex items-center gap-2.5 transition-all">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-lg shadow-blue-500/25 transition-all group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-blue-500/30">
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
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-400 to-violet-400 opacity-0 transition-opacity group-hover:opacity-20" />
            </div>
            <div className="flex flex-col">
              <span className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-base md:text-lg font-bold text-transparent">
                RPD
              </span>
              <span className="-mt-0.5 text-[10px] md:text-xs font-medium text-slate-400">
                Öğrenci Takip
              </span>
            </div>
          </Link>

          {/* Orta/Sağ Taraf: Profil Resmi veya İkinci Logo */}
          {/* Mobilde resmi biraz daha küçülttük ki ekrana tam sığsın (h-10) */}
          <a href="#" className="hidden sm:flex items-center transition-all hover:scale-105 ml-auto mr-4">
            <img
              src="/logo.png"
              alt="psk.dan. Mahmut Karadeniz"
              className="h-10 w-auto sm:h-12 md:h-16 lg:h-20 object-contain"
            />
          </a>

          {/* Sağ Taraf: Navigasyon ve Mobil Menü Butonu */}
          <nav className="flex items-center gap-2">
            {/* Büyük ekranlar için menü (Mobilde gizli) */}
            <div className="hidden md:flex items-center gap-4">
              {/* İleride buraya <Link> öğeleri ekleyebilirsin */}
              {/* Örnek: <Link href="/hakkimizda" className="text-sm font-medium text-slate-600 hover:text-blue-600">Hakkımızda</Link> */}
            </div>

            {/* Mobil cihazlar için Hamburger Menü Butonu */}
            <button 
              className="md:hidden flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menüyü aç"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </nav>
        </div>

        {/* Mobil Açılır Menü İçeriği */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-lg py-4 px-4 flex flex-col gap-3">
             <div className="flex justify-center mb-4">
                <img
                  src="/logo.png"
                  alt="psk.dan. Mahmut Karadeniz"
                  className="h-14 w-auto object-contain"
                />
             </div>
            {/* Mobilde görünmesini istediğin menü linklerini buraya ekleyebilirsin */}
            <Link href="/" className="px-4 py-2 bg-slate-50 rounded-lg text-slate-700 font-medium hover:bg-blue-50 hover:text-blue-600">
              Anasayfa
            </Link>
            {/* İhtiyacın olan diğer linkleri de buraya listeleyebilirsin */}
          </div>
        )}
      </header>
      
      {/* Sayfa İçeriği */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
