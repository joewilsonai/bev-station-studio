import { mutateJSON, readBytes, readJSON } from "./store";
import { storeFile } from "./bank";
import type { Board, Who } from "./types";
export type Look = { id: string; who: string; src: string; description: string; by: string; at: string };
export type Looks = { looks: Look[]; current: Record<string, { id: string; setAt: string; by: string; said?: string } | undefined> };
const FILE = "looks.json";
const empty = (): Looks => ({ looks: [], current: {} });
export const getLooks = async (): Promise<Looks> => (await readJSON<Looks>(FILE))?.value ?? empty();
export function activeLook(l: Looks, who: string): Look | null {
  const c = l.current[who]; return (c && l.looks.find(x => x.id === c.id)) || null;
}
export async function lookBytes(look: Look): Promise<Buffer | null> {
  return (await readBytes(look.src.replace("/api/file/", "")))?.bytes ?? null;
}
export async function addLook(who: string, bytes: Buffer, description: string, by: string): Promise<Look> {
  const look: Look = { id: Math.random().toString(36).slice(2, 10), who, src: await storeFile(`${who}-look.jpg`, bytes, "image/jpeg"), description, by, at: new Date().toISOString() };
  await mutateJSON<Looks>(FILE, empty, l => { l.looks.push(look); });
  return look;
}
// lookId null means back to the look locked Oct 26.
export async function setLook(who: string, lookId: string | null, by: string, said?: string) {
  return mutateJSON<Looks>(FILE, empty, l => {
    if (lookId === null) { l.current[who] = { id: "locked", setAt: new Date().toISOString(), by, said }; return; }
    if (!l.looks.some(x => x.id === lookId && x.who === who)) throw new Error("That look isn't one of hers.");
    l.current[who] = { id: lookId, setAt: new Date().toISOString(), by, said };
  });
}
// Shots still showing an earlier look, so she can see what needs redrawing or reshooting.
export function shotsToRedo(l: Looks, who: string, b: Board) {
  const c = l.current[who]; if (!c) return [];
  return b.shots.filter(s => !s.archived && s.cast.includes(who as Who) && s.takes.length > 0).filter(s => { const t = s.takes.find(x => x.id === s.pick) ?? s.takes[s.takes.length - 1]; return (s.status === "filmed" && c.id !== "locked") || (s.status !== "filmed" && (t.startedAt ?? t.at) < c.setAt); });
}
