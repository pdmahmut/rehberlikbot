"use client";

import { useState, useEffect } from "react";
import RPDYonlendirme from "@/components/RPDYonlendirme";

export default function OgrenciYonlendirmesiPage() {
  const [teacherName, setTeacherName] = useState<string | undefined>(undefined);
  const [classKey, setClassKey] = useState<string | undefined>(undefined);
  const [classDisplay, setClassDisplay] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.role === "teacher" && d.teacherName) setTeacherName(d.teacherName);
        if (d.isHomeroom && d.classKey) {
          setClassKey(d.classKey);
          setClassDisplay(d.classDisplay || undefined);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <RPDYonlendirme
      teacherName={teacherName}
      classKey={classKey}
      classDisplay={classDisplay}
    />
  );
}
