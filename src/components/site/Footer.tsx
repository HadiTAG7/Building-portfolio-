import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { getFormatters } from "@/lib/format";
import { UNIVERSE } from "@/lib/universe";
import { LogoMark } from "./Logo";

export function Footer({ t, locale }: { t: Dictionary; locale: Locale }) {
  const f = getFormatters(locale);
  return (
    <footer className="mt-20 bg-footer text-white no-print">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr] md:px-6">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[16px] font-extrabold">{t.brand.name}</span>
          </div>
          <p className="mt-4 max-w-2xl text-[13.5px] leading-7 text-white/70">{t.footer.disclaimer}</p>
        </div>
        <div className="flex flex-col gap-3 text-[13px] text-white/70 md:items-end">
          <Link href={`/${locale}/methodology`} className="font-bold text-white hover:text-[#c0f1cb]">
            {t.nav.methodology}
          </Link>
          <p className="md:text-end">{t.footer.source}</p>
          <p>{t.footer.dataThrough(f.date(UNIVERSE.source.lastDate))}</p>
        </div>
      </div>
    </footer>
  );
}
