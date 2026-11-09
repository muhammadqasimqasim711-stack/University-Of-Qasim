export const BOOK_CATEGORIES = [
  "Computer Science",
  "Biology",
  "Engineering",
  "Arts",
  "Commerce",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];
