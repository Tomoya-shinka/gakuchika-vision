/** ユーザープロフィール（localStorage: user_profile） */
export interface UserProfile {
  /** 名前 */
  name: string;
  /** 所属大学 */
  university: string;
  /** 学年・状況（例：3年生） */
  status: string;
  /** 卒業予定日 YYYY-MM-DD（カウントダウン用） */
  graduationDate: string;
  /** 入学年月日 YYYY-MM-DD（大学生活○日目用） */
  enrollmentDate?: string;
  /** 生年月日 YYYY-MM-DD（人生カウントダウン用） */
  birthDate?: string;
  /** 大学生フラグ（falseの場合、大学関連フィールドは非表示） */
  isStudent?: boolean;
  /** アバター画像URL */
  avatarUrl?: string;
}

export const USER_PROFILE_STORAGE_KEY = "user_profile";

const defaultProfile: UserProfile = {
  name: "TOMOYA",
  university: "〇〇大学",
  status: "3年生",
  graduationDate: "2028-03-31",
};

function isValidDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return { ...defaultProfile };
  try {
    const stored = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!stored) return { ...defaultProfile };
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const name = String(parsed.name ?? defaultProfile.name).trim() || defaultProfile.name;
    const university = String(parsed.university ?? defaultProfile.university);
    const status = String(parsed.status ?? defaultProfile.status);
    const graduationDate = isValidDate(String(parsed.graduationDate ?? ""))
      ? String(parsed.graduationDate)
      : defaultProfile.graduationDate;
    const enrollmentDateRaw = String(parsed.enrollmentDate ?? "").trim();
    const enrollmentDate = isValidDate(enrollmentDateRaw)
      ? enrollmentDateRaw
      : undefined;
    const birthDateRaw = String(parsed.birthDate ?? "").trim();
    const birthDate = isValidDate(birthDateRaw) ? birthDateRaw : undefined;
    const isStudent = parsed.isStudent !== undefined ? Boolean(parsed.isStudent) : true;
    const avatarUrl = typeof parsed.avatarUrl === "string" && parsed.avatarUrl ? parsed.avatarUrl : undefined;
    return { name, university, status, graduationDate, enrollmentDate, birthDate, isStudent, avatarUrl };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/** 卒業予定日をカウントダウン用のISO文字列に変換（日本時間 00:00:00） */
export function getGraduationTargetISO(graduationDate: string): string {
  if (!graduationDate || !isValidDate(graduationDate)) {
    return `${defaultProfile.graduationDate}T00:00:00+09:00`;
  }
  return `${graduationDate}T00:00:00+09:00`;
}
