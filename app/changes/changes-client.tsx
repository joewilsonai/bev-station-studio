"use client";
import Link from "next/link";
import { useState } from "react";
import { fieldLabel, showValue } from "@/lib/diff";
import type { Change } from "@/lib/history";
const when = (s: string) => new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export default function ChangesClient({ initial }: { initial: Change[] }) {
  const [items, setItems] = useState(initial); const [state, setState] = useState<Record<string, string>>({}); const [who, setWho] = useState("");
  const people = [...new Set(items.map(i => i.by))];
  const undo = async (id: string) => {
    setState(s => ({ ...s, [id]: "Undoing…" }));
    const r = await fetch("/api/changes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null); const j = await r?.json().catch(() => null);
    setState(s => ({ ...s, [id]: j?.message ?? j?.error ?? "That did not work. Try again." }));
    const f = await fetch("/api/changes").catch(() => null); if (f?.ok) setItems(await f.json());
  };
  const shown = who ? items.filter(i => i.by === who) : items;
  if (!items.length) return <p>Nothing has changed yet.</p>;
  return <>
    {people.length > 1 && <p><select aria-label="Whose changes" className="whofilter" value={who} onChange={e => setWho(e.target.value)}><option value="">Everyone</option>{people.map(p => <option key={p}>{p}</option>)}</select></p>}
    <ol className="changes">{shown.map(c => <li key={c.id} className="change">
      <div className="change-head"><b>{c.undoOf ? `Undo: ${c.title}` : c.title}</b><small>{c.by}, {when(c.at)}{c.ep ? <>, <Link href={`/e/${c.ep}`}>Episode {c.ep}</Link></> : null}</small></div>
      {c.changes.filter(f => f.field !== "order").map(f => <p key={f.field} className="change-field"><span>{fieldLabel(f.field)}</span> <del>{showValue(f.field, f.before)}</del> <ins>{showValue(f.field, f.after)}</ins></p>)}
      <p className="change-do">{state[c.id] ? <span role="status">{state[c.id]}</span> : <button className="link" onClick={() => undo(c.id)}>Undo this</button>}</p>
    </li>)}</ol>
  </>;
}
