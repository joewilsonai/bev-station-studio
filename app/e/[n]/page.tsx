import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/board";
import { episode, episodes } from "@/lib/episodes";
import Studio from "./studio";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n); const e = episode(n); if (!e) notFound();
  return <Studio ep={n} title={e.title} script={e.script} who={await currentUser()} initial={await getBoard(n)} all={episodes.map(x => ({ n: x.n, title: x.title }))} />;
}
