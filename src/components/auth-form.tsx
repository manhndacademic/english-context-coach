"use client";

import { useActionState } from "react";
import { loginAction, registerAction, googleLoginAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(loginAction, {});

  return (
    <div className="p-7 rounded-lg shadow-lg grid gap-4 text-left bg-surface border border-border">
      <form action={action} className="grid gap-5">
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Địa chỉ email
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Mật khẩu
          <Input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state.error ? <p className="text-danger font-semibold text-sm m-0">{state.error}</p> : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
      {googleEnabled ? (
        <form action={googleLoginAction}>
          <Button variant="secondary" className="w-full h-11" type="submit">
             Tiếp tục bằng Google
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(registerAction, {});

  return (
    <div className="p-7 rounded-lg shadow-lg grid gap-4 text-left bg-surface border border-border">
      <form action={action} className="grid gap-5">
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Họ và tên
          <Input name="name" autoComplete="name" />
        </label>
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Địa chỉ email
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Mật khẩu
          <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
        </label>
        <p className="text-xs text-muted m-0">Mật khẩu phải chứa ít nhất 12 ký tự.</p>
        {state.error ? <p className="text-danger font-semibold text-sm m-0">{state.error}</p> : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
      </form>
    </div>
  );
}
