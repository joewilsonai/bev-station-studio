import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logProblem } from "@/lib/problems";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const by = await currentUser(); const { what, where } = await req.json();
  if (!String(what ?? "").trim()) return NextResponse.json({ error: "Say what went wrong first." }, { status: 400 });
  try { await logProblem(String(what), String(where ?? ""), by); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "That did not send. Try again." }, { status: 503 }); }
}
