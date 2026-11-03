"use client";
import { useEffect, useRef, useState } from "react";
import type { BankItem } from "@/lib/bank";
import type { Looks } from "@/lib/looks";
import { Trouble } from "../connect/parts";
const CAST: [string, string][] = [["pen", "Pen"], ["maneater", "Maneater"], ["cherry-jane", "Cherry Jane"]];
type Tab = "faces" | "pictures" | "sounds" | "notes";
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 1.5e6) return file;
  const bmp = await createImageBitmap(file); const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = bmp.width * k; c.height = bmp.height * k; c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b ?? file), "image/jpeg", 0.86));
}
export default function BankClient({ initial, looks: looks0, who: me }: { initial: BankItem[]; looks: Looks; who: string }) {
  const [looks, setLooks] = useState(looks0); const [redo, setRedo] = useState<Record<string, string>>({});
  const [items, setItems] = useState(initial); const [tab, setTab] = useState<Tab>("faces"); const [err, setErr] = useState(""); const [busy, setBusy] = useState<string[]>([]); const [zoom, setZoom] = useState<string | null>(null);
  const live = items.filter(i => !i.archived);
  const refresh = async () => setItems(await (await fetch("/api/bank")).json());
  const work = async (label: string, fn: () => Promise<void>) => { setErr(""); setBusy(b => [...b, label]); try { await fn(); await refresh(); } catch (e) { setErr((e as Error).message); } setBusy(b => b.filter(x => x !== label)); };
  const post = async (url: string, body: object) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
  const upload = (files: Iterable<File | Blob>, names?: string) => { for (const f of files) { const name = names ?? (f as File).name ?? "recording.webm";
    work(`Saving ${name}`, async () => { const data = await shrink(f as File); const type = data.type || "application/octet-stream"; const r = await fetch(`/api/bank/upload?name=${encodeURIComponent(name)}`, { method: "POST", headers: { "content-type": type }, body: data }); const j = await r.json(); if (!r.ok) throw new Error(j.error); }); } };
  const remove = (id: string) => work("Removing", async () => { await post("/api/bank", { op: "remove", id }); });
  const rename = (it: BankItem) => { const t = prompt("Name it", it.title); if (t && t !== it.title) work("Renaming", async () => { await post("/api/bank", { op: "update", id: it.id, title: t }); }); };
  const counts: Record<Tab, number> = { faces: live.filter(i => i.kind === "face").length, pictures: live.filter(i => i.kind === "image").length, sounds: live.filter(i => i.kind === "sound").length, notes: live.filter(i => i.kind === "note").length };
  const gone = items.filter(i => i.archived);
  return (
    <div className="page-body">
      <h1>The Bank</h1>
      <p className="lede">Everything the show can draw from. Pin anything here to a shot, and Luna can see all of it.</p>
      <nav className="banktabs" aria-label="Bank sections">
        {([["faces", "Faces"], ["pictures", "Pictures"], ["sounds", "Sounds"], ["notes", "Notes"]] as [Tab, string][]).map(([t, l]) => <button key={t} className={tab === t ? "on" : ""} aria-pressed={tab === t} onClick={() => setTab(t)}>{l} ({counts[t]})</button>)}
      </nav>
      {err && <p className="err" role="alert">{err}</p>}
      {busy.length > 0 && <p role="status" style={{ color: "var(--gold)" }}>{busy.join(", ")}…</p>}

      {tab === "faces" && CAST.map(([who, name]) => <FaceRange key={who} who={who} name={name} me={me} looks={looks} redo={redo[who]}
        onDrawLook={(description, keepFace) => work(`Drawing a new look for ${name}`, async () => { await post("/api/looks", { op: "draw", who, description, keepFace }); setLooks(await (await fetch("/api/looks")).json()); })}
        onSetLook={(id) => work("Changing her look", async () => { const j = await post("/api/looks", { op: "set", who, id }); setLooks(j.looks); setRedo(r => ({ ...r, [who]: j.redo })); })} items={live.filter(i => i.kind === "face" && i.who === who)} onDraw={x => work(`Drawing ${name}`, async () => { await post("/api/bank/face", { who, expression: x }); })} onZoom={setZoom} onRemove={remove} />)}

      {tab === "pictures" && <>
        <DropBox accept="image/*" label="Add pictures" hint="Drop them here, or choose from your phone or computer." onFiles={f => upload(f)} />
        <div className="grid">{live.filter(i => i.kind === "image").map(i => <div key={i.id} className="item"><img src={i.src} alt={i.title} loading="lazy" onClick={() => setZoom(i.src!)} /><div className="meta"><span>{i.title}</span><small><button className="link" onClick={() => rename(i)}>Rename</button> <button className="link" onClick={() => remove(i.id)}>Remove</button></small></div></div>)}</div>
      </>}

      {tab === "sounds" && <>
        <DropBox accept="audio/*" label="Add sounds" hint="Drop a file here, choose one, or record it wherever you are." onFiles={f => upload(f)} extra={<Recorder onDone={b => upload([b], `Recorded ${new Date().toLocaleString()}.${b.type.includes("mp4") ? "m4a" : "webm"}`)} onError={setErr} />} />
        <AskSound onAsk={(prompt) => work("Making the sound", async () => { await post("/api/bank/sound", { prompt }); })} />
        {live.filter(i => i.kind === "sound").map(i => <div key={i.id} className="soundrow"><span>{i.title}{i.tags?.length ? <small style={{ color: "var(--chalk-dim)", display: "block" }}>{i.tags.join(", ")}</small> : null}</span><audio controls preload="none" src={i.src} aria-label={i.title} /><span style={{ display: "flex", gap: 10 }}><button className="link" onClick={() => rename(i)}>Rename</button><button className="link" onClick={() => remove(i.id)}>Remove</button></span></div>)}
      </>}

      {tab === "notes" && <>
        <NoteBox onSave={(text, ep) => work("Saving the note", async () => { await post("/api/bank", { op: "note", text, ep }); })} />
        {[...live.filter(i => i.kind === "note")].reverse().map(i => <article key={i.id} className="noteitem"><b>{i.title}</b>{i.text !== i.title && i.text}<small>{i.by}{i.ep ? `, Episode ${i.ep}` : ""} <button className="link" onClick={() => remove(i.id)}>Remove</button></small></article>)}
      </>}

      {gone.length > 0 && <details style={{ marginTop: 28 }}><summary style={{ color: "var(--chalk-dim)", cursor: "pointer" }}>Removed ({gone.length})</summary>{gone.map(i => <p key={i.id}>{i.title} <button className="link" onClick={() => work("Restoring", async () => { await post("/api/bank", { op: "restore", id: i.id }); })}>Put it back</button></p>)}</details>}
      <Trouble where="bank" />
      {zoom && <div className="lightbox" role="dialog" aria-label="Picture" onClick={() => setZoom(null)}><img src={zoom} alt="" /></div>}
    </div>
  );
}
function FaceRange({ who, name, items, onDraw, onZoom, onRemove, me, looks, redo, onDrawLook, onSetLook }: { me: string; looks: Looks; redo?: string; onDrawLook: (d: string, k: boolean) => void; onSetLook: (id: string | null) => void; who: string; name: string; items: BankItem[]; onDraw: (x: string) => void; onZoom: (s: string) => void; onRemove: (id: string) => void }) {
  const [x, setX] = useState(""); const [d, setD] = useState(""); const [keep, setKeep] = useState(false);
  const cur = looks.current[who]; const active = cur && looks.looks.find(l => l.id === cur.id); const options = looks.looks.filter(l => l.who === who).slice().reverse();
  return (
    <section className="range" aria-label={`${name}'s range`}>
      <h2><img src={active?.src ?? `/canon/${who}-face.jpg`} alt="" />{name}</h2>
      <div className="herlook">
        <h3>Her look</h3>
        <p className="hint">{active ? `Current look: ${active.description}` : "She has the look you and Joe locked on Oct 26."}</p>
        <form className="adder" onSubmit={e => { e.preventDefault(); if (d.trim()) { onDrawLook(d.trim(), keep); setD(""); } }}>
          <input type="text" aria-label={`How ${name} should look`} placeholder="How should she look? Too thin, harder, more Joan Jett…" value={d} onChange={e => setD(e.target.value)} />
          <label className="keepface"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} /> Keep her face</label>
          <button className="btn main" disabled={!d.trim()}>Draw this look</button>
        </form>
        {redo && <p className="tag-redo" role="status">{redo}</p>}
        {options.length > 0 && <div className="grid">{options.map(l => <div key={l.id} className={`item ${l.id === cur?.id ? "lookon" : ""}`}><img src={l.src} alt={l.description} loading="lazy" onClick={() => onZoom(l.src)} /><div className="meta"><span>{l.description}</span>{l.id === cur?.id ? <small>Her look now</small> : me === "Kim" ? <button className="btn yes" onClick={() => onSetLook(l.id)}>Make this her look</button> : <small>Only Kim can choose it</small>}</div></div>)}</div>}
        {active && me === "Kim" && <p><button className="link" onClick={() => onSetLook(null)}>Go back to the Oct 26 look</button></p>}
      </div>
      <h3>Her faces</h3>
      <form className="adder" onSubmit={e => { e.preventDefault(); if (x.trim()) { onDraw(x.trim()); setX(""); } }}>
        <input type="text" aria-label={`Stage direction for ${name}'s face`} placeholder="Stage direction: what is her face doing?" value={x} onChange={e => setX(e.target.value)} />
        <button className="btn main" disabled={!x.trim()}>Draw this face</button>
      </form>
      {items.length > 0 && <div className="grid">{items.map(i => <div key={i.id} className="item"><img src={i.src} alt={i.title} loading="lazy" onClick={() => onZoom(i.src!)} /><div className="meta"><span>{i.text}</span><small><button className="link" onClick={() => onRemove(i.id)}>Remove</button></small></div></div>)}</div>}
    </section>
  );
}
function DropBox({ accept, label, hint, onFiles, extra }: { accept: string; label: string; hint: string; onFiles: (f: File[]) => void; extra?: React.ReactNode }) {
  const [over, setOver] = useState(false); const input = useRef<HTMLInputElement>(null);
  return (
    <div className={`adder ${over ? "drag" : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}>
      <button className="btn main" onClick={() => input.current?.click()}>{label}</button>{extra}<span style={{ color: "var(--chalk-dim)" }}>{hint}</span>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={e => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
    </div>
  );
}
function Recorder({ onDone, onError }: { onDone: (b: Blob) => void; onError: (m: string) => void }) {
  const [on, setOn] = useState(false); const rec = useRef<MediaRecorder | null>(null); const mic = useRef<MediaStream | null>(null);
  const release = () => { mic.current?.getTracks().forEach(t => t.stop()); mic.current = null; };
  useEffect(() => () => { const r = rec.current; rec.current = null; if (r && r.state !== "inactive") r.stop(); release(); }, []); // leaving the tab always lets go of the mic
  const toggle = async () => {
    if (rec.current) { rec.current.stop(); rec.current = null; setOn(false); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); mic.current = stream; const m = new MediaRecorder(stream); const parts: Blob[] = [];
      m.ondataavailable = e => parts.push(e.data); m.onstop = () => { release(); if (parts.length) onDone(new Blob(parts, { type: m.mimeType.split(";")[0] })); }; m.start(); rec.current = m; setOn(true);
    } catch { release(); onError("The microphone is blocked. Allow it for this site in your browser settings, then record again."); }
  };
  return <button className="btn" aria-pressed={on} onClick={toggle}>{on ? "Stop recording" : "Record a sound"}</button>;
}
function AskSound({ onAsk }: { onAsk: (p: string) => void }) {
  const [p, setP] = useState("");
  return <form className="adder" onSubmit={e => { e.preventDefault(); if (p.trim()) { onAsk(p.trim()); setP(""); } }}><input type="text" aria-label="Describe a sound" placeholder="Or describe one: ice falling into a plastic cup, close" value={p} onChange={e => setP(e.target.value)} /><button className="btn" disabled={!p.trim()}>Make this sound</button></form>;
}
function NoteBox({ onSave }: { onSave: (t: string, ep?: number) => void }) {
  const [t, setT] = useState(""); const [ep, setEp] = useState("");
  return <form className="adder" onSubmit={e => { e.preventDefault(); if (t.trim()) { onSave(t, Number(ep) || undefined); setT(""); } }}><textarea aria-label="Your note" rows={3} placeholder="Stage directions, a rant, an idea for later" value={t} onChange={e => setT(e.target.value)} /><select aria-label="Which episode" value={ep} onChange={e => setEp(e.target.value)}><option value="">Whole show</option>{Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>Episode {i + 1}</option>)}</select><button className="btn main" disabled={!t.trim()}>Save the note</button></form>;
}
