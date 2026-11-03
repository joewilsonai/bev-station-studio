import { NextRequest, NextResponse } from "next/server";
import { isServiceFailure, logQuietly } from "@/lib/problems";
import { currentUser } from "@/lib/auth";
import { makeSoundItem } from "@/lib/sound";
export const dynamic = "force-dynamic"; export const maxDuration = 120;
export async function POST(req: NextRequest) {
  const by = await currentUser(); const { prompt, title } = await req.json();
  try { if (!String(prompt ?? "").trim()) throw new Error("Describe the sound first."); return NextResponse.json(await makeSoundItem(title || String(prompt).slice(0, 50), prompt, undefined, by)); }
  catch (e) { const msg = (e as Error).message; if (isServiceFailure(msg)) await logQuietly(msg, "sound", by); return NextResponse.json({ error: msg }, { status: 400 }); }
}
