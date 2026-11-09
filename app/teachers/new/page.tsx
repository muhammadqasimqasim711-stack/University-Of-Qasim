"use client";

import { TeacherForm } from "@/app/teachers/teacher-form";

export default function NewTeacherPage() {
  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Teachers</p>
          <h1>Add teacher</h1>
          <p className="lede">
            Record a teacher for the University of Qasim library.
          </p>
        </div>
      </header>
      <TeacherForm />
    </main>
  );
}
