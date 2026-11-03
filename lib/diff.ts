import type { Board, Line, Shot } from "./types";
export type FieldChange = { field: string; before: unknown; after: unknown };
const FIELDS: (keyof Shot)[] = ["panel", "desc", "camera", "place", "cast", "lines", "seconds", "note", "status", "pick", "archived", "refs", "sounds", "clip"];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function shotChanges(before: Shot | undefined, after: Shot): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of FIELDS) if (!same(before?.[f], after[f])) out.push({ field: f, before: before?.[f] ?? null, after: after[f] ?? null });
  const b = before?.takes.length ?? 0; if (after.takes.length !== b) out.push({ field: "takes", before: b, after: after.takes.length });
  return out;
}
export const liveOrder = (b: Board) => b.shots.filter(s => !s.archived).map(s => s.id);
const LABEL: Record<string, string> = { desc: "what we see", camera: "camera", place: "where", cast: "who's in it", lines: "lines", seconds: "seconds", note: "notes", status: "status", pick: "chosen take", archived: "on the rail", refs: "pinned pictures", sounds: "pinned sounds", panel: "scene", takes: "takes", clip: "clip" };
export const fieldLabel = (f: string) => LABEL[f] ?? f;
export function showValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (field === "lines") return (v as Line[]).map(l => `${l.name ?? l.who}: ${l.text}`).join(" / ") || "(none)";
  if (field === "archived") return v ? "off the rail" : "on the rail";
  if (Array.isArray(v)) return v.join(", ") || "(none)";
  return String(v);
}
// Undo only touches what this change touched, so later edits to other fields survive. Takes are never removed.
export function undoFields(s: Shot, changes: FieldChange[]) {
  const t = s as unknown as Record<string, unknown>;
  for (const c of changes) { if (c.field === "takes") continue; if (c.before === null) delete t[c.field]; else t[c.field] = c.before; }
}
// Puts the shots that were in the old order back in it, and leaves shots added since where they are.
export function restoreOrder<T extends { id: string }>(live: T[], order: string[]): T[] {
  const known = order.flatMap(id => live.filter(s => s.id === id)); let i = 0;
  return live.map(s => order.includes(s.id) ? known[i++] : s);
}
