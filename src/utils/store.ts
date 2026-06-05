import { openDB, type DBSchema } from "idb";
import type { RawRow, TemplateFingerprint, UserPreferences, GoogleSheetsConfig, JiraConfig, DataFormat } from "@/types/bug";

export type AnalysisRecord = {
  id: string;
  fileName: string;
  timestamp: number;
  rowCount: number;
  columnCount: number;
  hasInsights: boolean;
  insights?: string;
};

export type ChatEntry = {
  q: string;
  a: string;
  timestamp: number;
};

interface BugDashDB extends DBSchema {
  bugs: { key: string; value: { id: string; rows: RawRow[]; fileName: string; timestamp: number; dataFormat?: DataFormat; googleConfig?: GoogleSheetsConfig; jiraConfig?: JiraConfig } };
  templates: { key: string; value: TemplateFingerprint };
  preferences: { key: string; value: UserPreferences };
  history: { key: string; value: AnalysisRecord };
  chats: { key: string; value: { key: string; entries: ChatEntry[] } };
}

const DB_NAME = "bug-dashboard";
const DB_VERSION = 3;

function getDB() {
  return openDB<BugDashDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("bugs")) db.createObjectStore("bugs");
      if (!db.objectStoreNames.contains("templates")) db.createObjectStore("templates");
      if (!db.objectStoreNames.contains("preferences")) db.createObjectStore("preferences");
      if (!db.objectStoreNames.contains("history")) db.createObjectStore("history");
      if (!db.objectStoreNames.contains("chats")) db.createObjectStore("chats");
    },
  });
}

export async function saveBugData(rows: RawRow[], fileName: string, dataFormat?: DataFormat, googleConfig?: GoogleSheetsConfig, jiraConfig?: JiraConfig) {
  const db = await getDB();
  await db.put("bugs", { id: "latest", rows, fileName, timestamp: Date.now(), dataFormat, googleConfig, jiraConfig }, "latest");
}

export async function loadBugData(): Promise<{ rows: RawRow[]; fileName: string; timestamp: number; dataFormat?: DataFormat; googleConfig?: GoogleSheetsConfig; jiraConfig?: JiraConfig } | undefined> {
  const db = await getDB();
  return db.get("bugs", "latest");
}

export async function saveTemplate(fp: TemplateFingerprint) {
  const db = await getDB();
  await db.put("templates", fp, fp.id);
}

export async function loadTemplate(id: string): Promise<TemplateFingerprint | undefined> {
  const db = await getDB();
  return db.get("templates", id);
}

export async function savePreferences(prefs: UserPreferences) {
  const db = await getDB();
  await db.put("preferences", prefs, "user");
}

export async function loadPreferences(): Promise<UserPreferences | undefined> {
  const db = await getDB();
  return db.get("preferences", "user");
}

export function createFingerprint(headers: string[], sheetName: string): string {
  const sorted = [...headers].sort().join("|").toLowerCase();
  return `${sheetName.toLowerCase()}::${sorted}`;
}

export async function clearAllData() {
  const db = await getDB();
  await db.clear("bugs");
  await db.clear("templates");
}

// === Analysis History ===
export async function saveAnalysisRecord(record: AnalysisRecord) {
  const db = await getDB();
  await db.put("history", record, record.id);
}

export async function updateAnalysisRecord(id: string, patch: Partial<AnalysisRecord>) {
  const db = await getDB();
  const existing = await db.get("history", id);
  if (existing) {
    await db.put("history", { ...existing, ...patch }, id);
  }
}

export async function loadAnalysisHistory(): Promise<AnalysisRecord[]> {
  const db = await getDB();
  const all = await db.getAll("history");
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteAnalysisRecord(id: string) {
  const db = await getDB();
  await db.delete("history", id);
}

// === Chat History ===
export async function saveChatHistory(datasetKey: string, entries: ChatEntry[]) {
  const db = await getDB();
  await db.put("chats", { key: datasetKey, entries }, datasetKey);
}

export async function loadChatHistory(datasetKey: string): Promise<ChatEntry[]> {
  const db = await getDB();
  try {
    const record = await db.get("chats", datasetKey);
    return record?.entries || [];
  } catch {
    return [];
  }
}

export async function clearChatHistory(datasetKey: string) {
  const db = await getDB();
  try {
    await db.delete("chats", datasetKey);
  } catch {
    // ignore
  }
}