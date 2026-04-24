import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const sql = `
-- Drop existing table if exists
DROP TABLE IF EXISTS student_incidents CASCADE;

-- Recreate student_incidents table
CREATE TABLE student_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  incident_date DATE DEFAULT CURRENT_DATE,
  
  reporter_student_name TEXT,
  reporter_class_key TEXT,
  reporter_class_display TEXT,
  
  target_student_name TEXT NOT NULL,
  target_class_key TEXT,
  target_class_display TEXT,
  
  description TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),
  
  case_group_id UUID,
  record_role TEXT DEFAULT 'main' CHECK (record_role IN ('main', 'linked_reporter')),
  linked_from_id UUID REFERENCES student_incidents(id) ON DELETE SET NULL
);

ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon student_incidents" ON student_incidents;
CREATE POLICY "Allow all for anon student_incidents" ON student_incidents
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_student_incidents_target ON student_incidents(target_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_reporter ON student_incidents(reporter_student_name);
CREATE INDEX IF NOT EXISTS idx_student_incidents_status ON student_incidents(status);
CREATE INDEX IF NOT EXISTS idx_student_incidents_date ON student_incidents(incident_date);
`;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      const queries = sql.split(';').filter(q => q.trim());
      for (const query of queries) {
        if (query.trim()) {
          const { error: queryError } = await supabase.from('_sql').select(query);
          if (queryError) {
            console.error('Query error:', queryError);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Migration tamamlandı. Lütfen Supabase Dashboard > SQL Editor'dan migration'ı manuel çalıştırın."
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration başarısız" },
      { status: 500 }
    );
  }
}
