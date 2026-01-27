export type TodayStudent = {
  student_name: string;
  class_display: string;
  reason?: string;
  teacher_name?: string;
  created_at?: string;
};

export type ReferralStudent = {
  student_name: string;
  class_display: string;
  reason?: string;
  date: string;
  teacher_name?: string;
  created_at?: string;
};

export type StatsResponse = {
  serverTime?: string;
  todayCount: number;
  weekCount: number;
  monthCount?: number;
  totalCount?: number;
  topTeacher: { name: string; count: number } | null;
  todayStudents?: TodayStudent[];
  allStudents?: ReferralStudent[];
  byTeacher?: Record<string, number>;
  byClass?: Record<string, number>;
  byReason?: Record<string, number>;
  byReasonToday?: Record<string, number>;
  byReasonWeek?: Record<string, number>;
  byReasonMonth?: Record<string, number>;
};

export type ClassStudent = {
  id: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_number: string | null;
};

export type TimeFilter = "today" | "week" | "month" | "all" | "custom";
