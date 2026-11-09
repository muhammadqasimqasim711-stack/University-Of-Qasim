export type BorrowerRef =
  | { role: "student"; studentId: number }
  | { role: "teacher"; teacherId: number };

export function borrowerWhere(borrower: BorrowerRef) {
  return borrower.role === "student"
    ? { studentId: borrower.studentId }
    : { teacherId: borrower.teacherId };
}

export function borrowerData(borrower: BorrowerRef) {
  return borrower.role === "student"
    ? { studentId: borrower.studentId, teacherId: null }
    : { studentId: null, teacherId: borrower.teacherId };
}

export function sameBorrower(
  row: { studentId: number | null; teacherId: number | null },
  borrower: BorrowerRef,
) {
  return borrower.role === "student"
    ? row.studentId === borrower.studentId
    : row.teacherId === borrower.teacherId;
}
