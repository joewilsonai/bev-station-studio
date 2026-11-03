import { NextRequest, NextResponse } from "next/server";
import { readBytes } from "@/lib/store";
export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", mp4: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const p = (await params).path.join("/");
  if (!/^(takes|voice|bank)\//.test(p) || p.includes("..")) return new NextResponse("Not found", { status: 404 });
  const r = await readBytes(p); if (!r) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(r.bytes), { headers: { "content-type": TYPES[p.split(".").pop()!] ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" } });
}
