import { mutateJSON } from "./store";
export type Problem = { id: string; what: string; where?: string; by: string; at: string; auto?: boolean };
// Everything that goes wrong lands here for Luna's side to pick up, so nobody has to chase Joe.
export async function logProblem(what: string, where: string, by: string, auto = false) {
  await mutateJSON<Problem[]>("problems.json", () => [], l => { l.push({ id: Math.random().toString(36).slice(2, 10), what: what.slice(0, 2000), where, by, at: new Date().toISOString(), auto }); if (l.length > 300) l.splice(0, l.length - 300); });
}
// Her typos and empty fields aren't problems; a service failing is.
// For failures already on their way to the person: a logging hiccup must not hide the first error.
export const logQuietly = (what: string, where: string, by: string) => logProblem(what, where, by, true).catch(() => {});
export const isServiceFailure = (m: string) => /service said|did not download|no picture|not switched on|credit|balance|exhausted|quota|fetch failed|ECONN|timeout|overloaded/i.test(m);
