"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { calendarDateInKarachi, formatDisplayDate } from "@/lib/dates";

type LedgerEntry = {
  id: number;
  createdAt: string;
  imagePath: string;
  bookName: string;
  subName: string;
  authorName: string;
  publisher: string;
  edition: string;
  category: string;
  shelf: string;
  barcode: string;
  bookInformation: string;
  availableCopies: number;
};

function enteredOn(createdAt: string) {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return formatDisplayDate(calendarDateInKarachi(parsed));
}

function distinctValues(entries: LedgerEntry[], field: keyof LedgerEntry) {
  const values = new Set<string>();
  for (const entry of entries) {
    const value = String(entry[field] ?? "").trim();
    if (value) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function matchesField(value: string, filter: string) {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return value.toLowerCase().includes(needle);
}

export default function BookLedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedBook, setSelectedBook] = useState<LedgerEntry | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [barcodeFilter, setBarcodeFilter] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadLedger() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/book-ledger", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load the book ledger.");
        }

        const body = (await response.json()) as LedgerEntry[];
        if (!ignore) {
          setEntries(body);
          setSelectedBook((current) => {
            if (!current) {
              return null;
            }
            return body.find((entry) => entry.id === current.id) ?? current;
          });
        }
      } catch {
        if (!ignore) {
          setError("Could not load the book ledger.");
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

  const nameOptions = useMemo(() => distinctValues(entries, "bookName"), [entries]);
  const authorOptions = useMemo(
    () => distinctValues(entries, "authorName"),
    [entries],
  );
  const publisherOptions = useMemo(
    () => distinctValues(entries, "publisher"),
    [entries],
  );
  const categoryOptions = useMemo(
    () => distinctValues(entries, "category"),
    [entries],
  );
  const shelfOptions = useMemo(() => distinctValues(entries, "shelf"), [entries]);
  const barcodeOptions = useMemo(
    () => distinctValues(entries, "barcode"),
    [entries],
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          matchesField(entry.bookName, nameFilter) &&
          matchesField(entry.authorName, authorFilter) &&
          matchesField(entry.publisher, publisherFilter) &&
          matchesField(entry.category, categoryFilter) &&
          matchesField(entry.shelf, shelfFilter) &&
          matchesField(entry.barcode, barcodeFilter),
      ),
    [
      entries,
      nameFilter,
      authorFilter,
      publisherFilter,
      categoryFilter,
      shelfFilter,
      barcodeFilter,
    ],
  );

  const hasActiveFilters = Boolean(
    nameFilter ||
      authorFilter ||
      publisherFilter ||
      categoryFilter ||
      shelfFilter ||
      barcodeFilter,
  );

  function clearFilters() {
    setNameFilter("");
    setAuthorFilter("");
    setPublisherFilter("");
    setCategoryFilter("");
    setShelfFilter("");
    setBarcodeFilter("");
  }

  return (
    <main className="shell shell-wide">
      <header
        className="masthead"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <p className="eyebrow">Register</p>
          <h1>Book ledger</h1>
          <p className="lede">
            The register of books already entered in the library.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link
            className="button-link button-solid"
            href="/book-ledger/return-books"
            style={{ fontWeight: 600 }}
          >
            Return book
          </Link>
          <Link
            className="button-link button-outline"
            href="/book-ledger/returned-books"
            style={{ fontWeight: 600 }}
          >
            Returned book
          </Link>
          <Link
            className="button-link button-outline"
            href="/book-ledger/overdue-books"
            style={{ fontWeight: 600 }}
          >
            Overdue book
          </Link>
        </div>
      </header>

      <section className="panel form-panel">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
            label="Search by name"
            placeholder="Search or select a book name…"
            value={nameFilter}
            onChange={setNameFilter}
            options={nameOptions}
            allOptionLabel="All book names"
          />
          <SearchableCombobox
            label="Search by author"
            placeholder="Search or select an author…"
            value={authorFilter}
            onChange={setAuthorFilter}
            options={authorOptions}
            allOptionLabel="All authors"
          />
          <SearchableCombobox
            label="Search by publisher"
            placeholder="Search or select a publisher…"
            value={publisherFilter}
            onChange={setPublisherFilter}
            options={publisherOptions}
            allOptionLabel="All publishers"
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
          {hasActiveFilters ? (
            <div>
              <button type="button" className="button-quiet" onClick={clearFilters}>
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

        {selectedBook && selectedBook.availableCopies > 0 ? (
          <div className="actions" style={{ marginTop: "16px" }}>
            <p className="panel-copy">
              Selected book: <strong>{selectedBook.bookName}</strong>
            </p>
            <Link
              className="button-link button-solid"
              href={`/book-ledger/issue-students?bookId=${selectedBook.id}`}
            >
              Issue to student
            </Link>
            <Link
              className="button-link button-solid"
              href={`/book-ledger/issue-teachers?bookId=${selectedBook.id}`}
            >
              Issue to teachers
            </Link>
          </div>
        ) : null}

        {loading ? <p className="meta">Loading the book ledger…</p> : null}

        {!loading && filteredEntries.length === 0 ? (
          <p className="panel-copy">
            {entries.length === 0
              ? "No books in the ledger yet."
              : "No books match the selected filters."}
          </p>
        ) : null}

        {!loading && filteredEntries.length > 0 ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Date entered</th>
                  <th>Cover</th>
                  <th>Book name</th>
                  <th>Sub name</th>
                  <th>Author</th>
                  <th>Publisher</th>
                  <th>Edition</th>
                  <th>Category</th>
                  <th>Shelf</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const selected = selectedBook?.id === entry.id;
                  return (
                    <tr key={entry.id}>
                      <td>{enteredOn(entry.createdAt)}</td>
                      <td>
                        {entry.imagePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="cover-thumb"
                            src={entry.imagePath}
                            alt=""
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{entry.bookName}</td>
                      <td>{entry.subName || "—"}</td>
                      <td>{entry.authorName}</td>
                      <td>{entry.publisher}</td>
                      <td>{entry.edition}</td>
                      <td>{entry.category}</td>
                      <td>{entry.shelf || "—"}</td>
                      <td>{entry.barcode}</td>
                      <td>
                        <div className="row-actions">
                          {entry.availableCopies > 0 ? (
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelectedBook(entry)}
                            >
                              {selected ? "Selected" : "Select book"}
                            </button>
                          ) : (
                            <span className="meta">All copies issued</span>
                          )}
                          <Link href={`/books/${entry.id}`}>View</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
