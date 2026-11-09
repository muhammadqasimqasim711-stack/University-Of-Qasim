"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MemberIdCard } from "@/app/components/member-id-card";
import { formatDisplayDate } from "@/lib/dates";
import type { StudentView } from "@/lib/students";
import type { LoanView } from "@/lib/circulation";

function labelGender(gender: StudentView["gender"]) {
  return gender === "MALE" ? "Male" : "Female";
}

function labelStatus(status: StudentView["status"]) {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentView | null>(null);
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
        const studentRes = await fetch(`/api/students/${params.id}`, {
          cache: "no-store",
        });
        if (studentRes.status === 404) {
          if (!ignore) {
            setError("Student not found.");
          }
          return;
        }
        if (!studentRes.ok) {
          throw new Error("Could not load the student.");
        }

        const studentBody = (await studentRes.json()) as StudentView;
        if (!ignore) {
          setStudent(studentBody);
        }

        // Fetch circulation loans
        const loansRes = await fetch("/api/loans", { cache: "no-store" });
        if (loansRes.ok && !ignore) {
          const allLoans = (await loansRes.json()) as LoanView[];
          setLoans(
            allLoans.filter(
              (l) => l.borrowerKind === "student" && l.studentId === Number(params.id),
            ),
          );
        }
      } catch {
        if (!ignore) {
          setError("Could not load the student details.");
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
    if (!student) {
      return;
    }

    const nextStatus = student.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setPending(true);
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
      setStudent((await response.json()) as StudentView);
    } catch {
      setError("Could not update the student status.");
    } finally {
      setPending(false);
    }
  }

  async function deleteStudent() {
    if (!student) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the student.");
      }

      router.push("/students");
      router.refresh();
    } catch {
      setError("Could not delete the student.");
      setPending(false);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Student Profile Management</p>
          <h1>{student ? student.fullName : "Student profile"}</h1>
          <p className="lede">
            <Link href="/students">← Back to Students Directory</Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading student profile…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

      {student ? (
        <>
          {/* Hero: Digital ID Card & Quick Administration */}
          <section className="profile-hero-grid" style={{ marginBottom: 24 }}>
            <div className="profile-hero-card-col">
              <MemberIdCard role="student" member={student} showPrintButton={true} />
            </div>

            <div className="panel form-panel profile-quota-panel">
              <div className="quota-panel-header">
                <h2>Administrative Overview</h2>
                <span
                  className={
                    student.status === "ACTIVE" ? "badge active" : "badge suspended"
                  }
                >
                  {labelStatus(student.status)}
                </span>
              </div>

              <p className="panel-copy" style={{ marginTop: 4, marginBottom: 16 }}>
                Manage library circulation privileges, account activation, and official records.
              </p>

              <div className="profile-stats-grid">
                <div className="profile-stat-box">
                  <span className="profile-stat-label">Active Loans</span>
                  <strong className="profile-stat-value">{loans.length}</strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Semester</span>
                  <strong className="profile-stat-value">Sem {student.semester}</strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Program</span>
                  <strong className="profile-stat-value" style={{ fontSize: "1.1rem" }}>
                    {student.program}
                  </strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Status</span>
                  <strong
                    className="profile-stat-value"
                    style={{ color: student.status === "ACTIVE" ? "var(--ok)" : "var(--danger)" }}
                  >
                    {labelStatus(student.status)}
                  </strong>
                </div>
              </div>

              <div className="profile-quota-actions" style={{ marginTop: 20 }}>
                <Link
                  href={`/loans?studentId=${student.id}`}
                  className="button-solid button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  + Issue Book to Student
                </Link>
                <Link
                  href={`/students/${student.id}/edit`}
                  className="button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  Edit Student Details
                </Link>
                <button
                  type="button"
                  className="button-quiet"
                  disabled={pending}
                  onClick={() => void toggleStatus()}
                >
                  {student.status === "ACTIVE" ? "Suspend Account" : "Activate Account"}
                </button>
                {confirmingDelete ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="button-danger"
                      disabled={pending}
                      onClick={() => void deleteStudent()}
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
                    Delete Student
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Academic & Personal Information Panel */}
          <section className="panel form-panel" style={{ marginBottom: 24 }}>
            <h2>Academic &amp; Registration Details</h2>
            <dl className="detail-grid" style={{ marginTop: 16 }}>
              <Detail label="Roll Number" value={student.rollNumber} />
              <Detail label="Full Name" value={student.fullName} />
              <Detail label="Father Name" value={student.fatherName} />
              <Detail label="Gender" value={labelGender(student.gender)} />
              <Detail
                label="Date of Birth"
                value={formatDisplayDate(student.dateOfBirth)}
              />
              <Detail label="Department" value={student.department} />
              <Detail label="Program" value={student.program} />
              <Detail label="Semester" value={`Semester ${student.semester}`} />
              <Detail label="Batch / Session" value={student.batchSession} />
              <Detail
                label="Enrollment Date"
                value={formatDisplayDate(student.enrollmentDate)}
              />
              <Detail label="Mobile Number" value={student.mobileNumber} />
              <Detail label="Email Address" value={student.email} />
            </dl>
          </section>

          {/* Active Borrowed Books by this Student */}
          <section className="panel form-panel">
            <h2>Currently Borrowed Books ({loans.length})</h2>
            <p className="panel-copy">
              Circulation books actively issued to this student.
            </p>

            {loans.length === 0 ? (
              <p className="panel-copy" style={{ marginTop: 12 }}>
                This student currently has no borrowed books.
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
                              ✓ Allowed by Student
                            </span>
                          ) : (
                            <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                              ⏳ Pending Permission
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                            {loan.returnAllowed ? "Eligible for Return" : "Waiting for Student Permission"}
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
