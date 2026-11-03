import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { makeLook } from "@/lib/actions";
import { getBoard } from "@/lib/board";
import { episodes } from "@/lib/episodes";
import { getLooks, setLook, shotsToRedo } from "@/lib/looks";
import { isServiceFailure, logQuietly } from "@/lib/problems";
export const dynamic = "force-dynamic"; export const maxDuration = 300;
export async function GET() { return NextResponse.json(await getLooks()); }
export async function POST(req: NextRequest) {
  const by = await currentUser(); const b = await req.json();
  try {
    if (b.op === "draw") return NextResponse.json((await makeLook(b.who, String(b.description ?? ""), !!b.keepFace, b.pictures ?? [], by)).look);
    if (b.op === "set") {
      if (by !== "Kim") throw new Error("Only Kim can change a look.");
      const looks = await setLook(b.who, b.id ?? null, by);
      const counts = (await Promise.all(episodes.map(async e => ({ n: e.n, c: shotsToRedo(looks, b.who, await getBoard(e.n)).length })))).filter(x => x.c);
      return NextResponse.json({ looks, redo: counts.length ? `Shots still showing her old look: ${counts.map(x => `Episode ${x.n}, ${x.c}`).join("; ")}. Draw them again on the rail. Filmed clips get reshot on Joe's side.` : "" });
    }
    throw new Error("Unknown change.");
  } catch (e) { const msg = (e as Error).message; if (isServiceFailure(msg)) await logQuietly(msg, "look", by); return NextResponse.json({ error: msg }, { status: 400 }); }
}
