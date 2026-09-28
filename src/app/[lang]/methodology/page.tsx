import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { getDictionary, isLocale } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/methodology">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).methodology.title };
}

export default async function MethodologyPage({ params }: PageProps<"/[lang]/methodology">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const m = t.methodology;
  return (
    <>
      <Header onTool={false} />
      <main>
        <section className="bg-hero text-white">
          <div className="mx-auto max-w-[1100px] px-4 pb-14 pt-12 md:px-6">
            <Link href={`/${lang}`} className="text-[13px] font-bold text-[#c0f1cb] hover:underline">
              {t.dir === "rtl" ? "→" : "←"} {m.back}
            </Link>
            <h1 className="mt-4 text-[34px] font-extrabold leading-tight md:text-[44px]">{m.title}</h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-8 text-white/75">{m.intro}</p>
          </div>
        </section>
        <div className="relative z-10 mx-auto -mt-6 grid max-w-[1100px] gap-6 px-4 md:px-6">
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-[20px] font-extrabold text-ink">{m.dataTitle}</h2>
            <ul className="mt-4 space-y-2.5 text-[14.5px] leading-7 text-ink-2">
              {m.data.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-[20px] font-extrabold text-ink">{m.formulasTitle}</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full border-collapse text-[14px]">
                <tbody>
                  {m.formulas.map(([name, formula]) => (
                    <tr key={name} className="border-t border-line first:border-t-0">
                      <th scope="row" className="w-[34%] bg-[#f6f8fc] px-4 py-3 text-start align-top font-bold text-ink">
                        {name}
                      </th>
                      <td className="px-4 py-3 leading-7 text-ink-2">{formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-[var(--radius-card)] border border-line bg-mint p-6 sm:p-8">
            <h2 className="text-[20px] font-extrabold text-ink">{m.conventionsTitle}</h2>
            <ul className="mt-4 space-y-2.5 text-[14.5px] leading-7 text-ink-2">
              {m.conventions.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
