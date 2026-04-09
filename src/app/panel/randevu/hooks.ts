"use client";

"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Appointment, 
  AppointmentFormData, 
  AppointmentClosureData,
  AppointmentTask,
  AppointmentStatus 
} from "@/types";
import { parseJsonResponse, parseResponseError } from "@/lib/utils";

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Randevu yönetimi hook'u
export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Randevuları getir
  const fetchAppointments = useCallback(async (params?: {
    date?: string;
    from?: string;
    to?: string;
    status?: AppointmentStatus;
    participantType?: string;
    priority?: string;
    search?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = new URLSearchParams();
      if (params?.date) searchParams.set("date", params.date);
      if (params?.from) searchParams.set("from", params.from);
      if (params?.to) searchParams.set("to", params.to);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.participantType) searchParams.set("participantType", params.participantType);
      if (params?.priority) searchParams.set("priority", params.priority);
      if (params?.search) searchParams.set("search", params.search);

      const query = searchParams.toString();
      const res = await fetch(`/api/appointments${query ? `?${query}` : ""}`, {
        headers: { Accept: "application/json" }
      });
      
      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Randevular alınamadı");
      }
      
      const data = await parseJsonResponse<{ appointments?: Appointment[] }>(res);
      setAppointments(data.appointments || []);
      return data.appointments;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      setError(message);
      toast.error(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Yeni randevu oluştur
  const createAppointment = useCallback(async (formData: AppointmentFormData) => {
    try {
      setLoading(true);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Randevu oluşturulamadı");
      }

      const data = await parseJsonResponse<{ appointment: Appointment }>(res);
      setAppointments(prev => [...prev, data.appointment]);
      toast.success("Randevu oluşturuldu");
      return data.appointment;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Randevu güncelle
  const updateAppointment = useCallback(async (id: string, updateData: Partial<Appointment>) => {
    try {
      setLoading(true);
      const res = await fetch("/api/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, ...updateData })
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Randevu güncellenemedi");
      }

      const data = await parseJsonResponse<{ appointment: Appointment }>(res);
      setAppointments(prev =>
        prev.map(apt => apt.id === id ? { ...apt, ...data.appointment } : apt)
      );
      toast.success("Randevu güncellendi");
      return data.appointment;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Görüşme kapanışı
  const closeAppointment = useCallback(async (id: string, closureData: AppointmentClosureData) => {
    try {
      setLoading(true);
      
      const updateData: Partial<Appointment> = {
        status: closureData.status,
        outcome_summary: closureData.outcome_summary,
        outcome_decision: closureData.outcome_decision,
        next_action: closureData.next_action
      };

      const res = await fetch("/api/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, ...updateData })
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Görüşme kapatılamadı");
      }

      const data = await parseJsonResponse<{ appointment: Appointment }>(res);
      
      // Takip randevusu oluştur
      if (closureData.create_follow_up && closureData.status === "attended") {
        // Mevcut randevuyu al
        const currentAppointment = appointments.find(a => a.id === id);
        if (currentAppointment) {
          // 1 hafta sonrası için takip randevusu öner
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 7);
          
          const followUpData: AppointmentFormData = {
            appointment_date: getLocalDateString(nextDate),
            start_time: currentAppointment.start_time,
            duration: currentAppointment.duration,
            participant_type: currentAppointment.participant_type,
            participant_name: currentAppointment.participant_name,
            participant_class: currentAppointment.participant_class,
            topic_tags: currentAppointment.topic_tags,
            location: currentAppointment.location,
            purpose: `Takip görüşmesi - ${currentAppointment.purpose || ""}`,
            priority: "normal"
          };
          
          await createAppointment(followUpData);
        }
      }

      setAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, ...data.appointment } : apt)
      );
      
      toast.success("Görüşme kaydedildi");
      return data.appointment;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [appointments, createAppointment]);

  // Randevu sil
  const deleteAppointment = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/appointments?id=${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Randevu silinemedi");
      }

      setAppointments(prev => prev.filter(apt => apt.id !== id));
      toast.success("Randevu silindi");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu";
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bugünkü randevuları getir
  const getTodayAppointments = useCallback(() => {
    const today = getLocalDateString(new Date());
    return appointments.filter(apt => apt.appointment_date === today);
  }, [appointments]);

  // Bu haftanın randevularını getir
  const getWeekAppointments = useCallback(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Pazartesi
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Pazar

    const start = getLocalDateString(startOfWeek);
    const end = getLocalDateString(endOfWeek);

    return appointments.filter(apt => 
      apt.appointment_date >= start && apt.appointment_date <= end
    );
  }, [appointments]);

  // Durum bazlı sayılar
  const getStatusCounts = useCallback(() => {
    const counts = {
      planned: 0,
      attended: 0,
      not_attended: 0,
      postponed: 0,
      cancelled: 0
    };
    
    appointments.forEach(apt => {
      if (counts[apt.status] !== undefined) {
        counts[apt.status]++;
      }
    });
    
    return counts;
  }, [appointments]);

  return {
    appointments,
    loading,
    error,
    fetchAppointments,
    createAppointment,
    updateAppointment,
    closeAppointment,
    deleteAppointment,
    getTodayAppointments,
    getWeekAppointments,
    getStatusCounts
  };
}

// Randevu görevleri hook'u
export function useAppointmentTasks() {
  const [tasks, setTasks] = useState<AppointmentTask[]>([]);
  const [loading, setLoading] = useState(false);

  // Görevleri getir
  const fetchTasks = useCallback(async (appointmentId?: string) => {
    try {
      setLoading(true);
      const params = appointmentId ? `?appointmentId=${appointmentId}` : "";
      const res = await fetch(`/api/appointment-tasks${params}`, {
        headers: { Accept: "application/json" }
      });
      
      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Görevler alınamadı");
      }
      
      const data = await parseJsonResponse<{ tasks?: AppointmentTask[] }>(res);
      setTasks(data.tasks || []);
      return data.tasks;
    } catch (err) {
      toast.error("Görevler yüklenemedi");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Yeni görev oluştur
  const createTask = useCallback(async (appointmentId: string, description: string, dueDate?: string) => {
    try {
      const res = await fetch("/api/appointment-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          task_description: description,
          due_date: dueDate
        })
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Görev oluşturulamadı");
      }

      const data = await parseJsonResponse<{ task: AppointmentTask }>(res);
      setTasks(prev => [...prev, data.task]);
      toast.success("Görev eklendi");
      return data.task;
    } catch (err) {
      toast.error("Görev eklenemedi");
      return null;
    }
  }, []);

  // Görevi tamamla
  const toggleTask = useCallback(async (id: string, completed: boolean) => {
    try {
      const res = await fetch("/api/appointment-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, is_completed: completed })
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Görev güncellenemedi");
      }

      const data = await parseJsonResponse<{ task: AppointmentTask }>(res);
      setTasks(prev => 
        prev.map(task => task.id === id ? data.task : task)
      );
      return data.task;
    } catch (err) {
      toast.error("Görev güncellenemedi");
      return null;
    }
  }, []);

  // Görev sil
  const deleteTask = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/appointment-tasks?id=${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        const errorText = await parseResponseError(res);
        throw new Error(errorText || "Görev silinemedi");
      }

      setTasks(prev => prev.filter(task => task.id !== id));
      toast.success("Görev silindi");
      return true;
    } catch (err) {
      toast.error("Görev silinemedi");
      return false;
    }
  }, []);

  // Tamamlanmamış görevler
  const getPendingTasks = useCallback(() => {
    return tasks.filter(task => !task.is_completed);
  }, [tasks]);

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    toggleTask,
    deleteTask,
    getPendingTasks
  };
}

// Tarih yardımcı fonksiyonları
export function useCalendarHelpers() {
  // Haftanın günlerini getir
  const getWeekDays = useCallback((date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay() + 1); // Pazartesi
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, []);

  // Saat dilimlerini getir (08:00 - 17:00)
  const getTimeSlots = useCallback((startHour = 8, endHour = 17, interval = 30) => {
    const slots = [];
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += interval) {
        const time = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  }, []);

  // Tarih formatlama
  const formatDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }, []);

  // Kısa tarih formatlama
  const formatShortDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short"
    });
  }, []);

  // Gün adı
  const getDayName = useCallback((date: Date) => {
    return date.toLocaleDateString("tr-TR", { weekday: "short" });
  }, []);

  // Bugün mü kontrolü
  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  return {
    getWeekDays,
    getTimeSlots,
    formatDate,
    formatShortDate,
    getDayName,
    isToday
  };
}
