import { cookies } from "next/headers";
import { setActor } from "./actor";
export async function currentUser(): Promise<string> {
  const c = (await cookies()).get("studio")?.value ?? "";
  if (process.env.KIM_TOKEN && c === process.env.KIM_TOKEN) { setActor("Kim"); return "Kim"; }
  if (process.env.JOE_TOKEN && c === process.env.JOE_TOKEN) { setActor("Joe"); return "Joe"; }
  if (!process.env.KIM_TOKEN && process.env.NODE_ENV !== "production") { setActor("Kim"); return "Kim"; } // local development only // local development only: production always has tokens
  throw new Error("Not signed in");
}
