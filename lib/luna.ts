import { promises as fs } from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { episodes, episode } from "./episodes";
import type { Board } from "./types";
import { bankSummary, type BankItem } from "./bank";
const read = (f: string) => fs.readFile(path.join(process.cwd(), "data", f), "utf8");
export async function systemBlocks(who: string): Promise<Anthropic.TextBlockParam[]> {
  const canon = (await Promise.all(["setting-LOCKED.md", "character-sketches-the-three.md", "pen-LOCKED.md", "maneater-LOCKED.md", "cherry-jane-LOCKED.md"].map(read))).join("\n\n---\n\n");
  const stable = (await read("luna-brief.md")).replace("{{EPISODES}}", episodes.map(e => `${e.n}. ${e.title}`).join("; ")).replace("{{CANON}}", canon);
  return [{ type: "text", text: stable, cache_control: { type: "ephemeral" } }, { type: "text", text: `You are talking with ${who}.` }];
}
export function context(ep: number, b: Board, notes: string[], bank: BankItem[], recipe: string, looks = ""): string {
  const e = episode(ep)!;
  const shots = b.shots.filter(s => !s.archived).map((s, i) => `${i + 1}. id=${s.id} [${s.status}] ${s.seconds}s place=${s.place ?? "?"} cast=${s.cast.join(",")} camera=${s.camera ?? ""}\n   ${s.desc}\n   ${s.lines.map(l => `${l.who}${l.kind === "thought" ? " (thought)" : ""}: ${l.text}${l.proposed ? " [PROPOSED]" : ""}`).join(" / ")}${s.note ? `\n   note: ${s.note}` : ""}${s.refs?.length ? `\n   pictures pinned: ${s.refs.join(",")}` : ""}${s.sounds?.length ? `\n   sounds pinned: ${s.sounds.join(",")}` : ""}`).join("\n");
  return `Open now: Episode ${ep}, "${e.title}".\n\nKIM'S SCRIPT, exact:\n${e.script}\n\nTHE BOARD:\n${shots || "(empty)"}\n\nWHAT WE HAVE AGREED ACROSS THE SHOW:\n${notes.map(n => `- ${n}`).join("\n") || "(nothing yet)"}\n\nCHANGES KIM MADE TO THE LOOKS, these win over the canon:\n${looks || "(none)"}\n\nTHE BANK (ids you can pin to shots):\n${bankSummary(bank)}\n\nTHE RECIPE, Kim's template:\n${recipe}`;
}
const WHO = { type: "string", enum: ["pen", "maneater", "cherry-jane", "other"] };
const LINES = { type: "array", items: { type: "object", properties: { who: WHO, name: { type: "string", description: "Speaker's name if who is other" }, kind: { type: "string", enum: ["aloud", "thought"] }, text: { type: "string", description: "Word for word from Kim's script" } }, required: ["who", "kind", "text"] } };
const SHOT = { desc: { type: "string", description: "What we see, drawable without asking" }, camera: { type: "string" }, place: { type: "string", enum: ["no-mans-land", "bev-station", "silverware", "pos", "dock", "floor", "door"] }, cast: { type: "array", items: WHO }, lines: LINES, seconds: { type: "number" }, panel: { type: "string", description: "Kim's panel or scene label" }, note: { type: "string" } };
export const TOOLS: Anthropic.Tool[] = [
  { name: "add_shots", description: "Add shots to the end of this episode's board, or at a position.", input_schema: { type: "object", properties: { shots: { type: "array", items: { type: "object", properties: SHOT, required: ["desc", "cast", "seconds"] } }, at: { type: "number", description: "1-based position; omit for the end" } }, required: ["shots"] } },
  { name: "update_shot", description: "Change a shot on this board.", input_schema: { type: "object", properties: { id: { type: "string" }, ...SHOT }, required: ["id"] } },
  { name: "move_shot", description: "Move a shot to a 1-based position.", input_schema: { type: "object", properties: { id: { type: "string" }, position: { type: "number" } }, required: ["id", "position"] } },
  { name: "remove_shot", description: "Take a shot off the rail. It is kept and Kim can bring it back.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "draw_shots", description: "Start drawing pictures for these shots from the locked references. Starts right away in Kim's page; about a minute each.", input_schema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, direction: { type: "string", description: "Optional note for this take" } }, required: ["ids"] } },
  { name: "read_episode", description: "Read Kim's exact script for another episode.", input_schema: { type: "object", properties: { n: { type: "number" } }, required: ["n"] } },
  { name: "pin_to_shot", description: "Pin Bank pictures, faces or sounds to a shot. Replaces that shot's pinned lists when given.", input_schema: { type: "object", properties: { id: { type: "string" }, refs: { type: "array", items: { type: "string" } }, sounds: { type: "array", items: { type: "string" } } }, required: ["id"] } },
  { name: "add_note", description: "Put a note in the Bank, for this episode or the whole show.", input_schema: { type: "object", properties: { title: { type: "string" }, text: { type: "string" }, ep: { type: "number" } }, required: ["title", "text"] } },
  { name: "make_sound", description: "Generate a short sound effect and put it in the Bank. Describe the sound concretely.", input_schema: { type: "object", properties: { title: { type: "string" }, prompt: { type: "string" }, seconds: { type: "number" } }, required: ["title", "prompt"] } },
  { name: "make_face", description: "Draw one expression into a character's range in the Bank, from the locked face. Takes about 20 seconds in Kim's page.", input_schema: { type: "object", properties: { who: { type: "string", enum: ["pen", "maneater", "cherry-jane"] }, expression: { type: "string", description: "In Kim's words when she gave them" } }, required: ["who", "expression"] } },
  { name: "draw_look", description: "Draw a NEW look option for a character from Kim's description, in the Bank under Faces. It does not change anything until Kim makes it her look.", input_schema: { type: "object", properties: { who: { type: "string", enum: ["pen", "maneater", "cherry-jane"] }, description: { type: "string", description: "Kim's words" }, keep_face: { type: "boolean", description: "Keep her the same recognizable woman. Default false." } }, required: ["who", "description"] } },
  { name: "set_recipe", description: "Replace the Recipe with this full text, after Kim agrees to the change.", input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "request_feature", description: "Kim needs the studio to do something it can't. This reaches the Luna who builds it. Use it instead of sending her to Joe.", input_schema: { type: "object", properties: { what: { type: "string", description: "What she was trying to do, in her words" } }, required: ["what"] } },
  { name: "report_problem", description: "Something in the studio is broken or Kim is stuck. This reaches the Luna at Joe's side. Use it instead of sending Kim to Joe.", input_schema: { type: "object", properties: { what: { type: "string" } }, required: ["what"] } },
  { name: "remember", description: "Keep something Kim or Joe decided about the show, for every future session. Only what they actually decided.", input_schema: { type: "object", properties: { note: { type: "string" } }, required: ["note"] } },
];
export const MODEL = process.env.LUNA_MODEL ?? "claude-opus-5-5";
export const PRICE = { in: 4, out: 20, cacheRead: 0.4, cacheWrite: 5 };
