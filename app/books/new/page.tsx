import { BookForm } from "@/app/books/book-form";

export default async function NewBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Books</p>
          <h1>Add book</h1>
          <p className="lede">
            Record a book for the University of Qasim library.
          </p>
        </div>
      </header>
      <BookForm initialCategory={params?.category} />
    </main>
  );
}
