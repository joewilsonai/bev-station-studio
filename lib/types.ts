export type Who = "pen" | "maneater" | "cherry-jane" | "other";
export type Line = { who: Who; name?: string; kind: "aloud" | "thought"; text: string; proposed?: boolean; voice?: string };
export type Take = { id: string; src: string; by: string; at: string; startedAt?: string; direction?: string };
export type Status = "idea" | "drawn" | "yes" | "filmed";
export type Shot = {
  id: string; panel?: string; desc: string; camera?: string; place?: string;
  cast: Who[]; lines: Line[]; seconds: number; note?: string; status: Status;
  takes: Take[]; pick?: string; refs?: string[]; sounds?: string[]; archived?: boolean; by: string; at: string; clip?: string;
};
export type Board = { ep: number; shots: Shot[]; updatedAt: string };
export type ChatMsg = { role: "user" | "assistant"; by: string; text: string; at: string };
export const PLACES: Record<string, string> = {
  "no-mans-land": "No Man's Land", "bev-station": "Bev Station", silverware: "Silverware", pos: "The POS",
  dock: "The dock", floor: "The dining room", door: "Front door",
};
export const NAMES: Record<string, string> = { pen: "Pen", maneater: "Maneater", "cherry-jane": "Cherry Jane" };
