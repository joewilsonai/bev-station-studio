import sharp from "sharp";
import { logQuietly } from "./problems";
const REFUSED = /safety|content policy|moderation|prohibited|sensitive/i;
class Refused extends Error {}
const refused = "The drawing service refused this description. Reword it and draw it again.";
// Atlas sits behind Cloudflare, which bans default client signatures.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
type Lane = { model: (task: string) => string; extra: object };
// Everything runs on Atlas. Nothing here is NSFW, so GPT Image 2.5 leads; Seedream 5.0 Pro on the same
// account covers an outage. A refusal stops here: it is never retried on a less filtered model.
const GPT: Lane = { model: t => `openai/gpt-image-2.5-${process.env.GPT_IMAGE_VARIANT ?? "sunburst"}/${t}`, extra: { quality: process.env.GPT_IMAGE_QUALITY ?? "xhigh" } };
const SEEDREAM: Lane = { model: t => `bytedance/seedream-v5.0-pro/${t}`, extra: {} };
async function viaAtlas(lane: Lane, prompt: string, images: string[]): Promise<Buffer> {
  const key = process.env.ATLAS_API_KEY; if (!key) throw new Error("Atlas is not set up");
  const headers = { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": UA, accept: "application/json" };
  const s = await fetch("https://api.atlascloud.ai/api/v1/model/generateImage", { method: "POST", headers,
    body: JSON.stringify({ model: lane.model(images.length ? "edit" : "text-to-image"), prompt, size: "1152x2048", output_format: "jpeg", ...lane.extra, ...(images.length ? { images } : {}) }) });
  const q = await s.json().catch(() => null);
  const id = q?.data?.id;
  if (!s.ok || !id) { const m = JSON.stringify(q ?? s.status).slice(0, 240); if (REFUSED.test(m)) throw new Refused(m); throw new Error(`Atlas: ${m}`); }
  const deadline = Date.now() + 270000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2500));
    const p = await fetch(`https://api.atlascloud.ai/api/v1/model/prediction/${id}`, { headers }).catch(() => null);
    const d = p?.ok ? (await p.json().catch(() => null))?.data : null;
    if (!d) continue;
    const status = String(d.status ?? "").toLowerCase();
    if (status === "completed" || status === "succeeded") {
      const url = d.outputs?.[0]; if (!url) throw new Error("Atlas finished with no picture");
      const pic = await fetch(url, { headers: { "user-agent": UA } });
      if (!pic.ok) throw new Error("Atlas: the picture did not download");
      return Buffer.from(await pic.arrayBuffer());
    }
    if (!["", "queued", "pending", "starting", "processing", "running", "in_progress"].includes(status)) {
      const m = JSON.stringify(d.error ?? d).slice(0, 240); if (REFUSED.test(m)) throw new Refused(m); throw new Error(`Atlas: ${status} ${m}`);
    }
  }
  throw new Error("Atlas: the picture took too long");
}
export async function editImage(prompt: string, images: string[]): Promise<Buffer> {
  let raw: Buffer;
  try { raw = await viaAtlas(GPT, prompt, images); }
  catch (e) {
    if (e instanceof Refused) throw new Error(refused);
    await logQuietly(`Drawing fell back from GPT Image 2.5 to Seedream on Atlas: ${(e as Error).message}`, "draw", "studio");
    try { raw = await viaAtlas(SEEDREAM, prompt, images); }
    catch (e2) { if (e2 instanceof Refused) throw new Error(refused); throw new Error(`The drawing service said: ${(e2 as Error).message}`); }
  }
  return sharp(raw).jpeg({ quality: 85 }).toBuffer();
}
// A new picture with no references: used for a new look, where the old face must not hold it back.
export const generateImage = (prompt: string) => editImage(prompt, []);
export const dataUri = (b: Buffer, type = "image/jpeg") => `data:${type};base64,${b.toString("base64")}`;
// Atlas has no filter of its own, and these looks come from real women. Nothing sexual gets drawn, whoever asks.
const SEXUAL = /\b(nude|naked|nudity|topless|bottomless|undress\w*|lingerie|nipples?|genitals?|vagina|penis|porn\w*|explicit|nsfw|erotic|sex|sexy|sexual\w*|orgasm\w*|masturbat\w*|bare (breasts?|chest|ass|butt))\b/i;
export function assertDrawable(...texts: (string | undefined)[]) {
  if (SEXUAL.test(texts.filter(Boolean).join(" "))) throw new Error("The studio only draws clothed, non-sexual pictures. The joke can live in the words and the faces. Reword it and draw it again.");
}
