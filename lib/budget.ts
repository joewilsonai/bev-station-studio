import { mutateJSON } from "./store";
export const DAILY_CAP = Number(process.env.STUDIO_DAILY_CAP_USD ?? 5);
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
type Ledger = { spent: number; items: { what: string; usd: number; by: string; at: string }[] };
const round = (n: number) => Math.round(n * 10000) / 10000;
export class OverBudget extends Error {}
const file = () => `ledger/${day()}.json`;
// Money is held before a paid call starts, so simultaneous calls can't pass the cap together.
export async function reserve(what: string, usd: number, by: string) {
  await mutateJSON<Ledger>(file(), () => ({ spent: 0, items: [] }), l => {
    if (l.spent + usd > DAILY_CAP) throw new OverBudget(`Today's studio budget of $${DAILY_CAP} is used up. It resets at midnight Central, or Joe can raise it.`);
    l.spent = round(l.spent + usd); l.items.push({ what, usd, by, at: new Date().toISOString() });
  });
}
// After the call: replace what was held with what it really cost (0 when it failed).
export async function settle(what: string, held: number, actual: number, by: string) {
  await mutateJSON<Ledger>(file(), () => ({ spent: 0, items: [] }), l => {
    const d = round(actual - held); l.spent = round(Math.max(0, l.spent + d)); l.items.push({ what: `${what} settled`, usd: d, by, at: new Date().toISOString() });
  }).catch(() => {});
}
