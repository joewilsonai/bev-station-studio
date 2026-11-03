import eps from "@/data/episodes.json";
export type Episode = { n: number; title: string; script: string };
export const episodes = eps as Episode[];
export const episode = (n: number) => episodes.find(e => e.n === n);
