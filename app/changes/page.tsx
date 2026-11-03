import PageTop from "../page-top";
import ChangesClient from "./changes-client";
import { currentUser } from "@/lib/auth";
import { recentChanges } from "@/lib/history";
export const dynamic = "force-dynamic";
export default async function Page() {
  await currentUser();
  return <main className="page"><PageTop /><div className="page-body"><h1>What changed</h1><p className="lede">Every change, with who made it and what it was before. Newest first. Undo puts back only what that change touched.</p><ChangesClient initial={await recentChanges(150)} /></div></main>;
}
