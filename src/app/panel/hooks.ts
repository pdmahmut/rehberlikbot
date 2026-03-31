"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { StatsResponse, TimeFilter, ClassStudent } from "./types";
import { GUIDANCE_REFERRALS_CHANGED_EVENT } from "@/lib/guidance";

export function usePanelData() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [classes, setClasses] = useState<{ value: string; text: string }[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  const getDateRange = useCallback((filter: TimeFilter, customDateValue?: string) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    switch (filter) {
      case "today":
        return { from: todayStr, to: todayStr };
      case "week": {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        return { from: startOfWeek.toISOString().slice(0, 10), to: todayStr };
      }
      case "month": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: startOfMonth.toISOString().slice(0, 10), to: todayStr };
      }
      case "custom": {
        if (customDateValue) {
          return { from: customDateValue, to: customDateValue };
        }
        return {};
      }
      default:
        return {};
    }
  }, []);

  const fetchStats = useCallback(async (teacher?: string, classKey?: string, timeRange?: TimeFilter, customDate?: string, showToast = false) => {
    try {
      setLoadingStats(true);
      setStatsError(null);
      const params = new URLSearchParams();
      if (teacher) params.set("teacher", teacher);
      if (classKey) params.set("class", classKey);
      
      if (timeRange) {
        const range = getDateRange(timeRange, customDate);
        if (range.from) params.set("from", range.from);
        if (range.to) params.set("to", range.to);
      }
      
      const query = params.toString();
      const res = await fetch(`/api/stats${query ? `?${query}` : ""}`);
      if (!res.ok) {
        throw new Error("İstatistik isteği başarısız");
      }
      const json = (await res.json()) as StatsResponse;
      setStats(json);
      if (showToast) {
        toast.success("İstatistikler güncellendi");
      }
      return json;
    } catch (error) {
      console.error("Panel stats error:", error);
      setStatsError("İstatistikler yüklenemedi");
      toast.error("İstatistikler yüklenemedi");
      return null;
    } finally {
      setLoadingStats(false);
    }
  }, [getDateRange]);

  const getClassDisplayText = useCallback((classValue?: string) => {
    if (!classValue) return undefined;
    return classes.find(c => c.value === classValue)?.text || classValue;
  }, [classes]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoadingFilters(true);
        const [tRes, cRes] = await Promise.all([
          fetch("/api/teachers"),
          fetch("/api/data"),
        ]);

        if (tRes.ok) {
          const tJson = await tRes.json();
          if (Array.isArray(tJson.teachers)) {
            setTeachers(
              tJson.teachers.map((t: { value: string; label: string }) => ({ value: t.value, label: t.label }))
            );
          }
        }

        if (cRes.ok) {
          const cJson = await cRes.json();
          if (Array.isArray(cJson.sinifSubeList)) {
            setClasses(cJson.sinifSubeList);
          }
        }
      } catch (error) {
        console.error("Panel filters error:", error);
        toast.error("Filtreler yüklenemedi");
      } finally {
        setLoadingFilters(false);
      }
    };

    fetchStats();
    fetchFilters();

    const handleReferralChange = () => {
      fetchStats();
    };

    window.addEventListener(GUIDANCE_REFERRALS_CHANGED_EVENT, handleReferralChange);

    return () => {
      window.removeEventListener(GUIDANCE_REFERRALS_CHANGED_EVENT, handleReferralChange);
    };
  }, [fetchStats]);

  return {
    stats,
    setStats,
    loadingStats,
    statsError,
    teachers,
    classes,
    loadingFilters,
    fetchStats,
    getDateRange,
    getClassDisplayText,
  };
}

export function useClassStudents() {
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const loadClassStudents = useCallback(async (classKey: string, showToast = false) => {
    if (!classKey) {
      setClassStudents([]);
      return;
    }
    try {
      setLoadingStudents(true);
      setStudentError(null);
      const res = await fetch(`/api/class-students?classKey=${encodeURIComponent(classKey)}`);
      if (!res.ok) {
        throw new Error("Öğrenci listesi isteği başarısız");
      }
      const json = await res.json();
      const students = Array.isArray(json.students) ? json.students : [];
      setClassStudents(students);
      if (showToast) {
        toast.success(`${students.length} öğrenci yüklendi`);
      }
    } catch (error) {
      console.error("Panel class students error:", error);
      setStudentError("Öğrenciler yüklenemedi");
      toast.error("Öğrenciler yüklenemedi");
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  return {
    classStudents,
    setClassStudents,
    loadingStudents,
    studentError,
    setStudentError,
    loadClassStudents,
  };
}
