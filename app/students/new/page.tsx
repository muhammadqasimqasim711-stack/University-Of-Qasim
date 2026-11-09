"use client";

import { StudentForm } from "@/app/students/student-form";

export default function NewStudentPage() {
  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Students</p>
          <h1>Add student</h1>
          <p className="lede">
            Record a student for the University of Qasim library.
          </p>
        </div>
      </header>
      <StudentForm />
    </main>
  );
}
