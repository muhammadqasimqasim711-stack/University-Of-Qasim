"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MemberIdCard } from "@/app/components/member-id-card";
import { formatDisplayDate } from "@/lib/dates";
import type { StudentView } from "@/lib/students";
import type { TeacherView } from "@/lib/teachers";
import type { LoanView } from "@/lib/circulation";

type RoleType = "student" | "teacher";

type ProfileData = {
  role: RoleType;
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
};

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export default function AdminProfilesPage() {
  const [role, setRole] = useState<RoleType>("student");
  const [students, setStudents] = useState<StudentView[]>([]);
  const [teachers, setTeachers] = useState<TeacherView[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "loans">("info");

  // Search & Filter state
  const [searchInput, setSearchInput] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputId = useId();

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }
    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen]);

  // 1. Fetch Students and Teachers list
  useEffect(() => {
    let ignore = false;

    async function loadMembers() {
      setLoadingList(true);
      setError("");
      try {
        const [resStudents, resTeachers] = await Promise.all([
          fetch("/api/students", { cache: "no-store" }),
          fetch("/api/teachers", { cache: "no-store" }),
        ]);

        if (resStudents.ok && !ignore) {
          const stuData = (await resStudents.json()) as StudentView[];
          setStudents(stuData);
          if (stuData.length > 0) {
            setSelectedStudentId((prev) => {
              if (prev) return prev;
              const firstId = stuData[0].id;
              setSearchInput(`${stuData[0].rollNumber} — ${stuData[0].fullName}`);
              return firstId;
            });
          }
        }

        if (resTeachers.ok && !ignore) {
          const teaData = (await resTeachers.json()) as TeacherView[];
          setTeachers(teaData);
          if (teaData.length > 0 && !selectedTeacherId) {
            setSelectedTeacherId(teaData[0].id);
          }
        }
      } catch {
        if (!ignore) {
          setError("Failed to load members list from database.");
        }
      } finally {
        if (!ignore) {
          setLoadingList(false);
        }
      }
    }

    void loadMembers();

    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch specific profile when role or selected ID changes
  const activeSelectedId = role === "student" ? selectedStudentId : selectedTeacherId;

  useEffect(() => {
    let ignore = false;

    async function fetchMemberProfile() {
      if (!activeSelectedId) {
        setProfileData(null);
        return;
      }

      setLoadingProfile(true);
      setError("");

      try {
        const res = await fetch(`/api/profile?role=${role}&id=${activeSelectedId}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Could not load member profile details.");
        }

        const data = (await res.json()) as ProfileData;
        if (!ignore) {
          setProfileData(data);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err.message || "Failed to load profile.");
        }
      } finally {
        if (!ignore) {
          setLoadingProfile(false);
        }
      }
    }

    void fetchMemberProfile();

    return () => {
      ignore = true;
    };
  }, [role, activeSelectedId]);

  // Distinct departments for filter
  const departments = useMemo(() => {
    const list = role === "student" ? students : teachers;
    const depts = new Set<string>();
    list.forEach((item) => {
      if (item.department) depts.add(item.department);
    });
    return Array.from(depts).sort();
  }, [role, students, teachers]);

  // Current active member
  const currentMember = useMemo(() => {
    if (role === "student") {
      return students.find((s) => s.id === selectedStudentId) || null;
    }
    return teachers.find((t) => t.id === selectedTeacherId) || null;
  }, [role, selectedStudentId, selectedTeacherId, students, teachers]);

  // Members filtered by department (for direct <select> dropdown)
  const departmentMembers = useMemo(() => {
    const list = role === "student" ? students : teachers;
    if (!deptFilter) return list;
    return list.filter(
      (m) => m.department.toLowerCase() === deptFilter.toLowerCase()
    );
  }, [role, students, teachers, deptFilter]);

  // Search Results for the Search Bar with Dropdown
  const searchResults = useMemo(() => {
    const list = role === "student" ? students : teachers;
    return list.filter((item) => {
      // 1. Department filter
      if (deptFilter && item.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }

      // 2. Search query filter
      if (!searchInput.trim()) {
        return true;
      }

      const q = searchInput.toLowerCase().trim();

      // If searchInput exactly matches the active member's label, don't restrict to just that single item
      const activeLabel =
        role === "student"
          ? `${(item as StudentView).rollNumber} — ${item.fullName}`.toLowerCase()
          : `${(item as TeacherView).employeeId} — ${item.fullName}`.toLowerCase();
      if (searchInput.trim().toLowerCase() === activeLabel) {
        return true;
      }

      if (role === "student") {
        const s = item as StudentView;
        return (
          s.rollNumber.toLowerCase().includes(q) ||
          s.fullName.toLowerCase().includes(q) ||
          s.fatherName.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          s.program.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.mobileNumber.toLowerCase().includes(q)
        );
      } else {
        const t = item as TeacherView;
        return (
          t.employeeId.toLowerCase().includes(q) ||
          t.fullName.toLowerCase().includes(q) ||
          t.fatherName.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.designation.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.mobileNumber.toLowerCase().includes(q)
        );
      }
    });
  }, [role, students, teachers, deptFilter, searchInput]);

  function handleSelectMember(id: number) {
    if (role === "student") {
      setSelectedStudentId(id);
      const stu = students.find((s) => s.id === id);
      if (stu) {
        setSearchInput(`${stu.rollNumber} — ${stu.fullName}`);
      }
    } else {
      setSelectedTeacherId(id);
      const tea = teachers.find((t) => t.id === id);
      if (tea) {
        setSearchInput(`${tea.employeeId} — ${tea.fullName}`);
      }
    }
    setIsSearchOpen(false);
  }

  function handleRoleSwitch(newRole: RoleType) {
    setRole(newRole);
    setSearchInput("");
    setDeptFilter("");
    setIsSearchOpen(false);
    if (newRole === "student" && students.length > 0) {
      const firstStu = students[0];
      setSelectedStudentId(firstStu.id);
      setSearchInput(`${firstStu.rollNumber} — ${firstStu.fullName}`);
    } else if (newRole === "teacher" && teachers.length > 0) {
      const firstTea = teachers[0];
      setSelectedTeacherId(firstTea.id);
      setSearchInput(`${firstTea.employeeId} — ${firstTea.fullName}`);
    }
  }

  const isStudent = role === "student";
  const student = isStudent && profileData ? (profileData.profile as StudentView) : null;
  const teacher = !isStudent && profileData ? (profileData.profile as TeacherView) : null;

  const quotaUsedPercent = profileData
    ? Math.min(
        100,
        Math.round(
          (profileData.quota.activeLoansCount / Math.max(1, profileData.quota.maxBooks)) * 100
        )
      )
    : 0;

  const isFiltered = Boolean(deptFilter || (searchInput && (!currentMember || searchInput !== (isStudent ? `${(currentMember as StudentView).rollNumber} — ${currentMember.fullName}` : `${(currentMember as TeacherView).employeeId} — ${currentMember.fullName}`))));

  return (
    <main className="shell shell-wide">
      {/* Masthead */}
      <header className="masthead">
        <div>
          <p className="eyebrow">Admin Portal • Member Profiles</p>
          <h1>Profiles Directory</h1>
          <p className="lede">
            Search, select, and inspect complete member digital profiles, official ID cards, real-time borrowing quotas, and active circulation records.
          </p>
        </div>
      </header>

      {/* Role Toggle Tabs */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginRight: 4 }}>
          Profile Role:
        </span>
        <button
          type="button"
          className={role === "student" ? "category-pill active" : "category-pill"}
          onClick={() => handleRoleSwitch("student")}
          style={{ padding: "8px 18px", fontSize: 13.5 }}
        >
          👨‍🎓 Student Profiles ({students.length})
        </button>
        <button
          type="button"
          className={role === "teacher" ? "category-pill active" : "category-pill"}
          onClick={() => handleRoleSwitch("teacher")}
          style={{ padding: "8px 18px", fontSize: 13.5 }}
        >
          👩‍🏫 Teacher Profiles ({teachers.length})
        </button>
      </div>

      {/* Search & Selection Toolbar (Soft Coffee Color Scheme) */}
      <section
        style={{
          background: "var(--soft-coffee, #e5d5c5)",
          padding: "16px 18px",
          borderRadius: "10px",
          border: "1px solid #d4c2b0",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "14px",
            alignItems: "end",
          }}
        >
          {/* 1. Interactive Search Bar with Live Dropdown */}
          <div ref={searchContainerRef} style={{ position: "relative", minWidth: "260px" }}>
            <label
              htmlFor={searchInputId}
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "5px",
              }}
            >
              Search & Select {isStudent ? "Student (Roll # / Name)" : "Teacher (Emp ID / Name)"} *
            </label>

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1,
                }}
              >
                🔍
              </span>

              <input
                ref={searchInputRef}
                id={searchInputId}
                type="text"
                value={searchInput}
                placeholder={
                  isStudent
                    ? "Search roll #, name, department, email…"
                    : "Search emp ID, name, department, email…"
                }
                autoComplete="off"
                onFocus={(e) => {
                  setIsSearchOpen(true);
                  e.target.select();
                }}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!isSearchOpen) setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                  } else if (e.key === "ArrowDown") {
                    if (!isSearchOpen) setIsSearchOpen(true);
                  } else if (e.key === "Enter" && isSearchOpen && searchResults.length > 0) {
                    e.preventDefault();
                    handleSelectMember(searchResults[0].id);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "9px 66px 9px 32px",
                  borderRadius: "6px",
                  border: "1px solid #c8b6a3",
                  background: "#ffffff",
                  fontSize: "13px",
                  color: "var(--ink)",
                  height: "40px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />

              {/* Right actions: Clear button + Dropdown Chevron */}
              <div
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setIsSearchOpen(true);
                      searchInputRef.current?.focus();
                    }}
                    title="Clear search"
                    aria-label="Clear search"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 5px",
                      fontSize: "16px",
                      lineHeight: 1,
                      color: "var(--muted)",
                      borderRadius: "3px",
                    }}
                  >
                    ×
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen((prev) => !prev);
                    if (!isSearchOpen) {
                      searchInputRef.current?.focus();
                    }
                  }}
                  title="Toggle member dropdown"
                  aria-label="Toggle member dropdown"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 6px",
                    fontSize: "10px",
                    lineHeight: 1,
                    color: "var(--muted)",
                    borderRadius: "3px",
                  }}
                >
                  {isSearchOpen ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {/* Live Autocomplete Dropdown Popover */}
            {isSearchOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  maxHeight: "290px",
                  overflowY: "auto",
                  background: "#ffffff",
                  border: "1px solid #c8b6a3",
                  borderRadius: "8px",
                  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.16)",
                  zIndex: 250,
                }}
              >
                <div
                  style={{
                    padding: "7px 12px",
                    background: "#f8f4ee",
                    borderBottom: "1px solid #ebd9c8",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    {searchResults.length} {isStudent ? "student" : "teacher"}
                    {searchResults.length === 1 ? "" : "s"} found
                  </span>
                  <span style={{ fontSize: "10.5px", opacity: 0.85 }}>
                    Select or press Enter
                  </span>
                </div>

                {searchResults.length === 0 ? (
                  <div
                    style={{
                      padding: "20px 14px",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "13px",
                      fontStyle: "italic",
                    }}
                  >
                    No {isStudent ? "students" : "teachers"} matching &ldquo;{searchInput}&rdquo;
                  </div>
                ) : (
                  searchResults.map((m) => {
                    const isSelected = m.id === activeSelectedId;
                    const badgeCode = isStudent
                      ? (m as StudentView).rollNumber
                      : (m as TeacherView).employeeId;
                    const subDetail = isStudent
                      ? `${(m as StudentView).department} • ${(m as StudentView).program} • ${(m as StudentView).email}`
                      : `${(m as TeacherView).department} • ${(m as TeacherView).designation} • ${(m as TeacherView).email}`;

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMember(m.id)}
                        style={{
                          padding: "10px 14px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f6f1ea",
                          background: isSelected ? "#eef6ee" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isSelected ? "#e4f1e4" : "#fbf7f2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isSelected ? "#eef6ee" : "transparent";
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                background: isSelected ? "var(--green)" : "#43302b",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "11px",
                                padding: "2px 7px",
                                borderRadius: "4px",
                                fontFamily: "monospace",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {badgeCode}
                            </span>
                            <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                              {m.fullName}
                            </strong>
                            {isSelected && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--green)",
                                  fontWeight: 700,
                                  background: "#dcf0dc",
                                  padding: "1px 6px",
                                  borderRadius: "3px",
                                }}
                              >
                                ✓ Current
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--muted)",
                              marginTop: "3px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {subDetail}
                          </div>
                        </div>

                        <span
                          className={`badge ${m.status === "ACTIVE" ? "active" : "suspended"}`}
                          style={{ fontSize: "10px", flexShrink: 0 }}
                        >
                          {m.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 2. Direct Select Dropdown */}
          <div style={{ minWidth: "220px" }}>
            <label
              htmlFor="direct-member-select"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "5px",
              }}
            >
              Choose from Dropdown ({departmentMembers.length})
            </label>
            <select
              id="direct-member-select"
              value={activeSelectedId ?? ""}
              onChange={(e) => {
                const numId = Number(e.target.value);
                if (numId) {
                  handleSelectMember(numId);
                }
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: "1px solid #c8b6a3",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--ink)",
                height: "40px",
                boxSizing: "border-box",
              }}
            >
              <option value="" disabled>
                -- Choose a {isStudent ? "Student" : "Teacher"} --
              </option>
              {departmentMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {isStudent
                    ? `${(m as StudentView).rollNumber} — ${m.fullName} (${m.department})`
                    : `${(m as TeacherView).employeeId} — ${m.fullName} (${m.department})`}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Department Dropdown */}
          <div style={{ minWidth: "180px" }}>
            <label
              htmlFor="dept-filter-select"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "5px",
              }}
            >
              Filter by Department
            </label>
            <select
              id="dept-filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "6px",
                border: "1px solid #c8b6a3",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--ink)",
                height: "40px",
                boxSizing: "border-box",
              }}
            >
              <option value="">All Departments ({departments.length})</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Reset Filters Button */}
          {isFiltered && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setDeptFilter("");
                  if (currentMember) {
                    setSearchInput(
                      isStudent
                        ? `${(currentMember as StudentView).rollNumber} — ${currentMember.fullName}`
                        : `${(currentMember as TeacherView).employeeId} — ${currentMember.fullName}`
                    );
                  } else {
                    setSearchInput("");
                  }
                  setIsSearchOpen(false);
                }}
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  height: "40px",
                  whiteSpace: "nowrap",
                  background: "#ffffff",
                  border: "1px solid #c8b6a3",
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Currently Selected Member Status Indicator */}
        {currentMember && (
          <div
            style={{
              marginTop: "14px",
              padding: "8px 14px",
              background: "#f7f1eb",
              borderRadius: "6px",
              border: "1px solid #dfcfc2",
              fontSize: "12.5px",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <span style={{ color: "var(--muted)", marginRight: 6 }}>Viewing Profile:</span>
              <strong>{currentMember.fullName}</strong>
              <span
                style={{
                  marginLeft: 8,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color: "#43302b",
                  background: "#e8dcce",
                  padding: "1px 7px",
                  borderRadius: 4,
                  fontSize: "11.5px",
                }}
              >
                {isStudent
                  ? (currentMember as StudentView).rollNumber
                  : (currentMember as TeacherView).employeeId}
              </span>
              <span style={{ marginLeft: 8, color: "var(--muted)" }}>
                • {currentMember.department}
              </span>
            </div>
            <span
              className={`badge ${currentMember.status === "ACTIVE" ? "active" : "suspended"}`}
              style={{ fontSize: "11px" }}
            >
              {currentMember.status === "ACTIVE" ? "Active Account" : "Suspended"}
            </span>
          </div>
        )}
      </section>

      {/* Loading & Error States */}
      {error ? (
        <p className="banner error" role="alert" style={{ marginBottom: 20 }}>
          {error}
        </p>
      ) : null}

      {loadingList ? (
        <p className="panel status">Loading member directory…</p>
      ) : (isStudent && students.length === 0) || (!isStudent && teachers.length === 0) ? (
        <div className="panel form-panel" style={{ textAlign: "center", padding: "40px 20px" }}>
          <h3>No {isStudent ? "Students" : "Teachers"} Found</h3>
          <p className="panel-copy" style={{ marginBottom: 16 }}>
            There are no {isStudent ? "student" : "teacher"} records registered in the system yet.
          </p>
          <Link
            href={isStudent ? "/students/new" : "/teachers/new"}
            className="button-solid button-link"
          >
            + Add New {isStudent ? "Student" : "Teacher"}
          </Link>
        </div>
      ) : loadingProfile && !profileData ? (
        <p className="panel status">Loading member profile details…</p>
      ) : profileData ? (
        <>
          {/* Hero Section: MemberIdCard + Quota Overview Panel */}
          <section className="profile-hero-grid" style={{ marginBottom: 24 }}>
            {/* Left Column: Official Member ID Card */}
            <div className="profile-hero-card-col">
              <MemberIdCard
                role={profileData.role}
                member={profileData.profile}
                libraryName={profileData.libraryConfig.libraryName}
                showPrintButton={true}
              />
            </div>

            {/* Right Column: Quota & Administrative Status Panel */}
            <div className="panel form-panel profile-quota-panel">
              <div className="quota-panel-header">
                <h2>Administrative Profile Overview</h2>
                <span
                  className={
                    profileData.profile.status === "ACTIVE" ? "badge active" : "badge suspended"
                  }
                >
                  {profileData.profile.status === "ACTIVE" ? "Active Borrower" : "Suspended"}
                </span>
              </div>

              <p className="panel-copy" style={{ marginTop: 4, marginBottom: 16 }}>
                Borrowing privileges and circulation limits for this {profileData.role} account.
              </p>

              {/* Overdue Alert */}
              {profileData.quota.overdueCount > 0 ? (
                <div className="profile-overdue-alert" style={{ marginBottom: 14 }}>
                  <span>
                    ⚠️ <strong>Notice:</strong> This member has {profileData.quota.overdueCount} overdue book(s).
                  </span>
                </div>
              ) : null}

              {/* Quota Gauge */}
              <div className="quota-meter-box">
                <div className="quota-meter-label-row">
                  <span className="quota-meter-title">Active Borrowing Quota</span>
                  <strong className="quota-meter-ratio">
                    {profileData.quota.activeLoansCount} / {profileData.quota.maxBooks} Books
                  </strong>
                </div>

                <div className="quota-meter-track">
                  <div
                    className={`quota-meter-fill ${profileData.quota.remainingQuota === 0 ? "maxed" : ""}`}
                    style={{ width: `${quotaUsedPercent}%` }}
                  />
                </div>

                <p className="quota-meter-caption">
                  {profileData.quota.remainingQuota > 0 ? (
                    <span>
                      ✓ Can borrow <strong>{profileData.quota.remainingQuota}</strong> more{" "}
                      {profileData.quota.remainingQuota === 1 ? "book" : "books"} under master configuration rules.
                    </span>
                  ) : (
                    <span style={{ color: "var(--danger)" }}>
                      ⚠️ Maximum borrowing quota reached ({profileData.quota.maxBooks} books).
                    </span>
                  )}
                </p>
              </div>

              {/* Key Metrics Chips */}
              <div className="profile-stats-grid">
                <div className="profile-stat-box">
                  <span className="profile-stat-label">Currently Borrowed</span>
                  <strong className="profile-stat-value">{profileData.quota.activeLoansCount}</strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Max Allowed Limit</span>
                  <strong className="profile-stat-value">{profileData.quota.maxBooks}</strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Borrowing Period</span>
                  <strong className="profile-stat-value">
                    {profileData.libraryConfig.borrowingPeriodDays} Days
                  </strong>
                </div>

                <div className="profile-stat-box">
                  <span className="profile-stat-label">Overdue Books</span>
                  <strong
                    className="profile-stat-value"
                    style={{
                      color: profileData.quota.overdueCount > 0 ? "var(--danger)" : "var(--ok)",
                    }}
                  >
                    {profileData.quota.overdueCount}
                  </strong>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="profile-quota-actions" style={{ marginTop: 20 }}>
                <Link
                  href={isStudent ? "/book-ledger/issue-students" : "/book-ledger/issue-teachers"}
                  className="button-solid button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  + Issue Book to {isStudent ? "Student" : "Teacher"}
                </Link>
                <Link
                  href={isStudent && student ? `/students/${student.id}/edit` : teacher ? `/teachers/${teacher.id}/edit` : "#"}
                  className="button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  ✏️ Edit Profile Details
                </Link>
                <Link
                  href="/book-ledger"
                  className="button-quiet button-link"
                  style={{ fontSize: "0.9rem" }}
                >
                  View Book Ledger
                </Link>
              </div>
            </div>
          </section>

          {/* Tab Navigation: Details vs Active Loans */}
          <section className="profile-tabs-section">
            <div className="profile-tabs-bar" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "info"}
                className={activeTab === "info" ? "active" : ""}
                onClick={() => setActiveTab("info")}
              >
                📋 {isStudent ? "Student Academic Details" : "Teacher Professional Details"}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "loans"}
                className={activeTab === "loans" ? "active" : ""}
                onClick={() => setActiveTab("loans")}
              >
                📚 Active Loans ({profileData.activeLoans.length})
              </button>
            </div>

            {/* Tab 1: Academic / Professional Details */}
            {activeTab === "info" ? (
              <div className="panel form-panel profile-tab-content">
                <h2>{isStudent ? "Official Student Record" : "Official Faculty Record"}</h2>
                <p className="panel-copy">
                  University of Qasim verified library registration details.
                </p>

                <dl className="detail-grid" style={{ marginTop: 18 }}>
                  {isStudent && student ? (
                    <>
                      <DetailItem label="Roll Number" value={<strong>{student.rollNumber}</strong>} />
                      <DetailItem label="Full Name" value={<strong>{student.fullName}</strong>} />
                      <DetailItem label="Father's Name" value={student.fatherName} />
                      <DetailItem label="Gender" value={student.gender === "MALE" ? "Male" : "Female"} />
                      <DetailItem label="Date of Birth" value={formatDisplayDate(student.dateOfBirth)} />
                      <DetailItem label="Department" value={student.department} />
                      <DetailItem label="Degree Program" value={student.program} />
                      <DetailItem label="Current Semester" value={`Semester ${student.semester}`} />
                      <DetailItem label="Batch / Session" value={student.batchSession} />
                      <DetailItem label="Enrollment Date" value={formatDisplayDate(student.enrollmentDate)} />
                      <DetailItem label="Mobile Number" value={student.mobileNumber} />
                      <DetailItem label="Official Email" value={student.email} />
                      <DetailItem
                        label="Status"
                        value={
                          <span
                            className={student.status === "ACTIVE" ? "badge active" : "badge suspended"}
                          >
                            {student.status === "ACTIVE" ? "Active" : "Suspended"}
                          </span>
                        }
                      />
                    </>
                  ) : teacher ? (
                    <>
                      <DetailItem label="Employee ID" value={<strong>{teacher.employeeId}</strong>} />
                      <DetailItem label="Full Name" value={<strong>{teacher.fullName}</strong>} />
                      <DetailItem label="Father's Name" value={teacher.fatherName} />
                      <DetailItem label="Gender" value={teacher.gender === "MALE" ? "Male" : "Female"} />
                      <DetailItem label="Date of Birth" value={formatDisplayDate(teacher.dateOfBirth)} />
                      <DetailItem label="Department" value={teacher.department} />
                      <DetailItem label="Designation" value={teacher.designation} />
                      <DetailItem label="Joining Date" value={formatDisplayDate(teacher.joiningDate)} />
                      <DetailItem label="Mobile Number" value={teacher.mobileNumber} />
                      <DetailItem label="Official Email" value={teacher.email} />
                      <DetailItem
                        label="Status"
                        value={
                          <span
                            className={teacher.status === "ACTIVE" ? "badge active" : "badge suspended"}
                          >
                            {teacher.status === "ACTIVE" ? "Active" : "Suspended"}
                          </span>
                        }
                      />
                    </>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {/* Tab 2: Active Loans */}
            {activeTab === "loans" ? (
              <div className="panel form-panel profile-tab-content">
                <h2>Currently Borrowed Books ({profileData.activeLoans.length})</h2>
                <p className="panel-copy">
                  Books currently checked out by this {profileData.role}.
                </p>

                {profileData.activeLoans.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontStyle: "italic", padding: "20px 0" }}>
                    No books are currently issued to this member.
                  </p>
                ) : (
                  <div className="table-wrap" style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Barcode</th>
                          <th>Book Title</th>
                          <th>Author</th>
                          <th>Issue Date</th>
                          <th>Due Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileData.activeLoans.map((loan) => (
                          <tr key={loan.id}>
                            <td>
                              <code>{loan.barcode || "—"}</code>
                            </td>
                            <td>
                              <strong>{loan.bookName}</strong>
                            </td>
                            <td>{loan.authorName}</td>
                            <td>{formatDisplayDate(loan.issueDate)}</td>
                            <td>
                              <span style={{ color: loan.overdue ? "var(--danger)" : "inherit", fontWeight: loan.overdue ? 700 : 400 }}>
                                {formatDisplayDate(loan.dueDate)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${loan.overdue ? "suspended" : "active"}`}>
                                {loan.overdue ? "Overdue" : "Active"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
