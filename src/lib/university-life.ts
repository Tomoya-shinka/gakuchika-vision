function toDateAtMidnight(input: unknown): Date | null {
  if (input instanceof Date) {
    const d = new Date(input);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (typeof input === "string") {
    const iso =
      /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }

  if (
    input &&
    typeof input === "object" &&
    "toDate" in input &&
    typeof (input as { toDate: () => Date }).toDate === "function"
  ) {
    const d = (input as { toDate: () => Date }).toDate();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  return null;
}

export function calculateUnivDay(
  targetDate: unknown,
  enrollmentDate: unknown
): number | null {
  if (enrollmentDate == null) return null;
  if (typeof enrollmentDate === "string" && enrollmentDate.trim().length === 0) return null;

  const enroll = toDateAtMidnight(enrollmentDate);
  const target = toDateAtMidnight(targetDate);
  if (!enroll || !target) return null;

  const diffMs = target.getTime() - enroll.getTime();
  const day = Math.floor(diffMs / 86_400_000) + 1;
  if (!Number.isFinite(day)) return null;
  return day < 1 ? 1 : day;
}

export function formatUniversityDayLabel(day: number): string {
  return `大学生活 ${day}日目`;
}

