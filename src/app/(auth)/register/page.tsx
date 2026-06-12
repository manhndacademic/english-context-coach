import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth-form";
import { ChevronLeft } from "lucide-react";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="grid place-items-center min-h-screen bg-background p-6">
      <section className="w-full max-w-[460px] grid gap-[18px] text-center">
        <Link 
          href="/" 
          className="border-0 bg-transparent text-muted text-sm font-semibold p-2 px-3 rounded-sm transition-all hover:text-text inline-flex items-center gap-1 self-start pl-0"
        >
          <ChevronLeft size={16} /> Quay về trang chủ
        </Link>
        <div className="mt-2.5">
          <p className="font-serif text-2xl font-extrabold tracking-tight text-accent text-center m-0">
            English Context Coach
          </p>
          <h1 className="text-2xl font-extrabold font-serif mt-3 mb-1.5 text-text">
            Tạo tài khoản học mới
          </h1>
          <p className="text-muted text-sm leading-relaxed m-0">
            Các bài học cá nhân hóa và lịch sử lỗi sai của bạn sẽ được lưu trữ riêng tư.
          </p>
        </div>
        <RegisterForm />
        <p className="text-center text-muted text-sm mt-2">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
            Đăng nhập ngay
          </Link>
        </p>
      </section>
    </main>
  );
}
