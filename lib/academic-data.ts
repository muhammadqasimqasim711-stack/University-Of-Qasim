export const ACADEMIC_STRUCTURE: Record<string, string[]> = {
  "Computer Science": [
    "BS Computer Science",
    "BS Artificial Intelligence",
    "BS Software Engineering",
    "BS Data Science",
    "BS Information Technology",
  ],
  "Biology": [
    "DPT",
    "BS Biotechnology",
    "BS Microbiology",
    "BS Biochemistry",
    "BS Botany",
    "BS Zoology",
    "BS Chemistry",
  ],
  "Engineering": [
    "BS Mathematics",
    "BS Electrical Engineering",
    "BS Mechanical Engineering",
    "BS Civil Engineering",
  ],
  "Management Sciences": [
    "BBA",
    "BS Accounting & Finance",
    "BS Economics",
    "BS Commerce",
  ],
  "Social Sciences & Humanities": [
    "BS English",
    "BS Psychology",
    "BS International Relations",
    "BS Media Studies",
  ],
};

export const DEPARTMENTS = Object.keys(ACADEMIC_STRUCTURE);

export function getProgramsForDepartment(department: string): string[] {
  return ACADEMIC_STRUCTURE[department] ?? [];
}

/**
 * 5-year academic batches (startYear - (startYear + 5)).
 * Spanning 5 academic years.
 */
export const FIVE_YEAR_BATCHES = [
  "2022-2027",
  "2023-2028",
  "2024-2029",
  "2025-2030",
  "2026-2031",
  "2027-2032",
] as const;

export function isValidFiveYearBatch(batch: string): boolean {
  const match = /^(\d{4})-(\d{4})$/.exec(batch.trim());
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end - start === 5;
}

/**
 * Standard university teacher academic designations.
 */
export const TEACHER_DESIGNATIONS = [
  "Lecturer",
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "Visiting Faculty",
  "Head of Department (HOD)",
  "Dean",
  "Lab Instructor",
] as const;
