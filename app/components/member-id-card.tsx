"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { StudentView } from "@/lib/students";
import type { TeacherView } from "@/lib/teachers";

export type MemberIdCardProps = {
  role: "student" | "teacher";
  member: StudentView | TeacherView;
  libraryName?: string;
  showPrintButton?: boolean;
};

export function MemberIdCard({
  role,
  member,
  libraryName = "University of Qasim",
  showPrintButton = true,
}: MemberIdCardProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const identifier =
    role === "student"
      ? (member as StudentView).rollNumber
      : (member as TeacherView).employeeId;

  const initials = member.fullName
    ? member.fullName
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "UQ";

  const isStudent = role === "student";
  const student = isStudent ? (member as StudentView) : null;
  const teacher = !isStudent ? (member as TeacherView) : null;

  useEffect(() => {
    if (!barcodeRef.current || !identifier) return;

    try {
      JsBarcode(barcodeRef.current, identifier, {
        format: "CODE128",
        displayValue: true,
        fontSize: 13,
        textMargin: 3,
        height: 48,
        margin: 6,
        background: "#ffffff",
        lineColor: "#1c2430",
      });
    } catch {
      // Graceful fallback if value has unsupported characters
    }
  }, [identifier]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="id-card-container">
      <div id="printable-id-card" className="id-card">
        {/* Card Header / University Ribbon */}
        <div className="id-card-header">
          <div className="id-card-crest">
            <span className="id-card-mark">UQ</span>
          </div>
          <div className="id-card-header-titles">
            <span className="id-card-library-name">{libraryName}</span>
            <span className="id-card-subhead">
              {isStudent ? "STUDENT LIBRARY CARD" : "FACULTY LIBRARY CARD"}
            </span>
          </div>
          <div className="id-card-status-pill">
            <span className={`status-dot ${member.status.toLowerCase()}`} />
            <span>{member.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="id-card-body">
          <div className="id-card-avatar-box">
            <div className="id-card-avatar">{initials}</div>
            <div className="id-card-badge-pill">
              {isStudent ? "Student" : "Faculty"}
            </div>
          </div>

          <div className="id-card-info-grid">
            <div className="id-card-name-row">
              <h3 className="id-card-member-name">{member.fullName}</h3>
              <p className="id-card-identifier">
                <strong>{isStudent ? "Roll No:" : "Employee ID:"}</strong>{" "}
                <span>{identifier}</span>
              </p>
            </div>

            <div className="id-card-meta-row">
              <div>
                <span className="id-card-label">Department</span>
                <span className="id-card-value">{member.department}</span>
              </div>

              {isStudent && student ? (
                <div>
                  <span className="id-card-label">Program &amp; Sem</span>
                  <span className="id-card-value">
                    {student.program} (Sem {student.semester})
                  </span>
                </div>
              ) : teacher ? (
                <div>
                  <span className="id-card-label">Designation</span>
                  <span className="id-card-value">{teacher.designation}</span>
                </div>
              ) : null}

              {isStudent && student ? (
                <div>
                  <span className="id-card-label">Batch / Session</span>
                  <span className="id-card-value">{student.batchSession}</span>
                </div>
              ) : teacher ? (
                <div>
                  <span className="id-card-label">Faculty Member</span>
                  <span className="id-card-value">Senior Academic Staff</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Scannable Barcode Box */}
        <div className="id-card-barcode-section">
          <div className="id-card-barcode-wrap">
            <svg
              ref={barcodeRef}
              role="img"
              aria-label={`Barcode for ${identifier}`}
              style={{ display: "block", maxWidth: "100%", height: "auto" }}
            />
          </div>
          <span className="id-card-barcode-hint">
            Official University of Qasim Circulation Desk Barcode
          </span>
        </div>
      </div>

      {showPrintButton ? (
        <div className="id-card-actions">
          <button
            type="button"
            className="button-quiet id-card-print-btn"
            onClick={handlePrint}
          >
            🖨️ Print / Save ID Card
          </button>
        </div>
      ) : null}
    </div>
  );
}
