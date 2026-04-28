import "server-only";

import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

const TABLE_NAME = "admin_notification_states";
const FILE_PATH = path.join(process.cwd(), "var", "admin-notification-states.json");
const VIEWER_ROLE = "admin";

type StorageMode = "supabase" | "file";

export interface AdminNotificationStateRecord {
  source_type: string;
  source_id: string;
  viewer_role: string;
  read_at: string | null;
  popup_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationStateRef {
  sourceType: string;
  sourceId: string;
}

let resolvedStorageMode: Promise<StorageMode> | null = null;

function loadFileStates(): AdminNotificationStateRecord[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFileStates(states: AdminNotificationStateRecord[]) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(states, null, 2), "utf-8");
}

async function tryEnsureSupabaseTable() {
  if (!supabase) return;

  const sql = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  viewer_role TEXT NOT NULL DEFAULT '${VIEWER_ROLE}',
  read_at TIMESTAMPTZ NULL,
  popup_seen_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_type, source_id, viewer_role)
);

ALTER TABLE ${TABLE_NAME} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon ${TABLE_NAME}" ON ${TABLE_NAME};
CREATE POLICY "Allow all for anon ${TABLE_NAME}" ON ${TABLE_NAME}
  FOR ALL TO anon USING (true) WITH CHECK (true);
`;

  try {
    await supabase.rpc("exec_sql", { sql_query: sql });
  } catch {
    // If the RPC does not exist or permissions are limited, we will fall back later.
  }
}

async function resolveStorageMode(): Promise<StorageMode> {
  if (!resolvedStorageMode) {
    resolvedStorageMode = (async () => {
      if (!supabase) return "file";

      await tryEnsureSupabaseTable();

      try {
        const { error } = await supabase
          .from(TABLE_NAME)
          .select("source_type")
          .limit(1);

        return error ? "file" : "supabase";
      } catch {
        return "file";
      }
    })();
  }

  return resolvedStorageMode;
}

export async function listAdminNotificationStates(): Promise<AdminNotificationStateRecord[]> {
  const storageMode = await resolveStorageMode();

  if (storageMode === "supabase" && supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("viewer_role", VIEWER_ROLE);

    if (!error && data) {
      return data as AdminNotificationStateRecord[];
    }
  }

  return loadFileStates().filter((item) => item.viewer_role === VIEWER_ROLE);
}

export async function upsertAdminNotificationStates(
  updates: Array<
    AdminNotificationStateRef & {
      readAt?: string;
      popupSeenAt?: string;
    }
  >
) {
  if (updates.length === 0) return;

  const currentStates = await listAdminNotificationStates();
  const currentMap = new Map(
    currentStates.map((item) => [
      `${item.source_type}:${item.source_id}:${item.viewer_role}`,
      item,
    ])
  );
  const now = new Date().toISOString();

  const mergedRows = updates.map((update) => {
    const key = `${update.sourceType}:${update.sourceId}:${VIEWER_ROLE}`;
    const existing = currentMap.get(key);

    return {
      source_type: update.sourceType,
      source_id: update.sourceId,
      viewer_role: VIEWER_ROLE,
      read_at: update.readAt ?? existing?.read_at ?? null,
      popup_seen_at: update.popupSeenAt ?? existing?.popup_seen_at ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    } satisfies AdminNotificationStateRecord;
  });

  const storageMode = await resolveStorageMode();

  if (storageMode === "supabase" && supabase) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(mergedRows, { onConflict: "source_type,source_id,viewer_role" });

    if (!error) return;
  }

  const fileStates = loadFileStates();
  const fileMap = new Map(
    fileStates.map((item) => [
      `${item.source_type}:${item.source_id}:${item.viewer_role}`,
      item,
    ])
  );

  mergedRows.forEach((row) => {
    fileMap.set(`${row.source_type}:${row.source_id}:${row.viewer_role}`, row);
  });

  saveFileStates(Array.from(fileMap.values()));
}

export async function markAdminNotificationsRead(refs: AdminNotificationStateRef[]) {
  const timestamp = new Date().toISOString();
  await upsertAdminNotificationStates(
    refs.map((ref) => ({ ...ref, readAt: timestamp }))
  );
}

export async function markAdminNotificationsPopupSeen(refs: AdminNotificationStateRef[]) {
  const timestamp = new Date().toISOString();
  await upsertAdminNotificationStates(
    refs.map((ref) => ({ ...ref, popupSeenAt: timestamp }))
  );
}
