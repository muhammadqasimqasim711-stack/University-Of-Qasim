"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { formatDisplayDate } from "@/lib/dates";

type ReturnedLoanRecord = {
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

export default function ReturnedBooksPage() {
  const [kind, setKind] = useState<"student" | "teacher">("student");
  const [loans, setLoans] = useState<ReturnedLoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function fetchReturnedLoans() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/book-ledger/return-loans?kind=${kind}&status=returned`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not load returned book records.");
      }
      const data = (await response.json()) as ReturnedLoanRecord[];
      setLoans(data);
    } catch {
      setError("Could not load returned book records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReturnedLoans();
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
            / Returned books
          </p>
          <h1>Returned books</h1>
          <p className="lede">
            View the register of books that have been returned to the library by students and teachers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link className="button-link button-outline" href="/book-ledger">
            Book ledger
          </Link>
          <Link className="button-link button-outline" href="/book-ledger/return-books">
            Return book
          </Link>
          <Link
            className="button-link button-solid"
            href="/book-ledger/returned-books"
            style={{ fontWeight: 700 }}
          >
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
          onClick={() => setKind("student")}
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
          onClick={() => setKind("teacher")}
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

        {loading ? <p className="meta">Loading returned books…</p> : null}

        {!loading && filteredLoans.length === 0 ? (
          <p className="panel-copy">
            {loans.length === 0
              ? `No returned books found for ${kind}s yet.`
              : "No returned books match the selected filters."}
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
                    <th>Returned date</th>
                    <th>Status</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Book name</th>
                    <th>Issue date</th>
                    <th>Returned date</th>
                    <th>Status</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredLoans.map((loan) => (
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

                    <td>{formatDisplayDate(loan.issueDate)}</td>

                    {/* Returned date */}
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 700,
                          background: "#f0fdf4",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        {loan.returnedAt ? formatDisplayDate(loan.returnedAt) : "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: "#dcfce7",
                          color: "#15803d",
                          border: "1px solid #bbf7d0",
                          display: "inline-block",
                        }}
                      >
                        RETURNED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
