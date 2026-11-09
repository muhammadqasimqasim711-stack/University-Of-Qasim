"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEPARTMENTS, TEACHER_DESIGNATIONS } from "@/lib/academic-data";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import type { TeacherView } from "@/lib/teachers";

function statusLabel(status: TeacherView["status"]) {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

export default function TeachersPage() {
  const [query, setQuery] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  const [teachers, setTeachers] = useState<TeacherView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Dynamic master data
  const [masterDepts, setMasterDepts] = useState<string[]>(DEPARTMENTS);
  const [masterDesignations, setMasterDesignations] = useState<string[]>([...TEACHER_DESIGNATIONS]);

  useEffect(() => {
    fetch("/api/master/all")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.departments?.length > 0) setMasterDepts(data.departments);
        if (data.designations?.length > 0) setMasterDesignations(data.designations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadTeachers() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/teachers", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load teachers.");
        }

        const body = (await response.json()) as TeacherView[];
        if (!ignore) {
          setTeachers(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load teachers.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadTeachers();

    return () => {
      ignore = true;
    };
  }, []);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const distinctEmpIds = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.employeeId) set.add(t.employeeId);
    });
    return Array.from(set).sort();
  }, [teachers]);

  const distinctNames = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.fullName) set.add(t.fullName);
    });
    return Array.from(set).sort();
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const matchGeneral =
          teacher.employeeId.toLowerCase().includes(q) ||
          teacher.fullName.toLowerCase().includes(q) ||
          teacher.fatherName.toLowerCase().includes(q) ||
          teacher.department.toLowerCase().includes(q) ||
          teacher.designation.toLowerCase().includes(q) ||
          teacher.email.toLowerCase().includes(q) ||
          teacher.mobileNumber.toLowerCase().includes(q);
        if (!matchGeneral) return false;
      }

      if (empFilter.trim()) {
        const es = empFilter.trim().toLowerCase();
        if (!teacher.employeeId.toLowerCase().includes(es)) return false;
      }

      if (nameFilter.trim()) {
        const ns = nameFilter.trim().toLowerCase();
        if (!teacher.fullName.toLowerCase().includes(ns)) return false;
      }

      if (deptFilter.trim()) {
        const td = deptFilter.trim().toLowerCase();
        if (!teacher.department.toLowerCase().includes(td)) return false;
      }

      if (designationFilter.trim()) {
        const des = designationFilter.trim().toLowerCase();
        if (!teacher.designation.toLowerCase().includes(des)) return false;
      }

      return true;
    });
  }, [
    teachers,
    query,
    empFilter,
    nameFilter,
    deptFilter,
    designationFilter,
  ]);

  const hasActiveFilters = Boolean(
    query ||
    empFilter ||
    nameFilter ||
    deptFilter ||
    designationFilter
  );

  function clearFilters() {
    setQuery("");
    setEmpFilter("");
    setNameFilter("");
    setDeptFilter("");
    setDesignationFilter("");
  }

  async function toggleStatus(teacher: TeacherView) {
    const nextStatus = teacher.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setPendingId(teacher.id);
    setError("");

    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        throw new Error("Could not update status.");
      }

      const updated = (await response.json()) as TeacherView;
      setTeachers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("Could not update the teacher status.");
    } finally {
      setPendingId(null);
    }
  }

  async function removeTeacher(teacher: TeacherView) {
    setPendingId(teacher.id);
    setError("");

    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the teacher.");
      }

      setTeachers((current) => current.filter((item) => item.id !== teacher.id));
      setConfirmingId(null);
    } catch {
      setError("Could not delete the teacher.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Teachers</p>
          <h1>Teacher records</h1>
          <p className="lede">
            Search the register, add a teacher, and keep each record active or
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
            <label className="field search-field" htmlFor="teacher-search">
              <span>General Search</span>
              <input
                id="teacher-search"
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
          <Link className="button-link button-solid" href="/teachers/new">
            Add teacher
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
            label="Search Employee ID"
            placeholder="Search / select employee ID…"
            value={empFilter}
            onChange={setEmpFilter}
            options={distinctEmpIds}
          />

          <SearchableCombobox
            label="Search Teacher Name"
            placeholder="Search / select teacher name…"
            value={nameFilter}
            onChange={setNameFilter}
            options={distinctNames}
          />

          <SearchableCombobox
            label="Search Department"
            placeholder="Search / select department…"
            value={deptFilter}
            onChange={setDeptFilter}
            options={masterDepts}
          />

          <SearchableCombobox
            label="Search Designation"
            placeholder="Search / select designation…"
            value={designationFilter}
            onChange={setDesignationFilter}
            options={masterDesignations}
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

        {loading ? <p className="meta">Loading teachers…</p> : null}

        {!loading && teachers.length === 0 ? (
          <p className="panel-copy">No teachers yet. Add the first teacher record.</p>
        ) : null}

        {!loading && teachers.length > 0 && filteredTeachers.length === 0 ? (
          <p className="panel-copy">No teachers match the selected filter criteria.</p>
        ) : null}

        {!loading && filteredTeachers.length > 0 ? (
          <div className="table-wrap">
            <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted)" }}>
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </div>
            <table className="students">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.employeeId}</td>
                    <td>{teacher.fullName}</td>
                    <td>{teacher.department}</td>
                    <td>{teacher.designation}</td>
                    <td>{teacher.mobileNumber}</td>
                    <td>
                      <span
                        className={
                          teacher.status === "ACTIVE"
                            ? "badge active"
                            : "badge suspended"
                        }
                      >
                        {statusLabel(teacher.status)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/teachers/${teacher.id}`}>View</Link>
                        <Link href={`/teachers/${teacher.id}/edit`}>Edit</Link>
                        <button
                          type="button"
                          className="button-quiet"
                          disabled={pendingId === teacher.id}
                          onClick={() => void toggleStatus(teacher)}
                        >
                          {teacher.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                        {confirmingId === teacher.id ? (
                          <>
                            <span>Delete this teacher?</span>
                            <button
                              type="button"
                              className="button-danger"
                              disabled={pendingId === teacher.id}
                              onClick={() => void removeTeacher(teacher)}
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              className="button-quiet"
                              disabled={pendingId === teacher.id}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="button-danger"
                            disabled={pendingId === teacher.id}
                            onClick={() => setConfirmingId(teacher.id)}
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
