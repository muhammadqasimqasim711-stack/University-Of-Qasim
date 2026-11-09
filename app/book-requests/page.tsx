"use client";

import { useEffect, useState } from "react";
import { formatDisplayTimestamp } from "@/lib/dates";
import type { BookRequestView } from "@/lib/circulation";

export default function BookRequestsPage() {
  const [requests, setRequests] = useState<BookRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch("/api/book-requests", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load book requests.");
        }
        const body = (await response.json()) as BookRequestView[];
        if (!ignore) {
          setRequests(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load book requests.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  async function decide(request: BookRequestView, status: "APPROVED" | "DECLINED") {
    setPendingId(request.id);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/book-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not update the request.");
        return;
      }
      setRequests((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status } : item)),
      );
      setSuccessMessage(
        status === "APPROVED"
          ? `Request for "${request.bookName}" approved! If this book is in the catalogue, the loan has been officially issued with mutual permission.`
          : `Request for "${request.bookName}" declined.`,
      );
    } catch {
      setError("Could not update the request.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Circulation &amp; Requests</p>
          <h1>Book &amp; Borrow Requests</h1>
          <p className="lede">
            Review borrow requests submitted by students and teachers. When you approve a borrow request for a catalogue book, the book is automatically issued with mutual permission and barcode generation.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        {successMessage ? (
          <p className="banner ok" role="alert">
            {successMessage}
          </p>
        ) : null}
        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="meta">Loading requests…</p> : null}
        {!loading && requests.length === 0 ? (
          <p className="panel-copy">No book requests yet.</p>
        ) : null}
        {!loading && requests.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>From</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.bookName}</td>
                    <td>{request.authorName || "—"}</td>
                    <td>
                      {request.borrowerKind === "teacher" ? "Teacher" : "Student"} ·{" "}
                      {request.borrowerName}
                    </td>
                    <td>{request.note || "—"}</td>
                    <td>{labelStatus(request.status)}</td>
                    <td>{formatDisplayTimestamp(request.createdAt)}</td>
                    <td className="row-actions">
                      {request.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            disabled={pendingId === request.id}
                            onClick={() => void decide(request, "APPROVED")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="button-quiet"
                            disabled={pendingId === request.id}
                            onClick={() => void decide(request, "DECLINED")}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function labelStatus(status: BookRequestView["status"]) {
  if (status === "APPROVED") {
    return "Approved";
  }
  if (status === "DECLINED") {
    return "Declined";
  }
  return "Pending";
}
