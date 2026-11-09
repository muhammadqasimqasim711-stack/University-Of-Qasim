"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/session";
import { RegistrationForm } from "@/app/registration-form";

type LoginRole = "student" | "teacher" | "admin";
type EntranceMode = "login" | "register";

export function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<EntranceMode>("login");
  const [role, setRole] = useState<LoginRole>("student");
  const [rollNumber, setRollNumber] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [libraryName, setLibraryName] = useState("University of Qasim");

  useEffect(() => {
    let ignore = false;
    fetch("/api/configuration", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.libraryName) {
          setLibraryName(data.libraryName);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  function switchRole(newRole: LoginRole) {
    setRole(newRole);
    setError("");
    setRollNumber("");
    setEmployeeId("");
    setEmail("");
    setUsername("");
    setPassword("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const payload =
      role === "student"
        ? { role: "student", rollNumber: rollNumber.trim(), email: email.trim(), password }
        : role === "teacher"
          ? { role: "teacher", employeeId: employeeId.trim(), email: email.trim(), password }
          : { role: "admin", username: username.trim(), password };

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { role?: Role; message?: string };
      if (!response.ok || !body.role) {
        setError(body.message ?? "Authentication failed.");
        return;
      }

      const destination = body.role === "admin" ? "/configuration" : "/books";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="entrance">
      <section className="entrance-brand">
        <div className="mark" aria-hidden="true">
          {libraryName
            .split(" ")
            .filter(Boolean)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "UQ"}
        </div>
        <p className="eyebrow">Library</p>
        <h1>{libraryName}</h1>
      </section>

      <section className="entrance-form">
        {mode === "register" ? (
          <RegistrationForm onSwitchToLogin={() => setMode("login")} />
        ) : (
          <form className="panel form-panel entrance-card" onSubmit={onSubmit}>
            <div className="entrance-mode-tabs" role="tablist" aria-label="Portal access mode">
              <button
                type="button"
                role="tab"
                aria-selected={true}
                className="active"
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                onClick={() => setMode("register")}
              >
                Join Library
              </button>
            </div>

            <h2>Login</h2>

            <div className="role-toggle" role="tablist" aria-label="Select role">
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
              <button
                type="button"
                role="tab"
                aria-selected={role === "admin"}
                className={role === "admin" ? "active" : ""}
                onClick={() => switchRole("admin")}
              >
                Admin
              </button>
            </div>

            {error ? (
              <p className="banner error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="fields">
              {role === "student" ? (
                <>
                  <div className="field">
                    <label htmlFor="rollNumber">Roll number</label>
                    <input
                      id="rollNumber"
                      name="rollNumber"
                      autoComplete="username"
                      placeholder="Enter your roll number"
                      value={rollNumber}
                      onChange={(event) => setRollNumber(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="studentEmail">Email address</label>
                    <input
                      id="studentEmail"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="student@uoq.edu.pk"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="studentPassword">Password</label>
                    <input
                      id="studentPassword"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </>
              ) : role === "teacher" ? (
                <>
                  <div className="field">
                    <label htmlFor="employeeId">Employee ID</label>
                    <input
                      id="employeeId"
                      name="employeeId"
                      autoComplete="username"
                      placeholder="Enter your employee ID"
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="teacherEmail">Email address</label>
                    <input
                      id="teacherEmail"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="teacher@uoq.edu.pk"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="teacherPassword">Password</label>
                    <input
                      id="teacherPassword"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <div className="actions">
              <button type="submit" disabled={pending} style={{ width: "100%" }}>
                {pending ? "Signing in…" : "Login"}
              </button>
            </div>

            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid var(--line)",
                textAlign: "center",
              }}
            >
              <p className="field-help" style={{ marginBottom: "8px" }}>
                New student or teacher wanting to join the library?
              </p>
              <button
                type="button"
                className="button-quiet"
                onClick={() => setMode("register")}
                style={{ width: "100%", fontWeight: "600" }}
              >
                Submit Registration Request →
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
