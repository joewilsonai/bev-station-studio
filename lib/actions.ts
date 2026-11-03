import { changeBoard, findShot, getBoard, newId } from "./board";
import { addItem, storeFile } from "./bank";
import { reserve, settle } from "./budget";
import { DRAW_COST, drawFace, drawImage, drawLookImage } from "./draw";
import { addLook } from "./looks";
import { writeBytes } from "./store";
import { NAMES, type Take } from "./types";
export const IMG = { ext: "jpg", type: "image/jpeg" };
// One place for what costs money, so the site and the agents obey the same cap.
export async function drawShot(ep: number, id: string, direction: string | undefined, by: string): Promise<{ take: Take; bytes: Buffer }> {
  const shot = findShot(await getBoard(ep), id);
  if (!shot.desc.trim()) throw new Error("Describe the shot first, then draw it.");
  const startedAt = new Date().toISOString(); // a take started before a look change still shows the old look
  const what = `draw e${ep} ${id}`; await reserve(what, DRAW_COST, by);
  let bytes: Buffer;
  try { bytes = await drawImage(shot, direction); } catch (e) { await settle(what, DRAW_COST, 0, by); throw e; }
  const takeId = newId(); const file = `takes/e${String(ep).padStart(2, "0")}/${id}-${takeId}.${IMG.ext}`;
  await writeBytes(file, bytes, IMG.type);
  const take: Take = { id: takeId, src: `/api/file/${file}`, by, at: new Date().toISOString(), startedAt, direction };
  await changeBoard(ep, b => { const s = findShot(b, id); s.takes.push(take); s.pick = takeId; if (s.status === "idea") s.status = "drawn"; });
  return { take, bytes };
}
export async function makeFace(who: string, expression: string, by: string) {
  if (!NAMES[who] || !expression.trim()) throw new Error("Say whose face and what it's doing.");
  await reserve(`face ${who}`, DRAW_COST, by);
  let bytes: Buffer;
  try { bytes = await drawFace(who, expression); } catch (e) { await settle("face", DRAW_COST, 0, by); throw e; }
  const src = await storeFile(`${who}-face.${IMG.ext}`, bytes, IMG.type);
  return { item: await addItem({ kind: "face", who, title: `${NAMES[who]}: ${expression}`, text: expression, src, by }), bytes };
}
export async function makeLook(who: string, description: string, keepFace: boolean, pictures: string[], by: string) {
  if (!NAMES[who] || !description.trim()) throw new Error("Say whose look and what you want.");
  await reserve(`look ${who}`, DRAW_COST, by);
  let bytes: Buffer;
  try { bytes = await drawLookImage(who, description, keepFace, pictures); } catch (e) { await settle("look", DRAW_COST, 0, by); throw e; }
  return { look: await addLook(who, bytes, description, by), bytes };
}
