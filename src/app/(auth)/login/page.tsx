import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div>
          <p className="brand">English Context Coach</p>
          <h1>Sign in to continue learning in context.</h1>
          <p className="muted">Practice real workplace, study, and documentation English with Vietnamese feedback.</p>
        </div>
        <LoginForm googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
        <p className="centered muted">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
