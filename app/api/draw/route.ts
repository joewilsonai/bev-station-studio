import { NextRequest, NextResponse } from "next/server";
import { isServiceFailure, logQuietly } from "@/lib/problems";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/board";
import { drawShot } from "@/lib/actions";
export const dynamic = "force-dynamic"; export const maxDuration = 300;
export async function POST(req: NextRequest) {
  const by = await currentUser(); const { ep, id, direction } = await req.json();
  try { await drawShot(ep, id, direction, by); return NextResponse.json(await getBoard(ep)); }
  catch (e) { const msg = (e as Error).message; if (isServiceFailure(msg)) await logQuietly(msg, "draw", by); return NextResponse.json({ error: msg }, { status: 400 }); }
}
