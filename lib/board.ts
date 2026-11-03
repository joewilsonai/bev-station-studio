import { mutateJSON, readJSON } from "./store";
import { episode } from "./episodes";
import { inScript } from "./canon";
import type { Board, Line, Shot, Who } from "./types";
import seedE1 from "@/data/seed-e01.json";
import seedE2 from "@/data/seed-e02.json";
const SEEDS: Record<number, unknown[]> = { 1: seedE1, 2: seedE2 };
const pathFor = (ep: number) => `boards/e${String(ep).padStart(2, "0")}.json`;
export const newId = () => Math.random().toString(36).slice(2, 10);
function seed(ep: number): Board {
  return { ep, updatedAt: new Date().toISOString(), shots: (SEEDS[ep] ?? []) as Shot[] };
}
export async function getBoard(ep: number): Promise<Board> {
  return (await readJSON<Board>(pathFor(ep)))?.value ?? seed(ep);
}
export function stampLines(ep: number, lines: Line[] = []): Line[] {
  const script = episode(ep)?.script ?? "";
  return lines.map(l => ({ ...l, proposed: !inScript(l.text, script) }));
}
export type ShotInput = Partial<Pick<Shot, "panel" | "desc" | "camera" | "place" | "seconds" | "note">> & { cast?: Who[]; lines?: Line[]; refs?: string[]; sounds?: string[] };
export function makeShot(ep: number, s: ShotInput, by: string): Shot {
  return { id: newId(), panel: s.panel, desc: s.desc ?? "", camera: s.camera, place: s.place, cast: s.cast ?? [],
    lines: stampLines(ep, s.lines), seconds: s.seconds ?? 5, note: s.note, refs: s.refs, sounds: s.sounds, status: "idea", takes: [], by, at: new Date().toISOString() };
}
export async function changeBoard(ep: number, fn: (b: Board) => void): Promise<Board> {
  return mutateJSON<Board>(pathFor(ep), () => seed(ep), b => { fn(b); b.updatedAt = new Date().toISOString(); return b; });
}
export function findShot(b: Board, id: string): Shot {
  const s = b.shots.find(x => x.id === id);
  if (!s) throw new Error("That shot is no longer on this board.");
  return s;
}
export function applyUpdate(ep: number, s: Shot, patch: ShotInput) {
  for (const k of ["panel", "desc", "camera", "place", "note"] as const) if (patch[k] !== undefined) s[k] = patch[k];
  if (patch.seconds !== undefined) s.seconds = Math.max(1, Math.min(60, Number(patch.seconds) || 5));
  if (patch.cast) s.cast = patch.cast;
  if (patch.refs) s.refs = patch.refs;
  if (patch.sounds) s.sounds = patch.sounds;
  if (patch.lines) s.lines = stampLines(ep, patch.lines);
}
export function moveShot(b: Board, id: string, to: number) {
  const live = b.shots.filter(s => !s.archived);
  const from = live.findIndex(s => s.id === id);
  if (from < 0) throw new Error("That shot is no longer on this board.");
  const [m] = live.splice(from, 1);
  live.splice(Math.max(0, Math.min(live.length, to)), 0, m);
  b.shots = [...live, ...b.shots.filter(s => s.archived)];
}
