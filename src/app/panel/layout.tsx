"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  AlertTriangle, 
  CalendarDays, 
  Users, 
  UserCheck,
  LayoutDashboard,
  Send,
  GraduationCap,
  Settings,
  FileText,
  Menu,
  X,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  KeyRound,
  LogOut,
  Gavel,
  History,
  Sparkles,
  TrendingUp,
  Bell,
  Search,
  Moon,
  Sun,
  ChevronDown,
  Activity,
  Zap,
  Star,
  Clock,
  Target,
  BookOpen,
  Brain
} from "lucide-react";
import { toast } from "sonner";

const MASTER_PASSWORD = "sagopa";
const MAX_ATTEMPTS = 3;
const SESSION_KEY = "panel_authenticated";
const LOCKOUT_KEY = "panel_lockout";

// Menü item tipi
interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  exact?: boolean;
  badge?: string | null;
}

interface MenuCategory {
  title: string;
  items: MenuItem[];
}

// Menü kategorileri
const menuCategories: MenuCategory[] = [
  {
    title: "Genel",
    items: [
      { 
        href: "/panel", 
        label: "Özet", 
        icon: LayoutDashboard,
        exact: true,
        badge: null,
        color: "blue"
      },
    ]
  },
  {
    title: "Analiz",
    items: [
      { 
        href: "/panel/nedenler", 
        label: "Yönlendirme Nedenleri", 
        icon: Target,
        color: "amber"
      },
      { 
        href: "/panel/zaman", 
        label: "Zaman İstatistikleri", 
        icon: CalendarDays,
        color: "indigo"
      },
      { 
        href: "/panel/ogretmen", 
        label: "Öğretmen & Sınıf", 
        icon: UserCheck,
        color: "emerald"
      },
    ]
  },
  {
    title: "Öğrenci",
    items: [
      {
        href: "/panel/ogrenci-listesi",
        label: "Öğrenci Listesi",
        icon: GraduationCap,
        color: "cyan"
      },
      {
        href: "/panel/ogrenci-gecmisi",
        label: "Öğrenci Geçmişi",
        icon: History,
        color: "violet"
      },
      { 
        href: "/panel/ogrenciler", 
        label: "Öğrenci Yönetimi", 
        icon: Settings,
        color: "slate"
      },
    ]
  },
  {
    title: "İşlemler",
    items: [
      {
        href: "/panel/belge",
        label: "Belge Oluştur",
        icon: FileText,
        color: "purple"
      },
      {
        href: "/panel/disiplin",
        label: "Disiplin Kurulu",
        icon: Gavel,
        color: "rose"
      },
      { 
        href: "/panel/telegram", 
        label: "Telegram Bildirimleri", 
        icon: Send,
        color: "sky"
      },
    ]
  }
];

// Tüm menü öğelerini düz liste olarak al
const allMenuItems = menuCategories.flatMap(cat => cat.items);

// Renk haritası
const colorMap: Record<string, { gradient: string; bg: string; text: string; border: string }> = {
  blue: { gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  amber: { gradient: "from-amber-500 to-orange-600", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  indigo: { gradient: "from-indigo-500 to-violet-600", bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  emerald: { gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  cyan: { gradient: "from-cyan-500 to-blue-600", bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
  violet: { gradient: "from-violet-500 to-purple-600", bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  slate: { gradient: "from-slate-500 to-gray-600", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  purple: { gradient: "from-purple-500 to-pink-600", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  rose: { gradient: "from-rose-500 to-red-600", bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200" },
  sky: { gradient: "from-sky-500 to-cyan-600", bg: "bg-sky-50", text: "text-sky-600", border: "border-sky-200" },
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Genel", "Analiz", "Öğrenci", "İşlemler"]);
  
  // Şifre koruması state'leri
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Filtrelenmiş menü öğeleri
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allMenuItems.filter(item => 
      item.label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Session kontrolü
  useEffect(() => {
    const checkAuth = () => {
      const lockoutTime = localStorage.getItem(LOCKOUT_KEY);
      if (lockoutTime) {
        const lockoutDate = new Date(lockoutTime);
        const now = new Date();
        if (now.getTime() - lockoutDate.getTime() < 5 * 60 * 1000) {
          router.push("/");
          return;
        } else {
          localStorage.removeItem(LOCKOUT_KEY);
        }
      }

      const authenticated = sessionStorage.getItem(SESSION_KEY);
      if (authenticated === "true") {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, [router]);

  // Şifre kontrolü
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === MASTER_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsAuthenticated(true);
      toast.success("Giriş başarılı! Panele yönlendiriliyorsunuz...");
      setPassword("");
      setAttempts(0);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPassword("");
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        localStorage.setItem(LOCKOUT_KEY, new Date().toISOString());
        toast.error("3 yanlış deneme! Ana sayfaya yönlendiriliyorsunuz...");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } else {
        toast.error(`Yanlış şifre! Kalan deneme hakkı: ${MAX_ATTEMPTS - newAttempts}`);
      }
    }
  };

  // Çıkış yapma
  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    toast.success("Çıkış yapıldı!");
    router.push("/");
  };

  // Sayfa değiştiğinde sidebar'ı kapat
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // ESC tuşuyla kapat
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Ctrl+K ile arama
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => 
      prev.includes(title) 
        ? prev.filter(c => c !== title)
        : [...prev, title]
    );
  };

  // Mevcut sayfa
  const currentPage = allMenuItems.find(item => isActive(item.href, item.exact))?.label || "Panel";
  const currentPageItem = allMenuItems.find(item => isActive(item.href, item.exact));

  // Loading durumu
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="h-6 w-6 text-blue-400 animate-pulse" />
            </div>
          </div>
          <p className="text-slate-400 text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Şifre ekranı
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl animate-float-reverse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-glow" />
        </div>
        
        <div className={`relative w-full max-w-md transition-transform ${isShaking ? "animate-shake" : ""}`}>
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Üst Kısım */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-6 py-10 text-center overflow-hidden">
              <div className="absolute inset-0 bg-grid-white/10" />
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-float" />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4 shadow-lg">
                  <ShieldAlert className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Panel Girişi</h1>
                <p className="text-blue-200 text-sm mt-2">Rehberlik Yönetim Sistemi</p>
              </div>
            </div>
            
            {/* Form Kısmı */}
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6 bg-white/5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                  Şifre
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-12 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-white placeholder-slate-500"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Deneme Hakkı Göstergesi */}
              {attempts > 0 && (
                <div className="flex items-center justify-center gap-2">
                  {[...Array(MAX_ATTEMPTS)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all ${
                        i < attempts 
                          ? "bg-red-500 shadow-lg shadow-red-500/50" 
                          : "bg-white/20"
                      }`}
                    />
                  ))}
                  <span className="text-xs text-slate-400 ml-2">
                    {MAX_ATTEMPTS - attempts} deneme hakkı
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={!password}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
              >
                <Lock className="h-4 w-4" />
                Giriş Yap
              </button>

              <div className="text-center">
                <Link 
                  href="/" 
                  className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                >
                  ← Ana Sayfaya Dön
                </Link>
              </div>
            </form>
          </div>

          {/* Alt Bilgi */}
          <p className="text-center text-xs text-slate-500 mt-4">
            RPD Öğrenci Takip Sistemi • Güvenli Giriş
          </p>
        </div>

        <style jsx global>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          .animate-shake {
            animation: shake 0.5s ease-in-out;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Mobil Üst Bar */}
      <div className="lg:hidden fixed top-14 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-3 text-slate-700 hover:text-blue-600 transition-all group"
          >
            <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-blue-50 transition-colors">
              <Menu className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-slate-800">{currentPage}</span>
              <span className="text-[10px] text-slate-400">Menüyü aç</span>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobil Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSearch(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-slate-200">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Menüde ara... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400"
                autoFocus
              />
              <button
                onClick={() => setShowSearch(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredMenuItems && filteredMenuItems.length > 0 ? (
                filteredMenuItems.map(item => {
                  const Icon = item.icon;
                  const colors = colorMap[item.color || "blue"];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Icon className={`h-4 w-4 ${colors.text}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                    </Link>
                  );
                })
              ) : searchQuery ? (
                <div className="p-8 text-center text-slate-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Sonuç bulunamadı</p>
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-slate-400 font-medium px-2">Hızlı Erişim</p>
                  {allMenuItems.slice(0, 5).map(item => {
                    const Icon = item.icon;
                    const colors = colorMap[item.color || "blue"];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery("");
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                          <Icon className={`h-4 w-4 ${colors.text}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sol Menü */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${sidebarCollapsed ? "w-20" : "w-72"} 
        bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
        border-r border-slate-800/50
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        flex flex-col
        shadow-xl lg:shadow-2xl
      `}>
        {/* Logo ve Başlık */}
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="relative">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 shadow-lg shadow-blue-500/25">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h2 className="text-base font-bold text-white">RPD Panel</h2>
                  <p className="text-[10px] text-slate-500">Rehberlik Sistemi</p>
                </div>
              )}
            </div>
            
            {/* Mobil Kapat */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            {/* Desktop Collapse */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
            </button>
          </div>
        </div>

        {/* Arama Butonu */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3">
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-700/50"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Ara...</span>
              <kbd className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Menü Kategorileri */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {menuCategories.map((category) => (
            <div key={category.title} className="mb-2">
              {/* Kategori Başlığı */}
              {!sidebarCollapsed && (
                <button
                  onClick={() => toggleCategory(category.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors"
                >
                  <span>{category.title}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedCategories.includes(category.title) ? "" : "-rotate-90"}`} />
                </button>
              )}
              
              {/* Kategori Öğeleri */}
              {(sidebarCollapsed || expandedCategories.includes(category.title)) && (
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.exact);
                    const colors = colorMap[item.color || "blue"];
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`
                          group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                          ${sidebarCollapsed ? "justify-center" : ""}
                          ${active
                            ? `bg-gradient-to-r ${colors.gradient} text-white shadow-lg`
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                          }
                        `}
                      >
                        <div className={`
                          p-1.5 rounded-lg transition-all
                          ${active 
                            ? "bg-white/20" 
                            : `bg-slate-800 group-hover:${colors.bg}`
                          }
                        `}>
                          <Icon className={`h-4 w-4 ${active ? "text-white" : `group-hover:${colors.text}`}`} />
                        </div>
                        
                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {active && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            )}
                          </>
                        )}
                        
                        {/* Tooltip for collapsed mode */}
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                            {item.label}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Alt Kısım - Kullanıcı ve Çıkış */}
        <div className="p-3 border-t border-slate-800/50 bg-slate-950/50">
          {!sidebarCollapsed ? (
            <div className="space-y-2">
              {/* Kullanıcı Bilgisi */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/30">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                  R
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Rehber Öğretmen</p>
                  <p className="text-[10px] text-slate-500">Yönetici</p>
                </div>
              </div>
              
              {/* Çıkış Butonu */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group"
              >
                <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-red-500/20 transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                <span>Çıkış Yap</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                  R
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Çıkış Yap"
                className="w-full flex justify-center p-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Ana İçerik */}
      <main className="flex-1 p-4 lg:p-6 overflow-auto mt-16 lg:mt-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {children}
      </main>
    </div>
  );
}
