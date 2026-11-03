import { promises as fs } from "fs";
import path from "path";
import type { Shot } from "./types";
import { NAMES } from "./types";
import { getBank, itemBytes } from "./bank";
import { assertDrawable, dataUri, editImage, generateImage } from "./image";
import { activeLook, getLooks, lookBytes, type Looks } from "./looks";
const dataFile = (...p: string[]) => path.join(process.cwd(), "data", ...p);
const LOOK: Record<string, string> = { pen: "pen-LOCKED.md", maneater: "maneater-LOCKED.md", "cherry-jane": "cherry-jane-LOCKED.md" };
const REF: Record<string, string[]> = {
  pen: ["pen-face-LOCKED.jpg", "pen-reference-LOCKED.jpg"],
  maneater: ["maneater-face-LOCKED.jpg", "maneater-reference-LOCKED-front.jpg"],
  "cherry-jane": ["cherry-jane-face-LOCKED.jpg", "cherry-jane-reference-LOCKED.jpg"],
};
const ROOM: Record<string, string> = { "no-mans-land": "no-mans-land.jpg", "bev-station": "no-mans-land.jpg", silverware: "silverware.jpg", pos: "pos.jpg" };
const stripFront = (s: string) => s.replace(/^---[\s\S]*?---\s*/, "");
type Ref = { file: string; label: string; bytes?: Buffer };
export async function refsFor(shot: Shot, looks?: Looks): Promise<Ref[]> {
  const l = looks ?? await getLooks(); const out: Ref[] = [];
  const room = shot.place && ROOM[shot.place];
  if (room) out.push({ file: dataFile("rooms", room), label: `the room: ${room.replace(".jpg", "").replace(/-/g, " ")}. Keep this place, its practical light and its color` });
  for (const c of shot.cast) {
    const look = activeLook(l, c); const bytes = look && await lookBytes(look);
    if (look && bytes) { out.push({ file: "", bytes, label: `${NAMES[c]}'s current look. Keep her exact face and look from this picture` }); continue; }
    (REF[c] ?? []).forEach((f, i) => out.push({ file: dataFile("refs", f), label: `${NAMES[c]}'s locked ${i ? "look, full body" : "face"}. Keep exactly` }));
  }
  if (shot.cast.includes("maneater") && !activeLook(l, "maneater") && /\b(back|tattoo|tramp|turns away|lower back)\b/i.test(shot.desc)) out.push({ file: dataFile("refs", "maneater-reference-LOCKED-back.jpg"), label: "Maneater from behind, with her tattoo and the K" });
  return out.slice(0, 8);
}
// The character's notes: the locked ones, with Kim's current change on top and winning.
export async function lookNotes(who: string, looks?: Looks): Promise<string> {
  const base = LOOK[who] ? stripFront(await fs.readFile(dataFile(LOOK[who]), "utf8")) : "";
  const a = activeLook(looks ?? await getLooks(), who);
  return a ? `Kim changed this character's look: ${a.description}\nWhere this disagrees with the older notes below, this wins. Follow the current look picture.\n\n${base}` : base;
}
export async function promptFor(shot: Shot, refs: Ref[], direction?: string): Promise<string> {
  const l = await getLooks(); const looks = await Promise.all(shot.cast.filter(c => LOOK[c]).map(c => lookNotes(c, l)));
  const setting = stripFront(await fs.readFile(dataFile("setting-LOCKED.md"), "utf8"));
  return [
    "Using the people and the room from the reference pictures, make one photoreal vertical film still from a single-camera workplace comedy set in a suburban bar-and-grill. No cartoons. Natural restaurant light, shot on a real camera, shallow depth of field, natural skin texture with visible pores, fine film grain.",
    refs.length ? `The reference pictures show ${refs.map(r => r.label).join("; ")}.` : "",
    "People are caught mid-action, not posing for the camera. Keep each person's exact face, hair, wardrobe and marks from their reference pictures and look notes. Keep the exact room and its light from the room picture. Nobody in the picture who is not in the shot.",
    `What we see: ${shot.desc}`,
    shot.camera ? `Camera: ${shot.camera}` : "",
    direction ? `Change for this take: ${direction}` : "",
    "No captions, subtitles, logos or watermarks. The only readable words are ones the shot calls for, such as the PENELOPE name tag. Clothed and non-sexual: an ordinary shift at work.",
    looks.length ? `Look notes:\n${looks.join("\n\n")}` : "",
    `The place:\n${setting.slice(0, 1500)}`,
  ].filter(Boolean).join("\n\n");
}
// Pictures go through lib/image.ts: GPT Image 2.5 on Atlas.
export async function drawImage(shot: Shot, direction?: string): Promise<Buffer> {
  assertDrawable(shot.desc, shot.camera, direction);
  const refs = await refsFor(shot);
  const list = refs.length ? refs : [{ file: dataFile("rooms", "no-mans-land.jpg"), label: "the room. Keep this place, its practical light and its color" }];
  const images = await Promise.all(list.map(async r => dataUri(r.bytes ?? await fs.readFile(r.file))));
  const labels: Ref[] = [...list];
  // Whatever Kim pinned to this shot from the Bank: her picture selections and faces.
  if (shot.refs?.length) {
    const bank = await getBank();
    for (const id of shot.refs.slice(0, 5)) { const it = bank.find(b => b.id === id); if (!it || (it.kind !== "image" && it.kind !== "face")) continue; const bytes = await itemBytes(it); if (!bytes) continue;
      const ext = it.src?.split(".").pop()?.toLowerCase(); images.push(dataUri(bytes, ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg"));
      labels.push({ file: "", label: it.kind === "face" ? `${it.title}. Use this expression for that person` : `a reference Kim chose: ${it.title}` }); }
  }
  return editImage(await promptFor(shot, labels, direction), images);
}
export async function drawFace(who: string, expression: string): Promise<Buffer> {
  const [face, body] = REF[who] ?? []; if (!face) throw new Error("There are no locked pictures for that character.");
  assertDrawable(expression);
  const l = await getLooks(); const a = activeLook(l, who); const cur = a && await lookBytes(a);
  const prompt = `Using this woman from the reference pictures, make one photoreal vertical portrait still from a workplace comedy, head and shoulders. Change only her expression: ${expression}. Keep her exact face, hair, glasses, marks and wardrobe. Natural skin texture with visible pores, fine film grain. It should read clearly at phone size and feel caught, not posed. Plain restaurant background, soft focus, warm practical light. No text except a name tag if she wears one. Clothed and non-sexual.\n\nLook notes:\n${await lookNotes(who, l)}`;
  return editImage(prompt, cur ? [dataUri(cur)] : [dataUri(await fs.readFile(dataFile("refs", face))), dataUri(await fs.readFile(dataFile("refs", body)))]);
}
// A new look for a character. Unless she asks to keep the face, the old face and build leave the
// prompt entirely: the earlier notes were overruling her words.
export async function drawLookImage(who: string, description: string, keepFace: boolean, pictures: string[]): Promise<Buffer> {
  if (!LOOK[who]) throw new Error("That character has no look to change.");
  assertDrawable(description);
  const all = stripFront(await fs.readFile(dataFile(LOOK[who]), "utf8"));
  const notes = keepFace ? all : all.split("\n").filter(l => !/^\s*(#|\*\*(Face|Build|Age|Height|Likeness|Face reference|References?|Reference of record)\b|- \*\*(Show style|Age shown|Age|Height|Build|Face|Likeness|Never frazzles)\b|Every )/i.test(l)).join("\n");
  const prompt = [
    `Make one photoreal vertical full-body character reference picture of ${NAMES[who]}, a fictional server in a workplace comedy, standing in a worn, clean suburban bar-and-grill with warm practical light. One person, one front view, whole body and face clearly visible. Natural skin texture with visible pores, fine film grain. No writing on her clothes or body beyond what her notes call for.`,
    `What Kim wants now, and this wins over everything else: ${description}`,
    `Show it plainly in her body and face, not only her clothes. If Kim says hardened or tougher, make her visibly lived-in: lean muscle, strong jaw and cheekbones, real lines around the eyes and mouth, an older and more weathered face than a girl in her twenties.`,
    "She is an original fictional person. If a real or famous person is named, take only the attitude and style, never that person's face or likeness. Clothed and non-sexual: an ordinary shift at work.",
    keepFace ? "Keep her recognizably the same woman as the face reference, changed as asked." : "Her face, build and age can change as much as Kim's words call for.",
    `The rest of her from the earlier notes, for anything Kim's words don't change:\n${notes}`,
  ].join("\n\n");
  const images: string[] = [];
  if (keepFace) { const a2 = activeLook(await getLooks(), who); const cur = a2 && await lookBytes(a2); images.push(dataUri(cur ?? await fs.readFile(dataFile("refs", REF[who][0])))); }
  if (pictures.length) { const bank = await getBank(); for (const id of pictures.slice(0, 5)) { const it = bank.find(b => b.id === id); if (!it || (it.kind !== "image" && it.kind !== "face")) throw new Error(`Nothing usable in the Bank has the id ${id}.`); const b = await itemBytes(it); if (b) images.push(dataUri(b, it.src?.endsWith(".png") ? "image/png" : "image/jpeg")); } }
  return images.length ? editImage(prompt, images) : generateImage(prompt);
}
export const DRAW_COST = 0.15;
