"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminViewMode, useSessionRole } from "@/app/session-context";
import { MemberIdCard } from "@/app/components/member-id-card";
import { formatDisplayDate } from "@/lib/dates";
import type { StudentView } from "@/lib/students";
import type { TeacherView } from "@/lib/teachers";
import type { LoanView } from "@/lib/circulation";

type ProfileData = {
  role: "student" | "teacher";
  profile: StudentView | TeacherView;
  quota: {
    maxBooks: number;
    activeLoansCount: number;
    remainingQuota: number;
    overdueCount: number;
  };
  activeLoans: LoanView[];
  libraryConfig: {
    libraryName: string;
    contactEmail: string;
    borrowingPeriodDays: number;
  };
  isAdminPreview?: boolean;
  adminInfo?: {
    username: string;
    role: string;
    libraryName: string;
    contactEmail: string;
  };
};

export default function ProfilePage() {
  const role = useSessionRole();
  const { adminViewMode, setAdminViewMode } = useAdminViewMode();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "loans" | "security">("info");
  const [previewRole, setPreviewRole] = useState<"student" | "teacher">("student");

  // Form states for contact & password update
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formPending, setFormPending] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function fetchProfile() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/profile?role=${previewRole}`, { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to load profile.");
        }

        const json = (await res.json()) as ProfileData;
        if (!ignore) {
          setData(json);
          setMobileNumber(json.profile.mobileNumber || "");
          setEmail(json.profile.email || "");
          if (json.role && json.role !== previewRole) {
            setPreviewRole(json.role);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Could not load profile.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchProfile();

    return () => {
      ignore = true;
    };
  }, [previewRole]);

  async function handleSwitchPreview(target: "student" | "teacher") {
    setPreviewRole(target);
    setLoading(true);
    try {
      const res = await fetch(`/api/profile?role=${target}`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as ProfileData;
        setData(json);
        setMobileNumber(json.profile.mobileNumber || "");
        setEmail(json.profile.email || "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveContact(event: React.FormEvent) {
    event.preventDefault();
    setFormPending(true);
    setFormError("");
    setFormMessage("");

    if (newPassword && newPassword !== confirmPassword) {
      setFormError("New password and confirm password do not match.");
      setFormPending(false);
      return;
    }

    try {
      const payload: Record<string, string> = {
        mobileNumber,
        email,
      };

      if (newPassword) {
        payload.password = newPassword;
        if (currentPassword) {
          payload.currentPassword = currentPassword;
        }
      }

      const query = data?.isAdminPreview ? `?role=${data.role}&id=${data.profile.id}` : "";
      const res = await fetch(`/api/profile${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || "Could not update profile.");
      }

      setFormMessage(body.message || "Profile updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Update local state
      if (data) {
        setData({
          ...data,
          profile: {
            ...data.profile,
            mobileNumber,
            email,
          },
        });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setFormPending(false);
    }
  }

  // Profile section is removed from Admin Portal only (available in Student & Teacher view)
  if (role === "admin" && adminViewMode !== "student-teacher") {
    return (
      <main className="shell shell-wide">
        <header className="masthead">
          <div>
            <p className="eyebrow">Admin Portal</p>
            <h1>Member Profile Portal</h1>
            <p className="lede">
              The Profile section is reserved for the Student &amp; Teacher portal. You are currently in the Admin Portal.
            </p>
          </div>
        </header>
        <div className="panel form-panel" style={{ textAlign: "center", padding: "36px 20px" }}>
          <p style={{ fontSize: "1.05rem", marginBottom: 20 }}>
            To inspect digital member ID cards, borrowing quotas, and student/teacher profile records, switch to the Student &amp; Teacher portal.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/configuration" className="button-solid">
              ↩ Return to Master Configuration
            </Link>
            <button
              type="button"
              className="button-go-student-teacher"
              onClick={() => {
                setAdminViewMode("student-teacher");
              }}
            >
              👁️ View as Student &amp; Teacher
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="shell shell-wide">
        <p className="panel status">Loading your library profile…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="shell shell-wide">
        <p className="banner error" role="alert">
          {error}
        </p>
        <Link href="/books" className="button-link">
          ← Back to Library Catalogue
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const isStudent = data.role === "student";
  const student = isStudent ? (data.profile as StudentView) : null;
  const teacher = !isStudent ? (data.profile as TeacherView) : null;
  const quotaUsedPercent = Math.min(
    100,
    Math.round((data.quota.activeLoansCount / Math.max(1, data.quota.maxBooks)) * 100),
  );

  return (
    <main className="shell shell-wide">
      {/* Header */}
      <header className="masthead">
        <div>
          <p className="eyebrow">
            {isStudent ? "Student Profile" : "Teacher Profile"}
          </p>
          <h1>My Library Profile</h1>
          <p className="lede">
            View your official university digital library card, check your real-time borrowing quotas, and keep your contact details up to date.
          </p>
        </div>
      </header>
      <div className="profile-section-green-line" aria-hidden="true" />

      {/* Admin Preview Mode Switcher */}
      {data.isAdminPreview ? (
        <aside className="status-pending-block" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <strong>🛡️ Administrator Inspection Mode:</strong> Logged in as <strong>{data.adminInfo?.username || "Administrator"}</strong>. Previewing digital library cards &amp; member quotas.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Preview As:</span>
            <button
              type="button"
              className={previewRole === "student" ? "category-pill active" : "category-pill"}
              onClick={() => void handleSwitchPreview("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={previewRole === "teacher" ? "category-pill active" : "category-pill"}
              onClick={() => void handleSwitchPreview("teacher")}
            >
              Teacher
            </button>
          </div>
        </aside>
      ) : null}

      {/* Hero Section: ID Card & Borrowing Quota Gauge */}
      <section className="profile-hero-grid">
        {/* Left: Official Digital Library Card */}
        <div className="profile-hero-card-col">
          <MemberIdCard
            role={data.role}
            member={data.profile}
            libraryName={data.libraryConfig.libraryName}
            showPrintButton={true}
          />
        </div>

        {/* Right: Borrowing Quota & Circulation Stats Panel */}
        <div className="panel form-panel profile-quota-panel">
          <div className="quota-panel-header">
            <h2>Borrowing Quota &amp; Status</h2>
            <span className="badge active">
              {data.profile.status === "ACTIVE" ? "Active Borrower" : "Suspended"}
            </span>
          </div>

          <p className="panel-copy" style={{ marginTop: 4, marginBottom: 16 }}>
            Your borrowing allowance is managed by the library master configuration.
          </p>

          {/* Overdue Warning */}
          {data.quota.overdueCount > 0 ? (
            <div className="profile-overdue-alert">
              <span>⚠️ <strong>Overdue Notice:</strong> You have {data.quota.overdueCount} overdue book(s). Please return them promptly.</span>
            </div>
          ) : null}

          {/* Visual Quota Meter */}
          <div className="quota-meter-box">
            <div className="quota-meter-label-row">
              <span className="quota-meter-title">Active Borrowing Quota</span>
              <strong className="quota-meter-ratio">
                {data.quota.activeLoansCount} / {data.quota.maxBooks} Books
              </strong>
            </div>

            <div className="quota-meter-track">
              <div
                className={`quota-meter-fill ${data.quota.remainingQuota === 0 ? "maxed" : ""}`}
                style={{ width: `${quotaUsedPercent}%` }}
              />
            </div>

            <p className="quota-meter-caption">
              {data.quota.remainingQuota > 0 ? (
                <span>
                  ✓ You can borrow <strong>{data.quota.remainingQuota}</strong> more{" "}
                  {data.quota.remainingQuota === 1 ? "book" : "books"} from the library shelves.
                </span>
              ) : (
                <span style={{ color: "var(--danger)" }}>
                  ⚠️ You have reached your maximum borrowing quota ({data.quota.maxBooks} books).
                </span>
              )}
            </p>
          </div>

          {/* Key Stats Chips */}
          <div className="profile-stats-grid">
            <div className="profile-stat-box">
              <span className="profile-stat-label">Currently Borrowed</span>
              <strong className="profile-stat-value">{data.quota.activeLoansCount}</strong>
            </div>

            <div className="profile-stat-box">
              <span className="profile-stat-label">Max Allowed Limit</span>
              <strong className="profile-stat-value">{data.quota.maxBooks}</strong>
            </div>

            <div className="profile-stat-box">
              <span className="profile-stat-label">Borrowing Period</span>
              <strong className="profile-stat-value">
                {data.libraryConfig.borrowingPeriodDays} Days
              </strong>
            </div>

            <div className="profile-stat-box">
              <span className="profile-stat-label">Overdue Books</span>
              <strong
                className="profile-stat-value"
                style={{ color: data.quota.overdueCount > 0 ? "var(--danger)" : "var(--ok)" }}
              >
                {data.quota.overdueCount}
              </strong>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="profile-quota-actions">
            <Link href="/my-book-ledger" className="button-solid button-link" style={{ fontSize: "0.9rem" }}>
              View Book ledger ({data.quota.activeLoansCount}) →
            </Link>
            <Link href="/books" className="button-quiet button-link" style={{ fontSize: "0.9rem" }}>
              Browse Books Catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section className="profile-tabs-section">
        <div className="profile-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            className={activeTab === "info" ? "active" : ""}
            onClick={() => setActiveTab("info")}
          >
            📋 Academic &amp; Personal Info
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "loans"}
            className={activeTab === "loans" ? "active" : ""}
            onClick={() => setActiveTab("loans")}
          >
            📚 My Active Loans ({data.activeLoans.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            className={activeTab === "security" ? "active" : ""}
            onClick={() => setActiveTab("security")}
          >
            ⚙️ Edit Contact &amp; Security
          </button>
        </div>

        {/* Tab 1: Academic & Personal Info */}
        {activeTab === "info" ? (
          <div className="panel form-panel profile-tab-content">
            <h2>{isStudent ? "Student Academic Details" : "Faculty Professional Details"}</h2>
            <p className="panel-copy">
              Official university registration details recorded with the University of Qasim library database.
            </p>

            <dl className="detail-grid" style={{ marginTop: 18 }}>
              {isStudent && student ? (
                <>
                  <DetailItem label="Roll Number" value={student.rollNumber} />
                  <DetailItem label="Full Name" value={student.fullName} />
                  <DetailItem label="Father Name" value={student.fatherName} />
                  <DetailItem label="Gender" value={student.gender === "MALE" ? "Male" : "Female"} />
                  <DetailItem label="Date of Birth" value={formatDisplayDate(student.dateOfBirth)} />
                  <DetailItem label="Department" value={student.department} />
                  <DetailItem label="Degree Program" value={student.program} />
                  <DetailItem label="Current Semester" value={`Semester ${student.semester}`} />
                  <DetailItem label="Batch / Session" value={student.batchSession} />
                  <DetailItem label="Enrollment Date" value={formatDisplayDate(student.enrollmentDate)} />
                  <DetailItem label="Mobile Number" value={student.mobileNumber} />
                  <DetailItem label="Official Email" value={student.email} />
                </>
              ) : teacher ? (
                <>
                  <DetailItem label="Employee ID" value={teacher.employeeId} />
                  <DetailItem label="Full Name" value={teacher.fullName} />
                  <DetailItem label="Father Name" value={teacher.fatherName} />
                  <DetailItem label="Gender" value={teacher.gender === "MALE" ? "Male" : "Female"} />
                  <DetailItem label="Date of Birth" value={formatDisplayDate(teacher.dateOfBirth)} />
                  <DetailItem label="Department" value={teacher.department} />
                  <DetailItem label="Designation" value={teacher.designation} />
                  <DetailItem label="Joining Date" value={formatDisplayDate(teacher.joiningDate)} />
                  <DetailItem label="Mobile Number" value={teacher.mobileNumber} />
                  <DetailItem label="Official Email" value={teacher.email} />
                </>
              ) : null}
            </dl>
          </div>
        ) : null}

        {/* Tab 2: Active Borrowed Books */}
        {activeTab === "loans" ? (
          <div className="panel form-panel profile-tab-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2>My Active Borrowed Books</h2>
                <p className="panel-copy">
                  Books currently checked out under your university ID card.
                </p>
              </div>
              <Link href="/my-book-ledger" className="button-link" style={{ fontSize: "0.85rem" }}>
                Open Book ledger →
              </Link>
            </div>

            {data.activeLoans.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px" }}>
                <p className="panel-copy" style={{ fontSize: "1.05rem" }}>
                  You currently have no active borrowed books.
                </p>
                <Link href="/books" className="button-solid button-link" style={{ marginTop: 12 }}>
                  Explore Books Catalogue
                </Link>
              </div>
            ) : (
              <div className="book-grid-3col" style={{ marginTop: 16 }}>
                {data.activeLoans.map((loan) => (
                  <article
                    key={loan.id}
                    className="book-card"
                    style={{
                      border: loan.overdue ? "2px solid #ef4444" : "1px solid var(--line)",
                    }}
                  >
                    <div className="book-card-cover-wrap">
                      {loan.imagePath ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={loan.imagePath}
                          alt={loan.bookName}
                          className="book-card-cover"
                        />
                      ) : (
                        <div className="book-card-placeholder">
                          <span>No cover</span>
                        </div>
                      )}
                    </div>

                    <div className="book-card-body">
                      <h3 className="book-card-title">
                        <Link href={`/books/${loan.bookId}`}>{loan.bookName}</Link>
                      </h3>
                      {loan.authorName ? (
                        <p className="book-card-author">By {loan.authorName}</p>
                      ) : null}

                      <div className="book-card-tags">
                        {loan.category ? <span className="book-tag">{loan.category}</span> : null}
                        {loan.shelf ? <span className="book-tag">Shelf {loan.shelf}</span> : null}
                      </div>

                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "8px 10px",
                          fontSize: "0.82rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                          marginTop: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--muted)" }}>Issue Date:</span>
                          <strong>{formatDisplayDate(loan.issueDate)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--muted)" }}>Due Date:</span>
                          <strong className={loan.overdue ? "overdue" : undefined}>
                            {formatDisplayDate(loan.dueDate)} {loan.overdue ? "⚠️ Overdue" : ""}
                          </strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--muted)" }}>Return Permission:</span>
                          <strong>
                            {loan.returnAllowed ? "✓ Ready for Return" : "Not Permitted Yet"}
                          </strong>
                        </div>
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: 10 }}>
                        <Link
                          href="/my-book-ledger"
                          className="button-link button-quiet"
                          style={{ width: "100%", textAlign: "center", fontSize: "0.82rem" }}
                        >
                          Open Book ledger →
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Tab 3: Edit Contact & Security */}
        {activeTab === "security" ? (
          <div className="panel form-panel profile-tab-content">
            <h2>Contact Details &amp; Account Security</h2>
            <p className="panel-copy">
              Keep your contact information up to date so the library can notify you about loan due dates and book arrivals.
            </p>

            {formError ? (
              <p className="banner error" role="alert" style={{ marginTop: 14 }}>
                {formError}
              </p>
            ) : null}

            {formMessage ? (
              <p className="banner ok" role="alert" style={{ marginTop: 14 }}>
                {formMessage}
              </p>
            ) : null}

            <form onSubmit={handleSaveContact} className="fields" style={{ marginTop: 16 }}>
              <div className="fields-grid" style={{ display: "grid", gap: 16 }}>
                <div className="field">
                  <label htmlFor="mobileNumber">Mobile Number *</label>
                  <input
                    id="mobileNumber"
                    name="mobileNumber"
                    type="tel"
                    placeholder="e.g. 03001234567"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required
                  />
                  <p className="field-help">10 to 15 digits phone number for SMS and WhatsApp notices.</p>
                </div>

                <div className="field">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="e.g. name@uoq.edu.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="field-help">Official email for overdue reminders and receipt notifications.</p>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>Change Account Password</h3>
                <p className="panel-copy" style={{ fontSize: "0.88rem", marginBottom: 14 }}>
                  Leave password fields blank if you do not wish to change your current password.
                </p>

                <div className="fields-grid" style={{ display: "grid", gap: 16 }}>
                  <div className="field">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="actions" style={{ marginTop: 24 }}>
                <button type="submit" disabled={formPending}>
                  {formPending ? "Saving Changes…" : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
