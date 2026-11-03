import { changeBank } from "./bank";
import { changeBoard, findShot } from "./board";
import { restoreOrder, undoFields, type FieldChange } from "./diff";
import { getChange } from "./history";
import { setLook } from "./looks";
import { setRecipe } from "./bank";
import { actor } from "./actor";
const val = (c: FieldChange[], f: string) => c.find(x => x.field === f)?.before;
export async function undoChange(id: string): Promise<string> {
  const c = /^\d{4}-\d{2}-\d{2}T[\w-]+$/.test(id) ? await getChange(id) : null;
  if (!c) throw new Error("That change isn't in the log.");
  if (c.kind === "shot") {
    await changeBoard(c.ep!, b => { const s = findShot(b, c.target!); if (c.created) s.archived = true; else undoFields(s, c.changes); }, c.id);
    return c.created ? "That shot is off the rail, and kept." : "Put back.";
  }
  if (c.kind === "order") {
    const order = val(c.changes, "order") as string[];
    await changeBoard(c.ep!, b => { b.shots = [...restoreOrder(b.shots.filter(s => !s.archived), order), ...b.shots.filter(s => s.archived)]; }, c.id);
    return "The old order is back.";
  }
  if (c.kind === "bank") {
    await changeBank(items => { const i = items.find(x => x.id === c.target) as unknown as Record<string, unknown> | undefined; if (!i) throw new Error("That item is gone."); if (c.created) i.archived = true; else for (const f of c.changes) { if (f.before === null) delete i[f.field]; else i[f.field] = f.before; } }, c.id);
    return c.created ? "Taken out of the Bank, and kept." : "Put back.";
  }
  if (c.kind === "recipe") { await setRecipe(String(val(c.changes, "text")), actor(), c.id); return "The Recipe is back as it was."; }
  if (c.kind === "look") { const v = val(c.changes, "look") as string | null; if (!actor().startsWith("Kim")) throw new Error("Only Kim can change a look."); await setLook(c.target!, v === "locked" ? null : v, actor(), undefined, c.id); return "Her look is back as it was."; }
  throw new Error("That change can't be undone.");
}
