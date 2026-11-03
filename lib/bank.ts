import { promises as fs } from "fs";
import path from "path";
import { mutateJSON, readBytes, readJSON, writeBytes } from "./store";
import { logChange } from "./history";
import seed from "@/data/seed-bank.json";
export type Kind = "image" | "sound" | "note" | "face";
export type BankItem = { id: string; kind: Kind; title: string; text?: string; src?: string; who?: string; ep?: number; tags?: string[]; by: string; at: string; archived?: boolean };
const FILE = "bank.json";
export const getBank = async (): Promise<BankItem[]> => (await readJSON<BankItem[]>(FILE))?.value ?? (seed as BankItem[]);
export async function changeBank(fn: (b: BankItem[]) => void, undoOf?: string): Promise<BankItem[]> {
  let before: BankItem[] = [];
  const after = await mutateJSON<BankItem[]>(FILE, () => [...(seed as BankItem[])], b => { before = JSON.parse(JSON.stringify(b)); fn(b); return b; });
  const prior = new Map(before.map(i => [i.id, i]));
  await Promise.all(after.flatMap(i => {
    const p = prior.get(i.id);
    if (!p) return [logChange({ kind: "bank", target: i.id, created: true, title: `Added to the Bank: ${i.title}`, changes: [], undoOf })];
    const ch = (["title", "text", "ep", "archived"] as const).filter(f => JSON.stringify(p[f] ?? null) !== JSON.stringify(i[f] ?? null)).map(f => ({ field: f, before: p[f] ?? null, after: i[f] ?? null }));
    return ch.length ? [logChange({ kind: "bank", target: i.id, title: `Bank: ${i.title}`, changes: ch, undoOf })] : [];
  }));
  return after;
}
export const bankId = () => Math.random().toString(36).slice(2, 10);
export async function addItem(item: Omit<BankItem, "id" | "at">): Promise<BankItem> {
  const full: BankItem = { ...item, id: bankId(), at: new Date().toISOString() };
  await changeBank(b => { b.push(full); });
  return full;
}
export async function storeFile(name: string, data: Buffer, type: string) {
  const p = `bank/${bankId()}-${name.replace(/[^a-z0-9.]+/gi, "-").toLowerCase().slice(-48)}`;
  await writeBytes(p, data, type);
  return `/api/file/${p}`;
}
// The bytes of a bank picture, whether it was uploaded or came with the studio.
export async function itemBytes(item: BankItem): Promise<Buffer | null> {
  if (!item.src) return null;
  if (item.src.startsWith("/api/file/")) return (await readBytes(item.src.slice("/api/file/".length)))?.bytes ?? null;
  return fs.readFile(path.join(process.cwd(), "public", item.src)).catch(() => null);
}
export async function getRecipe(): Promise<string> {
  return (await readJSON<{ text: string }>("recipe.json"))?.value.text ?? fs.readFile(path.join(process.cwd(), "data", "recipe-seed.md"), "utf8");
}
export async function setRecipe(text: string, by: string, undoOf?: string) {
  const seedText = await getRecipe(); let before = seedText;
  await mutateJSON<{ text: string; by?: string; at?: string }>("recipe.json", () => ({ text: seedText }), r => { before = r.text; r.text = text; r.by = by; r.at = new Date().toISOString(); });
  if (before !== text) await logChange({ kind: "recipe", title: "The Recipe", changes: [{ field: "text", before, after: text }], by, undoOf });
}
export function bankSummary(items: BankItem[]): string {
  return items.filter(i => !i.archived).map(i => `${i.id} [${i.kind}${i.who ? ` ${i.who}` : ""}${i.ep ? ` ep${i.ep}` : ""}] ${i.title}${i.text ? `: ${i.text}` : ""}`).join("\n") || "(empty)";
}
