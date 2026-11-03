import { NextRequest, NextResponse } from "next/server";
import { isServiceFailure, logQuietly } from "@/lib/problems";
import { createHash } from "crypto";
import { currentUser } from "@/lib/auth";
import { reserve, settle } from "@/lib/budget";
import { readBytes, writeBytes } from "@/lib/store";
import show from "@/data/show.json";
export const dynamic = "force-dynamic"; export const maxDuration = 120;
const VOICES: Record<string, string> = show.voices;
export async function POST(req: NextRequest) {
  const by = await currentUser(); const { who, text, kind } = await req.json();
  let cost = 0;
  try {
    const voice = (kind === "thought" && VOICES[`${who}-thought`]) || VOICES[who]; if (!voice) throw new Error("There is no voice for that character yet.");
    const clean = String(text).replace(/[*_]/g, "").trim().slice(0, 900); if (!clean) throw new Error("This line is empty.");
    const file = `voice/${who}-${createHash("sha1").update(`${voice}:${clean}`).digest("hex").slice(0, 16)}.mp3`;
    if (await readBytes(file)) return NextResponse.json({ src: `/api/file/${file}` });
    const c = (clean.length / 1000) * 0.12; await reserve(`voice ${who}`, c, by); cost = c;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ text: clean, model_id: "eleven_v4", voice_settings: { stability: 0.5, similarity_boost: 0.82, style: 0.1, use_speaker_boost: true } }) });
    if (!r.ok) throw new Error(`The voice service said: ${(await r.text()).slice(0, 160)}`);
    await writeBytes(file, Buffer.from(await r.arrayBuffer()), "audio/mpeg"); cost = 0;
    return NextResponse.json({ src: `/api/file/${file}` });
  } catch (e) { if (cost) await settle("voice", cost, 0, by); const msg = (e as Error).message; if (isServiceFailure(msg)) await logQuietly(msg, "voice", by); return NextResponse.json({ error: msg }, { status: 400 }); }
}
