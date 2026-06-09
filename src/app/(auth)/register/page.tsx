import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div>
          <p className="brand">English Context Coach</p>
          <h1>Create your learner account.</h1>
          <p className="muted">Your lessons and mistake patterns stay tied to your private learning history.</p>
        </div>
        <RegisterForm />
        <p className="centered muted">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
