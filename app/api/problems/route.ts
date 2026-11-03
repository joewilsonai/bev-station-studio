import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readJSON } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest) {
  if ((await currentUser()) !== "Joe") return NextResponse.json({ error: "Not for this login." }, { status: 403 });
  return NextResponse.json((await readJSON<unknown[]>("problems.json"))?.value ?? []);
}
