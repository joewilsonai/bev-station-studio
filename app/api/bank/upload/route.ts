import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addItem, storeFile } from "@/lib/bank";
export const dynamic = "force-dynamic";
const OK = /^(image\/(jpeg|png|webp|gif)|audio\/(mpeg|mp3|mp4|x-m4a|m4a|wav|x-wav|webm|ogg|aac))/;
export async function POST(req: NextRequest) {
  const by = await currentUser(); const q = req.nextUrl.searchParams; const type = (req.headers.get("content-type") ?? "").split(";")[0];
  try {
    if (!OK.test(type)) throw new Error("The Bank takes pictures (JPEG, PNG, WebP, GIF) and sounds (MP3, M4A, WAV, OGG).");
    const data = Buffer.from(await req.arrayBuffer());
    if (data.length > 4.4e6) throw new Error("That file is over 4 MB. Trim it, or send it as an MP3.");
    const name = q.get("name") || "file"; const src = await storeFile(name, data, type);
    const item = await addItem({ kind: type.startsWith("image") ? "image" : "sound", title: q.get("title") || name.replace(/\.[^.]+$/, ""), src, ep: Number(q.get("ep")) || undefined, by });
    return NextResponse.json(item);
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
