"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Person = {
  id: number;
  fullName: string;
  identifier: string;
  borrowedThisMonth: number;
};

type BorrowerLists = {
  bookId: number;
  bookName: string;
  monthlyBorrowLimit: number;
  selectable: Person[];
  alreadyBorrowed: Person[];
  monthlyLimitExceeded: Person[];
};

type IssueFailure = {
  bookId: number;
  studentId: number | null;
  teacherId: number | null;
  message: string;
};

export function IssuePeople({
  kind,
  bookId,
}: {
  kind: "student" | "teacher";
  bookId: string;
}) {
  const parsedBookId = Number(bookId);
  const validBookId = Number.isInteger(parsedBookId) && parsedBookId > 0;
  const [lists, setLists] = useState<BorrowerLists | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [issuing, setIssuing] = useState(false);
  const [notice, setNotice] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const personLabel = kind === "student" ? "student" : "teacher";
  const heading = kind === "student" ? "Issue to student" : "Issue to teachers";

  useEffect(() => {
    if (!validBookId) {
      setLoading(false);
      setError("Book not found.");
      return;
    }

    let ignore = false;

    async function loadPeople() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/book-ledger/borrowers?bookId=${parsedBookId}&kind=${kind}`,
          { cache: "no-store" },
        );
        const body = (await response.json()) as BorrowerLists & { message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "Could not load people for this book.");
        }
        if (!ignore) {
          setLists(body);
          setSelectedIds((current) =>
            current.filter((id) => body.selectable.some((person) => person.id === id)),
          );
        }
      } catch (loadError) {
        if (!ignore) {
          setLists(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load people for this book.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadPeople();

    return () => {
      ignore = true;
    };
  }, [kind, parsedBookId, reloadKey, validBookId]);

  function togglePerson(personId: number) {
    setSelectedIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  async function finalIssue() {
    setNotice("");
    setFailures([]);

    if (!lists || selectedIds.length === 0) {
      setFailures([
        kind === "student"
          ? "Select at least one student."
          : "Select at least one teacher.",
      ]);
      return;
    }

    setIssuing(true);
    try {
      const response = await fetch("/api/book-ledger/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              bookId: lists.bookId,
              studentIds: kind === "student" ? selectedIds : [],
              teacherIds: kind === "teacher" ? selectedIds : [],
            },
          ],
        }),
      });
      const body = (await response.json()) as {
        message?: string;
        issuedCount?: number;
        failures?: IssueFailure[];
      };
      if (!response.ok) {
        setFailures([body.message ?? "Could not issue this book."]);
        return;
      }

      const issuedCount = body.issuedCount ?? 0;
      if (issuedCount > 0) {
        setNotice(
          issuedCount === 1
            ? `Issued this book to 1 ${personLabel}.`
            : `Issued this book to ${issuedCount} ${personLabel}s.`,
        );
      }

      const names = new Map(lists.selectable.map((person) => [person.id, person.fullName]));
      setFailures(
        (body.failures ?? []).map((failure) => {
          const personId = failure.studentId ?? failure.teacherId;
          const personName = (personId ? names.get(personId) : null) ?? "Person";
          return `${personName}: ${failure.message}`;
        }),
      );
      setReloadKey((value) => value + 1);
    } catch {
      setFailures(["Could not issue this book."]);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Book ledger</p>
          <h1>{heading}</h1>
          <p className="lede">
            {lists
              ? `Choose who should receive ${lists.bookName}.`
              : "Choose who should receive this book."}
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <p className="panel-copy">
          <Link href="/book-ledger">Back to book ledger</Link>
        </p>

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="banner ok" role="status">
            {notice}
          </p>
        ) : null}
        {failures.length > 0 ? (
          <div className="banner error" role="alert">
            {failures.map((failure) => (
              <p key={failure}>{failure}</p>
            ))}
          </div>
        ) : null}
        {loading ? <p className="meta">Loading…</p> : null}

        {!loading && lists ? (
          <div className="ledger-issue">
            <div className="ledger-issue-book">
              <span>Selected book</span>
              <strong>{lists.bookName}</strong>
            </div>

            <div className="ledger-issue-stats">
              <div className="ledger-issue-stat">
                <b>{lists.selectable.length}</b>
                <span>Can receive this book</span>
              </div>
              <div className="ledger-issue-stat">
                <b>{lists.alreadyBorrowed.length}</b>
                <span>Already borrowed</span>
              </div>
              <div className="ledger-issue-stat">
                <b>{lists.monthlyLimitExceeded.length}</b>
                <span>Monthly limit exceeded</span>
              </div>
            </div>

            <article className="ledger-issue-card">
              <div className="ledger-issue-head">
                <h2>Select {kind === "student" ? "students" : "teachers"}</h2>
                <span className="ledger-issue-count">{lists.selectable.length}</span>
              </div>
              <p className="panel-copy ledger-issue-note">
                These {kind === "student" ? "students" : "teachers"} are under the monthly limit of{" "}
                {lists.monthlyBorrowLimit} and do not already have this book.
              </p>
              {lists.selectable.length === 0 ? (
                <p className="panel-copy">
                  No {kind === "student" ? "students" : "teachers"} can receive this book.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="students">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Name</th>
                        <th>{kind === "student" ? "Roll number" : "Employee ID"}</th>
                        <th>This month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.selectable.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(person.id)}
                              aria-label={`Select ${person.fullName}`}
                              onChange={() => togglePerson(person.id)}
                            />
                          </td>
                          <td>{person.fullName}</td>
                          <td>{person.identifier}</td>
                          <td>
                            {person.borrowedThisMonth} of {lists.monthlyBorrowLimit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="actions">
                <button
                  type="button"
                  disabled={issuing}
                  onClick={() => void finalIssue()}
                >
                  {issuing ? "Issuing…" : "Final issue"}
                </button>
                <p className="meta">
                  {selectedIds.length === 1
                    ? `1 ${personLabel} selected`
                    : `${selectedIds.length} ${personLabel}s selected`}
                </p>
              </div>
            </article>

            <article className="ledger-issue-card ledger-issue-card-borrowed">
              <div className="ledger-issue-head">
                <h2>Already borrowed</h2>
                <span className="ledger-issue-count">{lists.alreadyBorrowed.length}</span>
              </div>
              <p className="panel-copy ledger-issue-note">
                These {kind === "student" ? "students" : "teachers"} already have this book, so they cannot be selected.
              </p>
              {lists.alreadyBorrowed.length === 0 ? (
                <p className="panel-copy">
                  No {kind === "student" ? "student" : "teacher"} currently has this book.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="students">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>{kind === "student" ? "Roll number" : "Employee ID"}</th>
                        <th>This month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.alreadyBorrowed.map((person) => (
                        <tr key={person.id}>
                          <td>{person.fullName}</td>
                          <td>{person.identifier}</td>
                          <td>
                            {person.borrowedThisMonth} of {lists.monthlyBorrowLimit}
                            {person.borrowedThisMonth >= lists.monthlyBorrowLimit
                              ? " · limit reached"
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="ledger-issue-card ledger-issue-card-limit">
              <div className="ledger-issue-head">
                <h2>Monthly limit exceeded</h2>
                <span className="ledger-issue-count">{lists.monthlyLimitExceeded.length}</span>
              </div>
              <p className="panel-copy ledger-issue-note">
                These {kind === "student" ? "students" : "teachers"} have already borrowed{" "}
                {lists.monthlyBorrowLimit} or more books this month, so they cannot be selected.
              </p>
              {lists.monthlyLimitExceeded.length === 0 ? (
                <p className="panel-copy">
                  No {kind === "student" ? "student" : "teacher"} has reached the monthly limit.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="students">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>{kind === "student" ? "Roll number" : "Employee ID"}</th>
                        <th>This month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lists.monthlyLimitExceeded.map((person) => (
                        <tr key={person.id}>
                          <td>{person.fullName}</td>
                          <td>{person.identifier}</td>
                          <td>
                            {person.borrowedThisMonth} of {lists.monthlyBorrowLimit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        ) : null}
      </section>
    </main>
  );
}
