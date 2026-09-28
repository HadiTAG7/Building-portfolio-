import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { getFormatters } from "@/lib/format";
import { UNIVERSE } from "@/lib/universe";

export function Hero({ t, locale }: { t: Dictionary; locale: Locale }) {
  const f = getFormatters(locale);
  const { source, assets } = UNIVERSE;
  const facts = [
    { value: f.int(assets.length), label: t.hero.funds },
    { value: f.int(source.tradingDays), label: t.hero.days },
    { value: `${source.firstDate.slice(0, 4)} – ${source.lastDate.slice(0, 4)}`, label: t.hero.period },
    { value: f.date(source.lastDate), label: t.hero.updated },
  ];
  return (
    <section className="relative overflow-hidden bg-hero text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 end-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(14,128,231,0.45),transparent_65%)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-52 start-[-8%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(85,187,149,0.28),transparent_65%)]" />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-14 md:px-6 md:pb-20 md:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12.5px] font-bold text-[#c0f1cb]">
          <span className="h-1.5 w-1.5 rounded-full bg-green" />
          {t.hero.eyebrow}
        </span>
        <h1 className="mt-5 max-w-3xl text-[34px] font-extrabold leading-[1.35] md:text-[50px] md:leading-[1.3]">{t.hero.title}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/75 md:text-[17px]">{t.hero.subtitle}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#builder" className="inline-flex h-12 items-center rounded-full bg-grad-blue px-7 text-[15px] font-bold text-white shadow-lg shadow-blue/30 hover:brightness-110">
            {t.hero.cta}
          </a>
        </div>
        <dl className="mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((x) => (
            <div key={x.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur-sm">
              <dt className="text-[12px] text-white/60">{x.label}</dt>
              <dd className="mt-1 text-[18px] font-extrabold ltr">{x.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
