"use client";

import { FormEvent, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Gender, StudentView } from "@/lib/students";
import {
  DEPARTMENTS,
  getProgramsForDepartment,
  FIVE_YEAR_BATCHES,
} from "@/lib/academic-data";

export type StudentFieldErrors = Partial<
  Record<
    | "rollNumber"
    | "fullName"
    | "fatherName"
    | "gender"
    | "dateOfBirth"
    | "department"
    | "program"
    | "semester"
    | "batchSession"
    | "enrollmentDate"
    | "mobileNumber"
    | "email"
    | "password",
    string[]
  >
>;

type StudentFormValues = {
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
};

const emptyValues: StudentFormValues = {
  rollNumber: "",
  fullName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  department: "",
  program: "",
  semester: "",
  batchSession: "",
  enrollmentDate: "",
  mobileNumber: "",
  email: "",
};

function valuesFromStudent(student: StudentView): StudentFormValues {
  return {
    rollNumber: student.rollNumber,
    fullName: student.fullName,
    fatherName: student.fatherName,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    department: student.department,
    program: student.program,
    semester: String(student.semester),
    batchSession: student.batchSession,
    enrollmentDate: student.enrollmentDate,
    mobileNumber: student.mobileNumber,
    email: student.email,
  };
}

function firstError(errors: string[] | undefined) {
  return errors?.[0];
}

export function StudentForm({ student }: { student?: StudentView }) {
  const router = useRouter();
  const [values, setValues] = useState<StudentFormValues>(
    student ? valuesFromStudent(student) : emptyValues,
  );
  const [fieldErrors, setFieldErrors] = useState<StudentFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Master configuration live data
  const [masterDepts, setMasterDepts] = useState<string[]>(DEPARTMENTS);
  const [masterAcademicStructure, setMasterAcademicStructure] = useState<Record<string, string[]>>({});
  const [masterSemesters, setMasterSemesters] = useState<string[]>(
    Array.from({ length: 12 }, (_, i) => String(i + 1))
  );
  const [masterBatches, setMasterBatches] = useState<string[]>([...FIVE_YEAR_BATCHES]);

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
        if (data.batches?.length > 0) setMasterBatches(data.batches);
      })
      .catch(() => {});
  }, []);

  const availablePrograms = useMemo(() => {
    if (values.department && masterAcademicStructure[values.department]) {
      return masterAcademicStructure[values.department];
    }
    return getProgramsForDepartment(values.department);
  }, [values.department, masterAcademicStructure]);

  function update<K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});

    try {
      const response = await fetch(
        student ? `/api/students/${student.id}` : "/api/students",
        {
          method: student ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            semester: Number(values.semester),
            password,
          }),
        },
      );
      const body = (await response.json()) as StudentView & {
        message?: string;
        errors?: StudentFieldErrors;
      };

      if (!response.ok) {
        setFieldErrors(body.errors ?? {});
        setFormError(body.message ?? "Could not save the student.");
        return;
      }

      router.push(`/students/${body.id}`);
      router.refresh();
    } catch {
      setFormError("Could not save the student.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h2>{student ? "Edit student" : "Add student"}</h2>
      <p className="panel-copy">
        {student
          ? "Update this student record. Roll number and email must stay unique. Leave the password blank to keep the current one."
          : "New students are saved as active. The roll number and password are used to sign in."}
      </p>

      {formError ? (
        <p className="banner error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="fields fields-grid">
        <TextField
          id="rollNumber"
          label="Roll number"
          value={values.rollNumber}
          error={firstError(fieldErrors.rollNumber)}
          onChange={(value) => update("rollNumber", value)}
        />
        <TextField
          id="fullName"
          label="Full name"
          value={values.fullName}
          error={firstError(fieldErrors.fullName)}
          onChange={(value) => update("fullName", value)}
        />
        <TextField
          id="fatherName"
          label="Father name"
          value={values.fatherName}
          error={firstError(fieldErrors.fatherName)}
          onChange={(value) => update("fatherName", value)}
        />
        <div className="field">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            value={values.gender}
            aria-invalid={fieldErrors.gender ? true : undefined}
            onChange={(event) => update("gender", event.target.value as Gender | "")}
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          {fieldErrors.gender ? (
            <p className="field-error">{firstError(fieldErrors.gender)}</p>
          ) : null}
        </div>
        <TextField
          id="dateOfBirth"
          label="Date of birth"
          type="date"
          value={values.dateOfBirth}
          error={firstError(fieldErrors.dateOfBirth)}
          onChange={(value) => update("dateOfBirth", value)}
        />
        <div className="field">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            name="department"
            value={values.department}
            aria-invalid={fieldErrors.department ? true : undefined}
            onChange={(event) => {
              update("department", event.target.value);
              update("program", "");
            }}
          >
            <option value="">Select department</option>
            {masterDepts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {fieldErrors.department ? (
            <p className="field-error">{firstError(fieldErrors.department)}</p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="program">Program</label>
          <select
            id="program"
            name="program"
            value={values.program}
            aria-invalid={fieldErrors.program ? true : undefined}
            disabled={!values.department}
            onChange={(event) => update("program", event.target.value)}
          >
            <option value="">
              {values.department ? "Select program" : "Select department first"}
            </option>
            {availablePrograms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {fieldErrors.program ? (
            <p className="field-error">{firstError(fieldErrors.program)}</p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="semester">Semester</label>
          <select
            id="semester"
            name="semester"
            value={values.semester}
            aria-invalid={fieldErrors.semester ? true : undefined}
            onChange={(event) => update("semester", event.target.value)}
          >
            <option value="">Select semester</option>
            {masterSemesters.map((s, idx) => {
              const numVal = s.replace(/\D/g, "") || String(idx + 1);
              return (
                <option key={s} value={numVal}>
                  {s.toLowerCase().includes("semester") ? s : `Semester ${s}`}
                </option>
              );
            })}
          </select>
          {fieldErrors.semester ? (
            <p className="field-error">{firstError(fieldErrors.semester)}</p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="batchSession">Batch/session</label>
          <select
            id="batchSession"
            name="batchSession"
            value={values.batchSession}
            aria-invalid={fieldErrors.batchSession ? true : undefined}
            onChange={(event) => update("batchSession", event.target.value)}
          >
            <option value="">Select batch/session</option>
            {masterBatches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {fieldErrors.batchSession ? (
            <p className="field-error">{firstError(fieldErrors.batchSession)}</p>
          ) : null}
        </div>
        <TextField
          id="enrollmentDate"
          label="Enrollment date"
          type="date"
          value={values.enrollmentDate}
          error={firstError(fieldErrors.enrollmentDate)}
          onChange={(value) => update("enrollmentDate", value)}
        />
        <TextField
          id="mobileNumber"
          label="Mobile number"
          inputMode="numeric"
          value={values.mobileNumber}
          error={firstError(fieldErrors.mobileNumber)}
          onChange={(value) => update("mobileNumber", value)}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          value={values.email}
          error={firstError(fieldErrors.email)}
          onChange={(value) => update("email", value)}
        />
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            aria-invalid={fieldErrors.password ? true : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="field-help">
            {student
              ? "Leave blank to keep the current password."
              : "At least 8 characters. The student uses this with the roll number."}
          </p>
          {fieldErrors.password ? (
            <p className="field-error">{firstError(fieldErrors.password)}</p>
          ) : null}
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save student"}
        </button>
        <a className="button-link" href={student ? `/students/${student.id}` : "/students"}>
          Cancel
        </a>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  min,
  max,
  step,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: "numeric";
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
