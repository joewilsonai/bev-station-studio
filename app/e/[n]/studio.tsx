"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, ChatMsg, Line, Shot, Who } from "@/lib/types";
import type { BankItem } from "@/lib/bank";
import type { Looks } from "@/lib/looks";
import { NAMES, PLACES } from "@/lib/types";

type Props = { ep: number; title: string; script: string; who: string; initial: Board; all: { n: number; title: string }[] };
const picOf = (s: Shot) => s.takes.find(t => t.id === s.pick)?.src ?? s.takes[s.takes.length - 1]?.src;
const STATUS: Record<string, string> = { idea: "Idea", drawn: "Drawn", yes: "Kim's yes", filmed: "In the cut" };

export default function Studio({ ep, title, script, who, initial, all }: Props) {
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [sel, setSel] = useState<string | null>(initial.shots.find(s => !s.archived)?.id ?? null);
  const [tab, setTab] = useState<"script" | "board" | "luna">("board");
  const [drawing, setDrawing] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");
  const [playing, setPlaying] = useState(false);
  const [looks, setLooks] = useState<Looks>({ looks: [], current: {} });
  useEffect(() => { fetch("/api/looks").then(r => r.json()).then(setLooks).catch(() => {}); }, []);
  const [bank, setBank] = useState<BankItem[]>([]);
  const loadBank = useCallback(() => { fetch("/api/bank").then(r => r.json()).then(setBank).catch(() => {}); }, []);
  useEffect(loadBank, [loadBank]);
  const live = useMemo(() => board.shots.filter(s => !s.archived), [board]);
  const gone = useMemo(() => board.shots.filter(s => s.archived), [board]);
  const shot = live.find(s => s.id === sel) ?? null;
  const total = live.reduce((a, s) => a + s.seconds, 0);

  const change = useCallback(async (body: object) => {
    setErr("");
    const r = await fetch(`/api/board/${ep}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) { setErr(j.error); return null; } setBoard(j); return j as Board;
  }, [ep]);

  const draw = useCallback(async (id: string, direction?: string) => {
    setErr(""); setDrawing(d => new Set(d).add(id));
    try {
      const r = await fetch("/api/draw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ep, id, direction }) });
      const j = await r.json(); if (!r.ok) setErr(j.error); else setBoard(j);
    } catch { setErr("The drawing did not come back. Check your connection and draw it again."); }
    setDrawing(d => { const n = new Set(d); n.delete(id); return n; });
  }, [ep]);

  // Keep up with what Joe or the other device did, without stepping on typing.
  useEffect(() => { const t = setInterval(async () => {
    if (document.hidden || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") return;
    const r = await fetch(`/api/board/${ep}`); if (r.ok) { const b: Board = await r.json(); setBoard(cur => b.updatedAt > cur.updatedAt ? b : cur); }
  }, 20000); return () => clearInterval(t); }, [ep]);

  const drag = useRef<string | null>(null);
  return (
    <div className="studio" data-tab={tab}>
      <header className="top">
        <Link className="logo-sm" href="/">Bev Station</Link>
        <select aria-label="Episode" value={ep} onChange={e => router.push(`/e/${e.target.value}`)}>
          {all.map(x => <option key={x.n} value={x.n}>{x.n}. {x.title}</option>)}
        </select>
        <span className="grow" />
        <Link href="/bank">Bank</Link><Link href="/recipe">Recipe</Link><Link href="/bible">Bible</Link>
      </header>

      <section className="pane-script" aria-label="Your script">
        <h2>{title}</h2>
        <p className="whose">Your words, exactly as you wrote them. Nothing here changes them.</p>
        <div className="script-text">{script.replace(/\*\*|\*|\\|^#+\s*/gm, "")}</div>
      </section>

      <section className="pane-board" aria-label="Board">
        <div className="rail-wrap">
          <div className="boardbar">
            <b>{live.length} shots</b><small>{Math.floor(total / 60)}:{String(total % 60).padStart(2, "0")}</small>
            <span className="grow" />
            <button className="btn" disabled={!live.length} onClick={() => setPlaying(true)}>Play the board</button>
            <a className="btn" href={`/api/export/${ep}`} style={{ textDecoration: "none" }}>Download for Panel by Panel</a>
          </div>
          <div className="rail-bar" />
          <div className="rail" role="list">
            {live.map((s, i) => (
              <button key={s.id} role="listitem" draggable className={`tick ${s.id === sel ? "sel" : ""}`} aria-label={`Shot ${i + 1}: ${s.desc.slice(0, 60)}`}
                onClick={() => setSel(s.id)}
                onDragStart={() => { drag.current = s.id; }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (drag.current && drag.current !== s.id) change({ op: "move", id: drag.current, to: i }); drag.current = null; }}>
                {picOf(s) ? <img className="pic" src={picOf(s)} alt="" loading="lazy" /> : <span className="blank">{drawing.has(s.id) ? "Drawing…" : (s.desc.slice(0, 44) || "New shot")}</span>}
                <span className="foot">{i + 1}<span className={`dot ${s.status}`} title={STATUS[s.status]} /></span>
              </button>
            ))}
            <button className="tick add" onClick={async () => { const b = await change({ op: "add", shot: { desc: "", seconds: 5, cast: [] } }); const l = b?.shots.filter(x => !x.archived); if (l?.length) setSel(l[l.length - 1].id); }}>Add a shot</button>
          </div>
        </div>
        {err && <p className="err" role="alert" style={{ margin: "10px 16px 0" }}>{err}</p>}
        {!live.length && (
          <div className="empty-board">
            <h3>Nothing on the rail yet</h3>
            <p>Ask Luna to board this episode, or add the first shot yourself.</p>
            <button className="btn main" onClick={() => setTab("luna")}>Open Luna</button>
          </div>
        )}
        {shot && <ShotEditor key={shot.id} shot={shot} index={live.indexOf(shot)} count={live.length} who={who} change={change} draw={draw} drawing={drawing.has(shot.id)} bank={bank} looks={looks} />}
        {gone.length > 0 && (
          <details style={{ padding: "0 16px 40px" }}>
            <summary style={{ color: "var(--chalk-dim)", cursor: "pointer" }}>Off the rail ({gone.length})</summary>
            {gone.map(s => <p key={s.id}>{s.desc.slice(0, 80) || "Empty shot"} <button className="link" onClick={() => change({ op: "restore", id: s.id })}>Put it back</button></p>)}
          </details>
        )}
      </section>

      <Luna ep={ep} title={title} who={who} empty={!live.length} onBoard={b => { setBoard(b); setSel(c => c && b.shots.some(s => s.id === c && !s.archived) ? c : b.shots.find(s => !s.archived)?.id ?? null); }} onDraw={(ids, d) => ids.forEach((id, i) => setTimeout(() => draw(id, d), i * 400))} onBank={loadBank} />

      <nav className="tabs" aria-label="Views">
        {(["script", "board", "luna"] as const).map(t => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "script" ? "Script" : t === "board" ? "Board" : "Luna"}</button>)}
      </nav>
      {playing && <Player bank={bank} shots={live} startAt={Math.max(0, live.findIndex(s => s.id === sel))} close={() => setPlaying(false)} />}
    </div>
  );
}

function ShotEditor({ shot, index, count, who, change, draw, drawing, bank, looks }: { looks: Looks; bank: BankItem[]; shot: Shot; index: number; count: number; who: string; change: (b: object) => Promise<Board | null>; draw: (id: string, d?: string) => void; drawing: boolean }) {
  const [desc, setDesc] = useState(shot.desc); const [camera, setCamera] = useState(shot.camera ?? ""); const [note, setNote] = useState(shot.note ?? "");
  const [direction, setDirection] = useState(""); const [lines, setLines] = useState<Line[]>(shot.lines);
  // A field someone is typing in is theirs: incoming saves only refresh fields that aren't being edited.
  const dirty = useRef<Set<string>>(new Set()); const linesJSON = JSON.stringify(shot.lines);
  useEffect(() => { const d = dirty.current; if (!d.has("desc")) setDesc(shot.desc); if (!d.has("camera")) setCamera(shot.camera ?? ""); if (!d.has("note")) setNote(shot.note ?? ""); if (!d.has("lines")) setLines(JSON.parse(linesJSON)); }, [shot.desc, shot.camera, shot.note, linesJSON]);
  const patch = (p: object) => change({ op: "update", id: shot.id, patch: p });
  const commit = (field: "desc" | "camera" | "note", value: string, was: string) => { dirty.current.delete(field); if (value !== was) patch({ [field]: value }); };
  const pic = picOf(shot);
  const shown = shot.takes.find(t => t.id === shot.pick) ?? shot.takes[shot.takes.length - 1];
  const stale = shown ? shot.cast.filter(c => { const k = looks.current[c]; return k && (shot.status === "filmed" ? k.id !== "locked" : (shown.startedAt ?? shown.at) < k.setAt); }) : [];
  const toggleCast = (c: Who) => patch({ cast: shot.cast.includes(c) ? shot.cast.filter(x => x !== c) : [...shot.cast, c] });
  const saveLines = (l: Line[]) => { dirty.current.delete("lines"); setLines(l); patch({ lines: l }); };
  return (
    <article className="shot" aria-label={`Shot ${index + 1}`}>
      <div>
        <div className="frame">
          {shot.clip ? <video src={shot.clip} controls playsInline poster={pic} /> : pic ? <img src={pic} alt={shot.desc} /> : <p className="wait">No picture yet. Describe the shot, then draw it from the locked faces.</p>}
          {drawing && <div className="drawing">Drawing from the locked faces. This takes a minute or two.</div>}
        </div>
        {shot.takes.length > 1 && <div className="takes" aria-label="Takes">{shot.takes.map((t, i) => <button key={t.id} className={t.id === shot.pick ? "on" : ""} aria-label={`Take ${i + 1}`} title={t.direction || `Take ${i + 1}`} onClick={() => change({ op: "pick", id: shot.id, take: t.id })}><img src={t.src} alt="" loading="lazy" /></button>)}</div>}
        {stale.length > 0 && <p className="tag-redo">Shows {stale.map(c => NAMES[c]).join(" and ")} in her old look. {shot.status === "filmed" ? "This clip needs reshooting on Joe's side." : "Draw it again to update it."}</p>}
        <div className="drawrow">
          <input aria-label="Note for this drawing" placeholder="Note for this take (optional)" value={direction} onChange={e => setDirection(e.target.value)} />
          <button className="btn main" disabled={drawing || !desc.trim()} onClick={() => { draw(shot.id, direction || undefined); setDirection(""); }}>{shot.takes.length ? "Draw another take" : "Draw it"}</button>
          <button className="btn" disabled={drawing || !desc.trim()} onClick={() => { [0, 1, 2].forEach(i => setTimeout(() => draw(shot.id, direction || undefined), i * 300)); setDirection(""); }}>Draw 3 to choose from</button>
        </div>
      </div>
      <div className="fields">
        <label>What we see<textarea value={desc} onChange={e => { dirty.current.add("desc"); setDesc(e.target.value); }} onBlur={() => commit("desc", desc, shot.desc)} /></label>
        <div className="two">
          <label>Camera<input value={camera} onChange={e => { dirty.current.add("camera"); setCamera(e.target.value); }} onBlur={() => commit("camera", camera, shot.camera ?? "")} /></label>
          <label>Where<select value={shot.place ?? ""} onChange={e => patch({ place: e.target.value })}><option value="">Choose</option>{Object.entries(PLACES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Seconds<input type="number" min={1} max={60} defaultValue={shot.seconds} key={shot.seconds} onBlur={e => Number(e.target.value) !== shot.seconds && patch({ seconds: Number(e.target.value) })} /></label>
        </div>
        <div className="castpick" role="group" aria-label="Who is in it">
          {(["pen", "maneater", "cherry-jane"] as Who[]).map(c => <button key={c} aria-pressed={shot.cast.includes(c)} className={shot.cast.includes(c) ? "on" : ""} onClick={() => toggleCast(c)}>{NAMES[c]}</button>)}
        </div>
        <div className="linesbox">
          {lines.map((l, i) => <LineRow key={i} line={l} onChange={n => { dirty.current.add("lines"); const c = [...lines]; c[i] = n; setLines(c); }} onSave={n => { const c = [...lines]; if (n) c[i] = n; saveLines(c); }} onRemove={() => saveLines(lines.filter((_, j) => j !== i))} />)}
          <div><button className="link" onClick={() => { dirty.current.add("lines"); setLines([...lines, { who: shot.cast[0] ?? "pen", kind: "aloud", text: "" }]); }}>Add a line</button></div>
        </div>
        <Pins label="Pictures and faces from the Bank" kinds={["image", "face"]} ids={shot.refs ?? []} bank={bank} onChange={refs => patch({ refs })} />
        <Pins label="Sounds from the Bank" kinds={["sound"]} ids={shot.sounds ?? []} bank={bank} onChange={sounds => patch({ sounds })} />
        <label>Notes<textarea style={{ minHeight: 52 }} value={note} onChange={e => { dirty.current.add("note"); setNote(e.target.value); }} onBlur={() => commit("note", note, shot.note ?? "")} /></label>
        <div className="shot-actions">
          {who === "Kim" && shot.status !== "filmed" && <button className={`btn yes ${shot.status === "yes" ? "on" : ""}`} aria-pressed={shot.status === "yes"} onClick={() => change({ op: "yes", id: shot.id, on: shot.status !== "yes" })}>{shot.status === "yes" ? "Your yes is on this" : "Give it your yes"}</button>}
          {who !== "Kim" && <small style={{ color: "var(--chalk-dim)" }}>{STATUS[shot.status]}</small>}
          {shot.status === "filmed" && who === "Kim" && <small style={{ color: "var(--chalk-dim)" }}>In the cut</small>}
          <button className="btn" disabled={index === 0} onClick={() => change({ op: "move", id: shot.id, to: index - 1 })}>Move earlier</button>
          <button className="btn" disabled={index === count - 1} onClick={() => change({ op: "move", id: shot.id, to: index + 1 })}>Move later</button>
          <button className="link" onClick={() => change({ op: "remove", id: shot.id })}>Take it off the rail</button>
        </div>
      </div>
    </article>
  );
}

function Pins({ label, kinds, ids, bank, onChange }: { label: string; kinds: string[]; ids: string[]; bank: BankItem[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const pool = bank.filter(b => kinds.includes(b.kind) && !b.archived);
  const isSound = kinds.includes("sound");
  return (
    <div className="pins">
      <div className="pins-head"><span>{label}</span><button className="link" onClick={() => setOpen(o => !o)}>{open ? "Done" : "Choose"}</button></div>
      {ids.length > 0 && <div className="pin-row">{ids.map(id => { const it = bank.find(b => b.id === id); if (!it) return null;
        return <span key={id} className="pin">{!isSound && <img src={it.src} alt="" />}<span>{it.title}</span><button className="link" aria-label={`Unpin ${it.title}`} onClick={() => onChange(ids.filter(x => x !== id))}>×</button></span>; })}</div>}
      {open && <div className="pin-pool">{pool.map(it => { const on = ids.includes(it.id);
        return <button key={it.id} aria-pressed={on} className={`pool-item ${on ? "on" : ""}`} onClick={() => { onChange(on ? ids.filter(x => x !== it.id) : [...ids, it.id]); if (isSound && !on) new Audio(it.src).play().catch(() => {}); }}>{!isSound && <img src={it.src} alt="" loading="lazy" />}<span>{it.title}</span></button>; })}
        <Link className="link" href="/bank">Add to the Bank</Link></div>}
    </div>
  );
}

function LineRow({ line, onChange, onSave, onRemove }: { line: Line; onChange: (l: Line) => void; onSave: (n?: Line) => void; onRemove: () => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const hear = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ who: line.who, text: line.text }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setMsg(j.error); return; }
    const a = new Audio(j.src); a.playbackRate = line.who === "pen" ? 0.92 : 1; a.play();
  };
  return (
    <div className="lineitem">
      <select className="who" aria-label="Who says it" value={`${line.who}:${line.kind}`} onChange={e => { const [w, k] = e.target.value.split(":"); onSave({ ...line, who: w as Who, kind: k as Line["kind"] }); }}>
        <option value="pen:aloud">Pen</option><option value="pen:thought">Pen, thought</option><option value="maneater:aloud">Maneater</option><option value="cherry-jane:aloud">Cherry Jane</option><option value="other:aloud">Someone else</option>
      </select>
      <div>
        <textarea aria-label="The line" value={line.text} onChange={e => onChange({ ...line, text: e.target.value })} onBlur={() => onSave()} />
        {line.proposed && line.text.trim() && <span className="tag-prop" title="These exact words are not in your script for this episode">Proposed, not in your script</span>}
        {msg && <p className="err">{msg}</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {line.who !== "other" && <button className="link" disabled={busy || !line.text.trim()} onClick={hear}>{busy ? "…" : "Hear it"}</button>}
        <button className="link" aria-label="Remove this line" onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

function Luna({ ep, title, who, empty, onBoard, onDraw, onBank }: { onBank: () => void; ep: number; title: string; who: string; empty: boolean; onBoard: (b: Board) => void; onDraw: (ids: string[], d?: string) => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [tool, setTool] = useState(""); const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch(`/api/luna/${ep}`).then(r => r.json()).then(setMsgs).catch(() => {}); }, [ep]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, tool]);
  const send = async (t: string) => {
    if (!t.trim() || busy) return;
    setText(""); setBusy(true); setError(""); const at = new Date().toISOString();
    setMsgs(m => [...m, { role: "user", by: who, text: t, at }, { role: "assistant", by: "Luna", text: "", at }]);
    try {
      const r = await fetch(`/api/luna/${ep}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
      const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) { const raw = buf.slice(0, i); buf = buf.slice(i + 1); if (!raw) continue; const e = JSON.parse(raw);
          if (e.text) { setTool(""); setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: c[c.length - 1].text + e.text }; return c; }); }
          if (e.tool) setTool(({ add_shots: "Hanging shots on the rail", update_shot: "Changing a shot", move_shot: "Moving a shot", remove_shot: "Taking a shot down", draw_shots: "Sending shots to be drawn", read_episode: "Reading your script", remember: "Writing that down", pin_to_shot: "Pinning it to the shot", add_note: "Putting a note in the Bank", make_sound: "Making the sound", make_face: "Drawing that face", draw_look: "Drawing a new look", set_recipe: "Updating the Recipe" } as Record<string, string>)[e.tool] ?? "Working");
          if (e.board) onBoard(e.board);
          if (e.draw) onDraw(e.draw, e.direction);
          if (e.bank) onBank();
          if (e.look) fetch("/api/looks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "draw", ...e.look }) }).then(async r => { if (!r.ok) setError((await r.json()).error); }).catch(() => setError("The look did not come back. Ask again."));
          if (e.face) fetch("/api/bank/face", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e.face) }).then(async r => { if (!r.ok) setError((await r.json()).error); onBank(); }).catch(() => setError("The face did not come back. Ask again."));
          if (e.error) setError(e.error);
        } }
    } catch { setError("The connection dropped. Send it again."); }
    setTool(""); setBusy(false);
  };
  const starts = empty ? [`Board ${title} with me, one scene at a time.`, "What is the cold open for this one?", "Read this like a director and tell me what worries you."] : ["What's the weakest shot on this rail?", "Which shots should I look at first?"];
  return (
    <aside className="pane-luna" aria-label="Luna">
      <div className="luna-head"><b>Luna</b><small>on this show, with you</small></div>
      <div className="chat" ref={box} aria-live="polite">
        {!msgs.length && <><p className="msg">{who === "Kim" ? "Kim. " : ""}I&apos;ve read {title}. I can hang shots on the rail, redo them, draw them from the locked faces, and tell you where I think it&apos;s soft. Your words don&apos;t change unless you change them.</p>
          <div className="starts">{starts.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}</div></>}
        {msgs.map((m, i) => m.role === "user"
          ? <div key={i} className="msg me">{m.by !== who && <span className="by">{m.by}</span>}{m.text}</div>
          : <div key={i} className="msg">{m.text.replace(/\*\*/g, "")}</div>)}
        {tool && <p className="tooling" role="status">{tool}…</p>}
        {busy && !tool && msgs[msgs.length - 1]?.text === "" && <p className="tooling" role="status">Reading…</p>}
        {error && <p className="err" role="alert">{error}</p>}
      </div>
      <form className="ask" onSubmit={e => { e.preventDefault(); send(text); }}>
        <textarea aria-label="Talk to Luna" placeholder="Tell me what you see" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 980) { e.preventDefault(); send(text); } }} />
        <button className="btn main" disabled={busy || !text.trim()}>Send</button>
      </form>
    </aside>
  );
}

function Player({ bank, shots, startAt, close }: { bank: BankItem[]; shots: Shot[]; startAt: number; close: () => void }) {
  const [i, setI] = useState(startAt); const [line, setLine] = useState<Line | null>(null); const [paused, setPaused] = useState(false); const [voice, setVoice] = useState(true);
  const s = shots[i]; const token = useRef(0); const audio = useRef<HTMLAudioElement | null>(null); const fx = useRef<HTMLAudioElement[]>([]);
  useEffect(() => {
    if (paused) return;
    const me = ++token.current; const alive = () => token.current === me;
    fx.current = (voice ? s.sounds ?? [] : []).map(id => bank.find(b => b.id === id)?.src).filter(Boolean).map(src => { const a = new Audio(src); a.volume = 0.6; a.play().catch(() => {}); return a; });
    (async () => {
      const started = Date.now();
      for (const l of s.lines) { if (!alive()) return; setLine(l);
        let played = false;
        if (voice && l.who !== "other" && l.text.trim()) { try {
          const r = await fetch("/api/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ who: l.who, text: l.text }) });
          if (r.ok && alive()) { const { src } = await r.json(); await new Promise<void>(res => { const a = new Audio(src); audio.current = a; a.playbackRate = l.who === "pen" ? 0.92 : 1; a.onended = () => res(); a.onerror = () => res(); a.play().then(() => { played = true; }).catch(() => res()); }); }
        } catch { /* captions carry it */ } }
        if (!played && alive()) await new Promise(res => setTimeout(res, Math.max(1400, l.text.split(/\s+/).length * 400)));
      }
      if (!alive()) return; setLine(null);
      const left = s.seconds * 1000 - (Date.now() - started); await new Promise(res => setTimeout(res, Math.max(350, left)));
      if (!alive()) return;
      if (i + 1 < shots.length) setI(i + 1); else close();
    })();
    return () => { token.current++; audio.current?.pause(); fx.current.forEach(a => a.pause()); };
  }, [i, paused, voice, s, shots.length, close, bank]);
  const pic = picOf(s);
  return (
    <div className="player" role="dialog" aria-label="Play the board">
      <div className="screen">
        {pic ? <img src={pic} alt={s.desc} /> : <div style={{ color: "#ccc", padding: 24 }}>{s.desc}</div>}
        {line && <p className={`cap ${line.kind === "thought" ? "thought" : ""}`}>{line.text}</p>}
      </div>
      <div className="bar">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button className="btn" onClick={() => setPaused(p => !p)}>{paused ? "Play" : "Pause"}</button>
        <button className="btn" disabled={i === shots.length - 1} onClick={() => setI(i + 1)}>Next</button>
        <span>{i + 1} of {shots.length}</span>
        <label><input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> Voices</label>
        <button className="btn" onClick={close}>Close</button>
      </div>
    </div>
  );
}
