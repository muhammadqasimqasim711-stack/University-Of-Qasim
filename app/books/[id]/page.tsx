"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookBarcode } from "@/app/books/book-barcode";
import { useAdminViewMode, useSessionRole } from "@/app/session-context";
import type { BookView } from "@/lib/books";

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [circulation, setCirculation] = useState<{
    available: boolean;
    holding: boolean;
    holdingLoanId?: number | null;
    pendingOfferLoanId?: number | null;
    userCopyNumber?: number | null;
    userCopyCode?: string | null;
    returnAllowed?: boolean;
    returnAllowedAt?: string | null;
    reservation: "WAITING" | "READY" | null;
    hasPendingRequest?: boolean;
    monthlyCount?: number;
    monthlyLimit?: number;
    canBorrowMonthly?: boolean;
    totalCopies?: number;
    borrowedCopies?: number;
    availableCopies?: number;
    copies?: Array<{
      copyNumber: number;
      copyCode: string;
      isBorrowed: boolean;
      borrowerName?: string;
      identifier?: string;
      dueDate?: string;
      overdue?: boolean;
    }>;
  } | null>(null);
  const [confirmingRequest, setConfirmingRequest] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [togglingReturnPermission, setTogglingReturnPermission] = useState(false);
  const role = useSessionRole();
  const { adminViewMode } = useAdminViewMode();
  const isAdmin = role === "admin";
  const isViewingAsUser = isAdmin && adminViewMode === "student-teacher";
  const canBorrow = role === "student" || role === "teacher";

  useEffect(() => {
    let ignore = false;

    async function loadBook() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/books/${params.id}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          if (!ignore) {
            setError("Book not found.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Could not load the book.");
        }

        const body = (await response.json()) as BookView;
        if (!ignore) {
          setBook(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load the book.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadBook();

    return () => {
      ignore = true;
    };
  }, [params.id]);

  useEffect(() => {
    let ignore = false;

    async function loadCirculation() {
      try {
        const response = await fetch(`/api/circulation/books/${params.id}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as {
          available: boolean;
          holding: boolean;
          holdingLoanId?: number | null;
          pendingOfferLoanId?: number | null;
          userCopyNumber?: number | null;
          userCopyCode?: string | null;
          returnAllowed?: boolean;
          returnAllowedAt?: string | null;
          reservation: "WAITING" | "READY" | null;
          hasPendingRequest?: boolean;
          monthlyCount?: number;
          monthlyLimit?: number;
          canBorrowMonthly?: boolean;
          totalCopies?: number;
          borrowedCopies?: number;
          availableCopies?: number;
          copies?: Array<{
            copyNumber: number;
            copyCode: string;
            isBorrowed: boolean;
            borrowerName?: string;
            identifier?: string;
            dueDate?: string;
            overdue?: boolean;
          }>;
        };
        if (!ignore) {
          setCirculation(body);
        }
      } catch {
        if (!ignore) {
          setCirculation(null);
        }
      }
    }

    void loadCirculation();
    return () => {
      ignore = true;
    };
  }, [params.id]);

  async function submitBorrowRequest() {
    if (!book) {
      return;
    }

    setSubmittingRequest(true);
    setError("");

    try {
      const response = await fetch("/api/book-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          bookName: book.bookName,
          authorName: book.authorName,
          note:
            requestNote.trim() ||
            `Borrow request for ${book.bookName} (Barcode: ${book.barcode})`,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        setError(body.message ?? "Could not send the borrow request.");
        return;
      }

      setCirculation((current) =>
        current ? { ...current, hasPendingRequest: true } : current,
      );
      setConfirmingRequest(false);
      setRequestNote("");
      setActionMessage(
        "Borrow request submitted successfully. It is now Pending Approval.",
      );
    } catch {
      setError("Could not send the borrow request.");
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleToggleReturnPermission(allow: boolean) {
    if (!circulation?.holdingLoanId) {
      return;
    }

    setTogglingReturnPermission(true);
    setError("");
    setActionMessage("");

    try {
      const response = await fetch(`/api/loans/${circulation.holdingLoanId}/allow-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        returnAllowed?: boolean;
        returnAllowedAt?: string | null;
      };

      if (!response.ok) {
        setError(body.message ?? "Could not update return permission.");
        return;
      }

      setCirculation((current) =>
        current
          ? {
              ...current,
              returnAllowed: allow,
              returnAllowedAt: allow ? new Date().toISOString() : null,
            }
          : current,
      );

      setActionMessage(
        allow
          ? "Permission granted! The Admin can now process the return of this book."
          : "Return permission revoked. The Admin cannot return this book until you allow it.",
      );
    } catch {
      setError("Could not update return permission.");
    } finally {
      setTogglingReturnPermission(false);
    }
  }

  async function takeBook(kind: "borrow" | "reserve") {
    if (!book) {
      return;
    }

    setPending(true);
    setError("");
    setActionMessage("");

    try {
      const response = await fetch(kind === "borrow" ? "/api/loans" : "/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Could not update this book.");
        return;
      }
      setCirculation((current) => {
        if (!current) {
          return kind === "borrow"
            ? { available: false, holding: true, reservation: null }
            : { available: false, holding: false, reservation: "WAITING" };
        }
        if (kind === "reserve") {
          return { ...current, reservation: "WAITING" };
        }
        const borrowedCopies = (current.borrowedCopies ?? 0) + 1;
        const totalCopies = current.totalCopies ?? borrowedCopies;
        return {
          ...current,
          holding: true,
          reservation: null,
          borrowedCopies,
          availableCopies: Math.max(0, totalCopies - borrowedCopies),
          available: borrowedCopies < totalCopies,
        };
      });
      setActionMessage(kind === "borrow" ? "You borrowed this book." : "You reserved this book.");
    } catch {
      setError("Could not update this book.");
    } finally {
      setPending(false);
    }
  }

  async function removeBook() {
    if (!book) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the book.");
      }

      router.push("/books");
      router.refresh();
    } catch {
      setError("Could not delete the book.");
      setPending(false);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Books</p>
          <h1>{book ? book.bookName : "Book details"}</h1>
          <p className="lede">
            <Link href="/books">Back to books</Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading book…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

      {book ? (
        <section className="panel form-panel">
          {actionMessage ? <p className="banner ok">{actionMessage}</p> : null}
          {isViewingAsUser ? (
            <div className="status-pending-block" style={{ marginTop: 12 }}>
              <p className="panel-copy" style={{ margin: 0 }}>
                ℹ️ <strong>Admin View Only:</strong> You are viewing this book in Student &amp; Teacher view mode. Personal borrowing is disabled for administrator accounts. To issue this book to a student or teacher, use the <Link href="/book-ledger" style={{ fontWeight: 700 }}>Book Ledger</Link> admin console.
              </p>
            </div>
          ) : null}
          {canBorrow && circulation ? (
            <div className="borrow-actions-section">
              {circulation.holding ? (
                <div
                  className="status-pending-block"
                  style={{
                    borderLeftColor: circulation.returnAllowed ? "#16a34a" : "#f59e0b",
                    background: circulation.returnAllowed ? "#f0fdf4" : "#fffbeb",
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem" }}>
                        📖 You currently have copy{" "}
                        <span
                          className="badge"
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            background: "#0284c7",
                            color: "#ffffff",
                            padding: "2px 8px",
                          }}
                        >
                          {circulation.userCopyCode || "BOOK-01"}
                        </span>{" "}
                        on loan
                      </h4>
                      <p className="panel-copy" style={{ margin: 0, fontSize: "0.85rem" }}>
                        You currently have copy {circulation.userCopyCode || "BOOK-01"} on loan. Book returns are strictly handled through the Return Books section.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {circulation.canBorrowMonthly === false ? (
                <div className="status-pending-block" style={{ borderLeftColor: "#ef4444", marginBottom: 14 }}>
                  <span className="badge" style={{ background: "#b91c1c", color: "#ffffff", fontWeight: 600 }}>
                    Monthly Borrowing Limit Reached ({circulation.monthlyCount ?? 0}/{circulation.monthlyLimit ?? 0} Books)
                  </span>
                  <p className="panel-copy" style={{ marginTop: 6 }}>
                    You have already borrowed {circulation.monthlyCount ?? 0} books this month. Library rules allow borrowing a maximum of {circulation.monthlyLimit ?? 0} books per month. You cannot borrow or request additional books until next month.
                  </p>
                </div>
              ) : null}

              {!circulation.holding && !circulation.available ? (
                <div className="status-pending-block" style={{ borderLeftColor: "#ef4444", marginBottom: 14 }}>
                  <span className="badge" style={{ background: "#b91c1c", color: "#ffffff", fontWeight: 600 }}>
                    Out of Stock · All {circulation.totalCopies ?? 0} Copies Borrowed
                  </span>
                  <p className="panel-copy" style={{ marginTop: 6 }}>
                    All {circulation.totalCopies ?? 0} copies of this book are currently on loan to other readers. This book cannot be borrowed at this time because it has reached {circulation.borrowedCopies ?? 0}/{circulation.totalCopies ?? 0} borrowed copies.
                  </p>
                </div>
              ) : null}

              {circulation.pendingOfferLoanId ? (
                <div
                  className="status-pending-block"
                  style={{
                    borderLeftColor: "#2563eb",
                    background: "#eff6ff",
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 6,
                  }}
                >
                  <span className="badge" style={{ background: "#1d4ed8", color: "#ffffff" }}>
                    Admin Loan Offer · Permission Required
                  </span>
                  <p className="panel-copy" style={{ marginTop: 8, marginBottom: 10 }}>
                    The library administrator has offered to issue this book to you. You can review and accept or decline this loan in your reader portal.
                  </p>
                  <Link href="/my-book-ledger" className="button-link button-solid" style={{ fontSize: "13px", padding: "6px 14px" }}>
                    View in Book ledger
                  </Link>
                </div>
              ) : null}

              {circulation.hasPendingRequest ? (
                <div className="status-pending-block" style={{ marginBottom: 16 }}>
                  <span className="badge badge-pending">Borrow Request Pending Admin Approval</span>
                  <p className="panel-copy" style={{ marginTop: 6 }}>
                    Your borrow request for <strong>{book.bookName}</strong> has been submitted to the library administration. In accordance with university library regulations, books are issued once the Administrator reviews and grants approval.
                  </p>
                </div>
              ) : null}

              {!circulation.holding && !circulation.hasPendingRequest && !circulation.pendingOfferLoanId ? (
                <div className="actions">
                  <button
                    type="button"
                    disabled={pending || submittingRequest || circulation.canBorrowMonthly === false}
                    onClick={() => setConfirmingRequest(true)}
                  >
                    Request Permission to Borrow
                  </button>
                  {circulation.reservation === "WAITING" ? (
                    <p className="panel-copy">You are in the queue for this book.</p>
                  ) : circulation.reservation === "READY" ? null : (
                    <button
                      type="button"
                      className="button-quiet"
                      disabled={pending || submittingRequest}
                      onClick={() => void takeBook("reserve")}
                    >
                      Reserve
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {confirmingRequest && book ? (
            <div className="confirm-modal-backdrop">
              <div
                className="panel form-panel confirm-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-borrow-title"
              >
                <h2 id="confirm-borrow-title">Request Permission to Borrow</h2>
                <p className="panel-copy">
                  In accordance with university library regulations, students and teachers must submit a borrow request for Administrator approval before a book can be issued.
                </p>
                <p className="panel-copy" style={{ marginTop: 8 }}>
                  Are you sure you want to request permission to borrow{" "}
                  <strong>{book.bookName}</strong> by {book.authorName}?
                </p>
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="borrow-request-note">Optional Note for Administrator</label>
                  <textarea
                    id="borrow-request-note"
                    rows={3}
                    value={requestNote}
                    placeholder="Add an optional note or remarks for the administrator…"
                    onChange={(event) => setRequestNote(event.target.value)}
                  />
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={() => void submitBorrowRequest()}
                  >
                    {submittingRequest ? "Submitting…" : "Submit Borrow Request"}
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    disabled={submittingRequest}
                    onClick={() => {
                      setConfirmingRequest(false);
                      setRequestNote("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="toolbar">
            <div className="row-actions">
              {isAdmin ? (
                <Link className="button-link" href={`/books/${book.id}/edit`}>
                  Edit
                </Link>
              ) : null}
              {isAdmin && confirmingDelete ? (
                <>
                  <span>Delete this book?</span>
                  <button
                    type="button"
                    className="button-danger"
                    disabled={pending}
                    onClick={() => void removeBook()}
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    disabled={pending}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : isAdmin ? (
                <button
                  type="button"
                  className="button-danger"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>

          {/* Numbered Copies Breakdown (BOOK-01 to BOOK-10) */}
          {circulation?.copies && circulation.copies.length > 0 ? (
            <div
              style={{
                marginTop: 20,
                marginBottom: 20,
                padding: "14px 16px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "0.98rem", color: "#1e293b" }}>
                  📚 Individual Copies Status ({circulation.copies.length} Copies)
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Limit: {circulation.totalCopies} copies · {circulation.availableCopies} Available · {circulation.borrowedCopies} Borrowed
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: 8,
                }}
              >
                {circulation.copies.map((copy) => (
                  <div
                    key={copy.copyNumber}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      border: copy.isBorrowed
                        ? copy.overdue
                          ? "1px solid #f87171"
                          : "1px solid #fed7aa"
                        : "1px solid #bbf7d0",
                      background: copy.isBorrowed
                        ? copy.overdue
                          ? "#fef2f2"
                          : "#fffbeb"
                        : "#f0fdf4",
                      color: copy.isBorrowed
                        ? copy.overdue
                          ? "#991b1b"
                          : "#9a3412"
                        : "#166534",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <strong style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                        {copy.copyCode}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "2px 5px",
                          borderRadius: 4,
                          background: copy.isBorrowed
                            ? copy.overdue
                              ? "#fee2e2"
                              : "#fef3c7"
                            : "#dcfce7",
                        }}
                      >
                        {copy.isBorrowed ? (copy.overdue ? "Overdue" : "Borrowed") : "Available"}
                      </span>
                    </div>
                    {copy.isBorrowed && copy.borrowerName ? (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: copy.overdue ? "#b91c1c" : "#7c2d12",
                        }}
                        title={`Borrowed by: ${copy.borrowerName} (${copy.identifier})`}
                      >
                        {copy.borrowerName}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          marginTop: 4,
                          color: "#15803d",
                          fontStyle: "italic",
                        }}
                      >
                        On shelf
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cover-preview" src={book.imagePath} alt="" />

          <dl className="detail-grid">
            <Detail label="Book name" value={book.bookName} />
            <Detail label="Sub name" value={book.subName || "—"} />
            <Detail label="Author name" value={book.authorName} />
            <Detail label="Publisher" value={book.publisher} />
            <Detail label="Edition" value={book.edition} />
            <Detail label="Category" value={book.category} />
            <Detail label="Shelf" value={book.shelf || "—"} />
            <Detail label="Barcode" value={book.barcode} />
            <Detail
              label="Book information"
              value={book.bookInformation || "—"}
            />
          </dl>

          <BookBarcode value={book.barcode} />
        </section>
      ) : null}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
