import Link from "next/link";
import show from "@/data/show.json";
export default function PageTop() {
  return (
    <header className="page-top">
      <Link className="logo-sm" href="/">{show.title}</Link><span className="grow" />
      <Link href="/bank">Bank</Link><Link href="/recipe">Recipe</Link><Link href="/bible">Bible</Link>
    </header>
  );
}
