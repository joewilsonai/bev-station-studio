import { addItem, storeFile } from "./bank";
import { reserve, settle } from "./budget";
export async function makeSoundItem(title: string, prompt: string, seconds: number | undefined, by: string) {
  const held = 0.08; await reserve(`sound ${title}`, held, by);
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ text: prompt.slice(0, 450), ...(seconds ? { duration_seconds: Math.max(0.5, Math.min(22, seconds)) } : {}), prompt_influence: 0.5 }) });
    if (!r.ok) throw new Error(`The sound service said: ${(await r.text()).slice(0, 160)}`);
    const src = await storeFile(`${title}.mp3`, Buffer.from(await r.arrayBuffer()), "audio/mpeg");
    return await addItem({ kind: "sound", title, text: prompt, src, tags: ["Made by Luna"], by: "Luna" });
  } catch (e) { await settle("sound", held, 0, by); throw e; }
}
