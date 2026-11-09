"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StudentForm } from "@/app/students/student-form";
import type { StudentView } from "@/lib/students";

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadStudent() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/students/${params.id}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          if (!ignore) {
            setError("Student not found.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Could not load the student.");
        }

        const body = (await response.json()) as StudentView;
        if (!ignore) {
          setStudent(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load the student.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadStudent();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Students</p>
          <h1>Edit student</h1>
          <p className="lede">
            <Link href={student ? `/students/${student.id}` : "/students"}>
              Back to student
            </Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading student…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}
      {student ? <StudentForm student={student} /> : null}
    </main>
  );
}
