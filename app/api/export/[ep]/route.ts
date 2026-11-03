import { NextRequest, NextResponse } from "next/server";
import { getBoard } from "@/lib/board";
import { episode } from "@/lib/episodes";
import { NAMES } from "@/lib/types";
import { toPanelByPanel } from "@/lib/export";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest, { params }: { params: Promise<{ ep: string }> }) {
  const ep = Number((await params).ep); const e = episode(ep); if (!e) return new NextResponse("Not found", { status: 404 });
  const text = toPanelByPanel(e, await getBoard(ep), NAMES);
  return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="bev-station-e${String(ep).padStart(2, "0")}.txt"` } });
}
