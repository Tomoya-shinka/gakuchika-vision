import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { SectionId } from "./self-analysis";

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

export const SECTION_TO_CATEGORY: Record<SectionId, string> = {
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
