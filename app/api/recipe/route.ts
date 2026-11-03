import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getRecipe, setRecipe } from "@/lib/bank";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ text: await getRecipe() }); }
export async function POST(req: NextRequest) { const by = await currentUser(); const { text } = await req.json(); await setRecipe(String(text), by); return NextResponse.json({ ok: true }); }
