"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MemberIdCard } from "@/app/components/member-id-card";
import { formatDisplayDate } from "@/lib/dates";
import type { TeacherView } from "@/lib/teachers";
import type { LoanView } from "@/lib/circulation";

function labelGender(gender: TeacherView["gender"]) {
  return gender === "MALE" ? "Male" : "Female";
}

function labelStatus(status: TeacherView["status"]) {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherView | null>(null);
  const [loans, setLoans] = useState<LoanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const teacherRes = await fetch(`/api/teachers/${params.id}`, {
          cache: "no-store",
        });
        if (teacherRes.status === 404) {
          if (!ignore) {
            setError("Teacher not found.");
          }
          return;
        }
        if (!teacherRes.ok) {
          throw new Error("Could not load the teacher.");
        }

        const teacherBody = (await teacherRes.json()) as TeacherView;
        if (!ignore) {
          setTeacher(teacherBody);
        }

        // Fetch circulation loans
        const loansRes = await fetch("/api/loans", { cache: "no-store" });
        if (loansRes.ok && !ignore) {
          const allLoans = (await loansRes.json()) as LoanView[];
          setLoans(
            allLoans.filter(
              (l) => l.borrowerKind === "teacher" && l.teacherId === Number(params.id),
            ),
          );
        }
      } catch {
        if (!ignore) {
          setError("Could not load the teacher details.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  async function toggleStatus() {
    if (!teacher) {
      return;
    }

    const nextStatus = teacher.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setPending(true);
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
      setTeacher((await response.json()) as TeacherView);
    } catch {
      setError("Could not update the teacher status.");
    } finally {
      setPending(false);
    }
  }

  async function removeTeacher() {
    if (!teacher) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the teacher.");
      }

      router.push("/teachers");
      router.refresh();
    } catch {
      setError("Could not delete the teacher.");
      setPending(false);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Teacher Profile Management</p>
          <h1>{teacher ? teacher.fullName : "Teacher profile"}</h1>
          <p className="lede">
            <Link href="/teachers">← Back to Teachers Directory</Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading teacher profile…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

      {teacher ? (
        <>
          {/* Hero: Digital ID Card & Quick Administration */}
          <section className="profile-hero-grid" style={{ marginBottom: 24 }}>
            <div className="profile-hero-card-col">
              <MemberIdCard role="teacher" member={teacher} showPrintButton={true} />
            </div>

            <div className="panel form-panel profile-quota-panel">
              <div className="quota-panel-header">
                <h2>Administrative Overview</h2>
                <span
                  className={
                    teacher.status === "ACTIVE" ? "badge active" : "badge suspended"
                  }
                >
                  {labelStatus(teacher.status)}
                </span>
              </div>

              <p className="panel-copy" style={{ marginTop: 4, marginBottom: 16 }}>
                Manage library faculty privileges, account activation, and official records.
              </p>

              <div className="profile-stats-grid">
                <div className="profile-stat-box">
                  <span className="profile-stat-label">Active Loans</span>
                  <strong className="profile-stat-value">{loans.length}</strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Designation</span>
                  <strong className="profile-stat-value" style={{ fontSize: "1.05rem" }}>
                    {teacher.designation}
                  </strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Department</span>
                  <strong className="profile-stat-value" style={{ fontSize: "1.05rem" }}>
                    {teacher.department}
                  </strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Status</span>
                  <strong
                    className="profile-stat-value"
                    style={{ color: teacher.status === "ACTIVE" ? "var(--ok)" : "var(--danger)" }}
                  >
                    {labelStatus(teacher.status)}
                  </strong>
                </div>
              </div>

              <div className="profile-quota-actions" style={{ marginTop: 20 }}>
                <Link
                  href={`/loans?teacherId=${teacher.id}`}
                  className="button-solid button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  + Issue Book to Teacher
                </Link>
                <Link
                  href={`/teachers/${teacher.id}/edit`}
                  className="button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  Edit Teacher Details
                </Link>
                <button
                  type="button"
                  className="button-quiet"
                  disabled={pending}
                  onClick={() => void toggleStatus()}
                >
                  {teacher.status === "ACTIVE" ? "Suspend Account" : "Activate Account"}
                </button>
                {confirmingDelete ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="button-danger"
                      disabled={pending}
                      onClick={() => void removeTeacher()}
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      className="button-quiet"
                      disabled={pending}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button-danger"
                    disabled={pending}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete Teacher
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Academic & Professional Information Panel */}
          <section className="panel form-panel" style={{ marginBottom: 24 }}>
            <h2>Faculty &amp; Professional Details</h2>
            <dl className="detail-grid" style={{ marginTop: 16 }}>
              <Detail label="Employee ID" value={teacher.employeeId} />
              <Detail label="Full Name" value={teacher.fullName} />
              <Detail label="Father Name" value={teacher.fatherName} />
              <Detail label="Gender" value={labelGender(teacher.gender)} />
              <Detail
                label="Date of Birth"
                value={formatDisplayDate(teacher.dateOfBirth)}
              />
              <Detail label="Department" value={teacher.department} />
              <Detail label="Designation" value={teacher.designation} />
              <Detail
                label="Joining Date"
                value={formatDisplayDate(teacher.joiningDate)}
              />
              <Detail label="Mobile Number" value={teacher.mobileNumber} />
              <Detail label="Email Address" value={teacher.email} />
            </dl>
          </section>

          {/* Active Borrowed Books by this Teacher */}
          <section className="panel form-panel">
            <h2>Currently Borrowed Books ({loans.length})</h2>
            <p className="panel-copy">
              Circulation books actively issued to this faculty member.
            </p>

            {loans.length === 0 ? (
              <p className="panel-copy" style={{ marginTop: 12 }}>
                This teacher currently has no borrowed books.
              </p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="students">
                  <thead>
                    <tr>
                      <th>Book Title</th>
                      <th>Barcode</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Return Permission</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <Link href={`/books/${loan.bookId}`}>
                            <strong>{loan.bookName}</strong>
                          </Link>
                          {loan.authorName ? (
                            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              By {loan.authorName}
                            </div>
                          ) : null}
                        </td>
                        <td>{loan.barcode || "—"}</td>
                        <td>{formatDisplayDate(loan.issueDate)}</td>
                        <td>
                          <span className={loan.overdue ? "overdue" : undefined}>
                            {formatDisplayDate(loan.dueDate)} {loan.overdue ? " (Overdue)" : ""}
                          </span>
                        </td>
                        <td>
                          {loan.overdue ? (
                            <span className="badge" style={{ background: "#ef4444", color: "#fff" }}>
                              Overdue
                            </span>
                          ) : (
                            <span className="badge active">Active</span>
                          )}
                        </td>
                        <td>
                          {loan.returnAllowed ? (
                            <span className="badge" style={{ background: "#16a34a", color: "#fff" }}>
                              ✓ Allowed by Teacher
                            </span>
                          ) : (
                            <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                              ⏳ Pending Permission
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                            {loan.returnAllowed ? "Eligible for Return" : "Waiting for Teacher Permission"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
