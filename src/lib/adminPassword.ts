import fs from "fs";
import path from "path";

type AdminPasswordStore = {
  currentPassword: string;
  previousPasswords: string[];
};

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function getStorePath() {
  const dir = path.join(process.cwd(), "var");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "admin-password.json");
}

function readStore(): AdminPasswordStore {
  try {
    const file = getStorePath();
    if (!fs.existsSync(file)) {
      const initial: AdminPasswordStore = {
        currentPassword: DEFAULT_ADMIN_PASSWORD,
        previousPasswords: [],
      };
      fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed.currentPassword === "string" && Array.isArray(parsed.previousPasswords)) {
      return parsed as AdminPasswordStore;
    }
  } catch {
    // fall through to default
  }
  return {
    currentPassword: DEFAULT_ADMIN_PASSWORD,
    previousPasswords: [],
  };
}

function writeStore(store: AdminPasswordStore) {
  const file = getStorePath();
  fs.writeFileSync(file, JSON.stringify(store, null, 2), "utf8");
}

export function verifyAdminPassword(password: string): boolean {
  const store = readStore();
  return password === store.currentPassword;
}

export function updateAdminPassword(oldPassword: string, newPassword: string): { success: boolean; error?: string } {
  const trimmedOld = String(oldPassword || "").trim();
  const trimmedNew = String(newPassword || "").trim();
  if (!trimmedOld || !trimmedNew) return { success: false, error: "Tüm alanlar zorunlu" };
  if (trimmedNew.length < 4) return { success: false, error: "Yeni şifre en az 4 karakter olmalı" };

  const store = readStore();
  if (trimmedOld !== store.currentPassword) return { success: false, error: "Mevcut şifre yanlış" };
  if (trimmedNew === store.currentPassword) return { success: false, error: "Yeni şifre mevcut şifreyle aynı olamaz" };
  if (store.previousPasswords.includes(trimmedNew)) {
    return { success: false, error: "Bu şifre daha önce kullanılmış. Farklı bir şifre seçin." };
  }

  const nextStore: AdminPasswordStore = {
    currentPassword: trimmedNew,
    previousPasswords: [store.currentPassword, ...store.previousPasswords].slice(0, 20),
  };
  writeStore(nextStore);
  return { success: true };
}
