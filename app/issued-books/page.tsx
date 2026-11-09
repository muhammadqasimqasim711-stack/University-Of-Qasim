"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { calendarDateInKarachi, formatDisplayDate } from "@/lib/dates";

type Kind = "student" | "teacher";

type StudentIssue = {
  id: number;
  bookName: string;
  copyNumber: number;
  studentName: string;
  rollNumber: string;
  department: string;
  issueDate: string;
  dueDate: string;
};

type TeacherIssue = {
  id: number;
  bookName: string;
  copyNumber: number;
  teacherName: string;
  employeeId: string;
  department: string;
  designation: string;
  issueDate: string;
  dueDate: string;
};

function formatIssuedCopy(copyNumber: number) {
  const number = copyNumber > 0 ? copyNumber : 1;
  return `COPY-${String(number).padStart(2, "0")}`;
}

function distinct(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function matchesField(value: string, filter: string) {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return value.toLowerCase().includes(needle);
}

function isOverdue(dueDate: string) {
  return Boolean(dueDate) && dueDate < calendarDateInKarachi();
}

export default function IssuedBooksPage() {
  const [kind, setKind] = useState<Kind>("student");
  const [studentRows, setStudentRows] = useState<StudentIssue[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookFilter, setBookFilter] = useState("");
  const [identifierFilter, setIdentifierFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadIssuedBooks() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/issued-books?kind=${kind}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as { message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "Could not load issued books.");
        }
        if (!ignore) {
          if (kind === "student") {
            setStudentRows(body as StudentIssue[]);
          } else {
            setTeacherRows(body as TeacherIssue[]);
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load issued books.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadIssuedBooks();

    return () => {
      ignore = true;
    };
  }, [kind]);

  function chooseKind(next: Kind) {
    if (next === kind) {
      return;
    }
    setBookFilter("");
    setIdentifierFilter("");
    setDepartmentFilter("");
    setError("");
    setLoading(true);
    setKind(next);
  }

  const bookOptions = useMemo(
    () =>
      distinct(
        (kind === "student" ? studentRows : teacherRows).map((row) => row.bookName),
      ),
    [kind, studentRows, teacherRows],
  );
  const identifierOptions = useMemo(
    () =>
      distinct(
        kind === "student"
          ? studentRows.map((row) => row.rollNumber)
          : teacherRows.map((row) => row.employeeId),
      ),
    [kind, studentRows, teacherRows],
  );
  const departmentOptions = useMemo(
    () =>
      distinct(
        (kind === "student" ? studentRows : teacherRows).map((row) => row.department),
      ),
    [kind, studentRows, teacherRows],
  );

  const filteredStudents = useMemo(
    () =>
      studentRows.filter(
        (row) =>
          matchesField(row.bookName, bookFilter) &&
          matchesField(row.rollNumber, identifierFilter) &&
          matchesField(row.department, departmentFilter),
      ),
    [studentRows, bookFilter, identifierFilter, departmentFilter],
  );
  const filteredTeachers = useMemo(
    () =>
      teacherRows.filter(
        (row) =>
          matchesField(row.bookName, bookFilter) &&
          matchesField(row.employeeId, identifierFilter) &&
          matchesField(row.department, departmentFilter),
      ),
    [teacherRows, bookFilter, identifierFilter, departmentFilter],
  );

  const hasActiveFilters = Boolean(bookFilter || identifierFilter || departmentFilter);
  const visibleCount = kind === "student" ? filteredStudents.length : filteredTeachers.length;
  const loadedCount = kind === "student" ? studentRows.length : teacherRows.length;
  const overdueCount =
    kind === "student"
      ? filteredStudents.filter((row) => isOverdue(row.dueDate)).length
      : filteredTeachers.filter((row) => isOverdue(row.dueDate)).length;

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Issued books</h1>
          <p className="lede">
            Books currently issued to students and teachers, including the copy that was assigned.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <div className="view-toggle" style={{ marginBottom: "18px" }}>
          <button
            type="button"
            className={kind === "student" ? "active" : undefined}
            onClick={() => chooseKind("student")}
          >
            Student
          </button>
          <button
            type="button"
            className={kind === "teacher" ? "active" : undefined}
            onClick={() => chooseKind("teacher")}
          >
            Teacher
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
            background: "#ead9c6",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #c9b09a",
            alignItems: "end",
          }}
        >
          <SearchableCombobox
            label="Search by book name"
            placeholder="Search or select a book name…"
            value={bookFilter}
            onChange={setBookFilter}
            options={bookOptions}
            allOptionLabel="All book names"
          />
          <SearchableCombobox
            label={kind === "student" ? "Search by roll number" : "Search by employee ID"}
            placeholder={
              kind === "student"
                ? "Search or select a roll number…"
                : "Search or select an employee ID…"
            }
            value={identifierFilter}
            onChange={setIdentifierFilter}
            options={identifierOptions}
            allOptionLabel={kind === "student" ? "All roll numbers" : "All employee IDs"}
          />
          <SearchableCombobox
            label="Search by department"
            placeholder="Search or select a department…"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={departmentOptions}
            allOptionLabel="All departments"
          />
          {hasActiveFilters ? (
            <div>
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setBookFilter("");
                  setIdentifierFilter("");
                  setDepartmentFilter("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="meta">Loading issued books…</p> : null}

        {!loading && visibleCount === 0 ? (
          <p className="panel-copy">
            {loadedCount === 0
              ? kind === "student"
                ? "No books are currently issued to students."
                : "No books are currently issued to teachers."
              : "No issued books match the selected filters."}
          </p>
        ) : null}

        {!loading && overdueCount > 0 ? (
          <p className="banner error" role="alert">
            {overdueCount === 1
              ? "1 issued book is overdue."
              : `${overdueCount} issued books are overdue.`}
          </p>
        ) : null}

        {!loading && kind === "student" && filteredStudents.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Book name</th>
                  <th>Copy</th>
                  <th>Student name</th>
                  <th>Roll number</th>
                  <th>Department</th>
                  <th>Issued date</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((row) => {
                  const overdue = isOverdue(row.dueDate);
                  return (
                    <tr key={row.id} className={overdue ? "issued-overdue" : undefined}>
                      <td>{row.bookName}</td>
                      <td>{formatIssuedCopy(row.copyNumber)}</td>
                      <td>{row.studentName}</td>
                      <td>{row.rollNumber}</td>
                      <td>{row.department}</td>
                      <td>{formatDisplayDate(row.issueDate)}</td>
                      <td>
                        <span className={overdue ? "overdue" : undefined}>
                          {formatDisplayDate(row.dueDate)}
                        </span>
                        {overdue ? <span className="issued-overdue-badge">Overdue</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && kind === "teacher" && filteredTeachers.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Book name</th>
                  <th>Copy</th>
                  <th>Teacher name</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Issued date</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((row) => {
                  const overdue = isOverdue(row.dueDate);
                  return (
                    <tr key={row.id} className={overdue ? "issued-overdue" : undefined}>
                      <td>{row.bookName}</td>
                      <td>{formatIssuedCopy(row.copyNumber)}</td>
                      <td>{row.teacherName}</td>
                      <td>{row.employeeId}</td>
                      <td>{row.department}</td>
                      <td>{row.designation}</td>
                      <td>{formatDisplayDate(row.issueDate)}</td>
                      <td>
                        <span className={overdue ? "overdue" : undefined}>
                          {formatDisplayDate(row.dueDate)}
                        </span>
                        {overdue ? <span className="issued-overdue-badge">Overdue</span> : null}
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
