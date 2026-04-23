"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, GraduationCap, Loader2, Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Başlık */}
        <div className="text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-xl">
              <GraduationCap className="h-9 w-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Rehberlik Sistemi</h1>
          <p className="text-white/60 text-sm mt-1">Lütfen giriş türünü seçin</p>
        </div>

        <Card className="rounded-2xl shadow-2xl border-0">
          <CardContent className="p-6 space-y-5">
            {!role ? (
              /* ROL SEÇİM EKRANI */
              <div className="space-y-3">
                <button
                  onClick={() => setRole("teacher")}
                  className="w-full flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50 px-5 py-4 transition-all text-left"
                >
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Öğretmen Girişi</div>
                    <div className="text-xs text-slate-500">Öğrenci yönlendirme</div>
                  </div>
                </button>

                <button
                  onClick={() => setRole("admin")}
                  className="w-full flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50 px-5 py-4 transition-all text-left"
                >
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Yönetici Girişi</div>
                    <div className="text-xs text-slate-500">Tüm panel erişimi</div>
                  </div>
                </button>
              </div>
            ) : (
              /* GİRİŞ FORMU */
              <div className="space-y-4">
                {/* Geri + rol etiketi */}
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="text-slate-400 hover:text-slate-600 text-sm">← Geri</button>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    role === "admin" ? "bg-cyan-100 text-cyan-700" : "bg-violet-100 text-violet-700"
                  }`}>
                    {role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
                    {role === "admin" ? "Yönetici" : "Öğretmen"}
                  </div>
                </div>

                {/* Şifre */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {role === "teacher" ? "Giriş Şifresi" : "Şifre"}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      placeholder="••••••••"
                      className="pr-10"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className={`w-full h-11 font-semibold text-white border-0 ${
                    role === "admin"
                      ? "bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
                      : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  }`}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Giriş Yap
                </Button>
                {role === "teacher" && (
                  <p className="text-xs text-slate-500">Yönetici tarafından verilen giriş şifrenizi kullanın.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
