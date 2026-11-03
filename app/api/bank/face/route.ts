import { NextRequest, NextResponse } from "next/server";
import { isServiceFailure, logQuietly } from "@/lib/problems";
import { currentUser } from "@/lib/auth";
import { makeFace } from "@/lib/actions";
export const dynamic = "force-dynamic"; export const maxDuration = 300;
export async function POST(req: NextRequest) {
  const by = await currentUser(); const { who, expression } = await req.json();
  try { return NextResponse.json((await makeFace(who, String(expression ?? ""), by)).item); }
  catch (e) { const msg = (e as Error).message; if (isServiceFailure(msg)) await logQuietly(msg, "face", by); return NextResponse.json({ error: msg }, { status: 400 }); }
}
