"use client";

import { useActionState } from "react";
import { loginAction, registerAction, googleLoginAction, type AuthActionState } from "@/app/(auth)/actions";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(loginAction, {});

  return (
    <div className="auth-card">
      <form action={action} className="stack">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {googleEnabled ? (
        <form action={googleLoginAction}>
          <button className="secondary-button full-width" type="submit">
            Continue with Google
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(registerAction, {});

  return (
    <div className="auth-card">
      <form action={action} className="stack">
        <label>
          Name
          <input name="name" autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={12} required />
        </label>
        <p className="hint">Use at least 12 characters.</p>
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
