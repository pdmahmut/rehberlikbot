'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  History,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const menuCategories = [
  { title: 'Genel', items: [{ href: '/panel/takvim', label: 'Takvim', icon: Calendar }] },
  {
    title: 'Sınıf Rehberliği',
    items: [
      { href: '/panel/sinif-rehberligi', label: 'Sınıf Rehberliği', icon: BookOpen },
      { href: '/panel/ogretmen-yonetimi', label: 'Öğretmen Yönetimi', icon: Users },
    ],
  },
  {
    title: 'Öğrenci Takip',
    items: [
      { href: '/panel/basvurular', label: 'Başvurular', icon: MessageSquare },
      { href: '/panel/ogrenci-listesi', label: 'Öğrenci Listesi', icon: GraduationCap },
      { href: '/panel/ogrenci-gecmisi', label: 'Öğrenci Geçmişi', icon: History },
      { href: '/panel/vaka-dosyalari', label: 'Vaka Dosyaları', icon: FolderOpen },
      { href: '/panel/ogrenciler', label: 'Öğrenci Yönetimi', icon: Users },
    ],
  },
  {
    title: 'Analiz ve Raporlar',
    items: [
      { href: '/panel/nedenler', label: 'Yönlendirme Nedenleri', icon: Target },
      { href: '/panel/zaman', label: 'Zaman İstatistikleri', icon: CalendarDays },
      { href: '/panel/ogretmen', label: 'Öğretmen ve Sınıf', icon: UserCheck },
    ],
  },
  {
    title: 'İşlemler',
    items: [{ href: '/panel/kullanici-yonetimi', label: 'Kullanıcı Yönetimi', icon: Users }],
  },
];

const teacherMenuItems = [
  { href: '/panel/ogrenci-yonlendirmesi', label: 'Öğrenci Yönlendirme', icon: Users },
  { href: '/panel/sinifim', label: 'Sınıfım', icon: GraduationCap },
];

const allMenuItems = [...menuCategories.flatMap((category) => category.items), ...teacherMenuItems];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'Genel',
    'Sınıf Rehberliği',
    'Öğrenci Takip',
    'Analiz ve Raporlar',
    'İşlemler',
  ]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data) => {
        setRole(data.role);
        setIsHomeroom(data.isHomeroom || false);
        setTeacherName(data.teacherName || null);
        setRoleLoading(false);

        if (data.role === 'admin') {
          fetch('/api/class-student-requests?status=pending')
            .then((response) => response.json())
            .then((pendingData) => setPendingRequestCount(pendingData.requests?.length || 0))
            .catch(() => {});
        }
      })
      .catch(() => setRoleLoading(false));
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allMenuItems.filter((item) => item.label.toLowerCase().includes(query));
  }, [searchQuery]);

  const isActive = (href: string) => pathname.startsWith(href);
  const currentPage = allMenuItems.find((item) => isActive(item.href))?.label || 'Panel';

  const toggleCategory = (title: string) => {
    setExpandedCategories((previous) =>
      previous.includes(title)
        ? previous.filter((item) => item !== title)
        : [...previous, title]
    );
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('Çıkış yapıldı');
    router.push('/login');
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500" />
          <p className="text-sm text-slate-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const sidebarWidthClass = sidebarCollapsed ? 'lg:w-20' : 'lg:w-72';

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex min-w-0 items-center gap-3 text-slate-700"
          >
            <div className="rounded-xl bg-slate-100 p-2">
              <Menu className="h-5 w-5" />
            </div>
            <span className="truncate text-sm font-semibold">{currentPage}</span>
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="rounded-xl bg-slate-100 p-2 text-slate-500"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
      )}

      {showSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-20">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSearch(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-200 p-4">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Menü içinde ara..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-slate-800 outline-none"
              />
              <button onClick={() => setShowSearch(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredMenuItems && filteredMenuItems.length > 0 ? (
                filteredMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">{item.label}</span>
                      <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>Arama sonucu bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 ${sidebarWidthClass} w-[86vw] max-w-[320px] transform border-r border-slate-800/50 bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} lg:static flex flex-col`}
      >
        <div className="border-b border-slate-800/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
              <div className="rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 p-2.5 shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              {(!sidebarCollapsed || role === 'teacher') && (
                <div>
                  <h2 className="text-base font-bold text-white">RPD Panel</h2>
                  <p className="text-[10px] text-slate-500">Rehberlik Sistemi</p>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg bg-slate-800 p-2 text-slate-400 lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSidebarCollapsed((previous) => !previous)}
                className="hidden rounded-lg bg-slate-800 p-2 text-slate-400 hover:text-white lg:flex"
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {role === 'teacher' ? (
            <div className="space-y-2">
              {teacherMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className={`rounded-lg p-1.5 ${active ? 'bg-white/20' : 'bg-slate-800'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            menuCategories.map((category) => (
              <div key={category.title} className="mb-2">
                {!sidebarCollapsed && (
                  <button
                    onClick={() => toggleCategory(category.title)}
                    className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    <span>{category.title}</span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        expandedCategories.includes(category.title) ? '' : '-rotate-90'
                      }`}
                    />
                  </button>
                )}

                {(sidebarCollapsed || expandedCategories.includes(category.title)) && (
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                            sidebarCollapsed ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg'
                              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                          }`}
                        >
                          <div className={`rounded-lg p-1.5 ${active ? 'bg-white/20' : 'bg-slate-800'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {sidebarCollapsed && (
                            <div className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                              {item.label}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </nav>

        <div className="space-y-2 border-t border-slate-800/50 bg-slate-950/50 p-3">
          {(!sidebarCollapsed || role === 'teacher') && (
            <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-800/30 px-3 py-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${
                  role === 'admin'
                    ? 'bg-gradient-to-br from-cyan-500 to-teal-600'
                    : 'bg-gradient-to-br from-violet-500 to-purple-600'
                }`}
              >
                {role === 'admin' ? 'Y' : teacherName ? teacherName.charAt(0).toUpperCase() : 'Ö'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">
                  {role === 'admin' ? 'Yönetici' : teacherName || 'Öğretmen'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {role === 'admin'
                    ? 'Tam erişim'
                    : isHomeroom
                      ? 'Sınıf Rehber Öğretmeni'
                      : 'Öğretmen'}
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <div className="rounded-lg bg-slate-800 p-1.5 group-hover:bg-red-500/20">
              <LogOut className="h-4 w-4" />
            </div>
            {(!sidebarCollapsed || role === 'teacher') && 'Çıkış Yap'}
          </button>
        </div>
      </aside>

      <main className="mt-16 flex-1 overflow-auto pb-20 lg:mt-0 lg:pb-0">
        {role === 'admin' && pendingRequestCount > 0 && !bannerDismissed && (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm lg:mx-6">
            <div className="shrink-0 rounded-lg bg-amber-100 p-1.5">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            <p className="flex-1 text-sm text-amber-800">
              <span className="font-semibold">{pendingRequestCount}</span> bekleyen sınıf talebi var
              {' '}(öğrenci silme veya sınıf değiştirme).
            </p>
            <Link
              href="/panel/sinif-talepleri"
              className="shrink-0 text-sm font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              İncele
            </Link>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 rounded-lg p-1 text-amber-500 hover:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="p-4 lg:p-6">{children}</div>
      </main>

      {role === 'teacher' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {teacherMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
