"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { calendarDateInKarachi, formatDisplayDate } from "@/lib/dates";

type View = "borrowed" | "returned";

type ReaderLoan = {
  id: number;
  bookName: string;
  authorName: string;
  publisher: string;
  category: string;
  shelf: string;
  barcode: string;
  issueDate: string;
  dueDate: string;
  returnedAt: string | null;
  approved: boolean;
};

type ApprovalNote = {
  id: number;
  message: string;
};

type LedgerResponse = {
  borrowed: ReaderLoan[];
  returned: ReaderLoan[];
  approvalNotes: ApprovalNote[];
  message?: string;
};

function distinct(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function matchesField(value: string, filter: string) {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return value.toLowerCase().includes(needle);
}

function displayDate(value: string | null) {
  if (!value) {
    return "—";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDisplayDate(value);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return formatDisplayDate(calendarDateInKarachi(parsed));
}

export default function MyBookLedgerPage() {
  const [view, setView] = useState<View>("borrowed");
  const [borrowed, setBorrowed] = useState<ReaderLoan[]>([]);
  const [returned, setReturned] = useState<ReaderLoan[]>([]);
  const [approvalNotes, setApprovalNotes] = useState<ApprovalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [barcodeFilter, setBarcodeFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadLedger() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/my-book-ledger", { cache: "no-store" });
        const body = (await response.json()) as LedgerResponse;
        if (!response.ok) {
          throw new Error(body.message ?? "Could not load your book ledger.");
        }
        if (!ignore) {
          setBorrowed(body.borrowed ?? []);
          setReturned(body.returned ?? []);
          setApprovalNotes(body.approvalNotes ?? []);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your book ledger.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadLedger();
    return () => {
      ignore = true;
    };
  }, []);

  function chooseView(next: View) {
    if (next === view) {
      return;
    }
    setAuthorFilter("");
    setCategoryFilter("");
    setShelfFilter("");
    setBarcodeFilter("");
    setPublisherFilter("");
    setView(next);
  }

  const source = view === "borrowed" ? borrowed : returned;
  const authorOptions = useMemo(() => distinct(source.map((row) => row.authorName)), [source]);
  const categoryOptions = useMemo(() => distinct(source.map((row) => row.category)), [source]);
  const shelfOptions = useMemo(() => distinct(source.map((row) => row.shelf)), [source]);
  const barcodeOptions = useMemo(() => distinct(source.map((row) => row.barcode)), [source]);
  const publisherOptions = useMemo(
    () => distinct(source.map((row) => row.publisher)),
    [source],
  );

  const filtered = useMemo(
    () =>
      source.filter(
        (row) =>
          matchesField(row.authorName, authorFilter) &&
          matchesField(row.category, categoryFilter) &&
          matchesField(row.shelf, shelfFilter) &&
          matchesField(row.barcode, barcodeFilter) &&
          matchesField(row.publisher, publisherFilter),
      ),
    [source, authorFilter, categoryFilter, shelfFilter, barcodeFilter, publisherFilter],
  );

  const hasActiveFilters = Boolean(
    authorFilter || categoryFilter || shelfFilter || barcodeFilter || publisherFilter,
  );

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Book ledger</p>
          <h1>Book ledger</h1>
          <p className="lede">
            Your borrowed books and the books you have already returned.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <div className="view-toggle" style={{ marginBottom: "18px" }}>
          <button
            type="button"
            className={view === "borrowed" ? "active" : undefined}
            onClick={() => chooseView("borrowed")}
          >
            Borrowed books
          </button>
          <button
            type="button"
            className={view === "returned" ? "active" : undefined}
            onClick={() => chooseView("returned")}
          >
            Return books
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
            background: "#ead9c6",
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid #c9b09a",
            alignItems: "end",
          }}
        >
          <SearchableCombobox
            label="Search by author"
            placeholder="Search or select an author…"
            value={authorFilter}
            onChange={setAuthorFilter}
            options={authorOptions}
            allOptionLabel="All authors"
          />
          <SearchableCombobox
            label="Search by category"
            placeholder="Search or select a category…"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            allOptionLabel="All categories"
          />
          <SearchableCombobox
            label="Search by shelf"
            placeholder="Search or select a shelf…"
            value={shelfFilter}
            onChange={setShelfFilter}
            options={shelfOptions}
            allOptionLabel="All shelves"
          />
          <SearchableCombobox
            label="Search by barcode"
            placeholder="Search or select a barcode…"
            value={barcodeFilter}
            onChange={setBarcodeFilter}
            options={barcodeOptions}
            allOptionLabel="All barcodes"
          />
          <SearchableCombobox
            label="Search by publisher"
            placeholder="Search or select a publisher…"
            value={publisherFilter}
            onChange={setPublisherFilter}
            options={publisherOptions}
            allOptionLabel="All publishers"
          />
          {hasActiveFilters ? (
            <div>
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setAuthorFilter("");
                  setCategoryFilter("");
                  setShelfFilter("");
                  setBarcodeFilter("");
                  setPublisherFilter("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="meta">Loading your book ledger…</p> : null}

        {!loading && view === "borrowed" && approvalNotes.length > 0 ? (
          <div className="banner ok" role="status">
            {approvalNotes.map((note) => (
              <p key={note.id}>{note.message}</p>
            ))}
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="panel-copy">
            {source.length === 0
              ? view === "borrowed"
                ? "You have no borrowed books."
                : "You have no returned books."
              : "No books match the selected filters."}
          </p>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Book name</th>
                  <th>Author</th>
                  <th>Publisher</th>
                  <th>Category</th>
                  <th>Shelf</th>
                  <th>Barcode</th>
                  <th>Issued date</th>
                  <th>Return date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.bookName}</td>
                    <td>{row.authorName || "—"}</td>
                    <td>{row.publisher || "—"}</td>
                    <td>{row.category || "—"}</td>
                    <td>{row.shelf || "—"}</td>
                    <td>{row.barcode || "—"}</td>
                    <td>{displayDate(row.issueDate)}</td>
                    <td>{displayDate(view === "borrowed" ? row.dueDate : row.returnedAt)}</td>
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
