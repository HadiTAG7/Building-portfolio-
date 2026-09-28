"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useUiStore } from "@/lib/ui-store";
import { LogoMark } from "./Logo";

function LanguageSwitch() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "");
  const qs = search.toString();
  return (
    <Link
      href={`/${other}${rest}${qs ? `?${qs}` : ""}`}
      hrefLang={other}
      className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-[13px] font-bold text-ink hover:border-blue hover:text-cobalt"
    >
      {t.nav.switchLanguage}
    </Link>
  );
}

export function Header({ onTool = true }: { onTool?: boolean }) {
  const { locale, t } = useI18n();
  const openLibrary = useUiStore((s) => s.openLibrary);
  const base = onTool ? "" : `/${locale}`;
  const links = [
    { href: `${base}#builder`, label: t.nav.builder },
    { href: `${base}#results`, label: t.nav.results },
    { href: `${base}#optimizer`, label: t.nav.optimizer },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-md no-print">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 md:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <LogoMark />
          <span className="flex flex-col leading-tight">
            <span className="text-[16px] font-extrabold text-ink">{t.brand.name}</span>
            <span className="hidden text-[11px] text-muted sm:block">{t.brand.sub}</span>
          </span>
        </Link>
        <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label="primary">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[14px] font-bold text-muted hover:bg-sky hover:text-cobalt">
              {l.label}
            </a>
          ))}
          <Link href={`/${locale}/methodology`} className="rounded-full px-3.5 py-2 text-[14px] font-bold text-muted hover:bg-sky hover:text-cobalt">
            {t.nav.methodology}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2 md:ms-2">
          {isFirebaseConfigured && onTool ? (
            <button
              type="button"
              onClick={openLibrary}
              className="hidden h-9 items-center rounded-full bg-sky px-4 text-[13px] font-bold text-cobalt hover:bg-sky-2 sm:inline-flex"
            >
              {t.nav.library}
            </button>
          ) : null}
          <Suspense fallback={null}>
            <LanguageSwitch />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
