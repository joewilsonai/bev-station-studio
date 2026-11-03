import { agentDoc } from "@/lib/install";
export const dynamic = "force-dynamic";
// One link Kim can hand any agent: "read this and install yourself."
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const t = (await ctx.params).token;
  if (!t || (t !== process.env.KIM_TOKEN && t !== process.env.JOE_TOKEN)) return new Response("Not found", { status: 404 });
  return new Response(agentDoc(t), { headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "no-store" } });
}
