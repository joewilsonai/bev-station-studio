"use client";
import { useState } from "react";
export function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return <div className="copybox"><code className="copyurl">{text}</code><button className="btn main" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2500); }}>{done ? "Copied" : label}</button></div>;
}
export function Trouble({ where }: { where: string }) {
  const [open, setOpen] = useState(false); const [t, setT] = useState(""); const [state, setState] = useState("");
  const send = async () => { setState("Sending…"); try { const r = await fetch("/api/problem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ what: t, where }) }); if (r.ok) { setState("Sent. Luna has it."); setT(""); setOpen(false); } else setState("That did not send. Try again."); } catch { setState("That did not send. Check your connection and try again."); } };
  return <div className="trouble">
    {!open && <button className="link" onClick={() => { setOpen(true); setState(""); }}>Something&apos;s not working, or I need something new</button>}
    {open && <><label>Tell Luna what you need, or what you tried and what happened.<textarea value={t} onChange={e => setT(e.target.value)} /></label><p><button className="btn main" disabled={!t.trim()} onClick={send}>Send it to Luna</button> <button className="link" onClick={() => setOpen(false)}>Never mind</button></p></>}
    {state && <p role="status">{state}</p>}
  </div>;
}
