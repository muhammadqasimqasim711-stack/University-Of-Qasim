"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookScan } from "@/app/books/book-scan";
import { SearchableCombobox } from "@/app/components/searchable-combobox";
import { useAdminViewMode, useSessionRole } from "@/app/session-context";
import { BOOK_CATEGORIES } from "@/lib/book-categories";
import type { BookView } from "@/lib/books";

type CatalogueBook = BookView & { availableCopies?: number };

export default function BooksPage() {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [publisherFilter, setPublisherFilter] = useState("");
  const [shelfFilter, setShelfFilter] = useState("");
  const [barcodeFilter, setBarcodeFilter] = useState("");

  const [books, setBooks] = useState<CatalogueBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const role = useSessionRole();
  const { adminViewMode } = useAdminViewMode();
  const isAdmin = role === "admin";
  const browsingAsReader = !isAdmin || adminViewMode === "student-teacher";
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    let ignore = false;

    async function loadBooks() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/books", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load books.");
        }

        const body = (await response.json()) as CatalogueBook[];
        if (!ignore) {
          setBooks(body);
        }
      } catch {
        if (!ignore) {
          setError("Could not load books.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadBooks();

    return () => {
      ignore = true;
    };
  }, []);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  // Distinct values for dropdown options
  const distinctCategories = useMemo(() => {
    const set = new Set<string>(BOOK_CATEGORIES);
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  const distinctAuthors = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.authorName) set.add(b.authorName);
    });
    return Array.from(set).sort();
  }, [books]);

  const distinctPublishers = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.publisher) set.add(b.publisher);
    });
    return Array.from(set).sort();
  }, [books]);

  const distinctShelves = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.shelf) set.add(b.shelf);
    });
    return Array.from(set).sort();
  }, [books]);

  const distinctBarcodes = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.barcode) set.add(b.barcode);
    });
    return Array.from(set).sort();
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      if (browsingAsReader && book.availableCopies === 0) {
        return false;
      }

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const match =
          book.bookName.toLowerCase().includes(q) ||
          book.subName.toLowerCase().includes(q) ||
          book.authorName.toLowerCase().includes(q) ||
          book.publisher.toLowerCase().includes(q) ||
          book.shelf.toLowerCase().includes(q) ||
          book.barcode.toLowerCase().includes(q) ||
          book.category.toLowerCase().includes(q) ||
          book.edition.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (categoryFilter.trim() && categoryFilter.toLowerCase() !== "all") {
        const cat = categoryFilter.trim().toLowerCase();
        if (!book.category.toLowerCase().includes(cat)) return false;
      }

      if (authorFilter.trim()) {
        const aut = authorFilter.trim().toLowerCase();
        if (!book.authorName.toLowerCase().includes(aut)) return false;
      }

      if (publisherFilter.trim()) {
        const pub = publisherFilter.trim().toLowerCase();
        if (!book.publisher.toLowerCase().includes(pub)) return false;
      }

      if (shelfFilter.trim()) {
        const sh = shelfFilter.trim().toLowerCase();
        if (!book.shelf.toLowerCase().includes(sh)) return false;
      }

      if (barcodeFilter.trim()) {
        const bc = barcodeFilter.trim().toLowerCase();
        if (!book.barcode.toLowerCase().includes(bc)) return false;
      }

      return true;
    });
  }, [
    books,
    query,
    categoryFilter,
    authorFilter,
    publisherFilter,
    shelfFilter,
    barcodeFilter,
    browsingAsReader,
  ]);

  const hasActiveFilters = Boolean(
    query ||
    categoryFilter ||
    authorFilter ||
    publisherFilter ||
    shelfFilter ||
    barcodeFilter
  );

  function clearFilters() {
    setQuery("");
    setCategoryFilter("");
    setAuthorFilter("");
    setPublisherFilter("");
    setShelfFilter("");
    setBarcodeFilter("");
  }

  async function removeBook(book: BookView) {
    setPendingId(book.id);
    setError("");

    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Could not delete the book.");
      }

      setBooks((current) => current.filter((item) => item.id !== book.id));
      setConfirmingId(null);
    } catch {
      setError("Could not delete the book.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Books</p>
          <h1>Book records</h1>
          <p className="lede">
            Search the catalogue, add a book, or scan its barcode.
          </p>
        </div>
      </header>

      <section className="panel form-panel">
        <div className="toolbar" style={{ marginBottom: "16px" }}>
          <form className="search-form" onSubmit={onSearch} style={{ flex: 1 }}>
            <label className="field search-field" htmlFor="book-search">
              <span>General Search</span>
              <input
                id="book-search"
                value={query}
                placeholder="Title, subtitle, information…"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </form>
          {isAdmin ? (
            <div className="row-actions">
              <div className="view-toggle">
                <button
                  type="button"
                  className={viewMode === "grid" ? "active" : undefined}
                  onClick={() => setViewMode("grid")}
                >
                  Cards
                </button>
                <button
                  type="button"
                  className={viewMode === "table" ? "active" : undefined}
                  onClick={() => setViewMode("table")}
                >
                  Table
                </button>
              </div>
              <Link
                className="button-link button-solid"
                href={
                  categoryFilter
                    ? `/books/new?category=${encodeURIComponent(categoryFilter)}`
                    : "/books/new"
                }
              >
                Add book
              </Link>
            </div>
          ) : null}
        </div>

        {/* Filter Toolbar: Search Category, Author, Publisher, Shelf, Barcode (each is only one box) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
            background: "var(--soft-coffee)",
            padding: "14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            alignItems: "end",
          }}
        >
          <SearchableCombobox
            label="Search Category"
            placeholder="Search / select category…"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={distinctCategories}
          />

          <SearchableCombobox
            label="Search Author"
            placeholder="Search / select author…"
            value={authorFilter}
            onChange={setAuthorFilter}
            options={distinctAuthors}
          />

          <SearchableCombobox
            label="Search Publisher"
            placeholder="Search / select publisher…"
            value={publisherFilter}
            onChange={setPublisherFilter}
            options={distinctPublishers}
          />

          <SearchableCombobox
            label="Search Shelf"
            placeholder="Search / select shelf…"
            value={shelfFilter}
            onChange={setShelfFilter}
            options={distinctShelves}
          />

          <SearchableCombobox
            label="Search Barcode"
            placeholder="Search / select barcode…"
            value={barcodeFilter}
            onChange={setBarcodeFilter}
            options={distinctBarcodes}
          />
          <button
            type="button"
            className="button-primary"
            onClick={() => {}}
            style={{ height: "38px", padding: "0 12px", marginLeft: "4px" }}
          >
            Filter
          </button>

          {hasActiveFilters && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="button-quiet"
                onClick={clearFilters}
                style={{
                  padding: "8px 14px",
                  fontSize: "13px",
                  height: "38px",
                  whiteSpace: "nowrap",
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Category Quick Pills */}
        <div
          className="category-filter-section"
          role="region"
          aria-label="Filter books by category"
          style={{ marginBottom: "16px" }}
        >
          <div className="category-filter-bar">
            <button
              type="button"
              className={`category-pill ${!categoryFilter ? "active" : ""}`}
              onClick={() => setCategoryFilter("")}
            >
              All Categories
            </button>
            {BOOK_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-pill ${categoryFilter.toLowerCase() === category.toLowerCase() ? "active" : ""}`}
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter.toLowerCase() === category.toLowerCase()
                      ? ""
                      : category,
                  )
                }
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <BookScan />

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? <p className="meta">Loading books…</p> : null}

        {!loading && books.length === 0 ? (
          <p className="panel-copy">No books yet. Add the first book record.</p>
        ) : null}

        {!loading && books.length > 0 && filteredBooks.length === 0 ? (
          <div className="empty-category-notice">
            <p className="panel-copy">
              {browsingAsReader && !hasActiveFilters
                ? "No books are available to borrow."
                : "No books match the selected filter criteria."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                className="button-quiet"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && filteredBooks.length > 0 ? (
          <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--muted)" }}>
            Showing {filteredBooks.length} of {books.length} books
          </div>
        ) : null}

        {!loading && filteredBooks.length > 0 && (!isAdmin || viewMode === "grid") ? (
          <div className="book-grid-3col">
            {filteredBooks.map((book) => (
              <article key={book.id} className="book-card">
                <div className="book-card-cover-wrap">
                  {book.imagePath ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="book-card-cover"
                      src={book.imagePath}
                      alt={`Cover of ${book.bookName}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="book-card-placeholder">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                        <path d="M6 2v20" />
                      </svg>
                      <span>No cover available</span>
                    </div>
                  )}
                </div>

                <div className="book-card-body">
                  <h3 className="book-card-title">
                    <Link href={`/books/${book.id}`}>{book.bookName}</Link>
                  </h3>

                  <p className="book-card-author">By {book.authorName}</p>

                  <div className="book-card-tags">
                    {book.category ? (
                      <span className="book-tag">{book.category}</span>
                    ) : null}
                    {book.shelf ? (
                      <span className="book-tag">Shelf {book.shelf}</span>
                    ) : null}
                    {book.edition ? (
                      <span className="book-tag">{book.edition}</span>
                    ) : null}
                  </div>

                  <div className="book-card-actions">
                    <Link href={`/books/${book.id}`} className="button-link">
                      View Book
                    </Link>
                    {isAdmin ? (
                      <Link
                        href={`/books/${book.id}/edit`}
                        className="button-quiet"
                      >
                        Edit
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && filteredBooks.length > 0 && isAdmin && viewMode === "table" ? (
          <div className="table-wrap">
            <table className="students">
              <thead>
                <tr>
                  <th>Cover</th>
                  <th>Book name</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Shelf</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => (
                  <tr key={book.id}>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="cover-thumb"
                        src={book.imagePath}
                        alt=""
                      />
                    </td>
                    <td>{book.bookName}</td>
                    <td>{book.authorName}</td>
                    <td>{book.category}</td>
                    <td>{book.shelf || "—"}</td>
                    <td>{book.barcode}</td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/books/${book.id}`}>View</Link>
                        {isAdmin ? (
                          <Link href={`/books/${book.id}/edit`}>Edit</Link>
                        ) : null}
                        {isAdmin && confirmingId === book.id ? (
                          <>
                            <span>Delete this book?</span>
                            <button
                              type="button"
                              className="button-danger"
                              disabled={pendingId === book.id}
                              onClick={() => void removeBook(book)}
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              className="button-quiet"
                              disabled={pendingId === book.id}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            className="button-danger"
                            disabled={pendingId === book.id}
                            onClick={() => setConfirmingId(book.id)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
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
