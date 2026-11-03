import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { applyUpdate, changeBoard, findShot, getBoard, makeShot, moveShot } from "@/lib/board";
import { addItem, bankSummary, changeBank, getBank, getRecipe, itemBytes, setRecipe, storeFile } from "@/lib/bank";
import { drawShot, IMG, makeFace, makeLook } from "@/lib/actions";
import { activeLook, getLooks, setLook, shotsToRedo } from "@/lib/looks";
import { makeSoundItem } from "@/lib/sound";
import { episode, episodes } from "@/lib/episodes";
import { guide, SITE } from "@/lib/install";
import { isServiceFailure, logProblem, logQuietly } from "@/lib/problems";
import { readBytes } from "@/lib/store";
import { fetchPublic } from "@/lib/fetch-public";
export const maxDuration = 300;
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const READ = { readOnlyHint: true } as const;
const Ep = z.number().int().min(1).max(16);
const Sign = z.string().optional().describe("Your own name, such as Pen or Datum");
const Cast = z.enum(["pen", "maneater", "cherry-jane", "other"]);
const LINE = z.object({ who: Cast, name: z.string().optional().describe("Speaker's name if who is other"), kind: z.enum(["aloud", "thought"]), text: z.string().describe("Word for word from Kim's script") });
const SHOT = { desc: z.string().optional().describe("What we see, drawable without asking"), camera: z.string().optional(), place: z.enum(["no-mans-land", "bev-station", "silverware", "pos", "dock", "floor", "door"]).optional(), cast: z.array(Cast).optional(), lines: z.array(LINE).optional(), seconds: z.number().optional(), panel: z.string().optional().describe("Kim's panel or scene label"), note: z.string().optional() };
const pic = (b: Buffer, type = IMG.type) => ({ type: "image" as const, data: b.toString("base64"), mimeType: type });
const typeOf = (src: string) => src.endsWith(".png") ? "image/png" : src.endsWith(".webp") ? "image/webp" : "image/jpeg";
function handlerFor(who: string) {
  const name = (s?: string) => (s?.trim() ? `${s.trim().slice(0, 40)}, for ${who}` : `${who}, by connector`);
  // Every tool answers in words a person can act on, and real failures reach Luna by themselves.
  const guard = async <T,>(fn: () => Promise<T | string>) => {
    try { const r = await fn(); return (typeof r === "string" ? text(r) : r) as ReturnType<typeof text>; }
    catch (e) { const m = (e as Error).message; if (isServiceFailure(m)) await logQuietly(m, "connector", who); return { ...text(m), isError: true }; }
  };
  return createMcpHandler(server => {
    server.registerTool("start_here", { title: "Start here", description: "The full manual: what this studio is, the rules of the show, how Kim works, every tool, and how a session goes. Call this first in every session.", inputSchema: z.object({}), annotations: READ }, () => guard(async () => guide()));
    server.registerTool("list_episodes", { title: "List episodes", description: "All sixteen episodes and how many shots each has.", inputSchema: z.object({}), annotations: READ },
      () => guard(async () => (await Promise.all(episodes.map(async e => { const live = (await getBoard(e.n)).shots.filter(s => !s.archived); return `${e.n}. ${e.title}: ${live.length} shots, ${live.filter(s => s.takes.length).length} with pictures, ${live.filter(s => s.status === "yes").length} with Kim's yes`; }))).join("\n")));
    server.registerTool("read_episode", { title: "Read an episode", description: "Kim's exact script and the current board for one episode, with a link to see it.", inputSchema: z.object({ episode: Ep }), annotations: READ },
      ({ episode: n }) => guard(async () => { const b = await getBoard(n); return `SEE THE BOARD: ${SITE}/e/${n}\n\nKIM'S SCRIPT, exact:\n${episode(n)!.script}\n\nTHE BOARD\n${b.shots.filter(s => !s.archived).map((s, i) => `${i + 1}. id ${s.id} [${s.status}] ${s.seconds}s ${s.place ?? ""} cast: ${s.cast.join(",")}${s.camera ? ` camera: ${s.camera}` : ""}\n   ${s.desc}\n   ${s.lines.map(l => `${l.who}${l.kind === "thought" ? " (thought)" : ""}: ${l.text}${l.proposed ? " [PROPOSED]" : ""}`).join(" / ")}${s.takes.length ? `\n   takes: ${s.takes.map(t => t.id + (t.id === s.pick ? " (pick)" : "")).join(", ")}` : ""}${s.refs?.length ? `\n   pictures pinned: ${s.refs.join(",")}` : ""}${s.sounds?.length ? `\n   sounds pinned: ${s.sounds.join(",")}` : ""}${s.note ? `\n   note: ${s.note}` : ""}`).join("\n") || "(empty)"}`; }));
    server.registerTool("read_recipe", { title: "Read the Recipe", description: "The fill-in-the-blank template for a scene.", inputSchema: z.object({}), annotations: READ }, () => guard(getRecipe));
    server.registerTool("set_recipe", { title: "Change the Recipe", description: "Replace the Recipe with this full text. Only after Kim agrees to the change.", inputSchema: z.object({ text: z.string(), signed_by: Sign }) }, ({ text: t, signed_by }) => guard(async () => { await setRecipe(t, name(signed_by)); return "The Recipe is updated."; }));
    server.registerTool("read_bank", { title: "Read the Bank", description: "Every note, sound, picture and face in the Bank, with the ids to pin them.", inputSchema: z.object({}), annotations: READ }, () => guard(async () => bankSummary(await getBank())));
    server.registerTool("show_picture", { title: "Show a picture", description: "See a picture: pass bank_id for a Bank picture or face, or episode and shot_id for a shot's current pick.", inputSchema: z.object({ bank_id: z.string().optional(), episode: Ep.optional(), shot_id: z.string().optional() }), annotations: READ },
      ({ bank_id, episode: ep, shot_id }) => guard(async () => {
        if (bank_id) { const it = (await getBank()).find(b => b.id === bank_id); if (!it || (it.kind !== "image" && it.kind !== "face")) throw new Error("That id isn't a picture in the Bank."); const b = await itemBytes(it); if (!b) throw new Error("That picture couldn't be read."); return { content: [{ type: "text" as const, text: it.title }, pic(b, typeOf(it.src!))] }; }
        if (!ep || !shot_id) throw new Error("Pass bank_id, or episode and shot_id.");
        const s = findShot(await getBoard(ep), shot_id); const t = s.takes.find(x => x.id === s.pick); if (!t) throw new Error("That shot has no picture yet.");
        const b = t.src.startsWith("/api/file/") ? (await readBytes(t.src.slice(10)))?.bytes : await itemBytes({ src: t.src } as never); if (!b) throw new Error("That picture couldn't be read.");
        return { content: [{ type: "text" as const, text: s.desc }, pic(b, typeOf(t.src))] }; }));
    server.registerTool("add_shot", { title: "Add a shot", description: "Hang a new shot on an episode's rail, at the end or at a 1-based position. Lines must be Kim's words exactly; anything else gets stamped Proposed.", inputSchema: z.object({ episode: Ep, ...SHOT, desc: z.string(), position: z.number().int().min(1).optional(), signed_by: Sign }) },
      ({ episode: ep, position, signed_by, ...s }) => guard(async () => { const shot = makeShot(ep, s, name(signed_by)); await changeBoard(ep, b => { const live = b.shots.filter(x => !x.archived); live.splice(position ? position - 1 : live.length, 0, shot); b.shots = [...live, ...b.shots.filter(x => x.archived)]; }); const p = shot.lines.filter(l => l.proposed); return `Added shot ${shot.id}.${p.length ? ` Stamped Proposed, not word for word in her script: ${p.map(l => l.text).join(" | ")}` : ""}`; }));
    server.registerTool("update_shot", { title: "Change a shot", description: "Change anything about a shot on the rail.", inputSchema: z.object({ episode: Ep, id: z.string(), ...SHOT }) },
      ({ episode: ep, id, ...patch }) => guard(async () => { const b = await changeBoard(ep, x => applyUpdate(ep, findShot(x, id), patch)); const p = findShot(b, id).lines.filter(l => l.proposed); return `Updated.${p.length ? ` Stamped Proposed: ${p.map(l => l.text).join(" | ")}` : ""}`; }));
    server.registerTool("move_shot", { title: "Move a shot", description: "Move a shot to a 1-based position on the rail.", inputSchema: z.object({ episode: Ep, id: z.string(), position: z.number().int().min(1) }) }, ({ episode: ep, id, position }) => guard(async () => { await changeBoard(ep, b => moveShot(b, id, position - 1)); return "Moved."; }));
    server.registerTool("remove_shot", { title: "Take a shot off the rail", description: "Takes a shot off the rail. It is kept and Kim can put it back on the site.", inputSchema: z.object({ episode: Ep, id: z.string() }) }, ({ episode: ep, id }) => guard(async () => { await changeBoard(ep, b => { findShot(b, id).archived = true; }); return "Off the rail, and kept."; }));
    server.registerTool("draw_shot", { title: "Draw a shot", description: "Draw a shot from the locked faces, the room and anything pinned to it. Up to about 2 minutes and 15 cents a take. Returns the pictures to show Kim. Set takes to 3 to give her choices. Ask before drawing unless she already said to.", inputSchema: z.object({ episode: Ep, id: z.string(), direction: z.string().optional().describe("A note for this take"), takes: z.number().int().min(1).max(3).optional(), signed_by: Sign }) },
      ({ episode: ep, id, direction, takes, signed_by }) => guard(async () => {
        const done = await Promise.allSettled(Array.from({ length: takes ?? 1 }, () => drawShot(ep, id, direction, name(signed_by))));
        const ok = done.flatMap(d => d.status === "fulfilled" ? [d.value] : []); const bad = done.flatMap(d => d.status === "rejected" ? [(d.reason as Error).message] : []);
        if (!ok.length) throw new Error(bad[0] ?? "The drawing failed. Try again.");
        return { content: ok.flatMap(o => [{ type: "text" as const, text: `Take ${o.take.id}` }, pic(o.bytes)]).concat([{ type: "text" as const, text: `${ok.length} on the rail: ${SITE}/e/${ep}. The newest is the pick; use pick_take to change it.${bad.length ? ` ${bad.length} failed: ${bad[0]}` : ""}` } as never]) }; }));
    server.registerTool("pick_take", { title: "Pick a take", description: "Choose which take a shot uses.", inputSchema: z.object({ episode: Ep, id: z.string(), take: z.string() }) }, ({ episode: ep, id, take }) => guard(async () => { await changeBoard(ep, b => { const s = findShot(b, id); if (!s.takes.some(t => t.id === take)) throw new Error("That shot has no such take."); s.pick = take; }); return "Picked."; }));
    server.registerTool("give_yes", { title: "Give Kim's yes", description: "Mark a shot with Kim's yes, or take it off. Only when Kim said so about this shot in this conversation. Never infer it.", inputSchema: z.object({ episode: Ep, id: z.string(), yes: z.boolean(), kim_said: z.string().describe("Kim's words, quoted") }) },
      ({ episode: ep, id, yes, kim_said }) => guard(async () => { if (who !== "Kim") throw new Error("Only Kim's own connection can give her yes."); await changeBoard(ep, b => { const s = findShot(b, id); if (s.status === "filmed") throw new Error("That shot is already in the cut."); s.status = yes ? "yes" : (s.takes.length ? "drawn" : "idea"); s.note = [s.note, yes ? `Kim's yes: "${kim_said.slice(0, 200)}"` : ""].filter(Boolean).join("\n"); }); return yes ? "Kim's yes is on it." : "Taken off."; }));
    server.registerTool("pin_to_shot", { title: "Pin from the Bank", description: "Pin Bank pictures, faces or sounds to a shot. Each list you pass replaces that shot's list. Pictures and faces feed the next drawing; sounds play in Play the board.", inputSchema: z.object({ episode: Ep, id: z.string(), pictures: z.array(z.string()).optional(), sounds: z.array(z.string()).optional() }) },
      ({ episode: ep, id, pictures, sounds }) => guard(async () => { const bank = await getBank(); for (const x of [...(pictures ?? []), ...(sounds ?? [])]) if (!bank.some(b => b.id === x)) throw new Error(`Nothing in the Bank has the id ${x}.`); await changeBoard(ep, b => applyUpdate(ep, findShot(b, id), { refs: pictures, sounds })); return "Pinned."; }));
    server.registerTool("add_note", { title: "Add a note", description: "Save a note to the Bank: an idea, a stage direction, a filled-in Recipe. Set episode when it belongs to one.", inputSchema: z.object({ title: z.string(), text: z.string(), episode: Ep.optional(), signed_by: Sign }) },
      ({ title, text: t, episode: ep, signed_by }) => guard(async () => { const n = await addItem({ kind: "note", title, text: t, ep, by: name(signed_by) }); return `Saved to the Bank as ${n.id}.`; }));
    server.registerTool("add_to_bank", { title: "Add a picture or sound", description: "Put a picture or sound into the Bank, from a public https link or base64. Under 4 MB. Pictures: JPEG, PNG, WebP. Sounds: MP3, M4A, WAV.", inputSchema: z.object({ title: z.string(), url: z.string().optional(), base64: z.string().optional(), content_type: z.string().optional().describe("Needed with base64, such as image/jpeg"), signed_by: Sign }) },
      ({ title, url, base64, content_type, signed_by }) => guard(async () => {
        let data: Buffer, type = content_type ?? "";
        if (url) { const f = await fetchPublic(url); data = f.data; type = f.type || type; }
        else if (base64) data = Buffer.from(base64, "base64"); else throw new Error("Pass a url or base64.");
        if (!/^(image\/(jpeg|png|webp)|audio\/(mpeg|mp3|mp4|x-m4a|m4a|wav|x-wav))$/.test(type)) throw new Error("The Bank takes JPEG, PNG or WebP pictures and MP3, M4A or WAV sounds.");
        if (data.length > 4.4e6) throw new Error("That file is over 4 MB.");
        const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav" } as Record<string, string>)[type] ?? "m4a";
        const it = await addItem({ kind: type.startsWith("image") ? "image" : "sound", title, src: await storeFile(`${title.slice(0, 30)}.${ext}`, data, type), by: name(signed_by) }); return `In the Bank as ${it.id}.`; }));
    server.registerTool("make_sound", { title: "Make a sound", description: "Generate a short sound effect into the Bank. Check read_bank first. Describe it concretely: ice falling into a plastic cup, close. About 8 cents.", inputSchema: z.object({ title: z.string(), description: z.string(), seconds: z.number().optional(), signed_by: Sign }) },
      ({ title, description, seconds, signed_by }) => guard(async () => { const s = await makeSoundItem(title, description, seconds, name(signed_by)); return `In the Bank as ${s.id}: ${s.title}. She can hear it at ${SITE}/bank.`; }));
    server.registerTool("make_face", { title: "Draw a face", description: "Draw one expression into a character's range in the Bank, from her locked face. Use Kim's words for the expression. Up to about 2 minutes and 15 cents. Returns the picture.", inputSchema: z.object({ who: z.enum(["pen", "maneater", "cherry-jane"]), expression: z.string(), signed_by: Sign }) },
      ({ who: w, expression, signed_by }) => guard(async () => { const { item, bytes } = await makeFace(w, expression, name(signed_by)); return { content: [{ type: "text" as const, text: `In the range as ${item.id}.` }, pic(bytes)] }; }));
    server.registerTool("list_looks", { title: "List looks", description: "Each character's current look and the options drawn so far, with ids.", inputSchema: z.object({}), annotations: READ },
      () => guard(async () => { const l = await getLooks(); return ["pen", "maneater", "cherry-jane"].map(w => { const a = activeLook(l, w); const o = l.looks.filter(x => x.who === w); return `${w}: ${a ? `current look ${a.id}: ${a.description}` : "the look locked Oct 26"}${o.length ? `\n  options: ${o.map(x => `${x.id} (${x.description.slice(0, 70)})`).join("; ")}` : ""}`; }).join("\n"); }));
    server.registerTool("draw_look", { title: "Draw a new look", description: "Draw options for changing how a character looks, from Kim's words. Up to about 2 minutes and 15 cents each. Returns the pictures to show her. It changes nothing until she chooses one. Leave keep_face off to let the face change too. A famous name gives only attitude and style, never that person's likeness. Pass pictures with Bank ids to use her references.", inputSchema: z.object({ who: z.enum(["pen", "maneater", "cherry-jane"]), description: z.string().describe("Kim's words"), keep_face: z.boolean().optional(), pictures: z.array(z.string()).optional(), options: z.number().int().min(1).max(3).optional(), signed_by: Sign }) },
      ({ who: w, description, keep_face, pictures, options, signed_by }) => guard(async () => {
        const done = await Promise.allSettled(Array.from({ length: options ?? 1 }, () => makeLook(w, description, !!keep_face, pictures ?? [], name(signed_by))));
        const ok = done.flatMap(d => d.status === "fulfilled" ? [d.value] : []); if (!ok.length) throw new Error(((done[0] as PromiseRejectedResult).reason as Error).message);
        return { content: [...ok.flatMap(o => [{ type: "text" as const, text: `Look ${o.look.id}` }, pic(o.bytes)]), { type: "text" as const, text: `Nothing changed yet. When Kim chooses one, call set_look. See them at ${SITE}/bank.` }] }; }));
    server.registerTool("set_look", { title: "Make it her look", description: "Make a drawn option a character's current look, or pass look_id \"locked\" to go back to the Oct 26 look. Every new drawing uses it from then on. Only when Kim chose it in this conversation. Reports which existing shots show the old look.", inputSchema: z.object({ who: z.enum(["pen", "maneater", "cherry-jane"]), look_id: z.string(), kim_said: z.string().describe("Kim's words, quoted") }) },
      ({ who: w, look_id, kim_said }) => guard(async () => { if (who !== "Kim") throw new Error("Only Kim's own connection can change a look."); const l = await setLook(w, look_id === "locked" ? null : look_id, name(), kim_said); const redo = (await Promise.all(episodes.map(async e => ({ n: e.n, c: shotsToRedo(l, w, await getBoard(e.n)).length })))).filter(x => x.c); return `Done. New drawings use this look.${redo.length ? ` Shots still showing the old look: ${redo.map(x => `Episode ${x.n}: ${x.c}`).join(", ")}. Redraw them; filmed clips get reshot on Joe's side.` : ""}`; }));
    server.registerTool("report_problem", { title: "Report a problem", description: "Tell Luna something isn't working. Use this instead of sending Kim to Joe.", inputSchema: z.object({ what: z.string().describe("What was tried and the exact error") }) }, ({ what }) => guard(async () => { await logProblem(what, "connector", who); return "Reported. Luna has it."; }));
  }, { serverInfo: { name: "bev-station-studio", version: "2.0.0" }, instructions: `Call start_here first: it holds the rules of this show and how to work. The writer's words are canon, so copy lines exactly. Only she gives a shot her yes.` });
}
async function handle(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const t = (await ctx.params).token;
  const who = t && t === process.env.KIM_TOKEN ? "Kim" : t && t === process.env.JOE_TOKEN ? "Joe" : null;
  if (!who) return new Response("Not found", { status: 404 });
  if (req.method === "GET" && !(req.headers.get("accept") ?? "").includes("text/event-stream"))
    return new Response(`This is the studio connector link. It's working.\n\nIt goes in Claude or ChatGPT, not a browser tab. The steps are at ${SITE}/connect\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  return handlerFor(who)(req);
}
export { handle as GET, handle as POST, handle as DELETE };
