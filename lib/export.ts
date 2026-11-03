import show from "@/data/show.json";
import type { Board } from "./types";
export function toPanelByPanel(e: { n: number; title: string }, b: Board, names: Record<string, string>): string {
  const live = b.shots.filter(s => !s.archived);
  const cast = [...new Set(live.flatMap(s => s.cast))].filter(c => names[c]);
  const looks: Record<string, string> = show.look_notes;
  const out = [`TITLE: ${show.title}, Episode ${e.n}: ${e.title}`, `BY: ${show.author}`, `STYLE: ${show.site_style}`, "", "CAST", ...cast.map(c => `${names[c]} = ${looks[c] ?? ""}`), ""];
  live.forEach((s, i) => {
    if (i % 4 === 0) out.push("PAGE");
    out.push(`PANEL: ${s.desc.replace(/\s+/g, " ")}`);
    if (s.camera) out.push(`SHOT: ${s.camera}`);
    for (const l of s.lines) out.push(`${names[l.who] ?? l.name ?? "Voice"}${l.kind === "thought" ? " (thinks)" : ""}: ${l.text.replace(/\s+/g, " ").trim()}`);
    if (s.note) out.push(`NOTE: ${s.note.replace(/\s+/g, " ")}`);
    out.push("");
  });
  return out.join("\n");
}
