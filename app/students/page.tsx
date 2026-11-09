"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEPARTMENTS, getProgramsForDepartment } from "@/lib/academic-data";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import type { StudentView } from "@/lib/students";

function statusLabel(status: StudentView["status"]) {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

export default function StudentsPage() {
  const [query, setQuery] = useState("");
  const [rollFilter, setRollFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [progFilter, setProgFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");

  const [students, setStudents] = useState<StudentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Dynamic master data
  const [masterDepts, setMasterDepts] = useState<string[]>(DEPARTMENTS);
  const [masterAcademicStructure, setMasterAcademicStructure] = useState<Record<string, string[]>>({});
  const [masterSemesters, setMasterSemesters] = useState<string[]>(
    Array.from({ length: 12 }, (_, i) => String(i + 1))
  );

  useEffect(() => {
    fetch("/api/master/all")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.departments?.length > 0) setMasterDepts(data.departments);
        if (data.academicStructure && Object.keys(data.academicStructure).length > 0) {
          setMasterAcademicStructure(data.academicStructure);
        }
        if (data.semesters?.length > 0) setMasterSemesters(data.semesters);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadStudents() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/students", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load students.");
        }

        const body = (await response.json()) as StudentView[];
        if (!ignore) {
          setStudents(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load students.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadStudents();

    return () => {
      ignore = true;
    };
  }, []);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const distinctRollNumbers = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.rollNumber) set.add(s.rollNumber);
    });
    return Array.from(set).sort();
  }, [students]);

  const availablePrograms = useMemo(() => {
    if (deptFilter) {
      return masterAcademicStructure[deptFilter] ?? getProgramsForDepartment(deptFilter);
    }
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.program) set.add(s.program);
    });
    return Array.from(set).sort();
  }, [students, deptFilter, masterAcademicStructure]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const matchGeneral =
          student.rollNumber.toLowerCase().includes(q) ||
          student.fullName.toLowerCase().includes(q) ||
          student.fatherName.toLowerCase().includes(q) ||
          student.department.toLowerCase().includes(q) ||
          student.program.toLowerCase().includes(q) ||
          student.email.toLowerCase().includes(q) ||
          student.mobileNumber.toLowerCase().includes(q);
        if (!matchGeneral) return false;
      }

      if (rollFilter.trim()) {
        const rs = rollFilter.trim().toLowerCase();
        if (!student.rollNumber.toLowerCase().includes(rs)) return false;
      }

      if (deptFilter.trim()) {
        const df = deptFilter.trim().toLowerCase();
        if (!student.department.toLowerCase().includes(df)) return false;
      }

      if (progFilter.trim()) {
        const pf = progFilter.trim().toLowerCase();
        if (!student.program.toLowerCase().includes(pf)) return false;
      }

      if (semFilter.trim()) {
        const sf = semFilter.trim().toLowerCase();
        if (
          String(student.semester) !== sf &&
          !`semester ${student.semester}`.toLowerCase().includes(sf)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    students,
    query,
    rollFilter,
    deptFilter,
    progFilter,
    semFilter,
  ]);

  const hasActiveFilters = Boolean(
    query ||
    rollFilter ||
    deptFilter ||
    progFilter ||
    semFilter
  );

  function clearFilters() {
    setQuery("");
    setRollFilter("");
    setDeptFilter("");
    setProgFilter("");
    setSemFilter("");
  }

  async function toggleStatus(student: StudentView) {
    const nextStatus = student.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setPendingId(student.id);
    setError("");

    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("Could not update status.");
      }

      const updated = (await response.json()) as StudentView;
      setStudents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("Could not update the student status.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteStudent(student: StudentView) {
    setPendingId(student.id);
    setError("");

    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the student.");
      }

      setStudents((current) => current.filter((item) => item.id !== student.id));
      setConfirmingId(null);
    } catch {
      setError("Could not delete the student.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Students</p>
          <h1>Student records</h1>
          <p className="lede">
            Search the register, add a student, and keep each record active or
            suspended.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <div
          className="toolbar"
          style={{
            marginBottom: "16px",
            background: "var(--soft-coffee, #e5d5c5)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid #d4c2b0",
          }}
        >
          <form className="search-form" onSubmit={onSearch} style={{ flex: 1 }}>
            <label className="field search-field" htmlFor="student-search">
              <span>General Search</span>
              <input
                id="student-search"
                value={query}
                placeholder="Name, father name, email, mobile…"
                onChange={(event) => setQuery(event.target.value)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #c8b6a3",
                }}
              />
            </label>
          </form>
          <Link className="button-link button-solid" href="/students/new">
            Add student
          </Link>
        </div>

        {/* Filter Toolbar: Each filter is only one box (search + dropdown combined) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
            background: "var(--soft-coffee, #e5d5c5)",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid #d4c2b0",
            alignItems: "end",
          }}
        >
          <SearchableCombobox
            label="Search Roll Number"
            placeholder="Search / select roll number…"
            value={rollFilter}
            onChange={setRollFilter}
            options={distinctRollNumbers}
          />

          <SearchableCombobox
            label="Search Department"
            placeholder="Search / select department…"
            value={deptFilter}
            onChange={(dept) => {
              setDeptFilter(dept);
              setProgFilter("");
            }}
            options={masterDepts}
          />

          <SearchableCombobox
            label="Search Program"
            placeholder="Search / select program…"
            value={progFilter}
            onChange={setProgFilter}
            options={availablePrograms}
            disabled={availablePrograms.length === 0}
          />

          <SearchableCombobox
            label="Search Semester"
            placeholder="Search / select semester…"
            value={semFilter}
            onChange={setSemFilter}
            options={masterSemesters.map((sem, idx) => {
              const numVal = sem.replace(/\D/g, "") || String(idx + 1);
              return {
                label: sem.toLowerCase().includes("semester") ? sem : `Semester ${sem}`,
                value: numVal,
              };
            })}
          />

          {hasActiveFilters && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="button-quiet"
                onClick={clearFilters}
                style={{ padding: "8px 14px", fontSize: "13px", height: "38px", whiteSpace: "nowrap" }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? <p className="meta">Loading students…</p> : null}

        {!loading && students.length === 0 ? (
          <p className="panel-copy">No students yet. Add the first student record.</p>
        ) : null}

        {!loading && students.length > 0 && filteredStudents.length === 0 ? (
          <p className="panel-copy">No students match the selected filter criteria.</p>
        ) : null}

        {!loading && filteredStudents.length > 0 ? (
          <div className="table-wrap">
            <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted)" }}>
              Showing {filteredStudents.length} of {students.length} students
            </div>
            <table className="students">
              <thead>
                <tr>
                  <th>Roll number</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Program</th>
                  <th>Semester</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.rollNumber}</td>
                    <td>{student.fullName}</td>
                    <td>{student.department}</td>
                    <td>{student.program}</td>
                    <td>{student.semester}</td>
                    <td>{student.mobileNumber}</td>
                    <td>
                      <span
                        className={
                          student.status === "ACTIVE"
                            ? "badge active"
                            : "badge suspended"
                        }
                      >
                        {statusLabel(student.status)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/students/${student.id}`}>View</Link>
                        <Link href={`/students/${student.id}/edit`}>Edit</Link>
                        <button
                          type="button"
                          className="button-quiet"
                          disabled={pendingId === student.id}
                          onClick={() => void toggleStatus(student)}
                        >
                          {student.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                        {confirmingId === student.id ? (
                          <>
                            <span>Delete this student?</span>
                            <button
                              type="button"
                              className="button-danger"
                              disabled={pendingId === student.id}
                              onClick={() => void deleteStudent(student)}
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              className="button-quiet"
                              disabled={pendingId === student.id}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="button-danger"
                            disabled={pendingId === student.id}
                            onClick={() => setConfirmingId(student.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
