"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, GraduationCap, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "teacher" | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!role) return;
    if (role === "admin" && !password) { toast.error("Şifre gerekli"); return; }
    if (role === "teacher" && !password) {
      toast.error("Şifre gerekli"); return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, password })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Giriş başarısız"); return; }
      toast.success("Giriş başarılı");
      if (data.role === "admin") router.push("/panel");
      else router.push("/panel/ogrenci-yonlendirmesi");
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRole(null);
    setPassword("");
    setShowPassword(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden bg-slate-950">
      {/* Arka plan */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo / Başlık */}
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 opacity-20 blur-md -z-10" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Rehberlik Sistemi</h1>
          <p className="text-white/40 text-sm mt-1.5">
            {!role ? "Giriş türünü seçin" : role === "admin" ? "Yönetici girişi" : "Öğretmen girişi"}
          </p>
        </div>

        {/* Kart */}
        <Card className="rounded-2xl shadow-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
          <CardContent className="p-5 space-y-4">
            {!role ? (
              /* ROL SEÇİM EKRANI */
              <div className="space-y-3">
                <button
                  onClick={() => setRole("teacher")}
                  className="group w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-violet-400/40 px-4 py-3.5 transition-all duration-300 text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 transition-transform duration-300 group-hover:scale-105">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Öğretmen Girişi</div>
                    <div className="text-xs text-white/40">Öğrenci yönlendirme</div>
                  </div>
                </button>

                <button
                  onClick={() => setRole("admin")}
                  className="group w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-emerald-400/40 px-4 py-3.5 transition-all duration-300 text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-105">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Yönetici Girişi</div>
                    <div className="text-xs text-white/40">Tüm panel erişimi</div>
                  </div>
                </button>
              </div>
            ) : (
              /* GİRİŞ FORMU */
              <div className="space-y-4">
                {/* Geri + rol etiketi */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Geri
                  </button>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    role === "admin"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-violet-500/15 text-violet-400"
                  }`}>
                    {role === "admin" ? <Shield className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                    {role === "admin" ? "Yönetici" : "Öğretmen"}
                  </div>
                </div>

                {/* Şifre */}
                <div>
                  <Label className="text-xs font-medium text-white/50 mb-1.5 block">
                    {role === "teacher" ? "Giriş Şifresi" : "Şifre"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      placeholder="••••••••"
                      className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/20 pr-10 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className={`w-full h-11 rounded-xl font-semibold text-white border-0 shadow-lg transition-all duration-300 ${
                    role === "admin"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20"
                      : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-violet-500/20"
                  }`}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Giriş Yap
                </Button>
                {role === "teacher" && (
                  <p className="text-[11px] text-white/30 text-center">Yönetici tarafından verilen giriş şifrenizi kullanın.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alt bilgi */}
        <p className="text-center text-[11px] text-white/20">RPD Öğrenci Takip Sistemi</p>
      </div>
    </div>
  );
}
