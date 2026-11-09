"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { calendarDateInKarachi, formatDisplayDate } from "@/lib/dates";

type OverdueLoanRecord = {
  id: number;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  bookName: string;
  authorName: string;
  category: string;
  shelf: string;
  barcode: string;
  borrowerId: number;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
  identifier: string;
  department: string;
  program?: string;
  semester?: number;
  designation?: string;
  email: string;
  issueDate: string;
  dueDate: string;
  returnedAt: string | null;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  overdue: boolean;
  daysOverdue: number;
};

function distinctValues(values: (string | number | undefined | null)[]) {
  const set = new Set<string>();
  for (const v of values) {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) set.add(s);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function matches(val: string | number | undefined | null, filter: string) {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return String(val ?? "").toLowerCase().includes(needle);
}

export default function OverdueBooksPage() {
  const [kind, setKind] = useState<"student" | "teacher">("student");
  const [loans, setLoans] = useState<OverdueLoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Student search filters
  const [studentRollFilter, setStudentRollFilter] = useState("");
  const [studentNameFilter, setStudentNameFilter] = useState("");
  const [studentDeptFilter, setStudentDeptFilter] = useState("");
  const [studentProgramFilter, setStudentProgramFilter] = useState("");
  const [studentSemesterFilter, setStudentSemesterFilter] = useState("");
  const [studentBookFilter, setStudentBookFilter] = useState("");

  // Teacher search filters
  const [teacherEmpIdFilter, setTeacherEmpIdFilter] = useState("");
  const [teacherNameFilter, setTeacherNameFilter] = useState("");
  const [teacherDeptFilter, setTeacherDeptFilter] = useState("");
  const [teacherDesignationFilter, setTeacherDesignationFilter] = useState("");
  const [teacherBookFilter, setTeacherBookFilter] = useState("");

  async function fetchOverdueLoans() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/book-ledger/return-loans?kind=${kind}&status=overdue`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not load overdue book records.");
      }
      const data = (await response.json()) as OverdueLoanRecord[];
      setLoans(data);
    } catch {
      setError("Could not load overdue book records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchOverdueLoans();
  }, [kind]);

  // Options for Student dropdowns
  const studentRollOptions = useMemo(
    () => distinctValues(loans.map((l) => l.identifier)),
    [loans],
  );
  const studentNameOptions = useMemo(
    () => distinctValues(loans.map((l) => l.borrowerName)),
    [loans],
  );
  const studentDeptOptions = useMemo(
    () => distinctValues(loans.map((l) => l.department)),
    [loans],
  );
  const studentProgramOptions = useMemo(
    () => distinctValues(loans.map((l) => l.program)),
    [loans],
  );
  const studentSemesterOptions = useMemo(
    () => distinctValues(loans.map((l) => l.semester)),
    [loans],
  );
  const studentBookOptions = useMemo(
    () => distinctValues(loans.map((l) => l.bookName)),
    [loans],
  );

  // Options for Teacher dropdowns
  const teacherEmpIdOptions = useMemo(
    () => distinctValues(loans.map((l) => l.identifier)),
    [loans],
  );
  const teacherNameOptions = useMemo(
    () => distinctValues(loans.map((l) => l.borrowerName)),
    [loans],
  );
  const teacherDeptOptions = useMemo(
    () => distinctValues(loans.map((l) => l.department)),
    [loans],
  );
  const teacherDesignationOptions = useMemo(
    () => distinctValues(loans.map((l) => l.designation)),
    [loans],
  );
  const teacherBookOptions = useMemo(
    () => distinctValues(loans.map((l) => l.bookName)),
    [loans],
  );

  const filteredLoans = useMemo(() => {
    if (kind === "student") {
      return loans.filter(
        (l) =>
          matches(l.identifier, studentRollFilter) &&
          matches(l.borrowerName, studentNameFilter) &&
          matches(l.department, studentDeptFilter) &&
          matches(l.program, studentProgramFilter) &&
          matches(l.semester, studentSemesterFilter) &&
          matches(l.bookName, studentBookFilter),
      );
    } else {
      return loans.filter(
        (l) =>
          matches(l.identifier, teacherEmpIdFilter) &&
          matches(l.borrowerName, teacherNameFilter) &&
          matches(l.department, teacherDeptFilter) &&
          matches(l.designation, teacherDesignationFilter) &&
          matches(l.bookName, teacherBookFilter),
      );
    }
  }, [
    loans,
    kind,
    studentRollFilter,
    studentNameFilter,
    studentDeptFilter,
    studentProgramFilter,
    studentSemesterFilter,
    studentBookFilter,
    teacherEmpIdFilter,
    teacherNameFilter,
    teacherDeptFilter,
    teacherDesignationFilter,
    teacherBookFilter,
  ]);

  const hasStudentFilters = Boolean(
    studentRollFilter ||
      studentNameFilter ||
      studentDeptFilter ||
      studentProgramFilter ||
      studentSemesterFilter ||
      studentBookFilter,
  );

  const hasTeacherFilters = Boolean(
    teacherEmpIdFilter ||
      teacherNameFilter ||
      teacherDeptFilter ||
      teacherDesignationFilter ||
      teacherBookFilter,
  );

  function clearStudentFilters() {
    setStudentRollFilter("");
    setStudentNameFilter("");
    setStudentDeptFilter("");
    setStudentProgramFilter("");
    setStudentSemesterFilter("");
    setStudentBookFilter("");
  }

  function clearTeacherFilters() {
    setTeacherEmpIdFilter("");
    setTeacherNameFilter("");
    setTeacherDeptFilter("");
    setTeacherDesignationFilter("");
    setTeacherBookFilter("");
  }

  async function handleReturnBook(loan: OverdueLoanRecord) {
    if (processingId !== null) return;
    setProcessingId(loan.id);
    setError("");
    setSuccessNotice("");

    try {
      const response = await fetch(`/api/loans/${loan.id}/return`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "Failed to return book.");
      }

      const todayStr = calendarDateInKarachi();
      const formattedDate = formatDisplayDate(todayStr);

      // Update row in state to show returned status and date
      setLoans((prev) =>
        prev.map((item) =>
          item.id === loan.id
            ? {
                ...item,
                status: "RETURNED",
                returnedAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      setSuccessNotice(
        `Overdue book "${loan.bookName}" for ${loan.borrowerName} (${loan.identifier}) has been successfully returned on ${formattedDate}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to return book.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <main className="shell shell-wide">
      <header
        className="masthead"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <p className="eyebrow">
            <Link href="/book-ledger" style={{ textDecoration: "none", color: "inherit" }}>
              Book ledger
            </Link>{" "}
            / Overdue books
          </p>
          <h1>Overdue books</h1>
          <p className="lede">
            List of overdue books with quick search filters and direct administrator return action in each row.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link className="button-link button-outline" href="/book-ledger">
            Book ledger
          </Link>
          <Link className="button-link button-outline" href="/book-ledger/return-books">
            Return book
          </Link>
          <Link className="button-link button-outline" href="/book-ledger/returned-books">
            Returned book
          </Link>
          <Link
            className="button-link button-solid"
            href="/book-ledger/overdue-books"
            style={{ fontWeight: 700 }}
          >
            Overdue book
          </Link>
        </div>
      </header>

      {/* Student / Teacher Selector Buttons */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "18px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setKind("student");
            setSuccessNotice("");
          }}
          className={kind === "student" ? "button-solid" : "button-outline"}
          style={{
            minWidth: "130px",
            padding: "10px 20px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Student
        </button>
        <button
          type="button"
          onClick={() => {
            setKind("teacher");
            setSuccessNotice("");
          }}
          className={kind === "teacher" ? "button-solid" : "button-outline"}
          style={{
            minWidth: "130px",
            padding: "10px 20px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Teacher
        </button>
      </div>

      <section className="panel form-panel">
        {/* Soft coffee color search bar container */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
            background: "#ead9c6",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #c9b09a",
            alignItems: "end",
          }}
        >
          {kind === "student" ? (
            <>
              <SearchableCombobox
                label="Search by roll number"
                placeholder="Search or select roll number…"
                value={studentRollFilter}
                onChange={setStudentRollFilter}
                options={studentRollOptions}
                allOptionLabel="All roll numbers"
              />
              <SearchableCombobox
                label="Search by name"
                placeholder="Search or select student name…"
                value={studentNameFilter}
                onChange={setStudentNameFilter}
                options={studentNameOptions}
                allOptionLabel="All student names"
              />
              <SearchableCombobox
                label="Search by department"
                placeholder="Search or select department…"
                value={studentDeptFilter}
                onChange={setStudentDeptFilter}
                options={studentDeptOptions}
                allOptionLabel="All departments"
              />
              <SearchableCombobox
                label="Search by program"
                placeholder="Search or select program…"
                value={studentProgramFilter}
                onChange={setStudentProgramFilter}
                options={studentProgramOptions}
                allOptionLabel="All programs"
              />
              <SearchableCombobox
                label="Search by semester"
                placeholder="Search or select semester…"
                value={studentSemesterFilter}
                onChange={setStudentSemesterFilter}
                options={studentSemesterOptions}
                allOptionLabel="All semesters"
              />
              <SearchableCombobox
                label="Search by book name"
                placeholder="Search or select book…"
                value={studentBookFilter}
                onChange={setStudentBookFilter}
                options={studentBookOptions}
                allOptionLabel="All books"
              />
              {hasStudentFilters ? (
                <div>
                  <button type="button" className="button-quiet" onClick={clearStudentFilters}>
                    Clear filters
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <SearchableCombobox
                label="Search by employee ID"
                placeholder="Search or select employee ID…"
                value={teacherEmpIdFilter}
                onChange={setTeacherEmpIdFilter}
                options={teacherEmpIdOptions}
                allOptionLabel="All employee IDs"
              />
              <SearchableCombobox
                label="Search by name"
                placeholder="Search or select teacher name…"
                value={teacherNameFilter}
                onChange={setTeacherNameFilter}
                options={teacherNameOptions}
                allOptionLabel="All teacher names"
              />
              <SearchableCombobox
                label="Search by department"
                placeholder="Search or select department…"
                value={teacherDeptFilter}
                onChange={setTeacherDeptFilter}
                options={teacherDeptOptions}
                allOptionLabel="All departments"
              />
              <SearchableCombobox
                label="Search by designation"
                placeholder="Search or select designation…"
                value={teacherDesignationFilter}
                onChange={setTeacherDesignationFilter}
                options={teacherDesignationOptions}
                allOptionLabel="All designations"
              />
              <SearchableCombobox
                label="Search by book name"
                placeholder="Search or select book…"
                value={teacherBookFilter}
                onChange={setTeacherBookFilter}
                options={teacherBookOptions}
                allOptionLabel="All books"
              />
              {hasTeacherFilters ? (
                <div>
                  <button type="button" className="button-quiet" onClick={clearTeacherFilters}>
                    Clear filters
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {error ? (
          <p className="banner error" role="alert" style={{ marginBottom: "16px" }}>
            {error}
          </p>
        ) : null}

        {successNotice ? (
          <p className="banner success" role="status" style={{ marginBottom: "16px" }}>
            {successNotice}
          </p>
        ) : null}

        {loading ? <p className="meta">Loading overdue books…</p> : null}

        {!loading && filteredLoans.length === 0 ? (
          <p className="panel-copy">
            {loans.length === 0
              ? `No overdue books found for ${kind}s.`
              : "No overdue books match the selected filters."}
          </p>
        ) : null}

        {!loading && filteredLoans.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                {kind === "student" ? (
                  <tr>
                    <th>Roll number</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Program</th>
                    <th>Semester</th>
                    <th>Book name</th>
                    <th>Issue date</th>
                    <th>Due date</th>
                    <th>Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Book name</th>
                    <th>Issue date</th>
                    <th>Due date</th>
                    <th>Action</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredLoans.map((loan) => {
                  const isReturned = loan.status === "RETURNED" || Boolean(loan.returnedAt);

                  return (
                    <tr key={loan.id}>
                      {kind === "student" ? (
                        <>
                          <td style={{ fontWeight: 700 }}>{loan.identifier}</td>
                          <td>{loan.borrowerName}</td>
                          <td>{loan.department}</td>
                          <td>{loan.program || "—"}</td>
                          <td>{loan.semester ? `Semester ${loan.semester}` : "—"}</td>
                          <td>
                            <strong>{loan.bookName}</strong>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 700 }}>{loan.identifier}</td>
                          <td>{loan.borrowerName}</td>
                          <td>{loan.department}</td>
                          <td>{loan.designation || "—"}</td>
                          <td>
                            <strong>{loan.bookName}</strong>
                          </td>
                        </>
                      )}

                      {/* Highlighted Issue Date */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 700,
                            background: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDisplayDate(loan.issueDate)}
                        </span>
                      </td>

                      {/* Highlighted Overdue Due Date */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 700,
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDisplayDate(loan.dueDate)}
                          {loan.daysOverdue > 0
                            ? ` (${loan.daysOverdue}d overdue)`
                            : " (Overdue)"}
                        </span>
                      </td>

                      {/* Return Book Button / Status */}
                      <td>
                        {isReturned ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span
                              className="badge"
                              style={{
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                display: "inline-block",
                                textAlign: "center",
                              }}
                            >
                              RETURNED
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                              {loan.returnedAt
                                ? formatDisplayDate(loan.returnedAt)
                                : formatDisplayDate(calendarDateInKarachi())}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="button-solid"
                            style={{
                              fontSize: "13px",
                              padding: "6px 14px",
                              whiteSpace: "nowrap",
                            }}
                            disabled={processingId === loan.id}
                            onClick={() => void handleReturnBook(loan)}
                          >
                            {processingId === loan.id ? "Returning…" : "Return book"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
