"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Gender } from "@/lib/students";
import {
  DEPARTMENTS,
  ACADEMIC_STRUCTURE,
  getProgramsForDepartment,
  FIVE_YEAR_BATCHES,
  TEACHER_DESIGNATIONS,
} from "@/lib/academic-data";

type RegistrationRole = "student" | "teacher";

type StudentFormState = {
  rollNumber: string;
  fullName: string;
  fatherName: string;
  gender: "" | Gender;
  dateOfBirth: string;
  department: string;
  program: string;
  semester: string;
  batchSession: string;
  enrollmentDate: string;
  mobileNumber: string;
  email: string;
  password: string;
};

type TeacherFormState = {
  employeeId: string;
  fullName: string;
  fatherName: string;
  gender: "" | Gender;
  dateOfBirth: string;
  department: string;
  designation: string;
  joiningDate: string;
  mobileNumber: string;
  email: string;
  password: string;
};

function computeTodayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeFifteenYearsAgo(): string {
  const d = new Date();
  const year = d.getFullYear() - 15;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initialStudentState: StudentFormState = {
  rollNumber: "",
  fullName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  department: "",
  program: "",
  semester: "1",
  batchSession: "2024-2029",
  enrollmentDate: computeTodayDate(),
  mobileNumber: "+92",
  email: "",
  password: "",
};

const initialTeacherState: TeacherFormState = {
  employeeId: "",
  fullName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  department: "",
  designation: "",
  joiningDate: computeTodayDate(),
  mobileNumber: "+92",
  email: "",
  password: "",
};

export function RegistrationForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [role, setRole] = useState<RegistrationRole>("student");
  const [studentValues, setStudentValues] = useState<StudentFormState>(initialStudentState);
  const [teacherValues, setTeacherValues] = useState<TeacherFormState>(initialTeacherState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState("");
  const [pending, setPending] = useState(false);
  const [maxDob, setMaxDob] = useState<string>(computeFifteenYearsAgo());

  // Real-time identifier availability status
  const [rollNumberStatus, setRollNumberStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  const [employeeIdStatus, setEmployeeIdStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  const [submittedInfo, setSubmittedInfo] = useState<{
    role: "student" | "teacher";
    name: string;
    identifier: string;
    email: string;
  } | null>(null);

  // Dynamic master data from Master Configuration
  const [masterDepts, setMasterDepts] = useState<string[]>(DEPARTMENTS);
  const [masterAcademicStructure, setMasterAcademicStructure] = useState<Record<string, string[]>>(ACADEMIC_STRUCTURE);
  const [masterSemesters, setMasterSemesters] = useState<string[]>(
    Array.from({ length: 12 }, (_, i) => String(i + 1))
  );
  const [masterBatches, setMasterBatches] = useState<string[]>([...FIVE_YEAR_BATCHES]);
  const [masterDesignations, setMasterDesignations] = useState<string[]>([...TEACHER_DESIGNATIONS]);

  // Load live master data on mount
  useEffect(() => {
    fetch("/api/master/all")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.departments && data.departments.length > 0) {
          setMasterDepts(data.departments);
        }
        if (data.academicStructure && Object.keys(data.academicStructure).length > 0) {
          setMasterAcademicStructure(data.academicStructure);
        }
        if (data.semesters && data.semesters.length > 0) {
          setMasterSemesters(data.semesters);
        }
        if (data.batches && data.batches.length > 0) {
          setMasterBatches(data.batches);
        }
        if (data.designations && data.designations.length > 0) {
          setMasterDesignations(data.designations);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch initial dates on mount
  useEffect(() => {
    let active = true;
    fetch("/api/registration-requests/next-roll-number")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.enrollmentDate) {
          setStudentValues((curr) => ({
            ...curr,
            enrollmentDate: data.enrollmentDate,
          }));
        }
        if (data.maxDateOfBirth) {
          setMaxDob(data.maxDateOfBirth);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  function switchRole(newRole: RegistrationRole) {
    setRole(newRole);
    setFieldErrors({});
    setGeneralError("");
  }

  function updateStudent<K extends keyof StudentFormState>(key: K, value: StudentFormState[K]) {
    setStudentValues((curr) => ({ ...curr, [key]: value }));
  }

  function updateTeacher<K extends keyof TeacherFormState>(key: K, value: TeacherFormState[K]) {
    setTeacherValues((curr) => ({ ...curr, [key]: value }));
  }

  // Check student roll number availability on blur/change
  async function checkRollNumberAvailability(roll: string) {
    const trimmed = roll.trim();
    if (!trimmed) {
      setRollNumberStatus({ checking: false, available: null, message: "" });
      return;
    }
    if (!/^\d{5,6}$/.test(trimmed)) {
      setRollNumberStatus({
        checking: false,
        available: false,
        message: "Roll number must be 5 to 6 digits numeric only.",
      });
      return;
    }

    setRollNumberStatus({ checking: true, available: null, message: "Checking availability…" });
    try {
      const res = await fetch(`/api/registration-requests/check-availability?type=student&value=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setRollNumberStatus({
        checking: false,
        available: data.available,
        message: data.message || (data.available ? "Roll number is available." : "Already in use."),
      });
    } catch {
      setRollNumberStatus({ checking: false, available: null, message: "" });
    }
  }

  // Check teacher employee ID availability on blur/change
  async function checkEmployeeIdAvailability(empId: string) {
    const trimmed = empId.trim().toUpperCase();
    if (!trimmed) {
      setEmployeeIdStatus({ checking: false, available: null, message: "" });
      return;
    }
    if (!/^EMP-\d{3,}$/i.test(trimmed)) {
      setEmployeeIdStatus({
        checking: false,
        available: false,
        message: "Format must be EMP-001 (EMP- followed by 3+ numbers).",
      });
      return;
    }

    setEmployeeIdStatus({ checking: true, available: null, message: "Checking availability…" });
    try {
      const res = await fetch(`/api/registration-requests/check-availability?type=teacher&value=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setEmployeeIdStatus({
        checking: false,
        available: data.available,
        message: data.message || (data.available ? "Employee ID is available." : "Already in use."),
      });
    } catch {
      setEmployeeIdStatus({ checking: false, available: null, message: "" });
    }
  }

  // Handle department change to reset program
  function handleDepartmentChange(dept: string) {
    setStudentValues((curr) => ({
      ...curr,
      department: dept,
      program: "",
    }));
  }

  // Smart Pakistan mobile number handler
  function handleMobileNumberChange(raw: string, roleType: "student" | "teacher") {
    let val = raw.trim();
    if (val.startsWith("03")) {
      val = "+92" + val.slice(1);
    } else if (val.startsWith("3") && !val.startsWith("+92")) {
      val = "+92" + val;
    }
    if (roleType === "student") {
      updateStudent("mobileNumber", val);
    } else {
      updateTeacher("mobileNumber", val);
    }
  }

  // Real-time password criteria for student
  const studentPasswordChecks = useMemo(() => {
    const pw = studentValues.password;
    const commonPasswords = [
      "password",
      "password123",
      "12345678",
      "123456789",
      "qwerty123",
      "admin123",
      "uoq12345",
      "welcome1",
    ];
    const isCommon = commonPasswords.includes(pw.toLowerCase());
    const isRepeated = /^(.)\1+$/.test(pw.toLowerCase());

    return {
      minLength: pw.length >= 8,
      hasUpper: /[A-Z]/.test(pw),
      hasLower: /[a-z]/.test(pw),
      hasDigitOrSpecial: /[\d\W_]/.test(pw),
      notEasy: pw.length >= 8 && !isCommon && !isRepeated,
    };
  }, [studentValues.password]);

  // Real-time password criteria for teacher
  const teacherPasswordChecks = useMemo(() => {
    const pw = teacherValues.password;
    const commonPasswords = [
      "password",
      "password123",
      "12345678",
      "123456789",
      "qwerty123",
      "admin123",
      "uoq12345",
      "welcome1",
    ];
    const isCommon = commonPasswords.includes(pw.toLowerCase());
    const isRepeated = /^(.)\1+$/.test(pw.toLowerCase());

    return {
      minLength: pw.length >= 8,
      hasUpper: /[A-Z]/.test(pw),
      hasLower: /[a-z]/.test(pw),
      hasDigitOrSpecial: /[\d\W_]/.test(pw),
      notEasy: pw.length >= 8 && !isCommon && !isRepeated,
    };
  }, [teacherValues.password]);

  const availablePrograms = useMemo(() => {
    return masterAcademicStructure[studentValues.department] ?? getProgramsForDepartment(studentValues.department);
  }, [studentValues.department, masterAcademicStructure]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setGeneralError("");
    setFieldErrors({});

    // Client-side age validation check
    if (role === "student" && studentValues.dateOfBirth) {
      if (studentValues.dateOfBirth > maxDob) {
        setFieldErrors({
          dateOfBirth: [`Student must be at least 15 years old as of today (born on or before ${maxDob}).`],
        });
        setPending(false);
        return;
      }
    }

    const payload =
      role === "student"
        ? {
            role: "student",
            ...studentValues,
            semester: Number(studentValues.semester),
          }
        : {
            role: "teacher",
            ...teacherValues,
            employeeId: teacherValues.employeeId.trim().toUpperCase(),
          };

    try {
      const response = await fetch("/api/registration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        setGeneralError(data.message ?? "Could not submit your registration request.");
        return;
      }

      setSubmittedInfo({
        role,
        name: role === "student" ? studentValues.fullName : teacherValues.fullName,
        identifier: role === "student" ? studentValues.rollNumber : teacherValues.employeeId.toUpperCase(),
        email: role === "student" ? studentValues.email : teacherValues.email,
      });
    } catch {
      setGeneralError("An unexpected network error occurred while submitting your request.");
    } finally {
      setPending(false);
    }
  }

  if (submittedInfo) {
    return (
      <div className="panel form-panel entrance-card entrance-card-wide">
        <div style={{ textAlign: "center", padding: "16px 8px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "var(--ok-bg)",
              color: "var(--ok)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
              fontSize: "30px",
              fontWeight: "bold",
            }}
          >
            ✓
          </div>
          <h2 style={{ marginBottom: "8px" }}>Request Submitted!</h2>
          <p className="panel-copy" style={{ marginBottom: "20px" }}>
            Thank you, <strong>{submittedInfo.name}</strong>. Your registration request to join the
            library has been sent to the library administration for review.
          </p>
          <div
            style={{
              background: "#f9f7f2",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "left",
              marginBottom: "24px",
              fontSize: "14px",
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: "0 0 6px" }}>
              <strong>Membership Type:</strong> {submittedInfo.role === "student" ? "Student" : "Teacher"}
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong>{submittedInfo.role === "student" ? "Roll Number" : "Employee ID"}:</strong>{" "}
              {submittedInfo.identifier}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Registered Email:</strong> {submittedInfo.email}
            </p>
          </div>
          <p className="panel-copy" style={{ fontSize: "13px", marginBottom: "24px" }}>
            Once an administrator reviews and approves your request, you will automatically receive
            an email confirmation at <strong>{submittedInfo.email}</strong>. You will then be able to
            sign in to the library portal.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button type="button" onClick={onSwitchToLogin}>
              Return to Login
            </button>
            <button
              type="button"
              className="button-quiet"
              onClick={() => {
                setSubmittedInfo(null);
                setStudentValues(initialStudentState);
                setTeacherValues(initialTeacherState);
                setRollNumberStatus({ checking: false, available: null, message: "" });
                setEmployeeIdStatus({ checking: false, available: null, message: "" });
              }}
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="panel form-panel entrance-card entrance-card-wide" onSubmit={onSubmit}>
      <div className="entrance-mode-tabs" role="tablist" aria-label="Portal access mode">
        <button
          type="button"
          role="tab"
          aria-selected={false}
          onClick={onSwitchToLogin}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={true}
          className="active"
        >
          Join Library
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <h2>Join Library</h2>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="button-quiet"
          style={{ padding: "6px 12px", fontSize: "13px" }}
        >
          Already registered? Log in
        </button>
      </div>

      <p className="panel-copy" style={{ marginBottom: "16px" }}>
        Select your role below and fill in the registration form. After clicking Final Submit, your
        request will be sent to the admin for approval.
      </p>

      {/* Role Toggle: Student or Teacher */}
      <div className="role-toggle" role="tablist" aria-label="Select role to register">
        <button
          type="button"
          role="tab"
          aria-selected={role === "student"}
          className={role === "student" ? "active" : ""}
          onClick={() => switchRole("student")}
        >
          Student
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === "teacher"}
          className={role === "teacher" ? "active" : ""}
          onClick={() => switchRole("teacher")}
        >
          Teacher
        </button>
      </div>

      {generalError ? (
        <p className="banner error" role="alert">
          {generalError}
        </p>
      ) : null}

      {role === "student" ? (
        <div className="fields fields-grid">
          {/* 1. Roll Number (Manual entry, 5 to 6 numbers, unique in library) */}
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="reg-rollNumber">Roll Number *</label>
              {rollNumberStatus.checking ? (
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Checking…</span>
              ) : rollNumberStatus.available === true ? (
                <span style={{ fontSize: "11px", color: "var(--ok, #15803d)", fontWeight: 600 }}>✓ Available</span>
              ) : rollNumberStatus.available === false ? (
                <span style={{ fontSize: "11px", color: "var(--danger, #b91c1c)", fontWeight: 600 }}>✗ {rollNumberStatus.message}</span>
              ) : null}
            </div>
            <input
              id="reg-rollNumber"
              value={studentValues.rollNumber}
              aria-invalid={fieldErrors.rollNumber ? true : undefined}
              placeholder="e.g. 641543 (5 to 6 numbers only)"
              required
              maxLength={6}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                updateStudent("rollNumber", val);
                if (val.length >= 5) {
                  checkRollNumberAvailability(val);
                } else {
                  setRollNumberStatus({ checking: false, available: null, message: "" });
                }
              }}
              onBlur={() => checkRollNumberAvailability(studentValues.rollNumber)}
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Enter 5 to 6 digits numeric roll number. Must not be used by other students.
            </p>
            {fieldErrors.rollNumber?.[0] ? (
              <p className="field-error">{fieldErrors.rollNumber[0]}</p>
            ) : null}
          </div>

          {/* 2. Full Name */}
          <div className="field">
            <label htmlFor="reg-fullName">Full Name *</label>
            <input
              id="reg-fullName"
              value={studentValues.fullName}
              aria-invalid={fieldErrors.fullName ? true : undefined}
              placeholder="Student's full name"
              required
              onChange={(e) => updateStudent("fullName", e.target.value)}
            />
            {fieldErrors.fullName?.[0] ? (
              <p className="field-error">{fieldErrors.fullName[0]}</p>
            ) : null}
          </div>

          {/* 3. Father's Name */}
          <div className="field">
            <label htmlFor="reg-fatherName">Father&apos;s Name *</label>
            <input
              id="reg-fatherName"
              value={studentValues.fatherName}
              aria-invalid={fieldErrors.fatherName ? true : undefined}
              placeholder="Father's full name"
              required
              onChange={(e) => updateStudent("fatherName", e.target.value)}
            />
            {fieldErrors.fatherName?.[0] ? (
              <p className="field-error">{fieldErrors.fatherName[0]}</p>
            ) : null}
          </div>

          {/* 4. Gender */}
          <div className="field">
            <label htmlFor="reg-gender">Gender *</label>
            <select
              id="reg-gender"
              value={studentValues.gender}
              aria-invalid={fieldErrors.gender ? true : undefined}
              required
              onChange={(e) => updateStudent("gender", e.target.value as Gender | "")}
            >
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            {fieldErrors.gender?.[0] ? (
              <p className="field-error">{fieldErrors.gender[0]}</p>
            ) : null}
          </div>

          {/* 5. Date of Birth (Age must be >= 15 years as of current date) */}
          <div className="field">
            <label htmlFor="reg-dateOfBirth">Date of Birth *</label>
            <input
              id="reg-dateOfBirth"
              type="date"
              max={maxDob}
              value={studentValues.dateOfBirth}
              aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
              required
              onChange={(e) => updateStudent("dateOfBirth", e.target.value)}
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Student must be at least 15 years of age as of today (born on or before {maxDob}).
            </p>
            {fieldErrors.dateOfBirth?.[0] ? (
              <p className="field-error">{fieldErrors.dateOfBirth[0]}</p>
            ) : null}
          </div>

          {/* 6. Department (Dropdown) */}
          <div className="field">
            <label htmlFor="reg-department">Department *</label>
            <select
              id="reg-department"
              value={studentValues.department}
              aria-invalid={fieldErrors.department ? true : undefined}
              required
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
              <option value="">-- Select Department --</option>
              {masterDepts.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            {fieldErrors.department?.[0] ? (
              <p className="field-error">{fieldErrors.department[0]}</p>
            ) : null}
          </div>

          {/* 7. Program (Dropdown based on Department) */}
          <div className="field">
            <label htmlFor="reg-program">Program *</label>
            <select
              id="reg-program"
              value={studentValues.program}
              aria-invalid={fieldErrors.program ? true : undefined}
              required
              disabled={!studentValues.department}
              onChange={(e) => updateStudent("program", e.target.value)}
            >
              <option value="">
                {studentValues.department ? "-- Select Program --" : "-- Select Department First --"}
              </option>
              {availablePrograms.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
            {fieldErrors.program?.[0] ? (
              <p className="field-error">{fieldErrors.program[0]}</p>
            ) : null}
          </div>

          {/* 8. Semester (Dropdown from Master Configuration) */}
          <div className="field">
            <label htmlFor="reg-semester">Semester *</label>
            <select
              id="reg-semester"
              value={studentValues.semester}
              aria-invalid={fieldErrors.semester ? true : undefined}
              required
              onChange={(e) => updateStudent("semester", e.target.value)}
            >
              {masterSemesters.map((sem, idx) => {
                const numericVal = sem.replace(/\D/g, "") || String(idx + 1);
                return (
                  <option key={sem} value={numericVal}>
                    {sem.toLowerCase().includes("semester") ? sem : `Semester ${sem}`}
                  </option>
                );
              })}
            </select>
            {fieldErrors.semester?.[0] ? (
              <p className="field-error">{fieldErrors.semester[0]}</p>
            ) : null}
          </div>

          {/* 9. Batch/Session (Dropdown of batches from Master Configuration) */}
          <div className="field">
            <label htmlFor="reg-batchSession">Batch / Session *</label>
            <select
              id="reg-batchSession"
              value={studentValues.batchSession}
              aria-invalid={fieldErrors.batchSession ? true : undefined}
              required
              onChange={(e) => updateStudent("batchSession", e.target.value)}
            >
              <option value="">-- Select Batch / Session --</option>
              {masterBatches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
            {fieldErrors.batchSession?.[0] ? (
              <p className="field-error">{fieldErrors.batchSession[0]}</p>
            ) : null}
          </div>

          {/* 10. Enrollment Date (Auto-generated current date, read-only) */}
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="reg-enrollmentDate">Enrollment Date *</label>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--accent, #8b5e34)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Auto (Today)
              </span>
            </div>
            <input
              id="reg-enrollmentDate"
              type="date"
              value={studentValues.enrollmentDate}
              readOnly
              style={{
                backgroundColor: "#f4f3ef",
                cursor: "not-allowed",
              }}
              title="Enrollment date is automatically set to the current date."
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Auto-generated as today&apos;s date.
            </p>
            {fieldErrors.enrollmentDate?.[0] ? (
              <p className="field-error">{fieldErrors.enrollmentDate[0]}</p>
            ) : null}
          </div>

          {/* 11. Mobile Number (Pakistan +92 format) */}
          <div className="field">
            <label htmlFor="reg-mobileNumber">Mobile Number (Pakistan +92) *</label>
            <input
              id="reg-mobileNumber"
              type="tel"
              value={studentValues.mobileNumber}
              aria-invalid={fieldErrors.mobileNumber ? true : undefined}
              placeholder="+923001234567"
              required
              onChange={(e) => handleMobileNumberChange(e.target.value, "student")}
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Must be a Pakistani mobile number starting with +92 followed by 10 digits (e.g. +923001234567).
            </p>
            {fieldErrors.mobileNumber?.[0] ? (
              <p className="field-error">{fieldErrors.mobileNumber[0]}</p>
            ) : null}
          </div>

          {/* 12. Email Address */}
          <div className="field">
            <label htmlFor="reg-email">Email Address *</label>
            <input
              id="reg-email"
              type="email"
              value={studentValues.email}
              aria-invalid={fieldErrors.email ? true : undefined}
              placeholder="student@example.com"
              required
              onChange={(e) => updateStudent("email", e.target.value)}
            />
            {fieldErrors.email?.[0] ? (
              <p className="field-error">{fieldErrors.email[0]}</p>
            ) : null}
          </div>

          {/* 13. Password (At least 8 chars, not easy) */}
          <div className="field field-wide">
            <label htmlFor="reg-password">Password (Minimum 8 Characters, Not Easy) *</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={studentValues.password}
              aria-invalid={fieldErrors.password ? true : undefined}
              placeholder="Enter strong password (e.g. UoqLib@2026)"
              required
              onChange={(e) => updateStudent("password", e.target.value)}
            />

            {/* Live Password Criteria / Strength Box */}
            <div
              style={{
                marginTop: "8px",
                padding: "10px 14px",
                background: "#faf9f6",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "6px",
              }}
            >
              <div style={{ color: studentPasswordChecks.minLength ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {studentPasswordChecks.minLength ? "✓" : "○"} At least 8 characters
              </div>
              <div style={{ color: studentPasswordChecks.hasUpper && studentPasswordChecks.hasLower ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {studentPasswordChecks.hasUpper && studentPasswordChecks.hasLower ? "✓" : "○"} Uppercase &amp; lowercase letters
              </div>
              <div style={{ color: studentPasswordChecks.hasDigitOrSpecial ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {studentPasswordChecks.hasDigitOrSpecial ? "✓" : "○"} At least 1 number or symbol
              </div>
              <div style={{ color: studentPasswordChecks.notEasy ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {studentPasswordChecks.notEasy ? "✓" : "○"} Not an easy / common password
              </div>
            </div>

            {fieldErrors.password?.[0] ? (
              <p className="field-error">{fieldErrors.password[0]}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="fields fields-grid">
          {/* 1. Employee ID (EMP-001 format, unique in library) */}
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="reg-employeeId">Employee ID (EMP-001 Format) *</label>
              {employeeIdStatus.checking ? (
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Checking…</span>
              ) : employeeIdStatus.available === true ? (
                <span style={{ fontSize: "11px", color: "var(--ok, #15803d)", fontWeight: 600 }}>✓ Available</span>
              ) : employeeIdStatus.available === false ? (
                <span style={{ fontSize: "11px", color: "var(--danger, #b91c1c)", fontWeight: 600 }}>✗ {employeeIdStatus.message}</span>
              ) : null}
            </div>
            <input
              id="reg-employeeId"
              value={teacherValues.employeeId}
              aria-invalid={fieldErrors.employeeId ? true : undefined}
              placeholder="e.g. EMP-001"
              required
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                updateTeacher("employeeId", val);
                if (/^EMP-\d{3,}$/i.test(val)) {
                  checkEmployeeIdAvailability(val);
                } else {
                  setEmployeeIdStatus({ checking: false, available: null, message: "" });
                }
              }}
              onBlur={() => checkEmployeeIdAvailability(teacherValues.employeeId)}
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Must enter as EMP-001 format and not already used by another teacher.
            </p>
            {fieldErrors.employeeId?.[0] ? (
              <p className="field-error">{fieldErrors.employeeId[0]}</p>
            ) : null}
          </div>

          {/* 2. Full Name */}
          <div className="field">
            <label htmlFor="reg-teacher-fullName">Full Name *</label>
            <input
              id="reg-teacher-fullName"
              value={teacherValues.fullName}
              aria-invalid={fieldErrors.fullName ? true : undefined}
              placeholder="Teacher's full name"
              required
              onChange={(e) => updateTeacher("fullName", e.target.value)}
            />
            {fieldErrors.fullName?.[0] ? (
              <p className="field-error">{fieldErrors.fullName[0]}</p>
            ) : null}
          </div>

          {/* 3. Father's Name */}
          <div className="field">
            <label htmlFor="reg-teacher-fatherName">Father&apos;s Name *</label>
            <input
              id="reg-teacher-fatherName"
              value={teacherValues.fatherName}
              aria-invalid={fieldErrors.fatherName ? true : undefined}
              placeholder="Father's full name"
              required
              onChange={(e) => updateTeacher("fatherName", e.target.value)}
            />
            {fieldErrors.fatherName?.[0] ? (
              <p className="field-error">{fieldErrors.fatherName[0]}</p>
            ) : null}
          </div>

          {/* 4. Gender */}
          <div className="field">
            <label htmlFor="reg-teacher-gender">Gender *</label>
            <select
              id="reg-teacher-gender"
              value={teacherValues.gender}
              aria-invalid={fieldErrors.gender ? true : undefined}
              required
              onChange={(e) => updateTeacher("gender", e.target.value as Gender | "")}
            >
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            {fieldErrors.gender?.[0] ? (
              <p className="field-error">{fieldErrors.gender[0]}</p>
            ) : null}
          </div>

          {/* 5. Date of Birth */}
          <div className="field">
            <label htmlFor="reg-teacher-dateOfBirth">Date of Birth *</label>
            <input
              id="reg-teacher-dateOfBirth"
              type="date"
              value={teacherValues.dateOfBirth}
              aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
              required
              onChange={(e) => updateTeacher("dateOfBirth", e.target.value)}
            />
            {fieldErrors.dateOfBirth?.[0] ? (
              <p className="field-error">{fieldErrors.dateOfBirth[0]}</p>
            ) : null}
          </div>

          {/* 6. Department (Dropdown) */}
          <div className="field">
            <label htmlFor="reg-teacher-department">Department *</label>
            <select
              id="reg-teacher-department"
              value={teacherValues.department}
              aria-invalid={fieldErrors.department ? true : undefined}
              required
              onChange={(e) => updateTeacher("department", e.target.value)}
            >
              <option value="">-- Select Department --</option>
              {masterDepts.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            {fieldErrors.department?.[0] ? (
              <p className="field-error">{fieldErrors.department[0]}</p>
            ) : null}
          </div>

          {/* 7. Designation (Dropdown) */}
          <div className="field">
            <label htmlFor="reg-teacher-designation">Designation *</label>
            <select
              id="reg-teacher-designation"
              value={teacherValues.designation}
              aria-invalid={fieldErrors.designation ? true : undefined}
              required
              onChange={(e) => updateTeacher("designation", e.target.value)}
            >
              <option value="">-- Select Designation --</option>
              {masterDesignations.map((desig) => (
                <option key={desig} value={desig}>
                  {desig}
                </option>
              ))}
            </select>
            {fieldErrors.designation?.[0] ? (
              <p className="field-error">{fieldErrors.designation[0]}</p>
            ) : null}
          </div>

          {/* 8. Joining Date */}
          <div className="field">
            <label htmlFor="reg-teacher-joiningDate">Joining Date *</label>
            <input
              id="reg-teacher-joiningDate"
              type="date"
              value={teacherValues.joiningDate}
              aria-invalid={fieldErrors.joiningDate ? true : undefined}
              required
              onChange={(e) => updateTeacher("joiningDate", e.target.value)}
            />
            {fieldErrors.joiningDate?.[0] ? (
              <p className="field-error">{fieldErrors.joiningDate[0]}</p>
            ) : null}
          </div>

          {/* 9. Mobile Number (Pakistan +92 format) */}
          <div className="field">
            <label htmlFor="reg-teacher-mobileNumber">Mobile Number (Pakistan +92) *</label>
            <input
              id="reg-teacher-mobileNumber"
              type="tel"
              value={teacherValues.mobileNumber}
              aria-invalid={fieldErrors.mobileNumber ? true : undefined}
              placeholder="+923001234567"
              required
              onChange={(e) => handleMobileNumberChange(e.target.value, "teacher")}
            />
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              Must be a Pakistani mobile number starting with +92 followed by 10 digits (e.g. +923001234567).
            </p>
            {fieldErrors.mobileNumber?.[0] ? (
              <p className="field-error">{fieldErrors.mobileNumber[0]}</p>
            ) : null}
          </div>

          {/* 10. Email Address */}
          <div className="field">
            <label htmlFor="reg-teacher-email">Email Address *</label>
            <input
              id="reg-teacher-email"
              type="email"
              value={teacherValues.email}
              aria-invalid={fieldErrors.email ? true : undefined}
              placeholder="teacher@example.com"
              required
              onChange={(e) => updateTeacher("email", e.target.value)}
            />
            {fieldErrors.email?.[0] ? (
              <p className="field-error">{fieldErrors.email[0]}</p>
            ) : null}
          </div>

          {/* 11. Password (Minimum 8 Characters, Not Easy) */}
          <div className="field field-wide">
            <label htmlFor="reg-teacher-password">Password (Minimum 8 Characters, Not Easy) *</label>
            <input
              id="reg-teacher-password"
              type="password"
              autoComplete="new-password"
              value={teacherValues.password}
              aria-invalid={fieldErrors.password ? true : undefined}
              placeholder="Choose a strong password (minimum 8 characters)"
              required
              onChange={(e) => updateTeacher("password", e.target.value)}
            />

            {/* Live Password Criteria / Strength Box */}
            <div
              style={{
                marginTop: "8px",
                padding: "10px 14px",
                background: "#faf9f6",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "6px",
              }}
            >
              <div style={{ color: teacherPasswordChecks.minLength ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {teacherPasswordChecks.minLength ? "✓" : "○"} At least 8 characters
              </div>
              <div style={{ color: teacherPasswordChecks.hasUpper && teacherPasswordChecks.hasLower ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {teacherPasswordChecks.hasUpper && teacherPasswordChecks.hasLower ? "✓" : "○"} Uppercase &amp; lowercase letters
              </div>
              <div style={{ color: teacherPasswordChecks.hasDigitOrSpecial ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {teacherPasswordChecks.hasDigitOrSpecial ? "✓" : "○"} At least 1 number or symbol
              </div>
              <div style={{ color: teacherPasswordChecks.notEasy ? "var(--ok, #15803d)" : "var(--muted, #64748b)" }}>
                {teacherPasswordChecks.notEasy ? "✓" : "○"} Not an easy / common password
              </div>
            </div>

            {fieldErrors.password?.[0] ? (
              <p className="field-error">{fieldErrors.password[0]}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="actions" style={{ marginTop: "24px" }}>
        <button
          type="submit"
          disabled={pending}
          style={{ width: "100%", padding: "14px 20px", fontSize: "16px" }}
        >
          {pending ? "Submitting Request…" : "Final Submit"}
        </button>
      </div>
    </form>
  );
}
