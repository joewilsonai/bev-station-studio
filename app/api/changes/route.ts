import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { recentChanges } from "@/lib/history";
import { undoChange } from "@/lib/undo";
export const dynamic = "force-dynamic";
export async function GET() { await currentUser(); return NextResponse.json(await recentChanges(150)); }
export async function POST(req: NextRequest) {
  await currentUser(); const { id } = await req.json();
  try { return NextResponse.json({ message: await undoChange(String(id)) }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
