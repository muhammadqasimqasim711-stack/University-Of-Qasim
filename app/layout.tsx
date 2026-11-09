import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SessionProvider } from "@/app/session-context";
import { SiteNav } from "@/app/site-nav";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "University of Qasim Library",
  description: "Master configuration for the University of Qasim library.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;

  return (
    <html lang="en">
      <body>
        <SessionProvider role={session?.role ?? null}>
          <SiteNav />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
