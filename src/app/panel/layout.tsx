"use client";
import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Menu, X, ChevronRight, LogOut, Brain, Search, ChevronDown, Calendar, GraduationCap, History, Target, Users, CalendarDays, UserCheck, MessageSquare, BookOpen, FolderOpen, Bell } from "lucide-react";
import { toast } from "sonner";

const menuCategories = [
  { title: "Genel", items: [{ href: "/panel/takvim", label: "Takvim", icon: Calendar, color: "teal" }] },
  { title: "Sınıf Rehberliği", items: [
    { href: "/panel/sinif-rehberligi", label: "Sınıf Rehberliği", icon: BookOpen, color: "emerald" },
    { href: "/panel/ogretmen-yonetimi", label: "Öğretmen Yönetimi", icon: Users, color: "violet" },
  ]},
  { title: "Öğrenci Takip", items: [
    { href: "/panel/basvurular", label: "Başvurular", icon: MessageSquare, color: "purple" },
    { href: "/panel/ogrenci-listesi", label: "Öğrenci Listesi", icon: GraduationCap, color: "emerald" },
    { href: "/panel/ogrenci-gecmisi", label: "Öğrenci Geçmişi", icon: History, color: "violet" },
    { href: "/panel/vaka-dosyalari", label: "Vaka Dosyaları", icon: FolderOpen, color: "cyan" },
    { href: "/panel/ogrenciler", label: "Öğrenci Yönetimi", icon: Users, color: "slate" },
  ]},
  { title: "Analiz & Raporlar", items: [
    { href: "/panel/nedenler", label: "Yönlendirme Nedenleri", icon: Target, color: "amber" },
    { href: "/panel/zaman", label: "Zaman İstatistikleri", icon: CalendarDays, color: "indigo" },
    { href: "/panel/ogretmen", label: "Öğretmen & Sınıf", icon: UserCheck, color: "emerald" },
  ]},
  { title: "İşlemler", items: [
    { href: "/panel/kullanici-yonetimi", label: "Kullanıcı Yönetimi", icon: Users, color: "slate" },
  ]}
];

const teacherMenuItems = [
  { href: "/panel/ogrenci-yonlendirmesi", label: "Öğrenci Yönlendirme", icon: Users, color: "blue" },
  { href: "/panel/sinifim", label: "Sınıfım", icon: GraduationCap, color: "emerald" },
];
const allMenuItems = [...menuCategories.flatMap(cat => cat.items), ...teacherMenuItems];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["Genel","Sınıf Rehberliği","Öğrenci Takip","Analiz & Raporlar","İşlemler"]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setRole(d.role); setIsHomeroom(d.isHomeroom || false); setTeacherName(d.teacherName || null); setRoleLoading(false);
      if (d.role === "admin") {
        fetch("/api/class-student-requests?status=pending")
          .then(r => r.json())
          .then(data => setPendingRequestCount(data.requests?.length || 0))
          .catch(() => {});
      }
    }).catch(() => setRoleLoading(false));
  }, []);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allMenuItems.filter(i => i.label.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Çıkış yapıldı!"); router.push("/login");
  };

  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setSidebarOpen(false); setShowSearch(false); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);
  const toggleCategory = (t: string) => setExpandedCategories(p => p.includes(t) ? p.filter(c => c !== t) : [...p, t]);
  const currentPage = allMenuItems.find(i => isActive(i.href))?.label || "Panel";

  if (roleLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500 mx-auto"></div>
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-3 text-slate-700">
            <div className="p-2 rounded-xl bg-slate-100"><Menu className="h-5 w-5" /></div>
            <span className="text-sm font-semibold">{currentPage}</span>
          </button>
          <button onClick={() => setShowSearch(true)} className="p-2 rounded-xl bg-slate-100 text-slate-500"><Search className="h-5 w-5" /></button>
        </div>
      </div>
      {sidebarOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />}
      {showSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSearch(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-slate-200">
              <Search className="h-5 w-5 text-slate-400" />
              <input type="text" placeholder="Menüde ara..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-slate-800" autoFocus />
              <button onClick={() => setShowSearch(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredMenuItems && filteredMenuItems.length > 0 ? filteredMenuItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                  </Link>
                );
              }) : <div className="p-8 text-center text-slate-400"><p>Ara...</p></div>}
            </div>
          </div>
        </div>
      )}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 ${sidebarCollapsed ? "w-20" : "w-72"} bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800/50 transform transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} flex flex-col shadow-xl`}>
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              {!sidebarCollapsed && <div><h2 className="text-base font-bold text-white">RPD Panel</h2><p className="text-[10px] text-slate-500">Rehberlik Sistemi</p></div>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-400"><X className="h-4 w-4" /></button>
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:flex p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
              </button>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {role === "teacher" && (
            <div className="space-y-1 px-1">
              {[
                { href: "/panel/ogrenci-yonlendirmesi", label: "Öğrenci Yönlendirme" },
                { href: "/panel/sinifim", label: "Sınıfım" },
              ].map(item => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {role !== "teacher" && menuCategories.map(category => (
            <div key={category.title} className="mb-2">
              {!sidebarCollapsed && (
                <button onClick={() => toggleCategory(category.title)} className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <span>{category.title}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedCategories.includes(category.title) ? "" : "-rotate-90"}`} />
                </button>
              )}
              {(sidebarCollapsed || expandedCategories.includes(category.title)) && (
                <div className="space-y-1">
                  {category.items.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${sidebarCollapsed ? "justify-center" : ""} ${active ? "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>
                        <div className={`p-1.5 rounded-lg ${active ? "bg-white/20" : "bg-slate-800"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
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
        <div className="p-3 border-t border-slate-800/50 bg-slate-950/50 space-y-1">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 mb-1">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${role === "admin" ? "bg-gradient-to-br from-cyan-500 to-teal-600" : "bg-gradient-to-br from-violet-500 to-purple-600"}`}>
                {role === "admin" ? "Y" : (teacherName ? teacherName.charAt(0).toUpperCase() : "Ö")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{role === "admin" ? "Yönetici" : (teacherName || "Öğretmen")}</p>
                <p className="text-[10px] text-slate-500">{role === "admin" ? "Tam erişim" : (isHomeroom ? "Sınıf Rehber Öğretmeni" : "Öğretmen")}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group">
            <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-red-500/20"><LogOut className="h-4 w-4" /></div>
            {!sidebarCollapsed && "Çıkış Yap"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto mt-16 lg:mt-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {/* Admin: pending class-student requests banner */}
        {role === "admin" && pendingRequestCount > 0 && !bannerDismissed && (
          <div className="mx-4 lg:mx-6 mt-4 lg:mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
            <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <p className="flex-1 text-sm text-amber-800">
              <span className="font-semibold">{pendingRequestCount}</span> bekleyen sınıf talebi var
              {" "}(öğrenci silme / sınıf değiştirme)
            </p>
            <Link
              href="/panel/sinif-talepleri"
              className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
            >
              İncele
            </Link>
            <button onClick={() => setBannerDismissed(true)} className="p-1 rounded-lg hover:bg-amber-100 text-amber-500 shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
