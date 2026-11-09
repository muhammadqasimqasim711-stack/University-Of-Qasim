"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Gender, TeacherView } from "@/lib/teachers";
import { DEPARTMENTS, TEACHER_DESIGNATIONS } from "@/lib/academic-data";

export type TeacherFieldErrors = Partial<
  Record<
    | "employeeId"
    | "fullName"
    | "fatherName"
    | "gender"
    | "dateOfBirth"
    | "department"
    | "designation"
    | "joiningDate"
    | "mobileNumber"
    | "email"
    | "password",
    string[]
  >
>;

type TeacherFormValues = {
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
};

const emptyValues: TeacherFormValues = {
  employeeId: "",
  fullName: "",
  fatherName: "",
  gender: "",
  dateOfBirth: "",
  department: "",
  designation: "",
  joiningDate: "",
  mobileNumber: "",
  email: "",
};

function valuesFromTeacher(teacher: TeacherView): TeacherFormValues {
  return {
    employeeId: teacher.employeeId,
    fullName: teacher.fullName,
    fatherName: teacher.fatherName,
    gender: teacher.gender,
    dateOfBirth: teacher.dateOfBirth,
    department: teacher.department,
    designation: teacher.designation,
    joiningDate: teacher.joiningDate,
    mobileNumber: teacher.mobileNumber,
    email: teacher.email,
  };
}

function firstError(errors: string[] | undefined) {
  return errors?.[0];
}

export function TeacherForm({ teacher }: { teacher?: TeacherView }) {
  const router = useRouter();
  const [values, setValues] = useState<TeacherFormValues>(
    teacher ? valuesFromTeacher(teacher) : emptyValues,
  );
  const [fieldErrors, setFieldErrors] = useState<TeacherFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Master configuration live data
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

  function update<K extends keyof TeacherFormValues>(
    key: K,
    value: TeacherFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});

    try {
      const response = await fetch(
        teacher ? `/api/teachers/${teacher.id}` : "/api/teachers",
        {
          method: teacher ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, password }),
        },
      );
      const body = (await response.json()) as TeacherView & {
        message?: string;
        errors?: TeacherFieldErrors;
      };

      if (!response.ok) {
        setFieldErrors(body.errors ?? {});
        setFormError(body.message ?? "Could not save the teacher.");
        return;
      }

      router.push(`/teachers/${body.id}`);
      router.refresh();
    } catch {
      setFormError("Could not save the teacher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h2>{teacher ? "Edit teacher" : "Add teacher"}</h2>
      <p className="panel-copy">
        {teacher
          ? "Update this teacher record. Employee ID and email must stay unique. Leave the password blank to keep the current one."
          : "New teachers are saved as active. The employee ID and password are used to sign in."}
      </p>

      {formError ? (
        <p className="banner error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="fields fields-grid">
        <TextField
          id="employeeId"
          label="Employee ID"
          value={values.employeeId}
          error={firstError(fieldErrors.employeeId)}
          onChange={(value) => update("employeeId", value)}
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
            onChange={(event) =>
              update("gender", event.target.value as Gender | "")
            }
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
            onChange={(event) => update("department", event.target.value)}
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
          <label htmlFor="designation">Designation</label>
          <select
            id="designation"
            name="designation"
            value={values.designation}
            aria-invalid={fieldErrors.designation ? true : undefined}
            onChange={(event) => update("designation", event.target.value)}
          >
            <option value="">Select designation</option>
            {masterDesignations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {fieldErrors.designation ? (
            <p className="field-error">{firstError(fieldErrors.designation)}</p>
          ) : null}
        </div>
        <TextField
          id="joiningDate"
          label="Joining date"
          type="date"
          value={values.joiningDate}
          error={firstError(fieldErrors.joiningDate)}
          onChange={(value) => update("joiningDate", value)}
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
            {teacher
              ? "Leave blank to keep the current password."
              : "At least 8 characters. The teacher uses this with the employee ID."}
          </p>
          {fieldErrors.password ? (
            <p className="field-error">{firstError(fieldErrors.password)}</p>
          ) : null}
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save teacher"}
        </button>
        <a
          className="button-link"
          href={teacher ? `/teachers/${teacher.id}` : "/teachers"}
        >
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
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
