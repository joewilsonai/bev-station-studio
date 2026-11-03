import Link from "next/link";
export default function PageTop() {
  return (
    <header className="page-top">
      <Link className="logo-sm" href="/">Bev Station</Link><span className="grow" />
      <Link href="/bank">Bank</Link><Link href="/recipe">Recipe</Link><Link href="/bible">Bible</Link>
    </header>
  );
}
