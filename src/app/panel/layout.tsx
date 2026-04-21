"use client";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
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
  LogOut,
  UserCog,
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
  Brain,
  CalendarCheck,
  FolderOpen,
  Calendar,
  ListTodo,
  ExternalLink,
  BellRing,
  Phone,
  PhoneCall,
  PieChart,
  MessageSquare,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";


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
        href: "/panel/takvim", 
        label: "Takvim", 
        icon: Calendar,
        color: "teal"
      },
    ]
  },
  {
    title: "Sınıf Rehberliği",
    items: [
      {
        href: "/panel/sinif-rehberligi",
        label: "Sınıf Rehberliği",
        icon: BookOpen,
        color: "emerald"
      },
    ]
  },
  {
    title: "Öğrenci Takip",
    items: [
      {
        href: "/panel/basvurular",
        label: "Başvurular",
        icon: MessageSquare,
        color: "purple"
      },
      {
        href: "/panel/ogrenci-listesi",
        label: "Öğrenci Listesi",
        icon: GraduationCap,
        color: "emerald"
      },
      {
        href: "/panel/ogrenci-gecmisi",
        label: "Öğrenci Geçmişi",
        icon: History,
        color: "violet"
      },
      {
        href: "/panel/vaka-dosyalari",
        label: "Vaka Dosyaları",
        icon: FolderOpen,
        color: "cyan"
      },
      {
        href: "/panel/ogrenciler", 
        label: "Öğrenci Yönetimi", 
        icon: Users,
        color: "slate"
      },
      {
        href: "/panel/risk-takip",
        label: "Risk Takip",
        icon: AlertTriangle,
        color: "red"
      },
    ]
  },
  {
    title: "Analiz & Raporlar",
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
      {
        href: "/panel/donem-raporu",
        label: "Dönem Raporu",
        icon: PieChart,
        color: "blue"
      },
    ]
  },
  {
    title: "İşlemler",
    items: [
      {
        href: "/panel/kullanici-yonetimi",
        label: "Kullanıcı Yönetimi",
        icon: UserCog,
        color: "violet"
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
  teal: { gradient: "from-teal-500 to-emerald-600", bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  orange: { gradient: "from-orange-500 to-amber-600", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  red: { gradient: "from-red-500 to-rose-600", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  pink: { gradient: "from-pink-500 to-rose-600", bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [classDisplay, setClassDisplay] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Genel", "Sınıf Rehberliği", "Öğrenci Takip", "Randevular", "Süreç Yönetimi", "Analiz & Raporlar", "İşlemler"]);

  // Şifre değişim modal state'leri (öğretmen için)
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        setRole(d.role);
        setIsHomeroom(d.isHomeroom || false);
        setTeacherName(d.teacherName || null);
        setClassDisplay(d.classDisplay || null);
        setRoleLoading(false);
        if (d.role === 'admin') {
          Promise.all([
            fetch("/api/deletion-requests?status=bekliyor").then(r => r.json()),
            fetch("/api/work-requests?status=bekliyor").then(r => r.json()),
          ]).then(([del, work]) => {
            setPendingDeleteCount((del.requests?.length ?? 0) + (work.requests?.length ?? 0));
          }).catch(() => {});
        }
      })
      .catch(() => setRoleLoading(false));
  }, []);

  // Filtrelenmiş menü öğeleri
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allMenuItems.filter(item => 
      item.label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Çıkış yapma
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Çıkış yapıldı!");
    router.push("/login");
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

  // Rol yüklenirken bekle
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500" />
      </div>
    );
  }

  const handleChangePassword = async () => {
    if (!oldPass.trim() || !newPass.trim() || !newPass2.trim()) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (newPass !== newPass2) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }
    setPassLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Hata"); return; }
      toast.success("Şifre değiştirildi");
      setShowPassModal(false);
      setOldPass(""); setNewPass(""); setNewPass2("");
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setPassLoading(false);
    }
  };

  // Öğretmen → sol panel layout
  if (role === 'teacher') {
    const accentFrom = isHomeroom ? 'from-teal-500' : 'from-violet-500';
    const accentTo   = isHomeroom ? 'to-emerald-600' : 'to-purple-600';
    const activeGrad = isHomeroom
      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 shadow-teal-500/25'
      : 'bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-500/25';

    const teacherMenu = isHomeroom
      ? [
          { href: '/panel/ogrenci-yonlendirmesi', label: 'Yönlendirme Yap', icon: Send },
          { href: '/panel/sinifim', label: 'Sınıfım', icon: Users },
          { href: '/panel/yonlendirme-gecmisi', label: 'Geçmiş', icon: History },
        ]
      : [
          { href: '/panel/ogrenci-yonlendirmesi', label: 'Yönlendirme Yap', icon: Send },
          { href: '/panel/yonlendirme-gecmisi', label: 'Geçmiş', icon: History },
        ];

    return (
      <div className="min-h-screen flex bg-slate-100">
        {/* Sol Sidebar */}
        <aside className="w-64 min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col shadow-2xl">
          {/* Logo */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 bg-gradient-to-br ${accentFrom} ${accentTo} rounded-xl shadow-lg`}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Dumlupınar</p>
                <p className="text-[11px] text-slate-400">Rehberlik Sistemi</p>
              </div>
            </div>
          </div>

          {/* Sınıf bilgisi — sadece rehber öğretmende */}
          {isHomeroom && classDisplay && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
              <p className="text-[10px] text-teal-400 font-medium uppercase tracking-wider mb-0.5">Sınıf Rehberi</p>
              <p className="text-sm font-bold text-teal-300">{classDisplay}</p>
            </div>
          )}

          {/* Menü */}
          <nav className="flex-1 p-3 space-y-1 mt-2">
            {teacherMenu.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? `${activeGrad} text-white shadow-lg`
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${active ? 'bg-white/20' : 'bg-slate-800'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {item.label}
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </Link>
              );
            })}
          </nav>

          {/* Alt — Kullanıcı & Çıkış */}
          <div className="p-3 border-t border-slate-800">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 mb-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accentFrom} ${accentTo} flex items-center justify-center text-white text-sm font-bold`}>
                {teacherName ? teacherName.charAt(0).toUpperCase() : 'Ö'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{teacherName || 'Öğretmen'}</p>
                <p className="text-[10px] text-slate-500">{isHomeroom ? 'Sınıf Rehber Öğretmeni' : 'Öğretmen'}</p>
              </div>
            </div>
            <button
              onClick={() => setShowPassModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-all group mb-1"
            >
              <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-slate-600 transition-colors">
                <KeyRound className="h-4 w-4" />
              </div>
              Şifre Değiştir
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-red-500/20 transition-colors">
                <LogOut className="h-4 w-4" />
              </div>
              Çıkış Yap
            </button>
          </div>
        </aside>

        {/* Şifre Değiştir Modalı */}
        {showPassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPassModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 bg-gradient-to-br ${accentFrom} ${accentTo} rounded-xl`}>
                    <KeyRound className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">Şifre Değiştir</h2>
                </div>
                <button onClick={() => setShowPassModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Mevcut şifre */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Mevcut Şifre</label>
                  <div className="relative">
                    <input
                      type={showOld ? "text" : "password"}
                      value={oldPass}
                      onChange={e => setOldPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-9 pl-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Yeni şifre */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Yeni Şifre</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pr-9 pl-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Yeni şifre tekrar */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Yeni Şifre (Tekrar)</label>
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPass2}
                    onChange={e => setNewPass2(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                    placeholder="••••••••"
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent ${
                      newPass2 && newPass !== newPass2
                        ? "border-red-300 focus:ring-red-500 bg-red-50"
                        : "border-slate-200 focus:ring-violet-500"
                    }`}
                  />
                  {newPass2 && newPass !== newPass2 && (
                    <p className="text-[11px] text-red-500 mt-1">Şifreler eşleşmiyor</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={passLoading}
                className={`w-full h-10 rounded-xl text-sm font-semibold text-white transition-all bg-gradient-to-r ${accentFrom} ${accentTo} hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2`}
              >
                {passLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {passLoading ? "Kaydediliyor..." : "Şifreyi Kaydet"}
              </button>
            </div>
          </div>
        )}

        {/* Ana İçerik */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
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
                            {item.href === '/panel/kullanici-yonetimi' && pendingDeleteCount > 0 && (
                              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                                {pendingDeleteCount}
                              </span>
                            )}
                            {active && pendingDeleteCount === 0 && (
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
