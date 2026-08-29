"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  Loader2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PreviewStudent {
  sira: number;
  ogrenciNo: string;
  ad: string;
  soyad: string;
}

interface PreviewClass {
  classKey: string;
  classDisplay: string;
  studentCount: number;
  isNew: boolean;
  students: PreviewStudent[];
}

interface Preview {
  fileName: string;
  classes: PreviewClass[];
  totals: {
    classCount: number;
    studentCount: number;
    newClassCount: number;
    currentStudentCount: number;
    currentClassCount: number;
  };
  warnings: { duplicates: string[]; incomplete: string[] };
}

type Mode = "classes" | "merge";

export default function OgrenciYuklePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<Mode>("classes");
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleFile = async (file: File) => {
    setReading(true);
    setPreview(null);
    setConfirmOpen(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/class-list/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PDF okunamadı");
      setPreview(data);
      toast.success(
        data.totals.classCount + " sınıf, " + data.totals.studentCount + " öğrenci okundu"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF okunamadı");
    } finally {
      setReading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/class-list/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          fileName: preview.fileName,
          classes: preview.classes.map((c) => ({
            classKey: c.classKey,
            classDisplay: c.classDisplay,
            students: c.students,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");

      toast.success(
        data.classCount +
          " sınıf, " +
          data.insertedCount +
          " öğrenci kaydedildi" +
          (data.removedCount ? " (" + data.removedCount + " eski kayıt silindi)" : "")
      );
      setPreview(null);
      setConfirmOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const hasWarnings =
    preview !== null &&
    (preview.warnings.duplicates.length > 0 || preview.warnings.incomplete.length > 0);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-green-700 p-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-3">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Öğrenci Listesi Yükle</h1>
            <p className="text-sm text-white/80">
              Sınıf listesi PDF dosyasını yükleyin; sınıflar ve öğrenciler otomatik oluşturulur
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
            <FileUp className="h-10 w-10 text-slate-400" />
            <div>
              <p className="font-medium text-slate-700">Sınıf listesi PDF dosyasını seçin</p>
              <p className="text-sm text-slate-500">
                Sınıf başlıkları ve öğrenci satırları otomatik okunur
              </p>
            </div>
            <Button onClick={() => fileRef.current?.click()} disabled={reading}>
              {reading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Okunuyor...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> PDF Seç
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Önizleme</h2>
                  <p className="text-sm text-slate-500">{preview.fileName}</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {preview.totals.classCount}
                    </div>
                    <div className="text-slate-500">sınıf</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {preview.totals.studentCount}
                    </div>
                    <div className="text-slate-500">öğrenci</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Sistemde şu an <strong>{preview.totals.currentClassCount}</strong> sınıf ve{" "}
                <strong>{preview.totals.currentStudentCount}</strong> öğrenci kayıtlı.
              </div>

              {hasWarnings && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-1 flex items-center gap-2 font-medium text-amber-800">
                    <AlertTriangle className="h-4 w-4" /> Dikkat edilmesi gerekenler
                  </div>
                  <ul className="ml-6 list-disc space-y-0.5 text-sm text-amber-700">
                    {preview.warnings.duplicates.slice(0, 8).map((d) => (
                      <li key={d}>Aynı sınıfta tekrar eden isim — {d}</li>
                    ))}
                    {preview.warnings.incomplete.slice(0, 8).map((d) => (
                      <li key={d}>Adı veya soyadı okunamadı — {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="divide-y rounded-lg border">
                {preview.classes.map((c) => (
                  <div key={c.classKey}>
                    <button
                      type="button"
                      onClick={() => setOpenClass(openClass === c.classKey ? null : c.classKey)}
                      className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={
                            "h-4 w-4 text-slate-400 transition-transform " +
                            (openClass === c.classKey ? "rotate-180" : "")
                          }
                        />
                        <span className="font-medium text-slate-800">{c.classDisplay}</span>
                        <Badge variant="secondary">{c.classKey}</Badge>
                        {c.isNew && (
                          <Badge className="bg-emerald-100 text-emerald-700">yeni sınıf</Badge>
                        )}
                      </div>
                      <span className="text-sm text-slate-500">{c.studentCount} öğrenci</span>
                    </button>

                    {openClass === c.classKey && (
                      <div className="overflow-x-auto border-t bg-slate-50/60 px-3 pb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-2 pr-4 font-medium">#</th>
                              <th className="py-2 pr-4 font-medium">Okul No</th>
                              <th className="py-2 pr-4 font-medium">Adı</th>
                              <th className="py-2 font-medium">Soyadı</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.students.map((s) => (
                              <tr
                                key={c.classKey + "-" + s.sira}
                                className="border-t border-slate-200"
                              >
                                <td className="py-1.5 pr-4 text-slate-400">{s.sira}</td>
                                <td className="py-1.5 pr-4 font-mono text-slate-600">
                                  {s.ogrenciNo}
                                </td>
                                <td className="py-1.5 pr-4 text-slate-800">{s.ad}</td>
                                <td className="py-1.5 text-slate-800">{s.soyad}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold text-slate-800">Nasıl kaydedilsin?</h2>

              <label className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="mode"
                  className="mt-1"
                  checked={mode === "classes"}
                  onChange={() => setMode("classes")}
                />
                <div>
                  <div className="font-medium text-slate-800">Bu PDF&apos;teki sınıfları güncelle</div>
                  <div className="text-sm text-slate-500">
                    Sadece bu PDF&apos;te bulunan sınıflar yenilenir; o sınıflardaki eski kayıtlar
                    silinip liste baştan yazılır. PDF&apos;te olmayan sınıflara dokunulmaz. Gelen,
                    ayrılan ve sınıfı değişen öğrenciler böyle güncellenir.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-slate-50">
                <input
                  type="radio"
                  name="mode"
                  className="mt-1"
                  checked={mode === "merge"}
                  onChange={() => setMode("merge")}
                />
                <div>
                  <div className="font-medium text-slate-800">Mevcuda ekle</div>
                  <div className="text-sm text-slate-500">
                    Kayıtlı öğrenciler korunur, listede olup sistemde olmayanlar eklenir. Sonradan
                    gelen öğrenciler için.
                  </div>
                </div>
              </label>

              {!confirmOpen ? (
                <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={saving}>
                  Devam Et
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-2 text-red-800">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="text-sm">
                      {mode === "classes" ? (
                        <>
                          <strong>
                            {preview.classes.map((c) => c.classKey).join(", ")}
                          </strong>{" "}
                          sınıflarındaki mevcut kayıtlar silinip yerine {preview.totals.studentCount}{" "}
                          öğrenci yazılacak. Diğer sınıflara dokunulmayacak.
                        </>
                      ) : (
                        <>
                          Mevcut kayıtlar korunarak en fazla {preview.totals.studentCount} öğrenci
                          eklenecek.
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setConfirmOpen(false)}
                      disabled={saving}
                    >
                      Vazgeç
                    </Button>
                    <Button className="flex-1" onClick={handleImport} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Onaylıyorum, kaydet
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
