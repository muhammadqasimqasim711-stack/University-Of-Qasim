import { IssuePeople } from "@/app/book-ledger/issue-people";

export default async function IssueStudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ bookId?: string }>;
}) {
  const params = await searchParams;
  return <IssuePeople kind="student" bookId={params?.bookId ?? ""} />;
}
