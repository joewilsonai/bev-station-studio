import PageTop from "../page-top";
import RecipeClient from "./recipe-client";
import { currentUser } from "@/lib/auth";
import { getRecipe } from "@/lib/bank";
export const dynamic = "force-dynamic";
export default async function Page() {
  await currentUser();
  return <main className="page"><PageTop /><div className="page-body"><h1>The Recipe</h1><p className="lede">The ingredients a scene needs, as a fill-in-the-blank. Change it until it&apos;s how you think. Luna works from whatever is here.</p><RecipeClient initial={await getRecipe()} /></div></main>;
}
