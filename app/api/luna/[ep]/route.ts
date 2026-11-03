import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { currentUser } from "@/lib/auth";
import { applyUpdate, changeBoard, findShot, getBoard, makeShot, moveShot } from "@/lib/board";
import { reserve, settle } from "@/lib/budget";
import { episode } from "@/lib/episodes";
import { context, MODEL, PRICE, systemBlocks, TOOLS } from "@/lib/luna";
import { mutateJSON, readJSON } from "@/lib/store";
import { addItem, getBank, getRecipe, setRecipe } from "@/lib/bank";
import { makeSoundItem } from "@/lib/sound";
import { logProblem, logQuietly } from "@/lib/problems";
import { activeLook, getLooks } from "@/lib/looks";
import type { ChatMsg } from "@/lib/types";
export const dynamic = "force-dynamic"; export const maxDuration = 300;
const HOLD = 0.3;
type Ctx = { params: Promise<{ ep: string }> };
const chatPath = (ep: number) => `chat/e${String(ep).padStart(2, "0")}.json`;
type Note = { note: string; by: string; at: string };
export async function GET(_: NextRequest, { params }: Ctx) {
  return NextResponse.json((await readJSON<ChatMsg[]>(chatPath(Number((await params).ep))))?.value ?? []);
}
async function runTool(name: string, input: Record<string, any>, ep: number, by: string, emit: (o: object) => void): Promise<string> {
  switch (name) {
    case "add_shots": { const fresh = input.shots.map((s: any) => makeShot(ep, s, "Luna")); const made: string[] = fresh.map((s: any) => s.id);
      const b = await changeBoard(ep, board => { const live = board.shots.filter(s => !s.archived); const at = input.at ? input.at - 1 : live.length;
        live.splice(at, 0, ...fresh); board.shots = [...live, ...board.shots.filter(s => s.archived)]; });
      emit({ board: b }); const prop = b.shots.filter(s => made.includes(s.id)).flatMap(s => s.lines.filter(l => l.proposed).map(l => l.text));
      return `Added ${made.length}: ${made.join(", ")}.${prop.length ? ` These lines are not word for word in her script and are marked Proposed: ${prop.join(" | ")}` : ""}`; }
    case "update_shot": { const { id, ...patch } = input; const b = await changeBoard(ep, board => applyUpdate(ep, findShot(board, id), patch)); emit({ board: b }); return "Updated."; }
    case "move_shot": { const b = await changeBoard(ep, board => moveShot(board, input.id, input.position - 1)); emit({ board: b }); return "Moved."; }
    case "remove_shot": { const b = await changeBoard(ep, board => { findShot(board, input.id).archived = true; }); emit({ board: b }); return "Off the rail, kept in case she wants it back."; }
    case "draw_shots": emit({ draw: input.ids, direction: input.direction }); return `Drawing started for ${input.ids.length}. The pictures land on the rail as they finish.`;
    case "read_episode": return episode(input.n)?.script ?? "No such episode.";
    case "pin_to_shot": { const { id, ...patch } = input; const b = await changeBoard(ep, board => applyUpdate(ep, findShot(board, id), patch)); emit({ board: b }); return "Pinned."; }
    case "add_note": { const n = await addItem({ kind: "note", title: input.title, text: input.text, ep: input.ep, by: "Luna" }); emit({ bank: true }); return `Note ${n.id} is in the Bank.`; }
    case "make_sound": { const s = await makeSoundItem(input.title, input.prompt, input.seconds, by); emit({ bank: true }); return `Sound ${s.id} is in the Bank: ${s.title}.`; }
    case "make_face": emit({ face: { who: input.who, expression: input.expression } }); return "Drawing started. It lands in the Bank under that character's range in a minute or two; its id is not known yet.";
    case "draw_look": emit({ look: { who: input.who, description: input.description, keepFace: !!input.keep_face } }); return "Drawing started. The option lands in the Bank under Faces in a minute or two. Kim makes it current herself.";
    case "set_recipe": await setRecipe(input.text, by); return "Recipe updated.";
    case "report_problem": await logProblem(input.what, `sidebar e${ep}`, by); return "Reported to my side.";
    case "remember": await mutateJSON<Note[]>("notes.json", () => [], n => { n.push({ note: input.note, by, at: new Date().toISOString() }); }); return "Kept.";
  }
  return "Unknown tool.";
}
export async function POST(req: NextRequest, { params }: Ctx) {
  const ep = Number((await params).ep); const by = await currentUser(); const { text } = await req.json();
  if (!episode(ep)) return NextResponse.json({ error: "No such episode." }, { status: 404 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({ async start(ctrl) {
    const emit = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
    try {
      const now = () => new Date().toISOString();
      const prior = await mutateJSON<ChatMsg[]>(chatPath(ep), () => [], c => { c.push({ role: "user", by, text: String(text).slice(0, 8000), at: now() }); });
      const notes = (await readJSON<Note[]>("notes.json"))?.value.map(n => n.note) ?? [];
      const client = new Anthropic();
      const history: Anthropic.MessageParam[] = prior.slice(-24).map(m => ({ role: m.role, content: m.role === "user" ? `${m.by}: ${m.text}` : m.text }));
      history[history.length - 1] = { role: "user", content: `${context(ep, await getBoard(ep), notes, await getBank(), await getRecipe(), await (async () => { const l = await getLooks(); return ["pen", "maneater", "cherry-jane"].map(w => { const a = activeLook(l, w); return a ? `${w}: ${a.description}` : ""; }).filter(Boolean).join("\n"); })())}\n\n${by}: ${String(text).slice(0, 8000)}` };
      const system = await systemBlocks(by); let reply = "";
      for (let turn = 0; turn < 8; turn++) {
        await reserve(`luna e${ep}`, HOLD, by); // released to the real cost after the call
        let cost = 0;
        try {
        const s = client.messages.stream({ model: MODEL, max_tokens: 6000, system, tools: TOOLS, messages: history });
        s.on("text", d => { reply += d; emit({ text: d }); });
        const m = await s.finalMessage();
        const u = m.usage; cost = (u.input_tokens * PRICE.in + u.output_tokens * PRICE.out + (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead + (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) / 1e6;
        await settle(`luna e${ep}`, HOLD, cost, by);
        cost = -1;
        if (m.stop_reason !== "tool_use") break;
        history.push({ role: "assistant", content: m.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const b of m.content) if (b.type === "tool_use") { emit({ tool: b.name });
          try { results.push({ type: "tool_result", tool_use_id: b.id, content: await runTool(b.name, b.input as Record<string, any>, ep, by, emit) }); }
          catch (e) { results.push({ type: "tool_result", tool_use_id: b.id, is_error: true, content: (e as Error).message }); } }
        history.push({ role: "user", content: results });
        if (reply && !reply.endsWith("\n")) { reply += "\n\n"; emit({ text: "\n\n" }); }
        } finally { if (cost >= 0) await settle(`luna e${ep}`, HOLD, cost, by); }
      }
      await mutateJSON<ChatMsg[]>(chatPath(ep), () => [], c => { c.push({ role: "assistant", by: "Luna", text: reply.trim(), at: now() }); });
      emit({ done: true });
    } catch (e) { const msg = (e as Error).message; await logQuietly(msg, `luna e${ep}`, by); emit({ error: /budget/i.test(msg) ? msg : "Luna hit an error and it has been reported. Send that again in a minute." }); }
    ctrl.close();
  } });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
