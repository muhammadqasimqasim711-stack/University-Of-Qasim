"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookForm } from "@/app/books/book-form";
import type { BookView } from "@/lib/books";

export default function EditBookPage() {
  const params = useParams<{ id: string }>();
  const [book, setBook] = useState<BookView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Books</p>
          <h1>Edit book</h1>
          <p className="lede">
            <Link href={book ? `/books/${book.id}` : "/books"}>
              Back to book
            </Link>
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading book…</p> : null}
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}
      {book ? <BookForm book={book} /> : null}
    </main>
  );
}
