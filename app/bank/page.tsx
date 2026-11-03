import PageTop from "../page-top";
import BankClient from "./bank-client";
import { currentUser } from "@/lib/auth";
import { getBank } from "@/lib/bank";
import { getLooks } from "@/lib/looks";
export const dynamic = "force-dynamic";
export default async function Page() {
  const who = await currentUser();
  return <main className="page"><PageTop /><BankClient initial={await getBank()} looks={await getLooks()} who={who} /></main>;
}
