"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export default function HesabimPage() {
  const [role, setRole] = useState<"admin" | "teacher" | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.role === "admin" ? "admin" : "teacher"))
      .finally(() => setLoadingRole(false));
  }, []);

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (newPassword.trim().length < 4) {
      toast.error("Yeni şifre en az 4 karakter olmalı");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifre ve tekrarı eşleşmiyor");
      return;
    }

    setSaving(true);
    try {
      const endpoint = role === "admin" ? "/api/auth/change-admin-password" : "/api/auth/change-password";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: oldPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Şifre güncellenemedi");
      }
      toast.success("Şifreniz güncellendi");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Şifre güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loadingRole) {
    return (
      <div className="mx-auto max-w-xl flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-xl">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-violet-600" />
            {role === "admin" ? "Yönetici Hesabı - Şifre Değiştir" : "Hesabım - Şifre Değiştir"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-1.5">
            <Label>Mevcut Şifre</Label>
            <div className="relative">
              <Input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Mevcut şifreniz"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Yeni Şifre</Label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 4 karakter"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Yeni Şifre (Tekrar)</Label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreyi tekrar yazın"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleChangePassword} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Şifreyi Güncelle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
