"use client";
import { useState } from "react";
export default function RecipeClient({ initial }: { initial: string }) {
  const [t, setT] = useState(initial); const [state, setState] = useState("");
  const save = async () => { setState("Saving…"); const r = await fetch("/api/recipe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) }); setState(r.ok ? "Saved" : "That did not save. Try again."); };
  return <>
    <textarea className="recipe" aria-label="The Recipe" value={t} onChange={e => { setT(e.target.value); setState(""); }} />
    <p style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button className="btn main" onClick={save}>Save the Recipe</button><button className="btn" onClick={async () => { await navigator.clipboard.writeText(t); setState("Copied"); }}>Copy it</button><span role="status">{state}</span></p>
  </>;
}
