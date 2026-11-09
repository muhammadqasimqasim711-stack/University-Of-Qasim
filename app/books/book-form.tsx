"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOK_CATEGORIES } from "@/lib/book-categories";
import type { AuthorView } from "@/lib/authors";
import type { PublisherView } from "@/lib/publishers";
import type { BookView } from "@/lib/books";
import type { ShelfView } from "@/lib/shelves";

type BookFieldErrors = Partial<
  Record<
    | "authorName"
    | "publisher"
    | "edition"
    | "category"
    | "bookName"
    | "subName"
    | "shelf"
    | "barcode"
    | "bookInformation"
    | "image",
    string[]
  >
>;

type BookFormValues = {
  authorName: string;
  publisher: string;
  edition: string;
  category: string;
  bookName: string;
  subName: string;
  shelf: string;
  barcode: string;
  bookInformation: string;
};

const emptyValues: BookFormValues = {
  authorName: "",
  publisher: "",
  edition: "",
  category: "",
  bookName: "",
  subName: "",
  shelf: "",
  barcode: "",
  bookInformation: "",
};

function firstError(errors: string[] | undefined) {
  return errors?.[0];
}

function valuesFromBook(book: BookView): BookFormValues {
  return {
    authorName: book.authorName,
    publisher: book.publisher,
    edition: book.edition,
    category: book.category,
    bookName: book.bookName,
    subName: book.subName,
    shelf: book.shelf,
    barcode: book.barcode,
    bookInformation: book.bookInformation,
  };
}

export function BookForm({
  book,
  initialCategory,
}: {
  book?: BookView;
  initialCategory?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<BookFormValues>(() => {
    if (book) {
      return valuesFromBook(book);
    }
    return {
      ...emptyValues,
      category: initialCategory ?? "",
    };
  });
  const [fieldErrors, setFieldErrors] = useState<BookFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shelves, setShelves] = useState<ShelfView[]>([]);
  const [authors, setAuthors] = useState<AuthorView[]>([]);
  const [publishers, setPublishers] = useState<PublisherView[]>([]);
  const [nextBarcodeInfo, setNextBarcodeInfo] = useState<{
    success: boolean;
    barcode?: string;
    error?: string;
  } | null>(null);

  // Filter shelves according to selected book category
  const categoryShelves = shelves.filter((sh) => {
    if (!values.category) return false;
    return !sh.category || sh.category.toLowerCase() === values.category.toLowerCase();
  });

  useEffect(() => {
    let ignore = false;

    async function loadOptions() {
      try {
        const [shelvesRes, authorsRes, publishersRes, nextBcRes] = await Promise.all([
          fetch("/api/shelves", { cache: "no-store" }),
          fetch("/api/authors", { cache: "no-store" }),
          fetch("/api/publishers", { cache: "no-store" }),
          !book ? fetch("/api/books/next-barcode", { cache: "no-store" }) : Promise.resolve(null),
        ]);
        if (shelvesRes.ok) {
          const body = (await shelvesRes.json()) as ShelfView[];
          if (!ignore) {
            setShelves(body);
          }
        }
        if (authorsRes.ok) {
          const body = (await authorsRes.json()) as AuthorView[];
          if (!ignore) {
            setAuthors(body);
          }
        }
        if (publishersRes.ok) {
          const body = (await publishersRes.json()) as PublisherView[];
          if (!ignore) {
            setPublishers(body);
          }
        }
        if (nextBcRes && nextBcRes.ok) {
          const bcData = await nextBcRes.json();
          if (!ignore) {
            setNextBarcodeInfo(bcData);
          }
        }
      } catch {
        // ignore load errors
      }
    }

    void loadOptions();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function update<K extends keyof BookFormValues>(
    key: K,
    value: BookFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setPreview(file: File | null) {
    setPreviewUrl((current) => {
      if (current?.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    setFieldErrors({});

    const body = new FormData();
    body.set("authorName", values.authorName);
    body.set("publisher", values.publisher);
    body.set("edition", values.edition);
    body.set("category", values.category);
    body.set("bookName", values.bookName);
    body.set("subName", values.subName);
    body.set("shelf", values.shelf);
    if (book) {
      body.set("barcode", values.barcode);
    }
    body.set("bookInformation", values.bookInformation);

    const image = fileRef.current?.files?.[0];
    if (image) {
      body.set("image", image);
    }

    try {
      const response = await fetch(book ? `/api/books/${book.id}` : "/api/books", {
        method: book ? "PUT" : "POST",
        body,
      });
      const payload = (await response.json()) as BookView & {
        message?: string;
        errors?: BookFieldErrors;
      };

      if (!response.ok) {
        setFieldErrors(payload.errors ?? {});
        setFormError(payload.message ?? "Could not save the book.");
        return;
      }

      router.push(`/books/${payload.id}`);
      router.refresh();
    } catch {
      setFormError("Could not save the book.");
    } finally {
      setSaving(false);
    }
  }

  const coverSrc = previewUrl ?? book?.imagePath ?? null;

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h2>{book ? "Edit book" : "Add book"}</h2>
      <p className="panel-copy">
        {book
          ? "Update this book. The barcode must stay unique. Leave the image blank to keep the current cover."
          : "Author, publisher, edition, category, book name, shelf, and a cover image are required. The book barcode is generated automatically upon saving based on Master Configuration. Sub name and book information can be left blank."}
      </p>

      {formError ? (
        <p className="banner error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="fields fields-grid">
        <div className="field">
          <label htmlFor="authorName">Author name *</label>
          <select
            id="authorName"
            name="authorName"
            value={values.authorName}
            aria-invalid={firstError(fieldErrors.authorName) ? true : undefined}
            onChange={(event) => update("authorName", event.target.value)}
          >
            <option value="">Select Author…</option>
            {authors.map((author) => (
              <option key={author.id} value={author.fullName}>
                {author.fullName}
              </option>
            ))}
            {values.authorName &&
            !authors.some((a) => a.fullName === values.authorName) ? (
              <option value={values.authorName}>{values.authorName}</option>
            ) : null}
          </select>
          {firstError(fieldErrors.authorName) ? (
            <p className="field-error">{firstError(fieldErrors.authorName)}</p>
          ) : null}
          <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
            💡 Configured via Master Configuration &gt; Authors.
          </p>
        </div>

        <div className="field">
          <label htmlFor="publisher">Publisher *</label>
          <select
            id="publisher"
            name="publisher"
            value={values.publisher}
            aria-invalid={firstError(fieldErrors.publisher) ? true : undefined}
            onChange={(event) => update("publisher", event.target.value)}
          >
            <option value="">Select Publisher…</option>
            {publishers.map((pub) => (
              <option key={pub.id} value={pub.name}>
                {pub.name}
              </option>
            ))}
            {values.publisher &&
            !publishers.some((p) => p.name === values.publisher) ? (
              <option value={values.publisher}>{values.publisher}</option>
            ) : null}
          </select>
          {firstError(fieldErrors.publisher) ? (
            <p className="field-error">{firstError(fieldErrors.publisher)}</p>
          ) : null}
          <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
            💡 Configured via Master Configuration &gt; Publishers.
          </p>
        </div>
        <TextField
          id="edition"
          label="Edition"
          value={values.edition}
          error={firstError(fieldErrors.edition)}
          onChange={(value) => update("edition", value)}
        />
        <div className="field">
          <label htmlFor="category">Category *</label>
          <select
            id="category"
            name="category"
            value={values.category}
            aria-invalid={firstError(fieldErrors.category) ? true : undefined}
            onChange={(event) => {
              const newCat = event.target.value;
              update("category", newCat);
              // Reset shelf if it doesn't belong to new category
              if (values.shelf) {
                const stillValid = shelves.some(
                  (sh) =>
                    sh.shelfNumber === values.shelf &&
                    (!sh.category || sh.category.toLowerCase() === newCat.toLowerCase())
                );
                if (!stillValid) update("shelf", "");
              }
            }}
          >
            <option value="">Select category…</option>
            {BOOK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            {values.category &&
            !BOOK_CATEGORIES.includes(values.category as (typeof BOOK_CATEGORIES)[number]) ? (
              <option value={values.category}>{values.category}</option>
            ) : null}
          </select>
          <div
            className="category-select-chips"
            role="group"
            aria-label="Quick category selection"
          >
            {BOOK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${values.category === cat ? "active" : ""}`}
                onClick={() => {
                  update("category", cat);
                  if (values.shelf) {
                    const stillValid = shelves.some(
                      (sh) =>
                        sh.shelfNumber === values.shelf &&
                        (!sh.category || sh.category.toLowerCase() === cat.toLowerCase())
                    );
                    if (!stillValid) update("shelf", "");
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          {firstError(fieldErrors.category) ? (
            <p className="field-error">{firstError(fieldErrors.category)}</p>
          ) : null}
        </div>
        <TextField
          id="bookName"
          label="Book name"
          value={values.bookName}
          error={firstError(fieldErrors.bookName)}
          onChange={(value) => update("bookName", value)}
        />
        <TextField
          id="subName"
          label="Sub name"
          value={values.subName}
          error={firstError(fieldErrors.subName)}
          onChange={(value) => update("subName", value)}
        />
        <div className="field">
          <label htmlFor="shelf">Shelf (Filtered by Category)</label>
          <select
            id="shelf"
            name="shelf"
            value={values.shelf}
            disabled={!values.category}
            aria-invalid={firstError(fieldErrors.shelf) ? true : undefined}
            onChange={(event) => update("shelf", event.target.value)}
          >
            {!values.category ? (
              <option value="">-- Please select category first --</option>
            ) : categoryShelves.length === 0 ? (
              <option value="">No shelves for category &quot;{values.category}&quot;</option>
            ) : (
              <option value="">Select shelf…</option>
            )}
            {categoryShelves.map((sh) => (
              <option key={sh.id} value={sh.shelfNumber}>
                Shelf {sh.shelfNumber}
                {sh.location ? ` (${sh.location})` : ""}
                {sh.capacity !== null && sh.capacity !== undefined ? ` [Cap: ${sh.capacity}]` : ""}
              </option>
            ))}
            {values.shelf &&
            !categoryShelves.some((sh) => sh.shelfNumber === values.shelf) ? (
              <option value={values.shelf}>{values.shelf}</option>
            ) : null}
          </select>
          {!values.category ? (
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px" }}>
              💡 Select a category above to view available shelves for that category.
            </p>
          ) : categoryShelves.length > 0 ? (
            <div
              className="category-select-chips"
              role="group"
              aria-label="Quick shelf selection"
            >
              {categoryShelves.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  className={`category-chip ${values.shelf === sh.shelfNumber ? "active" : ""}`}
                  onClick={() => update("shelf", sh.shelfNumber)}
                >
                  {sh.shelfNumber}
                  {sh.capacity !== null && sh.capacity !== undefined ? ` (${sh.capacity})` : ""}
                </button>
              ))}
            </div>
          ) : (
            <p className="field-help" style={{ fontSize: "12px", marginTop: "4px", color: "var(--muted)" }}>
              No shelves configured for &quot;{values.category}&quot; yet. Add one in Master Configuration.
            </p>
          )}
          {firstError(fieldErrors.shelf) ? (
            <p className="field-error">{firstError(fieldErrors.shelf)}</p>
          ) : null}
        </div>
        {!book ? (
          <div className="field" style={{ gridColumn: "span 2" }}>
            <div style={{
              padding: "12px 16px",
              background: "var(--paper-subtle, rgba(255, 255, 255, 0.05))",
              border: "1px dashed var(--line)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <div>
                <span style={{ fontWeight: 600 }}>🏷️ Automatic Barcode Assignment</span>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Barcode is generated automatically upon saving based on Master Configuration. Manual entry is removed.
                </p>
              </div>
              {nextBarcodeInfo && (
                <span style={{
                  padding: "4px 10px",
                  background: nextBarcodeInfo.success ? "rgba(13, 148, 136, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: nextBarcodeInfo.success ? "var(--brand, #0d9488)" : "var(--danger, #ef4444)",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.88rem"
                }}>
                  {nextBarcodeInfo.success
                    ? `Next Barcode: ${nextBarcodeInfo.barcode}`
                    : `⚠️ ${nextBarcodeInfo.error}`}
                </span>
              )}
            </div>
            {firstError(fieldErrors.barcode) ? (
              <p className="field-error" style={{ marginTop: 6 }}>{firstError(fieldErrors.barcode)}</p>
            ) : null}
          </div>
        ) : (
          <div className="field">
            <label htmlFor="barcode">Barcode (System Assigned)</label>
            <input
              id="barcode"
              name="barcode"
              value={values.barcode}
              disabled
              style={{ opacity: 0.8, cursor: "not-allowed" }}
            />
            <p className="field-help">Assigned automatically and immutable.</p>
          </div>
        )}
        <div className="field">
          <label htmlFor="image">Book image</label>
          <input
            ref={fileRef}
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={fieldErrors.image ? true : undefined}
            onChange={(event) => setPreview(event.target.files?.[0] ?? null)}
          />
          <p className="field-help">JPEG, PNG, or WebP, up to 2 MB.</p>
          {fieldErrors.image ? (
            <p className="field-error">{firstError(fieldErrors.image)}</p>
          ) : null}
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cover-preview" src={coverSrc} alt="" />
          ) : null}
        </div>
        <div className="field field-wide">
          <label htmlFor="bookInformation">Book information</label>
          <textarea
            id="bookInformation"
            name="bookInformation"
            rows={4}
            value={values.bookInformation}
            aria-invalid={fieldErrors.bookInformation ? true : undefined}
            onChange={(event) => update("bookInformation", event.target.value)}
          />
          {fieldErrors.bookInformation ? (
            <p className="field-error">
              {firstError(fieldErrors.bookInformation)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save book"}
        </button>
        <a className="button-link" href={book ? `/books/${book.id}` : "/books"}>
          Cancel
        </a>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  list,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  list?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="text"
        list={list}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
