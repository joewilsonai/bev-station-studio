import { cookies } from "next/headers";
export async function currentUser(): Promise<string> {
  const c = (await cookies()).get("studio")?.value ?? "";
  if (process.env.KIM_TOKEN && c === process.env.KIM_TOKEN) return "Kim";
  if (process.env.JOE_TOKEN && c === process.env.JOE_TOKEN) return "Joe";
  if (!process.env.KIM_TOKEN) return "Kim"; // local development only: production always has tokens
  throw new Error("Not signed in");
}
