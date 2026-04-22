import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'var', 'class-student-requests.json');

export interface ClassStudentRequest {
  id: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_value: string | null;
  request_type: 'delete' | 'class_change';
  new_class_key: string | null;
  new_class_display: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
}

function load(): ClassStudentRequest[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function save(data: ClassStudentRequest[]): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getRequests(filters: { status?: string; classKey?: string } = {}): ClassStudentRequest[] {
  let data = load();
  if (filters.status) data = data.filter(r => r.status === filters.status);
  if (filters.classKey) data = data.filter(r => r.class_key === filters.classKey);
  return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function hasPendingRequest(classKey: string, studentName: string, requestType: string): boolean {
  return load().some(
    r => r.class_key === classKey && r.student_name === studentName &&
         r.request_type === requestType && r.status === 'pending'
  );
}

export function createRequest(
  req: Omit<ClassStudentRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'admin_note'>
): ClassStudentRequest {
  const data = load();
  const newReq: ClassStudentRequest = {
    ...req,
    id: makeId(),
    status: 'pending',
    admin_note: null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };
  data.push(newReq);
  save(data);
  return newReq;
}

export function updateRequest(
  id: string,
  updates: { status: 'approved' | 'rejected'; admin_note?: string }
): ClassStudentRequest | null {
  const data = load();
  const idx = data.findIndex(r => r.id === id);
  if (idx === -1) return null;
  data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
  save(data);
  return data[idx];
}

export function getRequest(id: string): ClassStudentRequest | null {
  return load().find(r => r.id === id) || null;
}
