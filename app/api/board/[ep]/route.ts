import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { applyUpdate, changeBoard, findShot, getBoard, makeShot, moveShot } from "@/lib/board";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ ep: string }> };
export async function GET(_: NextRequest, { params }: Ctx) {
  return NextResponse.json(await getBoard(Number((await params).ep)));
}
export async function POST(req: NextRequest, { params }: Ctx) {
  const ep = Number((await params).ep); const by = await currentUser(); const b = await req.json();
  try {
    const out = await changeBoard(ep, board => {
      switch (b.op) {
        case "add": { const s = makeShot(ep, b.shot ?? { desc: "" }, by); const live = board.shots.filter(x => !x.archived);
          live.splice(b.at ?? live.length, 0, s); board.shots = [...live, ...board.shots.filter(x => x.archived)]; break; }
        case "update": applyUpdate(ep, findShot(board, b.id), b.patch); break;
        case "move": moveShot(board, b.id, b.to); break;
        case "remove": findShot(board, b.id).archived = true; break;
        case "restore": { const s = findShot(board, b.id); s.archived = false; const live = board.shots.filter(x => !x.archived && x.id !== b.id);
          board.shots = [...live, s, ...board.shots.filter(x => x.archived && x.id !== b.id)]; break; }
        case "pick": { const s = findShot(board, b.id); if (!s.takes.some(t => t.id === b.take)) throw new Error("That take is gone."); s.pick = b.take; if (s.status === "idea") s.status = "drawn"; break; }
        case "yes": { if (by !== "Kim") throw new Error("Only Kim can give a shot her yes."); const s = findShot(board, b.id); s.status = b.on ? "yes" : (s.takes.length ? "drawn" : "idea"); break; }
        default: throw new Error("Unknown change.");
      }
    });
    return NextResponse.json(out);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
