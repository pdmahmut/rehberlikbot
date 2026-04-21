"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, Loader2, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import RPDYonlendirme from "@/components/RPDYonlendirme";
import SinifimPage from "@/app/panel/sinifim/page";

interface SessionPayload {
  role: string;
  teacherName?: string;
  classKey?: string;
  classDisplay?: string;
  isHomeroom?: boolean;
}

type Tab = "yonlendirme" | "sinifim";

export default function OgretmenPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("yonlendirme");

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        setSession(data);
        setSessionLoaded(true);
      })
      .catch(() => setSessionLoaded(true));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Çıkış yapıldı");
    router.push("/login");
  };

  const isHomeroom = !!(session?.classKey);

  const tabs = [
    { id: "yonlendirme" as Tab, label: "Yönlendirme", icon: Send },
    ...(isHomeroom ? [{ id: "sinifim" as Tab, label: "Sınıfım", icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Üst bar */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 text-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Rehberlik Sistemi</h1>
              {session?.teacherName && (
                <p className="text-white/60 text-xs">Hoş geldiniz, {session.teacherName}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="text-white/80 hover:text-white hover:bg-white/10 gap-2">
            <LogOut className="h-4 w-4" />
            Çıkış
          </Button>
        </div>

        {/* Sekmeler */}
        {sessionLoaded && tabs.length > 1 && (
          <div className="max-w-4xl mx-auto mt-4 flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-teal-700 shadow"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* İçerik */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {!sessionLoaded ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        ) : activeTab === "yonlendirme" ? (
          <RPDYonlendirme
            teacherName={session?.teacherName}
            classKey={session?.classKey ?? undefined}
            classDisplay={session?.classDisplay ?? undefined}
          />
        ) : activeTab === "sinifim" ? (
          <SinifimPage />
        ) : null}
      </div>
    </div>
  );
}