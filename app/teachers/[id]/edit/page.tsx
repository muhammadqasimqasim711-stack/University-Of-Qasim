"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TeacherForm } from "@/app/teachers/teacher-form";
import type { TeacherView } from "@/lib/teachers";

export default function EditTeacherPage() {
  const params = useParams<{ id: string }>();
  const [teacher, setTeacher] = useState<TeacherView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadTeacher() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/teachers/${params.id}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          if (!ignore) {
            setError("Teacher not found.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Could not load the teacher.");
        }

        const body = (await response.json()) as TeacherView;
        if (!ignore) {
          setTeacher(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load the teacher.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadTeacher();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Teachers</p>
          <h1>Edit teacher</h1>
          <p className="lede">
            <Link href={teacher ? `/teachers/${teacher.id}` : "/teachers"}>
              Back to teacher
            </Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading teacher…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}
      {teacher ? <TeacherForm teacher={teacher} /> : null}
    </main>
  );
}
