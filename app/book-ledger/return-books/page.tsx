"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { calendarDateInKarachi, formatDisplayDate } from "@/lib/dates";

type ReturnLoanRecord = {
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

export default function ReturnBooksPage() {
  const [kind, setKind] = useState<"student" | "teacher">("student");
  const [loans, setLoans] = useState<ReturnLoanRecord[]>([]);
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

  // Teacher search filters
  const [teacherEmpIdFilter, setTeacherEmpIdFilter] = useState("");
  const [teacherNameFilter, setTeacherNameFilter] = useState("");
  const [teacherDeptFilter, setTeacherDeptFilter] = useState("");
  const [teacherDesignationFilter, setTeacherDesignationFilter] = useState("");

  async function fetchLoans() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/book-ledger/return-loans?kind=${kind}&status=active`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not load return book records.");
      }
      const data = (await response.json()) as ReturnLoanRecord[];
      setLoans(data);
    } catch {
      setError("Could not load return book records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchLoans();
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

  const filteredLoans = useMemo(() => {
    if (kind === "student") {
      return loans.filter(
        (l) =>
          matches(l.identifier, studentRollFilter) &&
          matches(l.borrowerName, studentNameFilter) &&
          matches(l.department, studentDeptFilter) &&
          matches(l.program, studentProgramFilter) &&
          matches(l.semester, studentSemesterFilter),
      );
    } else {
      return loans.filter(
        (l) =>
          matches(l.identifier, teacherEmpIdFilter) &&
          matches(l.borrowerName, teacherNameFilter) &&
          matches(l.department, teacherDeptFilter) &&
          matches(l.designation, teacherDesignationFilter),
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
    teacherEmpIdFilter,
    teacherNameFilter,
    teacherDeptFilter,
    teacherDesignationFilter,
  ]);

  // Sort loans so all overdue students/teachers appear at the top (upper of the table)
  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      const aReturned = a.status === "RETURNED" || Boolean(a.returnedAt);
      const bReturned = b.status === "RETURNED" || Boolean(b.returnedAt);
      const aOverdue = !aReturned && a.overdue;
      const bOverdue = !bReturned && b.overdue;

      // Overdue items always appear at the top
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // If both are overdue, sort earliest dueDate first (longest overdue first)
      if (aOverdue && bOverdue) {
        return a.dueDate.localeCompare(b.dueDate);
      }

      // Returned items go to the bottom
      if (aReturned && !bReturned) return 1;
      if (!aReturned && bReturned) return -1;

      // Default upcoming items sorted by dueDate ascending
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [filteredLoans]);

  const overdueCount = useMemo(() => {
    return filteredLoans.filter(
      (l) => !l.returnedAt && l.status !== "RETURNED" && l.overdue,
    ).length;
  }, [filteredLoans]);

  const hasStudentFilters = Boolean(
    studentRollFilter ||
      studentNameFilter ||
      studentDeptFilter ||
      studentProgramFilter ||
      studentSemesterFilter,
  );

  const hasTeacherFilters = Boolean(
    teacherEmpIdFilter ||
      teacherNameFilter ||
      teacherDeptFilter ||
      teacherDesignationFilter,
  );

  function clearStudentFilters() {
    setStudentRollFilter("");
    setStudentNameFilter("");
    setStudentDeptFilter("");
    setStudentProgramFilter("");
    setStudentSemesterFilter("");
  }

  function clearTeacherFilters() {
    setTeacherEmpIdFilter("");
    setTeacherNameFilter("");
    setTeacherDeptFilter("");
    setTeacherDesignationFilter("");
  }

  async function handleReturnBook(loan: ReturnLoanRecord) {
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
        `"${loan.bookName}" for ${loan.borrowerName} (${loan.identifier}) has been marked as RETURNED on ${formattedDate}.`,
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
            / Return books
          </p>
          <h1>Return books</h1>
          <p className="lede">
            Browse issued books and return them with administrator authorization without student or teacher permission.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link className="button-link button-outline" href="/book-ledger">
            Book ledger
          </Link>
          <Link
            className="button-link button-solid"
            href="/book-ledger/return-books"
            style={{ fontWeight: 700 }}
          >
            Return book
          </Link>
          <Link className="button-link button-outline" href="/book-ledger/returned-books">
            Returned book
          </Link>
          <Link className="button-link button-outline" href="/book-ledger/overdue-books">
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
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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

        {loading ? <p className="meta">Loading returnable books…</p> : null}

        {!loading && sortedLoans.length === 0 ? (
          <p className="panel-copy">
            {loans.length === 0
              ? `No active issued books found for ${kind}s.`
              : "No issued books match the selected filters."}
          </p>
        ) : null}

        {!loading && sortedLoans.length > 0 ? (
          <div>
            {overdueCount > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontWeight: 600,
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "18px" }}>⚠️</span>
                <span>
                  <strong>{overdueCount}</strong> overdue {kind} {overdueCount === 1 ? "record" : "records"} requiring immediate return — displayed at the top of the table in red.
                </span>
              </div>
            ) : null}

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
                  {sortedLoans.map((loan) => {
                    const isReturned = loan.status === "RETURNED" || Boolean(loan.returnedAt);
                    const isOverdue = !isReturned && loan.overdue;

                    return (
                      <tr
                        key={loan.id}
                        style={
                          isOverdue
                            ? {
                                backgroundColor: "#fef2f2",
                                borderLeft: "5px solid #dc2626",
                              }
                            : undefined
                        }
                      >
                        {kind === "student" ? (
                          <>
                            <td style={{ fontWeight: 700, color: isOverdue ? "#991b1b" : undefined }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span>{loan.identifier}</span>
                                {isOverdue ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: "#dc2626",
                                      color: "#ffffff",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    OVERDUE
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td style={{ fontWeight: isOverdue ? 600 : undefined, color: isOverdue ? "#991b1b" : undefined }}>
                              {loan.borrowerName}
                            </td>
                            <td>{loan.department}</td>
                            <td>{loan.program || "—"}</td>
                            <td>{loan.semester ? `Semester ${loan.semester}` : "—"}</td>
                            <td>
                              <strong style={{ color: isOverdue ? "#991b1b" : undefined }}>
                                {loan.bookName}
                              </strong>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 700, color: isOverdue ? "#991b1b" : undefined }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span>{loan.identifier}</span>
                                {isOverdue ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      background: "#dc2626",
                                      color: "#ffffff",
                                      fontSize: "10px",
                                      fontWeight: 800,
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    OVERDUE
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td style={{ fontWeight: isOverdue ? 600 : undefined, color: isOverdue ? "#991b1b" : undefined }}>
                              {loan.borrowerName}
                            </td>
                            <td>{loan.department}</td>
                            <td>{loan.designation || "—"}</td>
                            <td>
                              <strong style={{ color: isOverdue ? "#991b1b" : undefined }}>
                                {loan.bookName}
                              </strong>
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
                            }}
                          >
                            {formatDisplayDate(loan.issueDate)}
                          </span>
                        </td>

                        {/* Highlighted Due Date */}
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              fontWeight: 700,
                              background: isOverdue ? "#fee2e2" : "#fef3c7",
                              color: isOverdue ? "#b91c1c" : "#b45309",
                              border: isOverdue ? "1px solid #fca5a5" : "1px solid #fde68a",
                              boxShadow: isOverdue ? "0 1px 2px rgba(220, 38, 38, 0.15)" : undefined,
                            }}
                          >
                            {isOverdue ? "⚠️ " : ""}
                            {formatDisplayDate(loan.dueDate)}
                            {isOverdue ? " (Overdue)" : ""}
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
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
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
                                background: isOverdue ? "#dc2626" : undefined,
                                borderColor: isOverdue ? "#b91c1c" : undefined,
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
          </div>
        ) : null}
      </section>
    </main>
  );
}
