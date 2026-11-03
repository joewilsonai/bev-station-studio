import { listPaths, readJSON, writeBytes } from "./store";
import { actor } from "./actor";
import { liveOrder, shotChanges, type FieldChange } from "./diff";
import type { Board } from "./types";
export type Kind = "shot" | "order" | "bank" | "recipe" | "look";
export type Change = { id: string; at: string; by: string; kind: Kind; ep?: number; target?: string; title: string; changes: FieldChange[]; created?: boolean; undoOf?: string };
// Append-only: one object per change, never rewritten. A failed log line never loses the save itself.
export async function logChange(c: Omit<Change, "id" | "at" | "by"> & { by?: string }) {
  const at = new Date().toISOString(); const id = `${at.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: Change = { ...c, id, at, by: c.by ?? actor() };
  try { await writeBytes(`log/${at.slice(0, 10)}/${id}.json`, JSON.stringify(entry), "application/json", { createOnly: true }); }
  catch (e) { console.error("change log failed", (e as Error).message); }
  return entry;
}
export async function logBoard(ep: number, before: Board, after: Board, undoOf?: string) {
  const prior = new Map(before.shots.map(s => [s.id, s]));
  const writes: Promise<unknown>[] = [];
  for (const s of after.shots) {
    const ch = shotChanges(prior.get(s.id), s); if (!ch.length) continue;
    const created = !prior.has(s.id);
    writes.push(logChange({ kind: "shot", ep, target: s.id, title: created ? `New shot: ${s.desc.slice(0, 70) || "empty"}` : `Shot: ${s.desc.slice(0, 70) || s.id}`, changes: created ? [] : ch, created, undoOf }));
  }
  const a = liveOrder(before), b = liveOrder(after);
  if (a.length === b.length && a.join() !== b.join()) writes.push(logChange({ kind: "order", ep, title: "Shots reordered", changes: [{ field: "order", before: a, after: b }], undoOf }));
  await Promise.all(writes);
}
export async function recentChanges(limit = 150): Promise<Change[]> {
  const paths = (await listPaths("log/")).sort().reverse().slice(0, limit);
  const got = await Promise.all(paths.map(p => readJSON<Change>(p).catch(() => null)));
  return got.flatMap(g => g ? [g.value] : []);
}
export const getChange = async (id: string) => (await readJSON<Change>(`log/${id.slice(0, 10)}/${id}.json`))?.value ?? null;
