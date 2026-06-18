"use client";

import { useActionState, useState } from "react";
import {
  loginAction,
  registerAction,
  googleLoginAction,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    loginAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="p-7 rounded-lg shadow-lg grid gap-4 text-left bg-surface border border-border">
      <form action={action} className="grid gap-5">
        <label className="grid gap-2 text-left text-sm font-semibold text-text">
          Địa chỉ email
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="grid gap-2 text-left text-sm font-semibold text-text relative">
          Mật khẩu
          <div className="relative w-full">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer flex items-center justify-center p-1 focus:outline-none"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {state.error ? (
          <p className="text-danger font-semibold text-sm m-0">{state.error}</p>
        ) : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
      {googleEnabled ? (
        <>
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-muted text-xs font-bold uppercase">
              Hoặc
            </span>
            <div className="flex-grow border-t border-border"></div>
          </div>
          <form action={googleLoginAction}>
            <Button
              variant="secondary"
              className="w-full h-11 flex items-center justify-center gap-2"
              type="submit"
            >
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Đăng nhập với Google
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

export function RegisterForm({ googleEnabled }: { googleEnabled?: boolean }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(
    registerAction,
    {}
  );
  const [showPassword, setShowPassword] = useState(false);

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
        <label className="grid gap-2 text-left text-sm font-semibold text-text relative">
          Mật khẩu
          <div className="relative w-full">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-pointer flex items-center justify-center p-1 focus:outline-none"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <p className="text-xs text-muted m-0">
          Mật khẩu phải chứa ít nhất 12 ký tự.
        </p>
        {state.error ? (
          <p className="text-danger font-semibold text-sm m-0">{state.error}</p>
        ) : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
      </form>
      {googleEnabled ? (
        <>
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-muted text-xs font-bold uppercase">
              Hoặc
            </span>
            <div className="flex-grow border-t border-border"></div>
          </div>
          <form action={googleLoginAction}>
            <Button
              variant="secondary"
              className="w-full h-11 flex items-center justify-center gap-2"
              type="submit"
            >
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Đăng ký với Google
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
