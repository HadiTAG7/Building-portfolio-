import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "404",
};

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-hero p-6 text-white">
        <main className="text-center">
          <p className="text-[64px] font-extrabold">404</p>
          <p className="mt-2 text-[16px] text-white/75">الصفحة غير موجودة · Page not found</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/ar" className="rounded-full bg-grad-blue px-6 py-2.5 text-[14px] font-bold">
              العربية
            </Link>
            <Link href="/en" className="rounded-full border border-white/30 px-6 py-2.5 text-[14px] font-bold">
              English
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
