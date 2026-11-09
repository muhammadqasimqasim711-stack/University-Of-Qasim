import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

function isAdminOnly(pathname: string, method: string) {
  if (
    pathname === "/configuration" ||
    pathname.startsWith("/configuration/") ||
    pathname === "/profiles" ||
    pathname.startsWith("/profiles/") ||
    pathname === "/students" ||
    pathname.startsWith("/students/") ||
    pathname === "/teachers" ||
    pathname.startsWith("/teachers/") ||
    pathname === "/books/new" ||
    /^\/books\/[^/]+\/edit$/.test(pathname) ||
    pathname === "/book-ledger" ||
    pathname.startsWith("/book-ledger/") ||
    pathname === "/api/book-ledger" ||
    pathname.startsWith("/api/book-ledger/") ||
    pathname === "/issued-books" ||
    pathname.startsWith("/issued-books/") ||
    pathname === "/api/issued-books" ||
    pathname.startsWith("/api/issued-books/") ||
    pathname === "/api/configuration" ||
    pathname.startsWith("/api/configuration/") ||
    pathname.startsWith("/api/students") ||
    pathname.startsWith("/api/teachers") ||
    pathname === "/authors/new" ||
    /^\/authors\/[^/]+\/edit$/.test(pathname) ||
    pathname === "/shelves/new" ||
    /^\/shelves\/[^/]+\/edit$/.test(pathname) ||
    pathname === "/loans" ||
    pathname.startsWith("/loans/") ||
    pathname === "/requests" ||
    pathname.startsWith("/requests/") ||
    pathname === "/book-requests" ||
    pathname.startsWith("/book-requests/") ||
    (pathname.startsWith("/api/registration-requests") && method !== "POST") ||
    (pathname.startsWith("/api/book-requests/") && method !== "GET" && method !== "HEAD")
  ) {
    return true;
  }

  if (pathname === "/api/books" || pathname.startsWith("/api/books/")) {
    return method !== "GET" && method !== "HEAD";
  }

  if (pathname === "/api/shelves" || pathname.startsWith("/api/shelves/")) {
    return method !== "GET" && method !== "HEAD";
  }

  if (pathname === "/api/authors" || pathname.startsWith("/api/authors/")) {
    return method !== "GET" && method !== "HEAD";
  }

  if (pathname === "/api/publishers" || pathname.startsWith("/api/publishers/")) {
    return method !== "GET" && method !== "HEAD";
  }

  return false;
}

function reject(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { message: "Sign in required." },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    (pathname === "/api/registration-requests" && request.method === "POST") ||
    (pathname === "/api/configuration" &&
      (request.method === "GET" || request.method === "HEAD"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;

  if (pathname === "/" || pathname === "/login") {
    if (pathname === "/login" && session) {
      const destination =
        session.role === "admin" ? "/configuration" : "/books";
      return NextResponse.redirect(new URL(destination, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return reject(request, pathname);
  }

  if (session.role !== "admin" && isAdminOnly(pathname, request.method)) {
    return reject(request, pathname);
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (session.role === "admin") {
      return NextResponse.redirect(new URL("/configuration", request.url));
    }
    return NextResponse.redirect(new URL("/books", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/configuration",
    "/configuration/:path*",
    "/students",
    "/students/:path*",
    "/teachers",
    "/teachers/:path*",
    "/books",
    "/books/:path*",
    "/book-ledger",
    "/book-ledger/:path*",
    "/issued-books",
    "/issued-books/:path*",
    "/authors",
    "/authors/:path*",
    "/shelves",
    "/shelves/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/loans",
    "/my-loans",
    "/my-book-ledger",
    "/profile",
    "/return-books",
    "/overdue-books",
    "/barcodes",
    "/requests",
    "/requests/:path*",
    "/book-requests",
    "/api/:path*",
    "/book-images/:path*",
  ],
};
