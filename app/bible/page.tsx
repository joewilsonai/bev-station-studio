import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { readJSON } from "@/lib/store";
import { activeLook, getLooks } from "@/lib/looks";
export const dynamic = "force-dynamic";
const read = (f: string) => fs.readFile(path.join(process.cwd(), "data", f), "utf8").then(s => s.replace(/^---[\s\S]*?---\s*/, "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/`/g, ""));
export default async function Bible() {
  const [setting, pen, man, cj] = await Promise.all(["setting-LOCKED.md", "pen-LOCKED.md", "maneater-LOCKED.md", "cherry-jane-LOCKED.md"].map(read));
  const looks = await getLooks(); const cur = (w: string) => activeLook(looks, w);
  const notes = (await readJSON<{ note: string; by: string; at: string }[]>("notes.json"))?.value ?? [];
  return (
    <main className="bible">
      <p><Link href="/">Back to the episodes</Link></p>
      <h1>The show bible</h1>
      {notes.length > 0 && <><h2>What we&apos;ve agreed in the studio</h2><ul>{notes.map((n, i) => <li key={i}>{n.note}</li>)}</ul></>}
      <h2>The three looks</h2>
      <div className="looks">
        <section><img src={cur("pen")?.src ?? "/canon/pen-reference-LOCKED.jpg"} alt="Pen" />{cur("pen") && <p><b>Kim changed her look:</b> {cur("pen")!.description}</p>}<pre>{pen}</pre></section>
        <section>{cur("maneater") ? <><img src={cur("maneater")!.src} alt="Maneater" /><p><b>Kim changed her look:</b> {cur("maneater")!.description}</p></> : <><img src="/canon/maneater-reference-LOCKED-front.jpg" alt="Maneater, locked reference" /><img src="/canon/maneater-reference-LOCKED-back.jpg" alt="Maneater from behind" style={{ marginTop: 8 }} /></>}<pre>{man}</pre></section>
        <section><img src={cur("cherry-jane")?.src ?? "/canon/cherry-jane-reference-LOCKED.jpg"} alt="Cherry Jane" />{cur("cherry-jane") && <p><b>Kim changed her look:</b> {cur("cherry-jane")!.description}</p>}<pre>{cj}</pre></section>
      </div>
      <h2>The floor</h2>
      <img className="plan" src="/canon/floor-plan.png" alt="Floor plan" />
      <h2>The setting</h2>
      <pre>{setting}</pre>
    </main>
  );
}
