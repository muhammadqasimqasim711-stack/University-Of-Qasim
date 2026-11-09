import { IssuePeople } from "@/app/book-ledger/issue-people";

export default async function IssueTeachersPage({
  searchParams,
}: {
  searchParams?: Promise<{ bookId?: string }>;
}) {
  const params = await searchParams;
  return <IssuePeople kind="teacher" bookId={params?.bookId ?? ""} />;
}
