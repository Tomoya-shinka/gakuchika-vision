import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { SectionId } from "./self-analysis";
import type { SelfAnalysisFolder } from "./self-analysis-folders";

export interface FirestoreSelfAnalysisItem {
  id: string;
  sectionId: SectionId;
  content: string;
  createdAt: string;
}

const CATEGORY_TO_SECTION: Record<string, SectionId> = {
  success: "small-wins",
  enjoy: "fun",
  strength: "strength",
  dream: "dream",
};

export const SECTION_TO_CATEGORY: Record<string, string> = {
  "small-wins": "success",
  fun: "enjoy",
  strength: "strength",
  dream: "dream",
};

export function categoryToSectionId(category: string | null): SectionId {
  if (category && category in CATEGORY_TO_SECTION) {
    return CATEGORY_TO_SECTION[category] as SectionId;
  }
  return "small-wins";
}

export async function saveSelfAnalysisToFirestore(
  db: Firestore,
  userId: string,
  sectionId: SectionId,
  content: string
): Promise<void> {
  const col = collection(db, "users", userId, "self_analysis");
  await addDoc(col, {
    sectionId,
    content: content.trim(),
    createdAt: Timestamp.now(),
  });
}

export async function getSelfAnalysisFromFirestore(
  db: Firestore,
  userId: string
): Promise<FirestoreSelfAnalysisItem[]> {
  const col = collection(db, "users", userId, "self_analysis");
  const q = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : typeof data.createdAt === "string"
        ? data.createdAt
        : new Date().toISOString();
    return {
      id: d.id,
      sectionId: (data.sectionId ?? "small-wins") as SectionId,
      content: String(data.content ?? ""),
      createdAt,
    };
  });
}

// ─── フォルダ CRUD ───────────────────────────────────────────────────────────

export async function getFoldersFromFirestore(
  db: Firestore,
  userId: string
): Promise<SelfAnalysisFolder[]> {
  const col = collection(db, "users", userId, "self_analysis_folders");
  const q = query(col, orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name ?? ""),
      emoji: String(data.emoji ?? "📁"),
      description: data.description ? String(data.description) : undefined,
      order: typeof data.order === "number" ? data.order : 0,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === "string"
            ? data.createdAt
            : new Date().toISOString(),
      isDefault: data.isDefault === true,
    };
  });
}

export async function saveFolderToFirestore(
  db: Firestore,
  userId: string,
  folder: SelfAnalysisFolder
): Promise<void> {
  const ref = doc(db, "users", userId, "self_analysis_folders", folder.id);
  await setDoc(ref, {
    name: folder.name,
    emoji: folder.emoji,
    description: folder.description ?? null,
    order: folder.order,
    createdAt: folder.createdAt,
    isDefault: folder.isDefault,
  });
}

export async function deleteFolderFromFirestore(
  db: Firestore,
  userId: string,
  folderId: string
): Promise<void> {
  const ref = doc(db, "users", userId, "self_analysis_folders", folderId);
  await deleteDoc(ref);
}
