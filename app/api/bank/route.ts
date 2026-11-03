import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addItem, changeBank, getBank } from "@/lib/bank";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await getBank()); }
export async function POST(req: NextRequest) {
  const by = await currentUser(); const b = await req.json();
  try {
    if (b.op === "note") { if (!String(b.text ?? "").trim()) throw new Error("Write the note first."); await addItem({ kind: "note", title: String(b.title || String(b.text).slice(0, 60)), text: b.text, ep: b.ep || undefined, by }); }
    else if (b.op === "update") await changeBank(l => { const i = l.find(x => x.id === b.id); if (!i) throw new Error("That item is gone."); if (b.title !== undefined) i.title = b.title; if (b.text !== undefined) i.text = b.text; if (b.ep !== undefined) i.ep = b.ep || undefined; });
    else if (b.op === "remove" || b.op === "restore") await changeBank(l => { const i = l.find(x => x.id === b.id); if (i) i.archived = b.op === "remove"; });
    else throw new Error("Unknown change.");
    return NextResponse.json(await getBank());
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
