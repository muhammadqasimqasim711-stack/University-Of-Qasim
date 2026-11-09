"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDisplayDate, formatDisplayTimestamp } from "@/lib/dates";
import {
  DEPARTMENTS,
  getProgramsForDepartment,
  TEACHER_DESIGNATIONS,
} from "@/lib/academic-data";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import type {
  StudentRegistrationRequestView,
  TeacherRegistrationRequestView,
} from "@/lib/registration-requests";

type ActiveTab = "student" | "teacher";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("student");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Student filters: each filter is ONE box (search + dropdown combined)
  const [studentRoll, setStudentRoll] = useState("");
  const [studentDept, setStudentDept] = useState("");
  const [studentProg, setStudentProg] = useState("");
  const [studentSem, setStudentSem] = useState("");

  // Teacher filters: each filter is ONE box (search + dropdown combined)
  const [teacherEmp, setTeacherEmp] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherDept, setTeacherDept] = useState("");
  const [teacherDesignation, setTeacherDesignation] = useState("");

  const [studentRequests, setStudentRequests] = useState<StudentRegistrationRequestView[]>([]);
  const [teacherRequests, setTeacherRequests] = useState<TeacherRegistrationRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);

  // Review modal state
  const [reviewItem, setReviewItem] = useState<{
    type: "student" | "teacher";
    student?: StudentRegistrationRequestView;
    teacher?: TeacherRegistrationRequestView;
  } | null>(null);

  // Dynamic master data
  const [masterDepts, setMasterDepts] = useState<string[]>(DEPARTMENTS);
  const [masterAcademicStructure, setMasterAcademicStructure] = useState<Record<string, string[]>>({});
  const [masterSemesters, setMasterSemesters] = useState<string[]>(
    Array.from({ length: 12 }, (_, i) => String(i + 1))
  );
  const [masterDesignations, setMasterDesignations] = useState<string[]>([...TEACHER_DESIGNATIONS]);

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
        if (data.designations?.length > 0) setMasterDesignations(data.designations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initialLoad() {
      try {
        const [resStudents, resTeachers] = await Promise.all([
          fetch("/api/registration-requests?type=student", { cache: "no-store" }),
          fetch("/api/registration-requests?type=teacher", { cache: "no-store" }),
        ]);

        if (!resStudents.ok || !resTeachers.ok) {
          throw new Error("Failed to load registration requests.");
        }

        const studentsData = (await resStudents.json()) as StudentRegistrationRequestView[];
        const teachersData = (await resTeachers.json()) as TeacherRegistrationRequestView[];
        if (ignore) {
          return;
        }
        setStudentRequests(studentsData);
        setTeacherRequests(teachersData);
        setLoading(false);
      } catch {
        if (!ignore) {
          setError("Could not load registration requests from server.");
          setLoading(false);
        }
      }
    }

    void initialLoad();
    return () => {
      ignore = true;
    };
  }, []);

  const pendingStudentCount = useMemo(
    () => studentRequests.filter((r) => r.status === "PENDING").length,
    [studentRequests],
  );

  const pendingTeacherCount = useMemo(
    () => teacherRequests.filter((r) => r.status === "PENDING").length,
    [teacherRequests],
  );

  // Distinct values for student dropdowns
  const distinctStudentRollNumbers = useMemo(() => {
    const set = new Set<string>();
    studentRequests.forEach((r) => {
      if (r.rollNumber) set.add(r.rollNumber);
    });
    return Array.from(set).sort();
  }, [studentRequests]);

  const studentAvailablePrograms = useMemo(() => {
    if (studentDept) {
      return masterAcademicStructure[studentDept] ?? getProgramsForDepartment(studentDept);
    }
    const set = new Set<string>();
    studentRequests.forEach((r) => {
      if (r.program) set.add(r.program);
    });
    return Array.from(set).sort();
  }, [studentRequests, studentDept, masterAcademicStructure]);

  // Distinct values for teacher dropdowns
  const distinctTeacherEmpIds = useMemo(() => {
    const set = new Set<string>();
    teacherRequests.forEach((r) => {
      if (r.employeeId) set.add(r.employeeId);
    });
    return Array.from(set).sort();
  }, [teacherRequests]);

  const distinctTeacherNames = useMemo(() => {
    const set = new Set<string>();
    teacherRequests.forEach((r) => {
      if (r.fullName) set.add(r.fullName);
    });
    return Array.from(set).sort();
  }, [teacherRequests]);

  const filteredStudents = useMemo(() => {
    let list = studentRequests;
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.rollNumber.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.fatherName.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.program.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.mobileNumber.toLowerCase().includes(q),
      );
    }
    if (studentRoll.trim()) {
      const rs = studentRoll.trim().toLowerCase();
      list = list.filter((r) => r.rollNumber.toLowerCase().includes(rs));
    }
    if (studentDept.trim()) {
      const sd = studentDept.trim().toLowerCase();
      list = list.filter((r) => r.department.toLowerCase().includes(sd));
    }
    if (studentProg.trim()) {
      const sp = studentProg.trim().toLowerCase();
      list = list.filter((r) => r.program.toLowerCase().includes(sp));
    }
    if (studentSem.trim()) {
      const ss = studentSem.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.semester) === ss ||
          `semester ${r.semester}`.toLowerCase().includes(ss),
      );
    }
    return list;
  }, [
    studentRequests,
    statusFilter,
    searchQuery,
    studentRoll,
    studentDept,
    studentProg,
    studentSem,
  ]);

  const filteredTeachers = useMemo(() => {
    let list = teacherRequests;
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.employeeId.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.fatherName.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.designation.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.mobileNumber.toLowerCase().includes(q),
      );
    }
    if (teacherEmp.trim()) {
      const es = teacherEmp.trim().toLowerCase();
      list = list.filter((r) => r.employeeId.toLowerCase().includes(es));
    }
    if (teacherName.trim()) {
      const ns = teacherName.trim().toLowerCase();
      list = list.filter((r) => r.fullName.toLowerCase().includes(ns));
    }
    if (teacherDept.trim()) {
      const td = teacherDept.trim().toLowerCase();
      list = list.filter((r) => r.department.toLowerCase().includes(td));
    }
    if (teacherDesignation.trim()) {
      const des = teacherDesignation.trim().toLowerCase();
      list = list.filter((r) => r.designation.toLowerCase().includes(des));
    }
    return list;
  }, [
    teacherRequests,
    statusFilter,
    searchQuery,
    teacherEmp,
    teacherName,
    teacherDept,
    teacherDesignation,
  ]);

  const hasStudentFilters = Boolean(
    studentRoll || studentDept || studentProg || studentSem
  );

  function clearStudentFilters() {
    setStudentRoll("");
    setStudentDept("");
    setStudentProg("");
    setStudentSem("");
  }

  const hasTeacherFilters = Boolean(
    teacherEmp || teacherName || teacherDept || teacherDesignation
  );

  function clearTeacherFilters() {
    setTeacherEmp("");
    setTeacherName("");
    setTeacherDept("");
    setTeacherDesignation("");
  }

  async function handleApprove(type: "student" | "teacher", id: number, name: string, email: string) {
    setActionPendingId(id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/registration-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Approval failed.");
        return;
      }

      setSuccessMessage(
        `Registration approved! ${name} has been added to the library management system, and an email notification has been automatically sent to ${email}.`,
      );

      // Update state locally
      if (type === "student") {
        setStudentRequests((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "APPROVED", reviewedAt: new Date().toISOString() } : item,
          ),
        );
      } else {
        setTeacherRequests((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "APPROVED", reviewedAt: new Date().toISOString() } : item,
          ),
        );
      }

      if (reviewItem) {
        setReviewItem(null);
      }
    } catch {
      setError("An unexpected error occurred during approval.");
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleReject(type: "student" | "teacher", id: number) {
    setActionPendingId(id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/registration-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Decline failed.");
        return;
      }

      setSuccessMessage(`Registration request has been declined.`);

      if (type === "student") {
        setStudentRequests((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "REJECTED", reviewedAt: new Date().toISOString() } : item,
          ),
        );
      } else {
        setTeacherRequests((current) =>
          current.map((item) =>
            item.id === id ? { ...item, status: "REJECTED", reviewedAt: new Date().toISOString() } : item,
          ),
        );
      }

      if (reviewItem) {
        setReviewItem(null);
      }
    } catch {
      setError("An unexpected error occurred while declining request.");
    } finally {
      setActionPendingId(null);
    }
  }

  function renderStatusBadge(status: "PENDING" | "APPROVED" | "REJECTED") {
    if (status === "APPROVED") {
      return <span className="badge approved">Approved</span>;
    }
    if (status === "REJECTED") {
      return <span className="badge rejected">Declined</span>;
    }
    return <span className="badge pending-approval">Pending</span>;
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Registration Requests</p>
          <h1>Requests</h1>
          <p className="lede">
            Review registration requests submitted by students and teachers. When you approve a
            request, the member is automatically added to the library management system and a
            welcome notification email is sent to their email address.
          </p>
        </div>
      </header>

      {/* Main Section Toggle: Two Buttons: Student and Teacher */}
      <section style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className={activeTab === "student" ? "" : "button-quiet"}
            onClick={() => setActiveTab("student")}
            style={{
              padding: "10px 22px",
              fontSize: "15px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Student Requests</span>
            {pendingStudentCount > 0 ? (
              <span
                style={{
                  background: activeTab === "student" ? "#c4a36a" : "var(--green)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {pendingStudentCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className={activeTab === "teacher" ? "" : "button-quiet"}
            onClick={() => setActiveTab("teacher")}
            style={{
              padding: "10px 22px",
              fontSize: "15px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Teacher Requests</span>
            {pendingTeacherCount > 0 ? (
              <span
                style={{
                  background: activeTab === "teacher" ? "#c4a36a" : "var(--green)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                {pendingTeacherCount}
              </span>
            ) : null}
          </button>
        </div>
      </section>

      {/* Filters and search toolbar */}
      <section
        className="toolbar"
        style={{
          marginBottom: "20px",
          background: "var(--soft-coffee, #e5d5c5)",
          padding: "12px 14px",
          borderRadius: "8px",
          border: "1px solid #d4c2b0",
        }}
      >
        <div className="search-wrap" style={{ flex: 1, minWidth: "260px" }}>
          <input
            type="search"
            value={searchQuery}
            placeholder={
              activeTab === "student"
                ? "Search by roll number, name, department, email…"
                : "Search by employee ID, name, department, email…"
            }
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "#ffffff",
              border: "1px solid #c8b6a3",
            }}
          />
        </div>

        <div className="view-toggle" role="group" aria-label="Filter by status">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? "active" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "All" : status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Declined"}
            </button>
          ))}
        </div>
      </section>

      {/* Feedback Banners */}
      {successMessage ? (
        <p className="banner ok" role="status">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Student Section */}
      {activeTab === "student" ? (
        <section className="panel form-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <h2>Student Registration Requests</h2>
            <span className="meta">{filteredStudents.length} {filteredStudents.length === 1 ? "request" : "requests"} found</span>
          </div>

          {/* Student Filter Toolbar: Each filter is only one box (search + dropdown combined) */}
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
              value={studentRoll}
              onChange={setStudentRoll}
              options={distinctStudentRollNumbers}
            />

            <SearchableCombobox
              label="Search Department"
              placeholder="Search / select department…"
              value={studentDept}
              onChange={(dept) => {
                setStudentDept(dept);
                setStudentProg("");
              }}
              options={masterDepts}
            />

            <SearchableCombobox
              label="Search Program"
              placeholder="Search / select program…"
              value={studentProg}
              onChange={setStudentProg}
              options={studentAvailablePrograms}
              disabled={studentAvailablePrograms.length === 0}
            />

            <SearchableCombobox
              label="Search Semester"
              placeholder="Search / select semester…"
              value={studentSem}
              onChange={setStudentSem}
              options={masterSemesters.map((sem, idx) => {
                const numVal = sem.replace(/\D/g, "") || String(idx + 1);
                return {
                  label: sem.toLowerCase().includes("semester") ? sem : `Semester ${sem}`,
                  value: numVal,
                };
              })}
            />

            {hasStudentFilters && (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={clearStudentFilters}
                  style={{ padding: "8px 14px", fontSize: "13px", height: "38px", whiteSpace: "nowrap" }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="meta">Loading student requests…</p>
          ) : filteredStudents.length === 0 ? (
            <p className="panel-copy">No student registration requests matching criteria.</p>
          ) : (
            <div className="table-wrap">
              <table className="students">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Full Name</th>
                    <th>Father Name</th>
                    <th>Department &amp; Program</th>
                    <th>Semester</th>
                    <th>Email &amp; Mobile</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <strong>{req.rollNumber}</strong>
                      </td>
                      <td>{req.fullName}</td>
                      <td>{req.fatherName}</td>
                      <td>
                        <div>{req.department}</div>
                        <div className="meta" style={{ fontSize: "12px" }}>{req.program} ({req.batchSession})</div>
                      </td>
                      <td>Sem {req.semester}</td>
                      <td>
                        <div>{req.email}</div>
                        <div className="meta" style={{ fontSize: "12px" }}>{req.mobileNumber}</div>
                      </td>
                      <td>{renderStatusBadge(req.status)}</td>
                      <td>{formatDisplayTimestamp(req.createdAt)}</td>
                      <td className="row-actions" style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => setReviewItem({ type: "student", student: req })}
                          style={{ padding: "6px 12px", fontSize: "13px" }}
                        >
                          Review
                        </button>
                        {req.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionPendingId === req.id}
                              onClick={() => void handleApprove("student", req.id, req.fullName, req.email)}
                              style={{ padding: "6px 12px", fontSize: "13px" }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button-quiet"
                              disabled={actionPendingId === req.id}
                              onClick={() => void handleReject("student", req.id)}
                              style={{ padding: "6px 12px", fontSize: "13px" }}
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* Teacher Section */
        <section className="panel form-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
            <h2>Teacher Registration Requests</h2>
            <span className="meta">{filteredTeachers.length} {filteredTeachers.length === 1 ? "request" : "requests"} found</span>
          </div>

          {/* Teacher Filter Toolbar: Each filter is only one box (search + dropdown combined) */}
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
              value={teacherEmp}
              onChange={setTeacherEmp}
              options={distinctTeacherEmpIds}
            />

            <SearchableCombobox
              label="Search Teacher Name"
              placeholder="Search / select teacher name…"
              value={teacherName}
              onChange={setTeacherName}
              options={distinctTeacherNames}
            />

            <SearchableCombobox
              label="Search Department"
              placeholder="Search / select department…"
              value={teacherDept}
              onChange={setTeacherDept}
              options={masterDepts}
            />

            <SearchableCombobox
              label="Search Designation"
              placeholder="Search / select designation…"
              value={teacherDesignation}
              onChange={setTeacherDesignation}
              options={masterDesignations}
            />

            {hasTeacherFilters && (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={clearTeacherFilters}
                  style={{ padding: "8px 14px", fontSize: "13px", height: "38px", whiteSpace: "nowrap" }}
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="meta">Loading teacher requests…</p>
          ) : filteredTeachers.length === 0 ? (
            <p className="panel-copy">No teacher registration requests matching criteria.</p>
          ) : (
            <div className="table-wrap">
              <table className="students">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Full Name</th>
                    <th>Father Name</th>
                    <th>Department &amp; Designation</th>
                    <th>Joining Date</th>
                    <th>Email &amp; Mobile</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <strong>{req.employeeId}</strong>
                      </td>
                      <td>{req.fullName}</td>
                      <td>{req.fatherName}</td>
                      <td>
                        <div>{req.department}</div>
                        <div className="meta" style={{ fontSize: "12px" }}>{req.designation}</div>
                      </td>
                      <td>{formatDisplayDate(req.joiningDate)}</td>
                      <td>
                        <div>{req.email}</div>
                        <div className="meta" style={{ fontSize: "12px" }}>{req.mobileNumber}</div>
                      </td>
                      <td>{renderStatusBadge(req.status)}</td>
                      <td>{formatDisplayTimestamp(req.createdAt)}</td>
                      <td className="row-actions" style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => setReviewItem({ type: "teacher", teacher: req })}
                          style={{ padding: "6px 12px", fontSize: "13px" }}
                        >
                          Review
                        </button>
                        {req.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              disabled={actionPendingId === req.id}
                              onClick={() => void handleApprove("teacher", req.id, req.fullName, req.email)}
                              style={{ padding: "6px 12px", fontSize: "13px" }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button-quiet"
                              disabled={actionPendingId === req.id}
                              onClick={() => void handleReject("teacher", req.id)}
                              style={{ padding: "6px 12px", fontSize: "13px" }}
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Review Details Modal */}
      {reviewItem ? (
        <div className="confirm-modal-backdrop" onClick={() => setReviewItem(null)}>
          <div
            className="panel form-panel confirm-modal-card"
            style={{ width: "min(640px, 100%)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2>Review {reviewItem.type === "student" ? "Student" : "Teacher"} Request</h2>
              {reviewItem.type === "student" && reviewItem.student
                ? renderStatusBadge(reviewItem.student.status)
                : reviewItem.teacher
                  ? renderStatusBadge(reviewItem.teacher.status)
                  : null}
            </div>

            {reviewItem.type === "student" && reviewItem.student ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "14px" }}>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Roll Number</span>
                  <strong>{reviewItem.student.rollNumber}</strong>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Full Name</span>
                  <strong>{reviewItem.student.fullName}</strong>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Father&apos;s Name</span>
                  <span>{reviewItem.student.fatherName}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Gender</span>
                  <span>{reviewItem.student.gender}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Date of Birth</span>
                  <span>{formatDisplayDate(reviewItem.student.dateOfBirth)}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Department</span>
                  <span>{reviewItem.student.department}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Program</span>
                  <span>{reviewItem.student.program}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Semester</span>
                  <span>Semester {reviewItem.student.semester}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Batch / Session</span>
                  <span>{reviewItem.student.batchSession}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Enrollment Date</span>
                  <span>{formatDisplayDate(reviewItem.student.enrollmentDate)}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Mobile Number</span>
                  <span>{reviewItem.student.mobileNumber}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Email Address</span>
                  <span>{reviewItem.student.email}</span>
                </div>
                <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                  <span className="eyebrow" style={{ display: "block" }}>Submission Date</span>
                  <span className="meta">{formatDisplayTimestamp(reviewItem.student.createdAt)}</span>
                </div>
              </div>
            ) : reviewItem.teacher ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "14px" }}>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Employee ID</span>
                  <strong>{reviewItem.teacher.employeeId}</strong>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Full Name</span>
                  <strong>{reviewItem.teacher.fullName}</strong>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Father&apos;s Name</span>
                  <span>{reviewItem.teacher.fatherName}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Gender</span>
                  <span>{reviewItem.teacher.gender}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Date of Birth</span>
                  <span>{formatDisplayDate(reviewItem.teacher.dateOfBirth)}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Department</span>
                  <span>{reviewItem.teacher.department}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Designation</span>
                  <span>{reviewItem.teacher.designation}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Joining Date</span>
                  <span>{formatDisplayDate(reviewItem.teacher.joiningDate)}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Mobile Number</span>
                  <span>{reviewItem.teacher.mobileNumber}</span>
                </div>
                <div>
                  <span className="eyebrow" style={{ display: "block" }}>Email Address</span>
                  <span>{reviewItem.teacher.email}</span>
                </div>
                <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
                  <span className="eyebrow" style={{ display: "block" }}>Submission Date</span>
                  <span className="meta">{formatDisplayTimestamp(reviewItem.teacher.createdAt)}</span>
                </div>
              </div>
            ) : null}

            <div className="actions" style={{ marginTop: "24px", justifyContent: "flex-end" }}>
              <button type="button" className="button-quiet" onClick={() => setReviewItem(null)}>
                Close
              </button>
              {reviewItem.type === "student" && reviewItem.student && reviewItem.student.status === "PENDING" ? (
                <>
                  <button
                    type="button"
                    className="button-quiet"
                    disabled={actionPendingId === reviewItem.student.id}
                    onClick={() => void handleReject("student", reviewItem.student!.id)}
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    disabled={actionPendingId === reviewItem.student.id}
                    onClick={() =>
                      void handleApprove(
                        "student",
                        reviewItem.student!.id,
                        reviewItem.student!.fullName,
                        reviewItem.student!.email,
                      )
                    }
                  >
                    Approve Registration
                  </button>
                </>
              ) : null}
              {reviewItem.type === "teacher" && reviewItem.teacher && reviewItem.teacher.status === "PENDING" ? (
                <>
                  <button
                    type="button"
                    className="button-quiet"
                    disabled={actionPendingId === reviewItem.teacher.id}
                    onClick={() => void handleReject("teacher", reviewItem.teacher!.id)}
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    disabled={actionPendingId === reviewItem.teacher.id}
                    onClick={() =>
                      void handleApprove(
                        "teacher",
                        reviewItem.teacher!.id,
                        reviewItem.teacher!.fullName,
                        reviewItem.teacher!.email,
                      )
                    }
                  >
                    Approve Registration
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
