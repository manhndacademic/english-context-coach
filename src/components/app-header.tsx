import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";

export function AppHeader({ email }: { email?: string | null }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/dashboard">
        English Context Coach
      </Link>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/review">Review</Link>
        <span className="muted">{email}</span>
        <form action={logoutAction}>
          <button className="link-button" type="submit">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
