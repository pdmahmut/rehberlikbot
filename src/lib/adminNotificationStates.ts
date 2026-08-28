import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Yoneticinin bildirim okundu / popup goruldu / silindi isaretleri.
//
// Onceden once Supabase deneniyor, olmazsa var/admin-notification-states.json
// dosyasina duselecek sekilde yazilmisti. Tablo hicbir zaman olusturulmadigi
// icin pratikte HEP dosyaya dusuyordu ve Vercel'de her deploy'da siliniyordu:
// okundu isaretlediginiz bildirimler tekrar okunmamis gorunuyordu.
//
// Artik tek kaynak var: `admin_notification_states` tablosu.

const TABLE_NAME = "admin_notification_states";
const VIEWER_ROLE = "admin";

export interface AdminNotificationStateRecord {
  source_type: string;
  source_id: string;
  viewer_role: string;
  read_at: string | null;
  popup_seen_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationStateRef {
  sourceType: string;
  sourceId: string;
}

export async function listAdminNotificationStates(): Promise<AdminNotificationStateRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE_NAME)
    .select("*")
    .eq("viewer_role", VIEWER_ROLE);

  if (error) throw error;
  return (data || []) as AdminNotificationStateRecord[];
}

export async function upsertAdminNotificationStates(
  updates: Array<
    AdminNotificationStateRef & {
      readAt?: string;
      popupSeenAt?: string;
      deletedAt?: string | null;
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
    const existing = currentMap.get(`${update.sourceType}:${update.sourceId}:${VIEWER_ROLE}`);

    return {
      source_type: update.sourceType,
      source_id: update.sourceId,
      viewer_role: VIEWER_ROLE,
      read_at: update.readAt ?? existing?.read_at ?? null,
      popup_seen_at: update.popupSeenAt ?? existing?.popup_seen_at ?? null,
      deleted_at: Object.prototype.hasOwnProperty.call(update, "deletedAt")
        ? update.deletedAt ?? null
        : existing?.deleted_at ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    } satisfies AdminNotificationStateRecord;
  });

  const { error } = await getSupabaseAdmin()
    .from(TABLE_NAME)
    .upsert(mergedRows, { onConflict: "source_type,source_id,viewer_role" });

  if (error) throw error;
}

export async function markAdminNotificationsRead(refs: AdminNotificationStateRef[]) {
  const timestamp = new Date().toISOString();
  await upsertAdminNotificationStates(refs.map((ref) => ({ ...ref, readAt: timestamp })));
}

export async function markAdminNotificationsPopupSeen(refs: AdminNotificationStateRef[]) {
  const timestamp = new Date().toISOString();
  await upsertAdminNotificationStates(refs.map((ref) => ({ ...ref, popupSeenAt: timestamp })));
}

export async function deleteAdminNotifications(refs: AdminNotificationStateRef[]) {
  const timestamp = new Date().toISOString();
  await upsertAdminNotificationStates(refs.map((ref) => ({ ...ref, deletedAt: timestamp })));
}
