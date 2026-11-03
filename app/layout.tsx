import type { Metadata, Viewport } from "next";
import { Yellowtail, Jost, Courier_Prime } from "next/font/google";
import "./globals.css";
import show from "@/data/show.json";
const script = Yellowtail({ weight: "400", subsets: ["latin"], variable: "--f-script" });
const sans = Jost({ subsets: ["latin"], variable: "--f-sans" });
const type = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--f-type" });
export const metadata: Metadata = { title: show.title, description: "Where the show gets boarded", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#5a1222" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${script.variable} ${sans.variable} ${type.variable}`}><body>{children}</body></html>;
}
