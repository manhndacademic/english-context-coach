"use client";

import { useActionState, useState } from "react";
import { loginAction, registerAction, googleLoginAction, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(loginAction, {});
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
        {state.error ? <p className="text-danger font-semibold text-sm m-0">{state.error}</p> : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
      {googleEnabled ? (
        <form action={googleLoginAction}>
          <Button variant="secondary" className="w-full h-11" type="submit">
             Đăng nhập với Google
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(registerAction, {});
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
        <p className="text-xs text-muted m-0">Mật khẩu phải chứa ít nhất 12 ký tự.</p>
        {state.error ? <p className="text-danger font-semibold text-sm m-0">{state.error}</p> : null}
        <Button className="w-full h-11" disabled={pending} type="submit">
          {pending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
        </Button>
      </form>
    </div>
  );
}
