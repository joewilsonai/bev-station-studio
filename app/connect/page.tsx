import { cookies } from "next/headers";
import PageTop from "../page-top";
import { currentUser } from "@/lib/auth";
import { mcpUrl, SITE } from "@/lib/install";
import { Copy, Trouble } from "./parts";
import show from "@/data/show.json";
export const dynamic = "force-dynamic";
export default async function Page() {
  await currentUser(); const t = (await cookies()).get("studio")?.value ?? "local"; const url = mcpUrl(t); const doc = `${SITE}/m/${t}`;
  return <main className="page"><PageTop /><div className="page-body connect">
    <h1>Work from your Claude, ChatGPT or agents</h1>
    <p className="lede">Connect the studio once and they can do what you can do here: board shots, draw them, direct faces, make sounds, fill in the Recipe. They read a manual on how the show works, so you can just tell them what you see.</p>
    <section><h2>Your agents</h2>
      <p>Give any agent this one line. It installs itself, checks that it worked, and reads the manual.</p>
      <Copy text={`Read ${doc} and follow it to connect yourself to my ${show.title} studio. Tell me when it works.`} label="Copy the line for your agent" />
    </section>
    <section><h2>Claude</h2><p className="hint">Set it up once on a computer, at claude.ai.</p>
      <ol className="steps"><li>Open <b>Customize</b>, then <b>Connectors</b>.</li><li>Press <b>Add</b>, then <b>Add custom connector</b>.</li><li>Name it <b>{show.title}</b>, paste your link, and press <b>Continue</b>.</li><li>Leave <b>No sign-in</b> selected and press <b>Add</b>.</li><li>Press <b>Connect</b>. Under Tool permissions, change <b>Needs approval</b> to always allow if you don&apos;t want it asking every time.</li></ol>
      <Copy text={url} label="Copy your link" />
      <p className="hint">To use it: just ask, in any chat. Say &quot;Use {show.title}.&quot;</p>
    </section>
    <section><h2>ChatGPT</h2><p className="hint">Set it up once on a computer, at chatgpt.com.</p>
      <ol className="steps"><li>Open <b>Plugins</b>, press <b>Add</b>, then <b>Add custom MCP server</b>.</li><li>Name it <b>{show.title}</b> and paste your link under Connection.</li><li>Change Authentication to <b>No authentication</b>.</li><li>Tick <b>I understand and want to continue</b>, press <b>Create as a plugin</b>, then <b>Connect Bev Station</b>.</li></ol>
      <Copy text={url} label="Copy your link" />
      <p className="hint">To use it: in a new chat, type <b>@</b> and the name and pick it.</p>
    </section>
    <section><h2>Check that it worked</h2><p>Ask it this. You should get the list of episodes, starting with the first.</p>
      <Copy text={`Use ${show.title}. List the episodes.`} label="Copy the test question" /></section>
    <section><h2>Then try</h2><Copy text={`Use ${show.title}. Read the Recipe and help me fill it in for a scene in an episode, one question at a time. Save it as a note when we're done.`} label="Copy a first job" /></section>
    <p className="hint">Your link is private, like your studio link. Don&apos;t post it anywhere.</p>
    <Trouble where="connect page" />
  </div></main>;
}
