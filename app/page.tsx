import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getBoard } from "@/lib/board";
import { episodes } from "@/lib/episodes";
import { Trouble } from "./connect/parts";
import showData from "@/data/show.json";
const show = showData as unknown as { title: string; cut?: { title: string; text: string; src: string; poster: string }; cast: { id: string; name: string; sample?: string }[] };
import { activeLook, getLooks } from "@/lib/looks";
export const dynamic = "force-dynamic";
export default async function Door() {
  const who = await currentUser(); const looks = await getLooks(); const face = (w: string) => activeLook(looks, w)?.src ?? `/canon/${w}-face.jpg`;
  const rows = await Promise.all(episodes.map(async e => { const live = (await getBoard(e.n)).shots.filter(s => !s.archived); const first = live.find(s => s.pick);
    return { ...e, shots: live.length, drawn: live.filter(s => s.takes.length).length, thumb: first?.takes.find(t => t.id === first.pick)?.src }; }));
  return (
    <main className="door">
      <header className="marquee">
        <h1 className="logo">{show.title}</h1>
        <div>
          <p>Hi {who}. Pick an episode. Your script is on the left, the shots hang on the rail, and I&apos;m on the right. Tell me what you see.</p>
          <nav><Link href="/bank">The Bank</Link><Link href="/recipe">The Recipe</Link><Link href="/bible">The show bible</Link><Link href="/changes">What changed</Link><Link href="/connect">Work from your Claude or ChatGPT</Link></nav>
        </div>
      </header>
      <details className="howto">
        <summary>How this works</summary>
        <ol>
          <li><b>Open an episode.</b> Your script is on one side, and the shots hang on the rail in the middle.</li>
          <li><b>Tell Luna what you see.</b> She&apos;s on the right, or under the Luna tab on your phone. She can board a scene, change shots and draw them.</li>
          <li><b>Press a shot to work on it.</b> Draw it, or draw 3 and pick. Pin faces, pictures and sounds from the <Link href="/bank">Bank</Link>. Press Hear it on any line.</li>
          <li><b>Press Play the board</b> to watch the episode run. When a shot is right, give it your yes.</li>
          <li><b>Stock the <Link href="/bank">Bank</Link> whenever you like.</b> Record a sound at work, add a picture, jot a note, direct a face, change how someone looks. Fill in the <Link href="/recipe">Recipe</Link> when you&apos;re thinking through a scene.</li>
        </ol>
      </details>
      <section className="section rail-row" aria-label="Episodes">
        {rows.map(e => (
          <Link key={e.n} href={`/e/${e.n}`} className="door-card">
            <span className="no">No. {e.n}</span>
            <h3>{e.title}</h3>
            {e.thumb && <img src={e.thumb} alt="" loading="lazy" />}
            <small>{e.shots ? `${e.shots} shot${e.shots > 1 ? "s" : ""}, ${e.drawn} with pictures` : "Not boarded yet"}</small>
          </Link>
        ))}
      </section>
      {show.cut && <section className="door-row-2">
        <video controls preload="none" poster={show.cut.poster} playsInline src={show.cut.src} aria-label={show.cut.title} />
        <div>
          <h2>{show.cut.title}</h2>
          <p>{show.cut.text}</p>
          <div className="cast">
            {show.cast.map(c => <figure key={c.id}><img src={face(c.id)} alt={c.name} /><figcaption>{c.name}</figcaption>{c.sample && <audio controls preload="none" src={c.sample} aria-label={`${c.name}'s voice`} />}</figure>)}
          </div>
        </div>
      </section>}
      <Trouble where="front page" />
    </main>
  );
}
